/**
 * Stripe billing sync helpers.
 *
 * syncRepTeamBilling — keeps the Club plan rep-team add-on subscription item
 * in sync with the org's current active team count. Called on:
 *   - Rep team creation (when active_count >= 3 before creation)
 *   - Program year status → 'completed' or 'archived'
 *
 * Billable quantity = max(0, active_count - 3)
 * First 3 active rep teams are included in the Club plan price.
 */

import { supabaseAdmin } from './supabase-admin';
import { stripe } from './stripe';
import { getStripePriceId } from './stripe-prices';
import { getActiveRepTeamCount, updateOrgSubscription } from './db';

/**
 * Syncs the rep-team add-on subscription item for a Club org.
 * Safe to call at any time — no-ops when the org is not on Club or has no
 * active Stripe subscription.
 */
export async function syncRepTeamBilling(orgId: string): Promise<void> {
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan_id, stripe_subscription_id, subscription_period, rep_team_subscription_item_id')
    .eq('id', orgId)
    .maybeSingle();

  if (!org) return;
  if (org.plan_id !== 'club') return;
  if (!org.stripe_subscription_id) return;

  const activeCount = await getActiveRepTeamCount(orgId);
  const quantity = Math.max(0, activeCount - 3);
  const itemId = org.rep_team_subscription_item_id as string | null;

  if (itemId) {
    if (quantity > 0) {
      // Update existing item — Stripe creates a proration automatically.
      await stripe.subscriptionItems.update(itemId, { quantity });
    } else {
      // Quantity dropped to zero: remove the add-on line item.
      await stripe.subscriptionItems.del(itemId, { proration_behavior: 'always_invoice' });
      await updateOrgSubscription(orgId, { repTeamSubscriptionItemId: null });
    }
  } else if (quantity > 0) {
    // First billable team: create the add-on item on the subscription.
    const billingCycle = (org.subscription_period as 'monthly' | 'annual') ?? 'monthly';
    const priceId = await getStripePriceId('rep_team', billingCycle);

    if (!priceId) {
      // Config gap — price ID not entered via Platform Admin → Stripe Prices.
      // Log and bail rather than crashing; the billing page E6 section will
      // show 0 active add-ons until this is resolved.
      console.error(
        `[syncRepTeamBilling] No price ID for rep_team/${billingCycle} — ` +
        `add-on not created for org ${orgId}. Enter the price ID via Platform Admin → Stripe Prices.`,
      );
      return;
    }

    const item = await stripe.subscriptionItems.create({
      subscription: org.stripe_subscription_id as string,
      price: priceId,
      quantity,
      proration_behavior: 'always_invoice',
    });

    await updateOrgSubscription(orgId, { repTeamSubscriptionItemId: item.id });
  }
  // quantity === 0 and no itemId → nothing to do
}
