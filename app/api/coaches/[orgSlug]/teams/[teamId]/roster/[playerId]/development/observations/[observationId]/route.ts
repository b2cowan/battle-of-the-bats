import { NextResponse } from 'next/server';
import { getRepTeamMeasurableType, updateRepPlayerObservation, deleteRepPlayerObservation, getRepPlayerObservation } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { readObservationInput } from '@/lib/development-input';
import { resolveDevelopmentPlayerContext, assertGoalBelongsToPlayer } from '@/lib/development-player-route';

/** Edit an observation's wording, date, descriptor or evidence link. The skill it names is fixed. */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; observationId: string }> },) => {
  const { orgSlug, teamId, playerId, observationId } = await params;
  const resolved = await resolveDevelopmentPlayerContext(orgSlug, teamId, playerId, 'goals');
  if ('error' in resolved) return resolved.error!;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const read = readObservationInput(body, 'patch');
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const { fields } = read;

  // A descriptor must be one of the skill's own words — the observation's skill is read from the
  // observation itself (team + player scoped), never trusted from the body.
  if (fields.descriptor) {
    const mine = await getRepPlayerObservation(observationId, teamId, playerId);
    if (!mine) return NextResponse.json({ error: 'Observation not found' }, { status: 404 });
    const skill = await getRepTeamMeasurableType(mine.measurableTypeId, teamId);
    if (!skill?.descriptors.includes(fields.descriptor)) {
      return NextResponse.json({ error: `“${fields.descriptor}” isn’t one of this skill’s descriptors.` }, { status: 400 });
    }
  }
  if (fields.goalId) {
    const bad = await assertGoalBelongsToPlayer(teamId, playerId, fields.goalId);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  }
  try {
    const observation = await updateRepPlayerObservation(observationId, teamId, playerId, fields);
    if (!observation) return NextResponse.json({ error: 'Observation not found' }, { status: 404 });
    return NextResponse.json({ observation });
  } catch (error: unknown) {
    // The table's CHECK (note OR descriptor) is the last word: a patch that would blank both is
    // refused there, and the refusal reads the same as the reader's.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23514') {
      return NextResponse.json({ error: 'Say what you saw, or choose a descriptor.' }, { status: 400 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/observations/[observationId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; observationId: string }> },) => {
  const { orgSlug, teamId, playerId, observationId } = await params;
  const resolved = await resolveDevelopmentPlayerContext(orgSlug, teamId, playerId, 'goals');
  if ('error' in resolved) return resolved.error!;
  const deleted = await deleteRepPlayerObservation(observationId, teamId, playerId);
  if (!deleted) return NextResponse.json({ error: 'Observation not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/observations/[observationId]' });
