/**
 * Arrival as a LEAD TIME (Arrival & Places, owner rulings D1–D3, 2026-09-21).
 *
 * A coach thinks "be there 45 minutes early", not "5:15", so the form asks how long before — and
 * the stored value stays the clock time families already read (`rep_team_events.arrival_time`,
 * `HH:mm`, same day as the start). This module is the whole of that translation, pure and
 * client-safe: the form's dropdown, the team default in Settings and the seed at open time all
 * read the same seven answers, and the unit test pins the maths.
 *
 * ⚠ SAME DAY, ALWAYS. `arrival_time` cannot say "yesterday" (the column is a clock, not a
 * datetime), so a preset that would cross midnight — a 12:30 a.m. start with "1 hour before" —
 * is not offered: `arrivalClockFor` returns null and the dropdown greys that answer.
 */

/** The seven answers, in the order the dropdown offers them. Mirrors the CHECK on `rep_teams`. */
export const ARRIVAL_PRESET_MINUTES = [15, 30, 45, 60, 90, 120] as const;
export type ArrivalPresetMinutes = (typeof ARRIVAL_PRESET_MINUTES)[number];

/** "45 minutes before", "1 hour before", "1½ hours before" — the dropdown's own words. */
export function arrivalPresetLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes before`;
  if (minutes === 60) return '1 hour before';
  if (minutes === 90) return '1½ hours before';
  if (minutes % 60 === 0) return `${minutes / 60} hours before`;
  return `${minutes} minutes before`;
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function toClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * The clock `minutes` before a start, or null when the start is not a clock or the answer would
 * fall on the day before.
 */
export function arrivalClockFor(startHHmm: string, minutes: number): string | null {
  const start = toMinutes(startHHmm);
  if (start === null) return null;
  const at = start - minutes;
  if (at < 0) return null;
  return toClock(at);
}

/**
 * Which preset an arrival IS relative to its start — or null when it is none of them (a specific
 * time, a blank, or a start that is not a clock). This is how the dropdown derives its state from
 * the stored clock rather than storing a second field.
 */
export function arrivalPresetOf(startHHmm: string, arrivalHHmm: string): ArrivalPresetMinutes | null {
  const start = toMinutes(startHHmm);
  const arrival = toMinutes(arrivalHHmm);
  if (start === null || arrival === null) return null;
  const diff = start - arrival;
  return (ARRIVAL_PRESET_MINUTES as readonly number[]).includes(diff) ? (diff as ArrivalPresetMinutes) : null;
}

/**
 * The FOLLOW rule (D1's second half): when the start moves, an arrival that was a preset moves
 * with it; a specific time stays put. Returns the arrival to store after a start change.
 */
export function arrivalAfterStartChange(
  prevStartHHmm: string, nextStartHHmm: string, arrivalHHmm: string,
): string {
  if (!arrivalHHmm) return arrivalHHmm;
  const preset = arrivalPresetOf(prevStartHHmm, arrivalHHmm);
  if (preset === null) return arrivalHHmm;
  return arrivalClockFor(nextStartHHmm, preset) ?? arrivalHHmm;
}

/** A team default from the wire (a number in the list, or nothing) → the stored value. */
export function normalizeArrivalDefault(raw: unknown): ArrivalPresetMinutes | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return (ARRIVAL_PRESET_MINUTES as readonly number[]).includes(n) ? (n as ArrivalPresetMinutes) : null;
}
