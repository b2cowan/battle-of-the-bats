/**
 * Regression tests for the "what day is it?" bug class (J6-056 family).
 *
 * Production runs on UTC (Amplify); the org schedules in America/Toronto (UTC−4 in summer,
 * −5 in winter). Any calendar-day question answered from the runtime's zone is therefore a
 * day late from ~8 PM Toronto onwards — and a developer machine runs on Toronto time, so the
 * fault is invisible locally and only wrong in production, in the evening.
 *
 * The fixed instants below are chosen to sit inside that broken window.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tournamentToday, addCalendarDays, daysBetweenDateStrings, calendarDaysBetween } from '../../lib/timezone.ts';
import { deriveCoachTournamentPhase } from '../../lib/coach-tournament-phase.ts';

/** 2026-07-25, 8:30 PM in Toronto (EDT, UTC−4) — i.e. already 2026-07-26 in UTC. */
const EVENING_EDT = new Date('2026-07-26T00:30:00Z');
/** 2026-01-15, 8:30 PM in Toronto (EST, UTC−5) — already 2026-01-16 in UTC. */
const EVENING_EST = new Date('2026-01-16T01:30:00Z');

describe('tournamentToday — the evening rollover', () => {
  it('returns the Toronto date, not the UTC date, after 8 PM in summer', () => {
    assert.equal(EVENING_EDT.toISOString().slice(0, 10), '2026-07-26'); // what the bug saw
    assert.equal(tournamentToday(EVENING_EDT), '2026-07-25');           // what it should be
  });

  it('handles the winter offset too (EST, UTC−5)', () => {
    assert.equal(EVENING_EST.toISOString().slice(0, 10), '2026-01-16');
    assert.equal(tournamentToday(EVENING_EST), '2026-01-15');
  });

  it('agrees with UTC during Toronto daytime', () => {
    assert.equal(tournamentToday(new Date('2026-07-25T15:00:00Z')), '2026-07-25');
  });
});

describe('coach tournament phase — must not end an event that is still running', () => {
  const base = {
    registrationStatus: 'accepted',
    scheduleVisible: true,
    tournamentStatus: 'active',
    startDate: '2026-07-24',
    endDate: '2026-07-25',
  };

  it('stays game_day at 8:30 PM on the closing night (the bug: flipped to result)', () => {
    // The old behaviour, reproduced: deriving "today" from UTC ends the event a night early.
    assert.equal(
      deriveCoachTournamentPhase({ ...base, today: EVENING_EDT.toISOString().slice(0, 10) }),
      'result',
    );
    // The fix.
    assert.equal(
      deriveCoachTournamentPhase({ ...base, today: tournamentToday(EVENING_EDT) }),
      'game_day',
    );
  });

  it('does not start an event a night early either', () => {
    const eveningBefore = new Date('2026-07-24T00:30:00Z'); // 8:30 PM Jul 23 in Toronto
    assert.equal(
      deriveCoachTournamentPhase({ ...base, today: eveningBefore.toISOString().slice(0, 10) }),
      'game_day', // bug: event "starts" the night before
    );
    assert.equal(
      deriveCoachTournamentPhase({ ...base, today: tournamentToday(eveningBefore) }),
      'schedule_live',
    );
  });

  it('does end the event once the closing day is genuinely over', () => {
    assert.equal(
      deriveCoachTournamentPhase({ ...base, today: tournamentToday(new Date('2026-07-26T14:00:00Z')) }),
      'result',
    );
  });
});

describe('addCalendarDays', () => {
  it('steps forward and backward by calendar days', () => {
    assert.equal(addCalendarDays('2026-07-25', 7), '2026-08-01');
    assert.equal(addCalendarDays('2026-07-25', -1), '2026-07-24');
    assert.equal(addCalendarDays('2026-07-25', 0), '2026-07-25');
  });

  it('crosses a DST boundary without losing a day', () => {
    // Toronto springs forward 2026-03-08. A rolling 86_400_000ms step lands on the 7th at 11 PM.
    assert.equal(addCalendarDays('2026-03-07', 1), '2026-03-08');
    assert.equal(addCalendarDays('2026-03-07', 2), '2026-03-09');
  });

  it('round-trips against daysBetweenDateStrings', () => {
    assert.equal(daysBetweenDateStrings('2026-07-25', addCalendarDays('2026-07-25', 30)), 30);
  });

  it('leaves a malformed date alone rather than inventing one', () => {
    assert.equal(addCalendarDays('not-a-date', 3), 'not-a-date');
  });
});

describe('calendarDaysBetween — "days until" counts date boundaries, not 24h spans', () => {
  it('counts tonight as 0 days away and tomorrow morning as 1', () => {
    const nowEvening = new Date('2026-07-26T00:30:00Z');      // 8:30 PM Jul 25 Toronto
    const laterTonight = new Date('2026-07-26T02:00:00Z');    // 10 PM Jul 25 Toronto
    const tomorrowAM = new Date('2026-07-26T13:00:00Z');      // 9 AM Jul 26 Toronto
    assert.equal(calendarDaysBetween(nowEvening, laterTonight), 0);
    assert.equal(calendarDaysBetween(nowEvening, tomorrowAM), 1);
  });

  it('is negative for a past date', () => {
    assert.equal(
      calendarDaysBetween(new Date('2026-07-25T15:00:00Z'), new Date('2026-07-23T15:00:00Z')),
      -2,
    );
  });
});
