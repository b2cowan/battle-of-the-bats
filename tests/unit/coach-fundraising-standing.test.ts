/**
 * A SPONSOR'S CHIP IS DERIVED FROM THE MONEY, NEVER READ OFF THE FIELD (List · Room · Question
 * Phase B, 2026-09-02). The stored `sponsor_status` flips to `received` on the FIRST cheque, so a
 * chip that read it would call a half-kept promise "Received". The row's chip reads the two
 * figures the row already carries instead, and this pins the three answers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sponsorStanding, SPONSOR_STANDING_LABEL } from '../../lib/coach-fundraising';
import { arrivalOrder } from '../../lib/sponsor-arrivals';

describe('sponsorStanding — the derived chip', () => {
  it('a promise with nothing arrived is a pledge', () => {
    assert.equal(sponsorStanding(500, 0), 'pledged');
    assert.equal(sponsorStanding(null, 0), 'pledged');
  });

  it('some of a pledge still to come is part received — never "Received" on the first cheque', () => {
    assert.equal(sponsorStanding(500, 250), 'part');
    assert.equal(sponsorStanding(500, 499.99), 'part');
  });

  it('the promise kept — to the cent, or over — is received', () => {
    assert.equal(sponsorStanding(500, 500), 'received');
    assert.equal(sponsorStanding(500, 500.004), 'received');
    assert.equal(sponsorStanding(500, 600), 'received');
  });

  it('money with no promise behind it is received the moment it lands', () => {
    assert.equal(sponsorStanding(null, 100), 'received');
    assert.equal(sponsorStanding(0, 100), 'received');
  });

  it('every standing has one label, and only one', () => {
    assert.deepEqual(Object.keys(SPONSOR_STANDING_LABEL).sort(), ['part', 'pledged', 'received']);
  });
});

describe('arrivalOrder — the replay order an edit must respect', () => {
  it('sorts by the day the money arrived, then by the day it was recorded', () => {
    const rows = [
      { id: 'c', receivedDate: '2026-02-10', createdAt: '2026-02-11T00:00:00Z' },
      { id: 'a', receivedDate: '2026-01-10', createdAt: '2026-03-01T00:00:00Z' },
      { id: 'b', receivedDate: '2026-01-10', createdAt: '2026-01-10T00:00:00Z' },
    ];
    assert.deepEqual([...rows].sort(arrivalOrder).map(r => r.id), ['b', 'a', 'c']);
  });

  it('an undated cheque replays first — the day it was created is the only day it has', () => {
    const rows = [
      { id: 'dated', receivedDate: '2026-01-10', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'undated', receivedDate: null, createdAt: '2026-01-05T00:00:00Z' },
    ];
    assert.deepEqual([...rows].sort(arrivalOrder).map(r => r.id), ['undated', 'dated']);
  });

  it('moving one cheque past its sibling changes which one comes first — the whole reason an edit replays', () => {
    const before = [
      { id: 'first', receivedDate: '2026-01-10', createdAt: '2026-01-10T00:00:00Z' },
      { id: 'second', receivedDate: '2026-02-10', createdAt: '2026-02-10T00:00:00Z' },
    ];
    const edited = before.map(r => (r.id === 'first' ? { ...r, receivedDate: '2026-03-01' } : r));
    assert.deepEqual([...before].sort(arrivalOrder).map(r => r.id), ['first', 'second']);
    assert.deepEqual([...edited].sort(arrivalOrder).map(r => r.id), ['second', 'first']);
  });
});
