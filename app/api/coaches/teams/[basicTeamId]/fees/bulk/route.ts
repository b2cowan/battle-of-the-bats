import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import {
  BASIC_COACH_FEE_NO_PLAYERS_ERROR,
  BASIC_COACH_FEE_TOO_MANY_PLAYERS_ERROR,
  createBasicCoachTeamFeesForAllPlayers,
  normalizeBasicCoachTeamFeeBody,
} from '@/lib/basic-coach-fees';
import { withObservability } from '@/lib/observability';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function authError(status: 401 | 403) {
  return status === 401
    ? json({ error: 'Sign in required.' }, 401)
    : json({ error: 'You do not have access to this team.' }, 403);
}

function validationError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : '';
  return [
    'A fee label is required.',
    'A fee amount is required.',
    BASIC_COACH_FEE_NO_PLAYERS_ERROR,
    BASIC_COACH_FEE_TOO_MANY_PLAYERS_ERROR,
  ].includes(message)
    ? message
    : null;
}

type RouteCtx = { params: Promise<{ basicTeamId: string }> };

/** Add the same fee to EVERY roster player (one independent fee each; owner only). */
export const POST = withObservability(async (req: NextRequest, { params }: RouteCtx) => {
  try {
    const { basicTeamId } = await params;
    if (!UUID_RE.test(basicTeamId)) return json({ error: 'Team not found.' }, 400);
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { input, error } = normalizeBasicCoachTeamFeeBody(body);
    if (error) return json({ error }, 400);
    if (!input.label) return json({ error: 'A fee label is required.' }, 400);
    if (input.amount === undefined) return json({ error: 'A fee amount is required.' }, 400);

    // playerId is ignored for the bulk path — the fee goes to every roster player.
    const fees = await createBasicCoachTeamFeesForAllPlayers({
      basicCoachTeamId: basicTeamId,
      createdByUserId: guard.user.id,
      input: { label: input.label, amount: input.amount, notes: input.notes ?? null },
    });
    return json({ ok: true, fees });
  } catch (error) {
    const message = validationError(error);
    if (message) return json({ error: message }, 400);
    console.error('[coaches fees bulk POST] error:', error);
    return json({ error: 'Could not add the fee to your roster.' }, 500);
  }
}, { route: '/api/coaches/teams/[basicTeamId]/fees/bulk' });
