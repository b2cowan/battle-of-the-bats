import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_SCHEDULE_FILTER, eventDays, fieldKeyOf, filtersOn, gamesByDay, matchesScheduleFilter, matchesScheduleSearch,
  openingDay, scheduleStateOf, stepDay, type ScheduleFilter,
} from '../../lib/schedule-day.ts';
import { SCHEDULE_DAY_WORDS as W } from '../../lib/schedule-words.ts';
import type { Division, Game, Tournament } from '../../lib/types.ts';

/**
 * Tournament admin redesign Stage 3, Part 2 — the schedule opens on the day (S1, A33).
 * Before: one division, one stage, unplayed games only (F66); a waiting score and a forfeit matched no filter (F67).
 */

const T = { id: 't', startDate: '2026-10-07', endDate: '2026-10-09', settings: { game_duration_minutes: 75 } } as unknown as Tournament;
const DIVS = [{ id: 'u11', name: 'U11', settings: {} }, { id: 'u13', name: 'U13', settings: {} }] as unknown as Division[];
const g = (over: Partial<Game>): Game => ({
  id: over.id ?? 'g', tournamentId: 't', divisionId: 'u11', homeTeamId: 'h', awayTeamId: 'a', date: '2026-10-09', time: '16:00',
  location: '', status: 'scheduled', isPlayoff: false, ...over,
}) as Game;

describe('the opening (A33)', () => {
  const days = eventDays([g({ date: '2026-10-08' }), g({ date: '2026-10-09' })], T);
  test('the event\'s days are its stated span, plus any day a game is on', () => {
    assert.deepEqual(days, ['2026-10-07', '2026-10-08', '2026-10-09']);
    assert.deepEqual(eventDays([g({ date: '2026-10-12' })], T), ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12']);
  });
  test('today while the event is on', () => assert.equal(openingDay(days, '2026-10-08'), '2026-10-08'));
  test('its first day before it', () => assert.equal(openingDay(days, '2026-09-30'), '2026-10-07'));
  test('its last day after it', () => assert.equal(openingDay(days, '2026-11-01'), '2026-10-09'));
  test('no days at all: today', () => assert.equal(openingDay([], '2026-10-09'), '2026-10-09'));
  test('a typo\'d end date does not make a year of days', () => {
    assert.ok(eventDays([], { startDate: '2026-10-07', endDate: '2027-10-07' } as unknown as Tournament).length <= 31);
  });
  test('the arrows step through the event\'s days and stop at its ends', () => {
    assert.equal(stepDay(days, '2026-10-08', -1), '2026-10-07');
    assert.equal(stepDay(days, '2026-10-08', 1), '2026-10-09');
    assert.equal(stepDay(days, '2026-10-09', 1), null);
    assert.equal(stepDay(days, '2026-10-07', -1), null);
  });
});

describe('one state per game (G5\'s words)', () => {
  // 4:00 p.m. Eastern on Oct 9 — the demo's final, with the event's 75 minutes.
  const at = (hhmm: string) => Date.parse(`2026-10-09T${hhmm}:00-04:00`);
  const state = (over: Partial<Game>, now: string) => scheduleStateOf(g(over), DIVS, T, at(now), '2026-10-09');
  test('a cancelled game, a forfeit, a final, a waiting score', () => {
    assert.equal(state({ status: 'cancelled' }, '12:00'), 'cancelled');
    assert.equal(state({ status: 'forfeit' }, '12:00'), 'forfeit');
    assert.equal(state({ status: 'completed' }, '12:00'), 'final');
    assert.equal(state({ status: 'submitted' }, '12:00'), 'pendingReview');
  });
  test('an unscored game by the clock: Scheduled, Playing now for its length, then Needs a score', () => {
    assert.equal(state({}, '15:59'), 'scheduled');
    assert.equal(state({}, '17:14'), 'playingNow');
    assert.equal(state({}, '17:15'), 'needsScore');
  });
  test('every state has its word', () => {
    for (const s of ['needsScore', 'pendingReview', 'playingNow', 'scheduled', 'final', 'forfeit', 'cancelled'] as const) assert.ok(W.states[s]);
    assert.equal(W.states.pendingReview, 'Pending Review');
    assert.equal(W.states.needsScore, 'Needs a score');
  });
});

describe('the Filter (quiet until it filters; every state shows by default — F67)', () => {
  const played = g({ id: 'p', status: 'completed' });
  const waiting = g({ id: 'w', status: 'submitted' });
  const forfeit = g({ id: 'f', status: 'forfeit' });
  const playoff = g({ id: 'x', isPlayoff: true, divisionId: 'u13', venueId: 'v', venueFacilityId: 'd2' });
  test('nothing ticked: every game passes, whatever its state', () => {
    for (const [game, s] of [[played, 'final'], [waiting, 'pendingReview'], [forfeit, 'forfeit']] as const) {
      assert.equal(matchesScheduleFilter(game, s, NO_SCHEDULE_FILTER), true);
    }
    assert.equal(filtersOn(NO_SCHEDULE_FILTER), 0);
  });
  test('a ticked group passes what it ticks; groups combine', () => {
    const f: ScheduleFilter = { ...NO_SCHEDULE_FILTER, stages: ['playoff'], divisions: ['u13'] };
    assert.equal(filtersOn(f), 2);
    assert.equal(matchesScheduleFilter(playoff, 'scheduled', f), true);
    assert.equal(matchesScheduleFilter(played, 'final', f), false);
    assert.equal(matchesScheduleFilter(waiting, 'pendingReview', { ...NO_SCHEDULE_FILTER, states: ['pendingReview', 'forfeit'] }), true);
    assert.equal(matchesScheduleFilter(played, 'final', { ...NO_SCHEDULE_FILTER, states: ['pendingReview', 'forfeit'] }), false);
    assert.equal(matchesScheduleFilter(playoff, 'scheduled', { ...NO_SCHEDULE_FILTER, fields: [fieldKeyOf(playoff)] }), true);
  });
  test('a field key per diamond, a whole venue, a lane, or typed words', () => {
    assert.equal(fieldKeyOf(playoff), 'venue:v:d2');
    assert.equal(fieldKeyOf(g({ venueId: 'v' })), 'venue:v');
    assert.equal(fieldKeyOf(g({ scheduleFacilityLaneId: 'l1' })), 'lane:l1');
    assert.equal(fieldKeyOf(g({ location: ' Park 3 ' })), 'custom:park 3');
  });
  test('search reads both teams', () => {
    assert.equal(matchesScheduleSearch('Riverdale Rapids', 'Silver Creek Sharks', 'shark'), true);
    assert.equal(matchesScheduleSearch('Riverdale Rapids', 'Silver Creek Sharks', 'storm'), false);
    assert.equal(matchesScheduleSearch('A', 'B', '  '), true);
  });
});

describe('All games: the day bands, in time order, the undated last', () => {
  test('bands and order', () => {
    const out = gamesByDay([
      g({ id: 'b', date: '2026-10-09', time: '12:00' }), g({ id: 'u', date: '' as unknown as string }),
      g({ id: 'a', date: '2026-10-09', time: '09:00' }), g({ id: 'c', date: '2026-10-08', time: '18:00' }),
    ]);
    assert.deepEqual(out.map(o => o.day), ['2026-10-08', '2026-10-09', null]);
    assert.deepEqual(out[1].games.map(x => x.id), ['a', 'b']);
  });
});

describe('the day row\'s words', () => {
  test('"Today · Fri, Oct 9" and its caption', () => {
    assert.equal(W.dayLabel('2026-10-09', '2026-10-09'), 'Today · Fri, Oct 9');
    assert.equal(W.dayLabel('2026-10-08', '2026-10-09'), 'Thu, Oct 8');
    assert.equal(W.dayCaption(4, ['U11', 'U13']), '4 games · U11 and U13');
    assert.equal(W.dayCaption(1, ['U11']), '1 game · U11');
    assert.equal(W.dayCaption(12, ['U11', 'U13', 'U15']), '12 games · 3 divisions');
    assert.equal(W.dayCaption(0, []), 'No games');
  });
  test('the tools by their names (A34 as amended)', async () => {
    const { SCHEDULE_TOOL_NAMES: T2 } = await import('../../lib/schedule-words.ts');
    assert.equal(T2.roundRobin, 'Round-robin generator');
    assert.equal(T2.playoffs, 'Playoff generator');
  });
});
