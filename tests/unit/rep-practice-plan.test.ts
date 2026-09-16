import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockAsksForTeaching,
  blockRotates,
  computeBlockClocks, walkBlockClocks,
  computeRotation,
  defaultIntervalMinutes,
  startingGroupsForStation,
  copyPracticePlanForReuse,
  describeSplit,
  drawGroups,
  formatDuration,
  isPracticePlanEmpty,
  practiceKitBag,
  resolvePracticePlanTagNames,
  settleBlockKit, settleBlockPeople, settlePlanLevels,
  describeRounds, rotationByStation, stationWalk,
  movePlayerToGroup, unplacedPlayers,
  splitBlockIntoStations, collapseSoleStation,
  arrangeGroup, forgetArrangement, settleArrangements,
  sanitizePracticePlan,
  totalPlannedMinutes,
} from '../../lib/rep-practice-plan.ts';
import type { PracticePlan, PracticeRotation, PracticeStation } from '../../lib/types.ts';

/** A deterministic rng for the draw — sequence repeats, so shuffles are reproducible. */
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const station = (id: string, name: string): PracticeStation => ({ id, name });

function plan(overrides: Partial<PracticePlan> = {}): PracticePlan {
  return { version: 1, blocks: [], ...overrides };
}

describe('sanitizePracticePlan', () => {
  it('returns null for a plan with nothing in it (so the column goes back to NULL)', () => {
    assert.equal(sanitizePracticePlan({ version: 1, blocks: [] }), null);
    assert.equal(sanitizePracticePlan(null), null);
    assert.equal(sanitizePracticePlan('nope'), null);
  });

  // ⚠ Autosave fires ~1s after typing stops, so anything that discarded "empty" rows would delete
  // the block or station the coach had just added and was about to fill in.
  it('KEEPS a row the coach created but has not typed into yet', () => {
    const p = sanitizePracticePlan({ blocks: [{ title: '   ' }] });
    assert.equal(p?.blocks.length, 1, 'a bare "Add a block" survives the round trip');
    assert.equal(p?.blocks[0].title, '');

    const withStations = sanitizePracticePlan({
      blocks: [{ title: 'Stations', duration: { minutes: 20 }, stations: [{}, {}, {}] }],
    });
    assert.equal(withStations?.blocks[0].stations?.length, 3, 'three added stations, three kept');
  });

  it('still refuses junk that was never a row', () => {
    const p = sanitizePracticePlan({
      blocks: ['nope', null, 42, { title: 'Real' }],
    });
    assert.equal(p?.blocks.length, 1);
    assert.equal(p?.blocks[0].title, 'Real');
  });

  it('keeps a plan that only has a goal', () => {
    const p = sanitizePracticePlan({ goal: 'Contact point', blocks: [] });
    assert.equal(p?.goal, 'Contact point');
    assert.equal(p?.blocks.length, 0);
  });

  it('allows only ONE "rest of practice" block per plan (D13)', () => {
    const p = sanitizePracticePlan({
      blocks: [
        { title: 'Warm up', duration: { minutes: 10 } },
        { title: 'Hitting', duration: { restOfPractice: true } },
        { title: 'Scrimmage', duration: { restOfPractice: true } },
      ],
    });
    assert.equal(p?.blocks[1].duration.restOfPractice, true);
    // The second one keeps its block — the coach doesn't lose their work — but loses the claim.
    assert.equal(p?.blocks[2].duration.restOfPractice, undefined);
    assert.equal(p?.blocks[2].title, 'Scrimmage');
  });

  // Regression: the downgrade used to happen AFTER the "is this row empty?" gate, so a second
  // rest-of-practice block with no other content was written, then dropped by the very next
  // read — vanishing in the same request that saved it.
  it('is IDEMPOTENT — sanitising twice gives the same plan (it runs on read as well as write)', () => {
    const once = sanitizePracticePlan({
      blocks: [
        { title: 'Warm up', duration: { restOfPractice: true } },
        { title: 'Hitting', duration: { restOfPractice: true } },
        { duration: { restOfPractice: true } },
      ],
    });
    const twice = sanitizePracticePlan(once);
    assert.deepEqual(twice, once);
  });

  it('a second rest-of-practice block loses the claim but keeps its place', () => {
    const p = sanitizePracticePlan({
      blocks: [
        { title: 'Scrimmage', duration: { restOfPractice: true } },
        { duration: { restOfPractice: true } },
      ],
    });
    assert.equal(p?.blocks.length, 2, 'the coach keeps the block they added');
    assert.equal(p?.blocks[0].duration.restOfPractice, true);
    assert.equal(p?.blocks[1].duration.restOfPractice, undefined, 'only one block can run to the end');
  });

  // ── People live at exactly ONE level (owner ruling 2026-08-01) ──
  it('a block with NO stations keeps its own player list', () => {
    const p = sanitizePracticePlan({
      blocks: [{ title: 'Warm up', duration: { minutes: 10 }, playerIds: ['p1', 'p2'] }],
    });
    assert.deepEqual(p?.blocks[0].playerIds, ['p1', 'p2']);
  });

  it('adding stations moves people off the block ONTO the first station — one level answers "who is here" (D8)', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Stations', rotates: false, duration: { minutes: 20 },
        playerIds: ['p1', 'p2'],
        stations: [{ name: 'Tees', playerIds: ['p1'] }, { name: 'Toss', playerIds: ['p2'] }],
      }],
    });
    assert.equal(p?.blocks[0].playerIds, undefined, 'the block-level list is gone');
    assert.deepEqual(p?.blocks[0].stations?.[0].playerIds, ['p1'], 'the first station took the block\'s names — p2 already stood at Toss, so it stays there and lands nowhere else');
    assert.deepEqual(p?.blocks[0].stations?.[1].playerIds, ['p2'], 'the other stations keep theirs');
  });

  it('a ROTATING block keeps people only in its groups — a name on the block or a station JOINS them (D8)', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Carousel', duration: { minutes: 45 },
        playerIds: ['p1', 'p2'],
        stations: [{ name: 'Tees', playerIds: ['p1'] }, { name: 'Toss', playerIds: ['p2'] }],
        rotation: { totalMinutes: 45, intervalMinutes: 15, groups: [{ name: 'Group A', playerIds: ['p1'] }] },
      }],
    });
    assert.equal(p?.blocks[0].playerIds, undefined);
    assert.equal(p?.blocks[0].stations?.[0].playerIds, undefined);
    assert.deepEqual(p?.blocks[0].rotation?.groups[0].playerIds, ['p1', 'p2'], 'p2 was a stray and joined the standing group');
  });

  it('drops a legacy range entirely — ranges were removed (owner 2026-08-01)', () => {
    const p = sanitizePracticePlan({ blocks: [{ title: 'A', duration: { minutes: 25, toMinutes: 35 } }] });
    assert.equal((p?.blocks[0].duration as unknown as Record<string, unknown>).toMinutes, undefined);
    assert.equal(p?.blocks[0].duration.minutes, 25);
  });

  it('rejects nonsense durations instead of storing NaN', () => {
    const p = sanitizePracticePlan({
      blocks: [{ title: 'A', duration: { minutes: 'abc' } }, { title: 'B', duration: { minutes: -5 } }],
    });
    assert.equal(p?.blocks[0].duration.minutes, null);
    assert.equal(p?.blocks[1].duration.minutes, null);
  });

  it('rotation needs TWO stations — one station with groups queued behind it is a queue', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Tees only', duration: { minutes: 20 },
        stations: [{ name: 'Tees', playerIds: ['p1'] }],
        rotation: { totalMinutes: 20, intervalMinutes: 10, groups: [{ name: 'Group A', playerIds: ['p1'] }] },
      }],
    });
    assert.equal(blockRotates(p!.blocks[0]), false);
    assert.deepEqual(p?.blocks[0].stations?.[0].playerIds, ['p1'], 'so the station keeps its own people');
  });

  // ⚠ One child cannot stand at two stations in the same round.
  it('a player can only be in ONE group — a duplicate is dropped from the later group', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Carousel', duration: { minutes: 30 },
        stations: [{ name: 'A' }, { name: 'B' }],
        rotation: {
          intervalMinutes: 15,
          groups: [
            { name: 'Group A', playerIds: ['p1', 'p2'] },
            { name: 'Group B', playerIds: ['p2', 'p3'] },
          ],
        },
      }],
    });
    assert.deepEqual(p?.blocks[0].rotation?.groups[0].playerIds, ['p1', 'p2']);
    assert.deepEqual(p?.blocks[0].rotation?.groups[1].playerIds, ['p3'], 'p2 stays where it was first placed');
  });

  it('rotation is the DEFAULT once there are two stations', () => {
    const p = sanitizePracticePlan({
      blocks: [{ title: 'Carousel', duration: { minutes: 30 }, stations: [{ name: 'A' }, { name: 'B' }] }],
    });
    assert.equal(blockRotates(p!.blocks[0]), true);
    assert.equal(p?.blocks[0].rotates, undefined, 'the default is not written out');
  });

  it('turning rotation off is remembered', () => {
    const p = sanitizePracticePlan({
      blocks: [{ title: 'Split', rotates: false, duration: { minutes: 30 }, stations: [{ name: 'A' }, { name: 'B' }] }],
    });
    assert.equal(p?.blocks[0].rotates, false);
    assert.equal(blockRotates(p!.blocks[0]), false);
  });

  it('restricts every player reference to the current roster, at whichever level holds it', () => {
    const roster = new Set(['p1']);
    const p = sanitizePracticePlan({
      blocks: [
        { title: 'Warm up', duration: { minutes: 10 }, playerIds: ['p1', 'gone'] },
        {
          title: 'Split', rotates: false, duration: { minutes: 20 },
          stations: [{ name: 'Tees', playerIds: ['p1', 'gone'] }, { name: 'Toss' }],
        },
        {
          title: 'Carousel', duration: { minutes: 30 },
          stations: [{ name: 'Tees' }, { name: 'Toss' }],
          rotation: { totalMinutes: 30, intervalMinutes: 15, groups: [{ name: 'Group A', playerIds: ['p1', 'gone'] }] },
        },
      ],
    }, roster);
    assert.deepEqual(p?.blocks[0].playerIds, ['p1']);
    assert.deepEqual(p?.blocks[1].stations?.[0].playerIds, ['p1']);
    assert.deepEqual(p?.blocks[2].rotation?.groups[0].playerIds, ['p1']);
  });

  // ── Equipment / practice types as reusable tags (owner ruling 2026-08-01) ──
  it('accepts equipment and practice types as tag lists, and reads legacy free-text kit', () => {
    const tagged = sanitizePracticePlan({
      practiceTypes: ['Hitting', 'hitting', 'Fielding'],
      equipment: ['balls', 'tees'],
      blocks: [{ title: 'A', duration: { minutes: 5 }, stations: [{ name: 'Tees', equipment: ['3 tees'] }] }],
    });
    assert.deepEqual(tagged?.practiceTypes, ['Hitting', 'Fielding'], 'case-insensitive de-dup');
    assert.deepEqual(tagged?.equipment, ['balls', 'tees']);
    assert.deepEqual(tagged?.blocks[0].stations?.[0].equipment, ['3 tees']);

    const legacy = sanitizePracticePlan({ kit: 'balls, bases, tees', blocks: [] });
    assert.deepEqual(legacy?.equipment, ['balls, bases, tees']);
  });

  it('keeps a plan that only has practice types on it', () => {
    assert.deepEqual(sanitizePracticePlan({ practiceTypes: ['Hitting'], blocks: [] })?.practiceTypes, ['Hitting']);
  });

  it('keeps the description — a paragraph under the goal — trimmed, capped, and alone it is a plan worth keeping', () => {
    const p = sanitizePracticePlan({ description: '  Bring the machine; parents on the gate.  ', blocks: [] });
    assert.equal(p?.description, 'Bring the machine; parents on the gate.');
    assert.equal(sanitizePracticePlan({ description: '   ', blocks: [] }), null, 'whitespace is no description');
    assert.equal(sanitizePracticePlan({ description: 'x'.repeat(5000), blocks: [] })?.description?.length, 2000);
  });

  it('"What everyone\'s working on" is an ADDITION: stored only when true, and alone it is a plan worth keeping', () => {
    // Owner ruling 2026-09-14 — the rail is on a sheet because the coach put it there. A coach
    // who adds it and saves must find it on reload, so the flag alone is not "empty".
    assert.equal(sanitizePracticePlan({ includeFocusAreas: true, blocks: [] })?.includeFocusAreas, true);
    assert.equal(isPracticePlanEmpty({ version: 1, includeFocusAreas: true, blocks: [] }), false);
    // Anything but a literal true is the absence of the section — never a stored false.
    const off = sanitizePracticePlan({ includeFocusAreas: 'yes', goal: 'Contact', blocks: [] })!;
    assert.equal('includeFocusAreas' in off, false);
    assert.equal(sanitizePracticePlan({ includeFocusAreas: false, blocks: [] }), null);
  });

  it('de-duplicates a staff name repeated on one item', () => {
    const p = sanitizePracticePlan({ blocks: [{ title: 'A', duration: { minutes: 5 }, staff: ['Craig', 'craig', 'Adam'] }] });
    assert.deepEqual(p?.blocks[0].staff, ['Craig', 'Adam']);
  });

  // Regression: an earlier hand-written "is this row empty?" checklist omitted `rotationNote`, so a
  // station carrying only "rotate halfway" silently vanished on save.
  it('keeps a station whose ONLY content is a rotation note', () => {
    const withNote = sanitizePracticePlan({
      blocks: [{ title: 'Stations', duration: { minutes: 20 }, stations: [{ rotationNote: 'swap halfway' }] }],
    });
    assert.equal(withNote?.blocks[0].stations?.length, 1);
    assert.equal(withNote?.blocks[0].stations?.[0].rotationNote, 'swap halfway');
  });

  // A 1a plan may carry `count`; the field was retired at owner QA (2026-08-01). Dropping it must
  // not take the station with it — the row is still the coach's, it just stops storing that number.
  it('drops a legacy station `count` but KEEPS the station', () => {
    const legacy = sanitizePracticePlan({
      blocks: [{ title: 'Stations', duration: { minutes: 20 }, stations: [{ name: 'Tees', count: 3 }] }],
    });
    assert.equal(legacy?.blocks[0].stations?.length, 1);
    assert.equal(legacy?.blocks[0].stations?.[0].name, 'Tees');
    assert.ok(!('count' in (legacy?.blocks[0].stations?.[0] ?? {})));
  });

  it('keeps a block whose ONLY content is coaching points', () => {
    const p = sanitizePracticePlan({ blocks: [{ coachingPoints: ['stay back', 'short stride'] }] });
    assert.deepEqual(p?.blocks[0].coachingPoints, ['stay back', 'short stride']);
  });

  it('a plan is only NULL when the coach has added nothing at all', () => {
    // One bare block IS something the coach did, so the plan is worth storing.
    assert.notEqual(sanitizePracticePlan({ blocks: [{}] }), null);
    assert.equal(sanitizePracticePlan({ blocks: [] }), null);
  });

  it('caps the block list', () => {
    const blocks = Array.from({ length: 60 }, (_, i) => ({ title: `B${i}`, duration: { minutes: 5 } }));
    assert.equal(sanitizePracticePlan({ blocks })?.blocks.length, 30);
  });
});

describe('computeBlockClocks', () => {
  const start = '2026-08-04T22:00:00.000Z'; // 6:00 PM Toronto (EDT)

  it('runs the clock forward from the event start, in the ORG zone', () => {
    const clocks = computeBlockClocks(
      [
        { id: 'b1', rotates: false, title: 'Warm up', duration: { minutes: 15 } },
        { id: 'b2', rotates: false, title: 'Hitting', duration: { minutes: 30 } },
      ],
      start, null,
    );
    assert.equal(clocks[0].startLabel, '6:00 p.m.');
    assert.equal(clocks[0].endLabel, '6:15 p.m.');
    assert.equal(clocks[1].startLabel, '6:15 p.m.');
    assert.equal(clocks[1].endLabel, '6:45 p.m.');
  });


  it('runs a "rest of practice" block to the event end, and admits when it cannot know', () => {
    const blocks = [
      { id: 'b1', rotates: false, title: 'Warm up', duration: { minutes: 15 } },
      { id: 'b2', rotates: false, title: 'Scrimmage', duration: { minutes: null, restOfPractice: true } },
    ];
    const withEnd = computeBlockClocks(blocks, start, '2026-08-04T23:30:00.000Z');
    assert.equal(withEnd[1].endLabel, '7:30 p.m.');
    const withoutEnd = computeBlockClocks(blocks, start, null);
    assert.equal(withoutEnd[1].endLabel, null, 'an unknown end is null, never a guess');
  });

  it('returns nothing when the event has no start time', () => {
    assert.deepEqual(computeBlockClocks([], null, null), []);
  });
});

describe('formatDuration / totalPlannedMinutes', () => {
  it('phrases each duration form once', () => {
    assert.equal(formatDuration({ minutes: 25 }), '25 min');
    assert.equal(formatDuration({ minutes: null, restOfPractice: true }), 'Rest of practice');
    assert.equal(formatDuration({ minutes: null }), '');
  });

  it('never invents a number for "rest of practice"', () => {
    const total = totalPlannedMinutes(plan({ blocks: [
      { id: 'b1', rotates: false, title: 'A', duration: { minutes: 15 } },
      { id: 'b2', rotates: false, title: 'B', duration: { minutes: null, restOfPractice: true } },
    ] }));
    assert.equal(total, 15);
  });
});

describe('drawGroups (D21 — deliberately dumb)', () => {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];

  it('splits into N groups, everyone placed exactly once', () => {
    const groups = drawGroups(players, 'groups', 3, seededRng(7));
    assert.equal(groups.length, 3);
    const placed = groups.flatMap(g => g.playerIds);
    assert.equal(placed.length, players.length);
    assert.equal(new Set(placed).size, players.length);
  });

  it('splits by players-per-group, rounding UP so nobody is left out', () => {
    const groups = drawGroups(players, 'perGroup', 3, seededRng(7));
    assert.equal(groups.length, 4); // 10 players, 3 per group → 4 groups
    assert.equal(groups.flatMap(g => g.playerIds).length, 10);
  });

  it('produces an uneven split honestly rather than dropping a player', () => {
    const groups = drawGroups(players, 'groups', 3, seededRng(11));
    const sizes = groups.map(g => g.playerIds.length).sort();
    assert.deepEqual(sizes, [3, 3, 4]);
    assert.equal(describeSplit(groups), '3 groups from 10 — one of 4, two of 3.');
  });

  it('never makes more groups than there are players', () => {
    const groups = drawGroups(['p1', 'p2'], 'groups', 8, seededRng(3));
    assert.equal(groups.length, 2);
  });

  it('handles an empty draw without throwing', () => {
    assert.deepEqual(drawGroups([], 'groups', 3), []);
    assert.deepEqual(drawGroups(['p1'], 'groups', 0), []);
  });

  it('re-draws rather than optimising — a different seed gives a different arrangement', () => {
    const a = drawGroups(players, 'groups', 3, seededRng(1)).map(g => g.playerIds.join(','));
    const b = drawGroups(players, 'groups', 3, seededRng(999)).map(g => g.playerIds.join(','));
    assert.notDeepEqual(a, b);
  });
});

describe('the groups room — movePlayerToGroup / unplacedPlayers (stage 3 revision, D10 · D11)', () => {
  const roster = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  const rotation = (): PracticeRotation => ({
    intervalMinutes: 15,
    groupSource: 'random',
    groups: [
      { id: 'a', name: 'Group A', playerIds: ['p1', 'p2'] },
      { id: 'b', name: 'Group B', playerIds: ['p4', 'p5'] },
    ],
  });

  it('a player lands in ONE group and leaves the other — in roster order, never where let go', () => {
    const next = movePlayerToGroup(rotation(), 'p1', 'b', roster);
    assert.deepEqual(next.groups.map(g => g.playerIds), [['p2'], ['p1', 'p4', 'p5']]);
    assert.equal(next.groupSource, 'manual', 'placing by hand makes the groups chosen');
  });

  it('null takes a player out of every group', () => {
    const next = movePlayerToGroup(rotation(), 'p4', null, roster);
    assert.deepEqual(next.groups.map(g => g.playerIds), [['p1', 'p2'], ['p5']]);
  });

  it('a player from nowhere joins a group in roster order', () => {
    const next = movePlayerToGroup(rotation(), 'p3', 'a', roster);
    assert.deepEqual(next.groups[0].playerIds, ['p1', 'p2', 'p3']);
    assert.deepEqual(movePlayerToGroup(rotation(), 'p6', 'a', roster).groups[0].playerIds, ['p1', 'p2', 'p6']);
    assert.deepEqual(movePlayerToGroup(rotation(), 'p3', 'b', roster).groups[1].playerIds, ['p3', 'p4', 'p5']);
  });

  it('returns the SAME object when nothing would change — already there, already out, unknown target', () => {
    const r = rotation();
    assert.equal(movePlayerToGroup(r, 'p1', 'a', roster), r);
    assert.equal(movePlayerToGroup(r, 'p3', null, roster), r);
    assert.equal(movePlayerToGroup(r, 'p1', 'nope', roster), r);
    assert.equal(r.groupSource, 'random', 'and the source is untouched');
  });

  it('a stale id (off the roster) sorts last and is never dropped', () => {
    const r: PracticeRotation = { ...rotation(), groups: [{ id: 'a', name: 'Group A', playerIds: ['gone', 'p2'] }] };
    assert.deepEqual(movePlayerToGroup(r, 'p1', 'a', roster).groups[0].playerIds, ['p1', 'p2', 'gone']);
  });

  it('unplacedPlayers is the roster minus every group, in roster order — where a binned group lands', () => {
    const people = roster.map(id => ({ id }));
    assert.deepEqual(unplacedPlayers(people, rotation().groups).map(p => p.id), ['p3', 'p6']);
    const binned = rotation().groups.filter(g => g.id !== 'b');
    assert.deepEqual(unplacedPlayers(people, binned).map(p => p.id), ['p3', 'p4', 'p5', 'p6']);
    assert.deepEqual(unplacedPlayers(people, []).map(p => p.id), roster);
  });
});

describe('D13 — "+ Stations" on a written block makes TWO; binning back to one comes home', () => {
  const written = (): PracticePlan['blocks'][number] => ({
    id: 'b1', title: 'Passing drill', duration: { minutes: 15 },
    description: 'Two lines facing.', goal: 'Weight of pass.', coachingPoints: ['Head up', 'Follow your pass'],
    equipmentTagIds: ['cones'], playerIds: ['p1', 'p2'], staffTagIds: ['coach-bob'],
  });
  let n = 0;
  const ids = () => `s${++n}`;

  it('the words move into station 1, named after the block; the block keeps title, minutes, staff, kit and people for the settle pass', () => {
    const out = splitBlockIntoStations(written(), { id: 'new', name: '' }, ids);
    assert.equal(out.stations?.length, 2);
    const [first, second] = out.stations!;
    assert.equal(first.name, 'Passing drill');
    assert.equal(first.description, 'Two lines facing.');
    assert.equal(first.goal, 'Weight of pass.');
    assert.deepEqual(first.coachingPoints, ['Head up', 'Follow your pass']);
    assert.equal(second.id, 'new');
    assert.equal(out.description, undefined);
    assert.equal(out.goal, undefined);
    assert.equal(out.coachingPoints, undefined);
    assert.equal(out.title, 'Passing drill');
    assert.deepEqual(out.staffTagIds, ['coach-bob']);
    // kit and people are the settle pass's to move — they are still on the block here
    assert.deepEqual(out.equipmentTagIds, ['cones']);
    assert.deepEqual(out.playerIds, ['p1', 'p2']);
    // and the settle pass moves them onto station 1 / into the first draw
    const settled = settlePlanLevels({ version: 3, blocks: [out] }).blocks[0];
    assert.deepEqual(settled.stations?.[0].equipmentTagIds, ['cones']);
    assert.equal(settled.playerIds, undefined);
    assert.equal(settled.rotation?.groups.flatMap(g => g.playerIds).length, 2);
  });

  it('an EMPTY block — no title, no words — splits too: what arrives is station 1 and a blank station 2 stands beside it (owner, 2026-09-16)', () => {
    const empty = { ...written(), title: '', description: undefined, goal: undefined, coachingPoints: undefined };
    const out = splitBlockIntoStations(empty, { id: 'new', name: 'Drill', drillId: 'd1' }, ids);
    assert.equal(out.stations?.length, 2);
    assert.equal(out.stations?.[0].id, 'new', 'the drill is station 1');
    assert.equal(out.stations?.[1].name, '', 'a blank station 2 to type into');
    const blank = splitBlockIntoStations(empty, { id: 'w', name: '' }, ids);
    assert.equal(blank.stations?.length, 2, 'two blank stations when you write one');
    // and binning one of two blanks comes home to an empty block again
    assert.equal(collapseSoleStation({ ...blank, stations: [blank.stations![0]] }).stations, undefined);
  });

  it('a TITLE alone is an activity — "Warm-up" with nothing typed under it still splits (owner, 2026-09-16)', () => {
    const titled = { ...written(), description: undefined, goal: undefined, coachingPoints: undefined };
    const out = splitBlockIntoStations(titled, { id: 'new', name: '' }, ids);
    assert.equal(out.stations?.length, 2);
    assert.equal(out.stations?.[0].name, 'Passing drill');
    assert.equal(out.stations?.[0].description, undefined);
    assert.equal(out.stations?.[1].id, 'new');
    // and it comes home when the second is binned — a nameless survivor with no words goes quietly
    const back = collapseSoleStation({ ...out, stations: [out.stations![0]] });
    assert.equal(back.stations, undefined);
    assert.equal(back.title, 'Passing drill');
  });

  it('a block that already has stations just gains one', () => {
    const circuit = { ...written(), stations: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
    const out = splitBlockIntoStations(circuit, { id: 'c', name: 'C' }, ids);
    assert.deepEqual(out.stations?.map(s => s.id), ['a', 'b', 'c']);
    assert.equal(out.description, 'Two lines facing.', 'the intro stays the intro');
  });

  it('the reverse: one written station left and no block words → the words come back up, the station goes', () => {
    const block: PracticePlan['blocks'][number] = {
      id: 'b1', title: 'Passing drill', duration: { minutes: 15 },
      stations: [{ id: 's1', name: 'Passing drill', description: 'Two lines facing.', goal: 'Weight of pass.', coachingPoints: ['Head up'], staffTagIds: ['bob'], equipmentTagIds: ['cones'], playerIds: ['p1'] }],
    };
    const out = collapseSoleStation(block);
    assert.equal(out.stations, undefined);
    assert.equal(out.description, 'Two lines facing.');
    assert.equal(out.goal, 'Weight of pass.');
    assert.deepEqual(out.coachingPoints, ['Head up']);
    assert.deepEqual(out.staffTagIds, ['bob']);
    assert.deepEqual(out.equipmentTagIds, ['cones']);
    assert.deepEqual(out.playerIds, ['p1']);
  });

  it('…but NOTHING merges or drops: intro words on the block, a drill, a setup or a note keep the station', () => {
    const base: PracticePlan['blocks'][number] = { id: 'b1', title: 'X', duration: { minutes: 15 }, stations: [{ id: 's1', name: 'S', description: 'words' }] };
    assert.equal(collapseSoleStation({ ...base, goal: 'intro' }).stations?.length, 1);
    assert.equal(collapseSoleStation({ ...base, stations: [{ ...base.stations![0], drillId: 'd1' }] }).stations?.length, 1);
    assert.equal(collapseSoleStation({ ...base, stations: [{ ...base.stations![0], setup: 'cones' }] }).stations?.length, 1);
    assert.equal(collapseSoleStation({ ...base, stations: [{ ...base.stations![0], note: 'tonight' }] }).stations?.length, 1);
    assert.equal(collapseSoleStation({ ...base, stations: [base.stations![0], { id: 's2', name: 'T' }] }).stations?.length, 2, 'two stations are not a collapse');
  });
});

describe('D14 — the rotation grid is a starting point the coach can arrange', () => {
  const stations: PracticeStation[] = [{ id: 'test', name: 'test' }, { id: 'test2', name: 'test2' }];
  const rotation = (): PracticeRotation => ({
    intervalMinutes: 15, groupSource: 'random',
    groups: [{ id: 'A', name: 'Group A', playerIds: ['p1'] }, { id: 'B', name: 'Group B', playerIds: ['p2'] }],
  });

  it('the first move remembers the carousel and changes one cell; the grid reads it', () => {
    const r = arrangeGroup(rotation(), stations, 30, 1, 'B', 'test');
    assert.ok(r.arrangement, 'an arrangement now exists');
    assert.deepEqual(r.arrangement!.placements, [{ A: 'test', B: 'test' }, { A: 'test2', B: 'test' }]);
    const grid = computeRotation(r, stations, 30);
    assert.equal(grid.arranged, true);
    assert.deepEqual(grid.roundsList[0].cells.map(c => `${c.groupName}@${c.stationName}`), ['Group A@test', 'Group B@test']);
    assert.ok(grid.notes.includes('Group A and Group B share test in round 1.'));
    assert.ok(grid.notes.includes('test2 has nobody in round 1.'));
    assert.ok(grid.notes.includes("Group B won't reach test2."));
    assert.ok(!grid.notes.includes('Everyone does everything.'));
  });

  it('null sits a group out: no cell, named in `out`, said in the notes', () => {
    const r = arrangeGroup(rotation(), stations, 30, 2, 'A', null);
    const grid = computeRotation(r, stations, 30);
    assert.deepEqual(grid.roundsList[1].cells.map(c => c.groupName), ['Group B']);
    assert.deepEqual(grid.roundsList[1].out.map(o => o.groupName), ['Group A']);
    assert.ok(grid.notes.includes('Group A sits round 2 out.'));
    const turned = rotationByStation(grid, stations);
    assert.deepEqual(turned.rows[1].out.map(o => o.name), ['Group A']);
    assert.deepEqual(turned.rows[1].cellGroups.map(c => c.map(g => g.id)), [['B'], []], 'B keeps its standard round-2 place at test');
  });

  it('a move that changes nothing, or names what the rotation lacks, hands the same object back', () => {
    const r = rotation();
    assert.equal(arrangeGroup(r, stations, 30, 1, 'A', 'test'), r, 'A already stands at test in round 1');
    assert.equal(arrangeGroup(r, stations, 30, 3, 'A', 'test2'), r, 'no round 3');
    assert.equal(arrangeGroup(r, stations, 30, 1, 'Z', 'test'), r, 'no group Z');
    assert.equal(arrangeGroup(r, stations, 30, 1, 'A', 'nowhere'), r, 'no such station');
  });

  it('"Back to the standard rotation" forgets it; the carousel reads exactly as before', () => {
    const r = forgetArrangement(arrangeGroup(rotation(), stations, 30, 1, 'B', 'test'));
    assert.equal(r.arrangement, undefined);
    const grid = computeRotation(r, stations, 30);
    assert.equal(grid.arranged, false);
    assert.ok(grid.notes.includes('Everyone does everything.'));
  });

  it('a station or group added, or the clock changed, RESETS it — the settle pass drops what no longer fits', () => {
    const arranged = arrangeGroup(rotation(), stations, 30, 1, 'B', 'test');
    const block = (over: Partial<PracticePlan['blocks'][number]>): PracticePlan => ({
      version: 3, blocks: [{ id: 'b', title: 'Circuit', duration: { minutes: 30 }, stations, rotation: arranged, ...over }],
    });
    assert.ok(settleArrangements(block({})).blocks[0].rotation?.arrangement, 'unchanged facts keep it');
    assert.equal(settleArrangements(block({ stations: [...stations, { id: 'x', name: 'X' }] })).blocks[0].rotation?.arrangement, undefined, 'a station added');
    assert.equal(settleArrangements(block({ duration: { minutes: 45 } })).blocks[0].rotation?.arrangement, undefined, 'three rounds now');
    assert.equal(settleArrangements(block({ rotation: { ...arranged, groups: [...arranged.groups, { id: 'C', name: 'Group C', playerIds: ['p3'] }] } })).blocks[0].rotation?.arrangement, undefined, 'a group added');
    // a rename or reorder of the same stations keeps it
    assert.ok(settleArrangements(block({ stations: [{ id: 'test2', name: 'Renamed' }, { id: 'test', name: 'test' }] })).blocks[0].rotation?.arrangement, 'same ids, new names and order');
    // computeRotation makes the same call at read time when it does not fit
    assert.equal(computeRotation(arranged, [...stations, { id: 'x', name: 'X' }], 30).arranged, false);
  });

  it('the sanitiser keeps a well-formed arrangement and drops a malformed or unfitting one', () => {
    const arranged = arrangeGroup(rotation(), stations, 30, 1, 'B', 'test');
    const plan: PracticePlan = { version: 3, blocks: [{ id: 'b', title: 'Circuit', duration: { minutes: 30 }, stations, rotation: arranged }] };
    const clean = sanitizePracticePlan(plan);
    assert.deepEqual(clean!.blocks[0].rotation?.arrangement?.placements, arranged.arrangement!.placements);
    const junk = sanitizePracticePlan({ ...plan, blocks: [{ ...plan.blocks[0], rotation: { ...arranged, arrangement: { rounds: 'two', placements: 'no' } } }] });
    assert.equal(junk!.blocks[0].rotation?.arrangement, undefined);
    const stale = sanitizePracticePlan({ ...plan, blocks: [{ ...plan.blocks[0], duration: { minutes: 45 } }] });
    assert.equal(stale!.blocks[0].rotation?.arrangement, undefined, 'the clock moved — dropped on the way in');
  });
});

describe('computeRotation (D22–D26)', () => {
  const groups = [
    { id: 'gA', name: 'Group A', playerIds: ['p1', 'p2'] },
    { id: 'gB', name: 'Group B', playerIds: ['p3', 'p4'] },
    { id: 'gC', name: 'Group C', playerIds: ['p5', 'p6'] },
  ];
  const stations = [station('s1', 'Tees'), station('s2', 'Front toss'), station('s3', 'Fielding')];

  it('computes 3 rounds of 15 from 45 and everyone does everything', () => {
    const grid = computeRotation({ intervalMinutes: 15, groups, groupSource: 'manual' }, stations, 45);
    assert.equal(grid.rounds, 3);
    assert.equal(grid.spareMinutes, 0);
    assert.equal(grid.roundsList.length, 3);
    assert.ok(grid.notes.includes('Everyone does everything.'));
  });

  it('moves each group forward one station per round, coaches staying put', () => {
    const grid = computeRotation({ intervalMinutes: 15, groups, groupSource: 'manual' }, stations, 45);
    assert.equal(grid.roundsList[0].cells[0].stationName, 'Tees');        // A starts at Tees
    assert.equal(grid.roundsList[1].cells[0].stationName, 'Front toss');  // …then moves on
    assert.equal(grid.roundsList[2].cells[0].stationName, 'Fielding');
    assert.equal(grid.roundsList[0].cells[1].stationName, 'Front toss');  // B starts one along
  });

  it('STATES the leftover minutes rather than rounding them away (D24)', () => {
    const grid = computeRotation({ intervalMinutes: 15, groups, groupSource: 'manual' }, stations, 50);
    assert.equal(grid.rounds, 3);
    assert.equal(grid.spareMinutes, 5);
    assert.ok(grid.notes.some(n => n.includes('5 min spare')));
  });

  it('names the groups that will not reach a station, never inventing a round (D25)', () => {
    // 30 minutes at 15 = 2 rounds across 3 stations: every group misses one.
    const grid = computeRotation({ intervalMinutes: 15, groups, groupSource: 'manual' }, stations, 30);
    assert.equal(grid.rounds, 2, 'a third round is never invented to tidy it up');
    assert.ok(grid.notes.some(n => n.startsWith("Group A won't reach")));
    assert.ok(grid.notes.some(n => n.startsWith("Group C won't reach")));
  });

  it('says which groups SHARE a station when there are more groups than stations', () => {
    const fourGroups = [...groups, { id: 'gD', name: 'Group D', playerIds: ['p7'] }];
    const grid = computeRotation({ intervalMinutes: 15, groups: fourGroups, groupSource: 'manual' }, stations, 45);
    assert.equal(grid.roundsList[0].cells.length, 4, 'no group is dropped to make it fit');
    assert.ok(grid.notes.some(n => n.includes('share')));
  });

  it('refuses to compute when the interval is longer than the block, and says why', () => {
    const grid = computeRotation({ intervalMinutes: 60, groups, groupSource: 'manual' }, stations, 45);
    assert.equal(grid.rounds, 0);
    assert.equal(grid.incomplete, true);
    assert.ok(grid.notes[0].includes("doesn't fit"));
  });

  it('asks for what is missing instead of rendering an empty grid', () => {
    const grid = computeRotation({ intervalMinutes: null, groups: [], groupSource: 'manual' }, [], null);
    assert.equal(grid.incomplete, true);
    assert.ok(grid.notes[0].startsWith('Add '));
  });

  it('ignores unnamed stations rather than printing blank stops', () => {
    const grid = computeRotation(
      { intervalMinutes: 15, groups: groups.slice(0, 2), groupSource: 'manual' },
      [station('s1', 'Tees'), station('s2', '  ')], 30,
    );
    assert.equal(grid.roundsList[0].cells.every(c => c.stationName === 'Tees'), true);
  });
});

describe('defaultIntervalMinutes', () => {
  it('splits the block evenly across its stations — one turn each', () => {
    assert.equal(defaultIntervalMinutes(45, 3), 15);
    assert.equal(defaultIntervalMinutes(50, 3), 16, 'rounds down; the spare is stated by the grid');
  });

  it('has no answer without a length or any stations', () => {
    assert.equal(defaultIntervalMinutes(null, 3), null);
    assert.equal(defaultIntervalMinutes(45, 0), null);
    assert.equal(defaultIntervalMinutes(2, 5), null, 'less than a minute each is no interval at all');
  });

  it('is what the grid falls back to when the coach has not set one', () => {
    const grid = computeRotation(
      {
        intervalMinutes: null, groupSource: 'manual',
        groups: [{ id: 'a', name: 'A', playerIds: ['p1'] }, { id: 'b', name: 'B', playerIds: ['p2'] }],
      },
      [station('s1', 'Tees'), station('s2', 'Toss')],
      40,
    );
    assert.equal(grid.intervalMinutes, 20);
    assert.equal(grid.rounds, 2);
  });
});

describe('startingGroupsForStation', () => {
  const rotation = {
    totalMinutes: 45, intervalMinutes: 15, groupSource: 'manual' as const,
    groups: [
      { id: 'gA', name: 'Group A', playerIds: ['p1'] },
      { id: 'gB', name: 'Group B', playerIds: ['p2'] },
      { id: 'gC', name: 'Group C', playerIds: ['p3'] },
    ],
  };

  it('starts group i at station i, so each station can say who it begins with', () => {
    assert.deepEqual(startingGroupsForStation(rotation, 3, 0).map(g => g.name), ['Group A']);
    assert.deepEqual(startingGroupsForStation(rotation, 3, 1).map(g => g.name), ['Group B']);
    assert.deepEqual(startingGroupsForStation(rotation, 3, 2).map(g => g.name), ['Group C']);
  });

  it('names BOTH groups when more groups than stations share a start', () => {
    assert.deepEqual(startingGroupsForStation(rotation, 2, 0).map(g => g.name), ['Group A', 'Group C']);
    assert.deepEqual(startingGroupsForStation(rotation, 2, 1).map(g => g.name), ['Group B']);
  });

  it('says nobody starts at a station with more stations than groups', () => {
    assert.deepEqual(startingGroupsForStation(rotation, 4, 3), []);
    assert.deepEqual(startingGroupsForStation(null, 3, 0), []);
  });
});

describe('sanitizePracticePlan — staff/equipment tag ids (mig 266)', () => {
  it('accepts opaque staffTagIds/equipmentTagIds at every level, structurally, with no library check', () => {
    const plan = sanitizePracticePlan({
      equipmentTagIds: ['eq-1'],
      blocks: [{
        title: 'A', duration: { minutes: 5 }, staffTagIds: ['s-1'],
        stations: [{ name: 'Tees', staffTagIds: ['s-2'], equipmentTagIds: ['eq-2'] }],
      }],
    });
    assert.deepEqual(plan?.equipmentTagIds, ['eq-1']);
    assert.deepEqual(plan?.blocks[0].staffTagIds, ['s-1']);
    assert.deepEqual(plan?.blocks[0].stations?.[0].staffTagIds, ['s-2']);
    assert.deepEqual(plan?.blocks[0].stations?.[0].equipmentTagIds, ['eq-2']);
  });

  it('drops ids not in the supplied valid set, at every level, when one is passed', () => {
    const plan = sanitizePracticePlan(
      {
        equipmentTagIds: ['eq-real', 'eq-foreign'],
        blocks: [{ title: 'A', duration: { minutes: 5 }, staffTagIds: ['s-real', 's-foreign'] }],
      },
      undefined,
      new Set(['s-real']),
      new Set(['eq-real']),
    );
    assert.deepEqual(plan?.equipmentTagIds, ['eq-real']);
    assert.deepEqual(plan?.blocks[0].staffTagIds, ['s-real']);
  });

  it('leaves ids untouched when no valid set is supplied (structural-only pass)', () => {
    const plan = sanitizePracticePlan({
      blocks: [{ title: 'A', duration: { minutes: 5 }, staffTagIds: ['s-anything'] }],
    });
    assert.deepEqual(plan?.blocks[0].staffTagIds, ['s-anything']);
  });

  it('legacy staff/equipment strings still round-trip untouched beside the new id fields', () => {
    const plan = sanitizePracticePlan({
      equipment: ['Tees (4)'],
      blocks: [{ title: 'A', duration: { minutes: 5 }, staff: ['Coach Dana'] }],
    });
    assert.deepEqual(plan?.equipment, ['Tees (4)']);
    assert.deepEqual(plan?.blocks[0].staff, ['Coach Dana']);
  });
});

describe('resolvePracticePlanTagNames (mig 266) — display-only id→name resolution', () => {
  const STAFF = [{ id: 's-1', name: 'Dana' }];
  const EQUIPMENT = [{ id: 'eq-1', name: 'Tees (4)' }];

  it('resolves ids to current names at every level when present', () => {
    const plan = sanitizePracticePlan({
      equipmentTagIds: ['eq-1'],
      blocks: [{
        title: 'A', duration: { minutes: 5 }, staffTagIds: ['s-1'],
        stations: [{ name: 'Tees', staffTagIds: ['s-1'], equipmentTagIds: ['eq-1'] }],
      }],
    })!;
    const resolved = resolvePracticePlanTagNames(plan, STAFF, EQUIPMENT);
    assert.deepEqual(resolved.equipment, ['Tees (4)']);
    assert.deepEqual(resolved.blocks[0].staff, ['Dana']);
    assert.deepEqual(resolved.blocks[0].stations?.[0].staff, ['Dana']);
    assert.deepEqual(resolved.blocks[0].stations?.[0].equipment, ['Tees (4)']);
  });

  it('falls back to the legacy string when a level has no ids', () => {
    const plan = sanitizePracticePlan({
      equipment: ['Cones'],
      blocks: [{ title: 'A', duration: { minutes: 5 }, staff: ['Coach Priya'] }],
    })!;
    const resolved = resolvePracticePlanTagNames(plan, STAFF, EQUIPMENT);
    assert.deepEqual(resolved.equipment, ['Cones']);
    assert.deepEqual(resolved.blocks[0].staff, ['Coach Priya']);
  });

  it('silently drops an id with no match in the library rather than showing a blank', () => {
    const plan = sanitizePracticePlan({
      blocks: [{ title: 'A', duration: { minutes: 5 }, staffTagIds: ['s-deleted'] }],
    })!;
    const resolved = resolvePracticePlanTagNames(plan, STAFF, EQUIPMENT);
    assert.deepEqual(resolved.blocks[0].staff, []);
  });
});

describe('template provenance on a plan (Phase 3)', () => {
  it('round-trips templateId and the snapshotted templateName', () => {
    const plan = sanitizePracticePlan({
      templateId: 'tpl-1',
      templateName: 'Standard Tuesday',
      blocks: [{ title: 'A', duration: { minutes: 10 } }],
    });
    assert.equal(plan?.templateId, 'tpl-1');
    assert.equal(plan?.templateName, 'Standard Tuesday');
    // Idempotent, like every other field — this sanitiser runs on read as well as on write.
    assert.deepEqual(sanitizePracticePlan(plan), plan);
  });

  it('⚠ SURVIVES an edit, unlike a drill’s provenance — a template is scaffolding', () => {
    // A drill's id is cleared the moment a coach changes its words, because a drill is an identity
    // claim. "This plan started from Standard Tuesday" stays true however much they change, so
    // this id is not cleared by anything. Both rules are right, one screen apart.
    const edited = sanitizePracticePlan({
      templateId: 'tpl-1', templateName: 'Standard Tuesday',
      blocks: [{ title: 'Completely different', duration: { minutes: 45 } }],
    });
    assert.equal(edited?.templateId, 'tpl-1');
  });
});

describe('copyPracticePlanForReuse (D7 — a copy, never a series write)', () => {
  it('⚠ does NOT carry template provenance forward', () => {
    // Provenance records the IMMEDIATE source, and this coach started from a PRACTICE. Carrying it
    // would inflate "Started 8 plans" with plans nobody started from that template, and the
    // provenance line would name a template the coach never opened.
    const source = sanitizePracticePlan({
      templateId: 'tpl-1', templateName: 'Standard Tuesday',
      blocks: [{ title: 'A', duration: { minutes: 10 } }],
    })!;
    let n = 0;
    const copy = copyPracticePlanForReuse(source, new Set<string>(), () => `x${++n}`);
    assert.equal(copy.templateId, undefined);
    assert.equal(copy.templateName, undefined);
  });

  it('gives every block, station and group a fresh id and drops departed players', () => {
    let n = 0;
    const source = sanitizePracticePlan({
      goal: 'Contact point',
      practiceTypes: ['Hitting'],
      equipment: ['balls'],
      blocks: [{
        title: 'Carousel', duration: { minutes: 45 },
        stations: [{ name: 'Tees' }, { name: 'Toss' }],
        rotation: { totalMinutes: 45, intervalMinutes: 15, groups: [{ name: 'Group A', playerIds: ['p1', 'left'] }] },
      }],
    })!;
    const copy = copyPracticePlanForReuse(source, new Set(['p1']), () => `new-${n++}`);
    assert.equal(copy.goal, 'Contact point');
    assert.deepEqual(copy.practiceTypes, ['Hitting'], 'the kind of practice carries forward');
    assert.deepEqual(copy.equipment, ['balls']);
    assert.equal(copy.blocks[0].id, 'new-0');
    assert.notEqual(copy.blocks[0].id, source.blocks[0].id);
    assert.deepEqual(copy.blocks[0].rotation?.groups[0].playerIds, ['p1']);
  });

  it('carries the description forward — the paragraph is shape, like the goal', () => {
    const src = sanitizePracticePlan({ description: 'Our standard Tuesday.', blocks: [{ title: 'A', duration: { minutes: 10 } }] })!;
    assert.equal(copyPracticePlanForReuse(src, new Set<string>(), () => 'x').description, 'Our standard Tuesday.');
  });

  it('carries the focus section forward like kit — it is shape, not people', () => {
    const on = sanitizePracticePlan({ includeFocusAreas: true, blocks: [{ title: 'A', duration: { minutes: 10 } }] })!;
    assert.equal(copyPracticePlanForReuse(on, new Set<string>(), () => 'x').includeFocusAreas, true);
    const off = sanitizePracticePlan({ blocks: [{ title: 'A', duration: { minutes: 10 } }] })!;
    assert.equal('includeFocusAreas' in copyPracticePlanForReuse(off, new Set<string>(), () => 'x'), false);
  });
});

describe('isPracticePlanEmpty', () => {
  it('treats a blank plan and a missing plan the same', () => {
    assert.equal(isPracticePlanEmpty(null), true);
    assert.equal(isPracticePlanEmpty(plan()), true);
    assert.equal(isPracticePlanEmpty(plan({ goal: 'x' })), false);
  });

  it('a plan holding only equipmentTagIds (mig 266) is not empty', () => {
    assert.equal(isPracticePlanEmpty(plan({ equipmentTagIds: ['eq-1'] })), false);
  });
});

describe('walkBlockClocks — the walk also says where it stopped (the sheet\'s ghost row)', () => {
  const start = '2026-08-04T22:00:00.000Z'; // 6:00 p.m. Toronto (EDT)
  it('with no blocks the next block starts at the practice start', () => {
    const walk = walkBlockClocks([], start, null);
    assert.deepEqual(walk.clocks, []);
    assert.equal(walk.nextStartLabel, '6:00 p.m.');
  });
  it('after two timed blocks the next start is their sum; a block with no length does not move it', () => {
    const walk = walkBlockClocks([
      { id: 'b1', rotates: false, title: 'Warm up', duration: { minutes: 15 } },
      { id: 'b2', rotates: false, title: 'Untimed', duration: { minutes: null } },
      { id: 'b3', rotates: false, title: 'Hitting', duration: { minutes: 30 } },
    ], start, null);
    assert.equal(walk.clocks.length, 3);
    assert.equal(walk.nextStartLabel, '6:45 p.m.');
  });
  it('a rest-of-practice block with an end runs the cursor to the end; without one it stays put', () => {
    const blocks = [
      { id: 'b1', rotates: false, title: 'Warm up', duration: { minutes: 15 } },
      { id: 'b2', rotates: false, title: 'Scrimmage', duration: { minutes: null, restOfPractice: true } },
    ];
    assert.equal(walkBlockClocks(blocks, start, '2026-08-04T23:30:00.000Z').nextStartLabel, '7:30 p.m.');
    assert.equal(walkBlockClocks(blocks, start, null).nextStartLabel, '6:15 p.m.');
  });
  it('no start time → nothing, including no next start', () => {
    assert.deepEqual(walkBlockClocks([], '', null), { clocks: [], nextStartMs: null, nextStartLabel: null });
  });
});

// ── Stage 2 · The block (owner rulings D7 and D11, 2026-09-15) ──────────────────────────────────

describe('blockAsksForTeaching (D7) — a block placed from a drill has no words of its own', () => {
  it('a block with no stations is the activity and asks', () => {
    assert.equal(blockAsksForTeaching({ stations: [] }), true);
    assert.equal(blockAsksForTeaching({}), true);
  });
  it('a block with two or more stations asks — its own line is the circuit\'s intro', () => {
    assert.equal(blockAsksForTeaching({ stations: [station('s1', 'A'), station('s2', 'B')] }), true);
  });
  it('a block with EXACTLY ONE station and nothing written on itself does not ask', () => {
    assert.equal(blockAsksForTeaching({ stations: [station('s1', 'Probe drill')] }), false);
    assert.equal(blockAsksForTeaching({ stations: [station('s1', 'A')], description: '  ', coachingPoints: [''] }), false);
  });
  it('a block that HAD words before its station arrived keeps asking — content is always shown', () => {
    assert.equal(blockAsksForTeaching({ stations: [station('s1', 'A')], goal: 'Head up' }), true);
    assert.equal(blockAsksForTeaching({ stations: [station('s1', 'A')], description: 'Intro' }), true);
    assert.equal(blockAsksForTeaching({ stations: [station('s1', 'A')], coachingPoints: ['Small touches'] }), true);
  });
});

describe('sanitizePracticePlan — kit lives at exactly ONE level, and MOVES (D11)', () => {
  it('a block with NO stations keeps its own kit', () => {
    const p = sanitizePracticePlan({
      blocks: [{ title: 'Warm-up', duration: { minutes: 15 }, equipmentTagIds: ['ladders', 'cones'] }],
    });
    assert.deepEqual(p?.blocks[0].equipmentTagIds, ['ladders', 'cones']);
    assert.equal(p?.equipmentTagIds, undefined, 'nothing rises to the plan');
  });

  it('kit on a block whose first station is WRITTEN moves onto that station — its own kit first', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Circuit', rotates: false, duration: { minutes: 20 },
        equipmentTagIds: ['ladders', 'cones'],
        stations: [{ name: 'Tees', equipmentTagIds: ['cones', 'tees'] }, { name: 'Toss' }],
      }],
    });
    assert.equal(p?.blocks[0].equipmentTagIds, undefined, 'the block-level list is gone');
    assert.deepEqual(p?.blocks[0].stations?.[0].equipmentTagIds, ['cones', 'tees', 'ladders'], 'the first station has both, each once');
    assert.equal(p?.blocks[0].stations?.[1].equipmentTagIds, undefined, 'the second station is untouched');
    assert.equal(p?.equipmentTagIds, undefined, 'nothing rises to the plan');
  });

  it("kit on a block whose first station is a DRILL moves UP into the plan's list — a drill's kit is the drill's", () => {
    const p = sanitizePracticePlan({
      equipmentTagIds: ['water'],
      blocks: [{
        title: 'Probe drill', duration: { minutes: 20 },
        equipmentTagIds: ['ladders', 'water'],
        stations: [{ name: 'Probe drill', drillId: 'd1', equipmentTagIds: ['cones'] }],
      }],
    });
    assert.equal(p?.blocks[0].equipmentTagIds, undefined, 'the block-level list is gone');
    assert.deepEqual(p?.blocks[0].stations?.[0].equipmentTagIds, ['cones'], "the drill's own kit is untouched");
    assert.deepEqual(p?.equipmentTagIds, ['water', 'ladders'], "the plan's own list first, then what rose, each once");
  });

  it('the move is IDEMPOTENT — a second pass finds nothing to move (it runs on read as well as write)', () => {
    const once = sanitizePracticePlan({
      blocks: [{
        title: 'Circuit', duration: { minutes: 20 }, equipmentTagIds: ['ladders'],
        stations: [{ name: 'Tees' }, { name: 'Toss' }],
      }],
    });
    const twice = sanitizePracticePlan(JSON.parse(JSON.stringify(once)));
    assert.deepEqual(twice, once);
  });

  it("a block's kit is held to the team's library like every other level", () => {
    const p = sanitizePracticePlan(
      { blocks: [{ title: 'Warm-up', duration: { minutes: 15 }, equipmentTagIds: ['ladders', 'gone'] }] },
      undefined, undefined, new Set(['ladders']),
    );
    assert.deepEqual(p?.blocks[0].equipmentTagIds, ['ladders']);
  });

  it('settles kit AFTER the library check — a stale id never takes a slot a live one needed (/review, 2026-09-15)', () => {
    // A station already holding ten ids meets a block whose kit carries one stale id and two live
    // ones: the union is capped at twelve. Settling before the check would spend a slot on the stale
    // id and drop a live one; settling after it keeps both live ids.
    const stationKit = Array.from({ length: 10 }, (_, i) => `k${i + 1}`);
    const p = sanitizePracticePlan(
      { blocks: [{ title: 'Circuit', duration: { minutes: 20 }, equipmentTagIds: ['gone', 'k11', 'k12'], stations: [{ name: 'Tees', equipmentTagIds: stationKit }, { name: 'Toss' }] }] },
      undefined, undefined, new Set([...stationKit, 'k11', 'k12']),
    );
    assert.deepEqual(p?.blocks[0].stations?.[0].equipmentTagIds, [...stationKit, 'k11', 'k12']);
  });

  it('settleBlockKit is the one pass the editor and the sanitiser share — pure, and the same object when nothing moves', () => {
    const untouched = plan({ blocks: [{ id: 'b1', title: 'Warm-up', duration: { minutes: 15 }, equipmentTagIds: ['ladders'] }] });
    assert.equal(settleBlockKit(untouched), untouched, 'no stations — nothing moves, the same object');
    const before = plan({ equipmentTagIds: ['water'], blocks: [{ id: 'b1', title: 'Drill', duration: { minutes: 20 }, equipmentTagIds: ['ladders'], stations: [{ id: 's1', name: 'Probe drill', drillId: 'd1' }] }] });
    const snapshot = JSON.stringify(before);
    const after = settleBlockKit(before);
    assert.equal(JSON.stringify(before), snapshot, 'the input is untouched');
    assert.deepEqual(after.equipmentTagIds, ['water', 'ladders']);
    assert.equal(after.blocks[0].equipmentTagIds, undefined);
    assert.equal(settleBlockKit(after), after, 'idempotent — a second pass finds nothing to move');
  });
  it("a template keeps a block's kit — it is shape, like a station's", () => {
    const p = plan({ blocks: [{ id: 'b1', title: 'Warm-up', duration: { minutes: 15 }, equipmentTagIds: ['ladders'] }] });
    const copy = copyPracticePlanForReuse(p, new Set(), () => 'new');
    assert.deepEqual(copy.blocks[0].equipmentTagIds, ['ladders']);
  });
});

describe('sanitizePracticePlan — people live at exactly ONE level, and MOVE with it (stage 3, D8)', () => {
  const six = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

  it('a block with NO stations keeps its own names', () => {
    const p = sanitizePracticePlan({ blocks: [{ title: 'Warm-up', duration: { minutes: 15 }, playerIds: six }] });
    assert.deepEqual(p?.blocks[0].playerIds, six);
    assert.equal(p?.blocks[0].rotation, undefined);
  });

  it('the block\'s names land on the FIRST station when one arrives — a drill station holds people too', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Probe drill', duration: { minutes: 20 }, playerIds: six,
        stations: [{ name: 'Probe drill', drillId: 'd1' }],
      }],
    });
    assert.equal(p?.blocks[0].playerIds, undefined, 'the block-level list is gone');
    assert.deepEqual(p?.blocks[0].stations?.[0].playerIds, six, 'the drill station holds them — people are the practice\'s half');
  });

  it('rotating turns ON with names and no groups → the FIRST DRAW: dealt in stored order, one group per station, not shuffled', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Circuit', duration: { minutes: 45 },
        stations: [{ name: 'Tees', playerIds: six }, { name: 'Toss' }, { name: 'Bunt' }],
      }],
    });
    const groups = p?.blocks[0].rotation?.groups ?? [];
    assert.deepEqual(groups.map(g => g.name), ['Group A', 'Group B', 'Group C']);
    assert.deepEqual(groups.map(g => g.playerIds), [['p1', 'p2'], ['p3', 'p4'], ['p5', 'p6']], 'consecutive runs in stored order');
    assert.equal(p?.blocks[0].rotation?.groupSource, 'manual', 'not a shuffle — Draw is the shuffle');
    assert.ok(p?.blocks[0].stations?.every(s => s.playerIds === undefined), 'no station holds people in a rotation');
  });

  it('fewer names than stations → fewer groups, never an empty one; stray names join standing groups round-robin', () => {
    const two = sanitizePracticePlan({
      blocks: [{ title: 'Circuit', duration: { minutes: 45 }, playerIds: ['p1', 'p2'], stations: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }],
    });
    assert.deepEqual(two?.blocks[0].rotation?.groups.map(g => g.playerIds), [['p1'], ['p2']]);
    const standing = sanitizePracticePlan({
      blocks: [{
        title: 'Circuit', duration: { minutes: 45 }, playerIds: ['p5', 'p6', 'p7'],
        stations: [{ name: 'A' }, { name: 'B' }],
        rotation: { intervalMinutes: 15, groupSource: 'random', groups: [{ name: 'Group A', playerIds: ['p1', 'p2'] }, { name: 'Group B', playerIds: ['p3', 'p4'] }] },
      }],
    });
    assert.deepEqual(standing?.blocks[0].rotation?.groups.map(g => g.playerIds), [['p1', 'p2', 'p5', 'p7'], ['p3', 'p4', 'p6']]);
    assert.equal(standing?.blocks[0].rotation?.groupSource, 'random', 'the sanitiser joining a stray is not a coach\'s hand on a drawn group — the source stands (/review, 2026-09-15)');
  });

  it('a stale rotation beside a hand-placed station list never books one child at two stations (/review, 2026-09-15)', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Separate', rotates: false, duration: { minutes: 45 },
        stations: [{ name: 'A' }, { name: 'B', playerIds: ['p1'] }],
        rotation: { intervalMinutes: 15, groups: [{ name: 'Group A', playerIds: ['p1', 'p2'] }] },
      }],
    });
    assert.deepEqual(p?.blocks[0].stations?.[0].playerIds, ['p2'], 'p1 already stands at B — only p2 lands on A');
    assert.deepEqual(p?.blocks[0].stations?.[1].playerIds, ['p1']);
  });

  it('a stray joining standing groups is capped like every list — a read after the write sees what was written (/review, 2026-09-15)', () => {
    const many = Array.from({ length: 59 }, (_, i) => `p${i + 1}`);
    const strays = Array.from({ length: 5 }, (_, i) => `s${i + 1}`);
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Circuit', duration: { minutes: 45 }, playerIds: strays,
        stations: [{ name: 'A' }, { name: 'B' }],
        rotation: { intervalMinutes: 15, groups: [{ name: 'Group A', playerIds: many }] },
      }],
    });
    assert.equal(p?.blocks[0].rotation?.groups[0].playerIds.length, 60, 'the cap holds on the way in');
    assert.deepEqual(sanitizePracticePlan(JSON.parse(JSON.stringify(p))), p, 'and the read returns the same plan');
  });

  it('rotating turns OFF → each group lands on the station it STARTED at (the grid\'s own first row), and the rotation goes', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Circuit', rotates: false, duration: { minutes: 45 },
        stations: [{ name: 'A' }, { name: 'B' }],
        rotation: { intervalMinutes: 15, groups: [
          { name: 'Group A', playerIds: ['p1', 'p2'] }, { name: 'Group B', playerIds: ['p3', 'p4'] }, { name: 'Group C', playerIds: ['p5', 'p6'] },
        ] },
      }],
    });
    assert.equal(p?.blocks[0].rotation, undefined, 'a block that does not rotate carries no rotation');
    assert.deepEqual(p?.blocks[0].stations?.[0].playerIds, ['p1', 'p2', 'p5', 'p6'], 'groups A and C both started at the first station');
    assert.deepEqual(p?.blocks[0].stations?.[1].playerIds, ['p3', 'p4']);
  });

  it('the last station goes → everyone comes back to the block\'s own list', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Was a circuit', duration: { minutes: 45 }, stations: [],
        rotation: { intervalMinutes: 15, groups: [{ name: 'Group A', playerIds: ['p1', 'p2'] }, { name: 'Group B', playerIds: ['p3'] }] },
      }],
    });
    assert.deepEqual(p?.blocks[0].playerIds, ['p1', 'p2', 'p3']);
    assert.equal(p?.blocks[0].rotation, undefined);
  });

  it('a name outside the roster never moves anywhere — the roster check runs first', () => {
    const p = sanitizePracticePlan(
      { blocks: [{ title: 'Drill', duration: { minutes: 20 }, playerIds: ['p1', 'gone'], stations: [{ name: 'S' }] }] },
      new Set(['p1']),
    );
    assert.deepEqual(p?.blocks[0].stations?.[0].playerIds, ['p1']);
  });

  it('the move is IDEMPOTENT and DETERMINISTIC — a second pass finds nothing to move (it runs on read as well as write)', () => {
    const once = sanitizePracticePlan({
      blocks: [{ title: 'Circuit', duration: { minutes: 45 }, playerIds: six, stations: [{ name: 'A' }, { name: 'B' }] }],
    });
    const twice = sanitizePracticePlan(JSON.parse(JSON.stringify(once)));
    assert.deepEqual(twice, once);
    const again = sanitizePracticePlan({
      blocks: [{ title: 'Circuit', duration: { minutes: 45 }, playerIds: six, stations: [{ name: 'A' }, { name: 'B' }] }],
    });
    assert.deepEqual(again, once, 'the same input deals the same hand — no dice in the sanitiser');
  });

  it('settleBlockPeople is the one pass the editor and the sanitiser share — pure, and the same object when nothing moves', () => {
    const untouched = plan({ blocks: [{ id: 'b1', title: 'Warm-up', duration: { minutes: 15 }, playerIds: six }] });
    assert.equal(settleBlockPeople(untouched), untouched, 'no stations — nothing moves, the same object');
    const before = plan({ blocks: [{ id: 'b1', title: 'Drill', duration: { minutes: 20 }, playerIds: six, stations: [{ id: 's1', name: 'Probe drill', drillId: 'd1' }] }] });
    const snapshot = JSON.stringify(before);
    const after = settleBlockPeople(before);
    assert.equal(JSON.stringify(before), snapshot, 'the input is untouched');
    assert.deepEqual(after.blocks[0].stations?.[0].playerIds, six);
    assert.equal(after.blocks[0].playerIds, undefined);
    assert.equal(settleBlockPeople(after), after, 'idempotent — a second pass finds nothing to move');
  });

  it('settlePlanLevels runs kit then people — one call, so neither pass can be forgotten', () => {
    const before = plan({ blocks: [{ id: 'b1', title: 'Drill', duration: { minutes: 20 }, playerIds: ['p1'], equipmentTagIds: ['ladders'], stations: [{ id: 's1', name: 'Tees' }] }] });
    const after = settlePlanLevels(before);
    assert.deepEqual(after.blocks[0].stations?.[0].playerIds, ['p1']);
    assert.deepEqual(after.blocks[0].stations?.[0].equipmentTagIds, ['ladders']);
    assert.equal(after.blocks[0].playerIds, undefined);
    assert.equal(after.blocks[0].equipmentTagIds, undefined);
  });
});

describe('the rotation as the editor lays it out (stage 3 — presentation over computeRotation)', () => {
  it('describeRounds states the clock honestly and never tidies a spare minute', () => {
    assert.equal(describeRounds(45, 15), '3 rounds of 15 = 45 min');
    assert.equal(describeRounds(45, 20), '45 does not divide by 20 — 2 rounds and 5 min over');
    assert.equal(describeRounds(20, 20), '1 round of 20 = 20 min');
    assert.equal(describeRounds(10, 15), '10 min is less than one 15-min round');
    assert.equal(describeRounds(null, 15), '', 'nothing to say until both numbers exist');
    assert.equal(describeRounds(45, null), '');
  });

  it('rotationByStation turns the same cells to the station columns — down a column is one station\'s evening', () => {
    const stations: PracticeStation[] = [{ id: 's1', name: 'Ladder' }, { id: 's2', name: 'Control' }, { id: 's3', name: 'Finishing' }];
    const rotation = { intervalMinutes: 15, groupSource: 'manual' as const, groups: [
      { id: 'a', name: 'Group A', playerIds: ['p1'] }, { id: 'b', name: 'Group B', playerIds: ['p2'] }, { id: 'c', name: 'Group C', playerIds: ['p3'] },
    ] };
    const grid = computeRotation(rotation, stations, 45);
    const turned = rotationByStation(grid, stations);
    assert.deepEqual(turned.stations.map(s => s.name), ['Ladder', 'Control', 'Finishing']);
    assert.deepEqual(turned.rows.map(r => r.cells.map(c => c.join('+'))), [
      ['Group A', 'Group B', 'Group C'],
      ['Group C', 'Group A', 'Group B'],
      ['Group B', 'Group C', 'Group A'],
    ]);
    // Down the first column is the Ladder's whole evening — the same cells `computeRotation` gave the groups.
    assert.deepEqual(grid.roundsList.map(r => r.cells[0].stationName), ['Ladder', 'Control', 'Finishing'], 'group A\'s own row, unchanged');
  });

  it('rotationByStation — two groups sharing a station sit in one cell; an idle station is an empty cell; an unnamed station has no column', () => {
    const stations: PracticeStation[] = [{ id: 's1', name: 'Ladder' }, { id: 's2', name: 'Control' }, { id: 's3', name: '   ' }];
    const four = computeRotation({ intervalMinutes: 15, groupSource: 'manual', groups: [
      { id: 'a', name: 'A', playerIds: ['p1'] }, { id: 'b', name: 'B', playerIds: ['p2'] }, { id: 'c', name: 'C', playerIds: ['p3'] },
    ] }, stations, 30);
    const turned = rotationByStation(four, stations);
    assert.equal(turned.stations.length, 2, 'the blank station is not a stop');
    assert.deepEqual(turned.rows[0].cells, [['A', 'C'], ['B']], 'A and C share the Ladder in round 1');
    const one = computeRotation({ intervalMinutes: 15, groupSource: 'manual', groups: [{ id: 'a', name: 'A', playerIds: ['p1'] }] }, stations, 30);
    assert.deepEqual(rotationByStation(one, stations).rows[0].cells, [['A'], []], 'Control sits idle in round 1');
  });

  it('stationWalk — the stepper STOPS at both ends (the room\'s rule), names its destinations, and reads "Station N" for an unnamed one', () => {
    const stations: PracticeStation[] = [{ id: 's1', name: 'Ladder' }, { id: 's2', name: '' }, { id: 's3', name: 'Finishing' }];
    const first = stationWalk(stations, 's1');
    assert.equal(first.prev, null, 'no wrap from the first to the last');
    assert.deepEqual(first.next, { id: 's2', label: 'Station 2' });
    assert.deepEqual([first.index, first.total], [1, 3]);
    const last = stationWalk(stations, 's3');
    assert.equal(last.next, null, 'no wrap from the last to the first');
    assert.deepEqual(last.prev, { id: 's2', label: 'Station 2' });
    const middle = stationWalk(stations, 's2');
    assert.deepEqual([middle.prev?.label, middle.next?.label], ['Ladder', 'Finishing']);
    assert.deepEqual(stationWalk(stations, 'gone'), { prev: null, next: null, index: 0, total: 3 });
  });
});

describe('practiceKitBag (D11) — the bag is derived, never written down', () => {
  const tags = [{ id: 'ladders', name: 'Ladders' }, { id: 'cones', name: 'Cones' }, { id: 'water', name: 'Water' }, { id: 'balls', name: 'Balls' }];

  it("is the plan's own list, then every block's kit, then every station's — each name once", () => {
    const bag = practiceKitBag(plan({
      equipmentTagIds: ['water', 'cones'],
      blocks: [
        { id: 'b1', title: 'Warm-up', duration: { minutes: 15 }, equipmentTagIds: ['ladders', 'cones'] },
        { id: 'b2', title: 'Circuit', duration: { minutes: 20 }, stations: [{ id: 's1', name: 'Tees', equipmentTagIds: ['balls'] }] },
      ],
    }), tags);
    assert.deepEqual(bag.all, ['Water', 'Cones', 'Ladders', 'Balls']);
    assert.deepEqual(bag.fromBlocks, ['Ladders', 'Balls'], 'only what rose from below and was not already at the top');
  });

  it('a level with no ids reads its legacy names, and a name is one name whatever its case', () => {
    const bag = practiceKitBag(plan({
      equipment: ['Cones', 'Bibs'],
      blocks: [{ id: 'b1', title: 'Circuit', duration: { minutes: 20 }, stations: [{ id: 's1', name: 'Tees', equipment: ['cones', 'Spare balls'] }] }],
    }), tags);
    assert.deepEqual(bag.all, ['Cones', 'Bibs', 'Spare balls']);
    assert.deepEqual(bag.fromBlocks, ['Spare balls']);
  });

  it('drops an id the library no longer holds rather than showing a blank', () => {
    const bag = practiceKitBag(plan({ blocks: [{ id: 'b1', title: 'X', duration: { minutes: 5 }, equipmentTagIds: ['ladders', 'gone'] }] }), tags);
    assert.deepEqual(bag.all, ['Ladders']);
  });

  it('an empty plan has an empty bag', () => {
    assert.deepEqual(practiceKitBag(plan(), tags), { all: [], fromBlocks: [] });
  });
});
