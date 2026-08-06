/**
 * Game-Day Mode P3 — the bench order and the arm-care cap (owner-ruled 2026-08-05).
 *
 * Two contracts, table-driven:
 *  1. The bench sorts longest-sitting first, and the order is FROZEN for the period — a row
 *     that moves between the moment a coach looks and the moment they tap is how the wrong
 *     child gets sent in. The freeze is `applyBenchOrder`: it lays out a previously-computed
 *     order and never re-sorts, so a player benched mid-period lands at the bottom.
 *  2. ONE spelling of "the cap that applies to this player": their own cap wins, else the
 *     game's resolved team cap, else nothing at all — the product never invents a ceiling.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BENCH, applyBenchOrder, applyConsoleSwap, benchOrderIds, benchOrderStillSorted,
  benchStreakThrough,
} from '../../lib/coach-game-day.ts';
import { resolveLineupCaps, resolvePlayerPitcherCap } from '../../lib/lineup-caps.ts';

/** A grid row from a compact spelling: 'B' bench, '-' unassigned, anything else a position. */
const row = (playerId: string, periods: string) => ({
  playerId,
  inningPositions: Object.fromEntries(
    periods.split('').map((c, i) => [String(i + 1), c === 'B' ? BENCH : c === '-' ? '' : c]),
  ),
});

describe('benchStreakThrough — sits in a row, counting back from the cursor', () => {
  const CASES: [string, string, number, number][] = [
    ['not benched at all', 'SS SS SS'.replace(/ /g, ''), 3, 0],
    ['benched this period only', 'SSB', 3, 1],
    ['two straight', 'SBB', 3, 2],
    ['three straight, all game', 'BBB', 3, 3],
    ['a sit that ended last period', 'BBS', 3, 0],
    ['unassigned continues a real sit', 'SB-', 3, 2],
    ['unassigned ALONE is not a sit (a half-planned grid chips nobody)', 'S--', 3, 0],
    ['the cursor is what counts, not the whole grid', 'BBS', 2, 2],
  ];
  for (const [label, periods, period, expected] of CASES) {
    it(label, () => {
      assert.equal(benchStreakThrough(row('p', periods), period), expected);
    });
  }
});

describe('benchOrderIds — longest sitting on top', () => {
  it('sorts by streak, then total sits, then the order given (the roster order)', () => {
    const rows = [
      row('ava', 'SSS'),   // on the field — streak 0
      row('nora', 'SBB'),  // 2 straight
      row('zoe', 'BBB'),   // 3 straight
      row('lily', 'BSB'),  // 1 straight, but 2 sits all night
      row('priya', 'SSB'), // 1 straight, 1 sit
    ];
    assert.deepEqual(benchOrderIds(rows, 3), ['zoe', 'nora', 'lily', 'priya', 'ava']);
  });

  it('breaks a genuine tie on roster order, never on anything else', () => {
    const rows = [row('c', 'BB'), row('a', 'BB'), row('b', 'BB')];
    assert.deepEqual(benchOrderIds(rows, 2), ['c', 'a', 'b']);
  });

  it('puts everyone still on the field BELOW every sitter, so a mid-period benching lands last', () => {
    const rows = [row('onfield1', 'SS'), row('sat', 'SB'), row('onfield2', 'SS')];
    const order = benchOrderIds(rows, 2);
    assert.equal(order[0], 'sat');
    assert.deepEqual(order.slice(1), ['onfield1', 'onfield2']);
  });

  it('is read-only — the caller\'s array is never reordered underneath them', () => {
    const rows = [row('a', 'SS'), row('b', 'BB')];
    benchOrderIds(rows, 2);
    assert.deepEqual(rows.map(r => r.playerId), ['a', 'b']);
  });
});

describe('applyBenchOrder — the freeze (it lays out an order, it never computes one)', () => {
  it('lays the bench out in the frozen order', () => {
    const bench = [row('lily', 'BSB'), row('zoe', 'BBB'), row('nora', 'SBB')];
    const frozen = ['zoe', 'nora', 'lily'];
    assert.deepEqual(applyBenchOrder(bench, frozen).map(r => r.playerId), ['zoe', 'nora', 'lily']);
  });

  it('appends anyone missing from the order, keeping the order they arrived in', () => {
    const bench = [row('new2', 'SB'), row('zoe', 'BB'), row('new1', 'SB')];
    assert.deepEqual(
      applyBenchOrder(bench, ['zoe']).map(r => r.playerId),
      ['zoe', 'new2', 'new1'],
    );
  });

  it('an empty order is a no-op (the board before the first freeze)', () => {
    const bench = [row('b', 'BB'), row('a', 'BB')];
    assert.equal(applyBenchOrder(bench, []), bench);
  });

  it('never mutates its input', () => {
    const bench = [row('a', 'SB'), row('z', 'BB')];
    applyBenchOrder(bench, ['z', 'a']);
    assert.deepEqual(bench.map(r => r.playerId), ['a', 'z']);
  });

  /**
   * ⚠ THE RULE, end to end: a substitution mid-period must not move a single existing row.
   * Zoe and Nora are sitting when the coach looks at inning 3; the coach sends Priya in for
   * Ava; Ava joins the bench. Zoe and Nora must still be exactly where they were, and Ava must
   * be last — otherwise the next tap lands on someone the coach didn't mean.
   */
  it('a mid-period substitution leaves every existing row where it was', () => {
    const rows = [
      row('ava', 'CCC'), row('zoe', 'BBB'), row('priya', 'BSB'), row('nora', 'SBB'),
    ];
    const frozen = benchOrderIds(rows, 3);
    const benchBefore = rows.filter(r => (r.inningPositions['3'] ?? '') !== 'C');
    const orderBefore = applyBenchOrder(benchBefore, frozen).map(r => r.playerId);

    const after = applyConsoleSwap(rows, {
      inPlayerId: 'priya', outPlayerId: 'ava', fromPeriod: 3, periodCount: 3, scope: 'onward',
    });
    const benchAfter = after.filter(r => {
      const pos = r.inningPositions['3'] ?? '';
      return !pos || pos === BENCH;
    });
    // The SAME frozen order is applied — the period cursor has not moved.
    const orderAfter = applyBenchOrder(benchAfter, frozen).map(r => r.playerId);

    // zoe sits 3 straight, nora 2, priya 1 (a longer TOTAL doesn't beat a longer current sit).
    assert.deepEqual(orderBefore, ['zoe', 'nora', 'priya']);
    // Priya took the field; the survivors keep their relative order and Ava lands at the bottom.
    assert.deepEqual(orderAfter, ['zoe', 'nora', 'ava']);
  });

  it('re-sorting at the period boundary is what promotes the new longest sitter', () => {
    const rows = [row('zoe', 'BBS'), row('nora', 'SBB'), row('ava', 'SSB')];
    assert.deepEqual(benchOrderIds(rows, 2), ['zoe', 'nora', 'ava']);
    // One period later Zoe is back on the field and Nora has the longest sit.
    assert.deepEqual(benchOrderIds(rows, 3), ['nora', 'ava', 'zoe']);
  });
});

describe('benchOrderStillSorted — the label only claims an order it still has', () => {
  it('is true for a freshly frozen bench', () => {
    const bench = [row('zoe', 'BBB'), row('nora', 'SBB'), row('priya', 'SSB')];
    assert.equal(benchOrderStillSorted(bench, 3), true);
  });

  it('is true for one row, and for none', () => {
    assert.equal(benchOrderStillSorted([row('zoe', 'BBB')], 3), true);
    assert.equal(benchOrderStillSorted([], 3), true);
  });

  /**
   * ⚠ The case the review found. Ava was on the field when period 5 started (streak 0, so she
   * ranks last), but she had sat periods 1–4. The coach benches her mid-period: she stays at the
   * bottom — nothing moves under the thumb, which is the ruling — and her chip now reads "5th
   * straight". The ORDER is still the one the coach was looking at; the LABEL would be lying.
   */
  it('goes false when a mid-period benching lands a long sitter at the bottom', () => {
    const frozen = [row('nora', 'SSSBB'), row('ava', 'BBBBB')];
    assert.equal(benchOrderStillSorted(frozen, 5), false);
  });

  it('comes back true at the next period boundary, when the order re-settles', () => {
    const rows = [row('nora', 'SSSBB'), row('ava', 'BBBBB')];
    const resettled = applyBenchOrder(rows, benchOrderIds(rows, 5));
    assert.deepEqual(resettled.map(r => r.playerId), ['ava', 'nora']);
    assert.equal(benchOrderStillSorted(resettled, 5), true);
  });
});

describe('resolvePlayerPitcherCap — one spelling of the cap that applies', () => {
  const CASES: [string, number | null | undefined, number | null | undefined, number | null][] = [
    ['their own cap wins over the team cap', 4, 3, 4],
    ['their own cap wins even when it is looser', 5, 2, 5],
    ['no personal cap falls back to the team cap (the P1 gap)', null, 3, 3],
    ['undefined behaves as unset', undefined, 3, 3],
    ['nothing set anywhere = no cap, so the board says nothing', null, null, null],
    ['a personal cap with no team cap still applies', 4, null, 4],
  ];
  for (const [label, perPlayer, teamCap, expected] of CASES) {
    it(label, () => {
      assert.equal(resolvePlayerPitcherCap(perPlayer, teamCap), expected);
    });
  }

  it('the team cap is the game override first, then the season default', () => {
    const season = { maxInningsPerPosition: null, pitcherMaxInningsDefault: 3, minInningsPerPlayer: null };
    assert.equal(resolveLineupCaps(season, null).pitcherInningsCap, 3);
    assert.equal(resolveLineupCaps(season, { pitcherMaxInnings: 2 }).pitcherInningsCap, 2);
    assert.equal(resolveLineupCaps(null, null).pitcherInningsCap, null);
  });

  it('resolves end to end the way the console reads it', () => {
    const season = { maxInningsPerPosition: null, pitcherMaxInningsDefault: 3, minInningsPerPlayer: null };
    const teamCap = resolveLineupCaps(season, null).pitcherInningsCap;
    // A player with no cap of their own now gets a chip, from the season default.
    assert.equal(resolvePlayerPitcherCap(null, teamCap), 3);
    // A player the coach gave their own number keeps it.
    assert.equal(resolvePlayerPitcherCap(5, teamCap), 5);
  });
});
