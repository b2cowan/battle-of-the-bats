import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DIGEST_ACTIVITY_DAYS,
  teamHadActivityInWindow,
  isRepeatOfLastDigest,
} from '../../lib/insights-digest-gate';

const NOW = new Date('2026-11-15T23:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86400000).toISOString();

describe('teamHadActivityInWindow — the weekly digest only goes to a team that did something this week', () => {
  it('the window is one week', () => {
    assert.equal(DIGEST_ACTIVITY_DAYS, 7);
  });
  it('a game or practice inside the last week counts', () => {
    assert.equal(teamHadActivityInWindow([{ startsAt: daysAgo(1), status: 'scheduled' }], NOW), true);
    assert.equal(teamHadActivityInWindow([{ startsAt: daysAgo(6.5), status: 'scheduled' }], NOW), true);
  });
  it('a team that stopped playing in September gets nothing', () => {
    assert.equal(teamHadActivityInWindow([{ startsAt: '2026-09-20T18:00:00Z', status: 'scheduled' }], NOW), false);
  });
  it('an event older than a week does not count', () => {
    assert.equal(teamHadActivityInWindow([{ startsAt: daysAgo(7.5), status: 'scheduled' }], NOW), false);
  });
  it('an event still to come is not activity yet', () => {
    assert.equal(teamHadActivityInWindow([{ startsAt: daysAhead(2), status: 'scheduled' }], NOW), false);
  });
  it('a cancelled event never happened', () => {
    assert.equal(teamHadActivityInWindow([{ startsAt: daysAgo(1), status: 'cancelled' }], NOW), false);
  });
  it('no events at all is quiet', () => {
    assert.equal(teamHadActivityInWindow([], NOW), false);
  });
  it('one recent event among old ones is enough', () => {
    assert.equal(
      teamHadActivityInWindow([
        { startsAt: '2026-09-20T18:00:00Z', status: 'scheduled' },
        { startsAt: daysAgo(2), status: 'scheduled' },
      ], NOW),
      true,
    );
  });
});

describe('isRepeatOfLastDigest — a coach is never told the same thing twice running', () => {
  const facts = { rows: [{ label: 'This week', list: ['You\'ve won 9 straight.', 'Alex has made 2 of 8.'] }], n: 2 };
  it('identical facts are a repeat', () => {
    assert.equal(isRepeatOfLastDigest(facts, JSON.parse(JSON.stringify(facts))), true);
  });
  it('the stored copy may come back with its keys in another order', () => {
    const reordered = { n: 2, rows: [{ list: ['You\'ve won 9 straight.', 'Alex has made 2 of 8.'], label: 'This week' }] };
    assert.equal(isRepeatOfLastDigest(reordered, facts), true);
  });
  it('a changed finding is not a repeat', () => {
    const changed = { ...facts, rows: [{ label: 'This week', list: ['You\'ve won 10 straight.', 'Alex has made 2 of 8.'] }] };
    assert.equal(isRepeatOfLastDigest(facts, changed), false);
  });
  it('the same findings in a different order are not a repeat', () => {
    const swapped = { ...facts, rows: [{ label: 'This week', list: ['Alex has made 2 of 8.', 'You\'ve won 9 straight.'] }] };
    assert.equal(isRepeatOfLastDigest(facts, swapped), false);
  });
  it('no earlier digest (or one from before facts were stored) is never a repeat', () => {
    assert.equal(isRepeatOfLastDigest(null, facts), false);
    assert.equal(isRepeatOfLastDigest(undefined, facts), false);
  });
});
