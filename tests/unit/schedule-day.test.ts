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
    assert.equal(W.states.pendingReview, 'Pending review');
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

/**
 * Walk §294 (ruled 2026-10-12): a game still to play too close to another on its diamond wears "Tight turnover" (or
 * "Double-booked"), the Filter's Conflicts group finds exactly those rows, and each game of a pair is told about the
 * OTHER side of the gap — the earlier game was told the later game's end.
 */
describe('conflicts in every view (walk §294)', () => {
  test('only a game still to play has a conflict; once played the gap no longer matters', async () => {
    const { toPlayConflict } = await import('../../lib/schedule-day.ts');
    assert.equal(toPlayConflict('scheduled', 'buffer'), 'buffer');
    assert.equal(toPlayConflict('scheduled', 'overlap'), 'overlap');
    assert.equal(toPlayConflict('scheduled', null), null);
    for (const s of ['playingNow', 'needsScore', 'pendingReview', 'final', 'forfeit', 'cancelled'] as const) {
      assert.equal(toPlayConflict(s, 'buffer'), null, s);
    }
  });
  test('the Conflicts group passes the rows that wear its chip, and counts as one group on', () => {
    const game = g({ id: 'c' });
    const f: ScheduleFilter = { ...NO_SCHEDULE_FILTER, conflicts: ['buffer'] };
    assert.equal(filtersOn(f), 1);
    assert.equal(matchesScheduleFilter(game, 'scheduled', f, 'buffer'), true);
    assert.equal(matchesScheduleFilter(game, 'scheduled', f, 'overlap'), false);
    assert.equal(matchesScheduleFilter(game, 'scheduled', f, null), false);
    assert.equal(matchesScheduleFilter(game, 'scheduled', f), false);
    // Nothing ticked: a conflict changes nothing.
    assert.equal(matchesScheduleFilter(game, 'scheduled', NO_SCHEDULE_FILTER, 'buffer'), true);
  });
  test('the chip and the Filter say one word each', () => {
    assert.equal(W.conflicts.buffer, 'Tight turnover');
    assert.equal(W.conflicts.overlap, 'Double-booked');
    assert.equal(W.groups.conflicts, 'Conflicts');
  });
  test('the clash check flags BOTH games of a tight pair', async () => {
    const { buildConflictMap, toConflictGame } = await import('../../lib/schedule-conflict.ts');
    const tournament = { settings: { game_duration_minutes: 90, buffer_minutes: 15 } } as unknown as Tournament;
    const early = toConflictGame({ id: 'early', date: '2026-10-17', time: '09:00', status: 'scheduled', venueId: 'v', venueFacilityId: 'd2', divisionId: 'u11' });
    const late = toConflictGame({ id: 'late', date: '2026-10-17', time: '10:40', status: 'scheduled', venueId: 'v', venueFacilityId: 'd2', divisionId: 'u13' });
    const clear = toConflictGame({ id: 'clear', date: '2026-10-17', time: '12:30', status: 'scheduled', venueId: 'v', venueFacilityId: 'd2', divisionId: 'u11' });
    const map = buildConflictMap([early, late, clear], [], tournament);
    assert.equal(map.get('early')?.kind, 'buffer');
    assert.equal(map.get('late')?.kind, 'buffer');
    assert.equal(map.get('clear'), undefined); // 10:40 + 90 = 12:10, then 20 minutes: wider than the turnover
  });
  test("one rule decides the side of the gap; the EARLIER game's turnover applies, whichever game asks", async () => {
    const { turnoverSide } = await import('../../lib/schedule-conflict.ts');
    const divisions = [
      { id: 'u11', settings: { buffer_minutes: 15 } },
      { id: 'u13', settings: { buffer_minutes: 20 } },
    ] as unknown as Division[];
    const early = { startTime: '09:00:00', durationMinutes: 90, divisionId: 'u11' };
    const late = { startTime: '10:40', durationMinutes: 90, divisionId: 'u13' };
    assert.deepEqual(turnoverSide(early, late, divisions, null), { partnerLater: true, turnover: 15, gap: 10, partnerStart: '10:40', partnerEnd: '12:10' });
    assert.deepEqual(turnoverSide(late, early, divisions, null), { partnerLater: false, turnover: 15, gap: 10, partnerStart: '09:00', partnerEnd: '10:30' });
    assert.equal(turnoverSide({ startTime: null, durationMinutes: 90, divisionId: 'u11' }, late, divisions, null), null);
  });
  test('each game of the pair is told about the other side, in "turnover"; the read view drops "You can still save."', async () => {
    const { GAME_WINDOW_WORDS: G } = await import('../../lib/schedule-words.ts');
    const later = G.buffer('Maple Field 2', 'Ravens U11 Girls vs Falcons U11 Girls', '10:30 a.m.', 15, true);
    assert.equal(later.lead + later.rest, 'Maple Field 2 has Ravens U11 Girls vs Falcons U11 Girls until 10:30 a.m. — less than the 15-minute turnover. You can still save.');
    const earlierRead = G.bufferNext('Maple Field 2', 'Freeze U13 Boys vs Falcons U13 Boys', '10:40 a.m.', 10, 15, false);
    assert.equal(earlierRead.lead + earlierRead.rest, 'Freeze U13 Boys vs Falcons U13 Boys starts on Maple Field 2 at 10:40 a.m., 10 minutes after this game ends — less than the 15-minute turnover.');
    const touching = G.bufferNext('Maple Field 2', 'the U13 final', '10:30 a.m.', 0, 15, false);
    assert.match(touching.rest, /^, right as this game ends — less than the 15-minute turnover\.$/);
    const oneMinute = G.bufferNext('Diamond 1', 'A vs B', '10:31 a.m.', 1, 15, true);
    assert.match(oneMinute.rest, /^, 1 minute after this game ends/);
  });
});
