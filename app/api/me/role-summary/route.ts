import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getUserAccessContextsCached, hasCoachAccess, getPrimaryOrgDestination, workspaceDoorsFromContexts } from '@/lib/user-contexts';
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

  return NextResponse.json({
    adminHref: getPrimaryOrgDestination(contexts),
    coachHref: hasCoachAccess(contexts) ? '/coaches' : null,
    hasChat,
    workspaces,
  });
}, { route: '/api/me/role-summary' });
