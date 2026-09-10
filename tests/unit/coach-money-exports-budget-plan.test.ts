/**
 * The Budget Plan's export contract (owner rider, 2026-09-02): the file is grouped the way the
 * screen is grouped, in both views, and the period file's month headers ride BvA's own pieces
 * (`formatMonthLabel` text + `headerMonth` Excel dates). These run the builders' arithmetic —
 * a green render is not evidence about a file (memory: run-the-pure-module).
 *
 * THE LADDER (owner ruling 2026-09-08, mockup e94d05d9 round 2): both files now carry the screen's
 * bands and subtotals — COSTS → Planned costs, FUNDING → Planned funding — and the close reads
 * Costs less funding → Player installments → Short/buffer. The subtotals are asserted as NUMBERS
 * here, not as labels, because a subtotal that is present but wrong is the defect the ladder
 * exists to make visible.
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

/** The screen's own totals shape, with no estimate set: Planned costs = the lines. */
function totalsOf(over: Partial<BudgetPlanExportSource['totals']>): BudgetPlanExportSource['totals'] {
  return {
    totalPlanned: 2500, fundedByPlayers: 700, fundingLineCount: 1,
    itemized: 2500, expectedFunding: 1800,
    estimatedTotal: null, difference: 0, hasDifference: false, overPlanned: false,
    ...over,
  };
}

const STATEMENT_SOURCE: BudgetPlanExportSource = {
  groups: [{
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
  }],
  lines: [
    planLine({
      id: 'f', description: 'Chocolate Sale', totalAmount: 1800, lineKind: 'funding',
      categoryId: 'cat-fundraising', categoryName: 'Fundraising',
    }),
  ],
  totals: totalsOf({}),
  duesAssessed: 0,
  leftToFund: 700,
};

describe('the statement file (List view, and every PDF)', () => {
  it('reads band for band: COSTS → category → one row per word → Planned costs; FUNDING → category → Planned funding; the estimated close', () => {
    const { rows, kinds } = budgetPlanStatementRows(STATEMENT_SOURCE);
    assert.deepEqual(rows.map(r => r.item), [
      // ⚠ UPPERCASE in the file — the statement export's own band convention (REVENUE / EXPENSES),
      // and the only heading signal a PDF has, since that path never reads row kinds.
      'COSTS',
      'Tournaments',
      /* ⚠⚠ NOTHING BENEATH THE WORD (owner ruling 2026-09-09, migration 286). This printed the word
         and then an indented row per line under it; a word carries ONE line now, so the word's row
         IS that line — its schedule, its amount, its note. The nesting is what kept breaking the
         round trip: a spreadsheet can hide an indented row and the importer reads it back as a line
         the coach never wrote. */
      'Entry Fees',
      'Planned costs',
      'FUNDING',
      // The CATEGORY the line was filed in (owner ruling 2026-09-09) — never its stored kind. Bare
      // noun: the band above it already says Funding.
      'Fundraising',
      '  — Chocolate Sale',
      'Planned funding',
      'Player installments (estimated)',
    ]);
    assert.deepEqual(kinds, [
      'section', 'category', 'item', 'total',
      'section', 'category', 'item', 'total',
      'total',
    ]);
    // A band heading carries no figure at all.
    assert.equal(rows[0].planned, '');
    assert.equal(rows[4].planned, '');
    // The word's row carries its own money, its own note and its own answer to "when does this
    // money move?" — WHEN, not a chunk count (owner ruling 2026-09-04).
    assert.equal(rows[2].planned, 2500);
    assert.equal(rows[2].schedule, 'Apr · May');
    assert.equal(rows[2].notes, 'Spring classic');
    // The two subtotals wear the tiles' names and the tiles' figures.
    assert.equal(rows[3].planned, 2500);
    assert.equal(rows[7].planned, 1800);
    // The closing row is the screen's: players' side of a funded plan, saying where it came from.
    assert.equal(rows[8].planned, 700);
    assert.equal(rows[8].notes, 'Costs less funding, until dues are set');
  });

  it('a single-line item is one row, named by the item, with its schedule and note — and with no money in, Planned costs closes on the estimate row', () => {
    const src: BudgetPlanExportSource = {
      ...STATEMENT_SOURCE,
      groups: [{
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
      }],
      lines: [],
      totals: totalsOf({ totalPlanned: 5200, fundedByPlayers: 5200, fundingLineCount: 0, itemized: 5200, expectedFunding: 0 }),
    };
    const { rows, kinds } = budgetPlanStatementRows(src);
    // No Funding band, no Planned funding, no Costs less funding: nothing to subtract. The old
    // "Total planned budget" close is retired — Planned costs already says it one row up.
    assert.deepEqual(rows.map(r => r.item), ['COSTS', 'Facilities', 'Dome Time', 'Planned costs', 'Player installments (estimated)']);
    assert.deepEqual(kinds, ['section', 'category', 'item', 'total', 'total']);
    // ⚠ THE MONTHS THEMSELVES, not "Jan–Mar · 3 chunks". A count is not an answer to "when",
    // and the old label could not say that a partly-dated line had money with no date at all.
    assert.equal(rows[2].schedule, 'Jan · Feb · Mar');
    assert.equal(rows[2].notes, '16 sessions, Jan–Mar');
    assert.equal(rows[3].planned, 5200);
    assert.equal(rows[4].notes, 'Planned costs, until dues are set');
  });

  it('with dues scheduled, closes as the ladder — Costs less funding, Player installments, the residual — or on installments alone when they match', () => {
    const short = budgetPlanStatementRows({ ...STATEMENT_SOURCE, duesAssessed: 500, leftToFund: 200 });
    const shortTail = short.rows.slice(-4);
    assert.deepEqual(shortTail.map(r => r.item), ['Planned funding', 'Costs less funding', 'Player installments', 'Short of covering the plan']);
    // Costs less funding is the two subtotals' difference FLOORED AT ZERO — the same figure the tile
    // prints as the Estimated installments — so an over-funded plan reads $0.00 in the file exactly
    // as it does on screen, never a signed figure the screen's absolute formatter would hide.
    assert.equal(shortTail[1].planned, 700);
    const overFunded = budgetPlanStatementRows({
      ...STATEMENT_SOURCE,
      totals: totalsOf({ totalPlanned: 1500, fundedByPlayers: 0, itemized: 1500 }),
      duesAssessed: 500, leftToFund: -800,
    });
    assert.equal(overFunded.rows.find(r => r.item === 'Costs less funding')?.planned, 0);
    assert.equal(shortTail[1].notes, 'What player installments need to cover');
    assert.equal(shortTail[2].planned, 500);
    assert.equal(shortTail[3].planned, 200);
    assert.deepEqual(short.kinds.slice(-4), ['total', 'total', 'total', 'total']);

    const buffered = budgetPlanStatementRows({ ...STATEMENT_SOURCE, duesAssessed: 800, leftToFund: -100 });
    assert.equal(buffered.rows[buffered.rows.length - 1].item, 'Planned buffer');
    // Absolute in the file as on the screen — the label carries the direction.
    assert.equal(buffered.rows[buffered.rows.length - 1].planned, 100);

    const matched = budgetPlanStatementRows({ ...STATEMENT_SOURCE, duesAssessed: 700, leftToFund: 0 });
    assert.equal(matched.rows[matched.rows.length - 1].item, 'Player installments');
  });

  it('a season estimate that differs from the lines gets its gap as rows under the costs, and Planned costs stays the estimate', () => {
    const under = budgetPlanStatementRows({
      ...STATEMENT_SOURCE,
      totals: totalsOf({ totalPlanned: 3000, fundedByPlayers: 1200, estimatedTotal: 3000, difference: 500, hasDifference: true }),
    });
    const costsEnd = under.rows.findIndex(r => r.item === 'Planned costs');
    assert.deepEqual(under.rows.slice(costsEnd - 2, costsEnd + 1).map(r => r.item), ['Lines so far', 'Still to itemize', 'Planned costs']);
    assert.equal(under.rows[costsEnd - 2].planned, 2500);
    assert.equal(under.rows[costsEnd - 1].planned, 500);
    assert.equal(under.rows[costsEnd - 1].notes, 'Your estimate is $3,000.00');
    assert.equal(under.rows[costsEnd].planned, 3000);
    // ⚠ `plain`, NOT `item`: an item row is written one outline level down and hidden behind the
    // row above it, so these vanished into the last category's collapsed group — and their indent
    // made them phantom budget lines on re-import (/review, 2026-09-08).
    assert.deepEqual(under.kinds.slice(costsEnd - 2, costsEnd + 1), ['plain', 'plain', 'total']);

    // Lines past the estimate: the one state the screen draws in red. The gap is stated absolute —
    // the label carries the direction, as everywhere else in these files.
    const over = budgetPlanStatementRows({
      ...STATEMENT_SOURCE,
      totals: totalsOf({ totalPlanned: 2000, fundedByPlayers: 200, estimatedTotal: 2000, difference: -500, hasDifference: true, overPlanned: true }),
    });
    const overEnd = over.rows.findIndex(r => r.item === 'Planned costs');
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

  const oneWord = (): BudgetPlanExportSource => ({
    groups: [{
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
    lines: [],
    totals: totalsOf({ totalPlanned: 2500, itemized: 2500, expectedFunding: 0, fundingLineCount: 0 }),
    duesAssessed: 0,
    leftToFund: 2500,
  } as never);

  it('prints no row beneath a word — the word IS the line', () => {
    const { rows } = budgetPlanStatementRows(oneWord());
    const nested = rows.map(r => String(r.item)).filter(i => i.startsWith('    '));
    assert.deepEqual(nested, [], 'a nested row is one the spreadsheet can hide and the importer can invent');
    const word = rows.find(r => r.item === 'Entry Fees');
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
    const bucket = rows.find(r => r.item === 'Not itemized');
    assert.equal(bucket?.planned, 2500, 'the bucket carries its own sum, never one line’s figure');
    assert.equal(bucket?.schedule, '', 'no single line speaks for the bucket, so it claims no schedule');
  });

  it('money in reads the same way — one row per word, named by the word', () => {
    const src: BudgetPlanExportSource = {
      groups: [],
      lines: [
        planLine({
          id: 'f1', description: 'Chocolate sale', totalAmount: 2400, lineKind: 'funding',
          itemId: 'item-drive', itemName: 'Fundraising drive',
          categoryId: 'cat-fundraising', categoryName: 'Fundraising',
          notes: 'Expected team share',
          periods: [{ periodDate: '2026-03-01', amount: 1200 }, { periodDate: '2026-04-01', amount: 1200 }],
        }),
      ],
      totals: totalsOf({ expectedFunding: 2400, totalPlanned: 0, itemized: 0 }),
      duesAssessed: 0,
      leftToFund: 0,
    } as never;
    const { rows } = budgetPlanStatementRows(src);
    assert.deepEqual(rows.map(r => r.item), [
      'FUNDING',
      // The CATEGORY the line was filed in (owner ruling 2026-09-09) — never its stored kind.
      'Fundraising',
      '  — Fundraising drive',
      'Planned funding',
      // The builder always closes on the players' side; asserted so the shape above is the WHOLE
      // file rather than a prefix of it.
      'Player installments (estimated)',
    ]);
    const word = rows.find(r => r.item === '  — Fundraising drive');
    assert.equal(word?.planned, 2400);
    assert.equal(word?.schedule, 'Mar · Apr');
    assert.equal(word?.notes, 'Expected team share');
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

  it('rows follow the screen: two bands, merged items summed and unlabelled, money-in positive, two subtotals and a closing subtraction', () => {
    const view = buildPeriodView(LINES, 'months');
    const { rows, kinds } = budgetPeriodGridRows(view);
    assert.deepEqual(rows.map(r => r.item), [
      'COSTS',
      'Tournaments',
      // Unlabelled, exactly as the grid on screen now renders it (owner 2026-09-04, QA §133).
      '  — Entry Fees',
      'Planned costs',
      'FUNDING',
      'Fundraising',
      '  — Chocolate Sale',
      'Planned funding',
      'Costs less funding',
    ]);
    assert.deepEqual(kinds, ['section', 'category', 'item', 'total', 'section', 'category', 'item', 'total', 'total']);
    // A band carries no figures — every cell blank, Total included.
    assert.equal(rows[0]['m_2027-04'], '');
    assert.equal(rows[0].total, '');
    // The merged row holds both months.
    assert.equal(rows[2]['m_2027-04'], 1600);
    assert.equal(rows[2]['m_2027-05'], 900);
    assert.equal(rows[2].total, 2500);
    // Planned costs is the cost band's subtotal, column by column.
    assert.equal(rows[3]['m_2027-04'], 1600);
    assert.equal(rows[3]['m_2027-05'], 900);
    assert.equal(rows[3].total, 2500);
    // Money-in reads POSITIVE, as the screen paints it — the heading says the direction…
    assert.equal(rows[6].unscheduled, 1000);
    assert.equal(rows[5].total, 1000);
    // …and so does its subtotal…
    assert.equal(rows[7].unscheduled, 1000);
    assert.equal(rows[7].total, 1000);
    // …while the closing row keeps the signed arithmetic: costs less funding.
    assert.equal(rows[8].total, 1500);
    assert.equal(rows[8].unscheduled, -1000);
  });

  it('with no money in, Planned costs IS the close — no Funding band, no subtraction row', () => {
    const view = buildPeriodView(LINES.filter(l => l.lineKind === 'cost'), 'months');
    const { rows, kinds } = budgetPeriodGridRows(view);
    assert.deepEqual(rows.map(r => r.item), ['COSTS', 'Tournaments', '  — Entry Fees', 'Planned costs']);
    assert.deepEqual(kinds, ['section', 'category', 'item', 'total']);
    assert.equal(rows[3].total, 2500);
  });

  it('with a season estimate that differs from the lines, the cost subtotal reads "Lines so far" — one name, one number', () => {
    // The grid spreads LINES; an estimate has no dates. The List calls this same figure "Lines so
    // far" and reserves "Planned costs" for the estimate, so the grid may not borrow that name here
    // (the rule its closing row has carried since 2026-08-13; /review 2026-09-08).
    const view = buildPeriodView(LINES, 'months', { estimatedTotal: 4000 });
    assert.equal(view.estimateDiffers, true);
    const { rows } = budgetPeriodGridRows(view);
    assert.equal(rows[3].item, 'Lines so far');
    assert.equal(rows[3].total, 2500);
    // An estimate equal to the lines is not a difference — the ordinary name comes back.
    const same = buildPeriodView(LINES, 'months', { estimatedTotal: 2500 });
    assert.equal(same.estimateDiffers, false);
    assert.equal(budgetPeriodGridRows(same).rows[3].item, 'Planned costs');
  });
});
