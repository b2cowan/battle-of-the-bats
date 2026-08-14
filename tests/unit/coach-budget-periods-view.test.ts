import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPeriodView, quarterKeyOf, UNSCHEDULED, MAX_PERIOD_MONTHS,
  type PeriodViewLine,
} from '../../lib/coach-budget-periods-view.ts';

function line(
  id: string,
  description: string,
  totalAmount: number,
  periods: Array<[string | null, number]>,
  opts: { category?: string | null; funding?: boolean } = {},
): PeriodViewLine {
  return {
    id,
    description,
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
    assert.equal(view.columns[view.columns.length - 1].key, UNSCHEDULED);
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
  });
});

describe('funding', () => {
  it('subtracts down every column and closes with what players fund', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 3000]]),
      line('f', 'Fundraising', 1000, [['2027-01-01', 1000]], { funding: true, category: 'Fundraising' }),
    ], 'months');
    assert.equal(view.groups[1].name, 'Expected fundraising');
    assert.equal(view.groups[1].rows[0].cells['2027-01'], -1000);
    assert.equal(view.totals.cells['2027-01'], 2000);
    assert.equal(view.totals.total, 2000);
  });

  it('lands in ONE group whatever categories its lines carry', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 3000]]),
      line('f', 'Chocolate drive', 1000, [], { funding: true, category: 'Tournaments' }),
      line('g', 'Sponsor', 500, [], { funding: true, category: null }),
    ], 'months');
    const fundingGroups = view.groups.filter(g => g.lineKind === 'funding');
    assert.equal(fundingGroups.length, 1);
    assert.equal(fundingGroups[0].rows.length, 2);
    assert.equal(fundingGroups[0].total, -1500);
  });

  it('sorts last, whatever order the lines arrived in', () => {
    const view = buildPeriodView([
      line('f', 'Fundraising', 1000, [], { funding: true }),
      line('a', 'Entry fees', 3000, [], { category: 'Tournaments' }),
      line('b', 'Gear', 500, [], { category: 'Equipment' }),
    ], 'months');
    assert.deepEqual(view.groups.map(g => g.lineKind), ['cost', 'cost', 'funding']);
    assert.deepEqual(view.groups.map(g => g.name), ['Tournaments', 'Equipment', 'Expected fundraising']);
  });
});

describe('grouping and totals', () => {
  it('groups costs by category and keeps the plan\'s own order', () => {
    const view = buildPeriodView([
      line('a', 'Entry fees', 3000, [['2027-01-01', 3000]], { category: 'Tournaments' }),
      line('b', 'Gear', 1000, [['2027-01-01', 1000]], { category: 'Equipment' }),
      line('c', 'Uniforms', 2000, [['2027-02-01', 2000]], { category: 'Tournaments' }),
    ], 'months');
    assert.deepEqual(view.groups.map(g => g.name), ['Tournaments', 'Equipment']);
    assert.equal(view.groups[0].rows.length, 2);
    assert.equal(view.groups[0].total, 5000);
    assert.equal(view.groups[0].cells['2027-01'], 3000);
    assert.equal(view.groups[0].cells['2027-02'], 2000);
  });

  it('files an uncategorized line under one heading rather than dropping it', () => {
    const view = buildPeriodView([
      line('a', 'Something', 500, [], { category: null }),
    ], 'months');
    assert.equal(view.groups[0].name, 'Uncategorized');
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
