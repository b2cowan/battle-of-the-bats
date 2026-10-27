// No `server-only` marker on purpose: this module holds no key and no client (every function takes its Stripe client and
// its store as arguments), so the refund guards can run the real code against fakes. The routes are the server's.
import type Stripe from 'stripe';
import {
  REFUND_WORDS, decideRefund, formatCents, cardWords, remainingCents, stripeReasonFor, stripeRefusalWords,
  type MoneyCharge, type MoneyInvoice, type MoneyRead, type MoneyRefund, type MoneySubscription, type RefundAsk,
} from './console-money';
import { FEE_INVOICE_META } from './online-payment-words';

/**
 * The Money tab's server half (Support console Stage 3; owner Q1–Q4 2026-10-26; drawings A–C, G, H). Stripe is read live
 * when the tab opens and nothing it returns is stored (R7, Q4 A). A refund is a money write, in a fixed order:
 *   1. the refunds record, written as `started` BEFORE Stripe is asked — if it cannot be written, Stripe never is (T10);
 *   2. ONE Stripe call, its idempotency key our record's id, the amount always explicit, our id in its metadata;
 *   3. the record completed with Stripe's answer: done · refused (a definite 4xx only) · unknown (a timeout or a 5xx).
 * Recovery never re-sends: it LISTS the charge's refunds and looks for our id (Stripe prunes keys after ~24 h, so a second
 * request could make a second refund). Everything here takes its Stripe client and its store as arguments, so the guards
 * run it against mocks with no network.
 */

/** Each read's time limit; a refund's own limit is longer (it must not be cut short into "unknown" needlessly). */
export const READ_OPTS = { timeout: 8000, maxNetworkRetries: 1 } as const;
// The refund route has 60 seconds: two reads (8 s, one retry each) and the refund (15 s, one same-key retry) fit inside it.
export const REFUND_OPTS = { timeout: 15000, maxNetworkRetries: 1 } as const;
/** An unfinished refund older than this cannot still be running (the route's limit is 60 s): recovery may decide it. */
export const RECOVERY_AFTER_MS = 5 * 60_000;
const PAGE = 100;
const MAX_PAGES = 3;
const DAY = 86_400_000;

export type PriceMap = Map<string, { planId: string; cycle: string }>;

const idOf = (v: string | { id: string } | null | undefined): string | null => (v == null ? null : typeof v === 'string' ? v : v.id);
const iso = (unix: number | null | undefined): string | null => (unix ? new Date(unix * 1000).toISOString() : null); // utc-intentional: Stripe's unix instants
/** A customer that has not been deleted in Stripe, or null. */
const liveCustomer = (c: Stripe.Customer | Stripe.DeletedCustomer): Stripe.Customer | null => ('deleted' in c && c.deleted ? null : (c as Stripe.Customer));

// ── Normalising what Stripe returns (only the fields the console shows; never card numbers, names or fingerprints) ──

export function toMoneySubscription(s: Stripe.Subscription, prices: PriceMap): MoneySubscription {
  const item = s.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const known = priceId ? prices.get(priceId) : undefined;
  return {
    id: s.id,
    status: s.status,
    planId: known?.planId ?? null,
    cycle: known?.cycle ?? (item?.price?.recurring?.interval === 'year' ? 'annual' : item?.price?.recurring?.interval ? 'monthly' : null),
    amountCents: item?.price?.unit_amount ?? null,
    currency: item?.price?.currency ?? null,
    currentPeriodEnd: iso(s.status === 'trialing' ? (s.trial_end ?? item?.current_period_end) : item?.current_period_end),
    createdAt: iso(s.created)!,
    cancelAtPeriodEnd: !!s.cancel_at_period_end,
    endedAt: iso(s.ended_at ?? s.canceled_at),
  };
}

export function toMoneyInvoice(inv: Stripe.Invoice, prices: PriceMap): MoneyInvoice {
  const lines = inv.lines?.data ?? [];
  const priceOf = (l: Stripe.InvoiceLineItem) => {
    const p = l.pricing?.price_details?.price;
    return p ? prices.get(idOf(p as string | { id: string })!) : undefined;
  };
  const isProration = (l: Stripe.InvoiceLineItem) =>
    !!(l.parent?.subscription_item_details?.proration || l.parent?.invoice_item_details?.proration);
  const charged = lines.find(l => l.amount > 0 && priceOf(l)) ?? lines.find(l => l.amount > 0) ?? lines[0];
  const credit = lines.find(l => l.amount < 0 && isProration(l) && priceOf(l));
  const plan = charged ? priceOf(charged) : undefined;
  const subscriptionId = idOf(inv.parent?.subscription_details?.subscription ?? null);
  return {
    id: inv.id!,
    number: inv.number ?? null,
    billingReason: inv.billing_reason ?? null,
    subscriptionId,
    periodStart: iso(charged?.period?.start),
    periodEnd: iso(charged?.period?.end),
    planId: plan?.planId ?? null,
    cycle: plan?.cycle ?? null,
    fromPlanId: credit ? priceOf(credit)?.planId ?? null : null,
    description: subscriptionId ? null : (charged?.description ?? null),
    feeInvoice: !!inv.metadata?.[FEE_INVOICE_META],
  };
}

export function toMoneyRefund(r: Stripe.Refund): MoneyRefund {
  const ours = r.metadata?.platform_refund_id;
  return { id: r.id, amountCents: r.amount, createdAt: iso(r.created)!, status: r.status ?? 'pending', ourRefundId: ours || null };
}

export function toMoneyCharge(c: Stripe.Charge, invoice: MoneyInvoice | null): MoneyCharge {
  const card = c.payment_method_details?.card;
  return {
    id: c.id,
    createdAt: iso(c.created)!,
    amountCents: c.amount,
    currency: c.currency,
    status: c.status,
    refundedCents: c.amount_refunded ?? 0,
    disputed: !!c.disputed,
    failureCode: c.failure_code ?? null,
    card: card ? { brand: card.brand ?? '', last4: card.last4 ?? '' } : null,
    refunds: (c.refunds?.data ?? []).map(toMoneyRefund),
    invoice,
  };
}

/** The invoice a payment paid, asked of Stripe by its payment (an invoice no longer names its charge, API dahlia). */
async function invoiceForIntent(stripe: Stripe, paymentIntent: string, prices: PriceMap): Promise<MoneyInvoice | null> {
  const res = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: paymentIntent }, limit: 1, expand: ['data.invoice'] }, READ_OPTS);
  const inv = res.data[0]?.invoice;
  return inv && typeof inv !== 'string' && !('deleted' in inv && inv.deleted) ? toMoneyInvoice(inv as Stripe.Invoice, prices) : null;
}

// ── Ownership (every read and the refund, T5/T6) ──────────────────────────────────────────────────

export type ClubStripe = { customerId: string | null; customerShared: boolean };

/**
 * A charge (or invoice, or payment) is this club's only when it belongs to EXACTLY this club's Stripe customer — the
 * club has one, no other club shares it — and it was made in the same mode as this site's key.
 */
export function ownsObject(club: ClubStripe, obj: { customer: string | { id: string } | null; livemode: boolean }, live: boolean): boolean {
  if (!club.customerId || club.customerShared) return false;
  if (obj.livemode !== live) return false;
  return idOf(obj.customer) === club.customerId;
}

// ── The read ────────────────────────────────────────────────────────────────────────────────────

async function listAll<T extends { id: string }>(page: (startingAfter?: string) => Promise<Stripe.ApiList<T>>): Promise<{ items: T[]; more: boolean }> {
  const items: T[] = [];
  let after: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await page(after);
    items.push(...res.data);
    if (!res.has_more || res.data.length === 0) return { items, more: false };
    after = res.data[res.data.length - 1].id;
  }
  return { items, more: true };
}

/**
 * The Money tab's read for one club's Stripe customer: the customer and its card, every subscription (all statuses, to
 * see two live ones), twelve months of charges (or the twelve before `before`), the invoices behind them, and Stripe's
 * own preview of the next charge. Throws on any Stripe failure: the caller shows our record and one line.
 */
export async function readClubMoney(stripe: Stripe, customerId: string, opts: { prices: PriceMap; testMode: boolean; now?: Date; before?: string | null }): Promise<MoneyRead> {
  const now = opts.now ?? new Date();
  const until = opts.before ? Date.parse(opts.before) : null;
  const sinceMs = (until ?? now.getTime()) - 365 * DAY;
  const created = { gte: Math.floor(sinceMs / 1000), ...(until ? { lt: Math.floor(until / 1000) } : {}) };

  // The next charge is Stripe's own preview of the live subscription, never a price we work out. It starts as soon as the
  // subscriptions are read, beside the charges and invoices; a courtesy, so a failed preview reads "None", never a failed tab.
  const subsRead = stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 }, READ_OPTS);
  const nextRead = subsRead.then(async (list): Promise<MoneyRead['nextCharge']> => {
    const live = list.data.map(sub => toMoneySubscription(sub, opts.prices))
      .find(sub => (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') && !sub.cancelAtPeriodEnd);
    if (!live || until) return null;
    const preview = await stripe.invoices.createPreview({ customer: customerId, subscription: live.id }, READ_OPTS);
    const at = iso(preview.next_payment_attempt) ?? live.currentPeriodEnd;
    return at ? { amountCents: preview.amount_due, currency: preview.currency, at } : null;
  }).catch(() => null);
  const [customer, subs, charges, invoices, nextCharge] = await Promise.all([
    stripe.customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] }, READ_OPTS),
    subsRead,
    listAll<Stripe.Charge>(after => stripe.charges.list({ customer: customerId, created, limit: PAGE, expand: ['data.refunds'], ...(after ? { starting_after: after } : {}) }, READ_OPTS)),
    // An invoice is made before its charges (a retry pays days later), so the invoices reach back 45 days further.
    listAll<Stripe.Invoice & { id: string }>(after => stripe.invoices.list({ customer: customerId, created: { gte: created.gte - 45 * 86400, ...(created.lt ? { lt: created.lt } : {}) }, limit: PAGE, expand: ['data.payments'], ...(after ? { starting_after: after } : {}) }, READ_OPTS) as Promise<Stripe.ApiList<Stripe.Invoice & { id: string }>>),
    nextRead,
  ]);

  const byCharge = new Map<string, MoneyInvoice>();
  const byIntent = new Map<string, MoneyInvoice>();
  for (const inv of invoices.items) {
    const m = toMoneyInvoice(inv, opts.prices);
    for (const p of inv.payments?.data ?? []) {
      const ch = idOf(p.payment.charge ?? null);
      const pi = idOf(p.payment.payment_intent ?? null);
      if (ch) byCharge.set(ch, m);
      if (pi) byIntent.set(pi, m);
    }
  }
  // A charge whose invoice is older than the window: ask Stripe which invoice it paid (a handful at most).
  const orphans = charges.items.filter(c => !byCharge.has(c.id) && c.payment_intent && !byIntent.has(idOf(c.payment_intent)!)).slice(0, 10);
  await Promise.all(orphans.map(async c => {
    const pi = idOf(c.payment_intent)!;
    const inv = await invoiceForIntent(stripe, pi, opts.prices);
    if (inv) byIntent.set(pi, inv);
  }));

  const subscriptions = subs.data.map(s => toMoneySubscription(s, opts.prices));
  const moneyCharges = charges.items
    .map(c => toMoneyCharge(c, byCharge.get(c.id) ?? (c.payment_intent ? byIntent.get(idOf(c.payment_intent)!) : undefined) ?? null))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const cust = liveCustomer(customer);
  const pm = cust?.invoice_settings?.default_payment_method;
  const card = pm && typeof pm !== 'string' && pm.card
    ? { brand: pm.card.brand, last4: pm.card.last4 ?? '', expMonth: pm.card.exp_month, expYear: pm.card.exp_year } : null;
  const oldest = moneyCharges[moneyCharges.length - 1];
  return {
    readAt: now.toISOString(), // utc-intentional: an instant, formatted on screen
    testMode: opts.testMode,
    customer: { id: customerId, email: cust?.email ?? null },
    card,
    subscriptions,
    charges: moneyCharges,
    olderBefore: charges.more && oldest ? oldest.createdAt : (oldest ? new Date(sinceMs).toISOString() : null), // utc-intentional
    nextCharge,
  };
}

/**
 * One charge, ownership- and mode-checked; null when it is not this club's (or not found). With `prices` it also reads the
 * invoice behind it (the charge window); the refund passes null, needing only the charge and its customer's email.
 */
export async function readClubCharge(stripe: Stripe, chargeId: string, club: ClubStripe, live: boolean, prices: PriceMap | null): Promise<{ charge: MoneyCharge; customerEmail: string | null } | null> {
  if (!/^(ch|py)_[A-Za-z0-9]+$/.test(chargeId)) return null;
  let charge: Stripe.Charge;
  try {
    charge = await stripe.charges.retrieve(chargeId, { expand: ['refunds', 'customer'] }, READ_OPTS);
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 404) return null;
    throw err;
  }
  if (!ownsObject(club, charge, live)) return null;
  const pi = idOf(charge.payment_intent);
  const invoice = prices && pi ? await invoiceForIntent(stripe, pi, prices) : null;
  const customer = charge.customer && typeof charge.customer !== 'string' ? liveCustomer(charge.customer) : null;
  return { charge: toMoneyCharge(charge, invoice), customerEmail: customer?.email ?? null };
}

// ── Find (owner Q5): one exact read of one Stripe item, then its club by its customer ──────────────────────────────

export type FoundStripeItem = { customerId: string; livemode: boolean; amountCents: number; currency: string; at: string; chargeId: string | null };

const isMissing = (err: unknown) => (err as { statusCode?: number }).statusCode === 404 || (err as { code?: string }).code === 'resource_missing';

async function invoiceItem(stripe: Stripe, inv: Stripe.Invoice): Promise<FoundStripeItem | null> {
  const customerId = idOf(inv.customer as string | { id: string } | null);
  if (!customerId) return null;
  let chargeId: string | null = null;
  const pay = inv.payments?.data?.find(p => p.status === 'paid') ?? inv.payments?.data?.[0];
  if (pay?.payment.charge) chargeId = idOf(pay.payment.charge);
  else if (pay?.payment.payment_intent) {
    const pi = typeof pay.payment.payment_intent === 'string'
      ? await stripe.paymentIntents.retrieve(pay.payment.payment_intent, {}, READ_OPTS) : pay.payment.payment_intent;
    chargeId = idOf(pi.latest_charge as string | { id: string } | null);
  }
  return { customerId, livemode: inv.livemode, amountCents: inv.amount_paid || inv.total, currency: inv.currency, at: iso(inv.created)!, chargeId };
}

/**
 * The one Stripe item a typed number names, or null when Stripe has none (or it has no customer). The caller has already
 * checked the number's SHAPE (`stripeNumberKind`); an invoice's printed number is searched only through the query
 * `invoiceNumberQuery` built, with exactly one match accepted. Throws on a Stripe failure other than "not found".
 */
export async function findStripeItem(stripe: Stripe, number: string, kind: 'payment' | 'invoice' | 'invoice_number', query: string | null): Promise<FoundStripeItem | null> {
  try {
    if (kind === 'invoice_number') {
      if (!query) return null;
      const res = await stripe.invoices.search({ query, limit: 2, expand: ['data.payments'] }, READ_OPTS);
      return res.data.length === 1 ? invoiceItem(stripe, res.data[0]) : null;
    }
    if (kind === 'invoice') return invoiceItem(stripe, await stripe.invoices.retrieve(number, { expand: ['payments'] }, READ_OPTS));
    if (number.startsWith('pi_')) {
      const pi = await stripe.paymentIntents.retrieve(number, {}, READ_OPTS);
      const customerId = idOf(pi.customer as string | { id: string } | null);
      return customerId ? { customerId, livemode: pi.livemode, amountCents: pi.amount_received || pi.amount, currency: pi.currency, at: iso(pi.created)!,
        chargeId: idOf(pi.latest_charge as string | { id: string } | null) } : null;
    }
    const ch = await stripe.charges.retrieve(number, {}, READ_OPTS);
    const customerId = idOf(ch.customer as string | { id: string } | null);
    return customerId ? { customerId, livemode: ch.livemode, amountCents: ch.amount, currency: ch.currency, at: iso(ch.created)!, chargeId: ch.id } : null;
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

// ── The refund ──────────────────────────────────────────────────────────────────────────────────

export type RefundRecord = {
  id: string; status: 'started' | 'done' | 'refused' | 'unknown' | 'not_made'; actor_email: string; created_at: string;
  amount_cents: number; currency: string; reason: string; stripe_refund_id: string | null;
};

/** Our refunds record, as the refund needs it (the route passes the database; the guards pass a fake). */
export type RefundStore = {
  /** Unfinished refunds of a charge (started or unknown), oldest first. */
  openFor(chargeId: string): Promise<RefundRecord[]>;
  /** This person's refunds since a moment (started, done or unknown): Billing's daily brake. */
  countByActorSince(actorEmail: string, sinceIso: string): Promise<number>;
  /** Insert as `started`. Throws `InFlightError` when the charge already has an unfinished refund; any other error throws. */
  insertStarted(row: {
    org_id: string; stripe_customer_id: string; stripe_charge_id: string; amount_cents: number; currency: string;
    remaining_seen_cents: number; stripe_reason: 'duplicate' | 'requested_by_customer'; reason: string;
    actor_email: string; actor_role: string; livemode: boolean;
  }): Promise<{ id: string }>;
  /** Complete an UNFINISHED record (started or unknown); false when it was already completed (nothing written). */
  complete(id: string, patch: { status: RefundRecord['status']; stripe_refund_id?: string | null; stripe_error_code?: string | null; stripe_request_id?: string | null }): Promise<boolean>;
  /** The strict audit write: throws when it cannot be written. */
  audit(entry: { actorEmail: string; orgId: string; action: string; value: Record<string, unknown>; reason: string }): Promise<void>;
};

export class InFlightError extends Error {}

/** The sentence for a charge someone is refunding right now (drawing G 5). */
export function inFlightWords(r: Pick<RefundRecord, 'actor_email' | 'created_at'>, clock: (iso: string) => string): string {
  return `${r.actor_email} started a refund of this charge at ${clock(r.created_at)}. Open the charge again in a moment to see what is left.`;
}

/** Stripe's error, kept as its code and request id only (never its message, which can name an account or a key). */
export function stripeErrorFacts(err: unknown): { code: string | null; requestId: string | null; definite: boolean } {
  const e = err as { statusCode?: number; code?: string; requestId?: string; type?: string };
  const code = typeof e?.code === 'string' && /^[a-z_]{1,80}$/.test(e.code) ? e.code : null;
  const requestId = typeof e?.requestId === 'string' && /^req_[A-Za-z0-9]{1,64}$/.test(e.requestId) ? e.requestId : null;
  // A definite no: Stripe's own 400, 402 or 404 about THIS request. Anything else (a 409 key-in-use, a 429, a gateway's
  // 4xx, a timeout, a connection drop, a 5xx) leaves the refund's fate unknown, for recovery to decide.
  const status = e?.statusCode ?? 0;
  const definite = (status === 400 || status === 402 || status === 404) && e?.type !== 'StripeIdempotencyError';
  return { code, requestId, definite };
}

export type RefundInput = {
  orgId: string;
  club: ClubStripe;
  actor: { email: string; role: string };
  ownClub: boolean;
  demoClub: boolean;
  charge: MoneyCharge;
  ask: RefundAsk;
  /** The Money tab flagged this charge as charged twice: Stripe's reason is then `duplicate`. */
  flaggedDuplicate: boolean;
  live: boolean;
  now: Date;
  clock: (iso: string) => string;
};

export type RefundOutcome =
  | { ok: false; status: number; error: string; field?: 'amount' | 'reason'; nothingSent: boolean }
  | { ok: true; state: 'done'; message: string; stripeRefundId: string; auditMissing: boolean }
  | { ok: false; state: 'refused' | 'unknown'; status: number; error: string; nothingSent: false };

/** Make one refund, in the fixed order. Never retries a refund on its own beyond Stripe's own same-key retries. */
export async function makeRefund(stripe: Stripe, store: RefundStore, input: RefundInput): Promise<RefundOutcome> {
  const { charge, actor } = input;
  // Someone else's unfinished refund holds the charge (the database enforces it too).
  const open = await store.openFor(charge.id);
  if (open.length > 0) return { ok: false, status: 409, error: inFlightWords(open[0], input.clock), nothingSent: true };

  const since = new Date(input.now.getTime() - DAY).toISOString(); // utc-intentional: a 24-hour window
  const refundsLast24h = actor.role === 'billing' ? await store.countByActorSince(actor.email, since) : 0;
  const decision = decideRefund(
    { role: actor.role, ownClub: input.ownClub, demoClub: input.demoClub, charge, refundsLast24h, now: input.now },
    input.ask,
  );
  if (!decision.ok) return { ...decision, nothingSent: true };

  const stripeReason = stripeReasonFor(input.flaggedDuplicate);
  let record: { id: string };
  try {
    record = await store.insertStarted({
      org_id: input.orgId, stripe_customer_id: input.club.customerId!, stripe_charge_id: charge.id,
      amount_cents: decision.amountCents, currency: charge.currency, remaining_seen_cents: remainingCents(charge),
      stripe_reason: stripeReason, reason: decision.reason, actor_email: actor.email, actor_role: actor.role, livemode: input.live,
    });
  } catch (err) {
    if (err instanceof InFlightError) {
      const now = await store.openFor(charge.id).catch(() => []);
      return { ok: false, status: 409, nothingSent: true,
        error: now[0] ? inFlightWords(now[0], input.clock) : 'Someone else is refunding this charge right now. Open it again in a moment to see what is left.' };
    }
    return { ok: false, status: 500, error: REFUND_WORDS.recordFailed, nothingSent: true };
  }

  // Our record now holds the charge. Read Stripe's remainder again: a refund that finished since the person's read (in
  // this console or Stripe's dashboard) would otherwise pass the "it changed since you opened it" check it was meant for.
  try {
    const fresh = await stripe.charges.retrieve(charge.id, {}, READ_OPTS);
    const left = Math.max(0, fresh.amount - (fresh.amount_refunded ?? 0));
    if (left !== remainingCents(charge) || decision.amountCents > left) {
      await store.complete(record.id, { status: 'not_made' }).catch(() => false);
      return { ok: false, status: 409, field: 'amount', nothingSent: true,
        error: `Only ${formatCents(left, charge.currency)} of this charge can still be refunded: it changed since you opened it. Check the amount and try again.` };
    }
  } catch {
    await store.complete(record.id, { status: 'not_made' }).catch(() => false);
    return { ok: false, status: 503, error: REFUND_WORDS.readFailed, nothingSent: true };
  }

  const auditValue = {
    refund_record_id: record.id, stripe_charge_id: charge.id, amount_cents: decision.amountCents, currency: charge.currency,
    stripe_reason: stripeReason,
  };
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create({
      charge: charge.id,
      amount: decision.amountCents,
      reason: stripeReason,
      // Our number, the club and the staff member only: never the typed reason (it can hold a customer's details).
      metadata: { platform_refund_id: record.id, org_id: input.orgId, staff_email: actor.email },
    }, { ...REFUND_OPTS, idempotencyKey: record.id });
  } catch (err) {
    const facts = stripeErrorFacts(err);
    const state = facts.definite ? 'refused' as const : 'unknown' as const;
    await store.complete(record.id, { status: state, stripe_error_code: facts.code, stripe_request_id: facts.requestId }).catch(() => false);
    await store.audit({ actorEmail: actor.email, orgId: input.orgId, action: state === 'refused' ? 'refund_charge_refused' : 'refund_charge_unknown',
      value: { ...auditValue, outcome: state, stripe_error_code: facts.code, stripe_request_id: facts.requestId }, reason: decision.reason }).catch(() => undefined);
    return state === 'refused'
      ? { ok: false, state, status: 409, error: stripeRefusalWords(facts.code), nothingSent: false }
      : { ok: false, state, status: 504, error: REFUND_WORDS.noAnswer, nothingSent: false };
  }

  // Stripe made the refund. Nothing below may turn that into "no money moved": each step's failure is logged and said.
  await store.complete(record.id, { status: 'done', stripe_refund_id: refund.id }).catch(err => {
    console.error('[console-money] refund made, record not completed (recovery will):', (err as { code?: string }).code ?? 'error');
    return false;
  });
  let auditMissing = false;
  try {
    await store.audit({ actorEmail: actor.email, orgId: input.orgId, action: 'refund_charge',
      value: { ...auditValue, stripe_refund_id: refund.id, outcome: 'done' }, reason: decision.reason });
  } catch {
    auditMissing = true;
  }
  const didNotReach = refund.status === 'failed' || refund.status === 'canceled';
  return {
    ok: true, state: 'done', stripeRefundId: refund.id, auditMissing,
    message: didNotReach
      ? `Stripe took the refund of ${formatCents(decision.amountCents, charge.currency)} but reports it did not reach the card. It is in the club’s Story with your reason.`
      : `Refunded ${formatCents(decision.amountCents, charge.currency)} to the ${cardWords(charge.card)}. Stripe says it is on its way. It is in the club’s Story with your reason.${auditMissing ? ' The audit entry could not be written; the refund is recorded on the club.' : ''}`,
  };
}

/**
 * Recovery, run when a charge is opened: an unfinished refund old enough that its request cannot still be running is
 * decided by LISTING the charge's refunds in Stripe and matching our id in their metadata. Found → done; not found →
 * not made (the charge is released). It never sends a refund. Returns the records still in flight (younger ones).
 */
export async function recoverRefunds(stripe: Stripe, store: RefundStore, input: { orgId: string; chargeId: string; now: Date }): Promise<RefundRecord[]> {
  const open = await store.openFor(input.chargeId);
  const old = open.filter(r => input.now.getTime() - Date.parse(r.created_at) >= RECOVERY_AFTER_MS);
  if (old.length === 0) return open;
  const { items } = await listAll<Stripe.Refund>(after => stripe.refunds.list({ charge: input.chargeId, limit: PAGE, ...(after ? { starting_after: after } : {}) }, READ_OPTS));
  const byOurId = new Map(items.filter(r => r.metadata?.platform_refund_id).map(r => [r.metadata!.platform_refund_id, r] as const));
  for (const r of old) {
    const found = byOurId.get(r.id);
    // Only from started or unknown: two people opening the charge at once complete it once, and write one entry.
    const changed = await store.complete(r.id, found ? { status: 'done', stripe_refund_id: found.id } : { status: 'not_made' });
    if (!changed) continue;
    await store.audit({ actorEmail: 'refund-recovery', orgId: input.orgId, action: 'refund_charge_resolved',
      value: { refund_record_id: r.id, stripe_charge_id: input.chargeId, outcome: found ? 'done' : 'not_made', stripe_refund_id: found?.id ?? null,
        amount_cents: r.amount_cents, currency: r.currency, started_by: r.actor_email }, reason: r.reason }).catch(() => undefined);
  }
  return open.filter(r => !old.includes(r));
}
