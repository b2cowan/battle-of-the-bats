import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  updateRepPlayerDevelopmentGoal,
  deleteRepPlayerDevelopmentGoal,
  appendRepDevelopmentGoalReview,
} from '@/lib/db';
import { assertGoalBelongsToPlayer } from '@/lib/development-player-route';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopmentGoals, DEVELOPMENT_GRANT_MESSAGE } from '@/lib/coach-capabilities';
import { readGoalPatchInput } from '@/lib/development-input';
import { verifyFocusTag } from '@/lib/development-goal-input';
import { pastSeasonRefusal } from '@/lib/development-season-guard';

async function resolveContext(orgSlug: string, teamId: string, playerId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const [assignments, player] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getRepRosterPlayer(playerId),
  ]);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
  }

  // F04 (2026-09-11): the create route refused a past-season row; edit and delete did not, so a
  // current coach holding an old same-team id could reach a historical goal. One shared rule now.
  const past = pastSeasonRefusal(player, assignment);
  if (past) return { error: NextResponse.json({ error: past.error }, { status: past.status }) };

  // A goal id from another player (even same team) must 404, not silently edit — enforced
  // by the player_id scope on the mutation query itself (awards precedent), no pre-fetch.
  return { ctx, player, assignment };
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; goalId: string }> },) => {
  const { orgSlug, teamId, playerId, goalId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canWriteDevelopmentGoals(resolved.assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const read = readGoalPatchInput(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const { fields } = read;
  // The tag's OWNERSHIP is proved by the same helper the create route uses — one rule, one error
  // message. Null clears it back to "the coach hasn't said", which the rail shows at full strength.
  if (fields.tagId !== undefined) {
    const tag = await verifyFocusTag(body, { orgId: resolved.ctx.org.id, teamId });
    if ('error' in tag) return tag.error;
    fields.tagId = tag.tagId;
  }

  /**
   * A STATUS change is a review (F08, Phase 2). The profile's status pill used to overwrite the
   * status with nothing behind it; now the status rides an appended review event (status only —
   * no note, the "Review goal" dialog is where prose goes), so the goal's history stays whole and
   * the list and the timeline never disagree. Wording / note / tag / success / review-date edits
   * are edits, not reviews.
   */
  if (fields.status !== undefined) {
    const { status, reviewedOn, ...edits } = fields;
    // The review is written FIRST (the event is the record), so the goal must be proved THIS
    // player's before it — the update's player scope would refuse too late.
    if (await assertGoalBelongsToPlayer(teamId, playerId, goalId)) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }
    if (Object.keys(edits).length > 0) {
      const edited = await updateRepPlayerDevelopmentGoal(goalId, teamId, playerId, edits);
      if (!edited) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }
    const { goal } = await appendRepDevelopmentGoalReview({
      orgId: resolved.ctx.org.id, teamId, playerId, goalId, reviewedOn: reviewedOn!, status, createdBy: resolved.ctx.user.id,
    });
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    return NextResponse.json({ goal });
  }
  const goal = await updateRepPlayerDevelopmentGoal(goalId, teamId, playerId, fields);
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  return NextResponse.json({ goal });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals/[goalId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; goalId: string }> },) => {
  const { orgSlug, teamId, playerId, goalId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canWriteDevelopmentGoals(resolved.assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  const deleted = await deleteRepPlayerDevelopmentGoal(goalId, teamId, playerId);
  if (!deleted) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals/[goalId]' });
