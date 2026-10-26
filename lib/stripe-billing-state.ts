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

/** The statuses in which a subscription is paying right now. Checkout (A06) refuses a second subscription on these. */
export const PAYING_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due']);

/**
 * Which subscription a club's own record follows, when Stripe reports another one on the same customer.
 *
 * ⚠⚠ THE RECORD HOLDS ONE SUBSCRIPTION. The app never opens a second while one is paying (create-checkout refuses it), so
 * a second one is made outside the app, in Stripe's dashboard. It must NOT take the record over: the last event to arrive
 * used to win, and deleting that stray later blanked the record while the real subscription kept billing (mismatch seen
 * on the Money tab, 2026-10-26). The record moves to a different subscription only when the one on file is NOT paying,
 * by the same rule checkout uses to allow a new one: otherwise a club that paid for a new subscription would have it
 * dropped for good (the review of 2026-10-26: a subscription left unpaid, or a cancel that failed in Stripe).
 */
export function recordFollowsSubscription(args: { onFileId: string | null; incomingId: string; onFileIsPaying: boolean }): boolean {
  const { onFileId, incomingId, onFileIsPaying } = args;
  if (!onFileId || onFileId === incomingId || onFileId.startsWith('mock_')) return true;
  return !onFileIsPaying;
}

/**
 * Whether an event about a subscription (its deletion, its invoice paying or failing, its trial ending) is about the one
 * the club's record follows. Anything else (a stray made by hand, or the old one after a new one has taken over) leaves
 * the club's plan, status and renewal alone. Nothing on file, or an event that names no subscription (a one-off invoice):
 * the existing rules run as before.
 */
export function isTheRecordsSubscription(onFileId: string | null, eventSubscriptionId: string | null): boolean {
  return !onFileId || !eventSubscriptionId || onFileId === eventSubscriptionId || onFileId.startsWith('mock_');
}

/**
 * Whether the record's own subscription is paying: the record says so AND Stripe agrees. Gone from Stripe is not paying; any
 * other failure throws, so the webhook answers 500 and Stripe sends the event again rather than the record guessing.
 */
export async function subscriptionIsPaying(
  subscriptionId: string,
  recordedStatus: string | null,
  retrieve: (id: string) => Promise<{ status: string }>,
): Promise<boolean> {
  if (!PAYING_STATUSES.has(recordedStatus ?? '')) return false;
  try {
    return PAYING_STATUSES.has((await retrieve(subscriptionId)).status);
  } catch (error) {
    const { code, statusCode } = (error ?? {}) as { code?: string; statusCode?: number };
    if (code === 'resource_missing' || statusCode === 404) return false;
    throw error;
  }
}

/** The one sentence a refused staff plan change shows (drawing G 10), on the pencil and from every route that refuses. */
export const PAYING_CLUB_PLAN_REFUSAL =
  'This club pays through Stripe, so its plan changes there. The owner moves plan on their Plan & billing page, or cancel the subscription first. Changing it here would leave Stripe charging the old price.';
