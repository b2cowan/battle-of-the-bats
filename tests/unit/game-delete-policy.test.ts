import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PLAYOFF_REPLACE_ERROR,
  ROUND_ROBIN_REPLACE_ERROR,
  applyDivisionRoundRobinDeleteScope,
  draftReplaceReply,
  isReplaceableRoundRobinGame,
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

  it('the division delete never takes a game that is played, cancelled, kept or a playoff (F70, every caller)', () => {
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
      ['status', 'scheduled'],
      ['generator_locked', false],
    ]);

    // The scope IS the replaceable rule: a row passes every filter above exactly when the rule says replaceable.
    const rows = ['scheduled', 'submitted', 'completed', 'forfeit', 'cancelled'].flatMap(status =>
      [false, true].flatMap(is_playoff => [false, true].map(generator_locked => ({ status, is_playoff, generator_locked }))));
    for (const row of rows) {
      const passes: boolean = calls.every(([column, value]) => column === 'division_id' || (row as Record<string, unknown>)[column] === value);
      assert.equal(passes, isReplaceableRoundRobinGame(row), JSON.stringify(row));
    }
  });

  it('the one-step save (mig 320) replies: saved, schedule changed (409), or nothing saved (500)', () => {
    const words = { scheduleChanged: 'changed — nothing was saved', other: 'failed — nothing was saved', divisionNotFound: 'no division', invalid: 'invalid' };
    assert.deepEqual(draftReplaceReply({ ok: false, code: 'foreign_reference' }, null, words), { status: 400, body: { error: 'invalid' } });
    assert.deepEqual(
      draftReplaceReply({ ok: true, inserted: ['a', 'b'], replaced: 3 }, null, words),
      { status: 200, body: { success: true, inserted: ['a', 'b'], replaced: 3 } },
    );
    assert.deepEqual(
      draftReplaceReply({ ok: false, code: 'schedule_changed' }, null, words),
      { status: 409, body: { error: words.scheduleChanged, code: 'schedule_changed' } },
    );
    assert.deepEqual(draftReplaceReply({ ok: false, code: 'division_not_found' }, null, words), { status: 404, body: { error: 'no division' } });
    // The transaction raised (e.g. a bad reference on an inserted row, AFTER the removal): it rolled back whole, and
    // the reply says nothing was saved — never a raw database message.
    assert.deepEqual(
      draftReplaceReply(null, { message: 'insert or update on table "games" violates foreign key constraint' }, words),
      { status: 500, body: { error: words.other } },
    );
    assert.deepEqual(draftReplaceReply({ ok: false, code: 'something_new' }, null, words), { status: 500, body: { error: words.other } });
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
