/**
 * THE PLAN FILE READS BACK WHOLE — the export and the importer, in one test (2026-09-10).
 *
 * ⚠⚠ THIS TEST EXISTS BECAUSE BOTH HALVES WERE GREEN WHILE THE ROUND TRIP WAS BROKEN. The exporter
 * had tests for every row it writes; the reader had tests for every shape it reads, including one
 * that called itself "reads the plan's own statement export back". Three defects still lived
 * between them, and every one was invisible for the same reason: the reader's tests SPELL THEIR OWN
 * HEADERS and hand-write the rows, so they were testing a file that resembled ours rather than ours.
 *
 * What was actually broken, and for how long:
 *
 *   1. **Money-in lines came back as costs.** The file writes COSTS and FUNDING bands; the reader
 *      ignored them, so every fundraiser, sponsor and tournament-revenue line re-imported as a NEW
 *      COST inside a revenue category. Found by `/review` 2026-09-09.
 *   2. **Cost lines were dropped entirely.** A cost word's row printed flush with its category, and
 *      in a flat file the leading dash is the ONLY nesting signal — so the reader took each one for
 *      a category name. Since 2026-09-09, when a word became its own line (mig 286) and the
 *      dash-carrying sub-rows underneath it were removed.
 *   3. **No amount on any row.** The money column is headed `Planned`; the reader's alias list had
 *      `amount`/`total`/`cost`/`budget`/`estimate`, and `getCell` matches a header exactly. Since
 *      2026-09-02, when §133 renamed the column. Every row of a re-imported plan was refused with
 *      "No amount. Add one here, or leave the row out."
 *
 * So the rule this file enforces: **build the sheet FROM the exporter, with `BUDGET_PLAN_COLUMNS`
 * as its headers.** A test that types the headers out cannot see a rename, and a rename is what
 * two of the three defects were.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  budgetPlanStatementRows, budgetPeriodGridColumns, budgetPeriodGridRows,
  BUDGET_PLAN_COLUMNS, stripItemPrefix, type BudgetPlanExportSource, type MoneyRowKind,
} from '../../lib/coach-money-exports.ts';
import { buildPeriodView, type PeriodViewLine } from '../../lib/coach-budget-periods-view.ts';
import {
  rowsFromList, rowsFromMonthGrid, reviewBudgetRows, toKnownCategories,
  type ExistingBudgetLine, type ReviewedBudgetRow,
} from '../../lib/coach-budget-import.ts';
import type { ParsedImportFile, ParsedImportRow } from '../../lib/import/types.ts';

/* ── the plan, once — a cost line and TWO money-in categories, which is the shape §158 made
   ordinary: money in is grouped by the category it was filed in, so Tournaments holds both an
   entry fee to pay and gate revenue to take.

   ⚠⚠ EVERY LINE'S DESCRIPTION DIFFERS FROM ITS WORD, AND THAT IS THE POINT (/review, 2026-09-10).
   The first cut of this fixture set `description` equal to `itemName` on every line — and it was
   green while a coach's own exported plan came back almost entirely unmatched, because the file
   names a row by its WORD and matching keyed on the DESCRIPTION. On dev, 43 of 48 real lines have
   the two differing ("Umpire Fees" the word, "Umpires" the description; "Accommodation" the word,
   "Provincials hotel block" the description) — so the shape this test used to assert was the RARE
   one. A round-trip test that hard-codes the one field real data varies is testing a file that
   resembles ours, which is the exact failure this whole file exists to end. Keep them different. */

const LINES: PeriodViewLine[] = [
  {
    id: 'l1', description: 'Entry fees — 3 tournaments', itemId: 'i-entry', itemName: 'Entry Fees',
    categoryId: 'cat-tourn', categoryName: 'Tournaments', lineKind: 'cost',
    totalAmount: 2500, notes: 'Spring classic', periods: [{ periodDate: '2027-04-01', amount: 2500 }],
  },
  {
    id: 'l2', description: 'Gate takings (estimated)', itemId: 'i-gate', itemName: 'Gate Revenue',
    categoryId: 'cat-tourn', categoryName: 'Tournaments', lineKind: 'other_income',
    totalAmount: 1200, notes: null, periods: [{ periodDate: '2027-04-01', amount: 1200 }],
  },
  {
    id: 'l3', description: 'Chocolate sale — team share', itemId: 'i-choc', itemName: 'Chocolate Sale',
    categoryId: 'cat-fund', categoryName: 'Fundraising', lineKind: 'funding',
    totalAmount: 1800, notes: null, periods: [{ periodDate: '2027-05-01', amount: 1800 }],
  },
] as never;

const STATEMENT_SOURCE: BudgetPlanExportSource = {
  groups: [{
    categoryName: 'Tournaments',
    total: 2500,
    items: [{
      itemId: 'i-entry', itemName: 'Entry Fees', total: 2500,
      lines: [{
        description: 'Entry fees — 3 tournaments', notes: 'Spring classic', totalAmount: 2500,
        periods: [{ periodDate: '2027-04-01' }],
      }],
    }],
  }],
  lines: LINES as never,
  // The figures are the VIEW's — one calculation for the screen and the file (decisions A–D).
  view: buildPeriodView(LINES, 'months'),
};

/** The vocabulary the coach's own picker would offer, both sides, through the shared builder. */
const CATEGORIES = toKnownCategories([
  {
    id: 'cat-tourn', name: 'Tournaments', items: [
      { id: 'i-entry', name: 'Entry Fees', orgId: null, teamId: null, direction: 'out' },
      { id: 'i-gate', name: 'Gate Revenue', orgId: 'org1', teamId: 't1', direction: 'in' },
    ],
  },
  {
    id: 'cat-fund', name: 'Fundraising', items: [
      { id: 'i-choc', name: 'Chocolate Sale', orgId: 'org1', teamId: 't1', direction: 'in' },
    ],
  },
]);

/** The plan as the importer sees it already stored — each line carrying the side it is on. */
const EXISTING: ExistingBudgetLine[] = LINES.map(l => ({
  id: l.id,
  description: l.description,
  categoryName: l.categoryName,
  totalAmount: l.totalAmount,
  // The WORD is the identity a row is matched on; the description is only what the coach typed.
  itemId: l.itemId ?? null,
  direction: (l.lineKind === 'cost' ? 'out' : 'in') as 'in' | 'out',
}));

/* ── the two files, built the way a download builds them ─────────────────────────────────────── */

type Col = { label: string; key: string };

/** The CSV: the builder's rows, verbatim, under the export's own column headings. */
function csvFile(columns: Col[], rows: Array<Record<string, unknown>>): ParsedImportFile {
  return {
    headers: columns.map(c => c.label),
    rows: rows.map((r, i): ParsedImportRow => ({
      rowNumber: i + 2,
      values: Object.fromEntries(columns.map(c => [c.label, String(r[c.key] ?? '')])),
    })),
  };
}

/**
 * The Excel file: the same rows, minus the `— ` on every item row, plus the outline indent that
 * replaces it — exactly what `writeMoneyExport` does for xlsx and `parseXLSX` hands back.
 *
 * ⚠ THE STRIP IS THE EXPORTER'S OWN (`stripItemPrefix`), NOT A COPY OF ITS REGEX (/simplify,
 * 2026-09-10). A hand-typed `/^\s*(?:—\s*)?/` here would be this very file's own subject repeated
 * one level down: two hand-maintained things that must agree, with nothing tying them together.
 * Change the marker and the private copy drifts in silence, leaving the Excel half unwatched.
 */
function xlsxFile(
  columns: Col[], rows: Array<Record<string, unknown>>, kinds: (MoneyRowKind | undefined)[],
): ParsedImportFile {
  const file = csvFile(columns, rows);
  file.rows.forEach((row, i) => {
    if (kinds[i] !== 'item') return;
    const label = columns[0].label;
    row.values[label] = stripItemPrefix(row.values[label]);
    row.indented = true;
  });
  return file;
}

/** Every row's verdict, sorted by name — the funding band's own order follows the coach's
 *  category order, which is a question for the exporter's tests, not this one. What this test is
 *  about is that every line comes back, on its own side, as a change to itself. */
function verdicts(rows: ReviewedBudgetRow[]) {
  return rows
    .map(r => [r.categoryName, r.lineName, r.total, r.direction, r.outcome])
    .sort((x, y) => String(x[1]).localeCompare(String(y[1])));
}

const EXPECTED = [
  ['Fundraising', 'Chocolate Sale', 1800, 'in', 'update'],
  ['Tournaments', 'Entry Fees', 2500, 'out', 'update'],
  ['Tournaments', 'Gate Revenue', 1200, 'in', 'update'],
];

describe('the season plan, exported and imported back', () => {
  const statement = budgetPlanStatementRows(STATEMENT_SOURCE);

  it('the statement file (CSV) comes back as UPDATES on both sides — nothing added, nothing dropped', () => {
    const rows = rowsFromList(csvFile(BUDGET_PLAN_COLUMNS, statement.rows));
    assert.deepEqual(verdicts(reviewBudgetRows(rows, CATEGORIES, EXISTING)), EXPECTED);
  });

  it('the statement file (Excel) does the same, nested by styling instead of by dash', () => {
    const rows = rowsFromList(xlsxFile(BUDGET_PLAN_COLUMNS, statement.rows, statement.kinds));
    assert.deepEqual(verdicts(reviewBudgetRows(rows, CATEGORIES, EXISTING)), EXPECTED);
  });

  it('and so does the by-period grid, in both formats, with its months intact', () => {
    const view = buildPeriodView(LINES, 'months', { estimatedTotal: null });
    const columns = budgetPeriodGridColumns(view);
    const { rows: gridRows, kinds } = budgetPeriodGridRows(view);

    for (const file of [csvFile(columns, gridRows), xlsxFile(columns, gridRows, kinds)]) {
      const rows = rowsFromMonthGrid(file, 2027);
      assert.deepEqual(verdicts(reviewBudgetRows(rows, CATEGORIES, EXISTING)), EXPECTED);
      // The schedule survives the trip too — a re-import that flattened the months would rewrite
      // every line's payment plan on commit, which is a worse lie than losing the row.
      assert.deepEqual(
        rows.map(r => [r.lineName, r.periods.map(p => p.month)]).sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
        [['Chocolate Sale', ['2027-05']], ['Entry Fees', ['2027-04']], ['Gate Revenue', ['2027-04']]],
      );
    }
  });

  it('⚠ with dues, an estimate and an opening balance, the file still comes back as its two lines — Player installments is never a category, and no balance row is a line', () => {
    /* The revenue-first file (2026-09-12) prints Player installments INSIDE the Revenue band as a
       non-indented row with a figure — exactly the shape the reader takes for a CATEGORY NAME — plus
       Lines so far / Still to itemize, and Opening balance / Season net / Closing balance. Every one
       is skipped by construction (`PLAN_LADDER_LABEL` feeds the skip set), so the money-in
       category that follows the installments row is still filed under its own name. Pinned here
       over the SAME producers, with the installments row carrying a NEGATIVE undated overshoot. */
    const view = buildPeriodView(LINES, 'months', {
      estimatedTotal: 3000, openingBalance: 100,
      dues: { assessed: 1200, installments: [{ date: '2027-04-15', amount: 1500 }] },
    });
    const st = budgetPlanStatementRows({ ...STATEMENT_SOURCE, view, writtenOffClause: 'after $17.00 of adjustments' });
    assert.ok(st.rows.some(r => r.item === 'Player installments'), 'the fixture must exercise the installments row');
    assert.ok(st.rows.some(r => r.item === 'Still to itemize'), 'and the estimate rows');
    for (const file of [csvFile(BUDGET_PLAN_COLUMNS, st.rows), xlsxFile(BUDGET_PLAN_COLUMNS, st.rows, st.kinds)]) {
      assert.deepEqual(verdicts(reviewBudgetRows(rowsFromList(file), CATEGORIES, EXISTING)), EXPECTED);
    }
    const columns = budgetPeriodGridColumns(view);
    const grid = budgetPeriodGridRows(view);
    assert.equal(grid.rows.find(r => r.item === 'Player installments')?.unscheduled, -300, 'the overshoot is in the file, signed');
    for (const file of [csvFile(columns, grid.rows), xlsxFile(columns, grid.rows, grid.kinds)]) {
      const rows = rowsFromMonthGrid(file, 2027);
      assert.deepEqual(verdicts(reviewBudgetRows(rows, CATEGORIES, EXISTING)), EXPECTED);
      assert.deepEqual(
        rows.map(r => [r.lineName, r.periods.map(p => p.month)]).sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
        [['Chocolate Sale', ['2027-05']], ['Entry Fees', ['2027-04']], ['Gate Revenue', ['2027-04']]],
      );
    }
  });
  it('not one derived row survives as a line — no band, no subtotal, no ladder rung', () => {
    const names = rowsFromList(csvFile(BUDGET_PLAN_COLUMNS, statement.rows)).map(r => r.lineName);
    for (const derived of [
      'REVENUE', 'Revenue', 'EXPENSES', 'Expenses', 'Total revenue', 'Total expenses',
      'Opening balance', 'Season net', 'Closing balance', 'Lines so far', 'Still to itemize',
      // The words an OLDER file carries — still skipped, still never a line (2026-09-12).
      'COSTS', 'Costs', 'FUNDING', 'Funding', 'Planned costs', 'Planned funding',
      'Costs less funding', 'Player installments (estimated)',
    ]) {
      assert.ok(!names.includes(derived), `“${derived}” came back as a budget line`);
    }
  });

  it('a money-in row can never land on the cost line of the same name, or the other way about', () => {
    /* The plan holds "Grant" twice — the cheque and the application fee — which mig 248 says are
       two different words. A file naming both must update both, each on its own side; keying the
       match on category + name alone would have one of them overwrite the other. */
    const categories = toKnownCategories([{
      id: 'cat-fund', name: 'Fundraising', items: [
        { id: 'i-fee', name: 'Grant', orgId: null, teamId: null, direction: 'out' },
        { id: 'i-cheque', name: 'Grant', orgId: 'org1', teamId: 't1', direction: 'in' },
      ],
    }]);
    const existing: ExistingBudgetLine[] = [
      { id: 'x1', description: 'Grant', categoryName: 'Fundraising', totalAmount: 250, itemId: 'i-fee', direction: 'out' },
      { id: 'x2', description: 'Grant', categoryName: 'Fundraising', totalAmount: 5000, itemId: 'i-cheque', direction: 'in' },
    ];
    const file: ParsedImportFile = {
      headers: BUDGET_PLAN_COLUMNS.map(c => c.label),
      rows: [
        ['COSTS', '', '', ''],
        ['Fundraising', '', '250', ''],
        ['  — Grant', '', '250', 'the application fee'],
        ['FUNDING', '', '', ''],
        ['Fundraising', '', '5000', ''],
        ['  — Grant', '', '5000', 'the cheque'],
      ].map((cells, i) => ({
        rowNumber: i + 2,
        values: Object.fromEntries(BUDGET_PLAN_COLUMNS.map((c, j) => [c.label, cells[j]])),
      })),
    };
    const reviewed = reviewBudgetRows(rowsFromList(file), categories, existing);
    assert.deepEqual(reviewed.map(r => [r.direction, r.outcome, r.matchedLineId]), [
      ['out', 'update', 'x1'],
      ['in', 'update', 'x2'],
    ]);
    /* ⚠ THE SAME FILE IN THE NEW WORDS (revenue-first, 2026-09-12): REVENUE / EXPENSES are what the
       product writes now, and the older COSTS / FUNDING pair above is what every file on a coach's
       disk says. Both must read, each row on its own side — the bands are read as a switch, and a
       reader that knew only one pair would silently turn the other's money in into costs. */
    const newWords: ParsedImportFile = {
      headers: BUDGET_PLAN_COLUMNS.map(c => c.label),
      rows: [
        ['REVENUE', '', '', ''],
        ['Fundraising', '', '5000', ''],
        ['  — Grant', '', '5000', 'the cheque'],
        ['Total revenue', '', '5000', ''],
        ['EXPENSES', '', '', ''],
        ['Fundraising', '', '250', ''],
        ['  — Grant', '', '250', 'the application fee'],
        ['Total expenses', '', '250', ''],
        ['Opening balance', '', '100', ''],
        ['Season net', '', '4750', ''],
        ['Closing balance', '', '4850', ''],
      ].map((cells, i) => ({
        rowNumber: i + 2,
        values: Object.fromEntries(BUDGET_PLAN_COLUMNS.map((c, j) => [c.label, cells[j]])),
      })),
    };
    const reviewedNew = reviewBudgetRows(rowsFromList(newWords), categories, existing);
    assert.deepEqual(reviewedNew.map(r => [r.direction, r.outcome, r.matchedLineId]), [
      ['in', 'update', 'x2'],
      ['out', 'update', 'x1'],
    ]);
    // A club that OWNS a category called "Revenue" keeps it: a category row carries a figure, a
    // band heading never does, and that is what tells them apart (the bare-row clause).
    const ownRevenue: ParsedImportFile = {
      headers: BUDGET_PLAN_COLUMNS.map(c => c.label),
      rows: [
        ['EXPENSES', '', '', ''],
        ['Revenue', '', '80', ''],
        ['  — Bank fees', '', '80', ''],
      ].map((cells, i) => ({
        rowNumber: i + 2,
        values: Object.fromEntries(BUDGET_PLAN_COLUMNS.map((c, j) => [c.label, cells[j]])),
      })),
    };
    const own = reviewBudgetRows(rowsFromList(ownRevenue), toKnownCategories([]), []);
    assert.deepEqual(own.map(r => [r.categoryName, r.lineName, r.direction]), [['Revenue', 'Bank fees', 'out']]);
  });
});
