import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockRotates,
  buildRunSteps,
  formatRunClock,
  runRemainingSeconds,
  runStepAt,
} from '../../lib/rep-practice-plan.ts';
import type { PracticePlanBlock } from '../../lib/types.ts';

/**
 * The field run screen's arithmetic (Practice Plans 1b).
 *
 * ⚠ Every clock here is anchored to a real INSTANT and formatted through `lib/timezone.ts` inside
 * the module — never raw UTC date math on a naive string. `start` below is 6:00 PM Toronto, the
 * same fixture the 1a clock tests use, so the two files can't drift apart on what "6:00" means.
 */
const start = '2026-08-04T22:00:00.000Z'; // 6:00 PM Toronto (EDT)
const end = '2026-08-04T23:30:00.000Z';   // 7:30 PM Toronto
const startMs = new Date(start).getTime();
const min = (n: number) => n * 60_000;

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
  it('gives a plain block exactly one stop, starting when the running clock says', () => {
    const steps = buildRunSteps([block(), block({ id: 'b2', duration: { minutes: 25 } })], start, end);
    assert.equal(steps.length, 2);
    assert.deepEqual(steps.map(s => s.minutes), [10, 25]);
    assert.deepEqual(steps.map(s => s.startMs), [startMs, startMs + min(10)]);
    assert.deepEqual(steps.map(s => s.round), [null, null]);
  });

  it('gives a rotating block one stop PER ROUND — so "Rotate now" is the same tap as "Next block"', () => {
    const steps = buildRunSteps([rotationBlock()], start, end);
    assert.equal(steps.length, 3);
    assert.deepEqual(steps.map(s => s.round), [1, 2, 3]);
    assert.deepEqual(steps.map(s => s.rounds), [3, 3, 3]);
    assert.deepEqual(steps.map(s => s.minutes), [15, 15, 15]);
    assert.deepEqual(
      steps.map(s => s.startMs),
      [startMs, startMs + min(15), startMs + min(30)],
    );
    // Every round belongs to the SAME block, which is what keeps a rotation a stretch of the run
    // rather than a mode the coach has to get out of (D26).
    assert.deepEqual(steps.map(s => s.blockIndex), [0, 0, 0]);
  });

  it('uses the DERIVED interval — one turn each — when the coach never set one', () => {
    const rot = rotationBlock();
    const steps = buildRunSteps([{ ...rot, rotation: { ...rot.rotation!, intervalMinutes: null } }], start, end);
    // 45 minutes ÷ 3 stations = 15. The run screen must never re-derive this its own way.
    assert.equal(steps.length, 3);
    assert.deepEqual(steps.map(s => s.minutes), [15, 15, 15]);
  });

  it('does NOT rotate a single-station block — that is a queue, not a carousel', () => {
    const rot = rotationBlock({ stations: [{ id: 's1', name: 'Tees' }] });
    const steps = buildRunSteps([rot], start, end);
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
    const steps = buildRunSteps([{ ...rot, rotation: { ...rot.rotation!, groups: [] } }], start, end);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].round, null, 'a plain stop is how the screen knows to show block-level content');
    assert.equal(steps[0].minutes, 45);
    // ⚠ The block still REPORTS as rotating — the two facts are independent, which is exactly the
    // gap the run screen fell into.
    assert.equal(blockRotates(rot), true);
  });

  it('keeps a block on its OWN clock when another block shares its id', () => {
    // Ids are client-minted and nothing enforces uniqueness; keying the clock walk on them meant
    // the first block silently inherited the second's start time.
    const steps = buildRunSteps(
      [block({ id: 'dup', duration: { minutes: 10 } }), block({ id: 'dup', duration: { minutes: 25 } })],
      start, end,
    );
    assert.deepEqual(steps.map(s => s.startMs - startMs), [0, min(10)]);
    assert.deepEqual(steps.map(s => s.minutes), [10, 25]);
  });

  it('measures "rest of practice" to the event END, and admits it cannot without one', () => {
    const blocks = [block({ duration: { minutes: 30 } }), block({ id: 'b2', duration: { minutes: null, restOfPractice: true } })];
    const withEnd = buildRunSteps(blocks, start, end);
    assert.equal(withEnd[1].restOfPractice, true);
    assert.equal(withEnd[1].minutes, 60); // 6:30 PM → 7:30 PM

    const withoutEnd = buildRunSteps(blocks, start, null);
    assert.equal(withoutEnd[1].minutes, null); // honestly unknown, never a guess
  });

  it('returns nothing without a start time — a running clock cannot be invented', () => {
    assert.deepEqual(buildRunSteps([block()], null, end), []);
    assert.deepEqual(buildRunSteps([], start, end), []);
  });

  it('carries a mixed practice end to end, in order', () => {
    const steps = buildRunSteps(
      [block({ id: 'warm', duration: { minutes: 10 } }), rotationBlock(), block({ id: 'bp', title: 'Live BP', duration: { minutes: 30 } })],
      start, end,
    );
    assert.deepEqual(steps.map(s => s.blockId), ['warm', 'rot', 'rot', 'rot', 'bp']);
    assert.deepEqual(
      steps.map(s => s.startMs - startMs),
      [0, min(10), min(25), min(40), min(55)],
    );
  });
});

describe('runStepAt — where the screen opens', () => {
  const steps = buildRunSteps(
    [block({ id: 'warm', duration: { minutes: 10 } }), rotationBlock()],
    start, end,
  );

  it('lands on the stop the planned clock says is running', () => {
    assert.equal(runStepAt(steps, startMs + min(12)), 1); // 6:12 → round 1 of the rotation
    assert.equal(runStepAt(steps, startMs + min(27)), 2); // 6:27 → round 2
    assert.equal(runStepAt(steps, startMs + min(44)), 3); // 6:44 → round 3
  });

  it('answers the first stop before the practice and the last one after it', () => {
    assert.equal(runStepAt(steps, startMs - min(30)), 0);
    assert.equal(runStepAt(steps, startMs + min(600)), steps.length - 1);
  });

  it('is exactly on the boundary at a stop’s own start', () => {
    assert.equal(runStepAt(steps, startMs + min(10)), 1);
  });

  it('has no answer for an empty plan', () => {
    assert.equal(runStepAt([], startMs), -1);
  });

  /**
   * ⚠ REGRESSION (/review, 2026-08-01). A "rest of practice" block on an event with no end time
   * cannot advance the running clock, so every block after it shares its start instant. Taking the
   * LAST of that tie skipped the coach straight past the block actually in front of them and
   * started the next one's countdown from a time that had already gone.
   */
  it('lands on the block that OWNS a shared start instant, not the one queued behind it', () => {
    const blocks = [
      block({ id: 'warm', duration: { minutes: 10 } }),
      block({ id: 'games', title: 'Small-sided games', duration: { minutes: null, restOfPractice: true } }),
      block({ id: 'wrap', title: 'Wrap up', duration: { minutes: 10 } }),
    ];
    const steps = buildRunSteps(blocks, start, null); // no end time ⇒ the rest block never closes
    assert.deepEqual(steps.map(s => s.startMs - startMs), [0, min(10), min(10)]);
    // 6:25 is inside the open-ended block, not the one stacked behind it at the same instant.
    assert.equal(runStepAt(steps, startMs + min(25)), 1);
  });

  it('does the same for a block whose minutes were never filled in', () => {
    const steps = buildRunSteps(
      [block({ id: 'blank', duration: { minutes: null } }), block({ id: 'bp', duration: { minutes: 30 } })],
      start, end,
    );
    assert.deepEqual(steps.map(s => s.startMs - startMs), [0, 0]);
    assert.equal(runStepAt(steps, startMs + min(5)), 0);
  });

  it('still advances normally once a later stop has a genuinely later start', () => {
    const steps = buildRunSteps(
      [block({ id: 'blank', duration: { minutes: null } }), block({ id: 'bp', duration: { minutes: 30 } }),
        block({ id: 'wrap', duration: { minutes: 10 } })],
      start, end,
    );
    // blank@0, bp@0, wrap@30 — at 6:35 the cursor is on the wrap-up.
    assert.equal(runStepAt(steps, startMs + min(35)), 2);
  });
});

describe('runRemainingSeconds — the anchor is the whole design', () => {
  it('counts down from the anchor, not from the schedule', () => {
    assert.equal(runRemainingSeconds(25, startMs, startMs + min(12)), 13 * 60);
  });

  it('re-anchoring on a tap gives the stop its FULL length from that moment', () => {
    // A practice that started eight minutes late: the coach taps into a 25-minute block at 6:33.
    const tappedAt = startMs + min(33);
    assert.equal(runRemainingSeconds(25, tappedAt, tappedAt), 25 * 60);
    assert.equal(runRemainingSeconds(25, tappedAt, tappedAt + min(5)), 20 * 60);
  });

  it('goes negative on overrun rather than stopping — the screen waits, it does not act', () => {
    assert.equal(runRemainingSeconds(15, startMs, startMs + min(16) + 20_000), -80);
  });

  it('has nothing to say when the stop has no known length', () => {
    assert.equal(runRemainingSeconds(null, startMs, startMs), null);
    assert.equal(runRemainingSeconds(undefined, startMs, startMs), null);
  });
});

describe('formatRunClock', () => {
  it('reads as a clock at arm’s length', () => {
    assert.equal(formatRunClock(12 * 60 + 40), '12:40');
    assert.equal(formatRunClock(7), '0:07');
    assert.equal(formatRunClock(0), '0:00');
  });

  it('shows overrun as a plain "+", never an alarm', () => {
    assert.equal(formatRunClock(-80), '+1:20');
    assert.equal(formatRunClock(-1), '+0:01');
  });

  it('only reaches for hours when a stop genuinely runs past sixty minutes', () => {
    assert.equal(formatRunClock(60 * 60), '1:00:00');
    assert.equal(formatRunClock(-(90 * 60 + 5)), '+1:30:05');
  });
});
