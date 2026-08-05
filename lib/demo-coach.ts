/**
 * lib/demo-coach.ts — the Coach Sandbox's fictional world, and where it sits in time.
 *
 * One club — **Riverdale Ridge Baseball** — three teams, each frozen at a different moment of a
 * season (`COACH_SANDBOX_SEASON_PHASES_PLAN.md`, Phase 1):
 *
 *   · 11U — TRYOUT DAY.   Evaluations are running right now: sessions today, three evaluator
 *                          links, partial blind scores, one deliberate split opinion.
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

export const DEMO_COACH_TEAMS: Record<'tryoutDay' | 'midSeason' | 'seasonsEnd', DemoCoachTeamDef> = {
  tryoutDay: {
    id: DEMO_COACH_TEAM_IDS.tryoutDay,
    name: 'Riverdale Ridge 11U', slug: 'ridge-11u', division: '11U', color: '#1E3A8A',
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
  { name: 'Dana Kowalski',  scoredCount: 19, drift: -1 }, // reads harsh — the bias flag fires
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

/** Dues: $480/player in 4 × $120. Two families each sit on one overdue $120 → $240 outstanding. */
export const MIDSEASON_DUES = {
  totalAmount: 480,
  installments: 4,
  installmentAmount: 120,
  /** Roster indexes whose LAST installment is unpaid and past due. */
  overdueRosterIndexes: [6, 10] as const, // Dmitri Kovac, Imani Brooks
} as const;

export const MIDSEASON_BUDGET_LINES = [
  { description: 'Diamond rentals', total: 3200 },
  { description: 'Tournament entries', total: 2400 },
  { description: 'Uniforms & caps', total: 1800 },
  { description: 'Umpires', total: 1100 },
  { description: 'Equipment', total: 900 },
] as const;

/** Everyone but Wes (index 2) has a signed waiver on file — the "1 unsigned" beat. */
export const MIDSEASON_UNSIGNED_WAIVER_INDEX = 2;

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

  return { year, yearName: `${year} Season`, games, practices, saturdayDate };
}

/** `HH:MM` plus whole hours (events are same-day; the demo never schedules across midnight). */
function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  return `${String(Math.min(23, h + hours)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
