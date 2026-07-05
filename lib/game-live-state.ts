/**
 * Shared game "window state" classifier — the single definition of
 * live / overdue / future used by BOTH the tournament admin dashboard API
 * (`app/api/admin/tournament-dashboard/route.ts`) and the Schedule game rows
 * (`app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`), so the two
 * surfaces can never disagree about what's playing now vs. up next vs. overdue.
 *
 * Intentionally a PURE window test over millisecond timestamps. Each caller does
 * its own local-time conversion (the dashboard via `zonedWallClockToUtc`, the
 * Schedule via a local `Date` parse) and its own "which future game is Up Next"
 * selection — those aren't per-game properties.
 *
 * Only meaningful for a game that is still `scheduled` (unscored). A game being
 * scored (`submitted`) or finished (`completed`) is classified by its status, not
 * its clock, by the caller.
 *
 * Bucket mapping used by the dashboard:
 *   'live'     → Now Playing (alongside `submitted` games)
 *   'future'   → Up Next (when also today, earliest first)
 *   'overdue'  → Needs a Score (window fully elapsed, any day)
 */
export type ScheduledWindowState = 'live' | 'overdue' | 'future';

/** Default game length (minutes) when neither the game nor the tournament sets one. */
export const DEFAULT_GAME_DURATION_MINUTES = 60;

/**
 * Classify a scheduled game's play window against "now".
 *
 * @param startMs          UTC start instant in ms (NaN/Infinity → treated as not-started).
 * @param durationMinutes  Game length in minutes (non-positive/NaN → DEFAULT_GAME_DURATION_MINUTES).
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
    : DEFAULT_GAME_DURATION_MINUTES;
  const endMs = startMs + dur * 60_000;
  if (nowMs < startMs) return 'future';
  if (nowMs < endMs) return 'live';
  return 'overdue';
}
