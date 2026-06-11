import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import { reorderBasicCoachTeamPlayers } from '@/lib/basic-coach-roster';
import { withObservability } from '@/lib/observability';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function authError(status: 401 | 403) {
  return status === 401
    ? json({ error: 'Sign in required.' }, 401)
    : json({ error: 'You do not have access to this team.' }, 403);
}

type RouteCtx = { params: Promise<{ basicTeamId: string }> };

/** Persist a new player display order (owner only). Body: { orderedIds: string[] }. */
export const POST = withObservability(async (req: NextRequest, { params }: RouteCtx) => {
  try {
    const { basicTeamId } = await params;
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const body = (await req.json().catch(() => ({}))) as { orderedIds?: unknown };
    if (!Array.isArray(body.orderedIds)) {
      return json({ error: 'orderedIds (string[]) is required.' }, 400);
    }
    // The client always sends the full reordered set. Bound the work (one team-scoped UPDATE per
    // id) so a hand-crafted payload can't force tens of thousands of writes, and de-dupe so a
    // repeated id can't be written twice. Foreign ids are already harmless no-ops (team-scoped).
    const MAX_REORDER = 500; // no realistic Basic roster approaches this
    const orderedIds = Array.from(
      new Set(body.orderedIds.filter((id): id is string => typeof id === 'string')),
    );
    if (orderedIds.length > MAX_REORDER) {
      return json({ error: 'Too many players to reorder at once.' }, 400);
    }

    await reorderBasicCoachTeamPlayers({ basicCoachTeamId: basicTeamId, orderedIds });
    return json({ ok: true });
  } catch (error) {
    console.error('[coaches roster reorder POST] error:', error);
    return json({ error: 'Could not save the new order.' }, 500);
  }
}, { route: '/api/coaches/teams/[basicTeamId]/roster/reorder' });
