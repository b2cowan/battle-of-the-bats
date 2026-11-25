/**
 * lib/club-games-home.ts — WHAT THE CLUB HOME'S GAMES PART SAYS (Club Website Stage 1, Pass 2; drawing tabs 2 and 3; asks
 * G1–G5, G7, G9, G11 ruled 2026-11-25). Pure: it shapes the one games read (`lib/club-games-read.ts`, whose answer the
 * page renders first and the 30-second check replaces) into the bands the home draws. No read, no clock of its own (the
 * caller passes `now`), no React — so the page's render and every check say the same thing, and a plain test pins it.
 *
 *   · The title (G1, G2): "Today" with the date while the club has a game today (one not being played counts: a family
 *     who saw it this morning learns what happened to it); "Latest results" when nothing is today but a result is in the
 *     last two days; otherwise null — the part is absent.
 *   · The bands, by time, never by program: Live now → Later today → Latest results → Not being played today.
 *   · The order inside a band (G4): a tournament first (one row, its counts: Stage 0 A3), then by start (newest first in
 *     Latest results), at the same start house league by division from the youngest, then rep, then by place.
 *   · Four rows a band (G4), then one row "N more …" that opens the rest in place; Not being played today is never capped
 *     (more than three house league games called off on a day are already one row per season).
 *   · A capped band on a game day ends the part with each season's own schedule ("{season} schedule · Today, by division").
 *
 * The words are /marketing's (plan §10, Stage 1). Times only through `formatTime`; days through the shared helpers.
 */
import { formatTime, pluralize } from './utils.ts';
import { formatShortWeekdayDate, orgDayKey, zonedWallClockToUtc } from './timezone.ts';
import { orgClock } from './club-board-view.ts';
import { clubGameWindow, LIVE_NOW } from './club-game-live.ts';
import type { ClubGameRow, ClubGamesRead, ClubTournamentDay } from './club-games-read';

/** Rows a band shows before "N more" (G4). */
export const BAND_ROWS = 4;

export const GAMES_HOME_WORDS = {
  today: 'Today',
  latest: 'Latest results',
  live: LIVE_NOW,
  later: 'Later today',
  off: 'Not being played today',
  /** House league inside its window: its score arrives as a final, so the row says when (G7). */
  scoreAfter: 'Score after the game',
  noScoreYet: 'No score yet',
  movedTo: (day: string) => `Moved to ${day}`,
  scheduleDoor: (season: string) => `${season} schedule`,
  scheduleDoorSub: 'Today, by division',
  houseLeague: (division: string) => `House league · ${division}`,
  rep: 'Rep',
  repAway: 'Rep · away',
  failTitle: 'Games',
  failLead: "Games can't be shown right now.",
  failLink: 'The house league schedule',
  failTail: 'and each team\'s page still have them.',
  /** A club with no house league schedule to point at (/marketing 2026-11-25). */
  failNoLeague: "Each team's page still has them.",
  tryAgain: 'Try again',
  /** The Tournaments card's word on a tournament day, said instead of "Live now" (G9). */
  gamesToday: 'Games today',
} as const;

export type GamesBandKey = 'live' | 'later' | 'results' | 'off';

export type HomeGameItem =
  | { kind: 'game'; key: string; row: ClubGameRow }
  | { kind: 'tournament'; key: string; name: string; path: string; sub: string }
  | { kind: 'calledOff'; key: string; title: string; sub: string; path: string };

export interface HomeGamesBand {
  key: GamesBandKey;
  title: string;
  /** Every row, in order; the page shows the first `BAND_ROWS` until "more" is opened. */
  items: HomeGameItem[];
  /** The row that opens the rest, or null when the band fits. */
  more: { title: string; sub: string } | null;
}

export interface HomeGamesView {
  title: string;
  /** "Sat, Nov 28" beside "Today"; null under "Latest results" (each row carries its own day). */
  date: string | null;
  /** The club's day the view was made for (YYYY-MM-DD): a row on it says its time, any other its day. */
  today: string;
  bands: HomeGamesBand[];
  /** Each season's own schedule, when a band on a game day is capped (G4). */
  doors: { key: string; path: string; title: string; sub: string }[];
}

/** "9:00 a.m." for a game on `today`, else its day ("Thu, Nov 26"): the row's head line (tab 3). */
export function gameHeadTime(row: Pick<ClubGameRow, 'day' | 'startsAt'>, today: string): string {
  if (row.day !== today) return formatShortWeekdayDate(row.day);
  return row.startsAt ? orgClock(row.startsAt) : '';
}

/** The failure line in one piece, for a club with no house league schedule to link. */
export const failLine = () => `${GAMES_HOME_WORDS.failLead} ${GAMES_HOME_WORDS.failNoLeague}`;

/** The row's context line: "House league · U11", "Rep", "Rep · away" (the team line already names the team, G5). */
export function gameContext(row: Pick<ClubGameRow, 'program' | 'group' | 'homeAway'>): string {
  if (row.program === 'league') return GAMES_HOME_WORDS.houseLeague(row.group);
  return row.homeAway === 'away' ? GAMES_HOME_WORDS.repAway : GAMES_HOME_WORDS.rep;
}

/** A house league season's schedule page (the season's own; a rep row has none). */
const seasonSchedulePath = (row: ClubGameRow): string | null => (row.seasonSlug ? `/league/${row.seasonSlug}/schedule` : null);

const startMs = (row: ClubGameRow) => (row.startsAt ? Date.parse(row.startsAt) : Date.parse(`${row.day}T12:00:00Z`));

/** G4's order for two game rows at the same start: house league by division from the youngest, then rep, then place. */
function sameStartOrder(a: ClubGameRow, b: ClubGameRow): number {
  if (a.program !== b.program) return a.program === 'league' ? -1 : 1;
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.group !== b.group) return a.group.localeCompare(b.group);
  return (a.place ?? '').localeCompare(b.place ?? '');
}

const byStart = (newestFirst: boolean) => (a: ClubGameRow, b: ClubGameRow) => {
  const d = startMs(a) - startMs(b);
  if (d !== 0) return newestFirst ? -d : d;
  return sameStartOrder(a, b);
};

/** "Sat, Nov 28" or "Sat, Nov 28 – Sun, Nov 29" over a tournament's days in the window. */
function dayRange(days: string[]): string {
  const sorted = [...days].sort();
  const first = formatShortWeekdayDate(sorted[0]);
  return sorted.length > 1 ? `${first} – ${formatShortWeekdayDate(sorted[sorted.length - 1])}` : first;
}

/** Where one tournament's row sits and what its second line says (tab 3, "A tournament"). Null: no row. */
export function tournamentItem(t: ClubTournamentDay, today: string, nowMs: number): { band: Exclude<GamesBandKey, 'off'>; sub: string } | null {
  const d = t.days[today];
  if (d && d.games > 0) {
    const games = `${pluralize(d.games, 'game')} today`;
    if (d.live > 0) return { band: 'live', sub: `${d.live} live now · ${games}` };
    const at = (time: string | null) => (time ? zonedWallClockToUtc(today, time.slice(0, 5)) : null);
    const firstIso = at(d.first);
    if (firstIso && nowMs < Date.parse(firstIso)) return { band: 'later', sub: `${games} · first at ${formatTime(d.first!)}` };
    if (d.final >= d.games) return { band: 'results', sub: `${games} · all final` };
    const lastIso = at(d.last);
    const lastWindow = lastIso ? clubGameWindow({ startsAt: lastIso }) : null;
    // "0 of 5 games final" read as a fault (/marketing 2026-11-25): with nothing entered, say that.
    const progress = d.final > 0 ? `${d.final} of ${pluralize(d.games, 'game')} final` : null;
    if (lastWindow && nowMs >= lastWindow.endMs) return { band: 'results', sub: progress ?? `${games} · no results yet` };
    // Between rounds: nothing on, more to come — where the day stands, once a game is final.
    return { band: 'later', sub: progress ?? games };
  }
  // No game today: a tournament that played in the last two days is one results row, with its count (A3).
  const earlier = Object.entries(t.days).filter(([day, x]) => day < today && x.final > 0);
  if (earlier.length === 0) return null;
  const results = earlier.reduce((n, [, x]) => n + x.final, 0);
  return { band: 'results', sub: `${pluralize(results, 'result')} · ${dayRange(earlier.map(([day]) => day))}` };
}

/** The row that opens the rest of a band: how many, and what they are (the programs, or the days of results). */
function moreRow(key: GamesBandKey, rest: HomeGameItem[]): { title: string; sub: string } {
  const n = rest.length;
  if (key === 'results') {
    const days = [...new Set(rest.flatMap(i => (i.kind === 'game' ? [i.row.day] : [])))];
    return { title: `${n} more ${n === 1 ? 'result' : 'results'}`, sub: days.map(formatShortWeekdayDate).join(' · ') };
  }
  const league = rest.filter(i => i.kind === 'game' && i.row.program === 'league').length;
  const rep = rest.filter(i => i.kind === 'game' && i.row.program === 'rep').length;
  const tournaments = rest.filter(i => i.kind === 'tournament').length;
  const sub = [
    tournaments ? pluralize(tournaments, 'tournament') : null,
    league ? `${league} house league` : null,
    rep ? `${rep} rep` : null,
  ].filter(Boolean).join(' · ');
  return { title: `${n} more ${key === 'live' ? 'live now' : 'later today'}`, sub };
}

/** More than this many house league games called off in one season on one day become one row (tab 2, Rained out). */
const CALLED_OFF_AS_ONE = 3;

function calledOffItems(rows: ClubGameRow[]): HomeGameItem[] {
  const items: HomeGameItem[] = [];
  const bySeason = new Map<string, ClubGameRow[]>();
  for (const r of rows) {
    const path = seasonSchedulePath(r);
    if (path) bySeason.set(path, [...(bySeason.get(path) ?? []), r]);
  }
  const folded = new Set<ClubGameRow>();
  for (const [path, games] of bySeason) {
    if (games.length <= CALLED_OFF_AS_ONE) continue;
    games.forEach(g => folded.add(g));
    const states = new Set(games.map(g => g.state));
    // One kind says its word ("postponed", "cancelled"); a mix, or a game moved away, is "not being played".
    const only = states.size === 1 ? [...states][0] : null;
    const how = only === 'postponed' || only === 'cancelled' ? only : 'not being played';
    const places = new Set(games.map(g => g.place).filter(Boolean));
    const first = [...games].sort(byStart(false))[0];
    const clock = first.startsAt ? orgClock(first.startsAt) : '';
    items.push({
      kind: 'calledOff',
      key: `off|${path}`,
      title: `${games.length} house league games ${how}`,
      sub: [first.seasonName, places.size === 1 ? [...places][0] : null, clock ? `from ${clock}` : null]
        .filter(Boolean).join(' · '),
      path,
    });
  }
  for (const r of [...rows].sort(byStart(false))) if (!folded.has(r)) items.push({ kind: 'game', key: r.key, row: r });
  return items;
}

/** Which band a game row sits in on `today`, or null — not shown. */
function bandOf(r: ClubGameRow, today: string): GamesBandKey | null {
  const isToday = r.day === today;
  if (r.state === 'final') return 'results';
  // A game still on is Live now whatever day it began (an evening game running past midnight).
  if (r.state === 'live') return 'live';
  if (!isToday) return null;
  if (r.state === 'coming') return 'later';
  if (r.state === 'postponed' || r.state === 'cancelled' || r.state === 'moved') return 'off';
  // A house league game past its window with no score stays in its slot saying so (G7); a rep game with nothing saved
  // says nothing (a rep coach need not keep a score). Only today: a day-old gap is the schedule's to show.
  return r.state === 'noScore' && r.program === 'league' ? 'results' : null;
}

/**
 * The games part, or null when it is absent (G1). `now` is the moment the read was made for (its `asOf`) so a held check
 * and the page say the same; the tournament's "first at" and "all final" turn on it.
 */
export function homeGamesView(read: Pick<ClubGamesRead, 'today' | 'rows' | 'tournaments'>, now: number): HomeGamesView | null {
  const { today } = read;
  const rows: Record<GamesBandKey, ClubGameRow[]> = { live: [], later: [], results: [], off: [] };
  const items: Record<Exclude<GamesBandKey, 'off'>, HomeGameItem[]> = { live: [], later: [], results: [] };

  for (const r of read.rows) {
    const band = bandOf(r, today);
    if (band) rows[band].push(r);
  }

  let anyToday = rows.live.length + rows.later.length + rows.off.length > 0 || rows.results.some(r => r.day === today);
  // Tournaments first in their band (A3): the most games, one row.
  for (const t of read.tournaments) {
    const placed = tournamentItem(t, today, now);
    if (!placed) continue;
    if (t.days[today]?.games) anyToday = true;
    items[placed.band].push({ kind: 'tournament', key: `t|${t.path}`, name: t.name, path: t.path, sub: placed.sub });
  }
  for (const band of ['live', 'later', 'results'] as const) {
    items[band].push(...[...rows[band]].sort(byStart(band === 'results'))
      .map((row): HomeGameItem => ({ kind: 'game', key: row.key, row })));
  }

  const capped = (key: Exclude<GamesBandKey, 'off'>, title: string): HomeGamesBand | null => {
    const all = items[key];
    if (all.length === 0) return null;
    return { key, title, items: all, more: all.length > BAND_ROWS ? moreRow(key, all.slice(BAND_ROWS)) : null };
  };

  if (anyToday) {
    const bands = [
      capped('live', GAMES_HOME_WORDS.live),
      capped('later', GAMES_HOME_WORDS.later),
      capped('results', GAMES_HOME_WORDS.latest),
      rows.off.length ? { key: 'off' as const, title: GAMES_HOME_WORDS.off, items: calledOffItems(rows.off), more: null } : null,
    ].filter((b): b is HomeGamesBand => !!b);
    // A capped band ends the part with each season's own schedule, opening on today (G4). One row per season with a
    // game today, in the order the seasons first appear.
    const doors: HomeGamesView['doors'] = [];
    if (bands.some(b => b.more)) {
      for (const r of read.rows) {
        const path = r.day === today ? seasonSchedulePath(r) : null;
        if (path && r.seasonName && !doors.some(d => d.path === path)) {
          doors.push({ key: `door|${path}`, path, title: GAMES_HOME_WORDS.scheduleDoor(r.seasonName), sub: GAMES_HOME_WORDS.scheduleDoorSub });
        }
      }
    }
    return { title: GAMES_HOME_WORDS.today, date: formatShortWeekdayDate(today), today, bands, doors };
  }

  const latest = capped('results', GAMES_HOME_WORDS.latest);
  if (!latest) return null;
  // Titled "Latest results" itself, so the band carries no second heading of the same words.
  return { title: GAMES_HOME_WORDS.latest, date: null, today, bands: [{ ...latest, title: '' }], doors: [] };
}

/** The tournaments with games today, by path — the Tournaments card says "Games today" for these (G9). */
export function tournamentsWithGamesToday(read: Pick<ClubGamesRead, 'today' | 'tournaments'>): Set<string> {
  return new Set(read.tournaments.filter(t => (t.days[read.today]?.games ?? 0) > 0).map(t => t.path));
}

/** The moved game's new day for its line ("Moved to Sat, Dec 5"), or null — the Moved pill alone (tab 3). */
export function movedLine(row: Pick<ClubGameRow, 'movedTo'>): string | null {
  return row.movedTo ? GAMES_HOME_WORDS.movedTo(formatShortWeekdayDate(orgDayKey(row.movedTo))) : null;
}
