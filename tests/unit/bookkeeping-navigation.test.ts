import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BOOKKEEPING_VIEWS, bookkeepingAddress, bookkeepingPlace } from '../../lib/bookkeeping-navigation.ts';

const ID = 'b2026102-3000-4000-8000-000000000001';

describe('Bookkeeping addresses', () => {
  it('round-trips each view with an open record and keeps the underlying list filters', () => {
    for (const view of BOOKKEEPING_VIEWS) {
      const original = new URLSearchParams({ category: 'Bank charges', q: '$18.08', from: '2026-10-01' });
      const url = new URL(bookkeepingAddress(original, { view, record: ID }), 'http://localhost');
      assert.deepEqual(bookkeepingPlace(url.searchParams), { view, record: ID, form: null, attention: false });
      for (const [key, value] of original) assert.equal(url.searchParams.get(key), value);
    }
  });

  it('only opens a supported view and requires a valid record for Correct or Void', () => {
    for (const view of ['sources', 'record', 'add', 'invalid']) {
      assert.equal(bookkeepingPlace(new URLSearchParams({ view })).view, 'overview');
    }
    for (const form of ['correct', 'void']) {
      assert.equal(bookkeepingPlace(new URLSearchParams({ form, record: 'invalid' })).form, null);
      assert.equal(bookkeepingPlace(new URLSearchParams({ form, record: ID })).form, form);
    }
    assert.equal(bookkeepingPlace(new URLSearchParams('form=add')).form, 'add');
  });

  it('closing a window removes only its own place and switching views clears the attention filter', () => {
    const current = new URLSearchParams({ view: 'expenses', record: ID, form: 'correct', attention: '1', q: 'Hosting' });
    const closed = new URL(bookkeepingAddress(current, { record: null, form: null }), 'http://localhost');
    assert.deepEqual(bookkeepingPlace(closed.searchParams), { view: 'expenses', record: null, form: null, attention: true });
    assert.equal(closed.searchParams.get('q'), 'Hosting');
    const switched = new URL(bookkeepingAddress(closed.searchParams, { view: 'reports', attention: false }), 'http://localhost');
    assert.deepEqual(bookkeepingPlace(switched.searchParams), { view: 'reports', record: null, form: null, attention: false });
  });
});
