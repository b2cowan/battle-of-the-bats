import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildQueue, requestLines, type FriendPlacement, type FriendRequest } from '../../lib/league-friend-queue.ts';
import { divisionDrafted, divisionLinks, friendResult, outcomesToStore, FRIEND_RESULT_WORDS as R } from '../../lib/league-friend-draft.ts';
import { togetherOf } from '../../lib/house-league-board-pool.ts';
import type { LeagueRegistration } from '../../lib/types.ts';

/**
 * Board Ready Stage 1 Part 3: the links the draft keeps together, the outcomes it stores, the live result after the
 * draft (drawing tab 6's list of reasons) and the board's Together place (5b option B).
 */

let n = 0;
function reg(first: string, last: string, o: Partial<LeagueRegistration> = {}): LeagueRegistration {
  n += 1;
  return {
    id: `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`, divisionId: 'u9', playerFirstName: first, playerLastName: last,
    guardianFirstName: 'Pat', guardianLastName: last, guardianEmail: `${first.toLowerCase()}@example.com`, status: 'active', teamId: null,
    registeredAt: `2027-03-${String(n).padStart(2, '0')}T12:00:00Z`, endedAt: null, ...o,
  } as LeagueRegistration;
}
function req(asker: LeagueRegistration, o: Partial<FriendRequest>): FriendRequest {
  n += 1;
  return {
    id: `r${String(n).padStart(3, '0')}`, registrationId: asker.id, slot: 1, typedFirst: null, typedLast: null, typedParent: null, code: null,
    state: 'to_confirm', mark: null, matchedRegistrationId: null, reason: null, note: null, decidedBy: null, decidedAt: null,
    createdAt: `2027-03-10T0${n % 10}:00:00Z`, keptApartBy: null, keptApartAt: null, draftOutcome: null, ...o,
  };
}
const confirmed = (asker: LeagueRegistration, friend: LeagueRegistration, o: Partial<FriendRequest> = {}) =>
  req(asker, { typedFirst: friend.playerFirstName, typedLast: friend.playerLastName, state: 'confirmed', matchedRegistrationId: friend.id, decidedAt: '2027-03-12T12:00:00Z', ...o });

const teams: Record<string, string> = { red: 'Red', blue: 'Blue', black: 'Black' };
const ctx = (placement: FriendPlacement) => ({ placement, teamName: (id: string | null) => (id ? teams[id] ?? null : null), day: (v: string | null) => (v ? v.slice(5, 10) : '—') });

describe('the links (one per pair, between live sign-ups of one division)', () => {
  it('a Both asked pair is ONE link, with both requests, kept first', () => {
    const maya = reg('Maya', 'Okafor');
    const liam = reg('Liam', 'Chen');
    const a = confirmed(maya, liam);
    const b = confirmed(liam, maya);
    const links = divisionLinks(buildQueue([a, b], [maya, liam]), 'u9');
    assert.equal(links.length, 1);
    assert.deepEqual(links[0].requestIds, [a.id, b.id].sort());
    assert.equal(links[0].bothAsked, true);
  });
  it('a request still to confirm, another division, or a withdrawn friend is no link', () => {
    const maya = reg('Maya', 'Okafor');
    const zoe = reg('Zoe', 'Chen');
    const ben = reg('Ben', 'Osei', { divisionId: 'u11' });
    const aria = reg('Aria', 'Khan', { status: 'withdrawn' });
    const rows = buildQueue([
      req(maya, { typedFirst: 'Zoe', typedLast: 'Chen' }),
      req(maya, { code: 'K7M4QP', matchedRegistrationId: ben.id, mark: 'different_division' }),
      confirmed(zoe, aria),
    ], [maya, zoe, ben, aria]);
    assert.deepEqual(divisionLinks(rows, 'u9'), []);
  });
  it('a split on any of its requests splits the link, and says who', () => {
    const maya = reg('Maya', 'Okafor');
    const zoe = reg('Zoe', 'Chen');
    const [l] = divisionLinks(buildQueue([confirmed(maya, zoe, { keptApartAt: '2027-05-03T12:00:00Z', keptApartBy: 'Kelly Barrett' })], [maya, zoe]), 'u9');
    assert.equal(l.apart, true);
    assert.equal(l.keptApartBy, 'Kelly Barrett');
  });
});

describe('what the deal stores (mig 473)', () => {
  const link = (id: string, requestIds: string[], apart = false) =>
    ({ id, a: 'a', b: 'b', requestIds, bothAsked: false, code: false, confirmedAt: '', apart, keptApartBy: null, keptApartAt: null });
  it('each request of a link gets its outcome, a split too (so undoing it later still reads true)', () => {
    const out = outcomesToStore([link('x', ['r1', 'r2']), link('y', ['r3']), link('z', ['r4'], true)],
      new Map([['x', 'kept'], ['y', 'overCap'], ['z', 'apart']] as const));
    assert.deepEqual(out, { ids: ['r1', 'r2', 'r3', 'r4'], outcomes: ['kept', 'kept', 'over_cap', 'apart'] });
  });
  it('Keep friends together off: every link reads off, a split reads apart', () => {
    assert.deepEqual(outcomesToStore([link('x', ['r1']), link('z', ['r4'], true)], null), { ids: ['r1', 'r4'], outcomes: ['off', 'apart'] });
  });
});

describe('after the draft: Honoured or Not honoured, read live (A3, tab 6)', () => {
  function one(o: { asker?: Partial<LeagueRegistration>; friend?: Partial<LeagueRegistration>; q?: Partial<FriendRequest>; placement?: FriendPlacement } = {}) {
    const maya = reg('Maya', 'Okafor', { teamId: 'red', ...o.asker });
    const leo = reg('Leo', 'Park', { teamId: 'red', ...o.friend });
    const q = confirmed(maya, leo, o.q);
    const rows = buildQueue([q], [maya, leo]);
    const line = requestLines(rows).find(l => l.q.id === q.id)!;
    const placement = o.placement ?? { [maya.id]: { dealt: 'red', locked: false }, [leo.id]: { dealt: 'red', locked: false } };
    return friendResult(line, ctx(placement));
  }
  it('both on one team: Honoured, whatever the draft did', () => {
    assert.deepEqual(one({ q: { draftOutcome: 'over_cap' } }), { honoured: true, why: R.bothOn('Red') });
  });
  it('the group would pass 3', () => {
    assert.deepEqual(one({ friend: { teamId: 'blue' }, q: { draftOutcome: 'over_cap' } }), { honoured: false, why: R.overCap });
  });
  it('a friend locked to another team', () => {
    const r = one({ friend: { teamId: 'black' }, q: { draftOutcome: 'locked' } });
    assert.equal(r.honoured, false);
    assert.equal(r.why, R.locked('Leo', 'Black'));
  });
  it('kept apart on the board', () => {
    assert.equal(one({ friend: { teamId: 'blue' }, q: { keptApartAt: '2027-05-03T12:00:00Z', keptApartBy: 'Kelly Barrett' } }).why, R.keptApart('Kelly Barrett', '05-03'));
  });
  it('kept apart at the draft, the split since undone: still kept apart in the draft, not "confirmed after"', () => {
    assert.equal(one({ friend: { teamId: 'blue' }, q: { draftOutcome: 'apart' } }).why, R.apartInDraft);
  });
  it('kept by the draft, then moved by hand', () => {
    assert.equal(one({ friend: { teamId: 'blue' }, q: { draftOutcome: 'kept' } }).why, R.movedByHand);
  });
  it('confirmed after the draft (no outcome)', () => {
    assert.equal(one({ friend: { teamId: 'blue' } }).why, R.confirmedAfter);
  });
  it('the friend withdrew', () => {
    assert.equal(one({ friend: { teamId: null, status: 'withdrawn', endedAt: '2027-05-09T12:00:00Z' } }).why, R.withdrew('Leo', '05-09'));
  });
  it('a child placed after the draft was not in it', () => {
    const maya = reg('Maya', 'Okafor', { teamId: 'red' });
    const leo = reg('Leo', 'Park', { teamId: 'blue' });
    const q = confirmed(maya, leo);
    const line = requestLines(buildQueue([q], [maya, leo]))[0];
    assert.equal(friendResult(line, ctx({ [maya.id]: { dealt: 'red', locked: false } })).why, R.notInDraft('Leo'));
  });
  it('Not signed up, Can’t honour and still to confirm say so', () => {
    assert.equal(one({ q: { state: 'not_signed_up', matchedRegistrationId: null } }).why, R.notSignedUp);
    assert.equal(one({ q: { state: 'cant_honour', reason: 'different_division' } }).why, R.differentDivision);
    assert.equal(one({ q: { state: 'cant_honour', reason: 'other', note: 'Coach’s call' } }).why, R.cantHonour('Coach’s call'));
    assert.equal(one({ friend: { teamId: 'blue' }, q: { state: 'to_confirm', matchedRegistrationId: null, decidedAt: null } }).why, R.notConfirmed);
  });
  it('a division has drafted once the draft dealt any accepted player of it', () => {
    const maya = reg('Maya', 'Okafor');
    assert.equal(divisionDrafted('u9', [maya], {}), false);
    assert.equal(divisionDrafted('u9', [maya], { [maya.id]: { dealt: 'red', locked: false } }), true);
  });
});

describe('the board’s Together place (5b option B)', () => {
  const p = (id: string, teamId: string | null, email: string, locked = false) => ({ id, teamId, locked, guardianEmail: email });
  const link = (id: string, a: string, b: string, apart = false) =>
    ({ id, a, b, requestIds: [id], bothAsked: false, code: false, confirmedAt: '2027-03-12', apart, keptApartBy: null, keptApartAt: null });
  it('family and the friends the draft keeps are one group; a friend kept apart still shows on the one who asked', () => {
    // Nora and Theo are brother and sister; Noah is Nora's friend; Maya asked for Liam and Zoe, Zoe kept apart.
    const players = [p('nora', 'red', 'bell@x'), p('theo', 'red', 'bell@x'), p('noah', 'red', 'patel@x'), p('maya', 'red', 'o@x'), p('liam', 'red', 'c@x'), p('zoe', 'blue', 'z@x')];
    const t = togetherOf(players, ['red', 'blue'], [link('L1', 'nora', 'noah'), link('L2', 'maya', 'liam'), link('L3', 'maya', 'zoe', true)]);
    assert.deepEqual(t.get('noah')!.map(x => x.id).sort(), ['nora', 'theo']);
    assert.deepEqual(t.get('theo')!.map(x => [x.id, x.kind]).sort(), [['noah', 'friend'], ['nora', 'family']]);
    assert.deepEqual(t.get('maya')!.map(x => x.id).sort(), ['liam', 'zoe']);
    assert.deepEqual(t.get('liam')!.map(x => x.id), ['maya'], 'Zoe was kept apart from Maya, so she is not in Liam’s group');
    assert.equal(t.get('maya')!.find(x => x.id === 'zoe')!.outcome, 'apart');
  });
  it('without friends (a reader who can’t open Registrations) it is the family alone', () => {
    const players = [p('nora', 'red', 'bell@x'), p('theo', 'blue', 'bell@x'), p('noah', 'red', 'patel@x')];
    const t = togetherOf(players, ['red', 'blue'], null);
    assert.deepEqual(t.get('nora')!.map(x => x.id), ['theo']);
    assert.equal(t.has('noah'), false);
  });
});
