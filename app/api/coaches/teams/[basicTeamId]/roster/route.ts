import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import {
  getBasicCoachTeamPlayers,
  createBasicCoachTeamPlayer,
  normalizeBasicCoachTeamPlayerBody,
} from '@/lib/basic-coach-roster';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function authError(status: 401 | 403) {
  return status === 401
    ? json({ error: 'Sign in required.' }, 401)
    : json({ error: 'You do not have access to this team.' }, 403);
}

type RouteCtx = { params: Promise<{ basicTeamId: string }> };

/** List the master roster for an org-less Basic coach team (owner only). */
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId } = await params;
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const players = await getBasicCoachTeamPlayers(basicTeamId);
    return json({ ok: true, players });
  } catch (error) {
    console.error('[coaches roster GET] error:', error);
    return json({ error: 'Could not load your roster.' }, 500);
  }
}

/** Add a player to the master roster (identity fields only; owner only). */
export async function POST(req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId } = await params;
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { input, error } = normalizeBasicCoachTeamPlayerBody(body);
    if (error) return json({ error }, 400);
    if (!input.name) return json({ error: 'A player name is required.' }, 400);

    const player = await createBasicCoachTeamPlayer({
      basicCoachTeamId: basicTeamId,
      createdByUserId: guard.user.id,
      input,
    });
    return json({ ok: true, player });
  } catch (error) {
    console.error('[coaches roster POST] error:', error);
    return json({ error: 'Could not add the player.' }, 500);
  }
}
