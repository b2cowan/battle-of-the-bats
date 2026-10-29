/**
 * THE DATE AND TIME FIELDS' ARITHMETIC — plain calendar strings in, plain calendar strings out (owner ruling
 * 2026-10-25, plan docs/projects/active/THEMED_DATE_PICKER_PLAN.md). `components/shared/DateInput.tsx`,
 * `TimeInput.tsx` and `DateTimeInput.tsx` draw; this file decides what the calendar grid and typed text mean.
 *
 * ⚠ NOTHING HERE READS A DATE IN LOCAL TIME. A hand-built calendar's classic bug is "picked the 31st, saved the
 * 30th": a `new Date('2026-10-31')` is midnight UTC, which is the 30th in Toronto. Stepping is `lib/timezone.ts`'s
 * (its own parts, through UTC), and "today" is the caller's (`tournamentToday()`), never `new Date()` read here.
 */
import {
  LONG_MONTHS, SHORT_MONTHS, addCalendarDays, formatStoredDate, lastDayOfMonth, mondayOfDay,
} from './timezone';
import { minutesToTime, timeToMinutes } from './schedule-conflict';

export { LONG_MONTHS, SHORT_MONTHS };
export { addCalendarDays as addDays, addCalendarMonths as addMonths, mondayOfDay } from './timezone';

/** Monday first in every grid (calendar recipe C2, design log 2026-10-10). */
export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type DateParts = { y: number; m: number; d: number }; // m is 0-based, as the grid indexes months

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function daysInMonth(y: number, m: number): number {
  return Number(lastDayOfMonth(`${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}`).slice(8));
}

/** The parts of a real `YYYY-MM-DD` date, or null (a malformed string, or a day the month doesn't have). */
export function dateParts(iso: string | null | undefined): DateParts | null {
  const m = ISO_DATE.exec(iso ?? '');
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  if (mo < 0 || mo > 11 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

/** `YYYY-MM-DD` from parts already known to be a real day. */
export function isoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  const p = dateParts(iso);
  if (!p) return 0;
  const day = new Date(0);
  day.setUTCFullYear(p.y, p.m, p.d);
  return (day.getUTCDay() + 6) % 7;
}

/** The 42 days a month grid shows (six whole weeks, Monday first), so the panel's height never changes. */
export function monthGrid(y: number, m: number): string[] {
  const start = mondayOfDay(isoDate(y, m, 1));
  return Array.from({ length: 42 }, (_, i) => addCalendarDays(start, i));
}

/** "Oct 25, 2026" — the house date (`formatStoredDate`); '' for nothing or a day that does not exist. */
export function formatFieldDate(iso: string | null | undefined): string {
  return dateParts(iso) ? formatStoredDate(iso) : '';
}

/** "Sunday, October 25, 2026" — a day button's accessible name. */
export function longDateLabel(iso: string): string {
  const p = dateParts(iso);
  return p ? `${WEEKDAY_NAMES[weekdayIndex(iso)]}, ${LONG_MONTHS[p.m]} ${p.d}, ${p.y}` : iso;
}

export function inRange(iso: string, min?: string, max?: string): boolean {
  return !(min && iso < min) && !(max && iso > max);
}

function monthFromWord(word: string): number {
  const w = word.toLowerCase().replace(/\.$/, '');
  if (w.length < 3) return -1;
  return LONG_MONTHS.findIndex(name => name.toLowerCase().startsWith(w));
}

/**
 * What a person typed, read as a date — or null when it can't be read without guessing.
 * Reads: `2026-10-25` / `2026/10/25`; `Oct 25 2026`, `Oct 25, 2026`, `October 25`; `25 Oct 2026`, `25 Oct`;
 * a numeric `d/m/y` or `m/d/y` ONLY when one part is over 12 (Canada writes both, so `5/6/2026` is refused rather
 * than guessed). A missing year takes `yearHint` (the field's current year, else today's).
 * ⚠ Deliberately looser than the schedule import's cell reader (`lib/coach-schedule-import.ts`), which reads a
 * pasted sheet and must refuse anything it would have to guess at in bulk; a person in a field sees what it read.
 */
export function parseTypedDate(text: string, yearHint: number): string | null {
  const s = text.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const check = (y: number, m: number, d: number) =>
    m >= 0 && m <= 11 && d >= 1 && y >= 1000 && y <= 9999 && d <= daysInMonth(y, m) ? isoDate(y, m, d) : null;
  let r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (r) return check(+r[1], +r[2] - 1, +r[3]);
  r = /^([A-Za-z]+\.?) (\d{1,2})(?:st|nd|rd|th)?,? ?(\d{4})?$/.exec(s);
  if (r) { const m = monthFromWord(r[1]); return m < 0 ? null : check(r[3] ? +r[3] : yearHint, m, +r[2]); }
  r = /^(\d{1,2}) ([A-Za-z]+\.?),? ?(\d{4})?$/.exec(s);
  if (r) { const m = monthFromWord(r[2]); return m < 0 ? null : check(r[3] ? +r[3] : yearHint, m, +r[1]); }
  r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (r) {
    const a = +r[1], b = +r[2], y = +r[3];
    if (a > 12 && b <= 12) return check(y, b - 1, a);
    if (b > 12 && a <= 12) return check(y, a - 1, b);
    if (a === b) return check(y, a - 1, b);
    return null;
  }
  return null;
}

/* ── Times ────────────────────────────────────────────────────────────────────────────────────────── */

const HHMM = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

/** A stored time (`HH:MM`, or the native `HH:MM:SS`) as `HH:MM`, or null. */
export function normaliseTime(value: string | null | undefined): string | null {
  const m = HHMM.exec(value ?? '');
  return m && +m[1] < 24 && +m[2] < 60 ? `${m[1]}:${m[2]}` : null;
}

export { timeToMinutes as minutesOf };

/**
 * What a person typed, read as a 24-hour `HH:MM`, or null. Reads `8:30 p.m.`, `8:30pm`, `8pm`, `830`, `20:30`,
 * `8`, `noon`, `midnight`. A bare hour with no a.m./p.m. is the 24-hour clock (`8` is 8:00 a.m., `20` is 8:00 p.m.),
 * which is what the native field did.
 */
export function parseTypedTime(text: string): string | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  if (s === 'noon') return '12:00';
  if (s === 'midnight') return '00:00';
  const r = /^(\d{1,2})(?::?(\d{2}))? ?(a|p)?\.? ?(?:m\.?)?$/.exec(s);
  if (!r) return null;
  let h = +r[1];
  const mi = r[2] ? +r[2] : 0;
  if (mi > 59) return null;
  if (r[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (r[3] === 'p' ? 12 : 0);
  } else if (h > 23) return null;
  return minutesToTime(h * 60 + mi);
}

/**
 * The end time a booking has after its START moves from `oldStart` to `newStart` — the calendar-app rule (owner
 * 2026-10-28): the end moves by the same amount, so the length is kept. An empty end stays empty (nothing is
 * invented), an unreadable start leaves the end alone, and a shift past the day's edges stops at it (`23:59` / `00:00`)
 * rather than rolling into another day, which a time-only field cannot say.
 */
export function endFollowingStart(oldStart: string, newStart: string, end: string): string {
  const e = normaliseTime(end), a = normaliseTime(oldStart), b = normaliseTime(newStart);
  if (!e || !a || !b) return end;
  const shifted = timeToMinutes(e) + timeToMinutes(b) - timeToMinutes(a);
  return minutesToTime(Math.max(0, Math.min(24 * 60 - 1, shifted)));
}

/** The time list's rows: every `stepMinutes` across the day, inside `min`/`max` when given. */
export function timeSteps(stepMinutes: number, min?: string | null, max?: string | null): string[] {
  const step = Math.max(1, Math.min(240, Math.round(stepMinutes)));
  const lo = min ? timeToMinutes(min) : 0;
  const hi = max ? timeToMinutes(max) : 24 * 60 - 1;
  const out: string[] = [];
  for (let t = 0; t < 24 * 60; t += step) if (t >= lo && t <= hi) out.push(minutesToTime(t));
  return out;
}

/** The list step from a native `step` attribute (seconds). Absent, or under a minute, is the house 15. */
export function stepMinutesFrom(step: number | string | undefined): number {
  const s = Number(step);
  return Number.isFinite(s) && s >= 60 ? Math.round(s / 60) : 15;
}
