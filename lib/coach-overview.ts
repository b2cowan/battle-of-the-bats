// Pure decision logic for the Premium Coaches Portal team Overview (Chunk I, "The One Thing").
//
// WHY THIS MODULE EXISTS
// ----------------------
// The Overview used to render NINE independent bands, each testing its own predicate, in source
// order, with no priority between them. Two of them shipped opposite instructions off the SAME
// state: the in-season lull card ("Add an event") fired on `in_season && !nextEvent`, and the
// winding-down cue ("Close out the season") fired on that predicate PLUS four more facts. The cue's
// predicate is a STRICT SUPERSET, so whenever it could render the lull card was already wrong — and
// both drew. A coach was told to book an event and to close the season, in two stacked cards.
//
// The fix is not copy. It is a single ordered resolver: exactly one anchor may render, and a more
// specific state REPLACES the general state it is a superset of (design log 2026-07-30, rule 1).
//
// Selection lives here — PURE and unit-tested — because selection is where the defect was. Copy and
// formatting stay in the page: a resolver that also owned sentences would be untestable at the size
// that matters, and every future card would have to touch this file.
//
// D14, the rule that makes this safe: STATE PROPOSES, CAPABILITY DISPOSES. With only one action on
// the page, showing an action the coach cannot complete makes the whole page useless — so a
// candidate is only eligible if this coach can COMPLETE it. Gates here mirror
// `lib/coach-capabilities` ("can complete"), never `lib/coach-nav-visibility` ("can see").

import type { CoachRepPhase } from './coach-rep-phase';
import {
  type CoachCapabilities,
  canViewMoney,
  canViewRoster,
  canManageSchedule,
  canViewSchedule,
  canViewDevelopmentGoals,
} from './coach-capabilities';
import { isCoachNavItemVisible } from './coach-nav-visibility';

// ── The one thing ────────────────────────────────────────────────────────────

/** Which situation won the single anchor slot. */
export type AnchorKind = 'welcome' | 'game_day' | 'next_event' | 'season_check' | 'lull' | 'preseason';

/**
 * The three shapes one card can take (design log 2026-07-30, rule 3). The desktop mockups framed
 * this as "always a question"; that was CORRECTED at the mobile pass because game day is not a
 * decision — it is work, and turning the portal's highest-value moment into a prompt would have
 * been a regression.
 */
export type AnchorShape = 'working' | 'question' | 'next_step';

/** The primary action. `null` means the card renders INFORMATIONALLY — never a disabled button. */
export type AnchorAction =
  | 'build_lineup'
  | 'take_attendance'
  | 'open_schedule'
  | 'add_event'
  | 'close_season'
  | 'setup_step'
  /** Chunk B — opens the portal tour drawer. Not a navigation; the page owns the handler. */
  | 'take_tour';

/** Secondary text answers, rendered as one row (never a stack of buttons — rule 8). */
export type AnchorAnswer =
  | 'take_attendance'
  | 'open_schedule'
  | 'add_event'
  | 'view_tournaments'
  | 'not_yet'
  | 'got_it'
  | 'skip_step'
  /** Chunk B — the pre-season door the welcome INHERITS when it replaces that card (rule 2). */
  | 'setup_step';

export interface AnchorInput {
  phase: CoachRepPhase;
  hasNextEvent: boolean;
  /** The next event is a game (league / tournament / scrimmage), not a practice or team event. */
  nextIsGame: boolean;
  /**
   * The winding-down predicate, already evaluated by the caller: a real finalized game exists,
   * nothing is scheduled ahead, no registered tournament is coming, the team has been quiet
   * >= 14 days, and the coach has not dismissed it this season.
   */
  seasonWindingDown: boolean;
  /** A still-open setup step exists that THIS coach can complete (already capability-filtered). */
  hasOpenSetupStep: boolean;
  /**
   * Chunk B (P1 #12) — has this coach never been offered the portal tour, on a team that has not
   * been used yet? The account-scoped `tourDismissed` preference is what retires it, so this can
   * only ever be true BEFORE the coach takes or skips the tour once, on any team.
   *
   * Deliberately several facts, not one. `tourDismissed` alone would welcome an established coach
   * on a brand-new team they just rolled into; "no activity" alone would re-welcome someone who
   * already took the tour every time they started a season. Both together describe exactly the
   * person P1 #12 is about: a paying coach who never had a free team and has just arrived.
   *
   * The caller also folds in the Quiet Mode hints switch — a welcome IS a hint, and that switch is
   * independent of the tour flag, so a coach who turned hints off must not be met by one.
   */
  isColdStart: boolean;
  /** A registered tournament is upcoming or live — the lull card's second door. */
  hasUpcomingTournament: boolean;
  /** The caller's FULL resolved capabilities — gates below go through the exported predicates. */
  caps: CoachCapabilities;
  /**
   * Standalone head coach or club admin — the only people who can close a season. Not a capability:
   * it comes from the season's management scope, so it is passed alongside rather than folded in.
   */
  canManageSeasons: boolean;
}

export interface AnchorDecision {
  kind: AnchorKind;
  shape: AnchorShape;
  /** `null` ⇒ informational card: it keeps its sentence and drops its button. */
  primary: AnchorAction | null;
  answers: AnchorAnswer[];
}

/**
 * The event-shaped fallback chain, shared by game day and the next-event card so the two can never
 * diverge: Build lineup → Take attendance → Open schedule → informational.
 *
 * Game day and next-event NEVER yield to a later candidate when their gates fail. Opponent, time and
 * place matter to every coach on the staff, so the card stays and loses its button instead — the
 * alternative would show a coach without lineup access a "season is winding down" card on the
 * morning of a game.
 */
function eventActions(nextIsGame: boolean, caps: CoachCapabilities): Pick<AnchorDecision, 'primary' | 'answers'> {
  // ⚠ 2026-08-03: this door OPENS the schedule, so it wants the VIEW half of the split — not the
  // half that adds and cancels events. Both are true for every coach invited before the split, so
  // this changes no behaviour; it stops the wrong one being inherited by the next reader.
  const canSchedule = canViewSchedule(caps);
  if (!nextIsGame) {
    // A practice or team event: there is no lineup and attendance is the only real preparation.
    if (caps.attendance) return { primary: 'take_attendance', answers: canSchedule ? ['open_schedule'] : [] };
    return { primary: canSchedule ? 'open_schedule' : null, answers: [] };
  }
  if (caps.lineups) {
    return { primary: 'build_lineup', answers: caps.attendance ? ['take_attendance'] : [] };
  }
  if (caps.attendance) {
    return { primary: 'take_attendance', answers: canSchedule ? ['open_schedule'] : [] };
  }
  return { primary: canSchedule ? 'open_schedule' : null, answers: [] };
}

/**
 * Resolve the ONE anchor. First match wins; every later candidate is discarded.
 *
 * Order (design log 2026-07-30, rule 1; welcome added by Chunk B):
 *   0. welcome         — first visit, never toured  ← STRICT SUPERSET of (5); tested FIRST
 *   1. game day        — a game is today
 *   2. next event      — something is scheduled ahead
 *   3. season check    — winding down  ← STRICT SUPERSET of (4); must be tested FIRST
 *   4. in-season lull  — nothing scheduled, season still open
 *   5. pre-season      — the next setup step
 *
 * Returns `null` for D15: nothing is actionable for this coach, so no card renders and the page
 * opens on the board. A calm board beats narrating a situation the reader cannot act on.
 */
export function resolveOverviewAnchor(input: AnchorInput): AnchorDecision | null {
  const { phase, hasNextEvent, nextIsGame, seasonWindingDown, hasOpenSetupStep, hasUpcomingTournament, caps, canManageSeasons, isColdStart } = input;
  // ⚠ TWO answers since the 2026-08-03 split, and this function needs both. `canSchedule` gates the
  // "add an event" DOOR (a write); `canSeeSchedule` gates any card that makes a CLAIM about what is
  // or isn't on the calendar. Conflating them is how a coach who cannot see the schedule gets told,
  // confidently, that there is nothing on it.
  const canSchedule = canManageSchedule(caps);
  const canSeeSchedule = canViewSchedule(caps);

  // (0) Chunk B (P1 #12). A cold-signup coach IS a pre-season coach plus two extra facts, so this is
  // the same superset relation as (3)→(4): the specific state REPLACES the general one rather than
  // stacking beside it. A welcome BANNER next to the anchor would have re-created the exact
  // nine-independent-bands defect this resolver exists to remove.
  //
  // It inherits the replaced card's door (rule 2): "Add your players instead" carries the setup step
  // the welcome displaced, so a coach who would rather get on with it loses nothing. The inherited
  // answer is offered only when a step actually exists AND this coach can complete it — the same
  // capability filter the pre-season card applies, since `hasOpenSetupStep` arrives pre-filtered.
  //
  // Rule 4 (state proposes, capability disposes) is satisfied for free: every coach can take a tour,
  // so this card can never be the button-less variant.
  //
  // Only reachable in pre-season. A coach arriving mid-season to a live team meets their real
  // situation — a game today outranks an introduction, and this must never displace game day.
  if (isColdStart && phase === 'preseason') {
    return {
      kind: 'welcome',
      shape: 'next_step',
      primary: 'take_tour',
      answers: hasOpenSetupStep ? ['setup_step'] : [],
    };
  }

  // Every event-shaped candidate reads from the events fetch, which a coach without schedule
  // access never makes. Without it the page has NO event data — so these cards could only ever
  // announce "nothing scheduled" to someone simply not permitted to see the schedule.
  if (canSchedule && hasNextEvent && phase === 'game_day') {
    return { kind: 'game_day', shape: 'working', ...eventActions(nextIsGame, caps) };
  }

  if (canSchedule && hasNextEvent && phase === 'in_season') {
    return { kind: 'next_event', shape: 'working', ...eventActions(nextIsGame, caps) };
  }

  // (3) before (4). This single ordering is the defect fix.
  if (seasonWindingDown) {
    const canClose = canManageSeasons;
    const answers: AnchorAnswer[] = [];
    // D2 — a state that REPLACES another inherits the replaced card's door. Suppressing the lull
    // card must not cost the coach the "add an event" answer it was offering.
    if (canSchedule) answers.push('add_event');
    answers.push(canClose ? 'not_yet' : 'got_it');
    return {
      kind: 'season_check',
      shape: 'question',
      // A coach who cannot close the season keeps the sentence and loses the button — the club
      // closes it, and their Wrapped appears when it does. Already the shipped cue behaviour.
      primary: canClose ? 'close_season' : null,
      answers,
    };
  }

  /**
   * ⚠ Needs BOTH halves, and for two different reasons.
   *
   * "Nothing on your schedule" is a CLAIM — without view access there is no event data, so it would
   * be a confident wrong answer rather than a fact. And the card's whole shape is a single next
   * step, "Add an event": to someone who can see the schedule but not change it, it would be a
   * statement with no action, which is a control that exists only to refuse. Neither half alone
   * earns this card, so it yields to the board rather than rendering half of itself.
   */
  if (canSeeSchedule && canSchedule && phase === 'in_season' && !hasNextEvent) {
    return {
      kind: 'lull',
      shape: 'next_step',
      primary: 'add_event',
      // When a registered tournament is what is keeping the season alive, the card is ABOUT that
      // tournament — so it keeps a door to it. Dropping this link was a silent loss in the rewrite.
      answers: hasUpcomingTournament ? ['view_tournaments'] : [],
    };
  }

  if (phase === 'preseason' && hasOpenSetupStep) {
    return { kind: 'preseason', shape: 'next_step', primary: 'setup_step', answers: ['skip_step'] };
  }

  return null;
}

// ── The board ────────────────────────────────────────────────────────────────

export type TileKey =
  | 'record'
  | 'roster'
  | 'schedule'
  | 'tournaments'
  | 'dues'
  | 'budget'
  | 'moneySetup'
  | 'attendance'
  | 'playingTime'
  | 'development';

/**
 * The schedule slot's two faces. When the anchor is already about what's next, repeating it in a
 * tile is the "say it three times" defect — so the slot reports a DIFFERENT fact (this week's
 * counts + birthdays) instead of being removed, which would leave a five-tile board in the single
 * most common state.
 *
 * This refines D3 ("the anchor's subject drops out of the tile row") rather than contradicting it:
 * the SUBJECT (what's next) does drop out; the slot is reused rather than emptied.
 */
export type ScheduleFace = 'nextUp' | 'thisWeek';

export interface BoardInput {
  phase: CoachRepPhase;
  /** The winning anchor, so its subject can drop out of the tile row. */
  anchorKind: AnchorKind | null;
  caps: CoachCapabilities;
  /**
   * Has this team started using money AT ALL (a budget is set, or dues installments exist)?
   *
   * D16 — while a money-capable coach has neither, the pair COLLAPSES to one "set up your team's
   * money" tile and the freed slot fills with Attendance: two muted tiles side by side spent a
   * third of a phone screen saying "not set" and read as a broken product to the exact coach least
   * able to judge. This is the ONE documented exception to the fixed-set rule, and it is keyed on a
   * once-per-season lifecycle transition rather than a fluctuating value — so the board still
   * cannot reshuffle underneath a coach mid-season.
   *
   * **`null` = not known yet.** This matters: the answer arrives over a fetch, and guessing either
   * way makes two tiles CHANGE IDENTITY after first paint (label, icon and destination all move)
   * for one population or the other — which is precisely the spatial-memory guarantee above. When
   * it is `null` the two slots are reported as PENDING instead, so the board never claims a tile it
   * may have to take back.
   */
  moneyStarted: boolean | null;
}

export interface BoardDecision {
  slots: TileKey[];
  scheduleFace: ScheduleFace;
  /**
   * How many trailing slots are still undecided. The caller renders this many neutral placeholders
   * — a placeholder makes no identity claim, so resolving it into a real tile is not a reshuffle.
   */
  pendingSlots: number;
}

/**
 * Preference order per phase — most time-sensitive first. Every key appears in every list so a
 * selected tile always has a rank; unselected keys are simply never looked up.
 */
const TILE_ORDER: Record<CoachRepPhase, TileKey[]> = {
  preseason: ['roster', 'schedule', 'moneySetup', 'dues', 'budget', 'attendance', 'playingTime', 'development', 'record', 'tournaments'],
  in_season: ['dues', 'moneySetup', 'budget', 'attendance', 'playingTime', 'development', 'record', 'roster', 'schedule', 'tournaments'],
  game_day: ['roster', 'record', 'attendance', 'playingTime', 'development', 'schedule', 'dues', 'moneySetup', 'budget', 'tournaments'],
  result: ['record', 'tournaments', 'dues', 'moneySetup', 'budget', 'attendance', 'playingTime', 'development', 'roster', 'schedule'],
};

/** The board is capped at six: past that a phone stops being scannable and becomes a list. */
export const BOARD_SLOT_COUNT = 6;

/**
 * The coaching pair — the two season-health tiles a coach without money access gets in slots 5–6,
 * and the source of the freed slot when the money pair collapses (D16).
 *
 * Exported because the PAGE needs the same answer before it fetches: these tiles are the only ones
 * backed by their own request, and firing those requests for a tile the board will not show is two
 * wasted round trips on a landing page. One function, so the fetch gate and the board can never
 * disagree about what is needed.
 *
 * Gated on nav visibility rather than raw capability flags: a tile is a DOOR, and the question
 * "may this coach open Attendance / Development" already has exactly one owner.
 */
export function resolveCoachingPair(caps: CoachCapabilities): TileKey[] {
  const pair: TileKey[] = [];
  if (isCoachNavItemVisible(caps, 'Attendance')) pair.push('attendance');
  // Playing time reads the season's saved lineups; without that access it falls back to
  // Development, then to a shorter board. A documented chain, never a ranked list.
  if (caps.lineups) pair.push('playingTime');
  // The Development SECTION is visible to anyone with roster view (measurables ride roster), but
  // this tile's value is a GOAL COUNT, and goals are notes-gated — the route redacts them without
  // that grant. Gating the tile on section visibility would print a confident "No goals yet" at a
  // coach who simply is not cleared to see them. A tile is only offered when its NUMBER is real.
  else if (canViewDevelopmentGoals(caps)) pair.push('development');
  return pair;
}

/**
 * Compose the board: a FIXED set of tiles in a VARIABLE order (rule 5), so a coach keeps their
 * spatial memory as the season changes state. The only removals are capability-driven.
 *
 * Slots 5–6 are a season-health PAIR resolved once by capability:
 *   money access    → Dues + Budget      (who owes me / am I overspending)
 *   no money access → Attendance + Playing time  (is my squad showing up / is everyone playing)
 *
 * Both pairs sit at the same altitude and neither is visible at a glance anywhere else today.
 * Playing time falls back to Development, then to a shorter board — a documented chain, never a
 * ranked list that could reshuffle week to week.
 */
export function resolveBoard(input: BoardInput): BoardDecision {
  const { phase, anchorKind, caps, moneyStarted } = input;

  const selected: TileKey[] = [];
  // ⚠ VIEW half (2026-08-03). Both tiles below REPORT — the record and what is next — and neither
  // asks the coach to change anything, so they ride the ability to see the schedule rather than the
  // ability to edit it. Unchanged for every coach invited before the split, who holds both.
  const canSchedule = canViewSchedule(caps);

  // Always-on four (capability-filtered).
  // The record is derived from the season's games, so without schedule access it would read as
  // "no record" rather than "not yours to see".
  if (canSchedule) selected.push('record');
  if (canViewRoster(caps)) selected.push('roster');
  if (canSchedule) selected.push('schedule');
  selected.push('tournaments');

  // The season-health pair. A tile is a DOOR into a section, so its gate is the same one that
  // decides whether that section appears in the coach's navigation — asking the question a second
  // way here is how a tile ends up linking somewhere the coach cannot open.
  const coachingPair = resolveCoachingPair(caps);
  let pendingSlots = 0;

  if (canViewMoney(caps)) {
    if (moneyStarted === null) {
      // Not known yet — claim nothing. Two placeholders hold the space until the answer lands.
      pendingSlots = 2;
    } else if (moneyStarted) {
      selected.push('dues', 'budget');
    } else {
      // D16 — collapse, and hand the freed slot to the first available coaching tile.
      selected.push('moneySetup');
      if (coachingPair.length > 0) selected.push(coachingPair[0]);
    }
  } else {
    selected.push(...coachingPair);
  }

  const order = TILE_ORDER[phase] ?? TILE_ORDER.in_season;
  const slots = selected
    .slice()
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .slice(0, BOARD_SLOT_COUNT - pendingSlots);

  // The anchor's subject drops out: when the card is already about what's next, the schedule slot
  // reports this week instead of repeating it.
  const anchorIsAboutNextEvent = anchorKind === 'game_day' || anchorKind === 'next_event';

  return { slots, scheduleFace: anchorIsAboutNextEvent ? 'thisWeek' : 'nextUp', pendingSlots };
}

/**
 * Which coaching tiles the board will ACTUALLY draw — the exact subset, including D16's rule that
 * a collapsed money pair frees only ONE slot.
 *
 * The page uses this to decide which of the two tile-backed requests to fire. It exists because
 * `resolveCoachingPair` returns everything ELIGIBLE, which is a superset: a coach with money access
 * but nothing set up gets `moneySetup` + one coaching tile, so fetching for the second one is a
 * wasted round trip on the landing page. Unit-tested in both directions — no tile the board draws
 * is missing here, and nothing here is absent from the board.
 */
export function resolveCoachingTilesShown(caps: CoachCapabilities, moneyStarted: boolean | null): TileKey[] {
  if (!canViewMoney(caps)) return resolveCoachingPair(caps);
  if (moneyStarted === null || moneyStarted) return [];
  return resolveCoachingPair(caps).slice(0, 1);
}

// ── The coaching pair's two summaries ────────────────────────────────────────
//
// Both carry an EARNED-IT threshold, inherited from the Season Wrapped honesty rule: a verdict
// drawn from one game is not a verdict. Below the threshold the tile says so rather than printing a
// confident number — a coach acting on "62% attendance" computed from a single rained-out practice
// is worse served than one told there isn't enough yet.

/** A player is "slipping" below this share of the sessions they were expected at. */
export const ATTENDANCE_LOW_SHARE = 0.7;
/** Fewer recorded sessions than this and the tile reports "not enough yet". */
export const ATTENDANCE_MIN_SESSIONS = 3;

export interface AttendanceStat { attended: number; known: number }
export interface AttendanceRow { games: AttendanceStat; practices: AttendanceStat }

export interface AttendanceSummary {
  /** Team attendance share 0–1, or null when the season has not earned a verdict yet. */
  share: number | null;
  /** Total recorded player-sessions behind the share (the honest denominator). */
  sessions: number;
  /** Active players below `ATTENDANCE_LOW_SHARE` — only counted once THEY have enough sessions. */
  lowCount: number;
}

/**
 * Team attendance across games AND practices. Both count: a squad that shows up for games and skips
 * practice is exactly the pattern this tile exists to surface, and splitting them would need two
 * tiles the board does not have.
 */
export function summariseAttendance(rows: readonly AttendanceRow[]): AttendanceSummary {
  let attended = 0;
  let known = 0;
  let lowCount = 0;

  for (const row of rows) {
    const playerAttended = row.games.attended + row.practices.attended;
    const playerKnown = row.games.known + row.practices.known;
    attended += playerAttended;
    known += playerKnown;
    // A player with two recorded sessions is not "slipping" — they are new, or the season is.
    if (playerKnown >= ATTENDANCE_MIN_SESSIONS && playerAttended / playerKnown < ATTENDANCE_LOW_SHARE) {
      lowCount += 1;
    }
  }

  if (known < ATTENDANCE_MIN_SESSIONS) return { share: null, sessions: known, lowCount: 0 };
  return { share: attended / known, sessions: known, lowCount };
}

/** How far below the team's average field share a player must sit to be called out. */
export const PLAYING_TIME_BELOW_MARGIN = 0.15;
/** Fewer games with a saved lineup than this and the tile reports "not enough yet". */
export const PLAYING_TIME_MIN_GAMES = 3;

export interface PlayingTimeRow { fieldInnings: number; benchInnings: number }

export interface PlayingTimeSummary {
  verdict: 'even' | 'uneven' | 'insufficient';
  games: number;
  /** Players sitting more than `PLAYING_TIME_BELOW_MARGIN` below the team's average field share. */
  belowCount: number;
}

/**
 * Playing-time equity from the season's saved lineups. Measured as each player's share of the
 * innings that were DECIDED for them (on field vs. explicitly benched), compared to the team
 * average — not as raw innings, which would punish a player who missed games for reasons that have
 * nothing to do with fairness.
 *
 * "Decided" is deliberate and worth knowing: the underlying analysis tracks a third bucket,
 * `unassigned` (innings left blank in the grid), which is NOT counted on either side here. A
 * half-filled lineup therefore contributes only what the coach actually decided, rather than
 * scoring blanks as bench time and manufacturing an unfairness that has not happened yet.
 */
export function summarisePlayingTime(
  rows: readonly PlayingTimeRow[],
  gamesWithLineup: number,
): PlayingTimeSummary {
  const played = rows.filter(r => r.fieldInnings + r.benchInnings > 0);
  if (gamesWithLineup < PLAYING_TIME_MIN_GAMES || played.length < 2) {
    return { verdict: 'insufficient', games: gamesWithLineup, belowCount: 0 };
  }

  const shares = played.map(r => r.fieldInnings / (r.fieldInnings + r.benchInnings));
  const mean = shares.reduce((sum, s) => sum + s, 0) / shares.length;
  const belowCount = shares.filter(s => s < mean - PLAYING_TIME_BELOW_MARGIN).length;

  return { verdict: belowCount > 0 ? 'uneven' : 'even', games: gamesWithLineup, belowCount };
}
