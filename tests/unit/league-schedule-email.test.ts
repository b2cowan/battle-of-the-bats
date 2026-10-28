import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emailChangeLine, publishedLine, scheduleEmailWords } from '../../lib/league-schedule-email.ts';
import { netChangeOf, type GameSnapshot, type HeldChange } from '../../lib/league-game-changes.ts';
import { SCHEDULE_NOTICE_WORDS, reachedLine } from '../../lib/league-schedule-words.ts';

/** House League 9d-2b Part 4 (frame f3): what a family's game email says, from the net effect of the changes sent. */
const snap = (o: Partial<GameSnapshot> = {}): GameSnapshot => ({
  // 22:00 UTC on June 17 is 6:00 p.m. in Toronto (summer).
  scheduledAt: '2027-06-17T22:00:00+00:00', endsAt: '2027-06-17T23:30:00+00:00', location: null,
  venueId: 'v1', facilityId: 'f1', status: 'scheduled', movedFrom: null, ...o,
});
const placeOf = (s: GameSnapshot) => (s.facilityId === 'f2' ? 'Maple Grove Park · Diamond 2' : 'Maple Grove Park · Diamond 1');
let n = 0;
const row = (o: Pick<HeldChange, 'kind' | 'before' | 'after'>): HeldChange => ({
  id: `c${++n}`, gameId: 'g1', source: 'league', createdAt: `2027-06-01T00:00:${String(n).padStart(2, '0')}Z`, ...o,
});
const lineOf = (rows: HeldChange[], now: GameSnapshot) => emailChangeLine(netChangeOf(rows, now)!, 'Orioles vs Twins', placeOf);

describe('a changed game\'s line in the families\' email', () => {
  it('a later time the same day: Now in full, Was names only the clock', () => {
    const later = snap({ scheduledAt: '2027-06-17T23:30:00+00:00' });
    assert.equal(lineOf([row({ kind: 'moved', before: snap(), after: later })], later),
      'Orioles vs Twins\nNow: Thu, Jun 17, 7:30 p.m. · Maple Grove Park · Diamond 1\nWas: 6:00 p.m.');
  });

  it('a new day: Was names the day (the clock is the same)', () => {
    const nextWeek = snap({ scheduledAt: '2027-06-24T22:00:00+00:00' });
    assert.equal(lineOf([row({ kind: 'moved', before: snap(), after: nextWeek })], nextWeek),
      'Orioles vs Twins\nNow: Thu, Jun 24, 6:00 p.m. · Maple Grove Park · Diamond 1\nWas: Thu, Jun 17');
  });

  it('a new place only: Was names the place', () => {
    const d2 = snap({ facilityId: 'f2' });
    assert.equal(lineOf([row({ kind: 'place', before: snap(), after: d2 })], d2),
      'Orioles vs Twins\nNow: Thu, Jun 17, 6:00 p.m. · Maple Grove Park · Diamond 2\nWas: Maple Grove Park · Diamond 1');
  });

  it('a cancel names the game as families knew it, and one period after a clock', () => {
    const off = snap({ status: 'cancelled' });
    assert.equal(lineOf([row({ kind: 'cancelled', before: snap(), after: off })], off),
      'Cancelled: Orioles vs Twins, Thu, Jun 17, 6:00 p.m. · Maple Grove Park · Diamond 1. The club will tell you if it is replayed.');
  });

  it('a postpone names the day it was', () => {
    const off = snap({ status: 'postponed' });
    assert.equal(lineOf([row({ kind: 'postponed', before: snap(), after: off })], off),
      'Postponed: Orioles vs Twins, Thu, Jun 17. A new date is to come.');
  });

  it('an added game reads Added; a game with no place keeps one period after its clock', () => {
    const bare = snap({ venueId: null, facilityId: null });
    assert.equal(emailChangeLine(netChangeOf([row({ kind: 'added', before: null, after: bare })], bare)!, 'Orioles vs Twins', () => ''),
      'Added: Orioles vs Twins, Thu, Jun 17, 6:00 p.m.');
  });

  it('a game with no date to name (postponed, then cancelled) never ends in a dangling comma (/review 2026-10-28)', () => {
    const undated = snap({ scheduledAt: null, endsAt: null, venueId: null, facilityId: null, status: 'postponed' });
    const off = snap({ scheduledAt: null, endsAt: null, venueId: null, facilityId: null, status: 'cancelled' });
    assert.equal(emailChangeLine(netChangeOf([row({ kind: 'cancelled', before: undated, after: off })], off)!, 'Orioles vs Twins', () => ''),
      'Cancelled: Orioles vs Twins. The club will tell you if it is replayed.');
  });

  it('a postponed game families were told of, given a new date, reads Back on at its new date', () => {
    const off = snap({ status: 'postponed' }), back = snap({ scheduledAt: '2027-07-01T22:00:00+00:00' });
    assert.equal(lineOf([row({ kind: 'given_date', before: off, after: back })], back),
      'Back on: Orioles vs Twins, Thu, Jul 1, 6:00 p.m. · Maple Grove Park · Diamond 1.');
  });

  it('postponed and given a new date in one send is a move to families (they never heard it was postponed)', () => {
    const off = snap({ status: 'postponed' }), back = snap({ scheduledAt: '2027-07-01T22:00:00+00:00' });
    assert.equal(lineOf([row({ kind: 'postponed', before: snap(), after: off }), row({ kind: 'given_date', before: off, after: back })], back),
      'Orioles vs Twins\nNow: Thu, Jul 1, 6:00 p.m. · Maple Grove Park · Diamond 1\nWas: Thu, Jun 17');
  });
});

describe('the families\' email words', () => {
  const parts = [{ child: 'Ava', team: 'Twins', lines: ['x'] }];
  it('one team named once; several joined', () => {
    const one = scheduleEmailWords({ kind: 'changed', club: 'Riverdale', season: '2027', guardianFirst: 'Sam', parts, zoneSentence: 'z', schedulePath: '/r/league/s/schedule' });
    assert.equal(one.subject, 'Twins’ games changed');
    assert.equal(one.lists[0].title, 'Riverdale changed Ava’s games with Twins:');
    assert.equal(one.greeting, 'Hi Sam,');
    assert.equal(one.outro, 'Questions? Ask Twins’ coach.');
    assert.deepEqual(one.link, { label: 'See the full schedule →', path: '/r/league/s/schedule' });
    const two = scheduleEmailWords({ kind: 'published', club: 'Riverdale', season: '2027', guardianFirst: null, zoneSentence: 'z', schedulePath: '/p',
      parts: [...parts, { child: 'Henry', team: 'Rays', lines: ['y'] }] });
    assert.equal(two.subject, 'The schedule is up for Twins and Rays');
    assert.equal(two.lists[1].title, 'Riverdale published the 2027 schedule. Here are Henry’s games with Rays:');
    assert.equal(two.greeting, 'Hi,');
  });

  it('a published game\'s line', () => {
    assert.equal(publishedLine(snap(), 'Cardinals vs Rays', placeOf), 'Thu, Jun 17 · 6:00 p.m. · Cardinals vs Rays · Maple Grove Park · Diamond 1');
  });

  it('the history\'s To and the reached line', () => {
    assert.equal(SCHEDULE_NOTICE_WORDS.to('U12 Division', 66, 64), 'U12 Division · 66 families · reached 64');
    assert.equal(SCHEDULE_NOTICE_WORDS.publishedSubject('U12 Division'), 'Schedule published: U12 Division');
    assert.equal(reachedLine(64, 66, 2), 'Reached 64 of 66 families · 2 didn’t send.');
  });
});
