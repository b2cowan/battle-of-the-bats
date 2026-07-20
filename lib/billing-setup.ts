import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Org-level Stripe provisioning shared by the billing endpoints
 * (create-checkout, setup-payment-method, portal). Server-only.
 */

/** Get the org's Stripe customer id, creating and persisting one if missing. */
export async function ensureStripeCustomer(
  org: { id: string; stripeCustomerId?: string | null },
  email: string | undefined,
): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;
  const customer = await stripe.customers.create({
    email,
    metadata: { orgId: org.id },
  });
  // First-writer-wins link: concurrent requests (e.g. two billing buttons clicked
  // back-to-back before the org has a customer) each create a candidate customer.
  // Only one may become the customer of record — an unguarded overwrite would let
  // a later card-save land on an orphaned customer the org row no longer points at.
  const { data: linked } = await supabaseAdmin
    .from('organizations')
    .update({ stripe_customer_id: customer.id })
    .eq('id', org.id)
    .is('stripe_customer_id', null)
    .select('stripe_customer_id')
    .maybeSingle();
  if (linked?.stripe_customer_id === customer.id) return customer.id;

  // Lost the race (or the caller's auth context was stale): use the customer
  // already linked and discard ours — nothing has been attached to it yet.
  const { data: row } = await supabaseAdmin
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', org.id)
    .single();
  if (row?.stripe_customer_id && row.stripe_customer_id !== customer.id) {
    await stripe.customers.del(customer.id).catch(() => {});
    return row.stripe_customer_id;
  }
  return customer.id;
}

/**
 * Create a Checkout session in mode='setup' — saves a card on file, charges
 * nothing, and starts no subscription or trial. The webhook's setup-mode branch
 * promotes the saved card to the customer's default payment method so the
 * January 2027 conversion (manual runbook) can charge it — never before.
 * Success bounces back to the billing page with ?card_saved=1.
 */
export async function createCardSetupSession(
  org: { id: string; slug: string; stripeCustomerId?: string | null },
  email: string | undefined,
): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const billingPath = `/${org.slug}/admin/org/billing`;
  const customerId = await ensureStripeCustomer(org, email);
  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: customerId,
    payment_method_types: ['card'],
    metadata: { orgId: org.id, purpose: 'founding_season_card_on_file' },
    success_url: `${appUrl}${billingPath}?card_saved=1`,
    cancel_url: `${appUrl}${billingPath}`,
  });
  if (!session.url) throw new Error('Stripe did not return a setup session URL');
  return session.url;
}
