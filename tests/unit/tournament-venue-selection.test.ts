import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveVenueSelectionFromCatalog,
  type TournamentVenueCatalog,
} from '../../lib/tournament-venue-selection.ts';
import { formatVenueLocation } from '../../lib/venue-label.ts';

const catalog: TournamentVenueCatalog = {
  tournamentId: 'tournament-1',
  venues: new Map([
    ['venue-1', { id: 'venue-1', name: 'Lions Park' }],
    ['venue-2', { id: 'venue-2', name: 'Community Park' }],
  ]),
  facilities: new Map([
    ['facility-1', { id: 'facility-1', venueId: 'venue-1', name: 'Diamond 1' }],
    ['facility-2', { id: 'facility-2', venueId: 'venue-1', name: 'Diamond 2' }],
    ['facility-3', { id: 'facility-3', venueId: 'venue-2', name: 'Diamond 1' }],
  ]),
};

describe('formatVenueLocation — the one display string', () => {
  it('renders "Venue — Facility" with an em dash, venue alone otherwise', () => {
    assert.equal(formatVenueLocation('Lions Park', 'Diamond 2'), 'Lions Park — Diamond 2');
    assert.equal(formatVenueLocation('Lions Park'), 'Lions Park');
    assert.equal(formatVenueLocation('Lions Park', null), 'Lions Park');
  });
});

describe('tournament venue selection — picked references', () => {
  it('derives the display string from venue + facility, never trusting client text', () => {
    const result = resolveVenueSelectionFromCatalog(catalog, {
      venueId: 'venue-1',
      venueFacilityId: 'facility-2',
      locationText: 'whatever the client typed',
    });
    assert.ok(result.ok);
    assert.deepEqual(result.value, {
      venueId: 'venue-1',
      venueFacilityId: 'facility-2',
      location: 'Lions Park — Diamond 2',
    });
  });

  it('accepts a venue without a surface and derives the venue name', () => {
    const result = resolveVenueSelectionFromCatalog(catalog, { venueId: 'venue-1' });
    assert.ok(result.ok);
    assert.deepEqual(result.value, {
      venueId: 'venue-1',
      venueFacilityId: null,
      location: 'Lions Park',
    });
  });

  it('resolves a facility alone through its parent venue', () => {
    const result = resolveVenueSelectionFromCatalog(catalog, { venueFacilityId: 'facility-3' });
    assert.ok(result.ok);
    assert.deepEqual(result.value, {
      venueId: 'venue-2',
      venueFacilityId: 'facility-3',
      location: 'Community Park — Diamond 1',
    });
  });
});

describe('tournament venue selection — the explicit "somewhere else" path', () => {
  it('passes typed text through, trimmed, when nothing is picked', () => {
    const result = resolveVenueSelectionFromCatalog(catalog, { locationText: '  Riverside School Gym  ' });
    assert.ok(result.ok);
    assert.deepEqual(result.value, {
      venueId: null,
      venueFacilityId: null,
      location: 'Riverside School Gym',
    });
  });

  it('treats an explicit clear (nulls and empty strings alike) as fully unplaced', () => {
    for (const empty of [{}, { venueId: null, venueFacilityId: null }, { venueId: '', venueFacilityId: '', locationText: '' }]) {
      const result = resolveVenueSelectionFromCatalog(catalog, empty);
      assert.ok(result.ok);
      assert.deepEqual(result.value, { venueId: null, venueFacilityId: null, location: null });
    }
  });
});

describe('tournament venue selection — refusals (multi-tenant wall)', () => {
  it('refuses a venue id the tournament does not own — a foreign org reads as not found', () => {
    const result = resolveVenueSelectionFromCatalog(catalog, { venueId: 'someone-elses-venue' });
    assert.equal(result.ok, false);
  });

  it('refuses a facility id the tournament does not own', () => {
    const result = resolveVenueSelectionFromCatalog(catalog, { venueId: 'venue-1', venueFacilityId: 'foreign-facility' });
    assert.equal(result.ok, false);
  });

  it('refuses a facility that belongs to a different venue than the one picked', () => {
    const result = resolveVenueSelectionFromCatalog(catalog, { venueId: 'venue-2', venueFacilityId: 'facility-1' });
    assert.equal(result.ok, false);
  });
});
