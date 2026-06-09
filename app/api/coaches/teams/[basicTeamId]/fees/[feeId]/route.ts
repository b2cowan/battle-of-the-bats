import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import {
  BASIC_COACH_FEE_PLAYER_SCOPE_ERROR,
  deleteBasicCoachTeamFee,
  normalizeBasicCoachTeamFeeBody,
  updateBasicCoachTeamFee,
} from '@/lib/basic-coach-fees';

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

type RouteCtx = { params: Promise<{ basicTeamId: string; feeId: string }> };

/** Edit a fee (partial; owner only). */
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId, feeId } = await params;
    if (!UUID_RE.test(basicTeamId) || !UUID_RE.test(feeId)) return json({ error: 'Fee not found.' }, 400);
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { input, error } = normalizeBasicCoachTeamFeeBody(body);
    if (error) return json({ error }, 400);

    const fee = await updateBasicCoachTeamFee({ feeId, basicCoachTeamId: basicTeamId, input });
    if (!fee) return json({ error: 'Fee not found.' }, 404);
    return json({ ok: true, fee });
  } catch (error) {
    const message = validationError(error);
    if (message) return json({ error: message }, 400);
    console.error('[coaches fees PATCH] error:', error);
    return json({ error: 'Could not update the fee.' }, 500);
  }
}

/** Remove a fee (owner only). */
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId, feeId } = await params;
    if (!UUID_RE.test(basicTeamId) || !UUID_RE.test(feeId)) return json({ error: 'Fee not found.' }, 400);
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const removed = await deleteBasicCoachTeamFee({ feeId, basicCoachTeamId: basicTeamId });
    if (!removed) return json({ error: 'Fee not found.' }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error('[coaches fees DELETE] error:', error);
    return json({ error: 'Could not remove the fee.' }, 500);
  }
}
