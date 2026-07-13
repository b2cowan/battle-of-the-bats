import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  mergeRepTeamTags,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';

// Curation tool for money tags — folds one team expense tag's history (expense links) into another.
// Atomic via the merge_rep_team_tags RPC (migration 184 extended it to re-point expense links too).
// Money capability. Operates on the team's own tags (mergeRepTeamTags scopes to teamId).
export const POST = withObservability(async (req: Request,
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
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances.');
  if (denied) return denied;
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const winnerTagId = typeof body.winnerTagId === 'string' ? body.winnerTagId : '';
  const loserTagId = typeof body.loserTagId === 'string' ? body.loserTagId : '';
  if (!winnerTagId || !loserTagId) {
    return NextResponse.json({ error: 'winnerTagId and loserTagId are required' }, { status: 400 });
  }
  if (winnerTagId === loserTagId) {
    return NextResponse.json({ error: 'Choose two different tags to merge' }, { status: 400 });
  }

  try {
    await mergeRepTeamTags(winnerTagId, loserTagId, teamId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expense-tags/merge' });
