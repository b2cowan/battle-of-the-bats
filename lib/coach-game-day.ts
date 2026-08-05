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
