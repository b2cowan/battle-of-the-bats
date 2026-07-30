import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseMoneyCell, moneyValue, parseDateCell, parseMonthHeader,
  rowsFromMonthGrid, rowsFromList, rowsFromPayables,
  reviewBudgetRows, reviewPayableRows, committable,
  monthGridTemplateHeaders, templateExampleRows, templateMonths,
  LIST_TEMPLATE_HEADERS, PAYABLES_TEMPLATE_HEADERS,
  type KnownCategory, type ExistingBudgetLine,
} from '../../lib/coach-budget-import.ts';
import type { ParsedImportFile } from '../../lib/import/types.ts';

function sheet(headers: string[], rows: string[][]): ParsedImportFile {
  return {
    headers,
    rows: rows.map((cells, i) => ({
      rowNumber: i + 2,
      values: Object.fromEntries(headers.map((h, j) => [h, cells[j] ?? ''])),
    })),
  };
}

const CATEGORIES: KnownCategory[] = [
  { id: 'c1', name: 'Tournaments', items: [{ id: 'i1', name: 'Entry Fees' }, { id: 'i2', name: 'Uniforms' }] },
  { id: 'c2', name: 'Officials', items: [{ id: 'i3', name: 'Umpire Fees' }] },
];

describe('money cells', () => {
  it('reads what a spreadsheet actually produces', () => {
    assert.equal(parseMoneyCell('$1,200.00'), '1200');
    assert.equal(parseMoneyCell('1 200'), '1200');
    assert.equal(parseMoneyCell('(450)'), '-450');
    assert.equal(parseMoneyCell('  75.50 '), '75.5');
    assert.equal(parseMoneyCell(''), '');
  });

  it('hands junk back rather than inventing a number', () => {
    assert.equal(parseMoneyCell('about a grand'), 'about a grand');
    assert.equal(moneyValue('about a grand'), null);
    assert.equal(moneyValue('$1,200.00'), 1200);
    assert.equal(moneyValue(''), null);
  });
});

describe('date cells', () => {
  it('accepts ISO and refuses to guess an ambiguous date', () => {
    assert.equal(parseDateCell('2026-03-15'), '2026-03-15');
    assert.equal(parseDateCell('2026-03-15T00:00:00.000Z'), '2026-03-15');
    // 3 April or 4 March? A wrong due date chases a family — so it is not guessed.
    assert.equal(parseDateCell('03/04/2026'), '');
    assert.equal(parseDateCell('next Tuesday'), '');
  });
});

describe('month headers', () => {
  it('reads an explicit year in every shape the app itself writes', () => {
    assert.equal(parseMonthHeader('2026-09', 2026)?.month, '2026-09');
    assert.equal(parseMonthHeader('Sep 2026', 2020)?.month, '2026-09');
    assert.equal(parseMonthHeader("Mar '26", 2020)?.month, '2026-03');
    assert.equal(parseMonthHeader('September', 2026)?.month, '2026-09');
  });

  it('ignores a heading that is not a month', () => {
    assert.equal(parseMonthHeader('Total', 2026), null);
    assert.equal(parseMonthHeader('No date yet', 2026), null);
    assert.equal(parseMonthHeader('', 2026), null);
  });
});

describe('rowsFromMonthGrid', () => {
  it('turns month columns into dated periods and totals them', () => {
    const file = sheet(
      ['Category', 'Line', 'Mar 2026', 'Apr 2026', 'May 2026', 'Notes'],
      [['Tournaments', 'Entry Fees', '1,200', '', '$1,200', 'two events']],
    );
    const [row] = rowsFromMonthGrid(file, 2026);
    assert.equal(row.categoryName, 'Tournaments');
    assert.equal(row.lineName, 'Entry Fees');
    assert.deepEqual(row.periods, [
      { month: '2026-03', amount: '1200' },
      { month: '2026-05', amount: '1200' },
    ]);
    assert.equal(row.amount, '2400');
    assert.equal(row.notes, 'two events');
  });

  it('rolls the year forward when bare month names wrap round', () => {
    const file = sheet(
      ['Category', 'Line', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
      [['Facilities', 'Dome Time', '100', '', '', '', '200', '']],
    );
    const [row] = rowsFromMonthGrid(file, 2026);
    assert.deepEqual(row.periods, [
      { month: '2026-09', amount: '100' },
      { month: '2027-01', amount: '200' },
    ]);
  });

  it('re-reads the app’s OWN export: indented lines, derived columns, derived rows', () => {
    const file = sheet(
      ['Category / line', '2025', 'No date yet', "Mar '26", "Apr '26", 'Total'],
      [
        ['Tournaments', '4,150', '900', '1,200', '', '4,500'],
        ['  — Entry Fees', '3,300', '', '1,200', '', '3,600'],
        ['  — Uniforms', '850', '900', '', '', '900'],
        ['Total', '8,350', '1,450', '2,550', '600', '8,800'],
        ['Money in', '', '', '3,000', '1,500', '8,000'],
        ['Running balance', '', '', '450', '1,350', ''],
      ],
    );
    const rows = rowsFromMonthGrid(file, 2026);
    assert.deepEqual(rows.map(r => [r.categoryName, r.lineName]), [
      ['Tournaments', 'Entry Fees'],
      ['Tournaments', 'Uniforms'],
    ]);
    // The category row's own figures are derived from its lines — taken as a name, never a row.
    assert.equal(rows[0].amount, '1200');
    // The "No date yet" column survives the round trip as undated money.
    assert.equal(rows[1].amount, '900');
    assert.equal(rows[1].periods.length, 0);
  });

  it('caps a runaway sheet', () => {
    const file = sheet(['Category', 'Line', 'Amount'],
      Array.from({ length: 400 }, (_, i) => ['Tournaments', `Line ${i}`, '10']));
    assert.equal(rowsFromMonthGrid(file, 2026).length, 300);
  });
});

describe('rowsFromList', () => {
  it('reads a plain list and carries the category down the rows', () => {
    const file = sheet(['Category', 'Line', 'Amount', 'Notes'], [
      ['Tournaments', 'Entry Fees', '$3,600', ''],
      ['', 'Uniforms', '900', 'includes hats'],
      ['Officials', 'Umpire Fees', '1200', ''],
    ]);
    const rows = rowsFromList(file);
    assert.deepEqual(rows.map(r => r.categoryName), ['Tournaments', 'Tournaments', 'Officials']);
    assert.equal(rows[1].notes, 'includes hats');
    assert.equal(rows[2].amount, '1200');
  });
});

describe('rowsFromPayables', () => {
  it('stores a single amount + one due date the way the payable form already does', () => {
    const file = sheet(['Payee', 'Description', 'Category', 'Amount', 'Due Date'],
      [['City of Toronto', 'Diamond permits', 'Facilities', '$600', '2026-04-01']]);
    const [row] = rowsFromPayables(file);
    assert.equal(row.depositAmount, '600');
    assert.equal(row.depositDueDate, '2026-04-01');
    assert.equal(row.balanceAmount, '');
  });

  it('keeps an explicit deposit/balance split on its own dates', () => {
    const file = sheet(
      ['Description', 'Amount', 'Deposit', 'Deposit Due', 'Balance', 'Balance Due'],
      [['Spring classic', '1600', '800', '2026-02-01', '800', '2026-05-01']],
    );
    const [row] = rowsFromPayables(file);
    assert.equal(row.depositAmount, '800');
    assert.equal(row.depositDueDate, '2026-02-01');
    assert.equal(row.balanceAmount, '800');
    assert.equal(row.balanceDueDate, '2026-05-01');
  });
});

describe('reviewBudgetRows', () => {
  const existing: ExistingBudgetLine[] = [
    { id: 'l1', description: 'Entry Fees', categoryName: 'Tournaments', totalAmount: 3300 },
  ];

  function review(rows: Parameters<typeof reviewBudgetRows>[0]) {
    return reviewBudgetRows(rows, CATEGORIES, existing);
  }

  const row = (over: Partial<Parameters<typeof reviewBudgetRows>[0][number]>) => ({
    rowNumber: 1, categoryName: 'Tournaments', lineName: 'Uniforms',
    amount: '900', notes: '', periods: [], ...over,
  });

  it('adds a line that does not exist and updates one that does', () => {
    const [added, updated] = review([
      row({}),
      row({ rowNumber: 2, lineName: 'entry fees', amount: '3600' }),
    ]);
    assert.equal(added.outcome, 'add');
    assert.equal(updated.outcome, 'update');
    assert.equal(updated.matchedLineId, 'l1');
    assert.match(updated.reason!, /was \$3,300\.00/);
  });

  it('says so when an update changes only the dates', () => {
    const [only] = review([row({ lineName: 'Entry Fees', amount: '3300' })]);
    assert.equal(only.outcome, 'update');
    assert.match(only.reason!, /same total, new dates/);
  });

  it('blocks a row with no recognised category rather than filing it somewhere plausible', () => {
    const [r] = review([row({ categoryName: 'misc stuff we always forget' })]);
    assert.equal(r.outcome, 'blocked');
    assert.match(r.reason!, /No category called/);
  });

  it('blocks a row with no amount, and says where the amount was expected', () => {
    const noneAtAll = review([row({ amount: '' })])[0];
    assert.equal(noneAtAll.outcome, 'blocked');
    assert.match(noneAtAll.reason!, /No amount\./);

    const gridRow = review([row({ amount: '', periods: [{ month: '2026-03', amount: '0' }] })])[0];
    assert.match(gridRow.reason!, /month column/);
  });

  it('blocks a line named twice in one sheet — they would fight on commit', () => {
    const rows = review([row({}), row({ rowNumber: 2 })]);
    assert.ok(rows.every(r => r.outcome === 'blocked'));
    assert.match(rows[0].reason!, /more than once/);
  });

  it('blocks a nameless row', () => {
    assert.equal(review([row({ lineName: '' })])[0].outcome, 'blocked');
  });

  it('committable keeps everything that is not blocked', () => {
    const rows = review([row({}), row({ rowNumber: 2, lineName: '', amount: '' })]);
    assert.equal(committable(rows).length, 1);
  });
});

describe('reviewPayableRows', () => {
  const row = (over: Partial<Parameters<typeof reviewPayableRows>[0][number]>) => ({
    rowNumber: 1, payee: '', description: 'Diamond permits', categoryName: 'Facilities',
    amount: '600', depositAmount: '600', depositDueDate: '2026-04-01',
    balanceAmount: '', balanceDueDate: '', ...over,
  });
  const cats: KnownCategory[] = [...CATEGORIES, { id: 'c3', name: 'Facilities', items: [] }];

  it('always adds — a commitment has no identity to overwrite', () => {
    const [r] = reviewPayableRows([row({})], cats, []);
    assert.equal(r.outcome, 'add');
    assert.equal(r.warning, undefined);
  });

  it('flags a look-alike instead of merging it', () => {
    const [r] = reviewPayableRows([row({})], cats, ['Diamond permits']);
    assert.equal(r.outcome, 'add');
    assert.match(r.warning!, /already exists/);
  });

  it('blocks a row with no readable due date', () => {
    const [r] = reviewPayableRows([row({ depositDueDate: '', balanceDueDate: '' })], cats, []);
    assert.equal(r.outcome, 'blocked');
    assert.match(r.reason!, /due date/);
  });

  it('blocks a split that does not add up to the total', () => {
    const [r] = reviewPayableRows(
      [row({ amount: '1600', depositAmount: '800', balanceAmount: '400', balanceDueDate: '2026-05-01' })],
      cats, [],
    );
    assert.equal(r.outcome, 'blocked');
    assert.match(r.reason!, /add up/);
  });

  it('blocks an unrecognised category but allows no category at all', () => {
    assert.equal(reviewPayableRows([row({ categoryName: 'Nope' })], cats, [])[0].outcome, 'blocked');
    assert.equal(reviewPayableRows([row({ categoryName: '' })], cats, [])[0].outcome, 'add');
  });
});

describe('templates (D-G1: structure, never amounts)', () => {
  it('every template row leaves every amount cell EMPTY', () => {
    const headers = monthGridTemplateHeaders(['2026-09', '2026-10']);
    assert.deepEqual(headers, ['Category', 'Line', "Sep '26", "Oct '26", 'Notes']);

    for (const cols of [headers.length, LIST_TEMPLATE_HEADERS.length, PAYABLES_TEMPLATE_HEADERS.length]) {
      for (const row of templateExampleRows(CATEGORIES, cols)) {
        // Column 0 is the category and column 1 the line name — both are structure. EVERY other
        // cell must be blank: a dollar figure in a downloadable file is one the product proposed.
        assert.deepEqual(row.slice(2), Array(cols - 2).fill(''));
        assert.ok(row[0] && row[1]);
      }
    }
  });

  it('example rows come from the coach’s own taxonomy and stay short', () => {
    const rows = templateExampleRows(CATEGORIES, 4);
    assert.deepEqual(rows.map(r => r[1]), ['Entry Fees', 'Uniforms', 'Umpire Fees']);
  });

  it('offers a year from this month when the team has no dated money yet', () => {
    assert.deepEqual(templateMonths(['2026-03'], '2026-01'), ['2026-03']);
    const fresh = templateMonths([], '2026-11', 3);
    assert.deepEqual(fresh, ['2026-11', '2026-12', '2027-01']);
  });
});
