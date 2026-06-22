import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { userBelongsToOtherRealOrg } from '@/lib/org-membership-policy';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { sendEmail, orgInviteHtml, orgMemberAddedHtml } from '@/lib/email';
import type { OrgRole } from '@/lib/types';
import { withObservability } from '@/lib/observability';

function getActionLink(data: unknown) {
  return (data as { properties?: { action_link?: string | null } }).properties?.action_link ?? null;
}

const INVITABLE_ROLES: OrgRole[] = ['admin', 'staff', 'official', 'league_admin', 'league_registrar', 'treasurer'];

const ROLE_EMAIL_LABEL: Record<OrgRole, string> = {
  owner: 'owner',
  admin: 'administrator',
  staff: 'staff member',
  official: 'scorekeeper',
  league_admin: 'league administrator',
  league_registrar: 'league registrar',
  treasurer: 'treasurer',
  coach: 'coach',
};

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const { user, org } = ctx;

  const denied = await requireCapability(ctx, 'manage_members');
  if (denied) return denied;

  const body = await req.json();
  const email: string = String(body.email ?? '').trim().toLowerCase();
  const role: OrgRole = INVITABLE_ROLES.includes(body.role) ? (body.role as OrgRole) : 'staff';
  // J1-077: where the volunteer invite link lands. Officials already permit both
  // scoring and gate; this only routes the link (default 'both' → scorekeeper +
  // in-app cross-link to the gate). Ignored for non-official roles.
  const VOLUNTEER_PURPOSES = ['scorekeeping', 'gate', 'both'] as const;
  type VolunteerPurpose = typeof VOLUNTEER_PURPOSES[number];
  const purpose: VolunteerPurpose =
    role === 'official' && VOLUNTEER_PURPOSES.includes(body.purpose) ? body.purpose : 'both';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const planCfg = PLAN_CONFIG[org.planId];

  // Officials are free on Pro/Elite — skip the seat check entirely for them.
  const skipSeatCheck = role === 'official' && planCfg.officialsFreeSeats;

  if (!skipSeatCheck) {
    // Count only billable seats (exclude officials on plans where they are free).
    let seatQuery = supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id);

    if (planCfg.officialsFreeSeats) {
      seatQuery = seatQuery.neq('role', 'official');
    }

    const { count: seatCount } = await seatQuery;
    const seatLimit = planCfg.seatLimit;

    if ((seatCount ?? 0) >= seatLimit) {
      return NextResponse.json(
        { error: `Seat limit reached (${seatLimit} seat${seatLimit === 1 ? '' : 's'} on the ${planCfg.label} plan). Upgrade to add more members.` },
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';
  const roleLabel = ROLE_EMAIL_LABEL[role] ?? role;
  // J1-077: officials land on the screen matching their purpose. 'gate' → check-in,
  // otherwise the scorekeeper screen (which carries a cross-link to the gate).
  const volunteerLanding = purpose === 'gate' ? `/${org.slug}/check-in` : `/${org.slug}/scorekeeper`;
  const signInPath = role === 'official'
    ? `/auth/login?next=${encodeURIComponent(volunteerLanding)}`
    : '/auth/login';
  const signInUrl = `${appUrl}${signInPath}`;
  const signInAction = role === 'official'
    ? (purpose === 'gate' ? 'Open Check-In' : purpose === 'scorekeeping' ? 'Open Scorekeeper' : 'Open Volunteer View')
    : 'Sign In';

  if (existingUser) {
    // Check they're not already in THIS org
    const { data: sameMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', existingUser.id)
      .maybeSingle();

    if (sameMember) {
      return NextResponse.json({ error: 'This user is already a member of this organization' }, { status: 409 });
    }

    // Single-org by default (decision 2026-06-19): reject if they already belong to another
    // REAL org. A PENDING invite elsewhere (status='invited') does NOT count — the person never
    // accepted it (J10-001). A standalone coach's OWN Coaches Portal (team_workspace) is EXEMPT,
    // so a coach can still be invited into a club with one login. (Their current org is excluded.)
    if (await userBelongsToOtherRealOrg(existingUser.id, org.id)) {
      return NextResponse.json(
        { error: 'This user already belongs to another organization. They must be removed from their current organization before being invited here.' },
        { status: 409 }
      );
    }

    // Add directly with accepted_at = now
    const { error: insertError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: existingUser.id,
        role,
        status: 'active',
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: user.id, target_id: existingUser.id,
      action: 'member_invited', payload: { email, role, ...(role === 'official' ? { purpose } : {}) },
    });

    // Notify the existing user that they now have access to this org.
    await sendEmail(
      email,
      `You've been added to ${org.name} on FieldLogicHQ`,
      orgMemberAddedHtml({ orgName: org.name, roleLabel, signInUrl, ctaLabel: signInAction, scorekeeperNote: role === 'official' }),
    );

    return NextResponse.json({ ok: true, added: true });
  }

  // User doesn't exist — generate Supabase invite link.
  // Route through /auth/callback so the PKCE code is exchanged server-side
  // before the accept-invite page renders. The callback then redirects to next.
  const next = encodeURIComponent(`/auth/accept-invite?org=${org.slug}`);
  const redirectTo = `${appUrl}/auth/callback?next=${next}`;
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message ?? 'Failed to generate invite link' }, { status: 500 });
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
      });

    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: user.id, target_id: newUserId,
      action: 'member_invited', payload: { email, role, ...(role === 'official' ? { purpose } : {}) },
    });
  }

  // Send invite email via Resend
  const inviteUrl = getActionLink(linkData);

  const inviteAction = role === 'official'
    ? (purpose === 'gate' ? 'Accept Gate Volunteer Invite' : purpose === 'scorekeeping' ? 'Accept Scorekeeper Invite' : 'Accept Volunteer Invite')
    : 'Accept Invitation';
  await sendEmail(
    email,
    `You've been invited to ${org.name} on FieldLogicHQ`,
    orgInviteHtml({ orgName: org.name, roleLabel, inviteUrl: inviteUrl ?? appUrl, ctaLabel: inviteAction, scorekeeperNote: role === 'official' }),
  );

  return NextResponse.json({ ok: true, added: false });
}, { route: '/api/admin/members/invite' });
