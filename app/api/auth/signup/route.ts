import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createOrganization, createOrganizationMember, generateUniqueOrgSlug } from '@/lib/db';
import { sendEmail, signupVerificationHtml } from '@/lib/email';
import { captureError, withObservability } from '@/lib/observability';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { findPendingInviteByEmail } from '@/lib/invite-reconciliation';

// Abuse controls: signup is unauthenticated and fires Supabase admin calls + a Resend
// email per attempt; Supabase's built-in auth limits DON'T cover admin-API calls, so this
// route is the unprotected path. No signed-in identity yet → IP tier + a spoofing-proof
// global ceiling (mirrors app/api/league/create). Best-effort, per-Lambda-instance.
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(60 * MINUTE, 6);      // per source IP (spoofable → global backstop)
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 40);  // spoofing-proof ceiling across all callers

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shouldRequireEmailVerification() {
  const explicit = process.env.REQUIRE_SIGNUP_EMAIL_VERIFICATION;
  if (explicit !== undefined) return explicit === 'true';
  return process.env.NODE_ENV === 'production';
}

async function isSlugAvailable(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return !data;
}

async function rollbackOrganization(id: string) {
  const { error } = await supabaseAdmin.from('organizations').delete().eq('id', id);
  if (error) console.error('Signup rollback organization error:', error);
}

async function rollbackAuthUser(id: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) console.error('Signup rollback auth user error:', error);
}

// Does a Supabase auth user already exist for this email? Used by the account-only branch
// to reject signup for an existing (esp. invited/unconfirmed) email — otherwise
// generateLink({type:'signup'}) would overwrite that pending account's password + rotate
// its confirmation token (account-state tampering / DoS on an invited member). The owner
// path relies on createOrganization/createUser erroring on collision; account-only has no
// such downstream guard, so it checks up front. (listUsers cap mirrors invite/route.ts.)
async function authUserExistsForEmail(email: string): Promise<boolean> {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  return Boolean(data?.users.some(u => u.email?.toLowerCase() === email));
}

export const POST = withObservability(async (req: Request) => {
  let userId: string | null = null;
  let orgId: string | null = null;

  try {
    const { email, password, orgName, orgSlug, firstName, lastName } = await req.json();

    // Account-only mode (signup/org decoupling): when the orgName KEY is omitted entirely,
    // this creates the auth user WITHOUT an org or membership. The decoupled invited-user
    // branch uses this — they verify, land on /home, and accept their pending invite there
    // (reconciliation + PendingInvitationsCard). The owner path passes an orgName and gets
    // an org created in one shot, exactly as before (no regression).
    //
    // Distinguish "key omitted" (intentional account-only) from "key present but blank"
    // (owner intent, malformed) — the latter is a validation error, NOT a silent downgrade
    // to account-only (which would hand an org-intending caller an orgless account).
    const orgNameProvided = orgName !== undefined && orgName !== null;
    const accountOnly = !orgNameProvided;
    if (orgNameProvided && !(typeof orgName === 'string' && orgName.trim())) {
      return NextResponse.json({ error: 'Enter an organization name.' }, { status: 400 });
    }

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPassword = String(password);
    const normalizedOrgName = accountOnly ? '' : String(orgName).trim();
    const normalizedFirstName = String(firstName).trim();
    const normalizedLastName = String(lastName).trim();
    const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();

    if (!normalizedEmail || !normalizedFirstName || !normalizedLastName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
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
    // (which greet by first_name) have the person's real name.
    const userMetadata = {
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      full_name: fullName,
      display_name: fullName,
    };
    if (normalizedPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const requireVerification = shouldRequireEmailVerification();
    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'https://www.fieldlogichq.ca';

    if (requireVerification && !process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email verification is not configured.' }, { status: 500 });
    }

    // ── Account-only branch (signup/org decoupling) ──────────────────────────────
    // No org is created. The user verifies (or is auto-confirmed in dev) and lands on
    // /home, which reconciles any pending invite addressed to their email and shows the
    // PendingInvitationsCard. This REPLACES the minimal Phase 3 interstitial: the
    // invite-vs-create-your-own choice now happens naturally at /home, so signup no
    // longer needs a pending-invite pre-check (which also removes that lookup entirely).
    if (accountOnly) {
      // Reject if an account already exists for this email. Neutral message (no
      // confirmed-vs-unconfirmed distinction) avoids both account-state tampering on an
      // invited/pending user and email enumeration. An existing user who was invited
      // should sign in (login → reconciliation + pending-invite card), not re-sign-up.
      if (await authUserExistsForEmail(normalizedEmail)) {
        return NextResponse.json(
          { error: 'An account already exists for this email. Please sign in instead.' },
          { status: 409 },
        );
      }

      if (requireVerification) {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'signup',
          email: normalizedEmail,
          password: normalizedPassword,
          options: {
            data: userMetadata,
            redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/home')}`,
          },
        });

        if (linkError || !linkData?.user || !linkData.properties?.action_link) {
          const msg = linkError?.message ?? 'Failed to create verification link.';
          return NextResponse.json({ error: msg }, { status: 400 });
        }

        userId = linkData.user.id;

        const verifyUrl = `${origin}/auth/signup-confirm?link=${encodeURIComponent(linkData.properties.action_link)}`;
        await sendEmail(
          normalizedEmail,
          'Verify your FieldLogicHQ email',
          // No orgName — account-only verification uses neutral copy.
          signupVerificationHtml({ verifyUrl, firstName: normalizedFirstName }),
        );

        return NextResponse.json({
          success: true,
          requiresEmailVerification: true,
          email: normalizedEmail,
          accountOnly: true,
        });
      }

      // Dev / verification-off: auto-confirm and let the client land on /home.
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
      return NextResponse.json({ success: true, requiresEmailVerification: false, accountOnly: true });
    }

    // ── Sign-up Invite Guard (owner branch) ───────────────────────────────────────
    // Catch an already-invited / already-registered email BEFORE creating anything, so an
    // invitee who reached the owner sign-up by the wrong door is NOT walked into a stray org
    // (and the invited stub's credentials are never clobbered by generateLink({type:'signup'})).
    // Authoritative server guard — the UI branch is convenience; this holds even if bypassed.
    // Detection is submit-time only: parity with the account-only branch's neutral "account
    // exists" check, so it adds no pre-auth enumeration oracle. See SIGNUP_INVITE_GUARD_PLAN.md.
    const pendingInvite = await findPendingInviteByEmail(normalizedEmail);
    if (pendingInvite) {
      // Client renders the "You've been invited to {org}" branch + "Email me my link".
      // Deliberately return ONLY orgName (commonly public — it names the invite copy) and NOT
      // the role: to an unauthenticated caller the role is the escalation-useful disclosure
      // (admin vs staff) and the UX doesn't need it. Minimal-disclosure per /review 2026-07-06.
      return NextResponse.json({
        inviteBranch: 'invited',
        orgName: pendingInvite.orgName,
      });
    }
    // Existing account (no pending invite): never proceed — generateLink({type:'signup'}) on an
    // existing auth user rotates its credentials. Mirror the account-only branch's neutral guard.
    if (await authUserExistsForEmail(normalizedEmail)) {
      return NextResponse.json({ inviteBranch: 'account_exists' });
    }

    // ── Owner branch (org created with the account, unchanged) ────────────────────
    // The public URL is no longer collected at signup — auto-generate a unique slug from
    // the org name (the user refines it later in settings). A caller MAY still pass an
    // explicit orgSlug (e.g. a future custom flow); honor + validate it when present.
    let slug: string;
    if (typeof orgSlug === 'string' && orgSlug.trim()) {
      slug = slugify(orgSlug);
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return NextResponse.json({ error: 'Public URL must contain lowercase letters, numbers, and hyphens.' }, { status: 400 });
      }
      if (!(await isSlugAvailable(slug))) {
        return NextResponse.json({ error: 'That public URL is already taken. Try a different one.' }, { status: 409 });
      }
    } else {
      slug = await generateUniqueOrgSlug(normalizedOrgName);
    }

    let actionLink: string | null = null;

    if (requireVerification) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: normalizedEmail,
        password: normalizedPassword,
        options: {
          data: userMetadata,
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/${slug}/admin/onboarding?choosePlan=1`)}`,
        },
      });

      if (linkError || !linkData?.user || !linkData.properties?.action_link) {
        const msg = linkError?.message ?? 'Failed to create verification link.';
        return NextResponse.json({ error: msg }, { status: 400 });
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
        const msg = authError?.message ?? 'Failed to create user account.';
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      userId = authData.user.id;
    }

    // Create the organization
    const org = await createOrganization(normalizedOrgName, slug, 'tournament');
    if (!org) {
      // Roll back auth user on failure
      if (userId) await rollbackAuthUser(userId);
      return NextResponse.json({ error: 'Failed to create organization. The name or URL may already be taken.' }, { status: 400 });
    }
    orgId = org.id;

    // Link user as owner
    const member = await createOrganizationMember(org.id, userId, 'owner');
    if (!member) {
      await rollbackOrganization(org.id);
      await rollbackAuthUser(userId);
      return NextResponse.json({ error: 'Failed to link user to organization.' }, { status: 500 });
    }

    // Founding Season: auto-assign comp_period override
    // Tournament Plus is free through December 31, 2026 for all founding organizations.
    // This is non-fatal — org creation continues even if this insert fails.
    const FOUNDING_SEASON_EXPIRES_AT = '2027-01-01T00:00:00.000Z';
    if (new Date() < new Date(FOUNDING_SEASON_EXPIRES_AT)) {
      const { error: compErr } = await supabaseAdmin.from('org_overrides').insert({
        org_id: org.id,
        type: 'comp_period',
        value: null,
        expires_at: FOUNDING_SEASON_EXPIRES_AT,
        reason: 'Founding Season — Tournament Plus free through December 31, 2026',
        created_by: 'system',
      });
      if (compErr) {
        console.error('[signup] Founding season comp_period insert error:', compErr);
      }
    }

    // Note: the founding-season welcome email is NOT sent here. The org is created
    // on the free `tournament` plan and the user has not verified their email or
    // chosen a plan yet — sending "you have Tournament Plus" at this point is
    // premature. The welcome email now fires ~1 day after the user actually selects
    // Tournament Plus on the plan-select screen (see app/api/billing/create-checkout),
    // and a free-tier upsell fires ~1 week after choosing the free plan (see
    // app/api/admin/org/onboarding-plan). Only the verification email goes out now.

    if (requireVerification) {
      if (!actionLink) {
        await rollbackOrganization(org.id);
        await rollbackAuthUser(userId);
        return NextResponse.json({ error: 'Failed to generate verification email.' }, { status: 500 });
      }

      const verifyUrl = `${origin}/auth/signup-confirm?link=${encodeURIComponent(actionLink)}`;
      await sendEmail(
        normalizedEmail,
        'Verify your FieldLogicHQ email',
        signupVerificationHtml({ orgName: normalizedOrgName, verifyUrl, firstName: normalizedFirstName })
      );

      return NextResponse.json({
        success: true,
        requiresEmailVerification: true,
        email: normalizedEmail,
        orgSlug: org.slug,
      });
    }

    return NextResponse.json({ success: true, orgSlug: org.slug, requiresEmailVerification: false });
  } catch (err) {
    console.error('Signup route error:', err);
    void captureError(err, { route: '/api/auth/signup', method: 'POST', statusCode: 500 });
    if (orgId) {
      await rollbackOrganization(orgId).catch(() => {});
    }
    if (userId) {
      await rollbackAuthUser(userId).catch(() => {});
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}, { route: '/api/auth/signup' });
