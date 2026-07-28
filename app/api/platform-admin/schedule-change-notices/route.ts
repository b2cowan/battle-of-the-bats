import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { sweepScheduleChangeNotices } from '@/lib/schedule-change-notices';

/**
 * Schedule-change alerts — the 5-minute sweep (Free Coach Portal B2.3).
 *
 * Sends one batched push per affected team for every queued change whose quiet window has
 * closed (or whose game is imminent enough to skip the wait). Callers: the pg_cron scheduler
 * via x-cron-secret (migration 205), or a super-admin by hand.
 *
 * Safe at any cadence and safe to double-fire: rows are claimed with a conditional update
 * before the send, so two overlapping runs cannot buzz the same follower twice. A lost tick is
 * harmless — pending rows simply ride the next one, and the quiet-window test is evaluated
 * fresh each run rather than baked into the row.
 */

// Sequential sends across every ready group. Comfortable at today's scale; the leftover cap in
// the sweep (2000 notices) bounds one run, and anything past it rides the next tick.
export const maxDuration = 300;

export const POST = withObservability(async (req: Request) => {
  const machine = isCronRequest(req);
  let actor = 'cron-scheduler';
  if (!machine) {
    const auth = await requireSuperAdmin();
    if (auth.response) return auth.response;
    actor = auth.user.email ?? 'platform-admin';
  }

  const result = await sweepScheduleChangeNotices();

  // Only log a run that actually did something — a */5 tick would otherwise write 288 empty
  // audit rows a day.
  if (result.groupsSent > 0 || result.pushesFailed > 0) {
    await writePlatformAuditLog(
      actor,
      null,
      'schedule_change_notices_sweep',
      'result',
      null,
      { ...result },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}, { route: '/api/platform-admin/schedule-change-notices' });
