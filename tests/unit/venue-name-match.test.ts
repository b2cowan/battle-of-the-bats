/**
 * The exact-match rule shared by the schedule importer (Phase 2) and the Phase 3 resolve screen.
 *
 * These tests exist because the rule has TWO callers with very different consequences — one
 * writes on upload, one writes on an admin's click — and the whole point of sharing the module is
 * that they can never reach different conclusions about what a string names.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildVenueNameIndex, matchVenueName } from '../../lib/venue-name-match.ts';

const source = {
  venues: [
    { id: 'v1', name: 'Lions Sports Field' },
    { id: 'v2', name: 'Community Park' },
  ],
  facilities: [
    { id: 'f1', venueId: 'v1', name: 'Diamond 1' },
    { id: 'f2', venueId: 'v1', name: 'Diamond 2' },
    { id: 'f3', venueId: 'v2', name: 'Diamond 1' },
  ],
};
const index = buildVenueNameIndex(source);

describe('matchVenueName — what a typed string names', () => {
  it('matches a venue by name', () => {
    const result = matchVenueName('Community Park', index);
    assert.equal(result.kind, 'matched');
    assert.equal(result.kind === 'matched' && result.target.venue.id, 'v2');
    assert.equal(result.kind === 'matched' && result.target.facility, null);
  });

  it('matches a facility whose name is unique across the tournament', () => {
    const result = matchVenueName('Diamond 2', index);
    assert.equal(result.kind, 'matched');
    assert.equal(result.kind === 'matched' && result.target.venue.id, 'v1');
    assert.equal(result.kind === 'matched' && result.target.facility?.id, 'f2');
    // The caller gets the RECORD back, names included — the importer renders them straight into
    // its preview instead of looking the same rows up again.
    assert.equal(result.kind === 'matched' && result.target.facility?.name, 'Diamond 2');
  });

  it('matches the combined "Venue - Facility" label', () => {
    const result = matchVenueName('Lions Sports Field - Diamond 1', index);
    assert.equal(result.kind, 'matched');
    assert.equal(result.kind === 'matched' && result.target.facility?.id, 'f1');
  });

  it('reads the live em-dash label and the legacy hyphen label as the same string', () => {
    // Phase 2 unified the display string on an em dash. Files exported before that carry a
    // hyphen, and both must resolve to the same record or a re-import would look unmatched.
    assert.deepEqual(
      matchVenueName('Lions Sports Field — Diamond 1', index),
      matchVenueName('Lions Sports Field - Diamond 1', index),
    );
  });

  it('is case- and whitespace-insensitive', () => {
    const result = matchVenueName('  diamond   2 ', index);
    assert.equal(result.kind, 'matched');
    assert.equal(result.kind === 'matched' && result.target.facility?.id, 'f2');
  });

  it('never guesses at a near miss', () => {
    // The real Crimson Cup fixture: games typed "Field 1", fields named "diamond #1".
    assert.deepEqual(matchVenueName('Field 1', index), { kind: 'unmatched' });
    assert.deepEqual(matchVenueName('Diamond One', index), { kind: 'unmatched' });
    assert.deepEqual(matchVenueName('Diamond 22', index), { kind: 'unmatched' });
  });

  it('refuses to choose when a name reaches two records', () => {
    // "Diamond 1" exists at both venues, so nothing may be suggested.
    const result = matchVenueName('Diamond 1', index);
    assert.equal(result.kind, 'ambiguous');
    assert.equal(result.kind === 'ambiguous' && result.targets.length, 2);
  });

  it('treats a facility named after its own venue as ambiguous, not as the venue', () => {
    // Real in the Battle of the Bats fixture: a diamond carries its park's name.
    const shadowed = buildVenueNameIndex({
      venues: [{ id: 'v1', name: 'Lions Sports Field' }],
      facilities: [{ id: 'f9', venueId: 'v1', name: 'Lions Sports Field' }],
    });
    const result = matchVenueName('Lions Sports Field', shadowed);
    assert.equal(result.kind, 'ambiguous');
    assert.deepEqual(
      result.kind === 'ambiguous' && result.targets.map(t => t.facility?.id ?? null),
      [null, 'f9'],
    );
  });

  it('reports placeholder text as naming nothing — NOT as a failed match (ruling R2)', () => {
    for (const value of ['TBD', 'tba', 'T.B.D.', 'N/A', '(TBD)', 'none', '-', '—', '   ']) {
      assert.deepEqual(matchVenueName(value, index), { kind: 'none' }, `${value} should name nothing`);
    }
  });

  it('reports empty input as naming nothing', () => {
    assert.deepEqual(matchVenueName('', index), { kind: 'none' });
    assert.deepEqual(matchVenueName(null, index), { kind: 'none' });
    assert.deepEqual(matchVenueName(undefined, index), { kind: 'none' });
  });

  it('counts one record reached by two spellings as ONE candidate, not an ambiguity', () => {
    // A facility whose own name equals its combined label must not appear twice and so block
    // itself from ever matching.
    const selfLabelled = buildVenueNameIndex({
      venues: [{ id: 'v1', name: 'Park' }],
      facilities: [{ id: 'f1', venueId: 'v1', name: 'Park' }],
    });
    // "Park - Park" is the combined label; it reaches only the facility.
    const result = matchVenueName('Park - Park', selfLabelled);
    assert.equal(result.kind, 'matched');
    assert.equal(result.kind === 'matched' && result.target.facility?.id, 'f1');
  });

  it('ignores a facility whose parent venue is outside the catalog', () => {
    // Defensive: a name may only ever address a record this tournament actually owns.
    const orphaned = buildVenueNameIndex({
      venues: [{ id: 'v1', name: 'Lions Park' }],
      facilities: [{ id: 'fx', venueId: 'v-elsewhere', name: 'Diamond 9' }],
    });
    assert.deepEqual(matchVenueName('Diamond 9', orphaned), { kind: 'unmatched' });
  });

  it('matches nothing at all when the tournament has no venues', () => {
    const empty = buildVenueNameIndex({ venues: [], facilities: [] });
    assert.deepEqual(matchVenueName('Community Park', empty), { kind: 'unmatched' });
  });
});
