import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveVenuePlacement,
  sourcesShareSurface,
  isPlaceholderLocation,
  normalizeLocationText,
  isPlaced,
  venueGroupKey,
  facilityGroupKey,
} from '../../lib/venue-identity.ts';

describe('venue-identity — placement resolution', () => {
  it('resolves at the finest granularity the row carries', () => {
    assert.equal(resolveVenuePlacement({ venueFacilityId: 'f1', venueId: 'v1' }).kind, 'facility');
    assert.equal(resolveVenuePlacement({ venueId: 'v1' }).kind, 'venue');
    assert.equal(resolveVenuePlacement({ scheduleFacilityLaneId: 'l1' }).kind, 'lane');
    assert.equal(resolveVenuePlacement({ location: 'Diamond 1' }).kind, 'text');
    assert.equal(resolveVenuePlacement({}).kind, 'none');
    assert.equal(resolveVenuePlacement(null).kind, 'none');
  });

  it('keeps the parent venue on a facility placement so mixed granularity can compare', () => {
    const p = resolveVenuePlacement({ venueFacilityId: 'f1', venueId: 'v1' });
    assert.equal(p.facilityId, 'f1');
    assert.equal(p.venueId, 'v1');
  });

  it('ignores a lane once a real venue has been resolved onto the row', () => {
    // Lane resolution back-fills venue + facility; the lane id left behind is residue.
    const p = resolveVenuePlacement({ scheduleFacilityLaneId: 'l1', venueId: 'v1' });
    assert.equal(p.kind, 'venue');
    assert.equal(p.laneKey, null);
  });

  it('falls back to a draft lane label when the lane has no id yet', () => {
    const p = resolveVenuePlacement({ scheduleFacilityLaneLabel: 'Field 1' });
    assert.equal(p.kind, 'lane');
    assert.equal(p.laneKey, 'lane-label:field 1');
  });
});

describe('venue-identity — placeholder text (owner ruling R2)', () => {
  it('treats "no venue yet" markers as no field set, in any casing or punctuation', () => {
    const markers = [
      'TBD', 'tbd', ' Tbd ', 'T.B.D.', '(TBD)', 'TBA', 'tba',
      'N/A', 'n/a', 'NA', 'None', 'none', 'Unknown', 'nil', 'NULL',
      '-', '--', '—', '/', '   -   ',
    ];
    for (const value of markers) {
      assert.equal(isPlaceholderLocation(value), true, `${value} should be a placeholder`);
      assert.equal(resolveVenuePlacement({ location: value }).kind, 'none', `${value} should not place a game`);
    }
  });

  it('does not over-reach into strings that name a real place', () => {
    const realPlaces = [
      'Diamond 1', 'TBD Park', 'Field TBA 2', 'North TBD Complex',
      'Nathan Phillips Square', 'Nanaimo Field', 'None Such Park', 'Unknown Soldier Memorial Park',
    ];
    for (const value of realPlaces) {
      assert.equal(isPlaceholderLocation(value), false, `${value} should NOT be a placeholder`);
    }
  });

  it('never clashes two games sharing a "no venue yet" marker', () => {
    // Two unrelated games both marked "N/A" are not double-booked — and must never be able to
    // block a save or reject an upload.
    assert.equal(sourcesShareSurface({ location: 'N/A' }, { location: 'n/a' }), false);
    assert.equal(sourcesShareSurface({ location: '-' }, { location: '-' }), false);
  });

  it('never lets two placeholder games clash with each other', () => {
    assert.equal(sourcesShareSurface({ location: 'TBD' }, { location: 'TBD' }), false);
  });
});

describe('venue-identity — text normalization is trim + case-fold only', () => {
  it('folds case and collapses whitespace', () => {
    assert.equal(normalizeLocationText('  Diamond   1 '), 'diamond 1');
    assert.equal(normalizeLocationText('DIAMOND 1'), 'diamond 1');
  });

  it('treats empty and whitespace-only as unplaced', () => {
    assert.equal(normalizeLocationText(''), null);
    assert.equal(normalizeLocationText('   '), null);
    assert.equal(normalizeLocationText(null), null);
  });

  it('does NOT fuzzy match — a false clash blocking a legitimate save is the worse failure', () => {
    assert.equal(sourcesShareSurface({ location: 'Diamond 1' }, { location: 'Diamond One' }), false);
    assert.equal(sourcesShareSurface({ location: 'Diamond 1' }, { location: 'Diamond 1B' }), false);
  });
});

describe('venue-identity — surface comparison', () => {
  it('matches identical typed field names', () => {
    assert.equal(sourcesShareSurface({ location: 'Diamond 1' }, { location: 'diamond 1' }), true);
  });

  it('does not match different typed field names', () => {
    assert.equal(sourcesShareSurface({ location: 'Diamond 1' }, { location: 'Diamond 2' }), false);
  });

  it('matches the same facility', () => {
    assert.equal(sourcesShareSurface(
      { venueFacilityId: 'f1', venueId: 'v1' },
      { venueFacilityId: 'f1', venueId: 'v1' },
    ), true);
  });

  it('does NOT match two different diamonds in the same park', () => {
    assert.equal(sourcesShareSurface(
      { venueFacilityId: 'f1', venueId: 'v1' },
      { venueFacilityId: 'f2', venueId: 'v1' },
    ), false);
  });

  it('matches mixed granularity: a surface-pinned game vs a venue-only game at that venue', () => {
    // The blind spot both engines shared — these used to pass each other unseen.
    assert.equal(sourcesShareSurface(
      { venueFacilityId: 'f1', venueId: 'v1' },
      { venueId: 'v1' },
    ), true);
    assert.equal(sourcesShareSurface(
      { venueId: 'v1' },
      { venueFacilityId: 'f1', venueId: 'v1' },
    ), true);
  });

  it('does not match a venue-only game at a different venue', () => {
    assert.equal(sourcesShareSurface({ venueFacilityId: 'f1', venueId: 'v1' }, { venueId: 'v2' }), false);
  });

  it('stays conservative when a facility has no known parent venue', () => {
    // Cannot prove they share a surface, so it must not invent a clash.
    assert.equal(sourcesShareSurface({ venueFacilityId: 'f1' }, { venueId: 'v1' }), false);
  });

  it('never matches typed text against a structured reference (that is Phase 3, reviewed)', () => {
    assert.equal(sourcesShareSurface({ location: 'Diamond 1' }, { venueId: 'v1' }), false);
    assert.equal(sourcesShareSurface({ location: 'Diamond 1' }, { venueFacilityId: 'f1', venueId: 'v1' }), false);
  });

  it('matches lanes only against the same lane', () => {
    assert.equal(sourcesShareSurface({ scheduleFacilityLaneId: 'l1' }, { scheduleFacilityLaneId: 'l1' }), true);
    assert.equal(sourcesShareSurface({ scheduleFacilityLaneId: 'l1' }, { scheduleFacilityLaneId: 'l2' }), false);
  });

  it('never matches anything against an unplaced row', () => {
    assert.equal(sourcesShareSurface({}, {}), false);
    assert.equal(sourcesShareSurface({ venueId: 'v1' }, {}), false);
    assert.equal(sourcesShareSurface({ location: 'Diamond 1' }, { location: '' }), false);
  });
});

describe('venue-identity — grouping keys', () => {
  it('keys a venue, a lane and typed text distinctly', () => {
    assert.equal(venueGroupKey(resolveVenuePlacement({ venueId: 'v1' })), 'venue:v1');
    assert.equal(venueGroupKey(resolveVenuePlacement({ scheduleFacilityLaneId: 'l1' })), 'lane:l1');
    assert.equal(venueGroupKey(resolveVenuePlacement({ location: 'Diamond 1' })), 'text:diamond 1');
  });

  it('returns no key for an unplaced row, so it cannot count as a venue change', () => {
    assert.equal(venueGroupKey(resolveVenuePlacement({})), null);
    assert.equal(venueGroupKey(resolveVenuePlacement({ location: 'TBD' })), null);
  });

  it('keys the facility one level finer, falling back to the venue', () => {
    assert.equal(facilityGroupKey(resolveVenuePlacement({ venueFacilityId: 'f1', venueId: 'v1' })), 'facility:f1');
    assert.equal(facilityGroupKey(resolveVenuePlacement({ venueId: 'v1' })), 'venue:v1');
  });

  it('agrees with isPlaced', () => {
    assert.equal(isPlaced(resolveVenuePlacement({ location: 'Diamond 1' })), true);
    assert.equal(isPlaced(resolveVenuePlacement({ location: 'TBD' })), false);
  });
});
