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
  /**
   * GST/HST Stage 2 Part 3: the tax Stripe added to this invoice, in cents (already inside the charge's amount); null when none.
   * The amount only: WHY a charge was taxed the way it was is Stage 3's record.
   */
  taxCents?: number | null;
  // GST/HST Stage 3 Part 2: the sale's own state as Stripe holds it (the list is one row per sale, an invoice). Optional so an
  // older shape (a test's literal) still reads; the server always fills them.
  /** Stripe's status: open · paid · void · uncollectible (a draft is never listed). */
  status?: string | null;
  /** When it was issued (finalized; else made). */
  issuedAt?: string | null;
  currency?: string;
  totalCents?: number;
  /** What was left to pay after credit and the customer's balance (0 = nothing to pay by card). */
  amountDueCents?: number;
  amountRemainingCents?: number;
  /** A sent invoice's due date (a club's fee invoice); null for one charged automatically. */
  dueDate?: string | null;
  markedUncollectibleAt?: string | null;
  /**
   * Plans & pricing Stage 2 Part 2: Stripe's count of tries on this bill (its retry schedule's view), and when it next tries
   * (null: none scheduled, or a sent invoice). Null count = not read. The schedule's TOTAL is never on the bill.
   */
  attemptCount?: number | null;
  nextAttemptAt?: string | null;
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
  /** The bank's decline code ("insufficient_funds"), when the bank declined it; a code, never Stripe's own text. */
  declineCode?: string | null;
  /** The bank's advice on trying again: `do_not_try_again` means Stripe's next try runs only on a new card. */
  adviceCode?: string | null;
  card: { brand: string; last4: string } | null;
  /** The words for a charge paid some way other than a card ("Link", "Bank account ending 6789"); absent for a card. */
  otherMethod?: string | null;
  refunds: MoneyRefund[];
  invoice: MoneyInvoice | null;
  /** Its payment (GST/HST Stage 3 Part 2): our tax record keeps it, so a charge joins its sale by it. */
  paymentIntentId?: string | null;
};

/** GST/HST Part 6b: a credit note on the invoice a charge paid, as the charge window lists it (read live, never stored). */
export type ChargeCreditNote = { id: string; number: string; totalCents: number; currency: string; createdAt: string; pdf: string | null };

/**
 * A Stripe credit note as the charge window lists it. `withPdf` = the reader can REFUND (owner Q2 2026-11-06, GST/HST Stage 2
 * Part 7): Stripe's PDF carries the club's billing name, address and tax details, so a role that only reads Stripe gets the note's
 * number, total and date, and `pdf: null`. Only an https link is ever handed on.
 */
export function toChargeCreditNote(
  n: { id: string; number: string; total: number; currency: string; created: number; pdf?: string | null },
  opts: { withPdf: boolean },
): ChargeCreditNote {
  return {
    id: n.id, number: n.number, totalCents: n.total, currency: n.currency,
    createdAt: new Date(n.created * 1000).toISOString(), // utc-intentional: Stripe's unix instant
    pdf: opts.withPdf && n.pdf?.startsWith('https://') ? n.pdf : null,
  };
}

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
  /** The default payment method when it is not a card ("Link · name@example.com"); absent for a card or none. */
  otherMethod?: string | null;
  subscriptions: MoneySubscription[];
  /** Newest first. */
  charges: MoneyCharge[];
  /** GST/HST Stage 3 Part 2: every invoice read (the window's, and 45 days before it), so a sale with no charge still shows. */
  invoices?: MoneyInvoice[];
  /** Where "Show older charges" reads from (the oldest charge read), or null when there are no older ones. */
  olderBefore: string | null;
  /**
   * The instant this read's charges are complete down to: the window's start, or, when the read was capped, the oldest charge
   * it reached. A sale older than this with no charge may simply have its charge unread (so the list never calls it "outside Stripe").
   */
  chargesFrom?: string;
  /** True when Stripe holds more subscriptions than the read pages through (the newest are read). */
  subscriptionsMore: boolean;
  nextCharge: NextCharge;
};

/**
 * Stripe's own preview of the next charge. `none`: no live subscription, or it ends at the period end. `unread`: Stripe
 * could not be asked, which is never "None" (Plans & pricing Stage 0, Part 8).
 */
export type NextCharge =
  /** `amountCents` is the TOTAL Stripe will charge; `taxCents` the tax inside it (GST/HST Stage 2 Part 3), null when none. */
  | { kind: 'charge'; amountCents: number; currency: string; at: string; taxCents?: number | null }
  | { kind: 'none' }
  | { kind: 'unread' };

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

/** The start of the twelve months that end at `at` (an instant): the one window Stripe's read, our records and the screen share. */
export const yearBefore = (at: string | number): string => new Date(new Date(at).getTime() - 365 * 86_400_000).toISOString(); // utc-intentional: a 12-month window of instants

// ── Words ───────────────────────────────────────────────────────────────────────────────────────

/** "$100.00": a Stripe amount in its own currency (a club's subscription is not always CAD-only). */
export function formatCents(cents: number, currency = 'cad'): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'narrowSymbol' })
    .format(cents / 100);
}

/** "$660.00 a year": a Stripe price's checked amount; null when Stripe was not read, so it is left out, never guessed. */
export function stripeAmountWords(facts: { amountCents: number | null; currency?: string | null; interval: string | null } | undefined): string | null {
  if (!facts || facts.amountCents == null || !facts.interval) return null;
  return `${formatCents(facts.amountCents, facts.currency ?? 'cad')} a ${facts.interval}`;
}

/** "Visa ending 4242" (the card a refund goes back to; the drawings' words). The brand table is the product's one. */
export function cardWords(card: { brand: string; last4: string } | null): string {
  return card ? `${brandLabel(card.brand)} ending ${card.last4}` : 'the card it came from';
}

const FAILURES: Record<string, string> = {
  card_declined: 'card declined', expired_card: 'card expired', insufficient_funds: 'not enough funds',
  incorrect_cvc: 'wrong security code', processing_error: 'a processing error', authentication_required: 'needed the card holder',
  lost_card: 'card reported lost', stolen_card: 'card reported stolen',
  // The bank's decline codes (Plans & pricing Stage 2 Part 2), each in fixed words. `fraudulent` and `pickup_card` read as a
  // plain bank decline: they are the bank's suspicion, not a fact about the club.
  do_not_honor: 'declined by the bank', generic_decline: 'card declined', fraudulent: 'declined by the bank',
  pickup_card: 'declined by the bank', transaction_not_allowed: 'declined by the bank', card_not_supported: 'card not supported',
  card_velocity_exceeded: 'over the card’s limit', withdrawal_count_limit_exceeded: 'over the card’s limit',
  invalid_account: 'card account not valid', new_account_information_available: 'card details changed',
};
export function failureWords(code: string | null): string {
  return (code && FAILURES[code]) ?? 'not paid';
}
/** A failed charge's reason: the bank's own decline code when it gave one we name, else Stripe's failure code. */
export function chargeFailureWords(c: Pick<MoneyCharge, 'failureCode' | 'declineCode'>): string {
  return (c.declineCode && FAILURES[c.declineCode]) || failureWords(c.failureCode);
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

/** The period line with the tax inside the amount, when there is one (GST/HST Stage 2 Part 3). */
function withTax(period: string | null, taxCents: number | null | undefined, currency: string): string | null {
  if (!taxCents) return period;
  const tax = `includes ${formatCents(taxCents, currency)} tax`;
  return period ? `${period} · ${tax}` : tax;
}

/** What a charge paid for, in two lines: the main words and the period. */
export function paidForWords(c: MoneyCharge): { main: string; period: string | null } {
  if (!c.invoice) return { main: 'A charge made in Stripe, not by an invoice', period: null };
  return invoicePaidForWords(c.invoice, c.currency, { withTax: true });
}

/**
 * What an invoice paid for. `withTax`: the period line carries "includes $X tax" (the shipped charge list). A sale row does not
 * (GST/HST Stage 3 Part 2, Ask 3): its Tax column names the tax, so the phrase leaves the period line.
 */
export function invoicePaidForWords(inv: MoneyInvoice, currency: string, opts: { withTax: boolean }): { main: string; period: string | null } {
  const tax = (period: string | null) => (opts.withTax ? withTax(period, inv.taxCents, currency) : period);
  if (inv.feeInvoice) return { main: STRIPE_FEE_WORDS.paCharge(inv.number), period: null };
  if (!inv.subscriptionId) return { main: `Invoice made in Stripe${inv.description ? ` “${inv.description}”` : ''}`, period: null };
  const period = periodWords(inv.periodStart, inv.periodEnd);
  if (inv.billingReason === 'subscription_update') {
    const main = inv.fromPlanId && inv.planId
      ? `${(PLAN_RANK[inv.planId as OrgPlan] ?? 0) >= (PLAN_RANK[inv.fromPlanId as OrgPlan] ?? 0) ? 'Moved up' : 'Moved down'}: ${planLabel(inv.fromPlanId)} to ${planLabel(inv.planId)}`
      : `Plan moved${inv.planId ? ` to ${planLabel(inv.planId)}` : ''}`;
    return { main, period: tax(period ? `${period}, part month` : null) };
  }
  const first = inv.billingReason === 'subscription_create' ? ' · first charge' : '';
  return { main: `${planCycleWords(inv.planId, inv.cycle)}${first}`, period: tax(period) };
}

/** What Stripe says about a charge, in the console's words. */
export function stripeSaysWords(c: MoneyCharge): { text: string; tone: 'ok' | 'warn' | 'bad' | 'quiet' } {
  if (c.status === 'failed') return { text: `Failed · ${chargeFailureWords(c)}`, tone: 'bad' };
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
  rows.push({ key: 'card', label: 'Payment method', ours: 'Not kept here',
    stripe: !read ? notRead : read.card
      ? `${cardWords(read.card)} · expires ${String(read.card.expMonth).padStart(2, '0')}/${read.card.expYear}` : (read.otherMethod ?? 'No payment method on file'),
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
    nextChargeCell(read),
  ];
}

function nextChargeCell(read: MoneyRead): ReturnType<typeof moneyBand>[number] {
  const next = read.nextCharge;
  const cell = (value: string, note: string, tone?: 'warn') => ({ label: 'Next charge', value, note, ...(tone ? { tone } : {}) });
  switch (next.kind) {
    // The total, tax included: the figure Stripe will charge (GST/HST Stage 2 Part 3).
    case 'charge': return cell(formatCents(next.amountCents, next.currency),
      `on ${formatStoredDate(next.at)}${next.taxCents ? `, includes ${formatCents(next.taxCents, next.currency)} tax` : ''}`);
    case 'unread': return cell('Not read', 'Stripe could not be asked for the next charge. Read again.', 'warn');
    case 'none': return cell('None',
      read.subscriptions.some(s => isLiveSubscription(s.status) && s.cancelAtPeriodEnd) ? 'it ends at the period end' : 'no live subscription');
  }
}

/** Under the subscription when Stripe holds more than the read pages through. */
export function subscriptionsMoreWords(read: number): string {
  return `This customer has more than ${read} subscriptions in Stripe. The newest ${read} were read; open the customer in Stripe to see the rest.`;
}

// ── A failed payment (Plans & pricing Stage 2 Part 2; drawing tab 9's notice, read only) ─────────────────────────
// Read from the bills and charges the tab already reads (no second call). Stripe reports the tries made and the next one;
// the schedule's total is a dashboard setting it never reports, so no "of 4" is ever said.

/** When Stripe tries the bill next, as far as the bill and the bank's advice say. */
export type NextTry =
  | { kind: 'at'; at: string }
  /** The date is already behind the read: never shown as coming. */
  | { kind: 'was_due'; at: string }
  /** No try scheduled: whether Stripe used up its tries or retries are off, the bill does not say. */
  | { kind: 'none' }
  /** The bank said not to try this card again: Stripe keeps a date but runs it only on a new card (Stripe's own rule). */
  | { kind: 'new_card'; at: string | null };

export type FailedBill = {
  invoiceId: string;
  /** What is still owed on it. */
  amountCents: number;
  currency: string;
  /** The tax inside the amount, only when the amount is the whole bill (a part-paid bill's tax is not the remainder's). */
  taxCents: number | null;
  /** The newest failed charge, or null when Stripe tried but no failed charge was read (a card that needed its holder). */
  failedAt: string | null;
  reason: string | null;
  /** Stripe's own count; null when it did not report one (never a count of our own). */
  tries: number | null;
  next: NextTry;
  issuedAt: string | null;
};

export function nextTry(inv: Pick<MoneyInvoice, 'nextAttemptAt'>, lastFailed: Pick<MoneyCharge, 'adviceCode'> | null, readAt: string): NextTry {
  const at = inv.nextAttemptAt ?? null;
  const behind = !!at && Date.parse(at) < Date.parse(readAt);
  // A date already behind the read is not said on a new-card bill ("the Nov 3 try runs only on a new card" reads as if still ahead).
  if (lastFailed?.adviceCode === 'do_not_try_again') return { kind: 'new_card', at: behind ? null : at };
  if (!at) return { kind: 'none' };
  return behind ? { kind: 'was_due', at } : { kind: 'at', at };
}

/**
 * One bill as a failed payment, or null: open, something still owed, nothing on its way, and tried at least once (a failed
 * charge, or Stripe's count). A sent bill not yet tried is owed, not failed; a written-off or void bill is closed.
 * `charges`: the bill's own charges.
 */
export function failedBillOf(inv: MoneyInvoice, charges: readonly MoneyCharge[], readAt: string): FailedBill | null {
  if (inv.status !== 'open') return null;
  const total = inv.totalCents ?? 0;
  const owed = inv.amountRemainingCents ?? total;
  if (owed <= 0 || charges.some(c => c.status === 'pending')) return null;
  const failed = charges.filter(c => c.status === 'failed').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const tries = inv.attemptCount != null && inv.attemptCount > 0 ? inv.attemptCount : null;
  if (!failed.length && !tries) return null;
  const last = failed[failed.length - 1] ?? null;
  return {
    invoiceId: inv.id, amountCents: owed, currency: inv.currency ?? last?.currency ?? 'cad',
    taxCents: owed === total ? inv.taxCents ?? null : null,
    failedAt: last?.createdAt ?? null, reason: last ? chargeFailureWords(last) : null,
    tries, next: nextTry(inv, last, readAt), issuedAt: inv.issuedAt ?? null,
  };
}

/** Every failed bill in the read, newest first. */
export function failedBills(read: Pick<MoneyRead, 'invoices' | 'charges' | 'readAt'>): FailedBill[] {
  return (read.invoices ?? [])
    .map(inv => failedBillOf(inv, read.charges.filter(c => c.invoice?.id === inv.id), read.readAt))
    .filter((b): b is FailedBill => !!b)
    .sort((a, b) => (b.issuedAt ?? '').localeCompare(a.issuedAt ?? ''));
}

const timesWord = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** "Stripe has tried once and tries again on Jan 6.": the tries made and the next one, never a total. */
export function triesWords(bill: Pick<FailedBill, 'tries' | 'next'>): string {
  const t = bill.tries ? `Stripe has tried ${timesWord(bill.tries)}` : null;
  const next = bill.next;
  switch (next.kind) {
    case 'at': return `${t ? `${t} and tries` : 'Stripe tries'} again on ${consoleDay(next.at)}.`;
    case 'was_due': return `${t ? `${t}. It` : 'Stripe'} was due to try again on ${consoleDay(next.at)}. Read again for the result.`;
    case 'none': return `${t ? `${t}. It has` : 'Stripe has'} no further try scheduled.`;
    // "Only on a new card" stays true after the club has added one (the bank's advice is on the old card, and the bill cannot say which card is now on file).
    case 'new_card': return `${t ? `${t}. ` : ''}The bank said not to try this card again, so ${next.at
      ? `Stripe’s ${consoleDay(next.at)} try runs only on a new card` : 'Stripe tries again only on a new card'}.`;
  }
}

/** The sale row's second line under a failed bill. */
export function nextTryShort(next: NextTry): string {
  switch (next.kind) {
    case 'at': return `Stripe tries again ${consoleDay(next.at)}`;
    case 'was_due': return `Next try was due ${consoleDay(next.at)}`;
    case 'none': return 'No further try scheduled';
    case 'new_card': return 'Tries again only on a new card';
  }
}

export const FAILED_WORDS = {
  seeBill: 'See the bill',
  showThem: 'Show them',
  // `past_due` keeps working (lib/org-billing-access.ts): said only when our record says Past due.
  pastDue: 'The club is past due and keeps using everything meanwhile.',
  more: (n: number) => `${n} more bill${n === 1 ? ' is' : 's are'} unpaid too.`,
} as const;

/** The notice at the top of the tab: a bold lead, then the rest. `pastDue`: our record's status is past due. */
export function failedStoryWords(bill: FailedBill, opts: { pastDue: boolean; more: number }): { lead: string; text: string } {
  const amount = formatCents(bill.amountCents, bill.currency);
  const lead = bill.failedAt ? `The ${consoleDay(bill.failedAt)} payment of ${amount} failed` : `A payment of ${amount} did not go through`;
  const parts = [
    `${bill.reason ? `: ${bill.reason}` : ''}.`,
    bill.taxCents ? ` It includes ${formatCents(bill.taxCents, bill.currency)} tax.` : '',
    ` ${triesWords(bill)}`,
    opts.pastDue ? ` ${FAILED_WORDS.pastDue}` : '',
    opts.more > 0 ? ` ${FAILED_WORDS.more(opts.more)}` : '',
  ];
  return { lead, text: parts.join('') };
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
/**
 * `beforeTaxCents`: the credit note's before-tax figure the window showed (GST/HST Part 6b, R1), sent back with the card
 * figure it previewed; the server plans the note again and refuses when Stripe's answer moved. Ignored for a charge that
 * paid no invoice (R3).
 */
export type RefundAsk = { amountCents: unknown; remainingSeenCents: unknown; reason: unknown; beforeTaxCents?: unknown };
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
  // The tab's own read has not succeeded yet, so who may refund is not known: say so rather than naming a role.
  tabNotRead: 'Read this tab again to see whether this charge can be refunded.',
  // GST/HST Stage 2 Part 6b: a charge that paid an invoice is refunded through a credit note (owner R1–R3 2026-11-05).
  manyInvoices: 'This charge paid more than one invoice, so it cannot be refunded here. Refund it in Stripe. No money moved.',
  invoiceNotPaid: 'Stripe does not show this charge’s invoice as paid, so it cannot be refunded here. Refund it in Stripe. No money moved.',
  manyPayments: 'This charge’s invoice was paid by more than one payment, so it cannot be refunded here. Refund it in Stripe. No money moved.',
  nothingToCredit: 'This charge’s invoice has nothing left to credit, so it cannot be refunded here. No money moved.',
  noteNotWorkedOut: 'Stripe could not work out a credit note for that amount. Change the amount and try again. No money moved.',
  noteChanged: 'Stripe’s credit note for this amount changed since you opened it. Check the amount and try again. No money moved.',
  noteReadFailed: 'Stripe could not work out the credit note just now. Try again in a moment.',
  noteInvoiceGone: 'Stripe shows no invoice behind this charge just now, so no credit note can be made. Close this window and open the charge again.',
  noInvoice: 'This charge paid no invoice, so there is no credit note.',
} as const;

/** "$88.50 for the plan + $11.51 HST 13%": a credit note's split, in the refund window (R1). */
export function creditSplitWords(beforeTaxCents: number, taxLines: ReadonlyArray<{ label: string; cents: number }>, currency: string, feeInvoice: boolean): string {
  const what = `${formatCents(beforeTaxCents, currency)} for the ${feeInvoice ? 'Stripe fees' : 'plan'}`;
  return [what, ...taxLines.map(t => `${formatCents(t.cents, currency)} ${t.label}`)].join(' + ');
}

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
