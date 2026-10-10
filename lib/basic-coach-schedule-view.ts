/**
 * THE FREE COACH SCHEDULE'S CLOCK — every date and time the free portal's schedule shows or takes, in the
 * PLATFORM's zone (`lib/timezone.ts`), never the device's. React-free, so it can be pinned under a far-away zone.
 *
 * ⚠ C6-03 (Club Tier Stage 6c, fixed 2026-10-10): this was the one schedule in the app still on the device's clock.
 * It printed each event with `toLocaleDateString` / `toLocaleTimeString` and no zone, and its form read and wrote
 * `datetime-local` values through the device too — so a coach travelling, or a phone set to another zone, read
 * (and saved) another hour. A game starts when it starts: the premium schedule, the club calendar and the family app
 * all read the club's zone, and so does this.
 */
import { addHoursToWallClock, formatShortWeekdayDate, orgDayKey, tournamentNow, utcToZonedInputs, wallClockStringToUtc } from './timezone';
import { formatTime, formatTimeRange } from './utils';

/**
 * The row's when, in the club's zone: "Sat, Oct 10 · 6:00–8:00 p.m."; the end's day too when it runs into another
 * ("Sat, Oct 10 · 10:00 p.m. – Sun, Oct 11 · 1:00 a.m."), so an overnight range is never misread.
 */
export function basicEventWhen(startsAt: string, endsAt: string | null | undefined): string {
  const s = utcToZonedInputs(startsAt);
  if (!s.date) return '';
  const e = endsAt ? utcToZonedInputs(endsAt) : null;
  if (!e?.date) return `${formatShortWeekdayDate(s.date)} · ${formatTime(s.time)}`;
  if (e.date === s.date) return `${formatShortWeekdayDate(s.date)} · ${formatTimeRange(s.time, e.time)}`;
  return `${formatShortWeekdayDate(s.date)} · ${formatTime(s.time)} – ${formatShortWeekdayDate(orgDayKey(endsAt))} · ${formatTime(e.time)}`;
}

/** A stored instant as the `datetime-local` value the coach sees and edits ("YYYY-MM-DDTHH:mm"), in the club's zone. */
export function instantToWallInput(iso: string | null | undefined): string {
  const { date, time } = utcToZonedInputs(iso);
  return date && time ? `${date}T${time}` : '';
}

/** What the coach typed (a club-zone wall clock) as the instant to store; null when it isn't one. */
export function wallInputToInstant(local: string): string | null {
  const v = local.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  return wallClockStringToUtc(v);
}

/** A wall-clock input moved by `hours` — the schedule forms' one hour step (no zone; empty in, empty out). */
export const addHoursToWallInput = addHoursToWallClock;

/** A new event's start: the next top of the hour on the CLUB's clock (games and practices start on the hour). */
export function nextHourWallInput(now: Date = new Date()): string {
  const { date, time } = tournamentNow(now);
  return addHoursToWallInput(`${date}T${time.slice(0, 2)}:00`, 1);
}

/**
 * The merged list's order: the instant (a self-entered event's and a tournament game's are both real instants —
 * the game's is resolved from its wall clock in the club's zone, `lib/basic-coach-teams`). A naive wall clock is read
 * in the club's zone, never the device's; an unscheduled (TBD) game sorts last.
 */
export function basicScheduleSortKey(startsAt: string | null): number {
  if (!startsAt) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(wallClockStringToUtc(startsAt) ?? '');
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

