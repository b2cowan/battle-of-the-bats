import type Stripe from 'stripe';
import { billingEventFacts, billingEventStore, type BillingEventClaim, type BillingEventFacts, type BillingEventOutcome } from './stripe-billing-events';
import { stripeKeyIsLive } from './stripe-mode';
import { STRIPE_API_VERSION } from './stripe';
import { FEE_INVOICE_META } from './online-payment-words';
import { AuditFirstError, writeAuditBeforeChange } from './platform-audit';
import type { RunOptions } from './billing-event-customer-messages';
import {
  REPLAY_ACTION, paidInvoiceRefusal, recordRows, replayEventRefusal, replayReason, replayRefusal, replayRowRefusal, resultKind,
  type BillingRecord, type FetchedEventFacts, type ReplayRefusal, type ReplayRefusalKey, type ReplayResult, type ReplayRow,
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
 *   7. the outcome exactly as the receiver writes it: `done`, or the error stored with the claim cleared (and `<action>_failed`).
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
  report: (error: unknown) => Promise<void> | void;
};

export type ReplayInput = { eventId: unknown; actorEmail: string; reason: unknown };

export type ReplayAnswer =
  | { ok: false; status: number; refusal: ReplayRefusal }
  | { ok: true; result: ReplayResult };

const STATUS: Partial<Record<ReplayRefusalKey, number>> = {
  unknown: 404, reason: 400, change_log: 503, stripe_unread: 503, not_claimed: 503, record_unread: 503, too_old: 410,
};
const refuse = (refusal: ReplayRefusal): ReplayAnswer => ({ ok: false, status: STATUS[refusal.key] ?? 409, refusal });
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

export async function replayBillingEvent(input: ReplayInput, deps: ReplayDeps = serverReplayDeps()): Promise<ReplayAnswer> {
  // 1 · the reason.
  const reason = replayReason(input.reason);
  if (!reason) return refuse(replayRefusal('reason'));
  const eventId = typeof input.eventId === 'string' ? input.eventId.trim() : '';
  if (!/^evt_[A-Za-z0-9]+$/.test(eventId)) return refuse(replayRefusal('unknown'));

  // 2 · our own row.
  const live = deps.live();
  const now = deps.now();
  let row: ReplayRow | null;
  try {
    row = await deps.readRow(eventId);
  } catch {
    return refuse(replayRefusal('record_unread'));
  }
  const rowRefusal = replayRowRefusal(row, { live, now });
  if (rowRefusal || !row) return refuse(rowRefusal ?? replayRefusal('unknown'));

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
  return {
    ok: true,
    result: { kind: resultKind(outcome, rows), eventId, eventType: row.type, clubName: club?.name ?? null, rows, error, recordRead, marked },
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
    report: async error => (await import('./observability')).captureError(error, { route: '/api/platform-admin/watching-stripe/replay', method: 'POST' }),
  };
}

export { REPLAY_ACTION };
