/**
 * Whether Stripe still bills a club, and what a staff plan change says when it does (Support console Stage 3, owner Q9).
 * Plain, with no client, so the record screen, the shared plan-change rule and the Money tab read ONE copy.
 *
 * Two questions, two answers, on purpose:
 *   · `stripeStillBills` — a subscription not yet cancelled in Stripe, WHATEVER its billing status (unpaid, incomplete,
 *     paused and an unknown status included). A staff plan change is refused while it holds: Stripe can still charge, and
 *     the webhook still writes its plan back.
 *   · `hasLiveSubscription` (lib/plan-move.ts) — the narrower "paying right now" (active, trial, past due) that a plan
 *     MOVE through Stripe and free time's plan grant ask; a move needs a subscription Stripe will prorate.
 */

/** The two Stripe statuses after which a subscription never charges again. */
export function isEndedSubscriptionStatus(status: string | null | undefined): boolean {
  return status === 'canceled' || status === 'incomplete_expired';
}

export function stripeStillBills(org: { stripeSubscriptionId: string | null; subscriptionStatus: string | null }): boolean {
  return !!org.stripeSubscriptionId
    && !org.stripeSubscriptionId.startsWith('mock_')
    && !isEndedSubscriptionStatus(org.subscriptionStatus);
}

/** The one sentence a refused staff plan change shows (drawing G 10), on the pencil and from every route that refuses. */
export const PAYING_CLUB_PLAN_REFUSAL =
  'This club pays through Stripe, so its plan changes there. The owner moves plan on their Plan & billing page, or cancel the subscription first. Changing it here would leave Stripe charging the old price.';
