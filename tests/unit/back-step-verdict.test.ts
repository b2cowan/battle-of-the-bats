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
import { addressOf, homeOf, popVerdict, stepOf } from '../../components/coaches/backStep.ts';
import { readCode } from './_source-code.ts';

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
  it('a dead entry that NAMES A PLACE is the destination, not a placeholder', () => {
    // Owner, 2026-09-22 — "back from the lineup skips the game". The schedule's game sheet leaves
    // `?event=…&tab=…` on its entry when the coach walks out through one of its doors; Back onto
    // it is a Back onto the GAME, and the page reopens it from the address. Stepping over it is
    // what landed the coach on the bare schedule.
    assert.equal(popVerdict(3, null, true), 'stay');
    // …and an unaddressed one still is a placeholder: nothing could be restored from it.
    assert.equal(popVerdict(3, null, false), 'step-back');
    // A page entry is a page entry whatever is claimed about it.
    assert.equal(popVerdict(null, null, true), 'stay');
    // The top step's own pop still closes it — an address changes where Back LANDS, never what
    // an open level does when its entry is popped.
    assert.equal(popVerdict(null, 3, true), 'close-top');
    // ⚠ And with a level still OPEN, an address ABOVE it is a leftover like any other: what is on
    // screen is the truth, so landing there would leave the coach reading one thing at the address
    // of another. The exception belongs to "nothing is open", not to "it has an address".
    assert.equal(popVerdict(4, 3, true), 'step-back');
  });
});

describe('addressOf / homeOf — the place an entry names', () => {
  it('reads a non-empty string, and nothing else', () => {
    assert.equal(addressOf({ __step: 1, __stepAt: '/t/schedule?event=e1' }), '/t/schedule?event=e1');
    assert.equal(addressOf({ __step: 1 }), null, 'a step that names no place');
    assert.equal(addressOf({ __step: 1, __stepAt: '' }), null, 'an empty address is no address');
    assert.equal(addressOf({ __step: 1, __stepAt: 3 }), null);
    assert.equal(addressOf(null), null);
    assert.equal(homeOf({ __step: 1, __stepHome: '/t/schedule' }), '/t/schedule');
    assert.equal(homeOf({ __step: 1 }), null);
    assert.equal(homeOf(undefined), null);
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

/**
 * THE OPEN GAME IS A PLACE (owner, 2026-09-22 — "browser back skips the game"). The verdict above
 * only pays off if a level that CAN name a place actually does. Every door out of the schedule's
 * event sheet leads to another page — the lineup builder, Game day, Run practice, a player — and
 * for as long as the sheet stood on an address-less level, Back out of any of them stepped over
 * it onto the bare schedule. These three are the wiring that makes the game reachable: the sheet
 * names its address, the floor hands it to the step, and the page answers it on the way back in.
 */
describe('the schedule\'s game sheet names its address', () => {
  const schedule = readCode('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx');
  const floor = readCode('components/coaches/useDialogFloor.ts');

  it('the open event IS the address, and it carries the tab the coach is reading', () => {
    assert.match(
      schedule,
      /const sheetAddress = selectedEvent \? `\$\{base\}\/schedule\?event=\$\{selectedEvent\.id\}&tab=\$\{slideTab\}` : null;/,
      'the address is the one the deep link below already answers — and the builder\'s `return`',
    );
    assert.match(schedule, /useDialogFloor\(!!selectedEvent, slideOverRef, \{[\s\S]*?address: sheetAddress \}\);/);
  });

  it('the floor hands its address to the step', () => {
    assert.match(floor, /\}, opts\.address \?\? null\);/, 'useBackStep takes the floor\'s address');
  });

  it('the page hands the query back to the sheet, so a closed game leaves no address behind', () => {
    // A link, the builder's arrow or a reload lands on an entry carrying `?event=`. The sheet's
    // own entry carries it a commit later; this one gives it up, or closing the game would leave
    // an address naming a game that is no longer open.
    assert.match(schedule, /sp\.delete\('event'\);\s*sp\.delete\('tab'\);/);
    assert.match(schedule, /window\.history\.replaceState\(window\.history\.state, '', `\$\{window\.location\.pathname\}\$\{rest \? `\?\$\{rest\}` : ''\}`\);/);
  });
});
