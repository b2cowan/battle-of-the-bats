import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLOSE_WORDS as W, alsoWords, closureRows, defaultTicks, oneSentence, pressedWords, reopenSite, rowsUnder, venueTags,
  closedDays, pickedLabel, rowLinesUnder, staysLines,
  type ClosureFacts, type CloseSource, type StaffClosure,
} from '../../lib/place-closure-window.ts';
import { COACH_MAIL, type CoachMailGame } from '../../lib/place-closure-mail-words.ts';

/**
 * Club Website "Closed places, summarized", Session B (S4–S6, T2; owner 2026-11-26 "Build as you've written"): the Venue
 * library's one box, the venue tag, what each Reopen window says the site does, and the coach's combined reopen email
 * (/legal 2026-11-26). Pure: the rules the page, the windows and the server share.
 */
const NOW = '2026-11-26T20:00:00Z'; // 3:00 p.m. in the club's zone
const TODAY = '2026-11-26';
const MIDNIGHT = '2026-11-27T05:00:00Z';
let n = 0;
const c = (o: Partial<StaffClosure> = {}): StaffClosure => ({
  id: `c${++n}`, scope: 'diamond', venueId: 'lions', placeName: 'Lions Park', facilityName: 'Diamond 1', firstDay: TODAY, lastDay: TODAY,
  verb: 'postponed', closedAt: '2026-11-26T20:25:00Z', closedBy: 'Dana Reyes', showsFrom: '2026-11-26T20:25:00Z', endsAt: MIDNIGHT,
  ...o,
});
const f = (closure: StaffClosure, calledOff: string[] = [], markEvents: string[] = []): ClosureFacts =>
  ({ closure, calledOff, markEvents });
const NONE = new Set<string>();

describe('S4 · one box, a row per park and dates', () => {
  it('two diamonds of a park are one row, each game counted once, two presses said as two times', () => {
    const d1 = c({ facilityName: 'Diamond 1' });
    const d2 = c({ facilityName: 'Diamond 2', closedAt: '2026-11-26T20:40:00Z' });
    const rows = closureRows([f(d1, ['g1'], ['r1']), f(d2, ['g1', 'g2'], ['r1'])], NONE);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, 'Diamond 1 and Diamond 2 at Lions Park');
    assert.deepEqual(rows[0].lines, ['For Thu, Nov 26, closed at 3:25 p.m. and 3:40 p.m. by Dana Reyes', '2 postponed, 1 rep game marked']);
    assert.deepEqual(rows[0].diamonds.map(x => x.name), ['Diamond 1', 'Diamond 2']);
    for (const line of rows[0].lines) assert.doesNotMatch(line, /·/, 'no dotted line (owner 2026-11-26)');
  });
  it('a whole park reads "All diamonds at" only when every facility is a diamond; "All our fields" leads, the rest under it', () => {
    const all = c({ scope: 'all', venueId: null, placeName: null, facilityName: null });
    const park = c({ scope: 'place', venueId: 'alder', placeName: 'Alder Fields', facilityName: null });
    const gym = c({ scope: 'place', venueId: 'gym', placeName: 'Riverside Gym', facilityName: null });
    const rows = closureRows([f(park), f(gym), f(all)], new Set(['alder']));
    assert.deepEqual(rows.map(r => [r.title, r.under === null]), [['All our fields', true], ['All diamonds at Alder Fields', false], ['Riverside Gym', false]]);
    assert.equal(rowsUnder(rows, rows[0].key).length, 2);
  });
  it('different days are different rows; with no all-fields closure a park\'s diamond sits under its whole closure (item 5)', () => {
    const whole = c({ scope: 'place', facilityName: null });
    const d2 = c({ facilityName: 'Diamond 2', lastDay: '2026-11-29' });
    const other = c({ venueId: 'alder', placeName: 'Alder Fields', facilityName: 'Diamond 1' });
    const rows = closureRows([f(d2), f(other), f(whole)], NONE);
    assert.deepEqual(rows.map(r => r.title), ['Diamond 1 at Alder Fields', 'Lions Park', 'Diamond 2 at Lions Park']);
    assert.equal(rows[2].under, rows[1].key);
    assert.deepEqual(rows[2].lines.slice(0, 1), ['For Thu, Nov 26 to Sun, Nov 29, closed at 3:25 p.m. by Dana Reyes']);
  });
  it('a row sits under a wider one only on days they share (/review)', () => {
    const whole = c({ scope: 'place', facilityName: null });
    const later = c({ facilityName: 'Diamond 1', firstDay: '2026-12-05', lastDay: '2026-12-05', endsAt: '2026-12-06T05:00:00Z' });
    const rows = closureRows([f(whole), f(later)], NONE);
    assert.ok(rows.every(r => r.under === null), 'Dec 5 is not "also closed" under a Nov 26 closure');
    const all = c({ scope: 'all', venueId: null, placeName: null, facilityName: null });
    assert.ok(closureRows([f(all), f(later)], NONE).every(r => r.under === null));
  });
  it('the same place pressed again for longer: "It stays closed", and no line naming itself', () => {
    const short = c({ scope: 'place', facilityName: null });
    const long = c({ scope: 'place', facilityName: null, lastDay: '2026-11-29', endsAt: '2026-11-30T05:00:00Z' });
    const s = reopenSite([short, long], new Set([short.id]), NONE, NOW);
    assert.equal(s.kind === 'covered' && s.samePlace, true);
  });
  it('item 8 · who pressed: two closers, three presses, nobody named', () => {
    const at = (t: string, by: string | null) => ({ closedAt: `2026-11-26T${t}:00Z`, closedBy: by });
    assert.equal(pressedWords([at('20:25', 'Dana Reyes'), at('20:40', 'Sam Lee')]), 'closed at 3:25 p.m. by Dana Reyes and 3:40 p.m. by Sam Lee');
    assert.equal(pressedWords([at('20:25', 'Dana Reyes'), at('20:40', 'Dana Reyes'), at('21:00', 'Dana Reyes')]), 'closed by Dana Reyes');
    assert.equal(pressedWords([at('20:25', 'A'), at('20:40', 'B'), at('21:00', 'C')]), 'closed by 3 people');
    assert.equal(pressedWords([at('20:25', null), at('20:40', null), at('21:00', null)]), 'closed 3 times');
    assert.equal(pressedWords([at('20:25', 'Dana Reyes'), at('20:25', 'Dana Reyes')]), 'closed at 3:25 p.m. by Dana Reyes', 'one press is one instant');
  });
  it('the venue tag tells the truth: a park with only some diamonds closed is not "Closed today"', () => {
    const d1 = c({ facilityName: 'Diamond 1' }); const d2 = c({ facilityName: 'Diamond 2' });
    assert.deepEqual(venueTags([d1], 'lions', TODAY), ['1 diamond closed today']);
    assert.deepEqual(venueTags([d1, d2], 'lions', TODAY), ['2 diamonds closed today']);
    assert.deepEqual(venueTags([d1, c({ scope: 'place', facilityName: null })], 'lions', TODAY), ['Closed today']);
    assert.deepEqual(venueTags([c({ scope: 'all', venueId: null })], 'alder', TODAY), ['Closed today']);
    assert.deepEqual(venueTags([d1], 'alder', TODAY), []);
  });
  it('tomorrow gets its own tag when a closure starting tomorrow adds something (owner 2026-11-27)', () => {
    const next = { firstDay: '2026-11-27', lastDay: '2026-11-27' };
    const whole = c({ scope: 'place', facilityName: null, ...next });
    assert.deepEqual(venueTags([whole], 'lions', TODAY), ['Closed tomorrow']);
    assert.deepEqual(venueTags([c({ facilityName: 'Diamond 1' }), whole], 'lions', TODAY), ['1 diamond closed today', 'Closed tomorrow']);
    assert.deepEqual(venueTags([c({ facilityName: 'Diamond 2', ...next })], 'lions', TODAY), ['1 diamond closed tomorrow']);
    // A diamond closed through tomorrow counts in tomorrow's figure beside one starting then.
    assert.deepEqual(venueTags([c({ facilityName: 'Diamond 1', lastDay: '2026-11-27' }), c({ facilityName: 'Diamond 2', ...next })], 'lions', TODAY),
      ['1 diamond closed today', '2 diamonds closed tomorrow']);
    // Already closed whole through tomorrow: nothing to add.
    assert.deepEqual(venueTags([c({ scope: 'place', facilityName: null, lastDay: '2026-11-29' }), whole], 'lions', TODAY), ['Closed today']);
    assert.deepEqual(venueTags([c({ scope: 'place', facilityName: null, firstDay: '2026-11-28', lastDay: '2026-11-28' })], 'lions', TODAY), []);
  });
});

describe('days and ticks (owner 2026-11-27, "build it as sketched")', () => {
  it('a closure never sits under a wider one that starts later: today\'s would read as tomorrow\'s', () => {
    const all = c({ scope: 'all', venueId: null, placeName: null, facilityName: null, firstDay: '2026-11-27', lastDay: '2026-11-27' });
    const park = c({ scope: 'place', facilityName: null, lastDay: '2026-11-29' });
    const days = closedDays(closureRows([f(all), f(park)], NONE), TODAY);
    assert.deepEqual(days.map(d => [d.label, d.rows.map(r => r.title)]), [
      ['Thu, Nov 26 to Sun, Nov 29', ['Lions Park']],
      ['Tomorrow, Fri, Nov 27', ['All our fields']],
    ]);
  });
  const next = { firstDay: '2026-11-27', lastDay: '2026-11-27', endsAt: '2026-11-28T05:00:00Z' };
  const park = (venueId: string, placeName: string, o: Partial<StaffClosure> = {}) =>
    c({ scope: 'place', venueId, placeName, facilityName: null, ...o });
  it('a heading per day, soonest first, so tomorrow is never lost at the foot; a row says its days only where they differ', () => {
    const rows = closureRows([f(park('lions', 'Lions Park', next)), f(park('pine', 'Pinecrest Park'), ['g1']), f(c({ facilityName: 'Diamond 1' }))], NONE);
    const days = closedDays(rows, TODAY);
    assert.deepEqual(days.map(d => [d.label, d.rows.map(r => r.title)]), [
      ['Today, Thu, Nov 26', ['Diamond 1 at Lions Park', 'Pinecrest Park']],
      ['Tomorrow, Fri, Nov 27', ['Lions Park']],
    ]);
    assert.deepEqual(rowLinesUnder(days[0].rows[1], days[0]), ['Closed at 3:25 p.m. by Dana Reyes', '1 postponed']);
    assert.equal(closedDays(closureRows([f(park('a', 'A', { lastDay: '2026-11-29' }))], NONE), TODAY)[0].label, 'Thu, Nov 26 to Sun, Nov 29');
    const later = { firstDay: '2026-12-05', lastDay: '2026-12-05' };
    assert.equal(closedDays(closureRows([f(park('a', 'A', later))], NONE), TODAY)[0].label, 'Sat, Dec 5');
  });
  it('a row under all our fields stays in that heading and says its own days when they differ', () => {
    const all = c({ scope: 'all', venueId: null, placeName: null, facilityName: null, lastDay: '2026-11-29' });
    const rows = closureRows([f(all), f(park('lions', 'Lions Park', next))], NONE);
    const days = closedDays(rows, TODAY);
    assert.equal(days.length, 1);
    assert.deepEqual(rowLinesUnder(days[0].rows[1], days[0]), ['For Fri, Nov 27, closed at 3:25 p.m. by Dana Reyes']);
  });
  it('the button counts places: a diamond is one, a park ticked for two days is one, all our fields is named', () => {
    const rows = closureRows([f(park('alder', 'Alder Fields')), f(c({ facilityName: 'Diamond 1' })), f(c({ facilityName: 'Diamond 2' })),
      f(park('alder', 'Alder Fields', next))], NONE);
    assert.equal(pickedLabel(rows), 'Reopen 3 places');
    assert.equal(pickedLabel(rows.filter(r => r.venueId === 'alder')), 'Reopen 1 place');
    const all = closureRows([f(c({ scope: 'all', venueId: null, placeName: null, facilityName: null }))], NONE);
    assert.equal(pickedLabel(all), 'Reopen all our fields');
    assert.equal(pickedLabel([...all, ...rows]), 'Reopen everything ticked');
    assert.equal(W.severalGo('Reopen 4 places', 2, false), 'Reopen and email 2 coaches');
    assert.equal(W.severalGo('Reopen 4 places', 0, false), 'Reopen 4 places');
    assert.equal(W.severalGo('Reopen 4 places', 2, true), 'Reopen 4 places, email 2');
  });
  it('a ticked row a closure left showing still says reads "Stays closed", and the others do not', () => {
    const all = c({ scope: 'all', venueId: null, placeName: null, facilityName: null });
    const d1 = c({ facilityName: 'Diamond 1' });
    const alder = park('alder', 'Alder Fields', next);
    const rows = closureRows([f(all), f(d1), f(alder)], NONE);
    const ids = new Set([d1.id, alder.id]);
    const line = (id: string) => staysLines(rows.find(r => r.closureIds.includes(id))!, [all, d1, alder], ids, NONE, NOW);
    assert.deepEqual(line(d1.id), ['Stays closed: all our fields are closed today']);
    assert.deepEqual(line(alder.id), []);
    assert.deepEqual(staysLines(rows.find(r => r.closureIds.includes(d1.id))!, [all, d1], new Set([all.id, d1.id]), NONE, NOW), []);
    // One that didn't come off is simply still closed, never "stays closed" because of itself.
    assert.deepEqual(staysLines(rows.find(r => r.closureIds.includes(d1.id))!, [d1, alder], new Set([alder.id]), NONE, NOW), []);
  });
  it('a row held only in part, or by two reasons, gets a line per reason with its places', () => {
    const through = { lastDay: '2026-11-29', endsAt: '2026-11-30T05:00:00Z' };
    const row = [1, 2, 3].map(i => c({ facilityName: `Diamond ${i}` }));
    const longer = [1, 2].map(i => c({ facilityName: `Diamond ${i}`, ...through }));
    const rows = closureRows(row.map(x => f(x)), NONE);
    const chosen = new Set(row.map(x => x.id));
    assert.deepEqual(staysLines(rows[0], [...row, ...longer], chosen, NONE, NOW), [
      'Diamond 1 at Lions Park stays closed: Diamond 1 at Lions Park is closed through Sun, Nov 29',
      'Diamond 2 at Lions Park stays closed: Diamond 2 at Lions Park is closed through Sun, Nov 29',
    ]);
    const all = c({ scope: 'all', venueId: null, placeName: null, facilityName: null, ...through });
    assert.deepEqual(staysLines(rows[0], [...row, all], chosen, NONE, NOW), ['Stays closed: all our fields are closed through Sun, Nov 29']);
  });
});

describe('Reopen never says the site stops saying what it still says', () => {
  const all = c({ scope: 'all', venueId: null, placeName: null, facilityName: null });
  it('a diamond all our fields covers: "It stays closed", by the wider one', () => {
    const d1 = c({ facilityName: 'Diamond 1' });
    const s = reopenSite([all, d1], new Set([d1.id]), NONE, NOW);
    assert.deepEqual(s, { kind: 'covered', by: 'All our fields are closed today.', byName: 'all our fields', samePlace: false });
    assert.equal(`${W.removeStays(false)}${W.removeBy(s.kind === 'covered' ? s.by : '')}`, 'It stays closed. All our fields are closed today, so your site doesn’t change.');
    assert.equal(W.removeThen('Diamond 1', 'all our fields'), 'Diamond 1 will then open when you reopen all our fields.');
  });
  it('item 3 · partly covered (all fields today, the diamond through Sunday): it reopens, and says what stays', () => {
    const d2 = c({ facilityName: 'Diamond 2', lastDay: '2026-11-29', endsAt: '2026-11-30T05:00:00Z' });
    const s = reopenSite([all, d2], new Set([d2.id]), NONE, NOW);
    assert.equal(s.kind, 'stops');
    if (s.kind !== 'stops') return;
    assert.equal(W.reopenSite(s.own ?? undefined), 'Your site stops saying Diamond 2 at Lions Park is closed through Sun, Nov 29, at once.');
    assert.equal(oneSentence(s.still), 'All our fields are closed today.');
  });
  it('S5 · one of two diamonds: the other still shows; both: nothing of the park is left', () => {
    const d1 = c({ facilityName: 'Diamond 1' }); const d2 = c({ facilityName: 'Diamond 2' });
    const one = reopenSite([d1, d2], new Set([d1.id]), NONE, NOW);
    assert.equal(one.kind === 'stops' && oneSentence(one.still), 'Diamond 2 at Lions Park is closed today.');
    const both = reopenSite([d1, d2], new Set([d1.id, d2.id]), NONE, NOW);
    assert.deepEqual(both, { kind: 'stops', still: null, own: null });
  });
  it('S6 · all fields alone: the site then says the diamonds closed on their own; an unrelated park is said too', () => {
    const d1 = c({ facilityName: 'Diamond 1' }); const d2 = c({ facilityName: 'Diamond 2' });
    const s = reopenSite([all, d1, d2], new Set([all.id]), NONE, NOW);
    assert.equal(s.kind === 'stops' && oneSentence(s.still), 'Diamond 1 and Diamond 2 at Lions Park are closed today.');
  });
  it('S6 · the warning names one or two parks, three or more by count, and the tick counts what it reopens', () => {
    const rows = (list: StaffClosure[]) => closureRows(list.map(x => f(x)), NONE);
    const two = alsoWords(rows([c({ facilityName: 'Diamond 1' }), c({ facilityName: 'Diamond 2' })]));
    assert.equal(W.alsoClosed(two.names, two.one), 'Diamond 1 and Diamond 2 at Lions Park are also closed on their own.');
    assert.equal(W.alsoTick(two.count, two.diamonds), 'Reopen those two diamonds as well');
    const one = alsoWords(rows([c({ scope: 'place', venueId: 'alder', placeName: 'Alder Fields', facilityName: null })]));
    assert.equal(W.alsoClosed(one.names, one.one), 'Alder Fields is also closed on its own.');
    assert.equal(W.alsoTick(one.count, one.diamonds), 'Reopen it as well');
    const many = alsoWords(rows(['a', 'b', 'c'].map(v => c({ scope: 'place', venueId: v, placeName: `Park ${v}`, facilityName: null }))));
    assert.equal(W.alsoClosed(many.names, many.one), '3 places are also closed on their own.');
    assert.equal(W.alsoTick(many.count, many.diamonds), 'Reopen those 3 places as well');
  });
  it('the buttons (items 7 and 9)', () => {
    // A computer says one short sentence when coaches are emailed, so both buttons share the window's row.
    assert.equal(W.reopenParkGo(['Diamond 1', 'Diamond 2'], 2, false), 'Reopen and email 2 coaches');
    assert.equal(W.reopenParkGo(['Diamond 1', 'Diamond 2'], 0, false), 'Reopen 2 diamonds');
    assert.equal(W.reopenParkGo(['Diamond 1', 'Diamond 2'], 2, true), 'Reopen 2 diamonds, email 2');
    assert.equal(W.reopenParkGo([], 0, false), 'Reopen');
    assert.equal(W.reopenWideGo(null, false, 0, false), 'Reopen all our fields');
    assert.equal(W.reopenWideGo(null, false, 2, false), 'Reopen and email 2 coaches');
    assert.equal(W.reopenWideGo('Lions Park', true, 2, false), 'Reopen and email 2 coaches');
    assert.equal(W.reopenWideGo(null, true, 2, true), 'Reopen everything, email 2');
    assert.equal(W.removeGo(false), 'Remove its closure');
  });
});

describe('T2 · an already-marked game is listed, never ticked, never counted', () => {
  it('the window lists it apart from what it ticks, and says how long it stays marked', () => {
    const src = { league: [], rep: [{ id: 'fresh', match: 'linked', started: false }],
      repHeld: [{ id: 'held', teamName: 'U13 Ospreys', opponent: null, startsAt: NOW, by: 'Diamond 1 at Lions Park', closures: 1 }] } as unknown as CloseSource;
    assert.deepEqual([...defaultTicks(src)], ['fresh']);
    assert.equal(W.heldNote({ by: 'Diamond 1 at Lions Park', closures: 1 }), 'Diamond 1 at Lions Park is closed. It stays marked until both reopen, and its coach isn’t emailed again.');
    assert.equal(W.heldNote({ by: '2 diamonds at Lions Park', closures: 2 }), '2 diamonds at Lions Park are closed. It stays marked until all of them reopen, and its coach isn’t emailed again.');
    const server = readFileSync(join(import.meta.dirname, '..', '..', 'lib/place-closure-window-server.ts'), 'utf8');
    assert.match(server, /src\.rep\.filter\(g => !held\.has\(g\.id\) && theirs\(g\)\)/, 'a held game never reaches the tickable list');
    assert.equal(W.doneHeld(1), '1 rep game was already marked. Its coach wasn’t emailed again.');
  });
});

describe('the coach\'s reopen email, several closures in one press (/legal 2026-11-26, Session B)', () => {
  const closure = (facilityName: string | null, scope: 'diamond' | 'place' | 'all' = 'diamond', placeName: string | null = 'Lions Park') =>
    ({ scope, placeName, facilityName, firstDay: '2026-11-28', lastDay: '2026-11-28' });
  const game = (o: Partial<CoachMailGame>): CoachMailGame =>
    ({ startsAt: '2026-11-28T17:30:00Z', opponent: null, closure: closure('Diamond 1'), ...o });
  it('one place: today\'s words, unchanged', () => {
    assert.equal(COACH_MAIL.reopenSubject('U13 Ospreys', [game({})]), 'Diamond 1 at Lions Park reopened: U13 Ospreys game wasn’t moved');
  });
  it('different parks: "Fields reopened", each game at its place', () => {
    const g = [game({ at: { park: 'Lions Park', diamond: 'Diamond 1' } }),
      game({ startsAt: '2026-11-29T15:00:00Z', closure: closure(null, 'place', 'Alder Fields'), at: { park: 'Alder Fields', diamond: null } })];
    assert.equal(COACH_MAIL.reopenSubject('U13 Ospreys', g), 'Fields reopened: U13 Ospreys games weren’t moved');
    assert.equal(COACH_MAIL.reopenBody('Kestrel Bay', g),
      'Kestrel Bay reopened some of its fields. Your games on Sat, Nov 28 at 12:30 p.m. at Diamond 1 at Lions Park and Sun, Nov 29 at 10:00 a.m. at Alder Fields weren’t moved. Keep them or move them.');
  });
  it('MUST-FIX · all our fields reopened while a place stays closed: the game\'s own place, never "all its fields"', () => {
    const all = closure(null, 'all', null);
    const known = game({ closure: all, at: { park: 'Alder Fields', diamond: null }, stillClosed: true });
    assert.equal(COACH_MAIL.reopenSubject('U13 Ospreys', [known]), 'Alder Fields reopened: U13 Ospreys game wasn’t moved');
    assert.equal(COACH_MAIL.reopenBody('Kestrel Bay', [known]), 'Kestrel Bay reopened Alder Fields. Your game on Sat, Nov 28 at 12:30 p.m. wasn’t moved. Keep it or move it.');
    const unknown = game({ closure: all, at: null, stillClosed: true });
    assert.equal(COACH_MAIL.reopenSubject('U13 Ospreys', [unknown]), 'Fields reopened: U13 Ospreys game wasn’t moved');
    assert.equal(COACH_MAIL.reopenBody('Kestrel Bay', [unknown]),
      'Kestrel Bay lifted its closure of all its fields. Some places stay closed on their own. Your game on Sat, Nov 28 at 12:30 p.m. wasn’t moved. Keep it or move it.');
    // Nothing stays closed: today's words are true.
    assert.equal(COACH_MAIL.reopenBody('Kestrel Bay', [game({ closure: all })]), 'Kestrel Bay reopened all its fields. Your game on Sat, Nov 28 at 12:30 p.m. wasn’t moved. Keep it or move it.');
    // A mixed list never says "all its fields".
    const mixed = [game({ closure: all, at: { park: 'Alder Fields', diamond: null }, stillClosed: true }),
      game({ startsAt: '2026-11-29T15:00:00Z', at: { park: 'Lions Park', diamond: 'Diamond 1' } })];
    assert.doesNotMatch(COACH_MAIL.reopenBody('Kestrel Bay', mixed), /all its fields/);
  });
  it('a game at the park with no diamond is not "Lions Park reopened" while a diamond there stays closed (/review)', () => {
    const g = game({ closure: closure(null, 'all', null), at: { park: 'Lions Park', diamond: null }, stillClosed: true, parkStillClosed: true });
    assert.doesNotMatch(COACH_MAIL.reopenSubject('U13 Ospreys', [g]), /Lions Park reopened/);
    assert.doesNotMatch(COACH_MAIL.reopenBody('Kestrel Bay', [g]), /reopened Lions Park/);
  });
  it('several days in one press: never "reopened Lions Park" while a diamond there is closed on one of them (/review 2026-11-27)', () => {
    const sat = game({ at: { park: 'Lions Park', diamond: 'Diamond 1' }, parkStillClosed: true });
    const sun = game({ startsAt: '2026-11-29T15:00:00Z', closure: closure(null, 'place'), at: { park: 'Lions Park', diamond: null } });
    assert.doesNotMatch(COACH_MAIL.reopenBody('Kestrel Bay', [sat, sun]), /reopened Lions Park\./);
    assert.match(COACH_MAIL.reopenBody('Kestrel Bay', [sat, sun]), /^Kestrel Bay reopened some of its fields\./);
    // With nothing there still closed, the park is the honest name.
    assert.match(COACH_MAIL.reopenBody('Kestrel Bay', [{ ...sat, parkStillClosed: false }, sun]), /^Kestrel Bay reopened Lions Park\./);
  });
  it('the email still writes no link', () => {
    assert.doesNotMatch(COACH_MAIL.reopenBody('Kestrel Bay', [game({ stillClosed: true, at: null })]), /https?:|<a/);
  });
});

describe('the Reopen windows count one as one (the design check, 2026-11-26)', () => {
  it('one coach is "was emailed", named only to a person who sees rep', () => {
    assert.equal(W.reopenedCoaches(1, null), ' 1 coach was emailed.');
    assert.equal(W.reopenedCoaches(1, 'U13 Ospreys'), ' The U13 Ospreys’ coach was emailed.');
    assert.equal(W.reopenedCoaches(2, null), ' 2 coaches were emailed.');
    assert.equal(W.reopenedCoaches(0, null), '');
  });
  it('one postponed game speaks of its families', () => {
    assert.match(W.reopenStillRest(1), /^ Its families were emailed, so give it a new date/);
    assert.match(W.reopenStillRest(2), /^ Their families were emailed, so give each a new date/);
  });
});

describe('two presses in one minute read as one time', () => {
  it('one person: one time; two people: both', () => {
    const at = (s: string, closedBy: string) => ({ closedAt: `2026-11-26T20:25:${s}Z`, closedBy });
    assert.equal(pressedWords([at('02', 'Dana Reyes'), at('40', 'Dana Reyes')]), 'closed at 3:25 p.m. by Dana Reyes');
    assert.equal(pressedWords([at('02', 'Dana Reyes'), at('40', 'Sam Lee')]), 'closed at 3:25 p.m. by Dana Reyes and 3:25 p.m. by Sam Lee');
  });
});
