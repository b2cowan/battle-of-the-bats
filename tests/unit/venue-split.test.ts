import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { splitLockedLine, splitLockedRefusal } from '../../lib/venue-library.ts';
import { readSource } from './_source-code.ts';

// Club schedules Stage 2, Session 2A (mig 541; round 2 drawing tab 2; round 2 Ask 7 A, owner 2026-11-25: bookings still
// to come). The Venue library's split: a select after the kind, locked while a part is booked, said in one line.

describe('the locked line — once for every locked field', () => {
  it('one field says its own split', () => {
    assert.equal(splitLockedLine([{ name: 'Field 1', sections: 4 }]), 'Field 1 has bookings on its quarters, so it stays in four quarters.');
    assert.equal(splitLockedLine([{ name: 'Field 2', sections: 2 }]), 'Field 2 has bookings on its sides, so it stays in two sides.');
  });
  it('several fields, one line', () => {
    assert.equal(splitLockedLine([{ name: 'Field 1', sections: 4 }, { name: 'Field 2', sections: 2 }]),
      'Field 1 and Field 2 have bookings on their parts, so each stays split as it is.');
  });
  it('nothing locked, no line; the refusal is the same sentence', () => {
    assert.equal(splitLockedLine([]), null);
    assert.equal(splitLockedRefusal('Field 1', 4), 'Field 1 has bookings on its quarters, so it stays in four quarters.');
  });
});

describe('the route and the window', () => {
  const route = readSource('app/api/admin/org/venues/route.ts');
  const upd = route.slice(route.indexOf("action === 'update-venue'"), route.indexOf("action === 'archive-venue'"));
  it('a locked split is refused in words BEFORE any write (the race the window cannot see)', () => {
    const refuse = upd.indexOf("'split_locked'");
    assert.ok(refuse > 0);
    assert.ok(refuse < upd.indexOf('carryWordsForward('), 'before the rename carry, the first write');
    assert.match(upd, /facilitiesWithPartsBooked\(resplit\)/);
  });
  it('only a changed split writes `sections` (the lock trigger fires on any write of it)', () => {
    assert.match(upd, /resplitPatch = \(k: Kept\) => \(sectionsOf\(stored\.get\(k\.id\)!\.sections\) !== k\.sections \? \{ sections: k\.sections \} : \{\}\)/);
  });
  it("the database's own refusal is said too, never a 500", () => {
    assert.match(route, /\/\\bsplit_locked\\b\/\.test/);
  });
  it('an older page that sends no split, or a value that is not 1 / 2 / 4, keeps the stored one', () => {
    assert.match(upd, /const sent = f\.sections === 1 \|\| f\.sections === 2 \|\| f\.sections === 4 \? f\.sections : null;/);
    assert.match(upd, /sent \?\? \(fid && stored\.has\(fid\) \? sectionsOf\(stored\.get\(fid\)!\.sections\) : 1\)/);
  });
  it('the library read marks each split field, and the window locks its select by it', () => {
    assert.match(route, /withPartsBooked\(venues\)/);
    const win = readSource('components/admin/kit/club/VenueLibraryWindows.tsx');
    assert.match(win, /disabled=\{splitLocked\(f\)\}/);
    assert.match(win, /splitLocked=\{f => !!f\.id && !!venue\.facilities\.find\(s => s\.id === f\.id\)\?\.partsBooked\}/);
    assert.match(win, /SPLIT_CHOICES\.map/);
  });
  it('the lock asks the database’s question, never its own copy of it', () => {
    const server = readSource('lib/venue-library-server.ts');
    assert.match(server, /rpc\('org_venue_facility_parts_booked'/);
  });
});
