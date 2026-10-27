import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { bookLostDisputesSweep, sendDisputeReminders } from '@/lib/online-payment-landing';
import {
  releaseStrandedSubscriptionFees, remindUnpaidFeeInvoices, retryFailedFees, sendMonthlyFeeInvoices, sweepDisputeFees, syncOpenFeeInvoices,
} from '@/lib/platform-stripe-fees';

/**
 * THE ONLINE-PAYMENTS DAILY JOB (Club Tier Stage 12d-1 Part 4; owner 2026-10-27, the build's ask 2: one new daily job).
 * Each step is decided from the rows and a once-only stamp, so it is safe to run any time and a run that stopped part-way
 * finishes on the next (a double-fire sends nothing twice). In order:
 *   1. the dispute email three days before it is due, while unanswered (words §1.6 email 2);
 *   2. Stripe's dispute fees posted after the events stopped (an answering fee, or its return on a win);
 *   3. a retry of every fee whose billing failed (a passing Stripe error);
 *   4. Stripe's own state of every invoice still open (a missed webhook never leaves one unpaid on our side);
 *   5. (ruling 6) a fee whose line is still pending on a subscription that can no longer carry it, taken off it and
 *      returned to unbilled, before
 *   6. the club's own monthly invoice, gathering last month's fees — sent on the 1st, or the first run after it;
 *   7. the ONE reminder on an invoice past due (§7 ruling 3). Nothing switches off by itself;
 *   8. (Part 4b) a card dispute lost before its payment landed, whose booking at the landing failed.
 * One step's failure never stops the next.
 *
 * Callers: the pg_cron scheduler (daily, via x-cron-secret) or a person with `run_jobs`, by hand.
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
  const now = new Date();
  const steps: Step[] = [];
  const run = async (step: string, fn: () => Promise<unknown>) => {
    try { steps.push({ step, ok: true, result: await fn() }); }
    catch (e) {
      console.error(`[stripe-fees-daily] ${step} failed:`, e);
      steps.push({ step, ok: false, error: e instanceof Error ? e.message : 'failed' });
    }
  };
  await run('dispute_reminders', () => sendDisputeReminders(now));
  await run('dispute_fees', () => sweepDisputeFees(now));
  await run('retry_fees', () => retryFailedFees());
  await run('sync_invoices', () => syncOpenFeeInvoices());
  await run('stranded_fees', () => releaseStrandedSubscriptionFees(now));
  await run('monthly_invoices', () => sendMonthlyFeeInvoices(now));
  await run('invoice_reminders', () => remindUnpaidFeeInvoices(now));
  await run('lost_disputes', () => bookLostDisputesSweep(now));

  await writePlatformAuditLog(actor, null, 'stripe_fees_sweep', 'result', null, steps);
  const ok = steps.every(s => s.ok);
  return NextResponse.json({ ok, steps }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/stripe-fees-daily' });
