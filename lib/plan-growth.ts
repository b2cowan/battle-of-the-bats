import { PLAN_RANK } from './plan-features';
import type { OrgPlan } from './types';

/**
 * THE GROWTH HALF OF THE BUSINESS NUMBERS "BILLING EVENTS" CARD — pure decisions, no database.
 *
 *   · `subscription_started` — an org with no live subscription now has a paid plan that is paying or in
 *     its trial. A comeback after a cancellation or a lapse is a RECOVERY, never a new subscription.
 *   · `plan_upgraded` — an org that was already paying moved to a higher plan.
 *
 * The two never both apply to one change, so a customer is only ever in one row. Kept apart from
 * `platform-events` (which opens the database) so the rules can be tested on their own.
 */

/** Marks a Stripe subscription an in-app plan move changed; `applyMove` writes it, the webhook reads it. */
export const MOVE_METADATA_KEY = 'flhq_plan_move';

/**
 * True for the subscription update an in-app UP move causes. `applyMove` already records that upgrade
 * (it writes the new plan itself, so the webhook arrives to find nothing changed, or races it) — the
 * webhook skips its own upgrade event for it so one move is never counted twice.
 */
export function isInAppUpMove(metadata: Record<string, string> | null | undefined, planKey: string): boolean {
  return metadata?.[MOVE_METADATA_KEY] === 'up' && metadata.planKey === planKey;
}

export function isRecoveryTransition(previousStatus?: string | null, nextStatus?: string | null) {
  return (previousStatus === 'past_due' || previousStatus === 'canceled') &&
    (nextStatus === 'active' || nextStatus === 'trialing');
}

const PAYING_NOW_STATUSES = ['active', 'trialing'];
// A subscription that has not yet taken a first payment. Anything else with a subscription id — including a
// lapsed one (`unpaid`, `paused`) paying again — is an existing customer, so it is never a NEW subscription.
const NEVER_PAID_STATUSES = ['incomplete', 'incomplete_expired'];

/**
 * Was there a real subscription behind the org before this change? A free org, a Founding Season comp
 * (active, but no subscription id) and a subscription that never got past `incomplete` all say no —
 * so the first real subscription is counted once, and only once.
 */
function hadLiveSubscription(previousSubscriptionId?: string | null, previousStatus?: string | null) {
  return !!previousSubscriptionId && !NEVER_PAID_STATUSES.includes(previousStatus ?? '');
}

export type PlanMoveInput = {
  previousPlanId?: string | null;
  previousStatus?: string | null;
  previousSubscriptionId?: string | null;
  planId: string;
  status?: string | null;
};

export type PaysNowInput = {
  /** The plan the club holds on its own (what Stripe bills), never a free-time plan. */
  ownPlanId: string | null;
  status: string | null;
  subscriptionId: string | null;
  /** A running free-time plan grant lifts the club above its own plan. */
  onFreeTime: boolean;
};

/**
 * Does this club pay us today (Support console Stage 7, owner Q2 2026-10-27)? Its own plan is not the free Tournament
 * plan, its billing is ACTIVE, and a real subscription stands behind it. ⚠ Stricter than `PAYING_NOW_STATUSES` above, on
 * purpose: a subscription STARTS when its trial does (that rule's job), but a club in its trial does not pay yet. A
 * Founding Season comp is active with no subscription id; free time is a grant, not a payment; a `mock_` id is a test.
 */
export function paysNow(input: PaysNowInput): boolean {
  if (!input.ownPlanId || input.ownPlanId === 'tournament') return false;
  if (input.status !== 'active') return false;
  if (!hadLiveSubscription(input.subscriptionId, input.status) || input.subscriptionId!.startsWith('mock_')) return false;
  return !input.onFreeTime;
}

/** What a plan change means for the growth rows, if anything. */
export function classifyGrowthMove(input: PlanMoveInput): 'subscription_started' | 'plan_upgraded' | null {
  if (input.planId === 'tournament') return null;
  if (!PAYING_NOW_STATUSES.includes(input.status ?? '')) return null;
  if (isRecoveryTransition(input.previousStatus, input.status)) return null;
  if (!hadLiveSubscription(input.previousSubscriptionId, input.previousStatus)) return 'subscription_started';
  const from = PLAN_RANK[(input.previousPlanId ?? '') as OrgPlan];
  const to = PLAN_RANK[input.planId as OrgPlan];
  return from !== undefined && to !== undefined && to > from ? 'plan_upgraded' : null;
}
