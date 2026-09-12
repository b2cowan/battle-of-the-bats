/**
 * The Budget Plan's export contract (owner rider, 2026-09-02): the file is grouped the way the
 * screen is grouped, in both views, and the period file's month headers ride BvA's own pieces
 * (`formatMonthLabel` text + `headerMonth` Excel dates). These run the builders' arithmetic —
 * a green render is not evidence about a file (memory: run-the-pure-module).
 *
 * REVENUE FIRST, BALANCES CARRIED FORWARD (owner decisions A–D, 2026-09-12, replacing the ladder
 * of 2026-09-08): both files carry the screen's bands and subtotals — REVENUE → Total revenue,
 * EXPENSES → Total expenses — and close on Opening balance → Net → Closing balance. The figures
 * are the VIEW's (one calculation, two renderers): every source here is built by
 * `buildPeriodView` over the same lines the rows print, never hand-typed, so a test can only pass
 * when the producer and the calculation agree. The subtotals are asserted as NUMBERS, not as
 * labels, because a subtotal that is present but wrong is the defect the close exists to make
 * visible.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  budgetPlanStatementRows, budgetPeriodGridColumns, budgetPeriodGridRows,
  type BudgetPlanExportSource,
} from '../../lib/coach-money-exports.ts';
import { buildPeriodView, type PeriodViewLine } from '../../lib/coach-budget-periods-view.ts';

type StatementLine = BudgetPlanExportSource['lines'][number];

function planLine(over: Partial<PeriodViewLine> & {
  id: string; description: string; totalAmount: number;
  notes?: string | null; lineKind?: string;
}): StatementLine {
  // The statement builder takes the panel's richer line shape; this stub carries what it reads.
  return {
    itemId: `item-${over.description}`, itemName: over.description, categoryName: 'Tournaments',
    lineKind: 'cost', notes: null, periods: [], ...over,
  } as never;
}

/** The screen's own cost line — the one Entry Fees word, dated April and May. */
const ENTRY_FEES = planLine({
  id: 'a', description: 'Entry Fees', totalAmount: 2500, notes: 'Spring classic',
  periods: [{ periodDate: '2027-04-01', amount: 1500 }, { periodDate: '2027-05-01', amount: 1000 }],
});
const CHOCOLATE = planLine({
  id: 'f', description: 'Chocolate Sale', totalAmount: 1800, lineKind: 'funding',
  categoryId: 'cat-fundraising', categoryName: 'Fundraising',
});

const STATEMENT_GROUPS: BudgetPlanExportSource['groups'] = [{
  categoryName: 'Tournaments',
  total: 2500,
  items: [
    {
      itemId: 'item-entry',
      itemName: 'Entry Fees',
      total: 2500,
      lines: [
        {
          description: 'Entry Fees', notes: 'Spring classic', totalAmount: 2500,
          periods: [{ periodDate: '2027-04-01' }, { periodDate: '2027-05-01' }],
        },
      ],
    },
  ],
}];

/** A statement source whose figures come from the calculation, over the lines the rows print. */
function source(
  lines: StatementLine[],
  opts: Parameters<typeof buildPeriodView>[2] = {},
  groups: BudgetPlanExportSource['groups'] = STATEMENT_GROUPS,
  extra: Partial<BudgetPlanExportSource> = {},
): BudgetPlanExportSource {
  return {
    groups,
    lines,
    view: buildPeriodView(lines as unknown as PeriodViewLine[], 'months', opts),
    ...extra,
  };
}

const STATEMENT_SOURCE = source([ENTRY_FEES, CHOCOLATE], { openingBalance: 250 });

describe('the statement file (List view, and every PDF)', () => {
  it('reads band for band: REVENUE → category → one row per word → Total revenue; EXPENSES → category → word → Total expenses; the balance', () => {
    const { rows, kinds } = budgetPlanStatementRows(STATEMENT_SOURCE);
    assert.deepEqual(rows.map(r => r.item), [
      // ⚠ UPPERCASE in the file — the statement export's own band convention (REVENUE / EXPENSES),
      // and the only heading signal a PDF has, since that path never reads row kinds.
      // Revenue FIRST (owner decision, 2026-09-12) — what comes in, then what goes out.
      'REVENUE',
      // The CATEGORY the line was filed in (owner ruling 2026-09-09) — never its stored kind. Bare
      // noun: the band above it already says Revenue.
      'Fundraising',
      '  — Chocolate Sale',
      'Total revenue',
      'EXPENSES',
      'Tournaments',
      /* ⚠⚠ NOTHING BENEATH THE WORD (owner ruling 2026-09-09, migration 286). A word carries ONE
         line, so the word's row IS that line — its schedule, its amount, its note. The nesting is
         what kept breaking the round trip: a spreadsheet can hide an indented row and the importer
         reads it back as a line the coach never wrote.
         ⚠ THE LINE MARKER (2026-09-10). A cost word's row printed FLUSH once, and the re-importer
         read every cost line as a category name and dropped it. Excel strips the dash and indents. */
      '  — Entry Fees',
      'Total expenses',
      'Opening balance',
      'Season net',
      'Closing balance',
    ]);
    assert.deepEqual(kinds, [
      'section', 'category', 'item', 'total',
      'section', 'category', 'item', 'total',
      'total', 'total', 'total',
    ]);
    // A band heading carries no figure at all.
    assert.equal(rows[0].planned, '');
    assert.equal(rows[4].planned, '');
    // The word's row carries its own money, its own note and its own answer to "when does this
    // money move?" — WHEN, not a chunk count (owner ruling 2026-09-04).
    assert.equal(rows[6].planned, 2500);
    assert.equal(rows[6].schedule, 'Apr · May');
    assert.equal(rows[6].notes, 'Spring classic');
    // The two subtotals wear the tiles' names and the tiles' figures.
    assert.equal(rows[3].planned, 1800);
    assert.equal(rows[7].planned, 2500);
    // The close is the screen's balance: opening 250, net 1,800 − 2,500, closing 250 − 700.
    assert.equal(rows[8].planned, 250);
    assert.equal(rows[9].planned, -700);
    assert.equal(rows[10].planned, -450);
    // Undated money is in the season figures and in no month — the closing row says so.
    assert.equal(rows[10].notes, 'Includes the No date yet amounts');
  });

  it('a single-line item is one row, named by the item, with its schedule and note — and with no money in, the Revenue band still prints, at $0', () => {
    const dome = planLine({
      id: 'd', description: 'Dome Time', totalAmount: 5200, notes: '16 sessions, Jan–Mar',
      categoryName: 'Facilities',
      periods: [
        { periodDate: '2027-01-01', amount: 2000 }, { periodDate: '2027-02-01', amount: 2000 }, { periodDate: '2027-03-01', amount: 1200 },
      ],
    });
    const src = source([dome], {}, [{
      categoryName: 'Facilities',
      total: 5200,
      items: [{
        itemId: 'item-dome',
        itemName: 'Dome Time',
        total: 5200,
        lines: [{
          description: 'Dome Time', notes: '16 sessions, Jan–Mar', totalAmount: 5200,
          periods: [{ periodDate: '2027-01-01' }, { periodDate: '2027-02-01' }, { periodDate: '2027-03-01' }],
        }],
      }],
    }]);
    const { rows, kinds } = budgetPlanStatementRows(src);
    assert.deepEqual(rows.map(r => r.item), [
      'REVENUE', 'Total revenue',
      'EXPENSES', 'Facilities', '  — Dome Time', 'Total expenses',
      'Opening balance', 'Season net', 'Closing balance',
    ]);
    assert.deepEqual(kinds, ['section', 'total', 'section', 'category', 'item', 'total', 'total', 'total', 'total']);
    assert.equal(rows[1].planned, 0);
    // ⚠ THE MONTHS THEMSELVES, not "Jan–Mar · 3 chunks". A count is not an answer to "when".
    assert.equal(rows[4].schedule, 'Jan · Feb · Mar');
    assert.equal(rows[4].notes, '16 sessions, Jan–Mar');
    assert.equal(rows[5].planned, 5200);
    // NULL ≠ ZERO: an opening never set is blank with a note, never printed as $0.00.
    assert.equal(rows[6].planned, '');
    assert.equal(rows[6].notes, 'No opening balance is set — the balance assumes $0');
    assert.equal(rows[7].planned, -5200);
    assert.equal(rows[8].planned, -5200);
    assert.equal(rows[8].notes, '', 'nothing undated, nothing to caveat');
  });

  it('with dues scheduled, Player installments leads the Revenue band as the plan\'s own net figure, with the write-off clause', () => {
    const src = source([ENTRY_FEES, CHOCOLATE], {
      openingBalance: 250,
      dues: { assessed: 500, installments: [{ date: '2027-04-15', amount: 500 }] },
    }, STATEMENT_GROUPS, { writtenOffClause: 'after $50.00 of adjustments' });
    const { rows, kinds } = budgetPlanStatementRows(src);
    assert.deepEqual(rows.slice(0, 5).map(r => r.item), ['REVENUE', 'Player installments', 'Fundraising', '  — Chocolate Sale', 'Total revenue']);
    assert.equal(rows[1].planned, 500);
    assert.equal(rows[1].notes, 'What players are scheduled to pay, after $50.00 of adjustments');
    assert.equal(kinds[1], 'category');
    assert.equal(rows[4].planned, 2300);
    // And the season net moves with it: 2,300 − 2,500.
    assert.equal(rows.find(r => r.item === 'Season net')?.planned, -200);
    assert.equal(rows.find(r => r.item === 'Closing balance')?.planned, 50);
    // Without a write-off the clause is the plain sentence.
    const plain = budgetPlanStatementRows(source([ENTRY_FEES, CHOCOLATE], {
      dues: { assessed: 500, installments: [] },
    }));
    assert.equal(plain.rows[1].notes, 'What players are scheduled to pay');
    // ⚠ The old ladder is gone from the file with the rows it printed.
    for (const gone of ['Costs less funding', 'Shortfall (Buffer)', 'Short of covering the plan', 'Planned buffer', 'Player installments (estimated)']) {
      assert.equal(plain.rows.some(r => r.item === gone), false, `${gone} must not print any more`);
    }
  });

  it('a season estimate that differs from the lines gets its gap as rows under the costs, and Total expenses stays the estimate', () => {
    const under = budgetPlanStatementRows(source([ENTRY_FEES, CHOCOLATE], { estimatedTotal: 3000 }));
    const costsEnd = under.rows.findIndex(r => r.item === 'Total expenses');
    assert.deepEqual(under.rows.slice(costsEnd - 2, costsEnd + 1).map(r => r.item), ['Lines so far', 'Still to itemize', 'Total expenses']);
    assert.equal(under.rows[costsEnd - 2].planned, 2500);
    assert.equal(under.rows[costsEnd - 1].planned, 500);
    assert.equal(under.rows[costsEnd - 1].notes, 'Your estimate is $3,000.00');
    assert.equal(under.rows[costsEnd].planned, 3000);
    // ⚠ `plain`, NOT `item`: an item row is written one outline level down and hidden behind the
    // row above it, so these vanished into the last category's collapsed group — and their indent
    // made them phantom budget lines on re-import (/review, 2026-09-08).
    assert.deepEqual(under.kinds.slice(costsEnd - 2, costsEnd + 1), ['plain', 'plain', 'total']);
    // The remainder reaches the season net: 1,800 − 3,000.
    assert.equal(under.rows.find(r => r.item === 'Season net')?.planned, -1200);

    // Lines past the estimate (decision A: the estimate still governs): the one state the screen
    // draws in red. The gap is stated absolute — the label carries the direction.
    const over = budgetPlanStatementRows(source([ENTRY_FEES, CHOCOLATE], { estimatedTotal: 2000 }));
    const overEnd = over.rows.findIndex(r => r.item === 'Total expenses');
    assert.equal(over.rows[overEnd - 1].item, 'Over your estimate');
    assert.equal(over.rows[overEnd - 1].planned, 500);
    assert.equal(over.rows[overEnd].planned, 2000);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════════════════
   ONE WORD, ONE LINE — AND NOTHING BENEATH IT (owner ruling 2026-09-09, migration 286)
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('the statement file — a word is one row, on both sides of the plan', () => {
  /* ⚠⚠ WHAT THESE TESTS REPLACED IS THE ARGUMENT FOR THE CHANGE, so it is written down rather than
     deleted. Until this ruling a word could carry several lines, and the file printed them as
     INDENTED SUB-ROWS. Naming those rows was a defect factory in its own right:

       · named by their WORD, two note-less lines exported as two identical rows;
       · named by their SCHEDULE (the screen's own rule, for four days), they became importable rows
         called "May" and "No date yet" — and because the importer MINTS a team budget word from any
         name the library does not know, re-importing a plan a coach had just exported created
         budget words literally called "May", on the expense side, permanently, in their picker;
       · and the indent itself is invisible to the importer's parser, which accepts any leading
         whitespace, so a merged word exported as THREE rows it would happily read back as three
         lines.

     None of that can happen to a file with no rows beneath an item, which is what these pin. The
     rule that survives all of it: **never print a name into this file that the library could not
     match back.** */

  const oneWord = (): BudgetPlanExportSource => source(
    [planLine({ id: 'a', description: 'Entry Fees', totalAmount: 2500, notes: 'Spring classic', periods: [{ periodDate: '2026-05-01', amount: 2500 }] })],
    {},
    [{
      categoryName: 'Tournaments',
      total: 2500,
      items: [{
        itemId: 'item-entry',
        itemName: 'Entry Fees',
        total: 2500,
        lines: [{
          description: 'Entry Fees', notes: 'Spring classic', totalAmount: 2500,
          periods: [{ periodDate: '2026-05-01' }],
        }],
      }],
    }],
  );

  it('prints no row beneath a word — the word IS the line', () => {
    const { rows } = budgetPlanStatementRows(oneWord());
    const nested = rows.map(r => String(r.item)).filter(i => i.startsWith('    '));
    assert.deepEqual(nested, [], 'a nested row is one the spreadsheet can hide and the importer can invent');
    const word = rows.find(r => r.item === '  — Entry Fees');
    assert.equal(word?.planned, 2500);
    assert.equal(word?.schedule, 'May', 'the file drops nothing — the schedule stays in its own column');
    assert.equal(word?.notes, 'Spring classic');
  });

  it('keeps the word-LESS bucket summing, because those lines have no word to be joined on', () => {
    /* The one item row that can still hold several lines: pre-mig-243 rows with no word at all. Its
       sum is the answer and its When column stays empty, exactly as the screen's bucket row does. */
    const src = oneWord();
    src.groups[0].items = [{
      itemId: null,
      itemName: 'Not itemized',
      total: 2500,
      lines: [
        { description: 'Old line A', notes: null, totalAmount: 1600, periods: [] },
        { description: 'Old line B', notes: null, totalAmount: 900, periods: [{ periodDate: '2026-05-01' }] },
      ],
    }];
    const { rows } = budgetPlanStatementRows(src);
    const bucket = rows.find(r => r.item === '  — Not itemized');
    assert.equal(bucket?.planned, 2500, 'the bucket carries its own sum, never one line’s figure');
    assert.equal(bucket?.schedule, '', 'no single line speaks for the bucket, so it claims no schedule');
  });

  it('money in reads the same way — one row per word, named by the word', () => {
    const drive = planLine({
      id: 'f1', description: 'Chocolate sale', totalAmount: 2400, lineKind: 'funding',
      itemId: 'item-drive', itemName: 'Fundraising drive',
      categoryId: 'cat-fundraising', categoryName: 'Fundraising',
      notes: 'Expected team share',
      periods: [{ periodDate: '2026-03-01', amount: 1200 }, { periodDate: '2026-04-01', amount: 1200 }],
    });
    const { rows } = budgetPlanStatementRows(source([drive], {}, []));
    assert.deepEqual(rows.map(r => r.item), [
      'REVENUE',
      // The CATEGORY the line was filed in (owner ruling 2026-09-09) — never its stored kind.
      'Fundraising',
      '  — Fundraising drive',
      'Total revenue',
      // The Expenses band prints even with nothing in it, and the balance always closes; asserted
      // so the shape above is the WHOLE file rather than a prefix of it.
      'EXPENSES',
      'Total expenses',
      'Opening balance', 'Season net', 'Closing balance',
    ]);
    const word = rows.find(r => r.item === '  — Fundraising drive');
    assert.equal(word?.planned, 2400);
    assert.equal(word?.schedule, 'Mar · Apr');
    assert.equal(word?.notes, 'Expected team share');
    assert.equal(rows.find(r => r.item === 'Closing balance')?.planned, 2400);
  });

  it('never prints two rows a coach cannot tell apart — the twin defect, pinned', () => {
    const { rows } = budgetPlanStatementRows(STATEMENT_SOURCE);
    const leaves = rows.map(r => String(r.item)).filter(i => i.trimStart().startsWith('—'));
    assert.equal(new Set(leaves).size, leaves.length, 'every row label under a category must be distinct');
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
      categoryId: 'cat-fundraising', categoryName: 'Fundraising', totalAmount: 1000, lineKind: 'funding', periods: [],
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

  it('rows follow the screen: Revenue then Expenses, merged items summed and unlabelled, money-in positive, two subtotals, three balance rows', () => {
    const view = buildPeriodView(LINES, 'months', { openingBalance: 100 });
    const { rows, kinds } = budgetPeriodGridRows(view);
    assert.deepEqual(rows.map(r => r.item), [
      'REVENUE',
      'Fundraising',
      '  — Chocolate Sale',
      'Total revenue',
      'EXPENSES',
      'Tournaments',
      // Unlabelled, exactly as the grid on screen now renders it (owner 2026-09-04, QA §133).
      '  — Entry Fees',
      'Total expenses',
      'Opening balance',
      'Net for the month',
      'Closing balance',
    ]);
    assert.deepEqual(kinds, ['section', 'category', 'item', 'total', 'section', 'category', 'item', 'total', 'total', 'total', 'total']);
    // A band carries no figures — every cell blank, Total included.
    assert.equal(rows[0]['m_2027-04'], '');
    assert.equal(rows[0].total, '');
    // Money-in reads POSITIVE, as the screen paints it — the heading says the direction…
    assert.equal(rows[2].unscheduled, 1000);
    assert.equal(rows[1].total, 1000);
    // …and so does its subtotal.
    assert.equal(rows[3].unscheduled, 1000);
    assert.equal(rows[3].total, 1000);
    // The merged row holds both months.
    assert.equal(rows[6]['m_2027-04'], 1600);
    assert.equal(rows[6]['m_2027-05'], 900);
    assert.equal(rows[6].total, 2500);
    // Total expenses is the band's subtotal, column by column.
    assert.equal(rows[7]['m_2027-04'], 1600);
    assert.equal(rows[7]['m_2027-05'], 900);
    assert.equal(rows[7].total, 2500);
    // The balance: a moment has no undated cell on Opening/Closing; Net carries the undated net;
    // Total is the SEASON's opening / net / closing.
    assert.equal(rows[8].unscheduled, '');
    assert.equal(rows[8]['m_2027-04'], 100);
    assert.equal(rows[8]['m_2027-05'], -1500);
    assert.equal(rows[8].total, 100);
    assert.equal(rows[9].unscheduled, 1000);
    assert.equal(rows[9]['m_2027-04'], -1600);
    assert.equal(rows[9].total, -1500);
    assert.equal(rows[10].unscheduled, '');
    assert.equal(rows[10]['m_2027-05'], -2400);
    assert.equal(rows[10].total, -1400);
  });

  it('with no money in, the Revenue band still prints (empty, $0) and the balance still closes', () => {
    const view = buildPeriodView(LINES.filter(l => l.lineKind === 'cost'), 'months');
    const { rows, kinds } = budgetPeriodGridRows(view);
    assert.deepEqual(rows.map(r => r.item), [
      'REVENUE', 'Total revenue', 'EXPENSES', 'Tournaments', '  — Entry Fees', 'Total expenses',
      'Opening balance', 'Net for the month', 'Closing balance',
    ]);
    assert.deepEqual(kinds, ['section', 'total', 'section', 'category', 'item', 'total', 'total', 'total', 'total']);
    assert.equal(rows[1].total, 0);
    assert.equal(rows[5].total, 2500);
    // NULL ≠ ZERO: the opening never set is blank in the Total, and the months walk from 0.
    assert.equal(rows[6].total, '');
    assert.equal(rows[8].total, -2500);
  });

  it('a season estimate that differs gets its remainder as rows in the file, and Total expenses keeps its name', () => {
    const view = buildPeriodView(LINES, 'months', { estimatedTotal: 4000 });
    assert.notEqual(view.estimateRows, null);
    const { rows } = budgetPeriodGridRows(view);
    assert.deepEqual(rows.slice(7, 10).map(r => r.item),
      ['  — Lines so far', '  — Still to itemize', 'Total expenses']);
    assert.equal(rows[7].total, 2500);
    assert.equal(rows[8].total, 1500);
    assert.equal(rows[8].unscheduled, 1500);
    assert.equal(rows[9].total, 4000);
    // Lines ABOVE the estimate is the other branch: the remainder goes negative, wears the List's
    // other name, and is SIGNED in the file — a negative, line-less No date yet cell (plan §4).
    const over = budgetPeriodGridRows(buildPeriodView(LINES, 'months', { estimatedTotal: 2000 }));
    assert.equal(over.rows[8].item, '  — Over your estimate');
    assert.equal(over.rows[8].total, -500);
    assert.equal(over.rows[8].unscheduled, -500);
    assert.equal(over.rows[9].total, 2000);
    // An estimate equal to the lines is not a difference — no extra rows at all.
    const same = buildPeriodView(LINES, 'months', { estimatedTotal: 2500 });
    assert.equal(same.estimateRows, null);
    assert.equal(budgetPeriodGridRows(same).rows[7].item, 'Total expenses');
  });

  it('Player installments leads the Revenue band once scheduled, SIGNED, and the quarter file names its Net row', () => {
    const view = buildPeriodView(LINES, 'months', {
      dues: { assessed: 900, installments: [{ date: '2027-04-15', amount: 1200 }] },
    });
    const { rows, kinds } = budgetPeriodGridRows(view);
    assert.deepEqual(rows.slice(0, 3).map(r => r.item), ['REVENUE', 'Player installments', 'Fundraising']);
    assert.equal(kinds[1], 'category');
    // ⚠ SIGNED, not abs()'d (§164 finding #2): the schedule was lowered after its instalments
    // existed, so the undated cell is the −300 overshoot and the row still totals the plan's 900.
    assert.equal(rows[1]['m_2027-04'], 1200);
    assert.equal(rows[1].unscheduled, -300);
    assert.equal(rows[1].total, 900);
    // Total revenue: 1,200 in April, 1,000 − 300 undated.
    const totalRevenue = rows.find(r => r.item === 'Total revenue')!;
    assert.equal(totalRevenue['m_2027-04'], 1200);
    assert.equal(totalRevenue.unscheduled, 700);
    assert.equal(totalRevenue.total, 1900);

    const quarters = budgetPeriodGridRows(buildPeriodView(LINES, 'quarters', { openingBalance: 50 }));
    assert.deepEqual(quarters.rows.slice(-3).map(r => r.item), ['Opening balance', 'Net for the quarter', 'Closing balance']);
    assert.equal(quarters.rows[quarters.rows.length - 3]['q_2027-Q2'], 50);
    assert.equal(quarters.rows[quarters.rows.length - 1]['q_2027-Q2'], 50 - 2500);
    assert.equal(quarters.rows[quarters.rows.length - 1].total, 50 - 2500 + 1000);

    // No dues schedule, no installments row: before dues are set the helper under the table
    // carries the required figure, and it never reaches a file.
    const none = budgetPeriodGridRows(buildPeriodView(LINES, 'months'));
    assert.equal(none.rows.some(r => r.item === 'Player installments'), false);
    assert.equal(none.rows.some(r => r.item === 'Required player dues'), false);
  });

  it('⚠ a trial never reaches a file — the caller builds the file from the saved plan, and the producer never prints view.trial', () => {
    const view = buildPeriodView(LINES, 'months', { trial: { amount: 400, date: '2027-04-01' } });
    assert.notEqual(view.trial, null, 'the view carries the trial');
    const { rows } = budgetPeriodGridRows(view);
    assert.equal(rows.some(r => r.item === 'Extra expense'), false);
  });
});
