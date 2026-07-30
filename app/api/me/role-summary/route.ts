import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getUserAccessContextsCached, hasCoachAccess, getPrimaryOrgDestination } from '@/lib/user-contexts';
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
  return NextResponse.json({
    adminHref: getPrimaryOrgDestination(contexts),
    coachHref: hasCoachAccess(contexts) ? '/coaches' : null,
    hasChat,
  });
}, { route: '/api/me/role-summary' });
