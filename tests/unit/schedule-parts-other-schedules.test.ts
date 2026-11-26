import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { heldUnused, permitUse, windowOn, type BookingPlace, type PermitTime, type ScheduledTime, type UseBooking } from '../../lib/permit-time.ts';
import { freeTime, type FreeFilters, type FreeInput, type FreePermit, type TakenTime } from '../../lib/permit-free-time.ts';
import { rowsFromFound, tickFound } from '../../lib/club-schedule-permit-rows.ts';
import { draftsOn, heldSlots, takesFrom, type DraftHold, type PoolBooking, type Slot } from '../../lib/club-schedule-engine.ts';
import { heldUnusedWords } from '../../lib/permit-words.ts';
import { holdsAll, tickLabel } from '../../lib/field-parts.ts';

/**
 * CLUB SCHEDULES STAGE 2, SESSION 2D — other schedules, and the permit's Used figure (plan
 * SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md, Stage 2 "2D built"; the several-permits plan's owed item).
 *
 * The fixture: Lions Park, Field 1 in two sides (side A = 3, side B = 12, quarter units). One permit, Sundays 6–8 p.m.,
 * Mar 7 – Mar 28, 2027 (four Sundays, 8 h held). Two schedules on it: "Spring rep 2027" (final) and "Fall house league"
 * (a draft).
 */
const LIONS = 'lions', F1 = 'field-1', F2 = 'field-2';
const A = 3, B = 12, QA = 1, QB = 2;
const SUNDAYS = ['2027-03-07', '2027-03-14', '2027-03-21', '2027-03-28'];
const FINAL = 'Spring rep 2027', DRAFT = 'Fall house league';

const permit: PermitTime = {
  id: 'p1', startsOn: '2027-03-01', endsOn: '2027-03-31', datesOff: [],
  blocks: [{ id: 'b1', venueId: LIONS, facilityIds: [F1], weekdays: [7], startTime: '18:00', endTime: '20:00', fromDate: null, untilDate: null }],
};
const venueFacilities = new Map([[LIONS, [F1, F2]]]);
const at = (day: string, s: string, e: string) => windowOn(day, { startTime: s, endTime: e });
const use = (day: string, s: string, e: string, mask?: number, n = 0): UseBooking => ({
  key: `b${day}${s}${mask ?? ''}${n}`, ownerName: '13U AAA', venueId: LIONS, facilityId: F1, ...(mask ? { sectionMask: mask } : {}), ...at(day, s, e),
});

describe('Used: a booking on a part counts its share (round 1 Ask 9 A)', () => {
  it('side A for two hours is one hour; sides A and B at once are the field once; a whole hour beside a side is ¾', () => {
    const u = permitUse(permit, [
      use(SUNDAYS[0], '18:00', '20:00', A),
      use(SUNDAYS[1], '18:00', '20:00', A), use(SUNDAYS[1], '18:00', '20:00', B),
      use(SUNDAYS[2], '18:00', '20:00', A), use(SUNDAYS[2], '18:00', '19:00'),
    ], { venueFacilities });
    assert.equal(u.totals.heldMinutes, 4 * 120);
    assert.deepEqual(u.days.map(d => d.bookedMinutes), [60, 120, 90, 0]);
    assert.equal(u.totals.bookedMinutes, 270);
    assert.equal(u.totals.unusedMinutes, 210);
    assert.equal(u.places[0].bookedMinutes, 270, 'the permit window’s field row reads the same share');
  });

  it('no split: every figure reads exactly as before (a whole booking, with or without a mask property)', () => {
    const plain = [use(SUNDAYS[0], '18:00', '19:30'), use(SUNDAYS[0], '19:00', '20:30', undefined, 1), use(SUNDAYS[3], '17:00', '18:45')];
    const masked = plain.map(b => ({ ...b, sectionMask: 0 }));
    assert.deepEqual(permitUse(permit, masked, { venueFacilities }), permitUse(permit, plain, { venueFacilities }));
    assert.equal(permitUse(permit, plain, { venueFacilities }).totals.bookedMinutes, 120 + 45);
  });
});

describe('the Used line: unused time a final schedule holds that no team has', () => {
  const slot = (day: string, s: string, e: string, holds: ScheduledTime['holds'], mask?: number, by = FINAL, since = '2027-01-10T00:00:00Z'): ScheduledTime => ({
    venueId: LIONS, facilityId: F1, ...(mask ? { sectionMask: mask } : {}), ...at(day, s, e), scheduleId: by, by, holds, heldSince: Date.parse(since),
  });

  it('an open slot less what is booked on it, a part counting its share; house league’s time apart; out of hours ignored', () => {
    const lines = heldUnused(permit, [
      slot(SUNDAYS[0], '18:00', '20:00', 'open'), // whole field open; side A booked → side B's 2 h = 1 h of field
      slot(SUNDAYS[1], '18:00', '20:00', 'house_league', B), // side B, nobody → 1 h
      slot(SUNDAYS[2], '20:00', '21:00', 'open'), // outside the permit's hours
      slot(SUNDAYS[3], '18:00', '20:00', 'open', A, DRAFT), // another final schedule's side A → 1 h
    ], [use(SUNDAYS[0], '18:00', '20:00', A)], { venueFacilities });
    assert.deepEqual(lines, [
      { scheduleId: DRAFT, by: DRAFT, holds: 'open', minutes: 60 },
      { scheduleId: FINAL, by: FINAL, holds: 'house_league', minutes: 60 },
      { scheduleId: FINAL, by: FINAL, holds: 'open', minutes: 60 },
    ]);
  });

  it('two final schedules on the same ground: the one that held it first keeps it, so the lines never pass Unused', () => {
    const lines = heldUnused(permit, [
      slot(SUNDAYS[0], '18:00', '20:00', 'open', undefined, 'Later', '2027-02-01T00:00:00Z'),
      slot(SUNDAYS[0], '18:00', '20:00', 'open', undefined, 'Earlier', '2027-01-01T00:00:00Z'),
    ], [], { venueFacilities });
    assert.deepEqual(lines.map(l => [l.by, l.minutes]), [['Earlier', 120]]);
  });

  it('two schedules with one name are two lines; under a minute is no line', () => {
    const a = { ...slot(SUNDAYS[0], '18:00', '19:00', 'open'), scheduleId: 's-1' };
    const b = { ...slot(SUNDAYS[1], '18:00', '19:00', 'open'), scheduleId: 's-2' };
    const tiny = { ...slot(SUNDAYS[2], '18:00', '18:01', 'open', QA), scheduleId: 's-3' };
    assert.deepEqual(heldUnused(permit, [a, b, tiny], [], { venueFacilities }).map(l => l.scheduleId).sort(), ['s-1', 's-2']);
  });

  it('a slot a team’s practice covers is Booked, not in the line; a booking with no facility set takes it out too', () => {
    const covered = heldUnused(permit, [slot(SUNDAYS[0], '18:00', '20:00', 'teams')], [use(SUNDAYS[0], '18:00', '20:00')], { venueFacilities });
    assert.deepEqual(covered, []);
    const loose: UseBooking = { key: 'loose', ownerName: '13U AAA', venueId: LIONS, facilityId: null, ...at(SUNDAYS[1], '18:00', '19:00') };
    assert.deepEqual(heldUnused(permit, [slot(SUNDAYS[1], '18:00', '20:00', 'open')], [loose], { venueFacilities }), [{ scheduleId: FINAL, by: FINAL, holds: 'open', minutes: 60 }]);
    // A practice on part of a slot leaves the rest the schedule's (the league divided only 6:00–7:00).
    assert.deepEqual(heldUnused(permit, [slot(SUNDAYS[2], '18:00', '20:00', 'house_league')], [use(SUNDAYS[2], '18:00', '19:00')], { venueFacilities })
      .map(l => l.minutes), [60]);
  });

  it('a booking with no facility set over a field’s own booking: the lines still never pass Unused', () => {
    // Used counts the loose booking on top of the field's, so this Sunday has nothing unused: no line, never "1 h of 0 h".
    const loose: UseBooking = { key: 'loose', ownerName: '13U AAA', venueId: LIONS, facilityId: null, ...at(SUNDAYS[0], '18:00', '19:00') };
    const bookings = [use(SUNDAYS[0], '18:00', '19:00'), loose];
    const slots = [slot(SUNDAYS[0], '19:00', '20:00', 'open')];
    assert.equal(permitUse(permit, bookings, { venueFacilities }).days[0].bookedMinutes, 120);
    assert.deepEqual(heldUnused(permit, slots, bookings, { venueFacilities }), []);
  });

  it('nothing scheduled: no line', () => {
    assert.deepEqual(heldUnused(permit, [], [use(SUNDAYS[0], '18:00', '20:00')], { venueFacilities }), []);
  });

  it('says it as ONE sentence, the total first, each schedule inside it (2D design check F1, Ask 1 A)', () => {
    assert.equal(heldUnusedWords([], 3120), null, 'nothing held: no note');
    assert.equal(heldUnusedWords([{ scheduleId: 's', by: FINAL, holds: 'open', minutes: 540 }], 3120),
      'Of the 52 h unused, 9 h is held by a schedule and no team has it yet: open slots on Spring rep 2027.');
    assert.equal(heldUnusedWords([
      { scheduleId: 's', by: FINAL, holds: 'open', minutes: 540 },
      { scheduleId: 'h', by: 'Spring house league 2027', holds: 'house_league', minutes: 360 },
    ], 3120), 'Of the 52 h unused, 15 h is held by schedules and no team has it yet: 9 h of open slots on Spring rep 2027 and 6 h of house-league time on Spring house league 2027 not given out.');
    assert.match(heldUnusedWords([{ scheduleId: 's', by: FINAL, holds: 'teams', minutes: 90 }], 3120)!, /: time given to teams on Spring rep 2027 and not sent\.$/);
  });
});

describe('the builder: another schedule’s final time is taken, its draft is warned on, by part', () => {
  const w = at(SUNDAYS[0], '18:00', '19:30');
  const slot = (key: string, mask?: number): Slot => ({
    key, venueId: LIONS, facilityId: F1, blockIndex: 0, day: SUNDAYS[0], weekday: 7, week: '2027-03-01', startClock: '18:00', endClock: '19:30',
    ...w, pos: key, prime: false, weight: mask ? 0.5 : 1, ...(mask ? { sectionMask: mask } : {}),
  });
  const slots = [slot('a', A), slot('b', B), slot('whole')];

  it('side A held by a final schedule leaves side B to the builder', () => {
    const final: PoolBooking = { key: 'club_schedule_slot:x', venueId: LIONS, facilityId: F1, sectionMask: A, ...at(SUNDAYS[0], '18:00', '20:00'), ownerName: FINAL, kind: null };
    const held = heldSlots(slots, [final]);
    assert.deepEqual([...held.keys()].sort(), ['a', 'whole']);
    assert.equal(held.get('a')!.ownerName, FINAL);
  });

  it('the earliest booking in the list is the name said', () => {
    const practice: PoolBooking = { key: 'rep_team_event:1', venueId: LIONS, facilityId: F1, sectionMask: A, ...w, ownerName: '13U AAA', kind: 'practice' };
    const final: PoolBooking = { key: 'club_schedule_slot:x', venueId: LIONS, facilityId: F1, sectionMask: A, ...w, ownerName: FINAL, kind: null };
    assert.equal(heldSlots(slots, [practice, final]).get('a')!.ownerName, '13U AAA');
  });

  it('a draft on side A warns side A and the whole field, never side B; a draft at another time warns nothing', () => {
    const drafts: DraftHold[] = [
      { venueId: LIONS, facilityId: F1, sectionMask: A, ...at(SUNDAYS[0], '19:00', '20:00'), by: DRAFT },
      { venueId: LIONS, facilityId: F1, ...at(SUNDAYS[0], '19:30', '21:00'), by: 'Touching only' },
    ];
    const on = draftsOn(slots, drafts);
    assert.deepEqual([...on.keys()].sort(), ['a', 'whole']);
    assert.deepEqual(on.get('a'), [DRAFT]);
  });
});

describe('Find the time: a split field offers the part another booking leaves (census B, "a half booking takes the whole field")', () => {
  const fp: FreePermit[] = [{ ...permit, name: 'Lions spring', issuer: 'Town of Milton', createdAt: '2026-12-01T00:00:00Z' }];
  const booked = (day: string, mask?: number): BookingPlace => ({ venueId: LIONS, facilityId: F1, ...(mask ? { sectionMask: mask } : {}), ...at(day, '18:00', '20:00') });
  const input = (o: Partial<FreeInput> = {}): FreeInput => ({
    permits: fp, venueFacilities, kindOf: () => 'field', booked: [], drafts: [], ...o,
  });
  const f: FreeFilters = { from: '2027-03-01', to: '2027-03-31', weekdays: [], hours: [], kinds: [], venueIds: [], issuers: [], minMinutes: 60 };

  it('side A taken by a final schedule: the field loses that Sunday; side B’s row counts every Sunday side B is free', () => {
    const r = freeTime(input({ sectionsOf: () => 2, booked: [booked(SUNDAYS[0], A)] }), f);
    assert.deepEqual(r.rows.map(x => x.sectionMask ?? 0), [0, B], 'the field, then its side B; side A never counts a day');
    const [whole, sideB] = r.rows;
    assert.equal(whole.freeDays, 3);
    assert.equal(sideB.heldDays, 4);
    assert.equal(sideB.freeDays, 4, 'owner 2026-11-26: picking side B alone brings every Sunday it is free');
    assert.equal(sideB.freeMinutes, 4 * 60, 'a side counts half the field’s time, as Used does');
    assert.deepEqual(sideB.pieces.map(p => [p.fromDate, p.untilDate, p.sectionMask]), [[SUNDAYS[0], SUNDAYS[3], B]]);
  });

  it('a draft on side A: the field reads "held by a draft" that Sunday, side B is free then', () => {
    const drafts: TakenTime[] = [{ ...booked(SUNDAYS[1], A), by: DRAFT }];
    const r = freeTime(input({ sectionsOf: () => 2, drafts }), f);
    const [whole, sideB] = r.rows;
    assert.equal(whole.draftDays, 1);
    assert.deepEqual(whole.draftBy, [DRAFT]);
    assert.equal(sideB.sectionMask, B);
    assert.equal(sideB.freeDays, 4);
    assert.equal(r.rows.length, 2, 'side A is held by the draft where the field already counts the day: no row');
  });

  it('four quarters: quarter A taken leaves side B, and quarter B (inside side A) — never C or D apart from side B', () => {
    const r = freeTime(input({ sectionsOf: () => 4, booked: [booked(SUNDAYS[0], QA)] }), f);
    assert.deepEqual(r.rows.map(x => x.sectionMask ?? 0), [0, B, QB]);
  });

  it('no split: the rows are exactly as before, whatever the bookings carry', () => {
    const plain = freeTime(input({ booked: [booked(SUNDAYS[0])] }), f);
    assert.deepEqual(freeTime(input({ sectionsOf: () => 1, booked: [booked(SUNDAYS[0])] }), f), plain);
    assert.deepEqual(freeTime(input({ sectionsOf: () => 2, booked: [booked(SUNDAYS[0])] }), f), plain, 'a split field nobody books by part');
    // An unsplit field read with a part booking (a split since lowered) is the safe answer: the field is taken.
    assert.equal(freeTime(input({ booked: [booked(SUNDAYS[0], A)] }), f).rows[0].freeDays, 3);
  });

  it('the count line counts facilities, not rows, and each piece of ground’s hours once (2D design check F6)', () => {
    const r = freeTime(input({ sectionsOf: () => 2, booked: [booked(SUNDAYS[0], A)] }), f);
    assert.equal(r.rows.length, 2);
    assert.equal(r.places, 1, 'Field 1 and its side B are one facility');
    assert.equal(r.rows.reduce((m, x) => m + x.freeMinutes, 0), 600, 'the rows say 6 h + 4 h …');
    assert.equal(r.freeMinutes, 3 * 120 + 60, '… but side B adds only the Sunday Field 1’s own row does not count');
    // Four quarters, quarter A taken on the first Sunday: that day side B (1 h of field) and quarter B (0.5 h) are
    // separate ground and both count; on the other Sundays the whole field's row holds them.
    const q = freeTime(input({ sectionsOf: () => 4, booked: [booked(SUNDAYS[0], QA)] }), f);
    assert.equal(q.places, 1);
    assert.equal(q.freeMinutes, 3 * 120 + 60 + 30);
    // No split: the count is the rows' sum, as before.
    const plain = freeTime(input({ booked: [booked(SUNDAYS[0])] }), f);
    assert.equal(plain.freeMinutes, plain.rows.reduce((m, x) => m + x.freeMinutes, 0));
    assert.equal(plain.places, plain.rows.length);
  });

  it('the count line counts the hours only a part is free on a day the field’s row also has some (/review)', () => {
    // Mar 7: side A taken all evening. Mar 14: side A taken until 7. Free ground: 1 h + 1.5 h + 2 h + 2 h.
    const r = freeTime(input({ sectionsOf: () => 2, booked: [booked(SUNDAYS[0], A), { ...booked(SUNDAYS[1], A), ...at(SUNDAYS[1], '18:00', '19:00') }] }), f);
    assert.equal(r.freeMinutes, 60 + 90 + 120 + 120);
  });

  it('a split field’s rows say the tick list’s words: "Field 1 (whole)", "Field 1, side B" (2D design check F5)', () => {
    assert.equal(tickLabel('Field 1', undefined, 2), 'Field 1 (whole)');
    assert.equal(tickLabel('Field 1', B, 2), 'Field 1, side B');
    assert.equal(tickLabel('Field 1', QB, 4), 'Field 1, quarter B');
    assert.equal(tickLabel('Field 2', undefined, 1), 'Field 2', 'a field not split keeps its name');
  });

  it('a picked part row becomes a row on that part; the field’s whole and its side are never one row', () => {
    const r = freeTime(input({ sectionsOf: () => 2, booked: [booked(SUNDAYS[0], A)] }), f);
    const rows = rowsFromFound(r.rows, () => null);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].parts, undefined);
    assert.deepEqual(rows[1].parts, { [F1]: [B] });
    assert.deepEqual([rows[1].fromDate, rows[1].untilDate], [SUNDAYS[0], SUNDAYS[3]]);
  });
});

describe('whichever is finalized first keeps it (takesFrom)', () => {
  const at = (state: 'draft' | 'in_review' | 'final', since: string | null) => ({ state, heldSince: since ? Date.parse(since) : null });
  it('a schedule not final yet: every final schedule takes its time; a draft never does', () => {
    assert.equal(takesFrom(at('final', '2027-01-01T00:00:00Z'), null), true);
    assert.equal(takesFrom(at('draft', null), null), false);
    assert.equal(takesFrom(at('in_review', null), null), false);
  });
  it('time a final schedule holds: only one held since before takes it — never a later one (it shows the clash)', () => {
    const mine = Date.parse('2027-01-15T00:00:00Z');
    assert.equal(takesFrom(at('final', '2027-01-01T00:00:00Z'), mine), true);
    assert.equal(takesFrom(at('final', '2027-02-01T00:00:00Z'), mine), false);
    assert.equal(takesFrom(at('final', null), mine), false);
  });
});

describe('time a final schedule gains later is judged from when it gains it (/review)', () => {
  const slot = (key: string, day: string): Slot => ({
    key, venueId: LIONS, facilityId: F1, blockIndex: 0, day, weekday: 7, week: day, startClock: '18:00', endClock: '19:30',
    ...windowOn(day, { startTime: '18:00', endTime: '19:30' }), pos: key, prime: false, weight: 1,
  });
  const theirs = (day: string): PoolBooking => ({
    key: `club_schedule_slot:${day}`, venueId: LIONS, facilityId: F1, ...windowOn(day, { startTime: '18:00', endTime: '20:00' }),
    ownerName: DRAFT, kind: null, heldSince: Date.parse('2027-02-01T00:00:00Z'),
  });
  it('a schedule finalized first keeps what it already holds; new time is taken by a later one that already has it', () => {
    const slots = [slot('held-already', SUNDAYS[0]), slot('new', SUNDAYS[1])];
    const mine = (s: Slot) => (s.key === 'held-already' ? Date.parse('2027-01-01T00:00:00Z') : null);
    assert.deepEqual([...heldSlots(slots, [theirs(SUNDAYS[0]), theirs(SUNDAYS[1])], mine).keys()], ['new']);
  });
});

describe('Find the time: a field’s rows are one pick at a time', () => {
  it('ticking side B unticks the whole field (two rows of one field at once are refused when made); other fields stay', () => {
    const whole = `${LIONS}|${F1}`, sideB = `${LIONS}|${F1}|${B}`, other = `${LIONS}|${F2}`;
    assert.deepEqual([...tickFound(new Set([whole, other]), sideB, true)].sort(), [other, sideB].sort());
    assert.deepEqual([...tickFound(new Set([sideB, other]), whole, true)].sort(), [other, whole].sort());
    assert.deepEqual([...tickFound(new Set([sideB, other]), sideB, false)], [other]);
  });
});

describe('field-parts: holdsAll is the "larger ground" rule', () => {
  it('the whole holds every part; a side holds its quarters; a part never holds the whole', () => {
    assert.equal(holdsAll(0, A), true);
    assert.equal(holdsAll(A, QA), true);
    assert.equal(holdsAll(A, QB), true);
    assert.equal(holdsAll(B, QA), false);
    assert.equal(holdsAll(A, 0), false);
    assert.equal(holdsAll(0, 0), true);
  });
});

describe('the three readers read other schedules through one read (source guards)', () => {
  const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  it('the builder: other schedules’ final slots join the pool after the bookings; this schedule and its family never count', () => {
    const s = src('lib/club-schedule-server.ts');
    assert.match(s, /readScheduleSlotsIn\(orgId, p\.fromMs, p\.toMs, p\.finalSlotsAt \? \{ finalOnly: true, venueIds: p\.finalSlotsAt \} : \{\}\)/);
    assert.match(s, /for \(const s of \[\.\.\.scheduled\]\.sort\(byFirstHeld\)\)/, 'two final schedules: the one that held it first is the name said');
    assert.match(s, /if \(mine\.has\(s\.scheduleId\)\) continue;/);
    assert.match(s, /held: heldSlots\(checked\.slots, ctx\.pool, ctx\.mineSince\)/, 'the builder judges slot by slot');
    assert.match(s, /const held = heldSlots\(slots, ctx\.pool, ctx\.mineSince\);/, 'the schedule page: a final schedule never shows a later one as a clash');
    assert.match(src('lib/club-schedule-others-server.ts'), /Math\.max\(Date\.parse\(r\.club_schedules!\.finalized_at\), Date\.parse\(r\.created_at\)\)/);
    assert.match(s, /draftsOn: draftsOn\(checked\.slots, ctx\.drafts\)/);
    assert.match(src('app/api/admin/schedules/generate/route.ts'), /draftBy: built\.draftsOn\.get\(s\.key\),/);
  });
  it('the finder and the permit window read the same slots', () => {
    assert.match(src('lib/permit-free-time-server.ts'), /readScheduleSlotsIn\(orgId, fromMs, toMs\)/);
    assert.match(src('lib/permit-server.ts'), /permitUseOf\(orgId, \[p\], t, \{ withHeld: true \}\)/);
  });
});
