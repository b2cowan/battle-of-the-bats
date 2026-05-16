import { stripe } from '@/lib/stripe';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { restoreRetainedDowngradeTournaments, retentionDeadline } from '@/lib/billing-retention';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan } from '@/lib/types';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

function planKeyFromPriceId(priceId: string): OrgPlan | null {
  if (priceId === process.env.STRIPE_PRICE_TOURNAMENT_PLUS_MONTHLY) return 'tournament_plus';
  if (priceId === process.env.STRIPE_PRICE_LEAGUE_MONTHLY) return 'league';
  if (priceId === process.env.STRIPE_PRICE_CLUB_MONTHLY) return 'club';
  return null;
}

export async function POST(req: Request) {
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

  const eventObject = event.data.object as { customer?: string | { id?: string } | null };
  const customerId = typeof eventObject.customer === 'string'
    ? eventObject.customer
    : eventObject.customer?.id ?? null;

  if (!customerId) {
    return new Response('ok', { status: 200 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId: string = sub.items?.data?.[0]?.price?.id ?? '';
      const planKey = planKeyFromPriceId(priceId);
      if (planKey) {
        const cfg = PLAN_CONFIG[planKey];
        const { data: updatedOrg } = await supabaseAdmin
          .from('organizations')
          .update({
            plan_id: planKey,
            tournament_limit: cfg.tournamentLimit,
            subscription_status: sub.status,
            stripe_subscription_id: sub.id,
          })
          .eq('stripe_customer_id', customerId)
          .select('id')
          .maybeSingle();

        if (updatedOrg) {
          await restoreRetainedDowngradeTournaments(updatedOrg.id, cfg.tournamentLimit);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, name, plan_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (org) {
        const retentionUntil = retentionDeadline();
        const { data: intent } = await supabaseAdmin
          .from('billing_retention_intents')
          .insert({
            org_id: org.id,
            intent_type: 'cancellation',
            status: 'applied',
            from_plan: org.plan_id,
            target_plan: null,
            retention_until: retentionUntil,
            reason: 'Stripe subscription deleted',
            created_by_email: 'stripe-webhook',
            applied_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        const { data: tournaments } = await supabaseAdmin
          .from('tournaments')
          .select('id, name, slug, status, year, start_date, end_date')
          .eq('organization_id', org.id)
          .neq('status', 'archived');

        if (intent && tournaments && tournaments.length > 0) {
          await supabaseAdmin
            .from('tournaments')
            .update({ status: 'archived', is_active: false })
            .eq('organization_id', org.id)
            .in('id', tournaments.map(t => t.id));

          await supabaseAdmin
            .from('billing_retained_records')
            .insert(tournaments.map(t => ({
              intent_id: intent.id,
              org_id: org.id,
              record_type: 'tournament',
              record_id: t.id,
              display_name: t.name,
              retained_state: 'retained_inactive',
              retention_until: retentionUntil,
              metadata: {
                previousStatus: t.status,
                slug: t.slug,
                year: t.year,
                startDate: t.start_date,
                endDate: t.end_date,
                retentionReason: 'stripe_subscription_deleted',
                fromPlan: org.plan_id,
              },
            })));
        }

        if (intent) {
          await supabaseAdmin
            .from('billing_retained_records')
            .insert({
              intent_id: intent.id,
              org_id: org.id,
              record_type: 'account',
              record_id: null,
              display_name: org.name,
              retained_state: 'retained_inactive',
              retention_until: retentionUntil,
              metadata: {
                retentionReason: 'stripe_subscription_deleted',
                fromPlan: org.plan_id,
              },
            });
        }
      }

      await supabaseAdmin
        .from('organizations')
        .update({
          subscription_status: 'canceled',
          stripe_subscription_id: null,
          is_public: false,
          billing_suspended_at: new Date().toISOString(),
          billing_suspension_reason: 'Stripe subscription deleted',
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
