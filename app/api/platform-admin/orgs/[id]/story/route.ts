import { NextResponse } from 'next/server';
import { hasPlatformPower, requirePlatformAreaApi } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { buildClubStory } from '@/lib/platform-story';

/**
 * A club's whole Story, newest first (Support console Stage 2, A4). The record shows its first page from the server and
 * fetches this ONCE, the first time someone searches, filters or asks for more; the search and the Type filter then run
 * on screen (`filterStory`), so the words never leave the browser and a keystroke never rebuilds the Story. Every role
 * that opens the club record reads it; the page shows Put it back only to a role holding that power.
 */
export const GET = withObservability(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformAreaApi('organizations', 'view');
  if (auth.response) return auth.response;
  const { id } = await params;
  const entries = await buildClubStory(id, { money: hasPlatformPower(auth.role, 'find_stripe') });
  return NextResponse.json({ entries, total: entries.length }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/platform-admin/orgs/[id]/story' });
