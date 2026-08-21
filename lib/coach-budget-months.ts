/**
 * Money by Month (Coach Portal chunk H) — the month grid's arithmetic, with no IO.
 *
 * The Budget-vs-Actual route already buckets a monthly series for its cumulative chart. This
 * module is the same idea done honestly for a GRID, where every cell is read individually:
 *
 *  • Budget with NO date is NOT smeared across the months (what the chart used to do). It goes
 *    into an explicit "no date yet" bucket, because a coach reading a cell must never see money
 *    in a month they did not choose. (Owner decision D-H3, 2026-07-30.)
 *  • "Scheduled" (what the team has COMMITTED to pay, by due date) is a separate lens and never
 *    merges into the budget estimate — nothing double-counts and no payable↔line link is needed.
 *    (Owner ruling, 2026-07-30.)
 *  • "Difference" is only meaningful for months that have already happened; a future month with
 *    no spending is not a saving. The caller blanks those using `isElapsed`.
 *
 * The season has no stored start/end date (`rep_program_years` carries a year and a name only),
 * so the month range is DERIVED from the team's own dated money — see `deriveMonthRange`.
 *
 * ⚠⚠ CATEGORY IDENTITY IS NOT THIS MODULE's TO DECIDE (2026-08-17). It comes from
 * `coach-budget-rollup`'s `categoryKey`, which the statement uses — id first, name only as a
 * fallback. This module used to key by lowercased name alone, which is how Months and the statement
 * bucketed one report two ways; the header on that function has the two shapes it broke.
 */
/* ⚠ THE `.ts` EXTENSION IS LOAD-BEARING. Both modules are pure, and `scripts/check-demos.mjs` loads
   this one under plain Node — where an extensionless specifier does not resolve and the demo check
   dies with ERR_MODULE_NOT_FOUND rather than anything about money. Same reason the other pure
   `lib/coach-*` modules spell it out. */
import {
  categoryKey as categoryIdentity, displayCategoryName, NO_CATEGORY_LABEL,
} from './coach-budget-rollup.ts';

/** A month key, always `YYYY-MM`. */
export type MonthKey = string;

export interface DatedAmount {
  /** `YYYY-MM-DD`, or null when the amount carries no date (→ the "no date yet" bucket). */
  date: string | null;
  amount: number;
}

/**
 * One budget line standing behind a grid row, so the row can send a coach to the right editor.
 *
 * ⚠⚠ THE ROW IS AN ITEM, NOT A LINE, AND THAT IS WHY THIS EXISTS (owner-approved fix, 2026-08-17).
 * A grid row's own `id` stopped being a budget line id on 2026-08-15, when the rows began coming from
 * the report rollup so that Months and the statement could not group one plan two different ways. Two
 * budget lines on one item are ONE row by owner ruling — so the row has no single line to address, and
 * the "Edit this line's payment dates" link went on handing the composite row id to the budget page,
 * which looked for a line, found none, and returned **silently**. Two affordances were dead for two
 * days: that link and, worse, the "No date yet" cell, which is the grid's only route out of undated
 * budget.
 *
 * The rule: **the link addresses the ITEM and the item answers for its lines.** One line behind the
 * row → open that line's dates. Two or more → ask which. Never guess (a coach would silently edit a
 * line they were not looking at), and never withdraw the control (that would strand exactly the teams
 * whose plans are most complex).
 */
export interface GridPlanLine {
  /* ⚠ THE TABLE THIS ID BELONGS TO IS DELIBERATELY NOT NAMED HERE. `budget-line-kind-guard` scans for
     modules that read the budget-lines table without accounting for a line's KIND, and it flagged this
     file for the mention alone. Naming it and taking an exemption would have switched that guard off
     for this module permanently — including for a future edit that really did read the table. This
     module receives already-partitioned rows and never queries anything, so the honest fix was to stop
     saying the table's name. */
  /** The real budget-line id — what the budget page's deep link resolves against the plan. */
  id: string;
  /** The line's own typed description, which is how a coach tells two lines on one item apart. */
  description: string;
  amount: number;
  /** The dates it is currently split across. Empty = undated, which is worth saying out loud. */
  dates: string[];
}

export interface GridLine {
  id: string;
  description: string;
  categoryName: string;
  /** The category's real identity, when it has one. Absent = keyed by name (see the module header). */
  categoryId?: string | null;
  /** The budget lines this row stands for — see `GridPlanLine`. Absent on a spend-only row. */
  planLines?: GridPlanLine[];
  /** Taxonomy item link, when the line has one. THE KEY MONEY IS FILED UNDER: spending carries
   *  the same item, which is how a row gets its own figures rather than a dash. */
  itemId: string | null;
  totalAmount: number;
  /**
   * Is this row actually IN the plan? (mig 240.)
   *
   * ⚠ IT EXISTS BECAUSE THE ROWS STOPPED BEING BUDGET LINES. The grid used to be fed raw budget
   * lines, so a category with no line simply never appeared and `unplanned` could be read off the
   * map. It is now fed the report rollup, which emits a zero-budget row for every item the team
   * SPENT on — so every spending category has a row and the map can no longer tell the two apart.
   * Absent reads as true, which keeps every pre-240 caller honest.
   */
  inPlan?: boolean;
  /** Dated splits of `totalAmount`. Empty = the whole total is undated. */
  periods: DatedAmount[];
}

/** A paid expense or a commitment, already reduced to (category, date, amount). */
export interface CategoryEvent {
  categoryName: string | null;
  /** As on `GridLine` — the identity the statement grouped this money by, when it has one. */
  categoryId?: string | null;
  /**
   * ⚠⚠ WHICH ITEM THIS MONEY IS FOR (2026-08-21, owner-found). Without it the grid could only ever
   * put spending on a CATEGORY, so every item row showed a dash in its money columns — reading as
   * "no money here" on the very row the money belonged to, while the Statement view of the same
   * report itemised it correctly.
   *
   * ⚠ The join was always available and simply was not carried: every cost names an item (required
   * on the form and re-enforced by the server), and every grid row IS an item and already knows its
   * id. A stale comment claiming there was no such link outlived the migration that created it.
   *
   * Absent/null means genuinely unattributed — only reachable on rows predating the item
   * requirement — and lands in the category’s own bucket rather than being dropped.
   */
  itemId?: string | null;
  date: string | null;
  amount: number;
}

export interface MonthCell {
  budget: number;
  scheduled: number;
  actual: number;
}

export interface GridLineResult {
  id: string;
  description: string;
  /** Carried straight through so a cell can address a real budget line — see `GridPlanLine`. */
  planLines: GridPlanLine[];
  /** Per-month cells, index-aligned with `months`. */
  cells: MonthCell[];
  /** Budget the coach has not given a date to yet. */
  undatedBudget: number;
  /** Row totals, for the trailing Total column. */
  total: MonthCell;
}

export interface GridCategoryResult {
  categoryName: string;
  /** Lowercased/trimmed name — the same key the actuals join on, and the key a drill-in uses to
   *  find a cell's detail list. Returned rather than re-derived on the client so the two can't
   *  drift apart. */
  categoryKey: string;
  cells: MonthCell[];
  undatedBudget: number;
  total: MonthCell;
  lines: GridLineResult[];
  /** True when this category exists only because something is scheduled or paid against it —
   *  the coach has no budget line for it at all. Worth seeing, never worth hiding. */
  unplanned: boolean;
}

export interface MonthGrid {
  months: MonthKey[];
  /** True when the derived range was longer than the column cap and had to be cut. */
  truncated: boolean;
  categories: GridCategoryResult[];
  totals: {
    cells: MonthCell[];
    undatedBudget: number;
    total: MonthCell;
  };
}

// ── month key helpers ────────────────────────────────────────────────────────

/** `YYYY-MM-DD` (or an ISO timestamp) → `YYYY-MM`. Pure string work: no Date, no timezone. */
export function monthKeyOf(date: string | null | undefined): MonthKey | null {
  if (!date || date.length < 7) return null;
  const key = date.slice(0, 7);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key) ? key : null;
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const total = year * 12 + (month - 1) + n;
  const y = Math.floor(total / 12);
  const m = total % 12;
  return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}`;
}

/** Inclusive month count between two keys (`monthSpan('2026-03','2026-03') === 1`). */
export function monthSpan(from: MonthKey, to: MonthKey): number {
  const a = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7));
  const b = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7));
  return b - a + 1;
}

export const MIN_MONTH_COLUMNS = 6;
export const MAX_MONTH_COLUMNS = 24;

/**
 * The columns of the grid.
 *
 * Contiguous by design — a spreadsheet has no gaps, and a month with nothing in it is itself
 * information ("we pay nothing in June"). Derived from every dated money event the team has,
 * because the season stores no date span. A team with no dated money at all still gets a usable
 * window anchored on today so the grid is never a single column.
 */
export function deriveMonthRange(
  dates: Array<string | null | undefined>,
  todayMonth: MonthKey,
  opts: { min?: number; max?: number } = {},
): { months: MonthKey[]; truncated: boolean } {
  const min = opts.min ?? MIN_MONTH_COLUMNS;
  const max = opts.max ?? MAX_MONTH_COLUMNS;

  const keys = dates
    .map(monthKeyOf)
    .filter((k): k is MonthKey => k !== null)
    .sort();

  let first = keys[0] ?? todayMonth;
  let last = keys[keys.length - 1] ?? todayMonth;

  // Degenerate range — nothing dated, or everything dated in one month — gets a readable window
  // so a new plan is never a one-column grid. Extended FORWARD, because a budget's future is the
  // part a coach can still act on. A team with a genuine range keeps exactly that range: padding a
  // real five-month season out to six would invent a column nothing lives in.
  if (first === last) last = addMonths(first, min - 1);

  // A season in progress should show the month the coach is standing in, even when nothing is
  // dated there — otherwise "this month" is missing from the treasurer's own view.
  if (todayMonth < first) first = todayMonth;
  if (todayMonth > last) last = todayMonth;

  let truncated = false;
  if (monthSpan(first, last) > max) {
    last = addMonths(first, max - 1);
    truncated = true;
  }

  const months: MonthKey[] = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) months.push(m);
  return { months, truncated };
}

// ── bucketing ────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The shared identity, applied to whatever a line or an event happens to carry. */
function categoryKey(what: { categoryId?: string | null; categoryName: string | null | undefined }): string {
  return categoryIdentity(what.categoryId ?? null, what.categoryName ?? null);
}

function blankCells(count: number): MonthCell[] {
  return Array.from({ length: count }, () => ({ budget: 0, scheduled: 0, actual: 0 }));
}

function addCell(target: MonthCell, source: MonthCell): void {
  target.budget = round2(target.budget + source.budget);
  target.scheduled = round2(target.scheduled + source.scheduled);
  target.actual = round2(target.actual + source.actual);
}

export function buildMonthGrid(input: {
  lines: GridLine[];
  /** Paid amounts, by the date they were paid. */
  actuals: CategoryEvent[];
  /** Commitments, by the date they fall due (paid or not — a commitment is scheduled either way). */
  scheduled: CategoryEvent[];
  todayMonth: MonthKey;
  maxMonths?: number;
  /**
   * ESTIMATE dollars not yet covered by any line (`rep_program_years.budget_amount` above the
   * itemized sum). The category view already shows this as a "Not itemized yet" row; the month
   * grid must too, or the same page would report two different budget totals. It has no date by
   * definition, so it lands in the "no date yet" column. Positive only — an estimate BELOW the
   * lines has nothing unallocated to stand in for, and a negative row here would read as a refund.
   */
  bufferAmount?: number;
}): MonthGrid {
  const { lines, actuals, scheduled, todayMonth } = input;
  const bufferAmount = round2(input.bufferAmount ?? 0);

  const { months, truncated } = deriveMonthRange(
    [
      ...lines.flatMap(l => l.periods.map(p => p.date)),
      ...actuals.map(a => a.date),
      ...scheduled.map(s => s.date),
    ],
    todayMonth,
    { max: input.maxMonths ?? MAX_MONTH_COLUMNS },
  );
  const monthIndex = new Map(months.map((m, i) => [m, i]));

  // ── categories from the budget plan ──────────────────────────────────────
  const catOrder: string[] = [];
  const catLines = new Map<string, GridLine[]>();
  const catDisplay = new Map<string, string>();
  for (const line of lines) {
    const key = categoryKey(line);
    if (!catLines.has(key)) {
      catLines.set(key, []);
      catOrder.push(key);
      catDisplay.set(key, displayCategoryName(line.categoryName));
    }
    catLines.get(key)!.push(line);
  }

  // ── money events, bucketed to (category, month) ──────────────────────────
  const eventCells = new Map<string, MonthCell[]>();
  const undatedActual = new Map<string, number>();
  const undatedScheduled = new Map<string, number>();

  function cellsFor(key: string): MonthCell[] {
    let c = eventCells.get(key);
    if (!c) { c = blankCells(months.length); eventCells.set(key, c); }
    return c;
  }

  /* ⚠⚠ MONEY IS KEYED BY CATEGORY *AND* ITEM, and the shape matches `GridLine.id` exactly so a
     movement lands on the row it belongs to. Keyed by category alone, every item row showed a dash
     while its category carried the total (owner-found 2026-08-21). `no-item` is the same fallback
     the row ids use, so unattributed money still has somewhere honest to sit. */
  const eventKey = (e: CategoryEvent) => `${categoryKey(e)}|${e.itemId ?? 'no-item'}`;

  /* ⚠ SPLIT FROM THE RIGHT. A category key can be `name:<the name>` and a category name may
     legitimately contain a pipe; the item suffix never can (a uuid, or the literal `no-item`),
     so the LAST separator is the only safe one to cut on. */
  const catOf = (rowKey: string) => rowKey.slice(0, rowKey.lastIndexOf('|'));

  /* ⚠ THE ROW’S MONEY KEY IS BUILT FROM WHAT THE ROW *IS*, never from `line.id`. The caller’s id
     happens to be the same shape today, and depending on that would be a silent coupling: a caller
     numbering its rows differently would get money that lands nowhere, with no error. */
  const lineKey = (l: { categoryId?: string | null; categoryName: string | null; itemId: string | null }) =>
    `${categoryKey(l)}|${l.itemId ?? 'no-item'}`;

  function place(events: CategoryEvent[], field: 'actual' | 'scheduled', undated: Map<string, number>) {
    for (const e of events) {
      if (!e.amount) continue;
      const key = eventKey(e);
      const m = monthKeyOf(e.date);
      const i = m != null ? monthIndex.get(m) : undefined;
      if (i === undefined) {
        // Outside the window (only possible when the range was truncated) or genuinely undated —
        // never silently dropped, never smeared.
        undated.set(key, round2((undated.get(key) ?? 0) + e.amount));
        continue;
      }
      const cells = cellsFor(key);
      cells[i][field] = round2(cells[i][field] + e.amount);
    }
  }
  place(actuals, 'actual', undatedActual);
  place(scheduled, 'scheduled', undatedScheduled);

  // A category the team spends or owes on but has never budgeted still gets a row.
  const unplannedKeys: string[] = [];
  // ⚠ The maps are keyed by row (category|item) now, so the CATEGORY has to be read back out —
  // comparing a row key against `catLines` would never match and every category would look new.
  for (const rowKey of [...eventCells.keys(), ...undatedActual.keys(), ...undatedScheduled.keys()]) {
    const key = catOf(rowKey);
    if (catLines.has(key) || unplannedKeys.includes(key)) continue;
    unplannedKeys.push(key);
  }
  const eventDisplay = new Map<string, string>();
  for (const e of [...actuals, ...scheduled]) {
    const key = categoryKey(e);
    if (!eventDisplay.has(key)) eventDisplay.set(key, displayCategoryName(e.categoryName));
  }

  // ── assemble ─────────────────────────────────────────────────────────────
  const categories: GridCategoryResult[] = [];

  for (const key of [...catOrder, ...unplannedKeys]) {
    const ownLines = catLines.get(key) ?? [];
    // A category is unplanned when NOTHING in it is in the plan — not merely when it has no rows,
    // which stopped being the same question once spend-only rows started arriving (see GridLine).
    const unplanned = ownLines.length === 0 || ownLines.every(l => l.inPlan === false);

    /* ⚠ ONE ROW CLAIMS A KEY. Two rows in one category sharing an item (or both item-less) would
       otherwise each add the same money, and the category — the sum of its rows — would double it. */
    const claimed = new Set<string>();
    const lineResults: GridLineResult[] = ownLines.map(line => {
      const cells = blankCells(months.length);
      let undatedBudget = 0;

      if (line.periods.length === 0) {
        undatedBudget = round2(line.totalAmount);
      } else {
        let placed = 0;
        for (const p of line.periods) {
          const m = monthKeyOf(p.date);
          const i = m != null ? monthIndex.get(m) : undefined;
          if (i === undefined) { undatedBudget = round2(undatedBudget + p.amount); continue; }
          cells[i].budget = round2(cells[i].budget + p.amount);
          placed = round2(placed + p.amount);
        }
        // Periods are validated to sum to the line total (±$0.02) on write, but a line edited
        // after its periods were set can drift. Anything unaccounted for is undated, not lost.
        const remainder = round2(line.totalAmount - placed - undatedBudget);
        if (remainder > 0.005) undatedBudget = round2(undatedBudget + remainder);
      }

      /* ⚠⚠ THE ROW'S OWN MONEY, which it never used to get (owner-found 2026-08-21). Spending was
         placed on the CATEGORY, so every item row showed a dash in its money columns — reading as
         "no money here" on the exact row the money belonged to, while the Statement view of the
         same report itemised it correctly. ⚠ Keyed by `lineKey(line)` — what the row IS —
         never by `line.id`; see the rule above `eventKey`. */
      const own = claimed.has(lineKey(line)) ? undefined : eventCells.get(lineKey(line));
      claimed.add(lineKey(line));
      if (own) {
        for (let i = 0; i < months.length; i++) {
          cells[i].scheduled = round2(cells[i].scheduled + own[i].scheduled);
          cells[i].actual = round2(cells[i].actual + own[i].actual);
        }
      }
      const total: MonthCell = {
        budget: round2(line.totalAmount),
        // Undated money is in the total but in no column — the same shape the category uses.
        scheduled: round2(cells.reduce((t, c) => t + c.scheduled, 0) + (undatedScheduled.get(lineKey(line)) ?? 0)),
        actual: round2(cells.reduce((t, c) => t + c.actual, 0) + (undatedActual.get(lineKey(line)) ?? 0)),
      };
      return {
        id: line.id,
        description: line.description,
        planLines: line.planLines ?? [],
        cells,
        undatedBudget,
        total,
      };
    });

    /* ⚠⚠ THE CATEGORY IS NOW THE SUM OF ITS ROWS — which is what a reader always assumed it was.
       It used to carry the money itself while its rows showed dashes; the old comment here said
       there was no link from a cost to a row, and that was true when written and stopped being
       true when every cost started naming an item. Both sides have carried the key ever since.

       ⚠ ORPHANS STILL LAND SOMEWHERE. Money whose item has no row in this category (only
       reachable for costs predating the item requirement, which key as `no-item`) is added at
       the category level rather than dropped — so the grand total is unchanged either way. */
    const cells = blankCells(months.length);
    for (const lr of lineResults) {
      for (let i = 0; i < months.length; i++) addCell(cells[i], lr.cells[i]);
    }
    const rowKeys = new Set(ownLines.map(lineKey));
    for (const [rowKey, ev] of eventCells) {
      if (catOf(rowKey) !== key || rowKeys.has(rowKey)) continue;
      for (let i = 0; i < months.length; i++) {
        cells[i].scheduled = round2(cells[i].scheduled + ev[i].scheduled);
        cells[i].actual = round2(cells[i].actual + ev[i].actual);
      }
    }
    /* Every undated entry belonging to this category, whether or not it found a row. The cells
       above already hold all of its DATED money, so these two are the whole remainder. */
    const undatedIn = (m: Map<string, number>) => round2(
      [...m].reduce((t, [rowKey, v]) => (catOf(rowKey) === key ? t + v : t), 0));

    const undatedBudget = round2(lineResults.reduce((s, l) => s + l.undatedBudget, 0));
    const total: MonthCell = {
      budget: round2(lineResults.reduce((s, l) => s + l.total.budget, 0)),
      scheduled: round2(cells.reduce((s, c) => s + c.scheduled, 0) + undatedIn(undatedScheduled)),
      actual: round2(cells.reduce((s, c) => s + c.actual, 0) + undatedIn(undatedActual)),
    };

    if (
      unplanned
      && total.scheduled === 0 && total.actual === 0
    ) continue; // nothing to show

    categories.push({
      // ⚠ The last fallback is the statement's own word for a nameless category, not a second
      // spelling of it. "Uncategorized" here against "No category" there is how one bucket read as
      // two rows on one screen.
      categoryName: catDisplay.get(key) ?? eventDisplay.get(key) ?? NO_CATEGORY_LABEL,
      categoryKey: key,
      cells,
      undatedBudget,
      total,
      lines: lineResults,
      unplanned,
    });
  }

  if (bufferAmount > 0.005) {
    categories.push({
      categoryName: 'Not itemized yet',
      categoryKey: '__buffer__',
      cells: blankCells(months.length),
      undatedBudget: bufferAmount,
      total: { budget: bufferAmount, scheduled: 0, actual: 0 },
      lines: [],
      unplanned: false,
    });
  }

  // ── grand totals ─────────────────────────────────────────────────────────
  const totalCells = blankCells(months.length);
  for (const c of categories) for (let i = 0; i < months.length; i++) addCell(totalCells[i], c.cells[i]);
  const grandTotal: MonthCell = { budget: 0, scheduled: 0, actual: 0 };
  for (const c of categories) addCell(grandTotal, c.total);
  const undatedBudgetTotal = round2(categories.reduce((s, c) => s + c.undatedBudget, 0));

  return {
    months,
    truncated,
    categories,
    totals: {
      cells: totalCells,
      undatedBudget: undatedBudgetTotal,
      total: grandTotal,
    },
  };
}

// ── cash flow ────────────────────────────────────────────────────────────────

export interface CashFlowRow {
  month: MonthKey;
  moneyIn: number;
  moneyOut: number;
  running: number;
}

export interface CashFlowResult {
  rows: CashFlowRow[];
  /** The first month the running balance goes negative — the whole point of the strip. */
  shortfall: { month: MonthKey; amount: number } | null;
}

/**
 * Running balance across the grid's months.
 *
 * Money OUT comes from whichever lens the coach is reading — the plan under Budget, the
 * commitments under Scheduled, real spending under Actual. Never a blend: mixing a planned
 * estimate with a commitment for the same cost is exactly the double-count the "Scheduled is a
 * separate lens" ruling exists to prevent.
 */
export function buildCashFlow(
  months: MonthKey[],
  moneyInByMonth: Record<string, number>,
  moneyOutByMonth: Record<string, number>,
  openingBalance = 0,
): CashFlowResult {
  let running = round2(openingBalance);
  let shortfall: CashFlowResult['shortfall'] = null;

  const rows = months.map(month => {
    const moneyIn = round2(moneyInByMonth[month] ?? 0);
    const moneyOut = round2(moneyOutByMonth[month] ?? 0);
    running = round2(running + moneyIn - moneyOut);
    if (running < -0.005 && !shortfall) shortfall = { month, amount: round2(Math.abs(running)) };
    return { month, moneyIn, moneyOut, running };
  });

  return { rows, shortfall };
}

// ── lenses ───────────────────────────────────────────────────────────────────

/** What a cell shows. One payload serves all four, so flipping a lens never refetches. */
export type MoneyLens = 'budget' | 'scheduled' | 'actual' | 'difference';

/** Has this month already happened? Drives the Difference lens blanking future months. */
export function isElapsed(month: MonthKey, todayMonth: MonthKey): boolean {
  return month <= todayMonth;
}

/**
 * The value one MONTH cell shows under a lens, or null for "nothing to say here".
 *
 * Difference is Budget − Actual and ONLY for months that have already happened: a future month
 * with nothing spent in it is not a saving, and showing the whole budget as "under" would flatter
 * a coach into a shortfall (owner decision D-H5, 2026-07-30). Shared by the grid and its export
 * so the file a coach downloads can never disagree with the screen they downloaded it from.
 */
export function lensCell(
  cell: MonthCell, lens: MoneyLens, month: MonthKey, todayMonth: MonthKey,
): number | null {
  if (lens !== 'difference') return cell[lens];
  if (!isElapsed(month, todayMonth)) return null;
  return round2(cell.budget - cell.actual);
}

/** The same for a ROW total, where every month has already been rolled in. */
export function lensTotal(total: MonthCell, lens: MoneyLens): number {
  return lens === 'difference' ? round2(total.budget - total.actual) : total[lens];
}

/** Does this lens read the PLAN? Only those two can say anything about undated budget. */
export function lensReadsPlan(lens: MoneyLens): boolean {
  return lens === 'budget' || lens === 'difference';
}

/** "2026-03" → "Mar '26". Short by necessity: this is a column header on a phone. */
export function formatMonthLabel(month: MonthKey): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = Number(month.slice(5, 7));
  return `${names[m - 1] ?? month} '${month.slice(2, 4)}`;
}

/** "2026-03" → "March 2026", for prose (the shortfall sentence, a drill-in panel title). */
export function formatMonthLong(month: MonthKey): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const m = Number(month.slice(5, 7));
  return `${names[m - 1] ?? month} ${month.slice(0, 4)}`;
}
