import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import {
  BASIC_COACH_FEE_PLAYER_SCOPE_ERROR,
  createBasicCoachTeamFee,
  getBasicCoachTeamFees,
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
    BASIC_COACH_FEE_PLAYER_SCOPE_ERROR,
  ].includes(message)
    ? message
    : null;
}

type RouteCtx = { params: Promise<{ basicTeamId: string }> };

/** List the manual fee ledger for an org-less Basic coach team (owner only). */
export const GET = withObservability(async (_req: NextRequest, { params }: RouteCtx) => {
  try {
    const { basicTeamId } = await params;
    if (!UUID_RE.test(basicTeamId)) return json({ error: 'Team not found.' }, 400);
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const fees = await getBasicCoachTeamFees(basicTeamId);
    return json({ ok: true, fees });
  } catch (error) {
    console.error('[coaches fees GET] error:', error);
    return json({ error: 'Could not load your fees.' }, 500);
  }
}, { route: '/api/coaches/teams/[basicTeamId]/fees' });

/** Add a manual fee (owner only). */
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

    const fee = await createBasicCoachTeamFee({
      basicCoachTeamId: basicTeamId,
      createdByUserId: guard.user.id,
      input,
    });
    return json({ ok: true, fee });
  } catch (error) {
    const message = validationError(error);
    if (message) return json({ error: message }, 400);
    console.error('[coaches fees POST] error:', error);
    return json({ error: 'Could not add the fee.' }, 500);
  }
}, { route: '/api/coaches/teams/[basicTeamId]/fees' });
