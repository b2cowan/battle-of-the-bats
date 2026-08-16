import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAttendanceView, type AttendanceViewInput } from '../../lib/coach-attendance-view.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE ATTENDANCE REPORT'S FOUR STATES
 *
 * The screen was reported for showing three "nothing here" blocks at once, on three different
 * left edges, because three regions each decided independently that they had nothing to show.
 * It is one decision now — and the `/review` of 2026-08-15 found a real defect in the FIRST
 * version of that decision, which is why it is executable rather than merely commented.
 *
 * The rule the whole file exists to hold: **a skeleton may render before we know; anything
 * that makes a claim may not.**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

/** A settled, healthy report: 12 players, real figures, a next event to mark. */
const BASE: AttendanceViewInput = {
  loading: false,
  error: false,
  rowCount: 12,
  hasAnyData: true,
  markTargetLoading: false,
  markTargetFailed: false,
  hasMarkTarget: true,
};
const view = (over: Partial<AttendanceViewInput> = {}) => resolveAttendanceView({ ...BASE, ...over });

describe('nothing that makes a claim renders before BOTH lookups have landed', () => {
  /**
   * ⚠⚠ THE REGRESSION THIS FILE EXISTS FOR (/review 2026-08-15, confirmed High).
   *
   * The roster fetch lands first with players but nothing marked; the events lookup is still in
   * flight and will come back empty. The old code called this 'report' and painted the whole
   * table, then replaced it with the lone empty card a moment later. Whichever fetch won the
   * race decided whether the coach saw a clean settle or a table that appeared and vanished.
   */
  it('does not paint the report while the events lookup is still in flight', () => {
    const v = view({ rowCount: 12, hasAnyData: false, markTargetLoading: true });
    assert.equal(v.state, 'loading',
      'real rows painted before the schedule was known — this is the appear-then-vanish defect');
    assert.equal(v.showNothingYetNote, false);
  });

  it('does not paint an empty state while the roster fetch is still in flight', () => {
    const v = view({ loading: true, markTargetLoading: false, hasMarkTarget: false });
    assert.equal(v.state, 'loading');
    assert.equal(v.soloKind, null,
      'an empty state was asserted before the roster had come back');
  });

  it('settles into the solo empty state once both have landed', () => {
    const v = view({ rowCount: 12, hasAnyData: false, hasMarkTarget: false });
    assert.equal(v.state, 'solo');
    assert.equal(v.soloKind, 'no-schedule');
  });
});

describe('an error is never dressed up as "nothing here"', () => {
  it('outranks every other state, including a still-loading events lookup', () => {
    assert.equal(view({ error: true, loading: false, markTargetLoading: true }).state, 'error');
    assert.equal(view({ error: true, rowCount: 0 }).state, 'error');
  });
});

describe('a failed events lookup is not an empty schedule', () => {
  /**
   * ⚠ The distinction the page's three flags exist to keep: still looking / looked and found
   * nothing / could not look. Only the middle one licenses "nothing to take attendance for".
   */
  it('keeps the report on screen when the lookup failed and nothing is recorded', () => {
    const v = view({ hasAnyData: false, markTargetFailed: true, hasMarkTarget: false });
    assert.equal(v.state, 'report',
      'a network blip on the shortcut lookup wrongly reported the schedule as empty');
    assert.equal(v.showNothingYetNote, true);
  });
});

describe('real figures are never hidden behind an empty schedule', () => {
  /**
   * ⚠ Attendance rows outlive the events that produced them — delete a game and its figures
   * remain. An empty schedule alone must not hide a coach's real numbers.
   */
  it('shows the report when the schedule is empty but data exists', () => {
    const v = view({ hasAnyData: true, hasMarkTarget: false });
    assert.equal(v.state, 'report');
    assert.equal(v.showNothingYetNote, false);
  });
});

describe('the solo empty states', () => {
  it('an empty roster wins over the schedule question — nobody to take a register of', () => {
    assert.deepEqual(view({ rowCount: 0, hasAnyData: false }).soloKind, 'no-roster');
    assert.deepEqual(view({ rowCount: 0, hasAnyData: false, hasMarkTarget: false }).soloKind, 'no-roster');
  });

  it('never sets the caption — a solo empty state is alone on the page', () => {
    for (const over of [{ rowCount: 0, hasAnyData: false }, { rowCount: 5, hasAnyData: false, hasMarkTarget: false }]) {
      assert.equal(view(over).showNothingYetNote, false);
    }
  });
});

describe('the "nothing recorded yet" caption', () => {
  it('appears only while every figure is still a dash', () => {
    assert.equal(view({ hasAnyData: false }).showNothingYetNote, true);
    assert.equal(view({ hasAnyData: true }).showNothingYetNote, false);
  });
});

describe('no input combination produces a blank page', () => {
  it('every one of the 128 flag combinations resolves to a real state', () => {
    const bools = [false, true];
    let n = 0;
    for (const loading of bools) for (const error of bools) for (const hasAnyData of bools)
      for (const markTargetLoading of bools) for (const markTargetFailed of bools)
        for (const hasMarkTarget of bools) for (const rowCount of [0, 12]) {
          const v = resolveAttendanceView({
            loading, error, rowCount, hasAnyData, markTargetLoading, markTargetFailed, hasMarkTarget,
          });
          assert.ok(['loading', 'error', 'solo', 'report'].includes(v.state), `unknown state ${v.state}`);
          // A solo state must name which empty state it is, and no other state may claim one.
          assert.equal(v.soloKind !== null, v.state === 'solo');
          // The caption is a caption FOR the table; it may never appear without one.
          if (v.showNothingYetNote) assert.equal(v.state, 'report');
          n++;
        }
    assert.equal(n, 128);
  });
});
