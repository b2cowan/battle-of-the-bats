/**
 * The Season Budget Plan, read ACROSS time instead of down a list.
 *
 * Month columns already existed — but only on Budget vs. Actual, blended with actuals, which is
 * why coaches on the plan concluded the plan had none (owner finding 2026-08-12). This turns the
 * plan payload the page has ALREADY fetched into month or quarter columns: no endpoint, no
 * refetch, and quarters are simply months grouped, so the two views can never disagree.
 *
 * Four rules the shape depends on:
 *
 * 1. **The undated column is a real column** ("No date yet" since 2026-09-04, matching the
 *    statement — see the note where it is built). A line with no period split, or a period entered in
 *    "just names" mode with no date, has to go somewhere. Dropping it would make the columns
 *    quietly disagree with the plan's own total — the failure mode where a coach trusts a row of
 *    numbers that is missing $2,000. Naming it is honest, and doubles as the nudge to split it.
 * 2. **A funding line is stored positive; the KIND carries the sign** (migration 230). Inside
 *    this view a money-in GROUP's cells stay SIGNED (negative) — the plan page abs()es them at
 *    render time, because on screen money-in reads positive in green (owner 2026-08-13) — while
 *    `revenueTotals` is already POSITIVE, the way the Revenue band's subtotal prints it. Two
 *    signs, one rule each: never negate `revenueTotals` again in a renderer.
 * 3. **What has no dates goes in the undated column, and nothing is left out** (owner ruling
 *    2026-09-09 — this rule REPLACED "the estimated total's difference is not here… it belongs to
 *    the summary ladder"). Leaving the estimate's remainder out is what forced the cost subtotal
 *    to hedge its name and left the close disagreeing with the List by that exact figure. The
 *    same rule carries the dues schedule: any schedule amount without dated instalments lands
 *    undated rather than vanishing.
 * 4. **Revenue first, then a running balance** (owner decisions A–D, 2026-09-12 —
 *    COACH_BUDGET_REVENUE_FIRST_PLAN.md, replacing the Costs-less-funding → Player installments →
 *    Shortfall (Buffer) ladder of 2026-09-09). Player installments are the Revenue band's first
 *    row once scheduled (`installments`, its own field), and the plan closes on **Opening balance → Net → Closing balance**, walked by
 *    Budget vs. Actual's own `buildCashFlow` at month resolution whatever the display shows. A
 *    period where dues land and no bills fall due is simply a positive net now, and the thing a
 *    coach actually needs — the first month the balance goes below zero — is `balance.shortfall`.
 *
 * Pure: no IO, no React, no Date — every date is `YYYY-MM-DD` string arithmetic, so a coach in
 * Toronto and a server in UTC bucket a period into the same month.
 */

// Relative, with the extension, so `node --test` can load this module directly — the unit suite's
// resolver handles these but not the bundler's `@/` alias (see tests/ts-resolver.mjs).
import { monthKeyOf, addMonths, monthSpan, formatMonthLabel, MAX_MONTH_COLUMNS, buildCashFlow, type MonthKey } from './coach-budget-months.ts';
import {
  NO_ITEM_LABEL, categoryGroupOf, compareCategoryGroups, type CategoryGroupRef,
} from './coach-budget-rollup.ts';
import { isFundingKind, normalizeBudgetLineKind, type BudgetLineKind } from './coach-budget-totals.ts';

export type PeriodGranularity = 'months' | 'quarters';

export const PERIOD_GRANULARITIES: PeriodGranularity[] = ['months', 'quarters'];

export const GRANULARITY_LABEL: Record<PeriodGranularity, string> = {
  months:   'Months',
  quarters: 'Quarters',
};

/** The key an undated amount lands under. Not a date, deliberately — it must never sort among
 *  the real columns or be mistaken for one. */
export const UNSCHEDULED = 'unscheduled';

/** The row key every word-LESS cost line folds into — the one row on this grid that can stand for
 *  more than one budget line, and therefore the one that never carries a `lineId`. Named because
 *  two places have to agree about it, and a bare `'noitem'` in the second was how they'd drift. */
const NO_ITEM_ROW_KEY = 'noitem';

/**
 * The trial row's name — the extra-expense TRIAL (decision D), a cost the coach is only
 * considering. ⚠ ONE SPELLING with the panel's preview control, which prints it too. ⚠ Deliberately
 * NOT in `PLAN_LADDER_LABEL`: a trial never reaches a file (the export builds its view without one),
 * so the importer must never learn to skip a coach's own line by this name.
 */
export const PREVIEW_GROUP_NAME = 'Extra expense';

/** The two bands' empty states — the mockup's own sentences, printed by both views (`/simplify`
 *  2026-09-12: one spelling, one home, like every other cross-view word in this file). */
export const REVENUE_EMPTY_PROMPT = 'Add the revenue you expect from sponsors, fundraising or other sources.';
export const EXPENSES_EMPTY_PROMPT = 'Add a budget item or start with a season estimate.';

/**
 * ⚠ ONE SPELLING OF UNDATED MONEY, AND NOW ONE HOME FOR IT. "No date yet" is this grid's column
 * heading, the line form's third answer, the plan list's When chip, the export's own word and —
 * since one word carries one line (2026-09-09) — the LABEL on the real period that carries a
 * joined line's unscheduled remainder. Five surfaces, and the fifth one is stored in the database,
 * which is exactly when a hand-typed copy stops being a wording risk and starts being data.
 */
export const NO_DATE_LABEL = 'No date yet';

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
  /** The category's real identity — what a MONEY-IN line is grouped by (owner ruling 2026-09-09),
   *  keyed exactly as the Statement keys it. Absent on a legacy line = keyed by name. */
  categoryId?: string | null;
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
  /**
   * The ONE budget line this row stands for, or `null` when it stands for several — which is what
   * makes a row on the grid openable (2026-09-10).
   *
   * ⚠⚠ IT EXISTS BECAUSE THE ROW ID CANNOT DO THIS JOB. `id` is `group|rowKey`, a composite that
   * names a POSITION in this view and matches no record anywhere. Handing it to a door is the
   * precise bug the month grid shipped and fixed: the cell passed the composite row id to the
   * budget page, which found nothing and returned silently. A door is built from this field or it
   * is not built at all.
   *
   * ⚠ NULL IS A REAL ANSWER, NOT A MISSING ONE. The "Not itemized" bucket folds every word-less
   * legacy line in a category into one row, so no single line is behind its figures — the row
   * stays plain text rather than guessing which of them a coach meant.
   *
   * ⚠ AND IT SURVIVES A TWIN. One word carries one line since migration 286 (a partial unique
   * index enforces it), so an item row is one line today; if a second ever merges in below, this
   * goes back to null on its own rather than trusting the first one it saw. The invariant is
   * "never guess", and it is structural here rather than an assumption held in a comment.
   */
  lineId: string | null;
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

/** A subtotal or closing row: a figure per column, plus the season's own. */
export interface PeriodTotals {
  cells: Record<string, number>;
  total: number;
}

/**
 * The Opening/Net/Closing balance the grid closes on (revenue-first project, owner decisions A–D,
 * 2026-09-12 — replaces the Costs-less-funding → Player installments → Shortfall (Buffer) ladder).
 *
 * ⚠⚠ WALKED FROM `buildCashFlow` — the exact function Budget vs. Actual's Budget lens already
 * trusts — not re-derived. Reusing it here is the whole point: a second, independently-written
 * running-balance calculation is exactly the trap that produced two live figure-disagreement bugs
 * on this same grid three weeks ago (Owner QA §164). `seasonClosing = seasonOpening + seasonNet`
 * and `seasonNet === revenueTotals.total − expenseTotals.total` by construction (the undated
 * terms cancel algebraically — see the build site) — this row can never disagree with the table's
 * own subtotals above it.
 *
 * ⚠ ALWAYS WALKED AT REAL MONTH RESOLUTION, regardless of the grid's display granularity (§5:
 * "Quarters: sum monthly flows; opening is the first month's opening; closing is the last month's
 * closing"). A quarter's `opening`/`net`/`closing` cells are aggregated from the underlying
 * months, never bucketed directly — the same reason `shortfall` below is computed from months
 * even when the grid is displaying quarters or the List's single season column.
 */
export interface PeriodBalance {
  /** Column key (month or quarter, never `unscheduled`) → what that period opened with. */
  opening: Record<string, number>;
  /** Column key → revenue − expenses for that period alone. */
  net: Record<string, number>;
  /** Column key → what that period closed on. */
  closing: Record<string, number>;
  seasonOpening: number;
  /** The season's net, dated periods plus the undated bucket — the List's single "Season net". */
  seasonNet: number;
  /** seasonOpening + seasonNet. Can differ from the last dated period's `closing` by exactly the
   *  undated remainder — expected, and explained in the same note the export prints (§5). */
  seasonClosing: number;
  /** The No-date-yet column's own net (undated revenue − undated expenses, the estimate remainder
   *  and any undated dues included) — what the Net row prints in that column, where Opening and
   *  Closing print a dash. Null when nothing is undated. Since ruling 0 (2026-09-13) this is the
   *  whole of what the walk could not place — money dated past the window included. */
  undatedNet: number | null;
  /**
   * The monthly series the balance was walked from — every real month from the first dated
   * period to the last, whatever the display granularity. This is what a "room for an expense in
   * month m" question reads (§5: at most max(0, min closing from m onward)), and what the last
   * dated closing in the note comes from. Empty when nothing on the plan has a date.
   */
  months: Array<{ monthKey: MonthKey; opening: number; net: number; closing: number }>;
  /** True when the season has never carried an opening balance (`null`, never set) rather than
   *  carried at exactly zero — the same NULL-≠-ZERO distinction Budget vs. Actual's own opening
   *  reader makes (lib/coach-money-report-notes.ts). Render "None carried" rather than $0.00. */
  openingUnset: boolean;
  /** The first REAL MONTH the running balance goes negative, and by how much — computed from
   *  months so the alert is the same whether the coach is looking at List, Months or Quarters
   *  (§5: "Keep the alert in List and Quarters too, computed from months"). Null on a season that
   *  never dips below zero. */
  shortfall: { monthKey: MonthKey; amount: number } | null;
  /** The lowest any month closes — the all-clear sentence's figure, the sibling of `shortfall`
   *  (the same reduce over the same months, so the two can never disagree). Null when nothing is
   *  dated. */
  lowestClosing: number | null;
}

export interface PeriodView {
  columns: PeriodColumn[];
  /** Year bands over the dated columns, in order. Empty when nothing is dated. */
  yearBands: PeriodYearBand[];
  /** The CATEGORY groups only — money-in categories first (the picker's order), then the cost
   *  categories alphabetical: the statement order (owner decision, 2026-09-12), what comes in,
   *  what goes out. The two derived rows (`installments`, `trial`) are their own fields below, so
   *  a renderer places them and never has to recognise them by key (`/simplify`, 2026-09-12 —
   *  three call sites were finding them by a sentinel and the export carried a filter for a case
   *  that could not occur). */
  groups: PeriodViewGroup[];
  /**
   * PLAYER INSTALLMENTS — the first row of the Revenue band once dues are scheduled (owner
   * decisions A–D): the schedules' assessed total (net of write-offs, the same figure the Dues
   * tile prints) spread across the periods its instalments fall due in, with whatever the dated
   * instalments do not cover in No date yet — so its total is always the plan's own figure.
   * ⚠ STORED POSITIVE, and its undated cell can be NEGATIVE (a schedule lowered after its
   * instalments existed — §164 finding #2); a renderer draws it SIGNED, never through a money-in
   * abs(). Null before a schedule exists — the Required-player-dues helper carries that state.
   */
  installments: PeriodTotals | null;
  /** The extra-expense TRIAL (decision D), when one is being previewed — the last row of the
   *  Expenses band, already folded into `expenseTotals` and the balance. Null when nothing is
   *  being tried. Never reaches a file: the caller builds an export's view without one. */
  trial: PeriodTotals | null;
  /**
   * Σ cost groups, per column — the "Total expenses" subtotal row.
   *
   * ⚠⚠ THIS IS THE **EFFECTIVE** PLANNED EXPENSES, INCLUDING THE ESTIMATE (owner ruling 2026-09-09,
   * RECONFIRMED unchanged by decision A, 2026-09-12 — the reversal drafted for this project was
   * withdrawn). It used to be Σ lines, which is why the subtotal had to hedge its name to "Lines so
   * far" and why the closing row underneath disagreed with the List by the un-itemized remainder —
   * same name, two numbers, on a plan with a season estimate set. The remainder is now a real row
   * in the No-date-yet column (see `estimateRows`), so this subtotal IS the estimate, wears its own
   * name again, and `totals` below is the List's figure exactly — in EITHER direction: when lines
   * exceed the estimate the remainder nets NEGATIVE into the same column, never a special case.
   */
  expenseTotals: PeriodTotals;
  /**
   * Σ revenue groups, per column, POSITIVE — the "Total revenue" subtotal row. Includes Player
   * installments once dues are scheduled (decision A/B in COACH_BUDGET_REVENUE_FIRST_PLAN.md §0):
   * dues are no longer a separate closing ladder, they are a real revenue line like any other.
   * Null when the plan has no revenue at all (no money-in lines and no dues scheduled), so the
   * grid knows not to draw that band.
   */
  revenueTotals: PeriodTotals | null;
  /**
   * The two rows the Costs band grows when a season estimate differs from the lines — the SAME two
   * the List has always printed, in the same words: *Lines so far*, then either *Still to itemize*
   * or *Over your estimate* (owner ruling 2026-09-09; kept unchanged by decision A, 2026-09-12).
   *
   * ⚠ THE REMAINDER IS A REAL FIGURE IN THE No-date-yet COLUMN, not a decoration. An estimate has
   * no dates, and that column exists precisely to hold money without them — so putting it there is
   * what lets `expenseTotals` be the estimate and the close match the List. `over` is the List's
   * `overPlanned`: the lines outgrew the estimate and the remainder is negative.
   *
   * Null when no estimate is set, or when it matches the lines to the half-cent.
   *
   * ⚠ NO `over` FLAG. The remainder's own total IS the estimate's difference, so "the lines
   * outgrew the estimate" is `remainder.total < 0` and a stored boolean was one more thing to
   * keep in step with a number it was copied from (`/simplify`, 2026-09-09).
   */
  estimateRows: { linesSoFar: PeriodTotals; remainder: PeriodTotals } | null;
  /**
   * The Opening/Net/Closing balance — always computed (decision B), even before dues exist (it
   * reads deeply negative then, which is the honest answer: nothing has been asked of families
   * yet). Never null; a plan with nothing in it still has a season opening.
   */
  balance: PeriodBalance;
  /* ⚰ `estimateDiffers` IS GONE (2026-09-09). It answered "is an estimate set that differs from
     the lines?", and its two readers both wanted something else: the grid renamed its cost
     subtotal to "Lines so far" with it, and printed a note apologising that the estimate could not
     be drawn. Showing the remainder retired both, and `estimateRows !== null` is the same question
     asked of the thing that answers it. Do not reinstate a flag beside the rows it describes.

     ⚰ THE OLD `close` LADDER (Costs less funding → Player installments → Shortfall (Buffer)) IS
     ALSO GONE (2026-09-12, decisions A–D). Player installments is a revenue GROUP now (see
     `groups`), and the close is `balance` above — Budget vs. Actual's own grammar, not a
     plan-specific ladder. `PLAN_LADDER_LABEL.shortfallBuffer` / `.costsLessFunding` /
     `.installmentsEstimated` stay defined (an old export must still read back — see
     coach-budget-import.ts's `BAND_LABELS`) but nothing here prints them any more. */
  /** Did anything land in the undated column? Drives whether that column exists at all. */
  hasUnscheduled: boolean;
  /**
   * Is any closing figure negative? Drives the legend under the table, which must not explain a
   * notation the coach cannot see.
   *
   * ⚠ COMPUTED HERE, beside `hasUnscheduled` and `truncated`, which exist for exactly the same
   * reason: a note's condition belongs where the numbers are already being touched. The panel
   * derived this itself for a day, which put the ±half-cent deadband — the rule for what counts
   * as negative — in a second place, free to drift from the one the closing rows use.
   *
   * ⚠ Named for the FACT, not the drawing — and since 2026-09-12 the fact is "any BALANCE cell
   * (Net or Closing, any column or the season) is below zero". A bracket on this grid is now the
   * same warning it is on Budget vs. Actual — the account below zero, painted red — where the old
   * plan-close painted its brackets green for money landing ahead of the bills. The legend under
   * the table describes the new rows, not the deleted one.
   */
  hasNegative: boolean;
  /** True when the plan's dated span was wider than the window and the far end was dropped. The
   *  view SAYS so rather than showing a total that silently excludes it. */
  truncated: boolean;
  /**
   * What is dated PAST the window (owner ruling 0, 2026-09-13): the money-in and money-out dated
   * after the last column, and the month that column is. On the grid it sits under No date yet —
   * in the season Total, in no month — and the note under the table names it with this. Null
   * unless `truncated`.
   */
  beyondWindow: { moneyIn: number; moneyOut: number; after: MonthKey } | null;
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
  if (s.months.length === 0) return NO_DATE_LABEL;
  const dated = s.months.join(' · ');
  return s.undated > 0.005 ? `${dated} · ${fmtMoney(s.undated)} no date` : dated;
}

/**
 * THE MONTHS ALONE — a schedule read as a phrase, with no figure in it.
 *
 * ⚠ NEVER `whenSummaryText` FOR THIS JOB, and the reason outlived the function that first wrote it
 * down. That one appends the undated money as a FIGURE ("Mar · $400.00 no date"), which goes stale
 * against the amount in the very next cell — so anywhere a schedule is being used as a *phrase*
 * rather than as a cell (the add form's "already on this plan" panel, and its preview of what the
 * joined schedule becomes) wants the months and nothing else.
 *
 * ⚠ ONE SPELLING for the empty case: "No date yet", the same words the grid's column, the form's
 * third answer and the plan list's chip all print.
 */
export function whenMonthsText(s: WhenSummary): string {
  return s.months.length === 0 ? NO_DATE_LABEL : s.months.join(' · ');
}

/* ⚰ `mergedSubLineName` IS DELETED, AND SO IS THE ROW IT NAMED (owner ruling 2026-09-09,
   migration 286 — one word carries one line on a plan).

   It existed for four days. It named the sub-rows a merged word opened to reveal — first by their
   word, which echoed the row above them, then by their SCHEDULE, which meant suppressing the row's
   When cell so the same answer did not print three times across one row. Both halves are moot:
   there are no sub-rows. **The defect it was born for is migration 286's own header — read it
   there rather than here**; the lesson worth keeping is that a level of detail which can be
   visibly wrong for weeks without anyone noticing is not being read, which is the argument this
   file's grid was already making by never showing the level at all. */

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
 *  and so is an amount dated PAST THE WINDOW (owner ruling 0, 2026-09-13). The columns stop at two
 *  years; money dated after the last one sits under No date yet rather than in a month it does not
 *  belong to. ⚰ Until then the last column absorbed it (the §133-era rule, so every row still added
 *  to its Total) — which it still does under No date yet — while the balance walk beneath had
 *  always left it out of that month: the same dollar read "in the last month" on the row and "not
 *  in that month" on the balance under it. Budget vs. Actual's own month grid files it the same
 *  way ("never silently dropped, never smeared"). `beyondWindow` on the view names it. */
function columnFor(
  date: string | null, granularity: PeriodGranularity, columnKeys: string[],
): string {
  const month = monthKeyOf(date);
  if (!month) return UNSCHEDULED;
  const key = granularity === 'months' ? month : quarterKeyOf(month);
  return columnKeys.includes(key) ? key : UNSCHEDULED;
}

export function buildPeriodView(
  lines: PeriodViewLine[], granularity: PeriodGranularity,
  /**
   * `estimatedTotal` — the season estimate, when one is set. Its un-itemized remainder becomes a
   * real row in the No-date-yet column (2026-09-09); before that it was read only for a flag.
   * `categoryOrder` is the picker's category → sort_order, so the funding groups read in the order
   * the coach chose them from.
   * `dues` — the player dues schedule: the assessed total the List prints, and the dated
   * installments to spread. Omitted/null before dues are set.
   */
  opts: {
    estimatedTotal?: number | null;
    categoryOrder?: ReadonlyMap<string, number>;
    dues?: { assessed: number; installments: ReadonlyArray<{ date: string | null; amount: number }> } | null;
    /** The season's carried-forward cash (`rep_program_years.opening_balance`) — where the
     *  Opening/Net/Closing balance walk starts. Null = never carried (see `PeriodBalance.openingUnset`),
     *  never coerced to 0 before this reaches the caller — only the WALK treats a null as 0. */
    openingBalance?: number | null;
    /**
     * An EXTRA EXPENSE the coach is only considering (decision D, "Could we add another expense?").
     * Becomes the `preview` group — a cost like any other for every figure below it, so the trial
     * and the real table can never disagree: it widens the columns if its date is new, it lands in
     * No date yet with no date, it CONSUMES a "Still to itemize" allowance before it raises Total
     * expenses (the remainder is taken after it is folded in), and it walks the balance.
     * ⚠ Inside the view rather than a synthetic line in the caller's array, for three reasons a
     * line could not give: the row needs a stable KEY a renderer can badge, it must sort LAST
     * among the cost groups rather than alphabetically by an invented category name, and it must
     * carry no `lineId` door (there is no record to open). Null/absent = nothing being tried.
     */
    trial?: { amount: number; date: string | null } | null;
  } = {},
): PeriodView {
  const dated: string[] = [];
  for (const line of lines) {
    for (const p of line.periods) {
      if (p.periodDate) dated.push(p.periodDate);
    }
  }
  /* ⚠ DUES DATES WIDEN THE COLUMNS. A schedule can fall due outside every budget line's dates —
     a June instalment on a plan whose last bill is in April — and a column domain derived from
     lines alone would bucket it into the nearest existing column or drop it. Either way the grid
     would print a Total the columns do not add to. */
  const dues = opts.dues ?? null;
  if (dues) {
    for (const i of dues.installments) {
      if (i.date) dated.push(i.date);
    }
  }
  /* A trial in a month the plan has never reached is still a month the balance has to walk
     through — the same reason the dues dates above widen the domain. */
  const trial = opts.trial && opts.trial.amount > 0.005 ? opts.trial : null;
  if (trial?.date) dated.push(trial.date);

  const { columns: dateColumns, truncated } = deriveColumns(dated, granularity);
  const columnKeys = dateColumns.map(c => c.key);

  const groupsByKey = new Map<string, PeriodViewGroup>();
  /** The category behind each group, for the ordering rule below. */
  const refs = new Map<string, CategoryGroupRef>();
  /* The two subtotals, accumulated in the SAME pass so they cannot disagree with each other:
     Total revenue and Total expenses, column by column (owner ruling 2026-09-08; band roles
     confirmed unchanged by decision A/B, 2026-09-12 — only the reading order and the close
     changed). */
  const costCells: Record<string, number> = {};
  let costTotal = 0;
  const fundingCells: Record<string, number> = {};
  let fundingTotal = 0;
  let hasFunding = false;
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

    /* ⚠ EVERY LINE IS GROUPED BY ITS CATEGORY'S IDENTITY — the rollup's one rule, keyed by id so two
       categories sharing a name stay two groups (a club's own "Fundraising" beside the platform's).
       Money in used to be grouped by its stored KIND — "Fundraising · Sponsorship · Other income" —
       so a concession stand filed under Tournaments read under "Other income" here while the Statement
       put it under Tournaments (owner ruling 2026-09-09); and a cost group was keyed by its bare NAME,
       which also gave a nameless cost category the word "Uncategorized" where every other surface says
       "No category" — the nameless-last rule below compared against the latter and never fired. The
       `in:` prefix keeps a funding group from ever sharing a key with the cost group of the SAME
       category: two bands, opposite signs, and Tournaments legitimately has both. */
    const ref = categoryGroupOf(line);
    const groupKey = isFundingKind(lineKind) ? `in:${ref.key}` : ref.key;
    let group = groupsByKey.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        name: ref.name,
        lineKind,
        rows: [],
        cells: {},
        total: 0,
      };
      groupsByKey.set(groupKey, group);
      rowsByKey.set(groupKey, new Map());
      refs.set(groupKey, ref);
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
      : isCost ? NO_ITEM_ROW_KEY : `line:${line.id}`;
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
        // The word-less bucket holds several lines by construction; every other row is one line.
        lineId: rowKey === NO_ITEM_ROW_KEY ? null : line.id,
        cells: {},
        total: 0,
      };
      groupRows.set(rowKey, row);
      group.rows.push(row);
    }
    // A second line arriving on a row that already named one means the row names neither — see
    // `lineId`. Cheap, and it keeps "never guess which line" true without depending on the index.
    if (row.lineId !== line.id) row.lineId = null;
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
      add(isCost ? costCells : fundingCells, key, amount);
    }
    if (isCost) costTotal = r2(costTotal + rowTotal);
    else { fundingTotal = r2(fundingTotal + rowTotal); hasFunding = true; }
  }

  /* ⚠ ONE ORDERING RULE, THE LIST'S, IN BOTH VIEWS (P1 verify-pass correction, 2026-09-02: the two
     views sorted differently — the List via the rollup's compareCategories, this view by insertion
     order — so toggling views reshuffled the plan). Cost categories alphabetical with the nameless
     bucket last (§133, and the rule moved here the same day it landed there), the
     money-in groups after them in the picker's category order (owner 2026-09-09); cost rows
     alphabetical with "Not itemized" last (the rollup's own item sort); money-in rows keep line
     order, which is what their List section does. */
  for (const group of groupsByKey.values()) {
    if (isFundingKind(group.lineKind)) continue;
    group.rows.sort((a, b) => {
      const aNone = a.description === NO_ITEM_LABEL;
      const bNone = b.description === NO_ITEM_LABEL;
      if (aNone !== bNone) return aNone ? 1 : -1;
      return a.description.localeCompare(b.description);
    });
  }
  /* Costs alphabetical with the nameless bucket last (the List's rule, via the rollup's comparator
     with no order map); the funding groups in the picker's own category order, which is the order
     the List prints the same groups in. */
  const byName = compareCategoryGroups();
  const byPicker = compareCategoryGroups(opts.categoryOrder);
  const groups = [...groupsByKey.values()]
    // Revenue first, then the cost categories — the statement order (owner decision, 2026-09-12).
    .sort((a, b) => {
      const aIn = isFundingKind(a.lineKind);
      const bIn = isFundingKind(b.lineKind);
      if (aIn !== bIn) return aIn ? -1 : 1;
      return (aIn ? byPicker : byName)(refs.get(a.key)!, refs.get(b.key)!);
    });

  /* ── THE TRIAL (decision D, 2026-09-12) ─────────────────────────────────────────────────────
     Folded into the cost cells BEFORE the estimate's remainder is taken, which is what makes "a
     trial inside the allowance changes timing, not the total" fall out of the arithmetic rather
     than being a rule someone has to remember: the remainder below is estimate − (lines + trial). */
  let trialTotals: PeriodTotals | null = null;
  if (trial) {
    const cells: Record<string, number> = {};
    add(cells, columnFor(trial.date, granularity, columnKeys), trial.amount);
    if (cells[UNSCHEDULED] !== undefined) hasUnscheduled = true;
    trialTotals = { cells, total: r2(trial.amount) };
    for (const [key, amount] of Object.entries(cells)) add(costCells, key, amount);
    costTotal = r2(costTotal + trial.amount);
  }

  /* ── THE ESTIMATE'S REMAINDER (owner ruling 2026-09-09) ────────────────────────────────────
     An estimate has no dates, so this grid used to leave it out and rename the subtotal to "Lines
     so far" to stay honest — which left the closing row underneath disagreeing with the List by
     exactly this figure. The No-date-yet column is built to hold money without dates; the
     remainder goes there, the subtotal becomes the estimate, and both views close on one number.
     ⚠ THE REMAINDER CAN BE NEGATIVE (lines above the estimate — the List's "Over your estimate").
     Both branches place it the same way: the estimate is the plan's total either way. */
  // ±half a cent, the same deadband computeBudgetTotals uses for the List's estimate rows.
  const differs = opts.estimatedTotal != null && Math.abs(r2(opts.estimatedTotal) - costTotal) >= 0.005;
  let estimateRows: PeriodView['estimateRows'] = null;
  if (differs) {
    const difference = r2(opts.estimatedTotal! - costTotal);
    estimateRows = {
      linesSoFar: { cells: { ...costCells }, total: costTotal },
      remainder: { cells: { [UNSCHEDULED]: difference }, total: difference },
    };
    add(costCells, UNSCHEDULED, difference);
    costTotal = r2(opts.estimatedTotal!);
    hasUnscheduled = true;
  }

  /* ── PLAYER INSTALLMENTS JOIN REVENUE (owner decisions A–D, 2026-09-12) ─────────────────────
     Dues are no longer a separate closing ladder below the table — they are the first row of the
     Revenue band (owner-approved mockup, COACH_BUDGET_REVENUE_FIRST_HUB.html), and they count in
     `revenueTotals` like any money-in line. `duesCells` carries the undated remainder rule
     unchanged from the old `close` block: whatever the dated instalments do not cover lands in No
     date yet, so the row's Total always equals the figure the List prints — dropping the
     difference would make the grid quietly disagree with the tile above it, which is the whole
     defect class this work closes. */
  const revenueCells: Record<string, number> = {};
  for (const [key, amount] of Object.entries(fundingCells)) add(revenueCells, key, -amount);
  let revenueTotal = r2(-fundingTotal);
  let hasRevenue = hasFunding;
  let installments: PeriodTotals | null = null;
  if (dues) {
    const duesCells: Record<string, number> = {};
    let spreadTotal = 0;
    for (const i of dues.installments) {
      add(duesCells, columnFor(i.date, granularity, columnKeys), i.amount);
      spreadTotal = r2(spreadTotal + i.amount);
    }
    const undated = r2(dues.assessed - spreadTotal);
    if (Math.abs(undated) >= 0.005) add(duesCells, UNSCHEDULED, undated);
    if (duesCells[UNSCHEDULED] !== undefined) hasUnscheduled = true;
    installments = { cells: duesCells, total: r2(dues.assessed) };
    for (const [key, amount] of Object.entries(duesCells)) add(revenueCells, key, amount);
    revenueTotal = r2(revenueTotal + dues.assessed);
    hasRevenue = true;
  }

  /* ── THE BALANCE (owner decisions A–D, 2026-09-12) ──────────────────────────────────────────
     Opening + Net = Closing, walked by `buildCashFlow` — the exact function Budget vs. Actual's
     Budget lens already trusts, not re-derived. Always walked at REAL MONTH resolution off the
     same `dated` domain the display columns share, regardless of whether this view is displaying
     months, quarters or (for the List) nothing at all — §5: "Quarters: sum monthly flows; opening
     is the first month's opening; closing is the last month's closing", and the alert is computed
     from months so it reads the same in every view. */
  // The display's own columns ARE the month domain when it shows months; only Quarters needs the
  // span re-derived at month resolution (`/simplify` 2026-09-12 — the same sort was run twice).
  const monthColumns = granularity === 'months' ? dateColumns : deriveColumns(dated, 'months').columns;
  const monthKeys = monthColumns.map(c => c.key as MonthKey);
  const monthlyRevenue: Record<string, number> = {};
  const monthlyExpense: Record<string, number> = {};
  /* ⚠ MONEY PAST A TRUNCATED WINDOW IS UNPLACED, NOT EARLY (§5: "a cash forecast must not pretend
     those amounts arrive earlier") — a bill two years out cannot be the reason the last visible
     month closes below zero. It rides the undated flow, so the season net still equals revenue −
     expenses and no month claims it. Since ruling 0 (2026-09-13) the DISPLAY files it the same way
     (`columnFor` → No date yet), so the undated cells below already hold it and the walk reads
     them alone; the far tally kept here is for the note, which names the amount and the month it
     is past. `truncated` is what tells the reader the series is incomplete, and it is what
     suppresses any room-to-spend claim. */
  const inWindow = new Set<string>(monthKeys);
  let farRevenue = 0;
  let farExpense = 0;
  const place = (side: 'in' | 'out', date: string | null, amount: number) => {
    const month = monthKeyOf(date);
    if (!month) return;
    if (inWindow.has(month)) add(side === 'out' ? monthlyExpense : monthlyRevenue, month, amount);
    else if (side === 'out') farExpense = r2(farExpense + amount);
    else farRevenue = r2(farRevenue + amount);
  };
  for (const line of lines) {
    const side = isFundingKind(normalizeBudgetLineKind(line.lineKind)) ? 'in' : 'out';
    for (const p of line.periods) place(side, p.periodDate, p.amount);
  }
  if (dues) for (const i of dues.installments) place('in', i.date, i.amount);
  if (trial) place('out', trial.date, trial.amount);
  const flow = buildCashFlow(
    monthKeys, monthlyRevenue, monthlyExpense, opts.openingBalance ?? 0,
    { moneyIn: r2(revenueCells[UNSCHEDULED] ?? 0), moneyOut: r2(costCells[UNSCHEDULED] ?? 0) },
  );
  const beyondWindow: PeriodView['beyondWindow'] = truncated && monthKeys.length > 0
    ? { moneyIn: farRevenue, moneyOut: farExpense, after: monthKeys[monthKeys.length - 1] }
    : null;
  const balanceOpening: Record<string, number> = {};
  const balanceNet: Record<string, number> = {};
  const balanceClosing: Record<string, number> = {};
  if (granularity === 'months') {
    for (const row of flow.rows) {
      balanceOpening[row.month] = row.opening;
      balanceNet[row.month] = row.net;
      balanceClosing[row.month] = row.running;
    }
  } else {
    const byQuarter = new Map<string, typeof flow.rows>();
    for (const row of flow.rows) {
      const qk = quarterKeyOf(row.month);
      if (!byQuarter.has(qk)) byQuarter.set(qk, []);
      byQuarter.get(qk)!.push(row);
    }
    for (const [qk, qRows] of byQuarter) {
      balanceOpening[qk] = qRows[0].opening;
      balanceClosing[qk] = qRows[qRows.length - 1].running;
      balanceNet[qk] = r2(qRows.reduce((s, r) => s + r.net, 0));
    }
  }
  const balance: PeriodBalance = {
    opening: balanceOpening,
    net: balanceNet,
    closing: balanceClosing,
    seasonOpening: flow.opening,
    seasonNet: flow.net,
    seasonClosing: flow.ending,
    openingUnset: opts.openingBalance == null,
    undatedNet: (revenueCells[UNSCHEDULED] !== undefined || costCells[UNSCHEDULED] !== undefined)
      ? r2((revenueCells[UNSCHEDULED] ?? 0) - (costCells[UNSCHEDULED] ?? 0))
      : null,
    months: flow.rows.map(row => ({ monthKey: row.month, opening: row.opening, net: row.net, closing: row.running })),
    shortfall: flow.shortfall ? { monthKey: flow.shortfall.month, amount: flow.shortfall.amount } : null,
    lowestClosing: flow.rows.length > 0 ? flow.rows.reduce((m, r) => Math.min(m, r.running), Infinity) : null,
  };

  /* Every cell that can carry a figure the wrong side of zero — the whole of the question the
     legend under the table asks. Same deadband the cells themselves use. */
  const hasNegative =
    Object.values(balanceNet).some(n => n < -0.005) || flow.net < -0.005
    || Object.values(balanceClosing).some(n => n < -0.005) || flow.ending < -0.005;

  /* ⚠ "No date yet", AND IT LEADS (owner ruling 2026-09-04, QA §133). Both halves were drift, and
     the NAME half was losing money: this view's export wrote "Unscheduled" as a heading and the
     importer has never known that word, so a plan exported from here and read back dropped every
     undated amount silently — the row still arrived, with no figure on it. Budget vs. Actual has
     always said "No date yet" and always put it first, so this view moves to meet it rather than
     the other way round.
     ⚠ The word is also SPOKEN FOR elsewhere: "Unscheduled" is what the schedule tools call a game
     with no date. One product, one meaning per word. */
  const columns: PeriodColumn[] = hasUnscheduled
    ? [{ key: UNSCHEDULED, label: NO_DATE_LABEL, unscheduled: true }, ...dateColumns]
    : [...dateColumns];

  return {
    columns,
    yearBands: deriveYearBands(dateColumns),
    groups,
    installments,
    trial: trialTotals,
    expenseTotals: { cells: costCells, total: costTotal },
    revenueTotals: hasRevenue ? { cells: revenueCells, total: revenueTotal } : null,
    estimateRows,
    balance,
    hasUnscheduled,
    hasNegative,
    truncated,
    beyondWindow,
  };
}
