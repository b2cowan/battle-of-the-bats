import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { placeNamer } from '../../lib/house-league-coach-place.ts';
import { asLastSent, type HeldChange } from '../../lib/league-game-changes.ts';
import { teamFeedEntries } from '../../lib/export/team-feed-words.ts';
import { leagueEntries } from '../../lib/family-league-entries.ts';
import type { FieldSections } from '../../lib/field-parts.ts';

/**
 * CLUB SCHEDULES STAGE 2, SESSION 2E PART 2 — THE HOUSE-LEAGUE COACH AND THE FAMILY SAY THE PART. A game on side A reads
 * "Maple Grove Park · Diamond 2, side A" on the coach's page, the coach's calendar and the family pages (all one place
 * string, `placeNamer`); a game on a whole field reads byte-for-byte as before parts.
 */

const places = {
  venues: new Map([['v-1', { name: 'Maple Grove Park' }]]),
  facilities: new Map([['f-1', 'Diamond 2'], ['f-2', 'Diamond 3']]),
  sections: new Map<string, FieldSections>([['f-1', 2]]),
};
const base = { orgVenueId: 'v-1', orgVenueFacilityId: 'f-1', location: 'typed' };

describe('placeNamer (the coach page, the coach calendar and the family pages)', () => {
  const name = placeNamer(places);
  it('names a side with a comma, never a second dot', () => {
    assert.equal(name({ ...base, sectionMask: 3 }), 'Maple Grove Park · Diamond 2, side A');
    assert.equal(name({ ...base, sectionMask: 12 }), 'Maple Grove Park · Diamond 2, side B');
  });
  it('a whole field reads exactly as before parts', () => {
    assert.equal(name(base), 'Maple Grove Park · Diamond 2');
    assert.equal(name({ ...base, sectionMask: 0 }), 'Maple Grove Park · Diamond 2');
  });
  it('a mask the current split does not offer reads in quarter words', () => {
    assert.equal(name({ ...base, orgVenueFacilityId: 'f-2' }), 'Maple Grove Park · Diamond 3');
    // A mask the field's current split does not offer reads in quarter words (a booking made before the split changed).
    assert.equal(name({ ...base, orgVenueFacilityId: 'f-2', sectionMask: 3 }), 'Maple Grove Park · Diamond 3, quarters A–B');
  });
  it('the venue alone, and a typed place, are unchanged', () => {
    assert.equal(name({ orgVenueId: 'v-1', orgVenueFacilityId: null, location: null, sectionMask: 3 }), 'Maple Grove Park');
    assert.equal(name({ orgVenueId: null, orgVenueFacilityId: null, location: 'Back lot' }), 'Back lot');
    assert.equal(name({ orgVenueId: null, orgVenueFacilityId: null, location: null }), null);
  });
  it('a game as families last heard it names the part they heard', () => {
    const game = { id: 'g1', scheduledAt: '2027-05-01T14:00:00Z', endsAt: null, ...base, sectionMask: 12, status: 'scheduled' as const, movedFrom: null };
    const held: HeldChange[] = [{
      gameId: 'g1', before: { scheduledAt: game.scheduledAt, endsAt: null, location: 'typed', venueId: 'v-1', facilityId: 'f-1', sectionMask: 3, status: 'scheduled', movedFrom: null },
    } as unknown as HeldChange];
    const [heard] = asLastSent([game], held);
    assert.equal(name(heard), 'Maple Grove Park · Diamond 2, side A');
    const [whole] = asLastSent([{ ...game, sectionMask: undefined }], []);
    assert.equal('sectionMask' in whole, false);
  });
});

describe('the place string reaches the feed and the family list unchanged', () => {
  const ev = (location: string) => ({
    id: 'g1', name: 'Royals', eventType: 'league_game', opponent: 'Royals', homeAway: 'home', startsAt: '2027-05-01T14:00:00Z', endsAt: null,
    arrivalTime: null, location, locationAddress: null, fieldNumber: null, status: 'scheduled',
  });
  it('the calendar entry says the part', () => {
    const [e] = teamFeedEntries({ teamName: 'Jays', sport: 'baseball', reader: 'coach', events: [ev('Maple Grove Park · Diamond 2, side A')] });
    assert.equal(e.location, 'Maple Grove Park · Diamond 2, side A');
  });
  it('the family entry carries the place and no part key of its own', () => {
    const [e] = leagueEntries([ev('Maple Grove Park · Diamond 2, side A')], Date.parse('2027-04-01T00:00:00Z'));
    assert.equal(e.location, 'Maple Grove Park · Diamond 2, side A');
    assert.equal('sectionMask' in e, false);
  });
});

describe('the readers select the part', () => {
  const src = readFileSync(new URL('../../lib/house-league-coach.ts', import.meta.url), 'utf8');
  it('the scores and the games-as-sent reads select section_mask and pass it on', () => {
    assert.equal((src.match(/org_venue_facility_id, section_mask, status/g) ?? []).length, 2);
    assert.match(src, /\.\.\.maskProp\(r\.section_mask\)/g);
  });
});
