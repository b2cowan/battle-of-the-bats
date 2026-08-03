import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability, captureError } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { reconcileDemoTournament } from '@/lib/demo-reconcile';

/**
 * Demo sandbox tick — keeps the "See it live" tournament live, current and dated today.
 *
 * One scheduled call does the work of the tick, the replay reset and the nightly date
 * re-anchor, because the demo's state is a pure function of the clock (see lib/demo-reconcile.ts).
 * Run it every few minutes: the public pages already refresh on roughly a thirty-second cycle, so
 * a five-minute cadence is plenty for a visitor to watch a score move, and every run repairs
 * whatever the previous ones missed.
 *
 * Callers: the pg_cron scheduler (via x-cron-secret — the migration-183 pattern) or a
 * super-admin by hand. Same door for humans and machines, one code path, one audit trail.
 *
 * **This route alerts loudly on failure, by design.** A sandbox that has stopped ticking still
 * renders — it just shows a "live" semifinal that finished hours ago, on the one surface we point
 * strangers at as proof the product works. So a failed reconcile is reported to observability
 * (not merely logged) and returned as a 500, which is what makes the scheduler's own failure
 * tracking notice. A demo that is quietly frozen is worse than no demo.
 */

export const maxDuration = 60;

export const POST = withObservability(async (req: Request) => {
  const machine = isCronRequest(req);
  let actor = 'cron-scheduler';
  if (!machine) {
    const auth = await requireSuperAdmin();
    if (auth.response) return auth.response;
    actor = auth.user.email ?? 'platform-admin';
  }

  const result = await reconcileDemoTournament();

  // Only log runs that DID something (or failed). A tick every few minutes around the clock would
  // otherwise bury the audit log in "checked, nothing to do".
  if (!result.ok || result.gamesUpdated > 0) {
    await writePlatformAuditLog(
      actor,
      null,
      'demo_sandbox_tick',
      'result',
      null,
      {
        ok: result.ok,
        phase: result.phase,
        minuteInCycle: result.minuteInCycle,
        eventDate: result.eventDate,
        gamesUpdated: result.gamesUpdated,
        changes: result.changes,
        errors: result.errors,
      },
    );
  }

  if (!result.ok) {
    // Surface as a real error event so the demo going stale pages someone, rather than sitting
    // in a log nobody reads.
    await captureError(new Error(`Demo sandbox tick failed: ${result.errors.join('; ')}`), {
      route: '/api/platform-admin/demo-sandbox-tick',
      severity: 'error',
      requestContext: {
        phase: result.phase,
        minuteInCycle: result.minuteInCycle,
        gamesUpdated: result.gamesUpdated,
        errors: result.errors,
      },
    });
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}, { route: '/api/platform-admin/demo-sandbox-tick' });
