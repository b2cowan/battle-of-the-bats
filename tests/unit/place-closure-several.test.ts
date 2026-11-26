import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLOSE_WORDS as W, carryTicks, closedParks, diamondTickOff, pickCount, pickEntries, pickParam, placesWord, previewSentences,
  toggleDiamond, typedKind,
  type CloseLeagueGame, type CloseRepGame, type CloseSource, type PlacePick,
} from '../../lib/place-closure-window.ts';
import { markPlaceOfAll, placeEntriesValid, type ClosedPlace } from '../../lib/place-closures.ts';
import { COACH_MAIL } from '../../lib/place-closure-mail-words.ts';
import { closureStrip } from '../../lib/club-notice.ts';

/**
 * Club Website Stage 2, Session 2D: several places in one press (rulings M1–M8 and D1, owner 2026-11-26; the drawing
 * CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html; mig 549). The Places field's rules, the words said by park, the ticks that
 * survive a change of places, and D1's one game marked by two diamonds.
 */
const DAY = '2026-11-28';
const lions: ClosedPlace = { scope: 'place', venueId: 'lions', facilityId: null, name: 'Lions Park' };
const harbour: ClosedPlace = { scope: 'place', venueId: 'harbour', facilityId: null, name: 'Harbourview Park' };
const pine: ClosedPlace = { scope: 'place', venueId: 'pine', facilityId: null, name: 'Pinecrest Park' };
const d = (n: number): ClosedPlace => ({ scope: 'diamond', venueId: 'lions', facilityId: `d${n}`, name: 'Lions Park', facilityName: `Diamond ${n}` });
const every: ClosedPlace = { scope: 'all', venueId: null, facilityId: null, name: null };
const ORDER = ['d1', 'd2', 'd3'];

describe('M1–M6 · the Places field\'s rules', () => {
  const picks: PlacePick[] = [{ venueId: 'harbour', diamonds: [] }, { venueId: 'lions', diamonds: ['d1', 'd2'] }];
  it('a whole park is one entry, each chosen diamond is one; in the order chosen', () => {
    assert.equal(pickCount(picks), 3);
    assert.deepEqual(pickEntries(picks, false), [
      { venueId: 'harbour', facilityId: null }, { venueId: 'lions', facilityId: 'd1' }, { venueId: 'lions', facilityId: 'd2' },
    ]);
    assert.equal(pickParam(picks, false), 'harbour,lions:d1,lions:d2');
  });
  it('nothing chosen reads NOTHING (never every park); All our fields stands in for the parks', () => {
    assert.equal(pickParam([], false), null);
    assert.deepEqual(pickEntries([], false), []);
    assert.equal(pickParam(picks, true), 'all');
  });
  it('note 11 · the diamond ticks: from All diamonds one; every one collapses to the whole park; one always stays', () => {
    const whole: PlacePick = { venueId: 'lions', diamonds: [] };
    assert.deepEqual(toggleDiamond(whole, 'd2', true, ORDER).diamonds, ['d2']);
    const two = toggleDiamond(toggleDiamond(whole, 'd3', true, ORDER), 'd1', true, ORDER);
    assert.deepEqual(two.diamonds, ['d1', 'd3'], 'in the park\'s order');
    assert.deepEqual(toggleDiamond(two, 'd2', true, ORDER).diamonds, [], 'every diamond = the whole park, one entry');
    assert.deepEqual(toggleDiamond(two, '', true, ORDER).diamonds, [], 'All diamonds clears the picks');
    assert.deepEqual(toggleDiamond({ venueId: 'lions', diamonds: ['d1'] }, 'd1', false, ORDER).diamonds, ['d1'], 'the last tick stays');
    assert.deepEqual(toggleDiamond(whole, '', false, ORDER).diamonds, [], 'unticking All diamonds does nothing');
    assert.deepEqual(toggleDiamond(two, 'd3', false, ORDER).diamonds, ['d1']);
  });
  it('M6 · at 10 entries a tick that would add one is off; the tick that collapses to the whole park stays on', () => {
    const p: PlacePick = { venueId: 'lions', diamonds: ['d1'] };
    assert.equal(diamondTickOff(p, 'd2', ORDER, 9), false);
    assert.equal(diamondTickOff(p, 'd2', ORDER, 10), true);
    assert.equal(diamondTickOff({ venueId: 'lions', diamonds: ['d1', 'd2'] }, 'd3', ORDER, 10), false, 'it collapses to one entry');
    assert.equal(diamondTickOff({ venueId: 'lions', diamonds: [] }, 'd2', ORDER, 10), false, 'from All diamonds it replaces, never adds');
  });
  it('the press\'s places rule (mig 549): each place or diamond once, never a whole place beside its diamond', () => {
    assert.equal(placeEntriesValid([{ venueId: 'lions', facilityId: 'd1' }, { venueId: 'lions', facilityId: 'd2' }]), true);
    assert.equal(placeEntriesValid([{ venueId: 'lions', facilityId: 'd1' }, { venueId: 'lions', facilityId: 'd1' }]), false);
    assert.equal(placeEntriesValid([{ venueId: 'lions', facilityId: null }, { venueId: 'lions', facilityId: 'd1' }]), false);
    assert.equal(placeEntriesValid([{ venueId: 'lions', facilityId: null }, { venueId: 'harbour', facilityId: null }]), true);
    assert.equal(placeEntriesValid([{ venueId: null, facilityId: null }]), true);
    assert.equal(placeEntriesValid([{ venueId: null, facilityId: null }, { venueId: 'lions', facilityId: null }]), false);
    assert.equal(placeEntriesValid([]), false);
  });
  it('the field\'s words', () => {
    assert.equal(W.chosen(0, false), 'Choose places');
    assert.equal(W.chosen(1, false), '1 place chosen');
    assert.equal(W.chosen(3, false), '3 places chosen');
    assert.equal(W.chosen(3, true), 'All our fields');
    assert.equal(W.limit(true), 'Up to 10 parks or diamonds in one press. To close every one, tick “All our fields”.');
    assert.equal(W.limit(false), 'Up to 10 parks or diamonds in one press.', 'a house league admin has no All our fields');
    assert.equal(W.diamondsValue([], 3), 'All diamonds');
    assert.equal(W.diamondsValue(['Diamond 2'], 3), 'Diamond 2');
    assert.equal(W.diamondsValue(['Diamond 1', 'Diamond 2'], 3), '2 of 3 diamonds');
    assert.equal(W.diamondsLabel('Lions Park', '2 of 3 diamonds'), 'Diamonds at Lions Park: 2 of 3 diamonds');
    assert.equal(W.chooseFirst, 'Choose a place to see what’s on it.');
    assert.equal(W.remove('Pinecrest Park'), 'Remove Pinecrest Park');
  });
});

describe('the words group by park (the drawing\'s tabs 1, 4 and 5; note 14)', () => {
  it('the heading and the result say the park once', () => {
    assert.equal(placesWord([d(1), d(2)]), '2 diamonds at Lions Park');
    assert.equal(placesWord([harbour, d(1), d(2)]), 'Harbourview Park and 2 diamonds at Lions Park');
    assert.equal(placesWord([d(2)]), 'Diamond 2 at Lions Park');
    assert.equal(placesWord([harbour, lions, pine]), 'those places');
    assert.equal(W.whatsAt([harbour, d(1), d(2)]), 'What’s at Harbourview Park and 2 diamonds at Lions Park that day');
    assert.equal(W.doneTitle([d(1), d(3)]), '2 diamonds at Lions Park closed');
  });
  it('the button counts parks: one park\'s diamonds, both, N places', () => {
    assert.equal(W.go([d(1), d(2)], 41, false), 'Close 2 diamonds and email 41 families');
    assert.equal(W.go([harbour, d(1), d(2)], 41, false), 'Close both and email 41 families');
    assert.equal(W.go([harbour, lions, pine], 66, false), 'Close 3 places and email 66 families');
    assert.equal(W.go([harbour, lions, pine], 66, true), 'Close 3 places, email 66');
    assert.equal(W.go([every], 66, false), 'Close all our fields and email 66 families');
  });
  it('a link names the park, never a diamond; the Rain delay counts the park\'s diamonds', () => {
    assert.equal(W.linkLabel(2, false, [d(1), d(2)]), 'Link both to Lions Park');
    assert.equal(W.linkOn(1, [d(2)]), 'It is linked to Lions Park when you close. Families aren’t told.');
    assert.equal(W.tournamentAt(4, [d(1), d(2)], true), '4 games on Lions Park’s diamonds today');
    assert.equal(W.tournamentAt(4, [harbour, d(1)], true), '4 games on those places’ diamonds today');
  });
  it('two closures read "Reopen them"; one reads "Reopen it"', () => {
    assert.match(W.doneSite(['A.', 'B.'], DAY, 2), /Reopen them from the Venue library\.$/);
    assert.match(W.doneSite(['A.'], DAY, 1), /Reopen it from the Venue library\.$/);
  });
  it('note 12 · the preview shortens past four lines as the public strip does (three, then the rest)', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...harbour, venueId: `p${i}`, name: `Park ${i}` }));
    const lines = previewSentences(ten, DAY, DAY, DAY);
    assert.deepEqual(lines, ['Park 0 is closed today.', 'Park 1 is closed today.', 'Park 2 is closed today.', 'And 7 more places are closed.']);
    assert.equal(previewSentences(ten.slice(0, 4), DAY, DAY, DAY).length, 4, 'four lines stay four');
    // The strip itself is unchanged by the shared rule.
    const strip = closureStrip(ten.map(p => ({ scope: 'place' as const, placeName: p.name, facilityName: null, firstDay: DAY, lastDay: DAY,
      showsFrom: '2026-11-28T12:00:00Z', endsAt: '2026-11-29T05:00:00Z' })), '2026-11-28T13:00:00Z');
    assert.deepEqual(strip?.lines.map(l => l.sentence), lines);
  });
  it('the Overview counts parks: two diamonds of one park are ONE place closed', () => {
    const c = (o: { scope: 'place' | 'diamond' | 'all'; venueId: string | null; placeName: string | null; facilityName: string | null }) => o;
    assert.deepEqual(closedParks([
      c({ scope: 'diamond', venueId: 'lions', placeName: 'Lions Park', facilityName: 'Diamond 1' }),
      c({ scope: 'diamond', venueId: 'lions', placeName: 'Lions Park', facilityName: 'Diamond 3' }),
      c({ scope: 'place', venueId: 'harbour', placeName: 'Harbourview Park', facilityName: null }),
    ]), ['2 diamonds at Lions Park', 'Harbourview Park']);
    assert.deepEqual(closedParks([
      c({ scope: 'diamond', venueId: 'lions', placeName: 'Lions Park', facilityName: 'Diamond 1' }),
      c({ scope: 'place', venueId: 'lions', placeName: 'Lions Park', facilityName: null }),
    ]), ['Lions Park'], 'a whole park closed later wins over its diamond');
    assert.deepEqual(closedParks([c({ scope: 'all', venueId: null, placeName: null, facilityName: null })]), ['All our fields']);
  });
  it('the "maybe" group says what it holds: typed by hand, no diamond recorded, or both', () => {
    assert.equal(W.typed(typedKind([{ linkedToPlace: false }])), 'Place typed by hand');
    assert.equal(W.typed(typedKind([{ linkedToPlace: true }])), 'No diamond recorded');
    assert.equal(W.typed(typedKind([{ linkedToPlace: true }, { linkedToPlace: false }])), 'Typed place or no diamond');
    assert.equal(W.doneTyped(1, 'noDiamond'), '1 game with no diamond recorded wasn’t changed.');
    assert.equal(W.doneTyped(2), '2 games with a typed place weren’t changed.');
  });
});

describe('the admin\'s ticks survive a change of places (the drawing\'s tab 2)', () => {
  const lg = (id: string, o: Partial<CloseLeagueGame> = {}): CloseLeagueGame => ({
    id, seasonId: 's1', divisionId: 'u11', published: true, homeTeamId: `${id}h`, awayTeamId: `${id}a`, home: 'A', away: 'B',
    scheduledAt: '2026-11-28T14:00:00Z', field: 'Diamond 1', venueId: 'lions', typed: null, linkedToPlace: true, place: 0, match: 'linked',
    started: false, seen: 'x', ...o,
  });
  const rp = (id: string, o: Partial<CloseRepGame> = {}): CloseRepGame => ({
    id, teamId: 't', teamName: 'T', opponent: null, startsAt: '2026-11-28T17:30:00Z', field: null, venueId: 'lions', typed: null,
    linkedToPlace: true, place: 0, match: 'linked', started: false, seen: 'x', ...o,
  });
  const src = (league: CloseLeagueGame[], rep: CloseRepGame[] = []): CloseSource => ({
    today: DAY, places: [lions], seasons: [], league, rep, repHidden: false, tournaments: [], practices: 0, families: [], repReach: {},
  });
  it('an unticked game stays unticked; a new park\'s games arrive with the opening ticks', () => {
    const known = new Map([['a', { ticked: false, started: false }], ['b', { ticked: true, started: false }]]);
    const out = carryTicks(src([lg('a'), lg('b'), lg('c'), lg('typed', { match: 'maybe' })], [rp('r')]), known);
    assert.deepEqual([...out].sort(), ['b', 'c', 'r']);
  });
  it('K7 · the window\'s own tick is never carried: a game that becomes a "maybe" is unticked, and the reverse is ticked', () => {
    // Nothing the admin touched: narrowing a whole park to one diamond leaves its no-diamond game unticked again.
    assert.deepEqual([...carryTicks(src([lg('a', { match: 'maybe' }), lg('b')]), new Map())], ['b']);
    assert.deepEqual([...carryTicks(src([lg('a')]), new Map())], ['a']);
    // What the admin set stays, whichever way the game now matches.
    assert.deepEqual([...carryTicks(src([lg('a', { match: 'maybe' })]), new Map([['a', { ticked: true, started: false }]]))], ['a']);
    assert.deepEqual([...carryTicks(src([lg('a')]), new Map([['a', { ticked: false, started: false }]]))], []);
  });
  it('K6 · a game that has started since is never left ticked, and never auto-ticked', () => {
    const known = new Map([['a', { ticked: true, started: false }], ['s', { ticked: true, started: true }]]);
    const out = carryTicks(src([lg('a', { started: true }), lg('s', { started: true }), lg('n', { started: true })]), known);
    assert.deepEqual([...out], ['s'], 'ticked as started stays; newly started drops; a new started one is not ticked');
  });
});

describe('D1 · a game at the park with no diamond, two of its diamonds closed', () => {
  const dc = (n: number) => ({ scope: 'diamond' as const, venueId: 'lions', placeName: 'Lions Park', facilityName: `Diamond ${n}` });
  it('its mark says the park, never one diamond, while two or more stand; one standing reads that one', () => {
    assert.equal(markPlaceOfAll([dc(1), dc(3)]), '2 diamonds at Lions Park');
    assert.equal(markPlaceOfAll([dc(3)]), 'Diamond 3 at Lions Park');
    assert.equal(markPlaceOfAll([dc(1), dc(1)]), 'Diamond 1 at Lions Park', 'two presses on one diamond are one diamond');
    assert.equal(markPlaceOfAll([{ scope: 'place', venueId: 'lions', placeName: 'Lions Park', facilityName: null }, dc(1)]), 'Lions Park');
    assert.equal(markPlaceOfAll([dc(1), { ...dc(2), venueId: 'harbour', placeName: 'Harbourview Park' }]), 'Diamond 1 at Lions Park');
  });
  it('the coach\'s email names it once, by its park; Reopen of the last says the diamonds there reopened (/legal)', () => {
    const club = 'Kestrel Bay Softball Association';
    const closure = { scope: 'diamond' as const, placeName: 'Lions Park', facilityName: 'Diamond 1', firstDay: DAY, lastDay: DAY };
    const game = { startsAt: '2026-11-28T17:30:00Z', opponent: 'Marlow Heights', closure, placeWords: '2 diamonds at Lions Park' };
    assert.equal(COACH_MAIL.subject('U13 Ospreys', [game]), '2 diamonds at Lions Park are closed: U13 Ospreys game needs a new date');
    assert.match(COACH_MAIL.body(club, [game]), /^Kestrel Bay Softball Association closed 2 diamonds at Lions Park on Sat, Nov 28\. Your game there that day/);
    // /legal 2026-11-26: never "Lions Park reopened" (it overstates) nor a count a later press could contradict.
    const reopened = { ...game, placeWords: undefined, reopenPark: 'Lions Park' };
    assert.equal(COACH_MAIL.reopenSubject('U13 Ospreys', [reopened]), 'Diamonds at Lions Park reopened: U13 Ospreys game wasn’t moved');
    assert.equal(COACH_MAIL.reopenBody(club, [reopened]),
      'Kestrel Bay Softball Association reopened the diamonds at Lions Park that were closed. Your game on Sat, Nov 28 at 12:30 p.m. wasn’t moved. Keep it or move it.');
    // A reopen whose games disagree says the closure's own place.
    const other = { ...game, placeWords: undefined, closure: { ...closure, facilityName: 'Diamond 3' } };
    assert.match(COACH_MAIL.reopenBody(club, [{ ...reopened, closure: other.closure }, other]), /reopened Diamond 3 at Lions Park\./);
  });
  it('Reopen says the game stays marked while the other diamond is closed', () => {
    assert.equal(W.reopenKept(1, ['Diamond 1 at Lions Park']), '1 rep game stays marked while Diamond 1 at Lions Park is still closed. Its coach is told when that reopens.');
    assert.equal(W.reopenKept(2, ['2 diamonds at Lions Park']), '2 rep games stay marked while 2 diamonds at Lions Park are still closed. Their coaches are told when that reopens.');
    // Games held by different places name them all (never only the first holder's).
    assert.equal(W.reopenKept(2, ['Diamond 2 at Lions Park', 'Harbourview Park']), '2 rep games stay marked while Diamond 2 at Lions Park and Harbourview Park are still closed. Their coaches are told when those reopen.');
    assert.equal(W.reopenKept(1, ['All our fields']), '1 rep game stays marked while all our fields are still closed. Its coach is told when that reopens.');
  });
  it('a later whole-park closure is said as the park, never as one of its diamonds', () => {
    const park = { scope: 'place' as const, venueId: 'lions', placeName: 'Lions Park', facilityName: null };
    assert.equal(markPlaceOfAll([dc(1), dc(2), park]), 'Lions Park');
    assert.equal(markPlaceOfAll([dc(1), { scope: 'all', venueId: null, placeName: null, facilityName: null }]), 'All our fields');
  });
  it('the Rain delay\'s line: one park "Its diamonds", more "Their", three or more by count', () => {
    assert.deepEqual(W.rainDelayPlaces([d(1), d(2)]), { words: '2 diamonds at Lions Park', several: false });
    assert.deepEqual(W.rainDelayPlaces([harbour, lions]), { words: 'Harbourview Park and Lions Park', several: true });
    assert.deepEqual(W.rainDelayPlaces([harbour, lions, pine]), { words: '3 places', several: true });
    assert.equal(W.rainDelayLine('Kestrel Bay', '3 places', DAY, DAY, true), 'Kestrel Bay closed 3 places today. Their diamonds are picked below.');
  });
});
