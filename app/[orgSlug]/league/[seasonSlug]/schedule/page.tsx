import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getDivisionsForSeason,
  getTeamsForSeason,
  getOrgPlaceNames,
} from '@/lib/db';
import { publicSeasonGames } from '@/lib/league-game-changes-server';
import { SCHEDULE_PUBLIC_WORDS as P } from '@/lib/league-schedule-words';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { orgDayKey, timesInZoneSentence } from '@/lib/timezone';
import { STATE_WORDS, dayHeading, dayWords, weekRangeWords } from '@/lib/calendar-recipe';
import { clockOf, whereWords } from '@/lib/club-calendar-view';
import {
  SEASON_PUBLIC_WORDS, SEASON_SCHEDULE_WORDS, seasonCalendar, seasonWeeks, todayLineAt,
  type SeasonBooking, type SeasonWeek,
} from '@/lib/league-season-calendar';
import type { LeagueDivision } from '@/lib/types';
import column from '../../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

// A draft season is hidden by this page, so the tab does not name it either.
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    const season = await getClubSeason(club.id, seasonSlug);
    return season && season.status !== 'draft' ? `${season.name} schedule` : null;
  }, { path: `/league/${seasonSlug}/schedule` });
}

/**
 * THE PUBLIC SCHEDULE (House League 9d-2a, frames g1/g2; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Stage 9d-2a" g).
 * Games only — a practice is never public. Every game reads through the season page's own bookings
 * (`seasonCalendar`), so its state, its result and its place are the same words the convenor reads:
 *   - a CANCELLED game stays in its week, struck, with its word (it used to vanish: the read dropped it — C6-04);
 *   - a POSTPONED game leaves its week for "Needs a new date" (it used to read as on, at its old time);
 *   - the place is on every game; "Times in Eastern time." is said once (C10).
 * ⚠ THE WEEK AND THE DAY ARE THE CLUB'S (S6-12): this is a server page, so every day is `orgDayKey`'s, never the host's
 * clock — `seasonWeeks` files a booking by the Monday of its org-zone day.
 * ⚖ ONLY A PUBLISHED SCHEDULE IS PUBLIC (House League 9d-2b, 9d2·1, frame g2): a division still a draft says its schedule
 * is coming, and its tab says so. A published game reads as families last heard it until the league admin sends a change
 * (9d2·16, `publicSeasonGames`); a game re-dated and sent reads "Moved" with the date it was.
 */
export default async function PublicSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;
  const { d: divisionIdParam } = await searchParams;
  await forwardToOwnAddress(orgSlug, `/league/${seasonSlug}/schedule${divisionIdParam ? `?d=${encodeURIComponent(divisionIdParam)}` : ''}`);
  const href = await orgLinks(orgSlug);

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const season = await getClubSeason(org.id, seasonSlug);
  if (!season) notFound();
  if (season.status === 'draft') notFound();

  const [divisions, teams, places] = await Promise.all([
    getDivisionsForSeason(season.id),
    getTeamsForSeason(season.id),
    getOrgPlaceNames(org.id),
  ]);
  const { games, published } = await publicSeasonGames(season.id, divisions);

  const activeDivision: LeagueDivision | null =
    divisions.find(d => d.id === divisionIdParam) ?? divisions[0] ?? null;
  // A draft division has no public games; one division only and still a draft reads the same.
  const coming = !!activeDivision && !published.has(activeDivision.id);

  const { bookings, needsDate } = seasonCalendar({
    seasonName: season.name,
    sport: season.sport,
    games: activeDivision ? games.filter(g => g.divisionId === activeDivision.id) : games,
    practices: [],
    teamName: new Map(teams.map(t => [t.id, t.name])),
    divisionName: new Map(divisions.map(d => [d.id, d.name])),
    placeOf: (venueId, facilityId) => {
      const venue = places.venues.get(venueId);
      return venue ? { venue: venue.name, facility: facilityId ? places.facilities.get(facilityId) ?? null : null, address: venue.address } : null;
    },
  });
  const today = orgDayKey(new Date().toISOString());
  const { earlier, ahead } = seasonWeeks(bookings, today);
  const hasGames = bookings.length + needsDate.length > 0;

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  return (
    <div>
      {/* R6: the shared 1200px page column; this page's 800px measure left-aligns inside it. */}
      <div className={`container ${column.column}`} style={{ '--league-measure': '800px' } as React.CSSProperties}>
        <Link href={href(`/league/${seasonSlug}`)} className={kit.back}>
          ← {season.name}
        </Link>

        <h1 className={kit.title} style={{ marginBottom: '1.5rem' }}>Schedule</h1>

        {divisions.length > 1 && (
          <div className={column.tabs}>
            {divisions.map(d => {
              const isActive = d.id === activeDivision?.id;
              return (
                <Link
                  key={d.id}
                  href={href(`/league/${seasonSlug}/schedule`) + `?d=${d.id}`}
                  className={`${column.tab}${isActive ? ` ${column.tabActive}` : ''}`}
                >
                  {published.has(d.id) ? d.name : P.comingTab(d.name)}
                </Link>
              );
            })}
          </div>
        )}

        {coming ? (
          <div className={kit.empty}>{P.coming(activeDivision!.name)}. {P.comingHint}</div>
        ) : !hasGames ? (
          <div className={kit.empty}>{SEASON_PUBLIC_WORDS.noGames}</div>
        ) : (
          <>
            <p className={column.zone}>{timesInZoneSentence()}</p>
            <div className={column.weeks}>
              {earlier.length > 0 && (
                <details className={column.earlier}>
                  <summary>{SEASON_SCHEDULE_WORDS.earlierWeeks(earlier.length)}</summary>
                  {earlier.map(w => <Week key={w.monday} week={w} today={today} />)}
                </details>
              )}
              {ahead.map(w => <Week key={w.monday} week={w} today={today} />)}
              {needsDate.length > 0 && (
                <section className={column.week}>
                  <h2 className={column.weekHead}>{SEASON_SCHEDULE_WORDS.needsDate}</h2>
                  <div className={kit.list}>
                    {needsDate.map(b => <GameRow key={b.key} booking={b} />)}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A week: "Jun 14 – 20, 2027 · this week", its games, and the today line in this week only. */
function Week({ week, today }: { week: SeasonWeek<SeasonBooking>; today: string }) {
  const line = todayLineAt(week, today);
  const head = weekRangeWords(week.monday) + (line === null ? '' : ` · ${SEASON_SCHEDULE_WORDS.thisWeek}`);
  const todayLine = <div key="today" className={column.todayLine}>{dayHeading(today, today)}</div>;
  const rows = week.bookings.map(b => <GameRow key={b.key} booking={b} />);
  if (line !== null) rows.splice(line, 0, todayLine);
  return (
    <section className={column.week}>
      <h2 className={column.weekHead}>{head}</h2>
      <div className={kit.list}>{rows}</div>
    </section>
  );
}

/** One game: when · the match and its place · the result, or the state in words. */
function GameRow({ booking: b }: { booking: SeasonBooking }) {
  const game = b.source.kind === 'game' ? b.source.game : null;
  const postponed = b.state === 'postponed';
  const cancelled = b.state === 'cancelled';
  const place = whereWords(b);
  // Moved (9d2·10): a game re-dated since families first heard, once the change was sent — the date they heard.
  const movedFrom = game?.movedFrom && !postponed && !cancelled && !b.result ? game.movedFrom : null;
  return (
    <div className={`${column.game}${cancelled ? ` ${column.struck}` : ''}`}>
      {game?.scheduledAt ? (
        <time className={column.when} dateTime={game.scheduledAt}>
          {postponed ? SEASON_PUBLIC_WORDS.was(dayWords(b.day)) : dayWords(b.day)}
          <span>{clockOf(b.startMs)}</span>
        </time>
      ) : (
        <span className={column.when}>{SEASON_PUBLIC_WORDS.dateToCome}</span>
      )}
      <div className={column.match}>
        <span className={column.matchName}>
          {b.who}
          {cancelled && <span className={`${kit.chip} ${kit.chipNeutral}`}>{STATE_WORDS.cancelled}</span>}
        </span>
        {place && <span className={column.place}>{place}</span>}
        {movedFrom && <span className={column.place}>{P.movedWas(dayWords(orgDayKey(movedFrom)), clockOf(Date.parse(movedFrom)))}</span>}
      </div>
      {postponed ? (
        <span className={`${column.state} ${column.postponed}`}>{SEASON_PUBLIC_WORDS.postponed}</span>
      ) : b.result ? (
        <span className={column.state}>{b.result}</span>
      ) : movedFrom ? (
        <span className={column.state}><span className={`${kit.chip} ${kit.chipWarn}`}>{P.moved}</span></span>
      ) : null}
    </div>
  );
}
