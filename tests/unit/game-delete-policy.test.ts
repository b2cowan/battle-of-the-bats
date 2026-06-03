import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PLAYOFF_REPLACE_ERROR,
  ROUND_ROBIN_REPLACE_ERROR,
  applyDivisionRoundRobinDeleteScope,
  sanitizeGameIds,
  validateReplaceablePlayoffRows,
  validateReplaceableRoundRobinRows,
} from '../../lib/game-delete-policy.ts';

describe('game delete policy', () => {
  it('sanitizes requested game IDs', () => {
    assert.deepEqual(
      sanitizeGameIds([' g1 ', 'g2', '', 'g1', null, 42]),
      ['g1', 'g2'],
    );
    assert.equal(sanitizeGameIds('g1'), null);
  });

  it('scopes division schedule replacement to round-robin games only', () => {
    const calls: Array<[string, unknown]> = [];
    const query = {
      eq(column: string, value: unknown) {
        calls.push([column, value]);
        return this;
      },
    };

    assert.equal(applyDivisionRoundRobinDeleteScope(query, 'division-1'), query);
    assert.deepEqual(calls, [
      ['division_id', 'division-1'],
      ['is_playoff', false],
    ]);
  });

  it('rejects protected round-robin rows for build-from-current replacement', () => {
    assert.equal(validateReplaceableRoundRobinRows([
      { status: 'scheduled', is_playoff: false, generator_locked: false },
    ]), null);

    assert.equal(validateReplaceableRoundRobinRows([
      { status: 'scheduled', is_playoff: true, generator_locked: false },
    ]), ROUND_ROBIN_REPLACE_ERROR);

    assert.equal(validateReplaceableRoundRobinRows([
      { status: 'completed', is_playoff: false, generator_locked: false },
    ]), ROUND_ROBIN_REPLACE_ERROR);

    assert.equal(validateReplaceableRoundRobinRows([
      { status: 'scheduled', is_playoff: false, generator_locked: true },
    ]), ROUND_ROBIN_REPLACE_ERROR);
  });

  it('allows only unlocked scheduled playoff rows for playoff replacement', () => {
    assert.equal(validateReplaceablePlayoffRows([
      { status: 'scheduled', is_playoff: true, generator_locked: false },
    ]), null);

    assert.equal(validateReplaceablePlayoffRows([
      { status: 'submitted', is_playoff: true, generator_locked: false },
    ]), PLAYOFF_REPLACE_ERROR);

    assert.equal(validateReplaceablePlayoffRows([
      { status: 'completed', is_playoff: true, generator_locked: false },
    ]), PLAYOFF_REPLACE_ERROR);

    assert.equal(validateReplaceablePlayoffRows([
      { status: 'scheduled', is_playoff: true, generator_locked: true },
    ]), PLAYOFF_REPLACE_ERROR);

    assert.equal(validateReplaceablePlayoffRows([
      { status: 'scheduled', is_playoff: false, generator_locked: false },
    ]), PLAYOFF_REPLACE_ERROR);
  });
});
