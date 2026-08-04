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
 * ── The design decision that shapes everything below ────────────────────────────────────────
 *
 * **The state is a PURE FUNCTION of the clock. Nothing is stored.**
 *
 * `resolveDemoState(now)` computes which cycle we are in, how far through it we are, and what
 * every game's date, time, status and score should therefore be. The job simply writes that.
 * Consequences, all of them good:
 *
 *   • **The tick, the reset and the nightly date re-anchor are ONE job, not three.** Dates are
 *     derived from `now`, so "re-anchoring" is not a separate operation — it is what every run
 *     already does.
 *   • **It is self-healing.** A missed run is not a missed step; the next run computes the state
 *     from the clock and lands on it. There is no accumulated position to get stuck at, which is
 *     the failure mode behind "a frozen live demo is worse than none".
 *   • **It is idempotent.** Running it twice in the same minute writes the same rows twice.
 *   • **No schema change.** There is no cursor, no cycle counter, no job-state table.
 *
 * ── The cycle ───────────────────────────────────────────────────────────────────────────────
 *
 * Cycles are anchored to absolute epoch time (not to a first-run timestamp), so every server,
 * every job invocation and every reader computes the same phase for the same instant.
 *
 *   t = 0 … 88 min   SF1 is LIVE, its score stepping toward its predetermined final.
 *                    SF2 is already FINAL. The Final reads "Winner SF1" vs Cedar Hollow.
 *   t = 88 … 92 min  SF1 is FINAL. **The Final seeds itself** — "Winner SF1" becomes a real
 *                    team. This is the "the bracket fills itself in" beat.
 *   t = 92 … 120 min The Final is LIVE and stepping.
 *   t = 120          The cycle rolls over and the whole thing resets.
 *
 * Something is live for 116 of every 120 minutes. The four-minute seam is the one moment nothing
 * is moving, and it exists only because the Final needs a legal rest gap after the semifinal.
 *
 * The Final is never completed and no champion is ever crowned — deliberate. A demo whose
 * landing state is "this tournament is over" sells nothing, and crowning would reach for the
 * champions/notification path, which the sandbox must never touch. Every score including the
 * Final's is still deterministic (see `deterministicScore`), so the loop is exactly repeatable;
 * we simply stop the story before the last out. **Deviation from the plan's "hold the champions
 * state briefly" — recorded in the plan's build notes.**
 *
 * "LIVE" is not a status we write. `lib/game-status.ts` decides liveness from the game's time
 * WINDOW, so the only way to make a game read live is to place its window around `now` — which
 * is why the semifinal is anchored to the cycle start rather than to a literal 9:00 AM.
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
 * The semifinal starts at the top of the cycle and the Final at minute 95. At 90 minutes the
 * winner would get a 5-minute turnaround, which the schedule-health engine correctly reports as
 * a rest violation — so the demo would open on a schedule that is already broken, and the whole
 * "break it yourself and watch the score fall" beat would have nothing to fall from. At 75 the
 * gap is 20 minutes, comfortably past the 15-minute back-to-back threshold.
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
 * The final score of a BRACKET game — the one the visitor actually watches tick.
 *
 * Same rule as `deterministicScore`, scaled up, and the scaling is the whole point. A semifinal
 * ending 7–3 is ten runs spread across eighty-eight minutes, so the visible score steps about nine
 * times: a mean gap near ten minutes and a worst gap of thirteen. The plan's definition of done is
 * that a visitor sees the score move within two minutes, and measured against the real clock that
 * was met roughly one time in five — a prospect watches, nothing happens, and they leave.
 *
 * Doubling the runs roughly halves every gap. 14–6 and 10–8 are ordinary youth-ball scores, so
 * nothing about the demo reads as staged.
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

/**
 * A partial score `progress` (0…1) of the way to its final.
 *
 * Runs only ever go up, and the leader is never behind — a live demo that showed a score
 * *decreasing* between two polls would read as a bug, and it is the one thing a visitor watching
 * for thirty seconds would actually notice.
 */
export function partialScore(
  final: { homeScore: number; awayScore: number },
  progress: number,
): { homeScore: number; awayScore: number } {
  const clamped = Math.max(0, Math.min(1, progress));
  return {
    homeScore: Math.floor(final.homeScore * clamped),
    awayScore: Math.floor(final.awayScore * clamped),
  };
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
const ROUND_ROBIN_SLOTS: readonly { dayOffset: number; facility: number; hour: number }[] = [
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

// ── The cycle ────────────────────────────────────────────────────────────────────────────────

export const DEMO_CYCLE_MINUTES = 120;
/**
 * SF1 completes here, and the Final seeds itself.
 *
 * Sits deliberately close to the Final's first pitch below. Between the two, NOTHING is live —
 * the semifinal is over and the Final has not started — and a visitor arriving in that window
 * would find a demo that does not move, with the "scores tick on their own" chip pointing at
 * nothing. The first build left a fifteen-minute hole here (12% of every cycle); four minutes is
 * the most that can be reclaimed while the Final still gets a legal rest gap after the semifinal
 * (the schedule-health engine wants more than 15 minutes; 75-minute games starting at 0 and 92
 * leave 17). The remaining sliver is a coherent state anyway: the bracket has just filled itself
 * in and the Final is moments away.
 */
const SF1_ENDS_AT_MINUTE = 88;
/** The Final's first pitch. */
const FINAL_STARTS_AT_MINUTE = 92;
/** How far ahead of the cycle the already-finished semifinal was played. */
const SF2_MINUTES_BEFORE_CYCLE = 180;

export type DemoPhase = 'semifinal-live' | 'bracket-seeded' | 'final-live';

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
  phase: DemoPhase;
  /** Start of the current cycle (UTC instant). Everything is anchored to this. */
  cycleStart: Date;
  /** Whole minutes elapsed in the current cycle, 0 … DEMO_CYCLE_MINUTES. */
  minuteInCycle: number;
  /** The event's own day in the org's zone — the day the semifinals and final are played. */
  eventDate: string;
  /** True once SF1 is final, i.e. once "Winner SF1" resolves to a real team. */
  finalIsSeeded: boolean;
  games: DemoGameState[];
}

/** The date `dayOffset` days from `anchor`, as a wall-clock date in the org's zone. */
function shiftedDate(anchor: Date, dayOffset: number): string {
  const shifted = new Date(anchor.getTime() + dayOffset * 86_400_000);
  return utcToZonedInputs(shifted.toISOString(), ORG_TIME_ZONE).date;
}

/** `anchor` plus `minutes`, as a wall-clock `{date, time}` pair in the org's zone. */
function shiftedClock(anchor: Date, minutes: number): { date: string; time: string } {
  const shifted = new Date(anchor.getTime() + minutes * 60_000);
  const { date, time } = utcToZonedInputs(shifted.toISOString(), ORG_TIME_ZONE);
  return { date, time: `${time}:00` };
}

/** A fixed wall-clock hour on a shifted day — used for pool play, which is not clock-anchored. */
function fixedClock(anchor: Date, dayOffset: number, hour: number): { date: string; time: string } {
  return { date: shiftedDate(anchor, dayOffset), time: `${String(hour).padStart(2, '0')}:00:00` };
}

/**
 * How far past the cycle's start the "Up Next" filler game sits.
 *
 * Must exceed the 120-minute cycle, or the game slips into the past before the replay is over and
 * the dashboard's "still to come today" bucket empties out. 150 minutes clears it by half an hour.
 */
const UP_NEXT_MINUTES_AFTER_CYCLE_START = 150;

/**
 * When the "Up Next" filler game is played.
 *
 * The dashboard's Up Next bucket means "on the event date, and still ahead of us", so this game has
 * to satisfy BOTH for the whole replay — and the second condition is where the original placement
 * broke. It sat at cycle start + 242 minutes, four hours out, which for the replays that begin late
 * in the evening lands after midnight, on the day AFTER the event date. Measured across a full day
 * of cycle starts: the card emptied for the last stretch of the 8pm and 10pm replays, roughly an
 * hour a day, on the one screen the demo uses to argue that running a tournament is work.
 *
 * A replay that starts at 10pm cannot have a game that is both later today and more than two hours
 * away — the day runs out first. So the late case is clamped to the last minutes of the event date
 * instead, which keeps the card populated for all but the closing moment of that one replay. The
 * demo's games already float with the clock (a 10pm replay is a tournament playing at midnight), so
 * a late game there reads no stranger than the rest of it.
 */
function upNextClock(cycleStart: Date, eventDate: string): { date: string; time: string } {
  const natural = shiftedClock(cycleStart, UP_NEXT_MINUTES_AFTER_CYCLE_START);
  if (natural.date === eventDate) return natural;
  return { date: eventDate, time: '23:58:00' };
}

/**
 * What should the demo tournament look like at this instant?
 *
 * Pure: no I/O, no randomness, no hidden state. Given the same `now` it always returns the same
 * answer — which is what lets the seed and the reconcile job agree without talking to each other.
 */
export function resolveDemoState(now: Date = new Date()): DemoState {
  const cycleMs = DEMO_CYCLE_MINUTES * 60_000;
  const cycleStart = new Date(Math.floor(now.getTime() / cycleMs) * cycleMs);
  const minuteInCycle = Math.floor((now.getTime() - cycleStart.getTime()) / 60_000);

  const phase: DemoPhase =
    minuteInCycle < SF1_ENDS_AT_MINUTE ? 'semifinal-live'
      : minuteInCycle < FINAL_STARTS_AT_MINUTE ? 'bracket-seeded'
        : 'final-live';
  const finalIsSeeded = phase !== 'semifinal-live';

  // The semifinals kick off at the top of the cycle; the whole event hangs off that instant, so
  // "today" is whatever day the cycle start falls on in the org's zone.
  const sf = shiftedClock(cycleStart, 0);
  const eventDate = sf.date;

  // Pool play is anchored to the day the EARLIEST bracket game falls on, not to the event day.
  // The two are usually the same, but when the cycle starts in the small hours the earlier
  // semifinal (three hours back) slips onto the previous calendar day — and if pool play were
  // still measured from the event day, that semifinal would land on a day those teams already
  // played twice, tripping the games-per-day rule and dropping the demo out of "healthy" for a
  // few cycles every night. Measuring from the bracket's own first day keeps them clear.
  const bracketAnchor = new Date(cycleStart.getTime() - SF2_MINUTES_BEFORE_CYCLE * 60_000);

  const games: DemoGameState[] = [];

  // ── Pool play — complete before the bracket, on the two preceding days ──────────────────────
  // Diamonds are assigned once at seed time and never move, so the per-cycle state has no
  // opinion about them — only dates, times, statuses and scores.
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
      //   • one game moved to later today, so "Up Next" is populated and the visitor has
      //     somewhere to try entering a score.
      // The bracket division's pool play is always complete — its standings seed the bracket.
      const isNeedsScore = !division.hasBracket && index === 4;
      const isUpNextToday = !division.hasBracket && index === 5;

      if (isUpNextToday) {
        const clock = upNextClock(cycleStart, eventDate);
        games.push({ key, ...clock, status: 'scheduled', homeScore: null, awayScore: null });
        return;
      }

      const clock = fixedClock(bracketAnchor, slot.dayOffset, slot.hour);
      if (isNeedsScore) {
        games.push({ key, ...clock, status: 'scheduled', homeScore: null, awayScore: null });
        return;
      }

      const score = deterministicScore(home.strength, away.strength);
      games.push({ key, ...clock, status: 'completed', homeScore: score.homeScore, awayScore: score.awayScore });
    });
  });

  // ── The bracket ────────────────────────────────────────────────────────────────────────────
  const bracketDivision = DEMO_DIVISIONS.find(d => d.hasBracket)!;
  const byStrength = [...bracketDivision.teams].sort((a, b) => b.strength - a.strength);
  const [seed1, seed2, seed3, seed4] = byStrength;

  const sf1Final = deterministicBracketScore(seed1.strength, seed4.strength);
  const sf2Final = deterministicBracketScore(seed2.strength, seed3.strength);
  const finFinal = deterministicBracketScore(seed1.strength, seed2.strength);

  // SF2 was played earlier and is already in the books — it is what makes the bracket look like a
  // morning already in progress rather than one that has not started.
  const sf2Clock = shiftedClock(cycleStart, -SF2_MINUTES_BEFORE_CYCLE);
  games.push({
    key: DEMO_BRACKET_CODES.SF2, ...sf2Clock, status: 'completed',
    homeScore: sf2Final.homeScore, awayScore: sf2Final.awayScore,
  });

  // SF1 is the one the visitor watches. Live and stepping until it lands on its final.
  const sf1Live = phase === 'semifinal-live';
  const sf1Score = sf1Live
    ? partialScore(sf1Final, minuteInCycle / SF1_ENDS_AT_MINUTE)
    : sf1Final;
  games.push({
    key: DEMO_BRACKET_CODES.SF1, date: sf.date, time: sf.time,
    status: sf1Live ? 'scheduled' : 'completed',
    homeScore: sf1Score.homeScore, awayScore: sf1Score.awayScore,
  });

  // The Final. Scheduled and empty until the semifinal ends, then live and stepping. Never
  // completed — see the header for why the story stops before the last out.
  const finClock = shiftedClock(cycleStart, FINAL_STARTS_AT_MINUTE);
  const finLive = phase === 'final-live';
  const finScore = finLive
    ? partialScore(finFinal, (minuteInCycle - FINAL_STARTS_AT_MINUTE) / (DEMO_CYCLE_MINUTES - FINAL_STARTS_AT_MINUTE))
    : { homeScore: null as number | null, awayScore: null as number | null };
  games.push({
    key: DEMO_BRACKET_CODES.FIN, ...finClock, status: 'scheduled',
    homeScore: finScore.homeScore, awayScore: finScore.awayScore,
  });

  return { phase, cycleStart, minuteInCycle, eventDate, finalIsSeeded, games };
}

// ── What the sandbox chrome shows about the live game ────────────────────────────────────────

/**
 * The live beat: what is happening in the demo right now, and — the part that matters — WHEN the
 * score last moved.
 *
 * The demo's headline claim is "scores update on their own", but measured against the real clock
 * the visible score changes about nine times in the semifinal's eighty-eight minutes: a mean gap
 * near ten minutes and a worst gap of thirteen. A prospect who watches for ninety seconds usually
 * sees nothing, concludes the demo is a screenshot, and leaves. Making the score race would be a
 * lie; showing how fresh it is, is not. "Changed 1:12 ago" is a claim that keeps proving itself
 * every second, between the changes.
 *
 * Computed purely from the clock, exactly like every other demo fact — so the API route that
 * serves it touches no database at all.
 */
export interface DemoLiveBeat {
  /** `live` — a game is in progress. `between` — the four-minute seam while the bracket seeds. */
  kind: 'live' | 'between';
  /** Fan-language round name, e.g. "Semifinal". */
  label: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  /**
   * Epoch ms of the most recent moment either score stepped up — or first pitch, while the game
   * is still scoreless. Never null: "0:00 since the first pitch" is a truthful freshness reading.
   */
  lastChangedAtMs: number;
  /**
   * Epoch ms of the next moment the score will step up. Null only when this game has no runs left
   * to score before its phase ends.
   *
   * This exists because a demo that says "watch the score change by itself" and then shows a static
   * number for the next five minutes has told a lie the visitor can catch. Owner, second QA pass:
   * *"when I clicked watch the score change, the score did not change, it stayed 3-8."* It had in
   * fact moved five minutes later — but the promise was made in the present tense.
   *
   * We can be exact about this, which is unusual and worth using: the demo's entire state is a pure
   * function of the clock, so the next run is not a guess. Telling a stranger "the next one lands in
   * about ninety seconds" turns dead waiting into something to watch for.
   */
  nextChangeAtMs: number | null;
  /** `between` only: epoch ms of the Final's first pitch, so the seam can count down to it. */
  nextStartsAtMs: number | null;
}

/**
 * The minute at which a scoreboard reading of `value` first appeared, given a game that runs from
 * `startMinute` for `spanMinutes` and finishes on `finalValue`.
 *
 * `partialScore` floors `finalValue × progress`, so the reading steps up to `value` at the first
 * whole minute where that product reaches it — the inverse being `ceil(span × value / final)`.
 * A scoreless reading has never stepped, so its answer is first pitch.
 */
function minuteScoreReached(
  value: number,
  finalValue: number,
  startMinute: number,
  spanMinutes: number,
): number {
  if (value <= 0 || finalValue <= 0) return startMinute;
  return startMinute + Math.ceil((spanMinutes * value) / finalValue);
}

/**
 * The minute at which this side's score will next step up, or null when it has none left to score.
 *
 * The same question as `minuteScoreReached`, asked one run ahead — so it defers to that function
 * rather than restating the rounding rule, which would then have to be corrected in two places.
 */
function minuteOfNextRun(
  value: number,
  finalValue: number,
  startMinute: number,
  spanMinutes: number,
): number | null {
  if (value >= finalValue) return null;
  return minuteScoreReached(value + 1, finalValue, startMinute, spanMinutes);
}

/** What the sandbox chrome should say about the game on the field right now. */
export function resolveDemoLiveBeat(now: Date = new Date()): DemoLiveBeat {
  const state = resolveDemoState(now);
  const cycleStartMs = state.cycleStart.getTime();
  const atMinute = (minute: number) => cycleStartMs + minute * 60_000;

  const [seed1, seed2, , seed4] = demoBracketSeeds();

  if (state.phase === 'bracket-seeded') {
    // Nothing is on the field, and that is the single most interesting moment in the demo: the
    // semifinal has just ended and the bracket is filling itself in. The chrome says so rather
    // than going quiet, which is what used to make the tour's first step look broken.
    const sf1 = deterministicBracketScore(seed1.strength, seed4.strength);
    return {
      kind: 'between',
      label: 'Semifinal just ended',
      homeName: seed1.name,
      awayName: seed4.name,
      homeScore: sf1.homeScore,
      awayScore: sf1.awayScore,
      lastChangedAtMs: atMinute(SF1_ENDS_AT_MINUTE),
      // The next thing that moves in the seam is the final's first pitch, not a run.
      nextChangeAtMs: atMinute(FINAL_STARTS_AT_MINUTE),
      nextStartsAtMs: atMinute(FINAL_STARTS_AT_MINUTE),
    };
  }

  const isSemifinal = state.phase === 'semifinal-live';
  const opponent = isSemifinal ? seed4 : seed2;
  const startMinute = isSemifinal ? 0 : FINAL_STARTS_AT_MINUTE;
  const spanMinutes = isSemifinal
    ? SF1_ENDS_AT_MINUTE
    : DEMO_CYCLE_MINUTES - FINAL_STARTS_AT_MINUTE;

  const final = deterministicBracketScore(seed1.strength, opponent.strength);
  const shown = partialScore(final, (state.minuteInCycle - startMinute) / spanMinutes);

  // Whichever side stepped most recently is when the scoreboard last changed.
  const lastChangedMinute = Math.max(
    minuteScoreReached(shown.homeScore, final.homeScore, startMinute, spanMinutes),
    minuteScoreReached(shown.awayScore, final.awayScore, startMinute, spanMinutes),
  );

  // Whichever side scores SOONEST is the next thing the visitor will see move.
  const nextRunMinutes = [
    minuteOfNextRun(shown.homeScore, final.homeScore, startMinute, spanMinutes),
    minuteOfNextRun(shown.awayScore, final.awayScore, startMinute, spanMinutes),
  ].filter((m): m is number => m !== null);
  const nextRunMinute = nextRunMinutes.length > 0 ? Math.min(...nextRunMinutes) : null;

  /**
   * A run predicted AT or PAST the cycle boundary never actually lands.
   *
   * The Final's last runs are scheduled for minute 120 by the arithmetic — but the demo never
   * completes the Final (see the header: a landing state of "this tournament is over" sells
   * nothing), so at minute 120 the whole thing replays instead. Left unguarded, the chrome spent
   * the closing two minutes of every cycle counting down to a run that resolves as the tournament
   * resetting to 0–0 — which is precisely the "watch the score change" promise-then-don't that this
   * countdown was added to eliminate. Null here means the chrome simply says nothing; the banner's
   * own "Replays in mm:ss" is already telling the truth about what happens next.
   */
  const nextChangeAtMs = nextRunMinute !== null && nextRunMinute < DEMO_CYCLE_MINUTES
    ? atMinute(nextRunMinute)
    : null;

  return {
    kind: 'live',
    label: isSemifinal ? 'Semifinal' : 'Championship',
    homeName: seed1.name,
    awayName: opponent.name,
    homeScore: shown.homeScore,
    awayScore: shown.awayScore,
    lastChangedAtMs: atMinute(lastChangedMinute),
    nextChangeAtMs,
    nextStartsAtMs: null,
  };
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
