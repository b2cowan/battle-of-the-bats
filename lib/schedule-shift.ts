/**
 * Bulk "shift the day" scheduling logic — Rain-Delay Day-of Ops (Feature B).
 *
 * Pure + dependency-free (no DB, no React) so the SAME math + guards run in three places
 * without drift: the admin preview (client), the bulk endpoint (server, source of truth),
 * and `node --test` unit tests.
 *
 * TIME MODEL: games store `game_date` (date) + `game_time` (time) as naive **America/Toronto
 * wall-clock** values (see lib/timezone.ts). A "+1 hour" rain delay is therefore pure
 * wall-clock arithmetic on that stored value — a 6:00 PM game becomes 7:00 PM. DST does NOT
 * enter into the shift itself (it only matters when converting a wall-clock to an absolute
 * instant, e.g. reminder emails / ICS, which this shift does not do). Crossing midnight rolls
 * `game_date` to the next day.
 */

import {
  findBracketSchedulingViolations,
  type BracketSchedulingViolation,
  type BracketTimingGame,
} from './playoff-bracket.ts';

/** Only a not-yet-played game may be shifted or cancelled. */
export const SHIFTABLE_STATUS = 'scheduled';

/** Quick-pick offsets (minutes) offered in the UI, plus custom entry. */
export const SHIFT_PRESET_MINUTES = [30, 60, 120] as const;

/** The subset of an admin game this module needs. */
export interface ReschedulableGame {
  id: string;
  date: string | null; // game_date, 'YYYY-MM-DD'
  time: string | null; // game_time, 'HH:MM' or 'HH:MM:SS'
  status: string;
  isPlayoff?: boolean | null;
  bracketCode?: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
}

export interface BulkRescheduleInput {
  /** Minutes added to each shifted game's wall-clock start. 0 when only cancelling. */
  shiftMinutes: number;
  /** Game ids to shift by `shiftMinutes`. */
  shiftIds: string[];
  /** Game ids to cancel. Wins over shift if an id appears in both. */
  cancelIds: string[];
}

export interface PlannedShift {
  id: string;
  from: { date: string; time: string };
  to: { date: string; time: string };
}

export type SkipReason = 'not-found' | 'not-scheduled' | 'missing-datetime';

export interface SkippedGame {
  id: string;
  reason: SkipReason;
}

export interface BulkReschedulePlan {
  /** Games that will move, with computed before/after wall-clock. */
  shifts: PlannedShift[];
  /** Games that will be cancelled (validated to still be scheduled). */
  cancelIds: string[];
  /** Requested ids that can't be actioned (already played, missing, or no date/time). */
  skipped: SkippedGame[];
  /** Ordering violations this change would NEWLY introduce — non-empty means block. */
  newViolations: BracketSchedulingViolation[];
  /** Ordering violations that already existed (informational; not caused by this change). */
  preexistingViolations: BracketSchedulingViolation[];
}

/**
 * Add `deltaMinutes` to a wall-clock date+time, rolling the calendar date across midnight.
 * Pure wall-clock arithmetic (see TIME MODEL above). Malformed inputs are returned untouched
 * — callers validate presence separately.
 */
export function shiftWallClock(
  date: string,
  time: string,
  deltaMinutes: number,
): { date: string; time: string } {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!dm || !tm) return { date, time };

  const totalMin = Number(tm[1]) * 60 + Number(tm[2]) + deltaMinutes;
  const dayRoll = Math.floor(totalMin / 1440);
  const minOfDay = ((totalMin % 1440) + 1440) % 1440;
  const hh = String(Math.floor(minOfDay / 60)).padStart(2, '0');
  const mm = String(minOfDay % 60).padStart(2, '0');

  // Roll the calendar date with UTC math so no browser/server zone can drift the day.
  const rolled = new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]) + dayRoll));
  const y = rolled.getUTCFullYear();
  const mo = String(rolled.getUTCMonth() + 1).padStart(2, '0');
  const d = String(rolled.getUTCDate()).padStart(2, '0');
  return { date: `${y}-${mo}-${d}`, time: `${hh}:${mm}` };
}

function toTimingGame(g: ReschedulableGame): BracketTimingGame {
  return {
    code: g.bracketCode ?? null,
    home: g.homePlaceholder ?? null,
    away: g.awayPlaceholder ?? null,
    date: g.date,
    time: g.time,
  };
}

const violationKey = (v: BracketSchedulingViolation): string => `${v.game}>${v.feeder}`;

/**
 * Plan a bulk shift/cancel against the full set of a tournament's games. Computes the moved
 * times, filters out anything not eligible (already played / missing), and — critically —
 * runs the bracket-ordering guard on the resulting picture, reporting only the violations the
 * change would NEWLY introduce (so a pre-existing scheduling quirk never blocks an unrelated
 * shift). Cancelled games impose no timing constraint, so they're excluded from the "after"
 * picture. The server calls this as the source of truth; the admin UI calls it for live preview.
 */
export function planBulkReschedule(
  allGames: ReschedulableGame[],
  input: BulkRescheduleInput,
): BulkReschedulePlan {
  const byId = new Map(allGames.map((g) => [g.id, g]));
  const cancelSet = new Set(input.cancelIds);

  const skipped: SkippedGame[] = [];

  // Cancel wins over shift when an id is in both.
  const validCancelIds: string[] = [];
  for (const id of input.cancelIds) {
    const g = byId.get(id);
    if (!g) { skipped.push({ id, reason: 'not-found' }); continue; }
    if (g.status !== SHIFTABLE_STATUS) { skipped.push({ id, reason: 'not-scheduled' }); continue; }
    validCancelIds.push(id);
  }
  const validCancelSet = new Set(validCancelIds);

  const shifts: PlannedShift[] = [];
  for (const id of input.shiftIds) {
    if (cancelSet.has(id)) continue; // cancel takes precedence; don't also shift
    const g = byId.get(id);
    if (!g) { skipped.push({ id, reason: 'not-found' }); continue; }
    if (g.status !== SHIFTABLE_STATUS) { skipped.push({ id, reason: 'not-scheduled' }); continue; }
    if (!g.date || !g.time) { skipped.push({ id, reason: 'missing-datetime' }); continue; }
    shifts.push({ id, from: { date: g.date, time: g.time }, to: shiftWallClock(g.date, g.time, input.shiftMinutes) });
  }

  // Bracket-ordering: BEFORE = current times; AFTER = shifted times, cancelled games removed.
  const shiftTo = new Map(shifts.map((s) => [s.id, s.to]));
  const beforeGames: BracketTimingGame[] = [];
  const afterGames: BracketTimingGame[] = [];
  for (const g of allGames) {
    beforeGames.push(toTimingGame(g));
    if (validCancelSet.has(g.id)) continue; // cancelled → no timing constraint in the after picture
    const moved = shiftTo.get(g.id);
    afterGames.push(moved ? { ...toTimingGame(g), date: moved.date, time: moved.time } : toTimingGame(g));
  }

  const before = findBracketSchedulingViolations(beforeGames);
  const after = findBracketSchedulingViolations(afterGames);
  const beforeKeys = new Set(before.map(violationKey));
  const newViolations = after.filter((v) => !beforeKeys.has(violationKey(v)));

  return { shifts, cancelIds: validCancelIds, skipped, newViolations, preexistingViolations: before };
}
