import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import {
  normalizeBasicCoachInterestOptions,
  submitBasicCoachTeamScopeInterest,
} from '@/lib/basic-coach-interest';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function authError(status: 401 | 403) {
  return status === 401
    ? json({ error: 'Sign in required.' }, 401)
    : json({ error: 'You do not have access to this team.' }, 403);
}

type RouteCtx = { params: Promise<{ basicTeamId: string }> };

/** Capture coach interest in beyond-Basic team tools (owner only; no checkout/unlock). */
export async function POST(req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId } = await params;
    if (!UUID_RE.test(basicTeamId)) return json({ error: 'Team not found.' }, 400);

    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const interests = normalizeBasicCoachInterestOptions(body.interests);
    if (interests.length === 0) return json({ error: 'Choose at least one area.' }, 400);

    await submitBasicCoachTeamScopeInterest({
      basicCoachTeamId: basicTeamId,
      userEmail: guard.user.email,
      interests,
      userAgent: req.headers.get('user-agent'),
    });

    return json({ ok: true });
  } catch (error) {
    console.error('[coaches team interest POST] error:', error);
    return json({ error: 'Could not save your interest.' }, 500);
  }
}
