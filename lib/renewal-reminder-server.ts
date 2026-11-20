import 'server-only';
import type Stripe from 'stripe';
import { stripe } from './stripe';
import { supabaseAdmin } from './supabase-admin';
import { captureError } from './observability/capture';
import { SITE_URL } from './email';
import { sendTransactionalEmail } from './platform-email-templates';
import { orgOwnerEmails } from './notify-recipients';
import { readPendingEnding } from './plan-ending-store';
import { getPlanFromPriceId } from './stripe-prices';
import { PLAN_CONFIG } from './plan-config';
import { getBillingHref, billingUrlOrgFromRow } from './billing-urls';
import { namedTaxLines } from './billing-tax';
import { idOf } from './charge-tax-record';
import {
  DAY_MS, onePerAccount, planLineFigures, runRenewalReminder, sameInstant, REMINDER_WINDOW,
  type ReminderCandidate, type ReminderRunDeps, type ReminderStripeFacts,
} from './renewal-reminder';

/**
 * THE SENDER of the yearly renewal reminder (GST/HST Stage 6 step 6.4 Part B; rules and words in lib/renewal-reminder.ts). The daily
 * job's `renewal_reminders` step (`sendRenewalReminders`).
 *
 *   · WHO, from the stored rows before any Stripe read: an account whose own subscription is yearly (`subscription_period =
 *     'annual'`), active or trialing, with its period end (a trial's: its trial end) at most 37 days away. A coach's own
 *     Premium is one of these: its workspace's account row carries the same columns (`syncTeamWorkspaceSubscription`), so the
 *     reminder reads and stamps that row (team_workspaces.renewal_reminded_for is not used).
 *   · THE AMOUNT, from Stripe's preview of the next invoice (`invoices.createPreview({ subscription })`): its amount before tax
 *     after any discount, its taxes by name and its total. Never `amount_due`, never the plan's list price.
 *   · ⚖ NEVER throws for one account: one failure never stops the rest, and the step reports them.
 */

const ORGS = 'organizations';
const STRIPE_OPTS = { timeout: 10_000 };
/** The step stops starting new accounts after this long (the daily route's own limit is 300 s and other steps follow it). */
const BUDGET_MS = 120_000;
/** A monthly plan's next charge is never more than 31 days away, so a row with no cycle on record past this is a yearly one. */
const NO_CYCLE_MIN_DAYS = 31;
const ORG_COLUMNS = 'id, stripe_subscription_id, subscription_status, current_period_end, renewal_reminded_for';

type OrgRow = {
  id: string; stripe_subscription_id: string | null; subscription_status: string | null; current_period_end: string | null;
  renewal_reminded_for: string | null;
};

/** The accounts the stored rows say may be due (the window's far edge only: the rules decide the rest). */
async function readCandidates(now: Date): Promise<ReminderCandidate[]> {
  const at = (days: number) => new Date(now.getTime() + days * DAY_MS).toISOString();
  const billing = (fromDays: number) => supabaseAdmin.from(ORGS).select(ORG_COLUMNS)
    .not('stripe_subscription_id', 'is', null).in('subscription_status', ['active', 'trialing'])
    .gt('current_period_end', at(fromDays)).lte('current_period_end', at(REMINDER_WINDOW.latestDays))
    .order('current_period_end', { ascending: true }).limit(500);

  const [annual, noCycle] = await Promise.all([
    billing(0).eq('subscription_period', 'annual'),
    // A row with NO cycle on record (seen on dev 2026-11-13: a Coaches Portal whose first webhook arrived before its workspace
    // existed) must not miss a yearly reminder. Only past NO_CYCLE_MIN_DAYS, so a monthly plan costs no Stripe read; Stripe's
    // preview then decides whether the charge is yearly.
    billing(NO_CYCLE_MIN_DAYS).is('subscription_period', null),
  ]);
  if (annual.error) throw annual.error;
  if (noCycle.error) throw noCycle.error;
  const own: ReminderCandidate[] = ([...(annual.data ?? []), ...(noCycle.data ?? [])] as OrgRow[]).map(r => ({
    orgId: r.id, subscriptionId: r.stripe_subscription_id!, kind: r.subscription_status === 'trialing' ? 'trial' : 'renewal',
    chargeIso: r.current_period_end!, remindedFor: r.renewal_reminded_for,
  }));
  // The earlier date per account first (so the pick never flips), THEN the ones already told: they would otherwise cost a Stripe
  // read each, every day of the window, and use up the run's budget. (The reads' 500-row limit is applied before this: with over
  // 500 yearly accounts inside 37 days it would need a paged read; far from today's size.)
  return onePerAccount(own).filter(c => !sameInstant(c.remindedFor, c.chargeIso));
}

/** What Stripe says now: the subscription's status, cancel and charge date, and its preview of the next invoice. */
async function readStripe(c: ReminderCandidate): Promise<ReminderStripeFacts> {
  const sub = await stripe.subscriptions.retrieve(c.subscriptionId, {}, STRIPE_OPTS);
  const item = sub.items?.data?.[0];
  const chargeUnix = sub.status === 'trialing' ? (sub.trial_end ?? item?.current_period_end) : item?.current_period_end;
  const cancelSet = !!sub.cancel_at_period_end || !!sub.cancel_at;
  const chargeIso = chargeUnix ? new Date(chargeUnix * 1000).toISOString() : null;
  // A plan that is not billing, or whose cancel is set, is skipped by `skipAfterStripe` before any figure is read. Stripe has no
  // upcoming invoice for it, so asking for the preview would throw and count the account as a failure every day (walk §525 F9,
  // owner 2026-11-16). The figures below are never read for such a plan.
  if ((sub.status !== 'active' && sub.status !== 'trialing') || cancelSet) {
    return { status: sub.status, cancelSet, chargeIso, previewPlan: null, beforeTaxCents: 0, taxLines: [], totalCents: 0, currency: '', taxOff: false };
  }
  const preview = await stripe.invoices.createPreview({ subscription: c.subscriptionId }, STRIPE_OPTS);
  // The PLAN's lines only (/accounting 2026-11-13): a club's recovered Stripe fees queued on this subscription ride the same
  // invoice and would be in the preview's totals. The reminder is about the plan's renewal (and the invoice itemises the rest).
  const figures = planLineFigures((preview.lines?.data ?? []).map((l: Stripe.InvoiceLineItem) => ({
    parentType: l.parent?.type ?? null,
    amount: l.amount,
    discountCents: (l.discount_amounts ?? []).reduce((sum, d) => sum + d.amount, 0),
    priceId: idOf((l.pricing?.price_details?.price ?? null) as string | { id: string } | null),
    taxes: (l.taxes ?? []).map(t => ({ amount: t.amount, exclusive: t.tax_behavior === 'exclusive', taxRateId: t.tax_rate_details?.tax_rate ?? null })),
  })));
  const plan = figures.priceId ? await getPlanFromPriceId(figures.priceId) : null;
  return {
    status: sub.status,
    cancelSet,
    chargeIso,
    previewPlan: plan ? { planId: plan.planId, cycle: plan.billingCycle === 'annual' ? 'annual' : 'monthly' } : null,
    beforeTaxCents: figures.beforeTaxCents,
    taxLines: await namedTaxLines(figures.taxes.map(t => ({ amount: t.amount, tax_rate_details: t.taxRateId ? { tax_rate: t.taxRateId } : null })),
      id => stripe.taxRates.retrieve(id, {}, STRIPE_OPTS)),
    totalCents: figures.totalCents,
    currency: preview.currency,
    taxOff: !preview.automatic_tax?.enabled,
  };
}

const deps: ReminderRunDeps = {
  pendingEnding: async orgId => !!(await readPendingEnding(orgId)),
  async purchaseEmailAt(subscriptionId) {
    const { data, error } = await supabaseAdmin.from('platform_charge_tax_records').select('purchase_email_at')
      .eq('stripe_subscription_id', subscriptionId).eq('billing_reason', 'subscription_create').not('purchase_email_at', 'is', null)
      .order('purchase_email_at', { ascending: false }).limit(1).maybeSingle<{ purchase_email_at: string }>();
    if (error) throw error;
    return data?.purchase_email_at ?? null;
  },
  readStripe,
  recipients: orgOwnerEmails,
  async claim(orgId, chargeIso) {
    const { data, error } = await supabaseAdmin.from(ORGS).update({ renewal_reminded_for: chargeIso })
      .eq('id', orgId).or(`renewal_reminded_for.is.null,renewal_reminded_for.neq."${chargeIso}"`).select('id');
    if (error) throw error;
    return (data ?? []).length > 0;
  },
  async release(orgId, chargeIso, before) {
    const { error } = await supabaseAdmin.from(ORGS).update({ renewal_reminded_for: before })
      .eq('id', orgId).eq('renewal_reminded_for', chargeIso); // only our own claim
    if (error) console.error('[renewal-reminder] the claim could not be given back; the reminder is lost:', orgId, error.message);
  },
  async account(orgId) {
    const { data, error } = await supabaseAdmin.from(ORGS).select('name, slug, plan_id, account_kind').eq('id', orgId).single();
    if (error) throw error;
    const org = data as { name: string; slug: string; plan_id: string | null; account_kind: string | null };
    return { orgName: org.name, planId: org.plan_id, billingUrl: `${SITE_URL}${getBillingHref(billingUrlOrgFromRow(org))}` };
  },
  planLabel: planId => (planId && PLAN_CONFIG[planId as keyof typeof PLAN_CONFIG]?.label) || 'your plan',
  send: (to, email, idempotencyKey, orgId) => sendTransactionalEmail({
    key: 'yearly_renewal_reminder', to: to.email, vars: email.vars, defaultSubject: email.subject, defaultHtml: email.html,
    // The date, amount, cancel line and button follow a customised template's words, and its own button gives way to ours.
    fixedHtml: email.fixedHtml, fixedCarriesButton: true, orgId, idempotencyKey,
  }),
  log: (message, orgId) => {
    console.error(`[renewal-reminder] ${message}:`, orgId);
    void captureError(new Error(`renewal-reminder: ${message} (${orgId})`), { route: 'renewal-reminder' }); // a person is told, not only the log
  },
};

/**
 * The daily job's `renewal_reminders` step: every account due a yearly reminder, once per charge date. `late` counts the ones sent
 * under 30 days before the charge (the job did not run for over a week). Throws after the run when any failed, so the job's record
 * shows the step red; the next day tries them again, still in the window.
 */
export async function sendRenewalReminders(now: Date): Promise<{ sent: number; late: number; skipped: number; failed: number; unknown: number }> {
  const counts = { sent: 0, late: 0, skipped: 0, failed: 0, unknown: 0 };
  const stopAt = Date.now() + BUDGET_MS;
  for (const c of await readCandidates(now)) {
    // A slow Stripe must not use up the route's whole run and starve the steps after this one: the rest wait for tomorrow.
    if (Date.now() > stopAt) break;
    try {
      const r = await runRenewalReminder(c, deps, now);
      if (r.outcome === 'skipped') counts.skipped += 1;
      else if (r.outcome === 'not_sent') counts.failed += 1;
      else if (r.outcome === 'unknown') counts.unknown += 1;
      else {
        counts.sent += 1;
        if (r.late) counts.late += 1;
      }
    } catch (e) {
      counts.failed += 1;
      void captureError(e, { route: 'renewal-reminder' });
      console.error('[renewal-reminder]', c.orgId, e instanceof Error ? e.message : String(e));
    }
  }
  if (counts.failed > 0) throw new Error(`The yearly reminders: ${counts.failed} could not be sent, the next run tries again (${JSON.stringify(counts)})`);
  return counts;
}
