import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  daysAndClocksWords, divisionTimeLine, groupLeagueTime, groupTick, hasNotGiven, hoursAWeek, leaguePiece, leagueTimeMinutes,
  LEAGUE_TIME_WORDS, partsWords, partTick, pieceChanges, pieceDayWords, pieceMinutes, piecePartWords, practicesRemovedBy,
  readChangesBody, rowChanges, stageParts, timeLineWords, toggleParts,
  type LeagueTimeSlot,
} from '../../lib/league-time.ts';

/**
 * CLUB TIER STAGE 11b PART 3 — HOUSE LEAGUE'S TIME, READ (frame k2). The window groups the club's house-league slots into
 * parts (a weekday, a clock and a facility across the weeks), rows (one use, Not given yet last) and stretches (one block
 * of the club's schedule). The drawing's own sample: Maple Grove, Mon to Thu 6:00–9:00 p.m. and Sat 10:00 a.m.–1:00 p.m.
 * on two diamonds, cut into 90-minute slots.
 */

const U12 = '11111111-1111-4111-8111-111111111111';
const U14 = '22222222-2222-4222-8222-222222222222';
const SCHEDULE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const D1 = 'f1', D2 = 'f2';

let n = 0;
/** One slot a week for two weeks. Jun 7, 2027 is a Monday. */
function weekly(weekday: number, start: string, end: string, facilityId: string, block: string, use: LeagueTimeSlot['use']): LeagueTimeSlot[] {
  return [7, 14].map(d => ({
    id: `s${++n}`, scheduleId: SCHEDULE, blockId: block, venueId: 'v1', facilityId,
    day: `2027-06-${String(d + weekday - 1).padStart(2, '0')}`, weekday, start, end, use,
  }));
}

const games12 = { divisionId: U12, kind: 'games' as const };
const practice12 = { divisionId: U12, kind: 'practices' as const };
const games14 = { divisionId: U14, kind: 'games' as const };

const slots: LeagueTimeSlot[] = [];
for (const f of [D1, D2]) {
  for (const day of [2, 4]) slots.push(...weekly(day, '18:00', '19:30', f, 'A', games12), ...weekly(day, '19:30', '21:00', f, 'A', null));
  for (const day of [1, 3]) slots.push(...weekly(day, '18:00', '19:30', f, 'A', practice12), ...weekly(day, '19:30', '21:00', f, 'A', practice12));
}
slots.push(...weekly(6, '10:00', '11:30', D1, 'B', games14), ...weekly(6, '11:30', '13:00', D1, 'B', null),
  ...weekly(6, '10:00', '11:30', D2, 'B', null));

const sources = groupLeagueTime({
  slots,
  schedules: [{ id: SCHEDULE, name: 'Maple Grove · summer 2027', startsOn: '2027-06-01', endsOn: '2027-08-31' }],
  divisions: [{ id: U12, name: 'U12' }, { id: U14, name: 'U14' }],
  placeOf: (_v, f) => (f === D1 ? 'Diamond 1' : 'Diamond 2'),
  venueOf: () => 'Maple Grove Park',
});

describe('House league’s time — grouped as the window reads it (k2)', () => {
  it('one source per schedule, named with its dates and venues', () => {
    assert.equal(sources.length, 1);
    assert.equal(sources[0].name, 'Maple Grove · summer 2027');
    assert.deepEqual(sources[0].venues, ['Maple Grove Park']);
  });

  it('a stretch per block, in the week’s order, titled by the time house league holds in it', () => {
    const titles = sources[0].stretches.map(s => s.title);
    assert.equal(titles.length, 2);
    assert.equal(titles[0], 'Mon, Tue, Wed and Thu · 6:00–9:00 p.m. · Diamond 1 and Diamond 2');
    assert.equal(titles[1], 'Sat · 10:00 a.m.–1:00 p.m. · Diamond 1 and Diamond 2');
  });

  it('rows follow the divisions, games before practice time, Not given yet last', () => {
    assert.deepEqual(sources[0].stretches[0].rows.map(r => r.label), ['U12 games', 'U12 practice time', 'Not given yet']);
    assert.deepEqual(sources[0].stretches[1].rows.map(r => r.label), ['U14 games', 'Not given yet']);
  });

  it('a row’s detail joins touching clocks and gathers days and facilities that share one', () => {
    const [games, practice, open] = sources[0].stretches[0].rows;
    assert.equal(games.detail, 'Tue and Thu · 6:00–7:30 p.m. · Diamond 1 and Diamond 2');
    assert.equal(practice.detail, 'Mon and Wed · 6:00–9:00 p.m. · Diamond 1 and Diamond 2');
    assert.equal(open.detail, 'Tue and Thu · 7:30–9:00 p.m. · Diamond 1 and Diamond 2');
    // Shapes that don't line up are each said.
    assert.equal(sources[0].stretches[1].rows[1].detail,
      'Sat · 10:00–11:30 a.m. · Diamond 2; Sat · 11:30 a.m.–1:00 p.m. · Diamond 1');
  });

  it('hours add up across facilities, one slot a week per part (the hours line)', () => {
    const [games, practice, open] = sources[0].stretches[0].rows;
    assert.equal(hoursAWeek(games.minutesAWeek), '6 hours a week');
    assert.equal(hoursAWeek(practice.minutesAWeek), '12 hours a week');
    assert.equal(hoursAWeek(open.minutesAWeek), '6 hours a week');
    assert.equal(hoursAWeek(sources[0].stretches[1].rows[0].minutesAWeek), '1.5 hours a week');
    assert.equal(hoursAWeek(60), '1 hour a week');
    assert.equal(leagueTimeMinutes(sources), (6 + 12 + 6 + 4.5) * 60);
  });

  it('a part carries every week’s slot, so a give names them all', () => {
    const part = sources[0].stretches[0].rows[0].parts[0];
    assert.equal(part.slotIds.length, 2);
    assert.equal(part.firstDay < part.lastDay, true);
    assert.equal(hasNotGiven(sources), true);
  });

  it('nothing given reads as no source at all', () => {
    assert.deepEqual(groupLeagueTime({ slots: [], schedules: [], divisions: [], placeOf: () => '', venueOf: () => '' }), []);
  });

  it('a division no longer the season’s still shows its time, never dropped', () => {
    const gone = groupLeagueTime({
      slots: weekly(2, '18:00', '19:30', D1, 'A', { divisionId: '33333333-3333-4333-8333-333333333333', kind: 'games' }),
      schedules: [{ id: SCHEDULE, name: 'S', startsOn: '2027-06-01', endsOn: '2027-08-31' }],
      divisions: [], placeOf: () => 'Diamond 1', venueOf: () => 'Park',
    });
    assert.equal(gone[0].stretches[0].rows[0].label, 'Former division games');
  });
});

describe('partsWords — one facility, a venue, every day', () => {
  it('says each shape once, Monday first', () => {
    assert.equal(partsWords([{ weekday: 7, start: '09:00', end: '10:00', place: 'Field 1' }, { weekday: 1, start: '09:00', end: '10:00', place: 'Field 1' }]),
      'Mon and Sun · 9:00–10:00 a.m. · Field 1');
  });
  it('three numbered facilities read as a range', () => {
    assert.equal(partsWords(['Field 1', 'Field 2', 'Field 3'].map(place => ({ weekday: 2, start: '18:00', end: '19:00', place }))),
      'Tue · 6:00–7:00 p.m. · Fields 1–3');
  });
});

describe('readChangesBody — a Save names each slot once, what the window saw on it, and what it gets', () => {
  const A = U12, B = U14;
  it('takes a mixed Save: one slot given, another given back', () => {
    const body = { changes: [{ slotId: A, from: null, to: games14 }, { slotId: B, from: practice12, to: null }] };
    assert.deepEqual(readChangesBody(body), body.changes);
  });
  it('refuses a change that doesn’t say what it saw, or where it goes (/ux: never a give over unseen time)', () => {
    assert.equal(readChangesBody({ changes: [{ slotId: A, to: games14 }] }), null);
    assert.equal(readChangesBody({ changes: [{ slotId: A, from: null }] }), null);
    assert.equal(readChangesBody({ changes: [{ slotId: A, from: { kind: 'games' }, to: null }] }), null);
  });
  it('refuses a slot named twice, an unknown kind, no changes or a malformed id', () => {
    assert.equal(readChangesBody({ changes: [{ slotId: A, from: null, to: games14 }, { slotId: A, from: null, to: games12 }] }), null);
    assert.equal(readChangesBody({ changes: [{ slotId: A, from: null, to: { divisionId: U12, kind: 'tryouts' } }] }), null);
    assert.equal(readChangesBody({ changes: [] }), null);
    assert.equal(readChangesBody({ changes: [{ slotId: 'nope', from: null, to: null }] }), null);
    assert.equal(readChangesBody(null), null);
  });
  it('a whole row given in one pick is one change per slot, from the row’s use', () => {
    const open = sources[0].stretches[0].rows[2];
    const changes = rowChanges(open, games12);
    assert.equal(changes.length, 8);
    assert.ok(changes.every(c => c.from === null && c.to === games12));
  });
});

describe('A division’s piece — parts without their use, ticks that stage, one Save (ruled 2026-10-27)', () => {
  // Mixed: U12 holds one of Saturday 11:30's two weeks on Diamond 1 (a one-date Use, or a schedule extended).
  const sat = weekly(6, '11:30', '13:00', D1, 'B', null);
  const mixedSlots = [...slots.filter(s => !(s.weekday === 6 && s.start === '11:30')), { ...sat[0], use: games12 }, sat[1]];
  const mixedSources = groupLeagueTime({
    slots: mixedSlots,
    schedules: [{ id: SCHEDULE, name: 'Maple Grove · summer 2027', startsOn: '2027-06-01', endsOn: '2027-08-31' }],
    divisions: [{ id: U12, name: 'U12' }, { id: U14, name: 'U14' }],
    placeOf: (_v, f) => (f === D1 ? 'Diamond 1' : 'Diamond 2'), venueOf: () => 'Maple Grove Park',
  });
  const piece = leaguePiece(mixedSources, games12);
  const parts = piece.flatMap(s => s.days.flatMap(d => d.parts));
  const find = (weekday: number, start: string, place: string) => parts.find(p => p.weekday === weekday && p.start === start && p.place === place)!;

  it('groups by stretch, then weekday, each part one clock on one facility', () => {
    assert.equal(piece.length, 2);
    assert.deepEqual(piece[0].days.map(d => pieceDayWords(d.weekday)), ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays']);
    assert.equal(piecePartWords(piece[0].days[1].parts[0]), '6:00–7:30 p.m. · Diamond 1');
    assert.equal(piece[0].days[1].parts.length, 4);
  });
  it('a part is mine, free, held, or mixed — a held part has no box', () => {
    assert.equal(partTick(find(2, '18:00', 'Diamond 1'), {}), 'on');
    assert.equal(partTick(find(2, '19:30', 'Diamond 1'), {}), 'off');
    assert.equal(partTick(find(1, '18:00', 'Diamond 1'), {}), null);
    assert.deepEqual(find(1, '18:00', 'Diamond 1').held.map(h => h.use), [practice12]);
    const mixed = find(6, '11:30', 'Diamond 1');
    assert.equal(partTick(mixed, {}), 'mixed');
    assert.equal(LEAGUE_TIME_WORDS.piece.ofDates(mixed.mine.length, mixed.mine.length + mixed.free.length), '1 of 2 dates');
  });
  it('ticking a mixed part takes its free dates; unticking gives this division’s back', () => {
    const mixed = find(6, '11:30', 'Diamond 1');
    const on = toggleParts([mixed], {});
    assert.equal(on[mixed.key], 'all');
    assert.deepEqual(pieceChanges(piece, games12, on), mixed.free.map(slotId => ({ slotId, from: null, to: games12 })));
    const off = toggleParts([mixed], on);
    assert.deepEqual(pieceChanges(piece, games12, off), mixed.mine.map(slotId => ({ slotId, from: games12, to: null })));
  });
  it('a group tick is tri-state and toggles everything with a box under it', () => {
    const tuesdays = piece[0].days[1].parts;
    assert.equal(groupTick(tuesdays, {}), 'mixed');
    const all = toggleParts(tuesdays, {});
    assert.equal(groupTick(tuesdays, all), 'on');
    // Only the two free Tuesday parts are changes: the two already U12's drop out.
    assert.equal(Object.keys(all).length, 2);
    assert.equal(groupTick(tuesdays, toggleParts(tuesdays, all)), 'off');
    // Mondays are all U12 practice time: no box at all.
    assert.equal(groupTick(piece[0].days[0].parts, {}), null);
  });
  it('a stage back to how a part already is drops out of the count', () => {
    const p = find(2, '19:30', 'Diamond 1');
    assert.deepEqual(stageParts([p], stageParts([p], {}, 'all'), 'none'), {});
  });
  it('the piece’s hours count the parts it has or is staged to have', () => {
    assert.equal(hoursAWeek(pieceMinutes(piece, {})), '7.5 hours a week');
    assert.equal(hoursAWeek(pieceMinutes(piece, toggleParts(piece[0].days[1].parts, {}))), '10.5 hours a week');
  });
  it('giving back time with practices on it removes the ones on time that stops being their practice time', () => {
    const practices = [{ slotId: 'p1', divisionId: U12, team: 'Reds' }, { slotId: 'p2', divisionId: U12, team: 'Blues' }];
    assert.deepEqual(practicesRemovedBy([{ slotId: 'p1', from: practice12, to: null }], practices), [practices[0]]);
    assert.deepEqual(practicesRemovedBy([{ slotId: 'p2', from: practice12, to: practice12 }], practices), []);
    assert.equal(LEAGUE_TIME_WORDS.ask.title('U12', 'practices', 2, false), 'Give back 2 parts of U12’s practice time?');
    assert.equal(LEAGUE_TIME_WORDS.ask.title('U12', 'practices', 4, true), 'Give back all of U12’s practice time?');
    assert.equal(LEAGUE_TIME_WORDS.ask.note(['U12 Blue', 'U12 Red']),
      'U12 Blue and U12 Red have practices on this time. Saving removes the ones still to come. Past practices stay.');
    assert.equal(LEAGUE_TIME_WORDS.ask.confirm(6), 'Save and remove 6 practices');
  });
});

describe('The time line — where a division’s time comes from, days and clocks, no facilities', () => {
  it('says games and practice time, each as its own clause', () => {
    const w = timeLineWords('U12', divisionTimeLine(sources, U12))!;
    assert.equal(`${w.lead}${w.schedules.join(' and ')}${w.tail}`,
      'U12’s time comes from the club’s schedule, Maple Grove · summer 2027. Games: Tue and Thu, 6:00–7:30 p.m. Practice time: Mon and Wed, 6:00–9:00 p.m.');
  });
  it('a clause only for what the division has; none at all is no line of time', () => {
    const w = timeLineWords('U14', divisionTimeLine(sources, U14))!;
    assert.equal(w.tail, '. Games: Sat, 10:00–11:30 a.m.');
    assert.equal(timeLineWords('U9', divisionTimeLine(sources, '44444444-4444-4444-8444-444444444444')), null);
    assert.equal(LEAGUE_TIME_WORDS.line.none('U9'), 'U9 has no time from the club yet.');
  });
  it('two clocks on one day read joined; a day’s facilities never repeat it', () => {
    assert.equal(daysAndClocksWords([
      { weekday: 6, start: '10:00', end: '11:30' }, { weekday: 6, start: '13:00', end: '14:00' }, { weekday: 6, start: '10:00', end: '11:30' },
    ]), 'Sat, 10:00–11:30 a.m. and 1:00–2:00 p.m.');
  });
});
