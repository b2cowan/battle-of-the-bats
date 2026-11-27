import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nightPlaces, seasonCalendar, type SeasonPlace } from '../../lib/league-season-calendar.ts';
import { whereWords } from '../../lib/club-calendar-view.ts';
import { findNextLine } from '../../lib/house-league-find.ts';
import { leagueIssueWords, type LeagueHealthIssue } from '../../lib/league-schedule-health.ts';
import { fieldPartName, parkFieldWords, withoutPartWords } from '../../lib/field-parts.ts';
import { readCode } from './_source-code.ts';
import { emailChangeLine, placeTextOf, publishedLine } from '../../lib/league-schedule-email.ts';
import type { GameSnapshot } from '../../lib/league-game-changes.ts';
import type { LeagueGame, LeaguePractice } from '../../lib/types.ts';

/**
 * CLUB SCHEDULES STAGE 2, SESSION 2E PART 2 — EVERY HOUSE-LEAGUE PLACE WORD CARRIES THE PART (round 2 tab 8): "Milton
 * Sports Dome · Field 1, side A". The part joins the field with a comma, read at read time from (mask, the field's split).
 * With no split field every word reads exactly as before (the 2B rule).
 */

const DOME = 'v-dome', F1 = 'f-1', F3 = 'f-3';
const SIDE_A = 3, SIDE_B = 12;
const at = '2027-01-10T14:00:00.000Z';
const fields: Record<string, { name: string; sections?: number }> = { [F1]: { name: 'Field 1', sections: 2 }, [F3]: { name: 'Field 3' } };
const placeOf = (_v: string, f: string | null): SeasonPlace => ({
  venue: 'Milton Sports Dome', facility: f ? fields[f]?.name ?? null : null, address: null, ...(f && fields[f]?.sections ? { sections: fields[f].sections } : {}),
});
const game = (id: string, facility: string, sectionMask?: number): LeagueGame => ({
  id, seasonId: 's', divisionId: 'u9', homeTeamId: 'reds', awayTeamId: 'blues', scheduledAt: at, endsAt: null, status: 'scheduled',
  orgVenueId: DOME, orgVenueFacilityId: facility, ...(sectionMask ? { sectionMask } : {}), location: null, homeScore: null, awayScore: null,
} as unknown as LeagueGame);
const practice = (id: string, teamId: string, facility: string, sectionMask?: number): LeaguePractice => ({
  id, seasonId: 's', divisionId: 'u9', teamId, scheduledAt: at, endsAt: null, status: 'scheduled',
  orgVenueId: DOME, orgVenueFacilityId: facility, ...(sectionMask ? { sectionMask } : {}), location: null, clubScheduleSlotId: null,
} as unknown as LeaguePractice);
const cal = (games: LeagueGame[], practices: LeaguePractice[] = []) => seasonCalendar({
  seasonName: 'Winter', sport: 'soccer', games, practices, placeOf,
  teamName: new Map([['reds', 'Reds'], ['blues', 'Blues'], ['t2', 'Greens']]), divisionName: new Map([['u9', 'U9']]),
});

describe('The season calendar (admin, public schedule page, Find) says the part', () => {
  it('a side-A game reads "Milton Sports Dome · Field 1, side A"', () => {
    const [b] = cal([game('g1', F1, SIDE_A)]).bookings;
    assert.equal(b.where.part, 'side A');
    assert.equal(whereWords(b), 'Milton Sports Dome · Field 1, side A');
  });

  it('no split field: the place has no `part` key and reads as before', () => {
    const [b] = cal([game('g1', F3)]).bookings;
    assert.equal('part' in b.where, false);
    assert.equal(whereWords(b), 'Milton Sports Dome · Field 3');
  });

  it('a practice night keeps side A and side B as two places', () => {
    const { bookings } = cal([], [practice('p1', 'reds', F1, SIDE_A), practice('p2', 't2', F1, SIDE_B)]);
    assert.deepEqual(nightPlaces({ practices: bookings }).map(w => w.part).sort(), ['side A', 'side B']);
  });

  it('Find\'s next line names the part after the field', () => {
    const [b] = cal([game('g1', F1, SIDE_B)]).bookings;
    assert.equal(findNextLine('Reds', b), 'Reds’ next: Sun, Jan 10, 9:00 a.m. · Reds vs Blues · Milton Sports Dome, Field 1, side B');
    const [w] = cal([game('g1', F3)]).bookings;
    assert.equal(findNextLine('Reds', w), 'Reds’ next: Sun, Jan 10, 9:00 a.m. · Reds vs Blues · Milton Sports Dome, Field 3');
  });
});

describe('Schedule health\'s clash says the side both are on', () => {
  const ctx = {
    team: (id: string) => id, label: (k: string) => (k.endsWith('p1') ? 'Greens practice' : 'Reds vs Blues'), division: (d: string) => d,
    place: (_v: string, f: string | null, mask?: number) => `Milton Sports Dome · ${fieldPartName(fields[f!].name, mask, 2, ', ')}`,
  };
  const issue = (o: Partial<LeagueHealthIssue> = {}) => ({
    kind: 'clash', keys: ['league_game:g1', 'league_practice:p1'], venueId: DOME, facilityId: F1, day: '2027-01-10', startMs: Date.parse(at), ...o,
  }) as LeagueHealthIssue;

  it('two bookings on side A: "Field 1, side A is booked twice"', () => {
    assert.match(leagueIssueWords(issue({ sectionMask: SIDE_A } as Partial<LeagueHealthIssue>), ctx).text, /^Milton Sports Dome · Field 1, side A is booked twice/);
  });
  it('a side against the whole field (or no split): the field alone, as before', () => {
    assert.match(leagueIssueWords(issue(), ctx).text, /^Milton Sports Dome · Field 1 is booked twice/);
  });
});

describe('The family emails (published schedule and changes) say the part', () => {
  const places = {
    venues: new Map([[DOME, { name: 'Milton Sports Dome' }]]),
    facilities: new Map([[F1, 'Field 1'], [F3, 'Field 3']]),
    sections: new Map([[F1, 2 as const]]),
  };
  const placeOf = placeTextOf(places);
  const snap = (facilityId: string, sectionMask?: number): GameSnapshot => ({
    scheduledAt: at, endsAt: null, location: 'typed', venueId: DOME, facilityId, ...(sectionMask ? { sectionMask } : {}), status: 'scheduled', movedFrom: null,
  });

  it('a published line on side A, and the whole field exactly as before', () => {
    assert.match(publishedLine(snap(F1, SIDE_A), 'Reds vs Blues', placeOf), /Milton Sports Dome · Field 1, side A$/);
    assert.match(publishedLine(snap(F3), 'Reds vs Blues', placeOf), /Milton Sports Dome · Field 3$/);
    assert.equal(placeOf(snap(F1)), 'Milton Sports Dome · Field 1');
  });

  it('a side-only move names both sides (two different places)', () => {
    const line = emailChangeLine({ gameId: 'g1', kind: 'place', before: snap(F1, SIDE_A), now: snap(F1, SIDE_B), byClub: false, changeIds: [] }, 'Reds vs Blues', placeOf);
    assert.match(line ?? '', /Field 1, side B/);
    assert.match(line ?? '', /Field 1, side A/);
  });
});

describe('Stage 2 close: the part said once, from one home', () => {
  it('the club calendar reads a stored line\'s field without the part its writer joined on, and words the part once', () => {
    assert.equal(withoutPartWords('Field 1, side A'), 'Field 1');
    assert.equal(withoutPartWords('Field 1, quarter C'), 'Field 1');
    assert.equal(withoutPartWords('Field 1, quarters A–B'), 'Field 1');
    assert.equal(withoutPartWords('Field 1'), 'Field 1', 'a whole field reads as before');
    assert.equal(withoutPartWords('Diamond 2, North'), 'Diamond 2, North', 'only part words are taken off');
    // The house-league row: the stored line's field, the part from the row's own mask (before: "Field 1, side A, side A").
    const where = { venueId: 'v', venueName: 'Milton Sports Dome', facility: withoutPartWords('Field 1, side A'), part: 'side A', address: null, text: null };
    assert.equal(whereWords({ where, sport: null } as Parameters<typeof whereWords>[0]), 'Milton Sports Dome · Field 1, side A');
    assert.match(readCode('lib/club-calendar.ts'), /facility: withoutPartWords\(text\.slice\(at \+ VENUE_FACILITY_SEPARATOR\.length\)\)/);
  });
  it('parkFieldWords: the park and the field, the part after a comma; a whole or unsplit field as before', () => {
    assert.equal(parkFieldWords('Milton Sports Dome', 'Field 1', 3, 2), 'Milton Sports Dome · Field 1, side A');
    assert.equal(parkFieldWords('Milton Sports Dome', 'Field 1', 0, 2), 'Milton Sports Dome · Field 1');
    assert.equal(parkFieldWords('Milton Sports Dome', 'Field 1', 0, 1), 'Milton Sports Dome · Field 1');
    assert.equal(parkFieldWords('Milton Sports Dome', null, 3, 2), 'Milton Sports Dome', 'no field: the park alone, no part');
    assert.equal(parkFieldWords(null, 'Field 1', 12, 2), 'Field 1, side B');
    assert.equal(parkFieldWords(undefined, undefined, 0, 1), '');
  });
});
