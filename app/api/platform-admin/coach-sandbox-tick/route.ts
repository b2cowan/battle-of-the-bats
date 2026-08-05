import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability, captureError } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { reconcileCoachSandbox } from '@/lib/demo-coach-reconcile';

/**
 * Coach sandbox tick — keeps the coach demo's calendar true: the 11U's tryout is always TODAY,
 * the 12U's next game always THIS Saturday (COACH_SANDBOX_SEASON_PHASES_PLAN.md, Phase 1).
 *
 * Nightly, not every-two-minutes: nothing in the coach demo moves while you watch (the chrome
 * deliberately makes no motion claims), so the only thing that can go stale is the date — and a
 * date goes stale exactly once a day. The reconcile is stateless and diff-only, so a missed
 * night is repaired in full by the next run. See `lib/demo-coach-reconcile-core.ts`.
 *
 * Callers: the pg_cron scheduler (x-cron-secret, migration 183's pattern) or a super-admin by
 * hand. **Alerts loudly on failure**: a stale coach demo still renders — it just says the tryout
 * was yesterday, on a surface we point strangers at — so a failed reconcile is reported to
 * observability and returned as a 500, and the once-a-year "the calendar rolled over, reseed the
 * closed season" condition surfaces the same way rather than rotting quietly.
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

  const result = await reconcileCoachSandbox();

  // Only log runs that DID something (or failed) — steady-state nights stay out of the audit log.
  if (!result.ok || result.rowsShifted > 0) {
    await writePlatformAuditLog(
      actor,
      null,
      'coach_sandbox_tick',
      'result',
      null,
      {
        ok: result.ok,
        seeded: result.seeded,
        tryoutShiftDays: result.tryoutShiftDays,
        midSeasonShiftDays: result.midSeasonShiftDays,
        rowsShifted: result.rowsShifted,
        notes: result.notes,
        errors: result.errors,
      },
    );
  }

  if (!result.ok) {
    await captureError(new Error(`Coach sandbox tick failed: ${result.errors.join('; ')}`), {
      route: '/api/platform-admin/coach-sandbox-tick',
      severity: 'error',
      requestContext: {
        seeded: result.seeded,
        rowsShifted: result.rowsShifted,
        errors: result.errors,
      },
    });
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}, { route: '/api/platform-admin/coach-sandbox-tick' });
