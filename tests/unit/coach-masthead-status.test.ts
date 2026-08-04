/**
 * The team masthead's status line (desktop shell A2) — the selection half.
 *
 * The masthead is the portal's most-seen sentence, and the two ways it can be wrong are both
 * covered here: claiming a game day that isn't one (or missing one that is), and speaking at all
 * about a season that is finished.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveMastheadStatus,
  mastheadWhen,
  type MastheadEvent,
} from '../../lib/coach-masthead-status.ts';

/** 2026-06-18 is a Thursday. Times are Toronto wall-clock (EDT = UTC-4) unless noted. */
const NOW = new Date('2026-06-18T14:00:00-04:00');

const event = (over: Partial<MastheadEvent> = {}): MastheadEvent => ({
  id: 'evt-1',
  eventType: 'league_game',
  startsAt: '2026-06-18T18:30:00-04:00',
  opponent: 'Lions',
  name: 'League Game vs Lions',
  ...over,
});

describe('resolveMastheadStatus', () => {
  it('a game later today is game day', () => {
    const status = resolveMastheadStatus({
      programYearStatus: 'active', nextEvent: event(), hasFinalizedGame: true, now: NOW,
    });
    assert.equal(status?.kind, 'game_day');
    assert.equal(status?.daysAway, 0);
  });

  it('a PRACTICE today is not game day — it is simply what is next', () => {
    const status = resolveMastheadStatus({
      programYearStatus: 'active',
      nextEvent: event({ eventType: 'practice', opponent: null }),
      hasFinalizedGame: true,
      now: NOW,
    });
    assert.equal(status?.kind, 'next');
    assert.equal(status?.daysAway, 0);
  });

  it('a game tomorrow is next, not game day', () => {
    const status = resolveMastheadStatus({
      programYearStatus: 'active',
      nextEvent: event({ startsAt: '2026-06-19T18:30:00-04:00' }),
      hasFinalizedGame: true,
      now: NOW,
    });
    assert.equal(status?.kind, 'next');
    assert.equal(status?.daysAway, 1);
  });

  it('a game at 9pm tonight is still TODAY — the day gap is calendar days in the org zone, not a rolling 24h', () => {
    // 2026-06-18 21:00 EDT is 2026-06-19 01:00 UTC: raw UTC date math would call this tomorrow
    // and game day would never fire for an evening game.
    const status = resolveMastheadStatus({
      programYearStatus: 'active',
      nextEvent: event({ startsAt: '2026-06-19T01:00:00Z' }),
      hasFinalizedGame: true,
      now: NOW,
    });
    assert.equal(status?.kind, 'game_day');
  });

  it('a quiet week says nothing at all', () => {
    const status = resolveMastheadStatus({
      programYearStatus: 'active', nextEvent: null, hasFinalizedGame: true, now: NOW,
    });
    assert.equal(status, null);
  });

  it('a finished season has no next thing, even with an event still on its schedule', () => {
    for (const programYearStatus of ['completed', 'archived']) {
      const status = resolveMastheadStatus({
        programYearStatus, nextEvent: event(), hasFinalizedGame: true, now: NOW,
      });
      assert.equal(status, null, `${programYearStatus} must render no status`);
    }
  });

  it('a brand-new season with nothing played still announces its first game', () => {
    const status = resolveMastheadStatus({
      programYearStatus: 'draft',
      nextEvent: event({ startsAt: '2026-06-25T18:30:00-04:00' }),
      hasFinalizedGame: false,
      now: NOW,
    });
    assert.equal(status?.kind, 'next');
  });
});

describe('mastheadWhen', () => {
  it('today is named, not left to be inferred from a bare clock time', () => {
    assert.equal(mastheadWhen('2026-06-18T18:30:00-04:00', 0).day, 'Today');
  });

  it('inside the coming week it is a weekday', () => {
    assert.equal(mastheadWhen('2026-06-21T10:00:00-04:00', 3).day, 'Sun');
  });

  it('past six days it becomes a date — "Thu" three weeks out names the wrong Thursday', () => {
    assert.equal(mastheadWhen('2026-07-09T10:00:00-04:00', 21).day, 'Jul 9');
  });

  it('the clock is the ORG zone, not the server\'s UTC', () => {
    // 22:30 UTC = 6:30 p.m. in Toronto. A UTC read would say 10:30 p.m.
    assert.match(mastheadWhen('2026-06-18T22:30:00Z', 0).time, /^6:30/);
  });
});
