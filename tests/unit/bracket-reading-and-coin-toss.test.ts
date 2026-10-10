import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Game } from '../../lib/types';
import { bracketChampion, bracketSides, playedCount } from '../../lib/bracket-reading.ts';
import { gamesWaitingOnToss, pendingCoinTosses } from '../../lib/coin-toss.ts';
import { FINISH_WORDS } from '../../lib/after-event-words.ts';
import { championFinish } from '../../lib/event-recap.ts';
import { BRACKET_WORDS, COIN_TOSS_WORDS, PUBLISH_WORDS, bracketWhen } from '../../lib/schedule-words.ts';

/**
 * Tournament admin redesign Stage 3, Part 7 — the organizer's bracket reads the public bracket's way (S6 / A38), a coin
 * toss still owed is said where the seeds wait (S7 / A43), and the Publish window says what publishing does (S8).
 * The readings decide nothing of their own: who won is the champion rule's `isDecided`, the champion is the finished
 * board's, a toss is the standings engine's flag.
 */

let n = 0;
const game = (over: Partial<Game>): Game => ({
  id: `g${++n}`, tournamentId: 't', divisionId: 'u11', date: '2026-10-09', time: '14:00:00', location: '',
  homeTeamId: '', awayTeamId: '', status: 'scheduled', isPlayoff: true, ...over,
} as Game);

const TEAMS = [
  { id: 'rapids', name: 'Riverdale Rapids' },
  { id: 'cyclones', name: 'Cedar Hollow Cyclones' },
  { id: 'marauders', name: 'Maple Ridge Marauders' },
  { id: 'sharks', name: 'Silver Creek Sharks' },
];
const U11 = { id: 'u11', name: 'U11' };

describe('a bracket game reads its two sides (S6)', () => {
  test('the winner is bold and checked, each team keeps the slot it came from', () => {
    const sf1 = game({ bracketCode: 'SF1', status: 'completed', awayTeamId: 'rapids', homeTeamId: 'sharks',
      awayPlaceholder: 'Seed #1', homePlaceholder: 'Seed #4', awayScore: 14, homeScore: 6 });
    const { away, home } = bracketSides(sf1, TEAMS);
    assert.deepEqual(away, { name: 'Riverdale Rapids', slot: 'Seed 1', score: 14, won: true, known: true });
    assert.deepEqual(home, { name: 'Silver Creek Sharks', slot: 'Seed 4', score: 6, won: false, known: true });
  });
  test('a slot still waiting reads its words, with nothing under it', () => {
    const fin = game({ bracketCode: 'FIN', awayPlaceholder: 'Winner SF1', homePlaceholder: 'Winner SF2' });
    const { away } = bracketSides(fin, TEAMS);
    assert.equal(away.name, 'Semifinal 1 winner');
    assert.equal(away.slot, null);
    assert.equal(away.known, false);
    assert.equal(away.score, null);
  });
  test('a forfeit names its winner but never its nominal score (the finished board never shows it)', () => {
    const f = game({ bracketCode: 'SF2', status: 'forfeit', awayTeamId: 'cyclones', homeTeamId: 'marauders', awayScore: 7, homeScore: 0 });
    const { away, home } = bracketSides(f, TEAMS);
    assert.equal(away.won, true);
    assert.equal(away.score, null);
    assert.equal(home.score, null);
  });
  test('a scheduled game\'s stored zeros are no score, and nobody has won it', () => {
    const g = game({ bracketCode: 'SF1', awayTeamId: 'rapids', homeTeamId: 'sharks', awayScore: 0, homeScore: 0 });
    const { away, home } = bracketSides(g, TEAMS);
    assert.equal(away.score, null);
    assert.equal(away.won || home.won, false);
  });
  test('a round band counts what was played — a score waiting on review is played', () => {
    assert.equal(playedCount([game({ status: 'completed' }), game({ status: 'submitted' }), game({ status: 'scheduled' })]), 2);
  });
});

describe('the champion where the bracket ends (S6) — the finished board\'s sentence, one definition', () => {
  const sf1 = game({ bracketCode: 'SF1', status: 'completed', awayTeamId: 'rapids', homeTeamId: 'sharks', awayScore: 14, homeScore: 6 });
  const sf2 = game({ bracketCode: 'SF2', status: 'completed', awayTeamId: 'cyclones', homeTeamId: 'marauders', awayScore: 10, homeScore: 8 });
  test('the final still to play: "Decided by the final", and its two teams once both are known', () => {
    const fin = game({ bracketCode: 'FIN', awayTeamId: 'rapids', homeTeamId: 'cyclones' });
    const games = [sf1, sf2, fin];
    assert.deepEqual(bracketChampion(U11, games, games, TEAMS, true), { kind: 'waiting', either: ['Riverdale Rapids', 'Cedar Hollow Cyclones'] });
    const open = game({ bracketCode: 'FIN', awayPlaceholder: 'Winner SF1', homePlaceholder: 'Winner SF2' });
    assert.deepEqual(bracketChampion(U11, [open], [open], TEAMS, true), { kind: 'waiting', either: null });
  });
  test('decided: the team, and the same caption the finished board writes', () => {
    const fin = game({ bracketCode: 'FIN', status: 'completed', awayTeamId: 'cyclones', homeTeamId: 'rapids', awayScore: 5, homeScore: 4 });
    const games = [sf1, sf2, fin];
    const champion = bracketChampion(U11, games, games, TEAMS, true);
    const finish = championFinish(U11, games, id => TEAMS.find(t => t.id === id)?.name ?? null);
    assert.ok(finish);
    assert.deepEqual(champion, { kind: 'decided', team: 'Cedar Hollow Cyclones', caption: FINISH_WORDS.caption(finish) });
    assert.equal(champion?.kind === 'decided' && champion.caption, 'U11 champion · beat Riverdale Rapids 5–4 in the final');
  });
  test('a lower tier and a bracket with no final draw no champion card (Stage 4: no final, no trophy)', () => {
    const fin = game({ bracketCode: 'FIN', awayTeamId: 'rapids', homeTeamId: 'cyclones' });
    assert.equal(bracketChampion(U11, [fin], [fin], TEAMS, false), null);
    assert.equal(bracketChampion(U11, [sf1, sf2], [sf1, sf2], TEAMS, true), null);
    const third = game({ bracketCode: '3RD', awayTeamId: 'sharks', homeTeamId: 'marauders' });
    assert.equal(bracketChampion(U11, [third], [third], TEAMS, true), null);
  });
});

describe('a coin toss still owed (S7) — the standings engine\'s flag, read once for every screen', () => {
  // Rapids win everything; Cyclones and Marauders draw and finish level on points; Sharks lose everything.
  const rr = (away: string, home: string, as: number, hs: number) =>
    game({ isPlayoff: false, status: 'completed', awayTeamId: away, homeTeamId: home, awayScore: as, homeScore: hs });
  const roundRobin = [
    rr('rapids', 'sharks', 9, 1), rr('rapids', 'marauders', 6, 2), rr('rapids', 'cyclones', 5, 3),
    rr('cyclones', 'sharks', 7, 2), rr('marauders', 'sharks', 8, 4), rr('cyclones', 'marauders', 3, 3),
  ];
  const teams = TEAMS.map(t => ({ ...t, divisionId: 'u11', status: 'accepted' }));
  const sf1 = game({ id: 'sf1', bracketCode: 'SF1', awayPlaceholder: 'Seed #1', homePlaceholder: 'Seed #4' });
  const sf2 = game({ id: 'sf2', bracketCode: 'SF2', awayPlaceholder: 'Seed #2', homePlaceholder: 'Seed #3' });
  const division = (over = {}) => ({ id: 'u11', name: 'U11', playoffConfig: { tieBreakers: ['coin'], ...over } as never });

  test('the tie, the seeds it decides, and the semifinal that waits for it', () => {
    const [toss, ...rest] = pendingCoinTosses({ divisions: [division()], teams, games: [...roundRobin, sf1, sf2] });
    assert.equal(rest.length, 0);
    assert.deepEqual(toss.places, [2, 3]);
    assert.equal(toss.pool, null);
    assert.deepEqual(toss.teams.map(t => t.id).sort(), ['cyclones', 'marauders']);
    assert.deepEqual(toss.waits.map(w => w.bracketCode), ['SF2']);
    assert.deepEqual([...gamesWaitingOnToss([toss])], ['sf2']);
  });
  test('a recorded toss is no longer owed', () => {
    const [toss] = pendingCoinTosses({ divisions: [division()], teams, games: roundRobin });
    const recorded = division({ coinTossResults: { [toss.groupKey]: ['marauders', 'cyclones'] } });
    assert.deepEqual(pendingCoinTosses({ divisions: [recorded], teams, games: roundRobin }), []);
  });
  test('no toss is owed where the toss is not a tie-breaker', () => {
    const noCoin = { id: 'u11', name: 'U11', playoffConfig: { tieBreakers: ['rd'] } as never };
    assert.deepEqual(pendingCoinTosses({ divisions: [noCoin], teams, games: roundRobin }), []);
  });
  test('a bracket that reads a pool\'s table says places in the pool', () => {
    const pooled = teams.map(t => ({ ...t, poolId: 'pa' }));
    const sf = game({ id: 'sfp', bracketCode: 'SF2', awayPlaceholder: '2nd Pool A', homePlaceholder: '3rd Pool A' });
    const div = { ...division(), pools: [{ id: 'pa', name: 'A' }, { id: 'pb', name: 'B' }] };
    const [toss] = pendingCoinTosses({ divisions: [div], teams: pooled, games: [...roundRobin, sf] });
    assert.equal(toss.pool, 'A Pool');
    assert.deepEqual(toss.places, [2, 3]);
    assert.deepEqual(toss.waits.map(w => w.gameId), ['sfp']);
  });
  test('a game already played never waits', () => {
    const played = { ...sf2, status: 'completed' as const };
    const [toss] = pendingCoinTosses({ divisions: [division()], teams, games: [...roundRobin, played] });
    assert.deepEqual(toss.waits, []);
  });
});

describe('the words (/marketing 2026-10-09)', () => {
  test('the bracket', () => {
    assert.equal(BRACKET_WORDS.caption('Single elimination', 4, true), 'Single elimination · the top 4 of the round robin');
    assert.equal(BRACKET_WORDS.caption('Single elimination', 4, false), 'Single elimination · 4 teams');
    assert.equal(BRACKET_WORDS.played(2, 2), '2 of 2 played');
    assert.equal(bracketWhen('2026-10-09', '14:00:00'), 'Fri 2:00 p.m.');
  });
  test('the coin toss', () => {
    assert.equal(COIN_TOSS_WORDS.title([2, 3], null), 'A coin toss decides seeds 2 and 3');
    assert.equal(COIN_TOSS_WORDS.title([2, 3], 'A Pool'), 'A coin toss decides 2nd and 3rd in A Pool');
    assert.equal(COIN_TOSS_WORDS.body(['Cedar Hollow Cyclones', 'Maple Ridge Marauders'], ['Semifinal 2']),
      'Cedar Hollow Cyclones and Maple Ridge Marauders are still tied after every other tie-breaker. Semifinal 2 waits for it.');
    assert.equal(COIN_TOSS_WORDS.body(['A', 'B', 'C'], []), 'A, B and C are still tied after every other tie-breaker.');
    assert.equal(COIN_TOSS_WORDS.sheetTitle('U11'), 'Coin toss · U11');
    assert.equal(COIN_TOSS_WORDS.sheetFor([2, 3], null), 'For seeds 2 and 3');
    assert.equal(COIN_TOSS_WORDS.placeOf(2, null), 'Seed 2');
  });
  test('publishing', () => {
    assert.equal(PUBLISH_WORDS.noteBody(['U11', 'U13']), "U11 and U13 aren't published.");
    assert.equal(PUBLISH_WORDS.noteBody(['U11']), "U11 isn't published.");
    assert.equal(PUBLISH_WORDS.caption('Riverdale Summer Classic', 2), 'Riverdale Summer Classic · 2 divisions not published');
    assert.equal(PUBLISH_WORDS.emailBox(8), 'Email the 8 accepted teams that the schedule is live');
    assert.equal(PUBLISH_WORDS.go(['U11']), 'Publish U11');
    assert.equal(PUBLISH_WORDS.go(['U11', 'U13']), 'Publish 2 divisions');
    assert.equal(PUBLISH_WORDS.done(['U11', 'U13'], 8), 'Published U11 and U13 · emailed 8 teams');
    assert.equal(PUBLISH_WORDS.done(['U11'], 0), 'Published U11');
    assert.match(PUBLISH_WORDS.seesMoves(false), /Phone alerts to followers are on Tournament Plus\.$/);
  });
});
