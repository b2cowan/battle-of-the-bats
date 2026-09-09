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
    assert.equal(months.totals.total, quarters.totals.total);
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
    assert.equal(view.totals.total, 5000);
    // No money in → no Funding band to draw (owner ruling 2026-09-08); Planned costs IS the close.
    assert.equal(view.fundingTotals, null);
    assert.equal(view.costTotals.total, 5000);
    // No estimate passed → nothing to differ from.
    assert.equal(view.estimateDiffers, false);
  });
});

describe('funding', () => {
  it('subtracts down every column and closes with what players fund', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 3000]]),
      line('f', 'Fundraising', 1000, [['2027-01-01', 1000]], { funding: true, category: 'Fundraising' }),
    ], 'months');
    // Bare noun (owner ruling 2026-09-08): the band above it already says Funding.
    assert.equal(view.groups[1].name, 'Fundraising');
    assert.equal(view.groups[1].rows[0].cells['2027-01'], -1000);
    assert.equal(view.totals.cells['2027-01'], 2000);
    assert.equal(view.totals.total, 2000);
    // The two subtotals the grid prints, built in the same pass as the close, so they add up to it
    // column by column: Planned costs + Planned funding (signed) = Costs less funding.
    assert.equal(view.costTotals.cells['2027-01'], 3000);
    assert.equal(view.costTotals.total, 3000);
    assert.equal(view.fundingTotals?.cells['2027-01'], -1000);
    assert.equal(view.fundingTotals?.total, -1000);
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
    assert.equal(view.totals.total, 3000 - 1500);
  });

  it('sorts last, whatever order the lines arrived in — and in the picker\'s order among themselves', () => {
    const view = buildPeriodView([
      line('s', 'Sponsor', 200, [], { funding: true, category: 'Sponsorship' }),
      line('f', 'Chocolate drive', 1000, [], { funding: true, category: 'Fundraising' }),
      line('a', 'Entry fees', 3000, [], { category: 'Tournaments' }),
      line('b', 'Gear', 500, [], { category: 'Equipment' }),
    ], 'months');
    assert.deepEqual(view.groups.map(g => g.lineKind), ['cost', 'cost', 'funding', 'funding']);
    // Cost categories alphabetical (the List's rule); the money-in categories after them, alphabetical
    // when no picker order is handed in…
    assert.deepEqual(view.groups.map(g => g.name), ['Equipment', 'Tournaments', 'Fundraising', 'Sponsorship']);
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
    assert.equal(view.totals.total, 500);
  });

  it('every column sums to the same money the plan holds', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 1000], ['2027-02-01', 2000]]),
      line('b', 'Uniforms', 2000, []),
      line('f', 'Fundraising', 1000, [['2027-02-01', 1000]], { funding: true }),
    ], 'months');
    const summed = Object.values(view.totals.cells).reduce((s, n) => s + n, 0);
    assert.equal(Math.round(summed * 100) / 100, view.totals.total);
    assert.equal(view.totals.total, 4000);
  });

  it('handles an empty plan without inventing a column', () => {
    const view = buildPeriodView([], 'months');
    assert.deepEqual(view.columns, []);
    assert.deepEqual(view.groups, []);
    assert.equal(view.totals.total, 0);
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
