import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addTeamResults, familyClashes, familyShown, memberView, partChangeLines, type FamilySlot, type PartRead } from '../../lib/club-schedule-family.ts';
import type { ScheduleView, SlotView } from '../../lib/club-schedule-server.ts';
import type { TeamResult } from '../../lib/club-schedule-engine.ts';

/** Add time is a second schedule, shown as one (Phase 8, Session 1): the family's clashes and its page read. */

const at = (iso: string) => Date.parse(iso);
const fs = (id: string, venueId: string, facilityId: string | null, start: string, end: string, teamIds: string[] = []): FamilySlot =>
  ({ id, venueId, facilityId, startMs: at(start), endMs: at(end), teamIds });

describe('familyClashes — what the rest of the family holds at a slot\'s time', () => {
  const parent = { id: 'P', name: 'Fall practices', slots: [fs('p1', 'kins', 'dA', '2026-12-10T23:00:00Z', '2026-12-11T00:30:00Z', ['aa14'])] };

  it('the same place at an overlapping time is held by that member', () => {
    const c = familyClashes([fs('c1', 'kins', 'dA', '2026-12-10T23:30:00Z', '2026-12-11T01:00:00Z')], [parent]);
    assert.deepEqual(c.get('c1'), { placeWith: 'Fall practices', teams: [] });
  });

  it('another facility, or back to back, is free', () => {
    const c = familyClashes([
      fs('c1', 'kins', 'dB', '2026-12-10T23:00:00Z', '2026-12-11T00:30:00Z'),
      fs('c2', 'kins', 'dA', '2026-12-11T00:30:00Z', '2026-12-11T02:00:00Z'),
    ], [parent]);
    assert.equal(c.size, 0);
  });

  it('a venue with no facilities is the venue itself: null meets null, never a facility', () => {
    const whole = { id: 'P', name: 'Fall practices', slots: [fs('p1', 'dome', null, '2026-12-10T23:00:00Z', '2026-12-11T00:30:00Z')] };
    assert.equal(familyClashes([fs('c1', 'dome', null, '2026-12-10T23:00:00Z', '2026-12-11T00:30:00Z')], [whole]).get('c1')?.placeWith, 'Fall practices');
    assert.equal(familyClashes([fs('c1', 'dome', 'f1', '2026-12-10T23:00:00Z', '2026-12-11T00:30:00Z')], [whole]).size, 0);
  });

  it('the same team at the same time anywhere in the family is named, with where', () => {
    const c = familyClashes([fs('c1', 'prospect', 'd1', '2026-12-10T23:00:00Z', '2026-12-11T00:30:00Z', ['aa14', 'aa15'])], [parent]);
    assert.deepEqual(c.get('c1'), { placeWith: null, teams: [{ teamId: 'aa14', with: 'Fall practices' }] });
  });

  it('house league is not a team: it may hold several slots at once', () => {
    const hl = { id: 'P', name: 'Fall practices', slots: [fs('p1', 'kins', 'dA', '2026-12-10T23:00:00Z', '2026-12-11T00:30:00Z', ['house_league'])] };
    assert.equal(familyClashes([fs('c1', 'prospect', 'd1', '2026-12-10T23:00:00Z', '2026-12-11T00:30:00Z', ['house_league'])], [hl]).size, 0);
  });

  it('reads a long family quickly and exactly (sorted scan, a day back)', () => {
    const many = Array.from({ length: 3000 }, (_, i) => fs(`p${i}`, 'kins', 'dA', new Date(at('2026-09-01T22:00:00Z') + i * 3_600_000 * 8).toISOString(), new Date(at('2026-09-01T23:30:00Z') + i * 3_600_000 * 8).toISOString(), ['aa14']));
    const mine = Array.from({ length: 3000 }, (_, i) => fs(`c${i}`, 'kins', 'dA', new Date(at('2026-09-01T23:00:00Z') + i * 3_600_000 * 8).toISOString(), new Date(at('2026-09-02T00:30:00Z') + i * 3_600_000 * 8).toISOString()));
    const c = familyClashes(mine, [{ id: 'P', name: 'Fall practices', slots: many }]);
    assert.equal(c.size, 3000);
  });
});

function slot(id: string, over: Partial<SlotView> = {}): SlotView {
  return {
    id, key: `kins|dA|${id}`, venueId: 'kins', facilityId: 'dA', startsAt: '2026-12-10T23:00:00.000Z', endsAt: '2026-12-11T00:30:00.000Z',
    day: '2026-12-10', weekday: 4, week: '2026-12-07', startClock: '18:00', endClock: '19:30', prime: false, weight: 1,
    teamIds: [], locked: false, movedByHand: false, pricePermitId: null, handedBack: null, heldBy: null, clash: false, ...over,
  };
}
const totals = (o: Partial<ScheduleView['fairness']['totals']> = {}) => ({ slots: 0, seats: 0, handedOut: 0, open: 0, held: 0, short: 0, clashes: 0, ...o });
const result = (teamId: string, o: Partial<TeamResult> = {}): TeamResult => ({
  teamId, target: 0, got: 0, primeTarget: 0, prime: 0, units: 0, shared: 0, minutes: 0, pricedMinutes: 0, early: 0, facilities: 0, nights: [], short: 0, ...o,
});
function view(over: Partial<ScheduleView> & { name: string; id: string; startsOn: string; endsOn: string; changed?: boolean }): ScheduleView {
  const { name, id, startsOn, endsOn, changed, ...rest } = over;
  return {
    schedule: { id, name, state: 'final', startsOn, endsOn, version: 3, settings: {} as ScheduleView['schedule']['settings'], startedFromPermitId: null, startedFromScheduleId: null, replyBy: null, changedSinceSent: !!changed, sent: { at: '2026-10-02T12:00:00Z', by: null }, finalized: null },
    time: { blocks: [], datesOff: [] }, offParkNames: {},
    places: [{ venueId: 'kins', venueName: 'Kinsmen Park', facilities: [{ id: 'dA', name: 'Diamond A' }] }],
    teams: [], slots: [], fairness: { totals: totals(), teams: [] }, bill: null, pricing: null, fromPermits: [], teamOrder: [],
    canMoney: true, houseLeague: false, asks: [], pays: null, kept: [],
    ...rest,
  } as ScheduleView;
}
const team = (id: string, name: string) => ({ id, name, groupId: null, groupName: null, color: null, season: null }) as unknown as ScheduleView['teams'][number];

describe('familyShown — the family read as one', () => {
  const parent = view({
    id: 'P', name: 'Fall practices', startsOn: '2026-10-05', endsOn: '2027-01-24',
    teams: [team('aa14', '14U AA'), team('aa15', '15U AA')],
    slots: [slot('p1', { teamIds: ['aa14'] }), slot('p2', { teamIds: [], startsAt: '2026-12-11T01:00:00.000Z', endsAt: '2026-12-11T02:30:00.000Z', key: 'kins|dA|p2' })],
    fairness: { totals: totals({ slots: 64, seats: 64, handedOut: 63, open: 1, short: 0 }), teams: [result('aa14', { got: 32, nights: [1] }), result('aa15', { got: 31 })] },
    bill: { totalCents: 765000 } as ScheduleView['bill'],
  });
  const partView = view({
    id: 'C', name: 'Fall practices · Time added Nov 16', startsOn: '2026-12-10', endsOn: '2027-03-30',
    places: [{ venueId: 'prospect', venueName: 'Prospect Park', facilities: [{ id: 'd1', name: 'Diamond 1' }] }],
    teams: [team('aa14', '14U AA'), team('aa13', '13U AAA')],
    slots: [slot('c1', { venueId: 'prospect', facilityId: 'd1', key: 'prospect|d1|c1', teamIds: ['aa14'], startsAt: '2026-12-10T23:00:00.000Z', endsAt: '2026-12-11T00:30:00.000Z' })],
    fairness: { totals: totals({ slots: 1, seats: 1, handedOut: 1 }), teams: [result('aa14', { got: 1, nights: [4] })] },
  });
  const part: PartRead = { id: 'C', label: 'Time added Nov 16', state: 'draft', version: 1, startsOn: '2026-12-10', endsOn: '2027-03-30', sent: null, billed: false, changedSinceSent: false, changes: [], view: partView };

  it('a schedule with no parts reads exactly as before', () => {
    assert.equal(familyShown(parent, []), parent);
  });

  it('lays each part\'s slots in, tagged with their part and unsent until sent', () => {
    const v = familyShown(parent, [part]);
    assert.deepEqual(v.slots.map(s => [s.id, s.partId ?? null, !!s.unsent]), [['p1', null, false], ['c1', 'C', true], ['p2', null, false]]);
    assert.deepEqual(familyShown(parent, [{ ...part, state: 'final' }]).slots.find(s => s.id === 'c1')?.unsent, false);
  });

  it('the same team at the same time in two parts is a clash on both', () => {
    const v = familyShown(parent, [part]);
    assert.equal(v.slots.find(s => s.id === 'p1')?.clash, true);
    assert.equal(v.slots.find(s => s.id === 'c1')?.clash, true);
    assert.equal(v.fairness.totals.clashes, 2);
  });

  it('Fair shares counts the family: Handed out, seats and Short add; the bill stays the parent\'s', () => {
    const v = familyShown(parent, [part]);
    assert.deepEqual([v.fairness.totals.handedOut, v.fairness.totals.seats, v.fairness.totals.short], [64, 65, 0]);
    assert.equal(v.bill, parent.bill);
    assert.equal(v.fairness.teams.find(r => r.teamId === 'aa14')?.got, 33);
    assert.deepEqual(v.fairness.teams.find(r => r.teamId === 'aa14')?.nights, [1, 4]);
  });

  it('the page shows the family\'s dates; the parent reads Changed since sent while a part waits', () => {
    const v = familyShown(parent, [part]);
    assert.deepEqual([v.schedule.startsOn, v.schedule.endsOn, v.schedule.changedSinceSent], ['2026-10-05', '2027-03-30', true]);
    assert.equal(familyShown(parent, [{ ...part, state: 'final' }]).schedule.changedSinceSent, false);
    assert.equal(v.schedule.id, 'P', 'every write still goes to the parent unless a slot names its part');
  });

  it('places and teams are the family\'s, each once', () => {
    const v = familyShown(parent, [part]);
    assert.deepEqual(v.places.map(p => p.venueId), ['kins', 'prospect']);
    assert.deepEqual(v.teams.map(t => t.id), ['aa14', 'aa15', 'aa13']);
  });

  it('a slot belongs to its part\'s own view (the slot window, Give it to, an edit)', () => {
    assert.equal(memberView(parent, [part], 'C'), partView);
    assert.equal(memberView(parent, [part], null), parent);
  });

  it('an unsent part\'s practices read as the send says them', () => {
    const [t] = partChangeLines(part);
    assert.deepEqual({ ...t, groups: undefined }, { teamId: 'aa14', teamName: '14U AA', lines: ['Gains Thu, Dec 10, 6:00 p.m. · Prospect Park · Diamond 1'], groups: undefined });
    // One practice is a group of one: its line, as the send says it (owner 2026-11-17).
    assert.deepEqual(t.groups.map(g => [g.head, g.pattern]), [['Gains Thu, Dec 10, 6:00 p.m. · Prospect Park · Diamond 1', null]]);
  });
});

describe('addTeamResults', () => {
  it('adds counts, keeps the most facilities, and joins the nights Monday first', () => {
    const [r] = addTeamResults([[result('t', { got: 2, facilities: 2, nights: [0, 2] })], [result('t', { got: 1, facilities: 1, nights: [1] })]]);
    assert.deepEqual([r.got, r.facilities, r.nights], [3, 2, [1, 2, 0]]);
  });
});
