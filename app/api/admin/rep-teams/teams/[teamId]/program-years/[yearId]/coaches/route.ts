import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepTeam, getRepProgramYear, getRepTeamCoaches, getRepTeamCoachForUserYear, getActiveRepProgramYear } from '@/lib/db';
import { addStaffMember, removeStaffMember } from '@/lib/coach-membership';
import { userBelongsToOtherRealOrg } from '@/lib/org-membership-policy';
import { revokeStaleChatMembershipsForCoach } from '@/lib/chat-service';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const { teamId, yearId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const groupErr = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErr) return groupErr;

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const coaches = await getRepTeamCoaches(programYear.id);

  // Enrich with display names from org members
  const userIds = coaches.map(c => c.userId);
  const memberRows = userIds.length > 0
    ? (await supabaseAdmin
        .from('organization_members')
        .select('user_id, display_name')
        .eq('organization_id', ctx!.org.id)
        .in('user_id', userIds)).data ?? []
    : [];

  const { data: usersData } = userIds.length > 0
    ? await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    : { data: { users: [] } };

  const memberMap = new Map(memberRows.map(m => [m.user_id, m.display_name]));
  const emailMap = new Map((usersData?.users ?? []).map(u => [u.id, u.email ?? '']));

  const enriched = coaches.map(c => ({
    ...c,
    displayName: memberMap.get(c.userId) ?? null,
    email: emailMap.get(c.userId) ?? '',
  }));

  return NextResponse.json({ coaches: enriched });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const { teamId, yearId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const groupErr = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErr) return groupErr;

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const coachRole = body.coachRole === 'assistant_coach' ? 'assistant_coach' : 'head_coach';

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  // Guard: userId must be an active org member
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('id, role')
    .eq('organization_id', ctx!.org.id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!member) {
    return NextResponse.json({ error: 'User is not an active member of this organization' }, { status: 422 });
  }

  // Preserve cross-org guest ASSISTANT coaching (a ratified freedom) but block the SILENT escalation
  // of such a guest into a HEAD-coach seat: a capability-less guest membership (role 'coach') whose
  // holder is still active in ANOTHER real org is a cross-org guest, not a genuine local member — they
  // must be invited as a full member of THIS org first. Assistant assignment and same-org head coaches
  // (whose membership role is admin/staff/official/etc., or who have no other real org) are unaffected.
  if (
    coachRole === 'head_coach' &&
    member.role === 'coach' &&
    (await userBelongsToOtherRealOrg(userId, ctx!.org.id))
  ) {
    return NextResponse.json(
      { error: 'This coach is a guest from another organization. Invite them as a full member of this organization before making them a head coach.' },
      { status: 403 },
    );
  }

  // M1 (2026-08-16): an admin adds someone to the TEAM's staff, not to a season. A finished
  // season's staff list is a record — it names who really coached it and is never edited.
  if (programYear.status === 'completed' || programYear.status === 'archived') {
    return NextResponse.json(
      { error: 'This season is finished. Its staff list is a record — add coaches to the team’s current staff instead.' },
      { status: 409 },
    );
  }
  // ⚠ And the URL's year must BE the team's current live season. Two open years can coexist
  // (draft + draft — the create guard only blocks a second ACTIVE), and membership writes always
  // project onto the newest one; operating this endpoint against the older year would silently
  // file the coach somewhere the admin isn't looking and answer 201 with `coach: null`
  // (adversarial review 2026-08-16). Refusing is the honest answer.
  const liveYear = await getActiveRepProgramYear(team.id);
  if (!liveYear || liveYear.id !== programYear.id) {
    return NextResponse.json(
      { error: 'Staff is managed on the team’s current season. Open the newest season and add them there.' },
      { status: 409 },
    );
  }

  // Membership + the live-season record row (projected by addStaffMember). Point lookups on the
  // (program_year_id, user_id) unique index — never the whole staff list. Response keeps the row
  // shape the admin screen lists.
  if (await getRepTeamCoachForUserYear(programYear.id, userId)) {
    return NextResponse.json({ error: 'This user is already assigned as a coach for this program year' }, { status: 409 });
  }
  await addStaffMember({ orgId: ctx!.org.id, teamId: team.id, userId, coachRole });
  const coach = await getRepTeamCoachForUserYear(programYear.id, userId);
  return NextResponse.json({ coach }, { status: 201 });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches' });

export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string }> },) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const { teamId, yearId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const groupErr = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErr) return groupErr;

  const { searchParams } = url;
  const coachId = searchParams.get('coachId');
  if (!coachId) {
    return NextResponse.json({ error: 'coachId query param is required' }, { status: 400 });
  }

  // Verify the coach row belongs to this program year
  const { data: row } = await supabaseAdmin
    .from('rep_team_coaches')
    .select('id, user_id')
    .eq('id', coachId)
    .eq('program_year_id', yearId)
    .single();

  if (!row) {
    return NextResponse.json({ error: 'Coach assignment not found' }, { status: 404 });
  }

  // M1: a finished season's staff list is a record — removal happens on the team's staff, not
  // on history. (The per-season revocation this used to perform is retired with the model.)
  const rowYear = await getRepProgramYear(yearId);
  if (rowYear && (rowYear.status === 'completed' || rowYear.status === 'archived')) {
    return NextResponse.json(
      { error: 'This season is finished. Who coached it is part of its record — remove the coach from the team’s current staff instead.' },
      { status: 409 },
    );
  }
  // Same current-season guard as the POST: removal acts team-wide, and the live row it clears is
  // the NEWEST open year's — acting from an older open year's screen would orphan the row the
  // admin is actually looking at while revoking everywhere else.
  const liveYearForDelete = await getActiveRepProgramYear(teamId);
  if (!liveYearForDelete || liveYearForDelete.id !== yearId) {
    return NextResponse.json(
      { error: 'Staff is managed on the team’s current season. Open the newest season and remove them there.' },
      { status: 409 },
    );
  }

  // Revokes the TEAM membership (record kept) + deletes the live season's row + cleans up the
  // guest org membership — removal means removed, everywhere, in one action.
  const removed = await removeStaffMember(ctx!.org.id, teamId, row.user_id as string, ctx!.user.id);
  if (!removed) {
    console.warn('[program-year coaches DELETE] no active membership to revoke', { coachId });
  }
  await revokeStaleChatMembershipsForCoach(row.user_id as string).catch(() => {});
  return NextResponse.json({ ok: true, removed });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches' });
