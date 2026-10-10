import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  findRefusedOverlap, isRefusedOverlap, overlapGameOf, overlapOtherName, overlapRefusalWords, type OverlapGame,
} from '../../lib/tournament-overlap.ts';
import { checkVenueConflict } from '../../lib/schedule-conflict.ts';
import type { Division, Game, Tournament } from '../../lib/types.ts';

/**
 * Tournament admin redesign Stage 3, Part 4 — one overlap rule, refused at every door and on the server (A37).
 * Before: the Add window refused in the browser, the inline edit refused against the games on screen, the timeline drop
 * coloured and saved, the phone sheet warned and saved, Reinstate, the generators, the bracket editor and the rain
 * delay checked nothing, and only the import refused on the server.
 */

const T = { id: 't', settings: { game_duration_minutes: 75, buffer_minutes: 15 } } as unknown as Tournament;
const DIVS = [{ id: 'u11', name: 'U11', settings: {} }, { id: 'u13', name: 'U13', settings: { game_duration_minutes: 90 } }] as unknown as Division[];
const g = (over: Partial<OverlapGame>): OverlapGame => ({
  id: 'x', gameDate: '2026-10-09', startTime: '16:00', status: 'scheduled', divisionId: 'u11',
  venueId: 'lions', venueFacilityId: 'd2', location: 'Lions Park — Diamond 2', ...over,
});

describe('what is refused (A37)', () => {
  const final = g({ id: 'fin', isPlayoff: true, bracketCode: 'FIN' });
  const check = (p: OverlapGame) => checkVenueConflict({ proposedGame: p, allGames: [final], divisions: DIVS, tournament: T });

  test('two games on one picked diamond at once', () => {
    assert.equal(isRefusedOverlap(check(g({ id: 'p', startTime: '17:00' }))), true);
  });
  test('for the whole of the chain\'s length: a U11 game is 75 minutes (the event\'s), so 5:14 p.m. still overlaps', () => {
    assert.equal(isRefusedOverlap(check(g({ id: 'p', startTime: '17:14' }))), true);
    assert.equal(isRefusedOverlap(check(g({ id: 'p', startTime: '17:15' }))), false, 'a gap shorter than the buffer warns, never refuses');
    assert.equal(check(g({ id: 'p', startTime: '17:15' }))?.kind, 'buffer');
  });
  test('a game\'s own length wins: a 3-hour final still holds the diamond at 6:30 p.m.', () => {
    const long = g({ id: 'fin', isPlayoff: true, bracketCode: 'FIN', durationMinutes: 180 });
    const c = checkVenueConflict({ proposedGame: g({ id: 'p', startTime: '18:30' }), allGames: [long], divisions: DIVS, tournament: T });
    assert.equal(isRefusedOverlap(c), true);
  });
  test('another diamond at the same park is free', () => {
    assert.equal(check(g({ id: 'p', venueFacilityId: 'd3', location: 'Lions Park — Diamond 3' })), null);
  });
  test('two TYPED names that match only warn — a typed place isn\'t checked', () => {
    const typed = (id: string) => g({ id, venueId: null, venueFacilityId: null, location: 'Behind the school' });
    const c = checkVenueConflict({ proposedGame: typed('p'), allGames: [typed('q')], divisions: DIVS, tournament: T });
    assert.equal(c?.kind, 'overlap');
    assert.equal(c?.matchedOn, 'text');
    assert.equal(isRefusedOverlap(c), false);
  });
  test('a cancelled game holds no diamond', () => {
    const c = checkVenueConflict({ proposedGame: g({ id: 'p' }), allGames: [g({ id: 'q', status: 'cancelled' })], divisions: DIVS, tournament: T });
    assert.equal(c, null);
  });
});

describe('a batch is checked against the schedule and against itself', () => {
  const existing = [g({ id: 'a', startTime: '09:00' }), g({ id: 'b', startTime: '13:00', divisionId: 'u13' })];
  test('a draft\'s two games can\'t share a diamond either', () => {
    const found = findRefusedOverlap({ proposed: [g({ id: 'new:0', startTime: '11:00' }), g({ id: 'new:1', startTime: '11:30' })], existing, divisions: DIVS, tournament: T });
    assert.equal(found?.game.id, 'new:1');
    assert.equal(found?.conflict.conflictingGame.id, 'new:0');
  });
  test('a game moved replaces itself: moving it later never collides with where it was', () => {
    assert.equal(findRefusedOverlap({ proposed: [g({ id: 'a', startTime: '09:30' })], existing, divisions: DIVS, tournament: T }), null);
  });
  test('the games a write removes free their diamonds (a generator\'s replaced games, the bracket editor\'s dropped ones)', () => {
    const p = [g({ id: 'new:0', startTime: '13:30' })];
    assert.notEqual(findRefusedOverlap({ proposed: p, existing, divisions: DIVS, tournament: T }), null, 'U13 runs 90 minutes: 1:30 p.m. is taken');
    assert.equal(findRefusedOverlap({ proposed: p, existing, divisions: DIVS, tournament: T, removedIds: ['b'] }), null);
  });
  test('a cancelled proposal frees its diamond for the rest of the batch (the rain delay\'s cancel)', () => {
    const found = findRefusedOverlap({ proposed: [g({ id: 'a', status: 'cancelled' }), g({ id: 'new:0', startTime: '09:00' })], existing, divisions: DIVS, tournament: T });
    assert.equal(found, null);
  });
  test('Reinstate: a cancelled game back on its own diamond is refused when that time has been taken', () => {
    const taken = [g({ id: 'c', status: 'cancelled', startTime: '15:00' }), g({ id: 'd', startTime: '15:30' })];
    assert.notEqual(findRefusedOverlap({ proposed: [{ ...taken[0], status: 'scheduled' }], existing: taken, divisions: DIVS, tournament: T }), null);
  });
});

describe('the words — the field\'s red line and the server\'s refusal are one sentence', () => {
  const other = g({ id: 'fin', isPlayoff: true, bracketCode: 'FIN', startTime: '16:00' });
  const conflict = checkVenueConflict({ proposedGame: g({ id: 'p', startTime: '16:30' }), allGames: [other], divisions: DIVS, tournament: T })!;
  test('a playoff game by its round, the range by the chain, one period', () => {
    const w = overlapRefusalWords(conflict, { field: 'Diamond 2', noun: 'Diamond', divisions: DIVS, tournament: T });
    assert.equal(w.lead, 'Diamond 2 already has the U11 final, 4:00–5:15 p.m.');
    assert.equal(w.rest, " Two games in this tournament can't share a diamond: change the time or the diamond.");
  });
  test('a round-robin game by its two teams; a team not decided yet by its slot', () => {
    assert.equal(overlapOtherName(g({ awayName: 'Storm', homeName: 'Mustangs' }), DIVS), 'Storm vs Mustangs');
    assert.equal(overlapOtherName(g({ awayPlaceholder: 'Seed #2', homeName: 'Mustangs' }), DIVS), 'Seed 2 vs Mustangs');
  });
  test('a screen\'s game carries its teams\' names into the rule', () => {
    const game = { id: 'z', date: '2026-10-09', time: '16:00', homeTeamId: 'h', awayTeamId: 'a', divisionId: 'u11', status: 'scheduled' } as Game;
    const o = overlapGameOf(game, id => ({ h: 'Mustangs', a: 'Storm' })[id ?? ''] ?? null);
    assert.equal(overlapOtherName(o, DIVS), 'Storm vs Mustangs');
  });
});

describe('every writer refuses before its first write (A37 — fails when a new writer skips it)', () => {
  const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const games = src('app/api/admin/games/route.ts');
  const block = (action: string) => {
    const at = games.indexOf(`action === '${action}'`);
    assert.ok(at > 0, `no ${action} writer`);
    const next = games.slice(at + 10).search(/\n\s+(?:else )?if \(action === '/);
    return games.slice(at, next < 0 ? undefined : at + 10 + next);
  };
  const firstWrite = (b: string) => {
    const hits = [/\.insert\(/, /\.update\(/, /\.rpc\(/, /\.delete\(/].map(re => b.search(re)).filter(i => i >= 0);
    return hits.length ? Math.min(...hits) : Infinity;
  };
  for (const action of ['bulk-save', 'create', 'save-bracket', 'replace-division-round-robin', 'bulk-reschedule', 'bulk-restore', 'update', 'revert-to-scheduled']) {
    test(`the games route's ${action}`, () => {
      const b = block(action);
      const at = b.indexOf('overlapRefused(');
      assert.ok(at >= 0, `${action} never asks the overlap rule`);
      assert.ok(at < firstWrite(b), `${action} writes before it asks`);
    });
  }
  test('the typed-locations resolver and its Undo', () => {
    const loc = src('app/api/admin/schedule-locations/route.ts');
    const apply = loc.slice(loc.indexOf('async function applyAssignments'), loc.indexOf('async function revertGames'));
    const revert = loc.slice(loc.indexOf('async function revertGames'));
    for (const [name, b] of [['apply', apply], ['undo', revert]] as const) {
      const at = b.indexOf('tournamentOverlapRefusal(');
      assert.ok(at >= 0, `${name} never asks`);
      const create = Math.min(...['createTournamentVenue(', 'createTournamentFacility(', '.update('].map(s => b.indexOf(s)).filter(i => i >= 0));
      assert.ok(at < create, `${name} creates or writes before it asks`);
    }
  });
  test('the temporary lanes\' resolve', () => {
    const lanes = src('app/api/admin/schedule-facility-lanes/route.ts');
    const b = lanes.slice(lanes.indexOf("action === 'resolve'"));
    assert.ok(b.indexOf('tournamentOverlapRefusal(') >= 0 && b.indexOf('tournamentOverlapRefusal(') < b.indexOf('.update('));
  });
  test('a new games action is a decision: every action the route has is either a writer above or named here', () => {
    const actions = [...games.matchAll(/action === '([a-z-]+)'/g)].map(m => m[1]);
    // These place nothing: they delete, score, cancel (which frees a diamond) or finalize.
    const placesNothing = new Set(['delete-game', 'delete-division-games', 'delete-games', 'delete-playoff-games', 'delete-division-playoff-games',
      'delete-tournament-games', 'cancel', 'forfeit', 'submit-score', 'finalize', 'revert-score']);
    const writers = new Set(['bulk-save', 'create', 'save-bracket', 'replace-division-round-robin', 'bulk-reschedule', 'bulk-restore', 'update', 'revert-to-scheduled']);
    const unknown = [...new Set(actions)].filter(a => !writers.has(a) && !placesNothing.has(a));
    assert.deepEqual(unknown, [], 'a new action that places a game must ask the overlap rule before it writes');
  });
});
