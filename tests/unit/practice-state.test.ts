import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  RUN_WINDOW_MS, practiceHasPlan, isInRunWindow, practicePlanState,
  practiceFitLabel, practiceLengthMinutes, practiceRecapLine,
} from '../../lib/practice-state.ts';
import { sanitizePracticePlan, summarizePracticePlan, type PracticePlan } from '../../lib/rep-practice-plan.ts';

/**
 * A practice's state and the one action it earns (practices re-evaluation stage 0 · Arrive,
 * D1 · D3 · D4 · D7). The card, the rows and the Overview all read these; a second definition of
 * "planned" or a second run window anywhere is the drift this file exists to catch.
 */

const NOW = Date.parse('2026-09-20T15:31:00-04:00');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const H = 60 * 60 * 1000;

function planOf(blocks: unknown[]): PracticePlan {
  const p = sanitizePracticePlan({ version: 1, blocks });
  assert.ok(p, 'fixture plan sanitised to something');
  return p;
}

describe('practiceHasPlan — at least one BLOCK, never the row', () => {
  it('a goal-only autosaved draft is NOT a plan', () => {
    const goalOnly = sanitizePracticePlan({ goal: 'work on cut-offs', blocks: [] });
    assert.ok(goalOnly, 'a goal alone is a real, savable plan row');
    assert.equal(practiceHasPlan({ practicePlan: goalOnly }), false);
    assert.equal(practiceHasPlan({ practicePlan: null }), false);
  });
  it('one block is a plan', () => {
    assert.equal(practiceHasPlan({ practicePlan: planOf([{ title: 'Warm-up' }]) }), true);
  });
});

describe('the run window — ONE constant, three hours either side', () => {
  it('is exactly ±3h', () => {
    assert.equal(RUN_WINDOW_MS, 3 * H);
    assert.equal(isInRunWindow(at(-3 * H), NOW), true, 'three hours after the start is still inside');
    assert.equal(isInRunWindow(at(3 * H), NOW), true, 'three hours before the start is inside');
    assert.equal(isInRunWindow(at(3 * H + 1000), NOW), false);
    assert.equal(isInRunWindow(at(-3 * H - 1000), NOW), false);
  });
});

describe('practicePlanState — none · planned · run', () => {
  const planned = planOf([{ title: 'Warm-up', duration: { minutes: 20 } }]);
  it('no plan → none, whatever the clock says', () => {
    assert.equal(practicePlanState({ practicePlan: null, startsAt: at(0) }, NOW), 'none');
    assert.equal(practicePlanState({ practicePlan: null, startsAt: at(6 * 24 * H) }, NOW), 'none');
  });
  it('a plan six days out → planned; a plan inside the window → run', () => {
    assert.equal(practicePlanState({ practicePlan: planned, startsAt: at(6 * 24 * H) }, NOW), 'planned');
    assert.equal(practicePlanState({ practicePlan: planned, startsAt: at(20 * 60 * 1000) }, NOW), 'run');
    assert.equal(practicePlanState({ practicePlan: planned, startsAt: at(-20 * 60 * 1000) }, NOW), 'run', 'twenty minutes in is still tonight');
  });
  it('"run" is never claimed without a plan — the field screen needs something to run', () => {
    assert.equal(practicePlanState({ practicePlan: null, startsAt: at(0) }, NOW), 'none');
  });
});

describe('practiceFitLabel (D4) — the plan against the practice', () => {
  const three = planOf([
    { title: 'Warm-up', duration: { minutes: 15 } },
    { title: 'Stations', duration: { minutes: 30 }, stations: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] },
    { title: 'Game', duration: { minutes: 15 } },
  ]);
  it('says "60 of 90 min" when the practice has an end', () => {
    assert.equal(practiceFitLabel(three, at(0), at(90 * 60 * 1000)), '3 blocks · 60 of 90 min · 1 rotation');
  });
  it('says "60 min" — not "60 min planned" — when it does not', () => {
    assert.equal(practiceFitLabel(three, at(0), null), '3 blocks · 60 min · 1 rotation');
  });
  it('an overrunning plan is stated, never clipped', () => {
    assert.equal(practiceFitLabel(three, at(0), at(45 * 60 * 1000)), '3 blocks · 60 of 45 min · 1 rotation');
  });
  it('is ONE builder with the plain summary — the fit reading is an option on it, never string surgery', () => {
    assert.equal(summarizePracticePlan(three), '3 blocks · 60 min planned · 1 rotation', 'the Schedule panel keeps "planned"');
    assert.equal(summarizePracticePlan(three, { length: 90 }), '3 blocks · 60 of 90 min · 1 rotation');
    assert.equal(summarizePracticePlan(three, { length: null }), '3 blocks · 60 min · 1 rotation');
    assert.equal(practiceFitLabel(three, at(0), at(90 * 60 * 1000)), summarizePracticePlan(three, { length: 90 }));
  });
  it('a plan with no timed minutes falls back to the count (the fit is unknowable)', () => {
    const untimed = planOf([{ title: 'Whatever we need', duration: { restOfPractice: true } }]);
    assert.equal(practiceFitLabel(untimed, at(0), at(90 * 60 * 1000)), '1 block');
  });
  it('an end before the start is no end at all', () => {
    assert.equal(practiceLengthMinutes(at(0), at(-H)), null);
    assert.equal(practiceLengthMinutes(at(0), at(0)), null);
    assert.equal(practiceLengthMinutes(at(0), at(89.6 * 60 * 1000)), 90, 'rounded to whole minutes');
    assert.equal(practiceLengthMinutes(at(0), at(15_000)), null, 'fifteen seconds rounds to nothing — no "60 of 0 min"');
  });
});

describe('practiceRecapLine (D3) — the first line the coach wrote', () => {
  it('takes the first non-empty line, trimmed', () => {
    assert.equal(practiceRecapLine('\n  The shorter distance helped.  \nKeep that.'), 'The shorter distance helped.');
  });
  it('nothing written → null, never an empty line', () => {
    assert.equal(practiceRecapLine(null), null);
    assert.equal(practiceRecapLine(''), null);
    assert.equal(practiceRecapLine('  \n \n'), null);
  });
});
