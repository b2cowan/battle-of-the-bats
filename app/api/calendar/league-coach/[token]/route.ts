import { withObservability } from '@/lib/observability';
import { resolveSameHostOrigin } from '@/lib/app-origin';
import { readLeagueCoachFeed } from '@/lib/league-coach-calendar';
import {
  PRIVATE_FEED_CACHE,
  refusedFeedResponse, calendarResponse,
} from '@/lib/calendar-feed-response';

/**
 * A HOUSE-LEAGUE COACH'S CALENDAR FEED (House League 9d-3 Part 6, 9d3·5) — `/api/calendar/league-coach/{token}.ics`, the
 * rep coach's feed (`/api/calendar/coach/{token}`) for a `league_team_coaches` row. No session: the signed link is the
 * credential, and everything it may read is re-decided on every read (`readLeagueCoachFeed`).
 *
 * ⚠ A STOPPED LINK ANSWERS AN EMPTY CALENDAR, NEVER "NOT FOUND" (6d Ask 9): a removed coach, a reset link, a season no
 * longer live — "not found" would leave the old events frozen in the calendar. Only a link we never issued is "not
 * found", and only that is counted against the read limit.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;
  const answer = await readLeagueCoachFeed(token, resolveSameHostOrigin(req));

  switch (answer.kind) {
    case 'unconfigured':
      console.error('[calendar/league-coach] CALENDAR_LINK_SECRET is not set — every coach feed is refusing');
      return new Response('Calendar feeds are unavailable right now', { status: 503, headers: { 'Retry-After': '3600' } });
    case 'refused':
      return refusedFeedResponse(req);
    case 'stopped':
      return calendarResponse({ calendarName: answer.calendarName, entries: [], cacheControl: PRIVATE_FEED_CACHE });
    case 'live':
      return calendarResponse({ calendarName: answer.calendarName, entries: answer.entries, cacheControl: PRIVATE_FEED_CACHE });
  }
}, { route: '/api/calendar/league-coach/[token]' });
