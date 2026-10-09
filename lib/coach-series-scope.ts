/**
 * Which dates an edit of a repeating event reaches — asked when the coach presses the pencil, not after Save
 * (owner ruling 2026-10-09, all four asks as recommended; artifact 1NaTneZ5YFprr9SCt8bESG). Knowing the dates
 * BEFORE the form opens is the point: the form checks and marks every one of them for clashes before anything
 * saves. Asked after Save, the form had checked only the date it was opened on, and the server's answer for the
 * others arrived after the write and was never shown.
 */
import { formatEventDateRange, formatStoredDate, orgDayKey } from './timezone.ts';
import type { RepTeamEvent } from './types.ts';
import { joinWithAnd, pluralize } from './utils.ts';

/** The three answers — the same three the series write route takes (`scope=one|remaining|all`). */
export type SeriesScope = 'one' | 'remaining' | 'all';

export interface SeriesReach {
  one: string[];
  remaining: string[];
  all: string[];
}

/** The pencil's three rows, in order — worded by the event ("This practice only", "All games") and the scope each
 *  opens. Three always, as Delete offers (ask 4). */
export const SERIES_EDIT_ROWS: readonly { scope: SeriesScope; label: (word: string) => string }[] = [
  { scope: 'one', label: word => `This ${word} only` },
  { scope: 'remaining', label: () => 'This & future' },
  { scope: 'all', label: word => `All ${word}s` },
];

/**
 * The org-zone days (YYYY-MM-DD, in date order) each answer reaches. Mirrors the server's series write
 * (`updateRepTeamEventSeries`): the series is its first event and every event hung off it; This & future is the
 * ones starting at or after the opened one. Cancelled dates are counted — the write changes them too.
 */
export function seriesReach(events: readonly RepTeamEvent[], event: RepTeamEvent): SeriesReach {
  const anchor = event.recurrenceParentId ?? event.id;
  const members = events
    .filter(e => e.startsAt && (e.id === anchor || e.recurrenceParentId === anchor))
    .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
  const one = event.startsAt ? [orgDayKey(event.startsAt)] : [];
  // The opened event is always in the series, even if the list on screen has not caught up with it.
  if (!members.length) return { one, remaining: one, all: one };
  const all = members.map(e => orgDayKey(e.startsAt));
  return { one, remaining: all.filter((_, i) => (members[i].startsAt ?? '') >= (event.startsAt ?? '')), all };
}

/**
 * The line under an answer in the pencil's menu: "Nov 3" · "Nov 3 and Nov 10 · 2 practices" ·
 * "Nov 3–24 · 4 practices" (a range across New Year names both years). Two answers can reach the same dates (This &
 * future on a series' first date is All); the menu keeps all three, as Delete does, and these lines show when two are
 * the same (ask 4).
 */
export function reachHint(dates: readonly string[], noun: string): string {
  if (!dates.length) return '';
  const day = (d: string) => formatStoredDate(d, { withYear: false });
  if (dates.length === 1) return day(dates[0]);
  const span = dates.length === 2
    ? joinWithAnd(dates.map(day))
    : formatEventDateRange(dates[0], dates[dates.length - 1], false) ?? day(dates[0]);
  return `${span} · ${pluralize(dates.length, noun)}`;
}
