import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockRotates,
  collectPracticeTagSuggestions,
  computeBlockClocks,
  computeRotation,
  defaultIntervalMinutes,
  startingGroupsForStation,
  copyPracticePlanForReuse,
  collectStaffSuggestions,
  describeSplit,
  drawGroups,
  formatDuration,
  isPracticePlanEmpty,
  sanitizePracticePlan,
  totalPlannedMinutes,
} from '../../lib/rep-practice-plan.ts';
import type { PracticePlan, PracticeStation } from '../../lib/types.ts';

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

  it('adding stations moves people off the block — one level answers "who is here"', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'Stations', rotates: false, duration: { minutes: 20 },
        playerIds: ['p1', 'p2'],
        stations: [{ name: 'Tees', playerIds: ['p1'] }, { name: 'Toss', playerIds: ['p2'] }],
      }],
    });
    assert.equal(p?.blocks[0].playerIds, undefined, 'the block-level list is gone');
    assert.deepEqual(p?.blocks[0].stations?.[0].playerIds, ['p1'], 'the stations keep theirs');
  });

  it('a ROTATING block keeps people only in its groups — not on the block, not on the stations', () => {
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
    assert.deepEqual(p?.blocks[0].rotation?.groups[0].playerIds, ['p1']);
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

describe('collectPracticeTagSuggestions', () => {
  it('gathers staff, equipment and practice types in one walk, coaches first', () => {
    const a = sanitizePracticePlan({
      practiceTypes: ['Hitting'],
      equipment: ['balls'],
      blocks: [{ title: 'A', duration: { minutes: 5 }, staff: ['Craig'] }],
    });
    const b = sanitizePracticePlan({
      practiceTypes: ['Fielding', 'hitting'],
      blocks: [{
        title: 'B', duration: { minutes: 5 },
        stations: [{ name: 'Tees', staff: ['Adam'], equipment: ['tees', 'BALLS'] }],
      }],
    });
    const out = collectPracticeTagSuggestions([a, b], ['Head Coach']);
    assert.deepEqual(out.staff, ['Head Coach', 'Craig', 'Adam']);
    assert.deepEqual(out.equipment, ['balls', 'tees'], 'case-insensitive de-dup, first spelling wins');
    assert.deepEqual(out.practiceTypes, ['Hitting', 'Fielding']);
  });

  it('tolerates practices with no plan', () => {
    assert.deepEqual(collectPracticeTagSuggestions([null, null]), { staff: [], equipment: [], practiceTypes: [] });
  });
});

describe('copyPracticePlanForReuse (D7 — a copy, never a series write)', () => {
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
});

describe('collectStaffSuggestions (D12 — a reusable label, never a grant)', () => {
  it('gathers distinct names from blocks and stations, newest plan first', () => {
    const a = sanitizePracticePlan({ blocks: [{ title: 'A', duration: { minutes: 5 }, staff: ['Craig'] }] });
    const b = sanitizePracticePlan({
      blocks: [{ title: 'B', duration: { minutes: 5 }, stations: [{ name: 'Tees', staff: ['Adam', 'craig'] }] }],
    });
    assert.deepEqual(collectStaffSuggestions([a, b]), ['Craig', 'Adam']);
  });

  it('tolerates practices with no plan', () => {
    assert.deepEqual(collectStaffSuggestions([null, null]), []);
  });
});

describe('isPracticePlanEmpty', () => {
  it('treats a blank plan and a missing plan the same', () => {
    assert.equal(isPracticePlanEmpty(null), true);
    assert.equal(isPracticePlanEmpty(plan()), true);
    assert.equal(isPracticePlanEmpty(plan({ goal: 'x' })), false);
  });
});
