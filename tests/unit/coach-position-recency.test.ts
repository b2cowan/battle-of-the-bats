import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computePositionRecency,
  rankPositionsByStaleness,
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
