import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { invalidGamePatch, scoreRuleStatus } from '../../lib/league-game-patch.ts';

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

/** House League 9e-1: a game counts once both scores are in — and the server, not only the window, says so. */
describe('the score rule (stored row + patch)', () => {
  const played = { status: 'completed', homeScore: 5, awayScore: 3 };
  const on = { status: 'scheduled', homeScore: null, awayScore: null };
  it('both scores in, no status: played', () => {
    assert.deepEqual(scoreRuleStatus(on, { homeScore: 4, awayScore: 4 }), { status: 'completed' });
    assert.deepEqual(scoreRuleStatus(played, { homeScore: 6, awayScore: 3 }), { status: 'completed' });
  });
  it('both cleared, no status: a played game is on again; an unplayed one is left as it is', () => {
    assert.deepEqual(scoreRuleStatus(played, { homeScore: null, awayScore: null }), { status: 'scheduled' });
    assert.deepEqual(scoreRuleStatus(on, { homeScore: null, awayScore: null }), { status: undefined });
    assert.deepEqual(scoreRuleStatus({ ...on, status: 'postponed' }, { homeScore: null, awayScore: null }), { status: undefined });
  });
  it('refuses a game completed without both scores — cleared with completed, or completed alone on an unscored game', () => {
    assert.equal(scoreRuleStatus(played, { homeScore: null, awayScore: null, status: 'completed' }), 'refused');
    assert.equal(scoreRuleStatus(on, { status: 'completed' }), 'refused');
    assert.equal(scoreRuleStatus({ status: 'scheduled', homeScore: 2, awayScore: null }, { status: 'completed' }), 'refused');
  });
  it('lets through what it always did: the window’s own saves, postpone and cancel, put back on, a note', () => {
    assert.deepEqual(scoreRuleStatus(played, { homeScore: null, awayScore: null, status: 'scheduled' }), { status: 'scheduled' });
    assert.deepEqual(scoreRuleStatus(on, { homeScore: 2, awayScore: 1, status: 'completed' }), { status: 'completed' });
    assert.deepEqual(scoreRuleStatus(played, { status: 'cancelled' }), { status: 'cancelled' });
    assert.deepEqual(scoreRuleStatus(on, { status: 'postponed' }), { status: 'postponed' });
    assert.deepEqual(scoreRuleStatus(played, { status: 'completed' }), { status: 'completed' });
    assert.deepEqual(scoreRuleStatus({ status: 'completed', homeScore: null, awayScore: null }, {}), { status: undefined });
  });
  it('the route reads the stored scores and runs the rule before the write', () => {
    const code = readFileSync(new URL('../../app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts', import.meta.url), 'utf8');
    assert.ok(code.includes(".select('id, division_id, status, home_score, away_score,"), 'the stored scores are read');
    const patch = code.slice(code.indexOf('export const PATCH'), code.indexOf('export const DELETE'));
    const rule = patch.indexOf('scoreRuleStatus(');
    assert.ok(rule > patch.indexOf('invalidGamePatch(body)') && rule < patch.indexOf('updateLeagueGame(gameId, patch'));
    assert.doesNotMatch(patch, /If entering scores, auto-set status to completed/);
  });
});
