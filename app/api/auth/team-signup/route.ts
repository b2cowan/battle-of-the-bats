import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { COACHES_START_PATH, normalizeCoachPortalNext } from '@/lib/coaches-portal-routes';
import { captureError, captureAndJson, withObservability } from '@/lib/observability';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { authAccountExistsForEmail } from '@/lib/auth-account-lookup';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { sendSignupVerificationEmail, shouldRequireEmailVerification, verificationRedirect } from '@/lib/signup-verification';
import { parseStartBilling, parseStartDoor, startDoorLinkPath } from '@/lib/start-door';
import { lockStartDoorOrUndo } from '@/lib/founding-season';

// The verification rule is shared by every sign-up (lib/signup-verification.ts, 2026-10-16).

/**
 * Coach Premium's account step (Account-First Sign-up Part 3, owner A1–A7 2026-10-18): the account alone — the team,
 * the sport and the plan are asked on step 2, after the email link. The account remembers its door with the billing
 * picked on the pricing page and, from a claim link, the claim (lib/start-door.ts — screens only), and locks the door for
 * the Founding Season offer after the close (edge (b), 2026-10-19).
 *
 * Throttled as the coach sign-up is (`7bbfbebb`): per source, per address, and a global ceiling.
 */
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(15 * MINUTE, 15);      // per source IP (spoofable → global backstop)
const emailLimiter = new FixedWindowRateLimiter(60 * MINUTE, 5);    // per address being signed up
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 60);   // spoofing-proof ceiling across all callers

async function rollbackAuthUser(id: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) console.error('Coaches Portal signup rollback auth user error:', error);
}

function normalizeNext(value: unknown, fallback: string): string {
  return typeof value === 'string'
    ? normalizeCoachPortalNext(value.slice(0, 240), fallback)
    : fallback;
}

export const POST = withObservability(async (req: Request) => {
  let userId: string | null = null;

  try {
    const { email, password, next, firstName, lastName, startDoor, billing, claim } = await req.json();
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedPassword = String(password ?? '');
    // The account remembers Coach Premium's door with the billing from the pricing page. A claim sign-up remembers no
    // door (/review 2026-10-19): Home's Continue setup and a resend from sign-in would open the blank Premium step, where
    // a new team could be bought and the claim left open — its own link (`next`) and the organizer's claim email are its
    // way back. Its token is never kept on the account either (a secret that grants the team; metadata rides in every
    // session). The door is still LOCKED below for both, so the offer after the close holds for the claim too (edge (b)).
    const premiumDoor = parseStartDoor(startDoor, ['premium'] as const);
    const premiumBilling = parseStartBilling(billing);
    const startRecord = premiumDoor && claim !== true
      ? { door: premiumDoor, ...(premiumBilling && { billing: premiumBilling }) }
      : null;
    const safeNext = normalizeNext(next, premiumDoor ? startDoorLinkPath('premium') : COACHES_START_PATH);
    // Coach's real name (collected at signup so a Basic account isn't nameless). Optional here so a
    // signed-in / claim caller isn't blocked; the signup form enforces it before this call.
    const first = String(firstName ?? '').trim().slice(0, 80);
    const last = String(lastName ?? '').trim().slice(0, 80);
    const fullName = `${first} ${last}`.trim();
    // display_name too, matching the coach-signup route — the platform-admin org-detail member list
    // reads display_name with no fallback, so omitting it would show a blank name there.
    const metadata: Record<string, unknown> = {};
    if (first || last) Object.assign(metadata, { first_name: first, last_name: last, full_name: fullName, display_name: fullName });
    if (startRecord) metadata.start = startRecord;
    const userMetadata = Object.keys(metadata).length > 0 ? metadata : undefined;

    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    if (normalizedPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    // A FieldLogicHQ staff email is never a customer account (as the coach sign-up refuses it, 2026-10-16): with verification
    // off, an unclaimed staff address could otherwise be registered by anyone, and platform roles follow the email.
    if (await isPlatformAdminEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'This email address cannot be used to create an account.' }, { status: 403 });
    }
    // Only a well-formed request spends budget; most specific first, so a throttled caller can't spend the global one.
    const ip = clientIpFrom(req);
    if (!ipLimiter.take(ip) || !emailLimiter.take(normalizedEmail) || !globalLimiter.take('global')) {
      console.warn(`[auth/team-signup] rate-limited sign-up attempt ip=${ip}`);
      return NextResponse.json({ error: 'Too many sign-up attempts. Please wait a few minutes and try again.' }, { status: 429 });
    }
    // An existing account answers "sign in" before anything is made: a sign-up link generated for an existing address
    // would overwrite that account's password and rotate its token (the other sign-ups check the same; found building
    // Part 3, 2026-10-19 — this route had no check).
    if (await authAccountExistsForEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'An account already exists for this email. Please sign in instead.' }, { status: 409 });
    }

    const requireVerification = shouldRequireEmailVerification();
    // Trusted base URL for emailed verification links — see resolveTrustedAppOrigin (only our own
    // hosts are honored from the request Origin; an attacker host falls back to the canonical URL).
    const origin = resolveTrustedAppOrigin(req);

    if (requireVerification && !process.env.RESEND_API_KEY) {
      return captureAndJson(
        new Error('Signup email verification required but RESEND_API_KEY is not configured'),
        { error: 'Email verification is not configured.' },
        500,
      );
    }

    let actionLink: string | null = null;

    if (requireVerification) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: normalizedEmail,
        password: normalizedPassword,
        options: {
          data: userMetadata,
          redirectTo: verificationRedirect(origin, safeNext),
        },
      });

      if (linkError || !linkData?.user || !linkData.properties?.action_link) {
        const message = linkError?.message ?? 'Failed to create verification link.';
        const status = message.toLowerCase().includes('already') ? 409 : 400;
        return NextResponse.json({ error: message }, { status });
      }

      userId = linkData.user.id;
      actionLink = linkData.properties.action_link;
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: normalizedPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (authError || !authData.user) {
        const message = authError?.message ?? 'Failed to create user account.';
        const status = message.toLowerCase().includes('already') ? 409 : 400;
        return NextResponse.json({ error: message }, { status });
      }

      userId = authData.user.id;
    }

    // The Founding Season offer after the close reads a locked copy of the door (lib/founding-season.ts, edge (b)
    // 2026-10-19); a failed lock has already undone the account.
    if (!(await lockStartDoorOrUndo(userId, premiumDoor))) {
      userId = null;
      return NextResponse.json({ error: 'Account could not be created. Please try again.' }, { status: 500 });
    }

    if (requireVerification) {
      if (!actionLink) {
        if (userId) await rollbackAuthUser(userId);
        return captureAndJson(
          new Error('generateLink returned no action_link for signup verification'),
          { error: 'Failed to generate verification email.' },
          500,
        );
      }

      await sendSignupVerificationEmail({ to: normalizedEmail, origin, actionLink, continueName: 'your Coaches Portal' });

      return NextResponse.json({
        success: true,
        requiresEmailVerification: true,
        email: normalizedEmail,
      });
    }

    return NextResponse.json({ success: true, requiresEmailVerification: false, email: normalizedEmail });
  } catch (err) {
    console.error('Coaches Portal signup route error:', err);
    await captureError(err, { route: '/api/auth/team-signup', method: 'POST', statusCode: 500 });
    if (userId) {
      await rollbackAuthUser(userId).catch(() => {});
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}, { route: '/api/auth/team-signup' });
