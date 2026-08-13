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
 */

/** A month key, always `YYYY-MM`. */
export type MonthKey = string;

export interface DatedAmount {
  /** `YYYY-MM-DD`, or null when the amount carries no date (→ the "no date yet" bucket). */
  date: string | null;
  amount: number;
}

export interface GridLine {
  id: string;
  description: string;
  categoryName: string;
  /** Taxonomy item link, when the line has one — the strong key for prior-season matching. */
  itemId: string | null;
  itemName: string | null;
  totalAmount: number;
  /** Dated splits of `totalAmount`. Empty = the whole total is undated. */
  periods: DatedAmount[];
}

/** A paid expense or a commitment, already reduced to (category, date, amount). */
export interface CategoryEvent {
  categoryName: string | null;
  date: string | null;
  amount: number;
}

export interface PriorLine {
  description: string;
  itemId: string | null;
  itemName: string | null;
  categoryName: string;
  totalAmount: number;
}

export interface MonthCell {
  budget: number;
  scheduled: number;
  actual: number;
}

export interface GridLineResult {
  id: string;
  description: string;
  /** Per-month cells, index-aligned with `months`. */
  cells: MonthCell[];
  /** Budget the coach has not given a date to yet. */
  undatedBudget: number;
  /** Row totals, for the trailing Total column. */
  total: MonthCell;
  priorTotal: number | null;
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
  priorTotal: number | null;
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
    priorTotal: number | null;
  };
  /** Prior-season lines with nothing matching them this season — the "what am I forgetting?"
   *  half of the comparison column. */
  priorOnly: Array<{ description: string; categoryName: string; amount: number }>;
  hasPriorSeason: boolean;
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

function categoryKey(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

function blankCells(count: number): MonthCell[] {
  return Array.from({ length: count }, () => ({ budget: 0, scheduled: 0, actual: 0 }));
}

function addCell(target: MonthCell, source: MonthCell): void {
  target.budget = round2(target.budget + source.budget);
  target.scheduled = round2(target.scheduled + source.scheduled);
  target.actual = round2(target.actual + source.actual);
}

/**
 * Match a line to its prior-season equivalent: taxonomy item link first (exact and stable), then
 * a case-insensitive name match on description or item name. Names are all a free-text line has.
 */
function priorKeyCandidates(l: { itemId: string | null; itemName: string | null; description: string }): string[] {
  const out: string[] = [];
  if (l.itemId) out.push(`item:${l.itemId}`);
  if (l.itemName) out.push(`name:${l.itemName.trim().toLowerCase()}`);
  out.push(`name:${l.description.trim().toLowerCase()}`);
  return out;
}

export function buildMonthGrid(input: {
  lines: GridLine[];
  /** Paid amounts, by the date they were paid. */
  actuals: CategoryEvent[];
  /** Commitments, by the date they fall due (paid or not — a commitment is scheduled either way). */
  scheduled: CategoryEvent[];
  priorLines: PriorLine[];
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
  const { lines, actuals, scheduled, priorLines, todayMonth } = input;
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

  // Prior-season lines, indexed every way a current line might match them. The index holds the
  // LINES, not a running sum: a category total is the sum of the DISTINCT prior lines its lines
  // matched, so two same-named current lines can't count one prior line's dollars twice.
  const priorByKey = new Map<string, PriorLine[]>();
  const priorUsed = new Set<PriorLine>();
  for (const p of priorLines) {
    for (const key of priorKeyCandidates(p)) {
      const bucket = priorByKey.get(key);
      if (bucket) bucket.push(p); else priorByKey.set(key, [p]);
    }
  }

  // ── categories from the budget plan ──────────────────────────────────────
  const catOrder: string[] = [];
  const catLines = new Map<string, GridLine[]>();
  const catDisplay = new Map<string, string>();
  for (const line of lines) {
    const key = categoryKey(line.categoryName) || 'uncategorized';
    if (!catLines.has(key)) {
      catLines.set(key, []);
      catOrder.push(key);
      catDisplay.set(key, line.categoryName || 'Uncategorized');
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

  function place(events: CategoryEvent[], field: 'actual' | 'scheduled', undated: Map<string, number>) {
    for (const e of events) {
      if (!e.amount) continue;
      const key = categoryKey(e.categoryName) || 'uncategorized';
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
  for (const key of [...eventCells.keys(), ...undatedActual.keys(), ...undatedScheduled.keys()]) {
    if (catLines.has(key) || unplannedKeys.includes(key)) continue;
    unplannedKeys.push(key);
  }
  const eventDisplay = new Map<string, string>();
  for (const e of [...actuals, ...scheduled]) {
    const key = categoryKey(e.categoryName) || 'uncategorized';
    if (!eventDisplay.has(key)) eventDisplay.set(key, e.categoryName?.trim() || 'Uncategorized');
  }

  // ── assemble ─────────────────────────────────────────────────────────────
  const categories: GridCategoryResult[] = [];

  for (const key of [...catOrder, ...unplannedKeys]) {
    const ownLines = catLines.get(key) ?? [];
    const unplanned = !catLines.has(key);
    // The DISTINCT prior lines this category's lines matched — see `priorByKey`.
    const catPriorMatches = new Set<PriorLine>();

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

      // Match on the strongest key available: the taxonomy item link, then the item name, then
      // the description. First hit wins — a weaker key must not add a second match on top.
      let priorTotal: number | null = null;
      for (const k of priorKeyCandidates(line)) {
        const hits = priorByKey.get(k);
        if (!hits) continue;
        priorTotal = round2(hits.reduce((s, p) => s + p.totalAmount, 0));
        for (const p of hits) { priorUsed.add(p); catPriorMatches.add(p); }
        break;
      }

      const total: MonthCell = { budget: round2(line.totalAmount), scheduled: 0, actual: 0 };
      return {
        id: line.id,
        description: line.description,
        cells,
        undatedBudget,
        total,
        priorTotal,
      };
    });

    // Category cells = the plan's budget per month + the category's own scheduled/actual money.
    // Actuals and commitments are matched to a CATEGORY, not to a line (there is no payable↔line
    // link and, by owner ruling, there is not going to be one in v1), so they live at this level.
    const cells = blankCells(months.length);
    for (const lr of lineResults) {
      for (let i = 0; i < months.length; i++) cells[i].budget = round2(cells[i].budget + lr.cells[i].budget);
    }
    const ev = eventCells.get(key);
    if (ev) {
      for (let i = 0; i < months.length; i++) {
        cells[i].scheduled = round2(cells[i].scheduled + ev[i].scheduled);
        cells[i].actual = round2(cells[i].actual + ev[i].actual);
      }
    }

    const undatedBudget = round2(lineResults.reduce((s, l) => s + l.undatedBudget, 0));
    const total: MonthCell = {
      budget: round2(lineResults.reduce((s, l) => s + l.total.budget, 0)),
      scheduled: round2(
        cells.reduce((s, c) => s + c.scheduled, 0) + (undatedScheduled.get(key) ?? 0),
      ),
      actual: round2(
        cells.reduce((s, c) => s + c.actual, 0) + (undatedActual.get(key) ?? 0),
      ),
    };

    const priorTotal = catPriorMatches.size > 0
      ? round2([...catPriorMatches].reduce((s, p) => s + p.totalAmount, 0))
      : null;

    if (
      unplanned
      && total.scheduled === 0 && total.actual === 0
    ) continue; // nothing to show

    categories.push({
      categoryName: catDisplay.get(key) ?? eventDisplay.get(key) ?? 'Uncategorized',
      categoryKey: key,
      cells,
      undatedBudget,
      total,
      priorTotal,
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
      priorTotal: null,
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

  // Grand total from the DISTINCT prior lines matched anywhere — not the sum of category totals.
  // One prior line can answer to lines in two different categories (same name, different home),
  // and summing the categories would count its dollars twice.
  const priorGrandTotal = priorUsed.size > 0
    ? round2([...priorUsed].reduce((s, p) => s + p.totalAmount, 0))
    : null;

  const priorOnly = priorLines
    .filter(p => !priorUsed.has(p))
    .map(p => ({ description: p.description, categoryName: p.categoryName, amount: round2(p.totalAmount) }));

  return {
    months,
    truncated,
    categories,
    totals: {
      cells: totalCells,
      undatedBudget: undatedBudgetTotal,
      total: grandTotal,
      priorTotal: priorGrandTotal,
    },
    priorOnly,
    hasPriorSeason: priorLines.length > 0,
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
