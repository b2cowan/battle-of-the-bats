import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { PLAN_BILLING_PROFILES, planCancellationImpact } from '../../lib/plan-billing-profile.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import { subscriptionAmount } from '../../lib/stripe-billing-state.ts';
import type { BillingSnapshot, BillingRead } from '../../lib/plan-billing-data.ts';
import type { BillingBodyViewProps } from '../../components/billing/BillingBody.tsx';
import { functionBody, readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 0, Part 6 (fix 1): the customer's Plan & billing page shows what their own subscription charges
 * (recorded by the billing webhook, mig 418), and the price list only when nothing is recorded. Every other branch (free,
 * Founding Season, staff free time) is unchanged. Prompt: docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md.
 */

const load = billingTestLoader();
const { BillingBodyView } = load('components/billing/BillingBody.tsx') as { BillingBodyView: ComponentType<BillingBodyViewProps> };
const ready = <T>(data: T): BillingRead<T> => ({ status: 'ready', data });

function fixture(key: keyof typeof PLAN_CONFIG, org: Partial<BillingSnapshot['org']> = {}): BillingBodyViewProps {
  const profile = PLAN_BILLING_PROFILES[key];
  const snapshot: BillingSnapshot = {
    org: { id: 'org-a', slug: 'club-a', name: 'Falcons', planId: key, ownPlanId: key, enabledAddons: [], subscriptionStatus: 'active',
      subscriptionPeriod: 'monthly', currentPeriodEnd: '2027-03-01', teamLimit: 15, tournamentLimit: 1, stripeSubscriptionId: 'sub_1', ...org } as BillingSnapshot['org'],
    canManageBilling: true, usage: ready({ teams: { count: 9, limit: 15 }, tournament_slots: { count: 1, limit: 1 }, staff_seats: { count: 2, limit: profile.config.seatLimit }, officials: 4 }),
    freeTime: ready({ freeTime: null, portal: null, foundingThrough: null, overLimitAfter: false }),
    founding: ready({ isFoundingSeason: false, compUntil: null }),
    gating: ready({ tournament: false, tournament_plus: false, team: false, league: true, club: true, club_large: true }),
    cancellation: ready({ currentPlan: key, ...planCancellationImpact(profile, [], 9), activeTeams: 9, activeTournamentCount: 0, tournaments: [], cancelled: null }),
    move: ready({ live: false, scheduledMove: null }),
  };
  return { snapshot, profile, ownProfile: profile, actions: { busy: null, cycle: 'monthly', setCycle() {}, portal() {}, card() {}, reactivate() {}, keep() {}, cancel() {}, change() {}, details() {}, choose() {}, retry() {} } };
}
const html = (props: BillingBodyViewProps) => renderToStaticMarkup(createElement(BillingBodyView, props)).replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
const listPrice = (key: keyof typeof PLAN_CONFIG, cycle: 'monthly' | 'annual') =>
  W.plan.price(cycle === 'annual' ? PLAN_CONFIG[key].annualPrice : PLAN_CONFIG[key].monthlyPrice, cycle);

describe('the price line', () => {
  it('a subscription at a price that is not today\'s list price shows its own amount', () => {
    const rendered = html(fixture('club', { subscriptionAmountCents: 4250, subscriptionCurrency: 'cad' }));
    assert.match(rendered, /\$42\.50 CAD \/ month/);
    assert.ok(!rendered.includes(listPrice('club', 'monthly')));
  });
  it('yearly reads as a year, at the recorded amount', () => {
    const rendered = html(fixture('club', { subscriptionPeriod: 'annual', subscriptionAmountCents: 50000, subscriptionCurrency: 'cad' }));
    assert.match(rendered, /\$500 CAD \/ year/);
  });
  it('nothing recorded yet: the list price, monthly and yearly, exactly as before', () => {
    assert.ok(html(fixture('club')).includes(listPrice('club', 'monthly')));
    assert.ok(html(fixture('club', { subscriptionPeriod: 'annual' })).includes(listPrice('club', 'annual')));
  });
  it('an amount in another currency is not printed as CAD: the list price stands', () => {
    assert.ok(html(fixture('club', { subscriptionAmountCents: 4250, subscriptionCurrency: 'usd' })).includes(listPrice('club', 'monthly')));
  });
  it('the free plan and a Founding Season comp are unchanged by a recorded amount', () => {
    assert.ok(html(fixture('tournament', { subscriptionAmountCents: 4250, subscriptionCurrency: 'cad' })).includes(W.plan.free));
    const comp = fixture('league', { subscriptionAmountCents: 4250, subscriptionCurrency: 'cad' });
    assert.ok(comp.profile.showFoundingSeason, 'league shows the Founding Season');
    comp.foundingActive = true;
    comp.snapshot.founding = ready({ isFoundingSeason: true, compUntil: '2027-09-30' });
    const rendered = html(comp);
    assert.ok(rendered.includes(W.founding.price));
    assert.doesNotMatch(rendered, /42\.50/);
  });
  it('words: whole dollars print as the list price does, cents with two places', () => {
    assert.equal(W.plan.paidPrice(2900, 'monthly'), W.plan.price(29, 'monthly'));
    assert.equal(W.plan.paidPrice(123456, 'annual'), '$1,234.56 CAD / year');
  });
});

describe('the webhook records it', () => {
  it('reads the first item\'s price; a price with no flat amount records nothing', () => {
    assert.deepEqual(subscriptionAmount({ items: { data: [{ price: { unit_amount: 2900, currency: 'CAD' } }] } }),
      { subscription_amount_cents: 2900, subscription_currency: 'cad' });
    assert.deepEqual(subscriptionAmount({ items: { data: [{ price: { unit_amount: null, currency: 'cad' } }] } }),
      { subscription_amount_cents: null, subscription_currency: null });
  });
  const route = readCode('app/api/billing/webhook/route.ts');
  it('the club arm writes it with the plan; a portal path writes it after, on the subscription it follows', () => {
    assert.match(route, /subscription_period: billingCycle,\s*current_period_end: currentPeriodEnd,\s*\.\.\.subscriptionAmount\(sub\),/);
    assert.match(functionBody(route, 'recordSubscriptionAmount'), /\.eq\('stripe_subscription_id', sub\.id\)/);
    assert.equal((route.match(/await recordSubscriptionAmount\(sub\)/g) ?? []).length, 2);
  });
  it('every arm that clears the cycle clears the amount', () => {
    const clears = route.match(/subscription_period: null,\s*current_period_end: null,\s*subscription_amount_cents: null,\s*subscription_currency: null,/g) ?? [];
    assert.equal(clears.length, (route.match(/subscription_period: null,/g) ?? []).length);
  });
  it('the page\'s org carries the cycle and the amount (the auth context copies its fields by hand)', () => {
    const auth = readCode('lib/api-auth.ts');
    assert.match(auth, /subscriptionPeriod: orgRow\.subscription_period \?\? undefined/);
    assert.match(auth, /subscriptionAmountCents: orgRow\.subscription_amount_cents \?\? null/);
    assert.match(auth, /subscriptionCurrency: orgRow\.subscription_currency \?\? null/);
  });
});
