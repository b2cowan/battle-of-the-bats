import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPeriodView, quarterKeyOf, UNSCHEDULED, MAX_PERIOD_MONTHS,
  type PeriodViewLine,
} from '../../lib/coach-budget-periods-view.ts';
import { NO_CATEGORY_LABEL } from '../../lib/coach-budget-rollup.ts';

function line(
  id: string,
  description: string,
  totalAmount: number,
  periods: Array<[string | null, number]>,
  opts: { category?: string | null; funding?: boolean; itemId?: string | null } = {},
): PeriodViewLine {
  return {
    id,
    description,
    // Every line carries an item by default, derived from its name — the post-mig-240 shape,
    // where an item is required on every kind. Pass `itemId` to make two lines share one (the
    // merge case), or an explicit null for a legacy item-less line (the "Not itemized" case).
    itemId: 'itemId' in opts ? opts.itemId ?? null : `item-${description}`,
    itemName: description,
    // `'category' in opts`, not `??` — an explicit null is "uncategorized", which is a different
    // fact from "the helper's default".
    categoryName: 'category' in opts ? opts.category ?? null : 'Tournaments',
    totalAmount,
    lineKind: opts.funding ? 'funding' : 'cost',
    periods: periods.map(([periodDate, amount]) => ({ periodDate, amount })),
  };
}

describe('columns', () => {
  it('runs contiguously from the first dated period to the last', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 1000], ['2027-03-01', 2000]]),
    ], 'months');
    assert.deepEqual(view.columns.map(c => c.key), ['2027-01', '2027-02', '2027-03']);
    // A month nothing lives in is information ("we pay nothing in February"), and dropping it
    // would let two adjacent columns lie about how far apart they are.
    assert.equal(view.columns[1].label, 'Feb');
  });

  it('groups the columns into year BANDS rather than labelling one column', () => {
    // ⚠ The year used to print on the column where it changed, which made that column taller than
    // its neighbours and described a group with a single-column label (owner, 2026-08-13).
    const view = buildPeriodView([
      line('a', 'Travel', 3000, [['2027-11-01', 1000], ['2027-12-01', 1000], ['2028-01-01', 1000]]),
    ], 'months');
    assert.deepEqual(view.columns.map(c => c.label), ['Nov', 'Dec', 'Jan']);
    assert.deepEqual(view.yearBands, [{ year: '2027', span: 2 }, { year: '2028', span: 1 }]);
  });

  it('bands a single-year plan too, so the grid always says which season it is', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 2000, [['2027-01-01', 1000], ['2027-03-01', 1000]]),
    ], 'months');
    assert.deepEqual(view.yearBands, [{ year: '2027', span: 3 }]);
  });

  it('bands quarters the same way — Q1 alone does not say which season', () => {
    const view = buildPeriodView([
      line('a', 'Travel', 2000, [['2027-09-01', 1000], ['2028-01-01', 1000]]),
    ], 'quarters');
    assert.deepEqual(view.columns.map(c => c.label), ['Q3', 'Q4', 'Q1']);
    assert.deepEqual(view.yearBands, [{ year: '2027', span: 2 }, { year: '2028', span: 1 }]);
  });

  it('never bands the Unscheduled column — it belongs to no year', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 1000, [['2027-01-01', 1000]]),
      line('b', 'Uniforms', 500, []),
    ], 'months');
    assert.equal(view.hasUnscheduled, true);
    const banded = view.yearBands.reduce((s, b) => s + b.span, 0);
    assert.equal(banded, view.columns.filter(c => !c.unscheduled).length);
    assert.deepEqual(view.yearBands, [{ year: '2027', span: 1 }]);
  });

  it('has no bands at all when nothing is dated', () => {
    const view = buildPeriodView([line('a', 'Entry fees', 1000, [])], 'months');
    assert.deepEqual(view.yearBands, []);
  });

  it('groups the same months into quarters without changing which money is on screen', () => {
    const lines = [line('a', 'Entry fees', 3000, [['2027-01-01', 1000], ['2027-05-01', 2000]])];
    const months = buildPeriodView(lines, 'months');
    const quarters = buildPeriodView(lines, 'quarters');
    assert.deepEqual(quarters.columns.map(c => c.key), ['2027-Q1', '2027-Q2']);
    assert.equal(months.expenseTotals.total, quarters.expenseTotals.total);
    assert.equal(months.balance.seasonNet, quarters.balance.seasonNet);
    assert.equal(quarters.groups[0].rows[0].cells['2027-Q1'], 1000);
    assert.equal(quarters.groups[0].rows[0].cells['2027-Q2'], 2000);
  });

  it('maps every month to its quarter', () => {
    assert.equal(quarterKeyOf('2027-01'), '2027-Q1');
    assert.equal(quarterKeyOf('2027-03'), '2027-Q1');
    assert.equal(quarterKeyOf('2027-04'), '2027-Q2');
    assert.equal(quarterKeyOf('2027-12'), '2027-Q4');
  });

  it('caps a runaway span and says so instead of hiding the tail', () => {
    const view = buildPeriodView([
      line('a', 'Long haul', 2000, [['2027-01-01', 1000], ['2031-01-01', 1000]]),
    ], 'months');
    assert.equal(view.truncated, true);
    assert.equal(view.columns.filter(c => !c.unscheduled).length, MAX_PERIOD_MONTHS);
    // The far amount folds into the last column rather than vanishing: a row's cells must
    // always add up to its own total.
    const row = view.groups[0].rows[0];
    const summed = Object.values(row.cells).reduce((s, n) => s + n, 0);
    assert.equal(summed, row.total);
  });
});

describe('unscheduled', () => {
  it('carries a line with no period split at all', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 3000]]),
      line('b', 'Uniforms', 2000, []),
    ], 'months');
    assert.equal(view.hasUnscheduled, true);
    /* ⚠ IT LEADS — it used to be asserted LAST (owner ruling 2026-09-04, QA §133). Both grids
       now open on undated money instead of hiding it off the right-hand edge, so the assertion
       that was describing the old screen moves to the front with the column. The MONEY has not
       moved: the next line is the one that proves the amount still lands in that bucket. */
    assert.equal(view.columns[0].key, UNSCHEDULED);
    assert.equal(view.groups[0].rows[1].cells[UNSCHEDULED], 2000);
  });

  it('carries a dateless period from "just names" mode', () => {
    const view = buildPeriodView([
      line('a', 'Gear', 1000, [['2027-01-01', 600], [null, 400]]),
    ], 'months');
    assert.equal(view.groups[0].rows[0].cells[UNSCHEDULED], 400);
    assert.equal(view.groups[0].rows[0].cells['2027-01'], 600);
  });

  it('has no column when nothing lands in it', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 3000]]),
    ], 'months');
    assert.equal(view.hasUnscheduled, false);
    assert.equal(view.columns.some(c => c.unscheduled), false);
  });

  it('is the ONLY column when a plan has no dates at all', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, []),
      line('b', 'Uniforms', 2000, []),
    ], 'months');
    assert.deepEqual(view.columns.map(c => c.key), [UNSCHEDULED]);
    // No money in → no revenue subtotal to draw (the band draws with a prompt); the balance still
    // closes, on the undated net alone.
    assert.equal(view.revenueTotals, null);
    assert.equal(view.expenseTotals.total, 5000);
    assert.equal(view.balance.seasonNet, -5000);
    assert.equal(view.balance.months.length, 0);
    // No estimate passed → nothing to differ from.
    assert.equal(view.estimateRows, null);
  });
});

describe('revenue — first, positive, grouped by category', () => {
  it('reads money in POSITIVE in the subtotal while the group stays signed, and the balance nets it', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 3000]]),
      line('f', 'Fundraising', 1000, [['2027-01-01', 1000]], { funding: true, category: 'Fundraising' }),
    ], 'months');
    // Revenue LEADS (owner decision, 2026-09-12) — the statement's order, what comes in first.
    assert.equal(view.groups[0].name, 'Fundraising');
    assert.equal(view.groups[0].lineKind, 'funding');
    // The GROUP is signed (the panel abs()es it per cell)…
    assert.equal(view.groups[0].rows[0].cells['2027-01'], -1000);
    // …the SUBTOTAL is already positive — the Revenue band's own figure. Never negate it again.
    assert.equal(view.revenueTotals?.cells['2027-01'], 1000);
    assert.equal(view.revenueTotals?.total, 1000);
    assert.equal(view.expenseTotals.cells['2027-01'], 3000);
    assert.equal(view.expenseTotals.total, 3000);
    // Opening 0 (unset) + net (1,000 − 3,000) = closing (2,000).
    assert.equal(view.balance.net['2027-01'], -2000);
    assert.equal(view.balance.closing['2027-01'], -2000);
    assert.equal(view.balance.seasonNet, -2000);
    assert.equal(view.balance.seasonClosing, -2000);
  });

  /* ⚠⚠ REVERSED 2026-09-09 (owner ruling: the category is the shelf on both sides). This test used
     to be "lands in ONE group whatever categories its lines carry" — money in was one shelf per
     KIND regardless of filing, so a concession stand filed under Tournaments read under "Other
     income" here and under "Tournaments" on the Statement. Money in is grouped by CATEGORY now,
     exactly as costs are, through the rollup's one identity helper. */
  it('groups money in by CATEGORY, exactly as the Statement does — never one merged shelf', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 3000]]),
      line('f', 'Chocolate drive', 1000, [], { funding: true, category: 'Tournaments' }),
      line('g', 'Sponsor', 500, [], { funding: true, category: null }),
    ], 'months');
    const fundingGroups = view.groups.filter(g => g.lineKind === 'funding');
    // Two groups: the drive under Tournaments, the line with no category in the nameless bucket
    // under the one spelling every surface uses.
    assert.deepEqual(fundingGroups.map(g => g.name), ['Tournaments', NO_CATEGORY_LABEL]);
    assert.deepEqual(fundingGroups.map(g => g.total), [-1000, -500]);
    // And the FUNDING Tournaments group is not the COST Tournaments group — two bands, two signs.
    const tournaments = view.groups.filter(g => g.name === 'Tournaments');
    assert.equal(tournaments.length, 2);
    assert.deepEqual(tournaments.map(g => g.lineKind).sort(), ['cost', 'funding']);
    assert.equal(view.revenueTotals?.total, 1500);
    assert.equal(view.balance.seasonNet, 1500 - 3000);
  });

  it('sorts FIRST, whatever order the lines arrived in — and in the picker\'s order among themselves', () => {
    const view = buildPeriodView([
      line('s', 'Sponsor', 200, [], { funding: true, category: 'Sponsorship' }),
      line('f', 'Chocolate drive', 1000, [], { funding: true, category: 'Fundraising' }),
      line('a', 'Entry fees', 3000, [], { category: 'Tournaments' }),
      line('b', 'Gear', 500, [], { category: 'Equipment' }),
    ], 'months');
    assert.deepEqual(view.groups.map(g => g.lineKind), ['funding', 'funding', 'cost', 'cost']);
    // Money-in categories first, alphabetical when no picker order is handed in; then the cost
    // categories alphabetical (the List's rule)…
    assert.deepEqual(view.groups.map(g => g.name), ['Fundraising', 'Sponsorship', 'Equipment', 'Tournaments']);
    // …and in the picker's own order when one is. Name-keyed lines carry no id to look up, so the
    // order is pinned through id-carrying lines here.
    const ordered = buildPeriodView([
      { ...line('s', 'Sponsor', 200, [], { funding: true, category: 'Sponsorship' }), categoryId: 'cat-s' },
      { ...line('f', 'Chocolate drive', 1000, [], { funding: true, category: 'Fundraising' }), categoryId: 'cat-f' },
    ], 'months', { categoryOrder: new Map([['cat-s', 1], ['cat-f', 2]]) });
    assert.deepEqual(ordered.groups.map(g => g.name), ['Sponsorship', 'Fundraising']);
  });
});

describe('grouping and totals', () => {
  it('groups costs by category, categories alphabetical — the List\'s own ordering', () => {
    // ⚠ One ordering rule in both views (P1, 2026-09-02): this view used to keep insertion order
    // while the List sorted alphabetically, so toggling views reshuffled the plan.
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 3000]], { category: 'Tournaments' }),
      line('b', 'Gear', 1000, [['2027-01-01', 1000]], { category: 'Equipment' }),
      line('c', 'Uniforms', 2000, [['2027-02-01', 2000]], { category: 'Tournaments' }),
    ], 'months');
    assert.deepEqual(view.groups.map(g => g.name), ['Equipment', 'Tournaments']);
    assert.equal(view.groups[1].rows.length, 2);
    assert.equal(view.groups[1].total, 5000);
    assert.equal(view.groups[1].cells['2027-01'], 3000);
    assert.equal(view.groups[1].cells['2027-02'], 2000);
  });

  it('sorts a category\'s rows alphabetically by item', () => {
    const view = buildPeriodView([
      line('a', 'Umpire Fees', 600, [['2027-04-01', 600]]),
      line('b', 'Entry Fees', 1600, [['2027-04-01', 1600]]),
    ], 'months');
    assert.deepEqual(view.groups[0].rows.map(r => r.description), ['Entry Fees', 'Umpire Fees']);
  });

  it('files an uncategorized line under one heading rather than dropping it', () => {
    const view = buildPeriodView([
      line('a', 'Something', 500, [], { category: null }),
    ], 'months');
    // ⚠ The one spelling every surface uses (2026-09-09) — it read "Uncategorized" here while the
    // List and the Statement said "No category" for the same lines.
    assert.equal(view.groups[0].name, NO_CATEGORY_LABEL);
    assert.equal(view.expenseTotals.total, 500);
  });

  it('every column sums to the same money the plan holds', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 1000], ['2027-02-01', 2000]]),
      line('b', 'Uniforms', 2000, []),
      line('f', 'Fundraising', 1000, [['2027-02-01', 1000]], { funding: true }),
    ], 'months');
    const sum = (cells: Record<string, number>) =>
      Math.round(Object.values(cells).reduce((s, n) => s + n, 0) * 100) / 100;
    assert.equal(sum(view.expenseTotals.cells), view.expenseTotals.total);
    assert.equal(sum(view.revenueTotals!.cells), view.revenueTotals!.total);
    assert.equal(view.expenseTotals.total, 5000);
    assert.equal(view.revenueTotals!.total, 1000);
    // And the season net IS revenue − expenses, undated money included.
    assert.equal(view.balance.seasonNet, -4000);
  });

  it('handles an empty plan without inventing a column', () => {
    const view = buildPeriodView([], 'months');
    assert.deepEqual(view.columns, []);
    assert.deepEqual(view.groups, []);
    assert.equal(view.expenseTotals.total, 0);
    assert.equal(view.revenueTotals, null);
    assert.equal(view.balance.seasonClosing, 0);
    assert.equal(view.balance.openingUnset, true);
    assert.equal(view.hasUnscheduled, false);
  });
});

describe('the merge — two lines on one item are one row (P1, 2026-09-02)', () => {
  it('sums same-item lines into one row and counts them', () => {
    // The twins defect this whole build answers: two "Entry Fees" lines rendered as
    // indistinguishable rows because the item names the row and both carry the same item.
    const view = buildPeriodView([
      line('a', 'Entry Fees', 1600, [['2027-04-01', 1600]], { itemId: 'item-entry' }),
      line('b', 'Entry Fees', 900, [['2027-05-01', 900]], { itemId: 'item-entry' }),
    ], 'months');
    assert.equal(view.groups[0].rows.length, 1);
    const row = view.groups[0].rows[0];
    assert.equal(row.description, 'Entry Fees');
    assert.equal(row.lineCount, 2);
    assert.equal(row.total, 2500);
    assert.equal(row.cells['2027-04'], 1600);
    assert.equal(row.cells['2027-05'], 900);
  });

  it('merges by item ID, never by name — same-name items across sources stay two rows', () => {
    // The club's "Entry Fees" and the team's own are legitimately two items (Q7 territory).
    const view = buildPeriodView([
      line('a', 'Entry Fees', 1600, [], { itemId: 'club-entry' }),
      line('b', 'Entry Fees', 900, [], { itemId: 'team-entry' }),
    ], 'months');
    assert.equal(view.groups[0].rows.length, 2);
    assert.ok(view.groups[0].rows.every(r => r.lineCount === 1));
  });

  it('merges an unscheduled line into its dated sibling\'s row', () => {
    const view = buildPeriodView([
      line('a', 'Dome Time', 3000, [['2027-01-01', 3000]], { itemId: 'item-dome' }),
      line('b', 'Dome Time', 1200, [], { itemId: 'item-dome' }),
    ], 'months');
    const row = view.groups[0].rows[0];
    assert.equal(row.total, 4200);
    assert.equal(row.cells['2027-01'], 3000);
    assert.equal(row.cells[UNSCHEDULED], 1200);
    assert.equal(view.hasUnscheduled, true);
  });

  it('folds legacy item-less COST lines into "Not itemized", sorted last — the List\'s rule', () => {
    const view = buildPeriodView([
      line('a', 'Old line one', 500, [], { itemId: null }),
      line('b', 'Old line two', 300, [], { itemId: null }),
      line('c', 'Entry Fees', 1600, [['2027-04-01', 1600]]),
    ], 'months');
    const rows = view.groups[0].rows;
    assert.deepEqual(rows.map(r => r.description), ['Entry Fees', 'Not itemized']);
    assert.equal(rows[1].lineCount, 2);
    assert.equal(rows[1].total, 800);
  });

  it('keeps item-less MONEY-IN lines one row per line — their description is all the name they have', () => {
    const view = buildPeriodView([
      line('f', 'Chocolate Sale', 1800, [], { funding: true, itemId: null }),
      line('g', 'Bottle Drive', 900, [], { funding: true, itemId: null }),
    ], 'months');
    const fundingGroup = view.groups.find(g => g.lineKind === 'funding')!;
    assert.equal(fundingGroup.rows.length, 2);
    assert.deepEqual(fundingGroup.rows.map(r => r.description), ['Chocolate Sale', 'Bottle Drive']);
  });

  it('merges same-item money-in lines too, signed', () => {
    const view = buildPeriodView([
      line('f', 'Team Sponsorship', 1500, [['2027-02-01', 1500]], { funding: true, itemId: 'item-sponsor' }),
      line('g', 'Team Sponsorship', 500, [], { funding: true, itemId: 'item-sponsor' }),
    ], 'months');
    const fundingGroup = view.groups.find(g => g.lineKind === 'funding')!;
    assert.equal(fundingGroup.rows.length, 1);
    assert.equal(fundingGroup.rows[0].lineCount, 2);
    assert.equal(fundingGroup.rows[0].total, -2000);
    assert.equal(fundingGroup.rows[0].cells['2027-02'], -1500);
    assert.equal(fundingGroup.rows[0].cells[UNSCHEDULED], -500);
  });

  it('a merged row\'s cells still sum to its own total', () => {
    const view = buildPeriodView([
      line('a', 'Entry Fees', 1000.01, [['2027-04-01', 500.01], ['2027-05-01', 500.00]], { itemId: 'item-entry' }),
      line('b', 'Entry Fees', 899.99, [], { itemId: 'item-entry' }),
    ], 'months');
    const row = view.groups[0].rows[0];
    const summed = Object.values(row.cells).reduce((s, n) => s + n, 0);
    assert.equal(Math.round(summed * 100) / 100, Math.round(row.total * 100) / 100);
  });
});

/**
 * **THE ROW SAYS WHICH LINE IT IS, SO THE GRID CAN OPEN IT** (owner, 2026-09-10: *"should I be
 * able to click a number in the report and open up the edit modal? why am I only allowed to edit
 * on the list view?"*).
 *
 * ⚠⚠ THE WHOLE POINT IS THAT `row.id` COULD NOT DO THIS. It is `group|rowKey` — a name for a
 * POSITION in this view, matching no record in the database. The month grid built a door out of
 * exactly that composite once: the cell handed the budget page an id, the page found nothing, and
 * it returned in silence. So `lineId` is carried deliberately, and it is `null` — never a guess —
 * wherever a row genuinely stands for more than one line.
 */
describe('lineId — the door a row can honestly open', () => {
  it('names the one line behind an item row', () => {
    const view = buildPeriodView([
      line('line-dome', 'Dome Time', 5200, [['2027-03-01', 5200]]),
    ], 'months');
    const row = view.groups[0].rows[0];
    assert.equal(row.lineId, 'line-dome');
    // ⚠ And it is emphatically NOT the row id, which is what a door must never be built from.
    assert.notEqual(row.lineId, row.id);
  });

  it('names it on a money-in row too — a funding line opens the same form a cost line does', () => {
    const view = buildPeriodView([
      line('line-sponsor', 'Team Sponsorship', 1500, [['2027-02-01', 1500]], { funding: true }),
    ], 'months');
    const fundingGroup = view.groups.find(g => g.lineKind === 'funding')!;
    assert.equal(fundingGroup.rows[0].lineId, 'line-sponsor');
  });

  it('names it on an item-less MONEY-IN row, which is one line wearing its own description', () => {
    const view = buildPeriodView([
      line('line-choc', 'Chocolate Sale', 1800, [], { funding: true, itemId: null }),
    ], 'months');
    const fundingGroup = view.groups.find(g => g.lineKind === 'funding')!;
    assert.equal(fundingGroup.rows[0].lineId, 'line-choc');
  });

  it('⚠ refuses to name one for "Not itemized" — that bucket stands for several word-less lines', () => {
    const view = buildPeriodView([
      line('a', 'Old line one', 500, [], { itemId: null }),
      line('b', 'Old line two', 300, [], { itemId: null }),
      line('c', 'Entry Fees', 1600, [['2027-04-01', 1600]]),
    ], 'months');
    const rows = view.groups[0].rows;
    const bucket = rows.find(r => r.description === 'Not itemized')!;
    assert.equal(bucket.lineId, null);
    // The real row beside it still opens, so the null above is a decision and not a failure.
    assert.equal(rows.find(r => r.description === 'Entry Fees')!.lineId, 'c');
  });

  it('⚠ gives a bucket of ONE word-less line no door either — the row is the bucket, not the line', () => {
    /* A single legacy line still renders under the "Not itemized" heading rather than its own
       typed description, so a door here would open a form whose name matches nothing on screen.
       The row names the bucket; only the List names those lines. */
    const view = buildPeriodView([
      line('a', 'Old line one', 500, [], { itemId: null }),
    ], 'months');
    const bucket = view.groups[0].rows[0];
    assert.equal(bucket.description, 'Not itemized');
    assert.equal(bucket.lineId, null);
  });

  it('⚠⚠ drops the name when a twin merges in, rather than opening whichever line it saw first', () => {
    /* One word carries one line since migration 286 and a partial unique index enforces it, so
       this shape should not reach the view at all. It is guarded anyway because the failure is
       SILENT: the door would work, open a real form, and edit the wrong half of the row's figure. */
    const view = buildPeriodView([
      line('a', 'Entry Fees', 1600, [['2027-04-01', 1600]], { itemId: 'item-entry' }),
      line('b', 'Entry Fees', 900, [['2027-05-01', 900]], { itemId: 'item-entry' }),
    ], 'months');
    const row = view.groups[0].rows[0];
    assert.equal(row.lineCount, 2);
    assert.equal(row.lineId, null);
  });
});

/**
 * THE CLOSE (owner decisions A–D, 2026-09-12 — COACH_BUDGET_REVENUE_FIRST_PLAN.md, replacing the
 * Costs-less-funding → Player installments → Shortfall (Buffer) ladder of §164).
 *
 * The plan's two views close on one BALANCE: Opening + Net = Closing, walked by Budget vs.
 * Actual's own `buildCashFlow` at month resolution whatever the display shows. These tests are
 * the plan's §8 list: both estimate branches, a negative undated dues remainder, a quarter hiding
 * a negative month, `seasonNet === revenue − expenses`, an opening never set, the shortfall found
 * from months under quarters, a truncated range, and the trial.
 */
describe('the estimate, shown rather than apologised for (kept as built — decision A)', () => {
  const LINES = [
    line('a', 'Entry fees', 3000, [['2027-01-01', 3000]]),
    line('f', 'Fundraising', 1000, [['2027-01-01', 1000]], { funding: true, category: 'Fundraising' }),
  ];

  it('puts the un-itemized remainder in No date yet, so Total expenses IS the estimate and the close nets it', () => {
    const view = buildPeriodView(LINES, 'months', { estimatedTotal: 4000 });
    assert.equal(view.estimateRows?.linesSoFar.total, 3000);
    assert.equal(view.estimateRows?.remainder.total, 1000);
    assert.equal(view.estimateRows?.remainder.cells[UNSCHEDULED], 1000);
    // The subtotal is the estimate — the tile's figure, the helper's basis, BvA's Budget basis.
    assert.equal(view.expenseTotals.total, 4000);
    assert.equal(view.expenseTotals.cells[UNSCHEDULED], 1000);
    assert.equal(view.hasUnscheduled, true);
    // The remainder reaches the season net and no month: January nets 1,000 − 3,000, the season
    // nets 1,000 − 4,000. The last dated closing and the season closing differ by exactly it.
    assert.equal(view.balance.net['2027-01'], -2000);
    assert.equal(view.balance.closing['2027-01'], -2000);
    assert.equal(view.balance.undatedNet, -1000);
    assert.equal(view.balance.seasonNet, -3000);
    assert.equal(view.balance.seasonClosing, -3000);
  });

  it('⚠ the other branch — lines above the estimate leave a NEGATIVE, line-less No date yet cell (plan §4 edge case)', () => {
    // Every cost line here is fully dated: nothing else sits in No date yet, so the netted
    // adjustment has no undated line to offset and must stand alone as a negative in that column.
    const view = buildPeriodView(LINES, 'months', { estimatedTotal: 2000 });
    assert.equal(view.estimateRows?.remainder.total, -1000);
    assert.equal(view.estimateRows?.remainder.cells[UNSCHEDULED], -1000);
    assert.equal(view.hasUnscheduled, true);
    assert.equal(view.columns[0].key, UNSCHEDULED);
    // Total expenses IS the estimate — the lower figure governs (decision A) — and the column adds:
    // 3,000 dated − 1,000 undated = 2,000.
    assert.equal(view.expenseTotals.total, 2000);
    assert.equal(view.expenseTotals.cells[UNSCHEDULED], -1000);
    assert.equal(view.expenseTotals.cells['2027-01'], 3000);
    // The undated NET is then POSITIVE (an expense reversal), the season nets 1,000 − 2,000, and
    // the dated January is unaffected — the true $3,000 still lands there.
    assert.equal(view.balance.undatedNet, 1000);
    assert.equal(view.balance.closing['2027-01'], -2000);
    assert.equal(view.balance.seasonNet, -1000);
  });

  it('adds no rows when the estimate matches the lines, or when none is set', () => {
    assert.equal(buildPeriodView(LINES, 'months', { estimatedTotal: 3000 }).estimateRows, null);
    assert.equal(buildPeriodView(LINES, 'months').estimateRows, null);
    // A rounding tail is not a difference — the same half-cent deadband the List uses.
    assert.equal(buildPeriodView(LINES, 'months', { estimatedTotal: 3000.004 }).estimateRows, null);
  });
});

describe('player installments — the Revenue band\'s first row, its own field', () => {
  const LINES = [
    line('a', 'Entry fees', 3000, [['2027-01-01', 2000], ['2027-02-01', 1000]]),
    line('f', 'Fundraising', 500, [['2027-01-01', 500]], { funding: true, category: 'Fundraising' }),
  ];

  it('spreads the schedule by due date as its own field — never a category group', () => {
    const view = buildPeriodView(LINES, 'months', {
      dues: { assessed: 2000, installments: [
        { date: '2027-01-15', amount: 1200 },
        { date: '2027-02-15', amount: 800 },
      ] },
    });
    const row = view.installments!;
    // Stored POSITIVE — unlike a money-in line's group, which is signed — because it never went
    // through a line's sign; the panel renders it signed rather than abs()ing it (§164 finding #2).
    assert.equal(row.cells['2027-01'], 1200);
    assert.equal(row.cells['2027-02'], 800);
    assert.equal(row.total, 2000);
    // `groups` holds the CATEGORIES only — a renderer places the derived row itself (`/simplify`
    // 2026-09-12: three call sites were finding it by a sentinel key). Money in first, then costs.
    assert.deepEqual(view.groups.map(g => g.name), ['Fundraising', 'Tournaments']);
    // And it is IN the revenue subtotal: Jan 1,200 + 500, Feb 800.
    assert.equal(view.revenueTotals?.cells['2027-01'], 1700);
    assert.equal(view.revenueTotals?.cells['2027-02'], 800);
    assert.equal(view.revenueTotals?.total, 2500);
    // Jan: 1,700 in − 2,000 out = (300); Feb: 800 − 1,000 = (200); closing (500) — the season's net.
    assert.equal(view.balance.net['2027-01'], -300);
    assert.equal(view.balance.closing['2027-01'], -300);
    assert.equal(view.balance.closing['2027-02'], -500);
    assert.equal(view.balance.seasonNet, -500);
  });

  it('⚠ puts what the dated installments do not cover in No date yet, so the row totals the List figure', () => {
    // A schedule's total is checked against its installments on the manual POST path only, so the
    // two genuinely differ in production. Dropping the difference would make this row disagree
    // with the tile above it — the exact defect class this work closes.
    const view = buildPeriodView(LINES, 'months', {
      dues: { assessed: 2000, installments: [{ date: '2027-01-15', amount: 1200 }] },
    });
    assert.equal(view.installments?.cells[UNSCHEDULED], 800);
    assert.equal(view.installments?.total, 2000);
    assert.equal(view.hasUnscheduled, true);
    // The undated 800 reaches the season net and no month.
    assert.equal(view.balance.undatedNet, 800);
    assert.equal(view.balance.seasonNet, 2000 + 500 - 3000);
    // A schedule with a total and no instalments at all still draws the row, wholly undated.
    const bare = buildPeriodView(LINES, 'months', { dues: { assessed: 900, installments: [] } });
    assert.equal(bare.installments?.cells[UNSCHEDULED], 900);
    assert.equal(bare.installments?.total, 900);
  });

  it('⚠ widens the columns to reach a due date the plan does not have', () => {
    // A June instalment on a plan whose last bill falls in February. Bucketed into the nearest
    // existing column — or dropped — the grid would print a Total its columns do not add to.
    const view = buildPeriodView(LINES, 'months', {
      dues: { assessed: 500, installments: [{ date: '2027-06-10', amount: 500 }] },
    });
    assert.equal(view.columns.some(c => c.key === '2027-06'), true);
    assert.equal(view.installments?.cells['2027-06'], 500);
    // The balance walks the empty months between: March–May carry February's close forward.
    assert.equal(view.balance.opening['2027-04'], view.balance.closing['2027-02']);
    assert.equal(view.balance.net['2027-06'], 500);
  });

  it('draws no installments row before dues are set — the helper under the table carries that', () => {
    const view = buildPeriodView(LINES, 'months');
    assert.equal(view.installments, null);
    // A zero schedule is still a schedule (an explicit $0 after adjustments): the row draws.
    const zero = buildPeriodView(LINES, 'months', { dues: { assessed: 0, installments: [] } });
    assert.notEqual(zero.installments, null);
    assert.equal(zero.installments?.total, 0);
  });

  it('⚠ a schedule lowered after its instalments existed carries the overshoot as a NEGATIVE undated cell', () => {
    /* The state the adjustment work makes routine: the schedule's own total comes down, the dated
       instalments already generated do not. The chunks then sum to MORE than the plan's figure,
       and the undated cell has to carry a negative — the row's Total is the plan's number either
       way, and the cells sum to it. Rendered through a money-in path that absolute-values every
       cell, the −400 printed as 400 and the row stopped adding up (§164 /review finding #2). */
    const view = buildPeriodView([line('a', 'Entry fees', 3000, [['2027-01-01', 3000]])], 'months', {
      dues: { assessed: 1000, installments: [{ date: '2027-01-15', amount: 1400 }] },
    });
    const row = view.installments!;
    assert.equal(row.cells['2027-01'], 1400);
    assert.equal(row.cells[UNSCHEDULED], -400);
    assert.equal(row.total, 1000);
    const sum = Object.values(row.cells).reduce((s, n) => s + n, 0);
    assert.equal(Math.round(sum * 100) / 100, row.total);
    // January banks the 1,400 that is actually scheduled there; the season nets the plan's 1,000.
    assert.equal(view.balance.net['2027-01'], 1400 - 3000);
    assert.equal(view.balance.seasonNet, 1000 - 3000);
  });
});

describe('the balance — Opening + Net = Closing, walked from months (decisions A–D)', () => {
  const LINES = [
    line('a', 'Ice', 6000, [['2026-09-01', 6000]]),
    line('b', 'Ice', 3000, [['2026-10-01', 3000]], { itemId: 'item-ice-oct' }),
    line('c', 'Ice', 4000, [['2026-11-01', 4000]], { itemId: 'item-ice-nov' }),
    line('d', 'Ice', 1000, [['2026-12-01', 1000]], { itemId: 'item-ice-dec' }),
    line('s', 'Sponsor', 2000, [['2026-10-01', 2000]], { funding: true, category: 'Sponsorship' }),
  ];
  const DUES = { assessed: 12000, installments: [
    { date: '2026-09-15', amount: 4000 },
    { date: '2026-10-15', amount: 4000 },
    { date: '2026-11-15', amount: 4000 },
  ] };

  it('reproduces the mockup fixture: opening 1,000, September short, the season 1,000 up', () => {
    const view = buildPeriodView(LINES, 'months', { dues: DUES, openingBalance: 1000 });
    assert.equal(view.balance.openingUnset, false);
    assert.equal(view.balance.seasonOpening, 1000);
    assert.equal(view.balance.opening['2026-09'], 1000);
    assert.deepEqual(
      ['2026-09', '2026-10', '2026-11', '2026-12'].map(m => view.balance.closing[m]),
      [-1000, 2000, 2000, 1000],
    );
    assert.equal(view.balance.net['2026-09'], -2000);
    assert.equal(view.balance.seasonNet, 14000 - 14000);
    assert.equal(view.balance.seasonClosing, 1000);
    // Each dated column reads opening + net = closing, and each month opens on the last close.
    for (const m of ['2026-09', '2026-10', '2026-11', '2026-12']) {
      assert.equal(
        Math.round((view.balance.opening[m] + view.balance.net[m]) * 100) / 100,
        view.balance.closing[m], m,
      );
    }
    assert.equal(view.balance.opening['2026-10'], view.balance.closing['2026-09']);
    // The one month below zero is named, from the months — and the lowest closing, its sibling.
    assert.deepEqual(view.balance.shortfall, { monthKey: '2026-09', amount: 1000 });
    assert.equal(view.balance.lowestClosing, -1000);
    assert.equal(view.hasNegative, true);
  });

  it('⚠⚠ seasonNet === revenue − expenses, to the cent, undated money included', () => {
    const view = buildPeriodView([
      ...LINES,
      line('u', 'Bus', 333.33, [], { itemId: 'item-bus' }),
      line('p', 'Pledge', 100.1, [], { funding: true, category: 'Sponsorship', itemId: 'item-pledge' }),
    ], 'months', { estimatedTotal: 15000, dues: { assessed: 12500, installments: DUES.installments }, openingBalance: 250.25 });
    const expected = Math.round((view.revenueTotals!.total - view.expenseTotals.total) * 100) / 100;
    assert.equal(view.balance.seasonNet, expected);
    assert.equal(view.balance.seasonClosing, Math.round((250.25 + expected) * 100) / 100);
    // And the season's net is the months plus the undated column — nothing else.
    const months = view.balance.months.reduce((s, r) => s + r.net, 0);
    assert.equal(Math.round((months + (view.balance.undatedNet ?? 0)) * 100) / 100, view.balance.seasonNet);
  });

  it('a quarter opens on its first month, closes on its last, sums the flows — and still flags the month inside it', () => {
    const view = buildPeriodView(LINES, 'quarters', { dues: DUES, openingBalance: 1000 });
    assert.deepEqual(view.columns.map(c => c.key), ['2026-Q3', '2026-Q4']);
    // Q3 is September alone: opening 1,000, net (2,000), closing (1,000).
    assert.equal(view.balance.opening['2026-Q3'], 1000);
    assert.equal(view.balance.net['2026-Q3'], -2000);
    assert.equal(view.balance.closing['2026-Q3'], -1000);
    // Q4 = Oct + Nov + Dec: opens on September's close, nets +3,000 −2,000 +... = 2,000, closes 1,000.
    assert.equal(view.balance.opening['2026-Q4'], -1000);
    assert.equal(view.balance.net['2026-Q4'], 2000);
    assert.equal(view.balance.closing['2026-Q4'], 1000);
    // ⚠ A NEGATIVE MONTH HIDDEN INSIDE A POSITIVE QUARTER IS STILL FOUND (decision B): revise the
    // fixture so Q3 nets positive overall but a month within Q4 dips — the shortfall names the
    // MONTH, and it is computed from the monthly series whatever the display shows.
    const revised = buildPeriodView(LINES, 'quarters', {
      openingBalance: 1000,
      dues: { assessed: 12000, installments: [
        { date: '2026-09-15', amount: 6000 },
        { date: '2026-10-15', amount: 1000 },
        { date: '2026-12-15', amount: 5000 },
      ] },
    });
    // Sep +1,000 → Oct +1,000 → Nov (3,000) → Dec +1,000: Q4 closes above zero, November does not.
    assert.equal(revised.balance.closing['2026-Q4'], 1000);
    assert.deepEqual(revised.balance.shortfall, { monthKey: '2026-11', amount: 3000 });
    assert.equal(revised.balance.months.find(m => m.monthKey === '2026-11')?.closing, -3000);
    // The monthly series is the same series the Months view walks.
    const months = buildPeriodView(LINES, 'months', { openingBalance: 1000, dues: revised.installments && {
      assessed: 12000, installments: [
        { date: '2026-09-15', amount: 6000 }, { date: '2026-10-15', amount: 1000 }, { date: '2026-12-15', amount: 5000 },
      ] } });
    assert.deepEqual(months.balance.months, revised.balance.months);
  });

  it('NULL ≠ ZERO — an opening never set walks from 0 and says so; an explicit 0 does not', () => {
    const unset = buildPeriodView(LINES, 'months', { dues: DUES });
    assert.equal(unset.balance.openingUnset, true);
    assert.equal(unset.balance.seasonOpening, 0);
    assert.equal(unset.balance.closing['2026-09'], -2000);
    const zero = buildPeriodView(LINES, 'months', { dues: DUES, openingBalance: 0 });
    assert.equal(zero.balance.openingUnset, false);
    assert.equal(zero.balance.seasonOpening, 0);
    // A negative opening is a real state (a season starting in the hole) and walks like any other.
    const hole = buildPeriodView(LINES, 'months', { dues: DUES, openingBalance: -500 });
    assert.equal(hole.balance.opening['2026-09'], -500);
    assert.equal(hole.balance.closing['2026-09'], -2500);
    assert.equal(hole.balance.seasonClosing, -500);
  });

  it('before dues exist the balance is simply deeply negative — the honest answer, never hidden', () => {
    const view = buildPeriodView(LINES, 'months', { openingBalance: 1000 });
    assert.equal(view.installments, null);
    assert.equal(view.revenueTotals?.total, 2000);
    assert.deepEqual(
      ['2026-09', '2026-10', '2026-11', '2026-12'].map(m => view.balance.closing[m]),
      [-5000, -6000, -10000, -11000],
    );
    assert.equal(view.balance.seasonClosing, -11000);
    assert.deepEqual(view.balance.shortfall, { monthKey: '2026-09', amount: 5000 });
  });

  it('an over-funded plan closes positive without deriving anything negative', () => {
    const view = buildPeriodView([
      ...LINES.filter(l => !l.lineKind || l.lineKind === 'cost'),
      line('big', 'Title sponsor', 15000, [['2026-09-01', 15000]], { funding: true, category: 'Sponsorship' }),
    ], 'months', { openingBalance: 1000 });
    assert.equal(view.balance.seasonClosing, 1000 + 15000 - 14000);
    assert.equal(view.balance.shortfall, null);
    assert.ok(view.balance.months.every(m => m.closing >= 0));
    // Still a legend: the later months NET negative (bills, no receipts) even though every closing
    // stays above zero — and the legend explains Net's brackets as well as Closing's.
    assert.equal(view.balance.net['2026-11'], -4000);
    assert.equal(view.hasNegative, true);
  });

  it('hasNegative answers for the BALANCE rows only — a plain plan with no negative net or closing is quiet', () => {
    // Revenue covers every month from the first: nothing prints a bracket.
    const covered = buildPeriodView([
      line('a', 'Ice', 1000, [['2027-01-01', 1000]]),
      line('f', 'Sponsor', 1500, [['2027-01-01', 1500]], { funding: true, category: 'Sponsorship' }),
    ], 'months');
    assert.equal(covered.hasNegative, false);
    // A month whose net is negative but whose closing stays positive still needs the legend (Net
    // brackets) — the legend explains both rows.
    const dip = buildPeriodView([
      line('a', 'Ice', 1000, [['2027-02-01', 1000]]),
      line('f', 'Sponsor', 1500, [['2027-01-01', 1500]], { funding: true, category: 'Sponsorship' }),
    ], 'months');
    assert.equal(dip.balance.net['2027-02'], -1000);
    assert.equal(dip.balance.closing['2027-02'], 500);
    assert.equal(dip.hasNegative, true);
  });

  it('⚠ a truncated range: money past the window is in the Total and in no month — never pretended early', () => {
    const view = buildPeriodView([
      line('a', 'Near', 1000, [['2027-01-01', 1000]]),
      line('b', 'Far', 500, [['2031-01-01', 500]], { itemId: 'item-far' }),
      line('f', 'Sponsor', 2000, [['2027-01-01', 2000]], { funding: true, category: 'Sponsorship' }),
    ], 'months', { openingBalance: 0 });
    assert.equal(view.truncated, true);
    // The DISPLAY folds the far 500 into the last column (every row adds to its Total)…
    const last = view.columns[view.columns.length - 1].key;
    assert.equal(view.expenseTotals.cells[last], 500);
    // …but the WALK does not charge it to that month: the last month's closing carries January's
    // 1,000 forward untouched, while the season net still counts it.
    assert.equal(view.balance.closing[last], 1000);
    assert.equal(view.balance.seasonNet, 2000 - 1500);
    assert.equal(view.balance.seasonClosing, 500);
    assert.equal(view.balance.shortfall, null);
  });
});

describe('the trial — "could we add another expense?" (decision D)', () => {
  const LINES = [
    line('a', 'Ice', 6000, [['2026-09-01', 6000]]),
    line('b', 'Ice', 3000, [['2026-10-01', 3000]], { itemId: 'item-ice-oct' }),
    line('c', 'Ice', 4000, [['2026-11-01', 4000]], { itemId: 'item-ice-nov' }),
    line('d', 'Ice', 1000, [['2026-12-01', 1000]], { itemId: 'item-ice-dec' }),
    line('s', 'Sponsor', 2000, [['2026-10-01', 2000]], { funding: true, category: 'Sponsorship' }),
  ];
  const DUES = { assessed: 12000, installments: [
    { date: '2026-09-15', amount: 6000 },
    { date: '2026-10-15', amount: 3000 },
    { date: '2026-11-15', amount: 3000 },
  ] };

  it('is its own field — never a category group — and moves every later balance', () => {
    const base = buildPeriodView(LINES, 'months', { dues: DUES, openingBalance: 1000 });
    const view = buildPeriodView(LINES, 'months', { dues: DUES, openingBalance: 1000, trial: { amount: 600, date: '2026-10-01' } });
    assert.equal(base.trial, null);
    assert.equal(view.trial?.cells['2026-10'], 600);
    assert.equal(view.trial?.total, 600);
    // The category groups are untouched by a trial — it is folded into the subtotals, not filed.
    assert.deepEqual(view.groups.map(g => g.name), base.groups.map(g => g.name));
    // The mockup's own numbers: Oct/Nov/Dec 3,000 / 2,000 / 1,000 become 2,400 / 1,400 / 400.
    assert.deepEqual(['2026-10', '2026-11', '2026-12'].map(m => base.balance.closing[m]), [3000, 2000, 1000]);
    assert.deepEqual(['2026-10', '2026-11', '2026-12'].map(m => view.balance.closing[m]), [2400, 1400, 400]);
    assert.equal(view.balance.closing['2026-09'], base.balance.closing['2026-09']);
    assert.equal(view.expenseTotals.total, base.expenseTotals.total + 600);
    assert.equal(view.balance.seasonClosing, base.balance.seasonClosing - 600);
  });

  it('consumes a "Still to itemize" allowance first — dating part of a reserved amount changes timing, not the total', () => {
    const base = buildPeriodView(LINES, 'months', { estimatedTotal: 16000, dues: DUES, openingBalance: 1000 });
    assert.equal(base.estimateRows?.remainder.total, 2000);
    const inside = buildPeriodView(LINES, 'months', { estimatedTotal: 16000, dues: DUES, openingBalance: 1000, trial: { amount: 600, date: '2026-10-01' } });
    assert.equal(inside.estimateRows?.remainder.total, 1400);
    assert.equal(inside.expenseTotals.total, 16000);
    assert.equal(inside.balance.seasonClosing, base.balance.seasonClosing);
    // October still moves: the trial is dated, the allowance it came out of was not.
    assert.equal(inside.balance.closing['2026-10'], base.balance.closing['2026-10'] - 600);
    // Past the allowance, the excess raises Total expenses.
    const over = buildPeriodView(LINES, 'months', { estimatedTotal: 16000, dues: DUES, openingBalance: 1000, trial: { amount: 2500, date: '2026-10-01' } });
    assert.equal(over.estimateRows?.remainder.total, -500);
    assert.equal(over.expenseTotals.total, 16000);
    // ⚠ Total expenses stays the estimate (decision A) even here: the trial pushed the lines OVER
    // it, and the plan says so in red rather than raising the total.
    assert.equal(over.balance.seasonClosing, base.balance.seasonClosing);
  });

  it('with no date lands in No date yet; with a new date widens the columns; a zero trial is no trial', () => {
    const undated = buildPeriodView(LINES, 'months', { dues: DUES, trial: { amount: 250, date: null } });
    assert.equal(undated.trial?.cells[UNSCHEDULED], 250);
    assert.equal(undated.hasUnscheduled, true);
    assert.equal(undated.balance.undatedNet, -250);
    const far = buildPeriodView(LINES, 'months', { dues: DUES, trial: { amount: 250, date: '2027-02-01' } });
    assert.equal(far.columns.some(c => c.key === '2027-02'), true);
    assert.equal(far.balance.net['2027-02'], -250);
    const none = buildPeriodView(LINES, 'months', { dues: DUES, trial: { amount: 0, date: '2026-10-01' } });
    assert.equal(none.trial, null);
  });

  it('a trial that creates a later shortage is found — the mockup\'s $1,100 December case', () => {
    const view = buildPeriodView(LINES, 'months', { dues: DUES, openingBalance: 1000, trial: { amount: 1100, date: '2026-12-01' } });
    assert.deepEqual(view.balance.shortfall, { monthKey: '2026-12', amount: 100 });
  });
});
