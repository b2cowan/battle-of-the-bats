import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseMoneyCell, moneyValue, parseDateCell, parseMonthHeader,
  rowsFromMonthGrid, rowsFromList, rowsFromPayables,
  reviewBudgetRows, reviewPayableRows, committable,
  monthGridTemplateHeaders, templateExampleRows, templateMonths,
  LIST_TEMPLATE_HEADERS, PAYABLES_TEMPLATE_HEADERS,
  normalizeWord, snapBudgetRowsToLibrary, snapPayableRowsToLibrary,
  referenceSheetRows, templateChoiceLists, toKnownCategories,
  type KnownCategory, type ExistingBudgetLine, type DraftBudgetRow,
} from '../../lib/coach-budget-import.ts';
import type { ParsedImportFile } from '../../lib/import/types.ts';

function sheet(headers: string[], rows: string[][], indentedRows: number[] = []): ParsedImportFile {
  return {
    headers,
    rows: rows.map((cells, i) => ({
      rowNumber: i + 2,
      values: Object.fromEntries(headers.map((h, j) => [h, cells[j] ?? ''])),
      // What parseXLSX sets on a row nested by Excel styling (outline level / cell indent) —
      // the Excel export's line-row marker since its labels stopped carrying the `— ` dash.
      ...(indentedRows.includes(i) ? { indented: true } : {}),
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
    // The Excel export's month header is a real DATE cell, which parseXLSX hands over as a full
    // ISO date. The day is read and dropped — a month column is a month.
    assert.equal(parseMonthHeader('2026-02-01', 2020)?.month, '2026-02');
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

  it('re-reads the app’s EXCEL export: dash-free lines nested by styling, date-cell headers', () => {
    // What parseXLSX produces from the Excel file since 2026-08-25: month headers arrive as full
    // ISO dates, and line rows carry no `— ` prefix — their nesting is the `indented` flag read
    // from the row's outline level / cell indent (which also survives the groups being collapsed,
    // since hidden rows parse like any other).
    const file = sheet(
      ['Category / line', 'No date yet', '2026-03-01', '2026-04-01', 'Total'],
      [
        ['Tournaments', '900', '1,200', '', '4,500'],
        ['Entry Fees', '', '1,200', '', '3,600'],
        ['Uniforms', '900', '', '', '900'],
        ['Total', '1,450', '2,550', '600', '8,800'],
      ],
      [1, 2],
    );
    const rows = rowsFromMonthGrid(file, 2026);
    assert.deepEqual(rows.map(r => [r.categoryName, r.lineName]), [
      ['Tournaments', 'Entry Fees'],
      ['Tournaments', 'Uniforms'],
    ]);
    assert.deepEqual(rows[0].periods, [{ month: '2026-03', amount: '1200' }]);
    assert.equal(rows[1].amount, '900');
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

/* ══════════════════════════════════════════════════════════════════════════════════════════
   THE COACH'S SPELLING VS. THE LIBRARY'S (owner-approved 2026-09-06)
   ══════════════════════════════════════════════════════════════════════════════════════════ */

function draft(over: Partial<DraftBudgetRow> = {}): DraftBudgetRow {
  return { rowNumber: 1, categoryName: 'Tournaments', lineName: 'Entry Fees', amount: '100', notes: '', periods: [], ...over };
}

describe('normalizeWord', () => {
  it('forgives punctuation, spacing and case — the four spellings that used to be four words', () => {
    for (const spelling of ['Entry Fees', 'entry fees', 'Entry  Fees', 'Entry-Fees', 'Entry Fees.', '  ENTRY   FEES  ']) {
      assert.equal(normalizeWord(spelling), 'entry fees');
    }
  });

  it('folds an apostrophe out rather than into a space', () => {
    assert.equal(normalizeWord("Coach's Gear"), 'coachs gear');
    assert.equal(normalizeWord('Coachs Gear'), 'coachs gear');
    assert.equal(normalizeWord('Coach’s Gear'), 'coachs gear');
  });

  it('reads & as the word, so "League & Fees" and "League and Fees" agree', () => {
    assert.equal(normalizeWord('League & Fees'), normalizeWord('League and Fees'));
  });

  it('does NOT reach across a real difference', () => {
    assert.notEqual(normalizeWord('Entry Fee'), normalizeWord('Entry Fees'));
    assert.notEqual(normalizeWord('Tourney Fees'), normalizeWord('Entry Fees'));
  });
});

describe('snapping a sheet to the library’s own spelling', () => {
  it('rewrites a trivially-different cost name — the whole point of the feature', () => {
    for (const typed of ['entry fees', 'Entry  Fees', 'Entry-Fees', 'Entry Fees.']) {
      const [row] = snapBudgetRowsToLibrary([draft({ lineName: typed })], CATEGORIES);
      assert.equal(row.lineName, 'Entry Fees', `${typed} should snap`);
    }
  });

  it('rewrites the category too, which un-blocks a row a full stop used to refuse', () => {
    const [row] = snapBudgetRowsToLibrary([draft({ categoryName: 'tournaments.' })], CATEGORIES);
    assert.equal(row.categoryName, 'Tournaments');
    assert.equal(reviewBudgetRows([row], CATEGORIES, [])[0].outcome, 'add');
  });

  it('leaves a genuinely different name alone', () => {
    const [row] = snapBudgetRowsToLibrary([draft({ lineName: 'Entry Fee' })], CATEGORIES);
    assert.equal(row.lineName, 'Entry Fee');
    const [other] = snapBudgetRowsToLibrary([draft({ lineName: 'Tourney Fees' })], CATEGORIES);
    assert.equal(other.lineName, 'Tourney Fees');
  });

  it('snaps NOTHING when two library words normalise the same — mig 248 keys on lower(name), so both can exist', () => {
    const ambiguous: KnownCategory[] = [{
      id: 'c1', name: 'Tournaments',
      items: [{ id: 'i1', name: 'Entry Fees' }, { id: 'i9', name: 'Entry-Fees' }],
    }];
    const [row] = snapBudgetRowsToLibrary([draft({ lineName: 'entry fees' })], ambiguous);
    assert.equal(row.lineName, 'entry fees');
  });

  it('will not snap a cost name under a category it cannot place', () => {
    const [row] = snapBudgetRowsToLibrary([draft({ categoryName: 'Nowhere', lineName: 'entry fees' })], CATEGORIES);
    assert.equal(row.lineName, 'entry fees');
  });

  it('does the same for a bills sheet, which carries a category and no cost name', () => {
    const [row] = snapPayableRowsToLibrary([{
      rowNumber: 1, payee: 'Provincial Body', description: 'Registration', categoryName: 'officials',
      amount: '400', depositAmount: '', depositDueDate: '', balanceAmount: '', balanceDueDate: '',
    }], CATEGORIES);
    assert.equal(row.categoryName, 'Officials');
  });
});

describe('telling the coach when a row would mint a new cost name', () => {
  it('says nothing about a name the library already holds', () => {
    const [row] = reviewBudgetRows([draft()], CATEGORIES, []);
    assert.equal(row.outcome, 'add');
    assert.equal(row.warning, undefined);
    assert.equal(row.suggestion, undefined);
  });

  it('offers the near miss — "Entry Fee" almost certainly means "Entry Fees"', () => {
    const [row] = reviewBudgetRows([draft({ lineName: 'Entry Fee' })], CATEGORIES, []);
    assert.equal(row.outcome, 'add', 'a warning must never block');
    assert.match(row.warning ?? '', /did you mean/i);
    assert.equal(row.suggestion?.lineName, 'Entry Fees');
    assert.equal(row.suggestion?.label, 'Entry Fees');
  });

  it('points at the heading a known word already lives under, rather than guessing a spelling', () => {
    const [row] = reviewBudgetRows([draft({ categoryName: 'Officials', lineName: 'Entry Fees' })], CATEGORIES, []);
    assert.equal(row.outcome, 'add');
    assert.match(row.warning ?? '', /already under Tournaments/);
    assert.equal(row.suggestion?.categoryName, 'Tournaments');
    assert.equal(row.suggestion?.lineName, undefined);
  });

  it('still lets a genuinely new cost through, and says so plainly with no suggestion', () => {
    const [row] = reviewBudgetRows([draft({ lineName: 'Charter Bus' })], CATEGORIES, []);
    assert.equal(row.outcome, 'add');
    assert.match(row.warning ?? '', /New name — adds “Charter Bus” to your Tournaments list\./);
    assert.equal(row.suggestion, undefined);
  });

  it('suggests nothing when two library words are equally close — a coin-toss fix is worse than none', () => {
    const twins: KnownCategory[] = [{
      id: 'c1', name: 'Tournaments',
      items: [{ id: 'i1', name: 'Bat' }, { id: 'i2', name: 'Hat' }],
    }];
    const [row] = reviewBudgetRows([draft({ lineName: 'Cat' })], twins, []);
    assert.equal(row.suggestion, undefined);
    assert.match(row.warning ?? '', /New name — adds/);
  });

  it('leaves an UPDATE alone — it matched an existing line, so it is not inventing anything', () => {
    const existing: ExistingBudgetLine[] = [
      { id: 'l1', description: 'Entry Fee', categoryName: 'Tournaments', totalAmount: 100 },
    ];
    const [row] = reviewBudgetRows([draft({ lineName: 'Entry Fee' })], CATEGORIES, existing);
    assert.equal(row.outcome, 'update');
    assert.equal(row.warning, undefined);
  });
});

describe('the template’s vocabulary sheets (D-G1 holds here too)', () => {
  it('lists every category and cost name, with where each came from — and no amount anywhere', () => {
    const cats: KnownCategory[] = [
      { id: 'c1', name: 'Tournaments', items: [
        { id: 'i1', name: 'Entry Fees', source: 'standard' },
        { id: 'i2', name: 'Charter Bus', source: 'team' },
      ] },
      { id: 'c2', name: 'Officials', items: [{ id: 'i3', name: 'Umpire Fees', source: 'club' }] },
      { id: 'c3', name: 'Empty', items: [] },
      { id: 'c4', name: 'Other Income', items: [], incomeNameCount: 4 },
    ];
    assert.deepEqual(referenceSheetRows(cats), [
      ['Tournaments', 'Entry Fees', 'Standard'],
      ['Tournaments', 'Charter Bus', 'This team'],
      ['Officials', 'Umpire Fees', 'Your club'],
      /* A heading with no cost names still gets a row: a coach must be able to see it exists.
         ⚠ AND THE ROW SAYS WHICH EMPTY IT IS (owner, 2026-09-06). These two used to be the same
         blank row, and they are two different facts — one heading is waiting for its first cost
         name, the other has a full vocabulary that this spending sheet filters out. A coach reading
         either blank concluded they could not budget under it, when they can budget under both. */
      ['Empty', 'No cost names yet — type your own', ''],
      ['Other Income', 'Income names only — type your own', ''],
    ]);
    // Three columns, and not one of them can hold a figure the product proposed.
    for (const row of referenceSheetRows(cats)) assert.equal(row.length, 3);
  });

  it('counts the income names it drops, so the two empty headings can be told apart', () => {
    const [fundraising] = toKnownCategories([{
      id: 'c1', name: 'Fundraising', items: [
        { id: 'i1', name: 'Raffle', orgId: null, teamId: null, direction: 'in' },
        { id: 'i2', name: 'Bottle drive', orgId: null, teamId: null, direction: 'in' },
      ],
    }]);
    assert.deepEqual(fundraising.items, [], 'cost words only, as it has always been');
    assert.equal(fundraising.incomeNameCount, 2);
    assert.deepEqual(referenceSheetRows([fundraising]), [
      ['Fundraising', 'Income names only — type your own', ''],
    ]);
  });

  it('builds dropdown sources that are de-duplicated, with cost names sorted for a flat list', () => {
    const cats: KnownCategory[] = [
      { id: 'c1', name: 'Tournaments', items: [{ id: 'i1', name: 'Uniforms' }, { id: 'i2', name: 'Entry Fees' }] },
      // 'uniforms' again, under another heading — one dropdown entry, not two.
      { id: 'c2', name: 'Team Gear', items: [{ id: 'i3', name: 'uniforms' }, { id: 'i4', name: 'Bats' }] },
    ];
    const lists = templateChoiceLists(cats);
    assert.deepEqual(lists.categories, ['Tournaments', 'Team Gear'], 'categories keep the library’s order');
    assert.deepEqual(lists.items, ['Bats', 'Entry Fees', 'Uniforms']);
  });
});

describe('toKnownCategories — one mapping for all three screens that mount the importer', () => {
  const raw = [{
    id: 'c1', name: 'Fundraising', items: [
      { id: 'i1', name: 'Grant', orgId: null, teamId: null, direction: 'out' },
      // The same WORD on the income side. Mig 248 made the side part of its identity and the
      // coach's picker shows one at a time — a cost import must never be able to match this.
      { id: 'i2', name: 'Grant', orgId: 'org1', teamId: null, direction: 'in' },
      { id: 'i3', name: 'Raffle Licence', orgId: 'org1', teamId: 't1', direction: 'out' },
    ],
  }];

  it('keeps cost words only', () => {
    const [category] = toKnownCategories(raw);
    assert.deepEqual(category.items.map(i => i.id), ['i1', 'i3']);
  });

  it('names each word’s tier in words a coach reads', () => {
    const [category] = toKnownCategories(raw);
    assert.deepEqual(category.items.map(i => i.source), ['standard', 'team']);
  });

  it('so an income word is never matched, suggested, or offered in a dropdown', () => {
    const categories = toKnownCategories(raw);
    const [row] = reviewBudgetRows(
      [draft({ categoryName: 'Fundraising', lineName: 'Grant' })], categories, [],
    );
    // Matched the COST "Grant" (i1) — the only one left standing — so no new-word warning.
    assert.equal(row.warning, undefined);
    assert.deepEqual(templateChoiceLists(categories).items, ['Grant', 'Raffle Licence']);
  });
});
