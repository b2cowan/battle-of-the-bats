import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { restoreRetainedDowngradeTournaments } from '@/lib/billing-retention';
import { isBillingMockEnabled, isStripeConfigured } from '@/lib/billing-mock';
import { normalizeBillingCycle, PLAN_CONFIG } from '@/lib/plan-config';
import { getPlanConfigOverride } from '@/lib/plan-config-db';
import { getStripePriceId } from '@/lib/stripe-prices';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { isRecoveryTransition, writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan } from '@/lib/types';

function appendSuccess(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}success=1`;
}

function isMissingStartupTasksColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('startup_tasks');
}

async function resetStartupTasksIfAvailable(orgId: string) {
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ startup_tasks: {} })
    .eq('id', orgId);

  if (error && !isMissingStartupTasksColumn(error)) throw error;
}

async function resetStartupTasksForEditableOnboarding(orgId: string, enabled: boolean) {
  if (!enabled) return;

  const { count, error } = await supabaseAdmin
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .neq('status', 'archived');

  if (error) throw error;
  if ((count ?? 0) > 0) return;

  await resetStartupTasksIfAvailable(orgId);
}

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  const { planKey, returnTo, billingCycle: requestedBillingCycle }: {
    planKey: 'team' | 'tournament_plus' | 'league' | 'club';
    returnTo?: string;
    billingCycle?: unknown;
  } = await req.json();
  const billingCycle = normalizeBillingCycle(requestedBillingCycle);
  const plan = PLAN_CONFIG[planKey as OrgPlan];
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Invalid plan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (planKey === 'team') {
    return new Response(JSON.stringify({ error: 'Use Team checkout to create a standalone Team workspace.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Merge DB overrides over PLAN_CONFIG defaults for this plan
  const mergedConfig = await getPlanConfigOverride(planKey as OrgPlan);

  const gatingMap = await getPlanGatingMap();
  if (gatingMap[planKey]) {
    return new Response(JSON.stringify({ error: 'This plan is not open for self-serve checkout yet.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const fallbackReturnTo = `/${auth.org.slug}/admin/org/billing`;
  const safeReturnTo = returnTo?.startsWith(`/${auth.org.slug}/admin/`)
    ? returnTo
    : fallbackReturnTo;
  const isOnboardingPlanSelection = safeReturnTo.includes('/admin/onboarding');
  const shouldApplyDirectly = isBillingMockEnabled() || (!isStripeConfigured() && process.env.NODE_ENV !== 'production');

  // ── Dev mock: no Stripe, write directly to DB ──────────────────────────────
  if (shouldApplyDirectly) {
    const { error: orgError } = await supabaseAdmin
      .from('organizations')
      .update({
        plan_id: planKey,
        tournament_limit: mergedConfig.tournamentLimit,
        subscription_status: 'trialing',
        stripe_subscription_id: `mock_sub_${planKey}_${billingCycle}_${Date.now()}`,
      })
      .eq('id', auth.org.id);
    if (orgError) {
      return new Response(JSON.stringify({ error: orgError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const restoreResult = await restoreRetainedDowngradeTournaments(auth.org.id, plan.tournamentLimit);
    await resetStartupTasksForEditableOnboarding(auth.org.id, isOnboardingPlanSelection);

    if (isRecoveryTransition(auth.org.subscriptionStatus, 'trialing')) {
      await writePlatformEvent({
        eventType: 'subscription_recovered',
        source: 'mock',
        orgId: auth.org.id,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        previousPlanId: auth.org.planId,
        planId: planKey,
        previousSubscriptionStatus: auth.org.subscriptionStatus,
        subscriptionStatus: 'trialing',
        metadata: { billingCycle, restoredCount: restoreResult.restoredCount },
      });
    }

    return new Response(
      JSON.stringify({
        url: appendSuccess(`${appUrl}${safeReturnTo}`),
        applied: true,
        planKey,
        billingCycle,
        restoredCount: restoreResult.restoredCount,
        remainingRetainedCount: restoreResult.remainingRetainedCount,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Production: real Stripe checkout ──────────────────────────────────────
  if (!isStripeConfigured()) {
    return new Response(JSON.stringify({ error: 'Stripe checkout is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const priceId = await getStripePriceId(planKey as OrgPlan, billingCycle);
  if (!priceId) {
    const cycleLabel = billingCycle === 'annual' ? 'Annual' : 'Monthly';
    return new Response(JSON.stringify({ error: `${cycleLabel} checkout is not configured for ${plan.label} yet.` }), {
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

  await resetStartupTasksForEditableOnboarding(auth.org.id, isOnboardingPlanSelection);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: mergedConfig.trialDays,
      metadata: { orgId: auth.org.id, planKey, billingCycle },
    },
    metadata: { orgId: auth.org.id, planKey, billingCycle },
    success_url: appendSuccess(`${appUrl}${safeReturnTo}`),
    cancel_url: `${appUrl}${safeReturnTo}`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
