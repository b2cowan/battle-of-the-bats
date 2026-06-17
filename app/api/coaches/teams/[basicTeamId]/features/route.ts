import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import { setBasicCoachTeamFeature, isActivatableFeature } from '@/lib/basic-coach-teams';
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

/**
 * Turn a Tier-2 team-ops feature on/off for an org-less Basic coach team (owner only).
 * Drives Coaches Portal progressive-disclosure nav visibility (mig 131 `activated_features`).
 * Body: { feature: 'roster'|'schedule'|'fees'|'announcements', active?: boolean (default true) }.
 */
export const POST = withObservability(async (req: NextRequest, { params }: RouteCtx) => {
  try {
    const { basicTeamId } = await params;
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const body = (await req.json().catch(() => ({}))) as { feature?: unknown; active?: unknown };
    const feature = typeof body.feature === 'string' ? body.feature : '';
    if (!isActivatableFeature(feature)) {
      return json({ error: 'Unknown feature.' }, 400);
    }
    const active = body.active === undefined ? true : Boolean(body.active);

    const activatedFeatures = await setBasicCoachTeamFeature(basicTeamId, feature, active);
    return json({ ok: true, activatedFeatures });
  } catch (error) {
    console.error('[coaches features POST] error:', error);
    return json({ error: 'Could not update your team tools.' }, 500);
  }
}, { route: '/api/coaches/teams/[basicTeamId]/features' });
