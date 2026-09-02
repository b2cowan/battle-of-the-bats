import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability, captureError } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { reconcileDemoTournament } from '@/lib/demo-reconcile';

/**
 * Demo sandbox tick — keeps the "See it live" tournament current and dated today.
 *
 * As of the 2026-09-02 daily-snapshot rewrite, this is a nightly date re-anchor, not a live-score
 * tick — the demo's state is a fixed function of the calendar day (see lib/demo-reconcile.ts), so
 * one run a day is all this ever needs to do; every run still repairs whatever a previous one
 * missed.
 *
 * Callers: the pg_cron scheduler (via x-cron-secret — the migration-183 pattern) or a
 * super-admin by hand. Same door for humans and machines, one code path, one audit trail.
 *
 * **This route alerts loudly on failure, by design.** A sandbox that has stopped re-anchoring
 * still renders — it just shows a tournament dated in the past, on the one surface we point
 * strangers at as proof the product works. So a failed reconcile is reported to observability
 * (not merely logged) and returned as a 500, which is what makes the scheduler's own failure
 * tracking notice. A demo that is quietly stale is worse than no demo.
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
        eventDate: result.eventDate,
        gamesUpdated: result.gamesUpdated,
        errors: result.errors,
      },
    });
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}, { route: '/api/platform-admin/demo-sandbox-tick' });
