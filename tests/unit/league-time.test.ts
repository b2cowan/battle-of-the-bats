import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  groupLeagueTime, hasNotGiven, hoursAWeek, leagueTimeMinutes, partsWords, readGiveBody,
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

describe('readGiveBody — a give names its slots and who they go to', () => {
  const id = U12;
  it('takes a division’s games or practice time, from Not given yet', () => {
    assert.deepEqual(readGiveBody({ slotIds: [id, id], divisionId: U14, kind: 'games', from: null }),
      { slotIds: [id], divisionId: U14, kind: 'games', from: null });
  });
  it('takes a give back (kind null), dropping any division, from the use the window saw', () => {
    assert.deepEqual(readGiveBody({ slotIds: [id], divisionId: U14, kind: null, from: { divisionId: U14, kind: 'practices' } }),
      { slotIds: [id], divisionId: null, kind: null, from: { divisionId: U14, kind: 'practices' } });
  });
  it('refuses a give that doesn’t say what it saw (/ux: the SQL step overwrites whoever holds a slot)', () => {
    assert.equal(readGiveBody({ slotIds: [id], divisionId: U14, kind: 'games' }), null);
    assert.equal(readGiveBody({ slotIds: [id], divisionId: U14, kind: 'games', from: { kind: 'games' } }), null);
  });
  it('refuses a use with no division, an unknown kind, no slots or a malformed id', () => {
    assert.equal(readGiveBody({ slotIds: [id], kind: 'games', from: null }), null);
    assert.equal(readGiveBody({ slotIds: [id], divisionId: U14, kind: 'tryouts', from: null }), null);
    assert.equal(readGiveBody({ slotIds: [], divisionId: U14, kind: 'games', from: null }), null);
    assert.equal(readGiveBody({ slotIds: ['nope'], divisionId: U14, kind: 'games', from: null }), null);
    assert.equal(readGiveBody(null), null);
  });
});
