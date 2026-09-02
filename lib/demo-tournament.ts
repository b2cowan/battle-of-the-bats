/**
 * lib/demo-tournament.ts — the canonical definition of the demo tournament, and the pure
 * function that says what state it should be in RIGHT NOW.
 *
 * Two consumers share this module, which is the whole reason it exists:
 *   • `scripts/seed-demo-tournament.mjs` — creates the org, the event and every row from scratch;
 *   • the scheduled reconcile job — drags the existing rows back to the state this module says
 *     the clock implies.
 * If those two ever disagreed, a replay would produce a different tournament than the seed did,
 * and the "reset loop" would drift. They cannot disagree, because there is one definition here.
 *
 * ── The design decision that shapes everything below (rewritten 2026-09-02) ────────────────────
 *
 * **The state is a PURE FUNCTION of the clock. Nothing is stored.** That part never changed.
 * What changed is what the function describes: not a scoreboard moving in real time, but a fixed
 * daily snapshot. `resolveDemoState(now)` looks only at which CALENDAR DAY `now` falls on — the
 * hour and minute no longer matter — and returns the same story every time: a tournament day
 * where both semifinals are already played and the final is seeded and waiting. Consequences,
 * all of them still good:
 *
 *   • **The nightly date re-anchor is the only thing this job does now.** There is no more tick
 *     and no more reset — those existed to make a live-scoring illusion credible, and there is no
 *     illusion left to maintain. Dates are derived from `now`, so re-anchoring is simply what
 *     every run already does.
 *   • **It is self-healing.** A missed run is not a missed step; the next run computes the state
 *     from the clock and lands on it. There is no accumulated position to get stuck at, which is
 *     the failure mode behind "a frozen live demo is worse than none" — a lesson that still
 *     applies even though nothing here is ever mid-play: a reconcile that silently stopped running
 *     would leave the demo dated in the past, which is exactly as dead a giveaway.
 *   • **It is idempotent.** Running it twice in the same minute writes the same rows twice.
 *   • **No schema change.** There is no cursor, no cycle counter, no job-state table.
 *
 * ── Why nothing is ever live (owner ruling 2026-09-02) ──────────────────────────────────────
 *
 * A visitor can never write to this sandbox — every write path is blocked — so the previous design
 * simulated a live scoreboard purely as spectacle: a semifinal score stepped up minute by minute,
 * a banner counted down to the next "moment," the bracket's championship slot filled itself in
 * while a visitor watched. That was expensive to keep convincing (see the archived
 * `TOURNAMENT_ADMIN_SANDBOX_PLAN.md`'s QA history) for a payoff that is not this sandbox's job
 * anymore: it exists so a prospect can explore functionality, not so they can watch a number move.
 * See `docs/projects/active/TOURNAMENT_SANDBOX_DAILY_SNAPSHOT_PLAN.md` for the full reversal.
 *
 * The fixed daily story, all times in the org's zone, on "today":
 *
 *   12:00  SF2 (seed2 vs seed3) — COMPLETED, real final score.
 *   14:00  SF1 (seed1 vs seed4) — COMPLETED, real final score.
 *   16:00  the Final — SCHEDULED, home slot already seeded with the real top seed's name
 *          (no visitor ever sees the "Winner SF1" placeholder — that transition happened before
 *          they arrived, same as every completed game's transition did).
 *   17:00  the "Up Next" filler game (U13) — SCHEDULED, not yet played. Later than the Final,
 *          deliberately: see `UP_NEXT_HOUR`'s own comment for why.
 *
 * Times are chosen the same way pool play's noon/2pm slots were: never before noon or after 5pm,
 * which is what the schedule-health engine scores as an "edge" game — see `ROUND_ROBIN_SLOTS`'s
 * comment for the fuller story of why that matters here.
 *
 * The Final is never completed and no champion is ever crowned — unchanged from the original
 * design. A demo whose landing state is "this tournament is over" sells nothing, and crowning
 * would reach for the champions/notification path, which the sandbox must never touch.
 *
 * "LIVE" is not a status this job writes, and under the new design nothing in the demo ever
 * qualifies: `lib/game-status.ts` derives liveness from a `scheduled` game's time window
 * containing `now`, and every game here is either `completed` (immune to that check) or scheduled
 * for an hour that is not "right now" for the visitor reading it — except the rare visitor who
 * happens to load the page during the Final's own 16:00 slot, in which case the product's own
 * generic live-window behavior applies honestly: the Final really is scheduled for that hour.
 * That is ordinary platform behavior, not something this demo stages.
 */
// Explicit `.ts` extension (repo convention, `allowImportingTsExtensions`) so this module can be
// imported both by the app and directly by the seed script under Node's type stripping.
import { ORG_TIME_ZONE, utcToZonedInputs } from './timezone.ts';

// ── The fictional world (D1, ratified 2026-08-02) ────────────────────────────────────────────

export const DEMO_ORG_NAME = 'Riverdale Minor Ball Association';
export const DEMO_TOURNAMENT_NAME = 'Riverdale Summer Classic';
export const DEMO_VENUE_NAME = 'Riverdale Community Park';
/**
 * Four diamonds, not two — and the count is load-bearing, not decoration.
 *
 * With two, the two divisions had to be pushed into different time bands to avoid
 * double-booking, which gave their teams wildly different "early / late game" profiles and cost
 * real points on the schedule-health score. With four, both divisions play the same civilised
 * morning hours on their own pair of diamonds: no conflicts, and every team's day looks alike.
 * A four-diamond municipal park is also entirely ordinary, so nothing about it reads as staged.
 */
export const DEMO_FACILITIES = ['Diamond 1', 'Diamond 2', 'Diamond 3', 'Diamond 4'] as const;

/** How many diamonds one division occupies — two games run in parallel per time slot. */
export const FACILITIES_PER_DIVISION = 2;

/** Every contact in the demo is an IANA-reserved address that can never receive mail. */
export const DEMO_CONTACT_DOMAIN = 'example.com';

export interface DemoTeamDef {
  name: string;
  /** Higher wins. Distinct within a division → strictly transitive results → clean seeding. */
  strength: number;
  coach: string;
}

export interface DemoDivisionDef {
  name: string;
  /** Only a bracket division gets playoff games seeded from standings. */
  hasBracket: boolean;
  teams: DemoTeamDef[];
}

export const DEMO_DIVISIONS: readonly DemoDivisionDef[] = [
  {
    name: 'U11',
    hasBracket: true,
    teams: [
      { name: 'Riverdale Rapids',       strength: 4, coach: 'Dana Whitfield' },
      { name: 'Cedar Hollow Cyclones',  strength: 3, coach: 'Priya Raman' },
      { name: 'Maple Ridge Marauders',  strength: 2, coach: 'Aaron Beaulieu' },
      { name: 'Silver Creek Sharks',    strength: 1, coach: 'Rosa Ferreira' },
    ],
  },
  {
    name: 'U13',
    hasBracket: false,
    teams: [
      { name: 'Riverdale Thunder',      strength: 4, coach: 'Marcus Delacroix' },
      { name: 'Cedar Hollow Comets',    strength: 3, coach: 'Ingrid Halloran' },
      { name: 'Maple Ridge Mustangs',   strength: 2, coach: 'Tobias Nakamura' },
      { name: 'Silver Creek Storm',     strength: 1, coach: 'Yvette Ouellette' },
    ],
  },
];

/** Playoff shape for the bracket division — matches what the app's own bracket builder writes. */
export const DEMO_PLAYOFF_CONFIG = {
  type: 'single',
  crossover: 'reseed',
  tieBreakers: ['h2h', 'rd', 'rf', 'ra'],
  hasThirdPlace: false,
  teamsQualifying: 4,
} as const;

/**
 * Tournament settings. Deliberately MINIMAL — the old seed cloned a dev fixture and dragged its
 * clutter along, including a test e-transfer payment instruction with a real-looking address.
 * A sandbox must never show a prospect payment instructions of any kind, so there are none here.
 */
export const DEMO_TOURNAMENT_SETTINGS = {
  format: 'round_robin_playoffs',
  fee_scope: 'tournament',
  tie_breakers: ['h2h', 'rd', 'rf', 'ra'],
  tie_breaker_scope: 'tournament',
  buffer_minutes: 15,
  game_timing_scope: 'tournament',
  game_duration_minutes: 90,
  show_fees_on_register: false,
  payment_instructions_on_form: false,
  roster_require: false,
} as const;

/**
 * 75 minutes, not the 90-minute platform default — and the difference is load-bearing.
 *
 * SF1 sits at 14:00 and the Final at 16:00. At 90 minutes the winner would get a 45-minute
 * turnaround margin either way, which is fine — but the constraint predates the daily-snapshot
 * rewrite and 75 is kept because it still comfortably clears the schedule-health engine's
 * back-to-back threshold and nothing depends on it being wider.
 */
export const DEMO_GAME_DURATION_MINUTES = 75;

// ── Deterministic results ────────────────────────────────────────────────────────────────────

/**
 * The final score of any matchup, decided entirely by the two strengths.
 *
 * Every game in the demo — pool play AND bracket — resolves through this one function, which is
 * what makes the reset loop exactly repeatable: the same teams always produce the same score, so
 * standings, seeding and the bracket are identical on every replay, for ever.
 */
export function deterministicScore(
  homeStrength: number,
  awayStrength: number,
): { homeScore: number; awayScore: number } {
  if (homeStrength === awayStrength) return { homeScore: 5, awayScore: 5 };
  const diff = Math.min(Math.abs(homeStrength - awayStrength), 5);
  const winning = 4 + diff;                            // 5…9
  const losing = Math.max(1, 4 - Math.floor(diff / 2)); // 1…3
  return homeStrength > awayStrength
    ? { homeScore: winning, awayScore: losing }
    : { homeScore: losing, awayScore: winning };
}

/**
 * The final score of a BRACKET game — the semifinals and the (never-played) final.
 *
 * Same rule as `deterministicScore`, scaled up. 14–6 and 10–8 are ordinary youth-ball scores, so
 * nothing about the demo reads as staged. (The scaling originally existed to make a live-stepping
 * score move often enough to be convincing — that mechanic is gone as of the 2026-09-02
 * daily-snapshot rewrite, but the doubled scores are kept: they read fine as final scores on their
 * own and there's no reason to reintroduce the smaller, single-scaled numbers.)
 *
 * ⚠ Deliberately NOT applied to pool play. Standings, run differential and therefore the bracket's
 * seeding are computed from pool games alone, so leaving them at their original scale means the
 * seeding this changes is provably none of it — the health probe's "standings order matches the
 * canonical seeding" check proves that on every run. It also keeps the round robin's scores looking
 * like a round robin rather than every game being a slugfest.
 */
export function deterministicBracketScore(
  homeStrength: number,
  awayStrength: number,
): { homeScore: number; awayScore: number } {
  const base = deterministicScore(homeStrength, awayStrength);
  return { homeScore: base.homeScore * 2, awayScore: base.awayScore * 2 };
}

// ── The round robin ──────────────────────────────────────────────────────────────────────────

/** Pairings for a 4-team round robin, in playing order. Indexes into a division's `teams`. */
export const ROUND_ROBIN_PAIRS: readonly (readonly [number, number])[] = [
  [0, 3], [1, 2],   // day one, both diamonds
  [0, 2], [1, 3],   // day two, morning
  [0, 1], [2, 3],   // day two, midday
];

/**
 * Which day (relative to the event day), which diamond, and which hour each round-robin game
 * sits on. Both diamonds run in parallel, so the two games in a slot are on different fields.
 */
/**
 * Pool play sits at MIDDAY (12:00 and 14:00), never in the morning — a deliberate choice made
 * against the health engine, not for realism.
 *
 * That engine penalises an uneven spread of "edge" games (before noon, after 5pm) across teams.
 * With pool play at 9:00 and 11:00 every real team carried three early games while the Final's
 * unresolved "Winner SF1" slot — a participant with one mid-afternoon game and no edge games at
 * all — sat at zero, and the resulting spread cost twelve points on its own. Since that unresolved
 * slot is the demo's whole centrepiece, the schedule moved instead: with no game in an edge slot,
 * there is no spread to punish. 12:00 and 14:00 are also simply what a summer ball tournament
 * looks like.
 */
// Exported so the Season Opener (lib/demo-moments.ts) derives its slots from this pattern with a
// day shift, instead of retyping the six rows and silently drifting from the Classic's.
export const ROUND_ROBIN_SLOTS: readonly { dayOffset: number; facility: number; hour: number }[] = [
  { dayOffset: -2, facility: 0, hour: 12 },
  { dayOffset: -2, facility: 1, hour: 12 },
  { dayOffset: -1, facility: 0, hour: 12 },
  { dayOffset: -1, facility: 1, hour: 12 },
  { dayOffset: -1, facility: 0, hour: 14 },
  { dayOffset: -1, facility: 1, hour: 14 },
];

/**
 * Which diamond a round-robin game uses. Each division gets its own pair, so both divisions can
 * play the same hours without ever contending for a field — see DEMO_FACILITIES for why that
 * matters to the health score.
 */
export function roundRobinFacilityIndex(gameIndex: number, divisionIndex: number): number {
  return divisionIndex * FACILITIES_PER_DIVISION + ROUND_ROBIN_SLOTS[gameIndex].facility;
}

export const DEMO_BRACKET_CODES = { SF1: 'SF1', SF2: 'SF2', FIN: 'FIN' } as const;

// ── The daily snapshot ───────────────────────────────────────────────────────────────────────

/** Fixed hours-of-day for the bracket story, chosen to stay out of the schedule-health engine's
 *  "edge game" band (before noon / after 5pm) — same reasoning as pool play's own noon/2pm slots. */
const SF2_HOUR = 12;
const SF1_HOUR = 14;
const FINAL_HOUR = 16;
/**
 * As late as the schedule-health engine's "edge game" band allows (17:00 is the last safe hour —
 * see `ROUND_ROBIN_SLOTS`'s comment), so the dashboard's "Up Next" bucket stays populated for as
 * much of the day as possible before this game's own real-time window (17:00–~18:45, duration +
 * grace) arrives and it stops being "still ahead". After that there is nothing later scheduled
 * today, so — like a real tournament whose day has simply ended — "Up Next" legitimately reads
 * empty until the nightly re-anchor. `check-demo-sandbox.mjs` treats that specific, expected gap
 * as a note, not a failure; anything else showing the bucket empty is a real defect.
 */
const UP_NEXT_HOUR = 17;

export interface DemoGameState {
  /** `SF1` / `SF2` / `FIN` for bracket games; `RR-<division>-<n>` for pool games. */
  key: string;
  /** Wall-clock date in the org's zone, `YYYY-MM-DD`. */
  date: string;
  /** Wall-clock time in the org's zone, `HH:MM:SS`. */
  time: string;
  status: 'scheduled' | 'completed';
  homeScore: number | null;
  awayScore: number | null;
}

export interface DemoState {
  /** The event's own day in the org's zone — the day the semifinals and final are played. */
  eventDate: string;
  games: DemoGameState[];
}

/**
 * The date `dayOffset` days from `anchor`, as a wall-clock date in the org's zone.
 * Exported for `lib/demo-moments.ts` — one copy of the demo's date arithmetic, not two.
 *
 * ⚠ Resolves `anchor` to its org-zone CALENDAR DATE first, then shifts that date by whole days —
 * never the other way around. Shifting the INSTANT by `dayOffset * 86_400_000` ms and only then
 * converting to a zoned date (the original implementation) is wrong across a DST transition: near
 * local midnight the day the shift lands on can differ from the day arithmetic on the calendar
 * date would give, because a "day" isn't always 86,400,000ms in wall-clock terms. Verified
 * failure of that version: `now` = 2026-03-09T04:30:00Z (00:30 EDT, the hour after Toronto's
 * spring-forward) shifted by -1 landed on 2026-03-07 — a whole day skipped — and `now` =
 * 2026-11-02T04:30:00Z (23:30 EST, fall-back day) shifted by -1 landed on 2026-11-01, the SAME
 * date as `now` itself. Doing the shift in whole calendar days (via a UTC-flagged synthetic date,
 * which has no DST of its own) sidesteps the problem instead of working around a specific hour.
 */
export function shiftedDate(anchor: Date, dayOffset: number): string {
  const anchorDate = utcToZonedInputs(anchor.toISOString(), ORG_TIME_ZONE).date;
  const [year, month, day] = anchorDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + dayOffset * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** A fixed wall-clock hour on a shifted day. */
function fixedClock(anchor: Date, dayOffset: number, hour: number): { date: string; time: string } {
  return { date: shiftedDate(anchor, dayOffset), time: `${String(hour).padStart(2, '0')}:00:00` };
}

/**
 * What should the demo tournament look like today?
 *
 * Pure: no I/O, no randomness, no hidden state. Given a `now` on the same calendar day (in the
 * org's zone) it always returns the same answer, regardless of the hour or minute — which is what
 * lets the seed and the once-nightly reconcile job agree without talking to each other, and what
 * makes every visitor's view identical no matter when in the day they arrive.
 */
export function resolveDemoState(now: Date = new Date()): DemoState {
  const eventDate = shiftedDate(now, 0);
  const games: DemoGameState[] = [];

  // ── Pool play — complete before the bracket, on the two preceding days ──────────────────────
  // Diamonds are assigned once at seed time and never move, so the per-run state has no opinion
  // about them — only dates, times, statuses and scores.
  DEMO_DIVISIONS.forEach((division) => {
    ROUND_ROBIN_PAIRS.forEach((pair, index) => {
      const slot = ROUND_ROBIN_SLOTS[index];
      const [homeIdx, awayIdx] = pair;
      const home = division.teams[homeIdx];
      const away = division.teams[awayIdx];
      const key = `RR-${division.name}-${index}`;

      // Two deliberate exceptions in the NON-bracket division, both approved in the mockups:
      //   • one finished game left unscored, so the dashboard's "Needs a Score" bucket has a job
      //     in it (a game-day dashboard with nothing to do sells nothing);
      //   • one game scheduled later today, so "Up Next" is populated and the visitor has
      //     somewhere to try entering a score.
      // The bracket division's pool play is always complete — its standings seed the bracket.
      const isNeedsScore = !division.hasBracket && index === 4;
      const isUpNextToday = !division.hasBracket && index === 5;

      if (isUpNextToday) {
        const clock = fixedClock(now, 0, UP_NEXT_HOUR);
        games.push({ key, ...clock, status: 'scheduled', homeScore: null, awayScore: null });
        return;
      }

      const clock = fixedClock(now, slot.dayOffset, slot.hour);
      if (isNeedsScore) {
        games.push({ key, ...clock, status: 'scheduled', homeScore: null, awayScore: null });
        return;
      }

      const score = deterministicScore(home.strength, away.strength);
      games.push({ key, ...clock, status: 'completed', homeScore: score.homeScore, awayScore: score.awayScore });
    });
  });

  // ── The bracket — both semifinals already played, the final seeded and waiting ──────────────
  const bracketDivision = DEMO_DIVISIONS.find(d => d.hasBracket)!;
  const byStrength = [...bracketDivision.teams].sort((a, b) => b.strength - a.strength);
  const [seed1, seed2, seed3, seed4] = byStrength;

  const sf1Final = deterministicBracketScore(seed1.strength, seed4.strength);
  const sf2Final = deterministicBracketScore(seed2.strength, seed3.strength);

  games.push({
    key: DEMO_BRACKET_CODES.SF2, ...fixedClock(now, 0, SF2_HOUR), status: 'completed',
    homeScore: sf2Final.homeScore, awayScore: sf2Final.awayScore,
  });
  games.push({
    key: DEMO_BRACKET_CODES.SF1, ...fixedClock(now, 0, SF1_HOUR), status: 'completed',
    homeScore: sf1Final.homeScore, awayScore: sf1Final.awayScore,
  });
  // The Final. Seeded (the "Winner SF1" slot already resolved to the real top seed — see
  // `reconcileDemoTournament`, which writes that home slot unconditionally now) but never played
  // and never completed — see the header for why the story stops before the last out.
  games.push({
    key: DEMO_BRACKET_CODES.FIN, ...fixedClock(now, 0, FINAL_HOUR), status: 'scheduled',
    homeScore: null, awayScore: null,
  });

  return { eventDate, games };
}

/** The seeds, strongest first — the order the bracket is built from. */
export function demoBracketSeeds(): DemoTeamDef[] {
  const bracketDivision = DEMO_DIVISIONS.find(d => d.hasBracket)!;
  return [...bracketDivision.teams].sort((a, b) => b.strength - a.strength);
}

/** A fictional, unreachable contact address for a team's coach. */
export function demoCoachEmail(teamName: string): string {
  const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `coach-${slug}@${DEMO_CONTACT_DOMAIN}`;
}
