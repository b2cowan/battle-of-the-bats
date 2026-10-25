import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JAN_1 } from '../../lib/born-years.ts';
import {
  childTag, forecastChildren, nameList, ordinal, signupHeadline, signupNotice, signupSubject, signupToPay,
  type FormDivision, type PlacedChild,
} from '../../lib/league-signup.ts';

/** Club Tier 9b-1, Parts 5–6: one sign-up, several children — the words and the form's forecast (copy §7–§11). */

const div = (over: Partial<FormDivision>): FormDivision => ({
  id: 'u10', name: 'U10', note: null, capacity: 12, heldCount: 5, waitlistCount: 0,
  bornFromYear: 2016, bornToYear: 2017, price: 165, earlyPrice: null, ...over,
});
const season = { registrationFee: null, earlyBirdUntil: null, autoApproveUnderCapacity: true };
const child = (first: string, status: PlacedChild['status'], fee: number | null = 165, pos: number | null = null): PlacedChild =>
  ({ firstName: first, lastName: 'Kim', divisionName: 'U10', status, waitlistPosition: pos, fee });

describe('the family’s words', () => {
  it('ordinals and name lists', () => {
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
    assert.equal(nameList(['Henry', 'Ava', 'Sam']), 'Henry, Ava and Sam');
  });
  it('"Accepted" for the family, never "Approved" (9b·12)', () => {
    assert.equal(childTag('active', null), 'Accepted');
    assert.equal(childTag('pending_review', null), 'Received');
    assert.equal(childTag('waitlisted', 1), 'Waitlist · 1st');
  });
  it('to pay counts accepted children only', () => {
    assert.equal(signupToPay([child('Henry', 'active'), child('Ava', 'waitlisted', 165, 1), child('Sam', 'pending_review')]), 165);
  });
  it('headline and subject follow the outcomes', () => {
    assert.equal(signupHeadline([child('Ava', 'waitlisted', 165, 1)]), 'You’re on the waitlist');
    assert.equal(signupSubject([child('Henry', 'active')], 'Summer 2027'), 'Henry is accepted — Summer 2027');
    assert.equal(signupSubject([child('Henry', 'active'), child('Ava', 'waitlisted', 165, 1)], 'Summer 2027'),
      'Your sign-up for Summer 2027: 1 accepted, 1 on the waitlist');
  });
  it('one staff notice per sign-up, in staff words', () => {
    const n = signupNotice([child('Henry', 'active'), child('Ava', 'waitlisted', 165, 1)], 'Grace Kim', 'Summer 2027');
    assert.equal(n.title, 'New sign-up: Henry Kim and Ava Kim');
    assert.equal(n.body, 'Grace Kim · Summer 2027 · 1 approved, 1 on the waitlist');
  });
});

describe('the form’s forecast (9b·4, 9b·5, 9b·13)', () => {
  const TODAY = '2027-05-01';
  it('a date of birth finds the division; a year no division takes says so', () => {
    const [a, b] = forecastChildren([{ dob: '2016-04-01', divisionId: '' }, { dob: '2012-04-01', divisionId: '' }], [div({})], season, JAN_1, TODAY);
    assert.equal(a.kind, 'spot');
    assert.deepEqual(b, { kind: 'nofit', year: 2012 });
  });
  it('the last spot goes to the first child; the second joins the waitlist, never jumping it', () => {
    const one = div({ capacity: 6 });
    const [a, b] = forecastChildren([{ dob: '2016-04-01', divisionId: '' }, { dob: '2017-02-01', divisionId: '' }], [one], season, JAN_1, TODAY);
    assert.equal(a.kind, 'spot');
    assert.equal(b.kind, 'waitlist');
    assert.equal(b.kind === 'waitlist' && b.position, 1);
    const [c] = forecastChildren([{ dob: '2016-04-01', divisionId: '' }], [div({ waitlistCount: 2 })], season, JAN_1, TODAY);
    assert.equal(c.kind === 'waitlist' && c.position, 3, 'a spot is free but children are waiting: the line is joined');
  });
  it('two divisions for one age group: the family picks', () => {
    const a = div({ id: 'a', name: 'U10 A', note: 'Tuesday nights' }), b = div({ id: 'b', name: 'U10 B', note: 'Thursday nights' });
    const [p] = forecastChildren([{ dob: '2016-04-01', divisionId: '' }], [a, b], season, JAN_1, TODAY);
    assert.equal(p.kind, 'pick');
    const [q] = forecastChildren([{ dob: '2016-04-01', divisionId: 'b' }], [a, b], season, JAN_1, TODAY);
    assert.equal(q.kind === 'spot' && q.division.name, 'U10 B');
  });
  it('the early bird applies on its day, and says when it ended', () => {
    const d = div({ earlyPrice: 145 });
    const [on] = forecastChildren([{ dob: '2016-04-01', divisionId: '' }], [d], { ...season, earlyBirdUntil: '2027-05-01' }, JAN_1, TODAY);
    assert.equal(on.kind === 'spot' && on.amount, 145);
    const [off] = forecastChildren([{ dob: '2016-04-01', divisionId: '' }], [d], { ...season, earlyBirdUntil: '2027-04-30' }, JAN_1, TODAY);
    assert.equal(off.kind === 'spot' && off.amount, 165);
    assert.deepEqual(off.kind === 'spot' && off.earlyEnded, { amount: 145, until: 'Apr 30' });
  });
  it('a date of birth is required only when the season sorts by age', () => {
    assert.equal(forecastChildren([{ dob: '', divisionId: '' }], [div({})], season, JAN_1, TODAY)[0].kind, 'needDob');
    const open = div({ bornFromYear: null, bornToYear: null });
    assert.equal(forecastChildren([{ dob: '', divisionId: 'u10' }], [open], season, JAN_1, TODAY)[0].kind, 'spot');
  });
});
