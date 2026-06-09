import { getAuthContext, requireCapability, unauthorized } from '@/lib/api-auth';
import { isBillingMockEnabled, isStripeConfigured } from '@/lib/billing-mock';

export async function POST() {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();
  // Billing is owner-only — enforce server-side (the UI also hides these controls).
  const denied = await requireCapability(auth, 'billing');
  if (denied) return denied;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  // ── Dev mock: redirect to local mock portal ───────────────────────────────
  if (isBillingMockEnabled()) {
    return new Response(
      JSON.stringify({ url: `${appUrl}/${auth.org.slug}/admin/org/billing/mock-portal` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Production: real Stripe billing portal ────────────────────────────────
  if (!isStripeConfigured()) {
    return new Response(JSON.stringify({ error: 'Billing portal is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!auth.org.stripeCustomerId) {
    return new Response(JSON.stringify({ error: 'No billing account found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { stripe } = await import('@/lib/stripe');
  const session = await stripe.billingPortal.sessions.create({
    customer: auth.org.stripeCustomerId,
    return_url: `${appUrl}/${auth.org.slug}/admin/org/billing`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
