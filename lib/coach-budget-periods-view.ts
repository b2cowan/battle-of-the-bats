/**
 * The Season Budget Plan, read ACROSS time instead of down a list.
 *
 * Month columns already existed — but only on Budget vs. Actual, blended with actuals, which is
 * why coaches on the plan concluded the plan had none (owner finding 2026-08-12). This turns the
 * plan payload the page has ALREADY fetched into month or quarter columns: no endpoint, no
 * refetch, and quarters are simply months grouped, so the two views can never disagree.
 *
 * Three rules the shape depends on:
 *
 * 1. **Unscheduled is a real column.** A line with no period split, or a period entered in
 *    "just names" mode with no date, has to go somewhere. Dropping it would make the columns
 *    quietly disagree with the plan's own total — the failure mode where a coach trusts a row of
 *    numbers that is missing $2,000. Naming it is honest, and doubles as the nudge to split it.
 * 2. **A funding line is stored positive; the KIND carries the sign** (migration 230). This
 *    view keeps funding cells SIGNED so the closing row (what players fund, per column) is a
 *    real subtraction — the plan page abs()es funding cells at render time, because on screen
 *    money-in reads positive in green (owner 2026-08-13).
 * 3. **The estimated total's difference is not here.** It is not a line and has no dates; it
 *    belongs to the summary ladder, which states it once.
 *
 * Pure: no IO, no React, no Date — every date is `YYYY-MM-DD` string arithmetic, so a coach in
 * Toronto and a server in UTC bucket a period into the same month.
 */

// Relative, with the extension, so `node --test` can load this module directly — the unit suite's
// resolver handles these but not the bundler's `@/` alias (see tests/ts-resolver.mjs).
import { monthKeyOf, addMonths, monthSpan, MAX_MONTH_COLUMNS, type MonthKey } from './coach-budget-months.ts';
import { LINE_KIND_SECTION, type BudgetLineKind } from './coach-budget-totals.ts';

export type PeriodGranularity = 'months' | 'quarters';

export const PERIOD_GRANULARITIES: PeriodGranularity[] = ['months', 'quarters'];

export const GRANULARITY_LABEL: Record<PeriodGranularity, string> = {
  months:   'Months',
  quarters: 'Quarters',
};

/** The key an undated amount lands under. Not a date, deliberately — it must never sort among
 *  the real columns or be mistaken for one. */
export const UNSCHEDULED = 'unscheduled';

/** The same readability ceiling the Budget-vs-Actual month grid uses — imported, not restated, so
 *  tuning it once tunes both. Quarters inherit the same window, so switching granularity never
 *  changes WHICH money is on screen. */
export const MAX_PERIOD_MONTHS = MAX_MONTH_COLUMNS;

export interface PeriodViewLine {
  id: string;
  description: string;
  categoryName: string | null;
  totalAmount: number;
  lineKind?: BudgetLineKind | null;
  periods: Array<{ periodDate: string | null; amount: number }>;
}

export interface PeriodColumn {
  /** `2027-04`, `2027-Q2`, or `unscheduled`. */
  key: string;
  /** `Apr`, `Q2`, `Unscheduled` — the column heading. The YEAR is not here: it lives in the band
   *  above (see PeriodYearBand), because it describes a group of columns, not this one. */
  label: string;
  unscheduled: boolean;
}

export interface PeriodViewRow {
  id: string;
  description: string;
  lineKind: BudgetLineKind;
  /** Column key → amount. Absent key = nothing in that column (rendered as a dash, never $0.00 —
   *  a zero and a nothing are different facts). */
  cells: Record<string, number>;
  total: number;
}

export interface PeriodViewGroup {
  key: string;
  name: string;
  lineKind: BudgetLineKind;
  rows: PeriodViewRow[];
  cells: Record<string, number>;
  total: number;
}

/**
 * One year's worth of columns, for the band that sits above the month/quarter row.
 *
 * ⚠ This replaced printing the year on the one column where it CHANGED (owner, 2026-08-13). That
 * made a single column taller than its neighbours — it read as a glitch — and it treated the year
 * as a label on one column when it is really a property of a GROUP of them. `span` counts only
 * dated columns; Unscheduled belongs to no year and sits under a deliberately empty band.
 */
export interface PeriodYearBand {
  year: string;
  span: number;
}

export interface PeriodView {
  columns: PeriodColumn[];
  /** Year bands over the dated columns, in order. Empty when nothing is dated. */
  yearBands: PeriodYearBand[];
  /** Cost categories, in the plan's own order, then the funding group last (it is subtracted, so
   *  it reads at the foot of the column the way the ladder reads at the foot of the page). */
  groups: PeriodViewGroup[];
  /** Costs − funding, per column: what players fund month by month. */
  totals: { cells: Record<string, number>; total: number };
  /** Did anything land in Unscheduled? Drives whether that column exists at all. */
  hasUnscheduled: boolean;
  /** True when the plan's dated span was wider than the window and the far end was dropped. The
   *  view SAYS so rather than showing a total that silently excludes it. */
  truncated: boolean;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** `2027-04` → `2027-Q2`. */
export function quarterKeyOf(month: MonthKey): string {
  const year = month.slice(0, 4);
  const q = Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1;
  return `${year}-Q${q}`;
}

function add(cells: Record<string, number>, key: string, amount: number): void {
  cells[key] = r2((cells[key] ?? 0) + amount);
}

/**
 * Which columns the grid gets: contiguous from the earliest dated period to the latest, so a month
 * with nothing in it still appears — "we pay nothing in June" is information, and a gap would let
 * two adjacent columns lie about how far apart they are.
 */
function deriveColumns(
  dates: string[], granularity: PeriodGranularity,
): { columns: PeriodColumn[]; truncated: boolean } {
  const months = dates
    .map(monthKeyOf)
    .filter((m): m is MonthKey => m !== null)
    .sort();

  if (months.length === 0) return { columns: [], truncated: false };

  const first = months[0];
  let last = months[months.length - 1];
  let truncated = false;
  if (monthSpan(first, last) > MAX_PERIOD_MONTHS) {
    last = addMonths(first, MAX_PERIOD_MONTHS - 1);
    truncated = true;
  }

  const span: MonthKey[] = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) span.push(m);

  if (granularity === 'months') {
    return {
      truncated,
      columns: span.map(m => ({
        key: m,
        label: MONTH_SHORT[Number(m.slice(5, 7)) - 1],
        unscheduled: false,
      })),
    };
  }

  const seen = new Set<string>();
  const columns: PeriodColumn[] = [];
  for (const m of span) {
    const key = quarterKeyOf(m);
    if (seen.has(key)) continue;
    seen.add(key);
    columns.push({ key, label: key.slice(5), unscheduled: false });
  }
  return { columns, truncated };
}

/** Group consecutive dated columns by their year. `2026-09` and `2026-Q3` both yield `2026`. */
function deriveYearBands(columns: PeriodColumn[]): PeriodYearBand[] {
  const bands: PeriodYearBand[] = [];
  for (const col of columns) {
    if (col.unscheduled) continue;
    const year = col.key.slice(0, 4);
    const last = bands[bands.length - 1];
    if (last && last.year === year) last.span += 1;
    else bands.push({ year, span: 1 });
  }
  return bands;
}

/** Where one amount lands. A period with no date, or a line with no split at all, is unscheduled —
 *  and an amount outside the window is folded into the nearest end rather than vanishing. */
function columnFor(
  date: string | null, granularity: PeriodGranularity, columnKeys: string[],
): string {
  const month = monthKeyOf(date);
  if (!month) return UNSCHEDULED;
  const key = granularity === 'months' ? month : quarterKeyOf(month);
  if (columnKeys.includes(key)) return key;
  // Only reachable past the truncation window; the last column absorbs it so the row total and
  // the sum of its cells always agree. The view flags `truncated` so this is stated, not hidden.
  return columnKeys[columnKeys.length - 1] ?? UNSCHEDULED;
}

export function buildPeriodView(
  lines: PeriodViewLine[], granularity: PeriodGranularity,
): PeriodView {
  const dated: string[] = [];
  for (const line of lines) {
    for (const p of line.periods) {
      if (p.periodDate) dated.push(p.periodDate);
    }
  }

  const { columns: dateColumns, truncated } = deriveColumns(dated, granularity);
  const columnKeys = dateColumns.map(c => c.key);

  const groupsByKey = new Map<string, PeriodViewGroup>();
  const totals: Record<string, number> = {};
  let grandTotal = 0;
  let hasUnscheduled = false;

  for (const line of lines) {
    const lineKind: BudgetLineKind = line.lineKind === 'funding' ? 'funding' : 'cost';
    const sign = lineKind === 'funding' ? -1 : 1;

    const cells: Record<string, number> = {};
    if (line.periods.length === 0) {
      add(cells, UNSCHEDULED, sign * line.totalAmount);
    } else {
      for (const p of line.periods) {
        add(cells, columnFor(p.periodDate, granularity, columnKeys), sign * p.amount);
      }
    }
    if (cells[UNSCHEDULED] !== undefined) hasUnscheduled = true;

    const rowTotal = r2(sign * line.totalAmount);
    const row: PeriodViewRow = { id: line.id, description: line.description, lineKind, cells, total: rowTotal };

    // Funding is one group regardless of the categories its lines carry: it is subtracted as a
    // whole, and splitting it by cost category would put money coming IN under a heading that
    // names something the team spends on.
    const groupKey = lineKind === 'funding' ? 'funding' : (line.categoryName ?? 'Uncategorized');
    let group = groupsByKey.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        name: lineKind === 'funding' ? LINE_KIND_SECTION.funding : groupKey,
        lineKind,
        rows: [],
        cells: {},
        total: 0,
      };
      groupsByKey.set(groupKey, group);
    }
    group.rows.push(row);
    group.total = r2(group.total + rowTotal);
    for (const [key, amount] of Object.entries(cells)) {
      add(group.cells, key, amount);
      add(totals, key, amount);
    }
    grandTotal = r2(grandTotal + rowTotal);
  }

  const groups = [...groupsByKey.values()]
    .sort((a, b) => (a.lineKind === b.lineKind ? 0 : a.lineKind === 'funding' ? 1 : -1));

  const columns: PeriodColumn[] = [...dateColumns];
  if (hasUnscheduled) {
    columns.push({ key: UNSCHEDULED, label: 'Unscheduled', unscheduled: true });
  }

  return {
    columns,
    yearBands: deriveYearBands(dateColumns),
    groups,
    totals: { cells: totals, total: grandTotal },
    hasUnscheduled,
    truncated,
  };
}
