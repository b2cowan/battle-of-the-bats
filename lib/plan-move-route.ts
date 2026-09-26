import 'server-only';
import { getAuthContext, requireCapability, unauthorized } from './api-auth';
import { getPlanGatingMap } from './plan-gating-server';
import { PLAN_CONFIG } from './plan-config';
import type { MoveOrg, MoveRefusal } from './plan-move';
import type { OrgPlan } from './types';

/**
 * The shared front half of the three move routes (preview, move, cancel-the-scheduled-move): the
 * owner's `billing` power, the org named explicitly, and — for a target plan — the ONE gating source
 * (A10: the same `getPlanGatingMap` checkout and onboarding read), so a plan that is not on sale
 * cannot be moved onto by a door the checkout would refuse. Club and Club · Association stay
 * `early_access` until the Stage 8 flip; until then these answer 403 like checkout does.
 */
export async function authorizeMove(orgSlug: string | undefined): Promise<
  | { ok: true; org: MoveOrg & { name: string; slug: string }; actor: string; actorId: string }
  | { ok: false; response: Response }
> {
  const auth = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!auth) return { ok: false, response: unauthorized() };
  const denied = await requireCapability(auth, 'billing');
  if (denied) return { ok: false, response: denied };
  return {
    ok: true,
    actor: auth.user.email ?? auth.user.id,
    actorId: auth.user.id,
    org: {
      id: auth.org.id,
      name: auth.org.name,
      slug: auth.org.slug,
      planId: auth.org.planId,
      stripeCustomerId: auth.org.stripeCustomerId ?? null,
      stripeSubscriptionId: auth.org.stripeSubscriptionId ?? null,
      subscriptionStatus: auth.org.subscriptionStatus ?? null,
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

/** A refusal's HTTP status: the org's own state is a conflict; a provider hiccup is a 502. */
export function refusalResponse(refusal: MoveRefusal): Response {
  const status = refusal.code === 'stripe_error' ? 502
    : refusal.code === 'not_a_move' || refusal.code === 'price_missing' ? 400
    : 409;
  return Response.json(refusal, { status });
}
