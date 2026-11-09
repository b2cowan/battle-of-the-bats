import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability, captureAndJson } from '@/lib/observability';
import { isTournamentTier } from '@/lib/billing-urls';
import { calendarPrograms, calendarWindow, readClubCalendar, readComingBookings } from '@/lib/club-calendar';
import { CALENDAR_WORDS, matchesFilters, readFiltersQuery } from '@/lib/club-calendar-view';
import { isCalendarDate, tournamentToday } from '@/lib/timezone';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { kitPermitsLink } from '@/lib/admin-kit-nav';
import { readDatesOffTaken } from '@/lib/permit-dates-off';
import { calendarOutside } from '@/lib/permit-dates-off-view';

// ---------------------------------------------------------------------------
// The club calendar (Club Tier Stage 6b, Asks 6–7; D5)
// GET /api/admin/club-calendar?orgSlug=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD
//   — every booking of the programs this reader can open, in the org-zone days from…to (six weeks at most), each
//     marked with both sides of any clash 6a's rule finds (`lib/club-calendar.ts`). READ-ONLY (D3): there is no write.
//   — `outside`: what the club's permits' dates off took in that range, as this reader's Calendar shows it (Club Tier 13c
//     Session B, B2: the day's "Outside the permit" chip and each booking's mark). The permit's one rule
//     (`readDatesOffTaken`), from today on — a past day took nothing anyone can still move. Its own failure: a Calendar
//     never fails over a permit mark (none drawn).
// GET /api/admin/club-calendar?orgSlug=<slug>&next=YYYY-MM-DD[&venues=&programs=&teams=&clashes=1]
//   — an empty week's "Next:" (13c Session B, B4): the first booking still to come in the six weeks from that day (never
//     before today) that matches the page's filters — the Overview band's own reader (`readComingBookings`), no new query.
// ---------------------------------------------------------------------------

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  // A Tournament-plan organization has no club side at all (its /admin/org is redirected away): no calendar either.
  if (isTournamentTier(ctx.org.planId)) return forbidden();

  const member = { role: ctx.role, capabilities: ctx.capabilities };
  // The page shows the programs the reader can open; with none, the door is not drawn — and a direct call says why.
  if (!calendarPrograms(member, ctx.org).length) {
    return NextResponse.json({ error: CALENDAR_WORDS.noPrograms, code: 'no_programs' }, { status: 403 });
  }
  const reader = { org: ctx.org, member, userId: ctx.user.id, assignedTournamentIds: ctx.assignedTournamentIds };
  const today = tournamentToday();

  // An empty week's "Next:" (B4): its own question, answered before any range is read.
  const nextFrom = url.searchParams.get('next');
  if (nextFrom !== null) {
    if (!isCalendarDate(nextFrom)) return NextResponse.json({ error: 'Pick a day.', code: 'bad_range' }, { status: 400 });
    try {
      const coming = await readComingBookings(reader, nextFrom > today ? nextFrom : today);
      const filters = readFiltersQuery(url.searchParams);
      const next = coming.find(b => matchesFilters(b, filters));
      return NextResponse.json({ next: next ? { day: next.day, who: next.who } : null });
    } catch (err) {
      return captureAndJson(err, { error: CALENDAR_WORDS.loadFailed, code: 'load_failed' }, 500);
    }
  }

  const window = calendarWindow(url.searchParams.get('from'), url.searchParams.get('to'));
  if ('error' in window) return NextResponse.json({ error: window.error, code: 'bad_range' }, { status: 400 });

  try {
    // Permits ride the Venue library's plans; a range wholly past asks nothing.
    const venueLibrary = hasOrgVenueLibrary(ctx.org.planId);
    const [{ calendarKeyOf, ...read }, taken] = await Promise.all([
      readClubCalendar(reader, window.from, window.to),
      venueLibrary && window.to >= today
        ? readDatesOffTaken(ctx.org.id, { from: window.from > today ? window.from : today, nowMs: Date.now(), through: window.to }).then(r => r.taken)
          .catch(e => { console.error('[club-calendar] the dates-off read failed (no marks):', e); return null; })
        : Promise.resolve(null),
    ]);
    // "See the permit ›" only for a reader who can open Permits (the rail's own gate).
    const permitsHref = () => kitPermitsLink({
      base: `/${ctx.org.slug}/admin`, role: ctx.role, isCanceled: ctx.org.subscriptionStatus === 'canceled',
      tournamentTier: false, hasVenueLibrary: venueLibrary,
    })?.href ?? null;
    return NextResponse.json({ ...read, outside: taken ? calendarOutside(taken, read.bookings, calendarKeyOf, permitsHref()) : null });
  } catch (err) {
    return captureAndJson(err, { error: CALENDAR_WORDS.loadFailed, code: 'load_failed' }, 500);
  }
}, { route: '/api/admin/club-calendar' });
