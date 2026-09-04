/**
 * How a budget line's period split is ENTERED (coaches → Money → Season Budget Plan).
 *
 * A stored period is a name, an optional date and an amount — that is all, and this module does not
 * change it. What it adds is the coach-facing question the form asks first: *is this line split by
 * month, by quarter, by exact dates, or just by name?* The answer decides which control each row
 * gets and how a blank label is filled in. **The selection IS still the date** (months → the 1st,
 * quarters → the first day of the quarter) — nothing downstream that does arithmetic (Budget vs.
 * Actual, the month grid, installment generation) learns a new word.
 *
 * ⚠ SINCE MIG 274 THE MODE IS REMEMBERED on the line (its `split_mode` column, owner ruling
 * Q2 2026-09-02): the editor writes what the coach chose and reads it back, so a quarters split
 * whose label was edited no longer reopens as months. `inferSplitMode` survives as the FALLBACK
 * for lines written before the column existed (NULL) — the guess it used to be for everyone.
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

/** A raw `split_mode` from the database (or a request body), narrowed — one place, so a value the
 *  CHECK constraint would refuse can still never reach the pickers from a stale payload. Null =
 *  not stored (pre-274, or no split): the caller falls back to `inferSplitMode`. */
export function normalizeSplitMode(raw: string | null | undefined): PeriodSplitMode | null {
  return PERIOD_SPLIT_MODES.includes(raw as PeriodSplitMode) ? (raw as PeriodSplitMode) : null;
}

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

/** The heading over the date-side column. In `names` mode the date is OPTIONAL and sits second —
 *  the chunk's name leads (P2, 2026-09-02: a named chunk can carry a date without giving up its
 *  name, and one dateless chunk no longer hides the date controls for its dated siblings). */
export const SPLIT_MODE_COLUMN: Record<PeriodSplitMode, string> = {
  months:   'Month',
  quarters: 'Quarter',
  dates:    'Date',
  names:    'Date (optional)',
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

/* ─────────────────────────────────────────────────────────────────────────────
   THE AMOUNTS IN THE ROWS — even, and the refit that keeps a shape
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Split `whole` into `count` shares that are as equal as cents allow, the remainder on the LAST
 * row. Used for both money and percent, which is why the parameter has no unit in its name.
 *
 * ⚠ WHOLE CENTS THROUGHOUT. The obvious `Math.floor((whole / count) * 100) / 100` is wrong on
 * values a coach really types: $5.85 across three rows floors to 1.94 (because 5.85/3*100 is
 * 194.99999999999997 in binary floating point) and the last row silently absorbs the cent that
 * should never have gone missing.
 */
export function evenShares(whole: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.round(whole * 100);
  const base = Math.floor(cents / count);
  const last = cents - base * (count - 1);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? last : base) / 100);
}

/**
 * Was this split MEANT to be even?
 *
 * Owner ruling 2026-09-04 (QA §133). A split of $5,200 across three months is stored as
 * 1733 / 1733 / 1734 — a coach's whole-dollar rounding of a third — and refitting THOSE shares onto
 * $6,000 lands on 1999.62 / 1999.62 / 2000.76, which is proportionally exact and obviously wrong to
 * the coach who typed it. Rounding noise is not a shape, so it is not preserved.
 *
 * The test is EXACT, not a tolerance: the rows are even-but-for-rounding when they are *an even
 * split of their own sum* at one of the two grains anybody here actually rounds to — whole cents,
 * or whole dollars. At each grain that means either "as even as the grain allows" (no more than one
 * grain between the biggest row and the smallest) or exactly the shape `evenShares` itself
 * produces, whose LAST row carries the whole remainder. Order is ignored: a coach who types the odd
 * cent into the first row meant the same thing.
 *
 * ⚠⚠ A TOLERANCE WAS TRIED FIRST AND IT WAS WRONG (/review, same day). It read "one dollar, or half
 * a percent of the average row", and the percentage half is a real defect: **rounding noise has a
 * fixed size; it is never a fraction of the line.** Half a percent of a $50,000 row is $250 — so a
 * deliberate 50,125 / 49,875 counted as rounding and the next refit flattened it to a clean 50/50.
 * Erasing a coach's real number to tidy an imagined one is worse than not tidying.
 * ⚠ The accepted cost: a split ALREADY botched by the old arithmetic (1999.62 / 1999.62 / 2000.76)
 * is not recognised and will not heal itself on the next refit — by then it is genuinely
 * indistinguishable from a deliberate near-even shape. One tap on Split evenly fixes it, and that
 * tap is a far better price than the one above.
 */
export function isEvenWithinRounding(values: number[]): boolean {
  const count = values.length;
  if (count < 2) return true;
  const cents = values.map(v => Math.round(v * 100));
  const total = cents.reduce((s, v) => s + v, 0);
  if (total <= 0) return false;
  const sorted = [...cents].sort((a, b) => a - b);
  return [1, 100].some(grain => evenAtGrain(sorted, total, count, grain));
}

/** One grain's worth of the question above — 1 = whole cents, 100 = whole dollars. */
function evenAtGrain(sorted: number[], total: number, count: number, grain: number): boolean {
  if (total % grain !== 0 || sorted.some(c => c % grain !== 0)) return false;
  // As even as this grain allows.
  if (sorted[count - 1] - sorted[0] <= grain) return true;
  // Or the shape this module generates, whose last row carries the entire remainder — on a long
  // split that is legitimately several grains adrift of the first row.
  const units = total / grain;
  const base = Math.floor(units / count);
  const shape = Array.from({ length: count }, (_, i) =>
    (i === count - 1 ? units - base * (count - 1) : base) * grain).sort((a, b) => a - b);
  return shape.every((v, i) => v === sorted[i]);
}

/**
 * Refit an existing split onto a new line total — what "Rescale the split" does.
 *
 * Each row keeps its share of the old sum ($2,000 of $5,200 stays 5/13 of the new total), EXCEPT
 * where the rows were even but for rounding, which comes back exactly even (see
 * `isEvenWithinRounding`). The result always adds to the new total to the cent, so it can never
 * fail the sum check it exists to satisfy.
 *
 * ⚠ The leftover cents go to the rows with the largest fractional remainder — not all onto the last
 * row, which on a twelve-month split could push that row negative and blocked the save with a
 * different complaint.
 *
 * ⚠ ROWS THAT ADD TO NOTHING GET AN EVEN SPLIT, because there is no shape to keep and handing them
 * back untouched made this a SILENT NO-OP (/review): the banner offered a one-tap fix, the coach
 * took it, and every row stayed blank under the same red sum error.
 */
export function refitSplit(values: number[], total: number): number[] {
  const count = values.length;
  if (count === 0) return [];
  const oldSum = values.reduce((s, v) => s + v, 0);
  if (!(total > 0)) return values;
  if (oldSum <= 0 || isEvenWithinRounding(values)) return evenShares(total, count);

  const totalCents = Math.round(total * 100);
  const exact = values.map(v => (totalCents * v) / oldSum);
  const cents = exact.map(Math.floor);
  let leftover = totalCents - cents.reduce((s, v) => s + v, 0);
  const byRemainder = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; leftover > 0; k++, leftover--) cents[byRemainder[k % count].i] += 1;
  return cents.map(c => c / 100);
}
