import { getAuthContext, requireCapability, unauthorized } from '@/lib/api-auth';
import { isBillingMockEnabled, isStripeConfigured } from '@/lib/billing-mock';
import { ensureStripeCustomer, recordNextSeasonChoice, getOrgBillingFacts } from '@/lib/billing-setup';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getStripePriceId } from '@/lib/stripe-prices';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  FOUNDING_SEASON_COMP_EXPIRIES,
  PLAN_CONFIG,
  isFoundingSeasonPromoPlan,
  normalizeBillingCycle,
} from '@/lib/plan-config';
import {
  buildNextSeasonCheckoutParams,
  isNextSeasonChoiceOpen,
  nextSeasonPlanOptions,
  NEXT_SEASON_FIRST_CHARGE_LABEL,
} from '@/lib/next-season-choice';
import { withObservability } from '@/lib/observability';
import type { OrgPlan } from '@/lib/types';

/**
 * POST /api/billing/choose-next-season
 *
 * "Choose your 2028 plan" — the summer ask that replaces "add a payment method" as the thing a
 * Founding Season account is asked to do (FOUNDING_SEASON_2027_DESK_PLAN.md §4.4; owner-approved
 * 2026-09-07). Creates the subscription that will charge on the first-charge instant and NOT ONE
 * SECOND SOONER; everything that decides that date lives in lib/next-season-choice.ts, pinned to a
 * single constant and covered by tests/unit/next-season-choice.test.ts.
 *
 * Four gates, in this order, because each one is cheaper than the next:
 *   1. the window is open   — nothing may be chosen outside June 1 → September 30;
 *   2. the account is comped — a paying account has an ordinary subscription, not a choice;
 *   3. the plan is on offer  — the account's own plan, in either cycle (League/Club are
 *                              early-access and their checkout 403s, so they are not a real menu);
 *   4. the plan is live in plan_gating — a DB override can close a plan without touching config.
 */
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({})) as {
    orgSlug?: unknown; planKey?: unknown; billingCycle?: unknown;
  };
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug : undefined;
  const auth = await getAuthContext(orgSlug ? { orgSlug, allowSuspendedOrg: true } : { allowSuspendedOrg: true });
  if (!auth) return unauthorized();
  // Billing is owner-only — enforced server-side; the UI also hides the control.
  const denied = await requireCapability(auth, 'billing');
  if (denied) return denied;

  // ── 1. The window ─────────────────────────────────────────────────────────
  if (!isNextSeasonChoiceOpen()) {
    return json({ error: 'The plan choice is not open yet.' }, 403);
  }

  // ── 2. The account is actually comped ─────────────────────────────────────
  // Tolerant of the legacy instant, like every other recognition site: an account whose row the
  // backfill has not reached is still in the cohort.
  const { data: comp } = await supabaseAdmin
    .from('org_overrides')
    .select('id')
    .eq('org_id', auth.org.id)
    .eq('type', 'comp_period')
    .in('expires_at', [...FOUNDING_SEASON_COMP_EXPIRIES])
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (!comp) {
    return json({ error: 'This account is not on a Founding Season plan.' }, 403);
  }

  // ── 3. The plan is one this account may choose ────────────────────────────
  const planKey = typeof body.planKey === 'string' ? body.planKey : '';
  const billingCycle = normalizeBillingCycle(body.billingCycle);
  const options = nextSeasonPlanOptions(auth.org.planId);
  // Two tests, not one: the account's own plan must be on the Founding Season promo AND be what was
  // asked for. An account whose plan_id drifted away from its comp cannot widen its own menu.
  if (!options.includes(planKey as OrgPlan) || !isFoundingSeasonPromoPlan(planKey)) {
    return json({ error: 'That plan is not available for your next season.' }, 400);
  }

  // ── 4. The plan is open for self-serve checkout ───────────────────────────
  const gatingMap = await getPlanGatingMap();
  if (gatingMap[planKey as OrgPlan]) {
    return json({ error: 'This plan is not open for self-serve checkout yet.' }, 403);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const billingPath = `/${auth.org.slug}/admin/org/billing`;
  const successUrl = `${appUrl}${billingPath}?next_season=1`;
  const cancelUrl = `${appUrl}${billingPath}`;

  // A coach workspace's subscription must be bound to the WORKSPACE, not only to its shadow org —
  // syncTeamWorkspaceSubscription finds a workspace by subscription id, so an unbound one is lost.
  const { data: workspace } = await supabaseAdmin
    .from('team_workspaces')
    .select('id')
    .eq('workspace_org_id', auth.org.id)
    .maybeSingle();
  const teamWorkspaceId = (workspace?.id as string | undefined) ?? null;

  // ── Dev mock: no Stripe. Record the choice directly and bounce back ───────
  // The dev Stripe environment has NO price ids configured at all (every sandbox row in
  // stripe_prices is null), so this is the only path the QA walk can take on dev.
  if (isBillingMockEnabled() || (!isStripeConfigured() && process.env.NODE_ENV !== 'production')) {
    await recordNextSeasonChoice({
      orgId: auth.org.id,
      planKey,
      billingCycle,
      teamWorkspaceId,
    });
    return json({ url: successUrl, applied: true, planKey, billingCycle }, 200);
  }

  if (!isStripeConfigured()) {
    return json({ error: 'Billing is not configured.' }, 503);
  }

  const priceId = await getStripePriceId(planKey, billingCycle);
  if (!priceId) {
    const cycleLabel = billingCycle === 'annual' ? 'Annual' : 'Monthly';
    const label = PLAN_CONFIG[planKey as OrgPlan]?.label ?? planKey;
    return json({ error: `${cycleLabel} checkout is not configured for ${label} yet.` }, 400);
  }

  const { stripe } = await import('@/lib/stripe');
  const customerId = await ensureStripeCustomer(auth.org, auth.user.email);

  // ⚠⚠ CANCEL ANY PRIOR CHOICE BEFORE MAKING A NEW ONE, OR OCTOBER 1 CHARGES TWICE.
  // Every choice creates a real Stripe subscription whose first charge is the same instant. A second
  // one — a double-click, a back button from Checkout, a genuine change of mind — leaves BOTH live,
  // and on the first-charge day the customer is billed for both. Nothing downstream would notice:
  // the account row can only hold one subscription id, so the older one becomes invisible to us
  // while staying perfectly visible to Stripe. The paid Coaches Portal path has had exactly this
  // guard since it was built (`cancelPriorTeamSubscription` in the webhook); this is its twin.
  const priorFacts = await getOrgBillingFacts(auth.org.id);
  const priorSubscriptionId = priorFacts?.nextSeasonSubscriptionId ?? null;
  if (priorSubscriptionId?.startsWith('sub_')) {
    try {
      await stripe.subscriptions.cancel(priorSubscriptionId);
    } catch (err) {
      // Already gone is the expected failure and is fine. Anything else is not: rather than risk a
      // second live subscription, refuse and let the customer try again.
      const code = (err as { code?: string })?.code;
      if (code !== 'resource_missing') {
        return json({
          error: 'We could not replace your previous choice. Nothing has changed — please try again.',
        }, 409);
      }
    }
  }

  let params;
  try {
    params = buildNextSeasonCheckoutParams({
      customerId,
      priceId,
      orgId: auth.org.id,
      planKey: planKey as OrgPlan,
      billingCycle,
      successUrl,
      cancelUrl,
      teamWorkspaceId,
    });
  } catch (err) {
    // The builder refuses rather than emitting a session that could bill early (a first-charge
    // instant in the past). Surface it — a refusal the operator can see beats a silent charge.
    return json({ error: err instanceof Error ? err.message : 'The plan choice is not available.' }, 409);
  }

  const session = await stripe.checkout.sessions.create(params);
  return json({ url: session.url, firstChargeLabel: NEXT_SEASON_FIRST_CHARGE_LABEL }, 200);
}, { route: '/api/billing/choose-next-season' });
