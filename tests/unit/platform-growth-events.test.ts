import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyGrowthMove, isInAppUpMove, type PlanMoveInput } from '../../lib/plan-growth.ts';

// The growth half of the Business numbers "Billing events" card. One customer, one row.
const cases: Array<[string, PlanMoveInput, 'subscription_started' | 'plan_upgraded' | null]> = [
  ['a free org that starts paying is a new subscription',
    { previousPlanId: 'tournament', previousStatus: 'active', previousSubscriptionId: null, planId: 'tournament_plus', status: 'active' },
    'subscription_started'],
  ['a trial start is a new subscription',
    { previousPlanId: 'tournament', previousStatus: 'active', previousSubscriptionId: null, planId: 'club', status: 'trialing' },
    'subscription_started'],
  ['a Founding Season comp that starts paying is new, once',
    { previousPlanId: 'tournament_plus', previousStatus: 'active', previousSubscriptionId: null, planId: 'tournament_plus', status: 'active' },
    'subscription_started'],
  ['a subscription that sat in incomplete is new when it first goes live',
    { previousPlanId: 'tournament', previousStatus: 'incomplete', previousSubscriptionId: 'sub_1', planId: 'league', status: 'active' },
    'subscription_started'],
  ['a lapsed subscription (unpaid) paying again is a returning customer, not a new one',
    { previousPlanId: 'league', previousStatus: 'unpaid', previousSubscriptionId: 'sub_1', planId: 'league', status: 'active' },
    null],
  ['a paused subscription resuming is a returning customer, not a new one',
    { previousPlanId: 'league', previousStatus: 'paused', previousSubscriptionId: 'sub_1', planId: 'league', status: 'active' },
    null],
  ['the same subscription is not counted again when its status moves on',
    { previousPlanId: 'league', previousStatus: 'trialing', previousSubscriptionId: 'sub_1', planId: 'league', status: 'active' },
    null],
  ['a paying org moving to a higher plan is an upgrade, not a new subscription',
    { previousPlanId: 'tournament_plus', previousStatus: 'active', previousSubscriptionId: 'sub_1', planId: 'club', status: 'active' },
    'plan_upgraded'],
  ['a move down is not growth',
    { previousPlanId: 'club_large', previousStatus: 'active', previousSubscriptionId: 'sub_1', planId: 'club', status: 'active' },
    null],
  ['a comeback after a cancellation is a recovery, not growth',
    { previousPlanId: 'club', previousStatus: 'canceled', previousSubscriptionId: 'sub_1', planId: 'club_large', status: 'active' },
    null],
  ['a comeback after a lapse is a recovery, not growth',
    { previousPlanId: 'club', previousStatus: 'past_due', previousSubscriptionId: 'sub_1', planId: 'club_large', status: 'active' },
    null],
  ['a cancelled org with no subscription id coming back is still a recovery',
    { previousPlanId: 'club', previousStatus: 'canceled', previousSubscriptionId: null, planId: 'club', status: 'trialing' },
    null],
  ['the free plan is never growth',
    { previousPlanId: 'club', previousStatus: 'active', previousSubscriptionId: 'sub_1', planId: 'tournament', status: 'active' },
    null],
  ['a status that is not paying is not growth yet',
    { previousPlanId: 'tournament', previousStatus: 'active', previousSubscriptionId: null, planId: 'league', status: 'incomplete' },
    null],
  ['a paying org slipping to past due is not growth',
    { previousPlanId: 'league', previousStatus: 'active', previousSubscriptionId: 'sub_1', planId: 'league', status: 'past_due' },
    null],
];

describe('classifyGrowthMove', () => {
  for (const [name, input, expected] of cases) {
    it(name, () => assert.equal(classifyGrowthMove(input), expected));
  }
});

describe('isInAppUpMove', () => {
  it('recognises the Stripe update an in-app move up causes, for that plan only', () => {
    assert.equal(isInAppUpMove({ flhq_plan_move: 'up', planKey: 'club' }, 'club'), true);
    assert.equal(isInAppUpMove({ flhq_plan_move: 'up', planKey: 'club' }, 'club_large'), false);
    assert.equal(isInAppUpMove({ flhq_plan_move: 'down', planKey: 'club' }, 'club'), false);
    assert.equal(isInAppUpMove(null, 'club'), false);
  });
});
