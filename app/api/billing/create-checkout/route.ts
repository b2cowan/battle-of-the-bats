import { getAuthContext, requireCapability, unauthorized } from '@/lib/api-auth';
import { restoreRetainedDowngradeTournaments } from '@/lib/billing-retention';
import { getBillingHref } from '@/lib/billing-urls';
import { isBillingMockEnabled, isStripeConfigured } from '@/lib/billing-mock';
import { normalizeBillingCycle, PLAN_CONFIG, FOUNDING_SEASON_END, FOUNDING_SEASON_END_LABEL } from '@/lib/plan-config';
import { ensureFoundingSeasonCompPeriod, foundingSeasonOfferOnPlanChoice } from '@/lib/founding-season';
import { applyPlanChangeSideEffects, hadSubscriptionBefore, hasLiveSubscription } from '@/lib/plan-move';
import { moveDirection } from '@/lib/plan-move-options';
import { restoreAfterReactivation } from '@/lib/billing-reactivation';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { getPlanConfigOverride } from '@/lib/plan-config-db';
import { getStripePriceId } from '@/lib/stripe-prices';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { isRecoveryTransition, writeGrowthEvent, writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { welcomeBackHtml, tournamentPlusWelcomeHtml, SITE_URL } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { sendMarketingEmail, cancelScheduledEmail } from '@/lib/email-sender';
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token';
import type { OrgPlan } from '@/lib/types';
import { withObservability, captureAndJson } from '@/lib/observability';
import { ownPlanOf } from '@/lib/entitlement-grants';
import { inPlaceMetadata, inPlaceReturnPath, inPlaceUpgradeOf } from '@/lib/workspace-upgrade';
import { workspaceCannotBecomeClub } from '@/lib/workspace-upgrade-status';
import {
  billingAddressFromBody, billingBuyerOf, requireBillingLocation, type BillingBuyer,
} from '@/lib/billing-location-server';
import type { BillingLocation } from '@/lib/billing-location';
import { requireAcceptance } from '@/lib/legal-acceptance';

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
    /** Required when a Coaches Portal buys Club (Stage 4b): the name of the club it becomes. Ignored otherwise. */
    clubName?: unknown;
    /** With `clubName` (GST/HST Stage 1): the club's billing address from the "Start your club" window. Ignored otherwise. */
    billingAddress?: unknown;
  };
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug : undefined;
  const auth = await getAuthContext(orgSlug ? { orgSlug, allowSuspendedOrg: true } : { allowSuspendedOrg: true });
  if (!auth) return unauthorized();
  // Billing is owner-only — enforce server-side (the UI also hides these controls).
  const denied = await requireCapability(auth, 'billing');
  if (denied) return denied;
  // Nobody starts or changes a paid plan without the current Terms (GST/HST Stage 6 step 6.3, C1) — before every branch:
  // the address save, the dev mock and the Founding Season upgrade all write a plan or a record without Stripe.
  const terms = await requireAcceptance(auth.user);
  if (!terms.ok) return terms.response;

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

  // A06 (Club Tier Stage 1b): an org already paying on a live subscription never opens a SECOND
  // one — the webhook keys the org on its Stripe customer, so two subscriptions fight over one
  // plan. It changes the plan of the subscription it has (POST /api/billing/move). A dev mock
  // subscription is not a Stripe one (hasLiveSubscription says so) and keeps the mock checkout working.
  const liveSubscription = hasLiveSubscription({
    id: auth.org.id,
    planId: ownPlanOf(auth.org),
    stripeSubscriptionId: auth.org.stripeSubscriptionId ?? null,
    subscriptionStatus: auth.org.subscriptionStatus ?? null,
  });
  if (liveSubscription) {
    const direction = moveDirection(ownPlanOf(auth.org), planKey);
    return new Response(JSON.stringify({
      error: 'This organization already has a subscription. Change its plan instead of starting a second one.',
      code: 'subscription_exists',
      move: direction ? { planKey, direction } : null,
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Stage 4b: a standalone Coaches Portal (free days, or no subscription) buying a Club band becomes the club IN PLACE, on this same
  // organization — no second one. It must say what the club is called (the flip writes it), so the server refuses without a name
  // rather than quietly keeping "{team} Coaches Portal". A paying Premium coach never gets here: the 409 above sends them to the move.
  const inPlace = inPlaceUpgradeOf(auth.org, planKey, body.clubName);
  if (inPlace.kind === 'refused') {
    return new Response(JSON.stringify({ error: inPlace.error, code: inPlace.code }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const inPlaceClubName = inPlace.kind === 'in_place' ? inPlace.clubName : null;
  // The flip refuses some portals by name AFTER the charge (more than one team, or one that moved into another club): say so before.
  if (inPlaceClubName) {
    const blocked = await workspaceCannotBecomeClub(auth.org.id);
    if (blocked) {
      return new Response(JSON.stringify({ error: blocked, code: 'cannot_become_club' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const fallbackReturnTo = getBillingHref({ ...auth.org, planId: ownPlanOf(auth.org) }, { purpose: 'return' });
  const coachBillingReturn = isTeamWorkspaceOrg(auth.org) && returnTo === getBillingHref(auth.org, { host: 'coach', purpose: 'return' });
  const safeReturnTo = returnTo && (returnTo.startsWith(`/${auth.org.slug}/admin/`) || coachBillingReturn)
    ? returnTo
    : fallbackReturnTo;
  // Paying for the club lands on the CLUB's Plan & billing address (it exists on both sides of the flip — see
  // lib/workspace-upgrade.ts), carrying the in-place marker. LEAVING the payment page returns to where the coach was: nothing
  // changed, so their free days are exactly as they were.
  const successReturnTo = inPlaceClubName ? inPlaceReturnPath(auth.org.slug) : safeReturnTo;
  const isOnboardingPlanSelection = safeReturnTo.includes('/admin/onboarding');
  const shouldApplyDirectly = isBillingMockEnabled() || (!isStripeConfigured() && process.env.NODE_ENV !== 'production');

  // Founding Season: Tournament plan owners get Tournament Plus without Stripe — while the SIGNUP
  // window is open. After the close, only an organization that holds the Founding comp (given when it
  // was made) and is making its FIRST plan choice (owner 2026-10-19, lib/founding-season.ts); a free
  // org upgrading after that pays the list price through Stripe.
  const isFoundingSeasonTournamentUpgrade =
    !shouldApplyDirectly &&
    planKey === 'tournament_plus' &&
    ownPlanOf(auth.org) === 'tournament' &&
    (await foundingSeasonOfferOnPlanChoice(auth.org));

  // GST/HST Stage 1: a purchase needs the buyer's billing address on file (the comped Founding choice charges nothing, so it
  // is never asked). A portal becoming the club in place sends the CLUB's address with its name; it is saved to the club's own
  // row here — the coach's home address stays theirs. The mock path is a purchase too, so the dev walk meets the window.
  let billingLocation: BillingLocation | null = null;
  if (!isFoundingSeasonTournamentUpgrade) {
    const buyer: BillingBuyer = inPlaceClubName
      ? { kind: 'org', orgId: auth.org.id, name: inPlaceClubName, stripeCustomerId: auth.org.stripeCustomerId ?? null }
      : billingBuyerOf(auth.org, auth.user);
    const located = await requireBillingLocation(buyer, inPlaceClubName ? billingAddressFromBody(body.billingAddress) : null);
    if (!located.ok) return located.response;
    billingLocation = located.location;
  }

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
      return captureAndJson(orgError, { error: orgError.message }, 500);
    }

    // The database half of any plan change, so the mock path meets the same hook the webhook does — including Stage 4b's
    // "a Coaches Portal on Club becomes the club" (the mock subscription above is trialing, which counts as settled).
    await applyPlanChangeSideEffects({ orgId: auth.org.id, fromPlan: ownPlanOf(auth.org), toPlan: planKey, actor: auth.user.email ?? 'mock-checkout', clubName: inPlaceClubName });

    const restoreResult = await restoreRetainedDowngradeTournaments(auth.org.id, plan.tournamentLimit);
    // A07: coming back from a cancellation restores the site, the tournaments and the retention
    // records, and closes the cancellation (the Stripe path does the same from the webhook).
    if (auth.org.subscriptionStatus === 'canceled' && !isTeamWorkspaceOrg(auth.org)) {
      await restoreAfterReactivation(auth.org.id, plan.tournamentLimit);
    }
    await resetStartupTasksForEditableOnboarding(auth.org.id, isOnboardingPlanSelection);

    // Upgraded off the free Tournament plan — cancel any pending upsell email.
    if (planKey !== 'tournament') {
      await cancelScheduledEmail(auth.org.id, 'tournament_plus_upsell');
    }

    await writeGrowthEvent({
      source: 'mock',
      orgId: auth.org.id,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email,
      previousPlanId: ownPlanOf(auth.org),
      previousStatus: auth.org.subscriptionStatus,
      previousSubscriptionId: auth.org.stripeSubscriptionId ?? null,
      planId: planKey,
      status: 'trialing',
      metadata: { billingCycle },
    });

    if (isRecoveryTransition(auth.org.subscriptionStatus, 'trialing')) {
      await writePlatformEvent({
        eventType: 'subscription_recovered',
        source: 'mock',
        orgId: auth.org.id,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        previousPlanId: ownPlanOf(auth.org),
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
          orgId: auth.org.id,
          askedBy: auth.user.id,
        });
      }
    }

    return new Response(
      JSON.stringify({
        url: appendSuccess(`${appUrl}${successReturnTo}`),
        applied: true,
        planKey,
        billingCycle,
        restoredCount: restoreResult.restoredCount,
        remainingRetainedCount: restoreResult.remainingRetainedCount,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

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
      return captureAndJson(orgError, { error: orgError.message }, 500);
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
          subject: `You're on Tournament Plus — free through ${FOUNDING_SEASON_END_LABEL}`,
          html: tournamentPlusWelcomeHtml({
            orgName: auth.org.name,
            firstName: auth.user.user_metadata?.first_name as string | undefined,
            dashboardUrl: `${SITE_URL}/${auth.org.slug}/admin`,
            unsubscribeUrl: buildUnsubscribeUrl(auth.org.id) ?? undefined,
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
        previousPlanId: ownPlanOf(auth.org),
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
  const { TAXED_CHECKOUT } = await import('@/lib/billing-tax');

  // The buyer's name for its invoices: the club's (a Premium portal starting its club is buying as that club).
  // ⚠ Backing out of Stripe's page leaves the club's address and name on a Premium coach's customer (recorded, low risk: this
  // path runs only when that customer has no live subscription to charge at them).
  const customerId = await ensureStripeCustomer(auth.org, auth.user.email, billingLocation, inPlaceClubName ?? auth.org.name);

  // NO SECOND TRIAL (Ask 4, 2026-09-25). An organization that has already had a paid subscription
  // — a cancelled club coming back is the common case — pays from day one; the trial is for a
  // first purchase. A Founding Season next-season choice is a promise to pay, not a subscription
  // they used, so it does not count. (Asked of Stripe only when there is a trial to withhold.)
  const trialDays = mergedConfig.trialDays > 0 && !(await hadSubscriptionBefore(customerId))
    ? mergedConfig.trialDays
    : 0;

  await resetStartupTasksForEditableOnboarding(auth.org.id, isOnboardingPlanSelection);

  // The same object on the session AND the subscription: the webhook reads the subscription's, and a retry has no request behind it.
  const checkoutMetadata = { orgId: auth.org.id, planKey, billingCycle };
  const metadata = inPlaceClubName ? inPlaceMetadata(checkoutMetadata, inPlaceClubName) : checkoutMetadata;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    // GST/HST Stage 2: taxed by the club's address, and the club may enter its GST/HST number (lib/billing-tax.ts).
    ...TAXED_CHECKOUT,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      metadata,
    },
    metadata,
    success_url: appendSuccess(`${appUrl}${successReturnTo}`),
    cancel_url: `${appUrl}${safeReturnTo}`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}, { route: '/api/billing/create-checkout' });
