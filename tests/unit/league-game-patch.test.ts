import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { invalidGamePatch } from '../../lib/league-game-patch.ts';

/** 9d-2a /review call 7a (owner 2026-10-28): a bad status or score is a 400 with a sentence, never a 500. */
describe('a house-league game\'s patch: status and score', () => {
  it('takes the four states a game can hold and nothing else', () => {
    for (const status of ['scheduled', 'completed', 'cancelled', 'postponed']) assert.equal(invalidGamePatch({ status }), null, status);
    for (const status of ['finished', '', null, 3, undefined]) {
      assert.match(invalidGamePatch({ status })!, /scheduled, completed, cancelled or postponed/, String(status));
    }
  });

  it('takes both scores whole and 0 or more, or a clear of both', () => {
    assert.equal(invalidGamePatch({ homeScore: 3, awayScore: 0 }), null);
    assert.equal(invalidGamePatch({ homeScore: null, awayScore: null }), null);
    assert.equal(invalidGamePatch({ notes: 'x' }), null);
  });

  it('refuses one score alone, a half-clear, a negative, a fraction, a string', () => {
    for (const body of [
      { homeScore: 3 }, { awayScore: 3 }, { homeScore: 3, awayScore: null }, { homeScore: null, awayScore: 2 },
      { homeScore: -1, awayScore: 2 }, { homeScore: 1.5, awayScore: 2 }, { homeScore: '3', awayScore: 2 }, { homeScore: NaN, awayScore: 1 },
    ]) assert.ok(invalidGamePatch(body), JSON.stringify(body));
  });

  it('the route runs it before any write, and an unreadable body is a 400 too', () => {
    const code = readFileSync(new URL('../../app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts', import.meta.url), 'utf8');
    const patch = code.slice(code.indexOf('export const PATCH'), code.indexOf('export const DELETE'));
    assert.match(patch, /req\.json\(\)\.catch\(\(\) => null\)/);
    assert.ok(patch.indexOf('invalidGamePatch(body)') > 0 && patch.indexOf('invalidGamePatch(body)') < patch.indexOf('updateLeagueGame(gameId, patch'));
  });
});

/** 9d-2a /review call 5: the Generate check says it could not look, rather than reading clean. */
describe('Generate games\' check fails closed', () => {
  const server = readFileSync(new URL('../../lib/league-generate-server.ts', import.meta.url), 'utf8');
  it('turns a failed permit, club or house-league read into a warning', () => {
    assert.match(server, /club\.unread\?\.includes\('permit'\)\) warnings\.push\(\{ kind: 'unread', what: 'permit' \}\)/);
    assert.match(server, /club\.unread\?\.includes\('clashes'\) \|\| own\.unread\) warnings\.push\(\{ kind: 'unread', what: 'schedule' \}\)/);
  });
  it('the shared reads flag a failure and keep the save replies\' quiet policy', () => {
    const lookup = readFileSync(new URL('../../lib/venue-clash-lookup.ts', import.meta.url), 'utf8');
    assert.match(lookup, /\(out\.unread \?\?= \[\]\)\.push\('clashes'\)/);
    assert.match(lookup, /if \(permitFailed\) \(out\.unread \?\?= \[\]\)\.push\('permit'\)/);
    const venue = readFileSync(new URL('../../lib/league-venue.ts', import.meta.url), 'utf8');
    assert.match(venue, /if \(gamesRes\.error \|\| practicesRes\.error\) result\.unread = true/);
  });
});
