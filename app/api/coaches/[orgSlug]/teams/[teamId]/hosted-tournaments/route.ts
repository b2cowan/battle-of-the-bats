import { NextResponse } from 'next/server';
import { getAuthContextWithScope, forbidden, unauthorized } from '@/lib/api-auth';
import { syncTournamentGrantProjection } from '@/lib/coach-membership';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getTeamScopedRepTeamAccess, isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import { canConfigureTeam, denyUnless } from '@/lib/coach-capabilities';
import { TOURNAMENT_GRANT_KEY } from '@/lib/coach-tournament-grant';
import { withObservability } from '@/lib/observability';

export type HostedTournamentRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  registeredTeams: number;
};

/**
 * "Tournaments you run" — the second half of the team's tournament season (owner ruling 2026-09-13:
 * hosting lives on the coach portal's Tournaments page, not behind a second nav). Answers two
 * questions for the caller: may THIS PERSON run tournaments in this org, and which non-archived
 * ones exist. `canRun` is decided the way every admin tournament route decides it — the org role
 * plus the per-member override map (`hasCapability`) — so the section and the admin side can never
 * disagree; the "Run tournaments" staff grant reaches here only through its projection onto that
 * map. When the answer is no, the list is EMPTY: the page draws nothing, and nothing is leaked.
 *
 * The caller must also be able to open the Tournaments page at all (its `canConfigureTeam` gate),
 * so this read refuses exactly the people the page refuses.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  let ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const access = await getTeamScopedRepTeamAccess({
    orgId: ctx.org.id,
    repTeamId: teamId,
    userId: ctx.user.id,
    requireCoach: true,
    skipEntitlementCheck: !isTeamWorkspaceOrg(ctx.org),
  });
  if (!access.allowed) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  const denied = denyUnless(
    !!assignment && canConfigureTeam(assignment.capabilities),
    'Tournaments aren’t turned on for you. Ask the head coach to grant schedule editing.',
  );
  if (denied) return denied;

  /**
   * CONVERGE BEFORE ANSWERING. The grant reaches the admin side only through its projection onto
   * the workspace membership, and the projection is written by staff WRITES — so a second head
   * coach promoted before this shipped, a person whose two teams' writes raced, or a projection
   * that failed after its row committed would all read "cannot" here while the switch says "on".
   * This is the one door the coach side opens the right through, so re-derive it here for a
   * coach-role caller in a workspace (three small reads; a no-op when nothing changed) and read
   * the membership again. Idempotent and derived — not a seed. (/review 2026-09-13)
   */
  if (ctx.role === 'coach' && isTeamWorkspaceOrg(ctx.org)) {
    await syncTournamentGrantProjection(ctx.org.id, ctx.user.id).catch((e) => {
      console.error('[coaches hosted tournaments] projection converge failed (answering from the stored map):', e);
    });
    ctx = (await getAuthContextWithScope({ orgSlug, requireOrgSlug: true })) ?? ctx;
  }

  const canRun = hasModuleEntitlement(ctx.org, 'module_tournaments')
    && hasCapability(ctx.role, ctx.capabilities, TOURNAMENT_GRANT_KEY);
  if (!canRun) return NextResponse.json({ canRun: false, tournaments: [] as HostedTournamentRow[] });

  let query = supabaseAdmin
    .from('tournaments')
    .select('id, name, slug, status, start_date, end_date')
    .eq('org_id', ctx.org.id)
    .neq('status', 'archived')
    .order('start_date', { ascending: false, nullsFirst: false });
  // A club member scoped to particular tournaments sees only those — the same rule the admin list applies.
  if (ctx.assignedTournamentIds !== null) query = query.in('id', ctx.assignedTournamentIds);
  const { data: rows, error } = await query;
  if (error) {
    console.error('[coaches hosted tournaments] load error:', error);
    return NextResponse.json({ error: 'Tournaments could not be loaded' }, { status: 500 });
  }

  const ids = (rows ?? []).map(r => r.id as string);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('tournament_id')
      .in('tournament_id', ids);
    if (teamsError) {
      console.error('[coaches hosted tournaments] team count error:', teamsError);
    } else {
      for (const t of teams ?? []) {
        const key = t.tournament_id as string;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  const tournaments: HostedTournamentRow[] = (rows ?? []).map(r => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    status: r.status as string,
    startDate: (r.start_date as string | null) ?? null,
    endDate: (r.end_date as string | null) ?? null,
    registeredTeams: counts.get(r.id as string) ?? 0,
  }));

  return NextResponse.json({ canRun: true, tournaments });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/hosted-tournaments' });
