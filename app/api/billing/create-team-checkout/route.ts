import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { isBillingMockEnabled, isStripeConfigured } from '@/lib/billing-mock';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getPlanConfigOverride } from '@/lib/plan-config-db';
import { getStripePriceId } from '@/lib/stripe-prices';
import {
  buildTeamCheckoutMetadata,
  normalizeTeamCheckoutRequest,
} from '@/lib/team-checkout';
import {
  markTeamWorkspaceClaimed,
  TeamWorkspaceClaimError,
  verifyTeamWorkspaceClaimForCheckout,
} from '@/lib/team-workspace-claims';
import { provisionStandaloneTeamWorkspace, TeamWorkspaceProvisioningError } from '@/lib/team-workspace-provisioning';

function appendSuccess(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}success=1`;
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  let checkoutRequest;
  try {
    checkoutRequest = normalizeTeamCheckoutRequest(await req.json() as Record<string, unknown>);
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const shouldApplyDirectly = isBillingMockEnabled() || (!isStripeConfigured() && process.env.NODE_ENV !== 'production');

  if (shouldApplyDirectly) {
    try {
      const now = Date.now();
      const result = await provisionStandaloneTeamWorkspace({
        ownerUserId: user.id,
        ownerEmail: user.email,
        teamName: checkoutRequest.teamName,
        teamSlug: checkoutRequest.teamSlug,
        workspaceName: checkoutRequest.workspaceName,
        workspaceSlug: checkoutRequest.workspaceSlug,
        sport: checkoutRequest.sport,
        ageGroup: checkoutRequest.ageGroup,
        seasonName: checkoutRequest.seasonName,
        seasonYear: checkoutRequest.seasonYear,
        source: checkoutRequest.source,
        sourceTournamentId: checkoutRequest.sourceTournamentId,
        sourceTournamentTeamId: checkoutRequest.sourceTournamentTeamId,
        billingMode: 'team_direct',
        billingOwnerUserId: user.id,
        subscriptionStatus: 'active',
        stripeCustomerId: `mock_cus_team_${now}`,
        stripeSubscriptionId: `mock_sub_team_${checkoutRequest.billingCycle}_${now}`,
        stripeSubscriptionItemId: `mock_si_team_${now}`,
        entitlementSource: 'team_plan',
        entitlementStatus: 'active',
        eventSource: 'mock',
        sourceEventId: `mock_team_checkout_${now}`,
        actorUserId: user.id,
        actorEmail: user.email,
      });

      if (checkoutRequest.teamWorkspaceClaimId) {
        await markTeamWorkspaceClaimed({
          claimId: checkoutRequest.teamWorkspaceClaimId,
          teamWorkspaceId: result.teamWorkspaceId,
          claimedByUserId: user.id,
        });
      }

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
}
