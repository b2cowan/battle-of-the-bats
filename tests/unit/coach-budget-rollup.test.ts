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
 *
 * ── 2026-08-16: the same module learned DIRECTION and MONEY BACK ────────────────────────────
 * `rollupMoneyReport` is the full pass; `rollupBudget` is the cost-only wrapper the plan page
 * still calls. The rules it added are stated at the foot of this file, and three of them are
 * money-wrong-in-both-directions if reversed:
 *   5. a row is REVENUE or an EXPENSE, and one item can be both — two rows, one per section;
 *   6. VARIANCE IS ALWAYS GOOD-NEWS-POSITIVE, because the formula differs by direction;
 *   7. money back NETS into the row it repaid — never its own row, never income.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  rollupBudget, rollupMoneyReport, NO_ITEM_LABEL, NO_CATEGORY_LABEL,
  type RollupLine, type RollupSpend, type RollupRefund,
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

/* ── Money IN, and money BACK ────────────────────────────────────────────────────────────────
   Deliberately on the SAME category as the cost helpers above: a category holding both
   directions is the shape shape B exists for, and the shape most likely to be broken by a
   change that assumes one row per category+item. */
const REGISTRATION = 'item-registration';

function inLine(over: Partial<RollupLine> = {}): RollupLine {
  return line({
    id: 'in-line-1', direction: 'in',
    itemId: REGISTRATION, itemName: 'Registration revenue',
    totalAmount: 6000, description: 'what we expect to take',
    ...over,
  });
}

function income(over: Partial<RollupSpend> = {}): RollupSpend {
  return spend({
    id: 'in-1', direction: 'in',
    itemId: REGISTRATION, itemName: 'Registration revenue',
    amount: 6400, description: 'Gate + entries', paidDate: '2026-06-01',
    ...over,
  });
}

function refund(over: Partial<RollupRefund> = {}): RollupRefund {
  return {
    id: 'back-1', description: 'Cancelled entry refunded',
    categoryId: TOURNAMENTS, categoryName: 'Tournaments',
    itemId: ENTRY, itemName: 'Entry fees',
    amount: 150, receivedDate: '2026-09-03',
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

/* ══════════════════════════════════════════════════════════════════════════════════════════
   MONEY IN, MONEY OUT, MONEY BACK (2026-08-16)
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('rollupMoneyReport — a row is revenue or an expense, never both at once', () => {
  it('sorts a line into the section its direction names', () => {
    const r = rollupMoneyReport({ lines: [line(), inLine()], spend: [] });
    assert.deepEqual(r.revenue.categories.flatMap(c => c.items.map(i => i.itemName)), ['Registration revenue']);
    assert.deepEqual(r.expenses.categories.flatMap(c => c.items.map(i => i.itemName)), ['Entry fees']);
  });

  it('gives ONE item carrying both directions TWO rows, one in each section', () => {
    /* ⚠ THE SHAPE THAT BREAKS A ONE-ROW-PER-ITEM ASSUMPTION. The library's direction tag is a
       picker HINT, never a constraint (plan §3.6), so a coach can and will point both a cost and
       an income at the same word. Netting them into one row would report a $6,400 gate and a
       $2,400 entry fee as $4,000 of something with no name. */
    const r = rollupMoneyReport({
      lines: [],
      spend: [spend({ amount: 2400 }), income({ itemId: ENTRY, itemName: 'Entry fees', amount: 6400 })],
    });
    assert.equal(r.revenue.categories[0].items[0].itemName, 'Entry fees');
    assert.equal(r.revenue.categories[0].items[0].actual, 6400);
    assert.equal(r.expenses.categories[0].items[0].itemName, 'Entry fees');
    assert.equal(r.expenses.categories[0].items[0].actual, 2400);
  });

  it('stamps every row with its direction, so no screen has to infer one', () => {
    const r = rollupMoneyReport({ lines: [line(), inLine()], spend: [] });
    assert.equal(r.revenue.categories[0].direction, 'in');
    assert.equal(r.revenue.categories[0].items[0].direction, 'in');
    assert.equal(r.expenses.categories[0].direction, 'out');
    assert.equal(r.expenses.categories[0].items[0].direction, 'out');
  });
});

describe('rollupMoneyReport — variance is ALWAYS good-news-positive', () => {
  /* ⚠⚠ THE DEFECT THE WHOLE REPORT SHAPE EXISTS TO FIX (plan §8). A single mixed table ran
     `actual − budget` on revenue and `budget − actual` on costs behind one column heading, both
     green, both positive, the only distinguisher a two-letter tag. The formula still differs —
     it has to — but it is decided HERE, once, by the row's own direction, and the answer always
     means the same thing: positive is the good news. Sections supply the wording. */

  it('revenue over its budget is POSITIVE', () => {
    const r = rollupMoneyReport({ lines: [inLine({ totalAmount: 6000 })], spend: [income({ amount: 6400 })] });
    assert.equal(r.revenue.categories[0].items[0].variance, 400);
  });

  it('revenue UNDER its budget is negative', () => {
    const r = rollupMoneyReport({ lines: [inLine({ totalAmount: 1800 })], spend: [income({ amount: 1640 })] });
    assert.equal(r.revenue.categories[0].items[0].variance, -160);
  });

  it('a cost under its budget is POSITIVE, exactly as it always was', () => {
    const r = rollupMoneyReport({ lines: [line({ totalAmount: 2400 })], spend: [spend({ amount: 2250 })] });
    assert.equal(r.expenses.categories[0].items[0].variance, 150);
  });

  it('a cost over its budget is negative', () => {
    const r = rollupMoneyReport({ lines: [line({ totalAmount: 950 })], spend: [spend({ amount: 1110 })] });
    assert.equal(r.expenses.categories[0].items[0].variance, -160);
  });
});

describe('rollupMoneyReport — money back nets into the row it repaid', () => {
  it('is ONE row carrying the net, never a second row', () => {
    // The plan's own worked example: $2,400 paid, $150 back, the row reads $2,250.
    const r = rollupMoneyReport({
      lines: [line({ totalAmount: 2400 })],
      spend: [spend({ amount: 2400 })],
      refunds: [refund({ amount: 150 })],
    });
    const items = r.expenses.categories[0].items;
    assert.equal(items.length, 1);
    assert.equal(items[0].actual, 2250);
    assert.equal(items[0].variance, 150);        // $150 under, good news, positive
  });

  it('keeps the gross and the refund separately readable, for the "$2,400 paid · $150 back" line', () => {
    const r = rollupMoneyReport({
      lines: [], spend: [spend({ amount: 2400 })], refunds: [refund({ amount: 150 })],
    });
    const item = r.expenses.categories[0].items[0];
    assert.equal(item.grossActual, 2400);
    assert.equal(item.refundTotal, 150);
    assert.equal(item.refunds.length, 1);
    assert.equal(item.refunds[0].receivedDate, '2026-09-03');
  });

  it('reduces the INCOME when it points at an income item — contra-revenue, for free', () => {
    /* 🎯 The bonus the three-answer form buys (plan §3.1): a registration refunded to a visiting
       team must lower revenue, not raise costs. Nobody designs for this; the direction of the row
       it points at decides. */
    const r = rollupMoneyReport({
      lines: [inLine({ totalAmount: 6000 })],
      spend: [income({ amount: 6400 })],
      refunds: [refund({ id: 'b2', itemId: REGISTRATION, itemName: 'Registration revenue', amount: 250 })],
    });
    assert.equal(r.revenue.categories[0].items[0].actual, 6150);
    assert.equal(r.expenses.categories.length, 0);   // nothing landed on the cost side
  });

  it('nets into the COST side when an item carries both, because that is the base case', () => {
    // Documented, deliberate, and the reason a misfiled refund shows up as a negative rather
    // than as quietly-shrunken income.
    const r = rollupMoneyReport({
      lines: [],
      spend: [spend({ amount: 400 }), income({ itemId: ENTRY, itemName: 'Entry fees', amount: 900 })],
      refunds: [refund({ amount: 100 })],
    });
    assert.equal(r.expenses.categories[0].items[0].actual, 300);
    assert.equal(r.revenue.categories[0].items[0].actual, 900);
  });

  it('shows an item that goes NEGATIVE rather than blocking it', () => {
    /* ⚠ Nearly always the signal it is filed against the wrong item, which is exactly why it
       must be visible. Brackets are the screen's job; the module's job is not to clamp. */
    const r = rollupMoneyReport({ lines: [], spend: [], refunds: [refund({ amount: 125 })] });
    const item = r.expenses.categories[0].items[0];
    assert.equal(item.actual, -125);
    assert.equal(item.inPlan, false);
    assert.equal(item.grossActual, 0);
  });

  it('is dated when it ARRIVED, landing in that period and not the one the cost was paid in', () => {
    // Back-dating the credit into July would rewrite a month already reported on and reconciled.
    const r = rollupMoneyReport({
      lines: [line({ totalAmount: 600, periods: [
        { label: 'Jul', date: '2026-07-31', amount: 300, sortOrder: 0 },
        { label: 'Aug', date: '2026-08-31', amount: 300, sortOrder: 1 },
        { label: 'Sep', date: '2026-09-30', amount: 0,   sortOrder: 2 },
      ] })],
      spend: [
        spend({ id: 'c1', amount: 300, paidDate: '2026-07-14' }),
        spend({ id: 'c2', amount: 300, paidDate: '2026-08-20' }),
      ],
      refunds: [refund({ amount: 325, receivedDate: '2026-09-03' })],
    });
    const periods = r.expenses.categories[0].items[0].periods;
    assert.deepEqual(periods.map(p => p.actual), [300, 300, -325]);
    assert.equal(r.expenses.categories[0].items[0].actual, 275);
  });

  it('⚠⚠ is NOT the same record as an expense a family paid out of pocket', () => {
    /* THE TRAP (money-back plan §2). Both are "a parent paid me back". An out-of-pocket expense
       is still SPENDING — it counts in full and the team owes that family a credit. A refund is
       money returning. On the same item they must both be visible and must not merge: gross
       $325 of spending, $325 back, a net of zero — and TWO records behind it, not one. */
    const r = rollupMoneyReport({
      lines: [],
      spend: [spend({ id: 'oop', description: 'Permit — paid by the Silva family', amount: 325 })],
      refunds: [refund({ id: 'back', description: 'Club reimbursed the permit', amount: 325 })],
    });
    const item = r.expenses.categories[0].items[0];
    assert.equal(item.grossActual, 325);
    assert.equal(item.refundTotal, 325);
    assert.equal(item.actual, 0);
    assert.equal(item.costs.length, 1);
    assert.equal(item.refunds.length, 1);
  });

  it('never lets money back reach the revenue total as income', () => {
    // ⚠ NEVER BOTH (plan §4.2). Counted twice, a $325 reimbursement makes a season look $650
    // better than it is.
    const r = rollupMoneyReport({ lines: [], spend: [spend({ amount: 400 })], refunds: [refund({ amount: 325 })] });
    assert.equal(r.revenue.actual, 0);
    assert.equal(r.expenses.actual, 75);
    assert.equal(r.net.actual, -75);
  });
});

describe('rollupMoneyReport — the statement (shape A)', () => {
  it('totals each section and ends on the season net', () => {
    const r = rollupMoneyReport({
      lines: [inLine({ totalAmount: 8700 }), line({ totalAmount: 5750 })],
      spend: [income({ amount: 9280 }), spend({ amount: 5760 })],
    });
    assert.equal(r.revenue.budgeted, 8700);
    assert.equal(r.revenue.actual, 9280);
    assert.equal(r.revenue.variance, 580);        // took more than planned — good
    assert.equal(r.expenses.budgeted, 5750);
    assert.equal(r.expenses.actual, 5760);
    assert.equal(r.expenses.variance, -10);       // $10 over — bad
    assert.equal(r.net.budgeted, 2950);
    assert.equal(r.net.actual, 3520);
    assert.equal(r.net.variance, 570);
  });

  it('reconciles: a section is the sum of its categories, which are the sum of their items', () => {
    const r = rollupMoneyReport({
      lines: [inLine(), line()],
      spend: [income(), spend(), spend({ id: 'c2', itemId: 'item-travel', itemName: 'Travel', amount: 250 })],
      refunds: [refund({ amount: 50 })],
    });
    for (const section of [r.revenue, r.expenses]) {
      assert.equal(section.actual, section.categories.reduce((s, c) => s + c.actual, 0));
      assert.equal(section.budgeted, section.categories.reduce((s, c) => s + c.budgeted, 0));
      for (const cat of section.categories) {
        assert.equal(cat.actual, cat.items.reduce((s, i) => s + i.actual, 0));
      }
    }
  });
});

describe('rollupMoneyReport — by activity (shape B)', () => {
  const both = () => rollupMoneyReport({
    lines: [
      inLine({ totalAmount: 6900 }),
      line({ totalAmount: 4600 }),
      line({ id: 'eq', categoryId: 'cat-equipment', categoryName: 'Equipment', itemId: 'item-uniforms', itemName: 'Uniforms', totalAmount: 1150 }),
    ],
    spend: [
      income({ amount: 7640 }),
      spend({ amount: 4450 }),
      spend({ id: 'eq-c', categoryId: 'cat-equipment', categoryName: 'Equipment', itemId: 'item-uniforms', itemName: 'Uniforms', amount: 1310 }),
    ],
  });

  it('splits a category INSIDE itself and states what it netted', () => {
    const tournaments = both().activities.find(a => a.categoryName === 'Tournaments')!;
    assert.equal(tournaments.revenue!.actual, 7640);
    assert.equal(tournaments.costs!.actual, 4450);
    assert.equal(tournaments.net.budgeted, 2300);
    assert.equal(tournaments.net.actual, 3190);
    assert.equal(tournaments.net.variance, 890);
  });

  it('gives a cost-only category a NEGATIVE net and no revenue half at all', () => {
    // The honest reading of Equipment: it earned nothing and cost $1,310.
    const equipment = both().activities.find(a => a.categoryName === 'Equipment')!;
    assert.equal(equipment.revenue, null);
    assert.equal(equipment.costs!.actual, 1310);
    assert.equal(equipment.net.actual, -1310);
    assert.equal(equipment.net.variance, -160);
  });

  it('ends on the SAME season net as the statement, because it is the same money', () => {
    const r = both();
    const fromBlocks = Math.round(r.activities.reduce((s, a) => s + a.net.actual, 0) * 100) / 100;
    assert.equal(fromBlocks, r.net.actual);
  });

  it('leads with the categories that have BOTH halves — the question this lens exists for', () => {
    const r = rollupMoneyReport({
      lines: [
        inLine({ totalAmount: 6900 }),                                                     // Tournaments, in
        line({ totalAmount: 4600 }),                                                       // Tournaments, out
        line({ id: 'eq', categoryId: 'cat-equipment', categoryName: 'Equipment', itemId: 'item-uniforms', itemName: 'Uniforms', totalAmount: 1150 }),
        inLine({ id: 'fr', categoryId: 'cat-fundraising', categoryName: 'Fundraising', itemId: 'item-drive', itemName: 'Fundraising drive', totalAmount: 1800 }),
      ],
      spend: [],
    });
    assert.deepEqual(r.activities.map(a => a.categoryName), ['Tournaments', 'Fundraising', 'Equipment']);
  });
});

describe('rollupBudget — the cost-only wrapper the plan page still calls', () => {
  it('is the expenses half of the same pass, so the two can never group one plan two ways', () => {
    const lines = [line(), inLine()];
    const spends = [spend(), income()];
    assert.deepEqual(
      rollupBudget(lines, spends),
      rollupMoneyReport({ lines, spend: spends }).expenses.categories,
    );
  });

  it('ignores an income line entirely rather than summing it as a cost', () => {
    // The 19-readers lesson, one level up: a money-in line reaching a cost total inflates the
    // season and every dues figure derived from it.
    const rows = rollupBudget([line({ totalAmount: 1000 }), inLine({ totalAmount: 5000 })], []);
    assert.equal(rows.reduce((s, c) => s + c.budgeted, 0), 1000);
  });
});
