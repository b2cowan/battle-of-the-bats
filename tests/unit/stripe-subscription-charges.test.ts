import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {
  handleSubscriptionChargeEvent, isSubscriptionChargeEvent,
  type OwnerAlert, type SubscriptionChargeDeps,
} from '../../lib/stripe-subscription-charges.ts';
import { receiveBillingEvent, type BillingEventFacts, type BillingEventStore } from '../../lib/stripe-billing-events.ts';
import type { PlatformEventInput } from '../../lib/platform-events.ts';
import { EMAIL_KINDS } from '../../lib/email-kinds.ts';
import { functionBody, readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 0, Part 4 (S9): a dispute or refund on one of OUR subscription charges reaches the right club's
 * record and the owner's inbox once; a charge that paid no subscription invoice is recorded and left alone; nothing is
 * suspended. Prompt: docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md.
 */

const charge = (over: Partial<Stripe.Charge> = {}) => ({
  id: 'ch_1', amount: 2900, amount_refunded: 0, currency: 'cad', customer: 'cus_1', payment_intent: 'pi_1',
  refunds: { data: [] }, ...over,
}) as unknown as Stripe.Charge;

const subscriptionInvoice = { id: 'in_1', parent: { subscription_details: { subscription: 'sub_1' } } } as unknown as Stripe.Invoice;

const disputeEvent = (type: string, over: Record<string, unknown> = {}) => ({
  id: `evt_${type}`, type, livemode: false,
  data: { object: { id: 'du_1', charge: 'ch_1', amount: 2900, currency: 'cad', reason: 'product_not_received', status: 'needs_response',
    evidence_details: { due_by: 1_800_000_000 }, ...over } },
}) as unknown as Stripe.Event;

function harness(opts: { charge?: Stripe.Charge; invoice?: Stripe.Invoice | null; owner?: boolean; consoleRefunds?: string[] } = {}) {
  const events: PlatformEventInput[] = [];
  const alerts: OwnerAlert[] = [];
  const reads: string[] = [];
  const deps: SubscriptionChargeDeps = {
    async retrieveCharge(id) { reads.push(id); return opts.charge ?? charge(); },
    async invoiceForPaymentIntent() { return opts.invoice === undefined ? subscriptionInvoice : opts.invoice; },
    async ownerOf() { return opts.owner === false ? null : { orgId: 'org-1', orgName: 'Riverdale Minor Ball', teamWorkspaceId: null }; },
    async consoleRefundIds() { return new Set(opts.consoleRefunds ?? []); },
    async writeEvent(input) { events.push(input); },
    async alertOwner(alert) { alerts.push(alert); },
    live: () => false,
    siteUrl: 'https://example.test',
  };
  return { deps, events, alerts, reads };
}

describe('a dispute on a subscription charge', () => {
  it('reaches the right club, re-reads the charge, writes one event and emails the owner once', async () => {
    const h = harness();
    assert.equal(await handleSubscriptionChargeEvent(disputeEvent('charge.dispute.created'), h.deps), 'processed');
    assert.deepEqual(h.reads, ['ch_1']);
    assert.equal(h.events.length, 1);
    assert.equal(h.events[0].eventType, 'subscription_charge_disputed');
    assert.equal(h.events[0].orgId, 'org-1');
    assert.equal(h.events[0].sourceEventId, 'evt_charge.dispute.created:subscription_charge_disputed');
    assert.equal(h.events[0].metadata?.stripeSubscriptionId, 'sub_1');
    assert.equal(h.alerts.length, 1);
    assert.match(h.alerts[0].subject, /Riverdale Minor Ball/);
    assert.match(h.alerts[0].html, /Product not received/);
    assert.match(h.alerts[0].html, /Nothing on the account has been changed/);
    assert.match(h.alerts[0].html, /dashboard\.stripe\.com\/test\/disputes\/du_1/);
    assert.equal(h.alerts[0].idempotencyKey, 'billing-charge-alert:evt_charge.dispute.created');
  });

  it('an update is recorded but does not email; a closing emails with its result', async () => {
    const h = harness();
    await handleSubscriptionChargeEvent(disputeEvent('charge.dispute.updated', { status: 'under_review' }), h.deps);
    assert.equal(h.events[0].eventType, 'subscription_dispute_updated');
    assert.equal(h.alerts.length, 0);
    await handleSubscriptionChargeEvent(disputeEvent('charge.dispute.closed', { status: 'lost' }), h.deps);
    assert.equal(h.events[1].eventType, 'subscription_dispute_closed');
    assert.match(h.alerts[0].subject, /Dispute closed \(Lost\)/);
  });

  it('a club we cannot match is still told, with the Stripe customer, and no club link', async () => {
    const h = harness({ owner: false });
    await handleSubscriptionChargeEvent(disputeEvent('charge.dispute.created'), h.deps);
    assert.equal(h.events[0].orgId, null);
    assert.match(h.alerts[0].html, /cus_1/);
    assert.doesNotMatch(h.alerts[0].html, /platform-admin\/orgs/);
  });
});

describe('a charge that is not a subscription charge', () => {
  it('a charge whose payment paid no invoice (a fee, a one-off) is not ours: nothing written, nobody told', async () => {
    const h = harness({ invoice: null });
    assert.equal(await handleSubscriptionChargeEvent(disputeEvent('charge.dispute.created'), h.deps), 'not_ours');
    assert.equal(h.events.length, 0);
    assert.equal(h.alerts.length, 0);
  });
  it('an invoice that bills no subscription is not ours', async () => {
    const h = harness({ invoice: { id: 'in_fee', parent: null } as unknown as Stripe.Invoice });
    assert.equal(await handleSubscriptionChargeEvent(disputeEvent('charge.dispute.created'), h.deps), 'not_ours');
  });
  it('a charge with no payment behind it is not ours', async () => {
    const h = harness({ charge: charge({ payment_intent: null }) });
    assert.equal(await handleSubscriptionChargeEvent(disputeEvent('charge.dispute.created'), h.deps), 'not_ours');
  });
});

describe('a refund on a subscription charge', () => {
  const refunded = (id = 'evt_refund') => ({
    id, type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_1', customer: 'cus_1' } },
  }) as unknown as Stripe.Event;
  const withRefunds = charge({
    amount_refunded: 1000,
    refunds: { data: [{ id: 're_old', amount: 500, currency: 'cad', created: 1 }, { id: 're_new', amount: 500, currency: 'cad', created: 2 }] },
  } as never);

  it('is recorded with the latest refund and emailed', async () => {
    const h = harness({ charge: withRefunds });
    assert.equal(await handleSubscriptionChargeEvent(refunded(), h.deps), 'processed');
    assert.equal(h.events[0].eventType, 'subscription_charge_refunded');
    assert.equal(h.events[0].metadata?.refundId, 're_new');
    assert.equal(h.events[0].metadata?.fromConsole, false);
    assert.match(h.alerts[0].html, /refunded in Stripe/);
  });
  it('says so when our console made it', async () => {
    const h = harness({ charge: withRefunds, consoleRefunds: ['re_new'] });
    await handleSubscriptionChargeEvent(refunded(), h.deps);
    assert.equal(h.events[0].metadata?.fromConsole, true);
    assert.match(h.alerts[0].html, /from our support console/);
  });
});

describe('through the record (Part 2)', () => {
  it('a replayed dispute does nothing the second time', async () => {
    const seen = new Set<string>();
    const store: BillingEventStore = {
      async ignore() {},
      async claim(f: BillingEventFacts) { if (seen.has(f.id)) return 'duplicate'; seen.add(f.id); return 'new'; },
      async done() {},
      async fail() {},
    };
    const h = harness();
    const run = (e: Stripe.Event) => handleSubscriptionChargeEvent(e, h.deps);
    const deps = { store, live: () => false, report: () => {} };
    await receiveBillingEvent(disputeEvent('charge.dispute.created'), run, deps);
    const second = await receiveBillingEvent(disputeEvent('charge.dispute.created'), run, deps);
    assert.deepEqual(await second.json(), { received: true, duplicate: true });
    assert.equal(h.events.length, 1);
    assert.equal(h.alerts.length, 1);
  });
  it('a failed charge read throws, so the webhook answers 500 and Stripe retries', async () => {
    const h = harness();
    h.deps.retrieveCharge = async () => { throw new Error('Stripe is down'); };
    await assert.rejects(handleSubscriptionChargeEvent(disputeEvent('charge.dispute.created'), h.deps), /Stripe is down/);
    assert.equal(h.events.length, 0);
  });
});

describe('the webhook wears it', () => {
  const route = readCode('lib/billing-webhook-handler.ts');
  const seam = functionBody(route, 'runVerifiedBillingEvent');
  it('handles the four events BEFORE the customer-less early return (a dispute names no customer)', () => {
    for (const t of ['charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed', 'charge.refunded']) {
      assert.ok(isSubscriptionChargeEvent(t), t);
    }
    // The customer-less return lives in the plan's own work (GST/HST Stage 3 records an invoice after it), which the seam calls
    // only after these four are handled.
    const handled = seam.indexOf('isSubscriptionChargeEvent(event.type)');
    const planWork = seam.indexOf('await runPlanWork(event, customerId)');
    assert.ok(handled > -1 && planWork > handled, 'the four must be handled before the plan work (and its customer-less return)');
    assert.ok(!seam.includes("if (!customerId) return 'no_customer'"), 'the customer-less return must not come before the four');
    assert.ok(functionBody(route, 'runPlanWork').includes("if (!customerId) return 'no_customer'"));
  });
  it('suspends nothing: the handler writes no organization and cancels nothing', () => {
    const handler = readCode('lib/stripe-subscription-charges.ts');
    assert.doesNotMatch(handler, /from\('organizations'\)|billing_suspended|subscriptions\.cancel/);
  });
  it('the owner alert has its own kind, in our inbox', () => {
    assert.equal(EMAIL_KINDS.subscription_charge_alert.klass, 'inbox');
    assert.match(route, /kind: 'subscription_charge_alert'/);
  });
  it('the audit expects the four events on the billing endpoint', () => {
    const audit = readCode('scripts/audit-stripe-billing.mjs');
    for (const t of ['charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed', 'charge.refunded']) {
      assert.ok(audit.includes(`'${t}'`), t);
    }
  });
});
