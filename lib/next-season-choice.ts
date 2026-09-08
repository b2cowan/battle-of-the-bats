import type Stripe from 'stripe';
import {
  FOUNDING_SEASON_END,
  FOUNDING_SEASON_FIRST_CHARGE_LABEL,
  PLAN_CONFIG,
  isFoundingSeasonCardWindowOpen,
  type BillingCycle,
} from './plan-config';
import type { OrgPlan } from './types';

/**
 * THE NEXT-SEASON PLAN CHOICE — "what do you want for the season after this one?"
 *
 * Today its only opener is the Founding Season summer window (June 1 → September 30, 2027), and the
 * only instant it can charge on is FOUNDING_SEASON_END. It is named for the question rather than
 * the promotion because the question outlives the promotion; the constants stay in plan-config.
 *
 * ⚠⚠ THE ONE INVARIANT, AND THE ONLY REASON THIS MODULE IS SEPARATE FROM THE ROUTE:
 * NOTHING MAY BE CHARGED BEFORE THE FIRST-CHARGE INSTANT. Everything that decides when money moves
 * is in `buildNextSeasonSubscriptionData` and is pinned to ONE constant — no arithmetic, no
 * "days from now", no trial_period_days (which counts forward from the moment of purchase and would
 * charge a June chooser in June). tests/unit/next-season-choice.test.ts asserts all of it, including
 * the failure mode that matters most: a first-charge instant already in the PAST, which Stripe would
 * read as "trial over" and bill immediately.
 *
 * Owner rulings taken 2026-09-07 (FOUNDING_SEASON_2027_DESK_PLAN.md §8):
 *   D2 — recording a choice does NOT move the account's plan. The plan changes on the first-charge
 *        instant, not when the choice is made, so the free season is worth the same to everyone.
 *   D4 — a founding account that deliberately buys a BIGGER plan mid-season is charged for it on
 *        the ordinary checkout, as today. That is a purchase they chose; it is not this path.
 */

/** Checkout metadata discriminator — the webhook arm that binds a choice keys on this. */
export const NEXT_SEASON_CHOICE_KIND = 'founding_next_season';

/** The instant the first charge may land, and not one second sooner. */
export function nextSeasonFirstChargeIso(): string {
  return FOUNDING_SEASON_END;
}

/**
 * How far in the future the first charge must still be for a choice to be safe to create.
 *
 * Five minutes, because the only thing between our check and Stripe's clock is a network round
 * trip, and the failure it prevents is charging somebody we promised not to charge.
 */
export const NEXT_SEASON_MIN_LEAD_MS = 5 * 60 * 1000;

/**
 * What has become of a next-season choice subscription?
 *
 * ⚠⚠ THIS CLASSIFIER IS WHY THE WEBHOOK CANNOT TEAR AN ACCOUNT DOWN BY ACCIDENT.
 *
 * The choice creates a real Stripe subscription months before it charges, and the billing page
 * hands the customer a portal link. Three things can happen to it, and the ordinary webhook arms
 * get exactly one of them right:
 *
 *   • `pending` — still before the first charge. The account's plan must NOT move (ruling D2): it
 *     is still comped, and the plan changes when money changes hands.
 *   • `converted` — the trial ended and Stripe charged. NOW the plan applies, exactly as any other
 *     subscription's would.
 *   • `withdrawn` — the customer cancelled the choice, or it expired unpaid. This is the one the
 *     ordinary arms read as "this account cancelled", which would archive every tournament, hide
 *     the public site and suspend the org — or revoke a coach's Premium — while the account's
 *     actual Founding Season comp still had months to run. A withdrawn choice clears the choice
 *     and nothing else.
 *
 * Written as a classifier rather than a status string tested inline, because `trialing` happens to
 * be the only pre-charge status this subscription can hold TODAY. An unrecognised future status
 * falls to `converted`, which is the safe default of the three: the customer gets what they paid
 * for, and nothing is torn down.
 */
export type NextSeasonSubscriptionState = 'pending' | 'converted' | 'withdrawn';

export function classifyNextSeasonSubscription(status: string | null | undefined): NextSeasonSubscriptionState {
  if (status === 'trialing' || status === 'incomplete') return 'pending';
  if (status === 'canceled' || status === 'incomplete_expired' || status === 'unpaid') return 'withdrawn';
  return 'converted';
}

/** "October 1, 2027" — the customer-facing first-charge day, derived, never typed. */
export const NEXT_SEASON_FIRST_CHARGE_LABEL = FOUNDING_SEASON_FIRST_CHARGE_LABEL;

/** True while an account may make (or change) its next-season choice. */
export function isNextSeasonChoiceOpen(): boolean {
  return isFoundingSeasonCardWindowOpen();
}

/**
 * Which plans this account may choose for next season.
 *
 * Deliberately small, and it is the code that makes it small rather than a copy decision: League and
 * Club are `early_access` and their checkout 403s, so the honest menu is **the plan the account is
 * already on**, in either cycle. An account comped onto a FREE plan has nothing to renew and gets no
 * chooser at all — it simply stays free.
 *
 * Callers must still confirm the plan is live in `plan_gating` (a DB override can close a plan
 * without touching PLAN_CONFIG) — `assertNextSeasonPlanChoosable` does that server-side.
 */
export function nextSeasonPlanOptions(currentPlanKey: OrgPlan | string): OrgPlan[] {
  const plan = PLAN_CONFIG[currentPlanKey as OrgPlan];
  if (!plan) return [];
  if (plan.monthlyPrice === 0 && plan.annualPrice === 0) return [];
  return [currentPlanKey as OrgPlan];
}

/**
 * Build the Stripe Checkout parameters for a next-season choice.
 *
 * PURE — no Stripe call, no DB read — so the invariant above is unit-testable without a network.
 * Throws rather than returning a session that could bill early: a throw surfaces as a 500 the
 * operator sees, where a silent early charge surfaces as a refund and an apology.
 */
export function buildNextSeasonCheckoutParams(input: {
  customerId: string;
  priceId: string;
  orgId: string;
  planKey: OrgPlan;
  billingCycle: BillingCycle;
  successUrl: string;
  cancelUrl: string;
  /** Present for a coach workspace — the webhook binds the new subscription to it. */
  teamWorkspaceId?: string | null;
  /** Injectable clock, for the test. */
  now?: number;
}): Stripe.Checkout.SessionCreateParams {
  const firstChargeMs = new Date(nextSeasonFirstChargeIso()).getTime();
  const now = input.now ?? Date.now();

  if (!Number.isFinite(firstChargeMs)) {
    throw new Error('Next-season choice: the first-charge instant is not a valid date.');
  }
  // ⚠⚠ THE GUARD THAT MATTERS, AND IT KEEPS A MARGIN. Stripe treats a trial_end in the past as
  // "trial already over" and bills at once. If the season has ended — or an env override moved the
  // instant backwards — the choice must refuse to exist rather than take money early.
  //
  // The margin is not decoration. Between this check and Stripe receiving the request there is a
  // network round trip; a request that passed with 200ms to spare could arrive AFTER the instant
  // and be billed immediately. NEXT_SEASON_MIN_LEAD_MS buys more room than any plausible request
  // takes, at the cost of closing the door a minute early on the very last day — which costs a
  // customer one retry, where the alternative costs them a charge they were promised would not come.
  if (firstChargeMs - NEXT_SEASON_MIN_LEAD_MS <= now) {
    throw new Error(
      `Next-season choice is closed: the first charge would be ${NEXT_SEASON_FIRST_CHARGE_LABEL}, which is not far enough in the future to be safe.`,
    );
  }

  const metadata: Record<string, string> = {
    choiceKind: NEXT_SEASON_CHOICE_KIND,
    orgId: input.orgId,
    planKey: input.planKey,
    billingCycle: input.billingCycle,
  };
  if (input.teamWorkspaceId) metadata.teamWorkspaceId = input.teamWorkspaceId;

  return {
    mode: 'subscription',
    customer: input.customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    subscription_data: {
      // The whole promise, in one field, from one constant.
      trial_end: Math.floor(firstChargeMs / 1000),
      // No proration can raise an invoice at creation time.
      proration_behavior: 'none',
      metadata,
      // NEVER trial_period_days — it counts from the moment of purchase, so a June chooser would be
      // charged in June. The invariant test asserts this key is absent.
    },
    metadata,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
}
