/**
 * The support console's Money tab, its rules (Support console Stage 3, owner rulings 2026-10-26; drawings A–D, G, H).
 * Plain, with no database or Stripe client, so the screen, the routes and the tests share one copy:
 *   · the shapes the server reads out of Stripe (`MoneyRead` — never stored, R7);
 *   · the five "charged twice" patterns, found from Stripe's invoices and periods, never from amounts and times alone;
 *   · our record beside Stripe's, a difference marked on its row; the agree line; the money band;
 *   · a refund's rules and every sentence it can say (fixed words, chosen from codes — never Stripe's own text).
 * The server half (reads, the refund, recovery) is `lib/console-money-stripe.ts`.
 */
import { consoleClock, consoleDay } from './console-dates';
import { formatInOrgZone, formatStoredDate } from './timezone';
import { planLabel, subscriptionStatusLabel } from './platform-labels';
import { STRIPE_FEE_WORDS, brandLabel } from './online-payment-words';
import { parseCents } from './bookkeeping-expenses';
import { isEndedSubscriptionStatus } from './stripe-billing-state';
import { joinWithAnd } from './utils';
import { PLAN_RANK } from './plan-features';
import type { OrgPlan } from './types';

// ── The shapes ──────────────────────────────────────────────────────────────────────────────────

export type MoneyRefund = {
  id: string;
  amountCents: number;
  createdAt: string;
  status: string;
  /** Our refunds record's id when the console made it (the refund's metadata), else null: made in Stripe. */
  ourRefundId: string | null;
};

export type MoneyInvoice = {
  id: string;
  number: string | null;
  billingReason: string | null;
  subscriptionId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  planId: string | null;
  cycle: string | null;
  /** A plan move's part month: the plan it moved from (its credit line), when known. */
  fromPlanId: string | null;
  /** An invoice made in Stripe's dashboard: its first line's words. */
  description: string | null;
  /** 12d-1 Part 4: FieldLogicHQ's own invoice of a club's Stripe fees (by its metadata), never "made in Stripe's dashboard". */
  feeInvoice?: boolean;
};

export type MoneyCharge = {
  id: string;
  createdAt: string;
  amountCents: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  refundedCents: number;
  disputed: boolean;
  failureCode: string | null;
  card: { brand: string; last4: string } | null;
  refunds: MoneyRefund[];
  invoice: MoneyInvoice | null;
};

export type MoneySubscription = {
  id: string;
  status: string;
  planId: string | null;
  cycle: string | null;
  amountCents: number | null;
  currency: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  cancelAtPeriodEnd: boolean;
  endedAt: string | null;
};

export type MoneyRead = {
  readAt: string;
  testMode: boolean;
  customer: { id: string; email: string | null };
  card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  subscriptions: MoneySubscription[];
  /** Newest first. */
  charges: MoneyCharge[];
  /** Where "Show older charges" reads from (the oldest charge read), or null when there are no older ones. */
  olderBefore: string | null;
  nextCharge: { amountCents: number; currency: string; at: string } | null;
};

/** Our side of the comparison: what we keep (the plan the club PAYS for, never free time's). */
export type OurMoneyRecord = {
  planId: string;
  status: string;
  currentPeriodEnd: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  /** A running whole-plan free time, shown on our side only (it is not Stripe's to agree with). */
  freeThrough: { lastDay: string; what: string } | null;
};

// ── Words ───────────────────────────────────────────────────────────────────────────────────────

/** "$100.00": a Stripe amount in its own currency (a club's subscription is not always CAD-only). */
export function formatCents(cents: number, currency = 'cad'): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'narrowSymbol' })
    .format(cents / 100);
}

/** "Visa ending 4242" (the card a refund goes back to; the drawings' words). The brand table is the product's one. */
export function cardWords(card: { brand: string; last4: string } | null): string {
  return card ? `${brandLabel(card.brand)} ending ${card.last4}` : 'the card it came from';
}

const FAILURES: Record<string, string> = {
  card_declined: 'card declined', expired_card: 'card expired', insufficient_funds: 'not enough funds',
  incorrect_cvc: 'wrong security code', processing_error: 'a processing error', authentication_required: 'needed the card holder',
  lost_card: 'card reported lost', stolen_card: 'card reported stolen',
};
export function failureWords(code: string | null): string {
  return (code && FAILURES[code]) ?? 'not paid';
}

const cycleWord = (cycle: string | null) => (cycle === 'annual' || cycle === 'year' || cycle === 'yearly' ? 'yearly' : 'monthly');
/** "Club, monthly" or "A price we do not know". */
export function planCycleWords(planId: string | null, cycle: string | null): string {
  return planId ? `${planLabel(planId)}, ${cycleWord(cycle)}` : 'A price we do not know';
}
/** "Oct 1 to Nov 1, 2026" (or "Oct 1 to Nov 1" in a sentence that already names the year). */
export function periodWords(start: string | null, end: string | null, opts: { withYear?: boolean } = {}): string | null {
  if (!start || !end) return null;
  return `${formatStoredDate(start, { withYear: false })} to ${formatStoredDate(end, { withYear: opts.withYear ?? true })}`;
}

/** A subscription Stripe may still charge (not cancelled, not abandoned before its first payment). */
export const isLiveSubscription = (status: string) => !isEndedSubscriptionStatus(status);
const periodNoun = (cycle: string | null) => (cycleWord(cycle) === 'yearly' ? 'year' : 'month');

/** What a charge paid for, in two lines: the main words and the period. */
export function paidForWords(c: MoneyCharge): { main: string; period: string | null } {
  const inv = c.invoice;
  if (!inv) return { main: 'A charge made in Stripe, not by an invoice', period: null };
  if (inv.feeInvoice) return { main: STRIPE_FEE_WORDS.paCharge(inv.number), period: null };
  if (!inv.subscriptionId) return { main: `Invoice made in Stripe${inv.description ? ` “${inv.description}”` : ''}`, period: null };
  const period = periodWords(inv.periodStart, inv.periodEnd);
  if (inv.billingReason === 'subscription_update') {
    const main = inv.fromPlanId && inv.planId
      ? `${(PLAN_RANK[inv.planId as OrgPlan] ?? 0) >= (PLAN_RANK[inv.fromPlanId as OrgPlan] ?? 0) ? 'Moved up' : 'Moved down'}: ${planLabel(inv.fromPlanId)} to ${planLabel(inv.planId)}`
      : `Plan moved${inv.planId ? ` to ${planLabel(inv.planId)}` : ''}`;
    return { main, period: period ? `${period}, part month` : null };
  }
  const first = inv.billingReason === 'subscription_create' ? ' · first charge' : '';
  return { main: `${planCycleWords(inv.planId, inv.cycle)}${first}`, period };
}

/** What Stripe says about a charge, in the console's words. */
export function stripeSaysWords(c: MoneyCharge): { text: string; tone: 'ok' | 'warn' | 'bad' | 'quiet' } {
  if (c.status === 'failed') return { text: `Failed · ${failureWords(c.failureCode)}`, tone: 'bad' };
  if (c.disputed) return { text: 'Disputed', tone: 'bad' };
  if (c.status === 'pending') return { text: 'Pending', tone: 'warn' };
  if (c.refundedCents >= c.amountCents) return { text: 'Refunded', tone: 'quiet' };
  if (c.refundedCents > 0) return { text: `Part refunded · ${formatCents(c.refundedCents, c.currency)} back`, tone: 'warn' };
  return { text: 'Paid', tone: 'ok' };
}

export const remainingCents = (c: Pick<MoneyCharge, 'amountCents' | 'refundedCents'>) => Math.max(0, c.amountCents - c.refundedCents);

// ── The five patterns (drawing B) ───────────────────────────────────────────────────────────────

export type ChargeFlag =
  | { kind: 'duplicate'; firstChargeId: string; firstAt: string }
  | { kind: 'duplicate_first' }
  | { kind: 'plan_move'; renewalAt: string | null }
  | { kind: 'retry_paid'; failedAt: string }
  | { kind: 'not_subscription'; manualInvoice: boolean }
  | { kind: 'other_subscription'; subscriptionId: string }
  | { kind: 'portal'; subscriptionId: string };

export type Patterns = {
  flags: Map<string, ChargeFlag>;
  /** Each later charge of a period paid twice, with the first. */
  duplicates: Array<{ later: MoneyCharge; first: MoneyCharge }>;
  /** Live subscriptions other than the one we know (two live subscriptions). */
  secondSubscriptions: MoneySubscription[];
};

const RENEWALS = new Set(['subscription_cycle', 'subscription_create']);

/**
 * `portalSubscriptionIds`: the club's own Coaches Portal subscriptions (a portal the club pays for bills on the club's
 * customer). They are never a second subscription, and their charges are named as the portal's.
 */
export function findPatterns(read: Pick<MoneyRead, 'charges' | 'subscriptions'>, ourSubscriptionId: string | null, portalSubscriptionIds: readonly string[] = []): Patterns {
  const portal = new Set(portalSubscriptionIds);
  const flags = new Map<string, ChargeFlag>();
  const duplicates: Patterns['duplicates'] = [];
  const oldestFirst = [...read.charges].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // 1 · The same period paid twice: two paid, not wholly refunded, renewal-type charges of ONE subscription for the same
  // period (two invoices for one month, or one invoice paid twice). Two subscriptions billing a month is pattern 2.
  const byPeriod = new Map<string, MoneyCharge[]>();
  for (const c of oldestFirst) {
    const inv = c.invoice;
    if (c.status !== 'succeeded' || remainingCents(c) === 0 || !inv?.subscriptionId || !RENEWALS.has(inv.billingReason ?? '')) continue;    if (!inv.periodStart || !inv.periodEnd) continue;
    const key = `${inv.subscriptionId}|${inv.periodStart}|${inv.periodEnd}`;
    byPeriod.set(key, [...(byPeriod.get(key) ?? []), c]);
  }
  for (const group of byPeriod.values()) {
    if (group.length < 2) continue;
    const [first, ...later] = group;
    flags.set(first.id, { kind: 'duplicate_first' });
    for (const l of later) {
      flags.set(l.id, { kind: 'duplicate', firstChargeId: first.id, firstAt: first.createdAt });
      duplicates.push({ later: l, first });
    }
  }

  // 2 · Two live subscriptions: any live one that is not ours (when we know none, every one past the first).
  const live = read.subscriptions.filter(s => isLiveSubscription(s.status) && !portal.has(s.id));
  const known = ourSubscriptionId && live.some(s => s.id === ourSubscriptionId) ? ourSubscriptionId : (live[0]?.id ?? null);
  const secondSubscriptions = live.filter(s => s.id !== known);
  const second = new Set(secondSubscriptions.map(s => s.id));

  for (const c of oldestFirst) {
    if (flags.has(c.id)) continue;
    const inv = c.invoice;
    // 5 · Not the subscription's: no invoice, or an invoice with no subscription (made in Stripe's dashboard).
    if (!inv) { flags.set(c.id, { kind: 'not_subscription', manualInvoice: false }); continue; }
    if (inv.feeInvoice) continue; // 12d-1 Part 4: our own Stripe-fees invoice, named as one; never the warning
    if (!inv.subscriptionId) { flags.set(c.id, { kind: 'not_subscription', manualInvoice: true }); continue; }
    if (portal.has(inv.subscriptionId)) { flags.set(c.id, { kind: 'portal', subscriptionId: inv.subscriptionId }); continue; }
    if (second.has(inv.subscriptionId)) { flags.set(c.id, { kind: 'other_subscription', subscriptionId: inv.subscriptionId }); continue; }
    // 3 · A plan move's part month, beside the renewal that follows it: fine, named.
    if (inv.billingReason === 'subscription_update') {
      const renewal = oldestFirst.find(r => r.invoice?.subscriptionId === inv.subscriptionId && r.invoice.billingReason === 'subscription_cycle'
        && r.invoice.periodStart != null && r.invoice.periodStart === inv.periodEnd);
      flags.set(c.id, { kind: 'plan_move', renewalAt: renewal?.invoice?.periodStart ?? null });
      continue;
    }
    // 4 · Failed, then retried: a paid charge on an invoice that failed before. Fine, named.
    if (c.status === 'succeeded') {
      const failed = oldestFirst.find(f => f.status === 'failed' && f.invoice?.id === inv.id && f.createdAt < c.createdAt);
      if (failed) flags.set(c.id, { kind: 'retry_paid', failedAt: failed.createdAt });
    }
  }
  return { flags, duplicates, secondSubscriptions };
}

/** The line under a flagged charge (drawing B). */
export function flagWords(flag: ChargeFlag): { text: string; tone: 'bad' | 'quiet' } {
  switch (flag.kind) {
    case 'duplicate': return { text: `Charged twice: the same month as the ${consoleClock(flag.firstAt)} charge`, tone: 'bad' };
    case 'duplicate_first': return { text: 'The first of the two', tone: 'quiet' };
    case 'plan_move': return { text: `Not a duplicate: a plan move’s part month${flag.renewalAt ? `, then the ${consoleDay(flag.renewalAt)} renewal` : ''}`, tone: 'quiet' };
    case 'retry_paid': return { text: `Not a duplicate: Stripe tried again after the ${consoleDay(flag.failedAt)} failure and it paid`, tone: 'quiet' };
    case 'not_subscription': return { text: flag.manualInvoice
      ? 'Not the subscription’s: a one-off invoice made in Stripe’s dashboard'
      : 'Not the subscription’s: a charge made in Stripe, not by an invoice', tone: 'quiet' };
    case 'other_subscription': return { text: `From a second subscription, ${flag.subscriptionId}`, tone: 'bad' };
    case 'portal': return { text: 'Not a duplicate: a Coaches Portal this club pays for', tone: 'quiet' };
  }
}

// ── Ours beside Stripe's (drawing A) ────────────────────────────────────────────────────────────

export type CompareRow = {
  key: 'plan' | 'status' | 'renews' | 'free' | 'subscription' | 'customer' | 'card';
  label: string;
  ours: string;
  stripe: string;
  differs: boolean;
  /** Stripe's number on this row, for an Open in Stripe link (the console builds the address). */
  stripeId?: string;
};

/** The one renewal label set (owner Q10): Renews · Trial ends · Ended · Free through. */
export function renewalLabel(status: string): 'Renews' | 'Trial ends' | 'Ended' {
  return status === 'canceled' ? 'Ended' : status === 'trialing' ? 'Trial ends' : 'Renews';
}

/** The subscription Stripe's side is read from: ours when Stripe has it, else the one live one. */
export function comparedSubscription(read: Pick<MoneyRead, 'subscriptions'>, ourSubscriptionId: string | null): MoneySubscription | null {
  return read.subscriptions.find(s => s.id === ourSubscriptionId)
    ?? read.subscriptions.find(s => isLiveSubscription(s.status))
    ?? null;
}

const day = (iso: string | null) => (iso ? formatStoredDate(iso) : null);

export function compareRecord(ours: OurMoneyRecord, read: MoneyRead | null): CompareRow[] {
  const notRead = 'Not read';
  const sub = read ? comparedSubscription(read, ours.subscriptionId) : null;
  const liveCount = read ? read.subscriptions.filter(s => isLiveSubscription(s.status)).length : 0;
  const rows: CompareRow[] = [];

  const stripePlan = !read ? notRead : sub ? `${sub.planId ? planLabel(sub.planId) : 'A price we do not know'} · ${cycleWord(sub.cycle)}` : 'No subscription';
  rows.push({ key: 'plan', label: 'Plan', ours: planLabel(ours.planId), stripe: stripePlan,
    differs: !!sub && isLiveSubscription(sub.status) && sub.planId !== ours.planId });

  rows.push({ key: 'status', label: 'Billing status', ours: subscriptionStatusLabel(ours.status),
    stripe: !read ? notRead : sub ? subscriptionStatusLabel(sub.status) : '—',
    differs: !!sub && sub.status !== ours.status });

  const label = renewalLabel(ours.status);
  const stripeEnd = sub ? (sub.status === 'canceled' ? sub.endedAt : sub.currentPeriodEnd) : null;
  rows.push({ key: 'renews', label, ours: day(ours.currentPeriodEnd) ?? 'Not set',
    stripe: !read ? notRead : (day(stripeEnd) ?? '—'),
    differs: !!sub && !!stripeEnd && (day(ours.currentPeriodEnd) ?? '') !== (day(stripeEnd) ?? '') });

  if (ours.freeThrough) {
    rows.push({ key: 'free', label: 'Free through', ours: `${formatStoredDate(ours.freeThrough.lastDay)} · ${ours.freeThrough.what}`, stripe: '', differs: false });
  }

  if (ours.subscriptionId || sub) {
    rows.push({ key: 'subscription', label: 'Stripe subscription', ours: ours.subscriptionId ?? 'None',
      stripe: !read ? notRead : sub ? `${sub.id}${liveCount === 1 && isLiveSubscription(sub.status) ? ' · the only live one' : ''}` : 'None',
      differs: !!read && !!ours.subscriptionId && !ours.subscriptionId.startsWith('mock_') && sub?.id !== ours.subscriptionId,
      stripeId: sub?.id });
  }
  if (ours.customerId) {
    rows.push({ key: 'customer', label: 'Stripe customer', ours: ours.customerId,
      stripe: !read ? notRead : `${read.customer.id}${read.customer.email ? ` · ${read.customer.email}` : ''}`,
      differs: false, stripeId: read?.customer.id });
  }
  rows.push({ key: 'card', label: 'Card on file', ours: 'Not kept here',
    stripe: !read ? notRead : read.card
      ? `${cardWords(read.card)} · expires ${String(read.card.expMonth).padStart(2, '0')}/${read.card.expYear}` : 'No card on file',
    differs: false });
  return rows;
}

/** What one "Differs" chip opens (every highlight opens on click): what that difference means, in that row's figures. */
export function differsWords(row: CompareRow, rows: CompareRow[]): string {
  const sameCause = row.key !== 'subscription' && rows.some(r => r.key === 'subscription' && r.differs)
    ? ' It likely has the same cause as the subscription difference below.' : '';
  switch (row.key) {
    case 'plan':
      return `Stripe charges the club for ${row.stripe}; the club gets what our record says, ${row.ours}. Until they agree, the club pays for one plan and uses another.${sameCause}`;
    case 'status':
      return `What the club can use follows our record (${row.ours}); its card follows Stripe (${row.stripe}).${sameCause}`;
    case 'renews':
      return `Stripe next charges the card on ${row.stripe}. Our record says ${row.ours}, so the date we show the club is not the date its card is charged.${sameCause}`;
    case 'subscription': {
      const others = rows.some(r => r.key !== 'subscription' && r.differs) ? ' The other differences above likely come from it.' : '';
      return row.stripeId
        ? `Stripe has no subscription with our record’s number, so the Stripe column shows the club’s live one instead. Our record is following a subscription Stripe is not billing.${others}`
        : `Stripe has no subscription with our record’s number, and no other subscription for this club.${others}`;
    }
    default:
      return '';
  }
}

const ROW_NAMES: Record<string, string> = { plan: 'the plan', status: 'the billing status', renews: 'the renewal date', subscription: 'the subscription' };

/** The first line of the tab (drawing A/B): the patterns first, then the comparison. */
export function agreeLine(rows: CompareRow[], patterns: Patterns, ourSubscriptionId: string | null):
  { tone: 'ok' | 'warn' | 'bad'; text: string; secondSubscriptionId?: string } {
  const differing = rows.filter(r => r.differs);
  const differ = differing.length ? `Stripe and our record disagree on ${differing.length} thing${differing.length === 1 ? '' : 's'}: ${joinWithAnd(differing.map(r => ROW_NAMES[r.key] ?? r.label.toLowerCase()))}.` : null;
  const second = patterns.secondSubscriptions[0];
  if (second) {
    const amount = second.amountCents != null ? `${formatCents(second.amountCents, second.currency ?? 'cad')} each ${periodNoun(second.cycle)}` : 'every period';
    return { tone: 'bad', secondSubscriptionId: second.id,
      text: `Stripe has two live subscriptions for this club. We know ${ourSubscriptionId ?? 'neither'}. ${second.id} also charges ${amount}, since ${consoleDay(second.createdAt)}. Cancel it in Stripe, then refund its charges here.` };
  }
  const dup = patterns.duplicates[0];
  if (dup) {
    const minutes = Math.max(1, Math.round((Date.parse(dup.later.createdAt) - Date.parse(dup.first.createdAt)) / 60_000));
    const period = periodWords(dup.first.invoice?.periodStart ?? null, dup.first.invoice?.periodEnd ?? null, { withYear: false });
    const n = patterns.duplicates.length;
    return { tone: 'bad', text: `Charged twice${period ? ` for ${period}` : ''}. Two paid charges of ${formatCents(dup.later.amountCents, dup.later.currency)} cover the same ${periodNoun(dup.first.invoice?.cycle ?? null)}, ${minutes} minute${minutes === 1 ? '' : 's'} apart.${n > 1 ? ` ${n - 1} more period${n === 2 ? ' was' : 's were'} charged twice too.` : ''} ${differ ?? 'Otherwise Stripe and our record agree.'}` };
  }
  if (differ) return { tone: 'warn', text: differ };
  return { tone: 'ok', text: 'Stripe and our record agree.' };
}

/** The joined money band (drawing A): paid 12 months · refunded · next charge. */
export function moneyBand(read: MoneyRead, since: string): Array<{ label: string; value: string; note: string; tone?: 'warn' }> {
  const window = read.charges.filter(c => c.createdAt >= since);
  const paid = window.filter(c => c.status === 'succeeded');
  const currency = paid[0]?.currency ?? read.charges[0]?.currency ?? 'cad';
  const refunds = read.charges.flatMap(c => c.refunds).filter(r => r.createdAt >= since && (r.status === 'succeeded' || r.status === 'pending'));
  const firstPaid = paid[paid.length - 1];
  return [
    { label: 'Paid, last 12 months', value: formatCents(paid.reduce((s, c) => s + c.amountCents, 0), currency),
      note: paid.length ? `${paid.length} paid charge${paid.length === 1 ? '' : 's'} since ${consoleDay(firstPaid.createdAt)}` : 'none in 12 months' },
    { label: 'Refunded', value: formatCents(refunds.reduce((s, r) => s + r.amountCents, 0), currency),
      note: refunds.length === 0 ? 'none in 12 months' : refunds.length === 1 ? `1 refund, ${consoleDay(refunds[0].createdAt)}` : `${refunds.length} refunds`,
      ...(refunds.length ? { tone: 'warn' as const } : {}) },
    read.nextCharge
      ? { label: 'Next charge', value: formatCents(read.nextCharge.amountCents, read.nextCharge.currency), note: `on ${formatStoredDate(read.nextCharge.at)}` }
      : { label: 'Next charge', value: 'None', note: read.subscriptions.some(s => isLiveSubscription(s.status) && s.cancelAtPeriodEnd) ? 'it ends at the period end' : 'no live subscription' },
  ];
}

// ── A refund's rules (drawing G, H; owner Q1, Q2) ──────────────────────────────────────────────

export const REFUND_REASON_MAX = 500;
export const BILLING_REFUND_DAILY_LIMIT = 5;
export const BILLING_REFUND_MAX_AGE_MONTHS = 6;

/** True when the words hold a 13–19 digit run (spaces or dashes allowed between digits) that passes the Luhn check. */
export function holdsCardNumber(text: string): boolean {
  for (const m of text.matchAll(/\d(?:[ -]?\d){12,22}/g)) {
    const digits = m[0].replace(/[ -]/g, '');
    for (let len = 19; len >= 13; len--) {
      for (let i = 0; i + len <= digits.length; i++) {
        if (luhn(digits.slice(i, i + len))) return true;
      }
    }
  }
  return false;
}
function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** A refund's amount as the browser sends it: whole cents, a safe integer above zero. Anything else is refused. */
export function isWholeCents(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
}

/** Dollars typed into the window, as cents ("10", "$10.50", "1,000.00"); "12,50" is refused as ambiguous. Null when not an amount. */
export function centsFromTyped(text: string): number | null {
  const cents = parseCents(text);
  return cents != null && cents > 0 ? cents : null;
}

export type RefundFacts = {
  role: string;
  /** The staff member belongs to the club (the wider check). */
  ownClub: boolean;
  demoClub: boolean;
  /** The charge as Stripe returned it, already ownership- and mode-checked by the caller. */
  charge: Pick<MoneyCharge, 'createdAt' | 'amountCents' | 'refundedCents' | 'currency' | 'status' | 'disputed'>;
  /** This person's refunds in the last 24 hours (our record: started, done or unknown). */
  refundsLast24h: number;
  now: Date;
};
export type RefundAsk = { amountCents: unknown; remainingSeenCents: unknown; reason: unknown };
export type RefundRefusal = { ok: false; status: number; error: string; field?: 'amount' | 'reason' };

export const REFUND_WORDS = {
  ownClub: 'You belong to this club, so you cannot refund its charges. Another Billing or Super admin can.',
  demo: 'This is a public demo club, so its charges are not refunded here.',
  notOurs: 'That charge is not this club’s.',
  notPaid: 'This charge was not paid, so there is nothing to refund.',
  disputed: 'This charge is disputed. A disputed charge is answered in Stripe, not refunded. No money moved.',
  fullyRefunded: 'Fully refunded. There is nothing left to refund.',
  amount: 'Enter an amount in dollars and cents, more than $0.00.',
  reasonBlank: 'Say why before refunding.',
  reasonLong: `Keep the reason under ${REFUND_REASON_MAX} characters.`,
  reasonCard: 'The reason looks like it holds a card number. Leave card details out.',
  recordFailed: 'The refund could not be recorded, so it was not sent to Stripe. No money moved. Try again in a moment.',
  noAnswer: 'Stripe did not answer. The refund may or may not have gone through. Opening the charge checks with Stripe; it never offers a second refund until it knows.',
  readFailed: 'Stripe could not be read, so nothing was sent. No money moved. Try again in a moment.',
  readerRole: 'Refunds are made by Billing or a Super admin. Hand this charge on with its number.',
} as const;

/** Stripe's definite no, in fixed words chosen from its error code (never its own text). */
export function stripeRefusalWords(code: string | null): string {
  switch (code) {
    case 'charge_already_refunded': return 'Stripe did not refund it: this charge is already refunded. No money moved.';
    case 'charge_disputed':
    case 'refund_disputed_payment': return 'Stripe did not refund it: this charge is disputed. A disputed charge is answered in Stripe, not refunded. No money moved.';
    case 'amount_too_large': return 'Stripe did not refund it: that is more than is left on the charge. No money moved.';
    case 'charge_not_refundable': return 'Stripe did not refund it: this charge cannot be refunded. No money moved.';
    default: return 'Stripe did not refund it. No money moved.';
  }
}

const monthsBefore = (now: Date, months: number) => {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
};

/** Billing's two limits (owner Q1), judged from Stripe's own charge date and our refunds record; null for a Super admin. */
export function billingLimitRefusal(role: string, chargeCreatedAt: string, refundsLast24h: number, now: Date): string | null {
  if (role !== 'billing') return null;
  if (Date.parse(chargeCreatedAt) < monthsBefore(now, BILLING_REFUND_MAX_AGE_MONTHS).getTime()) {
    const month = formatInOrgZone(chargeCreatedAt, { month: 'long', year: 'numeric' });
    return `This charge is from ${month}, more than ${BILLING_REFUND_MAX_AGE_MONTHS} months ago. A Super admin can refund it.`;
  }
  if (refundsLast24h >= BILLING_REFUND_DAILY_LIMIT) {
    return `You have made ${refundsLast24h} refunds in the last 24 hours. A Super admin can make this one.`;
  }
  return null;
}

export type DoorFacts = Pick<RefundFacts, 'role' | 'ownClub' | 'demoClub' | 'refundsLast24h' | 'now'>;

/**
 * Why this charge cannot be refunded by this person, known BEFORE the click (drawing G): the door is then absent and the
 * line says why. The window, the charges table and the server all ask this one rule. `bad` is the red line (D-1: a
 * refusal may be red) — your own club, a disputed charge; the rest are quiet facts.
 */
export function refundDoorRefusal(facts: DoorFacts, c: RefundFacts['charge']): { status: number; text: string; bad: boolean } | null {
  if (facts.role !== 'super_admin' && facts.role !== 'billing') return { status: 403, text: REFUND_WORDS.readerRole, bad: false };
  if (facts.ownClub) return { status: 403, text: REFUND_WORDS.ownClub, bad: true };
  if (facts.demoClub) return { status: 403, text: REFUND_WORDS.demo, bad: false };
  if (c.disputed) return { status: 409, text: REFUND_WORDS.disputed, bad: true };
  if (c.status !== 'succeeded') return { status: 409, text: REFUND_WORDS.notPaid, bad: false };
  if (remainingCents(c) === 0) return { status: 409, text: REFUND_WORDS.fullyRefunded, bad: false };
  const limit = billingLimitRefusal(facts.role, c.createdAt, facts.refundsLast24h, facts.now);
  return limit ? { status: 403, text: limit, bad: false } : null;
}

/**
 * Every refusal known before Stripe is asked (drawing G; the route's order step 2). Zero writes happen on any of these.
 * Ownership, mode and the in-flight hold are checked by the caller (they need reads); everything else is here.
 */
export function decideRefund(facts: RefundFacts, ask: RefundAsk): RefundRefusal | { ok: true; amountCents: number; reason: string } {
  const door = refundDoorRefusal(facts, facts.charge);
  if (door) return { ok: false, status: door.status, error: door.text };
  const c = facts.charge;
  const left = remainingCents(c);
  if (!isWholeCents(ask.amountCents)) return { ok: false, status: 400, error: REFUND_WORDS.amount, field: 'amount' };
  if (!Number.isSafeInteger(ask.remainingSeenCents) || ask.remainingSeenCents !== left) {
    return { ok: false, status: 409, field: 'amount',
      error: `Only ${formatCents(left, c.currency)} of this charge can still be refunded: it changed since you opened it. Check the amount and try again.` };
  }
  if (ask.amountCents > left) {
    return { ok: false, status: 409, field: 'amount',
      error: `Only ${formatCents(left, c.currency)} of this charge can still be refunded. Change the amount and try again.` };
  }
  const reason = typeof ask.reason === 'string' ? ask.reason.trim() : '';
  if (!reason) return { ok: false, status: 400, error: REFUND_WORDS.reasonBlank, field: 'reason' };
  if (reason.length > REFUND_REASON_MAX) return { ok: false, status: 400, error: REFUND_WORDS.reasonLong, field: 'reason' };
  if (holdsCardNumber(reason)) return { ok: false, status: 400, error: REFUND_WORDS.reasonCard, field: 'reason' };
  return { ok: true, amountCents: ask.amountCents, reason };
}

/** Stripe's reason for a refund: duplicate when the Money tab flagged the charge, else requested by the customer. Never fraudulent. */
export function stripeReasonFor(flaggedDuplicate: boolean): 'duplicate' | 'requested_by_customer' {
  return flaggedDuplicate ? 'duplicate' : 'requested_by_customer';
}
