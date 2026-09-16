import { NextResponse } from 'next/server';
import { appendRepDevelopmentGoalReview } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { readGoalReviewInput } from '@/lib/development-input';
import { resolveDevelopmentPlayerContext, assertGoalBelongsToPlayer, assertEvidenceBelongsToPlayer } from '@/lib/development-player-route';

/**
 * Review a goal — APPEND a dated event (development lifecycle Phase 2, plan §7; F08; F19: the
 * status is the required choice, the note is optional). The goal's status (and its next review
 * date) move in the same step, so the list and the history never disagree. An existing review is
 * corrected or removed at `[reviewId]`, not here (owner ruling 2026-09-16).
 *
 * Gate: the goals predicate (the grant AND Internal notes) — the same resolver observations use.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; goalId: string }> },) => {
  const { orgSlug, teamId, playerId, goalId } = await params;
  const resolved = await resolveDevelopmentPlayerContext(orgSlug, teamId, playerId, 'goals');
  if ('error' in resolved) return resolved.error!;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const read = readGoalReviewInput(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });

  // This player's goal — the composite FK proves the team; the player is proved here.
  if (await assertGoalBelongsToPlayer(teamId, playerId, goalId)) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  const foreign = await assertEvidenceBelongsToPlayer(teamId, playerId, {
    measurableIds: read.fields.evidenceMeasurableIds, observationIds: read.fields.evidenceObservationIds,
  });
  if (foreign) return NextResponse.json({ error: foreign }, { status: 400 });

  const { review, goal } = await appendRepDevelopmentGoalReview({
    orgId: resolved.ctx.org.id, teamId, playerId, goalId, ...read.fields, createdBy: resolved.ctx.user.id,
  });
  return NextResponse.json({ review, goal }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals/[goalId]/reviews' });
