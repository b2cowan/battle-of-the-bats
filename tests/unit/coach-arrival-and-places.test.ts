/**
 * Arrival & Places (owner rulings D1–D9, 2026-09-21; mig 307).
 *
 * Pins the translations the form, the import and the routes all lean on:
 *   1. Arrival: a lead time ↔ the stored clock, same day only; a preset FOLLOWS a start change and a
 *      specific time stays put; the team default is one of the seven answers or nothing.
 *   2. Places: the book matches by trimmed, case-folded name; picking a place fills the address and
 *      the field only when the game has none; the write reader trims and caps.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ARRIVAL_PRESET_MINUTES, arrivalClockFor, arrivalPresetOf, arrivalAfterStartChange,
  arrivalPresetLabel, normalizeArrivalDefault,
} from '../../lib/coach-arrival.ts';
import { matchPlace, applyPlaceToEvent, filterPlaces, readPlaceFields, placeKey } from '../../lib/coach-places.ts';
import { surfaceLabel } from '../../lib/sports.ts';

describe('arrival — a lead time is a clock, same day', () => {
  it('turns a preset into the clock before the start', () => {
    assert.equal(arrivalClockFor('18:00', 45), '17:15');
    assert.equal(arrivalClockFor('18:00', 60), '17:00');
    assert.equal(arrivalClockFor('18:00', 90), '16:30');
    assert.equal(arrivalClockFor('09:05', 15), '08:50');
  });
  it('refuses to cross midnight — the column is a clock, not a datetime', () => {
    assert.equal(arrivalClockFor('00:30', 60), null);
    assert.equal(arrivalClockFor('00:30', 30), '00:00');
  });
  it('refuses a start that is not a clock', () => {
    assert.equal(arrivalClockFor('', 30), null);
    assert.equal(arrivalClockFor('25:00', 30), null);
  });
  it('reads the preset back from the stored clock, and a specific time as none', () => {
    assert.equal(arrivalPresetOf('18:00', '17:15'), 45);
    assert.equal(arrivalPresetOf('18:00', '16:00'), 120);
    assert.equal(arrivalPresetOf('18:00', '17:10'), null);
    assert.equal(arrivalPresetOf('18:00', ''), null);
    assert.equal(arrivalPresetOf('', '17:15'), null);
  });
  it('a preset follows the start; a specific time stays put; a blank stays blank', () => {
    assert.equal(arrivalAfterStartChange('18:00', '19:00', '17:15'), '18:15');
    assert.equal(arrivalAfterStartChange('18:00', '19:00', '17:10'), '17:10');
    assert.equal(arrivalAfterStartChange('18:00', '19:00', ''), '');
    // Following would cross midnight → the arrival keeps its old clock rather than vanishing.
    assert.equal(arrivalAfterStartChange('18:00', '00:30', '17:00'), '17:00');
  });
  it('names the seven answers the way a coach says them', () => {
    assert.deepEqual(ARRIVAL_PRESET_MINUTES.map(arrivalPresetLabel), [
      '15 minutes before', '30 minutes before', '45 minutes before', '1 hour before', '1½ hours before', '2 hours before',
    ]);
  });
  it('a team default is one of the seven answers or nothing', () => {
    assert.equal(normalizeArrivalDefault(45), 45);
    assert.equal(normalizeArrivalDefault('60'), 60);
    assert.equal(normalizeArrivalDefault(null), null);
    assert.equal(normalizeArrivalDefault(''), null);
    assert.equal(normalizeArrivalDefault(50), null);
    assert.equal(normalizeArrivalDefault('soon'), null);
  });
});

const BOOK = [
  { id: 'a', name: 'Sherwood Park', address: '1200 Sherwood Dr', fieldNumber: 'Diamond 2' },
  { id: 'b', name: 'Millennium Place', address: null, fieldNumber: null },
];

describe('places — the book matches by name, trimmed and case-folded', () => {
  it('finds a place however it was typed, and nothing for a prefix or a blank', () => {
    assert.equal(matchPlace(BOOK, ' sherwood park ')?.id, 'a');
    assert.equal(matchPlace(BOOK, 'SHERWOOD PARK')?.id, 'a');
    assert.equal(matchPlace(BOOK, 'Sherwood'), null);
    assert.equal(matchPlace(BOOK, ''), null);
    assert.equal(matchPlace(BOOK, null), null);
    assert.equal(placeKey('  Mill Woods  '), 'mill woods');
  });
  it('picking a place fills the address, and the field only when the game has none', () => {
    const blank = { location: '', locationAddress: '', fieldNumber: '', placeId: null as string | null };
    const picked = applyPlaceToEvent(blank, BOOK[0]);
    assert.equal(picked.location, 'Sherwood Park');
    assert.equal(picked.locationAddress, '1200 Sherwood Dr');
    assert.equal(picked.fieldNumber, 'Diamond 2');
    assert.equal(picked.placeId, 'a');
    // A diamond the coach already typed for THIS game wins over the place's usual.
    const typed = applyPlaceToEvent({ ...blank, fieldNumber: 'Diamond 5' }, BOOK[0]);
    assert.equal(typed.fieldNumber, 'Diamond 5');
    // A place with no address clears a stale one — the event's copy follows the place picked.
    const bare = applyPlaceToEvent({ ...blank, locationAddress: 'old' }, BOOK[1]);
    assert.equal(bare.locationAddress, '');
    assert.equal(bare.placeId, 'b');
  });
  it('filters the list by what is typed, name or address, and returns everything for nothing', () => {
    assert.deepEqual(filterPlaces(BOOK, 'mill').map(p => p.id), ['b']);
    assert.deepEqual(filterPlaces(BOOK, '1200').map(p => p.id), ['a']);
    assert.deepEqual(filterPlaces(BOOK, '  ').map(p => p.id), ['a', 'b']);
  });
  it('the write reader trims, caps and refuses a nameless place', () => {
    assert.deepEqual(readPlaceFields({ name: '  Sherwood Park ', address: ' 1200 Sherwood Dr ', fieldNumber: '', note: null }).fields,
      { name: 'Sherwood Park', address: '1200 Sherwood Dr', fieldNumber: null, note: null });
    assert.ok(readPlaceFields({ name: '   ' }).error);
    assert.ok(readPlaceFields({ name: 'x'.repeat(121) }).error);
    assert.ok(readPlaceFields({ name: 'Park', note: 'n'.repeat(161) }).error);
    assert.ok(readPlaceFields({ name: 'Park', address: 42 }).error);
    // A PATCH that names only the note leaves the rest undefined — "not editing", never "clear".
    assert.deepEqual(readPlaceFields({ note: 'park behind the arena' }).fields, { note: 'park behind the arena' });
  });
});

describe('a field number reads as a sentence — a bare code takes the sport\'s noun, a name stays as typed', () => {
  it('prefixes a bare code with the surface noun, "#" and a letter suffix included', () => {
    assert.equal(surfaceLabel('baseball', '1'), 'Diamond 1');
    assert.equal(surfaceLabel('softball', ' 1A '), 'Diamond 1A');
    assert.equal(surfaceLabel('basketball', '#2'), 'Court 2');
  });
  it('leaves a value that already names itself alone — never "Diamond Diamond 2"', () => {
    assert.equal(surfaceLabel('baseball', 'Diamond 2'), 'Diamond 2');
    assert.equal(surfaceLabel('baseball', 'North Court'), 'North Court');
    assert.equal(surfaceLabel('baseball', 'D2'), 'D2');
  });
  it('a sport with no surface noun of its own reads "Field", never "Other 1"; no sport at all is the platform default', () => {
    assert.equal(surfaceLabel('soccer', '1'), 'Field 1');
    assert.equal(surfaceLabel('other', '1'), 'Field 1');
    // null/blank resolves to the legacy default sport (softball) everywhere else in the packs — same here.
    assert.equal(surfaceLabel(null, '3'), 'Diamond 3');
  });
  it('blank in, empty out', () => {
    assert.equal(surfaceLabel('baseball', ''), '');
    assert.equal(surfaceLabel('baseball', '   '), '');
    assert.equal(surfaceLabel('baseball', null), '');
    assert.equal(surfaceLabel('baseball', undefined), '');
  });
});
