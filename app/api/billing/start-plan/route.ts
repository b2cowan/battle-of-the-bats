import { NextResponse } from 'next/server';
import { getAuthContext, requireCapability, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { ownPlanOf } from '@/lib/entitlement-grants';
import { startPlanOffer, startPlanSetupState } from '@/lib/start-plan-server';

/**
 * GET /api/billing/start-plan?orgSlug= → { offer } — the plan step of a paid door's organization (On-sale pages S2): the
 * door, the plan it came to buy, and each on-sale plan with the trial checkout will really give (trap B). `offer` is null
 * for every other organization, which keeps Run a tournament's plan step.
 *
 * GET /api/billing/start-plan?orgSlug=&session_id= → { state } — the wait after Stripe (trap A): `no_payment`,
 * `setting_up` or `ready` (lib/start-plan-server.ts `startPlanSetupState`).
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
  const offer = await startPlanOffer({
    id: auth.org.id,
    ownPlanId: ownPlanOf(auth.org),
    stripeCustomerId: auth.org.stripeCustomerId ?? null,
  });
  return NextResponse.json({ offer }, { headers });
}, { route: '/api/billing/start-plan' });
