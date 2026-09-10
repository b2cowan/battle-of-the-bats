/**
 * ONE SPELLING FOR "WHERE THIS RECORD'S MONEY LANDS" (owner ruling, §157 walk 2026-09-10).
 *
 * Three surfaces print a record's filing and they must agree word for word: the recording
 * conversation's "Which drive" hint, the drive room's stated Record door, and the sponsor room's.
 * The rule that made them agree was that the stated doors stopped repeating a figure the tile
 * behind them already shows — so a drift here is a coach reading two different sentences about
 * the same drive depending on which door they came through.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { raisingForFiling } from '../../lib/coach-fundraising';

describe('raisingForFiling — the shelf and the word', () => {
  it('prints shelf · word, the way every money surface prints a filing', () => {
    assert.equal(
      raisingForFiling({ budgetCategoryName: 'Fundraising', budgetItemName: 'Merchandise sales' }),
      'Fundraising · Merchandise sales',
    );
  });

  it('is null on a LEGACY record that names no line — never an empty string', () => {
    // The callers each answer this state in their own voice; a blank would print a bare label.
    assert.equal(raisingForFiling({ budgetCategoryName: 'Fundraising', budgetItemName: null }), null);
    assert.equal(raisingForFiling({}), null);
  });

  it('falls back to the word alone when the shelf is unnamed, rather than printing a stray separator', () => {
    assert.equal(raisingForFiling({ budgetCategoryName: null, budgetItemName: 'Grant' }), 'Grant');
  });
});
