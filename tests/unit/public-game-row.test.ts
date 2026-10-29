import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fanPlaceholder, friendlyPlaceholder, gameRowView, gameSideNames, liveCardView } from '../../lib/public-game-row.ts';
import type { Game } from '../../lib/types.ts';

/**
 * WHAT A GAME SAYS on the public tournament pages' shared parts (Public tournament pages Stage 2; hub "The end state":
 * the game row's two faces and the Live now card).
 */

const TODAY = '2026-10-28';
const game = (over: Partial<Game> = {}): Game => ({
  id: 'g1', date: TODAY, time: '17:00', status: 'scheduled', homeTeamId: 'h', awayTeamId: 'a',
  homeScore: null, awayScore: null, ...over,
} as Game);
const names = { away: 'Silver Creek Storm', home: 'Maple Ridge Mustangs' };

describe('the game row, scheduled face', () => {
  it('"5:00 p.m." over "Today", visitor then home, the division and field under them', () => {
    const v = gameRowView(game(), names, 'U13 · Diamond 4', TODAY);
    assert.equal(v.face, 'scheduled');
    assert.equal(v.head, '5:00 p.m.');
    assert.equal(v.when, 'Today');
    assert.deepEqual(v.sides.map(s => s.name), ['Silver Creek Storm', 'Maple Ridge Mustangs']);
    assert.equal(v.sub, 'U13 · Diamond 4');
  });
  it('another day reads its short weekday date', () => {
    assert.equal(gameRowView(game({ date: '2026-10-29', time: '09:00' }), names, '', TODAY).when, 'Thu, Oct 29');
    assert.equal(gameRowView(game({ date: '2026-10-29', time: '09:00' }), names, '', TODAY).head, '9:00 a.m.');
  });
  it('no context: no sub-line', () => {
    assert.equal(gameRowView(game(), names, '', TODAY).sub, null);
  });
  it('a submitted (unconfirmed) score is not a Final', () => {
    assert.equal(gameRowView(game({ status: 'submitted', homeScore: 3, awayScore: 1 }), names, '', TODAY).face, 'scheduled');
  });
});

describe('the game row, finished face', () => {
  it('"Final" over the date, the winner first and bold, both scores, no sub-line', () => {
    const v = gameRowView(game({ status: 'completed', date: '2026-10-27', awayScore: 6, homeScore: 14 }), names, 'U13 · Diamond 4', TODAY);
    assert.equal(v.face, 'final');
    assert.equal(v.head, 'Final');
    assert.equal(v.when, 'Oct 27');
    assert.deepEqual(v.sides, [
      { name: 'Maple Ridge Mustangs', score: 14, result: 'win' },
      { name: 'Silver Creek Storm', score: 6, result: 'lose' },
    ]);
    assert.equal(v.sub, null);
  });
  it('a visitor win stays first; a tie keeps visitor, home and marks no one', () => {
    assert.equal(gameRowView(game({ status: 'completed', awayScore: 9, homeScore: 2 }), names, '', TODAY).sides[0].result, 'win');
    const tie = gameRowView(game({ status: 'completed', awayScore: 4, homeScore: 4 }), names, '', TODAY);
    assert.deepEqual(tie.sides.map(s => [s.name, s.result]), [['Silver Creek Storm', null], ['Maple Ridge Mustangs', null]]);
  });
  it('a forfeit is a Final', () => {
    assert.equal(gameRowView(game({ status: 'forfeit', awayScore: 7, homeScore: 0 }), names, '', TODAY).face, 'final');
  });
});

describe('the game row, the Schedule\'s extras (Stage 3)', () => {
  const done = { status: 'submitted' as const, date: '2026-10-27', awayScore: 6, homeScore: 14 };
  it('an unofficial score is a finished face that says Unofficial, with its scores', () => {
    const v = gameRowView(game(done), names, '', TODAY, { state: 'unofficial' });
    assert.equal(v.face, 'final');
    assert.equal(v.head, 'Unofficial');
    assert.deepEqual(v.sides.map(s => s.score), [14, 6]);
  });
  it('a submitted score the organizer does not hold for review is a Final', () => {
    assert.equal(gameRowView(game(done), names, '', TODAY, { state: 'final' }).head, 'Final');
  });
  it('a cancelled game keeps the scheduled face and says so; nothing else does', () => {
    const v = gameRowView(game({ status: 'cancelled' }), names, 'U13 · Diamond 4', TODAY, { state: 'cancelled' });
    assert.equal(v.face, 'scheduled');
    assert.equal(v.cancelled, true);
    assert.equal(v.head, '5:00 p.m.');
    assert.equal(gameRowView(game(), names, '', TODAY, { state: 'upcoming' }).cancelled, false);
    assert.equal(gameRowView(game(), names, '', TODAY).cancelled, false);
  });
  it('a playoff game\'s round replaces the day under its time; the pool tag rides along', () => {
    const v = gameRowView(game(), names, 'Diamond 2', TODAY, { state: 'upcoming', round: 'Semifinal', poolTag: 'Pool A' });
    assert.equal(v.head, '5:00 p.m.');
    assert.equal(v.when, 'Semifinal');
    assert.equal(v.poolTag, 'Pool A');
    assert.equal(gameRowView(game(), names, '', TODAY).poolTag, null);
  });
  it('a finished game without both scores stays a scheduled face, whatever its state', () => {
    assert.equal(gameRowView(game({ status: 'completed' }), names, '', TODAY, { state: 'final' }).face, 'scheduled');
  });
});

describe('the Live now card', () => {
  it('both scores, the team behind drawn soft, division · field, Directions to the field', () => {
    const v = liveCardView(game({ status: 'scheduled', awayScore: 2, homeScore: 5 }), names, 'U13', 'Diamond 4', 'https://maps/x');
    assert.deepEqual(v.sides, [
      { name: 'Silver Creek Storm', score: 2, trailing: true },
      { name: 'Maple Ridge Mustangs', score: 5, trailing: false },
    ]);
    assert.equal(v.noScore, null);
    assert.equal(v.context, 'U13 · Diamond 4');
    assert.equal(v.field, 'Diamond 4');
  });
  it('before anyone has entered a score: "No score yet", never an invented 0–0 (D2)', () => {
    const v = liveCardView(game(), names, 'Championship', 'Diamond 2', null);
    assert.equal(v.noScore, 'No score yet');
    assert.deepEqual(v.sides.map(s => [s.score, s.trailing]), [[null, false], [null, false]]);
  });
  it('level: nobody trails; no field: no Directions name and the context is the label alone', () => {
    const v = liveCardView(game({ awayScore: 3, homeScore: 3 }), names, 'U11', null, null);
    assert.ok(v.sides.every(s => !s.trailing));
    assert.equal(v.context, 'U11');
    assert.equal(v.field, null);
  });
});

describe('names', () => {
  it('a bracket placeholder reads as English', () => {
    assert.equal(friendlyPlaceholder('Winner SF2'), 'Winner of SF2');
    assert.equal(friendlyPlaceholder('Winner of SF2'), 'Winner of SF2');
    assert.equal(friendlyPlaceholder(null), 'TBD');
    assert.deepEqual(
      gameSideNames(game({ awayTeamId: undefined, awayPlaceholder: 'Loser QF1' }), id => `Team ${id}`),
      { away: 'Loser of QF1', home: 'Team h' },
    );
  });
  it('the new pages say a slot as the bracket does: the game leads (owner 2026-10-28, ruling 2026-07-17)', () => {
    assert.equal(fanPlaceholder('Winner SF2'), 'Semifinal 2 winner');
    assert.equal(fanPlaceholder('Winner of SF2'), 'Semifinal 2 winner');
    assert.equal(fanPlaceholder('Loser QF1'), 'Quarterfinal 1 loser');
    assert.equal(fanPlaceholder('Pool A #1'), 'Pool A #1', 'an organizer\'s own text passes through');
    assert.equal(fanPlaceholder(null), 'TBD');
    assert.deepEqual(
      gameSideNames(game({ awayTeamId: undefined, awayPlaceholder: 'Winner SF1' }), id => `Team ${id}`, fanPlaceholder),
      { away: 'Semifinal 1 winner', home: 'Team h' },
    );
  });
});
