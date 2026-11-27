import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { findClubClashes, leagueBooking, repEventBooking } from '../../lib/venue-clash.ts';
import { groupLeagueTime, type LeagueTimeSlot } from '../../lib/league-time.ts';
import { overlappingBlocks, placesHeld, windowOn, type PartBlock, type PermitTime } from '../../lib/permit-time.ts';
import { freeTime, type FreeFilters, type FreePermit } from '../../lib/permit-free-time.ts';
import { rowsFromFound, settleOverlaps } from '../../lib/club-schedule-permit-rows.ts';
import { heldSlots, type PoolBooking, type ScheduleBlock, type Slot } from '../../lib/club-schedule-engine.ts';
import { timeKeeping, type KeepSlot } from '../../lib/club-schedule-keep.ts';

/**
 * THREE FAULTS FOUND BY THE STAGE 2 WALK'S CODE CHECK (walk §581, 2026-11-27; plan
 * SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md, "Faults found by the walk's check").
 */
const LIONS = 'lions', F1 = 'field-1';
const A = 3, B = 12;
const SUNDAYS = ['2027-03-07', '2027-03-14', '2027-03-21', '2027-03-28'];

describe('1. A schedule’s own house-league games never hold its time (a regenerate kept dropping them)', () => {
  const start = '2027-03-07T23:00:00Z', end = '2027-03-08T00:00:00Z';
  const game = leagueBooking({
    id: 'g1', kind: 'game', scheduled_at: start, ends_at: end, status: 'scheduled', org_venue_id: LIONS, org_venue_facility_id: F1, slot_use_id: 'slot-1',
  }, { season: 'Spring house league' })!;

  it('a game carries the slot it sits on', () => {
    assert.equal(game.gameSlotOf, 'slot-1');
  });

  it('the clash rule is unchanged: a game and a team’s practice on one slot still clash', () => {
    const practice = repEventBooking({
      id: 'e1', team_id: 't1', event_type: 'practice', starts_at: start, ends_at: end, org_venue_id: LIONS, org_venue_facility_id: F1, club_schedule_slot_id: 'slot-1',
    }, { team: '13U AAA' })!;
    assert.equal(findClubClashes(practice, [game]).length, 1);
  });

  const at = (clock: string) => windowOn(SUNDAYS[0], { startTime: clock, endTime: '23:00' }).startMs;
  const slotAt = (start: string, end: string, mask?: number): Slot => ({
    key: `${start}-${mask ?? 0}`, venueId: LIONS, facilityId: F1, ...(mask ? { sectionMask: mask } : {}), blockIndex: 0, day: SUNDAYS[0], weekday: 7,
    week: '2027-03-01', startClock: start, endClock: end, startMs: at(start), endMs: at(end), pos: start, prime: false, weight: 1,
  });
  const gameFrom = (start: string, end: string, own: boolean, mask?: number): PoolBooking => ({
    key: 'league_game:g', venueId: LIONS, facilityId: F1, ...(mask ? { sectionMask: mask } : {}), startMs: at(start), endMs: at(end),
    ownerName: 'Spring house league', kind: 'game', ...(own ? { ownGame: true } : {}),
  });
  const heldBy = (slots: Slot[], game: PoolBooking) => [...heldSlots(slots, [game]).keys()];

  it('the schedule’s own game never holds the slot it sits on; anyone else’s does', () => {
    const slots = [slotAt('18:00', '19:00'), slotAt('19:00', '20:00')];
    assert.deepEqual(heldBy(slots, gameFrom('18:00', '19:00', true)), []);
    assert.deepEqual(heldBy(slots, gameFrom('18:00', '19:00', false)), ['18:00-0']);
  });

  it('a slot cut shorter than its game: the game stays, so the slot it runs into is held', () => {
    const slots = [slotAt('18:00', '19:30'), slotAt('19:30', '21:00')];
    assert.deepEqual(heldBy(slots, gameFrom('18:00', '20:00', true)), ['19:30-0']);
  });

  it('time moved: the game goes with it, so it holds nothing', () => {
    assert.deepEqual(heldBy([slotAt('18:30', '19:30')], gameFrom('18:00', '19:00', true)), []);
    // A field re-cut from a side to the whole field is a move too.
    assert.deepEqual(heldBy([slotAt('18:00', '19:00')], gameFrom('18:00', '19:00', true, A)), []);
  });

  it('a side’s game leaves the other side free', () => {
    const slots = [slotAt('18:00', '19:00', A), slotAt('18:00', '19:00', B)];
    assert.deepEqual(heldBy(slots, gameFrom('18:00', '19:00', true, A)), []);
  });

  it('the pool reads the link, and the builder marks its own games', () => {
    const lookup = readFileSync('lib/venue-clash-lookup.ts', 'utf8');
    const gamesRead = lookup.slice(lookup.indexOf(".from('league_games')"), lookup.indexOf(".from('league_practices')"));
    assert.match(gamesRead, /\.select\('[^']*\bslot_use_id\b[^']*'\)/);
    const server = readFileSync('lib/club-schedule-server.ts', 'utf8');
    assert.match(server, /ownGameOn\(b\.gameSlotOf\) \? \{ ownGame: true \}/);
    assert.match(server, /!\(b\.endAssumed && ownGameOn\(b\.gameSlotOf\)\)/);
    // The page reads the family's slot ids too; a family member's game is not this schedule's own.
    assert.match(server, /gameSlotIds: loaded\.slots\.map\(s => s\.id\)/);
  });

  it('a game with no stored end says so, so it never holds the slot after its own', () => {
    assert.equal(game.endAssumed, undefined);
    const open = leagueBooking({ id: 'g2', kind: 'game', scheduled_at: start, org_venue_id: LIONS, slot_use_id: 'slot-1' }, { season: 'Spring house league' })!;
    assert.equal(open.endAssumed, true);
  });
});

describe('2. A game on a side runs the slot’s length, not the side’s share of it', () => {
  const slot = (id: string, mask?: number): LeagueTimeSlot => ({
    id, scheduleId: 'sch', blockId: 'b', venueId: LIONS, facilityId: F1, ...(mask ? { sectionMask: mask } : {}),
    day: SUNDAYS[0], weekday: 7, start: '18:00', end: '19:00', use: null,
  });
  const read = (s: LeagueTimeSlot) => groupLeagueTime({
    slots: [s], schedules: [{ id: 'sch', name: 'Spring', startsOn: '2027-03-01', endsOn: '2027-03-31' }], divisions: [],
    placeOf: () => 'Field 1', venueOf: () => 'Lions Park', sectionsOf: () => 2,
  })[0].stretches[0].rows[0].parts[0];

  it('a one-hour side: 60 minutes long, half an hour of the field’s time', () => {
    const part = read(slot('a', A));
    assert.deepEqual([part.slotMinutes, part.minutes], [60, 30]);
  });

  it('a whole field: both 60', () => {
    const part = read(slot('w'));
    assert.deepEqual([part.slotMinutes, part.minutes], [60, 60]);
  });

  it('Generate games says the slot’s length', () => {
    const window = readFileSync('components/admin/kit/club/league/schedule/GenerateGamesWindow.tsx', 'utf8');
    assert.match(window, /parts\.map\(p => p\.slotMinutes\)/);
  });
});

describe('3. Find the time: the form holding one side leaves the other to be found, and to be saved', () => {
  const venueFacilities = new Map([[LIONS, [F1]]]);
  const row = (id: string, mask?: number, permitId = 'p1'): PartBlock & { permitId: string } => ({
    id, venueId: LIONS, facilityIds: [F1], ...(mask ? { parts: { [F1]: [mask] } } : {}), weekdays: [7],
    startTime: '18:00', endTime: '20:00', fromDate: '2027-03-01', untilDate: '2027-03-31', permitId,
  });
  const permit: PermitTime = { id: 'p1', startsOn: '2027-03-01', endsOn: '2027-03-31', datesOff: [], blocks: [row('b1')] };
  const permits: FreePermit[] = [{ ...permit, name: 'Lions spring', issuer: null, createdAt: '2026-12-01T00:00:00Z' }];
  const filters: FreeFilters = { from: '2027-03-01', to: '2027-03-31', weekdays: [], hours: [], kinds: [], venueIds: [], issuers: [], minMinutes: 60 };
  const find = (rows: readonly PartBlock[]) => freeTime({
    permits, venueFacilities, kindOf: () => 'field', sectionsOf: () => 2, drafts: [],
    booked: placesHeld({ startsOn: '2027-03-01', endsOn: '2027-03-31', datesOff: [], blocks: rows }, venueFacilities),
  }, filters);

  it('the form’s time keeps its part', () => {
    const held = placesHeld({ startsOn: '2027-03-01', endsOn: '2027-03-31', datesOff: [], blocks: [row('r', B)] }, venueFacilities);
    assert.equal(held.length, 4);
    assert.ok(held.every(h => h.sectionMask === B));
    assert.deepEqual(held[0], { venueId: LIONS, facilityId: F1, sectionMask: B, ...windowOn(SUNDAYS[0], { startTime: '18:00', endTime: '20:00' }) });
  });

  it('side B on the form: the whole field has no free day, side A has all four, side B is not offered', () => {
    const r = find([row('r', B)]);
    assert.deepEqual(r.rows.map(x => [x.sectionMask ?? 0, x.freeDays]), [[0, 0], [A, 4]]);
  });

  it('the whole field on the form: nothing is offered, as before', () => {
    const r = find([row('r')]);
    assert.deepEqual(r.rows.map(x => [x.sectionMask ?? 0, x.freeDays]), [[0, 0]]);
  });

  it('picking the found side makes a row the save accepts beside the form’s', () => {
    const picked = rowsFromFound(find([row('r', B)]).rows.filter(x => x.freeDays), () => 'p1');
    assert.equal(picked.length, 1);
    const found: PartBlock = { id: 'found', ...picked[0] };
    assert.equal(overlappingBlocks({ blocks: [row('r', B), found] }, venueFacilities), null);
  });

  it('two rows on one piece of ground are still refused', () => {
    assert.deepEqual(overlappingBlocks({ blocks: [row('a', B), row('b', B)] }, venueFacilities), ['a', 'b']);
    assert.deepEqual(overlappingBlocks({ blocks: [row('a', B), row('b')] }, venueFacilities), ['a', 'b']);
    assert.deepEqual(overlappingBlocks({ blocks: [row('a'), row('b')] }, venueFacilities), ['a', 'b']);
  });

  it('Find the time reads the form’s rows through the same rule', () => {
    assert.match(readFileSync('lib/permit-free-time-server.ts', 'utf8'), /booked\.push\(\.\.\.placesHeld\(opts\.own, venueFacilities\)\)/);
  });

  // A sent schedule on Sundays; "today" is Mar 14, so Mar 7 is past and kept.
  const keepRow = (id: string, mask: number, startTime = '18:00'): ScheduleBlock => ({ ...row(id, mask), startTime });
  const pastSlot = (blockId: string, mask: number): KeepSlot => {
    const w = windowOn(SUNDAYS[0], { startTime: '18:00', endTime: '20:00' });
    return {
      key: `past-${blockId}`, venueId: LIONS, facilityId: F1, sectionMask: mask, blockId, permitId: 'p1',
      startsAt: new Date(w.startMs).toISOString(), endsAt: new Date(w.endMs).toISOString(), teamIds: ['t1'], locked: false, movedByHand: false, removed: false,
    };
  };
  const keep = (asked: ScheduleBlock[]) => timeKeeping(
    { startsOn: '2027-03-01', endsOn: '2027-03-31', datesOff: [], blocks: asked, blockIds: asked.map(b => b.id) },
    { blocks: [keepRow('a', A), keepRow('b', B)], blockIds: ['a', 'b'], endsOn: '2027-03-31' },
    [pastSlot('a', A), pastSlot('b', B)],
    { settings: { prime: null }, weightOf: () => 1, venueFacilities, pastFrom: SUNDAYS[1] },
  ).time.blocks.map(b => [b.parts?.[F1]?.[0], b.startTime, b.fromDate, b.untilDate]);

  it('a sent schedule: taking the side A row out leaves the untouched side B row as it was, never in two', () => {
    assert.deepEqual(keep([keepRow('b', B)]), [
      [B, '18:00', '2027-03-01', '2027-03-31'],
      [A, '18:00', '2027-03-01', '2027-03-13'],
    ]);
  });

  it('a sent schedule: an edited row starts today beside its own past, and the other side’s row is left alone', () => {
    assert.deepEqual(keep([keepRow('a', A, '18:30'), keepRow('b', B)]), [
      [A, '18:30', SUNDAYS[1], '2027-03-31'],
      [B, '18:00', '2027-03-01', '2027-03-31'],
      [A, '18:00', '2027-03-01', '2027-03-13'],
    ]);
  });

  it('two permits: the second keeps the other side, and loses the same side', () => {
    const range = { startsOn: '2027-03-01', endsOn: '2027-03-31' };
    const other = settleOverlaps([row('a', A, 'p1'), row('b', B, 'p2')], ['p1', 'p2'], range);
    assert.equal(other.blocks.length, 2);
    assert.deepEqual(other.overlaps, []);
    const same = settleOverlaps([row('a', A, 'p1'), row('b', A, 'p2')], ['p1', 'p2'], range);
    assert.deepEqual(same.blocks.map(b => b.id), ['a']);
  });
});
