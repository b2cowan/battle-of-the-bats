/**
 * POST /api/consumer/follows/feed
 *
 * Public, unauthenticated read: given a list of followed teams, returns each
 * one enriched with its live/next/recent game state (unified-app Phase 2
 * Slice 2). Powers the signed-out device Following feed (which has no server
 * session to resolve follows from) AND the light client-side refresh for
 * both signed-in and signed-out feeds. No PII — same data already exposed on
 * each tournament's public schedule page, just resolved cross-tournament here.
 *
 * Body: { teams: { teamId, teamName?, orgSlug, tournamentSlug }[] }
 */
import { NextResponse } from 'next/server';
import { getFollowFeed, type FollowFeedInput } from '@/lib/follow-feed';
import { withObservability } from '@/lib/observability';

interface FeedItem { teamId?: string; teamName?: string; orgSlug?: string; tournamentSlug?: string; }

const MAX_FEED_TEAMS = 100; // sanity cap — mirrors /api/consumer/follows/claim

export const POST = withObservability(async (req: Request) => {
  let body: { teams?: FeedItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const items = Array.isArray(body.teams) ? body.teams.slice(0, MAX_FEED_TEAMS) : [];
  const inputs: FollowFeedInput[] = items
    .filter((t): t is Required<Pick<FeedItem, 'teamId' | 'orgSlug' | 'tournamentSlug'>> & FeedItem =>
      !!t.teamId && !!t.orgSlug && !!t.tournamentSlug)
    .map(t => ({ teamId: t.teamId, teamName: t.teamName ?? '', orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug }));

  const entries = await getFollowFeed(inputs);
  return NextResponse.json({ entries });
}, { route: '/api/consumer/follows/feed' });
