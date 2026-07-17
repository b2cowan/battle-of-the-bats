import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';
import { computeTeamSeasonLineupAnalytics } from '@/lib/team-season-analytics';

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();
  const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
  if (denied) return denied;

  // Shared assembly (lib/team-season-analytics) — the same composition the Development
  // card quotes, so the two surfaces can never drift. Pass the already-fetched team through.
  const result = await computeTeamSeasonLineupAnalytics(teamId, { team });
  if (!result) {
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  return NextResponse.json({ analytics: result.analytics });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/lineup-analytics' });
