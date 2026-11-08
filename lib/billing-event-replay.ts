/**
 * Replay a missed Stripe plan-billing update (Plans & pricing Stage 2 Part 5; build prompt
 * `docs/projects/active/PLANS_PRICING_STAGE2_PART5_BUILD_PROMPT.md`, the audit and the owner rulings in the stage prompt's Part 5
 * block). THE DECISIONS AND THE WORDS, pure (no I/O), so `tests/unit/billing-event-replay.test.ts` runs them as they are. The engine
 * that reads, claims and runs is `billing-event-replay-run.ts`.
 *
 * ⚖ Owner rulings 2026-11-06 / 2026-11-08: a replay re-runs a stored event through OUR handler, re-fetched from Stripe by id (no
 * payload is stored); Super admin only, a reason, a change-log row written first; it refuses the other Stripe mode; only an update
 * that did not finish (failed, or taken and never finished) is replayed; plan billing only; no message to a customer.
 * ⚖ The audit (2026-11-08, A1): only the event types below were shown harmless the second time. A re-fetched event carries
 * Stripe's copy of the object AS IT WAS, and the types refused here write that copy over what has happened since.
 * ⚖ A2: a set-aside (`no_customer`) update names no Stripe customer, and Stripe never changes a stored event, so a replay would set
 * it aside again: it is refused with that reason.
 */
import { consoleDate, consoleWhen } from './console-dates';
import { planLabel, subscriptionStatusLabel } from './platform-labels';

/** The change-log action a replay writes first (its failure is `replay_billing_event_failed`). */
export const REPLAY_ACTION = 'replay_billing_event';

/** Stripe keeps an event for 30 days (API reference, "Retrieve an event": "if it was created in the last 30 days"). */
export const STRIPE_EVENT_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

/** A claim older than this with no outcome may be taken again (migration 416's `stripe_billing_event_claim`). */
export const CLAIM_LEASE_MS = 5 * 60_000;

/** The reason a person types, as long as the window lets it be (`RecordWindow`'s `whyMax`). */
export const REPLAY_REASON_MAX = 1000;

/**
 * The event types a replay may run: each was audited harmless the second time (fresh reads, keyed or forward-only writes, no
 * write to Stripe, its one customer message suppressed by the replay input). An ALLOW list, so a type the handler learns later is
 * refused until someone audits it (`tests/unit/billing-event-replay.test.ts` fails when the handler names a type in neither list).
 */
export const REPLAYABLE_TYPES: ReadonlySet<string> = new Set([
  'invoice.payment_succeeded', // only the subscription's latest invoice (`paidInvoiceRefusal`)
  'invoice.payment_failed',
  'invoice.paid', 'invoice.finalized', 'invoice.voided', 'invoice.marked_uncollectible',
  'credit_note.created', 'credit_note.updated', 'credit_note.voided',
  'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed', 'charge.refunded',
  'payment_method.detached',
  'customer.subscription.trial_will_end', // its only act is a customer email, which a replay never sends
]);

/** The types the audit found NOT harmless the second time (A1). Named so the guard test can tell "refused" from "never audited". */
export const REPLAY_REFUSED_TYPES: ReadonlySet<string> = new Set([
  'checkout.session.completed',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'payment_method.attached',
]);

/** One row of `stripe_billing_events`, as the replay reads it. */
export type ReplayRow = {
  id: string;
  type: string;
  livemode: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  objectId: string | null;
  receivedAt: string;
  claimedAt: string | null;
  processedAt: string | null;
  error: string | null;
  ignoredReason: string | null;
};

export type ReplayRefusalKey =
  | 'finished' | 'other_account' | 'too_old' | 'busy' | 'unknown' | 'change_log'
  | 'set_aside' | 'not_ours' | 'not_replayable' | 'fee_invoice' | 'later_bill' | 'not_plan_bill' | 'format' | 'stripe_unread' | 'not_claimed'
  | 'record_unread' | 'reason';

export type ReplayRefusal = { key: ReplayRefusalKey; title: string; body: string };

const agoDays = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);

/** The sentence for each refusal: the drawings' six (tab 2), and the audit's (A1, A2). */
export function replayRefusal(key: ReplayRefusalKey, facts: { processedAt?: string | null; ageDays?: number; type?: string; sentLive?: boolean } = {}): ReplayRefusal {
  switch (key) {
    case 'finished':
      return { key, title: 'This update already finished', body: `${facts.processedAt ? `It was processed on ${consoleWhen(facts.processedAt)}.` : 'It has already been processed.'} Nothing is waiting to be redone. If the club’s plan looks wrong, the morning check against Stripe lists it on this page.` };
    case 'other_account':
      return {
        key, title: 'This update came from the other Stripe account',
        body: facts.sentLive === undefined
          ? 'It was sent by a different Stripe account than the one this site reads, so it was set aside when it arrived. It cannot be replayed here.'
          : `It was sent by Stripe’s ${facts.sentLive ? 'live' : 'test'} account and this site reads the ${facts.sentLive ? 'test' : 'live'} account, so it was set aside when it arrived. It cannot be replayed here.`,
      };
    case 'too_old':
      return { key, title: 'Stripe no longer has this update', body: `Stripe keeps its updates for ${STRIPE_EVENT_RETENTION_DAYS} days${facts.ageDays !== undefined ? ` and this one is ${facts.ageDays} days old` : ''}. The product does not store a copy, so there is nothing to replay. Open the club’s Money tab to see what Stripe holds today.` };
    case 'busy':
      return { key, title: 'Stripe is sending this one right now', body: 'The product is already working on it. Wait a minute and look at the list again; if it still shows as failing, replay it then.' };
    case 'unknown':
      return { key, title: 'No update with that id', body: 'The product has no record of an update with this id. Check that you copied all of it, from the Events page in Stripe’s dashboard, in the same account this site reads.' };
    case 'change_log':
      return { key, title: 'Nothing was replayed', body: 'The change log could not be written, so nothing was replayed. Try again.' };
    case 'set_aside':
      return { key, title: 'This update names no Stripe customer', body: 'It was set aside when it arrived because it names no customer, and Stripe never changes an update it has sent. A replay would set it aside again, so there is nothing to redo.' };
    case 'not_ours':
      return { key, title: 'This charge paid no plan bill', body: 'It was set aside when it arrived: the charge it is about paid no subscription bill, so plan billing has nothing to do with it.' };
    case 'not_replayable':
      return { key, title: 'This kind of update is not replayed', body: `A replay runs Stripe’s copy of ${facts.type ? `a ${facts.type} update` : 'the update'} as it was when Stripe sent it, and this kind would write that old copy over what has changed since. If the club’s plan looks wrong, the morning check against Stripe lists it on this page.` };
    case 'fee_invoice':
      return { key, title: 'This is a Stripe-fees bill, not plan billing', body: 'It is a club’s bill for its online payments’ Stripe fees. A replay is for plan billing only; the club’s Money tab retries a fee bill.' };
    case 'later_bill':
      return { key, title: 'A later bill has been made since', body: 'This bill is no longer the plan’s latest, so its paid-through date is out of date. The later bill’s own update speaks for the plan; if the club’s plan looks wrong, the morning check against Stripe lists it on this page.' };
    case 'not_plan_bill':
      return { key, title: 'This bill is not for a plan', body: 'The bill bills no subscription (one made by hand in Stripe), so a replay could not check it against the plan as it stands today. It is not replayed.' };
    case 'format':
      return { key, title: 'This update is in a Stripe format the product does not read', body: 'Stripe wrote it in a different version of its format than the one the product reads, so replaying it could misread it. It is not replayed.' };
    case 'stripe_unread':
      return { key, title: 'Stripe did not answer', body: 'The product could not read the update from Stripe, so nothing was replayed. Try again in a few minutes.' };
    case 'not_claimed':
      return { key, title: 'Nothing was replayed', body: 'The product could not take this update to run it, so nothing was run. The attempt is in the change log. Try again.' };
    case 'record_unread':
      return { key, title: 'Nothing was replayed', body: 'The product could not read its own record of this update or of the club, so nothing was run. Try again in a few minutes.' };
    case 'reason':
      return { key, title: 'Say why first', body: `A replay needs a reason for the change log, up to ${REPLAY_REASON_MAX} characters.` };
  }
}

/** The reason as the change log keeps it, or null when it is blank or too long. */
export function replayReason(input: unknown): string | null {
  const reason = typeof input === 'string' ? input.trim() : '';
  return reason && reason.length <= REPLAY_REASON_MAX ? reason : null;
}

/**
 * May this row be replayed? Decided from our own record alone, before Stripe is asked and before anything is written. Order: no row;
 * the other Stripe mode; set aside (not ours, no customer); finished; being run right now; older than Stripe keeps; a type the audit
 * did not clear.
 */
export function replayRowRefusal(row: ReplayRow | null, ctx: { live: boolean; now: Date }): ReplayRefusal | null {
  if (!row) return replayRefusal('unknown');
  if (row.ignoredReason === 'wrong_mode' || row.livemode !== ctx.live) return replayRefusal('other_account', { sentLive: row.livemode });
  if (row.ignoredReason === 'not_ours') return replayRefusal('not_ours');
  if (row.ignoredReason === 'no_customer') return replayRefusal('set_aside');
  if (row.processedAt) return replayRefusal('finished', { processedAt: row.processedAt });
  // `<=`: the claim function treats a claim of exactly five minutes as still held (`claimed_at < now() - 5 minutes` re-claims).
  if (row.claimedAt && ctx.now.getTime() - new Date(row.claimedAt).getTime() <= CLAIM_LEASE_MS) return replayRefusal('busy');
  const ageDays = agoDays(row.receivedAt, ctx.now);
  if (ageDays >= STRIPE_EVENT_RETENTION_DAYS) return replayRefusal('too_old', { ageDays });
  if (!REPLAYABLE_TYPES.has(row.type)) return replayRefusal('not_replayable', { type: row.type });
  return null;
}

/** The facts of the re-fetched event the second check reads (never stored). */
export type FetchedEventFacts = {
  id: string;
  type: string;
  livemode: boolean;
  apiVersion: string | null;
  /** The event's invoice carries the Stripe-fees mark (a club's own fee bill). */
  feeInvoice: boolean;
  /** For an invoice event: the subscription it bills, null for a bill made by hand. */
  invoiceSubscriptionId: string | null;
  invoiceId: string | null;
};

/** The second check, on what Stripe handed back: the same event, the same mode, the format the handler reads, plan billing. */
export function replayEventRefusal(row: ReplayRow, event: FetchedEventFacts, ctx: { live: boolean; apiVersion: string }): ReplayRefusal | null {
  if (event.id !== row.id || event.type !== row.type) return replayRefusal('unknown');
  if (event.livemode !== ctx.live) return replayRefusal('other_account');
  if (event.apiVersion !== ctx.apiVersion) return replayRefusal('format');
  if (event.type.startsWith('invoice.') && event.feeInvoice) return replayRefusal('fee_invoice');
  if ((event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') && !event.invoiceSubscriptionId) {
    return replayRefusal('not_plan_bill');
  }
  return null;
}

/**
 * A paid invoice writes its OWN lines' period end as the plan's paid-through date (handler `invoicePeriodEnd`), so it is replayed
 * only while it is still the subscription's latest invoice: then that period is the current one. Asked of Stripe fresh.
 */
export function paidInvoiceRefusal(invoiceId: string | null, latestInvoiceId: string | null): ReplayRefusal | null {
  return invoiceId && latestInvoiceId === invoiceId ? null : replayRefusal('later_bill');
}

/** The club's billing record as staff read it on the club's page, read just before and just after the run (ruling 3). */
export type BillingRecord = {
  status: string | null;
  plan: string | null;
  paidThrough: string | null;
  cycle: string | null;
  planEnds: string | null;
};

export type RecordRow = { label: string; before: string; after: string; changed: boolean };

const cycleWord = (cycle: string | null) => (cycle === 'monthly' ? 'Monthly' : cycle === 'annual' ? 'Annual' : cycle ?? '—');
const FIELDS: Array<{ key: keyof BillingRecord; label: string; word: (v: string | null) => string }> = [
  { key: 'status', label: 'Status', word: v => (v ? subscriptionStatusLabel(v) : '—') },
  { key: 'plan', label: 'Plan', word: v => (v ? planLabel(v) : '—') },
  { key: 'paidThrough', label: 'Paid through', word: v => (v ? consoleDate(v) : '—') },
  { key: 'cycle', label: 'Billing cycle', word: cycleWord },
  { key: 'planEnds', label: 'Plan ends', word: v => (v ? consoleDate(v) : '—') },
];

/** The Before / After rows: each field in words, and whether it changed (compared as stored, so a re-format is not a change). */
export function recordRows(before: BillingRecord | null, after: BillingRecord | null): RecordRow[] {
  if (!before && !after) return [];
  return FIELDS.map(f => {
    const b = before?.[f.key] ?? null;
    const a = after?.[f.key] ?? null;
    return { label: f.label, before: f.word(b), after: f.word(a), changed: !sameStored(b, a) };
  });
}

/** Two stored values are the same when equal, or two instants at the same moment (Postgres and JS print one differently). */
function sameStored(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return /^\d{4}-\d{2}-\d{2}/.test(a) && /^\d{4}-\d{2}-\d{2}/.test(b) && !Number.isNaN(ta) && ta === tb;
}

/** `ran`: it ran, but there was no club record to compare (a dispute names no club) or it could not be read after the run. */
export type ReplayResultKind = 'changed' | 'unchanged' | 'ran' | 'failed' | 'set_aside' | 'no_customer';

export type ReplayResult = {
  kind: ReplayResultKind;
  eventId: string;
  eventType: string;
  clubName: string | null;
  rows: RecordRow[];
  /** The handler's own message when the run failed, cut to 500 as the row stores it. */
  error: string | null;
  /** False when the club's record could not be read after the run: Before / After is not shown and nothing is claimed about it. */
  recordRead: boolean;
  /** False when the run finished but could not be marked finished (the row may show as failing, and Stripe's own retry may run it again). */
  marked: boolean;
};

/** The words of the answer window (drawings tab 3; "Set aside again" for no customer dropped by A2). */
export function replayResultWords(r: ReplayResult): { title: string; sentence: string; foot: string } {
  const club = r.clubName ?? 'no one club';
  const anyChange = r.rows.some(row => row.changed);
  const unmarked = r.marked ? '' : ' The run finished but could not be marked finished, so the update may still show as failing.';
  const noMessage = `No message was sent to the customer. Bill and charge records the run keeps are not shown here.${unmarked}`;
  switch (r.kind) {
    case 'changed':
      return { title: 'Replayed. The club’s record changed.', sentence: `${r.eventType} for ${club} was processed.`, foot: noMessage };
    case 'unchanged':
      return {
        title: 'Replayed. Nothing changed.',
        sentence: `${r.eventType} for ${club} was processed. The club’s record already matched what Stripe holds, usually because a later update fixed it first.`,
        foot: noMessage,
      };
    case 'ran':
      return {
        title: 'Replayed.',
        sentence: r.recordRead
          ? `${r.eventType} was processed. It names no one club’s plan record, so there is no Before and After to show.`
          : `${r.eventType}${r.clubName ? ` for ${r.clubName}` : ''} was processed, but the club’s record could not be read afterwards; open the club to see it.`,
        foot: noMessage,
      };
    case 'no_customer':
      return {
        title: 'Set aside',
        sentence: `${r.eventType} ran and was set aside: Stripe’s copy names no customer, so there is nothing to update.`,
        foot: noMessage,
      };
    case 'set_aside':
      return {
        title: 'Set aside',
        sentence: `${r.eventType} ran and was set aside: the charge it is about paid no plan bill, so plan billing has nothing to do with it.`,
        foot: noMessage,
      };
    case 'failed':
      return {
        title: 'The replay failed',
        sentence: anyChange
          ? 'Part of the run was saved before it failed; Before and After show what changed. The update stays in the failing list.'
          : 'Nothing was changed by this try, and the update stays in the failing list. You can replay it again in a few minutes.',
        foot: 'No message was sent to the customer.',
      };
  }
}

/** The answer's kind from what the run came to and the two reads. */
export function resultKind(outcome: 'processed' | 'no_customer' | 'not_ours' | 'failed', rows: RecordRow[]): ReplayResultKind {
  if (outcome === 'failed') return 'failed';
  if (outcome === 'no_customer') return 'no_customer';
  if (outcome === 'not_ours') return 'set_aside';
  // No rows: nothing was compared (no club, or the after-read failed). Never "Nothing changed" on a comparison not made.
  if (!rows.length) return 'ran';
  return rows.some(r => r.changed) ? 'changed' : 'unchanged';
}
