/**
 * How a budget line's period split is ENTERED (coaches → Money → Season Budget Plan).
 *
 * A stored period is a name, an optional date and an amount — that is all, and this module does not
 * change it. What it adds is the coach-facing question the form asks first: *is this line split by
 * month, by quarter, by exact dates, or just by name?* The answer decides which control each row
 * gets and how a blank label is filled in; it is never stored, because **the selection IS the date**
 * (months → the 1st, quarters → the first day of the quarter). Nothing downstream — Budget vs.
 * Actual, the month grid, installment generation — learns a new word.
 *
 * The mode is therefore re-DERIVED when a saved line is reopened (`inferSplitMode`), not remembered
 * on the record. That is a deliberate trade: inference can be wrong, the coach can correct it, and
 * nothing is rewritten until they save.
 *
 * ⚠ Changing the mode RESETS the periods (owner ruling 2026-08-12). Converting one shape into
 * another only works when the shapes correspond and they don't: twelve months mapped onto four
 * quarters piles three rows into each quarter, and mapping back produces three Januaries, three
 * Aprils and so on. Months → specific dates is the one lossless conversion and is deliberately NOT
 * carved out — one rule beats a rule with an exception.
 *
 * Pure: no IO, no React, no Date (every date here is `YYYY-MM-DD` string arithmetic, so a coach in
 * Toronto and a server in UTC agree).
 */

export type PeriodSplitMode = 'months' | 'quarters' | 'dates' | 'names';

export const PERIOD_SPLIT_MODES: PeriodSplitMode[] = ['months', 'quarters', 'dates', 'names'];

/** Button copy for the mode chips, and the sentence that names step 2 underneath them. */
export const SPLIT_MODE_LABEL: Record<PeriodSplitMode, string> = {
  months:   'Months',
  quarters: 'Quarters',
  dates:    'Specific dates',
  names:    'Just names',
};

/** Lower-case, for mid-sentence use ("Now splitting by quarters."). */
export const SPLIT_MODE_NOUN: Record<PeriodSplitMode, string> = {
  months:   'months',
  quarters: 'quarters',
  dates:    'specific dates',
  names:    'names only',
};

export const SPLIT_MODE_STEP_TWO: Record<PeriodSplitMode, string> = {
  months:   'Add a period for each month you spend in',
  quarters: 'Add a period for each quarter',
  dates:    'Add a period for each payment date',
  names:    'Add a period for each part of the split',
};

/** The heading over the picker column. Empty in `names` mode — there is no picker. */
export const SPLIT_MODE_COLUMN: Record<PeriodSplitMode, string> = {
  months:   'Month',
  quarters: 'Quarter',
  dates:    'Date',
  names:    '',
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The years a month/quarter picker offers: the season's own, and the one after it, so a season
 *  crossing New Year can be entered. (The platform records a season YEAR and nothing more — see the
 *  season-start-month follow-up in the plan.) */
export function splitYears(seasonYear: number): number[] {
  return [seasonYear, seasonYear + 1];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** What the form holds for one period. `date` carries the month/quarter selection in every mode but
 *  `names` — the selection IS the date, which is why no new column exists. */
export interface PeriodDraft {
  label: string;
  /** `YYYY-MM-DD`, or '' when the period has no date (only reachable in `names` mode). */
  date: string;
  amount: string;
}

// ── reading a date ───────────────────────────────────────────────────────────

interface Ymd { year: number; month: number; day: number }

/** `'2027-04-01'` → `{ year: 2027, month: 3, day: 1 }`. Null for anything that isn't a real date.
 *  `month` is 0-based to match the pickers. */
export function readDate(date: string | null | undefined): Ymd | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1;
  const day = Number(date.slice(8, 10));
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function monthDate(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}-01`;
}

export function quarterDate(year: number, quarter: number): string {
  return monthDate(year, quarter * 3);
}

/** Which quarter a 0-based month falls in. */
export function quarterOf(month: number): number {
  return Math.floor(month / 3);
}

// ── the name a period gets ───────────────────────────────────────────────────

/**
 * The name a period is stored under when the coach leaves the label blank.
 *
 * Shown greyed in the label box while they type, and written on save — so what the form promised is
 * exactly what lands in Budget vs. Actual. `index` is only reached when there is nothing to derive
 * from (names mode, or a dateless row).
 */
export function derivedPeriodLabel(
  mode: PeriodSplitMode, period: PeriodDraft, index: number,
): string {
  const ymd = readDate(period.date);
  if (ymd) {
    if (mode === 'months') return `${MONTH_SHORT[ymd.month]} ${ymd.year}`;
    if (mode === 'quarters') return `Q${quarterOf(ymd.month) + 1} ${ymd.year}`;
    if (mode === 'dates') {
      // A date on the 1st reads as the month it opens; any other day is worth stating exactly,
      // because a coach who picked the 14th picked it for a reason.
      return ymd.day === 1
        ? `${MONTH_SHORT[ymd.month]} ${ymd.year}`
        : `${MONTH_SHORT[ymd.month]} ${ymd.day}, ${ymd.year}`;
    }
  }
  return `Period ${index + 1}`;
}

/** What the period will actually be SAVED as: what the coach typed, else the derived name. The
 *  stored column is NOT NULL and the API rejects a blank, so this is the single place that
 *  guarantees a name exists — the reason the label could become optional at all. */
export function resolvedPeriodLabel(
  mode: PeriodSplitMode, period: PeriodDraft, index: number,
): string {
  return period.label.trim() || derivedPeriodLabel(mode, period, index);
}

// ── building rows ────────────────────────────────────────────────────────────

/** The one empty period a fresh split starts with (owner: one, never zero and never twelve). */
export function blankPeriod(mode: PeriodSplitMode, seasonYear: number): PeriodDraft {
  return {
    label: '',
    amount: '',
    date: mode === 'months' || mode === 'quarters' ? monthDate(seasonYear, 0) : '',
  };
}

/**
 * The date the NEXT "+ Add period" should land on — one month or one quarter after the last row, so
 * repeatedly pressing one button walks a season without touching a picker. Rolls into the following
 * year, then stops advancing rather than leaving the picker's range.
 */
export function nextPeriodDate(
  mode: PeriodSplitMode, periods: PeriodDraft[], seasonYear: number,
): string {
  if (mode !== 'months' && mode !== 'quarters') return '';

  const years = splitYears(seasonYear);
  const last = [...periods].reverse().find(p => readDate(p.date));
  const ymd = last ? readDate(last.date) : null;
  if (!ymd) return monthDate(seasonYear, 0);

  const step = mode === 'months' ? 1 : 3;
  const base = mode === 'months' ? ymd.month : quarterOf(ymd.month) * 3;
  let month = base + step;
  let year = ymd.year;
  if (month > 11) { month -= 12; year += 1; }

  // Past the end of the offered range there is nowhere to advance to; repeat the last slot rather
  // than silently producing a year the picker cannot show.
  if (!years.includes(year)) return monthDate(ymd.year, base);
  return monthDate(year, month);
}

/**
 * Every month (or quarter) of the season year that isn't already covered, appended and sorted —
 * "Fill the season", the one-click version of pressing Add period twelve times.
 */
export function fillSeasonPeriods(
  mode: PeriodSplitMode, periods: PeriodDraft[], seasonYear: number,
): PeriodDraft[] {
  if (mode !== 'months' && mode !== 'quarters') return periods;

  const slots = mode === 'months' ? 12 : 4;
  const taken = new Set<number>();
  for (const p of periods) {
    const ymd = readDate(p.date);
    if (!ymd || ymd.year !== seasonYear) continue;
    taken.add(mode === 'months' ? ymd.month : quarterOf(ymd.month));
  }

  const added: PeriodDraft[] = [];
  for (let slot = 0; slot < slots; slot++) {
    if (taken.has(slot)) continue;
    added.push({
      label: '',
      amount: '',
      date: mode === 'months' ? monthDate(seasonYear, slot) : quarterDate(seasonYear, slot),
    });
  }
  if (added.length === 0) return periods;

  // Undated rows keep their position at the end; dated rows sort chronologically, so a filled
  // season reads as a calendar rather than as the order things happened to be added.
  return [...periods, ...added].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
}

// ── reading a saved line back ────────────────────────────────────────────────

/**
 * Which mode a SAVED line should reopen in.
 *
 * A ladder from most specific to least, because the shapes overlap: every quarter start is also a
 * 1st-of-month, so quarters are only claimed when the stored LABELS agree ("Q1 2027"). Being wrong
 * costs the coach one tap on the right mode — and nothing is rewritten until they save.
 */
export function inferSplitMode(periods: PeriodDraft[]): PeriodSplitMode {
  if (periods.length === 0) return 'months';

  const dates = periods.map(p => readDate(p.date));
  if (dates.some(d => d === null)) return 'names';

  const ymds = dates as Ymd[];
  const allFirsts = ymds.every(d => d.day === 1);
  if (!allFirsts) return 'dates';

  const allQuarterStarts = ymds.every(d => d.month % 3 === 0);
  const labelsSayQuarters = periods.every((p, i) =>
    p.label.trim().toUpperCase().startsWith(`Q${quarterOf(ymds[i].month) + 1}`));
  if (allQuarterStarts && labelsSayQuarters) return 'quarters';

  return 'months';
}
