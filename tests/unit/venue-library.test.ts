/**
 * THE VENUE LIBRARY's rules (Club Tier Stage 6b, Ask 9 — `lib/venue-library.ts`) and the one read-back that keeps an
 * ARCHIVED venue's booking whole (`whereOfLibraryRow`): archived venues leave every picker and keep every booking, so an
 * edit of a house-league game standing on one must not drop its facility link.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NO_USAGE, VENUE_LIBRARY_WORDS, archiveQuestion, bookedSentence, facilitiesCell, canSaveVenueLibrary, deleteQuestion,
  bookingsEmailProblem, duplicateFacilityName, seasonUseWords, tournamentUseWords, type VenueUsage,
} from '../../lib/venue-library.ts';
import { whereLibraryBody, whereOfLibraryRow } from '../../lib/where-field.ts';
import { formatVenueLocation } from '../../lib/venue-label.ts';

describe('who saves (Ask 9): the people who schedule a program', () => {
  it('the owner, an admin and a league admin save; so does anyone granted the tournament permission', () => {
    assert.equal(canSaveVenueLibrary('owner', null), true);
    assert.equal(canSaveVenueLibrary('admin', null), true);
    assert.equal(canSaveVenueLibrary('league_admin', null), true, 'the league admin house league sends here — refused before 6b (D02)');
    assert.equal(canSaveVenueLibrary('staff', { create_tournaments: true }), true);
  });
  it('a treasurer, a registrar, staff and a coach read', () => {
    for (const role of ['treasurer', 'league_registrar', 'staff', 'official', 'coach']) {
      assert.equal(canSaveVenueLibrary(role, null), false, role);
    }
    assert.equal(canSaveVenueLibrary(null, null), false);
  });
});

const usage = (over: Partial<VenueUsage>): VenueUsage => ({ ...NO_USAGE, ...over });

describe('Booked by this season, in words', () => {
  it('the phone row says it as a sentence, never a dotted line', () => {
    assert.equal(bookedSentence(usage({
      teams: ['11U AA', '12U AA', '13U AAA', '14U AA', '15U AA', '15U AAA'],
      seasons: [{ id: 's', name: '2026 Fall House League', games: 24, practices: 0 }],
      tournaments: [{ id: 't', name: 'UAT Rep Club Invitational 2026', games: 12 }],
    })), 'Booked by 6 teams, house league and 1 tournament');
    assert.equal(bookedSentence(usage({ teams: ['13U AAA'] })), 'Booked by 1 team');
    assert.equal(bookedSentence(NO_USAGE), 'Nothing booked this season');
    assert.equal(bookedSentence(undefined), 'Nothing booked this season');
  });
  it('the Facilities cell: a count in the venue’s own word, the names under it, four then "and N more"', () => {
    const f = (name: string, facilityType: string, displayOrder: number) => ({ id: name, name, facilityType, displayOrder });
    assert.deepEqual(facilitiesCell([f('Diamond 2', 'diamond', 2), f('Diamond 1', 'diamond', 1)]), { count: '2 diamonds', names: 'Diamond 1, Diamond 2' });
    assert.deepEqual(facilitiesCell([f('Centre Court', 'court', 1)]), { count: '1 court', names: 'Centre Court' });
    assert.equal(facilitiesCell([f('A', 'diamond', 1), f('Cage', 'other', 2)])?.count, '2 facilities');
    assert.equal(facilitiesCell([f('A', 'other', 1)])?.count, '1 facility');
    assert.equal(facilitiesCell(['A', 'B', 'C', 'D'].map((n, i) => f(n, 'field', i)))?.names, 'A, B, C, D');
    assert.equal(facilitiesCell(['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => f(n, 'field', i)))?.names, 'A, B, C, D and 2 more');
    assert.equal(facilitiesCell([]), null);
  });
  it('a season and a tournament say their games', () => {
    assert.equal(seasonUseWords({ games: 24, practices: 0 }), '24 games');
    assert.equal(seasonUseWords({ games: 0, practices: 3 }), '3 practices');
    assert.equal(seasonUseWords({ games: 1, practices: 1 }), '1 game, 1 practice');
    assert.equal(tournamentUseWords({ games: 0 }), 'not scheduled yet');
  });
});

describe('Archive when anything books it; Delete only when nothing does', () => {
  it('Archive names this season’s bookers, then says what it does', () => {
    const q = archiveQuestion('Lions Park', usage({
      anyBooking: true, teams: ['13U AAA', '14U AA'],
      seasons: [{ id: 's', name: '2026 Fall House League', games: 24, practices: 0 }],
      tournaments: [{ id: 't', name: 'UAT Rep Club Invitational 2026', games: 12 }],
    }));
    assert.equal(q.title, 'Archive Lions Park?');
    assert.equal(q.who, '2 teams, 2026 Fall House League and UAT Rep Club Invitational 2026 book it.');
    assert.match(q.what, /out of every picker\. Existing bookings keep it/);
    assert.match(q.what, /You can bring it back\./);
  });
  it('with nothing this season, past bookings still hold it — named as before', () => {
    assert.equal(archiveQuestion('Kinsmen Park', usage({ anyBooking: true, everTeams: ['11U AA'], everSeasons: ['2025 Fall House League'] })).who,
      '11U AA and 2025 Fall House League booked it before.');
  });
  it('Delete asks, and says nothing would be lost', () => {
    assert.deepEqual(deleteQuestion('Westfield School'), { title: 'Delete Westfield School?', body: 'Nothing has ever booked it. It leaves the library for good.' });
  });
  it('two facilities can’t share a name (case and spacing folded)', () => {
    assert.equal(duplicateFacilityName(['Diamond 1', 'diamond  1']), 'diamond  1');
    assert.equal(duplicateFacilityName(['Diamond 1', 'Diamond 2', '']), null);
  });
  it('the lede names every program (/marketing words it)', () => {
    assert.match(VENUE_LIBRARY_WORDS.lede, /Teams, house league and tournaments book them/);
  });
});

describe('an archived venue keeps its bookings whole through an edit', () => {
  const active = [{ id: 'kinsmen', name: 'Kinsmen Park', address: '200 Kinsmen Way', facilities: [{ id: 'b', name: 'Diamond B' }] }];
  it('a venue the list still carries reads from the list', () => {
    const w = whereOfLibraryRow({ orgVenueId: 'kinsmen', orgVenueFacilityId: 'b', location: 'Kinsmen Park — Diamond B' }, active);
    assert.deepEqual([w.source, w.location, w.fieldNumber, w.orgVenueFacilityId], ['club', 'Kinsmen Park', 'Diamond B', 'b']);
  });
  it('an ARCHIVED venue (gone from the list) keeps BOTH links, its words read back from the booking', () => {
    const w = whereOfLibraryRow({ orgVenueId: 'lions', orgVenueFacilityId: 'd2', location: formatVenueLocation('Lions Park', 'Diamond 2') }, active);
    assert.deepEqual([w.source, w.location, w.fieldNumber, w.orgVenueId, w.orgVenueFacilityId], ['club', 'Lions Park', 'Diamond 2', 'lions', 'd2']);
    // …and the save sends both links back: the facility is not dropped.
    assert.deepEqual(whereLibraryBody(w), { orgVenueId: 'lions', orgVenueFacilityId: 'd2', location: null });
  });
  it('the split is at the LAST separator, and the links never come from the words', () => {
    // A venue whose own name holds the separator still reads whole; whatever the words, both ids are the booking's own.
    const w = whereOfLibraryRow({ orgVenueId: 'v', orgVenueFacilityId: 'f', location: formatVenueLocation('Lions Park — North', 'Diamond 1') }, active);
    assert.deepEqual([w.location, w.fieldNumber, w.orgVenueId, w.orgVenueFacilityId], ['Lions Park — North', 'Diamond 1', 'v', 'f']);
  });
  it('an archived venue with no facility reads its one line as the venue', () => {
    const w = whereOfLibraryRow({ orgVenueId: 'lions', orgVenueFacilityId: null, location: 'Lions Park' }, active);
    assert.deepEqual([w.location, w.fieldNumber, w.orgVenueFacilityId], ['Lions Park', '', null]);
  });
});

describe('the bookings contact is an email or nothing (Club Tier 10a)', () => {
  it('blank says nothing; an address passes, spaces trimmed', () => {
    assert.equal(bookingsEmailProblem(''), null);
    assert.equal(bookingsEmailProblem(null), null);
    assert.equal(bookingsEmailProblem('  bookings@lionspark.ca '), null);
  });
  it('anything that is not one address is held, in words', () => {
    for (const bad of ['bookings', 'bookings@lionspark', 'a b@lionspark.ca', 'one@x.ca, two@x.ca', `${'a'.repeat(250)}@x.ca`]) {
      assert.equal(bookingsEmailProblem(bad), 'Enter the bookings contact as an email address.', bad);
    }
  });
});
