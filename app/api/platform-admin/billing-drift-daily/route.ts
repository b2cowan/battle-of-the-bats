import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { runTodaysBillingDriftCheck } from '@/lib/billing-drift-server';

/**
 * THE DAILY COMPARISON WITH STRIPE (Plans & pricing Stage 0, Part 11, S6; owner's go 2026-11-01). One step: read every
 * Stripe subscription and every billing record of ours that follows one, record where they disagree, and email the owner
 * when they do or when Stripe could not be read (`lib/billing-drift.ts`). ⚠ READ-ONLY: it repairs nothing.
 *
 * Callers: the pg_cron scheduler (daily, via x-cron-secret; mig 422) or a person with `run_jobs`, by hand.
 */
export const maxDuration = 300;

type Step = { step: string; ok: boolean; result?: unknown; error?: string };

export const POST = withObservability(async (req: Request) => {
  let actor = 'cron-scheduler';
  if (!isCronRequest(req)) {
    const auth = await requirePlatformPower('run_jobs');
    if (auth.response) return auth.response;
    actor = auth.user.email ?? 'platform-admin';
  }
  const steps: Step[] = [];
  try {
    const check = await runTodaysBillingDriftCheck(new Date());
    const result = {
      outcome: check.outcome, differences: check.differences.length, subscriptionsRead: check.subscriptionsRead,
      recordsCompared: check.recordsCompared, ownerEmailed: check.ownerEmailed,
    };
    // A check that could not compare is a failed step, not a green 200: the job's health reading must see it.
    steps.push(check.outcome === 'could_not_compare'
      ? { step: 'billing_drift', ok: false, result, error: check.error ?? 'could not compare' }
      : { step: 'billing_drift', ok: true, result });
  } catch (e) {
    console.error('[billing-drift-daily] failed:', e);
    steps.push({ step: 'billing_drift', ok: false, error: e instanceof Error ? e.message : 'failed' });
  }

  await writePlatformAuditLog(actor, null, 'billing_drift_check', 'result', null, steps);
  const ok = steps.every(s => s.ok);
  return NextResponse.json({ ok, steps }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/billing-drift-daily' });
