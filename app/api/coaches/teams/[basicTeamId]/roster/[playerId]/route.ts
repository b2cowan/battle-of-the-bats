import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import {
  updateBasicCoachTeamPlayer,
  deleteBasicCoachTeamPlayer,
  normalizeBasicCoachTeamPlayerBody,
} from '@/lib/basic-coach-roster';
import { withObservability } from '@/lib/observability';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function authError(status: 401 | 403) {
  return status === 401
    ? json({ error: 'Sign in required.' }, 401)
    : json({ error: 'You do not have access to this team.' }, 403);
}

type RouteCtx = { params: Promise<{ basicTeamId: string; playerId: string }> };

/** Edit a player (partial — only provided identity fields are written; owner only). */
export const PATCH = withObservability(async (req: NextRequest, { params }: RouteCtx) => {
  try {
    const { basicTeamId, playerId } = await params;
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { input, error } = normalizeBasicCoachTeamPlayerBody(body);
    if (error) return json({ error }, 400);

    const player = await updateBasicCoachTeamPlayer({ playerId, basicCoachTeamId: basicTeamId, input });
    if (!player) return json({ error: 'Player not found.' }, 404);
    return json({ ok: true, player });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'A player first name is required.') return json({ error: message }, 400);
    console.error('[coaches roster PATCH] error:', error);
    return json({ error: 'Could not update the player.' }, 500);
  }
}, { route: '/api/coaches/teams/[basicTeamId]/roster/[playerId]' });

/** Remove a player from the master roster (owner only). */
export const DELETE = withObservability(async (_req: NextRequest, { params }: RouteCtx) => {
  try {
    const { basicTeamId, playerId } = await params;
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const removed = await deleteBasicCoachTeamPlayer({ playerId, basicCoachTeamId: basicTeamId });
    if (!removed) return json({ error: 'Player not found.' }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error('[coaches roster DELETE] error:', error);
    return json({ error: 'Could not remove the player.' }, 500);
  }
}, { route: '/api/coaches/teams/[basicTeamId]/roster/[playerId]' });
