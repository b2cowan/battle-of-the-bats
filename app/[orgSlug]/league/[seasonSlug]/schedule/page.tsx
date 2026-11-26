import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getDivisionsForSeason,
  getTeamsForSeason,
  getOrgPlaceNames,
} from '@/lib/db';
import { isPublicLeagueSeason, postponedLately, publicSeasonGames } from '@/lib/league-game-changes-server';
import { SCHEDULE_PUBLIC_WORDS as P } from '@/lib/league-schedule-words';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { orgDayKey, timesInZoneSentence } from '@/lib/timezone';
import { dayHeading, dayWords, weekRangeWords } from '@/lib/calendar-recipe';
import { clockOf, whereWords } from '@/lib/club-calendar-view';
import {
  SEASON_PUBLIC_WORDS, SEASON_SCHEDULE_WORDS, seasonCalendar, seasonWeeks, todayLineAt,
  type SeasonBooking, type SeasonWeek,
} from '@/lib/league-season-calendar';
import type { LeagueDivision } from '@/lib/types';
import column from '../../league-column.module.css';
import PublicPage from '@/components/public/PublicPage';
import PublicSectionHead from '@/components/public/PublicSectionHead';
import { ScheduleMatchup, type GameRowState, type MatchupSide } from '@/components/public/PublicGameRow';
import { sideResult } from '@/lib/public-game-row';
import { leagueCheckWindow, leagueGamePhase } from '@/lib/club-game-live';
import { GAMES_HOME_WORDS } from '@/lib/club-games-home';
import LeagueScoresRefresher from '@/components/public/LeagueScoresRefresher';
import scheduleStyles from '@/components/public/PublicSchedule.module.css';
import kit from '@/components/public/ClubKit.module.css';
import { ClubSponsoredBy } from '@/components/public/ClubSponsors';
import { divisionSponsorsFor } from '@/lib/club-sponsorships-server';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';
import parts from '@/components/public/PublicParts.module.css';

export const dynamic = 'force-dynamic';

// A draft season is hidden by this page, so the tab does not name it either.
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    const season = await getClubSeason(club.id, seasonSlug);
    return isPublicLeagueSeason(season) ? `${season.name} schedule` : null;
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
  if (!isPublicLeagueSeason(season)) notFound();

  const [divisions, teams, places] = await Promise.all([
    getDivisionsForSeason(season.id),
    getTeamsForSeason(season.id),
    getOrgPlaceNames(org.id),
  ]);
  const { games, published } = await publicSeasonGames(season, divisions);

  const activeDivision: LeagueDivision | null =
    divisions.find(d => d.id === divisionIdParam) ?? divisions[0] ?? null;
  // A draft division has no public games; one division only and still a draft reads the same.
  const coming = !!activeDivision && !published.has(activeDivision.id);
  // Board Ready Stage 6 (ask 1): the active division's sponsors, a quiet line under its tab. A failed read draws no line.
  // Started here, awaited beside K17's read below (neither waits on the other).
  const sponsorsRead = activeDivision ? divisionSponsorsFor(org.id, [activeDivision.id]).catch((): Record<string, never[]> => ({})) : null;

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
  const renderedAt = new Date();
  const nowMs = renderedAt.getTime();
  const today = orgDayKey(renderedAt.toISOString());
  const { earlier, ahead } = seasonWeeks(bookings, today);
  const hasGames = bookings.length + needsDate.length > 0;
  const teamName = new Map(teams.map(t => [t.id, t.name]));
  const nameOf = (id: string | null) => (id && teamName.get(id)) || 'A team';
  // K17 (Club Website Stage 2): "Needs a new date" moves to the top while it holds a game postponed in the last 7 days, so
  // a parent looking for this morning's game finds it first, not six weeks down. Otherwise it stays at the foot (shipped).
  const [sponsors, needsDateOnTop] = await Promise.all([
    sponsorsRead,
    !coming
      ? postponedLately(season.id, needsDate.flatMap(b => (b.source.kind === 'game' ? [b.source.game.id] : [])), renderedAt)
      : false,
  ]);
  const sponsoredBy = activeDivision ? sponsors?.[activeDivision.id] ?? [] : [];
  const needsDateSection = needsDate.length > 0 && (
    <section className={kit.section}>
      <PublicSectionHead title={SEASON_SCHEDULE_WORDS.needsDate} />
      <ul className={`${kit.list} ${parts.gameList}`}>
        {needsDate.map(b => <GameRow key={b.key} booking={b} nameOf={nameOf} nowMs={nowMs} />)}
      </ul>
    </section>
  );

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  // The club page column (club round C2 + C5): on the logo edge, 960 at most (it was 800), 24 between sections.
  return (
    <PublicPage frame="club">
      {/* G6: checks every 30 seconds while a game of the season is on today; draws nothing. */}
      <LeagueScoresRefresher orgSlug={orgSlug} seasonSlug={seasonSlug} renderedAt={renderedAt.toISOString()}
        window={leagueCheckWindow(games, nowMs)} />
      <div>
        <Link href={href(`/league/${seasonSlug}`)} className={kit.back}>
          ← {season.name}
        </Link>
        <h1 className={kit.pageName}>Schedule</h1>
      </div>

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

      {activeDivision && (
        <ClubSponsoredBy sponsors={sponsoredBy}
          label={divisions.length > 1 ? SPONSORSHIPS_WORDS.sponsoredBy : SPONSORSHIPS_WORDS.sponsoredByNamed(activeDivision.name)} />
      )}

      {coming ? (
        <div className={kit.empty}>{P.coming(activeDivision!.name)}. {P.comingHint}</div>
      ) : !hasGames ? (
        <div className={kit.empty}>{SEASON_PUBLIC_WORDS.noGames}</div>
      ) : (
        <div>
          <p className={column.zone}>{timesInZoneSentence()}</p>
          <div className={column.weeks}>
            {needsDateOnTop && needsDateSection}
            {earlier.length > 0 && (
              <details className={column.earlier}>
                <summary>{SEASON_SCHEDULE_WORDS.earlierWeeks(earlier.length)}</summary>
                <div className={column.weeks}>
                  {earlier.map(w => <Week key={w.monday} week={w} today={today} nameOf={nameOf} nowMs={nowMs} />)}
                </div>
              </details>
            )}
            {ahead.map(w => <Week key={w.monday} week={w} today={today} nameOf={nameOf} nowMs={nowMs} />)}
            {!needsDateOnTop && needsDateSection}
          </div>
        </div>
      )}
    </PublicPage>
  );
}

type NameOf = (teamId: string | null) => string;

/** A week: "Jun 14 – 20, 2027 · this week" as the section's heading row (R4), its games, and the today line in this week only. */
function Week({ week, today, nameOf, nowMs }: { week: SeasonWeek<SeasonBooking>; today: string; nameOf: NameOf; nowMs: number }) {
  const line = todayLineAt(week, today);
  const head = weekRangeWords(week.monday) + (line === null ? '' : ` · ${SEASON_SCHEDULE_WORDS.thisWeek}`);
  const todayLine = <li key="today" className={column.todayLine}>{dayHeading(today, today)}</li>;
  const rows = week.bookings.map(b => <GameRow key={b.key} booking={b} nameOf={nameOf} nowMs={nowMs} />);
  if (line !== null) rows.splice(line, 0, todayLine);
  return (
    <section className={kit.section}>
      <PublicSectionHead title={head} />
      <ul className={`${kit.list} ${parts.gameList}`}>{rows}</ul>
    </section>
  );
}

/**
 * One game on the standard's game row (Public page layout standard R6; club round C7, 2026-11-05): the one-line row on a
 * desk, stacked on a phone, read when · who · status — the time with its day under it (the tournament Schedule's time and
 * "when"), the away team first, then home, each owning its score once the game is final (the winner bold). The house
 * league keeps what it showed: the place on every game (its Schedule's own ruling, C10 — the tournament's all-games list
 * carries none), Cancelled and Postponed in the one pill set, and a game re-dated and sent "Moved" with the date families
 * heard. The division is not repeated: the division tabs above already say it.
 */
function GameRow({ booking: b, nameOf, nowMs }: { booking: SeasonBooking; nameOf: NameOf; nowMs: number }) {
  const game = b.source.kind === 'game' ? b.source.game : null;
  if (!game) return null; // a practice is never public: the page passes none
  const postponed = b.state === 'postponed';
  const cancelled = b.state === 'cancelled';
  const place = whereWords(b);
  // Moved (9d2·10): a game re-dated since families first heard, once the change was sent — the date they heard.
  const movedFrom = game.movedFrom && !postponed && !cancelled && !b.result ? game.movedFrom : null;
  // Final exactly when the house league has always said "Final h–a" (`resultWords`): completed, both scores in.
  const final = !!b.result && game.homeScore != null && game.awayScore != null;
  // Live (Club Website Stage 1, G7): the one live rule — inside its window and no final yet. House league has no running
  // score, so the line under the teams says when it comes; the green edge and the pill say "live" (R9).
  // A re-dated game on now reads live, as the home says it (its Moved pill and "was …" line come back once it is over).
  const live = !cancelled && !postponed && !final && leagueGamePhase(game, nowMs) === 'live';
  const state: GameRowState | undefined =
    cancelled ? 'cancelled' : postponed ? 'postponed' : final ? 'final' : live ? 'live' : movedFrom ? 'moved' : undefined;
  const side = (teamId: string | null, score: number | null, other: number | null): MatchupSide => ({
    name: nameOf(teamId),
    score: final ? score : null,
    result: final ? sideResult(score, other) : null,
  });
  const dated = !!game.scheduledAt;
  return (
    <li className={live ? scheduleStyles.edge : undefined}>
      <ScheduleMatchup
        time={dated ? clockOf(b.startMs) : SEASON_PUBLIC_WORDS.dateToCome}
        round={dated ? (postponed ? SEASON_PUBLIC_WORDS.was(dayWords(b.day)) : dayWords(b.day)) : null}
        division={null}
        state={state}
        keepTime
        sides={[side(game.awayTeamId, game.awayScore, game.homeScore), side(game.homeTeamId, game.homeScore, game.awayScore)]}
        noScore={live ? GAMES_HOME_WORDS.scoreAfter
          : movedFrom ? P.movedWas(dayWords(orgDayKey(movedFrom)), clockOf(Date.parse(movedFrom))) : undefined}
        place={place ? { text: place } : undefined}
      />
    </li>
  );
}
