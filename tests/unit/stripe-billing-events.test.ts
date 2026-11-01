import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {
  billingEventFacts, receiveBillingEvent,
  type BillingEventClaim, type BillingEventFacts, type BillingEventOutcome, type BillingEventStore,
} from '../../lib/stripe-billing-events.ts';
import { invoiceFailureIsCurrent, statusAfterInvoicePaid, subscriptionEventIsStale } from '../../lib/stripe-billing-state.ts';
import { functionBody, readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 0, Part 2 (S5): the billing webhook keeps a record of every event, ignores a replay, ignores the
 * other Stripe mode, and acts on Stripe's current answer rather than the event's copy.
 * Prompt: docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md. The concurrent claim is proved in SQL by
 * scripts/stripe-billing-events-check.sql (two claims, the second refused).
 */

/** An in-memory store with the claim function's rules (mig 416), minus the five-minute lease. */
function memoryStore() {
  const rows = new Map<string, { facts: BillingEventFacts; claimed: boolean; processed: boolean; ignored: string | null; attempts: number; error: string | null }>();
  const store: BillingEventStore = {
    async ignore(facts, reason) {
      if (!rows.has(facts.id)) rows.set(facts.id, { facts, claimed: false, processed: false, ignored: reason, attempts: 1, error: null });
    },
    async claim(facts): Promise<BillingEventClaim> {
      const r = rows.get(facts.id);
      if (!r) { rows.set(facts.id, { facts, claimed: true, processed: false, ignored: null, attempts: 1, error: null }); return 'new'; }
      if (r.processed || r.ignored) return 'duplicate';
      if (r.claimed) return 'busy';
      r.claimed = true; r.attempts += 1; r.error = null;
      return 'retry';
    },
    async done(id, outcome) {
      const r = rows.get(id)!;
      r.processed = true; r.claimed = false; r.ignored = outcome === 'no_customer' ? 'no_customer' : null;
    },
    async fail(id, message) {
      const r = rows.get(id)!;
      r.error = message; r.claimed = false;
    },
  };
  return { store, rows };
}

const event = (over: Partial<Stripe.Event> & { object?: Record<string, unknown> } = {}): Stripe.Event => ({
  id: 'evt_1',
  type: 'customer.subscription.updated',
  livemode: false,
  data: { object: over.object ?? { id: 'sub_1', object: 'subscription', customer: 'cus_1', status: 'active' } },
  ...over,
} as unknown as Stripe.Event);

function runner(outcome: BillingEventOutcome = 'processed') {
  const calls: Array<string | null> = [];
  let failNext: Error | null = null;
  return {
    calls,
    failOnce(error: Error) { failNext = error; },
    run: async (_e: Stripe.Event, customerId: string | null) => {
      calls.push(customerId);
      if (failNext) { const e = failNext; failNext = null; throw e; }
      return outcome;
    },
  };
}

const deps = (store: BillingEventStore, live = false) => ({ store, live: () => live, report: () => {} });

describe('the record of what arrived', () => {
  it('keeps the ids: who, which subscription, which object', () => {
    assert.deepEqual(billingEventFacts(event()), {
      id: 'evt_1', type: 'customer.subscription.updated', livemode: false, customerId: 'cus_1', subscriptionId: 'sub_1', objectId: 'sub_1',
    });
    const invoice = billingEventFacts(event({
      type: 'invoice.payment_succeeded',
      object: { id: 'in_1', customer: { id: 'cus_2' }, parent: { subscription_details: { subscription: 'sub_9' } } },
    } as never));
    assert.equal(invoice.customerId, 'cus_2');
    assert.equal(invoice.subscriptionId, 'sub_9');
    assert.equal(invoice.objectId, 'in_1');
    const dispute = billingEventFacts(event({ type: 'charge.dispute.created', object: { id: 'dp_1', charge: 'ch_1' } } as never));
    assert.equal(dispute.customerId, null, 'a dispute names no customer');
    assert.equal(dispute.subscriptionId, null);
  });
});

describe('a replay does nothing', () => {
  it('the second delivery of one event is a duplicate and never runs', async () => {
    const { store, rows } = memoryStore();
    const r = runner();
    const first = await receiveBillingEvent(event(), r.run, deps(store));
    const second = await receiveBillingEvent(event(), r.run, deps(store));
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), { received: true, duplicate: true });
    assert.equal(r.calls.length, 1);
    assert.equal(rows.get('evt_1')!.processed, true);
  });

  it('a delivery that arrives while another is running it answers 500 and does not run it twice', async () => {
    const { store } = memoryStore();
    await store.claim(billingEventFacts(event()));
    const r = runner();
    const res = await receiveBillingEvent(event(), r.run, deps(store));
    assert.equal(res.status, 500);
    assert.equal(r.calls.length, 0);
  });
});

describe('the other Stripe mode', () => {
  it('a test event on a live key is recorded with the reason and never runs', async () => {
    const { store, rows } = memoryStore();
    const r = runner();
    const res = await receiveBillingEvent(event({ livemode: false }), r.run, deps(store, true));
    assert.equal(res.status, 200);
    assert.equal(r.calls.length, 0);
    assert.equal(rows.get('evt_1')!.ignored, 'wrong_mode');
    assert.equal(rows.get('evt_1')!.processed, false);
  });
  it('a live event on a test key is recorded and never runs', async () => {
    const { store, rows } = memoryStore();
    const r = runner();
    await receiveBillingEvent(event({ livemode: true }), r.run, deps(store, false));
    assert.equal(r.calls.length, 0);
    assert.equal(rows.get('evt_1')!.ignored, 'wrong_mode');
  });
  it('the same mode runs', async () => {
    const { store } = memoryStore();
    const r = runner();
    await receiveBillingEvent(event({ livemode: true }), r.run, deps(store, true));
    assert.equal(r.calls.length, 1);
  });
});

describe('a failure is kept and retried', () => {
  it('a failed run answers 500 with the error on the row; the retry runs and succeeds', async () => {
    const { store, rows } = memoryStore();
    const r = runner();
    r.failOnce(new Error('Stripe could not be read'));
    const first = await receiveBillingEvent(event(), r.run, deps(store));
    assert.equal(first.status, 500);
    assert.equal(rows.get('evt_1')!.error, 'Stripe could not be read');
    assert.equal(rows.get('evt_1')!.processed, false);

    const retry = await receiveBillingEvent(event(), r.run, deps(store));
    assert.equal(retry.status, 200);
    assert.equal(r.calls.length, 2);
    assert.equal(rows.get('evt_1')!.processed, true);
    assert.equal(rows.get('evt_1')!.error, null);
    assert.equal(rows.get('evt_1')!.attempts, 2);
  });

  it('a claim that cannot be written answers 500 (Stripe retries) and runs nothing', async () => {
    const r = runner();
    const broken: BillingEventStore = { ...memoryStore().store, claim: async () => { throw new Error('db down'); } };
    const res = await receiveBillingEvent(event(), r.run, deps(broken));
    assert.equal(res.status, 500);
    assert.equal(r.calls.length, 0);
  });

  it('an event with no customer is claimed, then marked with the reason', async () => {
    const { store, rows } = memoryStore();
    const res = await receiveBillingEvent(event({ object: { id: 'pm_1' } } as never), runner('no_customer').run, deps(store));
    assert.equal(res.status, 200);
    assert.equal(rows.get('evt_1')!.processed, true);
    assert.equal(rows.get('evt_1')!.ignored, 'no_customer');
  });
});

describe('Stripe\'s current answer, not the event\'s copy', () => {
  it('an old payment after a newer cancellation does not reactivate', () => {
    assert.equal(statusAfterInvoicePaid('canceled'), null);
    assert.equal(statusAfterInvoicePaid('incomplete_expired'), null);
    assert.equal(statusAfterInvoicePaid('unpaid'), null);
  });
  it('a paid invoice writes the subscription\'s current paying status', () => {
    assert.equal(statusAfterInvoicePaid('active'), 'active');
    assert.equal(statusAfterInvoicePaid('trialing'), 'trialing', 'a $0 trial invoice no longer reads as active');
    assert.equal(statusAfterInvoicePaid('past_due'), 'past_due');
  });
  it('a failure Stripe has moved past says nothing', () => {
    assert.equal(invoiceFailureIsCurrent('active'), false);
    assert.equal(invoiceFailureIsCurrent('trialing'), false);
    assert.equal(invoiceFailureIsCurrent('canceled'), false);
    assert.equal(invoiceFailureIsCurrent('past_due'), true);
    assert.equal(invoiceFailureIsCurrent('incomplete'), true, 'a first invoice that fails still marks it past due, as before');
  });
  it('a late update about a subscription that has since ended is stale; the ending\'s own event is not', () => {
    assert.equal(subscriptionEventIsStale('active', 'canceled'), true);
    assert.equal(subscriptionEventIsStale('canceled', 'canceled'), false);
    assert.equal(subscriptionEventIsStale('incomplete_expired', 'incomplete_expired'), false);
    assert.equal(subscriptionEventIsStale('active', 'past_due'), false);
  });
});

describe('the webhook wears it', () => {
  const route = readCode('app/api/billing/webhook/route.ts');
  const seam = functionBody(route, 'runVerifiedBillingEvent');
  const arm = (name: string) => seam.slice(seam.indexOf(`case '${name}'`), seam.indexOf('case ', seam.indexOf(`case '${name}'`) + 6));

  it('every verified event goes through the record, to the one seam', () => {
    assert.match(route, /return receiveBillingEvent\(event, runVerifiedBillingEvent\)/);
    assert.ok(route.indexOf('constructEvent(') < route.indexOf('receiveBillingEvent(event'), 'the signature is checked first');
  });
  it('the customer-less return and the fee invoice come AFTER the claim, inside the seam', () => {
    assert.match(seam, /if \(!customerId\) return 'no_customer'/);
    assert.match(seam, /syncFeeInvoiceFromEvent/);
  });
  it('the subscription arm writes from a re-read subscription, and skips a stale one', () => {
    const sub = seam.slice(seam.indexOf("case 'customer.subscription.updated'"), seam.indexOf("case 'customer.subscription.deleted'"));
    assert.match(sub, /const sub = await stripe\.subscriptions\.retrieve\(eventSub\.id\)/);
    assert.ok(sub.indexOf('subscriptionEventIsStale(eventSub.status, sub.status)') < sub.indexOf('getPlanFromPriceId('));
  });
  it('both invoice arms ask Stripe before they write a status', () => {
    const paid = arm('invoice.payment_succeeded');
    assert.ok(paid.indexOf('stripe.subscriptions.retrieve(paidSubscriptionId)') < paid.indexOf('subscription_status: status'));
    assert.doesNotMatch(paid, /subscription_status: 'active'/);
    const failed = arm('invoice.payment_failed');
    assert.ok(failed.indexOf('invoiceFailureIsCurrent(') < failed.indexOf("subscription_status: 'past_due'"));
  });
});
