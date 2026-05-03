import { stripe } from '@/lib/stripe';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan } from '@/lib/types';

export const dynamic = 'force-dynamic';

function planKeyFromPriceId(priceId: string): OrgPlan | null {
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_ELITE_MONTHLY) return 'elite';
  return null;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response(JSON.stringify({ error: 'Webhook signature verification failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const customerId =
    typeof (event.data.object as any).customer === 'string'
      ? (event.data.object as any).customer
      : null;

  if (!customerId) {
    return new Response('ok', { status: 200 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as any;
      const priceId: string = sub.items?.data?.[0]?.price?.id ?? '';
      const planKey = planKeyFromPriceId(priceId);
      if (planKey) {
        const cfg = PLAN_CONFIG[planKey];
        await supabaseAdmin
          .from('organizations')
          .update({
            plan_id: planKey,
            tournament_limit: cfg.tournamentLimit,
            subscription_status: sub.status,
            stripe_subscription_id: sub.id,
          })
          .eq('stripe_customer_id', customerId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      await supabaseAdmin
        .from('organizations')
        .update({
          plan_id: 'starter',
          tournament_limit: PLAN_CONFIG.starter.tournamentLimit,
          subscription_status: 'canceled',
          stripe_subscription_id: null,
        })
        .eq('stripe_customer_id', customerId);
      break;
    }

    case 'invoice.payment_failed': {
      await supabaseAdmin
        .from('organizations')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', customerId);
      break;
    }
  }

  return new Response('ok', { status: 200 });
}
