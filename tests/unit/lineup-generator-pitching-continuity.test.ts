import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateBestLineup,
  generateLineup,
  type GeneratorPlayer,
  type PositionPolicy,
} from '../../lib/lineup-generator.ts';

// P is deliberately not the first Sport Pack position. Development mode must still reserve and
// assign the pitcher before another field role can consume that player.
const FIELD = ['C', 'P', '1B', 'SS'];
const MODES: PositionPolicy[] = ['competitive', 'balanced', 'development'];

function player(playerId: string, extra: Partial<GeneratorPlayer> = {}): GeneratorPlayer {
  return {
    playerId,
    preferred: [],
    never: [],
    pitcher: null,
    aSquad: false,
    inningPositions: {},
    ...extra,
  };
}

function pitchingRoster(): GeneratorPlayer[] {
  return [
    player('A', { pitcher: { rank: 1, maxInnings: 3 } }),
    player('B', { pitcher: { rank: 2, maxInnings: 3 } }),
    player('C', { pitcher: { rank: 3, maxInnings: 3 } }),
    player('D'),
    player('E'),
    player('F'),
  ];
}

function pitchingInnings(grid: Map<string, Record<string, string>>, playerId: string, inningCount: number) {
  return Array.from({ length: inningCount }, (_, index) => index + 1)
    .filter(inning => grid.get(playerId)?.[String(inning)] === 'P');
}

function assertOnePitchingBlock(
  grid: Map<string, Record<string, string>>,
  players: GeneratorPlayer[],
  inningCount: number,
) {
  for (const p of players) {
    const innings = pitchingInnings(grid, p.playerId, inningCount);
    if (innings.length > 1) {
      assert.equal(
        innings.at(-1)! - innings[0] + 1,
        innings.length,
        `${p.playerId} returned to pitch after leaving the mound: ${innings.join(', ')}`,
      );
    }
    if (p.pitcher?.maxInnings != null) {
      assert.ok(innings.length <= p.pitcher.maxInnings, `${p.playerId} exceeded their pitching cap`);
    }
  }
  for (let inning = 1; inning <= inningCount; inning++) {
    const pitchers = players.filter(p => grid.get(p.playerId)?.[String(inning)] === 'P');
    assert.equal(pitchers.length, 1, `inning ${inning} should have exactly one pitcher`);
  }
}

describe('Auto-fill pitching continuity', () => {
  for (const policy of MODES) {
    it(`${policy}: keeps every multi-inning pitcher in one consecutive stint`, () => {
      const players = pitchingRoster();
      for (let attempt = 0; attempt < 20; attempt++) {
        const { assignment: grid } = generateLineup({
          players,
          inningCount: 7,
          policy,
          fillMode: 'regenerate',
          fieldPositions: FIELD,
          pitcherPosition: 'P',
        });
        assertOnePitchingBlock(grid, players, 7);
        assert.ok(
          players.some(p => pitchingInnings(grid, p.playerId, 7).length > 1),
          'fixture should exercise a multi-inning pitching stint',
        );
      }
    });
  }

  it('the best-of-candidates path used by the editor preserves the same guarantee', () => {
    const players = pitchingRoster();
    for (const policy of MODES) {
      const { assignment: grid } = generateBestLineup({
        players,
        inningCount: 7,
        policy,
        fillMode: 'regenerate',
        fieldPositions: FIELD,
        pitcherPosition: 'P',
      }, 8);
      assertOnePitchingBlock(grid, players, 7);
    }
  });

  it('extends the final usable stint when shorter caps cannot cover the game', () => {
    const players = [
      player('A', { pitcher: { rank: 1, maxInnings: 1 } }),
      player('B', { pitcher: { rank: 2, maxInnings: 1 } }),
      player('C', { pitcher: { rank: 3, maxInnings: 7 } }),
      player('D'),
      player('E'),
      player('F'),
    ];
    for (let attempt = 0; attempt < 20; attempt++) {
      const { assignment: grid } = generateLineup({
        players,
        inningCount: 7,
        policy: 'balanced',
        fillMode: 'regenerate',
        fieldPositions: FIELD,
        pitcherPosition: 'P',
      });
      assertOnePitchingBlock(grid, players, 7);
      assert.equal(pitchingInnings(grid, 'C', 7).length, 5);
    }
  });

  it('fill-empty bridges two coach-set pitching innings when the gap is writable', () => {
    const players = [
      player('A', { pitcher: { rank: 1, maxInnings: 3 }, inningPositions: { '1': 'P', '3': 'P' } }),
      player('B', { pitcher: { rank: 2, maxInnings: 3 } }),
      player('C'),
      player('D'),
    ];
    const { assignment: grid } = generateLineup({
      players,
      inningCount: 4,
      policy: 'balanced',
      fillMode: 'empty',
      fieldPositions: ['C', 'P'],
      pitcherPosition: 'P',
    });

    assert.deepEqual(pitchingInnings(grid, 'A', 4), [1, 2, 3]);
    assert.equal(grid.get('B')?.['4'], 'P');
  });

  it('does not start a pitcher before a locked field assignment and later pitching stint', () => {
    const players = [
      player('A', {
        pitcher: { rank: 1, maxInnings: 3 },
        inningPositions: { '2': 'SS', '3': 'P' },
      }),
      player('B', { pitcher: { rank: 2, maxInnings: 2 } }),
    ];
    const { assignment: grid } = generateLineup({
      players,
      inningCount: 3,
      policy: 'competitive',
      fillMode: 'empty',
      fieldPositions: ['P', 'SS'],
      pitcherPosition: 'P',
    });

    assert.deepEqual(pitchingInnings(grid, 'A', 3), [3]);
    assert.deepEqual(pitchingInnings(grid, 'B', 3), [1, 2]);
  });

  it('does not impose continuity on non-pitching positions', () => {
    const players = [
      player('A', { inningPositions: { '1': 'SS', '2': 'C', '3': 'SS' } }),
      player('B', { pitcher: { rank: 1, maxInnings: 3 }, inningPositions: { '1': 'P', '2': 'P', '3': 'P' } }),
    ];
    const { assignment: grid } = generateLineup({
      players,
      inningCount: 3,
      policy: 'balanced',
      fillMode: 'empty',
      fieldPositions: ['P', 'C', 'SS'],
      pitcherPosition: 'P',
    });

    assert.equal(grid.get('A')?.['1'], 'SS');
    assert.equal(grid.get('A')?.['2'], 'C');
    assert.equal(grid.get('A')?.['3'], 'SS');
  });
});
