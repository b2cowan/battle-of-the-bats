import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockRotates,
  buildRunOutline,
  buildRunSteps,
  computeRotation,
  namesWholeTeam,
  rotationByStation,
  runStepLengthLabel,
} from '../../lib/rep-practice-plan.ts';
import type { PracticePlanBlock } from '../../lib/types.ts';

/**
 * The field run screen's arithmetic (Practice Plans 1b).
 *
 * ⚠ THE RUN HAS NO CLOCK (owner ruling 2026-09-17, stage 5 P10) — the stops carry the plan's
 * LENGTH as information, never a start instant to count from. `startMs` below (6:00 PM Toronto,
 * the 1a clock fixture) serves only the rotation-board reads further down, whose round labels are
 * the paper's and are formatted through `lib/timezone.ts`.
 */
const start = '2026-08-04T22:00:00.000Z'; // 6:00 PM Toronto (EDT)
const startMs = new Date(start).getTime();

function block(overrides: Partial<PracticePlanBlock> = {}): PracticePlanBlock {
  return { id: 'b1', title: 'Warm-up', duration: { minutes: 10 }, ...overrides };
}

/** A rotation block: 45 minutes, three stations, three groups → three rounds of 15. */
function rotationBlock(overrides: Partial<PracticePlanBlock> = {}): PracticePlanBlock {
  return {
    id: 'rot',
    title: 'Station rotation',
    duration: { minutes: 45 },
    stations: [
      { id: 's1', name: 'Tees' },
      { id: 's2', name: 'Short hop' },
      { id: 's3', name: 'Toss' },
    ],
    rotation: {
      intervalMinutes: 15,
      groupSource: 'random',
      groups: [
        { id: 'g1', name: 'Group A', playerIds: ['p1'] },
        { id: 'g2', name: 'Group B', playerIds: ['p2'] },
        { id: 'g3', name: 'Group C', playerIds: ['p3'] },
      ],
    },
    ...overrides,
  };
}

describe('buildRunSteps', () => {
  it('gives a plain block exactly one stop, carrying the plan\'s length as information', () => {
    const steps = buildRunSteps([block(), block({ id: 'b2', duration: { minutes: 25 } })]);
    assert.equal(steps.length, 2);
    assert.deepEqual(steps.map(s => s.minutes), [10, 25]);
    assert.deepEqual(steps.map(s => s.round), [null, null]);
  });

  it('gives a rotating block one stop PER ROUND — so "Rotate now" is the same tap as "Next block"', () => {
    const steps = buildRunSteps([rotationBlock()]);
    assert.equal(steps.length, 3);
    assert.deepEqual(steps.map(s => s.round), [1, 2, 3]);
    assert.deepEqual(steps.map(s => s.rounds), [3, 3, 3]);
    assert.deepEqual(steps.map(s => s.minutes), [15, 15, 15]);
    // Every round belongs to the SAME block, which is what keeps a rotation a stretch of the run
    // rather than a mode the coach has to get out of (D26).
    assert.deepEqual(steps.map(s => s.blockIndex), [0, 0, 0]);
  });

  it('uses the DERIVED interval — one turn each — when the coach never set one', () => {
    const rot = rotationBlock();
    const steps = buildRunSteps([{ ...rot, rotation: { ...rot.rotation!, intervalMinutes: null } }]);
    // 45 minutes ÷ 3 stations = 15. The run screen must never re-derive this its own way.
    assert.equal(steps.length, 3);
    assert.deepEqual(steps.map(s => s.minutes), [15, 15, 15]);
  });

  it('does NOT rotate a single-station block — that is a queue, not a carousel', () => {
    const rot = rotationBlock({ stations: [{ id: 's1', name: 'Tees' }] });
    const steps = buildRunSteps([rot]);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].round, null);
    assert.equal(steps[0].minutes, 45);
  });

  /**
   * ⚠ REGRESSION (/review, 2026-08-01). This state — stations added, groups not drawn yet — is
   * simply what a half-written block looks like, and `round === null` is how the run screen knows
   * to show the block's own description, goal and coaching points instead of a carousel. Gating
   * that on `!blockRotates(block)` instead left this case rendering NEITHER section.
   */
  it('degrades a half-written rotation to one plain stop rather than dropping it from the run', () => {
    // No groups yet ⇒ no computable grid. The block is still real minutes on a real Tuesday and
    // the coach still has to get past it.
    const rot = rotationBlock();
    const steps = buildRunSteps([{ ...rot, rotation: { ...rot.rotation!, groups: [] } }]);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].round, null, 'a plain stop is how the screen knows to show block-level content');
    assert.equal(steps[0].minutes, 45);
    // ⚠ The block still REPORTS as rotating — the two facts are independent, which is exactly the
    // gap the run screen fell into.
    assert.equal(blockRotates(rot), true);
  });

  it('keeps each block\'s OWN length when another block shares its id', () => {
    // Ids are client-minted and nothing enforces uniqueness — the steps are built by position.
    const steps = buildRunSteps([block({ id: 'dup', duration: { minutes: 10 } }), block({ id: 'dup', duration: { minutes: 25 } })]);
    assert.deepEqual(steps.map(s => s.minutes), [10, 25]);
  });

  it('"rest of practice" is a kind, not a number — no clock to measure it against (P10)', () => {
    const steps = buildRunSteps([block({ duration: { minutes: 30 } }), block({ id: 'b2', duration: { minutes: null, restOfPractice: true } })]);
    assert.equal(steps[1].restOfPractice, true);
    assert.equal(steps[1].minutes, null);
  });

  it('needs no start time — a practice is a list of stops on any day', () => {
    assert.equal(buildRunSteps([block()]).length, 1);
    assert.deepEqual(buildRunSteps([]), []);
  });

  it('carries a mixed practice end to end, in order', () => {
    const steps = buildRunSteps(
      [block({ id: 'warm', duration: { minutes: 10 } }), rotationBlock(), block({ id: 'bp', title: 'Live BP', duration: { minutes: 30 } })],
    );
    assert.deepEqual(steps.map(s => s.blockId), ['warm', 'rot', 'rot', 'rot', 'bp']);
    assert.deepEqual(steps.map(s => s.minutes), [10, 15, 15, 15, 30]);
  });
});

describe('runStepLengthLabel — the plan\'s length as information, never a countdown (P10)', () => {
  it('reads "15 min" for a timed block and "10 min a round" inside a rotation', () => {
    const [warm, r1] = buildRunSteps([block({ duration: { minutes: 15 } }), rotationBlock({ rotation: { intervalMinutes: 10, groupSource: 'random', groups: rotationBlock().rotation!.groups } })]);
    assert.equal(runStepLengthLabel(warm), '15 min');
    assert.equal(runStepLengthLabel(r1), '10 min a round');
  });
  it('names the rest-of-practice block by its kind, and says nothing when the plan never said', () => {
    const [rest, blank] = buildRunSteps([block({ duration: { minutes: null, restOfPractice: true } }), block({ id: 'b2', duration: { minutes: null } })]);
    assert.equal(runStepLengthLabel(rest), 'Rest of practice');
    assert.equal(runStepLengthLabel(blank), '');
  });
});

// ── Stage 5 · Paper & the field (owner rulings P3 · P5 · P7 · P9, 2026-09-17) ──────────────────

describe('namesWholeTeam — "Whole team" is a SET comparison, never a count (P5)', () => {
  const roster = ['p1', 'p2', 'p3', 'p4'];
  it('nobody named is the whole team — the plan page\'s own word for an empty list', () => {
    assert.equal(namesWholeTeam([], roster), true);
    assert.equal(namesWholeTeam(undefined, roster), true);
  });
  it('every active player named IS the whole team tonight; one short is chips', () => {
    assert.equal(namesWholeTeam(['p4', 'p2', 'p1', 'p3'], roster), true, 'order is irrelevant');
    assert.equal(namesWholeTeam(['p1', 'p2', 'p3'], roster), false, 'three of four is a subset');
  });
  it('a count that happens to match is not enough — the SET must match', () => {
    assert.equal(namesWholeTeam(['p1', 'p2', 'p3', 'gone'], roster), false, 'four names, one not on the roster');
    assert.equal(namesWholeTeam(['p1', 'p1', 'p2', 'p3'], roster), false, 'a duplicate does not make up the difference');
  });
  it('with no roster to compare against, only an empty list reads as the whole team', () => {
    assert.equal(namesWholeTeam([], []), true);
    assert.equal(namesWholeTeam(['p1'], []), false);
  });
});

describe('the rotation\'s rows, keyed by station (P7) — the field reads the board\'s own re-key', () => {
  const rot = rotationBlock();
  const grid = computeRotation(rot.rotation!, rot.stations, 45, startMs);
  const turned = rotationByStation(grid, rot.stations);
  it('one row per named station, the group at each — and the NEXT round is the due state\'s row', () => {
    assert.deepEqual(turned.stations.map(s => s.name), ['Tees', 'Short hop', 'Toss']);
    // Round 1 (index 0) is what runs; when it is due, round 2 (index 1 — the 1-based round itself)
    // says who ARRIVES at each station.
    assert.deepEqual(turned.rows[0].cells, [['Group A'], ['Group B'], ['Group C']]);
    assert.deepEqual(turned.rows[1].cells, [['Group C'], ['Group A'], ['Group B']], 'the carousel turns');
    assert.deepEqual(turned.rows[1].out, []);
  });
  it('a hand-arranged round: two letters where two share, none where nobody is, the sitter under the list', () => {
    const arranged = rotationBlock({ rotation: { ...rot.rotation!, arrangement: {
      stationIds: ['s1', 's2', 's3'], groupIds: ['g1', 'g2', 'g3'], rounds: 3,
      placements: [
        { g1: 's1', g2: 's2', g3: 's3' },
        { g1: 's1', g2: 's1', g3: null },
        { g1: 's3', g2: 's2', g3: 's1' },
      ],
    } } });
    const g = computeRotation(arranged.rotation!, arranged.stations, 45, startMs);
    const t = rotationByStation(g, arranged.stations);
    assert.deepEqual(t.rows[1].cells, [['Group A', 'Group B'], [], []]);
    assert.deepEqual(t.rows[1].out.map(o => o.name), ['Group C']);
    assert.equal(t.rows[1].round, 2, 'the line reads "C sits round 2 out" from the row\'s own number');
  });
});

/**
 * THE FIELD'S FIRST SCREEN — the plan as a list (stage 7, owner ruling W1–W3, 2026-09-18).
 * One row per block, the plan's length (never a clock), a rotation's shape, stations as rows under
 * their block with the sole station folded, every row's stop, and "mine" from the reader's walk.
 */
describe('buildRunOutline — the list Run practice opens on', () => {
  const warmup = block({ id: 'w', title: 'Warm-up', duration: { minutes: 15 }, staffTagIds: ['t-coach'] });
  const rot = rotationBlock({
    stations: [
      { id: 's1', name: 'Tees', staffTagIds: ['t-sam'] },
      { id: 's2', name: 'Short hop', staffTagIds: ['t-coach'] },
      { id: 's3', name: 'Toss' },
    ],
  });
  const game = block({ id: 'g', title: 'Small-sided game', duration: { minutes: null, restOfPractice: true } });
  const plan = { version: 1, blocks: [warmup, rot, game] };
  const steps = buildRunSteps(plan.blocks);
  const mine = new Set(['t-coach']);
  const rows = buildRunOutline(plan, steps, mine);

  it('one row per block, in practice order, with the plan\'s length as the field states it — never a clock', () => {
    assert.deepEqual(rows.map(r => r.title), ['Warm-up', 'Station rotation', 'Small-sided game']);
    assert.deepEqual(rows.map(r => r.length), ['15 min', '45 min', 'Rest of practice']);
  });

  it('a rotation the field walks by rounds says its shape; a plain block says nothing', () => {
    assert.deepEqual(rows.map(r => r.shape), ['', '3 rounds · 15 min a round', '']);
  });

  it('every row is a door: a block row opens its FIRST stop (round 1 of a rotation)', () => {
    assert.deepEqual(rows.map(r => r.stepIndex), [0, 1, 4], 'three rounds sit between the warm-up and the game');
    assert.equal(steps[rows[1].stepIndex].round, 1);
  });

  it('stations are rows under their block; "mine" at both levels is the walk\'s own answer', () => {
    assert.deepEqual(rows[1].stations.map(s => s.label), ['Tees', 'Short hop', 'Toss']);
    assert.deepEqual(rows.map(r => r.mine), [true, false, false], 'a station inside a block does not mark the block');
    assert.deepEqual(rows[1].stations.map(s => s.mine), [false, true, false]);
  });

  it('a sole station IS the block — no sub-row, and its staff marks the block row', () => {
    const sole = block({ id: 'd', title: 'Drill', stations: [{ id: 'only', name: 'Bunting', staffTagIds: ['t-coach'] }] });
    const [row] = buildRunOutline({ version: 1, blocks: [sole] }, buildRunSteps([sole]), mine);
    assert.deepEqual(row.stations, []);
    assert.equal(row.mine, true);
  });

  it('a rotation that cannot be walked yet (no groups) is one plain stop, with no shape', () => {
    const half = rotationBlock({ id: 'half', rotation: { intervalMinutes: 15, groupSource: 'random', groups: [] } });
    const [row] = buildRunOutline({ version: 1, blocks: [half] }, buildRunSteps([half]), new Set());
    assert.equal(row.shape, '');
    assert.equal(row.stepIndex, 0);
    assert.equal(row.length, '45 min');
  });
});
