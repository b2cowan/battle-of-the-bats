import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatStoredClock, formatTime } from '../../lib/utils.ts';

/**
 * A STORED clock field ("HH:mm", as `arrival_time` is kept) prints as the product's one clock —
 * "5:45 p.m." — and free text a coach typed into the same field passes through as theirs. The
 * Schedule's arrival line and the printed practice sheet's where-line both read through this
 * (practices re-evaluation stage 5, P2, 2026-09-17: the sheet printed "Arrive 17:45" raw).
 */
describe('formatStoredClock', () => {
  it('formats a stored "HH:mm" through the one clock formatter', () => {
    assert.equal(formatStoredClock('17:45'), '5:45 p.m.');
    assert.equal(formatStoredClock('08:00'), '8:00 a.m.');
    assert.equal(formatStoredClock(' 9:05 '), '9:05 a.m.');
    assert.equal(formatStoredClock('17:45'), formatTime('17:45'), 'never a second spelling');
  });
  it('passes a free-text value through untouched — it is the coach\'s, not our prose', () => {
    assert.equal(formatStoredClock('after school'), 'after school');
    assert.equal(formatStoredClock('5pm sharp'), '5pm sharp', 'formatTime alone would read "5pm" as five in the morning');
  });
  it('is empty for nothing', () => {
    assert.equal(formatStoredClock(''), '');
    assert.equal(formatStoredClock(null), '');
    assert.equal(formatStoredClock(undefined), '');
  });
});
