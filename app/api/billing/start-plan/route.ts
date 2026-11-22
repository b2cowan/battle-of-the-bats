import { NextResponse } from 'next/server';
import { getAuthContext, requireCapability, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { ownPlanOf } from '@/lib/entitlement-grants';
import { billingLandingState, startPlanOffer, startPlanSetupState, startTrialFor } from '@/lib/start-plan-server';
import type { OrgPlan } from '@/lib/types';

/** The plans a checkout can start (the payment window's trial read): the four a free Tournament organization is offered. */
const START_TRIAL_PLANS = ['tournament_plus', 'league', 'club', 'club_large'] as const;

/**
 * GET /api/billing/start-plan?orgSlug= → { offer } — the plan step of a paid door's organization (On-sale pages S2): the
 * door, the plan it came to buy, and each on-sale plan with the trial checkout will really give (trap B). `offer` is null
 * for every other organization, which keeps Run a tournament's plan step.
 *
 * GET /api/billing/start-plan?orgSlug=&session_id= → { state } — the wait after Stripe (trap A): `no_payment`,
 * `setting_up` or `ready` (lib/start-plan-server.ts `startPlanSetupState`). The door's wait and Plan & billing's (S4).
 *
 * GET /api/billing/start-plan?orgSlug=&landing=1 → { state } — Plan & billing's wait after a second press was refused
 * because a paid start is still landing (S4, `billingLandingState`).
 *
 * GET /api/billing/start-plan?orgSlug=&plan= → { trial: { trialDays, returning } } — the payment window's TRUE trial (S4,
 * call 38), for any organization; never makes a Stripe customer.
 *
 * Owner-only (`billing`), the organization named explicitly; reads only.
 */
export const GET = withObservability(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  // No suspended-org exemption: a paid door's organization is a free Tournament one until its plan lands.
  const auth = await getAuthContext({ orgSlug: params.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!auth) return unauthorized();
  const denied = await requireCapability(auth, 'billing');
  if (denied) return denied;
  const headers = { 'Cache-Control': 'no-store' };
  if (params.has('session_id')) {
    return NextResponse.json({ state: await startPlanSetupState(auth.org.id, params.get('session_id')) }, { headers });
  }
  // On-sale pages S4: Plan & billing's wait after a refused second press (no session behind it).
  if (params.get('landing') === '1') {
    return NextResponse.json({ state: await billingLandingState(auth.org.id) }, { headers });
  }
  // On-sale pages S4, call 38: the payment window's TRUE trial for one plan, read-only (no Stripe customer is made).
  const plan = params.get('plan');
  if (plan !== null) {
    if (!(START_TRIAL_PLANS as readonly string[]).includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400, headers });
    }
    return NextResponse.json({ trial: await startTrialFor({ stripeCustomerId: auth.org.stripeCustomerId ?? null }, plan as OrgPlan) }, { headers });
  }
  const offer = await startPlanOffer({
    id: auth.org.id,
    ownPlanId: ownPlanOf(auth.org),
    stripeCustomerId: auth.org.stripeCustomerId ?? null,
  });
  return NextResponse.json({ offer }, { headers });
}, { route: '/api/billing/start-plan' });
