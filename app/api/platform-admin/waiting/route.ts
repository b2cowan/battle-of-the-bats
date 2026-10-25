import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { getPreviousPlatformAdminVisit } from '@/lib/platform-admin-visits';
import { countsByEntry, getWaitingSnapshot } from '@/lib/platform-waiting';

/**
 * The menu's amber counts (Support console Stage 2, A11): each entry's waiting total, from the same queue list Today
 * reads, for this role only (a queue whose list the role cannot open is never counted).
 */
export const GET = withObservability(async () => {
  const auth = await requirePlatformPower('view_console');
  if (auth.response) return auth.response;
  const previous = auth.user.email ? await getPreviousPlatformAdminVisit(auth.user.email) : null;
  const { queues } = await getWaitingSnapshot(auth.role, previous?.visited_at ?? null);
  return NextResponse.json({ counts: countsByEntry(queues) }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/platform-admin/waiting' });
