import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getUserAccessContextsCached, filterWorkspaceContexts } from '@/lib/user-contexts';
import { withObservability } from '@/lib/observability';

/**
 * GET /api/me/workspaces — lightweight signal for client shells: how many PLACES does
 * the SESSION user hold? Drives whether to show the "All Workspaces" switcher link,
 * which is hidden for single-place users ("single-org by default", decision 2026-06-19).
 *
 * Nav Unification Stage A: counts the SAME workspace list Home renders (org admin/staff,
 * premium coach, basic coach, official — everything but the fan card) via the shared
 * context resolver, replacing the old raw organization_members count. That count missed
 * coach- and claim-shaped places entirely, so an admin-at-A-who-coaches-at-B — the exact
 * person this link exists for — never crossed its 2+ threshold.
 */
export const GET = withObservability(async () => {
  const user = await getAuthenticatedUser();
  if (!user?.email) return NextResponse.json({ count: 0, hasMultiple: false });

  const contexts = await getUserAccessContextsCached(user.id, user.email).catch(() => []);
  const count = filterWorkspaceContexts(contexts).length;
  return NextResponse.json({ count, hasMultiple: count > 1 });
}, { route: '/api/me/workspaces' });
