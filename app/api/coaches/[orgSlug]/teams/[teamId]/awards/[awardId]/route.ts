import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  deleteRepPlayerAward,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageAwards } from '@/lib/coach-capabilities';

async function resolveAwardContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  const denied = denyUnless(canManageAwards(assignment.capabilities), 'You do not have access to awards.');
  if (denied) return { error: denied };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }
  return { ctx };
}

// Undo a mis-click — a hard delete of the record itself (distinct from retiring an award
// TYPE, which never deletes). Scoped by team_id, so an award can only be removed by a coach
// of its own team.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; awardId: string }> },) => {
  const { orgSlug, teamId, awardId } = await params;
  const resolved = await resolveAwardContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const deleted = await deleteRepPlayerAward(awardId, teamId);
  if (!deleted) return NextResponse.json({ error: 'Award not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/awards/[awardId]' });
