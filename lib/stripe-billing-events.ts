import type Stripe from 'stripe';
import { supabaseAdmin } from './supabase-admin';
import { stripeKeyIsLive } from './stripe-mode';

/**
 * The billing webhook's record of every event (Plans & pricing Stage 0, Part 2, S5; table `stripe_billing_events`, mig 416).
 *
 * Order, for every verified event: MODE (an event from the other Stripe mode is recorded and never run) → CLAIM (atomic in
 * the database, so a replay is a duplicate and two simultaneous deliveries cannot both run) → RUN (the webhook's own
 * `runVerifiedBillingEvent`, the seam a later replay calls) → OUTCOME (processed, or the error stored and a 500 so Stripe
 * retries). The Connect webhook's pattern (mig 358), with the claim made atomic.
 *
 * No payload is stored: it carries customer details and Stripe keeps it.
 */

export type BillingEventClaim = 'new' | 'retry' | 'duplicate' | 'busy';
/**
 * Why an event was recorded and never acted on: `wrong_mode` (the other Stripe mode), `no_customer` (nothing to act on; the
 * webhook answers it without touching a record), `not_ours` (a dispute or refund on a charge that paid no subscription
 * invoice, Part 4). The `ignored_reason` CHECK in migration 416 lists the same words; `stripe-billing-events.test.ts` compares.
 */
export const IGNORED_REASONS = ['wrong_mode', 'no_customer', 'not_ours'] as const;
export type IgnoredReason = (typeof IGNORED_REASONS)[number];
/** What running an event came to: it ran, or it was left alone for a reason a run can reach (`wrong_mode` is decided earlier). */
export type BillingEventOutcome = 'processed' | Exclude<IgnoredReason, 'wrong_mode'>;

export type BillingEventFacts = {
  id: string;
  type: string;
  livemode: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  objectId: string | null;
};

const idOf = (value: unknown): string | null =>
  typeof value === 'string' ? value : (value as { id?: unknown } | null | undefined)?.id as string | null ?? null;

/** The ids the record keeps: who, which subscription, which object. Read from the event's object, never fetched. */
export function billingEventFacts(event: Stripe.Event): BillingEventFacts {
  const object = event.data.object as unknown as Record<string, unknown>;
  let subscriptionId: string | null = null;
  if (event.type.startsWith('customer.subscription.')) subscriptionId = idOf(object.id);
  else if (event.type.startsWith('invoice.')) {
    const parent = object.parent as { subscription_details?: { subscription?: unknown } } | null | undefined;
    subscriptionId = idOf(parent?.subscription_details?.subscription);
  } else if (event.type === 'checkout.session.completed') subscriptionId = idOf(object.subscription);
  // A dispute names no customer (its charge does); the row's object is the dispute (du_…) and Part 4 finds the club.
  // ⚠ A DETACHED card no longer belongs to anyone: its `customer` is null and the one it left is in `previous_attributes`.
  // Reading only the object dropped every card removal as "no customer" (found 2026-11-05: the billing-address "Needs review"
  // never cleared after the old card was removed, and the card-on-file stamp never cleared either).
  const previous = (event.data as { previous_attributes?: { customer?: unknown } }).previous_attributes;
  const customerId = idOf(object.customer) ?? (event.type === 'payment_method.detached' ? idOf(previous?.customer) : null);
  return {
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    customerId,
    subscriptionId,
    objectId: idOf(object.id),
  };
}

export interface BillingEventStore {
  /** Records an event that will never run (the other Stripe mode). A replay of it changes nothing. */
  ignore(facts: BillingEventFacts, reason: 'wrong_mode'): Promise<void>;
  claim(facts: BillingEventFacts): Promise<BillingEventClaim>;
  done(id: string, outcome: BillingEventOutcome): Promise<void>;
  fail(id: string, message: string): Promise<void>;
}

const row = (f: BillingEventFacts) => ({
  id: f.id, type: f.type, livemode: f.livemode, customer_id: f.customerId, subscription_id: f.subscriptionId, object_id: f.objectId,
});

export const billingEventStore: BillingEventStore = {
  async ignore(facts, reason) {
    const { error } = await supabaseAdmin
      .from('stripe_billing_events')
      .upsert({ ...row(facts), ignored_reason: reason }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(`Couldn't record the ignored event: ${error.message}`);
  },
  async claim(facts) {
    const { data, error } = await supabaseAdmin.rpc('stripe_billing_event_claim', {
      p_id: facts.id, p_type: facts.type, p_livemode: facts.livemode,
      p_customer: facts.customerId, p_subscription: facts.subscriptionId, p_object: facts.objectId,
    });
    if (error) throw new Error(`Couldn't claim the event: ${error.message}`);
    const answer = typeof data === 'string' ? data : (data as Record<string, string> | null)?.stripe_billing_event_claim;
    if (answer !== 'new' && answer !== 'retry' && answer !== 'duplicate' && answer !== 'busy') {
      throw new Error(`The event claim answered ${JSON.stringify(data)}`);
    }
    return answer;
  },
  async done(id, outcome) {
    const { error } = await supabaseAdmin
      .from('stripe_billing_events')
      .update({ processed_at: new Date().toISOString(), claimed_at: null, error: null, ignored_reason: outcome === 'processed' ? null : outcome })
      .eq('id', id);
    if (error) throw new Error(`Couldn't mark the event processed: ${error.message}`);
  },
  async fail(id, message) {
    const { error } = await supabaseAdmin
      .from('stripe_billing_events')
      .update({ error: message.slice(0, 500), claimed_at: null })
      .eq('id', id);
    if (error) throw new Error(`Couldn't store the event's error: ${error.message}`);
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export type ReceiveDeps = {
  store: BillingEventStore;
  live: () => boolean;
  report: (error: unknown) => Promise<void> | void;
};

const DEFAULT_DEPS: ReceiveDeps = {
  store: billingEventStore,
  live: () => stripeKeyIsLive(),
  // Loaded when needed: observability reaches server-only modules the unit runner cannot load.
  report: async error => (await import('./observability')).captureError(error, { route: '/api/billing/webhook', method: 'POST' }),
};

/**
 * Receives one signature-verified event: mode, claim, run, outcome. `run` is the webhook's `runVerifiedBillingEvent`.
 *
 * ⚠ A failed run answers 500 so Stripe sends the event again; the row keeps the error and the next delivery reclaims it.
 * A `busy` claim (another delivery is running it right now) also answers 500: Stripe retries later, never runs it twice.
 * A run that succeeded but could not be marked answers 200: the record is right, only its bookkeeping is not, and a 500
 * would run the event a second time.
 */
export async function receiveBillingEvent(
  event: Stripe.Event,
  run: (event: Stripe.Event, customerId: string | null) => Promise<BillingEventOutcome>,
  deps: ReceiveDeps = DEFAULT_DEPS,
): Promise<Response> {
  const facts = billingEventFacts(event);

  // A test event must never touch a live record, nor a live event a test environment's.
  if (event.livemode !== deps.live()) {
    await deps.store.ignore(facts, 'wrong_mode').catch(error => console.error('[billing webhook]', error));
    return json({ received: true, ignored: 'wrong_mode' });
  }

  let claim: BillingEventClaim;
  try {
    claim = await deps.store.claim(facts);
  } catch (error) {
    await deps.report(error);
    return json({ error: 'Could not record the event' }, 500);
  }
  if (claim === 'duplicate') return json({ received: true, duplicate: true });
  if (claim === 'busy') return json({ error: 'This event is being handled by another delivery' }, 500);

  let outcome: BillingEventOutcome;
  try {
    outcome = await run(event, facts.customerId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.store.fail(facts.id, message).catch(e => console.error('[billing webhook]', e));
    await deps.report(error);
    return json({ error: 'The event failed and will be retried' }, 500);
  }

  await deps.store.done(facts.id, outcome).catch(async error => {
    console.error('[billing webhook] the event ran but could not be marked processed:', error);
    await deps.report(error);
  });
  return new Response('ok', { status: 200 });
}
