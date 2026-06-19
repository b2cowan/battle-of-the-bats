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
import {
  TeamWorkspaceClaimError,
  verifyTeamWorkspaceClaimForCheckout,
} from '@/lib/team-workspace-claims';
import { TeamWorkspaceProvisioningError } from '@/lib/team-workspace-provisioning';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { captureError, withObservability } from '@/lib/observability';

function appendSuccess(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}success=1`;
}

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

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

  if (checkoutRequest.claimToken) {
    try {
      const claim = await verifyTeamWorkspaceClaimForCheckout({
        token: checkoutRequest.claimToken,
        userId: user.id,
        userEmail: user.email,
      });

      checkoutRequest = {
        ...checkoutRequest,
        source: 'tournament_claim' as const,
        sourceTournamentId: claim.tournament.id,
        sourceTournamentTeamId: claim.tournamentTeam.id,
        teamWorkspaceClaimId: claim.id,
      };
    } catch (error) {
      if (error instanceof TeamWorkspaceClaimError) {
        return new Response(JSON.stringify({ error: error.message, code: error.code }), {
          status: error.code === 'claim_email_mismatch' ? 403 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }
  }

  // Per-team upgrade from an existing FREE Basic team: carry it forward so the new workspace
  // back-links to it (and Phase 4 migrates its data). The client-supplied id is NEVER trusted —
  // re-verify the authenticated user owns it first; an unowned/unknown id is silently ignored
  // (falls back to a fresh team). Claim checkouts derive their free team from the tournament
  // registration instead, so skip this there.
  if (!checkoutRequest.claimToken) {
    const basicTeamIdInput = typeof rawBody.basicCoachTeamId === 'string' ? rawBody.basicCoachTeamId.trim() : '';
    if (basicTeamIdInput) {
      const ownedTeam = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamIdInput });
      if (ownedTeam) {
        checkoutRequest = { ...checkoutRequest, basicCoachTeamId: ownedTeam.id };
      }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
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
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      checkoutKind: metadata.checkoutKind,
      ownerUserId: user.id,
      planKey: 'team',
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      ...(mergedConfig.trialDays > 0 ? { trial_period_days: mergedConfig.trialDays } : {}),
      metadata,
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
