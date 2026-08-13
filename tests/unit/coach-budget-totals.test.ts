import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeBudgetTotals, type AmountLine } from '../../lib/coach-budget-totals.ts';

function cost(totalAmount: number): AmountLine {
  return { totalAmount, lineKind: 'cost' };
}
function funding(totalAmount: number): AmountLine {
  return { totalAmount, lineKind: 'funding' };
}

describe('the plan with no estimate', () => {
  it('makes the line items the total', () => {
    const t = computeBudgetTotals({
      lines: [cost(3000), cost(2000), cost(3000)],
      estimatedTotal: null,
      rosterCount: 10,
    });
    assert.equal(t.itemized, 8000);
    assert.equal(t.costLineCount, 3);
    assert.equal(t.totalPlanned, 8000);
    assert.equal(t.estimatedTotal, null);
    assert.equal(t.hasDifference, false);
    assert.equal(t.overPlanned, false);
    assert.equal(t.fundedByPlayers, 8000);
    assert.equal(t.perPlayer, 800);
  });

  it('states no per player without a roster to divide by', () => {
    const t = computeBudgetTotals({ lines: [cost(8000)], estimatedTotal: null, rosterCount: 0 });
    assert.equal(t.perPlayer, null);
  });

  it('treats a line with no kind as a cost — every row written before migration 230 is one', () => {
    const t = computeBudgetTotals({
      lines: [{ totalAmount: 5000 }, { totalAmount: 1000, lineKind: null }],
      estimatedTotal: null,
    });
    assert.equal(t.itemized, 6000);
    assert.equal(t.expectedFunding, 0);
    assert.equal(t.costLineCount, 2);
  });
});

describe('the estimated total', () => {
  it('is the total, and the un-itemized part is the difference', () => {
    const t = computeBudgetTotals({
      lines: [cost(8000)],
      estimatedTotal: 10000,
      rosterCount: 10,
    });
    assert.equal(t.itemized, 8000);
    assert.equal(t.totalPlanned, 10000);
    assert.equal(t.difference, 2000);
    assert.equal(t.hasDifference, true);
    assert.equal(t.overPlanned, false);
    assert.equal(t.perPlayer, 1000);
  });

  it('SHRINKS as lines are added while the total holds — the owner rule, for free', () => {
    const before = computeBudgetTotals({ lines: [cost(8000)], estimatedTotal: 10000 });
    const after = computeBudgetTotals({ lines: [cost(8000), cost(1000)], estimatedTotal: 10000 });
    assert.equal(before.difference, 2000);
    assert.equal(after.difference, 1000);
    assert.equal(before.totalPlanned, 10000);
    assert.equal(after.totalPlanned, 10000);
  });

  it('goes NEGATIVE when the lines outgrow it, and still governs the total', () => {
    // ⚠ The rule that changed 2026-08-12. The old max(itemized, estimate) kept the number the
    // coach typed and then ignored it everywhere; $6,000 must mean $6,000.
    const t = computeBudgetTotals({
      lines: [cost(8000)],
      estimatedTotal: 6000,
      rosterCount: 10,
    });
    assert.equal(t.difference, -2000);
    assert.equal(t.overPlanned, true);
    assert.equal(t.totalPlanned, 6000);
    assert.equal(t.perPlayer, 600);
  });

  it('renders no difference row when the estimate matches the lines', () => {
    const t = computeBudgetTotals({ lines: [cost(8000)], estimatedTotal: 8000 });
    assert.equal(t.difference, 0);
    assert.equal(t.hasDifference, false);
    assert.equal(t.overPlanned, false);
  });

  it('treats a sub-cent rounding tail as no difference at all', () => {
    const t = computeBudgetTotals({
      lines: [cost(3333.33), cost(3333.33), cost(3333.34)],
      estimatedTotal: 10000,
    });
    assert.equal(t.itemized, 10000);
    assert.equal(t.hasDifference, false);
  });

  it('an estimate of zero is a set estimate, not an absent one', () => {
    const t = computeBudgetTotals({ lines: [cost(8000)], estimatedTotal: 0, rosterCount: 10 });
    assert.equal(t.totalPlanned, 0);
    assert.equal(t.difference, -8000);
    assert.equal(t.overPlanned, true);
    // Nothing is planned, so there is no per-player figure to state — as opposed to a planned
    // season that funding happens to cover, which really is $0.00 each (below).
    assert.equal(t.perPlayer, null);
  });
});

describe('expected funding', () => {
  it('lowers what players fund, and per player with it', () => {
    const t = computeBudgetTotals({
      lines: [cost(7000), cost(1000), funding(3000), funding(1000)],
      estimatedTotal: null,
      rosterCount: 10,
    });
    assert.equal(t.itemized, 8000);
    assert.equal(t.costLineCount, 2);
    assert.equal(t.expectedFunding, 4000);
    assert.equal(t.fundingLineCount, 2);
    assert.equal(t.totalPlanned, 8000);
    assert.equal(t.fundedByPlayers, 4000);
    assert.equal(t.perPlayer, 400);
  });

  it('never counts toward the itemized sum the estimate is measured against', () => {
    // A funding line is not a cost, so it must not eat into the un-itemized difference —
    // budgeting $4,000 of fundraising would otherwise LOOK like itemizing $4,000 of spending.
    const t = computeBudgetTotals({
      lines: [cost(8000), funding(4000)],
      estimatedTotal: 10000,
    });
    assert.equal(t.itemized, 8000);
    assert.equal(t.difference, 2000);
    assert.equal(t.totalPlanned, 10000);
    assert.equal(t.fundedByPlayers, 6000);
  });

  it('floors at zero rather than proposing negative dues', () => {
    const t = computeBudgetTotals({
      lines: [cost(3000), funding(5000)],
      estimatedTotal: null,
      rosterCount: 10,
    });
    assert.equal(t.fundedByPlayers, 0);
    // A planned season that funding covers entirely IS $0.00 per player — a real answer, and both
    // the budget page and the Money hub must give it.
    assert.equal(t.perPlayer, 0);
  });

  it('states no per-player figure when nothing is planned at all', () => {
    // ⚠ The Money hub used to add its own extra gate on top of this, so a team holding only a
    // funding line saw "$0.00 per player" on the budget page and nothing on the hub. Null-ness is
    // decided here, once.
    const t = computeBudgetTotals({ lines: [funding(2000)], estimatedTotal: null, rosterCount: 10 });
    assert.equal(t.totalPlanned, 0);
    assert.equal(t.fundedByPlayers, 0);
    assert.equal(t.perPlayer, null);
  });

  it('keeps cents honest across the whole ladder', () => {
    const t = computeBudgetTotals({
      lines: [cost(1000.1), cost(2000.2), funding(500.15)],
      estimatedTotal: null,
      rosterCount: 3,
    });
    assert.equal(t.itemized, 3000.3);
    assert.equal(t.expectedFunding, 500.15);
    assert.equal(t.fundedByPlayers, 2500.15);
    assert.equal(t.perPlayer, 833.38);
  });
});

describe('an empty plan', () => {
  it('reports zeroes without a difference row or a per-player figure', () => {
    const t = computeBudgetTotals({ lines: [], estimatedTotal: null, rosterCount: 12 });
    assert.equal(t.itemized, 0);
    assert.equal(t.totalPlanned, 0);
    assert.equal(t.hasDifference, false);
    // Nothing planned ⇒ no per-player figure to state, even with a full roster.
    assert.equal(t.perPlayer, null);
  });
});
