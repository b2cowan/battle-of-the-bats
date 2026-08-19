/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * SEASON MOMENTUM — the cumulative differential behind two charts (Insights P3, 2026-08-19)
 *
 * The one rule worth protecting here: a game with a result but no score entered must not silently
 * vanish from the series. It contributes nothing to the running total (there is nothing to add), but
 * its POSITION must still be nameable — `unscoredIndexes` — so a chart can mark the gap rather than
 * let its point count quietly disagree with the game log beside it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeSeasonMomentum, type SeasonMomentumGameInput } from '../../lib/coach-season-momentum.ts';

const scored = (teamScore: number, opponentScore: number): SeasonMomentumGameInput =>
  ({ teamScore, opponentScore });
const unscored: SeasonMomentumGameInput = { teamScore: null, opponentScore: null };

describe('computeSeasonMomentum', () => {
  it('returns an empty series for no games', () => {
    const out = computeSeasonMomentum([]);
    assert.deepEqual(out.points, []);
    assert.deepEqual(out.unscoredIndexes, []);
    assert.equal(out.scoredCount, 0);
    assert.equal(out.totalCount, 0);
  });

  it('produces one point per scored game, running cumulatively', () => {
    const out = computeSeasonMomentum([scored(5, 2), scored(1, 4), scored(6, 6)]);
    assert.deepEqual(out.points, [
      { index: 0, cumulative: 3 },
      { index: 1, cumulative: 0 },
      { index: 2, cumulative: 0 },
    ]);
    assert.equal(out.scoredCount, 3);
    assert.equal(out.totalCount, 3);
    assert.deepEqual(out.unscoredIndexes, []);
  });

  it('a single scored game produces exactly one point — the caller decides whether one point draws a line', () => {
    const out = computeSeasonMomentum([scored(3, 0)]);
    assert.deepEqual(out.points, [{ index: 0, cumulative: 3 }]);
    assert.equal(out.scoredCount, 1);
  });

  it('an unscored game leaves a gap at its true chronological position, not a dropped index', () => {
    const out = computeSeasonMomentum([scored(5, 2), unscored, scored(1, 0), unscored, scored(0, 3)]);
    assert.deepEqual(out.unscoredIndexes, [1, 3]);
    assert.deepEqual(out.points.map(p => p.index), [0, 2, 4]);
    assert.deepEqual(out.points.map(p => p.cumulative), [3, 4, 1]);
    assert.equal(out.scoredCount, 3);
    assert.equal(out.totalCount, 5);
  });

  it('a game scored on one side only counts as unscored (both scores are required to plot)', () => {
    const out = computeSeasonMomentum([scored(5, 2), { teamScore: 4, opponentScore: null }]);
    assert.deepEqual(out.unscoredIndexes, [1]);
    assert.equal(out.scoredCount, 1);
  });

  it('all games unscored produces no points and names every gap', () => {
    const out = computeSeasonMomentum([unscored, unscored]);
    assert.deepEqual(out.points, []);
    assert.deepEqual(out.unscoredIndexes, [0, 1]);
    assert.equal(out.totalCount, 2);
  });
});
