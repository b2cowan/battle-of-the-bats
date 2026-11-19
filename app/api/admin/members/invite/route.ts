import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { countsAsSeat, seatRowsFilter } from '@/lib/roles';
import { checkCrossOrgJoin, crossOrgJoinRefusalForAdmin } from '@/lib/org-membership-policy';
import { isAssignableRole } from '@/lib/board-roles';
import { memberOpensSentence, roleEmailLabel } from '@/lib/member-access';
import { memberDisplayName } from '@/lib/member-names';
import { acceptInvitePath, sendExistingAccountInvite } from '@/lib/invite-links';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { isPlatformAdminEmailStrict } from '@/lib/platform-auth';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { sendEmail, orgInviteHtml } from '@/lib/email';
import { parseVolunteerJob, volunteerCapabilitiesFor, type VolunteerJob } from '@/lib/volunteer-jobs';
import { INVITE_EMAIL_ACTION, VOLUNTEER_EMAIL_NOTE } from '@/lib/volunteer-words';
import type { OrgRole } from '@/lib/types';
import { withObservability, captureAndJson } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';
import { requireFreshCode } from '@/lib/two-step-fresh';
import { findAuthUserByEmail } from '@/lib/auth-account-lookup';
import { invitationHasLapsed } from '@/lib/invitation-lapse';

function getActionLink(data: unknown) {
  return (data as { properties?: { action_link?: string | null } }).properties?.action_link ?? null;
}

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const { user, org } = ctx;

  const denied = await requireCapability(ctx, 'manage_members');
  if (denied) return denied;

  const body = await req.json();
  const email: string = String(body.email ?? '').trim().toLowerCase();
  // A02 / A13: the role must be one this organization can hand out (lib/board-roles.ts — the same
  // list the dropdown reads). An unrecognised role used to become 'staff' without a word.
  if (!(await isAssignableRole({ ...org, id: org.id }, body.role))) {
    return NextResponse.json(
      { error: 'That role can’t be given in this organization.', code: 'role_not_assignable' },
      { status: 400 },
    );
  }
  const role: OrgRole = body.role;
  // "Helping with" (Stage 6, A26, ruled 2026-10-07): a volunteer's job is what they can DO — written
  // onto the new row as the per-member override (subtractive only: the gate → no scores, scoring → no
  // gate, both → the role's defaults), so every landing and both shells follow it. It used to route
  // the email's link only (J1-077) and was stored nowhere, so a gate volunteer landed on the
  // scorekeeper at every later sign-in (F62). Ignored for every other role.
  const job: VolunteerJob | null = role === 'official' ? parseVolunteerJob(body.purpose) : null;
  const capabilities = job ? volunteerCapabilitiesFor(job) : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // ⚖ Two kinds of address a club can never invite (Board Ready trust close-out 13, 2026-11-18). A "See it live" demo's
  // shared account: every anonymous visitor signs in as it, so a club that invited it would be opening itself to the
  // public. And FieldLogicHQ support: sign-up, team creation and the registration import already turn a staff address
  // away, and a staff account holding a club seat is refused support work on that club (lib/staff-own-club.ts).
  // ONE neutral answer for both (/review): two distinct refusals would let any club admin test an address for "is this
  // FieldLogicHQ support?".
  // ⚖ Leftover call 13 (owner 2026-11-19): when the staff read can't answer, refuse with "try again" rather than let the
  // address through; the strict read fails the same way for every address (a demo one too), so the refusal says nothing
  // about it.
  const staff = await isPlatformAdminEmailStrict(email);
  if (staff === null) {
    return NextResponse.json({ error: 'We couldn’t check that address just now. Try again.', code: 'address_check_failed' }, { status: 503 });
  }
  if (staff || isDemoOrganizerEmail(email)) {
    return NextResponse.json({ error: 'That address can’t be invited to a club.', code: 'address_not_invitable' }, { status: 403 });
  }

  const planCfg = PLAN_CONFIG[org.planId];

  // A role that is not a seat (a free official; coaching staff) never trips the guard.
  const skipSeatCheck = !countsAsSeat(role, planCfg);

  if (!skipSeatCheck) {
    // Count only the memberships that are seats — one rule, shared with the count read and the
    // Members page (owner ruling 2026-09-13: coaching staff don't count; a coach's waiting board role does, P2b).
    const { count: seatCount } = await supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .or(seatRowsFilter(planCfg));
    const seatLimit = planCfg.seatLimit;

    if ((seatCount ?? 0) >= seatLimit) {
      return NextResponse.json(
        { error: `Seat limit reached (${seatLimit} seat${seatLimit === 1 ? '' : 's'} on the ${planCfg.label} plan). Upgrade to add more members.`, code: 'seat_limit_reached' },
        { status: 403 }
      );
    }
  }

  // Adding an admin is one of the actions that ask for a code (Board Ready two-step, Part 2): after the checks above,
  // before anything is written or sent. (No club can hand out "owner"; only support's ownership transfer can.)
  if (role === 'admin') {
    const stale = await requireFreshCode();
    if (stale) return stale;
  }

  // Check if a Supabase auth user already exists with this email. supabase-js v2 has no getUserByEmail, so this is the
  // platform's paged scan (lib/auth-account-lookup.ts): it reads every page (the single first page of 1,000 missed an
  // existing account past that, which then got a second invitation instead of the add) and it THROWS on a read error rather
  // than reading it as "no such account" (Board Ready W2 fix E, sweep 3).
  let existingUser: Awaited<ReturnType<typeof findAuthUserByEmail>>;
  try {
    existingUser = await findAuthUserByEmail(email);
  } catch (err) {
    return captureAndJson(err, { error: 'We couldn’t check whether that person already has an account. Try again.' }, 500);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const roleLabel = roleEmailLabel(role);
  // What the role opens — the accept page's own sentence, in both emails (Stage 13b B2).
  const opens = memberOpensSentence(role, capabilities);

  if (existingUser) {
    // Check they're not already in THIS org
    const { data: sameMember } = await supabaseAdmin
      .from('organization_members')
      .select('id, role, status, pending_role, invited_at, pending_invited_at')
      .eq('organization_id', org.id)
      .eq('user_id', existingUser.id)
      .maybeSingle();

    // A pending row of either kind waits for the PERSON's yes (trust close-out 13): a second invitation never stands in for
    // it — a pending coaching row would otherwise fall to the coach-row branch below. A coach's waiting board role (P2b)
    // is a pending invitation too. A run-out one (P2c) is revived by Resend, never replaced: same answer, its own words.
    const resendWords = (sentAt: string | null) => invitationHasLapsed(sentAt)
      ? 'Their invitation has run out. Resend it from their row on Members.'
      : 'They already have an invitation waiting. Resend it from their row on Members.';
    if (sameMember?.pending_role) {
      return NextResponse.json({
        error: resendWords(sameMember.pending_invited_at),
        code: 'already_invited',
      }, { status: 409 });
    }
    if (sameMember?.status === 'invited') {
      return NextResponse.json({
        error: sameMember.role === 'coach'
          ? 'They haven’t accepted their coaching invitation yet. Invite them to the board once they have.'
          : resendWords(sameMember.invited_at),
        code: 'already_invited',
      }, { status: 409 });
    }
    if (sameMember && sameMember.role !== 'coach') {
      return NextResponse.json({ error: 'This user is already a member of this organization' }, { status: 409 });
    }

    // ⚖ Verified Network (2026-07-24; A03): belonging to another organization no longer blocks an
    // invite — coaching rows, pending and suspended rows never counted, and now neither does a
    // board seat elsewhere. Only a scorekeeper keeps one home organization.
    const join = await checkCrossOrgJoin(existingUser.id, org.id, role);
    if (join.blocked) {
      return NextResponse.json({ error: crossOrgJoinRefusalForAdmin(join), code: 'one_home_org' }, { status: 409 });
    }

    const nowIso = new Date().toISOString();

    // ⚖ AN EXISTING ACCOUNT IS INVITED, NEVER ADDED ON THE SPOT (Board Ready trust close-out 13, owner 2026-11-18). It used
    // to be written `active` with no yes from its owner. Now it is a pending row, the same one a new person gets, and it
    // becomes a membership only when they accept it from Home (POST /api/auth/invitations/[memberId], which also starts
    // their two-step days). Until then they hold the seat it reserves, as a new person's invitation does, and see nothing
    // of the club. `invited_email` stays EMPTY: the row already names the account (nothing to re-attach by email), and the
    // emptiness is what tells a resend and a Cancel that this is the person's own account (isInvitationToOwnAccount).
    // ⚠ Only a CONFIRMED account takes this path (/review): an unconfirmed one — another club's invitation not yet taken
    // up, or a sign-up never finished — has nothing to sign in with, so a "sign in to accept" email is a dead end. It falls
    // through to the new person's set-up invitation below, which works for an unconfirmed account and records its address.
    if (!sameMember && existingUser.email_confirmed_at) {
      const { error: pendingError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: existingUser.id,
          role,
          status: 'invited',
          invited_at: nowIso,
          capabilities,
        });
      if (pendingError) {
        return captureAndJson(pendingError, { error: 'The invitation couldn’t be created. Try again.' }, 500);
      }

      await writeOrgAudit(org.id, user.id, existingUser.id, 'member_invited', { email, role, existingAccount: true, ...(job ? { purpose: job } : {}) });

      await sendExistingAccountInvite({
        email, orgId: org.id, orgName: org.name, role, capabilities, inviterName: await memberDisplayName(org.id, user.id), askedBy: user.id,
      });

      return NextResponse.json({ ok: true, added: false, existingAccount: true });
    }

    // An unconfirmed account with no row here leaves this block for the set-up invitation (above).
    if (sameMember) {
      // ⚖ A CLUB'S OWN COACH INVITED TO THE BOARD ACCEPTS IT TOO (owner ruling 2026-11-18, trust close-out 13 P2b, mig 503).
      // They hold this org's capability-less coach row (the plumbing every staff invite writes; one row per person per
      // club). It used to be rewritten to the board role on the spot. Now the board role WAITS on the row beside their
      // coaching, which it never touches, and becomes theirs only when they accept it on Home (POST
      // /api/auth/invitations/[memberId], which also starts their two-step days). Until then it holds the seat it reserves,
      // as every pending invitation does, and opens nothing. Decline and Cancel clear it and leave the coach row as it was.
      // The volunteer's job rides along as the waiting access (null for every other role).
      const { data: offered, error: offerError } = await supabaseAdmin
        .from('organization_members')
        .update({ pending_role: role, pending_capabilities: capabilities, pending_invited_at: nowIso })
        .eq('id', sameMember.id)
        .eq('organization_id', org.id)
        .eq('role', 'coach')
        .eq('status', 'active')
        .is('pending_role', null)
        .select('id');

      if (offerError) {
        return captureAndJson(offerError, { error: 'The invitation couldn’t be created. Try again.' }, 500);
      }
      // Another invitation reached the row first, or it changed (/review): nothing was written.
      if (!offered?.length) {
        return NextResponse.json({
          error: 'Their membership changed while you were inviting them. Reload Members to see it as it is now.',
          code: 'member_changed',
        }, { status: 409 });
      }

      await writeOrgAudit(org.id, user.id, existingUser.id, 'member_invited', { email, role, existingAccount: true, keepsCoaching: true, ...(job ? { purpose: job } : {}) });

      await sendExistingAccountInvite({
        email, orgId: org.id, orgName: org.name, role, capabilities, inviterName: await memberDisplayName(org.id, user.id), askedBy: user.id, keepsCoaching: true,
      });

      return NextResponse.json({ ok: true, added: false, existingAccount: true });
    }
  }

  // User doesn't exist — generate Supabase invite link.
  // Route through /auth/callback so the PKCE code is exchanged server-side
  // before the accept-invite page renders. The callback then redirects to next.
  // J10-010: the link carries the club, the role and who sent it, so the accept page's first
  // frame is already right (a scorekeeper never sees the admin title flash). The page confirms all
  // three from the server once the session lands; the link only paints the first frame.
  const inviterName = await memberDisplayName(org.id, user.id);
  const next = encodeURIComponent(acceptInvitePath({ orgSlug: org.slug, role, inviterName }));
  const redirectTo = `${appUrl}/auth/callback?next=${next}`;
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData) {
    return captureAndJson(
      linkError ?? new Error('generateLink returned no data for member invite'),
      { error: linkError?.message ?? 'Failed to generate invite link' },
      500,
    );
  }

  // Create pending member row (no accepted_at)
  const newUserId = linkData.user?.id;
  if (newUserId) {
    // Checked (2026-10-08): an unchecked failure here still sent the invitation and answered "ok" —
    // an email for a membership that doesn't exist — and, once the audit write began landing, logged it.
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: newUserId,
        role,
        status: 'invited',
        invited_at: new Date().toISOString(),
        // Persist the invited email so reconciliation can re-attach this pending row
        // if the user self-registers/logs in instead of clicking the email link (mig 128).
        invited_email: email,
        // The volunteer's job, from the invite on (null for every other role).
        capabilities,
      });
    if (memberError) {
      return captureAndJson(memberError, { error: 'The invitation couldn’t be created. Try again.' }, 500);
    }

    await writeOrgAudit(org.id, user.id, newUserId, 'member_invited', { email, role, ...(job ? { purpose: job } : {}) });
  }

  // Send invite email via Resend
  const inviteUrl = getActionLink(linkData);

  await sendEmail(
    email,
    `You've been invited to ${org.name} on FieldLogicHQ`,
    orgInviteHtml({ orgName: org.name, roleLabel, inviteUrl: inviteUrl ?? appUrl, ctaLabel: INVITE_EMAIL_ACTION.accept, note: job ? VOLUNTEER_EMAIL_NOTE.invite[job] : null, opens, inviterName }),
    { kind: 'org_invite', orgId: org.id, askedBy: user.id },
  );

  return NextResponse.json({ ok: true, added: false });
}, { route: '/api/admin/members/invite' });
