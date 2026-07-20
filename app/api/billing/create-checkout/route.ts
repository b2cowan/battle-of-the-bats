import { getAuthContext, requireCapability, unauthorized } from '@/lib/api-auth';
import { restoreRetainedDowngradeTournaments } from '@/lib/billing-retention';
import { getBillingHref } from '@/lib/billing-urls';
import { isBillingMockEnabled, isStripeConfigured } from '@/lib/billing-mock';
import { normalizeBillingCycle, PLAN_CONFIG, isFoundingSeasonActive, FOUNDING_SEASON_END } from '@/lib/plan-config';
import { ensureFoundingSeasonCompPeriod } from '@/lib/founding-season';
import { getPlanConfigOverride } from '@/lib/plan-config-db';
import { getStripePriceId } from '@/lib/stripe-prices';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { isRecoveryTransition, writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { welcomeBackHtml, tournamentPlusWelcomeHtml, SITE_URL } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { sendMarketingEmail, cancelScheduledEmail } from '@/lib/email-sender';
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token';
import type { OrgPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';

/** Welcome email fires this many days after a user selects Tournament Plus at onboarding. */
const PLUS_WELCOME_DELAY_DAYS = 1;

function appendSuccess(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}success=1`;
}

function isMissingStartupTasksColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('startup_tasks');
}

function isOrgPlan(value: string | undefined): value is OrgPlan {
  return Boolean(value && value in PLAN_CONFIG);
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
    .eq('org_id', orgId)
    .neq('status', 'archived');

  if (error) throw error;
  if ((count ?? 0) > 0) return;

  await resetStartupTasksIfAvailable(orgId);
}

export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({})) as {
    planKey?: unknown;
    returnTo?: unknown;
    orgSlug?: unknown;
    billingCycle?: unknown;
  };
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug : undefined;
  const auth = await getAuthContext(orgSlug ? { orgSlug } : {});
  if (!auth) return unauthorized();
  // Billing is owner-only — enforce server-side (the UI also hides these controls).
  const denied = await requireCapability(auth, 'billing');
  if (denied) return denied;

  const planKey = typeof body.planKey === 'string' ? body.planKey : undefined;
  const returnTo = typeof body.returnTo === 'string' ? body.returnTo : undefined;
  const requestedBillingCycle = body.billingCycle;
  const billingCycle = normalizeBillingCycle(requestedBillingCycle);
  if (!isOrgPlan(planKey)) {
    return new Response(JSON.stringify({ error: 'Invalid plan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const plan = PLAN_CONFIG[planKey];
  if (planKey === 'team') {
    return new Response(JSON.stringify({ error: 'Use Coaches Portal checkout for coach-owned team subscriptions.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Merge DB overrides over PLAN_CONFIG defaults for this plan
  const mergedConfig = await getPlanConfigOverride(planKey);

  const gatingMap = await getPlanGatingMap();
  if (gatingMap[planKey]) {
    return new Response(JSON.stringify({ error: 'This plan is not open for self-serve checkout yet.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const fallbackReturnTo = getBillingHref(auth.org.slug, auth.org.planId);
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

    // Upgraded off the free Tournament plan — cancel any pending upsell email.
    if (planKey !== 'tournament') {
      await cancelScheduledEmail(auth.org.id, 'tournament_plus_upsell');
    }

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

      if (auth.org.subscriptionStatus === 'canceled' && auth.user.email) {
        const planLabel = PLAN_CONFIG[planKey]?.label ?? planKey;
        const dashboardUrl = `${SITE_URL}/${auth.org.slug}/admin`;
        await sendTransactionalEmail({
          key: 'welcome_back',
          to: auth.user.email,
          vars: { orgName: auth.org.name, planLabel, dashboardUrl },
          defaultSubject: `Welcome back to FieldLogicHQ — ${auth.org.name}`,
          defaultHtml: welcomeBackHtml({
            orgName: auth.org.name,
            planLabel,
            restoredTournaments: restoreResult.restoredCount,
            dashboardUrl,
          }),
        });
      }
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

  // Founding season: Tournament plan owners get Tournament Plus without Stripe.
  const isFoundingSeasonTournamentUpgrade =
    !shouldApplyDirectly &&
    planKey === 'tournament_plus' &&
    auth.org.planId === 'tournament' &&
    isFoundingSeasonActive();

  if (isFoundingSeasonTournamentUpgrade) {
    const { error: orgError } = await supabaseAdmin
      .from('organizations')
      .update({
        plan_id: 'tournament_plus',
        tournament_limit: mergedConfig.tournamentLimit,
        subscription_status: 'active',
        stripe_subscription_id: null,
        subscription_period: null,
        current_period_end: FOUNDING_SEASON_END,
      })
      .eq('id', auth.org.id);

    if (orgError) {
      return new Response(JSON.stringify({ error: orgError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await ensureFoundingSeasonCompPeriod(auth.org.id, auth.user.email);

    const restoreResult = await restoreRetainedDowngradeTournaments(auth.org.id, mergedConfig.tournamentLimit);
    await resetStartupTasksForEditableOnboarding(auth.org.id, isOnboardingPlanSelection);

    // Upgraded off the free Tournament plan onto Plus — cancel any pending upsell email.
    await cancelScheduledEmail(auth.org.id, 'tournament_plus_upsell');

    // Schedule the Tournament Plus welcome email for ~1 day later — only when this
    // founding-season upgrade happens during first-run onboarding plan selection.
    // Non-fatal: never block the plan selection on an email failure.
    if (isOnboardingPlanSelection && auth.user.email) {
      try {
        const scheduledAt = new Date(Date.now() + PLUS_WELCOME_DELAY_DAYS * 86_400_000).toISOString();
        await sendMarketingEmail({
          emailKey: 'tournament_plus_welcome',
          orgId: auth.org.id,
          toEmail: auth.user.email,
          subject: "You're on Tournament Plus — free through Dec 31",
          html: tournamentPlusWelcomeHtml({
            orgName: auth.org.name,
            firstName: auth.user.user_metadata?.first_name as string | undefined,
            dashboardUrl: `${SITE_URL}/${auth.org.slug}/admin`,
            unsubscribeUrl: buildUnsubscribeUrl(auth.org.id),
          }),
          skipOptOutCheck: true, // transactional welcome
          scheduledAt,
        });
      } catch (err) {
        console.error('[create-checkout] tournament_plus_welcome schedule failed (non-fatal):', err);
      }
    }

    if (isRecoveryTransition(auth.org.subscriptionStatus, 'active')) {
      await writePlatformEvent({
        eventType: 'subscription_recovered',
        source: 'founding_season',
        orgId: auth.org.id,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        previousPlanId: auth.org.planId,
        planId: 'tournament_plus',
        previousSubscriptionStatus: auth.org.subscriptionStatus,
        subscriptionStatus: 'active',
        metadata: { billingCycle, restoredCount: restoreResult.restoredCount, foundingSeason: true },
      });
    }

    return new Response(
      JSON.stringify({
        url: appendSuccess(`${appUrl}${safeReturnTo}`),
        applied: true,
        planKey: 'tournament_plus',
        billingCycle,
        foundingSeason: true,
        compUntil: FOUNDING_SEASON_END,
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

  const priceId = await getStripePriceId(planKey, billingCycle);
  if (!priceId) {
    const cycleLabel = billingCycle === 'annual' ? 'Annual' : 'Monthly';
    return new Response(JSON.stringify({ error: `${cycleLabel} checkout is not configured for ${plan.label} yet.` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { stripe } = await import('@/lib/stripe');
  const { ensureStripeCustomer } = await import('@/lib/billing-setup');

  const customerId = await ensureStripeCustomer(auth.org, auth.user.email);

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
}, { route: '/api/billing/create-checkout' });
