import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { winPct, compareValues, formatWinPct } from '../../lib/season-compare.ts';

describe('winPct', () => {
  it('counts a tie as half a win', () => {
    assert.equal(winPct({ wins: 3, losses: 1, ties: 0 }), 0.75);
    assert.equal(winPct({ wins: 1, losses: 1, ties: 2 }), 0.5); // (1 + 1) / 4
  });

  it('returns null when no games have been played (season in progress)', () => {
    assert.equal(winPct({ wins: 0, losses: 0, ties: 0 }), null);
  });

  it('is 1 for an unbeaten record and 0 for a winless one', () => {
    assert.equal(winPct({ wins: 5, losses: 0, ties: 0 }), 1);
    assert.equal(winPct({ wins: 0, losses: 5, ties: 0 }), 0);
  });
});

describe('compareValues', () => {
  it('reports up/down/flat against the prior value', () => {
    assert.deepEqual(compareValues(0.75, 0.5), { direction: 'up', delta: 0.25 });
    assert.deepEqual(compareValues(12, 15), { direction: 'down', delta: -3 });
    assert.deepEqual(compareValues(10, 10), { direction: 'flat', delta: 0 });
  });

  it('is n/a when either side is missing (no comparison possible)', () => {
    assert.deepEqual(compareValues(null, 0.5), { direction: 'na', delta: null });
    assert.deepEqual(compareValues(0.5, null), { direction: 'na', delta: null });
    assert.deepEqual(compareValues(undefined, undefined), { direction: 'na', delta: null });
  });
});

describe('formatWinPct', () => {
  it('renders a whole-percent string or a dash', () => {
    assert.equal(formatWinPct(0.75), '75%');
    assert.equal(formatWinPct(0.5), '50%');
    assert.equal(formatWinPct(null), '—');
  });
});
