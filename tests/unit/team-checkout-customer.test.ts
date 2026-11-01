import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buyerStripeCustomer, type BuyerCustomerDeps } from '../../lib/team-checkout-customer.ts';
import { readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 0, Part 7 (S10): one Stripe customer per Coaches Portal buyer, and no second trial.
 * Prompt: docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md.
 */

function deps(over: Partial<BuyerCustomerDeps> = {}) {
  const calls = { created: 0, searched: 0, reported: [] as unknown[] };
  const d: BuyerCustomerDeps = {
    async portalCustomerIds() { return []; },
    async customersByOwner() { calls.searched++; return []; },
    async create() { calls.created++; return 'cus_new'; },
    report(error) { calls.reported.push(error); },
    ...over,
  };
  return { d, calls };
}

describe('the buyer\'s Stripe customer', () => {
  it('a portal they already pay for: its customer, and nothing searched or created', async () => {
    const { d, calls } = deps({ async portalCustomerIds() { return ['cus_portal'] ; } });
    assert.deepEqual(await buyerStripeCustomer('u1', d), { customerId: 'cus_portal', source: 'portal' });
    assert.equal(calls.searched, 0); assert.equal(calls.created, 0);
  });
  it('no portal: a customer an earlier checkout made for them (their user id in its metadata)', async () => {
    const { d, calls } = deps({ async customersByOwner() { return ['cus_earlier']; } });
    assert.deepEqual(await buyerStripeCustomer('u1', d), { customerId: 'cus_earlier', source: 'metadata' });
    assert.equal(calls.created, 0);
  });
  it('neither: a new one', async () => {
    const { d, calls } = deps();
    assert.deepEqual(await buyerStripeCustomer('u1', d), { customerId: 'cus_new', source: 'created' });
    assert.equal(calls.created, 1);
  });
  it('a mock customer is never reused', async () => {
    const { d } = deps({ async portalCustomerIds() { return ['mock_cus_team_1']; }, async customersByOwner() { return ['mock_cus_2']; } });
    assert.equal((await buyerStripeCustomer('u1', d)).source, 'created');
  });
  it('a failed search is reported and falls through to creating one (never refuses the checkout)', async () => {
    const { d, calls } = deps({ async customersByOwner() { throw new Error('search unavailable'); } });
    assert.equal((await buyerStripeCustomer('u1', d)).source, 'created');
    assert.equal(calls.reported.length, 1);
  });
});

describe('the team checkout wears it', () => {
  const route = readCode('app/api/billing/create-team-checkout/route.ts');
  it('finds the buyer\'s customer instead of creating one on every click', () => {
    assert.match(route, /await buyerStripeCustomer\(user\.id, \{/);
    assert.equal((route.match(/stripe\.customers\.create\(/g) ?? []).length, 1, 'the only create is the fall-through');
    assert.ok(route.indexOf('stripe.customers.create(') > route.indexOf('async create()'));
    assert.match(route, /customer: customerId,/);
  });
  it('a portal a club pays for, or one that became a club, never lends its customer', () => {
    assert.match(route, /\.eq\('billing_owner_user_id', userId\)\.neq\('billing_mode', 'org_team_addon'\)\.neq\('workspace_state', 'org_owned'\)/);
  });
  it('no second trial, by the club checkout\'s one rule; Keep Premium still gets none', () => {
    assert.match(route, /!keepPortal && mergedConfig\.trialDays > 0 && !\(source !== 'created' && await hadSubscriptionBefore\(customerId\)\)/);
    assert.match(route, /\.\.\.\(trialDays > 0 \? \{ trial_period_days: trialDays \} : \{\}\)/);
    assert.match(route, /import \{ hadSubscriptionBefore \} from '@\/lib\/plan-move'/);
  });
});
