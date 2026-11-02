/**
 * league-standings.ts — A HOUSE-LEAGUE DIVISION'S TABLE, AND THE WORDS THAT EXPLAIN IT (House League Stage 9e-1, rulings
 * 9e·2–9e·6; words HOUSE_LEAGUE_STAGE9E_COPY.md Part A, §1–§4).
 *
 * ⚖ ONE RULE, READ BY EVERY SURFACE: the public standings page, the club's admin table, its export and the coach's line all
 * rank through `rankStandings`, and the "How the table is ranked" box is built from the same `rules` it sorts by, so the
 * words and the order cannot disagree (9e·2: the rules come from the season's sport and are not a setting).
 *
 *   - A game COUNTS once it is completed AND both scores are in (`gameCounts`). A completed game with a missing score used
 *     to read as 0–0; it counts for nothing now, and the game PATCH refuses to make one (Part 3).
 *   - Points: the sport's win and draw points (2 and 1 for ball). Teams level on points form a group.
 *   - A group of EXACTLY TWO is split by the counted games between those two (more wins ranks first; equal or none played
 *     is undecided). Three or more skip that step (a head-to-head circle settles nothing).
 *   - Then run differential, then runs for. Still level: a SHARED place ("T-3, T-3, 5"). No coin, and never the order the
 *     teams were created in (9e·3).
 *   - No counted game in the division: every team A–Z, no place (9e·4) — a table that ranks nothing shows nothing ranked.
 *
 * Pure and client-safe. Tested in tests/unit/league-standings.test.ts.
 */
import { getSportPack, type SportPack } from './sports';
import { ordinal } from './league-signup';
import { joinWithAnd, pluralize, possessive } from './utils';
import type { LeagueTeam } from './types';

export interface StandingsGame {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

/** A game counts in the standings once it is completed and both scores are in — the one definition (9e-1). */
export const gameCounts = (g: Pick<StandingsGame, 'status' | 'homeScore' | 'awayScore'>): boolean =>
  g.status === 'completed' && g.homeScore != null && g.awayScore != null;

export interface StandingsRow<T> {
  team: T;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;
  runsFor: number;
  runsAgainst: number;
  runDifferential: number;
  /** 1-based; a shared place repeats ("T-3, T-3") and the next takes the place after. Null before the first counted game. */
  place: number | null;
  /** Shares its place with another team. */
  tied: boolean;
  /** The team has at least one counted game (else its cells read as dashes). */
  counted: boolean;
  /** The other teams that share this place, in table order. */
  levelWith: T[];
}

/** The steps after points, in the order the table applies them. */
export type StandingsStep = 'h2h' | 'rd' | 'rf';
export const STANDINGS_STEPS: readonly StandingsStep[] = ['h2h', 'rd', 'rf'];

/** The sport's column words: abbreviations for the heads, sentence-case names for the tooltips and the box. */
export interface StandingsLabels {
  sport: string;
  forAbbr: string;
  againstAbbr: string;
  diffAbbr: string;
  /** "Runs for" */
  forName: string;
  /** "Runs against" */
  againstName: string;
  /** "Run differential" */
  diffName: string;
}

export interface Standings<T> {
  rows: StandingsRow<T>[];
  /** At least one counted game in the division: the table ranks. */
  scored: boolean;
  labels: StandingsLabels;
  rules: { pointsPerWin: number; pointsPerDraw: number; steps: readonly StandingsStep[] };
}

/** A house-league division's table, as `computeStandings` reads it. */
export type LeagueStandings = Standings<LeagueTeam>;
export type LeagueStandingsRow = StandingsRow<LeagueTeam>;

/** "Runs For" → "Runs for": the pack's labels are Title Case, a sentence is not. */
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

export function standingsLabels(pack: SportPack): StandingsLabels {
  return {
    sport: pack.label,
    forAbbr: pack.score.forAbbr,
    againstAbbr: pack.score.againstAbbr,
    diffAbbr: pack.score.diffAbbr,
    forName: sentence(pack.score.for),
    againstName: sentence(pack.score.against),
    diffName: `${pack.score.unit} differential`,
  };
}

/**
 * The division's table. `sport` is the season's stored value, read through the pack (the PATCH stores any string, so an
 * unknown sport reads the neutral pack). Games of teams not in `teams` are ignored.
 */
export function rankStandings<T extends { id: string; name: string }>(
  teams: readonly T[], games: readonly StandingsGame[], sport: string | null | undefined,
): Standings<T> {
  const pack = getSportPack(sport);
  const ids = new Set(teams.map(t => t.id));
  const counted = games.filter(g => gameCounts(g) && ids.has(g.homeTeamId) && ids.has(g.awayTeamId));
  const rules = { pointsPerWin: pack.pointsPerWin, pointsPerDraw: pack.pointsPerDraw, steps: STANDINGS_STEPS };
  const labels = standingsLabels(pack);

  const rows: StandingsRow<T>[] = teams.map(team => {
    let wins = 0, losses = 0, ties = 0, runsFor = 0, runsAgainst = 0;
    for (const g of counted) {
      const home = g.homeTeamId === team.id;
      if (!home && g.awayTeamId !== team.id) continue;
      const tf = (home ? g.homeScore : g.awayScore)!;
      const ta = (home ? g.awayScore : g.homeScore)!;
      runsFor += tf;
      runsAgainst += ta;
      if (tf > ta) wins++;
      else if (tf < ta) losses++;
      else ties++;
    }
    const gamesPlayed = wins + losses + ties;
    return {
      team, gamesPlayed, wins, losses, ties,
      points: wins * pack.pointsPerWin + ties * pack.pointsPerDraw,
      runsFor, runsAgainst, runDifferential: runsFor - runsAgainst,
      place: null, tied: false, counted: gamesPlayed > 0, levelWith: [],
    };
  });

  const byName = (a: StandingsRow<T>, b: StandingsRow<T>) => a.team.name.localeCompare(b.team.name);
  if (counted.length === 0) return { rows: rows.sort(byName), scored: false, labels, rules };

  /** Wins of `a` over `b` in their counted games. */
  const winsOver = (a: string, b: string) => counted.reduce((n, g) => {
    if (g.homeTeamId === a && g.awayTeamId === b) return n + (g.homeScore! > g.awayScore! ? 1 : 0);
    if (g.awayTeamId === a && g.homeTeamId === b) return n + (g.awayScore! > g.homeScore! ? 1 : 0);
    return n;
  }, 0);
  const byScores = (a: StandingsRow<T>, b: StandingsRow<T>) =>
    b.runDifferential - a.runDifferential || b.runsFor - a.runsFor;

  // Level groups by points, best first; each group split into places (an array of rows per place).
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  const places: StandingsRow<T>[][] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j < sorted.length && sorted[j].points === sorted[i].points) j++;
    const group = sorted.slice(i, j);
    i = j;
    if (group.length === 2) {
      const [a, b] = group;
      const ab = winsOver(a.team.id, b.team.id), ba = winsOver(b.team.id, a.team.id);
      if (ab !== ba) { places.push(...(ab > ba ? [[a], [b]] : [[b], [a]])); continue; }
    }
    group.sort((a, b) => byScores(a, b) || byName(a, b));
    for (const row of group) {
      const last = places[places.length - 1];
      if (last && group.includes(last[0]) && byScores(last[0], row) === 0) last.push(row);
      else places.push([row]);
    }
  }

  const out: StandingsRow<T>[] = [];
  for (const shared of places) {
    const place = out.length + 1;
    for (const row of shared) {
      out.push({
        ...row, place, tied: shared.length > 1,
        levelWith: shared.filter(r => r !== row).map(r => r.team),
      });
    }
  }
  return { rows: out, scored: true, labels, rules };
}

/** The record as one cell: "4-1-0". */
export const recordWords = (r: Pick<StandingsRow<unknown>, 'wins' | 'losses' | 'ties'>) => `${r.wins}-${r.losses}-${r.ties}`;

/** "+19", "0", "−7" (a true minus sign). */
export const diffWords = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/**
 * EVERY STANDINGS STRING (copy Part A §1–§4, accepted by the owner 2026-11-01 incl. §2 Option B "Level with"). One place,
 * so a word the owner changes is one edit. The switch's read words (`switch.yes` / `switch.no`) are the build's own.
 */
export const STANDINGS_WORDS = {
  // §1.1 the table
  title: 'Standings',
  col: { rank: '#', team: 'Team', gp: 'GP', w: 'W', l: 'L', t: 'T', pts: 'Pts', record: 'W-L-T' },
  tip: {
    gp: 'Games played', w: 'Wins', l: 'Losses', t: 'Ties', pts: 'Points', record: 'Wins-losses-ties',
    diff: (l: StandingsLabels) => `${l.diffName} (${l.forName.toLowerCase()} minus ${l.againstName.toLowerCase()})`,
    dash: 'No games scored yet',
  },
  /** The place cell: "3", or "T-3" for a shared place. */
  place: (place: number, tied: boolean) => (tied ? `T-${place}` : String(place)),
  /** The place cell's tooltip for a shared place: "Tied for 3rd". */
  placeTip: (place: number) => `Tied for ${ordinal(place)}`,
  dash: '–',
  swipe: (l: StandingsLabels) => `Swipe the table for GP, ${l.forAbbr} and ${l.againstAbbr}.`,

  // §1.2 the ranking box
  rank: {
    title: 'How the table is ranked',
    points: (win: number, draw: number) => `A win is ${pluralize(win, 'point')}, a tie ${draw}, a loss 0. Teams level on points are ordered by:`,
    step: (step: StandingsStep, l: StandingsLabels) =>
      step === 'h2h' ? 'The game between them, when exactly two teams are level'
      : step === 'rd' ? `${l.diffName} (${l.diffAbbr})`
      : `${l.forName} (${l.forAbbr})`,
    shared: 'Teams still level share a place, shown as “T-3”. A game counts once both scores are in.',
    short: (win: number, draw: number, l: StandingsLabels) =>
      `A win is ${pluralize(win, 'point')}, a tie ${draw}. Level on points: the game between them (when exactly two teams are level), then ${l.diffName.toLowerCase()}, then ${l.forName.toLowerCase()}. Still level: a shared place.`,
  },

  // §1.3 before there is a table (the public page)
  unpub: 'Standings show here once the schedule is up and the first scores are in.',
  noScore: 'Standings start with the first score. Teams are in alphabetical order until then.',
  /** "{Division} doesn’t keep standings. Its games are on the Schedule." — `link` is the linked word. */
  off: (division: string) => ({ before: `${division} doesn’t keep standings. Its games are on the `, link: 'Schedule', after: '.' }),
  offAll: { before: 'This league doesn’t show standings. The games are on the ', link: 'Schedule', after: '.' },
  noDivisions: 'No divisions have been set up for this season yet.',

  // §1.4 the score rule
  counts: 'A game counts once both scores are in.',

  // §2 the admin table
  admin: {
    levelCol: 'Level with',
    levelTip: (l: StandingsLabels) => `Level on points, ${l.diffName.toLowerCase()} and ${l.forName.toLowerCase()}`,
    levelCell: (names: readonly string[]) => joinWithAnd(names),
    rules: (sport: string) => `Ranked the way the public page ranks it. The rules come from the season’s sport (${sport}) and can’t be changed here.`,
    empty: 'No scores yet. Standings appear once a game has both scores.',
    noteUnpub: (division: string) => `Families can’t see this table yet: ${possessive(division)} schedule isn’t published.`,
    noteOff: (division: string) => `Families can’t see this table: standings are off for ${division}.`,
  },

  // §3 the switch
  switch: {
    label: 'Show standings',
    help: 'Turn off for a division that doesn’t rank teams. Families won’t see its table and coaches won’t see a standing line. You still see the table here.',
    on: (division: string) => `Standings are on for ${division}.`,
    off: (division: string) => `Standings are off for ${division}. Families can’t see them.`,
    /** The record's read row (a build word: the copy draws the switch, not the read). */
    yes: 'On',
    no: 'Off',
  },

  // §4 the coach's line
  coach: {
    heading: (shows: boolean) => (shows ? 'Scores and standings' : 'Scores'),
    none: 'Standings start with the first score.',
    link: 'See the standings',
  },
} as const;

/** The coach's standing line (copy §4), or null when it is absent. Pure: the page decides when to ask. */
export type CoachStandingLine = { kind: 'none'; text: string } | { kind: 'ranked'; text: string };

export function coachStandingLine<T extends { id: string }>(standings: Standings<T>, teamId: string): CoachStandingLine | null {
  const row = standings.rows.find(r => r.team.id === teamId);
  if (!row) return null;
  if (!standings.scored || row.place == null) return { kind: 'none', text: STANDINGS_WORDS.coach.none };
  const of = standings.rows.length;
  const where = row.tied ? `Tied for ${ordinal(row.place)} of ${of}` : `${ordinal(row.place)} of ${of}`;
  return { kind: 'ranked', text: `${where} · ${recordWords(row)} · ${pluralize(row.points, 'point')}` };
}
