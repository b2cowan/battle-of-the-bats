import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { isBillingMockEnabled, isStripeConfigured } from '@/lib/billing-mock';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getPlanConfigOverride } from '@/lib/plan-config-db';
import { getStripePriceId } from '@/lib/stripe-prices';
import { isFoundingSeasonActive, FOUNDING_SEASON_END } from '@/lib/plan-config';
import {
  buildTeamCheckoutMetadata,
  normalizeTeamCheckoutRequest,
  provisionTeamWorkspaceFromCheckoutMetadata,
  provisionCompTeamWorkspaceFromCheckout,
} from '@/lib/team-checkout';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { getActiveOwnedTeamWorkspace } from '@/lib/team-workspace-entitlements';
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

async function orgSlugById(orgId: string | null | undefined): Promise<string | null> {
  if (!orgId) return null;
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .maybeSingle<{ slug: string }>();
  return data?.slug ?? null;
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

  // One paid Coaches Portal per email (decision 2026-06-19): if this account already has a LIVE
  // portal, don't let them start a second one — route them to the one they have. This applies to
  // reactivation too: reactivating a canceled portal when you have NO live one still works (the
  // check returns null for a canceled portal), but you can't reactivate a second portal while
  // another is already live.
  const existingPortal = await getActiveOwnedTeamWorkspace(user.id);
  if (existingPortal) {
    return new Response(JSON.stringify({
      error: 'Your account already has a Coaches Portal. Each account can have one — use a different email to start another.',
      code: 'portal_exists',
      orgSlug: existingPortal.orgSlug,
      url: `${appUrl}/${existingPortal.orgSlug}/coaches`,
    }), { status: 409, headers: { 'Content-Type': 'application/json' } });
  }

  // Founding Season: the Premium Coaches Portal is comped ($0). Provision the full workspace WITHOUT
  // Stripe (platform_override billing mode + null subscription, comp period = FOUNDING_SEASON_END).
  // This is the launch path for the promo and takes precedence over BOTH the dev mock and real Stripe
  // checkout — no card is ever collected or charged while the promo is active.
  if (isFoundingSeasonActive()) {
    try {
      const metadata = buildTeamCheckoutMetadata({
        ownerUserId: user.id,
        ownerEmail: user.email,
        request: checkoutRequest,
      });
      const provisionResult = await provisionCompTeamWorkspaceFromCheckout({
        metadata,
        compPeriodEnd: FOUNDING_SEASON_END,
        eventSource: 'founding_season',
        sourceEventId: `founding_team_comp_${Date.now()}`,
      });

      if (!provisionResult.provisioned && provisionResult.reason === 'reactivated') {
        const slug = await orgSlugById(provisionResult.workspaceOrgId);
        if (!slug) throw new Error('Reactivated Coaches Portal workspace was not found.');
        return new Response(JSON.stringify({
          url: appendSuccess(`${appUrl}/${slug}/coaches`),
          applied: true,
          reactivated: true,
          comped: true,
          planKey: 'team',
          billingCycle: checkoutRequest.billingCycle,
          orgSlug: slug,
          teamWorkspaceId: provisionResult.teamWorkspaceId,
          repTeamId: provisionResult.repTeamId,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Owner already has a live portal (race past the pre-checkout guard) — route them to it.
      if (!provisionResult.provisioned && provisionResult.reason === 'already_exists') {
        const slug = await orgSlugById(provisionResult.workspaceOrgId ?? null);
        return new Response(JSON.stringify({
          url: slug ? appendSuccess(`${appUrl}/${slug}/coaches`) : `${appUrl}${checkoutRequest.returnTo}`,
          applied: true,
          comped: true,
          planKey: 'team',
          billingCycle: checkoutRequest.billingCycle,
          orgSlug: slug,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (!provisionResult.provisioned) throw new Error('Could not create Coaches Portal.');
      const { result } = provisionResult;

      return new Response(JSON.stringify({
        url: appendSuccess(`${appUrl}/${result.org.slug}/coaches`),
        applied: true,
        comped: true,
        planKey: 'team',
        billingCycle: checkoutRequest.billingCycle,
        orgSlug: result.org.slug,
        teamWorkspaceId: result.teamWorkspaceId,
        repTeamId: result.team.id,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      if (error instanceof TeamWorkspaceClaimError) {
        return new Response(JSON.stringify({ error: error.message, code: error.code }), {
          status: error.code === 'claim_email_mismatch' ? 403 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (error instanceof TeamWorkspaceProvisioningError) {
        return new Response(JSON.stringify({ error: error.message, code: error.code }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('[team checkout comp] provisioning error:', error);
      void captureError(error, { user: { id: user.id, email: user.email }, route: '/api/billing/create-team-checkout', method: 'POST', statusCode: 500 });
      return new Response(JSON.stringify({ error: 'Failed to create your free Premium Coaches Portal.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

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
