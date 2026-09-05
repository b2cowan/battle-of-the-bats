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
 * 1. **The undated column is a real column** ("No date yet" since 2026-09-04, matching the
 *    statement — see the note where it is built). A line with no period split, or a period entered in
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
import { monthKeyOf, addMonths, monthSpan, formatMonthLabel, MAX_MONTH_COLUMNS, type MonthKey } from './coach-budget-months.ts';
import { NO_ITEM_LABEL, NO_CATEGORY_LABEL } from './coach-budget-rollup.ts';
import {
  LINE_KIND_SECTION, BUDGET_LINE_KINDS, isFundingKind, normalizeBudgetLineKind,
  type BudgetLineKind,
} from './coach-budget-totals.ts';

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
  /** The item that NAMES this row (mig 240). `description` holds the item name captured when the
   *  line was written and is never re-synced, so it goes stale the moment a club admin renames a
   *  shared item — this is the live one, and the fallback is for money-in lines, which have none. */
  itemName?: string | null;
  /** The MERGE key (P1, 2026-09-02): two lines on one item are ONE row here, exactly as they are
   *  on the List — the item names the row, so two rows could only ever render as identical twins.
   *  Absent/null = a legacy line with no item; those fold into the category's "Not itemized"
   *  bucket for costs (the List's own rule via the rollup) and stay per-line for money in. */
  itemId?: string | null;
  categoryName: string | null;
  totalAmount: number;
  lineKind?: BudgetLineKind | null;
  periods: Array<{ periodDate: string | null; amount: number }>;
}

export interface PeriodColumn {
  /** `2027-04`, `2027-Q2`, or `unscheduled`. */
  key: string;
  /** `Apr`, `Q2`, `No date yet` — the column heading. The YEAR is not here: it lives in the band
   *  above (see PeriodYearBand), because it describes a group of columns, not this one. */
  label: string;
  unscheduled: boolean;
}

export interface PeriodViewRow {
  id: string;
  description: string;
  lineKind: BudgetLineKind;
  /** How many budget lines were summed into this row (rule 3 — the SUM ruling). ⚠ NOT RENDERED:
   *  the "N lines" caption this once fed came off every surface on 2026-09-04 (owner ruling, QA
   *  §133 — a fact the coach gets by opening the row does not need a label promising it). The
   *  count still decides shape upstream; nothing prints it. */
  lineCount: number;
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
 * dated columns; the undated column belongs to no year and sits under a deliberately empty band.
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
  /** Did anything land in the undated column? Drives whether that column exists at all. */
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

/**
 * ⚰ `scheduleSummaryLabel` STOOD HERE AND IS REPLACED BY `whenSummary` (owner ruling 2026-09-04).
 * It printed "Jan–Mar · 3 chunks", "Apr · 1 chunk", "3 chunks · no dates" or "—", and it had two
 * defects that the date requirement made unignorable:
 *
 *   1. **It counted chunks.** A count is not an answer to "when", and §133 ruled counts off rows
 *      elsewhere the same week.
 *   2. **⚠⚠ IT LIED ON A PARTLY-DATED LINE.** The UAT team's jersey order is a $500 deposit dated
 *      March plus a $1,000 balance with NO date; the column read "Mar · 2 chunks", so a coach
 *      scanning for undated money saw a fully dated line and the $1,000 stayed invisible until
 *      they opened it. That row, not the rename, is why this became a rewrite.
 *
 * And "—" could not tell a lump sum apart from an oversight, which is the whole point of the new
 * required answer.
 */

/** How many months are listed before the label switches to a span. Beyond four, the months stop
 *  being scannable and "spread across the year" is what a coach would say out loud anyway. */
const WHEN_MONTHS_LISTED = 4;

/**
 * What a budget line's **When** column says, as data rather than a string — because the chip paints
 * the undated half in the attention colour and the dated half in the plain one, and a caller cannot
 * split a sentence back apart safely.
 *
 * ⚠ THE UNDATED FIGURE IS A DOLLAR AMOUNT, and that is a deliberate reversal of the 2026-08-15
 * "no dollar figures in this column" rule (§9.6 / Chunk G rule 1). That rule was right when the
 * column only said WHEN: the row's own amount said how much. It stops being right the moment a
 * line can be *partly* dated, because then "how much of it is undated" is exactly the thing the
 * column is failing to say, and it is never the row's total.
 */
export interface WhenSummary {
  /** Month labels in order — `['Apr']`, `['Jan','Feb','Mar']`, or a single `['Jan–Dec']` span once
   *  more than four months carry money. Empty means nothing on this line has a date. */
  months: string[];
  /** Plan money on this line carrying no date at all. Zero when every chunk is dated. */
  undated: number;
}

/**
 * Yearless inside one year; the moment a line crosses New Year every label borrows
 * `formatMonthLabel`'s year tag ("Dec '26 · Jan '27") rather than letting two Januaries read alike.
 *
 * ⚠ A LINE WITH NO PERIODS IS THE WHOLE LINE UNDATED, which is why the total has to be passed in:
 * there are no chunks to add up, and reporting `undated: 0` there would make a lump sum look dated.
 */
export function whenSummary(
  periods: Array<{ periodDate: string | null; amount?: number | string | null }>,
  lineTotal: number,
): WhenSummary {
  if (periods.length === 0) return { months: [], undated: r2(lineTotal) };

  const dated = periods
    .map(p => ({ month: monthKeyOf(p.periodDate), amount: Number(p.amount ?? 0) || 0 }));
  const undated = r2(dated.filter(d => d.month === null).reduce((s, d) => s + d.amount, 0));

  const months = Array.from(new Set(
    dated.map(d => d.month).filter((m): m is MonthKey => m !== null),
  )).sort();
  if (months.length === 0) return { months: [], undated: r2(lineTotal) };

  const first = months[0];
  const last  = months[months.length - 1];
  const crossesYear = first.slice(0, 4) !== last.slice(0, 4);
  const name = (m: MonthKey) => (crossesYear
    ? formatMonthLabel(m)
    : MONTH_SHORT[Number(m.slice(5, 7)) - 1]);

  return {
    months: months.length <= WHEN_MONTHS_LISTED
      ? months.map(name)
      : [`${name(first)}–${name(last)}`],
    undated,
  };
}

/** The same answer as one string — for the export and anywhere a cell cannot carry two inks.
 *  ⚠ ONE SPELLING: "No date yet" is the month grid's column heading and the line form's own
 *  answer, so this is the third surface saying the same word rather than a fourth wording. */
export function whenSummaryText(s: WhenSummary, fmtMoney: (n: number) => string): string {
  if (s.months.length === 0) return 'No date yet';
  const dated = s.months.join(' · ');
  return s.undated > 0.005 ? `${dated} · ${fmtMoney(s.undated)} no date` : dated;
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

  // Rows keyed inside each group so two lines on one item are ONE row (P1, 2026-09-02 — the SUM
  // ruling of 2026-08-15, finally applied to this view too; per-line rows rendered as
  // indistinguishable twins because the item names the row and both lines carry the same item).
  const rowsByKey = new Map<string, Map<string, PeriodViewRow>>();

  for (const line of lines) {
    const lineKind: BudgetLineKind = normalizeBudgetLineKind(line.lineKind);
    // ⚠ Both money-in kinds carry the MINUS. A sponsorship treated as a cost would be added to
    // the month it lands in rather than subtracted from it, and the running balance below would
    // then be wrong by twice its amount (2026-08-15).
    const sign = isFundingKind(lineKind) ? -1 : 1;

    // Funding is one group regardless of the categories its lines carry: it is subtracted as a
    // whole, and splitting it by cost category would put money coming IN under a heading that
    // names something the team spends on.
    // Each money-in kind is ONE group, keyed by the kind itself — so fundraising and sponsorship
    // read as two headings rather than merging back into one the grid cannot tell apart.
    const groupKey = isFundingKind(lineKind) ? lineKind : (line.categoryName ?? 'Uncategorized');
    let group = groupsByKey.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        name: isFundingKind(lineKind) ? LINE_KIND_SECTION[lineKind] : groupKey,
        lineKind,
        rows: [],
        cells: {},
        total: 0,
      };
      groupsByKey.set(groupKey, group);
      rowsByKey.set(groupKey, new Map());
    }

    /* The merge key. Same item = same row (by ITEM ID, never by name — two items legitimately
       share a name across sources, and that twin is Q7's vocabulary territory, not this merge's).
       A COST line with no item folds into the category's "Not itemized" bucket, exactly as the
       List's rollup does; a money-in line with no item (pre-mig-243) stays a row of its own —
       the List never merges those, and its typed description is all the name it has.
       ⚠ "Is a cost" is asked through `isFundingKind`, never by comparing the kind to a literal
       (the guard's banned shape, and the genuine bug it exists for): a literal here would fold a
       FIFTH kind's item-less lines into the wrong bucket silently. */
    const isCost = !isFundingKind(lineKind);
    const rowKey = line.itemId
      ? `item:${line.itemId}`
      : isCost ? 'noitem' : `line:${line.id}`;
    const groupRows = rowsByKey.get(groupKey)!;
    let row = groupRows.get(rowKey);
    if (!row) {
      row = {
        id: `${groupKey}|${rowKey}`,
        description: line.itemId
          ? (line.itemName ?? line.description)
          : isCost ? NO_ITEM_LABEL : (line.itemName ?? line.description),
        lineKind,
        lineCount: 0,
        cells: {},
        total: 0,
      };
      groupRows.set(rowKey, row);
      group.rows.push(row);
    }
    row.lineCount += 1;

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
    row.total = r2(row.total + rowTotal);
    group.total = r2(group.total + rowTotal);
    for (const [key, amount] of Object.entries(cells)) {
      add(row.cells, key, amount);
      add(group.cells, key, amount);
      add(totals, key, amount);
    }
    grandTotal = r2(grandTotal + rowTotal);
  }

  /* ⚠ ONE ORDERING RULE, THE LIST'S, IN BOTH VIEWS (P1 verify-pass correction, 2026-09-02: the two
     views sorted differently — the List via the rollup's compareCategories, this view by insertion
     order — so toggling views reshuffled the plan). Cost categories alphabetical with the nameless
     bucket last (§133, and the rule moved here the same day it landed there), the
     money-in groups after them in kind order; cost rows alphabetical with "Not itemized" last (the
     rollup's own item sort); money-in rows keep line order, which is what their List section does. */
  for (const group of groupsByKey.values()) {
    if (isFundingKind(group.lineKind)) continue;
    group.rows.sort((a, b) => {
      const aNone = a.description === NO_ITEM_LABEL;
      const bNone = b.description === NO_ITEM_LABEL;
      if (aNone !== bNone) return aNone ? 1 : -1;
      return a.description.localeCompare(b.description);
    });
  }
  const groups = [...groupsByKey.values()]
    // Costs first, then the money-in groups — and among those, fundraising before sponsorship so
    // the order is the same everywhere the two appear.
    .sort((a, b) => {
      const byKind = BUDGET_LINE_KINDS.indexOf(a.lineKind) - BUDGET_LINE_KINDS.indexOf(b.lineKind);
      if (byKind !== 0) return byKind;
      /* ⚠ The nameless bucket LAST, because the rollup's own comparator does that for the List as
         of the §133 second look — and this view exists to hold one ordering rule for both. It is
         the same rule the rows above already follow for "Not itemized". */
      const aNone = a.name === NO_CATEGORY_LABEL;
      const bNone = b.name === NO_CATEGORY_LABEL;
      if (aNone !== bNone) return aNone ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

  /* ⚠ "No date yet", AND IT LEADS (owner ruling 2026-09-04, QA §133). Both halves were drift, and
     the NAME half was losing money: this view's export wrote "Unscheduled" as a heading and the
     importer has never known that word, so a plan exported from here and read back dropped every
     undated amount silently — the row still arrived, with no figure on it. Budget vs. Actual has
     always said "No date yet" and always put it first, so this view moves to meet it rather than
     the other way round.
     ⚠ The word is also SPOKEN FOR elsewhere: "Unscheduled" is what the schedule tools call a game
     with no date. One product, one meaning per word. */
  const columns: PeriodColumn[] = hasUnscheduled
    ? [{ key: UNSCHEDULED, label: 'No date yet', unscheduled: true }, ...dateColumns]
    : [...dateColumns];

  return {
    columns,
    yearBands: deriveYearBands(dateColumns),
    groups,
    totals: { cells: totals, total: grandTotal },
    hasUnscheduled,
    truncated,
  };
}
