/**
 * A budget is TWO LEVELS: category, then item — and the item names the row.
 *
 * The screen that forced this ruling (owner, 2026-08-15): a coach picked the item "Entry Fees" and
 * their plan rendered a row called "test", because the row was named by whatever free text had been
 * typed. Two reports cannot be lined up on words somebody typed, which is why the item became the
 * key and the description became a note.
 *
 * These tests state the four rules as arithmetic rather than as convention, because three of them
 * are the kind that a later "tidy-up" silently reverses:
 *   1. group two levels and no further;
 *   2. the ITEM names the row — never the description;
 *   3. two lines on one item SUM into one row, periods included;
 *   4. an item with spending and no line is its OWN row, flagged, not a footnote.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  rollupBudget, NO_ITEM_LABEL, NO_CATEGORY_LABEL,
  type RollupLine, type RollupSpend,
} from '../../lib/coach-budget-rollup.ts';

const TOURNAMENTS = 'cat-tournaments';
const FACILITIES  = 'cat-facilities';
const ENTRY       = 'item-entry-fees';
const DOME        = 'item-dome-time';

function line(over: Partial<RollupLine> = {}): RollupLine {
  return {
    id: 'line-1',
    categoryId: TOURNAMENTS, categoryName: 'Tournaments',
    itemId: ENTRY, itemName: 'Entry fees',
    totalAmount: 1000,
    description: 'whatever somebody typed',
    notes: null,
    periods: [],
    ...over,
  };
}

function spend(over: Partial<RollupSpend> = {}): RollupSpend {
  return {
    id: 'cost-1', description: 'Spring Classic entry',
    categoryId: TOURNAMENTS, categoryName: 'Tournaments',
    itemId: ENTRY, itemName: 'Entry fees',
    amount: 400, paidDate: '2026-05-01',
    ...over,
  };
}

describe('rollupBudget — the item names the row', () => {
  it('names a row by its ITEM, never by the description on the line', () => {
    // ⚠ THE REGRESSION FOR THE SCREENSHOT THAT STARTED THIS. A line whose description reads "test"
    // must render as "Entry fees"; if this ever fails, the plan is naming rows by free text again.
    const [cat] = rollupBudget([line({ description: 'test' })], []);
    assert.equal(cat.categoryName, 'Tournaments');
    assert.equal(cat.items.length, 1);
    assert.equal(cat.items[0].itemName, 'Entry fees');
  });

  it('groups two levels and no further', () => {
    const rows = rollupBudget(
      [line(), line({ id: 'l2', categoryId: FACILITIES, categoryName: 'Facilities', itemId: DOME, itemName: 'Dome time' })],
      [],
    );
    assert.deepEqual(rows.map(c => c.categoryName), ['Facilities', 'Tournaments']);
    assert.deepEqual(rows.map(c => c.items.length), [1, 1]);
  });
});

describe('rollupBudget — two lines on one item SUM into one row', () => {
  it('is ONE row carrying the total, captioned with how many lines made it', () => {
    // The owner's own screen: "Tournament entry fees $2,600" and "test $100", both on Entry Fees.
    const rows = rollupBudget(
      [line({ id: 'a', totalAmount: 2600 }), line({ id: 'b', description: 'test', totalAmount: 100 })],
      [],
    );
    assert.equal(rows[0].items.length, 1);
    assert.equal(rows[0].items[0].itemName, 'Entry fees');
    assert.equal(rows[0].items[0].budgeted, 2700);
    assert.equal(rows[0].items[0].lineCount, 2);
    assert.equal(rows[0].budgeted, 2700);
  });

  it('keeps both lines reachable, so a coach can still edit one of them', () => {
    const rows = rollupBudget([line({ id: 'a' }), line({ id: 'b', notes: 'the second one' })], []);
    assert.deepEqual(rows[0].items[0].lines.map(l => l.id), ['a', 'b']);
    assert.equal(rows[0].items[0].lines[1].notes, 'the second one');
  });

  it('MERGES the two lines\' payment periods by date rather than listing a month twice', () => {
    // ⚠ Two lines on one item is an ordinary shape now, so listing "Nov 30" twice would report one
    // month as two — the visual twin of the per-line double-count fixed on 2026-08-15.
    const rows = rollupBudget([
      line({ id: 'a', totalAmount: 600, periods: [
        { label: 'Nov', date: '2026-11-30', amount: 300, sortOrder: 0 },
        { label: 'Dec', date: '2026-12-31', amount: 300, sortOrder: 1 },
      ] }),
      line({ id: 'b', totalAmount: 200, periods: [
        { label: 'November', date: '2026-11-30', amount: 200, sortOrder: 0 },
      ] }),
    ], []);
    const periods = rows[0].items[0].periods;
    assert.equal(periods.length, 2);
    assert.deepEqual(periods.map(p => p.date), ['2026-11-30', '2026-12-31']);
    assert.equal(periods[0].amount, 500);   // 300 + 200, one row
  });

  it('collapses undated periods into a single bucket, kept last', () => {
    // A period with no date has nothing to be merged BY, and two lines' worth cannot be reconciled.
    const rows = rollupBudget([
      line({ id: 'a', periods: [{ label: 'Deposit', date: null, amount: 100, sortOrder: 0 }] }),
      line({ id: 'b', periods: [
        { label: 'Balance', date: null, amount: 50, sortOrder: 0 },
        { label: 'May', date: '2027-05-01', amount: 20, sortOrder: 1 },
      ] }),
    ], []);
    const periods = rows[0].items[0].periods;
    assert.deepEqual(periods.map(p => p.date), ['2027-05-01', null]);
    assert.equal(periods[1].amount, 150);
  });
});

describe('rollupBudget — charged but never budgeted', () => {
  it('gives an unplanned item its OWN row, flagged, with no budget figure', () => {
    // ⚠ THE ROW THE WHOLE CHANGE EXISTS FOR. It used to be an entry in a separate "Unbudgeted"
    // list at the foot of the report, divorced from the category it belongs to.
    const rows = rollupBudget(
      [line()],
      [spend({ id: 'c1', itemId: 'item-travel', itemName: 'Travel', amount: 250 })],
    );
    assert.equal(rows.length, 1);
    const items = rows[0].items;
    assert.equal(items.length, 2);
    const travel = items.find(i => i.itemName === 'Travel')!;
    assert.equal(travel.inPlan, false);
    assert.equal(travel.budgeted, 0);
    assert.equal(travel.actual, 250);
    assert.equal(travel.variance, -250);
  });

  it('flags a whole CATEGORY nobody budgeted for', () => {
    const rows = rollupBudget(
      [line()],
      [spend({ id: 'c1', categoryId: 'cat-officials', categoryName: 'Officials', itemId: 'item-ump', itemName: 'Umpire fees', amount: 600 })],
    );
    const officials = rows.find(c => c.categoryName === 'Officials')!;
    assert.equal(officials.inPlan, false);
    assert.equal(officials.actual, 600);
    // Planned categories first, so the unplanned ones read as the exception they are.
    assert.equal(rows[0].categoryName, 'Tournaments');
  });

  it('puts planned items before unplanned ones inside a category', () => {
    const rows = rollupBudget(
      [line({ itemId: 'item-zebra', itemName: 'Zebra' })],
      [spend({ id: 'c1', itemId: 'item-alpha', itemName: 'Alpha' })],
    );
    assert.deepEqual(rows[0].items.map(i => [i.itemName, i.inPlan]), [['Zebra', true], ['Alpha', false]]);
  });
});

describe('rollupBudget — spending that names no item, and no category', () => {
  it('buckets item-less rows under one honest prompt rather than inventing a name', () => {
    const rows = rollupBudget(
      [line({ itemId: null, itemName: null, totalAmount: 300 })],
      [spend({ id: 'c1', itemId: null, itemName: null, amount: 120 })],
    );
    assert.equal(rows[0].items.length, 1);
    assert.equal(rows[0].items[0].itemName, NO_ITEM_LABEL);
    assert.equal(rows[0].items[0].budgeted, 300);
    assert.equal(rows[0].items[0].actual, 120);
  });

  it('gives spending with no category at all a row of its own, still two levels deep', () => {
    const rows = rollupBudget([], [spend({
      id: 'c1', categoryId: null, categoryName: null, itemId: null, itemName: null, amount: 90,
    })]);
    assert.equal(rows[0].categoryName, NO_CATEGORY_LABEL);
    assert.equal(rows[0].items[0].itemName, NO_ITEM_LABEL);
    assert.equal(rows[0].actual, 90);
    assert.equal(rows[0].inPlan, false);
  });

  it('lands two costs typing the same category text in ONE row, not two identical ones', () => {
    const rows = rollupBudget([], [
      spend({ id: 'c1', categoryId: null, categoryName: 'Officials', itemId: null, itemName: null, amount: 40 }),
      spend({ id: 'c2', categoryId: null, categoryName: 'officials', itemId: null, itemName: null, amount: 60 }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].actual, 100);
  });
});

describe('rollupBudget — the arithmetic every screen quotes', () => {
  it('reconciles: a category is the sum of its items, planned and not', () => {
    // ⚠ THE INVARIANT THE REPORT'S TOTAL ROW DEPENDS ON. Unplanned spending is inside the
    // categories now, so a screen adding it again on top double-counts the very money this change
    // set out to make visible.
    const rows = rollupBudget(
      [line({ totalAmount: 1000 })],
      [spend({ id: 'c1', amount: 400 }), spend({ id: 'c2', itemId: 'item-travel', itemName: 'Travel', amount: 250 })],
    );
    const cat = rows[0];
    assert.equal(cat.budgeted, cat.items.reduce((s, i) => s + i.budgeted, 0));
    assert.equal(cat.actual, cat.items.reduce((s, i) => s + i.actual, 0));
    assert.equal(cat.actual, 650);
    assert.equal(cat.variance, 350);
  });

  it('places each cost in the first period on or after the day it was paid', () => {
    const rows = rollupBudget([line({ periods: [
      { label: 'Sep', date: '2026-09-30', amount: 100, sortOrder: 0 },
      { label: 'Oct', date: '2026-10-31', amount: 100, sortOrder: 1 },
    ] })], [
      spend({ id: 'c1', amount: 60, paidDate: '2026-09-02' }),
      spend({ id: 'c2', amount: 25, paidDate: '2026-10-15' }),
    ]);
    assert.deepEqual(rows[0].items[0].periods.map(p => p.actual), [60, 25]);
  });

  it('puts a cost paid after the last period, and one with no date, in the final period', () => {
    const rows = rollupBudget([line({ periods: [
      { label: 'Sep', date: '2026-09-30', amount: 100, sortOrder: 0 },
      { label: 'Oct', date: '2026-10-31', amount: 100, sortOrder: 1 },
    ] })], [
      spend({ id: 'c1', amount: 80, paidDate: '2027-03-01' }),
      spend({ id: 'c2', amount: 20, paidDate: null }),
    ]);
    assert.deepEqual(rows[0].items[0].periods.map(p => p.actual), [0, 100]);
  });

  it('rounds to cents rather than carrying a float tail onto a money screen', () => {
    const rows = rollupBudget([], [
      spend({ id: 'c1', amount: 0.1 }), spend({ id: 'c2', amount: 0.2 }),
    ]);
    assert.equal(rows[0].actual, 0.3);
  });
});

describe('rollupBudget — the category that split in two (/review, 2026-08-15)', () => {
  it('lands costs on ONE row whether they carry the category id or only its typed name', () => {
    /* ⚠ THE REGRESSION. The report learned category id↔name pairings only from budget LINES, so a
       category the team never budgeted for had no pairing at all: a cost carrying its id bucketed
       under the id, a sibling carrying only the text bucketed under the name, and "Officials"
       appeared twice — $2,000 and $600 — for one $2,600 category. The season total stayed right;
       the breakdown a coach reads did not. (The two rows also shared one expand toggle, being
       keyed by name.) The route now learns pairings from the SPENDING as well. */
    const rows = rollupBudget([], [
      spend({ id: 'c1', categoryId: 'cat-officials', categoryName: 'Officials', itemId: null, itemName: null, amount: 2000 }),
      spend({ id: 'c2', categoryId: 'cat-officials', categoryName: 'Officials', itemId: null, itemName: null, amount: 600 }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].categoryName, 'Officials');
    assert.equal(rows[0].actual, 2600);
    assert.equal(rows[0].inPlan, false);
  });

  it('still splits when the ids genuinely differ, rather than merging on name alone', () => {
    // Two real categories that happen to be typed the same must NOT be silently merged — the
    // fix above is about supplying the missing id, never about ignoring one that is present.
    const rows = rollupBudget([], [
      spend({ id: 'c1', categoryId: 'cat-a', categoryName: 'Officials', itemId: null, itemName: null, amount: 100 }),
      spend({ id: 'c2', categoryId: 'cat-b', categoryName: 'Officials', itemId: null, itemName: null, amount: 200 }),
    ]);
    assert.equal(rows.length, 2);
  });
});
