import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  firstClosureMatch, isClosureShowing, markSpent, markStanding, placeClosureMatch, placeNameInTyped, repTypedText,
  STRIP_CLOSURE_COLUMNS, stripClosureOf, type ClosedPlace, type MarkedEventNow, type RepMark,
} from '../../lib/place-closures.ts';
import {
  heldGames, isQuietLink, netChangeOf, quietLinkOf, type GameSnapshot, type HeldChange,
} from '../../lib/league-game-changes.ts';

/** Club Website Stage 2, Session 2A (mig 539): the rules Close a place's window, press and public reads share. */

const lions: ClosedPlace = { scope: 'place', venueId: 'lions', facilityId: null, name: 'Lions Park' };
const d2: ClosedPlace = { scope: 'diamond', venueId: 'lions', facilityId: 'd2', name: 'Lions Park' };
const harbour: ClosedPlace = { scope: 'place', venueId: 'harbour', facilityId: null, name: 'Harbourview Park' };
const every: ClosedPlace = { scope: 'all', venueId: null, facilityId: null, name: null };

describe('K7 · one matching rule: the place id first, then the name inside the typed text, any case', () => {
  it('finds the name inside typed text in any case, and a blank name or text never matches', () => {
    assert.equal(placeNameInTyped('Lions Park', 'Lions Park — Diamond 2'), true);
    assert.equal(placeNameInTyped('Lions Park', 'LIONS PARK D2'), true);
    assert.equal(placeNameInTyped('Lions Park', 'lions park d1'), true);
    assert.equal(placeNameInTyped('  Lions Park ', 'at lions park'), true);
    assert.equal(placeNameInTyped('Lions Park', 'Lions Pk'), false, 'the drawing\'s "Lions Pk" is not found, so not listed');
    assert.equal(placeNameInTyped('', 'Lions Park'), false);
    assert.equal(placeNameInTyped('Lions Park', '   '), false);
    assert.equal(placeNameInTyped('Lions Park', null), false);
  });

  it('a game on the place is linked; typed with the name is maybe; on another place it is not there', () => {
    assert.equal(placeClosureMatch(lions, { venueId: 'lions', facilityId: 'd1', typed: null }), 'linked');
    assert.equal(placeClosureMatch(lions, { venueId: null, facilityId: null, typed: 'Lions Park — Diamond 2' }), 'maybe');
    assert.equal(placeClosureMatch(lions, { venueId: 'harbour', facilityId: null, typed: 'next to Lions Park' }), null,
      'the id wins over the text');
    assert.equal(placeClosureMatch(lions, { venueId: null, facilityId: null, typed: 'Riverdale' }), null);
  });

  it('K2 · one diamond: that diamond linked, the place with no diamond maybe, another diamond not there', () => {
    assert.equal(placeClosureMatch(d2, { venueId: 'lions', facilityId: 'd2', typed: null }), 'linked');
    assert.equal(placeClosureMatch(d2, { venueId: 'lions', facilityId: null, typed: null }), 'maybe');
    assert.equal(placeClosureMatch(d2, { venueId: 'lions', facilityId: 'd1', typed: null }), null);
    assert.equal(placeClosureMatch(d2, { venueId: null, facilityId: null, typed: 'lions park d1' }), 'maybe',
      'a typed game names the park, not reliably the diamond: the admin decides');
  });

  it('"All our fields" takes every game that day, with or without a place', () => {
    assert.equal(placeClosureMatch(every, { venueId: 'anywhere', facilityId: null, typed: null }), 'linked');
    assert.equal(placeClosureMatch(every, { venueId: null, facilityId: null, typed: null }), 'linked');
  });

  it('two places: a game belongs to the first it is at, in the window\'s order', () => {
    assert.deepEqual(firstClosureMatch([lions, harbour], { venueId: 'harbour', facilityId: null, typed: null }), { index: 1, match: 'linked' });
    assert.deepEqual(firstClosureMatch([harbour, lions], { venueId: null, facilityId: null, typed: 'Lions Park' }), { index: 1, match: 'maybe' });
    assert.equal(firstClosureMatch([lions, harbour], { venueId: 'elsewhere', facilityId: null, typed: null }), null);
  });

  it('a rep game\'s typed text is its own typed place and its team place\'s name, together', () => {
    assert.equal(repTypedText('Diamond 1', 'Lions Park'), 'Diamond 1 · Lions Park');
    assert.equal(repTypedText(null, 'Lions Park'), 'Lions Park');
    assert.equal(repTypedText(null, null), null);
    assert.equal(placeClosureMatch(lions, { venueId: null, facilityId: null, typed: repTypedText(null, 'lions park (turf)') }), 'maybe');
  });
});

describe('K9 · the rep mark is spent by reading the game, never by writing', () => {
  const mark = (o: Partial<RepMark> = {}): RepMark => ({
    id: 'm1', closureId: 'c1', eventId: 'e1', teamId: 't1', markedStartsAt: '2026-11-28T17:30:00.000Z',
    markedVenueId: 'lions', markedFacilityId: null, markedPlaceId: null, markedLocation: null, coachEmailedAt: null, ...o,
  });
  const game = (o: Partial<MarkedEventNow> = {}): MarkedEventNow => ({
    id: 'e1', startsAt: '2026-11-28T17:30:00+00:00', status: 'scheduled', venueId: 'lions', facilityId: null, placeId: null,
    location: null, ...o,
  });

  it('stands while the game is as marked (the same instant written two ways is the same time)', () => {
    assert.equal(markSpent(mark(), game()), false);
    assert.equal(markStanding(mark(), game(), { reopenedAt: null }), true);
  });

  it('is spent when the coach moves it (time or any place field), cancels it, or it is gone', () => {
    assert.equal(markSpent(mark(), game({ startsAt: '2026-12-05T17:30:00Z' })), true);
    assert.equal(markSpent(mark(), game({ venueId: 'harbour' })), true);
    assert.equal(markSpent(mark(), game({ facilityId: 'd1' })), true);
    assert.equal(markSpent(mark(), game({ placeId: 'p1' })), true);
    assert.equal(markSpent(mark(), game({ location: 'Somewhere' })), true);
    assert.equal(markSpent(mark(), game({ status: 'cancelled' })), true);
    assert.equal(markSpent(mark(), null), true);
  });

  it('comes down on Reopen (K11)', () => {
    assert.equal(markStanding(mark(), game(), { reopenedAt: '2026-11-28T15:00:00Z' }), false);
  });

  it('a second closure over the same game is its own mark: reopening one never clears the other', () => {
    const first = mark({ id: 'm1', closureId: 'c1' }), second = mark({ id: 'm2', closureId: 'c2' });
    const reopened: Record<string, string | null> = { c1: null, c2: '2026-11-28T15:00:00Z' };
    const standing = [first, second].filter(m => markStanding(m, game(), { reopenedAt: reopened[m.closureId] }));
    assert.deepEqual(standing.map(m => m.id), ['m1']);
  });
});

describe('K3 · K16 · the strip: from the press to the end of Until, place words only, no job', () => {
  const c = { showsFrom: '2026-11-27T23:00:00Z', endsAt: '2026-11-29T05:00:00Z', reopenedAt: null };

  it('shows from the press (one set tonight already reads), is gone after Until or Reopen by itself', () => {
    assert.equal(isClosureShowing(c, Date.parse('2026-11-27T22:59:59Z')), false);
    assert.equal(isClosureShowing(c, Date.parse('2026-11-27T23:00:00Z')), true, 'the evening before: "closed tomorrow"');
    assert.equal(isClosureShowing(c, Date.parse('2026-11-29T04:59:59Z')), true);
    assert.equal(isClosureShowing(c, Date.parse('2026-11-29T05:00:00Z')), false, 'midnight after Until');
    assert.equal(isClosureShowing({ ...c, reopenedAt: '2026-11-28T15:00:00Z' }, Date.parse('2026-11-28T16:00:00Z')), false);
  });

  it('copies place words, days and the place id (for the cover rule) and nothing else, whatever the row carries', () => {
    const row = {
      scope: 'diamond' as const, org_venue_id: 'lions', place_name: 'Lions Park', facility_name: 'Diamond 2', first_day: '2026-11-28', last_day: '2026-11-29',
      shows_from: '2026-11-28T01:40:00Z', ends_at: '2026-11-30T05:00:00Z',
      line: 'The fields are flooded, sorry Wrens!', closed_by: 'u1', games: 12, division: 'U9',
    };
    const out = stripClosureOf(row);
    assert.deepEqual(Object.keys(out).sort(), ['allDiamonds', 'endsAt', 'facilityName', 'firstDay', 'lastDay', 'placeName', 'scope', 'showsFrom', 'venueId']);
    assert.deepEqual(out, {
      scope: 'diamond', venueId: 'lions', placeName: 'Lions Park', facilityName: 'Diamond 2', allDiamonds: false,
      firstDay: '2026-11-28', lastDay: '2026-11-29', showsFrom: '2026-11-28T01:40:00Z', endsAt: '2026-11-30T05:00:00Z',
    });
    const all = stripClosureOf({ ...row, scope: 'all', place_name: 'x', facility_name: 'y' });
    assert.equal(all.placeName, null);
    assert.equal(all.venueId, null);
    assert.equal(stripClosureOf({ ...row, scope: 'place' }).facilityName, null);
    assert.equal(stripClosureOf({ ...row, scope: 'place' }, new Set(['lions'])).allDiamonds, true, 'a park that is all diamonds');
    assert.equal(stripClosureOf(row, new Set(['lions'])).allDiamonds, false, 'only a whole park reads "all diamonds"');
  });

  it('the server reads exactly those columns: no count, division, person, team or admin line', () => {
    assert.deepEqual(STRIP_CLOSURE_COLUMNS.split(',').map(s => s.trim()).sort(),
      ['ends_at', 'facility_name', 'first_day', 'last_day', 'org_venue_id', 'place_name', 'scope', 'shows_from']);
  });
});

describe('K7 · "Link both" is not news in the send either (mig 539\'s recorder writes no row; this is the net-effect half)', () => {
  const typed = (o: Partial<GameSnapshot> = {}): GameSnapshot => ({
    scheduledAt: '2026-11-28T14:00:00Z', endsAt: null, location: 'lions park d1', venueId: null, facilityId: null,
    status: 'scheduled', movedFrom: null, ...o,
  });
  let n = 0;
  const row = (o: Pick<HeldChange, 'kind' | 'before' | 'after'>): HeldChange => ({
    id: `c${++n}`, gameId: 'g1', source: 'league', createdAt: `2026-11-27T00:00:${String(n).padStart(2, '0')}Z`, ...o,
  });
  const later = typed({ scheduledAt: '2026-11-28T16:00:00Z' });

  it('a quiet link is the place id appearing with nothing else changed, typed text kept, no diamond', () => {
    assert.equal(isQuietLink(typed(), typed({ venueId: 'lions' })), true);
    assert.equal(isQuietLink(typed(), typed({ venueId: 'lions', location: 'Lions Park' })), false, 'text changed');
    assert.equal(isQuietLink(typed(), typed({ venueId: 'lions', facilityId: 'd1' })), false, 'a diamond added');
    assert.equal(isQuietLink(typed({ venueId: 'harbour' }), typed({ venueId: 'lions' })), false, 'already had a place');
  });

  it('is read from the GAP between rows, never from a recorded row (a recorded link is news, whatever its name)', () => {
    const quiet = [row({ kind: 'moved', before: typed(), after: later }), row({ kind: 'moved', before: { ...later, venueId: 'lions' }, after: typed({ venueId: 'lions' }) })];
    assert.equal(quietLinkOf(quiet, typed({ venueId: 'lions' })), 'lions');
    const recorded = [row({ kind: 'place', before: typed(), after: typed({ venueId: 'lions' }) })];
    assert.equal(quietLinkOf(recorded, typed({ venueId: 'lions' })), null);
    assert.equal(netChangeOf(recorded, typed({ venueId: 'lions' }))?.kind, 'place', 'any other writer\'s link stays news');
  });

  it('moved, linked quietly, moved back: families hear nothing — not "moved to Lions Park"', () => {
    const rows = [row({ kind: 'moved', before: typed(), after: later }), row({ kind: 'moved', before: { ...later, venueId: 'lions' }, after: typed({ venueId: 'lions' }) })];
    const now = typed({ venueId: 'lions' });
    assert.equal(netChangeOf(rows, now), null);
    assert.equal(heldGames(rows, new Map([['g1', now]]))[0].news, null);
  });

  it('moved and linked quietly: news is the move, and its "Was" place is not called changed (the email reads net.before)', () => {
    const rows = [row({ kind: 'moved', before: typed(), after: later })];
    const now = { ...later, venueId: 'lions' };
    const net = netChangeOf(rows, now)!;
    assert.equal(net.kind, 'moved');
    assert.equal(net.before?.venueId, 'lions', 'the place families heard, with the link');
    assert.equal(net.before?.location, 'lions park d1');
  });

  it('the typed text changed too: a real place change, the link no part of it', () => {
    const rows = [row({ kind: 'place', before: typed(), after: typed({ location: 'Harbourview' }) })];
    const net = netChangeOf(rows, typed({ location: 'Harbourview', venueId: 'harbour' }))!;
    assert.equal(net.kind, 'place');
    assert.equal(net.before?.venueId, null);
  });

  it('a linked game the closure postponed reads as postponed (the press links before it calls off)', () => {
    const rows = [row({ kind: 'postponed', before: typed({ venueId: 'lions' }), after: typed({ venueId: 'lions', status: 'postponed' }) })];
    assert.equal(netChangeOf(rows, typed({ venueId: 'lions', status: 'postponed' }))?.kind, 'postponed');
  });
});
