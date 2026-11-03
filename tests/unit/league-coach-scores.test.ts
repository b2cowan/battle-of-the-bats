import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SCORE_WORDS as W, clubScoreLines, clubScoreTag, coachScoreView, refusalOf, scoreListed, scoresToCheck, isInstant,
  type GameScoreRecord,
} from '../../lib/league-coach-scores.ts';

/** House League 9e-3 Part 2: who sees which door on a game's score, the club's tag and lines, and "Scores to check". */
// 00:12Z Jun 18 is 8:12 p.m. Jun 17 in Toronto (EDT); 22:00Z Jun 17 is 6:00 p.m.
const START = '2027-06-17T22:00:00+00:00';
const ENTERED = '2027-06-18T00:12:00+00:00';
const NOW_SAME_DAY = Date.parse('2027-06-18T01:00:00+00:00'); // 9:00 p.m. Jun 17 in Toronto
const NOW_NEXT_DAY = Date.parse('2027-06-18T14:00:00+00:00'); // 10:00 a.m. Jun 18
const names = { home: 'Twins', away: 'Royals' };
const HOME = 'u-home', AWAY = 'u-away';

const played = { status: 'completed' as const, scheduledAt: START, homeScore: 7, awayScore: 4 };
const open = { status: 'scheduled' as const, scheduledAt: START, homeScore: null, awayScore: null };

const rec = (o: Partial<GameScoreRecord> = {}): GameScoreRecord => ({
  gameId: 'g1', enteredSide: 'coach', enteredBy: HOME, enteredByName: 'Alex Moreau', enteredAt: ENTERED,
  reportedBy: null, reportedAt: null, reportNote: null,
  checkedByName: null, checkedAt: null, correctedByName: null, correctedAt: null, ...o,
});
const home = { userId: HOME, home: true }, away = { userId: AWAY, home: false };

describe('the instant a press carries', () => {
  it('is a timestamp the database can read, not any string', () => {
    assert.equal(isInstant('2027-06-17T22:00:00.123456+00:00'), true);
    for (const v of ['abc', '', null, undefined, 5, {}]) assert.equal(isInstant(v), false, String(v));
  });
});

describe('the coach row', () => {
  it('lists a started game that is on, from its start time', () => {
    assert.equal(scoreListed(open, Date.parse(START)), true);
    assert.equal(scoreListed(open, Date.parse(START) - 1), false);
    assert.equal(scoreListed({ ...open, scheduledAt: null }, NOW_SAME_DAY), false);
    assert.equal(scoreListed({ ...open, status: 'postponed' }, NOW_SAME_DAY), false);
  });

  it('not started and called off have no door and no line', () => {
    assert.deepEqual(coachScoreView(open, null, home, names, Date.parse(START) - 1), { state: 'notStarted', door: null, line: null });
    assert.equal(coachScoreView({ ...open, status: 'cancelled' }, null, home, names, NOW_SAME_DAY).state, 'calledOff');
    assert.equal(coachScoreView({ ...open, status: 'postponed' }, null, home, names, NOW_SAME_DAY).door, null);
  });

  it('no score: the home coach enters, the away coach waits', () => {
    assert.deepEqual(coachScoreView(open, null, home, names, NOW_SAME_DAY), { state: 'enter', door: 'enter', line: null });
    assert.deepEqual(coachScoreView(open, null, away, names, NOW_SAME_DAY), { state: 'waiting', door: null, line: 'Twins’ coach enters the score.' });
  });

  it('a yesterday game with no score still offers Enter', () => {
    assert.equal(coachScoreView(open, null, home, names, NOW_NEXT_DAY + 86_400_000).door, 'enter');
  });

  it('entered by me, the same day: the time alone, and the change rule', () => {
    const v = coachScoreView(played, rec(), home, names, NOW_SAME_DAY);
    assert.equal(v.state, 'enteredMine');
    assert.equal(v.door, 'change');
    assert.equal(v.line, 'Entered by you at 8:12 p.m.');
  });

  it('entered by me, another day: the date before the time', () => {
    assert.equal(coachScoreView(played, rec(), home, names, NOW_NEXT_DAY).line, 'Entered by you, Jun 17 at 8:12 p.m.');
  });

  it('another coach of the home team reads the team, and can still change it', () => {
    const v = coachScoreView(played, rec({ enteredBy: 'u-other' }), home, names, NOW_SAME_DAY);
    assert.equal(v.state, 'enteredHome');
    assert.equal(v.door, 'change');
    assert.equal(v.line, 'Entered by Twins’ coach at 8:12 p.m.');
  });

  it('the away coach reads the team (never the person) and can report', () => {
    const v = coachScoreView(played, rec(), away, names, NOW_NEXT_DAY);
    assert.deepEqual(v, { state: 'enteredTheirs', door: 'report', line: 'Entered by Twins’ coach, Jun 17 at 8:12 p.m.' });
    assert.ok(!v.line!.includes('Alex'));
  });

  it('reported: both doors close; each side reads its line', () => {
    const r = rec({ reportedBy: AWAY, reportedAt: ENTERED });
    assert.deepEqual(coachScoreView(played, r, home, names, NOW_SAME_DAY),
      { state: 'reportedTheirs', door: null, line: 'Royals’ coach says this isn’t right. The league admin is checking it.' });
    assert.deepEqual(coachScoreView(played, r, away, names, NOW_SAME_DAY),
      { state: 'reportedMine', door: null, line: W.reportedMe });
    assert.equal(coachScoreView(played, r, { userId: 'u-away-2', home: false }, names, NOW_SAME_DAY).state, 'reportedAway');
  });

  it('checked, corrected or entered by the club: no door for anyone', () => {
    for (const [r, state, line] of [
      [rec({ checkedAt: ENTERED, checkedByName: 'Sam Lee' }), 'checked', W.byClubChecked],
      [rec({ correctedAt: ENTERED, correctedByName: 'Sam Lee' }), 'corrected', W.byClubCorrected],
      [rec({ enteredSide: 'club' }), 'clubEntered', W.byClubEntered],
      [null, 'clubEntered', W.byClubEntered],
    ] as const) {
      for (const viewer of [home, away]) assert.deepEqual(coachScoreView(played, r, viewer, names, NOW_SAME_DAY), { state, door: null, line });
    }
  });

  it('a coach of both teams is the home coach (no Report on their own score)', () => {
    assert.equal(coachScoreView(played, rec(), { userId: HOME, home: true }, names, NOW_SAME_DAY).door, 'change');
  });
});

describe('the words', () => {
  it('the foot, the hint and the toast follow the standings switch', () => {
    assert.match(W.foot(true), /^Scores count in the standings/);
    assert.match(W.foot(false), /^Scores show on the schedule/);
    assert.match(W.winHint(false), /^It shows on the schedule right away/);
    assert.equal(W.saved(true), 'Score saved. It counts in the standings now.');
    assert.equal(W.saved(false), 'Score saved.');
  });

  it('a team name ending in s takes the apostrophe alone', () => {
    assert.equal(W.away('Cubs'), 'Cubs’ coach enters the score.');
    assert.equal(W.err.notHome('Jays'), 'Only Jays’ coach enters the score.');
  });

  it('a score is written with an en dash', () => {
    assert.equal(W.final(7, 4), 'Final 7–4');
    assert.equal(W.keep(7, 4), 'Keep 7–4');
  });

  it('refusals map to a sentence and a status', () => {
    const n = { home: 'Twins', team: 'Royals', season: 'Summer 2027' };
    assert.deepEqual(refusalOf('changed', n), { status: 409, error: W.err.changed, code: 'changed' });
    assert.equal(refusalOf('finished', n).error, 'Summer 2027 has finished, so scores can’t be changed.');
    assert.equal(refusalOf('gone', n).error, 'You’re no longer a coach of Royals.');
    assert.equal(refusalOf('notFound', n).status, 404);
    assert.equal(refusalOf('notAway', n).status, 404);
  });
});

describe('the club side', () => {
  it('tags an unlooked-at coach score; nothing else', () => {
    assert.equal(clubScoreTag(played, rec()), 'coach');
    assert.equal(clubScoreTag(played, rec({ reportedAt: ENTERED })), 'reported');
    assert.equal(clubScoreTag(played, rec({ checkedAt: ENTERED })), null);
    assert.equal(clubScoreTag(played, rec({ correctedAt: ENTERED })), null);
    assert.equal(clubScoreTag(played, rec({ enteredSide: 'club' })), null);
    assert.equal(clubScoreTag(played, null), null);
    assert.equal(clubScoreTag(open, rec()), null);
  });

  it('coach entered: the person, the team and the date', () => {
    const l = clubScoreLines(played, rec(), names);
    assert.deepEqual(l, { tag: 'coach', lines: ['Entered by Alex Moreau, Twins’ coach, Jun 17 at 8:12 p.m.'], note: null, keep: 'Keep 7–4' });
  });

  it('reported, with and without a note', () => {
    const r = rec({ reportedAt: ENTERED, reportNote: 'We had it 6–4.' });
    assert.deepEqual(clubScoreLines(played, r, names), {
      tag: 'reported', lines: ['Entered by Alex Moreau, Jun 17 at 8:12 p.m. Royals’ coach says: “We had it 6–4.”'],
      note: 'This score counts until you change it.', keep: 'Keep 7–4',
    });
    assert.equal(clubScoreLines(played, { ...r, reportNote: null }, names).lines[0],
      'Entered by Alex Moreau, Jun 17 at 8:12 p.m. Royals’ coach reported this score and didn’t say what it should be.');
  });

  it('checked and corrected: the mark under the entry, no Keep', () => {
    const k = clubScoreLines(played, rec({ checkedAt: '2027-06-18T13:05:00+00:00', checkedByName: 'Sam Lee' }), names);
    assert.deepEqual(k.lines, ['Entered by Alex Moreau, Twins’ coach, Jun 17 at 8:12 p.m.', 'Checked by Sam Lee, Jun 18 at 9:05 a.m.']);
    assert.equal(k.keep, null);
    const c = clubScoreLines(played, rec({ correctedAt: '2027-06-18T13:05:00+00:00', correctedByName: 'Sam Lee' }), names);
    assert.equal(c.lines[1], 'Corrected by Sam Lee, Jun 18 at 9:05 a.m. Coaches can’t change this score now.');
  });

  it('the club entered it: its own line', () => {
    assert.deepEqual(clubScoreLines(played, rec({ enteredSide: 'club', enteredByName: 'Sam Lee' }), names).lines,
      ['Entered by Sam Lee, Jun 17 at 8:12 p.m.']);
    assert.deepEqual(clubScoreLines(played, null, names).lines, []);
  });

  it('Scores to check: reported first, then coach entered, oldest first in each', () => {
    const g = (id: string) => ({ id, ...played });
    const records = new Map<string, GameScoreRecord>([
      ['a', rec({ gameId: 'a', enteredAt: '2027-06-17T23:00:00Z' })],
      ['b', rec({ gameId: 'b', enteredAt: '2027-06-17T22:00:00Z' })],
      ['c', rec({ gameId: 'c', reportedAt: '2027-06-18T02:00:00Z' })],
      ['d', rec({ gameId: 'd', reportedAt: '2027-06-18T01:00:00Z' })],
      ['e', rec({ gameId: 'e', checkedAt: '2027-06-18T01:00:00Z' })],
    ]);
    assert.deepEqual(scoresToCheck([g('a'), g('b'), g('c'), g('d'), g('e'), g('f')], records).map(x => `${x.game.id}:${x.tag}`),
      ['d:reported', 'c:reported', 'b:coach', 'a:coach']);
  });
});
