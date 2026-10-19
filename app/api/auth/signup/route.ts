import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { authAccountExistsForEmail } from '@/lib/auth-account-lookup';
import { safeNextPath } from '@/lib/safe-redirect';
import { captureError, captureAndJson, withObservability } from '@/lib/observability';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { findPendingInviteByEmail } from '@/lib/invite-reconciliation';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { sendSignupVerificationEmail, shouldRequireEmailVerification, verificationRedirect } from '@/lib/signup-verification';
import { parseStartDoor, parseStartPricing, startDoorLinkPath } from '@/lib/start-door';
import { lockStartDoorOrUndo } from '@/lib/founding-season';

// Abuse controls: signup is unauthenticated and fires Supabase admin calls + a Resend
// email per attempt; Supabase's built-in auth limits DON'T cover admin-API calls, so this
// route is the unprotected path. No signed-in identity yet → IP tier + a spoofing-proof
// global ceiling (mirrors app/api/league/create). Best-effort, per-Lambda-instance.
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(60 * MINUTE, 6);      // per source IP (spoofable → global backstop)
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 40);  // spoofing-proof ceiling across all callers

// The verification rule is shared by every sign-up (lib/signup-verification.ts, 2026-10-16).

async function rollbackAuthUser(id: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) console.error('Signup rollback auth user error:', error);
}

// Does a Supabase auth user already exist for this email? Used by BOTH signup branches
// to reject signup for an existing (esp. invited/unconfirmed) email — otherwise
// generateLink({type:'signup'}) would overwrite that pending account's password + rotate
// its confirmation token (account-state tampering / DoS on an invited member).
//
// The paginating, fail-CLOSED implementation now lives in lib/auth-account-lookup.ts (shared
// with the coach-registration and assistant-invite "you already have an account" screens) —
// a listUsers error throws to this route's 500 handler rather than reading as "no such user".

/**
 * Two sign-ups arrive here, and both make the auth account and NOTHING else (Account-First Sign-up Part 2, owner
 * A1–A7 2026-10-18; tests/unit/account-first-signup.test.ts holds every signed-out sign-up to it):
 *  - **Run a tournament** (the organization door, `startDoor: 'organization'`): the account remembers its door and the
 *    pricing page's plan, and the email link lands on step 2 (/start/tournament), where the organization, its address,
 *    the owner seat and the Founding Season comp are made on one tap (/api/org/create). Before this the organization was
 *    built here, before anyone opened the email (F01): an abandoned sign-up left a live organization, and an address
 *    typed by someone who did not own it took a club's name and URL.
 *  - **Account only** (no door: fans, the follow nudge, "I was invited"): the person verifies and lands where they were
 *    going.
 * A page loaded before this release still sends an organization name; that is the organization door, and the name is
 * asked again on step 2.
 */
export const POST = withObservability(async (req: Request) => {
  let userId: string | null = null;

  try {
    const { email, password, orgName, firstName, lastName, next, startDoor, plan, billing } = await req.json();

    const organizationDoor = parseStartDoor(startDoor, ['organization'] as const) !== null
      || (orgName !== undefined && orgName !== null);

    // Where the link returns: the organization door's step 2. An account-only (fan) sign-up can pass its own return
    // path — e.g. the Follows feed or the tournament page they were on — else Home (/discover); validated to a
    // same-origin relative path (safeNextPath) so it can never become an open redirect.
    const returnPath = organizationDoor ? startDoorLinkPath('organization') : safeNextPath(next, '/discover');

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPassword = String(password);
    const normalizedFirstName = String(firstName).trim();
    const normalizedLastName = String(lastName).trim();
    const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();

    if (!normalizedEmail || !normalizedFirstName || !normalizedLastName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }
    // A FieldLogicHQ staff email is never a customer account (as the coach sign-up refuses it, 2026-10-16): with verification
    // off, an unclaimed staff address could otherwise be registered by anyone, and platform roles follow the email.
    if (await isPlatformAdminEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'This email address cannot be used to create an account.' }, { status: 403 });
    }

    // Rate-limit only once the request is well-formed, so a typo'd/empty submission doesn't
    // burn an honest user's budget. Most-specific (IP) → global, so a throttled abuser can't
    // spend the shared global allowance for everyone else. Blocks scripted email-send abuse
    // (Resend cost/reputation) + mass unconfirmed-account creation.
    const ip = clientIpFrom(req);
    if (!ipLimiter.take(ip) || !globalLimiter.take('global')) {
      console.warn(`[auth/signup] rate-limited signup attempt ip=${ip}`);
      return NextResponse.json(
        { error: 'Too many sign-up attempts. Please wait a few minutes and try again.' },
        { status: 429 },
      );
    }

    // Stored on the auth user so platform-admin support views (which read
    // user_metadata.display_name / full_name) and the welcome/upsell emails
    // (which greet by first_name) have the person's real name. The organization door adds the
    // remembered door (lib/start-door.ts — screens only, never an entitlement) with the pricing
    // page's plan and billing, so the plan step opens with that plan chosen on any device (A6).
    const pricing = organizationDoor ? parseStartPricing(plan, billing) : null;
    const userMetadata = {
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      full_name: fullName,
      display_name: fullName,
      ...(organizationDoor ? { start: { door: 'organization', ...(pricing ?? {}) } } : {}),
    };
    if (normalizedPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
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

    if (organizationDoor) {
      // ── Sign-up Invite Guard (organization door) ────────────────────────────────
      // Catch an already-invited email BEFORE creating anything, so an invitee who reached
      // Run a tournament by the wrong door is pointed at their invitation (and the invited
      // stub's credentials are never clobbered by generateLink({type:'signup'})).
      // Authoritative server guard — the UI branch is convenience; this holds even if bypassed.
      // Detection is submit-time only: parity with the neutral "account exists" check below,
      // so it adds no pre-auth enumeration oracle. See SIGNUP_INVITE_GUARD_PLAN.md.
      const pendingInvite = await findPendingInviteByEmail(normalizedEmail);
      if (pendingInvite) {
        // Deliberately return ONLY orgName (commonly public — it names the invite copy) and NOT
        // the role: to an unauthenticated caller the role is the escalation-useful disclosure
        // (admin vs staff) and the UX doesn't need it. Minimal-disclosure per /review 2026-07-06.
        return NextResponse.json({ inviteBranch: 'invited', orgName: pendingInvite.orgName });
      }
    }
    // Reject if an account already exists for this email — generateLink({type:'signup'}) on an
    // existing auth user would rotate its credentials. Neutral message (no confirmed-vs-unconfirmed
    // distinction) avoids both account-state tampering on an invited/pending user and email
    // enumeration. Both forms send the person to sign in (the organization door's step 2 follows).
    if (await authAccountExistsForEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'An account already exists for this email. Please sign in instead.' },
        { status: 409 },
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
          redirectTo: verificationRedirect(origin, returnPath),
        },
      });

      if (linkError || !linkData?.user || !linkData.properties?.action_link) {
        // A second submit that raced past the check above: the same neutral answer, never the auth service's own text.
        if (linkError?.status === 422) {
          return NextResponse.json({ error: 'An account already exists for this email. Please sign in instead.' }, { status: 409 });
        }
        const msg = linkError?.message ?? 'Failed to create verification link.';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      userId = linkData.user.id;
      actionLink = linkData.properties.action_link;
    } else {
      // Dev / verification-off: auto-confirm; the client signs in and goes on (step 2, or where it was going).
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: normalizedPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (authError || !authData.user) {
        const msg = authError?.message ?? 'Failed to create user account.';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      userId = authData.user.id;
    }

    // The Founding Season offer after the close reads a locked copy of the door (lib/founding-season.ts, edge (a)
    // 2026-10-19); a failed lock has already undone the account.
    if (organizationDoor && !(await lockStartDoorOrUndo(userId, 'organization'))) {
      userId = null;
      return NextResponse.json({ error: 'Account could not be created. Please try again.' }, { status: 500 });
    }

    if (actionLink) {
      // No name yet (it is asked on step 2), so the email reads "finish creating your account".
      // Note: the founding-season welcome email is NOT sent here — it fires ~1 day after the user
      // actually selects Tournament Plus on the plan step (app/api/billing/create-checkout).
      await sendSignupVerificationEmail({ to: normalizedEmail, origin, actionLink, firstName: normalizedFirstName });
    }

    // `next`: where an instant (verification-off) account-only sign-up goes; the follow nudge reads it.
    return NextResponse.json({
      success: true,
      requiresEmailVerification: requireVerification,
      email: normalizedEmail,
      ...(requireVerification ? {} : { next: returnPath }),
    });
  } catch (err) {
    console.error('Signup route error:', err);
    await captureError(err, { route: '/api/auth/signup', method: 'POST', statusCode: 500 });
    if (userId) {
      await rollbackAuthUser(userId).catch(() => {});
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}, { route: '/api/auth/signup' });
