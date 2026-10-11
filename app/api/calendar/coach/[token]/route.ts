import { withObservability } from '@/lib/observability';
import { resolveSameHostOrigin } from '@/lib/app-origin';
import { readCoachFeed } from '@/lib/coach-calendar-feed';
import {
  PRIVATE_FEED_CACHE,
  refusedFeedResponse, calendarResponse,
} from '@/lib/calendar-feed-response';

/**
 * A COACH'S CALENDAR FEED (Club Tier Stage 6d, A2) — `/api/calendar/coach/{token}.ics`, what the coach's Subscribe window
 * hands to Apple, Google and Outlook. No session: a calendar app sends none, so the signed link is the credential, and
 * everything it may read is re-decided on every read (`readCoachFeed`).
 *
 * ⚠ A STOPPED LINK ANSWERS AN EMPTY CALENDAR, NEVER "NOT FOUND" (Ask 9, S6D-04): a removed coach, a reset link, a
 * closed season — a calendar app keeps the last copy of a feed that won't answer, so "not found" would leave the old
 * events frozen in that calendar. Only a link we never issued is "not found", and only that is counted against the
 * read limit (A4: a good read touches the counter not at all — Google's shared servers poll many feeds from one address).
 *
 * The address sits under /api, not the hub's drawn `/cal/t/…` (a top-level segment is a club's address).
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;
  const answer = await readCoachFeed(token, resolveSameHostOrigin(req));

  switch (answer.kind) {
    case 'unconfigured':
      // A missing signing secret is our fault, not the link's: "try later", never "not found" (which some apps take as
      // a reason to drop the subscription). Logged, so the morning health check sees it.
      console.error('[calendar/coach] CALENDAR_LINK_SECRET is not set — every coach feed is refusing');
      return new Response('Calendar feeds are unavailable right now', { status: 503, headers: { 'Retry-After': '3600' } });
    case 'refused':
      return refusedFeedResponse(req);
    case 'stopped':
      return calendarResponse({ calendarName: answer.calendarName, entries: [], cacheControl: PRIVATE_FEED_CACHE });
    case 'live':
      return calendarResponse({ calendarName: answer.calendarName, entries: answer.entries, cacheControl: PRIVATE_FEED_CACHE });
  }
}, { route: '/api/calendar/coach/[token]' });
