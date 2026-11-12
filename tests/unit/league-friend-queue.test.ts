import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildQueue, candidatesFor, friendFold, friendTallies, honouredText, reasonOf, toConfirmCount, type FriendRequest } from '../../lib/league-friend-queue.ts';
import type { LeagueRegistration } from '../../lib/types.ts';

/** Board Ready Stage 1 Part 2: the registrar's queue (drawing tab 4). */

let n = 0;
function reg(first: string, last: string, o: Partial<LeagueRegistration> = {}): LeagueRegistration {
  n += 1;
  return {
    id: `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`, divisionId: 'u9', playerFirstName: first, playerLastName: last,
    guardianFirstName: 'Pat', guardianLastName: last, status: 'active', teamId: null,
    registeredAt: `2027-03-${String(n).padStart(2, '0')}T12:00:00Z`, ...o,
  } as LeagueRegistration;
}
function req(asker: LeagueRegistration, o: Partial<FriendRequest>): FriendRequest {
  n += 1;
  return {
    id: `r${n}`, registrationId: asker.id, slot: 1, typedFirst: null, typedLast: null, typedParent: null, code: null,
    state: 'to_confirm', mark: null, matchedRegistrationId: null, reason: null, note: null, decidedBy: null, decidedAt: null,
    createdAt: `2027-03-10T0${n % 10}:00:00Z`, ...o,
  };
}

describe('the friends normaliser', () => {
  it('ignores capitals, accents, hyphens, apostrophes and spaces', () => {
    assert.equal(friendFold('José'), friendFold('jose'));
    assert.equal(friendFold("O'Brien"), friendFold('OBrien'));
    assert.equal(friendFold('Mary-Jane'), friendFold('Mary Jane'));
  });
});

describe('suggestions', () => {
  const noah = reg('Noah', 'Patel');
  const jonathan = reg('Jonathan', 'Baptiste');
  const other = reg('Jon', 'Baptiste', { divisionId: 'u11' });
  const regs = [noah, jonathan, other];
  it('a first name that starts the other is similar; same division ranks first', () => {
    const c = candidatesFor({ registrationId: noah.id, typedFirst: 'Jon', typedLast: 'Baptiste', typedParent: null }, noah, regs);
    assert.deepEqual(c.map(x => x.reg.id), [jonathan.id, other.id]);
    assert.equal(reasonOf(c[0]), 'Similar first name · same last name');
  });
  it('never suggests the asking child, or a withdrawn sign-up', () => {
    const gone = reg('Ava', 'Lind', { status: 'withdrawn' });
    const c = candidatesFor({ registrationId: noah.id, typedFirst: 'Noah', typedLast: 'Patel', typedParent: null }, noah, [...regs, gone]);
    assert.equal(c.length, 0);
    assert.equal(candidatesFor({ registrationId: noah.id, typedFirst: 'Ava', typedLast: 'Lind', typedParent: null }, noah, [gone]).length, 0);
  });
  it('the parent’s name ranks and is the reason', () => {
    const a = reg('Max', 'Delaney', { guardianFirstName: 'Ryan', guardianLastName: 'Delaney' });
    const b = reg('Maxwell', 'Tran');
    const ethan = reg('Ethan', 'Roy');
    const c = candidatesFor({ registrationId: ethan.id, typedFirst: 'Max', typedLast: null, typedParent: 'Ryan' }, ethan, [a, b, ethan]);
    assert.equal(c[0].reg.id, a.id);
    assert.equal(reasonOf(c[0]), 'First name matches · parent matches');
  });
});

describe('the queue', () => {
  it('a single best match is Confirm; a first name alone is Pick one…; nobody is Not signed up', () => {
    const noah = reg('Noah', 'Patel'), jon = reg('Jonathan', 'Baptiste'), ethan = reg('Ethan', 'Roy'), max1 = reg('Max', 'Delaney'), max2 = reg('Maxwell', 'Tran'), lucas = reg('Lucas', 'Ferreira');
    const regs = [noah, jon, ethan, max1, max2, lucas];
    const rows = buildQueue([
      req(noah, { typedFirst: 'Jon', typedLast: 'Baptiste' }),
      req(ethan, { typedFirst: 'Max' }),
      req(lucas, { typedFirst: 'Owen', typedLast: 'Bains' }),
    ], regs);
    const by = new Map(rows.map(r => [r.asker.id, r]));
    assert.equal(by.get(noah.id)!.action, 'confirm');
    assert.deepEqual(by.get(noah.id)!.best, [{ id: by.get(noah.id)!.requests[0].id, matchId: jon.id }]);
    assert.equal(by.get(ethan.id)!.action, 'pick');
    assert.equal(by.get(ethan.id)!.best, null);
    assert.equal(by.get(lucas.id)!.action, 'notSignedUp');
    assert.ok(by.get(lucas.id)!.marks.has('noMatch'));
    assert.equal(toConfirmCount(rows), 3);
  });
  it('a match only in another division is Can’t honour, marked Different division', () => {
    const ava = reg('Ava', 'Lindqvist', { divisionId: 'u11' }), sophie = reg('Sophie', 'Moreau');
    const [row] = buildQueue([req(ava, { typedFirst: 'Sophie', typedLast: 'Moreau' })], [ava, sophie]);
    assert.equal(row.action, 'cantHonour');
    assert.ok(row.marks.has('differentDivision'));
  });
  it('Both asked is ONE row and ONE Confirm that covers both requests', () => {
    const maya = reg('Maya', 'Okafor'), liam = reg('Liam', 'Chen');
    const a = req(maya, { typedFirst: 'Liam', typedLast: 'Chen' }), b = req(liam, { typedFirst: 'Maya', typedLast: 'Okafor' });
    const rows = buildQueue([a, b], [maya, liam]);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].marks.has('bothAsked'));
    assert.deepEqual(rows[0].best, [{ id: a.id, matchId: liam.id }, { id: b.id, matchId: maya.id }]);
    assert.equal(toConfirmCount(rows), 1);
  });
  it('a code covers the other direction: the typed request back reads Confirmed', () => {
    const zoe = reg('Zoe', 'Chen'), harper = reg('Harper', 'Singh');
    const code = req(harper, { code: 'R2X8HN', state: 'confirmed', matchedRegistrationId: zoe.id, decidedAt: '2027-03-11T00:00:00Z' });
    const typed = req(zoe, { typedFirst: 'Harper', typedLast: 'Singh' });
    const rows = buildQueue([code, typed], [zoe, harper]);
    const back = rows.find(r => r.asker.id === zoe.id)!;
    assert.equal(back.band, 'confirmed');
    assert.ok(back.covered);
    assert.equal(toConfirmCount(rows), 0);
  });
  it('a withdrawn child’s requests leave the queue', () => {
    const gone = reg('Isla', 'Grant', { status: 'withdrawn' }), ruby = reg('Ruby', 'Tate');
    assert.equal(buildQueue([req(gone, { typedFirst: 'Ruby', typedLast: 'Tate' })], [gone, ruby]).length, 0);
  });
  it('a closed request sits in Closed', () => {
    const isla = reg('Isla', 'Grant');
    const [row] = buildQueue([req(isla, { typedFirst: 'Ruby', typedLast: 'T', state: 'not_signed_up', decidedAt: '2027-03-12T00:00:00Z' })], [isla]);
    assert.equal(row.band, 'closed');
    assert.equal(row.action, null);
  });
});

describe('the registrations list’s two friend columns', () => {
  it('"1 of 2" from the teams as they stand; blank until the child is on a team', () => {
    const a = reg('Ella', 'Brooks', { teamId: 'gold' }), b = reg('Mia', 'Santos', { teamId: 'gold' }), c = reg('Ivy', 'Park', { teamId: 'blue' }), d = reg('Sam', 'Lee');
    const t = friendTallies([
      req(a, { state: 'confirmed', matchedRegistrationId: b.id }),
      req(a, { slot: 2, state: 'confirmed', matchedRegistrationId: c.id }),
      req(d, { typedFirst: 'Ella', typedLast: 'Brooks' }),
    ], [a, b, c, d]);
    assert.equal(honouredText(t.get(a.id)), '1 of 2');
    assert.equal(honouredText(t.get(d.id)), '');
    assert.equal(t.get(d.id)!.asked, 1);
  });
});

describe('the /review edge cases (2026-11-11)', () => {
  it('a first name alone never makes a Both asked pair (two Liams)', () => {
    const maya = reg('Maya', 'Okafor'), liam = reg('Liam', 'Chen'), liam2 = reg('Liam', 'Ross');
    const rows = buildQueue([req(maya, { typedFirst: 'Liam' }), req(liam, { typedFirst: 'Maya', typedLast: 'Okafor' })], [maya, liam, liam2]);
    assert.equal(rows.length, 2);
    assert.equal(rows.find(r => r.asker.id === maya.id)!.action, 'pick');
  });
  it('two codes across divisions are two Can’t honour rows, never a pair', () => {
    const a = reg('Ava', 'One', { divisionId: 'u9' }), b = reg('Bea', 'Two', { divisionId: 'u11' });
    const rows = buildQueue([
      req(a, { code: 'AAAAAB', matchedRegistrationId: b.id, mark: 'different_division' }),
      req(b, { code: 'BBBBBC', matchedRegistrationId: a.id, mark: 'different_division' }),
    ], [a, b]);
    assert.equal(rows.length, 2);
    assert.ok(rows.every(r => r.action === 'cantHonour' && !r.best));
  });
  it('a code whose child withdrew offers no Confirm', () => {
    const a = reg('Ava', 'One'), gone = reg('Bea', 'Two', { status: 'withdrawn' });
    const [row] = buildQueue([req(a, { code: 'AAAAAB', matchedRegistrationId: gone.id })], [a, gone]);
    assert.equal(row.action, 'notSignedUp');
    assert.equal(row.best, null);
  });
  it('a loose first name in another division is Not signed up, not Can’t honour', () => {
    const a = reg('Ava', 'One'), al = reg('Alexander', 'Kim', { divisionId: 'u11' });
    const [row] = buildQueue([req(a, { typedFirst: 'Al' })], [a, al]);
    assert.equal(row.action, 'notSignedUp');
  });
  it('a covered request counts in Friends Honoured', () => {
    const zoe = reg('Zoe', 'Chen', { teamId: 't' }), harper = reg('Harper', 'Singh', { teamId: 't' });
    const reqs = [
      req(harper, { code: 'R2X8HN', state: 'confirmed', matchedRegistrationId: zoe.id, decidedAt: '2027-03-11T00:00:00Z' }),
      req(zoe, { typedFirst: 'Harper', typedLast: 'Singh' }),
    ];
    const t = friendTallies(reqs, [zoe, harper]);
    assert.equal(honouredText(t.get(zoe.id)), '1 of 1');
    assert.equal(honouredText(t.get(harper.id)), '1 of 1');
  });
});
