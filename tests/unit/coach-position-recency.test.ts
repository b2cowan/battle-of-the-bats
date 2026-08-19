import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computePositionRecency,
  rankPositionsByStaleness,
  computePositionRecencyMatrix,
  type PositionRecencyGame,
} from '../../lib/coach-position-recency.ts';

const PLAYERS = [
  { id: 'maya', name: 'Maya' },
  { id: 'jordan', name: 'Jordan' },
  { id: 'priya', name: 'Priya' },
  { id: 'dev', name: 'Dev' },
];

const TODAY = '2026-08-02';

/** Compact game builder: `game('2026-07-12', 'vs Falcons', { maya: { C: 5, LF: 2 } })`. */
function game(
  day: string,
  label: string,
  byPlayer: Record<string, Record<string, number>>,
  eventId = `ev-${day}-${label}`,
): PositionRecencyGame {
  return {
    eventId,
    day,
    label,
    byPlayer: Object.entries(byPlayer).map(([playerId, positionInnings]) => ({ playerId, positionInnings })),
  };
}

/** The mockup's scenario: Maya caught Jul 12, then Jordan and Priya covered every game since. */
const SEASON: PositionRecencyGame[] = [
  game('2026-07-12', 'vs Falcons', { maya: { C: 5 }, jordan: { SS: 7 }, priya: { '1B': 6 } }),
  game('2026-07-19', 'vs Storm', { jordan: { C: 7 }, maya: { LF: 7 }, priya: { '1B': 7 } }),
  game('2026-07-26', 'vs Comets', { priya: { C: 7 }, jordan: { SS: 7 }, maya: { RF: 4 } }),
];

function recency(position: string, games = SEASON, today = TODAY) {
  return computePositionRecency({ today, games, players: PLAYERS, position });
}

describe('computePositionRecency', () => {
  it('ranks the longest gap first and dates it from the org day', () => {
    const r = recency('C');
    assert.equal(r.players[0].name, 'Maya');
    assert.equal(r.players[0].lastDay, '2026-07-12');
    assert.equal(r.players[0].daysSince, 21);
    assert.equal(r.players[0].lastInnings, 5);
  });

  it('counts the games in which someone actually covered the position', () => {
    // Jul 12 (Maya), Jul 19 (Jordan), Jul 26 (Priya) — three covered games.
    assert.equal(recency('C').gamesCovered, 3);
  });

  it('names who has covered it since, most recent first, excluding the waiting player', () => {
    assert.deepEqual(recency('C').coveredSince, ['Priya', 'Jordan']);
  });

  it('returns receipts most recent first', () => {
    const r = recency('C');
    assert.deepEqual(r.appearances.map(a => a.day), ['2026-07-26', '2026-07-19', '2026-07-12']);
    assert.deepEqual(r.appearances.map(a => a.name), ['Priya', 'Jordan', 'Maya']);
    assert.equal(r.appearances[0].label, 'vs Comets');
  });

  it('reports single coverage without inventing a second player', () => {
    const r = recency('1B');
    assert.equal(r.players.length, 1);
    assert.equal(r.players[0].name, 'Priya');
    assert.deepEqual(r.coveredSince, []);
  });

  // ── The honesty rules ──────────────────────────────────────────────────────
  it('is empty for a position nobody has played — never a roster-intention guess', () => {
    const r = recency('3B');
    assert.deepEqual(r.players, []);
    assert.deepEqual(r.appearances, []);
    assert.equal(r.gamesCovered, 0);
  });

  it('ignores a lineup saved for a FUTURE game', () => {
    const withFuture = [...SEASON, game('2026-08-09', 'vs Rapids', { maya: { C: 7 } })];
    const r = recency('C', withFuture);
    // Maya still waiting since Jul 12 — Saturday's plan is not a game she has played.
    assert.equal(r.players[0].name, 'Maya');
    assert.equal(r.players[0].daysSince, 21);
    assert.equal(r.gamesCovered, 3);
    assert.equal(r.appearances.length, 3);
  });

  it('counts a game played TODAY as played', () => {
    const withToday = [...SEASON, game(TODAY, 'vs Rapids', { maya: { C: 7 } })];
    const r = recency('C', withToday);
    const maya = r.players.find(p => p.name === 'Maya');
    assert.equal(maya?.daysSince, 0);
  });

  it('treats both halves of a double-header as covered games on the same day', () => {
    const doubleHeader = [
      game('2026-07-26', 'vs Comets (1)', { maya: { C: 4 } }, 'dh-1'),
      game('2026-07-26', 'vs Comets (2)', { jordan: { C: 4 } }, 'dh-2'),
    ];
    const r = recency('C', doubleHeader);
    assert.equal(r.gamesCovered, 2);
    assert.ok(r.players.every(p => p.daysSince === 7));
  });

  it('skips an entry whose player is no longer on the roster rather than printing a blank', () => {
    const withGhost = [...SEASON, game('2026-07-30', 'vs Jays', { ghost: { C: 7 } })];
    const r = recency('C', withGhost);
    assert.ok(r.appearances.every(a => a.name));
    assert.equal(r.appearances.length, 3);
    assert.equal(r.gamesCovered, 3);
  });

  it('ignores zero-inning entries (a bench row is not a turn at the position)', () => {
    const r = recency('C', [game('2026-07-26', 'vs Comets', { maya: { C: 0 }, jordan: { C: 7 } })]);
    assert.equal(r.players.length, 1);
    assert.equal(r.players[0].name, 'Jordan');
  });

  it('handles an empty season without throwing', () => {
    const r = recency('C', []);
    assert.deepEqual(r.players, []);
    assert.equal(r.gamesCovered, 0);
    assert.deepEqual(r.coveredSince, []);
  });

  it('breaks equal gaps by name so the order never wobbles', () => {
    const sameDay = [
      game('2026-07-26', 'vs Comets', { priya: { C: 3 }, jordan: { C: 4 } }),
      game('2026-07-30', 'vs Jays', { maya: { C: 7 } }),
    ];
    const r = recency('C', sameDay);
    assert.deepEqual(r.players.map(p => p.name), ['Jordan', 'Priya', 'Maya']);
  });
});

describe('rankPositionsByStaleness', () => {
  const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const ranked = () => rankPositionsByStaleness({ today: TODAY, games: SEASON, players: PLAYERS, positions });

  it('opens on the position whose longest-waiting player has waited longest', () => {
    assert.equal(ranked()[0].position, 'C');
    assert.equal(ranked()[0].daysSince, 21);
  });

  it('sorts never-played positions last, not first', () => {
    const tail = ranked().slice(-4);
    assert.ok(tail.every(r => r.daysSince === null));
    assert.deepEqual(ranked().filter(r => r.daysSince === null).map(r => r.position).sort(),
      ['2B', '3B', 'CF', 'P']);
  });

  it('returns every position asked for, once', () => {
    assert.equal(ranked().length, positions.length);
    assert.deepEqual([...new Set(ranked().map(r => r.position))].sort(), [...positions].sort());
  });
});

/**
 * ⚠⚠ **THE MATRIX PIVOT IS TESTED HERE BECAUSE IT NEARLY WASN'T TESTABLE AT ALL.** It was first
 * written inside `lib/team-season-analytics.ts`, which carries `import 'server-only'` — so the one
 * rule that makes the whole feature honest (*a position a player has never played is ABSENT, never
 * a zero and never a season-long gap*) sat in the single file this suite cannot load. `/simplify`
 * moved the pivot here, beside the function it pivots; these are the assertions that move earned.
 */
describe('computePositionRecencyMatrix', () => {
  const POSITIONS = [
    { code: 'C', label: 'Catcher' },
    { code: 'SS', label: 'Shortstop' },
    { code: '1B', label: 'First Base' },
    { code: 'P', label: 'Pitcher' },
  ];
  const matrix = (games = SEASON, today = TODAY) =>
    computePositionRecencyMatrix({ today, games, players: PLAYERS, positions: POSITIONS });

  it('gives a player a key ONLY for positions they have actually played', () => {
    const maya = matrix().rows.find(r => r.name === 'Maya')!;
    // Maya caught on Jul 12 and played LF/RF since; she has never been written in at SS, 1B or P.
    assert.deepEqual(Object.keys(maya.byPosition).sort(), ['C']);
    assert.equal(maya.byPosition.SS, undefined,
      'a position never played must be ABSENT, so a renderer draws "never" — not a large gap');
  });

  it('carries the days, the innings and the day of that last turn into each cell', () => {
    const maya = matrix().rows.find(r => r.name === 'Maya')!;
    assert.deepEqual(maya.byPosition.C, { daysSince: 21, innings: 5, day: '2026-07-12' });
  });

  it('never invents a row for a player who has never appeared in a lineup', () => {
    // Dev is on the roster and in no game.
    assert.equal(matrix().rows.some(r => r.name === 'Dev'), false);
  });

  it('orders rows by NAME, not by staleness — a measurement, never a ranking', () => {
    const names = matrix().rows.map(r => r.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  });

  it('passes the caller’s position vocabulary straight through, in the caller’s order', () => {
    assert.deepEqual(matrix().positions, POSITIONS);
  });

  it('counts gamesRead as games where SOMEONE filled one of these positions', () => {
    // All three season games have a C, an SS or a 1B in them.
    assert.equal(matrix().gamesRead, 3);
    // A position set nobody has played reads zero rather than counting the games anyway.
    const none = computePositionRecencyMatrix({
      today: TODAY, games: SEASON, players: PLAYERS, positions: [{ code: '3B', label: 'Third' }],
    });
    assert.equal(none.gamesRead, 0);
    // ⚠ The ROWS still exist — everyone who appeared in a lineup gets one, each with no cell filled,
    // so the column renders a line of dashes. This assertion used to expect `[]`, which encoded the
    // defect the P2 review found: rows were created only where a position had been played, so a
    // column nobody has filled (and, worse, a player who never left the bench) simply vanished.
    assert.deepEqual(none.rows.map(r => r.name).sort(), ['Jordan', 'Maya', 'Priya']);
    assert.ok(none.rows.every(r => Object.keys(r.byPosition).length === 0));
  });

  it('excludes a game dated in the FUTURE — a saved lineup is a plan, not a turn taken', () => {
    const withPlan = [...SEASON, game('2026-08-09', 'vs Rovers', { dev: { C: 6 } })];
    assert.equal(matrix(withPlan).rows.some(r => r.name === 'Dev'), false);
  });

  it('handles no games and no positions without throwing', () => {
    assert.deepEqual(matrix([]).rows, []);
    assert.equal(matrix([]).gamesRead, 0);
    // No COLUMNS asked for still means rows for everyone who appeared — a grid with no columns,
    // which is what a sport with no field positions would legitimately render.
    const noPositions = computePositionRecencyMatrix({ today: TODAY, games: SEASON, players: PLAYERS, positions: [] });
    assert.deepEqual(noPositions.rows.map(r => r.name).sort(), ['Jordan', 'Maya', 'Priya']);
    assert.deepEqual(noPositions.positions, []);
  });
});

/**
 * ⚠⚠ **THE ALWAYS-BENCHED PLAYER** — found by the P2 adversarial review, and the one row the matrix
 * most needs. The first implementation created a row only inside the per-position loop, so a player
 * written into every saved lineup and never given a position had NO row at all; the panel dropped
 * the miss and they vanished from the grid — while sitting at the TOP of the table above it, which
 * orders most-benched first. The player the report exists to surface was the one it omitted.
 */
describe('computePositionRecencyMatrix — the player who never left the bench', () => {
  const POSITIONS = [{ code: 'C', label: 'Catcher' }, { code: 'SS', label: 'Shortstop' }];
  // Dev is in both lineups and takes no position in either; Jordan plays SS.
  const BENCHED: PositionRecencyGame[] = [
    game('2026-07-19', 'vs Storm', { jordan: { SS: 7 }, dev: {} }),
    game('2026-07-26', 'vs Comets', { jordan: { SS: 7 }, dev: { Bench: 0 } }),
  ];
  const m = () => computePositionRecencyMatrix({
    today: TODAY, games: BENCHED, players: PLAYERS, positions: POSITIONS,
  });

  it('gives them a row, so the grid can draw a line of dashes', () => {
    const dev = m().rows.find(r => r.name === 'Dev');
    assert.ok(dev, 'a player in a saved lineup must have a row even with no position to their name');
    assert.deepEqual(dev!.byPosition, {},
      'and it must be EMPTY — every cell renders "never", which is the honest answer');
  });

  it('still refuses a row to a player who was never in a lineup at all', () => {
    // Priya and Maya are on the roster and in neither game.
    assert.deepEqual(m().rows.map(r => r.name).sort(), ['Dev', 'Jordan']);
  });

  it('does not let a FUTURE lineup conjure a row', () => {
    const planned = [...BENCHED, game('2026-08-09', 'vs Rovers', { priya: {} })];
    assert.equal(m().rows.some(r => r.name === 'Priya'), false);
    assert.equal(
      computePositionRecencyMatrix({ today: TODAY, games: planned, players: PLAYERS, positions: POSITIONS })
        .rows.some(r => r.name === 'Priya'),
      false,
      'a lineup saved for a game not yet played is a plan, and a plan puts nobody in this grid',
    );
  });
});
