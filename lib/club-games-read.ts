import 'server-only';
import { publicClubRefusal, type PublicClubAccessOrg } from './public-club-access';
import { publicLeagueGamesBetween } from './league-game-changes-server';
import { getPublicTeamGamesBetween } from './public-team-schedule';
import { publicTournamentGamesBetween } from './public-tournament-data';
import { gameDayCheckWindow, isoWindow, leagueGamePhase } from './club-game-live';
import { publicGameState } from './game-status';
import { addCalendarDays, orgDayKey, tournamentToday, zonedWallClockToUtc } from './timezone';
import type { Organization } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE GAMES READ (Club Website Stage 1, Pass 1; drawing tab 7). What the club home's games part shows, and what its
 * 30-second check and the house league pages' check fetch: a club's games for today and the two days before (G2).
 *
 * Each program's games come through THAT program's own public rule, called and never copied (Stage 0's lesson D1: a draft
 * schedule reached families once):
 *   · house league — `publicLeagueGamesBetween` (not a draft season, published divisions, as families last heard them,
 *     the window applied after that view);
 *   · rep teams — `getPublicTeamGamesBetween` (Public only, the club not cancelled, the family layer, a live season;
 *     games only: never a practice, a multi-day tournament entry or a game copied from a tournament);
 *   · tournaments — `publicTournamentGamesBetween` (public status, the Schedule page on, published divisions, a held-back
 *     opponent blanked). The club's tournaments come ONLY this way: a copy on a rep team can be stale.
 * The rep rule does not ask whether the club's site is open or its plan carries rep teams (a team page gets that from its
 * own door), so this read asks the site and plan check, once per program, BEFORE calling a rule — and calls no rule a
 * switch or plan says no to. The staff calendar, which holds every game with none of these rules, never feeds it.
 *
 * It returns its OWN short list of fields, never a stored game: no notes, no score-entry details, no internal id.
 * ⚠ ALL OR NOTHING (G11): any program failing throws, so a visitor never sees a partial day as if it were the whole day.
 * Guarded by tests/unit/club-website-stage1-reads-guard.test.ts (its imports are an exact list; it reads no table).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Days the read reaches back: today and the two before (G2). */
export const CLUB_GAMES_DAYS_BACK = 2;

/**
 * Where a game stands on the home. `live` is the one live rule (G7): a house-league game reads "Score after the game",
 * a rep game the coach's running score. `noScore`: a house-league game whose window has passed with no score yet.
 * `moved`: a house-league game moved off this day (it says where to).
 */
export type ClubGameState = 'coming' | 'live' | 'final' | 'noScore' | 'postponed' | 'cancelled' | 'moved';

export interface ClubGameRow {
  /** Stable for the same game between a page and its check; made of what the row shows, never an internal id. */
  key: string;
  program: 'league' | 'rep';
  /** The club day this game is on, as families last heard it (YYYY-MM-DD). */
  day: string;
  /** Its start as families last heard it (an instant), or null when it has no time. Display formats it (formatTime). */
  startsAt: string | null;
  /** Its scheduled end (an instant), or null — the live window's end and the check's (G6, G7). */
  endsAt: string | null;
  /** House league: the division's name. Rep: the team's name. */
  group: string;
  /** House league: the division's place in its season, youngest first (G4's order); rep: 0. */
  groupOrder: number;
  /** House league: home team, away team. Rep: the club's team, its opponent. */
  home: string;
  away: string;
  /** Rep only: home, away or neutral (G5 shows away games, with "away"). */
  homeAway: 'home' | 'away' | 'neutral' | null;
  /** Where, as typed or as the club's place is named; null → the place line is left out. */
  place: string | null;
  /** The place's street address as the club or coach entered it — ONLY on a game that is live, the one row that offers
   *  Directions (tab 3: "only Live now keeps Directions"; "Directions only when the place has an address"). Every other
   *  row carries null, so the public answer holds no more addresses than the page draws. */
  address: string | null;
  state: ClubGameState;
  /** Both sides' scores (home first, as `home`/`away`), or null. A live rep game's is the coach's running score. */
  score: { home: number; away: number } | null;
  /** A moved game's new start (an instant), else null. */
  movedTo: string | null;
  /** The page it opens, inside the club's site (house league: the season's schedule on this division; rep: the team's
   *  page). The page adds the club's own address (`orgHref`), so one answer serves either web address. */
  path: string;
  /** House league: the season's name (for "{season} schedule · Today, by division"); rep: null. */
  seasonName: string | null;
  /** House league: the season's address name, which a house league page's check filters on; rep: null. */
  seasonSlug: string | null;
  /** A result was saved: a house league final, or a rep coach's End game. A rep game past its window with a score and
   *  no result is `final` but not decided — it reads as its score alone, never a winner nobody saved (G7, Part 0). */
  decided: boolean;
}

/** One of the club's tournaments with public games in the window: ONE row on the home, with its counts (Stage 0 A3). */
export interface ClubTournamentDay {
  name: string;
  /** The tournament's Overview, inside the club's site (the page adds the club's address). */
  path: string;
  /** Per club day in the window: games, live now, final, and the first and last games' starts (as stored, "HH:MM:SS";
   *  display formats them with formatTime; the last one closes the check window). A game whose submitted score waits
   *  for the organizer's confirmation is counted in `games`, in neither `live` nor `final`. */
  days: Record<string, { games: number; live: number; final: number; first: string | null; last: string | null }>;
}

export interface ClubGamesRead {
  /** When this was read (an instant): a check older than what a page already shows is ignored (`isNewerGamesRead`, lib/club-game-live.ts). */
  asOf: string;
  today: string;
  /** The window's club days, newest first: today, then the two before. */
  days: string[];
  rows: ClubGameRow[];
  tournaments: ClubTournamentDay[];
  /** When a page checks again today (G6): half an hour before the first game to the end of the last window; null → no
   *  check today. Instants. */
  checkWindow: { from: string; to: string } | null;
}

export type ClubGamesOrg = PublicClubAccessOrg & Pick<Organization, 'id' | 'slug' | 'requireScoreFinalization'>;

/** The window as instants: the start of the day two days back, to the start of tomorrow (club time). */
export function clubGamesWindow(today: string): { fromIso: string; toIso: string; days: string[] } {
  const first = addCalendarDays(today, -CLUB_GAMES_DAYS_BACK);
  const fromIso = zonedWallClockToUtc(first, '00:00');
  const toIso = zonedWallClockToUtc(addCalendarDays(today, 1), '00:00');
  if (!fromIso || !toIso) throw new Error(`The games window could not be read for ${today}`);
  const days = Array.from({ length: CLUB_GAMES_DAYS_BACK + 1 }, (_, i) => addCalendarDays(today, -i));
  return { fromIso, toIso, days };
}

const rowKey = (r: Omit<ClubGameRow, 'key'>) => [r.program, r.startsAt ?? r.day, r.group, r.home, r.away].join('|');

export async function readClubGames(
  org: ClubGamesOrg,
  options: { now?: Date } = {},
): Promise<ClubGamesRead> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const today = tournamentToday(now);
  const { fromIso, toIso, days } = clubGamesWindow(today);
  const empty: ClubGamesRead = { asOf: now.toISOString(), today, days, rows: [], tournaments: [], checkWindow: null };
  if (publicClubRefusal(org, 'home')) return empty;

  // The site and plan check, once per program, BEFORE its rule: a rule a switch or plan says no to is not called.
  const leagueOn = !publicClubRefusal(org, 'league');
  const teamsOn = !publicClubRefusal(org, 'teams');
  const [league, rep, tournaments] = await Promise.all([
    leagueOn ? publicLeagueGamesBetween(org.id, fromIso, toIso) : null,
    teamsOn ? getPublicTeamGamesBetween({ org, fromIso, toIso, now: nowMs }) : null,
    // Tournaments answer to their own rule, never the site's switch (every tournament page's rule).
    publicTournamentGamesBetween(org, days[days.length - 1], today),
  ]);

  const rows: ClubGameRow[] = [];
  const windowFrom = Date.parse(fromIso), windowTo = Date.parse(toIso);
  const inWindow = (iso: string | null) => !!iso && Date.parse(iso) >= windowFrom && Date.parse(iso) < windowTo;

  for (const s of league?.seasons ?? []) {
    const division = new Map(s.divisions.map((d, i) => [d.id, { name: d.name, order: i }]));
    for (const g of s.games) {
      const d = division.get(g.divisionId);
      if (!d) continue;
      const moved = !inWindow(g.scheduledAt) && inWindow(g.movedFrom);
      const phase = leagueGamePhase(g, nowMs);
      const venue = g.orgVenueId ? league!.places.venues.get(g.orgVenueId) : undefined;
      const facility = g.orgVenueFacilityId ? league!.places.facilities.get(g.orgVenueFacilityId) : undefined;
      const row = {
        program: 'league' as const,
        day: orgDayKey(moved ? g.movedFrom : g.scheduledAt),
        startsAt: moved ? g.movedFrom : g.scheduledAt,
        endsAt: moved ? null : g.endsAt,
        group: d.name,
        groupOrder: d.order,
        home: s.teamName.get(g.homeTeamId) ?? 'A team',
        away: s.teamName.get(g.awayTeamId) ?? 'A team',
        homeAway: null,
        place: venue ? (facility ? `${venue.name} · ${facility}` : venue.name) : (g.location?.trim() || null),
        address: phase === 'live' && !moved ? venue?.address?.trim() || null : null,
        // A game moved off this day and then called off says so (the day it left is kept on it for good).
        state: phase === 'cancelled' || phase === 'postponed' || !moved ? phase : 'moved' as const,
        score: phase === 'final' ? { home: g.homeScore!, away: g.awayScore! } : null,
        movedTo: moved ? g.scheduledAt : null,
        path: `/league/${s.season.slug}/schedule?d=${encodeURIComponent(g.divisionId)}`,
        seasonName: s.season.name,
        seasonSlug: s.season.slug,
        decided: phase === 'final',
      };
      rows.push({ key: rowKey(row), ...row });
    }
  }

  for (const { team, entry } of rep?.games ?? []) {
    // The rep rule already decided live and over (`repEntryState`, the team page's own facts): a running score is live;
    // over is End game, or a score whose window has passed; past its window with nothing saved, a result still owed.
    const state: ClubGameState = entry.status === 'cancelled' ? 'cancelled'
      : entry.live ? 'live'
        : entry.completed ? 'final'
          : Date.parse(entry.startsAt) <= nowMs ? 'noScore'
            : 'coming';
    const row = {
      program: 'rep' as const,
      day: orgDayKey(entry.startsAt),
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      group: team.name,
      groupOrder: 0,
      home: team.name,
      away: entry.opponent?.trim() || entry.name || '',
      homeAway: entry.homeAway,
      place: entry.location?.trim() || null,
      address: state === 'live' ? entry.locationAddress?.trim() || null : null,
      state,
      score: entry.hasScore && entry.teamScore !== null && entry.opponentScore !== null
        ? { home: entry.teamScore, away: entry.opponentScore } : null,
      movedTo: null,
      path: `/teams/${team.slug}`,
      seasonName: null,
      seasonSlug: null,
      decided: entry.result !== null,
    };
    rows.push({ key: rowKey(row), ...row });
  }

  const tournamentDays: ClubTournamentDay[] = tournaments.map(t => {
    const byDay: ClubTournamentDay['days'] = {};
    for (const g of t.games) {
      if (!g.date || g.status === 'cancelled') continue;
      const day = (byDay[g.date] ??= { games: 0, live: 0, final: 0, first: null, last: null });
      const state = publicGameState(g, t.requireFinalization, now);
      day.games += 1;
      if (state === 'live') day.live += 1;
      if (state === 'final') day.final += 1;
      if (g.time && (!day.first || g.time < day.first)) day.first = g.time;
      if (g.time && (!day.last || g.time > day.last)) day.last = g.time;
    }
    return { name: t.tournament.name, path: `/${t.tournament.slug}`, days: byDay };
  });

  // Today's timed games, every program, decide when a page checks again (a game postponed, cancelled or moved away
  // keeps no window). A tournament's last game runs the platform's booking length (its own length is the tournament's).
  const played = rows.filter(r => r.day === today && r.state !== 'cancelled' && r.state !== 'postponed' && r.state !== 'moved');
  const tournamentEnds = tournamentDays.flatMap(t => {
    const d = t.days[today];
    return d?.first && d.last ? [
      { startsAt: zonedWallClockToUtc(today, d.first), endsAt: null },
      { startsAt: zonedWallClockToUtc(today, d.last), endsAt: null },
    ] : [];
  });
  const check = gameDayCheckWindow([...played, ...tournamentEnds]);

  return {
    asOf: now.toISOString(),
    today,
    days,
    rows,
    tournaments: tournamentDays,
    checkWindow: isoWindow(check),
  };
}
