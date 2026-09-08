import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildNextSeasonCheckoutParams,
  nextSeasonPlanOptions,
  nextSeasonFirstChargeIso,
  NEXT_SEASON_CHOICE_KIND,
  NEXT_SEASON_MIN_LEAD_MS,
  classifyNextSeasonSubscription,
} from '../../lib/next-season-choice.ts';
import { FOUNDING_SEASON_END } from '../../lib/plan-config.ts';

/**
 * ⚠⚠ THE ONE PROMISE THIS WHOLE FLOW MAKES: nothing is charged before the first-charge instant.
 *
 * The 2028 plan choice is built in September 2026 and cannot open until June 2027 or charge until
 * October 2027 — nine months of code that never runs. These tests are what makes that delay
 * survivable: they assert that the ONLY thing deciding when money moves is one constant, that no
 * relative trial length can creep in beside it, and that the builder REFUSES rather than emitting a
 * session Stripe would bill immediately.
 *
 * If one of these fails, do not "fix the test" — the failure means a code path can take a
 * customer's money early.
 */

const BASE = {
  customerId: 'cus_test',
  priceId: 'price_test',
  orgId: 'org-1',
  planKey: 'tournament_plus' as const,
  billingCycle: 'annual' as const,
  successUrl: 'https://example.test/billing?next_season=1',
  cancelUrl: 'https://example.test/billing',
};

/** A moment safely inside the summer window, expressed relative to the constant itself. */
const INSIDE_WINDOW = new Date(FOUNDING_SEASON_END).getTime() - 90 * 86_400_000;

describe('the next-season choice cannot charge early', () => {
  it('pins the first charge to FOUNDING_SEASON_END and nothing else', () => {
    const params = buildNextSeasonCheckoutParams({ ...BASE, now: INSIDE_WINDOW });
    const subscriptionData = params.subscription_data;
    assert.ok(subscriptionData, 'the session must carry subscription_data');
    assert.equal(
      subscriptionData.trial_end,
      Math.floor(new Date(FOUNDING_SEASON_END).getTime() / 1000),
      'the trial must end exactly at the Founding Season end instant',
    );
    assert.equal(nextSeasonFirstChargeIso(), FOUNDING_SEASON_END);
  });

  it('never emits a relative trial length — trial_period_days counts from the day of purchase', () => {
    const params = buildNextSeasonCheckoutParams({ ...BASE, now: INSIDE_WINDOW });
    // A June chooser with trial_period_days: 14 is charged in June. The key must not exist at all.
    assert.equal(
      'trial_period_days' in (params.subscription_data ?? {}),
      false,
      'trial_period_days must never be set — it would bill from the moment of choosing',
    );
  });

  it('raises no invoice at creation time', () => {
    const params = buildNextSeasonCheckoutParams({ ...BASE, now: INSIDE_WINDOW });
    assert.equal(params.subscription_data?.proration_behavior, 'none');
    assert.equal('billing_cycle_anchor' in (params.subscription_data ?? {}), false);
  });

  it('REFUSES to build when the first-charge instant is already in the past', () => {
    // Stripe reads a trial_end in the past as "the trial is over" and bills at once. This is the
    // failure mode that would take money from every account on the day the season ended.
    const afterTheSeason = new Date(FOUNDING_SEASON_END).getTime() + 1;
    assert.throws(
      () => buildNextSeasonCheckoutParams({ ...BASE, now: afterTheSeason }),
      /not far enough in the future/,
    );
  });

  it('refuses on the exact instant too — the boundary is not in the future', () => {
    const exactly = new Date(FOUNDING_SEASON_END).getTime();
    assert.throws(() => buildNextSeasonCheckoutParams({ ...BASE, now: exactly }), /not far enough in the future/);
  });

  it('KEEPS A MARGIN — it refuses while the instant is close enough that latency could overtake it', () => {
    // Between this check and Stripe receiving the request there is a network round trip. A request
    // that passed with milliseconds to spare could arrive AFTER the instant and be billed at once.
    // Closing the door a few minutes early costs a customer one retry; the alternative costs them a
    // charge we promised would not come.
    const justInside = new Date(FOUNDING_SEASON_END).getTime() - (NEXT_SEASON_MIN_LEAD_MS - 1);
    assert.throws(
      () => buildNextSeasonCheckoutParams({ ...BASE, now: justInside }),
      /not far enough in the future/,
    );
    // ...and it still builds with the margin cleared.
    const safelyOutside = new Date(FOUNDING_SEASON_END).getTime() - (NEXT_SEASON_MIN_LEAD_MS + 1000);
    assert.ok(buildNextSeasonCheckoutParams({ ...BASE, now: safelyOutside }).subscription_data?.trial_end);
  });
});

describe('the choice carries what the webhook needs to record it', () => {
  it('stamps the discriminator, the account and the plan on BOTH metadata bags', () => {
    const params = buildNextSeasonCheckoutParams({ ...BASE, now: INSIDE_WINDOW });
    for (const bag of [params.metadata, params.subscription_data?.metadata]) {
      assert.equal(bag?.choiceKind, NEXT_SEASON_CHOICE_KIND);
      assert.equal(bag?.orgId, 'org-1');
      assert.equal(bag?.planKey, 'tournament_plus');
      assert.equal(bag?.billingCycle, 'annual');
    }
  });

  it('carries the workspace id for a coach, and omits it for an organization', () => {
    // Without this, syncTeamWorkspaceSubscription — which finds a workspace BY subscription id —
    // matches nothing for a brand-new subscription on an existing comped workspace, and the
    // binding is silently lost.
    const coach = buildNextSeasonCheckoutParams({ ...BASE, teamWorkspaceId: 'ws-1', now: INSIDE_WINDOW });
    assert.equal(coach.metadata?.teamWorkspaceId, 'ws-1');
    const org = buildNextSeasonCheckoutParams({ ...BASE, now: INSIDE_WINDOW });
    assert.equal('teamWorkspaceId' in (org.metadata ?? {}), false);
  });

  it('opens a subscription, not a payment — a one-off would charge now', () => {
    const params = buildNextSeasonCheckoutParams({ ...BASE, now: INSIDE_WINDOW });
    assert.equal(params.mode, 'subscription');
  });
});

describe('what becomes of a choice subscription (rulings D2 + the withdrawal fix)', () => {
  it('is PENDING before the first charge — the plan must not move yet (D2)', () => {
    assert.equal(classifyNextSeasonSubscription('trialing'), 'pending');
    assert.equal(classifyNextSeasonSubscription('incomplete'), 'pending');
  });

  it('is WITHDRAWN when the customer cancels it or it expires unpaid', () => {
    // ⚠ THE ONE THAT TEARS AN ACCOUNT DOWN IF IT IS WRONG. The billing page hands the customer a
    // Stripe portal link, where cancelling the choice is the obvious thing to do after a change of
    // mind. Classified as anything but 'withdrawn', the webhook reads it as "this account
    // cancelled" and archives every tournament, hides the public site and suspends the org — while
    // the Founding Season comp still has months to run.
    for (const status of ['canceled', 'incomplete_expired', 'unpaid']) {
      assert.equal(classifyNextSeasonSubscription(status), 'withdrawn', status);
    }
  });

  it('is CONVERTED once it is live, and for any status it does not recognise', () => {
    // 'converted' is the safe default of the three: the customer gets what they paid for, and
    // nothing is torn down. An unrecognised future Stripe status lands here on purpose.
    for (const status of ['active', 'past_due', 'paused', 'trialing_paused', '', null, undefined]) {
      assert.equal(classifyNextSeasonSubscription(status), 'converted', String(status));
    }
  });
});

describe('what an account may choose', () => {
  it('offers the account its own plan — League and Club are early-access, not a real menu', () => {
    assert.deepEqual(nextSeasonPlanOptions('tournament_plus'), ['tournament_plus']);
    assert.deepEqual(nextSeasonPlanOptions('team'), ['team']);
  });

  it('offers nothing to an account comped onto a FREE plan — it has nothing to renew', () => {
    assert.deepEqual(nextSeasonPlanOptions('tournament'), []);
  });

  it('offers nothing for an unknown plan key rather than guessing', () => {
    assert.deepEqual(nextSeasonPlanOptions('some_future_plan'), []);
  });
});
