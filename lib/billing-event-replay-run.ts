import type Stripe from 'stripe';
import { billingEventFacts, billingEventStore, type BillingEventClaim, type BillingEventFacts, type BillingEventOutcome } from './stripe-billing-events';
import { stripeKeyIsLive } from './stripe-mode';
import { STRIPE_API_VERSION } from './stripe';
import { FEE_INVOICE_META } from './online-payment-words';
import { AuditFirstError, writeAuditBeforeChange } from './platform-audit';
import type { RunOptions } from './billing-event-customer-messages';
import {
  REPLAY_ACTION, REPLAY_RESULT_ACTION, lastResultWords, paidInvoiceRefusal, recordRows, replayEventRefusal, replayReason, replayRefusal,
  replayRowRefusal, resultKind, resultRowValue,
  type BillingRecord, type FetchedEventFacts, type ReplayLookup, type ReplayRefusal, type ReplayRefusalKey, type ReplayResult, type ReplayRow,
} from './billing-event-replay';

/**
 * THE REPLAY ENGINE (Plans & pricing Stage 2 Part 5, Session 1): re-runs ONE stored plan-billing update through the webhook's own
 * seam, `runVerifiedBillingEvent`, never through the receiver (which answers a finished update as a duplicate). The decisions and
 * the words are `billing-event-replay.ts`; this file only orders the reads and writes. In this order:
 *
 *   1. the reason (required);
 *   2. our row: none, the other mode, set aside, finished, being run, older than Stripe keeps, a type the audit did not clear;
 *   3. the event re-fetched from Stripe by id (never stored): gone, another mode, another format, a fee bill, a bill for no plan;
 *      a paid bill only while it is the plan's latest (asked of Stripe fresh);
 *      → every refusal so far has written NOTHING and claimed nothing;
 *   4. the change-log row, FIRST and strictly (`writeAuditBeforeChange`); if it cannot be written nothing runs;
 *   5. the SAME atomic claim a live delivery takes (`stripe_billing_event_claim`, mig 416): a failed or stuck row answers `retry`,
 *      and a live delivery running it now answers `busy`, so a replay and Stripe's own retry can never both run it;
 *   6. the club's billing record (before), the run with `{ replay: true }` (no customer message), the record again (after);
 *   7. the outcome exactly as the receiver writes it: `done`, or the error stored with the claim cleared (and `<action>_failed`);
 *   8. (Session 2, owner call 2026-11-08) the companion change-log row `replay_billing_event_result`: the club's record before
 *      and after, best-effort, written only when the two reads were compared (not for a dispute; not for a failed run that
 *      changed nothing, whose `_failed` row already says so).
 *
 * A run that throws is not retried and Stripe is not told; the update stays in the failing list.
 */

export type ReplayClub = { orgId: string; name: string } | null;

export type ReplayDeps = {
  live: () => boolean;
  now: () => Date;
  /** The Stripe format the handler reads (`STRIPE_API_VERSION`). */
  apiVersion: string;
  readRow: (id: string) => Promise<ReplayRow | null>;
  /** null when Stripe answers that it has no such event (older than it keeps). Throws when Stripe could not be read. */
  retrieveEvent: (id: string) => Promise<Stripe.Event | null>;
  /** The subscription's latest invoice, read fresh. Throws when Stripe could not be read. */
  latestInvoiceOf: (subscriptionId: string) => Promise<string | null>;
  findClub: (row: ReplayRow) => Promise<ReplayClub>;
  readRecord: (orgId: string) => Promise<BillingRecord | null>;
  /** `writeAuditBeforeChange`'s own shape: throws `AuditFirstError` when the row cannot be written. */
  auditFirst: typeof writeAuditBeforeChange;
  claim: (facts: BillingEventFacts) => Promise<BillingEventClaim>;
  done: (id: string, outcome: BillingEventOutcome) => Promise<void>;
  fail: (id: string, message: string) => Promise<void>;
  run: (event: Stripe.Event, customerId: string | null, opts: RunOptions) => Promise<BillingEventOutcome>;
  /** The companion row after the run (step 8). Best-effort: a failure is reported, never the replay's answer. */
  recordResult: (entry: { actorEmail: string; orgId: string; reason: string; oldValue: Record<string, string>; newValue: Record<string, string> }) => Promise<void>;
  report: (error: unknown) => Promise<void> | void;
};

export type ReplayInput = { eventId: unknown; actorEmail: string; reason: unknown };

export type ReplayAnswer =
  | Refused
  | { ok: true; result: ReplayResult };

const STATUS: Partial<Record<ReplayRefusalKey, number>> = {
  unknown: 404, reason: 400, change_log: 503, stripe_unread: 503, not_claimed: 503, record_unread: 503, too_old: 410,
};
export type Refused = { ok: false; status: number; refusal: ReplayRefusal };
const refuse = (refusal: ReplayRefusal): Refused => ({ ok: false, status: STATUS[refusal.key] ?? 409, refusal });
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const idOf = (v: unknown): string | null =>
  typeof v === 'string' ? v : ((v as { id?: unknown } | null | undefined)?.id as string | undefined) ?? null;

/** The few facts of the re-fetched event the second check reads. Nothing of it is stored. */
export function fetchedEventFacts(event: Stripe.Event): FetchedEventFacts {
  const object = event.data.object as unknown as Record<string, unknown>;
  const isInvoice = event.type.startsWith('invoice.');
  const parent = object.parent as { subscription_details?: { subscription?: unknown } } | null | undefined;
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  return {
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    apiVersion: event.api_version ?? null,
    // The handler's own test for a club's fee bill (`runPlanWork`, before its switch).
    feeInvoice: isInvoice && !!metadata[FEE_INVOICE_META],
    invoiceSubscriptionId: isInvoice ? idOf(parent?.subscription_details?.subscription) : null,
    invoiceId: isInvoice ? idOf(object.id) : null,
  };
}

const rowFacts = (row: ReplayRow): BillingEventFacts => ({
  id: row.id, type: row.type, livemode: row.livemode, customerId: row.customerId, subscriptionId: row.subscriptionId, objectId: row.objectId,
});

type RowRead = { eventId: string; live: boolean; row: ReplayRow | null; refusal: ReplayRefusal | null };

/** The id, our own row and the refusal that row alone decides: shared by the replay (step 2) and the window's GET. */
async function readReplayRow(input: unknown, deps: Pick<ReplayDeps, 'live' | 'now' | 'readRow'>): Promise<RowRead> {
  const eventId = typeof input === 'string' ? input.trim() : '';
  if (!/^evt_[A-Za-z0-9]+$/.test(eventId)) return { eventId, live: false, row: null, refusal: replayRefusal('unknown') };
  const live = deps.live();
  const now = deps.now();
  let row: ReplayRow | null;
  try {
    row = await deps.readRow(eventId);
  } catch {
    return { eventId, live, row: null, refusal: replayRefusal('record_unread') };
  }
  return { eventId, live, row, refusal: replayRowRefusal(row, { live, now }) };
}

export async function replayBillingEvent(input: ReplayInput, deps: ReplayDeps = serverReplayDeps()): Promise<ReplayAnswer> {
  // 1 · the reason.
  const reason = replayReason(input.reason);
  if (!reason) return refuse(replayRefusal('reason'));

  // 2 · our own row (the same read the window's GET makes, so the window never promises what the click refuses).
  const read = await readReplayRow(input.eventId, deps);
  if (read.refusal || !read.row) return refuse(read.refusal ?? replayRefusal('unknown'));
  const { eventId, row, live } = read;

  // 3 · Stripe's copy, by id.
  let event: Stripe.Event | null;
  try {
    event = await deps.retrieveEvent(eventId);
  } catch {
    return refuse(replayRefusal('stripe_unread'));
  }
  if (!event) return refuse(replayRefusal('too_old'));
  const facts = fetchedEventFacts(event);
  const eventRefusal = replayEventRefusal(row, facts, { live, apiVersion: deps.apiVersion });
  if (eventRefusal) return refuse(eventRefusal);
  if (facts.type === 'invoice.payment_succeeded' && facts.invoiceSubscriptionId) {
    let latest: string | null;
    try {
      latest = await deps.latestInvoiceOf(facts.invoiceSubscriptionId);
    } catch {
      return refuse(replayRefusal('stripe_unread'));
    }
    const stale = paidInvoiceRefusal(facts.invoiceId, latest);
    if (stale) return refuse(stale);
  }
  let club: ReplayClub;
  try {
    club = await deps.findClub(row);
  } catch {
    return refuse(replayRefusal('record_unread'));
  }

  // 4 · the change log, FIRST. Nothing above wrote anything.
  let failed: (error: unknown) => Promise<void>;
  try {
    failed = await deps.auditFirst(input.actorEmail, club?.orgId ?? null, 'replay_billing_event', 'stripe_event', null,
      { eventId, type: row.type }, { reason });
  } catch (error) {
    if (error instanceof AuditFirstError) return refuse(replayRefusal('change_log'));
    throw error;
  }

  // 5 · the same claim a live delivery takes.
  let claim: BillingEventClaim;
  try {
    claim = await deps.claim(rowFacts(row));
  } catch (error) {
    await failed(error);
    return refuse(replayRefusal('not_claimed'));
  }
  if (claim === 'busy') {
    await failed(new Error('Being delivered by Stripe right now'));
    return refuse(replayRefusal('busy'));
  }
  if (claim === 'new') {
    // The row read above has gone (nothing deletes from this table): the claim made a fresh one. Release it, run nothing.
    await deps.fail(eventId, 'A replay found no stored record of this update').catch(e => deps.report(e));
    await failed(new Error('The stored record of this update had gone')).catch(e => deps.report(e));
    return refuse(replayRefusal('unknown'));
  }
  if (claim === 'duplicate') {
    await failed(new Error('Finished before the replay could take it'));
    const again = await deps.readRow(eventId).catch(() => null);
    return refuse(replayRefusal('finished', { processedAt: again?.processedAt ?? null }));
  }

  // 6 · before, the run, after. A before-read that fails runs nothing: the claim is released with the row's OWN error kept.
  let before: BillingRecord | null = null;
  if (club) {
    try {
      before = await deps.readRecord(club.orgId);
    } catch (thrown) {
      await deps.fail(eventId, row.error ?? messageOf(thrown)).catch(e => deps.report(e));
      await failed(thrown).catch(e => deps.report(e));
      return refuse(replayRefusal('record_unread'));
    }
  }
  let outcome: BillingEventOutcome | 'failed' = 'failed';
  let error: string | null = null;
  try {
    outcome = await deps.run(event, billingEventFacts(event).customerId, { replay: true });
  } catch (thrown) {
    error = messageOf(thrown).slice(0, 500);
    // 7 · the receiver's own failure answer: the error kept, the claim cleared (the row stays in the failing list).
    await deps.fail(eventId, error).catch(e => deps.report(e));
    await failed(thrown).catch(e => deps.report(e));
    await Promise.resolve(deps.report(thrown)).catch(() => {});
  }
  let after: BillingRecord | null = null;
  let recordRead = true;
  if (club) {
    try {
      after = await deps.readRecord(club.orgId);
    } catch {
      recordRead = false;
    }
  }
  let marked = true;
  if (outcome !== 'failed') {
    const ran = outcome;
    // The run succeeded; a failed mark is reported and told (the row may show as failing, and Stripe's retry may run it again,
    // which the audit found harmless for every replayable type), never a failed replay.
    await deps.done(eventId, ran).catch(async e => { marked = false; await deps.report(e); });
  }
  const rows = recordRead ? recordRows(before, after) : [];
  // 8 · what changed, kept: only when a comparison was made, and for a failed run only when part of it was saved.
  // A run that finished (`processed`) is kept even when nothing changed ("Nothing changed" is an answer). One set aside (no
  // customer, not ours) is not a replay of the club's record, so it is kept only if it somehow changed something.
  if (club && rows.length && (outcome === 'processed' || rows.some(r => r.changed))) {
    await deps.recordResult({
      actorEmail: input.actorEmail, orgId: club.orgId, reason,
      oldValue: resultRowValue(row.type, eventId, before),
      newValue: resultRowValue(row.type, eventId, after, outcome === 'failed'),
    }).catch(async e => { await Promise.resolve(deps.report(e)).catch(() => {}); });
  }
  return {
    ok: true,
    result: { kind: resultKind(outcome, rows), eventId, eventType: row.type, clubName: club?.name ?? null, rows, error, recordRead, marked },
  };
}

export type LookupAnswer =
  | Refused
  | { ok: true; update: ReplayLookup; refusal: ReplayRefusal | null };

/**
 * What the window shows before the click (Session 2's GET): our own row's facts, the club's name and the refusal the row alone
 * already decides (`replayRowRefusal`). Read-only: no Stripe call, no claim, no write. The refusals that need Stripe's copy
 * (a later bill, a fee bill, the format) are met at the click, after the reason, as the POST answers them.
 */
export async function lookupReplayUpdate(
  eventIdInput: unknown,
  deps: Pick<ReplayDeps, 'live' | 'now' | 'readRow' | 'findClub'> = serverReplayDeps(),
): Promise<LookupAnswer> {
  const { row, refusal } = await readReplayRow(eventIdInput, deps);
  if (!row) return refuse(refusal ?? replayRefusal('unknown'));
  // A club that cannot be read just now is not a refusal before the click: the window shows no name, and the POST reads it again.
  const club = refusal ? null : await deps.findClub(row).catch(() => null);
  return {
    ok: true,
    refusal,
    update: { eventId: row.id, eventType: row.type, receivedAt: row.receivedAt, clubName: club?.name ?? null, lastResult: lastResultWords(row) },
  };
}

/** The real reads and writes. Server modules load when called, so the unit runner can load this file with fakes. */
export function serverReplayDeps(): ReplayDeps {
  return {
    live: () => stripeKeyIsLive(),
    now: () => new Date(),
    apiVersion: STRIPE_API_VERSION,
    async readRow(id) {
      const { supabaseAdmin } = await import('./supabase-admin');
      const { data, error } = await supabaseAdmin.from('stripe_billing_events')
        .select('id, type, livemode, customer_id, subscription_id, object_id, received_at, claimed_at, processed_at, error, ignored_reason')
        .eq('id', id).maybeSingle();
      if (error) throw new Error(`Couldn't read the update's record: ${error.message}`);
      if (!data) return null;
      const r = data as Record<string, string | boolean | null>;
      return {
        id: r.id as string, type: r.type as string, livemode: r.livemode as boolean,
        customerId: r.customer_id as string | null, subscriptionId: r.subscription_id as string | null, objectId: r.object_id as string | null,
        receivedAt: r.received_at as string, claimedAt: r.claimed_at as string | null, processedAt: r.processed_at as string | null,
        error: r.error as string | null, ignoredReason: r.ignored_reason as string | null,
      };
    },
    async retrieveEvent(id) {
      const { getStripe } = await import('./stripe');
      try {
        return await getStripe().events.retrieve(id);
      } catch (error) {
        const e = error as { code?: string; statusCode?: number };
        if (e.code === 'resource_missing' || e.statusCode === 404) return null;
        throw error;
      }
    },
    async latestInvoiceOf(subscriptionId) {
      const { getStripe } = await import('./stripe');
      return idOf((await getStripe().subscriptions.retrieve(subscriptionId)).latest_invoice);
    },
    async findClub(row) {
      const [{ orgOfSubscription }, { supabaseAdmin }] = await Promise.all([import('./charge-tax-record-server'), import('./supabase-admin')]);
      const owner = await orgOfSubscription(row.subscriptionId, row.customerId);
      if (!owner) return null;
      const { data, error } = await supabaseAdmin.from('organizations').select('name').eq('id', owner.orgId).maybeSingle();
      if (error) throw new Error(`Couldn't read the club: ${error.message}`);
      return { orgId: owner.orgId, name: (data as { name: string } | null)?.name ?? 'A club' };
    },
    async readRecord(orgId) {
      const [{ supabaseAdmin }, { readPendingEnding }] = await Promise.all([import('./supabase-admin'), import('./plan-ending-store')]);
      const [{ data, error }, ending] = await Promise.all([
        supabaseAdmin.from('organizations').select('subscription_status, plan_id, current_period_end, subscription_period').eq('id', orgId).maybeSingle(),
        readPendingEnding(orgId),
      ]);
      if (error) throw new Error(`Couldn't read the club's billing record: ${error.message}`);
      if (!data) return null;
      const r = data as Record<string, string | null>;
      return { status: r.subscription_status, plan: r.plan_id, paidThrough: r.current_period_end, cycle: r.subscription_period, planEnds: ending?.effectiveAt ?? null };
    },
    auditFirst: writeAuditBeforeChange,
    claim: facts => billingEventStore.claim(facts),
    done: (id, outcome) => billingEventStore.done(id, outcome),
    fail: (id, message) => billingEventStore.fail(id, message),
    run: async (event, customerId, opts) => (await import('./billing-webhook-handler')).runVerifiedBillingEvent(event, customerId, opts),
    async recordResult({ actorEmail, orgId, reason, oldValue, newValue }) {
      // The Strict write throws on a rejected insert, so the caller's `.catch` reports it (the plain write only logs to the console).
      const { writePlatformAuditLogStrict } = await import('./platform-audit');
      await writePlatformAuditLogStrict(actorEmail, orgId, REPLAY_RESULT_ACTION, 'billing_record', oldValue, newValue, { reason });
    },
    report: async error => (await import('./observability')).captureError(error, { route: '/api/platform-admin/watching-stripe/replay', method: 'POST' }),
  };
}

export { REPLAY_ACTION };
