import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  mergeRepTeamTags,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';

// Curation tool: folds one tag's game history into another (the plan's anti-drift guardrail —
// "Top teams" vs "top in province" — so the library doesn't rot into near-duplicates). Atomic via
// the merge_rep_team_tags Postgres function (migration 181); this route only resolves auth + which
// id is the winner/loser.
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
  const denied = denyUnless(assignment.capabilities.schedule, 'You do not have access to the schedule.');
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
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tags/merge' });
