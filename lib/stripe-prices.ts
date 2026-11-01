import { supabaseAdmin } from './supabase-admin';
import type { OrgPlan } from './types';
import type { BillingCycle } from './plan-config';
import { stripeEnvironment } from './stripe-mode';

export type StripePriceRow = {
  id: string;
  plan_id: string;
  billing_cycle: string;
  environment: string;
  price_id: string | null;
  product_name: string | null;
  created_at: string;
  updated_at: string;
  updated_by_email: string | null;
  last_change_note: string | null;
};

const getStripeEnvironment = () => stripeEnvironment();

export async function getStripePriceId(
  planId: OrgPlan | string,
  billingCycle: BillingCycle | string,
): Promise<string | null> {
  const env = getStripeEnvironment();
  const { data } = await supabaseAdmin
    .from('stripe_prices')
    .select('price_id')
    .eq('plan_id', planId)
    .eq('billing_cycle', billingCycle)
    .eq('environment', env)
    .maybeSingle();
  return data?.price_id ?? null;
}

/**
 * H8 price-guard (runtime): is a Stripe price wired for this plan+cycle in the current environment?
 * Cheap DB lookup, no Stripe call — the heavy "is the price valid" check happens at config time
 * (see lib/stripe-price-validation.ts). The in-app upgrade card uses this to keep checkout CLOSED
 * for a plan toggled "Live" with no price configured, so it can't open a broken checkout.
 */
export async function isPlanCheckoutPriceConfigured(
  planId: OrgPlan | string,
  billingCycle: BillingCycle | string,
): Promise<boolean> {
  return (await getStripePriceId(planId, billingCycle)) != null;
}

export type PlanFromPrice = { planId: string; billingCycle: string; retired: boolean };

/**
 * The plan and cycle a Stripe price is for, in the current key's mode (Plans & pricing Stage 0, Part 5): the current
 * slots first, then the prices a slot has stopped using (`stripe_price_ids_retired`, mig 417), so a customer still paying
 * a replaced price is recognised. `null` means NO SUCH PRICE; a failed lookup THROWS (it is never "no such price").
 */
export async function getPlanFromPriceId(priceId: string): Promise<PlanFromPrice | null> {
  if (!priceId) return null;
  const env = getStripeEnvironment();
  const [current, retired] = await Promise.all([
    supabaseAdmin.from('stripe_prices').select('plan_id, billing_cycle')
      .eq('price_id', priceId).eq('environment', env).limit(1).maybeSingle(),
    supabaseAdmin.from('stripe_price_ids_retired').select('plan_id, billing_cycle')
      .eq('price_id', priceId).eq('environment', env).maybeSingle(),
  ]);
  if (current.error) throw new Error(`Couldn't look up the price: ${current.error.message}`);
  if (current.data) return { planId: current.data.plan_id, billingCycle: current.data.billing_cycle, retired: false };
  if (retired.error) throw new Error(`Couldn't look up the replaced prices: ${retired.error.message}`);
  if (retired.data) return { planId: retired.data.plan_id, billingCycle: retired.data.billing_cycle, retired: true };
  return null;
}

export async function getAllStripePrices(): Promise<StripePriceRow[]> {
  const { data } = await supabaseAdmin
    .from('stripe_prices')
    .select('*')
    .order('environment')
    .order('plan_id')
    .order('billing_cycle');
  return (data ?? []) as StripePriceRow[];
}
