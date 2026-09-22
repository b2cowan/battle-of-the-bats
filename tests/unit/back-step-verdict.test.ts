/**
 * Back goes up one level (owner, 2026-09-21) — the pure half of `useBackStep`.
 *
 * A sheet, a form, a station in Run practice: each stands one history entry behind the view it
 * opened from. `popVerdict` reads where the browser landed against the topmost open step and says
 * what the pop means; the hook does the pushing. The cases below are the ones that were argued
 * out — every one of them is a way a Back press could otherwise do nothing, or close the wrong
 * thing.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { popVerdict, stepOf } from '../../components/coaches/backStep.ts';

describe('popVerdict — what a Back landing means', () => {
  it('no step open: a page entry is nothing to do, a step entry is a dead one to step over', () => {
    assert.equal(popVerdict(null, null), 'stay');
    // A sheet left behind when the coach navigated away from inside it, reached again by Back;
    // or a closed sheet's entry reached by Forward. Either way, a press that would do nothing.
    assert.equal(popVerdict(3, null), 'step-back');
  });
  it('the top step\'s own entry was popped: hold the line and close it', () => {
    assert.equal(popVerdict(null, 3), 'close-top');   // one step over the page
    assert.equal(popVerdict(2, 3), 'close-top');      // a question over a room: the question closes
    assert.equal(popVerdict(1, 3), 'close-top');      // landed on a dead entry beneath — still the top's pop
  });
  it('landed on the top step\'s own entry: a no-op traverse, nothing to do', () => {
    assert.equal(popVerdict(3, 3), 'stay');
  });
  it('forward onto an entry above the top step: a closed step\'s leftover — undo it', () => {
    assert.equal(popVerdict(4, 3), 'step-back');
  });
});

describe('stepOf — the marker an entry carries', () => {
  it('reads a number, and nothing else', () => {
    assert.equal(stepOf({ __step: 7, __NA: true }), 7);
    assert.equal(stepOf({ __NA: true }), null);
    assert.equal(stepOf({ __step: '7' }), null);
    assert.equal(stepOf(null), null);
    assert.equal(stepOf(undefined), null);
  });
});
