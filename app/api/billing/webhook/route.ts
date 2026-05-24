import { stripe } from '@/lib/stripe';
import { PLAN_CONFIG, type BillingCycle } from '@/lib/plan-config';
import { getPlanFromPriceId } from '@/lib/stripe-prices';
import { restoreRetainedDowngradeTournaments, retentionDeadline } from '@/lib/billing-retention';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { isPastDueTransition, isRecoveryTransition, writePlatformEvent } from '@/lib/platform-events';
import {
  provisionTeamWorkspaceFromCheckoutMetadata,
  syncTeamWorkspaceSubscription,
} from '@/lib/team-checkout';
import { completeOrgTeamAddonBillingFromMetadata } from '@/lib/team-org-billing';
import { sendEmail, trialEndingHtml, SITE_URL } from '@/lib/email';
import type { OrgPlan } from '@/lib/types';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toIso(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

const PLAN_RANK: Record<OrgPlan, number> = {
  tournament: 0,
  team: 0,
  tournament_plus: 1,
  league: 2,
  club: 3,
};

function subscriptionIdFromSession(session: Stripe.Checkout.Session): string | null {
  return typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id ?? null;
}

function subscriptionItemId(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.id ?? null;
}

async function cancelPriorTeamSubscription(subscriptionId: string | null | undefined, newSubscriptionId: string | null | undefined) {
  if (!subscriptionId || subscriptionId === newSubscriptionId || !subscriptionId.startsWith('sub_')) return;
  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('[billing webhook] could not cancel prior Team subscription:', error);
  }
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
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.checkoutKind === 'org_team_addon') {
        const subscriptionId = subscriptionIdFromSession(session);
        const sub = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;

        const result = await completeOrgTeamAddonBillingFromMetadata({
          metadata: session.metadata,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionItemId: sub ? subscriptionItemId(sub) : null,
          subscriptionStatus: sub?.status ?? 'active',
          currentPeriodEnd: sub ? toIso(sub.items?.data?.[0]?.current_period_end) : null,
          sourceEventId: `${event.id}:org_team_addon_completed`,
        });
        if (result.ok) {
          await cancelPriorTeamSubscription(result.previousTeamSubscriptionId, subscriptionId);
        }
        break;
      }

      if (session.metadata?.checkoutKind === 'standalone_team') {
        const subscriptionId = subscriptionIdFromSession(session);
        const sub = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;

        await provisionTeamWorkspaceFromCheckoutMetadata({
          metadata: session.metadata,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionItemId: sub ? subscriptionItemId(sub) : null,
          subscriptionStatus: sub?.status ?? 'active',
          billingCycle: session.metadata.billingCycle ?? null,
          currentPeriodEnd: sub ? toIso(sub.items?.data?.[0]?.current_period_end) : null,
          eventSource: 'stripe',
          sourceEventId: `${event.id}:team_workspace_created`,
        });
        break;
      }

      const orgId = session.metadata?.orgId;
      if (orgId && customerId) {
        // Defensively ensure stripe_customer_id is set — create-checkout sets it before
        // redirect but this covers any race or retry scenarios.
        await supabaseAdmin
          .from('organizations')
          .update({ stripe_customer_id: customerId })
          .eq('id', orgId)
          .is('stripe_customer_id', null);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId: string = sub.items?.data?.[0]?.price?.id ?? '';
      const matchedPlan = await getPlanFromPriceId(priceId);
      if (matchedPlan) {
        if (matchedPlan.planId === 'org_team_addon') {
          const result = await completeOrgTeamAddonBillingFromMetadata({
            metadata: sub.metadata,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripeSubscriptionItemId: subscriptionItemId(sub),
            subscriptionStatus: sub.status,
            currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
            sourceEventId: `${event.id}:org_team_addon_completed`,
          });
          if (result.ok) {
            await cancelPriorTeamSubscription(result.previousTeamSubscriptionId, sub.id);
          }
          break;
        }

        const planKey = matchedPlan.planId as OrgPlan;
        const billingCycle = matchedPlan.billingCycle as BillingCycle;
        if (planKey === 'team') {
          const provisionResult = await provisionTeamWorkspaceFromCheckoutMetadata({
            metadata: sub.metadata,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripeSubscriptionItemId: subscriptionItemId(sub),
            subscriptionStatus: sub.status,
            billingCycle,
            currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
            eventSource: 'stripe',
            sourceEventId: `${event.id}:team_workspace_created`,
          });

          if (!provisionResult.provisioned && provisionResult.reason === 'not_team_checkout') {
            await syncTeamWorkspaceSubscription({
              stripeCustomerId: customerId,
              stripeSubscriptionId: sub.id,
              stripeSubscriptionItemId: subscriptionItemId(sub),
              subscriptionStatus: sub.status,
              billingCycle,
              currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
            });
          }
          break;
        }

        const cfg = PLAN_CONFIG[planKey];
        if (!cfg) break;
        // current_period_end moved to SubscriptionItem in API 2026-04-22.dahlia
        const currentPeriodEnd = toIso(sub.items?.data?.[0]?.current_period_end);
        const { data: currentOrg } = await supabaseAdmin
          .from('organizations')
          .select('id, plan_id, subscription_status')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        const { data: updatedOrg } = await supabaseAdmin
          .from('organizations')
          .update({
            plan_id: planKey,
            tournament_limit: cfg.tournamentLimit,
            subscription_status: sub.status,
            stripe_subscription_id: sub.id,
            subscription_period: billingCycle,
            current_period_end: currentPeriodEnd,
          })
          .eq('stripe_customer_id', customerId)
          .select('id')
          .maybeSingle();

        if (updatedOrg) {
          await restoreRetainedDowngradeTournaments(updatedOrg.id, cfg.tournamentLimit);

          const previousPlan = currentOrg?.plan_id as OrgPlan | undefined;
          const previousStatus = currentOrg?.subscription_status as string | null | undefined;
          if (previousPlan && PLAN_RANK[planKey] < PLAN_RANK[previousPlan]) {
            await writePlatformEvent({
              eventType: 'plan_downgraded',
              source: 'stripe',
              sourceEventId: `${event.id}:plan_downgraded`,
              orgId: updatedOrg.id,
              previousPlanId: previousPlan,
              planId: planKey,
              previousSubscriptionStatus: previousStatus,
              subscriptionStatus: sub.status,
              metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
            });
          }

          if (isPastDueTransition(previousStatus, sub.status)) {
            await writePlatformEvent({
              eventType: 'subscription_past_due',
              source: 'stripe',
              sourceEventId: `${event.id}:subscription_past_due`,
              orgId: updatedOrg.id,
              previousPlanId: previousPlan ?? null,
              planId: planKey,
              previousSubscriptionStatus: previousStatus,
              subscriptionStatus: sub.status,
              metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
            });
          }

          if (isRecoveryTransition(previousStatus, sub.status)) {
            await writePlatformEvent({
              eventType: 'subscription_recovered',
              source: 'stripe',
              sourceEventId: `${event.id}:subscription_recovered`,
              orgId: updatedOrg.id,
              previousPlanId: previousPlan ?? null,
              planId: planKey,
              previousSubscriptionStatus: previousStatus,
              subscriptionStatus: sub.status,
              metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
            });
          }
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const syncedTeamWorkspace = await syncTeamWorkspaceSubscription({
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripeSubscriptionItemId: subscriptionItemId(sub),
        subscriptionStatus: 'canceled',
        currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
      });

      if (syncedTeamWorkspace) {
        await writePlatformEvent({
          eventType: 'subscription_canceled',
          source: 'stripe',
          sourceEventId: `${event.id}:team_subscription_canceled`,
          planId: 'team',
          subscriptionStatus: 'canceled',
          metadata: { stripeCustomerId: customerId, stripeSubscriptionId: sub.id, scope: 'team_workspace' },
        });
        break;
      }

      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, name, plan_id, subscription_status')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (org) {
        // Check whether an in-app confirm route (cancel or downgrade-to-free) already
        // applied a retention intent. Select intent_type so we can differentiate the
        // update applied below.
        const { data: existingIntent } = await supabaseAdmin
          .from('billing_retention_intents')
          .select('id, intent_type')
          .eq('org_id', org.id)
          .eq('status', 'applied')
          .in('intent_type', ['cancellation', 'downgrade'])
          .order('applied_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!existingIntent) {
          // Stripe-initiated deletion (payment failure, portal cancel, etc.) — run full
          // retention logic and suspend the org.
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
            .eq('org_id', org.id)
            .neq('status', 'archived');

          if (intent && tournaments && tournaments.length > 0) {
            await supabaseAdmin
              .from('tournaments')
              .update({ status: 'archived', is_active: false })
              .eq('org_id', org.id)
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

          // Stripe-initiated: full suspension update.
          await supabaseAdmin
            .from('organizations')
            .update({
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              subscription_period: null,
              current_period_end: null,
              is_public: false,
              billing_suspended_at: new Date().toISOString(),
              billing_suspension_reason: 'Stripe subscription deleted',
            })
            .eq('stripe_customer_id', customerId);

          await writePlatformEvent({
            eventType: 'subscription_canceled',
            source: 'stripe',
            sourceEventId: `${event.id}:subscription_canceled`,
            orgId: org.id,
            previousPlanId: org.plan_id,
            planId: org.plan_id,
            previousSubscriptionStatus: org.subscription_status,
            subscriptionStatus: 'canceled',
            metadata: { stripeCustomerId: customerId, reason: 'Stripe subscription deleted' },
          });
        } else if (existingIntent.intent_type === 'cancellation') {
          // In-app cancellation already applied — org is already suspended. Clear the
          // Stripe subscription fields that only become accurate once Stripe confirms
          // the deletion. subscription_status, is_public, and billing_suspended_at
          // were already set correctly by the cancel/confirm route.
          await supabaseAdmin
            .from('organizations')
            .update({
              stripe_subscription_id: null,
              subscription_period: null,
              current_period_end: null,
            })
            .eq('stripe_customer_id', customerId);
        } else {
          // intent_type === 'downgrade' (downgrade-to-free): confirm route already set
          // plan_id='tournament' and subscription_status='active'. Clear Stripe fields
          // only — do NOT set subscription_status='canceled' or is_public=false.
          await supabaseAdmin
            .from('organizations')
            .update({
              stripe_subscription_id: null,
              subscription_period: null,
              current_period_end: null,
            })
            .eq('stripe_customer_id', customerId);
        }
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const currentPeriodEnd = toIso(invoice.period_end);
      const { data: currentOrg } = await supabaseAdmin
        .from('organizations')
        .select('id, plan_id, subscription_status')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      await supabaseAdmin
        .from('organizations')
        .update({
          subscription_status: 'active',
          ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
        })
        .eq('stripe_customer_id', customerId);

      if (currentOrg && isRecoveryTransition(currentOrg.subscription_status, 'active')) {
        await writePlatformEvent({
          eventType: 'subscription_recovered',
          source: 'stripe',
          sourceEventId: `${event.id}:subscription_recovered`,
          orgId: currentOrg.id,
          previousPlanId: currentOrg.plan_id,
          planId: currentOrg.plan_id,
          previousSubscriptionStatus: currentOrg.subscription_status,
          subscriptionStatus: 'active',
          metadata: { stripeCustomerId: customerId, invoiceId: invoice.id },
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const { data: currentOrg } = await supabaseAdmin
        .from('organizations')
        .select('id, plan_id, subscription_status')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      await supabaseAdmin
        .from('organizations')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', customerId);

      if (currentOrg && isPastDueTransition(currentOrg.subscription_status, 'past_due')) {
        await writePlatformEvent({
          eventType: 'subscription_past_due',
          source: 'stripe',
          sourceEventId: `${event.id}:subscription_past_due`,
          orgId: currentOrg.id,
          previousPlanId: currentOrg.plan_id,
          planId: currentOrg.plan_id,
          previousSubscriptionStatus: currentOrg.subscription_status,
          subscriptionStatus: 'past_due',
          metadata: { stripeCustomerId: customerId },
        });
      }
      break;
    }

    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription;
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, name, slug, plan_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      if (!org) break;

      const ownerEmail = await getOrgOwnerEmail(org.id);
      if (!ownerEmail) break;

      const planLabel = PLAN_CONFIG[org.plan_id as OrgPlan]?.label ?? org.plan_id;
      const trialEndDate = sub.trial_end
        ? new Date(sub.trial_end * 1000).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'soon';
      const billingUrl = `${SITE_URL}/${org.slug}/admin/org/billing`;

      await sendEmail(
        ownerEmail,
        `Your ${planLabel} trial ends ${trialEndDate}`,
        trialEndingHtml({ orgName: org.name, planLabel, trialEndDate, billingUrl }),
      );
      break;
    }
  }

  return new Response('ok', { status: 200 });
}
