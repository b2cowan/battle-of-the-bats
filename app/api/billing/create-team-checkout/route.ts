import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { isBillingMockEnabled, isStripeConfigured } from '@/lib/billing-mock';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getPlanConfigOverride } from '@/lib/plan-config-db';
import { getStripePriceId } from '@/lib/stripe-prices';
import {
  buildTeamCheckoutMetadata,
  normalizeTeamCheckoutRequest,
  provisionTeamWorkspaceFromCheckoutMetadata,
} from '@/lib/team-checkout';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { getActiveOwnedTeamWorkspace } from '@/lib/team-workspace-owned';
import { findKeepPremiumPortal } from '@/lib/portal-keep-premium';
import { TeamWorkspaceProvisioningError } from '@/lib/team-workspace-provisioning';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { captureError, withObservability } from '@/lib/observability';
import { buyerStripeCustomer } from '@/lib/team-checkout-customer';
import { hadSubscriptionBefore } from '@/lib/plan-move';
import { requireBillingLocation, stampStripeCustomerAddress } from '@/lib/billing-location-server';
import { BUYER_NAME_META, TAXED_CHECKOUT } from '@/lib/billing-tax';
import { BUYER_USER_META, COMEBACK_META } from '@/lib/plan-growth';
import { toStripeAddress } from '@/lib/billing-location';
import { requireAcceptance } from '@/lib/legal-acceptance';

function appendSuccess(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}success=1`;
}

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  // Nobody starts a paid plan without the current Terms (GST/HST Stage 6 step 6.3, C1) — before every branch: the comp
  // and dev-mock paths provision a workspace without Stripe.
  const terms = await requireAcceptance(user);
  if (!terms.ok) return terms.response;

  let checkoutRequest;
  let rawBody: Record<string, unknown>;
  try {
    rawBody = (await req.json()) as Record<string, unknown>;
    checkoutRequest = normalizeTeamCheckoutRequest(rawBody);
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid Coaches Portal checkout request.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const gatingMap = await getPlanGatingMap();
  if (gatingMap.team) {
    return new Response(JSON.stringify({ error: 'Coaches Portal checkout is not open for self-serve yet.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Per-team upgrade from an existing FREE Basic team: carry it forward so the new workspace
  // back-links to it (and Phase 4 migrates its data). The client-supplied id is NEVER trusted —
  // re-verify the authenticated user owns it first; an unowned/unknown id is silently ignored
  // (falls back to a fresh team).
  const basicTeamIdInput = typeof rawBody.basicCoachTeamId === 'string' ? rawBody.basicCoachTeamId.trim() : '';
  if (basicTeamIdInput) {
    const ownedTeam = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamIdInput });
    if (ownedTeam) {
      checkoutRequest = { ...checkoutRequest, basicCoachTeamId: ownedTeam.id };
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  // One paid Coaches Portal per email (decision 2026-06-19): if this account already has a LIVE
  // portal, don't let them start a second one — route them to the one they have. This applies to
  // reactivation too: reactivating a canceled portal when you have NO live one still works (the
  // check returns null for a canceled portal), but you can't reactivate a second portal while
  // another is already live.
  // Keep Premium (Support console Stage 4b, Part 6): the coach's portal from free time, named by this checkout, is the
  // one the purchase attaches to, so it is not "another" portal. Any OTHER live portal still refuses.
  const keepPortal = await findKeepPremiumPortal({
    ownerUserId: user.id,
    reactivateOrgSlug: checkoutRequest.reactivateOrgSlug,
    basicCoachTeamId: checkoutRequest.basicCoachTeamId,
  });
  const existingPortal = await getActiveOwnedTeamWorkspace(user.id);
  if (existingPortal && existingPortal.workspaceOrgId !== keepPortal?.orgId) {
    return new Response(JSON.stringify({
      error: 'Your account already has a Coaches Portal. Each account can have one — use a different email to start another.',
      code: 'portal_exists',
      orgSlug: existingPortal.orgSlug,
      url: `${appUrl}/${existingPortal.orgSlug}/coaches`,
    }), { status: 409, headers: { 'Content-Type': 'application/json' } });
  }

  // GST/HST Stage 1: a coach buys Premium as a PERSON, so the address is their own home address, saved by the sign-up page's
  // Address step before this request. The mock path below is a purchase, so the dev walk meets the step.
  // Coach Premium is a purchase: a Québec address is refused (GST/HST 6.4, Q6).
  const located = await requireBillingLocation({ kind: 'user', userId: user.id }, null, { purchase: true });
  if (!located.ok) return located.response;

  const shouldApplyDirectly = isBillingMockEnabled() || (!isStripeConfigured() && process.env.NODE_ENV !== 'production');

  if (shouldApplyDirectly) {
    try {
      const now = Date.now();
      const mockSubscriptionId = `mock_sub_team_${checkoutRequest.billingCycle}_${now}`;
      const mockSubscriptionItemId = `mock_si_team_${now}`;
      const metadata = buildTeamCheckoutMetadata({
        ownerUserId: user.id,
        ownerEmail: user.email,
        request: checkoutRequest,
      });
      const provisionResult = await provisionTeamWorkspaceFromCheckoutMetadata({
        metadata,
        stripeCustomerId: `mock_cus_team_${now}`,
        stripeSubscriptionId: mockSubscriptionId,
        stripeSubscriptionItemId: mockSubscriptionItemId,
        subscriptionStatus: 'active',
        billingCycle: checkoutRequest.billingCycle,
        eventSource: 'mock',
        sourceEventId: `mock_team_checkout_${now}`,
      });

      if (!provisionResult.provisioned && (
        provisionResult.reason === 'missing_subscription_id' ||
        provisionResult.reason === 'not_team_checkout'
      )) {
        throw new Error('Could not apply Coaches Portal checkout.');
      }

      if (!provisionResult.provisioned && provisionResult.reason === 'reactivated') {
        const { data: org, error: orgError } = await supabaseAdmin
          .from('organizations')
          .select('slug')
          .eq('id', provisionResult.workspaceOrgId)
          .maybeSingle<{ slug: string }>();
        if (orgError) throw orgError;
        if (!org?.slug) throw new Error('Reactivated Coaches Portal workspace was not found.');

        return new Response(JSON.stringify({
          url: appendSuccess(`${appUrl}/${org.slug}/coaches`),
          applied: true,
          reactivated: true,
          planKey: 'team',
          billingCycle: checkoutRequest.billingCycle,
          orgSlug: org.slug,
          teamWorkspaceId: provisionResult.teamWorkspaceId,
          repTeamId: provisionResult.repTeamId,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!provisionResult.provisioned) throw new Error('Could not create Coaches Portal.');
      const { result } = provisionResult;

      return new Response(JSON.stringify({
        url: appendSuccess(`${appUrl}/${result.org.slug}/coaches`),
        applied: true,
        planKey: 'team',
        billingCycle: checkoutRequest.billingCycle,
        orgSlug: result.org.slug,
        teamWorkspaceId: result.teamWorkspaceId,
        repTeamId: result.team.id,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof TeamWorkspaceProvisioningError) {
        return new Response(JSON.stringify({ error: error.message, code: error.code }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('[team checkout mock] provisioning error:', error);
      void captureError(error, { user: { id: user.id, email: user.email }, route: '/api/billing/create-team-checkout', method: 'POST', statusCode: 500 });
      return new Response(JSON.stringify({ error: 'Failed to create Coaches Portal.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (!isStripeConfigured()) {
    return new Response(JSON.stringify({ error: 'Stripe checkout is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const priceId = await getStripePriceId('team', checkoutRequest.billingCycle);
  if (!priceId) {
    const cycleLabel = checkoutRequest.billingCycle === 'annual' ? 'Annual' : 'Monthly';
    return new Response(JSON.stringify({ error: `${cycleLabel} checkout is not configured for Team yet.` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const mergedConfig = await getPlanConfigOverride('team');
  const metadata = buildTeamCheckoutMetadata({
    ownerUserId: user.id,
    ownerEmail: user.email,
    request: checkoutRequest,
  });
  const { stripe } = await import('@/lib/stripe');
  // The buyer's name for its invoices (accounting 6b): a coach buys Premium as a person, so it is the coach's own name.
  const buyerName = ((user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined)?.trim() || null;
  // Stage 0 (S10): the buyer's own Stripe customer, found before one is made, so their history is in one place.
  const { customerId, source } = await buyerStripeCustomer(user.id, {
    async portalCustomerIds(userId) {
      const { data, error } = await supabaseAdmin.from('team_workspaces').select('stripe_customer_id')
        .eq('billing_owner_user_id', userId).neq('billing_mode', 'org_team_addon').neq('workspace_state', 'org_owned')
        .not('stripe_customer_id', 'is', null).order('updated_at', { ascending: false }).limit(5);
      if (error) throw error;
      return ((data ?? []) as Array<{ stripe_customer_id: string }>).map(r => r.stripe_customer_id);
    },
    async customersByOwner(userId) {
      const res = await stripe.customers.search({ query: `metadata['ownerUserId']:'${userId}'`, limit: 10 });
      return res.data.sort((a, b) => b.created - a.created).map(c => c.id);
    },
    async create() {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { checkoutKind: metadata.checkoutKind, ownerUserId: user.id, planKey: 'team', ...(buyerName ? { [BUYER_NAME_META]: buyerName } : {}) },
        ...(buyerName ? { name: buyerName } : {}),
        address: toStripeAddress(located.location),
      });
      return customer.id;
    },
    report: error => void captureError(error, { user: { id: user.id, email: user.email }, route: '/api/billing/create-team-checkout', method: 'POST' }),
  });
  // A customer found again (an earlier portal, or a checkout left before paying) carries the address it is charged at.
  if (source !== 'created') await stampStripeCustomerAddress(customerId, located.location, buyerName);

  // Keep Premium is a coach who already had Premium free: a trial on top would only push the first charge out. And, as the
  // club checkout rules, no second trial for a customer that ever held a subscription (a new customer has held none).
  // GST/HST 6.4: also the purchase email's "Welcome back" (a paid comeback's one email, ruling Q3), so it is always asked.
  const returning = source !== 'created' && await hadSubscriptionBefore(customerId);
  const trialDays = !keepPortal && mergedConfig.trialDays > 0 && !returning
    ? mergedConfig.trialDays : 0;
  // GST/HST 6.4: who bought (the purchase email's "Bought by" and their Terms) and whether they came back. On the subscription
  // only: the session's metadata is what the webhook's team-checkout parser reads, and it stays as it was.
  const subscriptionMetadata = { ...metadata, [BUYER_USER_META]: user.id, ...(returning ? { [COMEBACK_META]: '1' } : {}) };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    // GST/HST Stage 2: taxed by the coach's own address, and a GST/HST number may be entered (owner Ask 6: coaches too).
    ...TAXED_CHECKOUT,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      metadata: subscriptionMetadata,
    },
    metadata,
    success_url: `${appUrl}/coaches/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}${checkoutRequest.returnTo}`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}, { route: '/api/billing/create-team-checkout' });
