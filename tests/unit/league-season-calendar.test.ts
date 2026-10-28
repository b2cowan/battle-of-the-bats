import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { foldNights, gameSlotOf, resultWords, seasonCalendar, seasonWeeks, todayLineAt, type SeasonCalendarInput, type SeasonGameSlot } from '../../lib/league-season-calendar.ts';
import type { LeagueGame, LeaguePractice } from '../../lib/types.ts';

/**
 * HOUSE LEAGUE STAGE 9d-2a — THE SEASON'S SCHEDULE AS THE CALENDAR'S BOOKINGS (frames b1–b4). A postponed game leaves its
 * week for "Needs a new date"; a cancelled one stays, struck; "Time from" only on an exact slot; a night of practices folds.
 */

const at = (day: string, clock: string) => new Date(`${day}T${clock}:00-04:00`).toISOString();
function game(id: string, over: Partial<LeagueGame> = {}): LeagueGame {
  return {
    id, seasonId: 's1', divisionId: 'd1', homeTeamId: 'red', awayTeamId: 'blue',
    scheduledAt: at('2027-06-15', '18:00'), endsAt: at('2027-06-15', '19:30'),
    orgVenueId: 'v1', orgVenueFacilityId: 'f1', location: 'Maple Grove Park — Diamond 1',
    homeScore: null, awayScore: null, status: 'scheduled', notes: null, createdAt: '', updatedAt: '', ...over,
  };
}
function practice(id: string, teamId: string, clock: string, over: Partial<LeaguePractice> = {}): LeaguePractice {
  return {
    id, seasonId: 's1', divisionId: 'd1', teamId, scheduledAt: at('2027-06-14', clock), endsAt: null,
    orgVenueId: 'v1', orgVenueFacilityId: 'f1', location: null, notes: null, status: 'scheduled', recurrenceGroupId: null,
    clubScheduleSlotId: null, createdAt: '', updatedAt: '', ...over,
  };
}
const slot: SeasonGameSlot = {
  slotId: 'slot1', divisionId: 'd1', startsAt: at('2027-06-15', '18:00'), venueId: 'v1', facilityId: 'f1',
  scheduleId: 'sch1', scheduleName: 'Maple Grove · summer 2027',
};
const base = (over: Partial<SeasonCalendarInput> = {}): SeasonCalendarInput => ({
  seasonName: 'Draft Test 2027', sport: 'baseball', games: [], practices: [],
  teamName: new Map([['red', 'Red Sox'], ['blue', 'Blue Jays'], ['cards', 'Cardinals']]),
  divisionName: new Map([['d1', 'U12 Division']]),
  placeOf: (v, f) => (v === 'v1' ? { venue: 'Maple Grove Park', facility: f === 'f1' ? 'Diamond 1' : 'Diamond 2', address: '410 Maple Grove Rd' } : null),
  gameSlots: [slot], ...over,
});

describe('seasonCalendar', () => {
  it('a postponed game leaves its week for Needs a new date, keeping the date it had', () => {
    const c = seasonCalendar(base({ games: [game('g1'), game('g2', { status: 'postponed', scheduledAt: at('2027-06-12', '10:00') })] }));
    assert.deepEqual(c.bookings.map(b => b.key), ['league_game:g1']);
    assert.deepEqual(c.needsDate.map(b => b.key), ['league_game:g2']);
    assert.equal(c.needsDate[0].day, '2027-06-12');
    assert.equal(c.needsDate[0].state, 'postponed');
  });

  it('a game with no date waits there too', () => {
    const c = seasonCalendar(base({ games: [game('g1', { scheduledAt: null, endsAt: null })] }));
    assert.equal(c.bookings.length, 0);
    assert.equal(c.needsDate.length, 1);
  });

  it('a cancelled game stays in its week, with its word; a played one says its result', () => {
    const c = seasonCalendar(base({ games: [
      game('g1', { status: 'cancelled' }),
      game('g2', { status: 'completed', homeScore: 7, awayScore: 4, scheduledAt: at('2027-06-16', '18:00'), endsAt: null }),
    ] }));
    assert.equal(c.bookings[0].state, 'cancelled');
    assert.equal(c.bookings[1].result, 'Final 7–4');
    assert.equal(c.bookings[1].state, null);
    assert.equal(c.bookings[1].hasEnd, false);
  });

  it('names who, the division and the club venue by its current words; a typed place as typed', () => {
    const c = seasonCalendar(base({ games: [game('g1'), game('g2', { orgVenueId: null, orgVenueFacilityId: null, location: 'Eastview School', scheduledAt: at('2027-06-17', '18:00') })] }));
    assert.equal(c.bookings[0].who, 'Red Sox vs Blue Jays');
    assert.equal(c.bookings[0].what, 'U12 Division');
    assert.deepEqual(c.bookings[0].where, { venueId: 'v1', venueName: 'Maple Grove Park', facility: 'Diamond 1', address: '410 Maple Grove Rd', text: null });
    assert.deepEqual(c.bookings[1].where, { venueId: null, venueName: null, facility: null, address: null, text: 'Eastview School' });
  });

  it('carries the server\'s clash and permit reads by key, and never a clash on a postponed game', () => {
    const clash = { clash: 'booked_by' as const, clashesWith: [] };
    const c = seasonCalendar(base({
      games: [game('g1'), game('g2', { status: 'postponed' })],
      clashes: new Map([['league_game:g1', clash], ['league_game:g2', clash]]),
    }));
    assert.equal(c.bookings[0].clash, 'booked_by');
    assert.equal(c.needsDate[0].clash, null);
  });
});

describe('Time from {schedule}', () => {
  it('only on the exact slot: same division, start and facility', () => {
    assert.equal(gameSlotOf(game('g1'), [slot])?.slotId, 'slot1');
    assert.equal(gameSlotOf(game('g1', { scheduledAt: at('2027-06-15', '18:30') }), [slot]), null, 'moved by hand');
    assert.equal(gameSlotOf(game('g1', { orgVenueFacilityId: 'f2' }), [slot]), null, 'another facility');
    assert.equal(gameSlotOf(game('g1', { divisionId: 'd2' }), [slot]), null, 'another division\'s time');
    assert.equal(gameSlotOf(game('g1', { orgVenueId: null }), [slot]), null, 'a typed place');
  });

  it('a game says its schedule; one off every slot says nothing', () => {
    const c = seasonCalendar(base({ games: [game('g1'), game('g2', { scheduledAt: at('2027-06-15', '20:00') })] }));
    assert.equal(c.bookings[0].clubSchedule?.scheduleName, 'Maple Grove · summer 2027');
    assert.equal(c.bookings[1].clubSchedule, null);
  });

  it('a club practice says its own slot\'s schedule', () => {
    const c = seasonCalendar(base({
      practices: [practice('p1', 'red', '18:00', { clubScheduleSlotId: 'ps1' }), practice('p2', 'blue', '19:00')],
      practiceSchedule: new Map([['ps1', { scheduleId: 'sch1', scheduleName: 'Maple Grove · summer 2027' }]]),
      canOpenSchedules: true,
    }));
    assert.deepEqual(c.bookings[0].clubSchedule, { slotId: 'ps1', scheduleId: 'sch1', scheduleName: 'Maple Grove · summer 2027', canOpen: true });
    assert.equal(c.bookings[1].clubSchedule, null);
  });
});

describe('foldNights', () => {
  it('folds one division\'s practices on one day; a lone practice, a game and a cancelled practice stay rows', () => {
    const c = seasonCalendar(base({
      games: [game('g1', { scheduledAt: at('2027-06-14', '17:00'), endsAt: null })],
      practices: [
        practice('p1', 'red', '18:00'), practice('p2', 'blue', '19:00'), practice('p3', 'cards', '20:00', { status: 'cancelled' }),
        practice('p4', 'red', '18:00', { scheduledAt: at('2027-06-16', '18:00') }),
      ],
    }));
    const rows = foldNights(c.bookings);
    assert.deepEqual(rows.map(r => (r.kind === 'one' ? r.booking.key : r.key)), [
      'league_game:g1', 'night:2027-06-14|d1', 'league_practice:p3', 'league_practice:p4',
    ]);
    const night = rows[1];
    assert.ok(night.kind === 'night');
    assert.equal(night.practices.length, 2);
    assert.equal(night.startMs, Date.parse(at('2027-06-14', '18:00')));
    assert.equal(night.endMs, Date.parse(at('2027-06-14', '20:30')), 'the last practice\'s end (90 minutes when none is stored)');
  });
});

describe('resultWords', () => {
  it('needs both scores and a completed game', () => {
    assert.equal(resultWords({ status: 'completed', homeScore: 7, awayScore: 4 }), 'Final 7–4');
    assert.equal(resultWords({ status: 'completed', homeScore: 7, awayScore: null }), null);
    assert.equal(resultWords({ status: 'scheduled', homeScore: 7, awayScore: 4 }), null);
  });
});

describe('seasonWeeks and the today line (g1: the public schedule opens on this week)', () => {
  const b = (day: string) => ({ day });
  const days = ['2027-06-01', '2027-06-08', '2027-06-09', '2027-06-15', '2027-06-18', '2027-06-22'].map(b);
  it('folds the weeks before this one and opens on this week, Monday first', () => {
    const { earlier, ahead } = seasonWeeks(days, '2027-06-17');
    assert.deepEqual(earlier.map(w => w.monday), ['2027-05-31', '2027-06-07']);
    assert.deepEqual(ahead.map(w => w.monday), ['2027-06-14', '2027-06-21']);
    assert.equal(earlier[1].bookings.length, 2);
  });
  it('a Sunday belongs to the week before it', () => {
    assert.deepEqual(seasonWeeks([b('2027-06-20')], '2027-06-14').ahead.map(w => w.monday), ['2027-06-14']);
  });
  it('a week with nothing in it opens on the next week that has games', () => {
    const { earlier, ahead } = seasonWeeks([b('2027-06-01'), b('2027-06-22')], '2027-06-17');
    assert.equal(earlier.length, 1);
    assert.deepEqual(ahead.map(w => w.monday), ['2027-06-21']);
  });
  it('a season wholly behind today folds nothing: the whole season is the record', () => {
    const { earlier, ahead } = seasonWeeks(days, '2027-09-01');
    assert.equal(earlier.length, 0);
    assert.equal(ahead.length, 4);
  });
  it('the today line sits before the first booking on or after today, after the last when all are behind, and only in this week', () => {
    const { ahead } = seasonWeeks(days, '2027-06-17');
    assert.equal(todayLineAt(ahead[0], '2027-06-17'), 1, 'after Jun 15, before Jun 18');
    assert.equal(todayLineAt(ahead[0], '2027-06-15'), 0, 'a game today: the line heads it');
    assert.equal(todayLineAt(ahead[0], '2027-06-19'), 2, 'every game behind today: the line closes the week');
    assert.equal(todayLineAt(ahead[1], '2027-06-17'), null, 'not this week');
  });
});

describe('the public schedule (g1) reads every game and never a practice', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  it('reads every status (a cancelled game used to vanish — C6-04) and passes no practices', () => {
    const page = read('app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx');
    assert.match(page, /getSeasonGamesEveryStatus\(season\.id\)/);
    assert.match(page, /practices: \[\],/);
    assert.equal(page.match(/timesInZoneSentence\(\)/g)?.length, 1, 'the zone is said once');
    const db = read('lib/db.ts');
    const fn = db.slice(db.indexOf('export async function getSeasonGamesEveryStatus'), db.indexOf('export async function getOrgPlaceNames'));
    assert.doesNotMatch(fn, /\.neq\('status'|\.in\('status'|\.eq\('status'/);
  });
});
