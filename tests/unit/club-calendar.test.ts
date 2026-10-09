/**
 * THE CLUB CALENDAR's pure rules (Club Tier Stage 6b, Asks 6–7 — `lib/club-calendar-view.ts`) and the pair rule it reads
 * through (`findClashPairs`, 6a's one rule over a whole week). The drawing's week (hub v64, specimen 5) is the fixture:
 * Tuesday's 13U AAA × 14U AA on Lions Park Diamond 2 and 11U AA × a house-league game on Kinsmen B, Wednesday's
 * "Kinsmen Park, no diamond" beside a league game on Diamond A (busy then), and the count of "3 clashes" that is PAIRS.
 */
process.env.TZ = 'UTC';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CALENDAR_WORDS, ELSEWHERE, NO_FILTERS, clashLineWords, clashPairCount, exportRows, filterOptions, icsEntries,
  matchesFilters, monthCells, rangeFor, rangeWords, rangeWordsShort, stepCursor, timeWords, weekDays, whereWords,
  type CalendarBooking, type CalendarOther,
} from '../../lib/club-calendar-view.ts';
import { findClashPairs, leagueBooking, repEventBooking } from '../../lib/venue-clash.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';

const at = (day: string, hhmm: string) => Date.parse(zonedWallClockToUtc(day, hhmm)!);

function booking(over: Partial<CalendarBooking> & Pick<CalendarBooking, 'key'>): CalendarBooking {
  return {
    program: 'rep', kind: 'practice', day: '2026-11-03', startMs: at('2026-11-03', '18:00'), endMs: at('2026-11-03', '20:00'),
    hasEnd: true, allDay: false, teamId: 't13', ownerName: '13U AAA', colour: '#B91C1C',
    who: '13U AAA', what: 'Practice', sport: 'softball',
    where: { venueId: 'lions', venueName: 'Lions Park', facility: 'Diamond 2', address: '41 Lions Park Dr', text: null },
    headCoach: null, clash: null, clashesWith: [], door: null,
    ...over,
  };
}
const other = (key: string, clash: CalendarOther['clash'] = 'booked_by'): CalendarOther => ({
  key, program: 'rep', kind: 'practice', label: 'X practice', startMs: 0, endMs: 1, where: 'Diamond 2', contact: null, clash,
});

describe('the clash count is PAIRS, said once', () => {
  const a = booking({ key: 'rep_event:13', clash: 'booked_by', clashesWith: [other('rep_event:14')] });
  const b = booking({ key: 'rep_event:14', teamId: 't14', who: '14U AA', clash: 'booked_by', clashesWith: [other('rep_event:13')] });
  const c = booking({ key: 'rep_event:11', teamId: 't11', clash: 'booked_by', clashesWith: [other('league_game:1')] });
  const busy = booking({ key: 'rep_event:12', clash: 'busy_then', clashesWith: [other('league_game:2', 'busy_then')] });

  it('two sides of one clash on screen count once', () => {
    assert.equal(clashPairCount([a, b]), 1);
  });
  it('a clash whose other side is off screen (another program, a filter) still counts', () => {
    assert.equal(clashPairCount([c]), 1);
    assert.equal(clashPairCount([a, b, c]), 2);
  });
  it('"busy then" may clash — drawn dashed, never counted', () => {
    assert.equal(clashPairCount([busy]), 0);
  });
  it('Clashes only keeps the booked bookings, not the busy ones', () => {
    const f = { ...NO_FILTERS, clashesOnly: true };
    assert.deepEqual([a, busy].filter(x => matchesFilters(x, f)).map(x => x.key), ['rep_event:13']);
  });
});

describe('filters: quiet pills, each choice counted at its row end', () => {
  const lions = booking({ key: 'rep_event:1' });
  const kinsmen = booking({ key: 'league_game:1', program: 'league', teamId: null, ownerName: '2026 Fall House League', where: { venueId: 'kinsmen', venueName: 'Kinsmen Park', facility: 'Diamond B', address: null, text: null } });
  const away = booking({ key: 'rep_event:2', teamId: 't14', ownerName: '14U AA', where: { venueId: null, venueName: null, facility: null, address: null, text: 'Eastview Park' } });
  const all = [lions, kinsmen, away];

  it('Venue lists the club’s venues by their current names, then the places the club doesn’t own', () => {
    const o = filterOptions(all, new Map([['lions', 'Lions Park'], ['kinsmen', 'Kinsmen Park']]));
    assert.deepEqual(o.venues.map(v => [v.label, v.count]), [['Kinsmen Park', 1], ['Lions Park', 1], [CALENDAR_WORDS.elsewhere, 1]]);
  });
  it('Program and Team narrow; a Team filter keeps only that team’s bookings', () => {
    assert.deepEqual(all.filter(b => matchesFilters(b, { ...NO_FILTERS, programs: new Set(['league'] as const) })).map(b => b.key), ['league_game:1']);
    assert.deepEqual(all.filter(b => matchesFilters(b, { ...NO_FILTERS, teams: new Set(['t14']) })).map(b => b.key), ['rep_event:2']);
    assert.deepEqual(all.filter(b => matchesFilters(b, { ...NO_FILTERS, venues: new Set([ELSEWHERE]) })).map(b => b.key), ['rep_event:2']);
  });
});

describe('one clock: ranges, days and times in the org zone', () => {
  it('Week and List read Monday–Sunday; Month its calendar month', () => {
    assert.deepEqual(rangeFor('week', '2026-11-04'), { from: '2026-11-02', to: '2026-11-08' });
    assert.deepEqual(rangeFor('list', '2026-11-08'), { from: '2026-11-02', to: '2026-11-08' });
    assert.deepEqual(rangeFor('month', '2026-11-17'), { from: '2026-11-01', to: '2026-11-30' });
    assert.deepEqual(rangeFor('month', '2026-02-10'), { from: '2026-02-01', to: '2026-02-28' });
  });
  it('the arrows step a week, or a month', () => {
    assert.equal(stepCursor('week', '2026-11-04', 1), '2026-11-11');
    assert.equal(stepCursor('month', '2026-11-17', -1), '2026-10-01');
    assert.equal(stepCursor('month', '2026-12-17', 1), '2027-01-01');
  });
  it('the range says itself as drawn', () => {
    assert.equal(rangeWords('week', '2026-11-04'), 'Nov 2 – 8, 2026');
    assert.equal(rangeWords('week', '2026-10-28'), 'Oct 26 – Nov 1, 2026');
    assert.equal(rangeWords('week', '2026-12-30'), 'Dec 28, 2026 – Jan 3, 2027');
    assert.equal(rangeWords('month', '2026-11-17'), 'November 2026');
    assert.equal(rangeWordsShort('week', '2026-11-04'), 'Nov 2 – 8');
  });
  it('Month is Monday-first, padded to whole weeks', () => {
    const cells = monthCells('2026-11-01');
    assert.equal(cells.length % 7, 0);
    assert.deepEqual(cells.slice(0, 7), [null, null, null, null, null, null, '2026-11-01']);
    assert.deepEqual(weekDays('2026-11-01'), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });
  it('a time reads the house clock; no stored end is its start alone; an untimed tournament day is All day', () => {
    assert.equal(timeWords(booking({ key: 'a' })), '6:00–8:00 p.m.');
    assert.equal(timeWords(booking({ key: 'b', hasEnd: false })), '6:00 p.m.');
    assert.equal(timeWords(booking({ key: 'c', allDay: true })), 'All day');
  });
});

describe('where: the club’s venue and the sport’s word; a team’s own place as it is', () => {
  it('a bare facility code takes the sport’s noun — Diamond for softball, Court for basketball', () => {
    assert.equal(whereWords(booking({ key: 'a', where: { venueId: 'v', venueName: 'Lions Park', facility: '2', address: null, text: null } })), 'Lions Park · Diamond 2');
    assert.equal(whereWords(booking({ key: 'b', sport: 'basketball', where: { venueId: 'v', venueName: 'Westfield Gym', facility: '2', address: null, text: null } })), 'Westfield Gym · Court 2');
  });
  it('a named facility is said as named; a place the club doesn’t own is never rewritten', () => {
    assert.equal(whereWords(booking({ key: 'a' })), 'Lions Park · Diamond 2');
    assert.equal(whereWords(booking({ key: 'b', where: { venueId: null, venueName: null, facility: null, address: null, text: 'Eastview Park' } })), 'Eastview Park');
  });
});

describe('the clash words and the export hold what the page shows', () => {
  const b = booking({ key: 'rep_event:13', clash: 'booked_by', clashesWith: [{ ...other('rep_event:14'), label: '14U AA practice' }] });
  it('the List says the clash once, under the place', () => {
    assert.equal(clashLineWords(b), 'Clashes with 14U AA practice');
    assert.equal(clashLineWords(booking({ key: 'x' })), null);
  });
  it('Excel/CSV rows carry the org-zone date, the house clock and the clash', () => {
    const [row] = exportRows([b]);
    assert.deepEqual(row, { date: '2026-11-03', time: '6:00–8:00 p.m.', program: 'Rep teams', who: '13U AAA', what: 'Practice', venue: 'Lions Park', facility: 'Diamond 2', clash: 'Clashes with 14U AA practice' });
  });
  it('the Calendar file anchors each booking in UTC', () => {
    const [e] = icsEntries([b]);
    assert.equal(e.startsAtIso, new Date(at('2026-11-03', '18:00')).toISOString());
    assert.equal(e.location, 'Lions Park · Diamond 2');
  });
  it('Export’s one line names the range, the filters and the count', () => {
    assert.equal(CALENDAR_WORDS.exportHolds('Nov 2 – 8, 2026', ['Lions Park'], 8), 'Nov 2 – 8, 2026 · Lions Park · 8 bookings, as shown');
  });
});

describe('findClashPairs — 6a’s one rule over a week, each pair once', () => {
  const rep = (id: string, team: string, from: string, to: string, facility: string | null) => repEventBooking(
    { id, team_id: team, event_type: 'practice', starts_at: zonedWallClockToUtc('2026-11-03', from), ends_at: zonedWallClockToUtc('2026-11-03', to), status: 'scheduled', org_venue_id: 'lions', org_venue_facility_id: facility },
    { team },
  )!;
  it('two teams on one diamond at once is one booked_by pair; two diamonds in one park are none', () => {
    const pairs = findClashPairs([rep('13', 't13', '18:00', '20:00', 'd2'), rep('14', 't14', '17:30', '19:30', 'd2'), rep('15', 't15', '18:00', '20:00', 'd1')]);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].kind, 'booked_by');
    assert.deepEqual([pairs[0].a.key, pairs[0].b.key].sort(), ['rep_event:13', 'rep_event:14']);
  });
  it('a facility unset on one side is busy then; touching ends are not a clash; a team never clashes with itself', () => {
    assert.equal(findClashPairs([rep('12', 't12', '18:00', '19:30', null), rep('13', 't13', '18:00', '20:00', 'd2')])[0].kind, 'busy_then');
    assert.equal(findClashPairs([rep('a', 't13', '18:00', '19:00', 'd2'), rep('b', 't14', '19:00', '20:00', 'd2')]).length, 0);
    assert.equal(findClashPairs([rep('a', 't13', '18:00', '19:00', 'd2'), rep('b', 't13', '18:30', '20:00', 'd2')]).length, 0);
  });
  it('a rep practice and a house-league game on Kinsmen B clash across programs', () => {
    const practice = repEventBooking({ id: '11', team_id: 't11', event_type: 'practice', starts_at: zonedWallClockToUtc('2026-11-03', '18:00'), ends_at: zonedWallClockToUtc('2026-11-03', '19:30'), status: 'scheduled', org_venue_id: 'kinsmen', org_venue_facility_id: 'b' }, { team: '11U AA' })!;
    const game = leagueBooking({ id: 'g', kind: 'game', scheduled_at: zonedWallClockToUtc('2026-11-03', '18:00'), ends_at: null, status: 'scheduled', org_venue_id: 'kinsmen', org_venue_facility_id: 'b' }, { season: '2026 Fall House League' })!;
    assert.equal(findClashPairs([practice, game]).length, 1);
  });
});
