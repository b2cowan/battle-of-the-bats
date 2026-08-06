import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import { utcToZonedInputs, zonedWallClockToUtc } from './timezone';

/**
 * lib/coach-game-day.ts — Game-Day Mode (the bench console), P1 pure logic.
 *
 * Everything here is pure and table-testable: the live window, the swap math, result
 * derivation, and the quiet-score-write guard. The console page, the entry points and the
 * events PATCH route all import THIS module rather than re-deriving any of it, because the
 * window and the guard must agree — an entry point that shows the door while the guard slams
 * it (or vice versa) is the drift this file exists to prevent.
 *
 * ── The rules that bind (plan §1/§3, owner-approved 2026-08-04) ─────────────────────────────
 *  · "Live" is a TIME WINDOW, never a stored state. No event status is added; nothing here is
 *    persisted. Entry actions are absent outside the window (not disabled); the deep link
 *    outside the window renders review mode, never a 404.
 *  · D4 by construction: a substitution edits the one lineup grid that already exists
 *    (`rep_team_lineup_entries.inning_positions`, via the existing lineup PUT). No new
 *    playing-time record, no shift log. Abandoning the console mid-game leaves data
 *    indistinguishable from never opening it.
 *  · The quiet flag is honored ONLY for score fields and ONLY inside the live window — it must
 *    never become a general notification bypass. The one family notification fires at End game
 *    through the ordinary (non-quiet) write path.
 */

// ── The live window ──────────────────────────────────────────────────────────────────────────

/** The console opens this long before first pitch even when no arrival time is set. */
export const GAME_DAY_OPENS_BEFORE_MS = 2 * 60 * 60 * 1000;
/** Assumed game length when the event has no end time. */
export const GAME_DAY_ASSUMED_DURATION_MS = 4 * 60 * 60 * 1000;
/** How long the console lingers after the (actual or assumed) end. */
export const GAME_DAY_LINGERS_AFTER_MS = 3 * 60 * 60 * 1000;

/** The minimal event shape every predicate here reads. All fields exist on `RepTeamEvent`. */
export interface GameDayEventShape {
  eventType: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  /** "Be there by" wall clock, `HH:mm`, in the org's zone (coach-owned Tier-2 field). */
  arrivalTime: string | null;
}

/**
 * The ONE adapter from an event row to the shape above. Every call site — the console page,
 * all three entry points, the nudge module, the quiet-write guard — goes through here rather
 * than hand-picking the five fields, so a field added to the window/guard arithmetic is a
 * one-place change (the drift this module's header forbids, one level up).
 */
export function toGameDayEventShape(event: {
  eventType: string; status: string; startsAt: string;
  endsAt?: string | null; arrivalTime?: string | null;
}): GameDayEventShape {
  return {
    eventType: event.eventType, status: event.status, startsAt: event.startsAt,
    endsAt: event.endsAt ?? null, arrivalTime: event.arrivalTime ?? null,
  };
}

/** The console's URL — single-sourced beside the predicate that decides when to offer it. */
export function gameDayConsolePath(orgSlug: string, teamId: string, eventId: string): string {
  return `/${orgSlug}/coaches/teams/${teamId}/game/${eventId}`;
}

/**
 * The whole entry-point decision in one call: the console's href while the game's live window
 * is open, null otherwise. What every "Game day" pill and masthead link renders from.
 */
export function gameDayEntryHref(
  orgSlug: string, teamId: string,
  event: { id: string } & Parameters<typeof toGameDayEventShape>[0],
  nowMs: number,
): string | null {
  return isInGameDayWindow(toGameDayEventShape(event), nowMs)
    ? gameDayConsolePath(orgSlug, teamId, event.id)
    : null;
}

/**
 * The arrival time as a UTC instant, resolved on the game's own calendar day in the org's
 * zone. Null when there is no (parseable) arrival time — the window then simply opens at
 * `starts − 2h`. Never throws: a malformed value degrades to null, not a broken window.
 */
export function resolveArrivalInstantMs(
  startsAt: string,
  arrivalTime: string | null,
): number | null {
  const match = arrivalTime ? /^(\d{1,2}):(\d{2})$/.exec(arrivalTime.trim()) : null;
  if (!match) return null;
  const { date } = utcToZonedInputs(startsAt);
  if (!date) return null;
  const iso = zonedWallClockToUtc(date, `${match[1].padStart(2, '0')}:${match[2]}`);
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * The game-day window: `[min(arrival, starts − 2h), (ends ?? starts + 4h) + 3h]`.
 * Null when `startsAt` is unparseable (no window is safer than a window anchored at NaN).
 */
export function gameDayWindow(
  event: Pick<GameDayEventShape, 'startsAt' | 'endsAt' | 'arrivalTime'>,
): { opensAtMs: number; closesAtMs: number } | null {
  const startsMs = new Date(event.startsAt).getTime();
  if (Number.isNaN(startsMs)) return null;
  const arrivalMs = resolveArrivalInstantMs(event.startsAt, event.arrivalTime);
  const opensAtMs = Math.min(arrivalMs ?? Infinity, startsMs - GAME_DAY_OPENS_BEFORE_MS);
  const endsMs = event.endsAt ? new Date(event.endsAt).getTime() : NaN;
  const effectiveEndMs = Number.isNaN(endsMs) ? startsMs + GAME_DAY_ASSUMED_DURATION_MS : endsMs;
  return { opensAtMs, closesAtMs: effectiveEndMs + GAME_DAY_LINGERS_AFTER_MS };
}

/** A game the console can exist for at all: a game-type event that is not cancelled. */
export function isGameDayEvent(event: Pick<GameDayEventShape, 'eventType' | 'status'>): boolean {
  return COACH_GAME_EVENT_TYPES.includes(event.eventType) && event.status !== 'cancelled';
}

/**
 * Whether `now` sits inside the game's live window. This single predicate backs BOTH the entry
 * points (schedule row / lineups hub / masthead show the door only while true) and the server's
 * quiet-flag guard — one clock, no drift.
 */
export function isInGameDayWindow(event: GameDayEventShape, nowMs: number): boolean {
  if (!isGameDayEvent(event)) return false;
  const window = gameDayWindow(event);
  if (!window) return false;
  return nowMs >= window.opensAtMs && nowMs <= window.closesAtMs;
}

/**
 * Which shape the console renders for a visitor arriving at the deep link. Review is the
 * answer everywhere outside the live window — before it (nothing to run yet) and after it
 * (the record stands) — so the link never 404s and never offers writes time has closed.
 */
export function consoleMode(event: GameDayEventShape, nowMs: number): 'live' | 'review' {
  return isInGameDayWindow(event, nowMs) ? 'live' : 'review';
}

// ── Result derivation (server-side at End game; fixes the API-set-scores-leave-result-NULL gap) ──

export type GameResult = 'win' | 'loss' | 'tie';

/** Both scores present → win/loss/tie; anything missing → null (never guess half a score). */
export function deriveGameResult(
  teamScore: number | null | undefined,
  opponentScore: number | null | undefined,
): GameResult | null {
  if (typeof teamScore !== 'number' || Number.isNaN(teamScore)) return null;
  if (typeof opponentScore !== 'number' || Number.isNaN(opponentScore)) return null;
  if (teamScore > opponentScore) return 'win';
  if (teamScore < opponentScore) return 'loss';
  return 'tie';
}

// ── The swap math ────────────────────────────────────────────────────────────────────────────

/** The literal the lineup grid uses for a bench inning (`lib/lineup-analysis.ts` BENCH_POSITION). */
export const BENCH = 'Bench';

export interface SwapGridRow {
  playerId: string;
  /** 1-based period number (as a string key) → position code, `'Bench'`, or `''`/absent. */
  inningPositions: Record<string, string>;
}

export interface ConsoleSwap {
  /** Who goes in. */
  inPlayerId: string;
  /** Whose spot they take; null fills an empty position instead. */
  outPlayerId: string | null;
  /** The position to fill when `outPlayerId` is null. Ignored otherwise. */
  position?: string;
  /** 1-based period the swap starts at (the console's current-period cursor). */
  fromPeriod: number;
  periodCount: number;
  scope: 'onward' | 'single';
}

/**
 * Apply one bench decision to the grid, immutably.
 *
 * "{In} goes in for {Out} from period N on" — the incoming player INHERITS the outgoing
 * player's remaining schedule (each period's position, including any planned bench sits, so a
 * pre-game rotation survives the swap), and the outgoing player sits for those periods. The
 * `'single'` scope touches exactly one period. Filling an empty slot (`outPlayerId: null`)
 * writes only the incoming player's periods — nobody is benched for it.
 *
 * Rows other than the two involved are returned by reference; involved rows get fresh objects.
 * Out-of-range periods and a self-swap are no-ops, returning `rows` unchanged.
 */
export function applyConsoleSwap<T extends SwapGridRow>(rows: T[], swap: ConsoleSwap): T[] {
  const { inPlayerId, outPlayerId, fromPeriod, periodCount, scope } = swap;
  if (inPlayerId === outPlayerId) return rows;
  if (!Number.isInteger(fromPeriod) || fromPeriod < 1 || fromPeriod > periodCount) return rows;

  const inRow = rows.find(r => r.playerId === inPlayerId);
  if (!inRow) return rows;
  const outRow = outPlayerId ? rows.find(r => r.playerId === outPlayerId) : null;
  if (outPlayerId && !outRow) return rows;
  if (!outPlayerId && !swap.position) return rows;

  const lastPeriod = scope === 'single' ? fromPeriod : periodCount;
  const nextIn: Record<string, string> = { ...inRow.inningPositions };
  const nextOut: Record<string, string> | null = outRow ? { ...outRow.inningPositions } : null;

  for (let p = fromPeriod; p <= lastPeriod; p++) {
    const key = String(p);
    if (outRow && nextOut) {
      nextIn[key] = outRow.inningPositions[key] ?? '';
      nextOut[key] = BENCH;
    } else {
      nextIn[key] = swap.position as string;
    }
  }

  return rows.map(r => {
    if (r.playerId === inPlayerId) return { ...r, inningPositions: nextIn };
    if (nextOut && r.playerId === outPlayerId) return { ...r, inningPositions: nextOut };
    return r;
  });
}

// ── The bench, ordered (P3) ──────────────────────────────────────────────────────────────────

/**
 * How many periods this player has sat in a ROW, counting backwards from `period` inclusive
 * ("2nd straight inning sitting").
 *
 * An UNASSIGNED period (`''`) continues a streak — the board groups it under Bench, and the
 * chip must agree with what the coach sees — but at least one explicit `'Bench'` is required,
 * so a half-planned grid doesn't chip every player as a long sitter.
 */
export function benchStreakThrough(row: SwapGridRow, period: number): number {
  let streak = 0;
  let sawBench = false;
  for (let p = period; p >= 1; p--) {
    const pos = row.inningPositions[String(p)] ?? '';
    if (pos === BENCH) sawBench = true;
    else if (pos !== '') break;
    streak += 1;
  }
  return sawBench ? streak : 0;
}

/** Total periods spent explicitly benched up to and including `period` — the second sort key,
 *  so two players on the same streak are separated by who has sat more all night. */
function benchedThrough(row: SwapGridRow, period: number): number {
  let n = 0;
  for (let p = 1; p <= period; p++) {
    if ((row.inningPositions[String(p)] ?? '') === BENCH) n += 1;
  }
  return n;
}

/**
 * The bench order for ONE period: longest current sit first, then most sat overall, then the
 * order the caller passed in (the roster order the coach already knows — never jersey-number
 * arithmetic, which is not an ordering anyone thinks in).
 *
 * ⚠ Pass EVERY row, not just the benched ones. A player on the field at the boundary has a
 * streak of 0 and sorts below every sitter, so when they are benched mid-period they land at
 * the BOTTOM of the frozen order without needing a special "newcomer" path — the freeze and
 * the sort agree, which is the whole reason the rule is safe.
 */
export function benchOrderIds(rows: SwapGridRow[], period: number): string[] {
  // Both keys are scans over the grid, so they are computed ONCE per row rather than on every
  // pairwise comparison; `sort` is stable (ES2019), which is what keeps roster order as the
  // tiebreak without carrying an index around.
  return rows
    .map(row => ({
      playerId: row.playerId,
      streak: benchStreakThrough(row, period),
      sits: benchedThrough(row, period),
    }))
    .sort((a, b) => b.streak - a.streak || b.sits - a.sits)
    .map(entry => entry.playerId);
}

/**
 * Lay the bench out in a previously-frozen order, immutably.
 *
 * ⚠ THE POINT OF THIS FUNCTION IS THAT IT DOES NOT RE-SORT. The order is computed once when
 * the period cursor moves (`benchOrderIds`) and then applied unchanged for the rest of that
 * period, so no row ever moves between the moment a coach looks and the moment they tap —
 * which is how the wrong child gets sent in. Anyone missing from `orderIds` keeps their given
 * order at the end; an empty order is a no-op.
 */
export function applyBenchOrder<T extends { playerId: string }>(benched: T[], orderIds: string[]): T[] {
  if (orderIds.length === 0) return benched;
  const rank = new Map(orderIds.map((id, i) => [id, i]));
  // Stable sort keeps anyone the order doesn't name in the sequence they arrived in, at the end.
  return benched
    .slice()
    .sort((a, b) =>
      (rank.get(a.playerId) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.playerId) ?? Number.MAX_SAFE_INTEGER));
}

/**
 * Is this bench list, as it currently reads, still in longest-sitting-first order?
 *
 * ⚠ The freeze can outlive its own claim. A player who was ON THE FIELD when the period started
 * has a streak of 0 and is therefore ranked last — but if the coach then benches them mid-period
 * and they had sat the four periods before this one, their live streak chip reads "5th straight"
 * while they sit at the BOTTOM of the list. The order is correct (it is the order the coach was
 * looking at, deliberately unmoved); the LABEL is what would be lying. So the board asks this
 * before claiming anything, and says plain "Bench" when the claim has gone stale. It comes back
 * true by itself at the next period boundary, when the order re-settles.
 */
export function benchOrderStillSorted(benched: SwapGridRow[], period: number): boolean {
  let previous = Infinity;
  for (const row of benched) {
    const streak = benchStreakThrough(row, period);
    if (streak > previous) return false;
    previous = streak;
  }
  return true;
}

// ── The quiet-score-write guard (server-checked; the flag must never widen) ──────────────────

/** The ONLY fields a quiet write may carry. `result` is deliberately absent: a mid-game
 *  derived "win" would lie to the Season Record until End game; the final write is non-quiet. */
export const QUIET_ALLOWED_FIELDS = ['teamScore', 'opponentScore'] as const;

export type QuietWriteVerdict = { ok: true } | { ok: false; reason: string };

/**
 * May THIS request suppress the family notification? Rejection is a 400 at the route — never a
 * silent un-quieting (which would spam families) and never a silent suppression of a
 * non-score change (which would make the flag a general bypass).
 */
export function validateQuietScoreWrite(input: {
  /** Body keys besides `quiet` itself. */
  bodyKeys: string[];
  event: GameDayEventShape & { mirrored: boolean };
  nowMs: number;
}): QuietWriteVerdict {
  const fields = input.bodyKeys;
  if (fields.length === 0) return { ok: false, reason: 'A quiet write must include a score.' };
  const allowed = new Set<string>(QUIET_ALLOWED_FIELDS);
  const stray = fields.filter(f => !allowed.has(f));
  if (stray.length > 0) {
    return { ok: false, reason: `quiet only applies to score fields (got: ${stray.join(', ')}).` };
  }
  if (input.event.mirrored) {
    return { ok: false, reason: 'The tournament scores this game.' };
  }
  if (!isGameDayEvent(input.event)) {
    return { ok: false, reason: 'quiet only applies to a scheduled game.' };
  }
  if (!isInGameDayWindow(input.event, input.nowMs)) {
    return { ok: false, reason: 'quiet only applies during the game-day window.' };
  }
  return { ok: true };
}

// ── Client-side UI preference keys (sessionStorage; never persisted server-side) ─────────────

/** The console's period cursor — a UI preference, exactly like the practice run's station pick. */
export const gameDayPeriodKey = (eventId: string) => `fl.game-day.period.${eventId}`;
/** "Skip lineup — just score & attendance" for this game, chosen at the no-lineup fallback. */
export const gameDaySkipLineupKey = (eventId: string) => `fl.game-day.skip-lineup.${eventId}`;
/** P3 — whether the coach has switched OFF "screen staying on" for this game. Default is on;
 *  the preference is per-game and per-tab, like every other console UI preference. */
export const gameDayAwakeKey = (eventId: string) => `fl.game-day.awake.${eventId}`;
