import { getAuthContext, unauthorized } from '@/lib/api-auth';

const DEV_MODE = !process.env.STRIPE_SECRET_KEY;

export async function POST() {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  // ── Dev mock: redirect to local mock portal ───────────────────────────────
  if (DEV_MODE) {
    return new Response(
      JSON.stringify({ url: `${appUrl}/${auth.org.slug}/admin/billing/mock-portal` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Production: real Stripe billing portal ────────────────────────────────
  if (!auth.org.stripeCustomerId) {
    return new Response(JSON.stringify({ error: 'No billing account found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { stripe } = await import('@/lib/stripe');
  const session = await stripe.billingPortal.sessions.create({
    customer: auth.org.stripeCustomerId,
    return_url: `${appUrl}/${auth.org.slug}/admin/billing`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
