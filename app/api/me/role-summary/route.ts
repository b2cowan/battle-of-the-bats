import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getUserAccessContextsCached, hasCoachAccess, getPrimaryOrgPlanContext, workspaceDoorsFromContexts } from '@/lib/user-contexts';
import { userHasChatMembership } from '@/lib/chat-service';

export const runtime = 'nodejs';

/**
 * GET /api/me/role-summary — the signed-in caller's global chrome doors, for surfaces that
 * resolve identity CLIENT-side (the tournament-page strip + org-home nav, whose HTML the
 * service worker caches anonymously — identity must never be SSR'd there):
 *   • adminHref — the caller's primary organization workspace destination (null if none);
 *   • coachHref — the coaches hub when the account coaches anything (Basic or Premium);
 *   • hasChat   — whether the caller belongs to ≥1 active chat room (the fan strip shows a
 *     Chat door only to people who can actually chat — state-based fan chrome, Phase 1).
 *   • orgPlan / billingHref — the primary org's plan and its billing screen (R4, 2026-08-01),
 *     so the marketing pricing page can mark the caller's current tier and point its CTAs at
 *     the screen where a plan change actually happens instead of the sign-up funnel.
 *
 * Deliberately ONE endpoint rather than a second pricing-specific call: the plan and slug already
 * ride the access contexts resolved below, so the new FIELDS cost no extra query. The anonymous
 * baseline is untouched — an anonymous visitor 401s above and never reaches this.
 *
 * ⚠ Be precise about what that does and doesn't buy: the pricing page is a NEW CALLER, so a
 * signed-in visitor to /pricing now makes one round-trip here that they previously did not. Only
 * org operators can act on the answer, and there is no cheaper client-side signal for "holds an org
 * workspace" — so signed-in fans and org-less coaches pay for a result that changes nothing for
 * them. Accepted as the price of R4 (a signed-in operator must not be funnelled through sign-up for
 * a plan they already have). If /pricing ever needs to get lighter, the lever is a cached or
 * SSR-passed workspace hint, not more fields on this response.
 */
export const GET = withObservability(async () => {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  const [contexts, hasChat] = await Promise.all([
    user.email
      ? getUserAccessContextsCached(user.id, user.email).catch(() => [])
      : Promise.resolve([]),
    userHasChatMembership(user.id).catch(() => false),
  ]);
  // Stage D.2 — one door per place, in Home's order: 2+ flips the chrome pill into the
  // "Workspaces ▾" popover (client-resolved surfaces read this; SSR'd bars get the same
  // list from the same resolver via their layouts).
  const workspaces = workspaceDoorsFromContexts(contexts);

  // Stage A instrumentation (NAV_UNIFICATION_PLAN §6): the multi-hat share of signed-in
  // traffic is the single number that decides whether any visible cross-place control
  // beyond the Workspaces popover ever gets built (<~10% → cancelled, not deferred).
  // One greppable CloudWatch line on an already-authed hot path — anonymous requests
  // 401 above and never reach it, so the anonymous baseline gains nothing. Counted off
  // the DOORS list (places you can actually enter) — the same set the popover renders.
  console.log(
    `[metric] multi_hat user=${user.id} places=${workspaces.length} kinds=${workspaces.map(w => w.kind).join(',') || 'none'}`,
  );

  // R4: the SAME primary org the Admin Area door points at, described by plan + billing screen.
  // The door is resolved ONCE, off the doors list already built above, and handed to the plan
  // lookup — so the two answers are the same org by construction, not by two walks agreeing.
  const adminHref = workspaces.find(d => d.kind === 'organization')?.href ?? null;
  const primaryOrg = getPrimaryOrgPlanContext(contexts, adminHref);

  return NextResponse.json({
    adminHref,
    coachHref: hasCoachAccess(contexts) ? '/coaches' : null,
    hasChat,
    workspaces,
    orgPlan: primaryOrg.planId,
    billingHref: primaryOrg.billingHref,
  });
}, { route: '/api/me/role-summary' });
