/**
 * The Budget Plan's export contract (owner rider, 2026-09-02): the file is grouped the way the
 * screen is grouped, in both views, and the period file's month headers ride BvA's own pieces
 * (`formatMonthLabel` text + `headerMonth` Excel dates). These run the builders' arithmetic —
 * a green render is not evidence about a file (memory: run-the-pure-module).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  budgetPlanStatementRows, budgetPeriodGridColumns, budgetPeriodGridRows,
  type BudgetPlanExportSource,
} from '../../lib/coach-money-exports.ts';
import { buildPeriodView, type PeriodViewLine } from '../../lib/coach-budget-periods-view.ts';

function planLine(over: Partial<PeriodViewLine> & {
  id: string; description: string; totalAmount: number;
  notes?: string | null; lineKind?: string;
}): never {
  // The statement builder takes the panel's richer line shape; this stub carries what it reads.
  return {
    itemId: `item-${over.description}`, itemName: over.description, categoryName: 'Tournaments',
    lineKind: 'cost', notes: null, periods: [], ...over,
  } as never;
}

const STATEMENT_SOURCE: BudgetPlanExportSource = {
  groups: [{
    categoryName: 'Tournaments',
    total: 2500,
    items: [
      {
        itemName: 'Entry Fees',
        total: 2500,
        lines: [
          { description: 'Entry Fees', notes: 'Spring classic', totalAmount: 1600, periods: [{ periodDate: '2027-04-01' }] },
          { description: 'Entry Fees', notes: 'Regional qualifier', totalAmount: 900, periods: [{ periodDate: '2027-05-01' }] },
        ],
      },
    ],
  }],
  lines: [
    planLine({ id: 'f', description: 'Chocolate Sale', totalAmount: 1800, lineKind: 'funding' }),
  ],
  totals: { totalPlanned: 2500, fundedByPlayers: 700, fundingLineCount: 1 },
  duesAssessed: 0,
  leftToFund: 700,
};

describe('the statement file (List view, and every PDF)', () => {
  it('groups category → summed item → per-line sub-rows named by their notes', () => {
    const { rows, kinds } = budgetPlanStatementRows(STATEMENT_SOURCE);
    assert.deepEqual(rows.map(r => r.item), [
      'Tournaments',
      // ⚠ NO "(2 lines)" SUFFIX. The count came off every screen and every export label in one
      // ruling (owner 2026-09-04, QA §133) — and this file is where it read emptiest, since the two
      // lines it counted are the very next rows. The SUM ruling still holds; only the label went.
      'Entry Fees',
      '  — Spring classic',
      '  — Regional qualifier',
      'Expected fundraising',
      '  — Chocolate Sale',
      'Player installments (estimated)',
    ]);
    assert.deepEqual(kinds, ['category', 'item', 'item', 'item', 'category', 'item', 'total']);
    // The summed item row carries the sum; its lines carry their own money and their own answer to
    // "when does this money move?" — WHEN, not a chunk count (owner ruling 2026-09-04).
    assert.equal(rows[1].planned, 2500);
    assert.equal(rows[2].planned, 1600);
    assert.equal(rows[2].schedule, 'Apr');
    assert.equal(rows[3].notes, 'Regional qualifier');
    // The closing row is the screen's: players' side of a funded plan.
    assert.equal(rows[6].planned, 700);
  });

  it('a single-line item is one row, named by the item, with its schedule and note', () => {
    const src: BudgetPlanExportSource = {
      ...STATEMENT_SOURCE,
      groups: [{
        categoryName: 'Facilities',
        total: 5200,
        items: [{
          itemName: 'Dome Time',
          total: 5200,
          lines: [{
            description: 'Dome Time', notes: '16 sessions, Jan–Mar', totalAmount: 5200,
            periods: [{ periodDate: '2027-01-01' }, { periodDate: '2027-02-01' }, { periodDate: '2027-03-01' }],
          }],
        }],
      }],
      lines: [],
      totals: { totalPlanned: 5200, fundedByPlayers: 5200, fundingLineCount: 0 },
    };
    const { rows } = budgetPlanStatementRows(src);
    assert.deepEqual(rows.map(r => r.item), ['Facilities', 'Dome Time', 'Total planned budget']);
    // ⚠ THE MONTHS THEMSELVES, not "Jan–Mar · 3 chunks". A count is not an answer to "when",
    // and the old label could not say that a partly-dated line had money with no date at all.
    assert.equal(rows[1].schedule, 'Jan · Feb · Mar');
    assert.equal(rows[1].notes, '16 sessions, Jan–Mar');
  });

  it('with dues scheduled, closes on the screen\'s residual — or on nothing when they match', () => {
    const short = budgetPlanStatementRows({ ...STATEMENT_SOURCE, duesAssessed: 500, leftToFund: 200 });
    const shortTail = short.rows.slice(-2).map(r => r.item);
    assert.deepEqual(shortTail, ['Player installments', 'Short of covering the plan']);
    assert.equal(short.rows[short.rows.length - 1].planned, 200);

    const buffered = budgetPlanStatementRows({ ...STATEMENT_SOURCE, duesAssessed: 800, leftToFund: -100 });
    assert.equal(buffered.rows[buffered.rows.length - 1].item, 'Planned buffer');
    // Absolute in the file as on the screen — the label carries the direction.
    assert.equal(buffered.rows[buffered.rows.length - 1].planned, 100);

    const matched = budgetPlanStatementRows({ ...STATEMENT_SOURCE, duesAssessed: 700, leftToFund: 0 });
    assert.equal(matched.rows[matched.rows.length - 1].item, 'Player installments');
  });
});

describe('the period-grid file (By-period view)', () => {
  const LINES: PeriodViewLine[] = [
    {
      id: 'a', description: 'Entry Fees', itemId: 'item-entry', itemName: 'Entry Fees',
      categoryName: 'Tournaments', totalAmount: 1600, lineKind: 'cost',
      periods: [{ periodDate: '2027-04-01', amount: 1600 }],
    },
    {
      id: 'b', description: 'Entry Fees', itemId: 'item-entry', itemName: 'Entry Fees',
      categoryName: 'Tournaments', totalAmount: 900, lineKind: 'cost',
      periods: [{ periodDate: '2027-05-01', amount: 900 }],
    },
    {
      id: 'f', description: 'Chocolate Sale', itemId: null, itemName: null,
      categoryName: null, totalAmount: 1000, lineKind: 'funding', periods: [],
    },
  ];

  it('columns follow the screen: undated first, BvA month labels with real Excel header dates, Total', () => {
    const view = buildPeriodView(LINES, 'months');
    const cols = budgetPeriodGridColumns(view);
    assert.deepEqual(cols.map(c => c.label),
      // ⚠ "No date yet", AND IT LEADS (owner ruling 2026-09-04, QA §133). The heading is the half
      // that was losing money: nothing in the importer's aliases matched "Unscheduled", so a plan
      // exported here and read back dropped every undated amount in silence.
      ['Category / line', 'No date yet', "Apr '27", "May '27", 'Total']);
    // The BvA mechanism verbatim: `headerMonth` is what downloadMoneyExport turns into a real
    // date cell in the Excel header row.
    // ⚠ INDEXES SHIFTED BY ONE when the undated column moved to the front. Asserted by NAME as
    // well, so the next reordering fails on the thing that moved rather than on an off-by-one.
    assert.equal(cols[1].label, 'No date yet');
    assert.equal(cols[1].headerMonth, undefined, 'the undated column is not a date and must never carry one');
    assert.equal(cols[2].headerMonth, '2027-04');
    assert.equal(cols[3].headerMonth, '2027-05');
    assert.equal(cols[4].headerMonth, undefined, 'Total is not a date either');
  });

  it('quarter columns carry the year in text and never a headerMonth — a quarter is not a date', () => {
    const view = buildPeriodView(LINES, 'quarters');
    const cols = budgetPeriodGridColumns(view);
    assert.deepEqual(cols.map(c => c.label), ['Category / line', 'No date yet', "Q2 '27", 'Total']);
    assert.ok(cols.every(c => c.headerMonth === undefined));
  });

  it('rows follow the screen: merged items summed and unlabelled, money-in positive, the closing row a real subtraction', () => {
    const view = buildPeriodView(LINES, 'months');
    const { rows, kinds } = budgetPeriodGridRows(view);
    assert.deepEqual(rows.map(r => r.item), [
      'Tournaments',
      // Unlabelled, exactly as the grid on screen now renders it (owner 2026-09-04, QA §133).
      '  — Entry Fees',
      'Expected fundraising',
      '  — Chocolate Sale',
      'Costs less funding',
    ]);
    assert.deepEqual(kinds, ['category', 'item', 'category', 'item', 'total']);
    // The merged row holds both months.
    assert.equal(rows[1]['m_2027-04'], 1600);
    assert.equal(rows[1]['m_2027-05'], 900);
    assert.equal(rows[1].total, 2500);
    // Money-in reads POSITIVE, as the screen paints it — the heading says the direction…
    assert.equal(rows[3].unscheduled, 1000);
    assert.equal(rows[2].total, 1000);
    // …and the closing row keeps the signed arithmetic: costs less funding.
    assert.equal(rows[4].total, 1500);
    assert.equal(rows[4].unscheduled, -1000);
  });
});
