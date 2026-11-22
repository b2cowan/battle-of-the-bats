import 'server-only';
import { getAuthContext, requireCapability, unauthorized } from './api-auth';
import { getPlanGatingMap } from './plan-gating-server';
import { PLAN_CONFIG } from './plan-config';
import type { MoveOrg, MoveRefusal } from './plan-move';
import type { OrgPlan } from './types';
import { getBillingFreeTimeFacts, ownPlanOf } from './entitlement-grants';
import { freeTimeCatchesEnd, moveLandsAt } from './free-time';
import { PLAN_RANK } from './plan-features';
import { PLAN_BILLING_WORDS as W } from './plan-billing-words';
import type { AcceptanceUser } from './legal-acceptance';

/**
 * The shared front half of the three move routes (preview, move, cancel-the-scheduled-move): the
 * owner's `billing` power, the org named explicitly, and — for a target plan — the ONE gating source
 * (A10: the same `getPlanGatingMap` checkout and onboarding read), so a plan that is not on sale
 * cannot be moved onto by a door the checkout would refuse. Club and Club · Association stay
 * `early_access` until the Stage 8 flip; until then these answer 403 like checkout does.
 */
export async function authorizeMove(orgSlug: string | undefined): Promise<
  | { ok: true; org: MoveOrg & { name: string; slug: string; currentPeriodEnd: string | null }; actor: string; actorId: string; user: AcceptanceUser }
  | { ok: false; response: Response }
> {
  const auth = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!auth) return { ok: false, response: unauthorized() };
  const denied = await requireCapability(auth, 'billing');
  if (denied) return { ok: false, response: denied };
  return {
    ok: true,
    // The signed-in person, for the move's Terms check (GST/HST Stage 6 step 6.3, C1 — POST only; DELETE and the preview never ask).
    user: auth.user,
    actor: auth.user.email ?? auth.user.id,
    actorId: auth.user.id,
    org: {
      id: auth.org.id,
      name: auth.org.name,
      slug: auth.org.slug,
      planId: ownPlanOf(auth.org),
      stripeCustomerId: auth.org.stripeCustomerId ?? null,
      stripeSubscriptionId: auth.org.stripeSubscriptionId ?? null,
      subscriptionStatus: auth.org.subscriptionStatus ?? null,
      // S4 Part 3: when a move down would land (the free-plan refusal asks free time at that date).
      currentPeriodEnd: auth.org.currentPeriodEnd ?? null,
    },
  };
}

export function parseTargetPlan(value: unknown): OrgPlan | null {
  return typeof value === 'string' && value in PLAN_CONFIG ? (value as OrgPlan) : null;
}

/** 403 while the target plan is not on sale — the checkout's own answer, from the same source. */
export async function refuseIfGated(toPlan: OrgPlan): Promise<Response | null> {
  const gating = await getPlanGatingMap();
  if (!gating[toPlan]) return null;
  return Response.json(
    { error: `${PLAN_CONFIG[toPlan].label} isn’t open for purchase yet.`, code: 'plan_not_on_sale' },
    { status: 403 },
  );
}

/**
 * On-sale pages S4 Part 3 (carried item 2; owner 2026-11-21, "Cancel is the one door"): a paying club whose running
 * whole-plan free time would catch its ending is refused a move to that plan or below it — the move would pay for nothing
 * it doesn't already have, and a move to the free plan is what Cancel already does (with nothing archived). Checkout's own
 * `below_free_plan` words. Asked strictly: a failed read refuses nothing silently, it throws (a 500 the window shows).
 */
export async function refuseBelowFreePlan(
  org: { id: string; name: string; ownPlan: OrgPlan; subscriptionStatus: string | null; currentPeriodEnd?: string | null }, toPlan: OrgPlan,
): Promise<Response | null> {
  // Asked at the date the move would land (/review 2026-11-21): a move to the free plan or below waits for the renewal, so
  // free time that ends before then catches nothing — and that club keeps its move down (Cancel would close it).
  const at = moveLandsAt(org.currentPeriodEnd);
  const { planGrant } = await getBillingFreeTimeFacts(
    { id: org.id, plan_id: org.ownPlan, subscription_status: org.subscriptionStatus, enabled_addons: [] }, { strict: true },
  );
  if (!planGrant || !freeTimeCatchesEnd(planGrant, at)) return null;
  if (PLAN_RANK[toPlan] > PLAN_RANK[planGrant.plan]) return null;
  return Response.json({ error: W.fallBack.belowFreePlan(org.name, planGrant.plan), code: 'below_free_plan' }, { status: 409 });
}

/** A refusal's HTTP status: the org's own state is a conflict; a provider hiccup is a 502. */
export function refusalResponse(refusal: MoveRefusal): Response {
  const status = refusal.code === 'stripe_error' ? 502
    : refusal.code === 'not_a_move' || refusal.code === 'price_missing' || refusal.code === 'club_name_invalid' ? 400
    : 409;
  return Response.json(refusal, { status });
}
