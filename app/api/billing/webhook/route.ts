import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import { withObservability } from '@/lib/observability';
import { receiveBillingEvent } from '@/lib/stripe-billing-events';
import { runVerifiedBillingEvent } from '@/lib/billing-webhook-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withObservability(async (req: Request) => {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response(JSON.stringify({ error: 'Webhook signature verification failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Plans & pricing Stage 0 (S5): the mode check, the claim and the outcome live in lib/stripe-billing-events.ts.
  return receiveBillingEvent(event, runVerifiedBillingEvent);
}, { route: '/api/billing/webhook' });
