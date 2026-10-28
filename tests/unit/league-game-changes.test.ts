import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  familiesFor, heldGames, lastSentView, netChangeOf, sendClaim, teamsHearing,
  type GameSnapshot, type HeldChange,
} from '../../lib/league-game-changes.ts';

/** House League 9d-2b Part 1 (mig 409): what a send says is the net effect, and families see what they last heard. */
const snap = (o: Partial<GameSnapshot> = {}): GameSnapshot => ({
  scheduledAt: '2027-06-17T22:00:00+00:00', endsAt: '2027-06-17T23:30:00+00:00', location: 'Park A',
  venueId: 'v1', facilityId: 'f1', status: 'scheduled', movedFrom: null, ...o,
});
let n = 0;
const row = (o: Partial<HeldChange> & Pick<HeldChange, 'kind' | 'before' | 'after'>): HeldChange => ({
  id: `c${++n}`, gameId: 'g1', source: 'league', createdAt: `2027-06-01T00:00:${String(n).padStart(2, '0')}Z`, ...o,
});

describe('the net effect of a game\'s held changes', () => {
  const sent = snap();
  const moved = snap({ scheduledAt: '2027-06-17T23:30:00+00:00', endsAt: '2027-06-18T01:00:00+00:00' });
  const movedAgain = snap({ scheduledAt: '2027-06-18T22:00:00+00:00', endsAt: '2027-06-18T23:30:00+00:00' });

  it('a game moved twice reads once, from the date families heard to the date now', () => {
    const rows = [row({ kind: 'moved', before: sent, after: moved }), row({ kind: 'moved', before: moved, after: movedAgain })];
    const net = netChangeOf(rows, movedAgain)!;
    assert.equal(net.kind, 'moved');
    assert.equal(net.before, sent);
    assert.equal(net.changeIds.length, 2);
  });

  it('moved and moved back reads nothing', () => {
    assert.equal(netChangeOf([row({ kind: 'moved', before: sent, after: moved }), row({ kind: 'moved', before: moved, after: sent })], sent), null);
  });

  it('added then cancelled reads nothing; added and on reads added', () => {
    const added = row({ kind: 'added', before: null, after: sent });
    assert.equal(netChangeOf([added, row({ kind: 'cancelled', before: sent, after: snap({ status: 'cancelled' }) })], snap({ status: 'cancelled' })), null);
    assert.equal(netChangeOf([added], sent)!.kind, 'added');
  });

  it('a place change alone is place; a cancelled game\'s place is nobody\'s news', () => {
    const there = snap({ location: 'Park B', facilityId: 'f2' });
    assert.equal(netChangeOf([row({ kind: 'place', before: sent, after: there })], there)!.kind, 'place');
    const off = snap({ status: 'cancelled', location: 'Park B' });
    const rows = [row({ kind: 'cancelled', before: snap({ status: 'cancelled' }), after: snap({ status: 'cancelled' }) })];
    assert.equal(netChangeOf(rows, off), null);
  });

  it('postponed, then given a date, reads given a date; cancelled and put back on reads nothing', () => {
    const post = snap({ status: 'postponed' });
    assert.equal(netChangeOf([row({ kind: 'postponed', before: sent, after: post })], post)!.kind, 'postponed');
    const heard = snap({ status: 'postponed' });
    assert.equal(netChangeOf([row({ kind: 'given_date', before: heard, after: movedAgain })], movedAgain)!.kind, 'given_date');
    const off = snap({ status: 'cancelled' });
    assert.equal(netChangeOf([row({ kind: 'cancelled', before: sent, after: off }), row({ kind: 'back_on', before: off, after: sent })], sent), null);
  });

  it('a club-caused change says so', () => {
    assert.equal(netChangeOf([row({ kind: 'moved', before: sent, after: moved, source: 'club' })], moved)!.byClub, true);
  });
});

describe('a division\'s held games and the send\'s claim', () => {
  it('claims every held row, emails only the news, and never a game played since', () => {
    const a = snap(), b = snap({ location: 'Park B' });
    const rows: HeldChange[] = [
      row({ gameId: 'g1', kind: 'place', before: a, after: b }),
      row({ gameId: 'g2', kind: 'moved', before: a, after: snap({ scheduledAt: '2027-06-20T22:00:00+00:00' }) }),
      row({ gameId: 'g3', kind: 'place', before: a, after: b }),
    ];
    const current = new Map([['g1', b], ['g2', snap({ scheduledAt: '2027-06-20T22:00:00+00:00', status: 'completed' })], ['g3', a]]);
    const games = heldGames(rows, current);
    assert.deepEqual(games.map(g => [g.gameId, !!g.news, g.played]), [['g1', true, false], ['g2', false, true], ['g3', false, false]]);
    const claim = sendClaim(games);
    assert.equal(claim.changeIds.length, 3);
    assert.deepEqual(claim.newsGameIds, ['g1']);
  });
});

describe('what families see until the send (9d2·16)', () => {
  it('the game as they last heard it; nothing for a game added since; a played game as it is', () => {
    const heard = snap(), now = snap({ location: 'Park B' });
    assert.equal(lastSentView(now, [row({ kind: 'place', before: heard, after: now })]), heard);
    assert.equal(lastSentView(now, [row({ kind: 'added', before: null, after: now })]), null);
    const played = snap({ status: 'completed', location: 'Park B' });
    assert.equal(lastSentView(played, [row({ kind: 'place', before: heard, after: now })]), played);
    assert.equal(lastSentView(now, []), now);
  });
});

describe('who hears it', () => {
  it('the two teams\' families, each family once, a part per child on a changed team', () => {
    const teams = teamsHearing([{ homeTeamId: 'twins', awayTeamId: 'rays' }]);
    const families = familiesFor([
      { registrationId: 'r1', email: 'Kim@Example.invalid ', childName: 'Ava', teamId: 'twins' },
      { registrationId: 'r2', email: 'kim@example.invalid', childName: 'Henry', teamId: 'rays' },
      { registrationId: 'r3', email: 'chen@example.invalid', childName: 'Liam', teamId: 'jays' },
      { registrationId: 'r4', email: '', childName: 'Noor', teamId: 'twins' },
    ], teams);
    assert.deepEqual([...families.keys()], ['kim@example.invalid']);
    assert.deepEqual(families.get('kim@example.invalid')!.map(c => c.childName), ['Ava', 'Henry']);
  });
});
