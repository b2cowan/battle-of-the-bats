import { addCalendarDays } from './timezone';

/**
 * The Transactions date pill's preset vocabulary (owner-approved mockup, 2026-08-19 — "The Fourth
 * Pill"). One list, in menu order. Each preset RESOLVES to a plain from/to pair of org-calendar
 * day keys and is then applied through the exact same `applyDateRange` window the two raw date
 * pickers used to feed — a preset changes how the window is CHOSEN, never what a window means
 * (overdue rows still bypass it entirely; see `applyDateRange`'s header).
 *
 * ⚠ 'around' IS THE DEFAULT AND KEEPS THE OLD BEHAVIOUR EXACTLY: 30 days back / 30 days AHEAD.
 * The forward half is what lets next month's scheduled commitments show when a coach turns the
 * Scheduled status on — defaulting to a backward-only "Last 30 days" would silently drop that
 * view (the mockup's open call #1, decided with the mockup approval).
 *
 * ⚠ 'season' MEANS "EVERYTHING", NOT A CALENDAR YEAR. A season's book can carry rows dated before
 * January 1 (a deposit paid the fall before), so the caller passes bounds from
 * `computeSeasonBounds` below, derived from the book itself — cropping to Jan 1–Dec 31 would hide
 * real rows, which is exactly the bug a "Whole season" option exists to prevent. There is
 * deliberately no "All time": the register is one season deep by design, so the season IS this
 * book's all.
 *
 * ⚠ NO QUARTERS, ON PURPOSE (open call #3): a team's money year is the season, not fiscal
 * quarters. If treasurer-minded coaches ever ask, it is one more entry here — nothing else moves.
 */
export const DATE_RANGE_PRESETS = [
  { id: 'around', label: 'Around today' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'last60', label: 'Last 60 days' },
  { id: 'last90', label: 'Last 90 days' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'season', label: 'Whole season' },
] as const;

export type DateRangePresetId = (typeof DATE_RANGE_PRESETS)[number]['id'];

/** 'custom' is the pill's eighth state — not in the menu list because it is never PICKED, only
 *  entered by editing a date field. A custom range is pinned dates; every preset re-anchors to
 *  today each time it is resolved. */
export type DateRangeSelection = DateRangePresetId | 'custom';

export function isDateRangePresetId(v: string): v is DateRangePresetId {
  return DATE_RANGE_PRESETS.some(p => p.id === v);
}

/** The one number behind "Around today": 30 back, 30 ahead. Also the floor `computeSeasonBounds`
 *  pads to, and the seed for a custom range before a coach has typed one — three uses, one
 *  constant, so the default window can never quietly disagree with itself. */
export const AROUND_WINDOW_DAYS = 30;

/**
 * What 'Whole season' means for a given book: its own earliest→latest dated row, widened to at
 * least the around-today window so a young or still-loading book resolves sensibly. Derived from
 * the rows so the option can never crop one that exists — a calendar-year guess would hide a
 * deposit paid the fall before. Undated rows are skipped here; the register's own windowing
 * already treats a null date as always in range.
 */
export function computeSeasonBounds(
  rows: readonly { date: string | null }[],
  todayKey: string,
): { from: string; to: string } {
  let from = addCalendarDays(todayKey, -AROUND_WINDOW_DAYS);
  let to = addCalendarDays(todayKey, AROUND_WINDOW_DAYS);
  for (const r of rows) {
    if (r.date === null) continue;
    if (r.date < from) from = r.date;
    if (r.date > to) to = r.date;
  }
  return { from, to };
}

/** First day of the month `dayKey` sits in — pure key math, no timezone in play. */
function monthStart(dayKey: string): string {
  return `${dayKey.slice(0, 8)}01`;
}

/** Last day of that month, via the first of the next month minus one calendar day. */
function monthEnd(dayKey: string): string {
  const [y, m] = dayKey.split('-').map(Number);
  const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return addCalendarDays(nextFirst, -1);
}

/**
 * Resolve a preset to the window it means on `todayKey` (the org's calendar day — pass
 * `tournamentToday()`, never a raw UTC date; see the timezone memory rules).
 *
 * 'thisMonth' runs to the month's END, not to today: with Scheduled on, the rest of the month's
 * commitments are the half a coach is usually looking for. `seasonBounds` is the caller's
 * "everything" span — `computeSeasonBounds` is its one definition.
 */
export function resolveDateRangePreset(
  id: DateRangePresetId,
  todayKey: string,
  seasonBounds: { from: string; to: string },
): { from: string; to: string } {
  switch (id) {
    case 'around': return {
      from: addCalendarDays(todayKey, -AROUND_WINDOW_DAYS),
      to: addCalendarDays(todayKey, AROUND_WINDOW_DAYS),
    };
    case 'last30': return { from: addCalendarDays(todayKey, -30), to: todayKey };
    case 'last60': return { from: addCalendarDays(todayKey, -60), to: todayKey };
    case 'last90': return { from: addCalendarDays(todayKey, -90), to: todayKey };
    case 'thisMonth': return { from: monthStart(todayKey), to: monthEnd(todayKey) };
    case 'lastMonth': {
      const prevEnd = addCalendarDays(monthStart(todayKey), -1);
      return { from: monthStart(prevEnd), to: prevEnd };
    }
    case 'season': return seasonBounds;
  }
}
