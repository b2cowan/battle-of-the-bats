import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepTeam, getRepProgramYear, getRepTeamCoaches, addRepTeamCoach, removeRepTeamCoach, cleanupOrphanedCoachMembership } from '@/lib/db';
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
    .select('id')
    .eq('organization_id', ctx!.org.id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!member) {
    return NextResponse.json({ error: 'User is not an active member of this organization' }, { status: 422 });
  }

  try {
    const coach = await addRepTeamCoach(programYear.id, team.id, ctx!.org.id, userId, coachRole);
    return NextResponse.json({ coach }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'This user is already assigned as a coach for this program year' }, { status: 409 });
    }
    throw e;
  }
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

  await removeRepTeamCoach(coachId);
  // Clean up an orphaned capability-less guest membership + revoke stale tournament chat access
  // (consistent with the coach-side + oversight removal paths).
  await cleanupOrphanedCoachMembership(ctx!.org.id, row.user_id as string).catch(() => {});
  await revokeStaleChatMembershipsForCoach(row.user_id as string).catch(() => {});
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches' });
