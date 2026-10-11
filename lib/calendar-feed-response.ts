import 'server-only';
import { composeICSFromInstants, type ICSInstantEventInput } from './export/ics';
import { countRefusedCalendarRead, tooManyRequests } from './no-login-token';

/**
 * lib/calendar-feed-response.ts — how every team calendar feed answers (Club Tier Stage 6d, F8–F10). One home, so the
 * coach's feed, the public team feed and the family's feed can't drift on what a stopped link or a cache says.
 *
 *   a calendar      named even when empty (F8), the four-hour refresh hint (the composer writes it);
 *   a stopped link  the SAME answer with no entries — an empty calendar under its name, so a subscribed calendar drops
 *                   the events instead of keeping its last copy frozen (F10, S6D-04);
 *   never issued    "not found" (`refusedFeedResponse`), and only then — counted against the abuse ceiling.
 */

/** A private feed (a coach's, a family's): five minutes in the reader's own cache and no shared cache — the calendar
 *  app is the slow part, not us. */
export const PRIVATE_FEED_CACHE = 'private, max-age=300';

/**
 * The public team feed: one address per team, identical for every family, so a shared cache in front of the server
 * serves every family one read (the owner's cost ruling — "it costs the same however many families subscribe"). Five
 * minutes fresh, ten more served stale while it re-reads — so a team leaving Public link can take up to fifteen minutes
 * to leave a subscriber's calendar through the cache (the cost ruling's trade). ⚠ Whether the host's CDN honours it is
 * checked on production after the promote (walk 8); if it doesn't, the route memoises per team for five minutes instead.
 */
export const PUBLIC_FEED_CACHE = 'public, s-maxage=300, stale-while-revalidate=600';

export async function calendarResponse(params: {
  calendarName: string;
  entries: readonly ICSInstantEventInput[];
  cacheControl: string;
}): Promise<Response> {
  const ics = await composeICSFromInstants([...params.entries], params.calendarName);
  if (!ics) return new Response('Could not build calendar', { status: 500 });
  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="schedule.ics"',
      'Cache-Control': params.cacheControl,
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function calendarNotFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow' } });
}

/**
 * A read we REFUSE — a link we never issued, an unknown team: "not found", counted against the abuse ceiling, and past
 * it "too many". ONE answer for the three feeds, and the only place a feed touches the counter (A4: a good read is never
 * counted; a stopped link answers an empty calendar and is never counted either).
 */
export async function refusedFeedResponse(req: Request): Promise<Response> {
  const verdict = await countRefusedCalendarRead(req);
  return verdict.allowed ? calendarNotFound() : tooManyRequests(verdict);
}
