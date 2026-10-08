import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { countsAsSeat, seatExemptRoles } from '@/lib/roles';
import { checkCrossOrgJoin, crossOrgJoinRefusalForAdmin } from '@/lib/org-membership-policy';
import { isAssignableRole } from '@/lib/board-roles';
import { roleEmailLabel } from '@/lib/member-access';
import { memberDisplayName } from '@/lib/member-names';
import { acceptInvitePath } from '@/lib/invite-links';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { sendEmail, orgInviteHtml, orgMemberAddedHtml } from '@/lib/email';
import { parseVolunteerJob, volunteerCapabilitiesFor, volunteerHome, type VolunteerJob } from '@/lib/volunteer-jobs';
import { INVITE_EMAIL_ACTION, VOLUNTEER_EMAIL_NOTE } from '@/lib/volunteer-words';
import type { OrgRole } from '@/lib/types';
import { withObservability, captureAndJson } from '@/lib/observability';

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

  const planCfg = PLAN_CONFIG[org.planId];

  // A role that is not a seat (a free official; coaching staff) never trips the guard.
  const skipSeatCheck = !countsAsSeat(role, planCfg);

  if (!skipSeatCheck) {
    // Count only the memberships that are seats — one rule, shared with the count read and the
    // Members page (owner ruling 2026-09-13: coaching staff don't count).
    const { count: seatCount } = await supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .not('role', 'in', `(${seatExemptRoles(planCfg).join(',')})`);
    const seatLimit = planCfg.seatLimit;

    if ((seatCount ?? 0) >= seatLimit) {
      return NextResponse.json(
        { error: `Seat limit reached (${seatLimit} seat${seatLimit === 1 ? '' : 's'} on the ${planCfg.label} plan). Upgrade to add more members.`, code: 'seat_limit_reached' },
        { status: 403 }
      );
    }
  }

  // Check if a Supabase auth user already exists with this email.
  // NOTE: supabase.auth.admin.getUserByEmail() is not available in supabase-js v2.x.
  // Using listUsers with perPage:1000 — sufficient for current platform scale.
  // Revisit with pagination or a direct email lookup API when the user base grows.
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = usersData?.users.find(u => u.email?.toLowerCase() === email);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const roleLabel = roleEmailLabel(role);
  // A volunteer's sign-in link opens their job — the same rule as every later sign-in.
  const volunteerLanding = volunteerHome(org.slug, role, capabilities);
  const signInPath = volunteerLanding
    ? `/auth/login?next=${encodeURIComponent(volunteerLanding)}`
    : '/auth/login';
  const signInUrl = `${appUrl}${signInPath}`;

  if (existingUser) {
    // Check they're not already in THIS org
    const { data: sameMember } = await supabaseAdmin
      .from('organization_members')
      .select('id, role, status')
      .eq('organization_id', org.id)
      .eq('user_id', existingUser.id)
      .maybeSingle();

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

    // Someone who already COACHES here holds this org's capability-less coach row (the plumbing
    // every staff invite writes). Inviting them to the board gives that row the board role; their
    // coaching lives on their team's staff list and is untouched. (It used to answer "already a
    // member", and the Manage dialog now refuses coach rows — this is the door that works.)
    const nowIso = new Date().toISOString();
    // Both writes carry the volunteer's job (null for every other role — a coach row is capability-less).
    const { error: insertError } = sameMember
      ? await supabaseAdmin
        .from('organization_members')
        .update({ role, status: 'active', accepted_at: nowIso, capabilities })
        .eq('id', sameMember.id)
        .eq('organization_id', org.id)
        .eq('role', 'coach')
      : await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: existingUser.id,
          role,
          status: 'active',
          invited_at: nowIso,
          accepted_at: nowIso,
          capabilities,
        });

    if (insertError) {
      return captureAndJson(insertError, { error: insertError.message }, 500);
    }

    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: user.id, target_id: existingUser.id,
      action: 'member_invited', payload: { email, role, ...(job ? { purpose: job } : {}) },
    });

    // Notify the existing user that they now have access to this org.
    await sendEmail(
      email,
      `You've been added to ${org.name} on FieldLogicHQ`,
      orgMemberAddedHtml({ orgName: org.name, roleLabel, signInUrl, ctaLabel: INVITE_EMAIL_ACTION.signIn, note: job ? VOLUNTEER_EMAIL_NOTE.added[job] : null }),
    );

    return NextResponse.json({ ok: true, added: true });
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
    await supabaseAdmin
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

    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: user.id, target_id: newUserId,
      action: 'member_invited', payload: { email, role, ...(job ? { purpose: job } : {}) },
    });
  }

  // Send invite email via Resend
  const inviteUrl = getActionLink(linkData);

  await sendEmail(
    email,
    `You've been invited to ${org.name} on FieldLogicHQ`,
    orgInviteHtml({ orgName: org.name, roleLabel, inviteUrl: inviteUrl ?? appUrl, ctaLabel: INVITE_EMAIL_ACTION.accept, note: job ? VOLUNTEER_EMAIL_NOTE.invite[job] : null, inviterName }),
  );

  return NextResponse.json({ ok: true, added: false });
}, { route: '/api/admin/members/invite' });
