import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateLineup, generateBestLineup, type GeneratorPlayer, type PositionPolicy,
} from '../../lib/lineup-generator.ts';

// Auto-fill rationale (Coach Lineups Deep Dive, Phase 3 — D6/D7). Three tags cover every filled
// cell this pass explains (Best <rank>, Rotated, Only eligible pitcher); one tag covers the single
// blank-cell cause it explains (the mound, capped). Everything else stays unexplained on purpose —
// these tests pin the boundary, not just the happy path.

function player(playerId: string, extra: Partial<GeneratorPlayer> = {}): GeneratorPlayer {
  return { playerId, preferred: [], never: [], pitcher: null, aSquad: false, inningPositions: {}, ...extra };
}

describe('Auto-fill rationale — filled cells', () => {
  const MODES: PositionPolicy[] = ['competitive', 'balanced'];
  for (const policy of MODES) {
    it(`${policy}: the player rated Best 1 at a spot is tagged 'best' rank 1`, () => {
      // Exactly one player per field position — nobody sits, so the fairness bench pick (which
      // ignores ratings) can't randomly take A out of contention for SS.
      const players = [player('A', { preferred: ['SS'] }), player('B'), player('C')];
      const { assignment, rationale } = generateLineup({
        players, inningCount: 1, policy, fillMode: 'regenerate', fieldPositions: ['C', '1B', 'SS'], pitcherPosition: null,
      });
      const ssPlayer = [...assignment.entries()].find(([, g]) => g['1'] === 'SS')?.[0];
      assert.equal(ssPlayer, 'A', 'the only player who rates SS should take it');
      assert.deepEqual(rationale.cellReasons.get('A')?.['1'], { position: 'SS', reason: { kind: 'best', rank: 1 } });
    });
  }

  it('balanced: an unrated pick is tagged \'rotated\', never \'best\'', () => {
    const players = [player('A'), player('B'), player('C')];
    const { assignment, rationale } = generateLineup({
      players, inningCount: 1, policy: 'balanced', fillMode: 'regenerate', fieldPositions: ['C', '1B'], pitcherPosition: null,
    });
    for (const [playerId, grid] of assignment) {
      const pos = grid['1'];
      if (!pos || pos === 'Bench') continue;
      assert.deepEqual(rationale.cellReasons.get(playerId)?.['1'], { position: pos, reason: { kind: 'rotated' } });
    }
  });

  it('development: never tags \'best\' even when the pick coincidentally holds that rating (ratings are not read)', () => {
    // A rates SS Best, but development ignores ratings entirely — the reason must say so honestly
    // rather than crediting a rating the algorithm never consulted.
    const players = [player('A', { preferred: ['SS'] }), player('B')];
    let sawA = false;
    for (let attempt = 0; attempt < 20 && !sawA; attempt++) {
      const { assignment, rationale } = generateLineup({
        players, inningCount: 1, policy: 'development', fillMode: 'regenerate', fieldPositions: ['SS', 'C'], pitcherPosition: null,
      });
      if (assignment.get('A')?.['1'] === 'SS') {
        sawA = true;
        assert.deepEqual(rationale.cellReasons.get('A')?.['1'], { position: 'SS', reason: { kind: 'rotated' } });
      }
    }
    assert.ok(sawA, 'fixture should eventually land A on SS across shuffles');
  });

  it('the sole eligible pitcher is tagged \'only_pitcher\'', () => {
    const players = [
      player('A', { pitcher: { rank: 1, maxInnings: null } }),
      player('B'), player('C'),
    ];
    const { assignment, rationale } = generateLineup({
      players, inningCount: 1, policy: 'balanced', fillMode: 'regenerate', fieldPositions: ['P', 'C'], pitcherPosition: 'P',
    });
    assert.equal(assignment.get('A')?.['1'], 'P');
    assert.deepEqual(rationale.cellReasons.get('A')?.['1'], { position: 'P', reason: { kind: 'only_pitcher' } });
  });

  it('a pitcher pick among several eligible arms carries no reason (only the sole-eligible case is named)', () => {
    // Exactly two players for two positions — nobody sits, so both pitchers are always on the
    // field and eligible; picking the ace over the other arm is a real choice, not a solo default.
    const players = [
      player('A', { pitcher: { rank: 1, maxInnings: null } }),
      player('B', { pitcher: { rank: 2, maxInnings: null } }),
    ];
    const { assignment, rationale } = generateLineup({
      players, inningCount: 1, policy: 'competitive', fillMode: 'regenerate', fieldPositions: ['P', 'C'], pitcherPosition: 'P',
    });
    const pitcherId = [...assignment.entries()].find(([, g]) => g['1'] === 'P')?.[0];
    assert.equal(pitcherId, 'A', 'competitive leads with the ace');
    assert.equal(rationale.cellReasons.get(pitcherId ?? '')?.['1'], undefined);
  });
});

describe('Auto-fill rationale — blank cells', () => {
  it('a mound left blank because every pitcher is at their cap is flagged pitcher-capped', () => {
    const players = [
      player('A', { pitcher: { rank: 1, maxInnings: 1 }, inningPositions: { '1': 'P' } }),
      player('B'), player('C'),
    ];
    const { assignment, rationale } = generateLineup({
      players, inningCount: 2, policy: 'balanced', fillMode: 'empty', fieldPositions: ['P', 'C'], pitcherPosition: 'P',
    });
    // A is spent and no other pitcher exists, so the mound itself stays blank in inning 2 — A may
    // still play the OTHER field position, which is a different assertion than "A has no cell".
    assert.ok(![...assignment.values()].some(g => g['2'] === 'P'), 'nobody should be on the mound in inning 2');
    assert.ok(rationale.pitcherCappedInnings.has(2));
    assert.ok(!rationale.pitcherCappedInnings.has(1), 'inning 1 was locked, not written, this run');
  });

  it('a mound left blank with no pitching chart at all is NOT flagged (pitching is simply unused)', () => {
    const players = [player('A'), player('B')];
    const { rationale } = generateLineup({
      players, inningCount: 1, policy: 'balanced', fillMode: 'regenerate', fieldPositions: ['P', 'C', 'SS'], pitcherPosition: 'P',
    });
    assert.equal(rationale.pitcherCappedInnings.size, 0);
  });

  it('an ordinary open field role is never flagged pitcher-capped, even with the mound filled fine in the same inning', () => {
    const players = [
      player('A', { pitcher: { rank: 1, maxInnings: null } }),
      player('B', { never: ['SS'] }),
    ];
    const { assignment, rationale } = generateLineup({
      players, inningCount: 1, policy: 'balanced', fillMode: 'regenerate', fieldPositions: ['P', 'SS'], pitcherPosition: 'P',
    });
    assert.equal(assignment.get('A')?.['1'], 'P', 'the mound fills fine');
    assert.equal(assignment.get('B')?.['1'], undefined, 'SS has no eligible player and stays blank');
    assert.equal(rationale.pitcherCappedInnings.size, 0, 'the open role is SS, not the mound');
  });
});

describe('Auto-fill rationale — generateBestLineup carries the WINNING candidate\'s reasons', () => {
  it('every recorded reason matches the position actually returned, across many candidate pools', () => {
    const players = [
      player('A', { pitcher: { rank: 1, maxInnings: 3 }, preferred: ['SS'] }),
      player('B', { pitcher: { rank: 2, maxInnings: 3 } }),
      player('C', { preferred: ['C'] }),
      player('D'), player('E'), player('F'),
    ];
    for (let attempt = 0; attempt < 15; attempt++) {
      const { assignment, rationale } = generateBestLineup({
        players, inningCount: 5, policy: 'competitive', fillMode: 'regenerate',
        fieldPositions: ['C', 'P', '1B', 'SS'], pitcherPosition: 'P',
      }, 10);
      for (const [playerId, byInning] of rationale.cellReasons) {
        for (const [inning, { position }] of Object.entries(byInning)) {
          assert.equal(
            assignment.get(playerId)?.[inning], position,
            `reason for ${playerId} inning ${inning} claims '${position}' but the winning lineup differs`,
          );
        }
      }
    }
  });
});
