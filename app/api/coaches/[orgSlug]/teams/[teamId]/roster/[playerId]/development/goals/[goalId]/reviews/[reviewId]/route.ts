import { NextResponse } from 'next/server';
import { getRepDevelopmentGoalReview, updateRepDevelopmentGoalReview, deleteRepDevelopmentGoalReview } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { readGoalReviewInput } from '@/lib/development-input';
import { resolveDevelopmentPlayerContext, assertEvidenceBelongsToPlayer } from '@/lib/development-player-route';

/**
 * Correct or remove ONE review (owner ruling 2026-09-16 — a coach's own working record, not an
 * audit log a mistake should have to live in forever; it also feeds the family-facing development
 * handout, which is the point). A full replace, same shape as the create route: the sheet always
 * pre-fills every field, so there is nothing partial to merge. Either write re-derives the goal's
 * status (and next-review date) from whichever review is now the LATEST — the same rule the append
 * route always applied, re-run because a correction can move which review that is.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; goalId: string; reviewId: string }> },) => {
  const { orgSlug, teamId, playerId, goalId, reviewId } = await params;
  const resolved = await resolveDevelopmentPlayerContext(orgSlug, teamId, playerId, 'goals');
  if ('error' in resolved) return resolved.error!;

  const existing = await getRepDevelopmentGoalReview(reviewId, teamId, playerId);
  if (!existing || existing.goalId !== goalId) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const read = readGoalReviewInput(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });

  const foreign = await assertEvidenceBelongsToPlayer(teamId, playerId, {
    measurableIds: read.fields.evidenceMeasurableIds, observationIds: read.fields.evidenceObservationIds,
  });
  if (foreign) return NextResponse.json({ error: foreign }, { status: 400 });

  const saved = await updateRepDevelopmentGoalReview(reviewId, teamId, playerId, read.fields);
  if (!saved) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  return NextResponse.json(saved);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals/[goalId]/reviews/[reviewId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; goalId: string; reviewId: string }> },) => {
  const { orgSlug, teamId, playerId, goalId, reviewId } = await params;
  const resolved = await resolveDevelopmentPlayerContext(orgSlug, teamId, playerId, 'goals');
  if ('error' in resolved) return resolved.error!;

  const existing = await getRepDevelopmentGoalReview(reviewId, teamId, playerId);
  if (!existing || existing.goalId !== goalId) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

  const deleted = await deleteRepDevelopmentGoalReview(reviewId, teamId, playerId);
  if (!deleted) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  return NextResponse.json(deleted);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals/[goalId]/reviews/[reviewId]' });
