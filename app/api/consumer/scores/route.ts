/**
 * /api/consumer/scores
 *
 * The Unified Home Scores tab's client-fetched personalization (Phase 3). The /scores
 * SSR shell stays 100% anon-safe — it renders only the platform-wide live board — and
 * ALL per-account/per-device data rides this route (FP-2 viewer-identity pattern). No
 * per-user data is ever SSR'd into cacheable HTML, and the SW's blanket /api/ no-cache
 * rule plus no-store below keep it off every cache.
 *
 *  - GET  → the signed-in union (coached teams + run/officiated events ∪ follows).
 *           Signed-out callers get an empty payload; the client then POSTs its device
 *           follows for the signed-out lanes.
 *  - POST → { teams: { teamId, teamName?, orgSlug, tournamentSlug }[] } → the same lanes
 *           built from a device's local follows. Public data only (same info already on
 *           each tournament's schedule page), so this needs no auth — mirrors
 *           /api/consumer/follows/feed.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { getScoresFeedForUser, getScoresFeedForDeviceFollows } from '@/lib/scores-feed';
import type { ScoresPayload } from '@/lib/scores-view';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_FEED_TEAMS = 100; // sanity cap — mirrors /api/consumer/follows/feed

const EMPTY: ScoresPayload = { signedIn: false, today: '', events: [], games: [], orgTiles: [], liveCount: 0 };

export const GET = withObservability(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json(EMPTY, { headers: NO_STORE });

  const payload = await getScoresFeedForUser({ id: user.id, email: user.email });
  return NextResponse.json(payload, { headers: NO_STORE });
}, { route: '/api/consumer/scores' });

interface FeedItem { teamId?: string; teamName?: string; orgSlug?: string; tournamentSlug?: string; }
interface TournItem { orgSlug?: string; tournamentSlug?: string; }
interface OrgItem { orgSlug?: string; }

export const POST = withObservability(async (req: Request) => {
  let body: { teams?: FeedItem[]; tournaments?: TournItem[]; orgs?: OrgItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const items = Array.isArray(body.teams) ? body.teams.slice(0, MAX_FEED_TEAMS) : [];
  const teams = items
    .filter((t): t is Required<Pick<FeedItem, 'teamId' | 'orgSlug' | 'tournamentSlug'>> & FeedItem =>
      !!t.teamId && !!t.orgSlug && !!t.tournamentSlug)
    .map(t => ({ teamId: t.teamId, teamName: t.teamName ?? '', orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug }));

  // Phase 6: device whole-event + org follows also power the signed-out Scores grid.
  const tournaments = (Array.isArray(body.tournaments) ? body.tournaments.slice(0, MAX_FEED_TEAMS) : [])
    .filter((t): t is Required<TournItem> => !!t.orgSlug && !!t.tournamentSlug)
    .map(t => ({ orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug }));
  const orgSlugs = (Array.isArray(body.orgs) ? body.orgs.slice(0, MAX_FEED_TEAMS) : [])
    .map(o => o.orgSlug)
    .filter((s): s is string => !!s);

  const payload = await getScoresFeedForDeviceFollows(teams, tournaments, orgSlugs);
  return NextResponse.json(payload, { headers: NO_STORE });
}, { route: '/api/consumer/scores' });
