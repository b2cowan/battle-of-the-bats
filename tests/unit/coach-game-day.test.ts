/**
 * Game-Day Mode P1 — pure-logic tests (lib/coach-game-day.ts).
 *
 * Four contracts, table-driven:
 *  1. The live window: `[min(arrival, starts − 2h), (ends ?? starts + 4h) + 3h]`, boundaries
 *     inclusive; "live" is a time window, never a stored state.
 *  2. The swap math: the incoming player INHERITS the outgoing player's remaining schedule
 *     (planned rotations survive), the outgoing player sits; immutable; no-ops stay `===`.
 *  3. Result derivation: both scores or nothing — never guess half a score.
 *  4. The quiet-flag guard: score fields only, live window only, never mirrored — the flag
 *     must not become a general notification bypass.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BENCH,
  applyConsoleSwap,
  consoleMode,
  deriveGameResult,
  gameDayWindow,
  GAME_DAY_ASSUMED_DURATION_MS,
  GAME_DAY_LINGERS_AFTER_MS,
  GAME_DAY_OPENS_BEFORE_MS,
  isGameDayEvent,
  isInGameDayWindow,
  resolveArrivalInstantMs,
  validateQuietScoreWrite,
  type GameDayEventShape,
} from '../../lib/coach-game-day.ts';

/** 6:30 PM Toronto (EDT, UTC−4) on 2026-06-14 → 22:30Z. */
const STARTS = '2026-06-14T22:30:00.000Z';
const STARTS_MS = new Date(STARTS).getTime();
const HOUR = 60 * 60 * 1000;

const game = (overrides: Partial<GameDayEventShape> = {}): GameDayEventShape => ({
  eventType: 'league_game',
  status: 'scheduled',
  startsAt: STARTS,
  endsAt: null,
  arrivalTime: null,
  ...overrides,
});

describe('resolveArrivalInstantMs', () => {
  it('resolves HH:mm on the game day in the org zone (5:45 PM Toronto → 21:45Z)', () => {
    assert.equal(resolveArrivalInstantMs(STARTS, '17:45'), new Date('2026-06-14T21:45:00.000Z').getTime());
  });
  it('tolerates a single-digit hour', () => {
    assert.equal(resolveArrivalInstantMs(STARTS, '9:00'), new Date('2026-06-14T13:00:00.000Z').getTime());
  });
  it('degrades to null rather than a broken instant', () => {
    assert.equal(resolveArrivalInstantMs(STARTS, null), null);
    assert.equal(resolveArrivalInstantMs(STARTS, 'soon'), null);
    assert.equal(resolveArrivalInstantMs('not-a-date', '17:45'), null);
  });
});

describe('gameDayWindow', () => {
  it('without an arrival time, opens 2h before first pitch', () => {
    const w = gameDayWindow(game());
    assert.ok(w);
    assert.equal(w.opensAtMs, STARTS_MS - GAME_DAY_OPENS_BEFORE_MS);
  });

  it('an arrival EARLIER than starts−2h opens the window (min of the two)', () => {
    // 3:00 PM Toronto = 19:00Z, earlier than 20:30Z (starts − 2h).
    const w = gameDayWindow(game({ arrivalTime: '15:00' }));
    assert.ok(w);
    assert.equal(w.opensAtMs, new Date('2026-06-14T19:00:00.000Z').getTime());
  });

  it('an arrival LATER than starts−2h does not shrink the window', () => {
    // 5:45 PM Toronto = 21:45Z, later than 20:30Z — the 2h floor wins.
    const w = gameDayWindow(game({ arrivalTime: '17:45' }));
    assert.ok(w);
    assert.equal(w.opensAtMs, STARTS_MS - GAME_DAY_OPENS_BEFORE_MS);
  });

  it('without an end time, closes at starts + 4h + 3h', () => {
    const w = gameDayWindow(game());
    assert.ok(w);
    assert.equal(w.closesAtMs, STARTS_MS + GAME_DAY_ASSUMED_DURATION_MS + GAME_DAY_LINGERS_AFTER_MS);
  });

  it('with an end time, closes 3h after it', () => {
    const ends = '2026-06-15T00:30:00.000Z';
    const w = gameDayWindow(game({ endsAt: ends }));
    assert.ok(w);
    assert.equal(w.closesAtMs, new Date(ends).getTime() + GAME_DAY_LINGERS_AFTER_MS);
  });

  it('an unparseable start yields NO window, not a NaN-anchored one', () => {
    assert.equal(gameDayWindow(game({ startsAt: 'garbage' })), null);
  });
});

describe('isInGameDayWindow — boundaries inclusive, gate by type and status', () => {
  const e = game();
  const w = gameDayWindow(e)!;

  const table: [string, GameDayEventShape, number, boolean][] = [
    ['exactly at open', e, w.opensAtMs, true],
    ['1ms before open', e, w.opensAtMs - 1, false],
    ['mid-game', e, STARTS_MS + HOUR, true],
    ['exactly at close', e, w.closesAtMs, true],
    ['1ms after close', e, w.closesAtMs + 1, false],
    ['cancelled game, mid-window', game({ status: 'cancelled' }), STARTS_MS + HOUR, false],
    ['a practice, mid-window', game({ eventType: 'practice' }), STARTS_MS + HOUR, false],
    ['a team event, mid-window', game({ eventType: 'team_event' }), STARTS_MS + HOUR, false],
    ['a scrimmage counts as a game', game({ eventType: 'scrimmage' }), STARTS_MS + HOUR, true],
    ['a tournament game counts', game({ eventType: 'tournament_game' }), STARTS_MS + HOUR, true],
  ];
  for (const [label, event, nowMs, expected] of table) {
    it(label, () => assert.equal(isInGameDayWindow(event, nowMs), expected));
  }

  it('isGameDayEvent alone ignores the clock (used by the console 404 gate)', () => {
    assert.equal(isGameDayEvent(game()), true);
    assert.equal(isGameDayEvent(game({ status: 'cancelled' })), false);
    assert.equal(isGameDayEvent(game({ eventType: 'practice' })), false);
  });
});

describe('consoleMode — the deep link never 404s and never offers stale writes', () => {
  const e = game();
  const w = gameDayWindow(e)!;
  it('before the window → review (nothing to run yet)', () => {
    assert.equal(consoleMode(e, w.opensAtMs - HOUR), 'review');
  });
  it('inside the window → live', () => {
    assert.equal(consoleMode(e, STARTS_MS), 'live');
  });
  it('after the window → review (the record stands)', () => {
    assert.equal(consoleMode(e, w.closesAtMs + HOUR), 'review');
  });
  it('a cancelled game is review even mid-window', () => {
    assert.equal(consoleMode(game({ status: 'cancelled' }), STARTS_MS), 'review');
  });
});

describe('deriveGameResult — both scores or nothing', () => {
  const table: [number | null | undefined, number | null | undefined, string | null][] = [
    [4, 2, 'win'],
    [2, 4, 'loss'],
    [3, 3, 'tie'],
    [0, 0, 'tie'],
    [null, 2, null],
    [2, null, null],
    [undefined, undefined, null],
    [Number.NaN, 2, null],
  ];
  for (const [ts, os, expected] of table) {
    it(`(${ts}, ${os}) → ${expected}`, () => assert.equal(deriveGameResult(ts, os), expected));
  }
});

describe('applyConsoleSwap — the grid math', () => {
  // A pitches then catches; B sits all game; C rotates SS → Bench → SS.
  const rows = () => [
    { playerId: 'A', inningPositions: { '1': 'P', '2': 'P', '3': 'C' } },
    { playerId: 'B', inningPositions: { '1': BENCH, '2': BENCH, '3': BENCH } },
    { playerId: 'C', inningPositions: { '1': 'SS', '2': BENCH, '3': 'SS' } },
  ];

  it('onward: the incoming player inherits the remaining schedule; the outgoing sits', () => {
    const out = applyConsoleSwap(rows(), {
      inPlayerId: 'B', outPlayerId: 'A', fromPeriod: 2, periodCount: 3, scope: 'onward',
    });
    assert.deepEqual(out.find(r => r.playerId === 'B')!.inningPositions, { '1': BENCH, '2': 'P', '3': 'C' });
    assert.deepEqual(out.find(r => r.playerId === 'A')!.inningPositions, { '1': 'P', '2': BENCH, '3': BENCH });
  });

  it('onward: a planned bench sit in the outgoing schedule survives the swap', () => {
    const out = applyConsoleSwap(rows(), {
      inPlayerId: 'B', outPlayerId: 'C', fromPeriod: 1, periodCount: 3, scope: 'onward',
    });
    // B takes C's whole rotation, INCLUDING the planned inning-2 sit.
    assert.deepEqual(out.find(r => r.playerId === 'B')!.inningPositions, { '1': 'SS', '2': BENCH, '3': 'SS' });
    assert.deepEqual(out.find(r => r.playerId === 'C')!.inningPositions, { '1': BENCH, '2': BENCH, '3': BENCH });
  });

  it('single: exactly one period changes', () => {
    const out = applyConsoleSwap(rows(), {
      inPlayerId: 'B', outPlayerId: 'A', fromPeriod: 2, periodCount: 3, scope: 'single',
    });
    assert.deepEqual(out.find(r => r.playerId === 'B')!.inningPositions, { '1': BENCH, '2': 'P', '3': BENCH });
    assert.deepEqual(out.find(r => r.playerId === 'A')!.inningPositions, { '1': 'P', '2': BENCH, '3': 'C' });
  });

  it('an absent grid key on the outgoing row reads as unassigned, not a crash', () => {
    const sparse: { playerId: string; inningPositions: Record<string, string> }[] = [
      { playerId: 'A', inningPositions: { '1': 'P' } },
      { playerId: 'B', inningPositions: {} },
    ];
    const out = applyConsoleSwap(sparse, {
      inPlayerId: 'B', outPlayerId: 'A', fromPeriod: 1, periodCount: 2, scope: 'onward',
    });
    assert.deepEqual(out.find(r => r.playerId === 'B')!.inningPositions, { '1': 'P', '2': '' });
    assert.deepEqual(out.find(r => r.playerId === 'A')!.inningPositions, { '1': BENCH, '2': BENCH });
  });

  it('empty-slot fill: writes only the incoming player; nobody is benched for it', () => {
    const before = rows();
    const out = applyConsoleSwap(before, {
      inPlayerId: 'B', outPlayerId: null, position: 'RF', fromPeriod: 2, periodCount: 3, scope: 'onward',
    });
    assert.deepEqual(out.find(r => r.playerId === 'B')!.inningPositions, { '1': BENCH, '2': 'RF', '3': 'RF' });
    // Untouched rows keep their identity — the debounced save diff stays honest.
    assert.equal(out.find(r => r.playerId === 'A'), before.find(r => r.playerId === 'A'));
    assert.equal(out.find(r => r.playerId === 'C'), before.find(r => r.playerId === 'C'));
  });

  it('never mutates the input rows', () => {
    const before = rows();
    const frozen = JSON.stringify(before);
    applyConsoleSwap(before, {
      inPlayerId: 'B', outPlayerId: 'A', fromPeriod: 1, periodCount: 3, scope: 'onward',
    });
    assert.equal(JSON.stringify(before), frozen);
  });

  const NOOPS: [string, Parameters<typeof applyConsoleSwap>[1]][] = [
    ['self-swap', { inPlayerId: 'A', outPlayerId: 'A', fromPeriod: 1, periodCount: 3, scope: 'onward' }],
    ['period below range', { inPlayerId: 'B', outPlayerId: 'A', fromPeriod: 0, periodCount: 3, scope: 'onward' }],
    ['period above range', { inPlayerId: 'B', outPlayerId: 'A', fromPeriod: 4, periodCount: 3, scope: 'onward' }],
    ['unknown incoming player', { inPlayerId: 'Z', outPlayerId: 'A', fromPeriod: 1, periodCount: 3, scope: 'onward' }],
    ['unknown outgoing player', { inPlayerId: 'B', outPlayerId: 'Z', fromPeriod: 1, periodCount: 3, scope: 'onward' }],
    ['empty-slot fill without a position', { inPlayerId: 'B', outPlayerId: null, fromPeriod: 1, periodCount: 3, scope: 'onward' }],
  ];
  for (const [label, swap] of NOOPS) {
    it(`${label} is a no-op returning the same array`, () => {
      const before = rows();
      assert.equal(applyConsoleSwap(before, swap), before);
    });
  }
});

describe('validateQuietScoreWrite — the flag must never widen', () => {
  const live = { ...game(), mirrored: false };
  const nowLive = STARTS_MS + HOUR;

  it('a score-only write inside the window is quiet-eligible', () => {
    assert.deepEqual(
      validateQuietScoreWrite({ bodyKeys: ['teamScore'], event: live, nowMs: nowLive }),
      { ok: true },
    );
    assert.deepEqual(
      validateQuietScoreWrite({ bodyKeys: ['teamScore', 'opponentScore'], event: live, nowMs: nowLive }),
      { ok: true },
    );
  });

  const REJECTS: [string, string[], typeof live, number][] = [
    ['an empty body', [], live, nowLive],
    ['a non-score field', ['teamScore', 'opponent'], live, nowLive],
    // `result` mid-game would lie to the Season Record until End game — the final write is non-quiet.
    ['result riding along', ['teamScore', 'result'], live, nowLive],
    ['a schedule change', ['startsAt'], live, nowLive],
    ['a mirrored game', ['teamScore'], { ...live, mirrored: true }, nowLive],
    ['a cancelled game', ['teamScore'], { ...live, status: 'cancelled' }, nowLive],
    ['a practice', ['teamScore'], { ...live, eventType: 'practice' }, nowLive],
    ['before the window opens', ['teamScore'], live, gameDayWindow(live)!.opensAtMs - 1],
    ['after the window closes', ['teamScore'], live, gameDayWindow(live)!.closesAtMs + 1],
  ];
  for (const [label, bodyKeys, event, nowMs] of REJECTS) {
    it(`rejects ${label}`, () => {
      const verdict = validateQuietScoreWrite({ bodyKeys, event, nowMs });
      assert.equal(verdict.ok, false);
    });
  }
});
