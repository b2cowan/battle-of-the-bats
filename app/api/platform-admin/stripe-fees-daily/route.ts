import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { bookLostDisputesSweep, sendDisputeReminders } from '@/lib/online-payment-landing';
import { sendEndingWarnings, sendTermsNotices } from '@/lib/online-payment-owner-notices';
import { countOverdueEndings, sendEndingEmails } from '@/lib/plan-ending-server';
import { backfillChargeTaxRecords, catchUpChargeTaxRecords } from '@/lib/charge-tax-record-server';
import { catchUpPurchaseEmails } from '@/lib/purchase-details-server';
import { sendRenewalReminders } from '@/lib/renewal-reminder-server';

/**
 * THE ONLINE-PAYMENTS DAILY JOB (Club Tier Stage 12d-1 Part 4; owner 2026-10-27, the build's ask 2: one new daily job).
 * Each step is decided from the rows and a once-only stamp, so it is safe to run any time and a run that stopped part-way
 * finishes on the next (a double-fire sends nothing twice).
 *
 * ⚠ The path, the pg_cron job that calls it (`stripe_fees_tick`, mig 395, WATCHED AUTOMATION) and the audit action
 * `stripe_fees_sweep` (the GST/HST worksheet finds the backfill's marker by it) keep their "stripe fees" names on purpose.
 * The six steps that billed clubs for Stripe's extras were retired by Stripe-owned pricing Stage 4 (2026-11-18): Stripe now
 * takes those from the club's own balance. In order:
 *   1. the dispute email three days before it is due, while unanswered (words §1.6 email 2);
 *   2. (Part 4b) a card dispute lost before its payment landed, whose booking at the landing failed;
 *   3. (12d-2, owner ruling 4) the payments terms changed: the owners' item and one email the day a club is found behind,
 *      one reminder 14 days later (nothing while the version is the placeholder draft);
 *   4. (12d-2) an ending the owner didn't choose: the owners' item and one email (seven days before a comp runs out; the
 *      day a subscription payment fails), and the open pay pages of a club whose plan no longer offers online payments
 *      closed (free time runs out with no event of its own);
 *   5. (Plans end at the renewal date, Part C, G6) a cancel that waits: the "ends on" email a failed send left owed, and
 *      the ONE reminder seven days before the end — each stamped once on its row;
 *   6. (G3) the endings Stripe hasn't finished — a cancel still waiting more than three days past its date — counted on
 *      this job's record. Never acted on here: a platform admin finishes each from the club's record, after Stripe is read;
 *   7. (GST/HST Stage 3 Part 1) every invoice and credit note Stripe made in the last 35 days that has no tax record gets one
 *      (a missed or failed webhook event), and every record still open has its payment state re-read; then
 *   7b. (GST/HST 6.4) the purchase email still owed by an invoice paid in the last three days (a webhook that failed or never
 *      arrived), through the same send as the webhook — once only, on the record's stamp; then
 *   7c. (GST/HST 6.4 Part B) the yearly reminder: every owner of a yearly plan, 30 to 37 days before its next charge (a renewal, a
 *      yearly trial ending, a yearly next-season choice's first charge), the date and the amount with its tax as Stripe would charge
 *      it — once per charge date, on the account's stamp; under 30 days and still untold, it goes anyway and is counted `late`; then
 *   8. (Stage 4 Ask 11, owner 2026-11-06) the BACKFILL: invoices and credit notes from 2026-05-01 up to the first record the webhook
 *      wrote, 120 a run until none is missing.
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
  await run('lost_disputes', () => bookLostDisputesSweep(now));
  await run('terms_notices', () => sendTermsNotices(now));
  await run('ending_warnings', () => sendEndingWarnings(now));
  await run('plan_ending_emails', () => sendEndingEmails(now));
  await run('overdue_endings', () => countOverdueEndings(now));
  await run('tax_records', () => catchUpChargeTaxRecords(now));
  await run('purchase_emails', () => catchUpPurchaseEmails(now));
  await run('renewal_reminders', () => sendRenewalReminders(now));
  await run('tax_records_backfill', () => backfillChargeTaxRecords(now));

  await writePlatformAuditLog(actor, null, 'stripe_fees_sweep', 'result', null, steps);
  const ok = steps.every(s => s.ok);
  return NextResponse.json({ ok, steps }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/stripe-fees-daily' });
