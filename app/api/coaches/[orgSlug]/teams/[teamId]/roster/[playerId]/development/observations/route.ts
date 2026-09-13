import { NextResponse } from 'next/server';
import { getRepTeamMeasurableType, getRepTeamEvaluationSession, createRepPlayerObservation } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { readObservationInput } from '@/lib/development-input';
import { resolveDevelopmentPlayerContext, assertGoalBelongsToPlayer } from '@/lib/development-player-route';

/**
 * Record an OBSERVATION (development lifecycle Phase 2, plan §7): what the coach saw against an
 * observed SKILL, dated, optionally as evidence for a goal, optionally in a session. A coach's
 * written judgement about a child — read on Internal notes, written on the Development grant AND
 * notes (the goals gate; §178 build call 2).
 */

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveDevelopmentPlayerContext(orgSlug, teamId, playerId, 'goals');
  if ('error' in resolved) return resolved.error!;
  const { ctx, player } = resolved;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const read = readObservationInput(body, 'create');
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const { measurableTypeId, observedOn, note, descriptor, goalId, sessionId: requestedSessionId } = read.fields;

  // This team's ACTIVE observed skill — a retired skill takes no new observation (its saved ones
  // stay), and a measured test takes a number, never an observation (the database refuses it too).
  const [skill, badGoal] = await Promise.all([
    getRepTeamMeasurableType(measurableTypeId, teamId),
    assertGoalBelongsToPlayer(teamId, playerId, goalId),
  ]);
  if (!skill || !skill.isActive) return NextResponse.json({ error: 'Pick an active observed skill for this team.' }, { status: 400 });
  if (skill.kind !== 'skill') return NextResponse.json({ error: 'A measured test takes a number — record a result instead.' }, { status: 400 });
  // The descriptor is one of the skill's own words, as written on the definition right now — the
  // text is snapshotted onto the observation so a later edit to the list never rewrites it.
  if (descriptor && !skill.descriptors.includes(descriptor)) {
    return NextResponse.json({ error: `“${descriptor}” isn’t one of this skill’s descriptors.` }, { status: 400 });
  }
  if (badGoal) return NextResponse.json({ error: badGoal }, { status: 400 });

  let sessionId: string | null = null;
  if (requestedSessionId) {
    const session = await getRepTeamEvaluationSession(requestedSessionId, teamId, player.programYearId);
    if (!session) return NextResponse.json({ error: 'Session not found for this team and season.' }, { status: 400 });
    sessionId = session.id;
  }

  const observation = await createRepPlayerObservation({
    orgId: ctx.org.id, teamId, playerId, measurableTypeId, observedOn, note, descriptor, goalId, sessionId,
    createdBy: ctx.user.id,
  });
  return NextResponse.json({ observation }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/observations' });
