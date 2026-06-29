import { supabaseAdmin } from './supabase-admin';
import type { OrgPlan } from './types';
import type { BillingCycle } from './plan-config';

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

function getStripeEnvironment(): 'sandbox' | 'live' {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? 'live' : 'sandbox';
}

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

export async function getPlanFromPriceId(
  priceId: string,
): Promise<{ planId: string; billingCycle: string } | null> {
  const { data } = await supabaseAdmin
    .from('stripe_prices')
    .select('plan_id, billing_cycle')
    .eq('price_id', priceId)
    .maybeSingle();
  if (!data) return null;
  return { planId: data.plan_id, billingCycle: data.billing_cycle };
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
