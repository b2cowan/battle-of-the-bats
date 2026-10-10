import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifiedChanges, matchReplacedGames, scheduleChangesFromRows, type ReplaceRow } from '../../lib/schedule-change-classify.ts';

/**
 * Tournament admin redesign Stage 3, Part 5 — "Replace 2 games still to play? Their teams are told if U13 is
 * published" must be TRUE (owner ruling 2026-10-09, "tell it as moves"). Before: the replace deleted the games still
 * to play and inserted the draft's, and nobody was told anything.
 */

let n = 0;
const row = (over: Partial<ReplaceRow>): ReplaceRow => ({
  id: `g${++n}`, game_date: '2026-10-10', game_time: '09:00:00', location: 'Lions Park — Diamond 2', diamond_id: 'lions',
  venue_facility_id: 'd2', status: 'scheduled', division_id: 'u13', home_team_id: 'storm', away_team_id: 'mustangs', ...over,
});

describe('who still meets, who no longer does', () => {
  test('a pairing the draft keeps is a MOVE, on the draft\'s game', () => {
    const old = row({ id: 'old1' });
    const fresh = row({ id: 'new1', game_time: '13:00:00', venue_facility_id: 'd3', location: 'Lions Park — Diamond 3' });
    const { moves, dropped } = matchReplacedGames([old], [fresh]);
    assert.equal(dropped.length, 0);
    assert.equal(moves.length, 1);
    assert.equal(moves[0].after.id, 'new1');
    assert.equal(moves[0].before.game_time, '09:00:00');
  });
  test('home and away the other way round are the same two teams — and the move is still told', () => {
    const old = row({ id: 'old1' });
    const fresh = row({ id: 'new1', game_time: '13:00:00', home_team_id: 'mustangs', away_team_id: 'storm' });
    const { moves } = matchReplacedGames([old], [fresh]);
    assert.equal(moves.length, 1);
    // The before takes the new orientation, or the classifier would read a restructured matchup and stay silent.
    const changes = scheduleChangesFromRows(new Map([[moves[0].after.id, moves[0].before]]), [moves[0].after]);
    assert.deepEqual(classifiedChanges(changes).map(c => c.kind), ['moved']);
  });
  test('a pairing the draft drops is DROPPED (the caller keeps it, cancelled, in a published division)', () => {
    const { moves, dropped } = matchReplacedGames([row({ id: 'old1', home_team_id: 'storm', away_team_id: 'royals' })], [row({ id: 'new1' })]);
    assert.deepEqual(moves, []);
    assert.deepEqual(dropped.map(d => d.id), ['old1']);
    // Kept as a cancelled game, it is told as a cancellation.
    const kept = { ...dropped[0], id: 'kept1', status: 'cancelled' };
    const changes = scheduleChangesFromRows(new Map([['kept1', dropped[0]]]), [kept]);
    assert.deepEqual(classifiedChanges(changes).map(c => c.kind), ['cancelled']);
  });
  test('a pairing new to the draft tells nobody (it is in neither list)', () => {
    const { moves, dropped } = matchReplacedGames([], [row({ id: 'new1' })]);
    assert.deepEqual([moves.length, dropped.length], [0, 0]);
  });
  test('two games between the same teams pair earliest to earliest', () => {
    const olds = [row({ id: 'oldLate', game_date: '2026-10-11' }), row({ id: 'oldEarly', game_date: '2026-10-10' })];
    const news = [row({ id: 'newLate', game_date: '2026-10-11', game_time: '15:00:00' }), row({ id: 'newEarly', game_date: '2026-10-10', game_time: '15:00:00' })];
    const { moves } = matchReplacedGames(olds, news);
    assert.deepEqual(moves.map(m => `${m.before.id}→${m.after.id}`), ['oldEarly→newEarly', 'oldLate→newLate']);
  });
  test('a game drawn by pool slots pairs by its slots until its teams are known', () => {
    const old = row({ id: 'old1', home_team_id: null, away_team_id: null, home_slot_id: 'A1', away_slot_id: 'A2' });
    const fresh = row({ id: 'new1', home_team_id: null, away_team_id: null, home_slot_id: 'A2', away_slot_id: 'A1', game_time: '11:00:00' });
    assert.equal(matchReplacedGames([old], [fresh]).moves.length, 1);
  });
  test('a game with an empty side can\'t be matched: it is dropped, never guessed', () => {
    const old = row({ id: 'old1', away_team_id: null });
    assert.deepEqual(matchReplacedGames([old], [row({ id: 'new1' })]).dropped.map(d => d.id), ['old1']);
  });
  test('a move that changes nothing (same day, time and diamond) is no news', () => {
    const old = row({ id: 'old1' });
    const fresh = row({ id: 'new1' });
    const { moves } = matchReplacedGames([old], [fresh]);
    const changes = scheduleChangesFromRows(new Map([[moves[0].after.id, moves[0].before]]), [moves[0].after]);
    assert.deepEqual(classifiedChanges(changes), []);
  });
});

describe('the route reads what it replaces before the replace, and tells it after', () => {
  const route = readFileSync(new URL('../../app/api/admin/games/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const block = route.slice(route.indexOf("action === 'replace-division-round-robin'"), route.indexOf("action === 'delete-division-games'"));
  test('the replaced games are read before the transaction that deletes them', () => {
    assert.ok(block.indexOf('select(REPLACED_COLUMNS)') > 0);
    assert.ok(block.indexOf('select(REPLACED_COLUMNS)') < block.indexOf(".rpc('replace_division_round_robin_games'"));
  });
  test('only a published division is told, and only after the save stands', () => {
    assert.match(block, /await tellTheReplace\(ctx\.org, divRow\.tournament_id, replacedRows, reply\.body\.inserted, divisionShown\?\.schedule_visibility === 'published'\);/);
    assert.ok(block.indexOf('tellTheReplace(') > block.indexOf('reply.status !== 200'));
    const fn = route.slice(route.indexOf('async function tellTheReplace('), route.indexOf('async function announcePlayoffsIfFirstTime('));
    assert.match(fn, /if \(!published \|\| replaced\.length === 0\) return;/);
    assert.match(fn, /status: 'cancelled'/);
    assert.match(fn, /matchReplacedGames\(replaced, insertedRows\)/);
    assert.match(fn, /await announceScheduleChanges\(org, tournamentId, beforeById\);/);
    assert.match(fn, /catch \(err\)/, 'never fails the save');
  });
});

describe('a slot draft over games that got their teams (/review 2026-10-09)', () => {
  test('matched by the pool slots when the new game has slots only — told as a move, not a drop', () => {
    const old = row({ id: 'oldS', home_slot_id: 'sA', away_slot_id: 'sB' });
    const fresh = row({ id: 'newS', home_team_id: null, away_team_id: null, home_slot_id: 'sB', away_slot_id: 'sA', game_time: '13:00:00' });
    const { moves, dropped } = matchReplacedGames([old], [fresh]);
    assert.equal(dropped.length, 0);
    assert.equal(moves[0]?.after.id, 'newS');
  });
  test('a new game is never taken twice, even when both its keys match', () => {
    const a = row({ id: 'a', home_slot_id: 'sA', away_slot_id: 'sB' });
    const b = row({ id: 'b', home_slot_id: 'sA', away_slot_id: 'sB' });
    const fresh = row({ id: 'n1', home_slot_id: 'sA', away_slot_id: 'sB' });
    const { moves, dropped } = matchReplacedGames([a, b], [fresh]);
    assert.equal(moves.length, 1);
    assert.equal(dropped.length, 1);
  });
});
