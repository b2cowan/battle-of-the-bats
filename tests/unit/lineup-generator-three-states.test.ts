import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateLineup, type GeneratorPlayer, type PositionPolicy } from '../../lib/lineup-generator.ts';

// The generator's first unit tests (depth-chart three-states plan, 2026-09-12). They pin the ORDER
// in which each Auto-fill mode reads a player's ratings — Best (ranked), Never, blank = fine — and
// never the scoring weights. Every assertion here is deterministic despite the generator's
// shuffle: rosters are sized so nobody sits, and the position under test (SS) is deliberately
// listed AFTER four unrated positions, the way a real Sport Pack lists it — the rated-first fill
// order is what keeps a rated shortstop from being spent on catcher.

// No mound in these tests: pitching is governed by the pitcher depth chart, not by ratings.
const FIELD = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const MODES: PositionPolicy[] = ['competitive', 'balanced', 'development'];

function player(playerId: string, extra: Partial<GeneratorPlayer> = {}): GeneratorPlayer {
  return { playerId, preferred: [], never: [], pitcher: null, aSquad: false, inningPositions: {}, ...extra };
}
/** Eight players, one per field position, so every inning has no bench. */
function roster(overrides: Record<string, Partial<GeneratorPlayer>> = {}): GeneratorPlayer[] {
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(id => player(id, overrides[id]));
}
function run(players: GeneratorPlayer[], policy: PositionPolicy, inningCount = 1, fieldPositions = FIELD) {
  return generateLineup({ players, inningCount, policy, fillMode: 'regenerate', fieldPositions, pitcherPosition: null }).assignment;
}
const at = (grid: Map<string, Record<string, string>>, id: string, inning = 1) => grid.get(id)?.[String(inning)];
const whoAt = (grid: Map<string, Record<string, string>>, pos: string, inning = 1) =>
  [...grid.entries()].find(([, g]) => g[String(inning)] === pos)?.[0];

describe('Never — a wall in every mode', () => {
  for (const policy of MODES) {
    it(`${policy}: a player is never placed at a Never, across many shuffles`, () => {
      const players = roster({ A: { never: ['SS', 'C'] } });
      for (let i = 0; i < 40; i++) {
        const grid = run(players, policy);
        assert.notEqual(at(grid, 'A'), 'SS');
        assert.notEqual(at(grid, 'A'), 'C');
      }
    });
  }

  it('when everyone has a spot as Never it is left blank rather than forced — the rest still fill', () => {
    const players = roster(Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(id => [id, { never: ['SS'] }])));
    for (const policy of MODES) {
      const grid = run(players, policy);
      assert.equal(whoAt(grid, 'SS'), undefined, `${policy}: nobody at SS`);
      for (const pos of FIELD.filter(p => p !== 'SS')) assert.ok(whoAt(grid, pos), `${policy}: ${pos} filled`);
    }
  });
});

describe('Blank = fine — an unrated roster fills every position in every mode', () => {
  for (const policy of MODES) {
    it(`${policy}: no holes with no ratings at all`, () => {
      const grid = run(roster(), policy, 2);
      for (const inning of [1, 2]) for (const pos of FIELD) assert.ok(whoAt(grid, pos, inning), `${pos} inning ${inning}`);
    });
  }
});

describe('Competitive — Best first, in rank order', () => {
  it('a rated position fills before the unrated ones listed ahead of it, so the rated player is never spent elsewhere', () => {
    // C, 1B, 2B and 3B are all listed before SS and nobody rates them; D must still land at SS,
    // in both modes that read ratings.
    const players = roster({ D: { preferred: ['SS'] } });
    for (let i = 0; i < 40; i++) {
      assert.equal(whoAt(run(players, 'competitive'), 'SS'), 'D');
      assert.equal(whoAt(run(players, 'balanced'), 'SS'), 'D');
    }
  });

  it('a player rated Best at a spot takes it over everyone who is merely fine there', () => {
    const players = roster({ D: { preferred: ['SS'] } });
    for (let i = 0; i < 20; i++) assert.equal(whoAt(run(players, 'competitive'), 'SS'), 'D');
  });

  it('the player for whom the spot ranks highest wins it', () => {
    // A has SS as Best 2 (behind 2B); B has SS as Best 1.
    const players = roster({ A: { preferred: ['2B', 'SS'] }, B: { preferred: ['SS'] } });
    for (let i = 0; i < 20; i++) assert.equal(whoAt(run(players, 'competitive'), 'SS'), 'B');
  });

  it('an equal rank goes to the A-squad player', () => {
    const players = roster({ A: { preferred: ['SS'] }, B: { preferred: ['SS'], aSquad: true } });
    for (let i = 0; i < 20; i++) assert.equal(whoAt(run(players, 'competitive'), 'SS'), 'B');
  });

  it('keeps the only Best-rated player at their spot inning after inning', () => {
    const players = roster({ D: { preferred: ['SS'] } });
    const grid = run(players, 'competitive', 3);
    for (const inning of [1, 2, 3]) assert.equal(at(grid, 'D', inning), 'SS');
  });
});

describe('Balanced — anyone rated Best, rotated evenly (rank ignored on purpose)', () => {
  it('a rated player beats the unrated for the spot', () => {
    const players = roster({ D: { preferred: ['SS'] } });
    for (let i = 0; i < 20; i++) assert.equal(whoAt(run(players, 'balanced'), 'SS'), 'D');
  });

  it('two players rated Best at the same spot share it across innings regardless of rank', () => {
    // A ranks SS first; B ranks it second (behind LF, which is listed after SS so it cannot claim
    // B first). Competitive would give SS to A both innings — Balanced gives each of them one,
    // because "rotate" is the point of the mode.
    const players = roster({ A: { preferred: ['SS'] }, B: { preferred: ['LF', 'SS'] } });
    for (let i = 0; i < 10; i++) {
      const grid = run(players, 'balanced', 2);
      const holders = new Set([whoAt(grid, 'SS', 1), whoAt(grid, 'SS', 2)]);
      assert.deepEqual([...holders].sort(), ['A', 'B']);
    }
  });
});

describe('Development — everyone rotates; only Never is read', () => {
  it('does not keep a Best-rated player at their spot two innings running when others are free', () => {
    const players = roster({ D: { preferred: ['SS'] } });
    for (let i = 0; i < 10; i++) {
      const grid = run(players, 'development', 2);
      assert.notEqual(whoAt(grid, 'SS', 1), whoAt(grid, 'SS', 2));
    }
  });

  it('still honours a Never while rotating', () => {
    const players = roster({ D: { preferred: ['SS'], never: ['C'] } });
    for (let i = 0; i < 20; i++) assert.notEqual(at(run(players, 'development'), 'D'), 'C');
  });
});
