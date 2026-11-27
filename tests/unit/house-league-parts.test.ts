import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { planPractices, splitFieldsOf, PRACTICE_TIME_WORDS as W, type PracticeTimeSlot, type PracticeTimeTeam } from '../../lib/league-practice-time.ts';
import { groupLeagueTime, partsShapes, placesWords, type LeagueTimeSlot } from '../../lib/league-time.ts';
import { gameSlotLookup, gameSlotsAt, type SeasonGameSlot } from '../../lib/league-season-calendar.ts';
import { asLastSent, placeDiffers, snapshotOf, type GameSnapshot, type HeldChange } from '../../lib/league-game-changes.ts';
import { leagueFingerprint, leagueRows, planLeagueChanges, type LeagueSlot, type LeagueSlotGame, type PracticeFace } from '../../lib/club-schedule-league-plan.ts';
import { leagueRowLine } from '../../lib/club-schedule-league-words.ts';
import { faceOfTold, placeOfTold, predictHandOut, toldKey, snapshotOf as toldSnapshotOf, type ToldPractice } from '../../lib/league-practice-tell.ts';
import { findLeagueBookingConflicts, keptPart, type LeagueBooking } from '../../lib/league-schedule-conflict.ts';
import { formatPartLocation, formatVenueLocation } from '../../lib/venue-label.ts';
import { projectClubSlots, type RawClubSlot } from '../../lib/league-club-schedule.ts';
import { mondayOfDay, utcToZonedInputs, zonedWallClockToUtc } from '../../lib/timezone.ts';
import type { PlacePart } from '../../lib/league-time.ts';

/**
 * CLUB SCHEDULES STAGE 2, SESSION 2E PART 1 — HOUSE LEAGUE CARRIES A PART FROM CLUB TIME (round 2 Asks 1 A and 5 A; tabs 6
 * and 8). House league never splits a field: a slot on a side arrives as a slot on a side. Practice time gives a side ONE
 * team whatever "Teams at once" says; the time row says "Field 1 in two sides, Field 3" and counts a side as half the
 * field's time; a game generated on side A is on side A; side A beside side B is no clash; side A → side B is a move.
 * With no split field every read is exactly as before parts.
 */

const F1 = 'f-1', F3 = 'f-3', DOME = 'v-dome';
const SIDE_A = 3, SIDE_B = 12;
const sideOf = (mask: number): PlacePart => ({ id: F1, name: 'Field 1', mask, sections: 2 });

// ── Practice time (tab 6) ────────────────────────────────────────────────────────────────────────────────────────────

let n = 0;
/** Sun 9:00 a.m.–1:30 p.m. for `weeks` Sundays from Jan 3, 2027 (Eastern, -05:00), on a place. */
function sundays(place: string, placeKey: string, field?: PlacePart, weeks = 4): PracticeTimeSlot[] {
  return Array.from({ length: weeks }, (_, i) => {
    const day = new Date(Date.UTC(2027, 0, 3 + i * 7)).toISOString().slice(0, 10);
    return {
      id: `s${++n}`, day, weekday: 7, start: '09:00', end: '13:30', startsAt: `${day}T09:00:00-05:00`, place, placeKey, venue: 'Milton Sports Dome',
      ...(field ? { field } : {}),
    };
  });
}
const tab6 = () => [
  ...sundays('Field 1 side A', `${DOME}|${F1}|3`, sideOf(SIDE_A)),
  ...sundays('Field 1 side B', `${DOME}|${F1}|12`, sideOf(SIDE_B)),
  ...sundays('Field 3', `${DOME}|${F3}`),
];
const u9 = (count: number): PracticeTimeTeam[] => Array.from({ length: count }, (_, i) => ({ id: `t${i + 10}`, name: `U9 Team ${i + 1}` }));
const settings = { practiceMinutes: 90, teamsAtOnce: 2, practicesAWeek: 1 };

describe('Practice time: a side holds one team (round 2 Ask 5 A)', () => {
  it('the drawing: Field 1 in two sides + Field 3, 90 minutes, 2 at once, 10 teams → the same 12 places a week, 2 open', () => {
    const plan = planPractices({ slots: tab6(), teams: u9(10), settings });
    assert.equal(plan.seatsAWeek, 12, 'Field 3: 3 starts × 2 at once; each side: 3 starts × 1');
    assert.equal(plan.perTeam, 1);
    assert.equal(plan.openAWeek, 2);
    assert.equal(W.everyTeam(plan.perTeam), 'Every team gets 1 practice a week.');
    assert.equal(W.open(plan.openAWeek), '2 slots stay open.');
  });

  it('never two teams on one side at one start; Field 3 may hold two', () => {
    const slots = tab6();
    const plan = planPractices({ slots, teams: u9(12), settings });
    const placeOf = new Map(slots.map(s => [s.id, s.place]));
    const at = new Map<string, number>();
    for (const r of plan.rows) {
      const k = `${placeOf.get(r.slotId)}|${r.scheduledAt}`;
      at.set(k, (at.get(k) ?? 0) + 1);
    }
    for (const [k, count] of at) assert.ok(count <= (k.startsWith('Field 3') ? 2 : 1), `${k} holds ${count}`);
    assert.ok([...at].some(([k, c]) => k.startsWith('Field 3') && c === 2), 'Field 3 still takes two at once');
  });

  it('side A and side B at one clock are two places, never one (no slot dropped)', () => {
    const slots = tab6();
    const plan = planPractices({ slots, teams: u9(12), settings });
    const placeOf = new Map(slots.map(s => [s.id, s.place]));
    const used = new Set(plan.rows.map(r => placeOf.get(r.slotId)));
    assert.ok(used.has('Field 1 side A') && used.has('Field 1 side B'), 'both sides hold practices');
    assert.equal(plan.rows.length, 12 * 4, 'every seat, every Sunday');
  });

  it('the time row: "Field 1 in two sides, Field 3", 9 hours a week (a side counts half the field\'s time)', () => {
    const slots = tab6().filter(s => s.day === '2027-01-03');
    const shapes = partsShapes(slots.map(x => ({ weekday: x.weekday, start: x.start, end: x.end, place: x.place, field: x.field })));
    assert.equal(shapes.length, 1);
    assert.equal(placesWords(shapes[0]), 'Field 1 in two sides, Field 3');
    assert.equal(shapes[0].minutesAWeek, 540);
  });

  it('the line under the dropdowns, only when the time has a part', () => {
    assert.deepEqual(splitFieldsOf(tab6()), [{ name: 'Field 1', sections: 2 }]);
    assert.equal(W.partsHoldOne(splitFieldsOf(tab6())), 'Field 1’s sides hold one team each. Teams at once is for whole facilities.');
    assert.equal(W.partsHoldOne([{ name: 'Field 2', sections: 4 }]), 'Field 2’s quarters hold one team each. Teams at once is for whole facilities.');
    assert.deepEqual(splitFieldsOf(sundays('Field 3', `${DOME}|${F3}`)), []);
  });

  it('no split field: the shape reads exactly as before (no `where`, the same minutes)', () => {
    const slots = sundays('Field 3', `${DOME}|${F3}`).slice(0, 1);
    const [shape] = partsShapes(slots.map(x => ({ weekday: x.weekday, start: x.start, end: x.end, place: x.place })));
    assert.deepEqual(Object.keys(shape).sort(), ['days', 'minutesAWeek', 'places', 'when']);
    assert.equal(shape.minutesAWeek, 270);
  });
});

// ── House league's time (the window, the hand-off bell) ──────────────────────────────────────────────────────────────

describe('House league\'s time: a part is its own part, at its share', () => {
  const slot = (id: string, mask: number | undefined, facilityId = F1): LeagueTimeSlot => ({
    id, scheduleId: 'sch', blockId: 'b', venueId: DOME, facilityId, ...(mask ? { sectionMask: mask } : {}),
    day: '2027-01-03', weekday: 7, start: '09:00', end: '13:30', use: null,
  });
  const read = (slots: LeagueTimeSlot[]) => groupLeagueTime({
    slots, schedules: [{ id: 'sch', name: 'Winter', startsOn: '2027-01-01', endsOn: '2027-03-31' }], divisions: [],
    placeOf: (_v, f) => (f === F1 ? 'Field 1' : 'Field 3'), venueOf: () => 'Milton Sports Dome',
    sectionsOf: f => (f === F1 ? 2 : 1),
  });

  it('side A and side B at one clock stay two parts; the hours count each at half; the words fold', () => {
    const [src] = read([slot('a', SIDE_A), slot('b', SIDE_B), slot('c', undefined, F3)]);
    const row = src.stretches[0].rows[0];
    assert.equal(row.parts.length, 3);
    assert.equal(row.minutesAWeek, 540);
    assert.match(row.detail, /Field 1 in two sides, Field 3$/);
    assert.match(src.stretches[0].title, /Field 1 in two sides, Field 3$/);
  });

  it('no split field: the parts are the objects they were (no `field` key)', () => {
    const [src] = read([slot('c', undefined, F3)]);
    assert.equal('field' in src.stretches[0].rows[0].parts[0], false);
    assert.equal(src.stretches[0].rows[0].minutesAWeek, 270);
  });
});

// ── Games on club time (tab 8) ───────────────────────────────────────────────────────────────────────────────────────

describe('Games: a game is on its slot\'s part', () => {
  const at = '2027-01-03T14:00:00.000Z';
  const slots: SeasonGameSlot[] = [
    { slotId: 'sa', divisionId: 'u9', startsAt: at, venueId: DOME, facilityId: F1, sectionMask: SIDE_A, scheduleId: 'sch', scheduleName: 'Winter' },
    { slotId: 'sb', divisionId: 'u9', startsAt: at, venueId: DOME, facilityId: F1, sectionMask: SIDE_B, scheduleId: 'sch', scheduleName: 'Winter' },
  ];
  const look = gameSlotLookup(slots);
  const game = (sectionMask?: number) => ({ divisionId: 'u9', scheduledAt: at, orgVenueId: DOME, orgVenueFacilityId: F1, ...(sectionMask ? { sectionMask } : {}) });

  it('side A links to side A\'s slot and side B to side B\'s', () => {
    assert.equal(look(game(SIDE_A))?.slotId, 'sa');
    assert.equal(look(game(SIDE_B))?.slotId, 'sb');
  });

  it('a whole-field game (a hand move: house league never splits a field) links to no side', () => {
    assert.equal(look(game()), null);
  });

  it('the stored place carries the part after a comma; the whole field is the line it always was', () => {
    assert.equal(formatPartLocation('Milton Sports Dome', 'Field 1', SIDE_A, 2), 'Milton Sports Dome — Field 1, side A');
    assert.equal(formatPartLocation('Milton Sports Dome', 'Field 1', 4, 4), 'Milton Sports Dome — Field 1, quarter C');
    assert.equal(formatPartLocation('Milton Sports Dome', 'Field 3', 0, 1), formatVenueLocation('Milton Sports Dome', 'Field 3'));
    // The club calendar reads the facility back from the LAST " — " (a comma, never a second dash).
    const line = formatPartLocation('Milton Sports Dome', 'Field 1', SIDE_B, 2);
    assert.equal(line.slice(line.lastIndexOf(' — ') + 3), 'Field 1, side B');
  });
});

// ── Clashes ──────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Clashes: side A beside side B is none; the whole field meets each side', () => {
  const b = (id: string, sectionMask?: number): LeagueBooking => ({
    id, kind: 'game', startsAt: '2027-01-03T14:00:00.000Z', endsAt: '2027-01-03T15:30:00.000Z',
    orgVenueId: DOME, orgVenueFacilityId: F1, ...(sectionMask ? { sectionMask } : {}), location: 'Milton Sports Dome — Field 1',
  });

  it('two games at once on two sides of one field', () => {
    assert.equal(findLeagueBookingConflicts(b('a', SIDE_A), [b('b', SIDE_B)]).length, 0);
  });
  it('a side against the whole field, and two games on one side', () => {
    assert.equal(findLeagueBookingConflicts(b('a', SIDE_A), [b('w')]).length, 1);
    assert.equal(findLeagueBookingConflicts(b('a', SIDE_A), [b('a2', SIDE_A)]).length, 1);
  });
});

describe('A hand edit keeps the part only on its own field (round 2 Ask 1 A)', () => {
  it('the same field keeps side A; another field, or none, is the whole', () => {
    const stored = { org_venue_facility_id: F1, section_mask: SIDE_A };
    assert.equal(keptPart(stored, F1, 2), SIDE_A);
    assert.equal(keptPart(stored, F3, 2), 0);
    assert.equal(keptPart(stored, null, 1), 0);
    assert.equal(keptPart({ org_venue_facility_id: F1, section_mask: null }, F1, 2), 0);
  });

  it('a part its field no longer offers is the whole field (split differently since)', () => {
    const stored = { org_venue_facility_id: F1, section_mask: SIDE_A };
    assert.equal(keptPart(stored, F1, 1), 0);
    assert.equal(keptPart({ ...stored, section_mask: 1 }, F1, 2), 0, 'quarter A on a field now in two sides');
    assert.equal(keptPart(stored, F1, 4), SIDE_A, 'side A is quarters A–B');
  });
});

// ── A part change is a move (tab 8) ──────────────────────────────────────────────────────────────────────────────────

describe('Changes to send: side A → side B is a change of place', () => {
  const snap = (sectionMask?: number): GameSnapshot => ({
    scheduledAt: '2027-01-10T14:00:00.000Z', endsAt: null, location: 'Milton Sports Dome — Field 1', venueId: DOME, facilityId: F1,
    ...(sectionMask ? { sectionMask } : {}), status: 'scheduled', movedFrom: null,
  });

  it('placeDiffers sees the part; an older snapshot with no part reads the whole field', () => {
    assert.equal(placeDiffers(snap(SIDE_A), snap(SIDE_B)), true);
    assert.equal(placeDiffers(snap(SIDE_A), snap(SIDE_A)), false);
    assert.equal(placeDiffers(snap(), snap()), false);
  });

  it('a whole-field game\'s snapshot has no part key (exactly as before parts)', () => {
    const g = { scheduledAt: null, endsAt: null, location: null, orgVenueId: DOME, orgVenueFacilityId: F1, status: 'scheduled' as const, movedFrom: null };
    assert.equal('sectionMask' in snapshotOf(g), false);
    assert.equal(snapshotOf({ ...g, sectionMask: SIDE_B }).sectionMask, SIDE_B);
  });

  it('until the send, families see the side they last heard', () => {
    const now = {
      id: 'g1', scheduledAt: '2027-01-10T14:00:00.000Z', endsAt: null, location: 'Milton Sports Dome — Field 1, side B',
      orgVenueId: DOME, orgVenueFacilityId: F1, sectionMask: SIDE_B, status: 'scheduled' as const, movedFrom: null,
    };
    const held: HeldChange[] = [{
      id: 'c1', gameId: 'g1', kind: 'place', source: 'league', createdAt: '2027-01-01T00:00:00Z',
      before: { ...snap(SIDE_A), location: 'Milton Sports Dome — Field 1, side A' }, after: snapshotOf(now),
    }];
    const [seen] = asLastSent([now], held);
    assert.equal(seen.sectionMask, SIDE_A);
    assert.equal(seen.location, 'Milton Sports Dome — Field 1, side A');
    // Heard on the whole field: no part on what families see.
    const [whole] = asLastSent([now], [{ ...held[0], before: snap() }]);
    assert.equal('sectionMask' in whole, false);
  });
});

describe('Send the changes: a house-league game or practice moved to the other side is a move', () => {
  const ms = (day: string, time: string) => Date.parse(zonedWallClockToUtc(day, time)!);
  const weekOfMs = (t: number) => mondayOfDay(utcToZonedInputs(new Date(t).toISOString()).date);
  const NOW = ms('2027-01-01', '09:00');
  const slot = (id: string, o: Partial<LeagueSlot>): LeagueSlot =>
    ({ id, startMs: ms('2027-01-10', '09:00'), endMs: ms('2027-01-10', '10:30'), venueId: DOME, facilityId: F1, removed: false, houseLeague: true, isNew: false, ...o });
  const slots = [slot('old', { sectionMask: SIDE_A, removed: true }), slot('new', { sectionMask: SIDE_B, isNew: true })];

  it('the same time and field on the other side: the game moves (before 2E it was skipped)', () => {
    const games: LeagueSlotGame[] = [{ id: 'g1', seasonId: 'w', divisionId: 'u9', slotId: 'old', startMs: ms('2027-01-10', '09:00'), endMs: null, status: 'scheduled', published: true }];
    const plan = planLeagueChanges({
      slots, uses: [{ slotId: 'old', seasonId: 'w', divisionId: 'u9', kind: 'games' }], games, practices: [], nowMs: NOW, weekOfMs,
      locationOf: id => (id === 'new' ? 'Milton Sports Dome — Field 1, side B' : 'Milton Sports Dome — Field 1, side A'),
    });
    assert.equal(plan.step.games.move.length, 1);
    assert.equal(plan.step.games.move[0].location, 'Milton Sports Dome — Field 1, side B');
  });

  it('side A and side B re-timed together stay on their sides, whatever the slot ids', () => {
    const later = ms('2027-01-10', '09:30');
    // The ids would pair side A with the new side B ("n1") if ground didn't break the tie.
    const both = [
      slot('a-old', { sectionMask: SIDE_A, removed: true }), slot('b-old', { sectionMask: SIDE_B, removed: true }),
      slot('n1', { sectionMask: SIDE_B, startMs: later, isNew: true }), slot('n2', { sectionMask: SIDE_A, startMs: later, isNew: true }),
    ];
    const uses = ['a-old', 'b-old'].map(slotId => ({ slotId, seasonId: 'w', divisionId: 'u9', kind: 'practices' as const }));
    const plan = planLeagueChanges({ slots: both, uses, practices: [], nowMs: NOW, weekOfMs, locationOf: () => '' });
    assert.deepEqual(plan.step.uses, [{ from: 'a-old', to: 'n2' }, { from: 'b-old', to: 'n1' }]);
  });

  it('a practice moved to the other side is a change the coach and families are told; its row names both sides', () => {
    const plan = planLeagueChanges({
      slots, uses: [{ slotId: 'old', seasonId: 'w', divisionId: 'u9', kind: 'practices' }], nowMs: NOW, weekOfMs, locationOf: () => '',
      practices: [{ id: 'p1', teamId: 't1', seasonId: 'w', divisionId: 'u9', slotId: 'old', startMs: ms('2027-01-10', '09:00'), endMs: ms('2027-01-10', '10:30'), cancelled: false }],
    });
    assert.equal(plan.changes.length, 1);
    assert.equal(plan.changes[0].kind, 'moved');
    const face = (slotId: string): PracticeFace => ({
      day: '2027-01-10', weekday: 7, startClock: '09:00', endClock: '10:30', venueId: DOME, facilityId: F1,
      sectionMask: slotId === 'new' ? SIDE_B : SIDE_A,
    });
    const [row] = leagueRows(plan.changes, (_s, _e, id) => face(id), []);
    const line = leagueRowLine(row, f => ({ venue: 'Milton Sports Dome', facility: `Field 1, side ${f.sectionMask === SIDE_B ? 'B' : 'A'}` }));
    assert.match(line, /Field 1, side A → Field 1, side B/);
  });
});

// ── 2E part 2's two rulings (owner 2026-11-27, the 2E part 1 review's questions A and B) ─────────────────────────────

describe('Question B: a whole field holding two teams, turned into sides, keeps one team a side', () => {
  const ms = (day: string, time: string) => Date.parse(zonedWallClockToUtc(day, time)!);
  const weekOfMs = (t: number) => mondayOfDay(utcToZonedInputs(new Date(t).toISOString()).date);
  const NOW = ms('2027-01-01', '09:00');
  const slot = (id: string, o: Partial<LeagueSlot>): LeagueSlot =>
    ({ id, startMs: ms('2027-01-10', '09:00'), endMs: ms('2027-01-10', '10:30'), venueId: DOME, facilityId: F1, removed: false, houseLeague: true, isNew: false, ...o });
  const practice = (id: string, teamId: string) =>
    ({ id, teamId, seasonId: 'w', divisionId: 'u9', slotId: 'whole', startMs: ms('2027-01-10', '09:00'), endMs: ms('2027-01-10', '10:30'), cancelled: false });
  const uses = [{ slotId: 'whole', seasonId: 'w', divisionId: 'u9', kind: 'practices' as const }];
  const run = (slots: LeagueSlot[], practices: ReturnType<typeof practice>[]) =>
    planLeagueChanges({ slots, uses, practices, nowMs: NOW, weekOfMs, locationOf: id => `Milton Sports Dome — ${id}` });
  const sides = [slot('whole', { removed: true }), slot('sa', { sectionMask: SIDE_A, isNew: true }), slot('sb', { sectionMask: SIDE_B, isNew: true })];

  it('the first team on side A, the second on side B, which becomes the division\'s practice time', () => {
    const plan = run(sides, [practice('p1', 't1'), practice('p2', 't2')]);
    assert.deepEqual(plan.step.uses, [{ from: 'whole', to: 'sa' }]);
    assert.deepEqual(plan.step.copies, [{ from: 'sa', to: 'sb' }]);
    assert.deepEqual(plan.step.updates.map(u => [u.practiceId, u.slotId]), [['p1', 'sa'], ['p2', 'sb']]);
    assert.deepEqual(plan.step.cancel, []);
  });

  it('a third team, with no side left, is cancelled (as any practice that no longer fits)', () => {
    const plan = run(sides, [practice('p1', 't1'), practice('p2', 't2'), practice('p3', 't3')]);
    assert.deepEqual(plan.step.updates.map(u => u.slotId), ['sa', 'sb']);
    assert.deepEqual(plan.step.cancel, ['p3']);
    assert.equal(plan.changes.find(c => c.practiceId === 'p3')?.kind, 'cancelled');
  });

  it('a part with a use of its own, or another field, is never taken for the second team', () => {
    const owned = run([...sides.slice(0, 2), slot('sb', { sectionMask: SIDE_B, isNew: true, facilityId: F3 })], [practice('p1', 't1'), practice('p2', 't2')]);
    assert.equal(owned.step.copies, undefined);
    assert.deepEqual(owned.step.cancel, ['p2']);
  });

  it('the copy is in the fingerprint (a press must find the plan the window showed)', () => {
    const two = run(sides, [practice('p1', 't1'), practice('p2', 't2')]);
    const one = run(sides, [practice('p1', 't1')]);
    assert.notEqual(leagueFingerprint(two.step), leagueFingerprint({ ...two.step, copies: undefined }));
    assert.equal(one.step.copies, undefined);
  });

  it('no split field: two teams carried onto a whole field stay together, the step has no `copies` key', () => {
    const plan = run([slot('whole', { removed: true }), slot('w2', { isNew: true })], [practice('p1', 't1'), practice('p2', 't2')]);
    assert.equal('copies' in plan.step, false);
    assert.deepEqual(plan.step.updates.map(u => u.slotId), ['w2', 'w2']);
  });

  it('mig 553 makes the copy a practices use, after step 1, only on time house league holds and nothing uses', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/553_a_part_beside_takes_the_next_team.sql', import.meta.url), 'utf8');
    const loop = (key: string) => sql.indexOf(`jsonb_array_elements(coalesce(p_league->'${key}'`);
    const copies = loop('copies');
    assert.ok(copies > loop('uses') && copies < loop('cancel'));
    assert.match(sql.slice(copies, copies + 1400), /insert into league_slot_uses[\s\S]*u\.kind = 'practices'/);
    assert.match(sql.slice(copies, copies + 1400), /p\.program = 'house_league'/);
  });
});

describe('Question A: a hand-placed game takes the side of the club time it lands on', () => {
  const at = '2027-01-03T14:00:00.000Z';
  const s = (slotId: string, sectionMask?: number, o: Partial<SeasonGameSlot> = {}): SeasonGameSlot =>
    ({ slotId, divisionId: 'u9', startsAt: at, venueId: DOME, facilityId: F1, ...(sectionMask ? { sectionMask } : {}), scheduleId: 'sch', scheduleName: 'Winter', ...o });
  const slots = [s('sb', SIDE_B), s('sa', SIDE_A), s('other-div', SIDE_A, { divisionId: 'u11' }), s('f3', undefined, { facilityId: F3 })];
  const game = (sectionMask?: number) => ({ divisionId: 'u9', scheduledAt: at, orgVenueId: DOME, orgVenueFacilityId: F1, ...(sectionMask ? { sectionMask } : {}) });

  it('a whole field picked onto side time: side A first, then side B (placeGame takes the first free)', () => {
    assert.deepEqual(gameSlotsAt(game(), slots).map(x => x.slotId), ['sa', 'sb']);
  });
  it('a side-B game keeps side B first; another division\'s or field\'s time is never offered', () => {
    assert.deepEqual(gameSlotsAt(game(SIDE_B), slots).map(x => x.slotId), ['sb', 'sa']);
    assert.deepEqual(gameSlotsAt({ ...game(), scheduledAt: '2027-01-03T15:00:00.000Z' }, slots), []);
  });
  it('whole-field time: the one slot, as before parts', () => {
    assert.deepEqual(gameSlotsAt({ ...game(), orgVenueFacilityId: F3 }, slots).map(x => x.slotId), ['f3']);
  });
});

// ── The Tell step remembers the side families were told ──────────────────────────────────────────────────────────────

describe('Tell: side A and side B are different practices to a family', () => {
  const told = (m?: number): ToldPractice => ({ s: '2027-01-10T14:00:00.000Z', e: '2027-01-10T15:30:00.000Z', v: DOME, f: F1, l: null, ...(m ? { m } : {}) });

  it('the key carries the part; a whole-field one keys as before', () => {
    assert.notEqual(toldKey(told(SIDE_A)), toldKey(told(SIDE_B)));
    assert.equal(toldKey(told()), `${Date.parse(told().s)}|${Date.parse(told().e!)}|v:${DOME}|${F1}`);
  });

  it('the snapshot keeps the part; a whole one stores no `m`', () => {
    const nowMs = Date.parse('2027-01-01T00:00:00Z');
    assert.equal(toldSnapshotOf([told(SIDE_A)], nowMs)[0].m, SIDE_A);
    assert.equal('m' in toldSnapshotOf([told()], nowMs)[0], false);
  });

  it('the face reads the part back and says it after a comma', () => {
    const face = faceOfTold(Date.parse(told().s), Date.parse(told().e!), `${DOME}|${F1}|${SIDE_B}`);
    assert.equal(face.sectionMask, SIDE_B);
    const words = placeOfTold({ venue: () => 'Milton Sports Dome', facility: () => 'Field 1', sections: () => 2 })(face);
    assert.deepEqual(words, { venue: 'Milton Sports Dome', facility: 'Field 1, side B' });
  });

  it('a hand-out predicted onto a side carries the side (a told team moved A → B is a change)', () => {
    const slots = tab6().slice(0, 1);
    const predicted = predictHandOut({
      current: new Map(), rows: [{ slotId: slots[0].id, teamId: 't1', scheduledAt: slots[0].startsAt, endsAt: slots[0].startsAt }],
      slots, slotIds: [slots[0].id], nowMs: 0,
    });
    assert.equal(predicted.get('t1')![0].m, SIDE_A);
    assert.equal(predicted.get('t1')![0].f, F1);
  });
});

// ── House league's view of a club schedule ──────────────────────────────────────────────────────────────────────────

describe('The league admin\'s club-schedule view: side A and side B are two runs, two rows', () => {
  it('each side repeats on its own and keeps its part', () => {
    const raw = (id: string, day: string, mask: number): RawClubSlot => ({
      id, venueId: DOME, facilityId: F1, sectionMask: mask, startsAt: `${day}T14:00:00.000Z`, day, weekday: 7,
      startClock: '09:00', endClock: '10:30', teamIds: [], houseLeague: true, removed: false,
    });
    const out = projectClubSlots({
      slots: [raw('a1', '2027-01-03', SIDE_A), raw('b1', '2027-01-03', SIDE_B), raw('a2', '2027-01-10', SIDE_A)],
      week: { from: '2027-01-03', to: '2027-01-03' }, seasonId: 'w', uses: new Map(), teamName: null, final: true, now: '2026-01-01T00:00:00Z',
      inSeason: () => true,
    });
    assert.equal(out.find(x => x.id === 'a1')!.sectionMask, SIDE_A);
    assert.match(out.find(x => x.id === 'a1')!.repeats ?? '', /^Every Sunday/);
    assert.equal(out.find(x => x.id === 'b1')!.repeats, null, 'side B has one date: not side A\'s run');
  });
});

// ── The writers, by their text (the SQL is proved on dev by scripts/schedule-parts-house-league-check.sql) ──────────

describe('The writers carry the part', () => {
  const mig = readFileSync(new URL('../../supabase/migrations/552_house_league_takes_its_slots_part.sql', import.meta.url), 'utf8');
  it('mig 552: generated games and handed-out practices take the SLOT\'s part; a part holds one practice at a time', () => {
    assert.match(mig, /INSERT INTO league_games\([^)]*section_mask/);
    assert.match(mig, /org_venue_facility_id, section_mask, club_schedule_slot_id\)/);
    assert.match(mig, /case when s\.section_mask <> 0 then 1 else v_cap end/);
  });
  it('mig 552: the change record and the snapshot see the part; Undo puts it back', () => {
    assert.match(mig, /OR NEW\.section_mask IS DISTINCT FROM OLD\.section_mask/);
    assert.match(mig, /'sectionMask', g\.section_mask/);
    // The recorder is re-made here, so its older rule is held here too: "Link both" is still not news (mig 539).
    assert.match(mig, /v_link\s+:= coalesce\(current_setting\('league\.quiet_link', true\), ''\) = 'on'/);
    assert.match(mig, /v_where := NOT v_link AND \(/);
    assert.match(mig, /section_mask = CASE WHEN jsonb_exists\(v_b, 'sectionMask'\)/);
  });
  it('mig 552: a row keeping its field and part is not judged again; a new part still is', () => {
    assert.match(mig, /tg_op = 'UPDATE' and new\.section_mask = old\.section_mask\s+and \(to_jsonb\(old\) ->> tg_argv\[0\]\) is not distinct from \(to_jsonb\(new\) ->> tg_argv\[0\]\)/);
    assert.match(mig, /raise exception 'part_illegal:/);
  });
  it('the game window and the practice edit resolve the place with the stored row (a kept part)', () => {
    const game = readFileSync(new URL('../../app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts', import.meta.url), 'utf8');
    const practice = readFileSync(new URL('../../app/api/admin/house-league/seasons/[seasonId]/practices/[practiceId]/route.ts', import.meta.url), 'utf8');
    assert.match(game, /stored: game,/);
    assert.match(practice, /stored: practice,/);
  });
});
