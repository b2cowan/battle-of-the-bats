import { NextResponse } from 'next/server';
import {
  getRepTeamOpponentObservationById,
  deleteRepTeamOpponentObservation,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canLogScoutingObservation } from '@/lib/coach-capabilities';

/**
 * The curation "eraser" (owner-ratified 2026-08-04): the head coach can remove ANY
 * observation; everyone else only their own. There is deliberately no UPDATE route —
 * observations are append-only in spirit (game-moments convention).
 */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; opponentKey: string; observationId: string }> },) => {
  const { orgSlug, teamId, observationId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canLogScoutingObservation(assignment.capabilities), 'You do not have access to the scouting book.');
  if (denied) return denied;

  const observation = await getRepTeamOpponentObservationById(teamId, observationId);
  if (!observation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAuthor = observation.createdBy != null && observation.createdBy === ctx.user.id;
  if (!assignment.capabilities.isHeadCoach && !isAuthor) {
    return NextResponse.json({ error: 'Only the head coach can remove someone else’s observation.' }, { status: 403 });
  }

  await deleteRepTeamOpponentObservation(teamId, observationId);
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/opponents/[opponentKey]/observations/[observationId]' });
