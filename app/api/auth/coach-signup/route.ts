import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { withObservability, captureError, captureAndJson } from '@/lib/observability';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { authAccountExistsForEmail } from '@/lib/auth-account-lookup';
import { getAssistantInviteByToken } from '@/lib/assistant-invites';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import {
  sendSignupVerificationEmail, shouldRequireEmailVerification, verificationRedirect, verificationReturnPath,
} from '@/lib/signup-verification';
import { parseStartDoor } from '@/lib/start-door';
import { lockStartDoorOrUndo } from '@/lib/founding-season';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * The coach sign-up — start a team, start a league, the coach join page, tournament registration and the
 * assistant-invite page all create their account here.
 *
 * VERIFY EVERY SIGN-UP (owner 2026-10-16; lib/signup-verification.ts). Until then it confirmed any address at once,
 * so an account made for someone else's email collected the invitations and team claims later sent to it. Now, when
 * verification is on, the account is created unconfirmed and the person confirms by the emailed link, which signs
 * them in and returns them to `next` (the caller's own screen, to finish). The one exception is a request that
 * already proves the inbox: a live assistant invitation whose invited email is this one (`inviteToken`) — that link
 * was emailed to the address, so the account is ready at once, as before.
 *
 * Throttled (interim from 2026-10-16, kept): looser per source than the org sign-up — every new coach registering for
 * a tournament comes through here, often several from one venue's Wi-Fi — plus a per-address ceiling and a global one.
 */
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(15 * MINUTE, 15);      // per source IP (spoofable → global backstop); a short
                                                                    // window, so a venue's shared Wi-Fi recovers in minutes
const emailLimiter = new FixedWindowRateLimiter(60 * MINUTE, 5);    // per address being signed up
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 60);   // spoofing-proof ceiling across all callers

/** Does this request already prove the inbox? A live assistant invitation addressed to this email. */
async function inviteProvesEmail(inviteToken: unknown, email: string): Promise<boolean> {
  if (typeof inviteToken !== 'string' || !inviteToken) return false;
  const invite = await getAssistantInviteByToken(inviteToken);
  return !!invite && invite.status === 'pending' && !invite.expired && invite.invitedEmail.trim().toLowerCase() === email;
}

export const POST = withObservability(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({})) as {
    email?: unknown;
    password?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    next?: unknown;
    continueName?: unknown;
    inviteToken?: unknown;
    startDoor?: unknown;
  };

  const email     = typeof body.email     === 'string' ? body.email.trim().toLowerCase() : '';
  const password  = typeof body.password  === 'string' ? body.password : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName  = typeof body.lastName  === 'string' ? body.lastName.trim()  : '';
  const continueName = typeof body.continueName === 'string' ? body.continueName.trim().slice(0, 120) : '';
  // Account-first (owner A3, 2026-10-18): Start a team / Start a league send only the account and name their door. The
  // account remembers it (lib/start-door.ts — screens only, never an entitlement), and the link lands on its step 2.
  const startDoor = parseStartDoor(body.startDoor, ['team', 'league'] as const);

  if (!email || !password) {
    return json({ error: 'Email and password are required.' }, 400);
  }
  if (!firstName || !lastName) {
    return json({ error: 'Enter your first and last name.' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, 400);
  }
  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }
  // Only a well-formed request spends budget; most specific first, so a throttled caller can't spend the global one.
  const ip = clientIpFrom(req);
  if (!ipLimiter.take(ip) || !emailLimiter.take(email) || !globalLimiter.take('global')) {
    console.warn(`[auth/coach-signup] rate-limited sign-up attempt ip=${ip}`);
    return json({ error: 'Too many sign-up attempts. Please wait a few minutes and try again.' }, 429);
  }
  // FieldLogicHQ staff are NOT coaches — block before createUser so a public form can't
  // create an orphaned coach account on a staff email (also guards /coaches/join + /start/team).
  if (await isPlatformAdminEmail(email)) {
    return json({ error: 'This email address cannot be used to register a team.' }, 403);
  }

  // Name parity with org signup: store the same four fields on the auth user so
  // platform-admin support views (which read display_name / full_name) and the
  // email greetings (which greet by first_name) have the coach's real name. Without
  // this a coach account had blank user_metadata while an org owner did not.
  const fullName = `${firstName} ${lastName}`.trim();
  const userMetadata = {
    first_name: firstName, last_name: lastName, full_name: fullName, display_name: fullName,
    ...(startDoor ? { start: { door: startDoor } } : {}),
  };

  // ── Verify by link (production): the account waits, unconfirmed, until the person opens the email ──
  if (shouldRequireEmailVerification() && !(await inviteProvesEmail(body.inviteToken, email))) {
    if (!process.env.RESEND_API_KEY) {
      return captureAndJson(new Error('Coach sign-up verification required but RESEND_API_KEY is not configured'),
        { error: 'Email verification is not configured.' }, 500);
    }
    // An existing account answers as it always has (the callers send the person to sign in). Checked FIRST: a signup
    // link generated for an existing address would overwrite that account's password and rotate its token.
    if (await authAccountExistsForEmail(email)) return json({ error: 'email_exists' }, 409);

    const origin = resolveTrustedAppOrigin(req);
    const next = verificationReturnPath(body.next, '/coaches', startDoor);
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: { data: userMetadata, redirectTo: verificationRedirect(origin, next) },
    });
    if (linkError || !linkData?.properties?.action_link) {
      if (linkError?.status === 422) return json({ error: 'email_exists' }, 409);
      await captureError(linkError ?? new Error('generateLink returned no action link'), {
        statusCode: 500,
        user: { email },
        requestContext: { operation: 'supabaseAdmin.auth.admin.generateLink(signup)', supabaseStatus: linkError?.status ?? null },
      });
      return json({ error: 'Account could not be created. Please try again.' }, 500);
    }
    // The league door's Founding Season offer after the close reads a locked copy of the door (edge (a), 2026-10-19).
    if (linkData.user && !(await lockStartDoorOrUndo(linkData.user.id, startDoor))) {
      return json({ error: 'Account could not be created. Please try again.' }, 500);
    }
    await sendSignupVerificationEmail({
      to: email, origin, actionLink: linkData.properties.action_link, firstName, continueName: continueName || null,
    });
    return json({ ok: true, requiresEmailVerification: true, email });
  }

  // ── Instant: verification off (dev), or a live invitation already proved the inbox ──
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (error) {
    // Supabase returns "User already registered" for duplicate emails
    if (
      error.message?.toLowerCase().includes('already registered') ||
      error.message?.toLowerCase().includes('already exists') ||
      error.status === 422
    ) {
      return json({ error: 'email_exists' }, 409);
    }
    // Pipe the REAL failure into the existing observability pipeline (same path org signup /
    // org create already use) so the platform-admin issue AND the production alert email carry
    // the actual cause — e.g. an auth signing-key error — instead of a generic "HTTP 500". Signup
    // is on the critical-route allowlist, so this escalates to a critical alert on first occurrence.
    // captureError never throws and, by marking the request captured, replaces withObservability's
    // generic returned-5xx fallback with this rich attribution (no double-count).
    await captureError(error, {
      statusCode: 500,
      user: { email },
      requestContext: {
        operation: 'supabaseAdmin.auth.admin.createUser',
        supabaseStatus: error.status ?? null,
        supabaseCode: (error as { code?: string }).code ?? null,
      },
    });
    return json({ error: 'Account could not be created. Please try again.' }, 500);
  }

  if (created.user && !(await lockStartDoorOrUndo(created.user.id, startDoor))) {
    return json({ error: 'Account could not be created. Please try again.' }, 500);
  }
  return json({ ok: true, requiresEmailVerification: false });
}, { route: '/api/auth/coach-signup' });
