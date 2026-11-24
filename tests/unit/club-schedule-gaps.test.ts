import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GAP_WORDS as G, scheduleGaps, teamSubject, teamsWords, type GapSlot, type GapsInput, type GapTeam } from '../../lib/club-schedule-gaps.ts';
import { defaultRules } from '../../lib/club-schedule-settings.ts';

/**
 * OPEN SLOTS AND SHORT TEAMS (owner rulings 2026-11-24): a team's share is the limit; time nobody is owed stays open and
 * the screen says why. Each case is one the Milton winter dome traced that day, in miniature.
 */
const D = ['2027-01-03', '2027-01-10', '2027-01-17'];
const slot = (day: string, fac: string, teamIds: string[] = [], over: Partial<GapSlot> = {}): GapSlot => ({
  key: `${day}|${fac}`, day, week: day, weekday: 7, startClock: '08:00', endClock: '09:00', venueId: 'dome', facilityId: fac,
  teamIds, heldBy: null, locked: false, movedByHand: false, ...over,
});
const TEAMS: GapTeam[] = [
  { id: 'r1', name: 'U11 Rep Purple', groupId: 'rep', groupName: 'Rep' },
  { id: 'r2', name: 'U11 Rep White', groupId: 'rep', groupName: 'Rep' },
  { id: 's1', name: 'U15 Select Purple', groupId: 'sel', groupName: 'Select' },
  { id: 's2', name: 'U15 Select White', groupId: 'sel', groupName: 'Select' },
];
const KEPT = [{ facilityIds: ['f5'], groupIds: ['sel'], teamIds: [] as string[] }];
const input = (slots: GapSlot[], results: GapsInput['results'], rules: Partial<GapsInput['rules']> = {}): GapsInput => ({
  slots, results, teams: TEAMS, rules: { ...defaultRules(), fieldsBy: KEPT, ...rules }, split: { method: 'percentage', values: {} },
});

describe('why a slot is open', () => {
  it('A · a rule holds a team back: one a day over 3 Sundays allows 3, its share is 4', () => {
    const g = scheduleGaps(input(
      [slot(D[0], 'f1', ['r1']), slot(D[1], 'f1', ['r1']), slot(D[2], 'f1', ['r1']), slot(D[2], 'f5')],
      [{ teamId: 'r1', got: 3, short: 1 }], { maxPerDay: 1 },
    ));
    assert.deepEqual(g.short, [{ teamId: 'r1', has: 3, share: 4, gap: 1, slots: 3 }]);
    assert.deepEqual(g.groups.map(x => x.kind), ['cap']);
    const cap = g.groups[0];
    assert.equal(G.head(cap, t => teamsWords(t, TEAMS)), '1 slot is open because 1 practice a day holds U11 Rep Purple back');
    assert.equal(G.explain(cap, g, t => teamSubject(t, TEAMS), () => []), 'U11 Rep Purple can have at most 3 slots on these 3 Sundays, and its share is 4.');
  });
  it('the cap names the group when every team held back is of one: "A Rep team"', () => {
    const g = scheduleGaps(input(
      [slot(D[0], 'f1', ['r1']), slot(D[0], 'f2', ['r2']), slot(D[1], 'f1', ['r1']), slot(D[1], 'f2', ['r2']), slot(D[1], 'f5')],
      [{ teamId: 'r1', got: 2, short: 1 }, { teamId: 'r2', got: 2, short: 1 }], { maxPerWeek: 1 },
    ));
    const cap = g.groups.find(x => x.kind === 'cap')!;
    assert.equal(G.head(cap, t => teamsWords(t, TEAMS)), '1 slot is open because 1 practice a week holds the Rep teams back');
    assert.equal(G.explain(cap, g, t => teamSubject(t, TEAMS), () => []), 'A Rep team can have at most 2 slots on these 2 Sundays, and its share is 3.');
  });
  it('B · a kept field: the team still short is kept off it', () => {
    const g = scheduleGaps(input(
      [slot(D[0], 'f1', ['r1']), slot(D[1], 'f1', ['r1']), slot(D[2], 'f1', ['s1']), slot(D[2], 'f5')],
      [{ teamId: 'r1', got: 2, short: 1 }],
    ));
    assert.deepEqual(g.groups.map(x => x.kind), ['kept']);
    const kept = g.groups[0];
    assert.equal(G.head(kept, () => ''), '1 slot is open on fields kept for Select');
    assert.equal(G.explain(kept, g, () => '', () => ['Field 5']),
      'Field 5 is kept for Select, and every team allowed there has its share. The team still short isn’t allowed on them.');
  });
  it('C · someone can take it: a short team, free that Sunday, allowed there', () => {
    const g = scheduleGaps(input(
      [slot(D[0], 'f5', ['s1']), slot(D[1], 'f5', ['s1']), slot(D[2], 'f5')],
      [{ teamId: 's1', got: 2, short: 1 }], { maxPerDay: 1 },
    ));
    assert.deepEqual(g.groups.map(x => x.kind), ['free']);
    assert.deepEqual(g.open[0].takers, ['s1']);
  });
  it('a team that already plays that day is not offered it; the slot says so', () => {
    const g = scheduleGaps(input(
      [slot(D[0], 'f1', ['r1']), slot(D[0], 'f2'), slot(D[1], 'f1')],
      [{ teamId: 'r1', got: 1, short: 2 }], { maxPerDay: 1 },
    ));
    assert.deepEqual(g.open.map(o => o.why), ['plays', 'free']);
  });
  it('nobody short: the open time is spare; a slot a booking holds is never open', () => {
    const g = scheduleGaps(input([slot(D[0], 'f1', ['r1']), slot(D[0], 'f2'), slot(D[1], 'f1', [], { heldBy: { ownerName: 'Part 1' } })], []));
    assert.equal(g.open.length, 1);
    assert.deepEqual(g.groups.map(x => x.kind), ['spare']);
  });
});

describe('what /review found (2026-11-24)', () => {
  it('a team that shares reads its units: 10 shared slots are 5 of 7, never 10 of 12', () => {
    const g = scheduleGaps(input([slot(D[0], 'f1')], [{ teamId: 's1', got: 10, short: 2, units: 5 }]));
    assert.deepEqual(g.short, [{ teamId: 's1', has: 5, share: 7, gap: 2, slots: 10 }]);
  });
  it('a half reads as a half: 4½ of 7, 3 slots short', () => {
    const g = scheduleGaps(input([slot(D[0], 'f1')], [{ teamId: 's1', got: 9, short: 3, units: 4.5 }]));
    assert.equal(`${G.pageLine(g, D, 'this week')}`, '1 team is 3 slots short of its share, and 1 slot is open, on Sun, Jan 3.');
    assert.deepEqual([g.short[0].has, g.short[0].share], [4.5, 7]);
  });
  it('a slot a team handed back is never offered back to it', () => {
    const g = scheduleGaps(input([slot(D[0], 'f5', [], { handedBack: { teamId: 's1' } })], [{ teamId: 's1', got: 2, short: 1 }]));
    assert.deepEqual(g.open[0].takers, []);
  });
  it('"every team allowed there has its share" only when it is true', () => {
    // s1 (Select, allowed on f5) is short but held back by one a day; r1 (Rep) is kept off f5.
    const g = scheduleGaps(input(
      [slot(D[0], 'f5', ['s1']), slot(D[0], 'f1', ['r2']), slot(D[1], 'f1', ['r1']), slot(D[1], 'f5', ['s1']), slot(D[1], 'f6')],
      [{ teamId: 's1', got: 2, short: 1 }, { teamId: 'r1', got: 1, short: 1 }], { maxPerDay: 1, fieldsBy: [{ facilityIds: ['f5', 'f6'], groupIds: ['sel'], teamIds: [] }] },
    ));
    const kept = g.groups.find(x => x.kind === 'kept');
    assert.ok(kept && kept.kind === 'kept' && !kept.allowedMet);
    assert.doesNotMatch(G.explain(kept!, g, () => '', () => ['Field 6']), /every team allowed there/);
  });
  it('fields said once, with the right plural', () => {
    assert.equal(G.where(['Box 1', 'Box 2']), 'Boxes 1 and 2');
    assert.equal(G.where(['Diamond A', 'Diamond B']), 'Diamond A and Diamond B');
  });
});

describe('the page line: the same sentence on every set of dates', () => {
  const g = scheduleGaps(input(
    [slot(D[0], 'f1', ['r1']), slot(D[0], 'f2', ['r2']), slot(D[1], 'f1', ['r1']), slot(D[1], 'f2', ['r2']), slot(D[2], 'f1', ['r1']), slot(D[2], 'f2', ['r2']), slot(D[2], 'f5'), slot(D[2], 'f6')],
    [{ teamId: 'r1', got: 3, short: 1 }, { teamId: 'r2', got: 3, short: 1 }], { maxPerDay: 1 },
  ));
  it('says how many are short, by how much, how many slots are open, and where', () => {
    assert.equal(G.pageLine(g, D, 'on these Sundays'), '2 teams are 1 slot short of their share, and 2 slots are open, all on Sun, Jan 17.');
  });
  it('nothing short and nothing open: no line', () => {
    assert.equal(G.pageLine(scheduleGaps(input([slot(D[0], 'f1', ['r1'])], [])), D, 'this week'), null);
  });
  it('open on several dates: how many of them are on screen', () => {
    const two = scheduleGaps(input([slot(D[0], 'f1'), slot(D[1], 'f1'), slot(D[2], 'f1')], []));
    assert.equal(G.pageLine(two, [D[0]], 'on these Sundays'), '3 slots are open, on 3 Sundays, 1 of them on these Sundays.');
  });
  it('a day’s open slots in one row; fields said once', () => {
    assert.equal(G.when('2027-03-07', ['09:00', '08:00', '10:00', '08:00']), 'Sun, Mar 7 · 8:00 a.m., 9:00 a.m. and 10:00 a.m.');
    assert.equal(G.where(['Field 5', 'Field 6', 'Field 5']), 'Fields 5 and 6');
  });
});
