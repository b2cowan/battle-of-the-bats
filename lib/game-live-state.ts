/**
 * Shared game "window state" classifier — the single definition of
 * live / overdue / future used by BOTH the tournament admin dashboard API
 * (`app/api/admin/tournament-dashboard/route.ts`) and the Schedule game rows
 * (`app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`), so the two
 * surfaces can never disagree about what's playing now vs. up next vs. overdue.
 *
 * `scheduledWindowState` is a PURE window test over millisecond timestamps.
 * `gameWindowState` wraps it for a game's stored wall clock in the org's zone,
 * with the one rule for a game that has a day and no start time — the dashboard
 * API and Results' bands both read it. The Schedule parses its own local start.
 * "Which future game is Up Next" stays each caller's (not a per-game property).
 *
 * Only meaningful for a game that is still `scheduled` (unscored). A game being
 * scored (`submitted`) or finished (`completed`) is classified by its status, not
 * its clock, by the caller.
 *
 * Bucket mapping used by the dashboard:
 *   'live'     → Playing now (`submitted` games are To finalize, by their status)
 *   'future'   → Up Next (when also today, earliest first)
 *   'overdue'  → Needs a Score (window fully elapsed, any day)
 */
import { zonedWallClockToUtc } from './timezone';
import { DEFAULT_BOOKING_MINUTES } from './booking-length';

export type ScheduledWindowState = 'live' | 'overdue' | 'future';

/**
 * Classify a scheduled game's play window against "now". The length is THE chain's answer (`gameLengthMinutes`,
 * lib/booking-length.ts — A39: how long a game reads Playing now is how long it lasts); the board used to keep its
 * own 60 here.
 *
 * @param startMs          UTC start instant in ms (NaN/Infinity → treated as not-started).
 * @param durationMinutes  Game length in minutes (non-positive/NaN → the one booking length).
 * @param nowMs            Current instant in ms.
 * @returns 'future' before start · 'live' inside [start, start+duration) · 'overdue' after.
 */
export function scheduledWindowState(
  startMs: number,
  durationMinutes: number,
  nowMs: number,
): ScheduledWindowState {
  // Untimed / unparseable start → not-yet-started (safe: never false-positive "live").
  if (!Number.isFinite(startMs)) return 'future';
  const dur = Number.isFinite(durationMinutes) && durationMinutes > 0
    ? durationMinutes
    : DEFAULT_BOOKING_MINUTES;
  const endMs = startMs + dur * 60_000;
  if (nowMs < startMs) return 'future';
  if (nowMs < endMs) return 'live';
  return 'overdue';
}

/**
 * A scheduled game's window, from its stored date and time read in the org's zone (DST-correct via
 * `zonedWallClockToUtc`). A game with a day and no start time has no window to test: a past day is
 * 'overdue', so an unscored past game never drops out of Needs a score; today or later is 'future'
 * (never a false "live").
 */
export function gameWindowState(opts: {
  date: string | null | undefined;
  time: string | null | undefined;
  durationMinutes: number;
  nowMs: number;
  /** The tournament's today, `YYYY-MM-DD`. */
  today: string;
}): ScheduledWindowState {
  const iso = zonedWallClockToUtc(opts.date, opts.time);
  if (!iso) return opts.date && opts.date < opts.today ? 'overdue' : 'future';
  return scheduledWindowState(new Date(iso).getTime(), opts.durationMinutes, opts.nowMs);
}
