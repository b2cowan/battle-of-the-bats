/**
 * lib/coach-money-exports.ts
 * The column contracts and row builders behind every Money export.
 *
 * ⚠ THESE ARE PURE FUNCTIONS OVER DATA THE CALLER ALREADY HAS — they do no fetching, and that is
 * the point. An earlier build had one hub-wide Export menu that fetched each dataset itself, and
 * it could not survive contact with the screens: Budget vs. Actual has two shapes and four
 * readings, Budget Plan has two, Expenses has three sub-tabs and a tag filter. A menu above the
 * tab bar cannot see any of it, so it could only ever offer a generic version and hope that was
 * what the coach meant — which is exactly how Budget vs. Actual ended up with two buttons both
 * saying "Export" and producing different files (owner ruling 2026-08-13, mockup artifact
 * 96675523).
 *
 * So Export now lives on each TAB, beside the switches that decide what it contains, and each tab
 * passes in what is on screen. This module keeps the two things worth sharing: what the columns
 * are called, and how a row is built from a record. One definition each, so the same dataset can
 * never come out two different ways.
 */
import type { ExportColumnDef, ReportShape, XlsxRowStyle } from './export';
import {
  buildFilename, serializeHeaders, serializeRows, generateCSV, downloadCSVBlob, downloadXLSX,
  downloadPDF, DEFAULT_PDF_SETTINGS, BRANDING_TEXT, loadBrandMark, type OrgPdfSettings,
} from './export';
import { duesStatusLabel } from './dues-status';
import { duesLadderTotals, type DuesLadder } from './dues-payments';
import { PLAN_LADDER_LABEL, isFundingKind, type BudgetTotals } from './coach-budget-totals';
import { categoryGroupOf, groupByCategory, groupByItem } from './coach-budget-rollup';
import {
  whenSummary, whenSummaryText, type PeriodView, type PeriodTotals,
} from './coach-budget-periods-view';
import { formatMonthLabel } from './coach-budget-months';
import { planColumnLabel, netRowLabel, type CompareBasis } from './coach-budget-basis';
import { noteRunsForFile, noteTextForFile, type ReportNote } from './coach-money-report-notes';
import { isDuesCategory } from './coach-dues-revenue';
import { KIND_LABEL, SPONSOR_STANDING_LABEL, sponsorStanding } from './coach-fundraising';
import { REGISTER_KIND_LABEL, type RegisterBookRow } from './coach-register';
import { clubMoneyInWord, type ClubMoneyInMeaning, type ClubRequestType } from './coach-club-money';
import type { RepBudgetLineWithPeriods, RepTeamExpense } from './types';
import type { CommitmentStanding } from './payable-standing';

export type MoneyExportFormat = 'xlsx' | 'csv' | 'pdf';

/** A row is a flat bag of primitives — the shape `serializeRows` consumes. */
export type ExportRow = Record<string, string | number>;

/**
 * What a row IS in a grouped report — how the EXCEL file dresses it (bold bands, collapsible item
 * groups). Kinds are declared by the builder that pushes the row, never guessed from its text.
 *
 * ⚠ THE `  — ` ITEM PREFIX IS STRIPPED FROM THE EXCEL CELLS ONLY (owner call 2026-08-25 — Excel's
 * own indent carries the nesting there). CSV and PDF keep the dash text: they have no indent of
 * their own, and it is what their import path reads. The Excel round trip holds a different way —
 * `parseXLSX` marks each outlined/indented row and `stripLineIndent` accepts that mark as the
 * line-row signal the dash used to carry. The one degradation, accepted with the call: copy-paste
 * an exported Excel file's CELLS into a fresh sheet and the styling (hence the line-vs-category
 * distinction) does not travel; re-importing the downloaded FILE itself is the promise.
 */
export type MoneyRowKind = 'section' | 'category' | 'item' | 'total' | 'plain';

/** What each kind means in Excel. Items nest one outline level down, START CLOSED (the file
 *  opens at category level; the "+" opens a group), with the collapse control on the category
 *  row above them (`summaryBelow: false` — see downloadXLSX). */
const ROW_KIND_STYLE: Record<MoneyRowKind, XlsxRowStyle> = {
  section:  { bold: true },
  category: { bold: true },
  item:     { outlineLevel: 1, indent: 1, collapsed: true },
  total:    { bold: true },
  /* A level-0 row that is neither a heading nor a total — the plan's estimate rows ("Lines so far",
     "Still to itemize"). ⚠ NOT `item`: an item row is written one outline level down and HIDDEN
     behind the row above it, so an estimate row filed as an item vanished into the last category's
     collapsed group — and, on re-import, its indent made it a phantom budget LINE (/review,
     2026-09-08). Plain: no bold, no indent, no outline level. */
  plain:    {},
};

/** The item rows' `  — ` label prefix, stripped for the Excel body only — see MoneyRowKind. */
const ITEM_PREFIX = /^\s*(?:—\s*)?/;

/**
 * That same strip, as the one function anybody else may call.
 *
 * ⚠ EXPORTED FOR THE ROUND-TRIP TEST, AND THE REASON IS THE TEST'S OWN SUBJECT (/simplify,
 * 2026-09-10). `coach-budget-plan-round-trip.test.ts` simulates the Excel writer to prove a plan
 * reads back, and it had HAND-COPIED this regex to do it — recreating, inside the guard, the exact
 * "two hand-maintained things that must agree, with nothing tying them together" failure the guard
 * exists to catch. Change the marker and that private copy would have drifted in silence, leaving
 * the Excel half of the round trip unwatched.
 */
export function stripItemPrefix(label: string): string {
  return label.replace(ITEM_PREFIX, '');
}

/**
 * Excel number formats for a currency column. Display only — the stored value is the raw signed
 * number either way, so a formatted file re-imports identically (parseXLSX reads cell.value).
 *
 *  - `minus`    — `-$1,234.00`, `$0.00`. Matches `money()` and every PDF cell; the default.
 *  - `brackets` — `($1,234.00)`, and zero shows as `—`. The Budget-vs-Actual notation: that
 *    report's binding screen rule is brackets-for-negative and em-dash-for-zero (`fmtCell`), and
 *    its spreadsheet should read like the screen it came from. No other tab's screen uses
 *    brackets, so no other tab passes this.
 */
const CURRENCY_NUMFMT: Record<'minus' | 'brackets', string> = {
  minus:    '$#,##0.00',
  brackets: '$#,##0.00;($#,##0.00);"—"',
};

/**
 * Currency for a PDF cell.
 *
 * ⚠ IT KEEPS THE MINUS SIGN, and that is the entire point. A first version of this helper called
 * `Math.abs()` — copied from a screen formatter whose callers print the sign separately — and it
 * silently turned a player $50 IN CREDIT into "$50.00", indistinguishable from a player who OWES
 * $50 (/review finding, 2026-08-13). A spreadsheet cell keeps the raw signed number, so only the
 * PDF path was affected, which is exactly how it would have reached a parent unnoticed.
 *
 * Anything that wants to print the sign itself must pass an absolute value in.
 */
function money(n: number): string {
  const str = Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${str}` : `$${str}`;
}
/** The same formatter for the family dues statement (lib/coach-dues-statement.ts) — one spelling
 *  of a dollar amount across every Money document, sign included. */
export { money as formatMoneyCell };

// ── The Budget Plan (owner export rider, 2026-09-02) ────────────────────────────────────────
// ⚠ THE FILE IS GROUPED THE WAY THE SCREEN IS GROUPED, in both views — the contract Budget vs.
// Actual has kept since mig 243, adopted here by owner rider: "the export manages the groupings
// properly like the budget vs actual export does and formats date headers the same way." The flat
// one-row-per-line dataset this replaces had the same twins the screen did (two same-item lines,
// identical in every column), and could not be reconciled against the plan it came from.

export const BUDGET_PLAN_COLUMNS: ExportColumnDef[] = [
  { label: 'Category / line', key: 'item',     format: 'text' },
  /* The List's own WHEN vocabulary ("Jan · Feb · Mar", "No date yet", "Mar · $1,000.00 no date").
     ⚠ SAME WORDS AS THE SCREEN, from the same helper — the two have drifted before, and a file a
     treasurer reconciles against a screen must not describe one line two ways. It carries a dollar
     figure only for the undated HALF of a partly-dated line, which the row's own total cannot say. */
  { label: 'When',            key: 'schedule', format: 'text' },
  { label: 'Planned',         key: 'planned',  format: 'currency' },
  { label: 'Notes',           key: 'notes',    format: 'text' },
];

/** One cost category as the plan list renders it — the panel passes its OWN memoized grouping
 *  (the shared rollup's), so the file cannot disagree with the screen it came from. */
export interface BudgetPlanExportGroup {
  categoryName: string;
  total: number;
  items: Array<{
    /** Null = the word-LESS bucket ("Not itemized"), the only item row that can still hold several
     *  lines since one word carries one line (migration 286). */
    itemId: string | null;
    itemName: string;
    total: number;
    lines: Array<{
      description: string;
      notes: string | null;
      totalAmount: number;
      periods: Array<{ periodDate: string | null }>;
    }>;
  }>;
}

export interface BudgetPlanExportSource {
  /** The screen's own cost grouping (category → item → lines), from the shared rollup. */
  groups: BudgetPlanExportGroup[];
  /** EVERY line — the money-in sections are derived here by kind, exactly as the list derives
   *  its own. Cost lines in it are ignored (they arrive via `groups`). */
  lines: RepBudgetLineWithPeriods[];
  /** The screen's closing figures, from `computeBudgetTotals` — never re-derived here. The ladder
   *  reads more of them than the old close did: both subtotals and the estimate rows (2026-09-08). */
  totals: Pick<BudgetTotals,
    'totalPlanned' | 'fundedByPlayers' | 'costsLessFunding' | 'fundingLineCount' | 'itemized' | 'expectedFunding'
    | 'estimatedTotal' | 'difference' | 'hasDifference' | 'overPlanned'>;
  /** The Dues tab's assessed total, echoed on the plan as the players' side — net of anything
   *  written off it (owner ruling §160 Part F2, 2026-09-11). */
  duesAssessed: number;
  /** plan − funding − dues, signed exactly as the screen computes it. */
  leftToFund: number;
  /** "after $17.00 of adjustments" etc. — the same clause the screen's tile and closing row
   *  already state beside this figure, so the downloaded file never shows the net number under a
   *  note that reads as if it were still the gross schedule total. Absent/null on the ordinary
   *  season that has never written anything off. */
  writtenOffClause?: string | null;
  /** The picker's category → sort_order, so the funding groups print in the order the coach chose
   *  them from (owner ruling 2026-09-09). Absent = alphabetical. */
  categoryOrder?: ReadonlyMap<string, number>;
}

/** The **When** cell, in the screen's own words. `money()` rather than a bare number so the undated
 *  half of a partly-dated line reads as the money it is. */
/* ⚰ `subLineLabel` IS DELETED WITH THE ROWS IT NAMED (owner ruling 2026-09-09, migration 286).
   It answered "what is a merged sub-line called in a file?" — a question that no longer has a
   subject, because a word carries one line and this file has no rows beneath an item.
   ⚠ WORTH KNOWING WHY IT EXISTED, because the same trap is still live one door away. The importer
   matches a row to a line by its NAME TEXT and mints a brand-new team budget word from any name the
   library does not know. A sub-row exported as "Oct" therefore matched nothing, and re-importing a
   plan a coach had just exported CREATED A BUDGET WORD CALLED "Oct", permanently, in their picker.
   The flat file cannot produce that row at all — but the rule it teaches survives: **never print a
   name into this file that the library could not match back.** */

function whenText(
  periods: Array<{ periodDate: string | null; amount?: number | string | null }>,
  lineTotal: number | string | null | undefined,
): string {
  return whenSummaryText(whenSummary(periods, Number(lineTotal ?? 0) || 0), money);
}

/**
 * The plan's STATEMENT file — the List view, and every PDF (a period grid does not fit paper, the
 * same ruling that shapes Budget vs. Actual's PDF).
 *
 * The screen's shape, band for band (owner ruling 2026-09-08): COSTS → category rows → item rows
 * (same-item lines summed) → per-line sub-rows named by their notes → the estimate rows when one
 * is set and differs → Planned costs; FUNDING → one section per CATEGORY → Planned funding; then the
 * close as the screen prints it — Costs less funding, Player installments, Short/buffer — or the
 * single estimated-installments row before dues exist.
 */
export function budgetPlanStatementRows(
  src: BudgetPlanExportSource,
): { rows: ExportRow[]; kinds: (MoneyRowKind | undefined)[] } {
  const rows: ExportRow[] = [];
  const kinds: (MoneyRowKind | undefined)[] = [];
  const push = (row: ExportRow, kind?: MoneyRowKind) => { rows.push(row); kinds.push(kind); };
  const L = PLAN_LADDER_LABEL;
  const { totals } = src;
  const hasFunding = totals.fundingLineCount > 0;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // ── COSTS: the band, its categories, the estimate rows, the subtotal ─────────────────────────
  // A band heading carries no figures (the screen's own rule). The subtotal wears the tile's exact
  // name — the tiles are the table's subtotals (owner ruling 2026-09-08). A funding-only plan has
  // no costs to head, so the band waits for one, as it does on screen.
  // ⚠ Band labels are UPPERCASE in the file — the statement export's own convention (REVENUE /
  // EXPENSES), and the only signal a PDF has that a row is a heading: the PDF path never reads kinds.
  const hasCosts = src.groups.length > 0 || totals.estimatedTotal != null;
  if (hasCosts) push({ item: L.costsBand.toUpperCase(), schedule: '', planned: '', notes: '' }, 'section');

  for (const cat of src.groups) {
    push({ item: cat.categoryName, schedule: '', planned: cat.total, notes: '' }, 'category');
    /* ⚠⚠ ONE ROW PER WORD, AND NOTHING BENEATH IT (owner ruling 2026-09-09, migration 286). A word
       carries one line, so an item row IS that line: its schedule, its amount, its note. The
       indented sub-rows this printed underneath are gone with the twins they described — and with
       them goes the shape that kept breaking the round trip, since a nested row is one the
       spreadsheet can hide and the importer can read back as a line the coach never wrote.
       ⚠ The word-LESS bucket still prints as one "Not itemized" row carrying its own sum; those
       lines have no word to be joined on and the rollup already sums them. */
    for (const item of cat.items) {
      /* A word carries one line, so that line IS the row and speaks for it. The word-LESS bucket
         has no single line to speak for it — its sum is the answer and its When column stays
         empty, exactly as the screen's own bucket row does. */
      const only = item.itemId ? item.lines[0] : null;
      /* ⚠⚠ THE LINE MARKER IS NOT DECORATION — IT IS THE ONLY THING A FLAT FILE HAS (2026-09-10).
         A cost word's row printed FLUSH, so in the CSV and the PDF nothing distinguished it from
         the category heading above it, and the re-importer — whose only nesting signal in a flat
         file is this dash — read every cost line as a CATEGORY NAME and dropped it. It survived
         until now because the sub-rows underneath used to carry the dash and be read as the lines;
         when a word became its own line (owner ruling 2026-09-09, mig 286) the sub-rows went and
         the marker went with them. The funding half of this same file never stopped writing it.
         ⚠ Excel is unaffected: the XLSX writer strips `ITEM_PREFIX` from every `item` row and
         replaces it with a real outline indent. */
      push({
        item: `  — ${item.itemName}`,
        schedule: only ? whenText(only.periods, only.totalAmount) : '',
        // The group's own sum, never one line's figure: identical for a word, correct for the bucket.
        planned: item.total,
        notes: only ? (only.notes ?? '') : '',
      }, 'item');
    }
  }

  // A season estimate that differs from the lines: the gap as two rows where the sum is, rather
  // than only in a tile caption. "Planned costs" stays the estimate — the number the plan uses.
  // ⚠ `plain`, never `item` — see ROW_KIND_STYLE. And the re-importer skips these labels outright
  // (lib/coach-budget-import.ts DERIVED_ROW_LABELS reads them from PLAN_LADDER_LABEL).
  if (totals.hasDifference) {
    push({ item: L.linesSoFar, schedule: '', planned: totals.itemized, notes: '' }, 'plain');
    push({
      item: totals.overPlanned ? L.overEstimate : L.stillToItemize,
      schedule: '',
      planned: Math.abs(totals.difference),
      notes: `Your estimate is ${money(totals.estimatedTotal ?? 0)}`,
    }, 'plain');
  }
  if (hasCosts) push({ item: L.plannedCosts, schedule: '', planned: totals.totalPlanned, notes: '' }, 'total');

  // ── FUNDING: the band, one section per CATEGORY in the picker's order, the subtotal ──────────
  // Positive figures under headings that say the direction, exactly as the list prints them.
  // ⚠ Grouped by category, not by stored kind (owner ruling 2026-09-09) — the same identity the
  // cost half of this file and the Statement already use, through the rollup's one helper.
  if (hasFunding) {
    push({ item: L.fundingBand.toUpperCase(), schedule: '', planned: '', notes: '' }, 'section');
    const fundingLines = src.lines.filter(l => isFundingKind(l.lineKind));
    for (const { ref, items: kindLines } of groupByCategory(fundingLines, categoryGroupOf, src.categoryOrder)) {
      const sectionTotal = round2(kindLines.reduce((s, l) => s + Number(l.totalAmount ?? 0), 0));
      push({ item: ref.name, schedule: '', planned: sectionTotal, notes: '' }, 'category');
      /* ⚠⚠ ONE ROW PER WORD, MERGED (owner ruling 2026-09-09) — and this loop carried a defect of
         its own, not merely an inconsistency. It printed one row per LINE while naming each by its
         ITEM, so two money-in lines filed against one word exported as two rows with the SAME name,
         the same schedule column and nothing to tell them apart. The cost half of this file has
         summed them into one openable row since the 2026-08-15 ruling; `groupByItem` is that rule,
         shared with the plan list so the file and the screen cannot say different things. */
      /* ⚠ ONE ROW PER WORD, AND NOTHING BENEATH IT (owner ruling 2026-09-09, migration 286). A
         money-in word carries one line and a word-LESS money-in line is its own group, so every
         group here holds exactly one line — `groupByItem` is still what ORDERS them and what keeps
         this file and the plan list from ever saying different things. */
      for (const item of groupByItem(kindLines)) {
        const only = item.lines[0];
        push({
          item: `  — ${item.itemName}`,
          schedule: whenText(only.periods ?? [], only.totalAmount),
          planned: item.total,
          notes: only.notes ?? '',
        }, 'item');
      }
    }
    push({ item: L.plannedFunding, schedule: '', planned: totals.expectedFunding, notes: '' }, 'total');
  }

  // ── THE CLOSE: the ladder once dues exist, one estimated row before ──────────────────────────
  if (src.duesAssessed > 0) {
    if (hasFunding) {
      // ⚠ THE SIGNED FIGURE, following the screen (owner ruling 2026-09-09). This printed
      // `fundedByPlayers` — floored at zero — which matched the screen while the screen was also
      // flooring, and both were wrong for a row that states a subtraction: an over-funded plan read
      // $0.00 in the file and a bracketed negative on the By-period grid. The floor stays on the
      // estimated-installments row below, where it belongs.
      push({
        item: L.costsLessFunding,
        schedule: '',
        planned: totals.costsLessFunding,
        notes: L.costsLessFundingNote,
      }, 'total');
    }
    push({
      item: L.installments,
      schedule: '',
      planned: src.duesAssessed,
      notes: src.writtenOffClause
        ? `What players are scheduled to pay, ${src.writtenOffClause}`
        : 'What players are scheduled to pay',
    }, 'total');
    // The screen's own residual row, absent when the schedules match the plan ($0.00 says
    // nothing). Absolute, as the screen prints it — the label carries the direction.
    if (Math.abs(src.leftToFund) >= 0.005) {
      push({
        item: src.leftToFund < 0 ? L.buffer : L.shortOfPlan,
        schedule: '',
        planned: round2(Math.abs(src.leftToFund)),
        notes: '',
      }, 'total');
    }
  } else {
    push({
      item: L.installmentsEstimated,
      schedule: '',
      planned: totals.fundedByPlayers,
      notes: `${hasFunding ? L.costsLessFunding : L.plannedCosts}, until dues are set`,
    }, 'total');
  }

  return { rows, kinds };
}

/**
 * The By-period file's columns — from the view the screen is showing, so the file follows the
 * coach's own Months/Quarters choice.
 *
 * ⚠ MONTH HEADERS ARE BvA'S, VIA THE SHARED PIECES (owner rider): `formatMonthLabel` spells the
 * text ("Feb '26") and `headerMonth` writes the Excel header as the month's real date — the same
 * mechanism `downloadMoneyExport` already runs for the BvA month file. Never a second formatter.
 * Quarter columns carry the year in text ("Q2 '26") — the screen's year band has no cell to live
 * in here — and no headerMonth: a quarter is not a date.
 */
export function budgetPeriodGridColumns(view: PeriodView): ExportColumnDef[] {
  const cols: ExportColumnDef[] = [{ label: 'Category / line', key: 'item', format: 'text' }];
  for (const col of view.columns) {
    if (col.unscheduled) {
      // ⚠ THE HEADING THE IMPORTER READS. It said "Unscheduled" until 2026-09-04, which no import
      // alias matched, so a plan exported here and read back lost every undated amount without
      // saying so. Change this word only together with ALIASES.undated in coach-budget-import.
      cols.push({ label: 'No date yet', key: 'unscheduled', format: 'currency' });
    } else if (/^\d{4}-\d{2}$/.test(col.key)) {
      cols.push({ label: formatMonthLabel(col.key), key: `m_${col.key}`, format: 'currency', headerMonth: col.key });
    } else {
      // `2027-Q2` → `Q2 '27`.
      cols.push({ label: `${col.key.slice(5)} '${col.key.slice(2, 4)}`, key: `q_${col.key}`, format: 'currency' });
    }
  }
  cols.push({ label: 'Total', key: 'total', format: 'currency' });
  return cols;
}

/** The column key a view column's money lands under — must mirror budgetPeriodGridColumns. */
function periodColumnKey(col: PeriodView['columns'][number]): string {
  if (col.unscheduled) return 'unscheduled';
  return /^\d{4}-\d{2}$/.test(col.key) ? `m_${col.key}` : `q_${col.key}`;
}

/**
 * The By-period file's rows — the grid exactly as rendered (owner ruling 2026-09-08): the COSTS
 * band, its category rows and merged item rows, Planned costs; the FUNDING band, its kind rows
 * POSITIVE the way the screen paints them, Planned funding; and the screen's own closing
 * subtraction. With no money in, Planned costs IS the close.
 */
export function budgetPeriodGridRows(
  view: PeriodView,
): { rows: ExportRow[]; kinds: (MoneyRowKind | undefined)[] } {
  const rows: ExportRow[] = [];
  const kinds: (MoneyRowKind | undefined)[] = [];
  const push = (row: ExportRow, kind?: MoneyRowKind) => { rows.push(row); kinds.push(kind); };
  const L = PLAN_LADDER_LABEL;

  /** Money-in cells read POSITIVE (owner 2026-08-13) — the section heading says the direction,
   *  on screen and therefore in the file. The closing row keeps the signed view totals: it is a
   *  real subtraction. */
  const cell = (funding: boolean, n: number | undefined): number | string =>
    n == null ? '' : funding ? Math.abs(n) : n;

  /** A band heading carries no figures at all — blank cells, exactly as the screen draws it. */
  const band = (label: string) => {
    const row: ExportRow = { item: label };
    for (const col of view.columns) row[periodColumnKey(col)] = '';
    row.total = '';
    push(row, 'section');
  };
  /** A subtotal or the close, from a per-column total the view built in the same pass. */
  const totalRow = (label: string, funding: boolean, t: PeriodTotals) => {
    const row: ExportRow = { item: label };
    for (const col of view.columns) row[periodColumnKey(col)] = cell(funding, t.cells[col.key]);
    row.total = cell(funding, t.total);
    push(row, 'total');
  };
  const groupRows = (group: PeriodView['groups'][number]) => {
    const funding = isFundingKind(group.lineKind);
    const groupRow: ExportRow = { item: group.name };
    for (const col of view.columns) groupRow[periodColumnKey(col)] = cell(funding, group.cells[col.key]);
    groupRow.total = cell(funding, group.total);
    push(groupRow, 'category');

    for (const row of group.rows) {
      // ⚠ NO "(N lines)" SUFFIX (owner ruling 2026-09-04, QA §133) — the screen this file mirrors
      // no longer says it either, and a file that annotated a merge the report had stopped
      // annotating would be the two-vocabularies defect the suffix was added to avoid.
      const lineRow: ExportRow = { item: `  — ${row.description}` };
      for (const col of view.columns) lineRow[periodColumnKey(col)] = cell(funding, row.cells[col.key]);
      lineRow.total = cell(funding, row.total);
      push(lineRow, 'item');
    }
  };

  // The grid's shape, band for band (owner ruling 2026-09-08): COSTS → categories → Planned costs;
  // FUNDING → kinds → Planned funding → Costs less funding. With no money in, Planned costs IS the
  // close, so the old "Total planned budget" footer has nothing left to say.
  const costGroups = view.groups.filter(g => !isFundingKind(g.lineKind));
  const fundingGroups = view.groups.filter(g => isFundingKind(g.lineKind));
  // ⚠ ONE NAME, ONE NUMBER: this grid spreads LINES, and an estimate has no dates. When an estimate
  // is set and differs, the cost subtotal is the lines' sum and reads "Lines so far" — exactly what
  // the List calls that same figure — never "Planned costs", which is the estimate there.
  if (costGroups.length > 0) {
    band(L.costsBand.toUpperCase());
    costGroups.forEach(groupRows);
    /* ⚠ The estimate's un-itemized remainder is a REAL ROW now, in the No-date-yet column, so this
       subtotal is the estimate and keeps its own name in every state (owner ruling 2026-09-09).
       It used to read "Lines so far" whenever an estimate differed — see the note on the view's
       `costTotals`. The two rows are the List's own, verbatim; the file prints them indented the
       way it indents a line under its category. */
    if (view.estimateRows) {
      totalRow(`  — ${L.linesSoFar}`, false, view.estimateRows.linesSoFar);
      totalRow(
        `  — ${view.estimateRows.remainder.total < 0 ? L.overEstimate : L.stillToItemize}`,
        false, view.estimateRows.remainder,
      );
    }
    totalRow(L.plannedCosts, false, view.costTotals);
  }
  if (view.fundingTotals && fundingGroups.length > 0) {
    band(L.fundingBand.toUpperCase());
    fundingGroups.forEach(groupRows);
    totalRow(L.plannedFunding, true, view.fundingTotals);
    totalRow(L.costsLessFunding, false, view.totals);
  }
  /* The ladder finishes in the file exactly as it finishes on screen (owner ruling 2026-09-09) —
     an export's shape is its screen's shape, and a file that stopped at Costs less funding would
     leave a treasurer doing by hand the subtraction the grid now prints. Installments read
     POSITIVE like every money-in row; the close keeps its sign. */
  if (view.close) {
    /* ⚠ `false` = do not absolute-value this row, and that is deliberate rather than a
       mis-typed flag (/review, 2026-09-10). Its undated cell holds what the dated instalments do
       not cover, which is negative whenever a schedule was lowered after its instalments existed;
       abs()ing it printed an overshoot as a positive and the row stopped summing to its own Total.
       Ordinary values here are already positive, so the file is unchanged in every normal case. */
    totalRow(L.installments, false, view.close.installments);
    totalRow(L.shortfallBuffer, false, view.close.shortfall);
  }

  return { rows, kinds };
}

// ── Player dues ─────────────────────────────────────────────────────────────────────────────

/* ⚠⚠ AN EXPORT'S SHAPE IS ITS SCREEN'S SHAPE (QA §146 F2), so these are the dues table's columns
   and they move when it moves. The dues ladder (owner ruling 2026-09-07) split `Credits` into
   `Fundraising` + `Other credits` and added `Handed back`, so a file that kept the old three would
   answer a treasurer's question differently from the screen they exported it from.

   ⚖ THIS IS AN OUTWARD-FACING BREAK, TAKEN DELIBERATELY. A coach's saved spreadsheet addresses our
   columns by POSITION — same reasoning as the payables column retirement above. It happens in the
   release that makes the old headings wrong rather than a release later, because `Credits` was
   already netting payouts away silently: Blake's $150 Bottle Drive rebate exported as part of a
   $176.98 lump with $100 of it already handed back, and `Paid` read $900 for a family who sent
   $1,200. Two columns that could not be reconciled to anything.

   ⚠ `Handed back` IS ALWAYS A COLUMN HERE, unlike on the screen, which hides it when no family has
   one. A file whose column COUNT depends on its data cannot be appended to last month's, and a
   spreadsheet reader has no chevron to ask why a heading vanished. Zeroes are cheap in a file and
   expensive on a screen — that difference is the reason the two rules differ. */
export const DUES_EXPORT_COLUMNS: ExportColumnDef[] = [
  { label: 'Player',        key: 'player',        format: 'text' },
  { label: 'Dues',          key: 'totalDues',     format: 'currency' },
  { label: 'Fundraising',   key: 'fundraising',   format: 'currency' },
  { label: 'Other credits', key: 'otherCredits',  format: 'currency' },
  { label: 'Paid',          key: 'paid',          format: 'currency' },
  { label: 'Handed back',   key: 'handedBack',    format: 'currency' },
  { label: 'Balance',       key: 'balance',       format: 'currency' },
  { label: 'Status',        key: 'status',        format: 'text' },
];

/* ⚠⚠ A REPORT'S SHAPE IS PART OF ITS COLUMN CONTRACT, DECLARED BESIDE THE COLUMNS (review
   2026-09-07). The dues sheet went from six columns to eight and the pre-commit PDF check refused
   it: on a portrait page the fit contract gave up Balance and Status — the two columns a treasurer
   opened the file for — and printed an apology for them. The fit contract's own text says a
   fixed-column report should never reach that line; the answer for a fixed eight is the one the
   tournament results sheet already gives at eight — landscape is the report's OWN shape, not an
   org preference, and at that width every column clears the legible floor.
   ⚠ KEYED ON THE COLUMNS CONSTANT ITSELF, NOT ON THE DATASET NAME. The first cut keyed it on
   `spec.dataset` — and this one sheet has THREE names: the coach's button says `player-dues`, the
   exhibit harness says `coach-player-dues`, the export registry says `coaches-player-dues`. The
   coach got landscape; the gate that refused the commit stayed on portrait and kept refusing.
   Both call sites already pass this module's own `DUES_EXPORT_COLUMNS`, so identity on that array
   is the one key they cannot disagree about — the shape is part of the column contract, literally.
   ⚠ DENSITY IS THE SHEET'S OWN TOO (owner, 2026-09-08). At the org-default "readable" density a
   landscape page holds exactly TWELVE body rows, so a twelve-family roster fit and its Total row —
   the line the sheet gained in QA §151 — was the one thing on page two. Measured on the real
   engine, not the fake: compact holds eighteen families plus the Total on one sheet, and a
   treasurer's eight-column money table at that size is a normal financial print. The exhibit
   harness renders an eighteen-family bench and refuses the commit if it ever needs a second page. */
const REPORT_SHAPES = new Map<readonly ExportColumnDef[], ReportShape>([
  [DUES_EXPORT_COLUMNS, { orientation: 'landscape', density: 'compact' }],
]);

export type DuesExportPlayer = {
  player: { playerFirstName: string; playerLastName: string | null };
  schedule: { totalAmount: number } | null;
  paidAmount: number;
  totalCredits: number;
  rollingBalance: number;
  /** Mode-aware derived figures (owner model 2026-08-14) — REQUIRED so the export's status word
   *  takes duesStatusLabel's mode-aware path; without them a keep_separate team's spreadsheet
   *  would read "Settled" beside a family still owing cash (the /review Critical). */
  leftToSend: number;
  owedBack: number;
  outstanding: number;
  /** ⚠ REQUIRED so the spreadsheet can say "Past due" where the screen does. The status word is a
   *  question about TIME since 2026-08-14, and a file that graded season completion while the
   *  table beside it flagged who was behind would be the same one-product-two-answers defect the
   *  shared word list exists to prevent. */
  installments: Array<{ dueDate: string | null; paidAt: string | null; remainingAmount?: number; amount?: number }>;
  /** ⚠ REQUIRED for the same reason as the two above: without it `duesStatusLabel` can only ever
   *  reach "In credit", so an OVERPAID family — one the team owes money back to — would read the
   *  same in the file as one whose sponsor covered their season (QA §148). Required rather than
   *  optional deliberately: the label takes it optionally, so a builder that assembled this shape
   *  field-by-field would drop the word in silence and nothing would catch it. */
  ownMoneyHeld: number;
  /** The five figures the table reads left to right — see `splitDuesLadder`. ⚠ REQUIRED, not
   *  optional: a builder assembling this shape field-by-field would otherwise export three empty
   *  money columns in silence, which is the failure mode the two fields above were made required
   *  to prevent. */
  ladder: DuesLadder;
};

/**
 * The dues sheet's rows, and the TOTALS ROW under them (owner ruling 2026-09-07, QA §151).
 *
 * ⚠⚠ THE FILE GETS THE FOOTER BECAUSE THE SCREEN DOES — an export's shape is its screen's shape
 * (QA §146 F2), and the totals row is the one line on either that proves the ladder closes across
 * the whole roster. A treasurer who pivots this file would otherwise build the same six sums by
 * hand and have nothing to check them against.
 *
 * ⚠ IT NAMES ITSELF, WHERE THE SCREEN'S DOES NOT. On screen the count IS the label: a rule above
 * the row and the column headings above that say everything. A CSV has no footer line and a PDF
 * has no tint, so a bare "12 players" in the first column reads as a thirteenth family. The file
 * says `Total` and carries the head count after it — same figures, and the one extra word a flat
 * format needs to stay honest.
 *
 * ⚠ NO ROW WHEN THERE ARE NO PLAYERS. `downloadMoneyExport` refuses an empty dataset by counting
 * rows; a footer over nothing would defeat that and write a file whose only line totals zero.
 */
export function duesExportRows(
  players: DuesExportPlayer[],
): { rows: ExportRow[]; kinds: (MoneyRowKind | undefined)[] } {
  const rows: ExportRow[] = players.map(p => ({
    player: [p.player.playerFirstName, p.player.playerLastName].filter(Boolean).join(' '),
    /* ⚠⚠ THE LADDER'S BILL, NOT THE SCHEDULE TOTAL (owner R1, 2026-09-09 · /review). A bill written
       off comes off `ladder.dues`, and the Total row below is summed from those same ladders — so
       reading the raw schedule total here wrote a file whose Dues column added up to MORE than its
       own Total line, on any team with an adjustment. A treasurer sums that column; the screen it
       came from is not there to explain the gap. The blank-on-no-schedule rule below is unchanged. */
    totalDues: p.schedule ? p.ladder.dues : '',
    /* ⚠ THE LADDER'S FIGURES, NOT THE SCREEN'S OLD PAIR. A real ZERO is written as zero rather
       than blanked, because a spreadsheet column that empties itself cannot be summed and a
       treasurer reading `Fundraising` wants to see that a family raised nothing, not an empty
       cell they have to interpret.

       ⚠⚠ ONLY `Dues` STILL BLANKS ON A MISSING SCHEDULE, and the other five stopped when the
       totals row arrived (QA §151). A player added after dues were set has no schedule and can
       still hold a fundraiser credit, a payment and a payout — real money the screen has always
       shown on their row. Blanking it here made the file quieter than the screen AND put the
       footer beyond reach of its own columns: a treasurer summing `Fundraising` would land short
       of the total under it by exactly that player's credit, with nothing in the file to explain
       the gap. A missing BILL is genuinely nothing, so `Dues` keeps its blank and sums as zero. */
    fundraising: p.ladder.fundraising,
    otherCredits: p.ladder.otherCredits,
    paid: p.ladder.paid,
    handedBack: p.ladder.handedBack,
    balance: p.rollingBalance,
    // ⚠ The shared word list, so the table and the file cannot call one player two things.
    status: duesStatusLabel(p),
  }));
  if (rows.length === 0) return { rows, kinds: [] };

  /* ⚠ THE SHARED SUM, not a seventh hand-rolled reduce in this file. `duesLadderTotals` is what
     the screen's footer reads too, so the spreadsheet and the table cannot land a cent apart —
     and it sums the BALANCE column rather than re-deriving it from the five beside it. */
  const totals = duesLadderTotals(players.map(p => ({ ladder: p.ladder, balance: p.rollingBalance })));
  rows.push({
    player: `Total — ${totals.players} player${totals.players === 1 ? '' : 's'}`,
    totalDues: totals.dues,
    fundraising: totals.fundraising,
    otherCredits: totals.otherCredits,
    paid: totals.paid,
    handedBack: totals.handedBack,
    balance: totals.balance,
    /* ⚠ DELIBERATELY EMPTY. Status is a per-family verdict; a roster has no single one, and the
       nearest candidates ("9 up to date, 1 past due") are the band's job, not a cell's. */
    status: '',
  });
  return { rows, kinds: [...players.map(() => undefined), 'total' as const] };
}

/** Currency pre-formatted as strings — jsPDF has no number formatter. */
export function duesPdfRows(rows: ExportRow[]): (string | number)[][] {
  return rows.map(r => [
    String(r.player),
    r.totalDues !== '' ? money(Number(r.totalDues)) : '—',
    r.fundraising !== '' ? money(Number(r.fundraising)) : '—',
    r.otherCredits !== '' ? money(Number(r.otherCredits)) : '—',
    r.paid !== '' ? money(Number(r.paid)) : '—',
    r.handedBack !== '' ? money(Number(r.handedBack)) : '—',
    r.balance !== '' ? money(Number(r.balance)) : '—',
    String(r.status),
  ]);
}

// ── Expenses & payables ─────────────────────────────────────────────────────────────────────
// ⚠ NOTES ARE DELIBERATELY OUT. An expense note is free text a coach may have used for anything;
// keeping it off the export leaves this dataset free of any sensitive-field policy.

export const EXPENSE_COLUMNS: ExportColumnDef[] = [
  { label: 'Description',  key: 'description', format: 'text' },
  { label: 'Category',     key: 'category',    format: 'text' },
  { label: 'Amount',       key: 'amount',      format: 'currency' },
  { label: 'Paid',         key: 'paid',        format: 'text' },
  /* ⚖ `Deposit` / `Deposit due` / `Balance` / `Balance due` ARE RETIRED (Payables Rebuild P4,
     owner-confirmed 2026-08-20), and everything after them has shifted four columns left.
     THIS IS AN OUTWARD-FACING BREAK AND IT WAS TAKEN DELIBERATELY, ONCE.

     A coach's saved spreadsheet, pivot table or accountant's template addresses our columns by
     POSITION, so this reaches work that lives outside the product and that nobody here can see —
     which is exactly why it happens in the release that makes those headings wrong rather than a
     release later. Until now a plan could hold at most two pieces, so the four described it
     truthfully; a bill can now repeat monthly for two seasons, and a column headed `Balance`
     quoting installment 2 of twelve is a lie a reader has no way to detect.

     ⚠ NOTHING IS LOST. `Payments` says how many pieces the plan has and how many payments have
     landed, `Paid to date` and `Still owing` say what they say, and the dated pieces themselves are
     the PAYMENT SCHEDULE export — one row per piece, which is the file that could always answer
     "when is each one due?" for a plan of any length.

     ⚠ THE IMPORT TEMPLATE STILL HAS THEM (`PAYABLES_TEMPLATE_HEADERS`), and that is not drift: an
     imported sheet genuinely states a deposit and a balance, and `composeTwoPieceInstallments` is
     still the rule for what those two columns MEAN. Reading a two-piece sheet in and describing an
     n-piece bill out are different jobs. */
  { label: 'Payments',     key: 'payments',    format: 'text' },
  { label: 'Paid to date', key: 'paidToDate',  format: 'currency' },
  { label: 'Still owing',  key: 'stillOwing',  format: 'currency' },
  { label: 'Payee',        key: 'payee',       format: 'text' },
  // ⚠ TAGS BELONG HERE BECAUSE THE FILTER SITS ON THE SAME TOOLBAR AS EXPORT. A coach could
  // narrow the list to one money tag, export it, and open a spreadsheet with no column saying
  // which tag they had picked — the one fact that made the export worth taking (owner review
  // 2026-08-15, Q on the Tags column). Unlike notes above, a tag is a chosen label from a
  // managed library, never free text a coach may have put anything into.
  { label: 'Tags',         key: 'tags',        format: 'text' },
];

/** What the Paid column says, per state. A lookup rather than a chain, so the three are one list. */
const PAID_STATE_LABEL: Record<CommitmentStanding['state'], string> = {
  settled:     'Paid',
  partly_paid: 'Partly paid',
  unpaid:      'Unpaid',
};

/**
 * @param tagsByExpenseId which money tags each expense carries, as the list panel holds them.
 * @param tagById         the loaded tag library, for turning those ids into names.
 * Both optional: a caller without the tag library still gets every other column, with Tags blank.
 */
export function expenseRows(
  expenses: RepTeamExpense[],
  tagsByExpenseId: Record<string, string[]> = {},
  tagById: Map<string, { name: string }> = new Map(),
  /** Where each commitment stands, keyed by id. Optional: a caller without it still gets every
   *  column the plan does not decide, with the payment columns blank. */
  standings: Readonly<Record<string, CommitmentStanding>> = {},
): ExportRow[] {
  return expenses.map(e => {
    const standing = standings[e.id];
    const pieces = standing?.installments ?? [];
    return {
    description: e.description,
    category: e.category ?? '',
    /* ⚠ R2 — the total is the SUM OF THE PIECES, not a separately typed figure. Falls back to the
       stored amount only when a standing was not supplied, never to reconcile a disagreement. */
    amount: standing ? standing.total : e.amount,
    /* ⚠ R4 — SETTLED MEANS PAID IN FULL. "Partly paid" is a state the old two-word sentence
       ("Deposit paid · Balance paid") could not express at all: a $600 bill with $200 against it
       read as Unpaid, and a coach filtering a spreadsheet for what was still outstanding got the
       full $600 back as the figure to chase. */
    paid: standing ? PAID_STATE_LABEL[standing.state] : PAID_STATE_LABEL.unpaid,
    // How many pieces the plan has, and how many payments have landed against it — the two facts
    // the retired deposit/balance headings could not carry once a commitment can repeat monthly.
    payments: standing ? `${standing.payments.length} of ${pieces.length}` : '',
    paidToDate: standing ? standing.paid : '',
    /* ⚠ R6 — over-payment is stated, not hidden. `remaining` floors at zero, so a commitment paid
       twice would otherwise export as "fully settled, nothing owing" with the extra dollar
       invisible; saying it out loud is what lets a coach find it against a bank statement. */
    stillOwing: standing ? (standing.over > 0 ? -standing.over : standing.remaining) : '',
    payee: e.payeePayer ?? '',
    // Names, not ids, and joined the way the row shows them. A tag the library no longer holds
    // is dropped rather than exported as a bare id.
    tags: (tagsByExpenseId[e.id] ?? [])
      .map(id => tagById.get(id)?.name)
      .filter((n): n is string => !!n)
      .join(', '),
    };
  });
}

/* ⚠ THE `MONEY_IN` DATASET IS GONE (money redesign P3, 2026-08-17), and it is not lost — it is
   SPLIT. It exported income and money back as one file with a Kind column telling them apart, which
   was the honest shape while one list held both. The register separates them into two filters, so
   the same rows now come out as `income` and `refund` files that each mean what their heading says,
   built by `registerExportRows` below from whatever the strip is showing. Do not reinstate a
   combined arrivals export: a heading covering two opposite events is exactly the naming problem
   this release closed. */

// ── The register ────────────────────────────────────────────────────────────────────────────

/**
 * The register's own file — and it REPLACES the Expenses and Money-in datasets rather than joining
 * them (money redesign P3).
 *
 * ⚠ THE FILE IS WHATEVER THE STRIP IS SHOWING. Both retired datasets survive as a filtered export
 * of this one: `Expenses` is the register on its Expenses filter, `Money in` is Income and Refunds
 * as two separate files that finally mean what their headings say. A menu above the tab bar could
 * never have offered that, which is the argument this module's header already makes.
 *
 * ⚠ THE BALANCE COLUMN LEAVES WITH THE SCREEN'S. A running balance over a filtered subset is a
 * number that looks like cash and isn't — and a spreadsheet is exactly where such a column gets
 * summed, sorted and quoted to a club treasurer with no filter chip in sight.
 */
export const REGISTER_COLUMNS: ExportColumnDef[] = [
  { label: 'Date',      key: 'date',     format: 'date' },
  { label: 'What',      key: 'what',     format: 'text' },
  { label: 'Kind',      key: 'kind',     format: 'text' },
  { label: 'Category',  key: 'category', format: 'text' },
  { label: 'Item',      key: 'item',     format: 'text' },
  // ⚠ TWO COLUMNS, POSITIVE IN BOTH. A single signed column is the superseded draft the register
  // exists instead of (plan §2), and in a spreadsheet it is worse still: whatever lands in one
  // column gets summed by someone.
  { label: 'Money out', key: 'moneyOut', format: 'currency' },
  { label: 'Money in',  key: 'moneyIn',  format: 'currency' },
  { label: 'Balance',   key: 'balance',  format: 'currency' },
  { label: 'Status',    key: 'status',   format: 'text' },
  /* ⚠ APPENDED, NEVER INSERTED (money centralization P4). This module's own header records why:
     a coach's saved pivot table or accountant's template addresses these columns by POSITION, so a
     new one goes on the end where nothing shifts under work nobody here can see.
     ⚠ AND IT IS NOT A SECOND COPY OF `Status`. That column says whether team cash moved; this says
     WHOSE money did, which is the fact a treasurer needs to reconcile a household's credit against
     the bill it came from. */
  { label: 'Paid by',   key: 'paidBy',   format: 'text' },
];

export function registerExportRows(
  rows: Array<RegisterBookRow>,
  /** False when the screen is filtered — the column comes out blank, exactly as it is hidden. */
  showBalance: boolean,
): ExportRow[] {
  return rows.map(r => ({
    date: r.date ?? '',
    what: r.description,
    kind: REGISTER_KIND_LABEL[r.kind],
    category: r.categoryName ?? '',
    item: r.itemName ?? '',
    moneyOut: r.moneyOut || '',
    moneyIn: r.moneyIn || '',
    /* ⚠ THE FIGURE, NOT A BLANK, ON A ROW THAT MOVED NO TEAM CASH (/review, 2026-08-17). This read
       `showBalance && r.movesCash ? … : ''`, which emptied the Balance cell on exactly the
       out-of-pocket row the SCREEN deliberately fills in — the register's own rule is that the
       balance repeats unchanged there, because "repeating the previous figure rather than blanking
       it keeps the column readable top to bottom." A coach exporting the book they are looking at
       got a gap where the screen shows a number, in the one place this design says not to. The
       Status column carries the explanation instead: `Settled — no team cash`. */
    balance: showBalance ? r.balance : '',
    /* The two facts a column of figures cannot carry: whether this has happened yet, and whether it
       moved the team's cash at all. Without the second, an out-of-pocket cost reads in a spreadsheet
       as money that left the account. */
    status: r.overdueDays != null ? `Overdue · ${r.overdueDays}d`
      : r.scheduled ? 'Scheduled' : r.movesCash ? 'Settled' : 'Settled — no team cash',
    /* Blank rather than a placeholder on the overwhelming majority of rows the team paid: a
       spreadsheet is filtered and sorted, and "The team" as text would sort in among real names. */
    paidBy: r.paidByName ?? '',
  }));
}

/** The payment-schedule sub-tab: one dated commitment per row, across both lanes. */
export const SCHEDULE_COLUMNS: ExportColumnDef[] = [
  { label: 'Due date',    key: 'dueDate',     format: 'date' },
  { label: 'What',        key: 'description', format: 'text' },
  { label: 'From',        key: 'source',      format: 'text' },
  { label: 'Amount',      key: 'amount',      format: 'currency' },
  { label: 'Status',      key: 'status',      format: 'text' },
];

export function scheduleRows(
  rows: Array<{ description: string; amount: number; dueDate: string | null; paid?: boolean; overdue: boolean; source: 'team' | 'org' }>,
): ExportRow[] {
  return rows.map(r => ({
    dueDate: r.dueDate ?? '',
    description: r.description,
    source: r.source === 'org' ? 'Club' : 'Team',
    amount: r.amount,
    status: r.paid ? 'Paid' : r.overdue ? 'Overdue' : 'Due',
  }));
}

// ── Fundraisers ─────────────────────────────────────────────────────────────────────────────
// ⚠ Per-fundraiser totals ONLY — never the per-player breakdown, which names children beside the
// money they raised and stays on the fundraiser's own page.

export const FUNDRAISER_COLUMNS: ExportColumnDef[] = [
  { label: 'Name',           key: 'name',     format: 'text' },
  // ⚠ The KIND leads, so the two total separately in a spreadsheet. A treasurer's question is how
  // much of the season came from families selling things versus from sponsors, and a single
  // undifferentiated list cannot be pivoted to answer it (2026-08-15).
  { label: 'Kind',           key: 'kind',     format: 'text' },
  { label: 'Status',         key: 'status',   format: 'text' },
  // "Credit", never "rebate", in anything a customer reads (vocabulary ruling 2026-08-31 — the
  // dues side already said credit everywhere). The KEY stays `rebate`: it is an identifier.
  { label: 'Credit %',       key: 'rebate',   format: 'number' },
  { label: 'Starts',         key: 'starts',   format: 'date' },
  { label: 'Ends',           key: 'ends',     format: 'date' },
  // ⚠ RECEIVED AND PLEDGED ARE SEPARATE COLUMNS (owner ruling Q15, 2026-08-28 — the forms
  // review's SP-3). The old single "Total raised" mixed cash with promises, so a treasurer
  // pivoting the sheet counted a $2,000 pledge as raised money with only the Status column to
  // save them. Now a sum of Received is money; a sum of Pledged is what is still to come.
  { label: 'Received',       key: 'raised',   format: 'currency' },
  { label: 'Pledged',        key: 'pledged',  format: 'currency' },
  { label: 'Player credits', key: 'credits',  format: 'currency' },
  { label: 'Team net',       key: 'net',      format: 'currency' },
  { label: 'Players',        key: 'players',  format: 'number' },
  // ⚠ The money-in half of the money-tag report (mig 239). The Expenses export has carried a Tags
  // column since 2026-08-15; without the same column here a coach pivoting a spreadsheet by tag
  // sees every dollar that label COST and none of what it BROUGHT IN, which reads as a loss.
  { label: 'Tags',           key: 'tags',     format: 'text' },
];

/**
 * @param tagById the loaded money-tag library, for turning each record's tag ids into names.
 * Optional: a caller without it still gets every other column, with Tags blank.
 */
export function fundraiserRows(
  list: Array<{
    name: string; playerRebatePercent: number; startDate: string | null; endDate: string | null;
    totalRaised: number; totalCredits: number; teamNet: number; playerCount: number;
    kind?: 'fundraiser' | 'sponsor'; sponsorStatus?: 'pledged' | 'received' | null;
    isActive?: boolean; tagIds?: string[]; stillToCome?: number | null;
  }>,
  tagById: Map<string, { name: string }> = new Map(),
): ExportRow[] {
  return list.map(f => ({
    name: f.name,
    kind: KIND_LABEL[f.kind ?? 'fundraiser'],
    // A drive is running or it isn't; a sponsor has arrived or it hasn't. The column carries
    // whichever question applies, because a spreadsheet cannot ask which kind it is looking at.
    status: f.kind === 'sponsor'
      /* The same DERIVED word the row and the room show (Phase B, 2026-09-02): the stored status
         flips to received on the first cheque, so it called a half-kept promise "Received". */
      ? SPONSOR_STANDING_LABEL[sponsorStanding(f.totalRaised + (f.stillToCome ?? 0), f.totalRaised)]
      : (f.isActive === false ? 'Closed' : 'Active'),
    rebate: f.playerRebatePercent,
    starts: f.startDate ?? '',
    ends: f.endDate ?? '',
    raised: f.totalRaised,
    // What is still to come on the promise (mig 268) — zero for a drive or a fully-kept pledge.
    pledged: f.stillToCome ?? 0,
    credits: f.totalCredits,
    net: f.teamNet,
    players: f.playerCount,
    // Names, not ids, joined the way the record shows them — same rule as the expense export.
    tags: (f.tagIds ?? [])
      .map(id => tagById.get(id)?.name)
      .filter((n): n is string => !!n)
      .join(', '),
  }));
}

// ── Org allocations ─────────────────────────────────────────────────────────────────────────
// What the club has billed this team, one INSTALLMENT per row rather than one allocation: a
// treasurer reconciling a bank statement is matching individual payments, not totals.

/* ⚠ THE FILING COLUMNS ARE NEW (mig 250, money redesign P4) and they are the reason a treasurer can
   reconcile this file against Budget vs. Actual at all: until a club record names one of the team's
   own budget words, none of its money reached that report. An unfiled row exports an empty pair
   rather than a placeholder — a spreadsheet is filtered and sorted, and "Not filed" as text would
   sort in among the real category names. */
/**
 * ═══ THE CLUB TAB'S ONE EXPORT — the table as it stands on screen ═══════════════════════════════
 *
 * ⚠⚠ ONE BUTTON, ONE FILE (owner, 2026-09-01). The tab briefly carried an Export per group, which
 * was two triggers both reading the word "Export" producing different files — the exact shape
 * `CoachExportButton`'s own header records an owner ruling against. The tab is one table now, so it
 * gets one export OF that table: the portal rule is that an export gives you what you are looking
 * at.
 *
 * ⚠⚠ AND THE PER-INSTALMENT GRAIN IS NOT LOST WITH IT, WHICH IS WHY THIS IS SAFE. The old bills
 * export was one row per INSTALMENT, deliberately — "a payment is what gets matched". That reading
 * still exists, and in a better place: the **Ledger** carries every club instalment as its own
 * DATED row (`coach-register-book.ts`, `kind: 'club'`) with its category, item, money out, running
 * balance and status, and the register export ships all of it. A treasurer reconciling a bank
 * statement wants the dated book; a coach exporting this screen wants this screen.
 *
 * ⚠ EVERY MONEY COLUMN IS UNAMBIGUOUS, and that is the register's rule applied here: "whatever
 * lands in one column gets summed by someone". A bill's outstanding and a request's asked amount
 * are NOT the same quantity, so they never share a column — `Billed` / `Paid` / `Still to pay`
 * belong to bills, `Requested` to requests, and each one sums to something true on its own.
 */
export const CLUB_MONEY_COLUMNS: ExportColumnDef[] = [
  { label: 'Group',        key: 'group',     format: 'text' },
  { label: 'What',         key: 'what',      format: 'text' },
  { label: 'Direction',    key: 'direction', format: 'text' },
  { label: 'New money or money back', key: 'meaning', format: 'text' },
  { label: 'Category',     key: 'category',  format: 'text' },
  { label: 'Item',         key: 'item',      format: 'text' },
  { label: 'Billed',       key: 'billed',    format: 'currency' },
  { label: 'Paid',         key: 'paid',      format: 'currency' },
  { label: 'Still to pay', key: 'toPay',     format: 'currency' },
  { label: 'Requested',    key: 'requested', format: 'currency' },
  { label: 'Status',       key: 'status',    format: 'text' },
  { label: 'Decided',      key: 'decided',   format: 'date' },
];

/**
 * The whole Club tab, in the order it is read on screen: the bills band, then the requests band.
 *
 * ⚠ THE ROW ORDER IS THE SCREEN'S, not the database's — a coach who exports what they are looking
 * at should be able to find the row they were looking at.
 */
export function clubMoneyRows(
  splits: Array<{
    allocationDescription: string;
    amount: number;
    budgetCategoryName?: string | null;
    budgetItemName?: string | null;
    installments: Array<{ amount: number; dueDate: string; paidAt: string | null }>;
  }>,
  requests: Array<{
    requestType: ClubRequestType; moneyInMeaning?: ClubMoneyInMeaning | null;
    amount: number; description: string;
    budgetCategoryName?: string | null; budgetItemName?: string | null;
    status: string; reviewedAt: string | null;
  }>,
  today: string,
): ExportRow[] {
  const bills = splits.map(s => {
    let paid = 0, toPay = 0, overdue = 0;
    for (const i of s.installments) {
      if (i.paidAt) { paid += i.amount; continue; }
      toPay += i.amount;
      if (i.dueDate < today) overdue += 1;
    }
    return {
      group: 'Billed us',
      what: s.allocationDescription,
      direction: '',
      meaning: '',
      category: s.budgetCategoryName ?? '',
      item: s.budgetItemName ?? '',
      billed: s.amount,
      paid,
      toPay,
      requested: '',
      /* The same three words the row shows, so a spreadsheet and the screen agree about a bill. */
      status: overdue > 0
        ? String(overdue) + ' overdue'
        : toPay > 0.005 ? 'On track' : 'Paid',
      decided: '',
    };
  });
  const asked = requests.map(r => ({
    group: "We've asked",
    what: r.description,
    // ⚠ "Club", not "Org" — the file a coach hands their treasurer uses the screen's own word.
    direction: r.requestType === 'payment_to_org' ? 'To the club' : 'From the club',
    meaning: clubMoneyInWord(r) ?? '',
    category: r.budgetCategoryName ?? '',
    item: r.budgetItemName ?? '',
    billed: '', paid: '', toPay: '',
    requested: r.amount,
    status: REQUEST_STATUS_LABEL[r.status] ?? (r.status.charAt(0).toUpperCase() + r.status.slice(1)),
    decided: r.reviewedAt ? r.reviewedAt.slice(0, 10) : '',
  }));
  return [...bills, ...asked];
}

export const ALLOCATION_COLUMNS: ExportColumnDef[] = [
  { label: 'Allocation', key: 'allocation', format: 'text' },
  { label: 'Category',   key: 'category',   format: 'text' },
  { label: 'Item',       key: 'item',       format: 'text' },
  { label: 'Due date',   key: 'dueDate',    format: 'date' },
  { label: 'Amount',     key: 'amount',     format: 'currency' },
  { label: 'Status',     key: 'status',     format: 'text' },
  { label: 'Paid on',    key: 'paidAt',     format: 'date' },
];

export function allocationRows(
  splits: Array<{
    allocationDescription: string;
    budgetCategoryName?: string | null;
    budgetItemName?: string | null;
    installments: Array<{ dueDate: string; amount: number; paidAt: string | null }>;
  }>,
  today: string,
): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const s of splits) {
    for (const i of s.installments) {
      rows.push({
        allocation: s.allocationDescription,
        // One filing per BILL, repeated on each of its instalment rows — a spreadsheet reader
        // filters on a column, and a value present on only the first row of a group filters wrong.
        category: s.budgetCategoryName ?? '',
        item: s.budgetItemName ?? '',
        dueDate: i.dueDate,
        amount: i.amount,
        status: i.paidAt ? 'Paid' : i.dueDate < today ? 'Overdue' : 'Due',
        paidAt: i.paidAt ?? '',
      });
    }
  }
  return rows;
}

// ── Payment requests ────────────────────────────────────────────────────────────────────────

export const PAYMENT_REQUEST_COLUMNS: ExportColumnDef[] = [
  { label: 'Raised',      key: 'created',     format: 'date' },
  { label: 'Direction',   key: 'type',        format: 'text' },
  { label: 'Description', key: 'description', format: 'text' },
  // See the note on ALLOCATION_COLUMNS — same two columns, same reason.
  /* ⚠ THE MEANING SITS BEFORE THE FILING, because it is what decides how the filing is READ
     (mig 271). A spreadsheet showing "From the club · Facilities · Diamond Permits · $325" cannot
     be reconciled against the report without it: the same four columns describe a grant that added
     $325 of revenue and a repayment that took $325 off a cost. Blank on anything going TO the club,
     where there is nothing to say. */
  { label: 'New money or money back', key: 'meaning', format: 'text' },
  { label: 'Category',    key: 'category',    format: 'text' },
  { label: 'Item',        key: 'item',        format: 'text' },
  { label: 'Amount',      key: 'amount',      format: 'currency' },
  { label: 'Method',      key: 'method',      format: 'text' },
  { label: 'Status',      key: 'status',      format: 'text' },
  { label: 'Reviewed',    key: 'reviewed',    format: 'date' },
];

/** What a status reads as in the file. ⚠ `pending` says WHO is holding it, matching the screen —
 *  a treasurer opening this spreadsheet a month later needs the same answer the tab gave. */
const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending:  'Awaiting the club',
  approved: 'Approved',
  denied:   'Declined',
};

export function paymentRequestRows(
  requests: Array<{
    requestType: ClubRequestType; moneyInMeaning?: ClubMoneyInMeaning | null;
    amount: number; description: string;
    budgetCategoryName?: string | null; budgetItemName?: string | null;
    paymentMethod: string | null; status: string; createdAt: string; reviewedAt: string | null;
  }>,
): ExportRow[] {
  return requests.map(r => ({
    created: r.createdAt.slice(0, 10),
    // ⚠ "Club", not "Org" (owner ruling 2026-08-17) — the file a coach hands their treasurer must
    // use the same word the screen does, and this pair was the last place saying otherwise.
    type: r.requestType === 'payment_to_org' ? 'To the club' : 'From the club',
    description: r.description,
    /* ⚠ THE SAME TWO WORDS THE ROW PRINTS, from the module that owns them — including what a
       LEGACY row (no answer) reads as, which is decided there rather than here. A blank column and
       a wrong word are both worse than the truth: the report has counted these as repayments since
       they were approved. */
    meaning: clubMoneyInWord(r) ?? '',
    category: r.budgetCategoryName ?? '',
    item: r.budgetItemName ?? '',
    amount: r.amount,
    method: r.paymentMethod ?? '',
    status: REQUEST_STATUS_LABEL[r.status]
      ?? (r.status.charAt(0).toUpperCase() + r.status.slice(1)),
    reviewed: r.reviewedAt ? r.reviewedAt.slice(0, 10) : '',
  }));
}

// ── Budget vs. actual (the CATEGORY table) ──────────────────────────────────────────────────
// ⚠ NOT the month grid. That one's columns depend on the season's months and its cells on the
// chosen reading, so it is built by the panel that owns those switches.

/**
 * The Budget-vs-Actual columns — and the plan column is NAMED BY THE BASIS.
 *
 * ⚠⚠ IT WAS A FLAT CONSTANT AND THAT WAS A REAL DEFECT (owner QA §145, 2026-09-05). The To date
 * basis shipped re-cutting every figure in this file correctly, and left both of its LABELS behind:
 * a part-year plan came out headed "Budgeted", under a closing row called "Season net", with no
 * mark anywhere saying which span it covered. The figures were right and the file lied about them —
 * which is worse than being wrong, because a board reading the attachment has nothing to check
 * against. The screen has renamed both since the day the basis shipped; this is the file catching
 * up, through the same two helpers, so a third name can never be invented here.
 */
export function bvaExportColumns(basis: CompareBasis): ExportColumnDef[] {
  return [
    { label: 'Item',                   key: 'item',     format: 'text' },
    { label: planColumnLabel(basis),   key: 'budgeted', format: 'currency' },
    { label: 'Actual',                 key: 'actual',   format: 'currency' },
    { label: 'Variance',               key: 'variance', format: 'currency' },
  ];
}

/** One category, in either direction — the shape both report sections share. */
type BvaCategory = {
  /** ⚠ THE SYNTHETIC DUES ROW IS RECOGNISED BY THIS (2026-09-04) — the same sentinel key the
   *  screen and the Months band use. It is the only category on this report that is not a budget
   *  category, and the file has to say "not set yet" where it would otherwise say "not budgeted". */
  categoryId?: string | null;
  categoryName: string; budgeted: number; actual: number; variance: number;
  /** False = nothing in this category was budgeted; the file leaves Budgeted blank, as the
   *  screen does, rather than printing a zero that reads like a plan of $0. */
  inPlan: boolean;
  items: Array<{
    itemName: string; budgeted: number; actual: number; variance: number;
    inPlan: boolean; lineCount: number;
    /** Money back netted into the row. The file says so in the row's own label, because a
     *  spreadsheet has no drill-in to put it underneath. */
    refundTotal: number; grossActual: number;
  }>;
};

export type BvaCategorySource = {
  /** Estimate not yet itemized — real planned money, so it belongs in the file. */
  buffer: number;
  /** ⚠ NO LONGER ADDED AS EXTRA ROWS — it is reported as one figure. Every paid dollar, planned or
   *  not, is inside a category row now (mig 240), so listing these again below the total was how a
   *  spreadsheet came out with more spending in it than the team did. */
  unbudgeted: number;
  effectiveBudget: number;
  totalActual: number;
  headroom: number;
  /**
   * The statement, so the file reads as the screen does (mig 243).
   *
   * ⚠ CATEGORY → ITEM, matching the screen (owner ruling 2026-08-15). The file used to list a row
   * per budget LINE, named by whatever description was typed — so a spreadsheet could not be
   * reconciled against the plan any more than the report could.
   *
   * ⚠ THE EXPENSES CATEGORIES COME FROM HERE, not from a second top-level copy. The route shipped
   * both for a while and the payload carried the heaviest part of a season's report twice.
   */
  report: {
    revenue:  { categories: BvaCategory[]; budgeted: number; actual: number; variance: number };
    expenses: { categories: BvaCategory[] };
    /** Measured against the EFFECTIVE budget, so the file's closing rows match the screen's. */
    net: { budgeted: number; actual: number; variance: number };
  };
  /* ⚠ `funding` IS GONE (owner ruling 2026-09-04). It fed one thing here — the closing "Funded by
     players" row — and that row is deleted: once dues sit in the revenue band its Budgeted figure
     is the budgeted Season net with the sign flipped, and its Actual is Season net's Actual negated.
     Season net itself is no longer gated on it either; it closes this file the way it closes the
     screen, always. */
};

/** One row-pusher, shared by everything that writes into a Budget-vs-Actual file. */
type PushRow = (row: ExportRow, kind?: MoneyRowKind) => void;

/**
 * Every item, planned or not — the file carries the same two levels the screen does, so a coach can
 * reconcile one against the other line for line.
 *
 * ⚠ SHARED BY BOTH SHAPES (2026-09-05). The statement and the by-activity file describe the same
 * items; giving the second one its own copy of this loop would let one item read two ways in two
 * files downloaded a minute apart, which is the drift this whole module exists to prevent.
 */
function pushItemRows(items: BvaCategory['items'], push: PushRow): void {
  for (const item of items) {
    // ⚠ NO "(N lines)" SUFFIX — owner ruling 2026-09-04, QA §133; see the by-period export above.
    const label = item.itemName;
    /* ⚠ MONEY BACK IS SAID IN THE LABEL, NOT GIVEN A ROW. The screen puts "$2,400 paid · $150
       back" underneath the row; a spreadsheet has no underneath, and a second row would make the
       column add up to more spending than the team did — the exact defect that took the
       unbudgeted rows out of this file. */
    const back = item.refundTotal > 0.005
      ? ` — ${item.grossActual.toFixed(2)} less ${item.refundTotal.toFixed(2)} back`
      : '';
    push({
      item: `  — ${label}${item.inPlan ? '' : ' — not budgeted'}${back}`,
      budgeted: item.inPlan ? item.budgeted : '',
      actual:   item.actual,
      variance: item.variance,
    }, 'item');
  }
}

/**
 * The Budget-vs-Actual CATEGORY table. Both the hub-era export and the panel's own call this, so
 * the same report cannot come out two ways.
 *
 * ⚠ THE BUFFER, THE UNBUDGETED ROWS, THE TOTAL AND THE FUNDING BLOCK ARE PART OF THE REPORT, not
 * decoration. A first draft rebuilt this from the categories alone and shipped a spreadsheet whose
 * totals disagreed with the screen — which is the whole argument for one builder rather than two.
 *
 * ⚠ NOT the month grid: its columns depend on the season and its cells on the chosen reading, so
 * it is built by the panel that owns those switches.
 */
export function bvaCategoryRows(
  data: BvaCategorySource | null,
  /** Names the closing row. See `bvaExportColumns` for why the file has to be told. */
  basis: CompareBasis = 'season',
): { rows: ExportRow[]; kinds: (MoneyRowKind | undefined)[] } {
  const rows: ExportRow[] = [];
  // Index-aligned with `rows` — how the Excel file dresses each one. CSV/PDF never read it.
  const kinds: (MoneyRowKind | undefined)[] = [];
  const push = (row: ExportRow, kind?: MoneyRowKind) => { rows.push(row); kinds.push(kind); };
  if (!data) return { rows, kinds };

  /** One category and its items — the same two levels in both sections, and in both SHAPES. */
  const pushCategory = (cat: BvaCategory) => {
    /* ⚠ "not budgeted" IS THE WRONG WORD FOR THE DUES ROW, and it is the only row on this file that
       is not a budget category. A team with no schedule has not failed to budget something — it has
       not set its dues up yet, which is a different fact and the one the screen states. */
    const isDues = isDuesCategory(cat.categoryId);
    const notPlannedSuffix = isDues ? ' (not set yet)' : ' (not budgeted)';
    push({
      item: cat.inPlan ? cat.categoryName : `${cat.categoryName}${notPlannedSuffix}`,
      // ⚠ BLANK, NEVER ZERO, where nothing was budgeted. A 0 in a spreadsheet is a plan of nothing;
      // an empty cell is the absence of a plan, and those are different facts a treasurer acts on
      // differently.
      budgeted: cat.inPlan ? cat.budgeted : '',
      actual: cat.actual,
      variance: cat.variance,
    }, 'category');
    /* ⚠⚠⚠ THE PER-FAMILY ROWS ARE **SCREEN-ONLY**, AND THIS IS A DELIBERATE, NAMED EXCEPTION TO
       `EXPORT SHAPE = SCREEN SHAPE` (owner ruling 2026-09-10). Read this before "fixing" it.

       Since 2026-09-10 the Player dues category on screen folds to ONE ROW PER FAMILY, each naming
       a child and carrying what that family was billed, what has come in, and **what they still
       owe**. Every other category's items follow the screen into this file, and the standing lesson
       (`project_coach_bva_activity_fold`) says these two shapes must not drift — which is exactly
       why the divergence has to be argued here rather than discovered later.

       ⚠⚠ THE STATEMENT EXPORTS TO A FILE A TREASURER EMAILS TO A BOARD. Following the screen would
       put twelve families' debts into that file, where it is forwarded, printed and left on a table
       — and the coach who pressed Export never chose to publish it. The alternative (the file
       matching the screen) was considered and REJECTED by the owner on exactly that ground: it
       changes what a treasurer is handing round a table.

       ⚠ DRIVES AND SPONSORS STAY NAMED in this file, and the line is not arbitrary: they are
       businesses and events. These are children.

       ⚠ THE FIGURE IS UNCHANGED — the category row above already carries the season's dues total,
       and it is the sum of the rows being suppressed. Nothing is lost from the file's arithmetic;
       only the names are.

       ⚠ IF THE OWNER EVER REVERSES THIS, delete the branch — do NOT add a flag. A file that
       sometimes names children is worse than either answer. */
    if (isDues) return;
    pushItemRows(cat.items, push);
  };

  /* ⚠ THE FILE IS THE STATEMENT, because the screen is (mig 243). Revenue first with its own
     total, then expenses, then what players still fund — a spreadsheet that grouped the same
     records differently from the report it was downloaded from is the two-buttons-one-name defect
     wearing a different hat. */
  if (data.report.revenue.categories.length > 0) {
    push({ item: 'REVENUE', budgeted: '', actual: '', variance: '' }, 'section');
    for (const cat of data.report.revenue.categories) pushCategory(cat);
    push({
      item: 'Total revenue',
      budgeted: data.report.revenue.budgeted,
      actual: data.report.revenue.actual,
      // ⚠ actual − budget on this side. Raising LESS than expected must read as the unfavourable
      // number here and on screen; written the other way round, a team that came up $1,350 short
      // saw red on screen and a positive figure in the spreadsheet.
      variance: data.report.revenue.variance,
    }, 'total');
    push({ item: 'EXPENSES', budgeted: '', actual: '', variance: '' }, 'section');
  }

  for (const cat of data.report.expenses.categories ?? []) pushCategory(cat);
  if (data.buffer > 0) {
    // 'category' for the bolding: the screen renders this row with the category-header
    // treatment (panel `bufferRow`), and the file should read like the screen (/review find).
    // "Estimate not yet broken out" (owner D5.11, 2026-09-02) — renamed with the screen; the old
    // "Not itemized yet" collided with "Not itemized", a different concept on the same table.
    push({ item: 'Estimate not yet broken out', budgeted: data.buffer, actual: '', variance: '' }, 'category');
  }
  push({
    item: data.report.revenue.categories.length > 0 ? 'Total expenses' : 'Total',
    budgeted: data.effectiveBudget, actual: data.totalActual, variance: data.headroom,
  }, 'total');
  // Named, not added. The rows above already contain every one of these dollars.
  if (data.unbudgeted > 0) {
    push({ item: '  of which never budgeted', budgeted: '', actual: data.unbudgeted, variance: '' }, 'item');
  }

  /* ⚠⚠ THE FILE ENDS WHERE THE SCREEN ENDS (owner ruling 2026-09-04). "Funded by players" used to
     follow Season net here; it is deleted, because once dues sit in the revenue band its Budgeted
     figure is the budgeted Season net with the sign flipped and its Actual is Season net's Actual
     negated — two rows, four figures, no new fact. A board reading the spreadsheet alone loses the
     phrase "the plan needs $X from families"; that was ruled acceptable, because a file has no
     footnotes and the Budget plan file owns and already prints that figure. Do not solve it with a
     trailing note row: a string in a money column is what this file has twice been cleaned up to
     stop doing.
     ⚠ AND SEASON NET IS NO LONGER GATED. It was pushed only when `funding` existed — an accident of
     sitting inside that block — while the screen has always printed it unconditionally. Deleting
     the row it shared a branch with is what made the difference visible. */
  if (data.report.revenue.categories.length > 0) {
    // The server's figure, the same one the screen prints — never a fourth recomputation.
    push({
      /* ⚠ RENAMED BY THE BASIS (owner QA §145). Under To date this figure is a CASH-TIMING
         statement wearing a PROFITABILITY name, which is the whole reason the screen renames it —
         and a file that kept the season's name for it would be the only place a reader could not
         tell. Same helper as the screen; never a second spelling. */
      item: netRowLabel(basis),
      budgeted: data.report.net.budgeted,
      actual: data.report.net.actual,
      variance: data.report.net.variance,
    }, 'total');
  }
  return { rows, kinds };
}

/** One activity block, as the by-activity view draws it: what a category earned, what it cost,
 *  what it netted. Mirrors the screen's own `ActivityBlock`. */
export type BvaActivityBlock = {
  categoryId?: string | null;
  categoryName: string;
  revenue: BvaCategory | null;
  costs: BvaCategory | null;
  net: { budgeted: number; actual: number; variance: number };
};

export type BvaActivitySource = {
  activities: BvaActivityBlock[];
  buffer: number;
  net: { budgeted: number; actual: number; variance: number };
};

/**
 * THE BY-ACTIVITY TABLE — its own file at last (owner ruling 2026-09-05, QA §145).
 *
 * ⚠⚠ WHY IT EXISTS. Until 2026-09-05 this view had no export of its own and fell through to the
 * STATEMENT — never a decision, just what was left when the view was not Months. That was not a
 * cosmetic mismatch: by activity is the only shape that sets a category's revenue against its own
 * costs, which is the one question a statement structurally cannot answer, because a category
 * appears in both of its sections. A coach who read "did hosting the tournament pay for itself?"
 * on screen and pressed Export got a file that could not tell them.
 *
 * ⚠ THE SILENT PART WAS THE TELL. The one comparable swap on this screen — the Months view's PDF,
 * which is deliberately the statement because a month grid on paper can only leave months off — is
 * ANNOUNCED in the file-type dialog, with its own note saying "never silent". This one announced
 * nothing.
 *
 * ⚠ DUES LEAD, AS A ROW AND NOT A BLOCK, exactly as on screen: a band, one row and a subtotal would
 * be the words "Player dues" three times over a category with one figure that can never have a cost
 * half. Omitting them is not an option either — both shapes close on the same Season net, and it
 * moved when dues joined the revenue half, so blocks without them would sum to one number under a
 * total that says another.
 *
 * ⚠ THE INNER Revenue / Costs LABELS APPEAR ONLY WHERE A BLOCK HAS BOTH. On a one-sided category
 * they are a heading distinguishing nothing from nothing — the screen's rule, kept.
 *
 * ⚠⚠ ONE BLOCK IS NOW ONE HEADING PLUS ITS LINES — no shouted band above, no "netted" row below
 * (owner ruling 2026-09-06, QA §146 F2). The full argument is at the push site; the rule to carry
 * away is that **this file's shape is the screen's shape, and when one moves the other moves in the
 * same unit of work.** It has now drifted once, within a day of being written, in exactly that way.
 */
export function bvaActivityRows(
  data: BvaActivitySource | null,
  basis: CompareBasis = 'season',
  /** Recognises the synthetic dues block — the one "category" that is not a budget category. */
  isDues: (categoryId?: string | null) => boolean = id => isDuesCategory(id ?? null),
): { rows: ExportRow[]; kinds: (MoneyRowKind | undefined)[] } {
  const rows: ExportRow[] = [];
  const kinds: (MoneyRowKind | undefined)[] = [];
  const push: PushRow = (row, kind) => { rows.push(row); kinds.push(kind); };
  if (!data) return { rows, kinds };

  for (const block of data.activities) {
    if (!isDues(block.categoryId)) continue;
    const cat = block.revenue;
    if (!cat) continue;
    push({
      // "not set yet", never "not budgeted" — a team with no schedule has not failed to budget
      // something, it has not set its dues up. Same wording as the statement file.
      item: cat.inPlan ? cat.categoryName : `${cat.categoryName} (not set yet)`,
      budgeted: cat.inPlan ? cat.budgeted : '',
      actual: cat.actual,
      variance: cat.variance,
    }, 'category');
    /* ⚠⚠⚠ NO `pushItemRows` HERE, AND ITS ABSENCE IS NOW A RULING RATHER THAN AN ACCIDENT (owner
       2026-09-10). Until that date the dues block genuinely had no items, so this loop wrote a bare
       row because there was nothing else to write. It has one row per FAMILY now — each naming a
       child and what they still owe — and adding the call would put all of them into a file a
       treasurer emails to a board.

       ⚠ THE SAME EXCEPTION AS THE STATEMENT FILE'S, ARGUED IN FULL AT `pushCategory` above: the
       per-family rows are SCREEN-ONLY, drives and sponsors stay named because they are businesses
       and events rather than children, and the category figure here is already the sum of what is
       being suppressed, so the file's arithmetic loses nothing. This is a deliberate, named
       exception to EXPORT SHAPE = SCREEN SHAPE — not a divergence to tidy up. */
  }

  for (const block of data.activities) {
    if (isDues(block.categoryId)) continue;
    const bothHalves = !!block.revenue && !!block.costs;

    /* ⚠⚠ THE NET LEADS THE BLOCK, AND THE "netted" ROW IS GONE (owner ruling 2026-09-06, QA §146
       F2: *"the file should match the screen"*).

       This file used to open each block with the category's name SHOUTED as a band and close it,
       three rows later, on "<name> netted" carrying the figures. That was faithful to the screen it
       was written against — for one day. The screen moved the net onto the category's own row at
       the TOP of the block and deleted both the band and the closing subtotal; the file did not
       follow, so a coach reading "Tournaments · ($2,500.00)" on screen and pressing Export got a
       spreadsheet with an empty TOURNAMENTS heading and the figure at the bottom under a different
       word. Same arithmetic, two documents.

       ⚠ THE WORDS "netted" AND "cost" LEAVE WITH THE ROW, and that is the point rather than a
       casualty. They existed because the row sat BELOW the lines and had to say what it was
       summing; above them, on a category row that every shape already reads as a total, the
       category's own name is the whole label. A cost-only block still nets NEGATIVE and still says
       so in brackets — the honest reading of a category that earned nothing, carried by the figure
       rather than the label.

       ⚠ THE FIGURES ARE UNTOUCHED: `block.net`, the same three the closing row stated, in the same
       order. Only their row moved. */
    push({
      item: block.categoryName,
      budgeted: block.net.budgeted,
      actual: block.net.actual,
      variance: block.net.variance,
    }, 'category');

    /* ⚠ THE INNER LABELS SIT INSIDE THE BLOCK, not over it. On screen they are the quietest thing
       in the table — a sub-label, no ground, no rule — and they live behind the activity's fold, so
       in the file they take the ITEM level: one outline step in, under the row that totals them,
       collapsing with the lines they introduce. As `category` rows they were bold and level-0, and
       they split one activity into two Excel groups.

       ⚠⚠ AND THEY ARE SHOUTED, which is the ONE thing a spreadsheet cell can do that the screen
       does with CSS (/review, 2026-09-06). Demoting them to item level took their bold with it, and
       a plain "Revenue" at the same indent as "Concession revenue" with three empty money cells is
       not a heading — it is a line somebody forgot to fill in. The screen renders these in small
       capitals precisely so they cannot be mistaken for a line name; `text-transform` has no
       spreadsheet equivalent, so the file carries the case in the string. This is the same rule
       that removed the shouted band above: **match the screen**, and here the screen shouts. */
    if (block.revenue) {
      if (bothHalves) push({ item: 'REVENUE', budgeted: '', actual: '', variance: '' }, 'item');
      pushItemRows(block.revenue.items, push);
    }
    if (block.costs) {
      /* ⚠ "EXPENSES", NOT "COSTS" (owner ruling 2026-09-10). The screen's inner sub-label moved to
         Expenses when the two-register rule was settled — the Statement half of this same file has
         always shouted EXPENSES — and this literal is the one the file's own header rule is about:
         the export's shape is the screen's shape, in the same unit of work. ⚠ The Budget PLAN's
         COSTS band above is a DIFFERENT register (Costs / Funding, a plan not a statement) and is
         deliberately left alone. */
      if (bothHalves) push({ item: 'EXPENSES', budgeted: '', actual: '', variance: '' }, 'item');
      pushItemRows(block.costs.items, push);
    }
  }

  if (data.buffer > 0) {
    push({ item: 'Estimate not yet broken out', budgeted: data.buffer, actual: '', variance: '' }, 'category');
  }

  // Where both shapes end, on the same figure and under the basis's own name.
  push({
    item: netRowLabel(basis),
    budgeted: data.net.budgeted,
    actual: data.net.actual,
    variance: data.net.variance,
  }, 'total');

  return { rows, kinds };
}

// ── The one download path ───────────────────────────────────────────────────────────────────

/** What the masthead says. The caller supplies the words; this module supplies the layout. */
export interface MoneyMasthead {
  /** Line 1 — the team and the season. */
  title: string;
  /** Line 2 — the report and every setting that shaped it. Omit a setting the report does not
   *  take: naming one the file does not have would be worse than naming none. */
  subtitle?: string;
  /** Line 3 — the day the figures were true. On a part-year reading this is not decoration; it is
   *  what the numbers mean, and the first thing a forwarded attachment loses. */
  meta?: string;
}

export interface MoneyDownload {
  /** Filename segment: `{org}-{dataset}-{scope}-{date}.{ext}`. */
  dataset: string;
  /** Sheet name, and the title printed at the head of a PDF. */
  title: string;
  columns: ExportColumnDef[];
  rows: ExportRow[];
  /** What each row IS, index-aligned with `rows` — Excel presentation only (bold bands,
   *  collapsible item groups). Absent = every row plain, which is right for a flat dataset. */
  rowKinds?: (MoneyRowKind | undefined)[];
  /** How the Excel file writes a currency cell. Default `minus` (matches money() and the PDFs);
   *  the Budget-vs-Actual pair passes `brackets`, its binding screen notation. */
  currencyNotation?: 'minus' | 'brackets';
  /** Currency pre-formatted for jsPDF. Required only when the caller offers PDF. */
  pdfRows?: (rows: ExportRow[]) => (string | number)[][];
  /**
   * A board-ready OPENING BLOCK for the PDF alone (BvA Two Truths D6.3, 2026-09-02): a titled
   * key/value section printed above the table — the headroom sentence, funded-by-players — built
   * from values the screen already computes, never new arithmetic. Rendered through the PDF
   * engine's own grouped mode (blank headers = a key/value block, the practice sheet's idiom).
   * Excel and CSV deliberately do not carry it: a spreadsheet's opening rows would sum into
   * whatever a treasurer pivots.
   */
  pdfIntro?: { label: string; rows: Array<[string, string]> };
  /**
   * THE REPORT'S OWN FOOTNOTES, carried into the file (owner ruling 2026-09-05).
   *
   * ⚠ THE POINT: a treasurer downloads a money report and emails it to a board. Before this, the
   * figures travelled and every sentence explaining what they mean stayed behind on the screen —
   * so a board read "Total expenses" with no way to know it deliberately excludes costs a family
   * paid a vendor directly. These are the same `ReportNote`s the screen renders, from the same
   * array, so the file cannot fall behind the page.
   *
   * ⚠ EXCEL AND PDF ONLY, and CSV's absence is a decision. A CSV is the file a treasurer pivots
   * and re-imports; prose rows under the data break both, and the import round trip is a shipped
   * feature of this hub rather than a hypothetical.
   *
   * ⚠ A `screenOnly` CLAUSE NEVER ARRIVES HERE — `noteRunsForFile` has already dropped it. A file
   * that says "tap a category's figure" is telling a reader to tap paper.
   */
  notes?: ReportNote[];
  /**
   * THE BLOCK ABOVE THE TABLE — whose money, what report, on what settings, true as of when
   * (owner ruling 2026-09-05). Everything identifying an export used to live in its FILENAME, which
   * is the first thing lost when somebody saves the attachment or pastes the table into an email.
   *
   * ⚠⚠ REPORTS ONLY. The importer takes the first non-empty row as the column header, so a masthead
   * on a file the product re-imports — the budget plan, the bills schedule — is read AS the header
   * and the import fails on a file this product produced.
   *
   * ⚠ EXCEL ONLY. The PDF already opens on its own titled header, drawn by the PDF engine with the
   * club's branding; a second title block under it would be the title twice.
   */
  masthead?: MoneyMasthead;
  orgLabel: string;
  /** Season name — in the filename, and under a PDF's title. */
  scopeLabel: string;
  teamName: string;
  pdfSettings?: OrgPdfSettings | null;
  /** What to say when there is nothing to write. */
  emptyMessage: string;
}

/**
 * Hand the coach the file.
 *
 * Throws with a coach-readable message when the screen holds nothing — the caller shows it rather
 * than downloading an empty sheet, because a spreadsheet with a header row and no rows looks like
 * the product lost the data.
 */
export async function downloadMoneyExport(format: MoneyExportFormat, spec: MoneyDownload): Promise<void> {
  if (spec.rows.length === 0) throw new Error(spec.emptyMessage);

  const filename = buildFilename(
    { org: spec.orgLabel, dataset: spec.dataset, scope: spec.scopeLabel },
    format,
  );

  /* ⚠ THE CLUB'S DOCUMENT SETTINGS, RESOLVED ONCE FOR EVERY FORMAT (owner ruling 2026-09-05).
     They used to be read only inside the PDF branch, which is why an Excel file could not carry a
     crest even where the club had uploaded one — and why a caller that never passed them got
     default paper in both. Same object, same defaults, both branches. */
  const settings = { ...DEFAULT_PDF_SETTINGS, ...(spec.pdfSettings ?? {}) };

  if (format === 'pdf') {
    const body = spec.pdfRows ? spec.pdfRows(spec.rows) : serializeRows(spec.rows, spec.columns);
    await downloadPDF(
      filename,
      spec.title,
      // D1: the header carries the team's name (the identity); the subtitle keeps the season.
      spec.scopeLabel || undefined,
      spec.columns.map(c => c.label),
      body,
      settings,
      {
        identity: spec.teamName,
        ...(REPORT_SHAPES.has(spec.columns) ? { shape: REPORT_SHAPES.get(spec.columns) } : {}),
        // Flattened to plain sentences here — the PDF engine has no rich text inside a wrapped
        // paragraph, and the screen-only clauses are already gone.
        ...(spec.notes?.length
          ? { notes: spec.notes.map(n => ({ text: noteTextForFile(n), tone: n.tone })) }
          : {}),
        /* The opening block rides the engine's grouped mode: its own blank-header group first
           (a key/value block), then the table under the report's own title. Absent, the flat
           path is byte-identical to what every export always produced. */
        ...(spec.pdfIntro
          ? {
            groups: [
              { label: spec.pdfIntro.label, headers: ['', ''], rows: spec.pdfIntro.rows },
              { label: spec.title, rows: body },
            ],
          }
          : {}),
      },
    );
    return;
  }

  const headers = serializeHeaders(spec.columns);
  const body = serializeRows(spec.rows, spec.columns);
  if (format === 'csv') { downloadCSVBlob(filename, generateCSV(headers, body)); return; }

  /* The Excel file gets what the flat formats cannot carry: currency-formatted cells on every
     money column, real dates in month headers, and — where the caller declared row kinds — bold
     section/category/total bands with the item rows grouped, indented and starting CLOSED under
     Excel's own +/− controls. The item rows also shed their `  — ` label prefix here, and ONLY
     here — the indent replaces it (see MoneyRowKind for why the round trip survives that). */
  spec.rowKinds?.forEach((kind, i) => {
    // The label is always the first active column in a grouped dataset; `body` is this call's
    // own serialization, so mutating it cannot reach the CSV or PDF paths above.
    if (kind === 'item') body[i][0] = String(body[i][0]).replace(ITEM_PREFIX, '');
  });
  /* Fetched only when this file is actually going to draw one — a plain dataset export makes no
     request. Cached for the page, so a treasurer downloading four views pays for it once. */
  const brandMark = spec.masthead && settings.showBranding ? await loadBrandMark() : null;
  const numFmt = CURRENCY_NUMFMT[spec.currencyNotation ?? 'minus'];
  // Aligned with `headers` — the same sensitive-column filter serializeHeaders just applied.
  const activeCols = spec.columns.filter(c => !c.sensitive);
  await downloadXLSX(filename, headers, body, spec.title, {
    columnNumFmts: activeCols.map(c => (c.format === 'currency' ? numFmt : undefined)),
    rowStyles: spec.rowKinds?.map(k => (k ? ROW_KIND_STYLE[k] : undefined)),
    // A month column's header becomes the month's real date — UTC midnight, deliberately:
    // ExcelJS converts dates with pure epoch math, so only a UTC boundary shows the right
    // month in every timezone (see the downloadXLSX doc).
    columnHeaderDates: activeCols.map(c => {
      if (!c.headerMonth) return undefined;
      const [y, m] = c.headerMonth.split('-').map(Number);
      // Fail soft on a malformed month: the header keeps its text label rather than
      // writing an Invalid Date into the cell.
      if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return undefined;
      return new Date(Date.UTC(y, m - 1, 1));
    }),
    // Merged, wrapped cells under the table — the screen's own bold, kept. See `XlsxNote`.
    notes: spec.notes?.map(n => ({ runs: noteRunsForFile(n), tone: n.tone })),
    /* ⚠ THE CLUB'S LOGO ON TOP, OURS AT THE FOOT (owner ruling 2026-09-05). The masthead is
       letterhead — it says whose document this is, and a team's financial statement is the club's.
       Both ride the settings the PDF already uses, so a club sets its branding once. */
    masthead: spec.masthead && {
      ...spec.masthead,
      logoDataUrl: settings.logoDataUrl,
    },
    /* Our own mark, under the notes, on the club's own branding switch — force-on for the free
       plan, off-able for the rest, exactly as the PDF footer already behaves. Same words, too. */
    /**
     * ⚠⚠ ONLY ON A FILE THAT CARRIES A MASTHEAD, AND THAT GATE IS LOAD-BEARING (/review, same
     * day it was written). The first version branded every Money spreadsheet, which quietly
     * broke the import round trip: the budget plan and bills files are read back in, the parser
     * treats every non-blank row after the header as DATA, and a trailing "Generated by
     * FieldLogicHQ" would have come back as a budget line in the import preview.
     *
     * A masthead is what makes a file a REPORT — something read, emailed, filed. A file without
     * one is a DATASET: it must start on its column row and end on its last data row, because
     * this product reads it back. One flag decides both ends of the file, so they can never
     * disagree about which kind it is.
     *
     * ⚠ IT CARRIES OUR MARK NOW (owner, 2026-09-05). It shipped as text that morning under a note
     * saying a spreadsheet can only embed a raster and our brand asset was an SVG — which was half
     * true and stopped one step early: `public/favicon.svg` is a vector, but the PWA icons beside
     * it have been real PNGs since July. Nothing had to be stored; it had to be found. The mark
     * fails soft, so a footer that cannot load it is still the sentence it always was.
     */
    footer: spec.masthead && settings.showBranding
      ? { text: BRANDING_TEXT, logoDataUrl: brandMark ?? undefined }
      : undefined,
  });
}
