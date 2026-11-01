/**
 * One Stripe customer per Coaches Portal buyer (Plans & pricing Stage 0, Part 7, S10).
 *
 * The team checkout created a NEW Stripe customer on every click, so a coach's history was spread over many customers and
 * the no-second-trial rule (`hadSubscriptionBefore`, lib/plan-move.ts) could never see it: every fresh customer had never
 * held a subscription. The club checkout's org-based `ensureStripeCustomer` does not fit, because a coach's checkout starts
 * before their portal's organization exists. So the buyer is found by who they are, in this order:
 *   1. the customer on a Coaches Portal they already pay for (billing owner; not one a club pays for, not one that became a
 *      club, whose customer is the club's now);
 *   2. a customer whose metadata carries their user id (every customer this checkout creates carries it, so a checkout
 *      abandoned before any portal existed is found again);
 *   3. a new customer, carrying that user id.
 * A failed search falls through to creating one (today's behaviour) and is reported; it never refuses the checkout.
 */

export type BuyerCustomerSource = 'portal' | 'metadata' | 'created';

export type BuyerCustomerDeps = {
  /** Customers on the Coaches Portals this person pays for, newest first. */
  portalCustomerIds(userId: string): Promise<string[]>;
  /** Customers whose metadata names this person (`ownerUserId`), newest first. */
  customersByOwner(userId: string): Promise<string[]>;
  create(): Promise<string>;
  report(error: unknown): void;
};

const real = (id: string | null | undefined): id is string => !!id && !id.startsWith('mock_');

export async function buyerStripeCustomer(userId: string, deps: BuyerCustomerDeps): Promise<{ customerId: string; source: BuyerCustomerSource }> {
  const onPortal = (await deps.portalCustomerIds(userId)).find(real);
  if (onPortal) return { customerId: onPortal, source: 'portal' };
  try {
    const byOwner = (await deps.customersByOwner(userId)).find(real);
    if (byOwner) return { customerId: byOwner, source: 'metadata' };
  } catch (error) {
    deps.report(error);
  }
  return { customerId: await deps.create(), source: 'created' };
}
