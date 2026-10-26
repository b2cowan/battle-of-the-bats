/**
 * A club's record follows ONE subscription (Money-tab walk M2, 2026-10-26). A second subscription made by hand in
 * Stripe's dashboard must not take the record over, and deleting it, or its invoices, must not blank the record,
 * flip its status or suspend the club. And a club that really starts a new subscription must not have it dropped.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  PAYING_STATUSES, isTheRecordsSubscription, recordFollowsSubscription, subscriptionIsPaying,
} from '../../lib/stripe-billing-state.ts';

const retrieving = (status: string) => async () => ({ status });
const failing = (error: unknown) => async (): Promise<{ status: string }> => { throw error; };

describe('which subscription the record follows', () => {
  it('a stray second subscription does not take over while the one on file is paying', () => {
    assert.equal(recordFollowsSubscription({ onFileId: 'sub_known', incomingId: 'sub_stray', onFileIsPaying: true }), false);
  });
  it('the record moves on once the one on file is not paying', () => {
    assert.equal(recordFollowsSubscription({ onFileId: 'sub_old', incomingId: 'sub_new', onFileIsPaying: false }), true);
  });
  it('the first subscription, the same one again, and a dev placeholder always go through', () => {
    assert.equal(recordFollowsSubscription({ onFileId: null, incomingId: 'sub_a', onFileIsPaying: true }), true);
    assert.equal(recordFollowsSubscription({ onFileId: 'sub_a', incomingId: 'sub_a', onFileIsPaying: true }), true);
    assert.equal(recordFollowsSubscription({ onFileId: 'mock_sub_x', incomingId: 'sub_a', onFileIsPaying: true }), true);
  });
});

describe('whether the one on file is paying (the same rule checkout uses to allow a new subscription)', () => {
  it('paying means active, trialing or past due, in our record AND in Stripe', async () => {
    for (const status of PAYING_STATUSES) assert.equal(await subscriptionIsPaying('sub_a', status, retrieving(status)), true);
    assert.deepEqual([...PAYING_STATUSES].sort(), ['active', 'past_due', 'trialing']);
  });
  it('unpaid, incomplete, paused and ended are not paying, so a new subscription can take over', async () => {
    for (const status of ['unpaid', 'incomplete', 'paused', 'canceled', 'incomplete_expired']) {
      assert.equal(await subscriptionIsPaying('sub_a', 'active', retrieving(status)), false, status);
    }
  });
  it('a club our record calls canceled is not paying even if Stripe still bills (a cancel that failed in Stripe)', async () => {
    assert.equal(await subscriptionIsPaying('sub_a', 'canceled', retrieving('active')), false);
  });
  it('a subscription Stripe has never heard of is not paying; any other failure throws so Stripe retries', async () => {
    assert.equal(await subscriptionIsPaying('sub_a', 'active', failing({ code: 'resource_missing' })), false);
    assert.equal(await subscriptionIsPaying('sub_a', 'active', failing({ statusCode: 404 })), false);
    await assert.rejects(subscriptionIsPaying('sub_a', 'active', failing({ statusCode: 500 })));
  });
});

describe('which events are about the club’s own subscription', () => {
  it('only the subscription on file speaks for the club', () => {
    assert.equal(isTheRecordsSubscription('sub_known', 'sub_known'), true);
    assert.equal(isTheRecordsSubscription('sub_known', 'sub_stray'), false);
  });
  it('nothing on file, or an event naming no subscription (a one-off invoice), keeps the existing rules', () => {
    assert.equal(isTheRecordsSubscription(null, 'sub_any'), true);
    assert.equal(isTheRecordsSubscription('sub_known', null), true);
  });
});

describe('the webhook asks these questions before it writes', () => {
  const webhook = readCode('app/api/billing/webhook/route.ts');
  const before = (needle: string, later: string) => {
    const at = webhook.indexOf(needle);
    return at > -1 && at < webhook.indexOf(later, at);
  };
  it('guards the plan write', () => {
    assert.match(webhook, /!recordFollowsSubscription\(/);
    assert.ok(before('recordFollowsSubscription(', ".from('organizations')\n          .update({\n            plan_id: planKey"));
  });
  it('guards the deletion before any archive or suspension', () => {
    assert.ok(before('isTheRecordsSubscription(org.stripe_subscription_id, sub.id)', "reason: 'Stripe subscription deleted'"));
  });
  it('guards both invoice events and the trial-ending email', () => {
    assert.ok(before("case 'invoice.payment_succeeded'", 'isTheRecordsSubscription(currentOrg.stripe_subscription_id, invoiceSubscriptionId(invoice))'));
    assert.match(webhook, /isTheRecordsSubscription\(currentOrg\.stripe_subscription_id, invoiceSubscriptionId\(failedInvoice\)\)/);
    assert.match(webhook, /isTheRecordsSubscription\(org\.stripe_subscription_id, sub\.id\)\) break/);
  });
});
