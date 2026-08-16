/**
 * lib/demo-coach.ts — the Coach Sandbox's fictional world, and where it sits in time.
 *
 * One club — **Riverdale Ridge Baseball** — five teams, each frozen at a different moment of a
 * season (`COACH_SANDBOX_SEASON_PHASES_PLAN.md`), listed here in the order the year happens:
 *
 *   · 11U — TRYOUT DAY.   Evaluations are running right now: sessions today, three evaluator
 *                          links, partial blind scores, one deliberate split opinion.
 *   · 14U — OFF-SEASON.   Between seasons, with the books open: a categorized budget, real
 *                          spending logged against it, dues part-collected with one family
 *                          overdue, winter sessions, two practice plans, a testing session.
 *   · 10U — SEASON START. Two weeks in: the whole year on the schedule, three games played,
 *                          the opener's lineup saved, attendance only where it was taken.
 *   · 12U — MID-SEASON.   The richest team: 14-3-1, a game this Saturday with no lineup set,
 *                          an attendance dip, a playing-time outlier, two families overdue.
 *   · 13U — SEASON'S END. Last year's team. Its year is closed through the REAL lifecycle
 *                          (active → completed, the same transition the product performs) and
 *                          browsed through the already-approved archive doors only.
 *
 * Same design rules as `lib/demo-tournament.ts` / `lib/demo-moments.ts`:
 *
 *   1. **Pure and deterministic.** Everything is a function of the clock. The seed materializes
 *      this module; the nightly re-anchor job re-runs the same resolvers and diffs. Nothing here
 *      touches a database, and there is no randomness — reseeding must not churn rows.
 *   2. **Anchored relative to today** (org wall clock, America/Toronto): the tryout is always
 *      TODAY, the 12U game is always THIS Saturday, the 13U season always LAST year.
 *
 *      ⚠ **WEEK-QUANTIZED, NOT DAY-QUANTIZED.** Every dated row on the 14U and 10U is placed at
 *      `thisSaturday + X` for a fixed X (`weekAnchoredDates` below), exactly as the 12U's season
 *      already is. So the nightly re-anchor's shift is always a multiple of seven and a Sunday
 *      session stays a Sunday session. Anchoring anything to a raw day count instead would walk
 *      it one weekday per night — a "winter Sunday skills session" quietly becoming a Thursday.
 *   3. **Every person is fictional and unreachable.** Invented names, `@example.com` guardians
 *      (IANA-reserved — cannot receive mail), no phone numbers. Defense in depth on top of the
 *      notify/email chokepoint silence.
 *
 * ⚠ Scores are INTEGERS 1..scaleMax (the app rejects halves — `lib/tryout-score-session.ts`).
 * ⚠ Only `league_game`/`tournament_game` count toward the record tile (`lib/coach-season-record.ts`).
 */
import { zonedWallClockToUtc, addCalendarDays } from './timezone.ts';
import { DEMO_COACH_TEAM_IDS } from './demo-org.ts';
import { shiftedDate, DEMO_CONTACT_DOMAIN } from './demo-tournament.ts';
import { dayOfWeekFor } from './coach-recurrence.ts';
import { getRubricStarter } from './tryout-rubric-templates.ts';
import { addMonths } from './coach-budget-months.ts';

export const DEMO_COACH_ORG_NAME = 'Riverdale Ridge Baseball';
/** The one demo coach — head coach of all three teams. Display name shows in staff panels. */
export const DEMO_COACH_DISPLAY_NAME = 'Jordan Blake';

export interface DemoCoachTeamDef {
  id: string;
  name: string;
  slug: string;
  division: string;
  color: string;
}

export const DEMO_COACH_TEAMS: Record<
  'tryoutDay' | 'offSeason' | 'seasonStart' | 'midSeason' | 'seasonsEnd',
  DemoCoachTeamDef
> = {
  tryoutDay: {
    id: DEMO_COACH_TEAM_IDS.tryoutDay,
    name: 'Riverdale Ridge 11U', slug: 'ridge-11u', division: '11U', color: '#1E3A8A',
  },
  offSeason: {
    id: DEMO_COACH_TEAM_IDS.offSeason,
    name: 'Riverdale Ridge 14U', slug: 'ridge-14u', division: '14U', color: '#1E3A8A',
  },
  seasonStart: {
    id: DEMO_COACH_TEAM_IDS.seasonStart,
    name: 'Riverdale Ridge 10U', slug: 'ridge-10u', division: '10U', color: '#1E3A8A',
  },
  midSeason: {
    id: DEMO_COACH_TEAM_IDS.midSeason,
    name: 'Riverdale Ridge 12U', slug: 'ridge-12u', division: '12U', color: '#1E3A8A',
  },
  seasonsEnd: {
    id: DEMO_COACH_TEAM_IDS.seasonsEnd,
    name: 'Riverdale Ridge 13U', slug: 'ridge-13u', division: '13U', color: '#1E3A8A',
  },
};

// ── time helpers ─────────────────────────────────────────────────────────────────────────────

/** The org-timezone calendar date `offsetDays` from `now`, as `YYYY-MM-DD`.
 *  One copy of the demo's date arithmetic, not two — this IS the tournament demo's `shiftedDate`,
 *  re-exported under the name this module's callers (seed, checker, reconcile) already use. */
export const orgDateWithOffset = shiftedDate;

/** Day of week (0=Sun..6=Sat) for a `YYYY-MM-DD` string — the platform's zone-free helper;
 *  every date this module feeds it is generated valid, so the null arm is unreachable. */
const dayOfWeek = (date: string): number => dayOfWeekFor(date) ?? 0;

/** UTC ISO instant for an org-wall-clock date + `HH:MM`. */
function at(date: string, time: string): string {
  const iso = zonedWallClockToUtc(date, time);
  if (!iso) throw new Error(`demo-coach: bad wall clock ${date} ${time}`);
  return iso;
}

/** Offset (in days, 0..6) from today to the next Saturday — 0 when today IS Saturday. */
function offsetToSaturday(now: Date): number {
  const today = orgDateWithOffset(now, 0);
  return (6 - dayOfWeek(today) + 7) % 7;
}

/**
 * The org-calendar date `x` days from THIS Saturday — the one placement rule the 14U and 10U
 * worlds use for every dated row.
 *
 * `x` is a weekday-and-week offset in one number (0 = this Saturday, +1 = Sunday, -4 = Tuesday
 * past, -7 = last Saturday, …), so a whole season is authored as constants that never move
 * relative to each other, and the nightly re-anchor only ever shifts by whole weeks.
 *
 * ⚠ Whether a given `x` is in the PAST is not a constant — today's weekday decides it. Only
 * `x <= -7` is past on every day of the week (`offsetToSaturday` spans 0..6), which is why every
 * fact that must be settled — a game with a result, a paid installment, a logged expense — sits
 * at `x <= -7`, and everything with `x >= 1` is unambiguously ahead. The band between them is
 * reserved for rows that are allowed to flip (a practice whose attendance appears once it has
 * happened), and those resolve `happened` from the clock rather than from a constant.
 */
function weekAnchoredDates(now: Date): (x: number) => string {
  // Resolved once per run: the weekday of "today" cannot change mid-resolve, and rebuilding it
  // per date would rescan a zoned formatter ~30 times (`resolveMidSeasonState` hoists it too).
  const satOffset = offsetToSaturday(now);
  return (x: number) => orgDateWithOffset(now, satOffset + x);
}

/**
 * The key of one of the 14U's winter sessions, by its week offset `x`.
 *
 * ⚠ A practice plan has to name the session it belongs to, and the seed looks that session up by
 * key. Written as literals the two sides agree only by a human re-deriving `week * 7 + 1` — and
 * when they stopped agreeing the plan would simply not attach, silently, because a missing key
 * reads as "this practice has no plan". Both sides call this instead, so the pairing is stated
 * once as arithmetic. (`x = -13` renders as `OP-SUN--13`; the double dash is the negative sign,
 * which is exactly the sort of literal nobody should be typing by hand.)
 */
export function offSeasonSessionKey(x: number): string {
  return `OP-SUN-${x}`;
}

/** Week offsets of the 14U's Sunday sessions: five behind us, four from this weekend on. */
const OFFSEASON_SUNDAY_WEEKS = [-5, -4, -3, -2, -1, 0, 1, 2, 3] as const;
const offSeasonSundayOffset = (week: number) => week * 7 + 1;

/** The first day of the month `offset` months from today, org-calendar. Budget periods are month
 *  buckets, so they are re-derived from the clock on each pass rather than shifted like events.
 *  Month arithmetic comes from the Money-by-Month grid's own helper — one implementation of the
 *  negative-wraparound idiom, not two. */
function monthStart(now: Date, offset: number): string {
  return `${addMonths(orgDateWithOffset(now, 0).slice(0, 7), offset)}-01`;
}

// ── people ───────────────────────────────────────────────────────────────────────────────────

export interface DemoPlayer {
  first: string;
  last: string;
  number: string;
  primary: string;
  secondary: string | null;
  bats: 'L' | 'R' | 'S';
  throws: 'L' | 'R';
}

/** Guardian contact formula — one rule, asserted by the health check: unreachable by construction
 *  (the same IANA-reserved domain as every other contact in the demo world). */
export function demoGuardianEmail(last: string): string {
  return `ridge.${last.toLowerCase().replace(/[^a-z]/g, '')}.family@${DEMO_CONTACT_DOMAIN}`;
}

/** 12U — the mid-season roster. Index matters: the lineup grid below refers to these positions. */
export const MIDSEASON_ROSTER: readonly DemoPlayer[] = [
  { first: 'Theo',    last: 'Marsh',      number: '1',  primary: 'P',  secondary: 'SS', bats: 'R', throws: 'R' },
  { first: 'Nadia',   last: 'Osei',       number: '4',  primary: 'C',  secondary: '1B', bats: 'R', throws: 'R' },
  { first: 'Wes',     last: 'Calloway',   number: '7',  primary: 'C',  secondary: '3B', bats: 'L', throws: 'R' },
  { first: 'Priya',   last: 'Chandran',   number: '9',  primary: '1B', secondary: null, bats: 'L', throws: 'L' },
  { first: 'Marco',   last: 'Reyes',      number: '11', primary: 'P',  secondary: '2B', bats: 'R', throws: 'R' },
  { first: 'June',    last: 'Whitfield',  number: '13', primary: '2B', secondary: 'SS', bats: 'S', throws: 'R' },
  { first: 'Dmitri',  last: 'Kovac',      number: '16', primary: '3B', secondary: '1B', bats: 'R', throws: 'R' },
  { first: 'Alba',    last: 'Ferreira',   number: '19', primary: 'SS', secondary: '2B', bats: 'R', throws: 'R' },
  { first: 'Sam',     last: 'Tanaka',     number: '21', primary: 'LF', secondary: 'CF', bats: 'L', throws: 'L' },
  { first: 'Rowan',   last: 'Gallagher',  number: '24', primary: 'CF', secondary: 'RF', bats: 'R', throws: 'R' },
  { first: 'Imani',   last: 'Brooks',     number: '27', primary: 'RF', secondary: 'LF', bats: 'R', throws: 'R' },
  { first: 'Felix',   last: 'Aubert',     number: '30', primary: 'RF', secondary: 'CF', bats: 'L', throws: 'R' },
];

/** 13U — last year's roster. One player more than 12U; index 12 sat out the archived lineups. */
export const SEASONS_END_ROSTER: readonly DemoPlayer[] = [
  { first: 'Lena',    last: 'Petrov',     number: '2',  primary: 'P',  secondary: '3B', bats: 'R', throws: 'R' },
  { first: 'Oscar',   last: 'Blanchard',  number: '5',  primary: 'C',  secondary: null, bats: 'R', throws: 'R' },
  { first: 'Maren',   last: 'Holt',       number: '6',  primary: 'C',  secondary: '1B', bats: 'L', throws: 'R' },
  { first: 'Ravi',    last: 'Menon',      number: '8',  primary: '1B', secondary: null, bats: 'L', throws: 'L' },
  { first: 'Cole',    last: 'Iverson',    number: '10', primary: 'P',  secondary: 'SS', bats: 'R', throws: 'R' },
  { first: 'Anouk',   last: 'Tremblay',   number: '12', primary: '2B', secondary: 'SS', bats: 'S', throws: 'R' },
  { first: 'Silas',   last: 'Okafor',     number: '14', primary: '3B', secondary: '2B', bats: 'R', throws: 'R' },
  { first: 'Greta',   last: 'Lindqvist',  number: '15', primary: 'SS', secondary: '3B', bats: 'R', throws: 'R' },
  { first: 'Jonah',   last: 'Castellano', number: '18', primary: 'LF', secondary: 'RF', bats: 'L', throws: 'L' },
  { first: 'Freya',   last: 'Doyle',      number: '20', primary: 'CF', secondary: 'LF', bats: 'R', throws: 'R' },
  { first: 'Mateo',   last: 'Vidal',      number: '23', primary: 'RF', secondary: 'CF', bats: 'R', throws: 'R' },
  { first: 'Hana',    last: 'Yoshida',    number: '25', primary: 'RF', secondary: '2B', bats: 'L', throws: 'R' },
  { first: 'Elliott', last: 'Fontaine',   number: '28', primary: 'LF', secondary: '1B', bats: 'R', throws: 'R' },
];

/** 11U — three returning players already on next season's roster ("roster in formation"). */
export const TRYOUT_RETURNING: readonly DemoPlayer[] = [
  { first: 'Zora',    last: 'Aldana',     number: '3',  primary: 'SS', secondary: 'P',  bats: 'R', throws: 'R' },
  { first: 'Ben',     last: 'Kowalczyk',  number: '17', primary: 'C',  secondary: null, bats: 'R', throws: 'R' },
  { first: 'Tessa',   last: 'Nakagawa',   number: '22', primary: 'CF', secondary: '2B', bats: 'L', throws: 'L' },
];

export interface DemoTryoutCandidate {
  first: string;
  last: string;
  guardianFirst: string;
  guardianLast: string;
  bib: number;
  /** True for the candidates who arrived for this morning's session. */
  checkedIn: boolean;
}

/**
 * 28 candidates, bibs 2..29 (blind evaluation shows bibs, never names). The first 24 are checked
 * in; four are registered for this evening's session and haven't arrived yet.
 */
export const TRYOUT_CANDIDATES: readonly DemoTryoutCandidate[] = [
  ['Milo', 'Hartley', 'Grace', 'Hartley'], ['Ada', 'Beaumont', 'Luc', 'Beaumont'],
  ['Ezra', 'Okonkwo', 'Chidi', 'Okonkwo'], ['Suvi', 'Laine', 'Antti', 'Laine'],
  ['Callum', 'Byrne', 'Siobhan', 'Byrne'], ['Rosa', 'Delgado', 'Marisol', 'Delgado'],
  ['Ivan', 'Sorokin', 'Elena', 'Sorokina'], ['Maeve', 'Quinlan', 'Padraig', 'Quinlan'],
  ['Kofi', 'Mensah', 'Abena', 'Mensah'], ['Isla', 'MacRae', 'Ewan', 'MacRae'],
  ['Dario', 'Bianchi', 'Lucia', 'Bianchi'], ['Noor', 'Haddad', 'Rami', 'Haddad'],
  ['Otis', 'Wexler', 'Miriam', 'Wexler'], ['Pia', 'Lindgren', 'Stefan', 'Lindgren'],
  ['Ruben', 'Alvares', 'Ines', 'Alvares'], ['Sana', 'Qureshi', 'Faisal', 'Qureshi'],
  ['Tomas', 'Herrera', 'Valeria', 'Herrera'], ['Uma', 'Krishnan', 'Dev', 'Krishnan'],
  ['Viggo', 'Andersen', 'Freja', 'Andersen'], ['Wren', 'Tallis', 'Imogen', 'Tallis'],
  ['Yusuf', 'Demir', 'Aylin', 'Demir'], ['Zadie', 'Cormier', 'Rene', 'Cormier'],
  ['Arlo', 'Fenwick', 'Josephine', 'Fenwick'], ['Britt', 'Halvorsen', 'Nils', 'Halvorsen'],
  ['Cassia', 'Moreau', 'Etienne', 'Moreau'], ['Dov', 'Abramov', 'Rivka', 'Abramova'],
  ['Effie', 'Antoniou', 'Nikos', 'Antoniou'], ['Farid', 'Nazari', 'Laleh', 'Nazari'],
].map(([first, last, guardianFirst, guardianLast], i) => ({
  first, last, guardianFirst, guardianLast, bib: i + 2, checkedIn: i < 24,
}));

// ── tryout rubric + evaluators ───────────────────────────────────────────────────────────────

/** The app's OWN starter scorecard, not a copy of it — if the product's starter rubric ever
 *  changes, the demo's next reseed follows it instead of silently drifting from the thing it
 *  exists to showcase. Only the name is the demo's. */
export const DEMO_TRYOUT_RUBRIC = {
  name: 'Ridge 11U evaluation',
  ...getRubricStarter('baseball'),
};

export interface DemoEvaluator {
  name: string;
  /** How many candidates (in bib order) this evaluator has scored so far. */
  scoredCount: number;
  /** Flat drift applied to every score — makes the per-evaluator bias readout tell a story. */
  drift: number;
}

/** Three evaluator links: two mid-session, one who starts this evening. */
export const DEMO_EVALUATORS: readonly DemoEvaluator[] = [
  { name: 'Priya Raman',    scoredCount: 22, drift: 0 },
  /**
   * ⚠ Reads harsh — but the scoreboard's bias chip does NOT fire on this, and the comment here
   * claimed for a year that it did. Measured 2026-08-05: consensus is the mean of each evaluator's
   * OWN mean, so with two scorers a −1 drift moves each of them only half that, giving ±0.39
   * against a 0.15 × 5 = 0.75 threshold. Making "runs cold" appear needs roughly −2, and it needs
   * the tryout hub's stage to be linkable before a tour could point at it. Both deferred (owner,
   * 2026-08-05); the harsh scorer stays because it makes the split opinion below plausible.
   */
  { name: 'Dana Kowalski',  scoredCount: 19, drift: -1 },
  { name: 'Marcus Field',   scoredCount: 0,  drift: 0 },  // starts at the evening session
];

/** The one deliberate split opinion: bib 14 (Otis Wexler), category `hitting`. */
export const SPLIT_OPINION = {
  bib: 14,
  category: 'hitting',
  scores: [5, 2] as const, // Priya 5, Dana 2
  notes: ['Best bat speed on the field today.', 'Chased everything up. Needs a full look Thursday.'] as const,
};

/**
 * Deterministic score for (evaluator, bib, category) — integers 1..5, stable across reseeds.
 * A candidate has an innate quality band; categories wobble around it; an evaluator's drift
 * shifts it. The split-opinion pair overrides this.
 */
export function tryoutScoreFor(evaluatorIndex: number, bib: number, categoryIndex: number): number {
  const split = SPLIT_OPINION;
  if (bib === split.bib && DEMO_TRYOUT_RUBRIC.categories[categoryIndex].key === split.category
      && evaluatorIndex < split.scores.length) {
    return split.scores[evaluatorIndex];
  }
  const quality = 2 + ((bib * 7 + 3) % 4);            // 2..5 per candidate
  const wobble = ((bib + categoryIndex * 5) % 3) - 1; // -1..1 per category
  const raw = quality + wobble + DEMO_EVALUATORS[evaluatorIndex].drift;
  return Math.max(1, Math.min(DEMO_TRYOUT_RUBRIC.scaleMax, raw));
}

// ── opponents (one invented world — clubs that read like the tournament sandbox's) ───────────

const OPPONENTS = [
  'Harborview Falcons', 'Cedar Hollow Cyclones', 'Port Alma Miners',
  'Maple Landing Loons', 'Birchmount Bears', 'Stonebridge Storm',
] as const;

export const DEMO_HOME_DIAMOND = 'Riverdale Park — Diamond 2';

// ── 12U mid-season ───────────────────────────────────────────────────────────────────────────

export interface DemoGame {
  /** Stable key for diffing between the seed and the re-anchor job. */
  key: string;
  date: string;
  time: string;
  startsAtIso: string;
  endsAtIso: string;
  opponent: string;
  homeAway: 'home' | 'away';
  result: 'win' | 'loss' | 'tie' | null;
  teamScore: number | null;
  opponentScore: number | null;
  /** Index into the season's lineup list, or null when no lineup was saved for this game. */
  lineupOrder: number | null;
}

export interface DemoPractice {
  key: string;
  date: string;
  time: string;
  startsAtIso: string;
  endsAtIso: string;
  /** False for this week's practices still ahead — they exist on the schedule, with no attendance. */
  happened: boolean;
  /** Attendance shape: indexes into the roster of players NOT attending, and how. */
  absent: readonly number[];
  late: readonly number[];
  /** What this session is called on the schedule. Defaults to "Team practice" when absent. */
  name?: string;
}

/** Chronological results, oldest → newest: 14-3-1, and "won 4 of the last 5". */
const MIDSEASON_RESULTS: ReadonlyArray<{ r: 'win' | 'loss' | 'tie'; us: number; them: number }> = [
  { r: 'win', us: 7, them: 3 }, { r: 'win', us: 5, them: 4 }, { r: 'loss', us: 2, them: 6 },
  { r: 'win', us: 9, them: 1 }, { r: 'win', us: 4, them: 2 }, { r: 'win', us: 6, them: 5 },
  { r: 'tie', us: 3, them: 3 }, { r: 'win', us: 8, them: 2 }, { r: 'loss', us: 1, them: 4 },
  { r: 'win', us: 5, them: 0 }, { r: 'win', us: 7, them: 6 }, { r: 'win', us: 3, them: 1 },
  { r: 'win', us: 6, them: 2 }, { r: 'loss', us: 4, them: 5 }, { r: 'win', us: 2, them: 1 },
  { r: 'win', us: 10, them: 4 }, { r: 'win', us: 5, them: 3 }, { r: 'win', us: 6, them: 4 },
];

/**
 * The 12U lineup grid — innings 1..6 × roster index → position (or 'Bench').
 *
 * Authored, not generated, so the story it tells is inspectable: nine legal positions every
 * inning; Theo (0) pitches 1-3 and Marco (4) pitches 4-6, both AT the 3-inning arm-care default;
 * Felix (11) fields only 2 of 6 innings — the deliberate playing-time outlier the fairness
 * insight flags; everyone else sits at most twice.
 */
export const MIDSEASON_LINEUP_GRID: ReadonlyArray<readonly string[]> = [
  //  0     1        2        3       4        5      6      7     8       9      10     11
  ['P',   'Bench', 'C',     '1B',   'Bench', '2B',  '3B',  'SS', 'LF',   'CF',  'RF',  'Bench'], // 1
  ['P',   'C',     'Bench', '1B',   '2B',    'Bench','3B', 'SS', 'LF',   'CF',  'RF',  'Bench'], // 2
  ['P',   'C',     '1B',    'Bench','2B',    '3B',  'Bench','SS','LF',   'CF',  'RF',  'Bench'], // 3
  ['SS',  'Bench', 'C',     '1B',   'P',     '2B',  '3B',  'Bench','LF', 'CF',  'RF',  'Bench'], // 4
  ['LF',  'C',     'Bench', '1B',   'P',     '2B',  '3B',  'SS', 'Bench','Bench','CF', 'RF'],    // 5
  ['Bench','C',    '1B',    'Bench','P',     '2B',  '3B',  'SS', 'LF',   'CF',  'Bench','RF'],   // 6
];

export const MIDSEASON_INNING_COUNT = 6;
export const MIDSEASON_LINEUP_GAMES = 6; // the newest 6 decided games carry a saved lineup

/**
 * Which roster slot the guided tour points at twice — first as a number on the playing-time table,
 * then as the family whose recap that number belongs to.
 *
 * It is the OUTLIER above (index 11, Felix, 2 of 6 innings), and it is named here rather than
 * spelled `11` in the seed so the two references cannot drift apart: if the grid is ever
 * re-authored so a different player sits most, this constant is what has to move with it, in one
 * place, and the health check asserts the pairing.
 */
export const MIDSEASON_SHOWCASE_ROSTER_INDEX = 11;

/** Arm care: Theo has an explicit per-game cap; the season default covers Marco. */
export const MIDSEASON_LINEUP_SETTINGS = {
  maxInningsPerPosition: null,
  pitcherMaxInningsDefault: 3,
  minInningsPerPlayer: 2,
} as const;

export function midseasonPitcherProfile(rosterIndex: number): object | null {
  // The FULL LineupProfile shape (lib/types.ts), matching what the app's own normalizer
  // persists — readers cast this column without runtime defaulting, so a partial object here
  // would be the one row in the product that doesn't conform to its own type.
  const profile = (rank: number, maxInnings: number | null) =>
    ({ morePreferred: [], canPlay: [], never: [], pitcher: { rank, maxInnings }, aSquad: false });
  if (rosterIndex === 0) return profile(1, 3);
  if (rosterIndex === 4) return profile(2, null);
  return null;
}

/**
 * The two team-wide dues settings, for every demo team — stated, not inherited.
 *
 * ⚠ THE DEMO'S MOST SYMPATHETIC MOMENT DEPENDS ON THE SECOND OF THESE. The guided tour's money
 * step narrates a family whose bill reads "covered by fundraising" because half a bottle drive
 * came off their dues — which only happens while credits are applied to bills at all. Until
 * 2026-08-14 the seed never set the column, so that whole sentence was riding a database default:
 * a future default of `keep_separate` would have left the tour describing a screen that no longer
 * said it, with every page still rendering perfectly. That is exactly the silent demo drift the
 * repo's drift rule exists to catch, and a default is not a decision.
 *
 * `last_first` is also the product's own default, so this pins the demo to today's behaviour
 * rather than dressing it up: a prospect sees what a real new team would get.
 *
 * Reminders stay ON because the moments dock and the money step both talk about families being
 * chased — and because a demo that quietly disabled the emails would be showing a tidier product
 * than the one we sell. Nothing can actually send: the sandbox blocks every write.
 */
export const DEMO_DUES_SETTINGS = {
  auto_reminders_enabled: true,
  credit_application: 'last_first',
} as const;

/** Dues: $480/player in 4 × $120. Two families each sit on one overdue $120 → $240 outstanding. */
export const MIDSEASON_DUES = {
  totalAmount: 480,
  installments: 4,
  installmentAmount: 120,
  /** Roster indexes whose LAST installment is unpaid and past due. */
  overdueRosterIndexes: [6, 10] as const, // Dmitri Kovac, Imani Brooks
  /** The part-paid family (owner ruling 2026-08-13, payment-record showcase): the FUTURE
   *  instalment #4 sits at $90 of $120, sent ahead as three small e-transfers — the row a
   *  prospect should meet. Deliberately the future one: on a past-due instalment this family
   *  would read as a THIRD overdue household and break the "two families behind" story the
   *  tour narrates and the demo checker pins ($240 across exactly two). */
  partPaid: {
    rosterIndex: 3,
    /** Zero-based instalment the partial lands on (its stamp stays null). */
    installmentIndex: 3,
    /** The e-transfers, oldest first, summing under one instalment. */
    splits: [40, 30, 20] as const,
    /** Received, relative to the anchored clock (days). */
    splitOffsets: [-24, -14, -6] as const,
  },
} as const;

/**
 * The Bottle Drive — the demo's answer to "what does fundraising actually DO for a family?"
 *
 * Until 2026-08-14 the coach sandbox had no fundraiser at all, so the most sympathetic thing this
 * product does — a family's bill going DOWN because their kid sold bottles — was a thing a
 * prospect could not see. The drive is CLOSED, so its rebates are credits, and with the team on
 * the default `last_first` setting they land on the final instalment: Wes Calloway's is covered
 * outright and reads "Covered by fundraising", the other four ask for less than $120.
 *
 * ⚠ THREE PINS THIS MUST NOT BREAK, and the reason every number here is what it is:
 *   1. **$240 overdue across exactly two families.** Dmitri (6) and Imani (10) are deliberately
 *      NOT on this list: a rebate would land on their open bills and quietly clear the debt the
 *      guided tour narrates by name.
 *   2. **Every rebate is ≤ the $120 instalment**, so no credit can cascade backwards off the last
 *      bill into instalment #3 and clear an overdue one from the side.
 *   3. **Priya (3) is not on the list either** — her instalment #4 is the "$90 of $120" part-paid
 *      showcase, and a credit settling the remaining $30 would take that row off the screen.
 */
export const MIDSEASON_FUNDRAISER = {
  name: 'Bottle Drive',
  description: 'Spring bottle drive — half of what each player raises comes straight off their dues.',
  rebatePercent: 50,
  /** Opened / closed, relative to the anchored clock (days). Closed, so the credits are real. */
  startOffset: -56,
  endOffset: -21,
  /** rosterIndex → raised. Rebate is half, and never more than one instalment (pin 2). */
  entries: [
    { rosterIndex: 0,  raised: 160 }, // Theo Marsh      → $80
    { rosterIndex: 1,  raised: 90  }, // Nadia Osei      → $45
    { rosterIndex: 2,  raised: 240 }, // Wes Calloway    → $120, covers the last bill exactly
    { rosterIndex: 4,  raised: 60  }, // Marco Reyes     → $30
    { rosterIndex: 5,  raised: 120 }, // June Whitfield  → $60
  ],
} as const;

/**
 * The sponsor — the demo's answer to "what does the OTHER kind of money-in look like?"
 *
 * Sponsorships shipped 2026-08-15 and the shop window did not follow: a prospect opening the coach
 * sandbox met a Fundraising tab with one bottle drive on it and nothing to show that the product
 * distinguishes a drive from a business writing a cheque. The product had gained something the
 * demo could not say — the drift this repo's rule exists to catch, and one a health check can
 * never raise on its own.
 *
 * ⚠⚠ CLUB-WIDE, CREDITED TO NOBODY, AND THAT IS NOT A SHORTCUT. Attributing it to a family would
 * write a dues credit onto that family's bill, and the 12U's bills are load-bearing: the guided
 * tour narrates $240 overdue across EXACTLY two families and one instalment sitting at $90 of $120,
 * and `check-demo-coach` pins both. A sponsor credit could clear a debt the tour talks about by
 * name, or settle the $30 that makes the part-paid row worth looking at. A club-wide sponsor
 * touches no bill at all, so every pin survives BY CONSTRUCTION rather than by arithmetic that has
 * to be re-checked whenever a number moves. The three pins on MIDSEASON_FUNDRAISER above are the
 * same rule, arrived at the same way.
 *
 * RECEIVED rather than pledged: a pledge is the state that does nothing to the books, and a demo
 * whose only sponsor was invisible in every figure would be showing the feature switched off. The
 * pledged/received distinction is told in the tour's sentence and in the help guide instead.
 */
export const MIDSEASON_SPONSOR = {
  name: 'Riverdale Dental',
  description: 'Season sponsor — banner at the diamond and a name on the practice jerseys.',
  amount: 750,
  /** Received, relative to the anchored clock (days). Well inside the season already played. */
  receivedOffset: -34,
} as const;

/**
 * The 12U's plan, built in the spring — and, since Phase 3, actually spent against.
 *
 * ⚠ **The categories are not decoration.** Budget-vs-actual matches a logged expense to a line by
 * comparing the expense's free-text category to the category NAME (same rule as
 * `OFFSEASON_BUDGET_LINES`). Until 2026-08-05 these five lines carried no category at all, so the
 * report grouped the entire plan under "Uncategorized" and filed every dollar as unbudgeted — which
 * is why a team 18 games into its season showed $9,400 planned and $0.00 actual. Every category
 * here must also be TEAM-reachable (`scope` `team` or `both`), or the seed refuses it.
 *
 * ⚠ One category per line, deliberately: the report groups BY category, so two lines sharing one
 * would merge on screen and the over-plan line would disappear into an average.
 */
export const MIDSEASON_BUDGET_LINES = [
  { description: 'Diamond rentals',    category: 'Facilities',  total: 3200 },
  { description: 'Tournament entries', category: 'Tournaments', total: 2400 },
  { description: 'Uniforms & caps',    category: 'Team Gear',   total: 1800 },
  { description: 'Umpires',            category: 'Officials',   total: 1100 },
  { description: 'Balls, screens and practice gear', category: 'Training', total: 900 },
] as const;

/**
 * The 12U's SEASON ESTIMATE — deliberately **not** the sum of the lines above ($9,400).
 *
 * ⚠ DO NOT "FIX" THIS BY RE-DERIVING IT FROM `MIDSEASON_BUDGET_LINES`. Every other demo team sets
 * its estimate to exactly its itemized total, which is tidy and, on this one team, would hide the
 * feature it is here to show. The Generate Player Installments sheet offers a coach three ways to
 * price a season — split the itemized lines, split the estimate, or type the amounts — and the
 * first two are the SAME subtraction against two different tops. Where the tops are equal, two of
 * the three cards print an identical figure and the choice reads as decoration.
 *
 * $800 of headroom is also the honest shape of a mid-season team: a coach who estimated the year at
 * $10,200 and has itemized $9,400 of it so far, with the rest still to be pinned down. It lights up
 * the "not itemized yet" rung of the budget ladder on the same screen.
 */
export const MIDSEASON_SEASON_ESTIMATE = 10_200;

/** Everyone but Wes (index 2) has a signed waiver on file — the "1 unsigned" beat. */
export const MIDSEASON_UNSIGNED_WAIVER_INDEX = 2;

/**
 * Two plans on the 12U's most recent PAST practices — the written record of what was actually run
 * on the Tuesday the room emptied out and the Thursday after it.
 *
 * ⚠ Past practices only, deliberately. A plan on an UPCOMING practice would be a second thing the
 * Overview could be asked about, and this team's whole beat is that its one thing is Saturday's
 * unset lineup. (Confirmed harmless either way — `resolveOverviewAnchor` reads the next event's
 * TYPE, never whether it has a plan — but the moment stays undiluted on purpose.)
 */
export const MIDSEASON_PRACTICE_PLANS: readonly DemoPracticePlan[] = [
  {
    practiceKey: 'P-TUE-1',
    goal: 'Cut the free bases we gave away on Saturday.',
    practiceTypes: ['Fielding'],
    equipment: ['Buckets', 'Cones'],
    blocks: [
      {
        id: 'demo-12u-tue-warmup', title: 'Warm-up and throwing', minutes: 15,
        description: 'Dynamic work, then out to the outfield grass.',
        staff: [DEMO_COACH_DISPLAY_NAME], playerIndexes: null,
      },
      {
        id: 'demo-12u-tue-relays', title: 'Relays and cuts', minutes: 30,
        description: 'Two lines from the corner, cut man on the grass every time.',
        goal: 'Somebody is always calling the cut.',
        coachingPoints: ['Line up the throw', 'Loud and early, then get out of the way'],
        staff: [DEMO_COACH_DISPLAY_NAME], playerIndexes: null,
      },
      {
        id: 'demo-12u-tue-situations', title: 'Situations', minutes: null, restOfPractice: true,
        description: 'Runner on second, one out. Play it out, then talk about it.',
        playerIndexes: null,
      },
    ],
  },
  {
    practiceKey: 'P-THU-1',
    goal: 'Sharpen the top of the order before Saturday.',
    practiceTypes: ['Hitting'],
    equipment: ['Tees', 'Screens', 'Short bats'],
    blocks: [
      {
        id: 'demo-12u-thu-warmup', title: 'Warm-up', minutes: 12,
        description: 'Band work and easy throwing.',
        staff: [DEMO_COACH_DISPLAY_NAME], playerIndexes: null,
      },
      {
        id: 'demo-12u-thu-rounds', title: 'Hitting rounds', minutes: 40,
        description: 'Three groups: tee, front toss, live off the machine.',
        goal: 'Every hitter takes at least one round with two strikes.',
        coachingPoints: ['Two strikes, shorten up', 'One plan per round'],
        staff: [DEMO_COACH_DISPLAY_NAME], playerIndexes: null,
      },
      {
        id: 'demo-12u-thu-run', title: 'Baserunning', minutes: 15,
        description: 'Leads and reads at second.',
        playerIndexes: null,
      },
    ],
  },
];

export const MIDSEASON_DEVELOPMENT_GOALS = [
  { rosterIndex: 5, focusArea: 'Two-strike approach', note: 'Shorten up with two strikes — fouled off 9 straight in Tuesday cage work.' },
  { rosterIndex: 9, focusArea: 'First-step reads in centre', note: 'Freezes on balls hit straight at him. Working drop-step drills.' },
  { rosterIndex: 0, focusArea: 'Holding runners', note: 'Slide-step added. Times to the plate trending down.' },
] as const;

export interface MidSeasonState {
  year: number;
  yearName: string;
  games: DemoGame[];
  practices: DemoPractice[];
  saturdayDate: string;
  /** What the season has actually cost so far — the "actual" half of budget-vs-actual (Phase 3). */
  expenses: DemoExpense[];
}

/**
 * Mid-season, resolved from the clock: 18 decided games behind us, a game THIS Saturday with no
 * result and no lineup, Tuesday/Thursday practices around it, and an attendance dip on the two
 * most recent Tuesdays.
 */
export function resolveMidSeasonState(now: Date): MidSeasonState {
  const satOffset = offsetToSaturday(now);
  const saturdayDate = orgDateWithOffset(now, satOffset);
  const year = Number(orgDateWithOffset(now, 0).slice(0, 4));

  const games: DemoGame[] = [];
  const game = (key: string, date: string, time: string, i: number | null, opp: number,
                homeAway: 'home' | 'away', lineupOrder: number | null): DemoGame => {
    const decided = i != null ? MIDSEASON_RESULTS[i] : null;
    return {
      key, date, time,
      startsAtIso: at(date, time), endsAtIso: at(date, addHours(time, 2)),
      opponent: OPPONENTS[opp % OPPONENTS.length], homeAway,
      result: decided?.r ?? null,
      teamScore: decided?.us ?? null, opponentScore: decided?.them ?? null,
      lineupOrder,
    };
  };

  // Past decided games, oldest → newest: ten Saturdays back, six Sundays, two Wednesday nights.
  const slots: Array<{ date: string; time: string }> = [];
  for (let week = 10; week >= 1; week--) {
    slots.push({ date: orgDateWithOffset(now, satOffset - 7 * week), time: '09:00' });
    if ([1, 2, 4, 5, 7, 8].includes(week)) {
      slots.push({ date: orgDateWithOffset(now, satOffset - 7 * week + 1), time: '11:30' });
    }
    if ([3, 6].includes(week)) {
      slots.push({ date: orgDateWithOffset(now, satOffset - 7 * week + 4), time: '18:30' });
    }
  }
  slots.sort((a, b) => a.date.localeCompare(b.date));
  if (slots.length !== MIDSEASON_RESULTS.length) {
    // Two hand-authored constants must agree: the week-loop above produces the slots, the
    // results array decides them. The reconcile's "exactly one unresulted game" invariant
    // rides on this — fail at resolve time, not as a silently wrong demo.
    throw new Error(`demo-coach: ${slots.length} game slots for ${MIDSEASON_RESULTS.length} results`);
  }
  slots.forEach((slot, i) => {
    const lineupOrder = i >= slots.length - MIDSEASON_LINEUP_GAMES ? i - (slots.length - MIDSEASON_LINEUP_GAMES) : null;
    games.push(game(`G-${i}`, slot.date, slot.time, i, i, i % 2 === 0 ? 'home' : 'away', lineupOrder));
  });

  // THIS Saturday: scheduled, unscored, no lineup — the "one thing" the Overview asks for.
  games.push(game('G-SAT', saturdayDate, '09:00', null, 0, 'home', null));

  // Practices: Tuesday + Thursday for the past nine weeks, plus this week's pair — which stays
  // on the schedule even when it's still ahead ("3 events this week" is the moment's beat), it
  // just carries no attendance yet.
  const practices: DemoPractice[] = [];
  const today = orgDateWithOffset(now, 0);
  const tueOffset = satOffset - 4; // the Tuesday before this Saturday
  for (let week = 9; week >= 0; week--) {
    for (const [dayShift, label] of [[0, 'TUE'], [2, 'THU']] as const) {
      const date = orgDateWithOffset(now, tueOffset - 7 * week + dayShift);
      const happened = date <= today;
      const isRecentTuesday = label === 'TUE' && week <= 1 && happened;
      practices.push({
        key: `P-${label}-${week}`, date, time: '18:00',
        startsAtIso: at(date, '18:00'), endsAtIso: at(date, '19:30'),
        happened,
        // The dip: the two most recent Tuesdays lose a third of the room (8/12 ≈ 71% with a late).
        absent: isRecentTuesday ? [2, 6, 11] : happened && week % 3 === 0 ? [7] : [],
        late: isRecentTuesday ? [4] : [],
      });
    }
  }

  /**
   * The books, eighteen games in (Phase 3).
   *
   * Dated off the SAME Saturday anchor as the schedule, so the nightly re-anchor moves the money
   * with the calendar rather than leaving a bill dated before the season it belongs to.
   *
   * ⚠ **Facilities is deliberately OVER plan**, and it is the only anomaly on the team. Owner
   * ruling 2026-08-05: a demo whose every line comes in under budget teaches a prospect that the
   * report flatters them, which is the opposite of the thing being sold. Two rainouts moved to
   * weeknight slots is the most ordinary way a real season goes over, so that is what it says.
   * The unbudgeted-expense beat stays with the 14U — one anomaly per team, or neither reads.
   */
  const paidAt = (weeksBack: number) => orgDateWithOffset(now, satOffset - 7 * weeksBack);
  const expenses: DemoExpense[] = [
    demoExpense('MS-DIAMOND-1', 'Diamond rentals — spring block', 'Facilities', 2400, paidAt(11)),
    demoExpense('MS-DIAMOND-2', 'Diamond rentals — weeknight slots', 'Facilities', 1050, paidAt(3),
      'Two rainouts moved to weeknights. Not in the spring plan.'),
    demoExpense('MS-TOURN-1', 'Spring Classic entry', 'Tournaments', 1200, paidAt(12)),
    demoExpense('MS-TOURN-2', 'Riverside Invitational entry', 'Tournaments', 1200, paidAt(5)),
    demoExpense('MS-GEAR', 'Jerseys, caps and helmets', 'Team Gear', 1755, paidAt(10)),
    demoExpense('MS-UMP-1', 'Umpire fees — first half', 'Officials', 550, paidAt(7)),
    demoExpense('MS-UMP-2', 'Umpire fees — second half', 'Officials', 440, paidAt(2)),
    demoExpense('MS-TRAINING', 'Balls, screens and practice gear', 'Training', 610, paidAt(9)),
  ];

  return { year, yearName: `${year} Season`, games, practices, saturdayDate, expenses };
}

/** `HH:MM` plus whole hours (events are same-day; the demo never schedules across midnight). */
function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  return `${String(Math.min(23, h + hours)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── 14U off-season ───────────────────────────────────────────────────────────────────────────

/** 14U — the off-season roster, carried over and complete. Thirteen players. */
export const OFFSEASON_ROSTER: readonly DemoPlayer[] = [
  { first: 'Ines',     last: 'Duarte',     number: '2',  primary: 'C',  secondary: '1B', bats: 'R', throws: 'R' },
  { first: 'Kwame',    last: 'Boateng',    number: '4',  primary: 'P',  secondary: '3B', bats: 'R', throws: 'R' },
  { first: 'Sofia',    last: 'Marchetti',  number: '6',  primary: 'SS', secondary: '2B', bats: 'L', throws: 'R' },
  { first: 'Levi',     last: 'Ashworth',   number: '8',  primary: '1B', secondary: 'LF', bats: 'L', throws: 'L' },
  { first: 'Tariq',    last: 'Bahri',      number: '11', primary: '2B', secondary: 'SS', bats: 'S', throws: 'R' },
  { first: 'Elowen',   last: 'Pryce',      number: '13', primary: '3B', secondary: 'C',  bats: 'R', throws: 'R' },
  { first: 'Nikolai',  last: 'Varga',      number: '15', primary: 'P',  secondary: 'RF', bats: 'R', throws: 'R' },
  { first: 'Camille',  last: 'Dubois',     number: '18', primary: 'CF', secondary: 'SS', bats: 'L', throws: 'L' },
  { first: 'Rafael',   last: 'Ocampo',     number: '20', primary: 'LF', secondary: 'CF', bats: 'R', throws: 'R' },
  { first: 'Yuki',     last: 'Tashiro',    number: '22', primary: 'RF', secondary: 'LF', bats: 'L', throws: 'R' },
  { first: 'Hannah',   last: 'Berglund',   number: '26', primary: 'C',  secondary: '3B', bats: 'R', throws: 'R' },
  { first: 'Osman',    last: 'Yilmaz',     number: '29', primary: 'P',  secondary: '1B', bats: 'R', throws: 'R' },
  { first: 'Delphine', last: 'Roux',       number: '31', primary: '2B', secondary: 'RF', bats: 'R', throws: 'R' },
];

/**
 * The budget plan — six lines, each on one of the PLATFORM's own budget categories.
 *
 * ⚠ `category` is not decoration: budget-vs-actual matches a logged expense to a budget line by
 * comparing the expense's free-text category to the category NAME, case-insensitively
 * (`app/api/coaches/.../budget-vs-actual/route.ts`). These strings must stay identical to the
 * platform-default `budget_categories` rows (org_id NULL) the seed looks them up by, or the whole
 * moment lands on a page reading "Uncategorized" with every dollar filed as unbudgeted.
 *
 * ⚠ **Every category here must be TEAM-reachable** (`scope` `team` or `both`). The coach's own
 * budget planner lists only those, and its write path refuses the rest — so a line on an org-only
 * category (`Admin`, `Coaching`) is a state no coach could ever create: the plan list would show
 * it, and opening Edit Budget Line would find the category missing from its own picker. The seed
 * enforces the scope so this cannot be reintroduced by choosing a plausible-sounding name.
 */
export const OFFSEASON_BUDGET_LINES = [
  { description: 'Tournament entries — four weekends', category: 'Tournaments',       total: 3600 },
  { description: 'Diamond and dome rentals',           category: 'Facilities',        total: 2800 },
  { description: 'Uniforms, caps and helmets',         category: 'Team Gear',         total: 2100 },
  { description: 'Winter cage sessions',               category: 'Training',          total: 1400 },
  { description: 'Umpire fees',                        category: 'Officials',         total: 1200 },
  { description: 'Raffle licence and printing',        category: 'Fundraising Costs', total: 600 },
] as const;

/**
 * The money the team expects to bring IN, so the demo shows the thing the product gained on
 * 2026-08-12: a budget that says what players actually have to fund, not just what the season costs.
 *
 * It pairs with the "Raffle licence and printing" cost line — the raffle costs $600 to run and is
 * expected to net the team $2,400 — which is the honest shape of a real fundraiser and the reason
 * the two are separate kinds rather than one netted-off number.
 *
 * ⚠ NO CATEGORY, deliberately. A funding line is not an expense: it never enters budget-vs-actual's
 * category matching, and filing it under a spending category would put money coming in beneath a
 * heading that names something the team pays for. It renders in its own section, where the category
 * is not shown at all.
 */
export const OFFSEASON_FUNDING_LINES = [
  { description: 'Raffle proceeds — team share (estimated)', total: 2400 },
] as const;

/** Each line is phased across four months (this month ±). Quarters divide every total exactly —
 *  the planner enforces periods summing to their line within $0.02, and the demo must not sit on
 *  that tolerance. (The funding line's total divides exactly too, for the same reason.) */
export const OFFSEASON_BUDGET_PERIOD_MONTHS = [-1, 0, 1, 2] as const;

/**
 * The instant a demo bill is settled: late afternoon in the ORG's own day, never 16:00 UTC.
 *
 * ⚠ One definition on purpose. The seed writes these stamps and the nightly re-anchor re-asserts
 * them from the same world, so two spellings of "4pm" would make every single run rewrite every
 * expense — a job whose entire contract is that a steady day writes nothing.
 */
export function demoPaidStampIso(date: string): string {
  return at(date, '16:00');
}

export interface DemoExpense {
  key: string;
  description: string;
  /** Free text in the product; here, always a budget category name — or deliberately not one. */
  category: string;
  amount: number;
  type: 'expense' | 'tournament_payable';
  /** Lump expenses: when it was paid. Payables leave this null and use the two legs. */
  paidDate: string | null;
  deposit?: { amount: number; dueDate: string; paidDate: string | null };
  balance?: { amount: number; dueDate: string; paidDate: string | null };
  notes?: string | null;
}

/**
 * A settled, lump-sum expense — the shape three of the five teams now use.
 *
 * Shared rather than re-declared per team (Phase 3): the off-season resolver had its own local
 * copy, and a second and third one would be three places for the same row to drift. Payables keep
 * their object literal, because a two-legged bill has nothing to abbreviate.
 */
export function demoExpense(
  key: string, description: string, category: string, amount: number,
  paidDate: string, notes: string | null = null,
): DemoExpense {
  return { key, description, category, amount, type: 'expense', paidDate, notes };
}

/** Dues: $900 a player in four. One family is a payment behind — $225 overdue, and the sweep that
 *  would chase it is exactly what the demo org is excluded from. */
export const OFFSEASON_DUES = {
  totalAmount: 900,
  installments: 4,
  installmentAmount: 225,
  /** Week-anchored due dates: two settled, two ahead. */
  dueOffsets: [-49, -21, 7, 35] as const,
  /** Roster index whose SECOND installment went unpaid past its due date. */
  overdueRosterIndex: 4, // Tariq Bahri
} as const;

/** The winter's development work: what four players are actually being coached on. */
export const OFFSEASON_DEVELOPMENT_GOALS = [
  { rosterIndex: 1, focusArea: 'Repeating the delivery', status: 'working',
    note: 'Lands closed when he tires. Ten pitches a session with the towel, no hitter.' },
  { rosterIndex: 3, focusArea: 'Picking the short hop at first', status: 'working',
    note: 'Wants the ball on a long hop. We are making it comfortable rather than avoiding it.' },
  { rosterIndex: 7, focusArea: 'Reading the ball off the bat in centre', status: 'working',
    note: 'First step is honest now — the routes are what we are working on.' },
  { rosterIndex: 10, focusArea: 'Throwing through the bag', status: 'achieved',
    note: 'Pop time down a tenth since the fall. She has stopped aiming it.' },
] as const;

/** The team's testing library — coach-defined, as the product intends (nothing ships seeded). */
export const OFFSEASON_MEASURABLE_TYPES = [
  { name: '60-yard dash',  unit: 'seconds' },
  { name: 'Exit velocity', unit: 'mph' },
  { name: 'Home to first', unit: 'seconds' },
] as const;

/** Two of the thirteen missed the testing session — they get an honest blank, never a zero. */
export const OFFSEASON_TESTING_ABSENT = [5, 12] as const;

/** A deterministic reading for (player, test) — a band per player, a wobble per test. */
export function offseasonMeasurableValue(rosterIndex: number, typeIndex: number): number {
  const band = (rosterIndex * 3 + 1) % 5;               // 0..4 per player
  const wobble = ((rosterIndex + typeIndex * 2) % 3);   // 0..2
  if (typeIndex === 0) return Math.round((8.6 - band * 0.22 - wobble * 0.05) * 100) / 100; // seconds
  if (typeIndex === 1) return 52 + band * 3 + wobble;                                       // mph
  return Math.round((4.9 - band * 0.13 - wobble * 0.04) * 100) / 100;                       // seconds
}

/**
 * A practice plan, as the world knows it: the product's own `practice_plan` jsonb shape, with
 * player membership left as ROSTER INDEXES for the seed to resolve into row ids. Groups and block
 * rosters are the only part of a plan that references people.
 */
export interface DemoPracticePlan {
  /** Which practice (by `DemoPractice.key`) this plan belongs to. */
  practiceKey: string;
  goal: string;
  practiceTypes: string[];
  equipment: string[];
  blocks: Array<{
    id: string;
    title: string;
    minutes: number | null;
    restOfPractice?: boolean;
    description?: string;
    goal?: string;
    coachingPoints?: string[];
    staff?: string[];
    /** Roster indexes for this block, or null for the whole team. */
    playerIndexes?: readonly number[] | null;
    /** ⚠ No `count` — the product retired it (owner ruling 2026-08-01, `PracticeStation`). */
    stations?: Array<{
      id: string; name: string; description?: string; goal?: string;
      equipment?: string[]; setup?: string; coachingPoints?: string[]; staff?: string[]; note?: string;
    }>;
    rotation?: {
      intervalMinutes: number;
      groups: Array<{ id: string; name: string; playerIndexes: readonly number[] }>;
    };
  }>;
}

export const OFFSEASON_ASSISTANT_NAMES = ['Dana Whitlock', 'Sam Ferreira'] as const;

/** Two plans: the circuit that was run in January, and next Sunday's, written and ready. */
export const OFFSEASON_PRACTICE_PLANS: readonly DemoPracticePlan[] = [
  {
    practiceKey: offSeasonSessionKey(offSeasonSundayOffset(-2)),
    goal: 'Everyone gets a full turn at all three stations.',
    practiceTypes: ['Skills'],
    equipment: ['Tees', 'Screens', 'Short bats', 'Buckets'],
    blocks: [
      {
        id: 'demo-14u-warmup', title: 'Warm-up and throwing progression', minutes: 20,
        description: 'Dynamic work, then the throwing ladder out to sixty feet.',
        goal: 'Arms live before anyone swings.',
        coachingPoints: ['Feet before hands', 'Finish over the front side'],
        staff: [DEMO_COACH_DISPLAY_NAME],
        playerIndexes: null,
      },
      {
        id: 'demo-14u-circuit', title: 'Three-station circuit', minutes: 45,
        description: 'Groups move on every fifteen minutes.',
        goal: 'A full turn at hitting, short hops and bunt defence.',
        staff: [DEMO_COACH_DISPLAY_NAME],
        stations: [
          {
            id: 'demo-14u-stn-tee', name: 'Tee work — inside pitch',
            description: 'Two tees into the near net, ball set on the inner half.',
            goal: 'The barrel turns instead of being pushed.',
            equipment: ['Tees', 'Short bats'], setup: 'Two tees into the near net, ten feet apart.',
            coachingPoints: ['Hands inside it', 'Turn the barrel, do not push it'],
            staff: [DEMO_COACH_DISPLAY_NAME],
          },
          {
            id: 'demo-14u-stn-hops', name: 'Short hops',
            description: 'Partner short hops, forehand and backhand, then bare hand.',
            goal: 'Hands stay soft when the hop is ugly.',
            equipment: ['Buckets'], setup: 'Partners at fifteen feet on the turf.',
            coachingPoints: ['Work through it, not at it', 'Soft hands, quiet feet'],
            staff: [OFFSEASON_ASSISTANT_NAMES[0]],
            note: 'Bare-hand the last two minutes.',
          },
          {
            id: 'demo-14u-stn-bunt', name: 'Bunt defence',
            description: 'Live bunts off the machine with the corners crashing.',
            goal: 'Somebody calls it, every single time.',
            equipment: ['Screens'], setup: 'Machine at half speed, corners at the grass.',
            coachingPoints: ['Call it early and loud', 'Pitcher covers third on the wheel'],
            staff: [OFFSEASON_ASSISTANT_NAMES[1]],
          },
        ],
        rotation: {
          intervalMinutes: 15,
          groups: [
            { id: 'demo-14u-grp-a', name: 'Group A', playerIndexes: [0, 1, 2, 3] },
            { id: 'demo-14u-grp-b', name: 'Group B', playerIndexes: [4, 5, 6, 7] },
            { id: 'demo-14u-grp-c', name: 'Group C', playerIndexes: [8, 9, 10, 11, 12] },
          ],
        },
      },
      {
        id: 'demo-14u-finish', title: 'Baserunning finisher', minutes: null, restOfPractice: true,
        description: 'Reads off the bat from second, two groups, coaches quiet.',
        goal: 'Let them decide, then talk about it.',
        playerIndexes: null,
      },
    ],
  },
  {
    practiceKey: offSeasonSessionKey(offSeasonSundayOffset(1)),
    goal: 'First look at live pitching since the fall.',
    practiceTypes: ['Skills', 'Live'],
    equipment: ['Screens', 'Helmets', 'Buckets'],
    blocks: [
      {
        id: 'demo-14u-next-warmup', title: 'Warm-up and long toss', minutes: 25,
        description: 'Out to a hundred feet, then back down.',
        staff: [DEMO_COACH_DISPLAY_NAME],
        playerIndexes: null,
      },
      {
        id: 'demo-14u-next-live', title: 'Controlled live at-bats', minutes: 40,
        description: 'Two arms up, everyone gets six pitches with a count.',
        goal: 'Compete in a count, not just swing.',
        coachingPoints: ['Take your walk', 'One plan per at-bat'],
        staff: [DEMO_COACH_DISPLAY_NAME, OFFSEASON_ASSISTANT_NAMES[0]],
        playerIndexes: null,
      },
      {
        id: 'demo-14u-next-close', title: 'Season talk', minutes: 10,
        description: 'Schedule, dues, and what the first three weeks look like.',
        playerIndexes: null,
      },
    ],
  },
];

export interface OffSeasonState {
  year: number;
  yearName: string;
  /** Empty, and meant to be: nobody plays anybody in the off-season. Present so the seed's
   *  event/attendance writers take one shape of state, not two. */
  games: DemoGame[];
  practices: DemoPractice[];
  /** Four installment due dates, oldest first (two settled, two ahead). */
  duesDueDates: string[];
  /** When each settled installment was actually paid — a few days before it was due. */
  duesPaidDates: string[];
  expenses: DemoExpense[];
  /** Month-first dates for the budget phasing, oldest first. */
  budgetPeriodDates: string[];
  /** The practice the testing session was run at, and the day it happened. */
  testingSessionPracticeKey: string;
  testingSessionDate: string;
}

/**
 * Off-season, resolved from the clock: Sunday skills sessions running from five weeks back to
 * three weeks ahead, Wednesday cage nights among them, the winter's spending already logged, and
 * dues two installments in.
 *
 * The program year is NEXT season's — an off-season team has rolled over and is building the year
 * it hasn't played yet, which is why its Money screens are the moment's landing place.
 */
export function resolveOffSeasonState(now: Date): OffSeasonState {
  const today = orgDateWithOffset(now, 0);
  const year = Number(today.slice(0, 4)) + 1;
  const dateAt = weekAnchoredDates(now);

  const practices: DemoPractice[] = [];
  const session = (key: string, x: number, time: string, endTime: string, name: string,
                   absent: readonly number[], late: readonly number[]) => {
    const date = dateAt(x);
    const happened = date <= today;
    practices.push({
      key, date, time, startsAtIso: at(date, time), endsAtIso: at(date, endTime),
      happened,
      // Attendance only exists for sessions that have actually been run.
      absent: happened ? absent : [], late: happened ? late : [],
      name,
    });
  };

  // Sunday mornings (Saturday + 1), nine of them: five behind, four from this weekend on.
  for (const week of OFFSEASON_SUNDAY_WEEKS) {
    const x = offSeasonSundayOffset(week);
    session(offSeasonSessionKey(x), x, '10:00', '11:30', 'Sunday skills session',
      week % 2 === 0 ? [3, 9] : [6], week === -2 ? [11] : []);
  }
  // Wednesday cage nights (Saturday + 4 − 7), three across the winter.
  for (const week of [-4, -2, 1]) {
    const x = week * 7 - 3;
    session(`OP-CAGE-${x}`, x, '19:00', '20:15', 'Cage night',
      [2, 8], week === -2 ? [0] : []);
  }
  practices.sort((a, b) => a.date.localeCompare(b.date));

  // Offsets in, dates out — the shared row builder takes a date, and this team thinks in offsets.
  const expense = (key: string, description: string, category: string, amount: number,
                   paidX: number, notes: string | null = null): DemoExpense =>
    demoExpense(key, description, category, amount, dateAt(paidX), notes);

  const expenses: DemoExpense[] = [
    expense('EX-FALL', 'Fall Classic entry', 'Tournaments', 900, -45),
    {
      key: 'EX-SPRING', description: 'Spring Invitational', category: 'Tournaments',
      amount: 1200, type: 'tournament_payable', paidDate: null,
      // Paid a couple of days BEFORE it was due, like every other settled row in this world —
      // the only thing running late here is the dues instalment that is meant to be.
      deposit: { amount: 400, dueDate: dateAt(-30), paidDate: dateAt(-32) },
      balance: { amount: 800, dueDate: dateAt(21), paidDate: null },
      notes: 'Balance due four weeks before the first game.',
    },
    expense('EX-DOME', 'Dome time — January block', 'Facilities', 1150, -38),
    expense('EX-GEAR', 'Jerseys and caps — deposit', 'Team Gear', 1050, -24),
    expense('EX-CAGE', 'Cage rental — eight weeks', 'Training', 700, -17),
    // Deliberately on a category with NO budget line: the report's "unbudgeted" section has to
    // have something honest to report, and a team photo is exactly the sort of thing nobody plans.
    expense('EX-PHOTO', 'Team photo day — deposit', 'Events', 180, -10,
      'Nobody budgeted for this. It happens every year.'),
  ];

  return {
    year,
    yearName: `${year} Season`,
    games: [],
    practices,
    duesDueDates: OFFSEASON_DUES.dueOffsets.map(dateAt),
    duesPaidDates: OFFSEASON_DUES.dueOffsets.map(x => addCalendarDays(dateAt(x), -3)),
    expenses,
    budgetPeriodDates: OFFSEASON_BUDGET_PERIOD_MONTHS.map(offset => monthStart(now, offset)),
    testingSessionPracticeKey: offSeasonSessionKey(offSeasonSundayOffset(-3)),
    testingSessionDate: dateAt(offSeasonSundayOffset(-3)),
  };
}

// ── 10U season start ─────────────────────────────────────────────────────────────────────────

/** 10U — the season-start roster: complete, numbered, every player with a position. */
export const SEASON_START_ROSTER: readonly DemoPlayer[] = [
  { first: 'Micah',  last: 'Underhill', number: '2',  primary: 'P',  secondary: 'SS', bats: 'R', throws: 'R' },
  { first: 'Leni',   last: 'Falk',      number: '3',  primary: 'C',  secondary: '1B', bats: 'R', throws: 'R' },
  { first: 'Amos',   last: 'Trudeau',   number: '5',  primary: '1B', secondary: 'LF', bats: 'L', throws: 'L' },
  { first: 'Sena',   last: 'Adeyemi',   number: '7',  primary: '2B', secondary: 'RF', bats: 'R', throws: 'R' },
  { first: 'Clara',  last: 'Bishopp',   number: '8',  primary: 'SS', secondary: '2B', bats: 'R', throws: 'R' },
  { first: 'Rory',   last: 'Mackinnon', number: '10', primary: '3B', secondary: 'P',  bats: 'L', throws: 'R' },
  { first: 'Nia',    last: 'Baptiste',  number: '12', primary: 'LF', secondary: 'CF', bats: 'R', throws: 'R' },
  { first: 'Tobias', last: 'Halloran',  number: '14', primary: 'CF', secondary: 'SS', bats: 'S', throws: 'R' },
  { first: 'Pearl',  last: 'Nakamura',  number: '15', primary: 'RF', secondary: 'LF', bats: 'L', throws: 'R' },
  { first: 'Ezio',   last: 'Cattaneo',  number: '17', primary: 'P',  secondary: '3B', bats: 'R', throws: 'R' },
  { first: 'Wilma',  last: 'Sorensen',  number: '20', primary: 'C',  secondary: '2B', bats: 'R', throws: 'R' },
  { first: 'Dez',    last: 'Abernathy', number: '21', primary: 'RF', secondary: '1B', bats: 'L', throws: 'L' },
];

/**
 * The opener's lineup — the only one saved, three weeks of season still to write.
 *
 * Authored so a 10U first game reads the way a good one does: nine legal positions every inning,
 * two pitchers at three innings each (the arm-care default), every player at their own primary or
 * secondary position, and NOBODY below four of six in the field. The playing-time story on this
 * team is deliberately unremarkable — the outlier belongs to the 12U, and two teams telling the
 * same cautionary tale would flatten both.
 *
 * ⚠ Hand-authored grids drift silently: the first draft of this one sat two players at three
 * innings, which is the exact shape the 12U's fairness insight exists to flag. The health check
 * asserts the four-inning floor so a future edit cannot reintroduce it unnoticed.
 */
export const SEASON_START_LINEUP_GRID: ReadonlyArray<readonly string[]> = [
  //  0      1       2       3       4     5       6       7       8       9      10      11
  ['P',    'C',    '1B',   '2B',   'SS', '3B',   'LF',   'CF',   'RF',   'Bench','Bench','Bench'], // 1
  ['P',    'C',    '1B',   'RF',   'SS', 'Bench','LF',   'CF',   'Bench','3B',   '2B',   'Bench'], // 2
  ['P',    'Bench','1B',   '2B',   'SS', '3B',   'LF',   'CF',   'Bench','Bench','C',    'RF'],    // 3
  ['Bench','C',    'Bench','RF',   'SS', '3B',   'CF',   'Bench','LF',   'P',    '2B',   '1B'],    // 4
  ['SS',   'C',    '1B',   'Bench','2B', '3B',   'Bench','CF',   'LF',   'P',    'Bench','RF'],    // 5
  ['Bench','C',    'Bench','Bench','SS', '3B',   'LF',   'CF',   'RF',   'P',    '2B',   '1B'],    // 6
];

export const SEASON_START_LINEUP_SETTINGS = {
  maxInningsPerPosition: null,
  pitcherMaxInningsDefault: 3,
  minInningsPerPlayer: 2,
} as const;

/** The batting order the opener was played with — roster indexes, first to last. */
export const SEASON_START_BATTING_ORDER: readonly number[] = [7, 4, 0, 2, 9, 1, 5, 6, 3, 10, 8, 11];

/** Team-reachable categories only — same rule as `OFFSEASON_BUDGET_LINES`, same reason. */
export const SEASON_START_BUDGET_LINES = [
  { description: 'Diamond permits',         category: 'Facilities', total: 1600 },
  { description: 'Umpire fees',             category: 'Officials',  total: 900 },
  { description: 'Jerseys, caps and balls', category: 'Team Gear',  total: 1500 },
  { description: 'Year-end party',          category: 'Events',     total: 400 },
] as const;

/** Dues: $600 a player in four. Eleven of twelve have paid the first — mostly current, one chase. */
export const SEASON_START_DUES = {
  totalAmount: 600,
  installments: 4,
  installmentAmount: 150,
  dueOffsets: [-21, 7, 35, 63] as const,
  /** The one roster index whose first installment is still outstanding. */
  unpaidFirstRosterIndex: 8, // Pearl Nakamura
} as const;

/** The three games already played, oldest first: 2-1, and the loss was the midweek one. */
const SEASON_START_RESULTS: ReadonlyArray<{ r: 'win' | 'loss' | 'tie'; us: number; them: number }> = [
  { r: 'win', us: 8, them: 3 }, { r: 'loss', us: 2, them: 5 }, { r: 'win', us: 6, them: 1 },
];

export interface SeasonStartState {
  year: number;
  yearName: string;
  games: DemoGame[];
  practices: DemoPractice[];
  duesDueDates: string[];
  duesPaidDates: string[];
  /** Opening day — the anchor the nightly re-anchor holds two weeks behind this Saturday. */
  openingDate: string;
  /** Key of the one game carrying a saved lineup. */
  lineupGameKey: string;
  /** The first bills of a young season — the "actual" half of budget-vs-actual (Phase 3). */
  expenses: DemoExpense[];
}

/**
 * Season start, resolved from the clock: opening day is always the Saturday two weeks back, the
 * whole season runs out ahead of it, three games are in the books and the rest are waiting.
 *
 * ⚠ Every DECIDED game sits at `x <= -7` so it is behind us on every weekday (see
 * `weekAnchoredDates`). A scheduled game that drifted into the past without a score would read as
 * a game the coach forgot to write up — the one thing a demo schedule must never look like.
 */
export function resolveSeasonStartState(now: Date): SeasonStartState {
  const today = orgDateWithOffset(now, 0);
  const year = Number(today.slice(0, 4));
  const dateAt = weekAnchoredDates(now);

  const games: DemoGame[] = [];
  const addGame = (key: string, x: number, time: string, resultIndex: number | null,
                   opponentIndex: number, lineupOrder: number | null) => {
    const date = dateAt(x);
    const decided = resultIndex != null ? SEASON_START_RESULTS[resultIndex] : null;
    games.push({
      key, date, time,
      startsAtIso: at(date, time), endsAtIso: at(date, addHours(time, 2)),
      opponent: OPPONENTS[opponentIndex % OPPONENTS.length],
      homeAway: opponentIndex % 2 === 0 ? 'home' : 'away',
      result: decided?.r ?? null,
      teamScore: decided?.us ?? null, opponentScore: decided?.them ?? null,
      lineupOrder,
    });
  };

  // Played: opening Saturday, the Tuesday after it, last Saturday. Only the opener has a lineup.
  addGame('SS-G0', -14, '09:00', 0, 0, 0);
  addGame('SS-G1', -11, '18:15', 1, 1, null);
  addGame('SS-G2', -7, '09:00', 2, 2, null);

  // Ahead: eight more Saturdays and four Tuesday nights — the year, already laid out.
  let opponentIndex = 3;
  for (const week of [0, 1, 2, 3, 4, 5, 6, 7]) {
    addGame(`SS-SAT-${week}`, week * 7, '09:00', null, opponentIndex++, null);
    if ([0, 2, 4, 6].includes(week)) {
      addGame(`SS-TUE-${week}`, week * 7 + 3, '18:15', null, opponentIndex++, null);
    }
  }
  games.sort((a, b) => a.date.localeCompare(b.date));

  // Thursday practices (Saturday + 5 − 7) through the season, two behind and nine ahead.
  const practices: DemoPractice[] = [];
  for (let week = -2; week <= 8; week++) {
    const x = week * 7 - 2;
    const date = dateAt(x);
    const happened = date <= today;
    practices.push({
      key: `SS-P-${x}`, date, time: '17:30',
      startsAtIso: at(date, '17:30'), endsAtIso: at(date, '19:00'),
      happened,
      absent: happened ? (week === -1 ? [4, 11] : [7]) : [],
      late: happened && week === -2 ? [2] : [],
    });
  }

  /**
   * The first bills of a young season (Phase 3) — the up-front ones and nothing else.
   *
   * A team two weeks old should NOT have a full ledger; the point of this moment's books is that
   * the plan is complete and the spending has barely begun, which is a different picture from the
   * 12U's nearly-closed year. Every stamp sits at `x <= -7`, the same settled-fact band the games
   * obey, so nothing here can drift into the future on a Wednesday.
   */
  const expenses: DemoExpense[] = [
    // A DEPOSIT, not the full order — the balance falls due when the jerseys arrive. The first
    // draft paid the gear line off in full, which put a fortnight-old season at 56% of its budget
    // and made the health check fail on its own data. Front-loaded is realistic; already spent is
    // a different team's story, and this moment's whole point is the year still being ahead.
    demoExpense('SS-GEAR', 'Jerseys and caps — deposit', 'Team Gear', 900, dateAt(-28)),
    demoExpense('SS-PERMIT', 'Diamond permits — first half', 'Facilities', 800, dateAt(-21)),
    demoExpense('SS-UMP', 'Umpire fees — opening weekend', 'Officials', 165, dateAt(-7)),
  ];

  return {
    year,
    yearName: `${year} Season`,
    games,
    practices,
    duesDueDates: SEASON_START_DUES.dueOffsets.map(dateAt),
    duesPaidDates: SEASON_START_DUES.dueOffsets.map(x => addCalendarDays(dateAt(x), -3)),
    openingDate: dateAt(-14),
    lineupGameKey: 'SS-G0',
    expenses,
  };
}

// ── 11U tryout day ───────────────────────────────────────────────────────────────────────────

export interface TryoutDayState {
  year: number;
  yearName: string;
  sessions: Array<{ key: string; label: string; date: string; start: string; end: string; startsAtIso: string; endsAtIso: string }>;
  /** ISO instants for registration submissions, oldest first, one per candidate. */
  submittedAtIso: string[];
  checkedInAtIso: string;
  evaluatorExpiryIso: string;
}

/**
 * Tryout day, resolved from the clock: the 11U is choosing NEXT season's roster, sessions are
 * TODAY (morning done, evening ahead, callbacks tomorrow), and registrations arrived over the
 * two weeks before.
 */
export function resolveTryoutDayState(now: Date): TryoutDayState {
  const today = orgDateWithOffset(now, 0);
  const tomorrow = orgDateWithOffset(now, 1);
  const year = Number(today.slice(0, 4)) + 1;
  const session = (key: string, label: string, date: string, start: string, end: string) => ({
    key, label, date, start, end, startsAtIso: at(date, start), endsAtIso: at(date, end),
  });
  return {
    year,
    yearName: `${year} Season`,
    sessions: [
      session('S-AM', 'Morning session — infield focus', today, '09:00', '11:00'),
      session('S-PM', 'Evening session — full squad', today, '17:30', '19:30'),
      session('S-CB', 'Callbacks', tomorrow, '09:00', '10:30'),
    ],
    submittedAtIso: TRYOUT_CANDIDATES.map((_, i) =>
      at(orgDateWithOffset(now, -14 + Math.floor(i / 2)), `${String(8 + (i % 12)).padStart(2, '0')}:${i % 2 === 0 ? '10' : '40'}`)),
    checkedInAtIso: at(today, '08:45'),
    evaluatorExpiryIso: at(tomorrow, '23:00'),
  };
}

export const TRYOUT_DESCRIPTION =
  'Two evaluation sessions plus callbacks. Bring a glove and water; bibs are handed out at check-in. '
  + 'Decisions go out by email within a week of callbacks.';

// ── 13U season's end ─────────────────────────────────────────────────────────────────────────

/**
 * Chronological 26-game season, oldest → newest: 18-6-2 with a five-game win streak (games
 * 8-12) and four one-run games so Wrapped's "closest game" has something to say.
 */
const SEASONS_END_RESULTS: ReadonlyArray<{ r: 'win' | 'loss' | 'tie'; us: number; them: number }> = [
  { r: 'win', us: 6, them: 2 }, { r: 'loss', us: 3, them: 4 }, { r: 'win', us: 8, them: 5 },
  { r: 'win', us: 5, them: 1 }, { r: 'tie', us: 4, them: 4 }, { r: 'loss', us: 2, them: 7 },
  { r: 'win', us: 9, them: 3 }, { r: 'win', us: 4, them: 3 }, { r: 'win', us: 7, them: 2 },
  { r: 'win', us: 3, them: 2 }, { r: 'win', us: 6, them: 0 }, { r: 'win', us: 5, them: 4 },
  { r: 'loss', us: 1, them: 2 }, { r: 'win', us: 8, them: 1 }, { r: 'win', us: 10, them: 6 },
  { r: 'tie', us: 5, them: 5 }, { r: 'win', us: 4, them: 0 }, { r: 'loss', us: 3, them: 6 },
  { r: 'win', us: 7, them: 4 }, { r: 'win', us: 2, them: 1 }, { r: 'win', us: 6, them: 3 },
  { r: 'loss', us: 4, them: 8 }, { r: 'win', us: 9, them: 2 }, { r: 'win', us: 5, them: 2 },
  { r: 'loss', us: 2, them: 3 }, { r: 'win', us: 7, them: 1 },
];

/** Which of the 26 games carry a saved lineup, and which batting order each used. */
export const SEASONS_END_LINEUPS: ReadonlyArray<{ gameIndex: number; order: 'A' | 'B' }> = [
  { gameIndex: 8, order: 'A' }, { gameIndex: 10, order: 'A' }, { gameIndex: 13, order: 'A' }, // 3 wins, one order — the Wrapped lineup fact
  { gameIndex: 16, order: 'B' }, { gameIndex: 18, order: 'B' }, { gameIndex: 21, order: 'B' }, // order B eats a loss — never qualifies
  { gameIndex: 22, order: 'B' }, { gameIndex: 25, order: 'B' },
];

/** Batting orders as roster-index sequences (12 of 13 — Elliott sat the saved-lineup games). */
export const SEASONS_END_BATTING_ORDERS: Record<'A' | 'B', readonly number[]> = {
  A: [9, 5, 7, 3, 0, 6, 1, 10, 4, 8, 11, 2],
  B: [5, 9, 3, 7, 6, 0, 10, 1, 8, 4, 2, 11],
};

export const SEASONS_END_AWARD_TYPES = [
  { name: 'Player of the Game', emoji: '🏅' },
  { name: 'Most Improved', emoji: '📈' },
] as const;

/** Awards: player-of-the-game through the year, Most Improved at the banquet. */
export const SEASONS_END_AWARDS: ReadonlyArray<{ rosterIndex: number; typeIndex: 0 | 1; gameIndex: number | null; note: string | null }> = [
  { rosterIndex: 9, typeIndex: 0, gameIndex: 3, note: 'Two triples and the catch of the year.' },
  { rosterIndex: 0, typeIndex: 0, gameIndex: 10, note: 'Complete-game shutout.' },
  { rosterIndex: 7, typeIndex: 0, gameIndex: 13, note: null },
  { rosterIndex: 4, typeIndex: 0, gameIndex: 19, note: 'Walk-off in the seventh.' },
  { rosterIndex: 11, typeIndex: 0, gameIndex: 23, note: null },
  { rosterIndex: 11, typeIndex: 1, gameIndex: null, note: 'From ninth in the order to leading the team in on-base.' },
];

/** 12 verified guardian links; 9 opened their family recap. */
export const SEASONS_END_FAMILY = { verifiedLinks: 12, recapViews: 9 } as const;

export const SEASONS_END_DUES = { totalAmount: 600, installments: 4, installmentAmount: 150 } as const;

export const SEASONS_END_BUDGET_LINES = [
  { description: 'Diamond rentals', total: 2800 },
  { description: 'Tournament entries', total: 3000 },
  { description: 'Uniforms & caps', total: 1600 },
  { description: 'Umpires', total: 1000 },
] as const;

export interface SeasonsEndState {
  year: number;
  yearName: string;
  games: DemoGame[];
  practices: DemoPractice[];
}

/**
 * Season's End, resolved from the clock: LAST calendar year's season, May → August. Fixed to the
 * calendar (not to today) — a finished year doesn't drift; the re-anchor only moves it when the
 * year itself rolls over.
 */
export function resolveSeasonsEndState(now: Date): SeasonsEndState {
  const year = Number(orgDateWithOffset(now, 0).slice(0, 4)) - 1;

  // First Saturday of May that year, zone-safe.
  const may1 = `${year}-05-01`;
  const firstSat = orgDateFromParts(year, 5, 1 + ((6 - dayOfWeek(may1) + 7) % 7));

  const games: DemoGame[] = [];
  SEASONS_END_RESULTS.forEach((res, i) => {
    // Two games most weekends: Saturday 09:00 and Sunday 11:30, thirteen weeks running.
    const week = Math.floor(i / 2);
    const date = addCalendarDays(firstSat, week * 7 + (i % 2));
    const time = i % 2 === 0 ? '09:00' : '11:30';
    const lineupIndex = SEASONS_END_LINEUPS.findIndex(l => l.gameIndex === i);
    games.push({
      key: `E-${i}`, date, time,
      startsAtIso: at(date, time), endsAtIso: at(date, addHours(time, 2)),
      opponent: OPPONENTS[(i * 5 + 1) % OPPONENTS.length],
      homeAway: i % 2 === 0 ? 'home' : 'away',
      result: res.r, teamScore: res.us, opponentScore: res.them,
      lineupOrder: lineupIndex === -1 ? null : lineupIndex,
    });
  });

  // Wednesday practices through the season, with true-to-life attendance (~89%).
  const practices: DemoPractice[] = [];
  for (let week = 0; week < 12; week++) {
    const date = addCalendarDays(firstSat, week * 7 + 4);
    practices.push({
      key: `EP-${week}`, date, time: '18:00',
      startsAtIso: at(date, '18:00'), endsAtIso: at(date, '19:30'),
      happened: true, // the whole season is last year
      absent: week % 3 === 0 ? [(week + 2) % 13, (week + 7) % 13] : [(week + 5) % 13],
      late: week % 4 === 0 ? [(week + 9) % 13] : [],
    });
  }

  return { year, yearName: `${year} Season`, games, practices };
}

/** `YYYY-MM-DD` from parts (no zone math — these are org-calendar dates by construction). */
function orgDateFromParts(year: number, month: number, day: number): string {
  return addCalendarDays(`${year}-${String(month).padStart(2, '0')}-01`, day - 1);
}
