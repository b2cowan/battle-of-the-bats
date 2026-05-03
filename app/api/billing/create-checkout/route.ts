import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan } from '@/lib/types';

const DEV_MODE = !process.env.STRIPE_SECRET_KEY;

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  const { planKey }: { planKey: 'pro' | 'elite' } = await req.json();
  const plan = PLAN_CONFIG[planKey as OrgPlan];
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Invalid plan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  // ── Dev mock: no Stripe, write directly to DB ──────────────────────────────
  if (DEV_MODE) {
    await supabaseAdmin
      .from('organizations')
      .update({
        plan_id: planKey,
        tournament_limit: plan.tournamentLimit,
        subscription_status: 'trialing',
        stripe_subscription_id: `mock_sub_${planKey}_${Date.now()}`,
      })
      .eq('id', auth.org.id);

    return new Response(
      JSON.stringify({ url: `${appUrl}/${auth.org.slug}/admin/billing?success=1` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Production: real Stripe checkout ──────────────────────────────────────
  if (!plan.priceId) {
    return new Response(JSON.stringify({ error: 'No price configured for this plan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { stripe } = await import('@/lib/stripe');

  let customerId = auth.org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: auth.user.email,
      metadata: { orgId: auth.org.id },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', auth.org.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${appUrl}/${auth.org.slug}/admin/billing?success=1`,
    cancel_url: `${appUrl}/${auth.org.slug}/admin/billing`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
