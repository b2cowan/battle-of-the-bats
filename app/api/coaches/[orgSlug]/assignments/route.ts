import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getClosedCoachingAssignmentsForUser } from '@/lib/db';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { countActiveBasicCoachTeamMembershipsForUser } from '@/lib/basic-coach-teams';
import { withObservability } from '@/lib/observability';
import { buildCoachSeasons } from '@/lib/coach-season-view';

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },) => {
  const { orgSlug } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.org.slug !== orgSlug) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // `assignments` = rep (paid) coaching in THIS org; `hasBasicCoachTeam` = the user coaches a
  // free (Basic) team anywhere — powers the admin shell's coach-view door for a free-tier owner
  // who also coaches (P3-2), whose coach home is the global launchpad, not this org's portal.
  // `closedAssignments` = coaching on completed/archived seasons (Batch 3, P0 #1) — kept as a
  // SEPARATE array so no existing consumer of `assignments` silently starts seeing closed years.
  // Only teams with NO active assignment are listed, and only the newest closed season per team:
  // it answers "which of my TEAMS has finished", which is what the team switcher and the
  // Overview redirect ask it. Chunk F did NOT widen it — a rolled-forward team must keep
  // resolving to its live season everywhere that predicate is used.
  const lookupOpts = { isTeamWorkspace: isTeamWorkspaceOrg(ctx.org) };
  const [assignments, closedAll, basicMemberships] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id, lookupOpts),
    getClosedCoachingAssignmentsForUser(ctx.org.id, ctx.user.id, lookupOpts),
    countActiveBasicCoachTeamMembershipsForUser(ctx.user.id),
  ]);
  const activeTeamIds = new Set(assignments.map(a => a.teamId));
  const seenTeams = new Set<string>();
  const closedAssignments = closedAll.filter(a => {
    if (activeTeamIds.has(a.teamId) || seenTeams.has(a.teamId)) return false;
    seenTeams.add(a.teamId);
    return true;
  });

  // `seasons` (Chunk F) = EVERY season this coach holds an assignment on, per team — the season
  // switcher's list, and deliberately a THIRD array rather than a widening of `closedAssignments`
  // (which is deduped to one-per-team and drops rolled-forward teams entirely, so it can't answer
  // "which seasons of THIS team can I open"). Both lookups are already in flight above; without
  // this the data was being fetched and thrown away. Newest first, live season leading.
  const seasons = buildCoachSeasons(assignments, closedAll);

  return NextResponse.json({
    assignments,
    closedAssignments,
    seasons,
    hasBasicCoachTeam: basicMemberships > 0,
  });
}, { route: '/api/coaches/[orgSlug]/assignments' });
