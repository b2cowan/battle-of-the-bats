import { getAuthContext, requireCapability, unauthorized } from '@/lib/api-auth';
import { isBillingMockEnabled } from '@/lib/billing-mock';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { isPastDueTransition, isRecoveryTransition, writeGrowthEvent, writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan, SubscriptionStatus } from '@/lib/types';
import { PLAN_RANK } from '@/lib/plan-features';
import { withObservability } from '@/lib/observability';
import { ownPlanOf } from '@/lib/entitlement-grants';

export const POST = withObservability(async (req: Request) => {
  if (!isBillingMockEnabled()) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug : undefined;
  const auth = await getAuthContext({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!auth) return unauthorized();
  const denied = await requireCapability(auth, 'billing');
  if (denied) return denied;

  const { plan, status }: { plan: OrgPlan; status: SubscriptionStatus } = body;
  const cfg = PLAN_CONFIG[plan];
  if (!cfg) {
    return new Response(JSON.stringify({ error: 'Invalid plan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const normalizedStatus = plan === 'tournament' && status === 'trialing' ? 'active' : status;
  const subId = plan === 'tournament' ? null : `mock_sub_${plan}_${Date.now()}`;
  const previousPlan = ownPlanOf(auth.org);
  const previousStatus = auth.org.subscriptionStatus;

  await supabaseAdmin
    .from('organizations')
    .update({
      plan_id: plan,
      tournament_limit: cfg.tournamentLimit,
      subscription_status: normalizedStatus,
      stripe_subscription_id: subId,
      ...(plan === 'tournament' ? { subscription_period: null, current_period_end: null } : {}),
    })
    .eq('id', auth.org.id);

  if (PLAN_RANK[plan] < PLAN_RANK[previousPlan]) {
    await writePlatformEvent({
      eventType: 'plan_downgraded',
      source: 'mock',
      orgId: auth.org.id,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email,
      previousPlanId: previousPlan,
      planId: plan,
      previousSubscriptionStatus: previousStatus,
      subscriptionStatus: normalizedStatus,
    });
  }

  await writeGrowthEvent({
    source: 'mock',
    orgId: auth.org.id,
    actorUserId: auth.user.id,
    actorEmail: auth.user.email,
    previousPlanId: previousPlan,
    previousStatus,
    previousSubscriptionId: auth.org.stripeSubscriptionId ?? null,
    planId: plan,
    status: normalizedStatus,
  });

  if (isPastDueTransition(previousStatus, normalizedStatus)) {
    await writePlatformEvent({
      eventType: 'subscription_past_due',
      source: 'mock',
      orgId: auth.org.id,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email,
      previousPlanId: previousPlan,
      planId: plan,
      previousSubscriptionStatus: previousStatus,
      subscriptionStatus: normalizedStatus,
    });
  }

  if (isRecoveryTransition(previousStatus, normalizedStatus)) {
    await writePlatformEvent({
      eventType: 'subscription_recovered',
      source: 'mock',
      orgId: auth.org.id,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email,
      previousPlanId: previousPlan,
      planId: plan,
      previousSubscriptionStatus: previousStatus,
      subscriptionStatus: normalizedStatus,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}, { route: '/api/billing/mock-apply' });
