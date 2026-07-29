import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getClosedCoachingAssignmentsForUser } from '@/lib/db';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { countActiveBasicCoachTeamMembershipsForUser } from '@/lib/basic-coach-teams';
import { withObservability } from '@/lib/observability';

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
  // Only teams with NO active assignment are listed (a rolled-forward team's past seasons live
  // in Insights, not the switcher), and only the newest closed season per team.
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
  return NextResponse.json({ assignments, closedAssignments, hasBasicCoachTeam: basicMemberships > 0 });
}, { route: '/api/coaches/[orgSlug]/assignments' });
