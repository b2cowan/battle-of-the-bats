import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { givePortalFreeTime } from '@/lib/portal-free-time-give';

/**
 * Give a free coach the Premium Coaches Portal for a set time (Support console Stage 4b, owner rulings 2026-10-27).
 * The coach is the address's `[id]` (their account), never the body; the body chooses one of the coach's own free teams
 * (`team_id`), the last free day as `YYYY-MM-DD` (`last_day`) and why (`reason`). The power is checked before anything
 * is read; every rule and refusal is `givePortalFreeTime` (lib/portal-free-time-give.ts).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('portal_free_time');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { team_id?: unknown; last_day?: unknown; reason?: unknown };
  const result = await givePortalFreeTime({
    coachUserId: id,
    teamId: body.team_id,
    lastDay: body.last_day,
    reason: body.reason,
    actor: { id: auth.user.id, email: auth.user.email!, role: auth.role },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, orgId: result.orgId, mode: result.mode, copyShort: result.copyShort ?? null });
}, { route: '/api/platform-admin/people/[id]/portal-free-time' });
