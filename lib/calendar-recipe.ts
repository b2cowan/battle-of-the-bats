/**
 * THE CALENDAR RECIPE'S SHARED WORDS AND GRIDS (Club Tier Stage 6c, ruled 2026-10-10 — table standard §11).
 *
 * Every calendar in the app — the coach's Schedule, a team's schedule (admin), the club calendar — heads its days,
 * names its week and lays out its grids through here, so "Sat, Oct 10" is one spelling (C8), a week starts on Monday
 * in every grid (C2), and today is said in words wherever a day is headed (C7). All of it is built from the date's own
 * calendar parts — never a device-midnight `Date`, which named the wrong day east or west of the club's zone.
 *
 * React-free, so the guards and the unit tests read it straight.
 */
import {
  addCalendarDays, formatMonthYear, formatShortWeekdayDate, formatWeekRange, lastDayOfMonth, mondayOfDay, orgDayKey,
  parseDateOnlyParts, utcToZonedInputs,
} from './timezone';
import { formatTime, formatTimeRange } from './utils';

/** The weekday heads of every grid, Monday first (C2). */
export const WEEKDAY_HEADS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** The word that says today, before the day's own words (C7). */
export const TODAY_WORD = 'Today';

/** "Sat, Oct 10" — a day as a heading, a band or a label names it (C8). */
export const dayWords = (day: string): string => formatShortWeekdayDate(day);

/** "Today · Sat, Oct 10" on today, "Sat, Oct 10" on any other day — a day heading that never says today in colour alone (C7). */
export function dayHeading(day: string, today: string): string {
  return day === today ? `${TODAY_WORD} · ${dayWords(day)}` : dayWords(day);
}

/** The seven days of the week a calendar date falls in, Monday first. */
export function weekDays(cursor: string): string[] {
  const from = mondayOfDay(cursor);
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(from, i));
}

/** The week a cursor falls in, in the one range spelling: "Oct 5 – 11, 2026" (a phone drops the year). */
export function weekRangeWords(cursor: string, withYear = true): string {
  const from = mondayOfDay(cursor);
  return formatWeekRange(from, addCalendarDays(from, 6), withYear);
}

/** "October 2026". */
export const monthWords = (cursor: string): string => formatMonthYear(cursor);

/**
 * The widest words the date control can show, one per line — set unseen under the dates so the control keeps ONE width
 * while a coach steps through weeks and months and the › arrow stays under the finger (owner, 2026-10-10). Every pair
 * of months a week can straddle (the turn of the year the widest) and every month's name: the cursor's year only sets
 * the digits, and the label's tabular figures make every year, and every day of the month, the same width.
 */
export function widestRangeWords(cursor: string, withYear = true): string {
  const y = Number(cursor.slice(0, 4));
  const mm = (m: number) => String(m).padStart(2, '0');
  const straddles = Array.from({ length: 12 }, (_, i) => i < 11
    ? formatWeekRange(`${y}-${mm(i + 1)}-28`, `${y}-${mm(i + 2)}-03`, withYear)
    : formatWeekRange(`${y}-12-28`, `${y + 1}-01-03`, withYear));
  const months = Array.from({ length: 12 }, (_, i) => formatMonthYear(`${y}-${mm(i + 1)}-01`));
  return [...straddles, ...months].join('\n');
}

/** A month as Monday-first weeks: each cell a day of the month, or null padding to fill its first and last week. */
export function monthCells(cursor: string): (string | null)[] {
  const from = `${cursor.slice(0, 7)}-01`;
  const to = lastDayOfMonth(cursor);
  const p = parseDateOnlyParts(from);
  if (!p) return [];
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  const cells: (string | null)[] = Array((dow + 6) % 7).fill(null);
  for (let d = from; d <= to; d = addCalendarDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** A called-off booking's one word (C9) — the chips, the read windows and the club calendar's Status column say it. */
export const STATE_WORDS = { cancelled: 'Cancelled', postponed: 'Postponed' } as const;

/**
 * An event's when, in the one spelling and clock (C8, C10): "Sat, Oct 10 · 6:00–8:00 p.m."; the end's day too when it
 * runs into another ("Sat, Oct 10 · 10:00 p.m. – Sun, Oct 11 · 1:00 a.m."), so an overnight range is never misread.
 */
export function eventWhenWords(startsAt: string, endsAt: string | null | undefined): string {
  const s = utcToZonedInputs(startsAt);
  if (!s.date) return '';
  const e = endsAt ? utcToZonedInputs(endsAt) : null;
  if (!e?.date) return `${dayWords(s.date)} · ${formatTime(s.time)}`;
  if (e.date === s.date) return `${dayWords(s.date)} · ${formatTimeRange(s.time, e.time)}`;
  return `${dayWords(s.date)} · ${formatTime(s.time)} – ${dayWords(orgDayKey(endsAt))} · ${formatTime(e.time)}`;
}

/** The day of the month as its cell shows it ("10"). */
export const dayOfMonth = (day: string): number => Number(day.slice(8, 10));

/** A season list's run, as the now line reads it: a month's band, or a row on a club-local day. */
export type SeasonListItem = { kind: 'band'; month: string } | { kind: 'row'; day: string };

/**
 * WHERE THE NOW LINE GOES in a season list (C7): the index to draw it BEFORE — the first row on or after today; or, when
 * that row opens a LATER month than today's, before that month's band, so the line closes the earlier month instead of
 * sitting under a band whose rows aren't today's month. `items.length` when the season is behind today (after the last
 * row); -1 when the list has no rows at all.
 */
export function nowLineAt(items: readonly SeasonListItem[], today: string): number {
  if (!items.some(i => i.kind === 'row')) return -1;
  const ahead = items.findIndex(i => i.kind === 'row' && i.day >= today);
  if (ahead < 0) return items.length;
  const before = items[ahead - 1];
  return before?.kind === 'band' && before.month > today.slice(0, 7) ? ahead - 1 : ahead;
}
