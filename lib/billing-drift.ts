import type Stripe from 'stripe';
import { PLAN_CONFIG } from './plan-config';
import { isEndedSubscriptionStatus } from './stripe-billing-state';
import { inParallel } from './supabase-paging';
import { formatStoredDate } from './timezone';

/**
 * THE DAILY COMPARISON WITH STRIPE (Plans & pricing Stage 0, Part 11, S6; owner's go 2026-11-01). Once a day it reads every
 * subscription Stripe holds and every billing record of ours that follows one, and says where they disagree. ⚠ IT REPORTS
 * AND NEVER REPAIRS: nothing here writes a club, a portal or Stripe. The result is one row of `stripe_billing_drift_checks`
 * (mig 421; Stage 2's "Watching Stripe" tab reads it) and, when anything differs OR Stripe could not be read, one email to
 * the owner's inbox, at most once a day per outcome (owner 2026-11-01: a check that cannot reach Stripe must not be silent).
 *
 * WHAT IS COMPARED, per record (`organizations` with a subscription id: clubs AND the Coaches Portal's own workspace
 * record, which is what Plan & billing reads):
 *   · gone      the record follows a subscription Stripe does not have
 *   · status    the standing differs (both sides folded the same way: trial, past due, ended, otherwise active)
 *   · plan      the record's own plan (the stored column: free time lives in `org_overrides`, never here) against the
 *               plan of Stripe's price, a replaced price included (Part 5)
 *   · cycle     monthly against yearly
 *   · renewal   the period end, more than an hour apart
 *   · price     Stripe's price is no plan slot we have ever used (plan and cycle are then not compared)
 * and, across the account, a subscription Stripe is BILLING that nothing of ours follows (not a club, not a portal's
 * workspace row, not a club's next-season choice). Plan, cycle and renewal are not compared on a subscription that has
 * ended: the status line says it.
 *
 * WHAT IS NOT: a portal the club pays for (its workspace record holds no subscription), staff free time and Founding comps
 * (no subscription), test ids (`mock_`). Stripe is read in ONE paged pass (the default list: every subscription not
 * cancelled); a record whose subscription is not in it is retrieved by itself (a cancelled one, or one that is gone).
 * Any read that fails makes the whole day "could not compare", never a difference.
 */

export type DriftKind = 'gone' | 'status' | 'plan' | 'cycle' | 'renewal' | 'price' | 'not_followed';

/** One of our records that follows a Stripe subscription. */
export type DriftRecord = {
  orgId: string;
  name: string;
  subscriptionId: string;
  status: string | null;
  planId: string | null;
  cycle: string | null;
  periodEnd: string | null;
};

/** A Stripe subscription, shaped once. `periodEnd` in seconds, as Stripe gives it (the first item's, as the webhook reads). */
export type DriftSubscription = {
  id: string;
  status: string;
  customerId: string | null;
  priceId: string | null;
  periodEnd: number | null;
};

export type Difference = {
  kind: DriftKind;
  subscriptionId: string;
  orgId: string | null;
  name: string | null;
  ours: string | null;
  stripe: string | null;
};

export type DriftOutcome = 'equal' | 'differs' | 'could_not_compare';

export type DriftCheck = {
  outcome: DriftOutcome;
  environment: string;
  subscriptionsRead: number;
  recordsCompared: number;
  differences: Difference[];
  error: string | null;
  ownerEmailed: boolean;
};

export type PriceFacts = { planId: string; billingCycle: string } | null;

export type BillingDriftDeps = {
  environment: string;
  /** Every subscription Stripe holds that is not cancelled. Throws on a failed read or past its ceiling. */
  listSubscriptions(): Promise<DriftSubscription[]>;
  /** One subscription by id; `null` = Stripe has no such subscription. Throws on any other failure. */
  retrieveSubscription(id: string): Promise<DriftSubscription | null>;
  loadRecords(): Promise<DriftRecord[]>;
  /** Subscription ids something of ours follows that is not a `DriftRecord`: portal workspace rows, next-season choices. */
  loadFollowedElsewhere(): Promise<Set<string>>;
  /** Part 5's recognition: `null` = no slot has ever used it. Throws on a failed lookup. */
  planOfPrice(priceId: string): Promise<PriceFacts>;
  /** Sends the owner's email; true when it was sent. Never throws. */
  sendAlert(subject: string, html: string, idempotencyKey: string): Promise<boolean>;
  saveCheck(check: DriftCheck): Promise<void>;
  emailHtml: (check: DriftCheck) => string;
  now: Date;
};

/** Stripe's status and ours, folded the same way so a portal's mapped status and a club's raw one compare alike. */
export function standing(status: string | null | undefined): 'trialing' | 'past_due' | 'ended' | 'active' | 'none' {
  if (!status) return 'none';
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (isEndedSubscriptionStatus(status)) return 'ended';
  return 'active';
}

/** The statuses in which Stripe is billing someone: a subscription in one of them must be followed by a record of ours. */
const BILLING_STANDINGS = new Set(['active', 'trialing', 'past_due']);

/** More than this far apart, two renewal dates are a difference (rounding and a webhook a few seconds behind are not). */
const RENEWAL_TOLERANCE_MS = 60 * 60 * 1000;

/** Single Stripe retrievals and price lookups run this many at a time: well inside Stripe's read limit, and the day stays short. */
const READS_AT_ONCE = 4;

const ERROR_TEXT_CAP = 300;

export function shapeSubscription(sub: Stripe.Subscription): DriftSubscription {
  const item = sub.items?.data?.[0];
  return {
    id: sub.id,
    status: sub.status,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
    priceId: item?.price?.id ?? null,
    periodEnd: item?.current_period_end ?? null,
  };
}

/** The comparison itself: pure, so every kind of difference is pinned by a test. */
export function compareBillingRecords(input: {
  records: DriftRecord[];
  subscriptions: Map<string, DriftSubscription>;
  followedElsewhere: Set<string>;
  priceFacts: Map<string, PriceFacts>;
}): Difference[] {
  const { records, subscriptions, followedElsewhere, priceFacts } = input;
  const out: Difference[] = [];
  for (const r of records) {
    const at = { subscriptionId: r.subscriptionId, orgId: r.orgId, name: r.name };
    const sub = subscriptions.get(r.subscriptionId);
    if (!sub) { out.push({ kind: 'gone', ...at, ours: r.status, stripe: null }); continue; }
    const stripeStanding = standing(sub.status);
    if (standing(r.status) !== stripeStanding) out.push({ kind: 'status', ...at, ours: r.status, stripe: sub.status });
    if (stripeStanding === 'ended') continue;

    const facts = sub.priceId ? priceFacts.get(sub.priceId) ?? null : null;
    if (!facts) out.push({ kind: 'price', ...at, ours: null, stripe: sub.priceId });
    else {
      if (facts.planId !== r.planId) out.push({ kind: 'plan', ...at, ours: r.planId, stripe: facts.planId });
      if (facts.billingCycle !== r.cycle) out.push({ kind: 'cycle', ...at, ours: r.cycle, stripe: facts.billingCycle });
    }
    const stripeEnd = sub.periodEnd != null ? sub.periodEnd * 1000 : null;
    const parsedEnd = r.periodEnd ? Date.parse(r.periodEnd) : NaN;
    const ourEnd = Number.isNaN(parsedEnd) ? null : parsedEnd; // an unreadable date is "not recorded", never a silent match
    if (stripeEnd !== ourEnd && (stripeEnd == null || ourEnd == null || Math.abs(stripeEnd - ourEnd) > RENEWAL_TOLERANCE_MS)) {
      out.push({
        kind: 'renewal', ...at,
        ours: ourEnd == null ? null : new Date(ourEnd).toISOString(),
        stripe: stripeEnd == null ? null : new Date(stripeEnd).toISOString(),
      });
    }
  }

  const followed = new Set([...records.map(r => r.subscriptionId), ...followedElsewhere]);
  for (const sub of subscriptions.values()) {
    if (followed.has(sub.id) || !BILLING_STANDINGS.has(standing(sub.status))) continue;
    out.push({ kind: 'not_followed', subscriptionId: sub.id, orgId: null, name: null, ours: null, stripe: sub.customerId });
  }
  return out;
}

/**
 * One day's check. Reads, compares, emails the owner when it is not `equal`, and records the result. A failed read is
 * "could not compare" (with the error); a failed save throws, so the job's run is marked failed.
 */
export async function runBillingDriftCheck(deps: BillingDriftDeps): Promise<DriftCheck> {
  const check: DriftCheck = {
    outcome: 'equal', environment: deps.environment, subscriptionsRead: 0, recordsCompared: 0,
    differences: [], error: null, ownerEmailed: false,
  };
  try {
    const [records, followedElsewhere, listed] = await Promise.all([
      deps.loadRecords(), deps.loadFollowedElsewhere(), deps.listSubscriptions(),
    ]);
    const subscriptions = new Map(listed.map(s => [s.id, s]));
    check.subscriptionsRead = listed.length;
    const missing = [...new Set(records.map(r => r.subscriptionId))].filter(id => !subscriptions.has(id));
    for (const one of await inParallel(missing, READS_AT_ONCE, deps.retrieveSubscription)) {
      if (one) subscriptions.set(one.id, one);
    }
    const priceIds = [...new Set([...subscriptions.values()].map(s => s.priceId).filter((p): p is string => !!p))];
    const facts = await inParallel(priceIds, READS_AT_ONCE, deps.planOfPrice);
    const priceFacts = new Map<string, PriceFacts>(priceIds.map((id, i) => [id, facts[i]]));
    check.recordsCompared = records.length;
    check.differences = compareBillingRecords({ records, subscriptions, followedElsewhere, priceFacts });
    check.outcome = check.differences.length ? 'differs' : 'equal';
  } catch (e) {
    check.outcome = 'could_not_compare';
    // Capped: a gateway's whole HTML page can ride in a failed read's message, and it is stored, audited and emailed.
    check.error = (e instanceof Error ? e.message : String(e)).slice(0, ERROR_TEXT_CAP);
  }

  if (check.outcome !== 'equal') {
    // utc-intentional: a dedupe key, not a calendar answer; any fixed day boundary gives "at most once a day".
    const key = `billing-drift:${deps.environment}:${check.outcome}:${deps.now.toISOString().slice(0, 10)}`;
    check.ownerEmailed = await deps.sendAlert(driftSubject(check), deps.emailHtml(check), key);
  }
  await deps.saveCheck(check);
  return check;
}

// ── The owner's email ────────────────────────────────────────────────────────────────────────────────────────────

export function driftSubject(check: DriftCheck): string {
  if (check.outcome === 'could_not_compare') return 'Today’s billing check could not compare with Stripe';
  const n = check.differences.length;
  return `Stripe and our billing records disagree: ${n} ${n === 1 ? 'difference' : 'differences'}`;
}

const planName = (id: string | null) => (id ? PLAN_CONFIG[id as keyof typeof PLAN_CONFIG]?.label ?? id : 'none');
const cycleName = (c: string | null) => (c === 'annual' ? 'yearly' : c === 'monthly' ? 'monthly' : 'not recorded');
const dateName = (iso: string | null) => (iso ? formatStoredDate(iso) : 'not recorded');

/** One plain sentence per difference (the email and, later, the Watching Stripe tab). */
export function differenceWords(d: Difference): string {
  switch (d.kind) {
    case 'gone': return 'Our record follows a subscription Stripe does not have.';
    case 'status': return `Status: ours says ${d.ours ?? 'nothing'}, Stripe says ${d.stripe}.`;
    case 'plan': return `Plan: ours says ${planName(d.ours)}, Stripe’s price is for ${planName(d.stripe)}.`;
    case 'cycle': return `Billing: ours says ${cycleName(d.ours)}, Stripe says ${cycleName(d.stripe)}.`;
    case 'renewal': return `Renews: ours says ${dateName(d.ours)}, Stripe says ${dateName(d.stripe)}.`;
    case 'price': return d.stripe
      ? `Stripe’s price ${d.stripe} is not one of our plan prices, so the plan and billing could not be compared.`
      : 'Stripe’s subscription has no price, so the plan and billing could not be compared.';
    case 'not_followed': return `Stripe is billing a subscription that no club or Coaches Portal of ours follows (customer ${d.stripe ?? 'unknown'}).`;
  }
}

/** Past this many lines the email says how many more; the check's row keeps them all. */
export const EMAIL_LINE_CAP = 50;
