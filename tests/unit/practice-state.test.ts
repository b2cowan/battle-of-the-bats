import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  RUN_WINDOW_MS, practiceHasPlan, isInRunWindow, practicePlanState,
  practiceFitLabel, practiceLengthMinutes, practiceRecapLine,
  practicePlanFit, practicePlannedLabel, practiceRemainderLabel, practiceStarted, practiceIsRecord,
} from '../../lib/practice-state.ts';
import { emptyPracticePlan, sanitizePracticePlan, summarizePracticePlan, type PracticePlan } from '../../lib/rep-practice-plan.ts';

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

describe('practicePlanFit — the sheet\'s "N of 90 min planned · K unplanned" (stage 1, D3)', () => {
  it('a blank plan against a 90-minute practice: 0 of 90 planned, 90 unplanned', () => {
    const fit = practicePlanFit(emptyPracticePlan(), 90);
    assert.deepEqual(fit, { planned: 0, length: 90, remainder: { kind: 'unplanned', minutes: 90 } });
    assert.equal(practicePlannedLabel(fit), '0 of 90 min planned');
    assert.equal(practiceRemainderLabel(fit), '90 unplanned');
  });
  it('one 15-minute block: 15 of 90, 75 unplanned', () => {
    const fit = practicePlanFit(planOf([{ title: 'Warm-up', duration: { minutes: 15 } }]), 90);
    assert.equal(practicePlannedLabel(fit), '15 of 90 min planned');
    assert.equal(practiceRemainderLabel(fit), '75 unplanned');
  });
  it('a plan that fills the practice exactly has no second half', () => {
    const fit = practicePlanFit(planOf([{ title: 'A', duration: { minutes: 60 } }, { title: 'B', duration: { minutes: 30 } }]), 90);
    assert.equal(practicePlannedLabel(fit), '90 of 90 min planned');
    assert.equal(practiceRemainderLabel(fit), null);
  });
  it('a plan that overruns says "over" — honest, and the reason the line exists', () => {
    const fit = practicePlanFit(planOf([{ title: 'A', duration: { minutes: 100 } }]), 90);
    assert.equal(practicePlannedLabel(fit), '100 of 90 min planned');
    assert.equal(practiceRemainderLabel(fit), '10 over');
  });
  it('a "rest of practice" block claims the remainder rather than leaving it "unplanned"', () => {
    const fit = practicePlanFit(planOf([
      { title: 'Warm-up', duration: { minutes: 30 } },
      { title: 'Scrimmage', duration: { restOfPractice: true } },
    ]), 90);
    assert.equal(practicePlannedLabel(fit), '30 of 90 min planned', 'timed minutes only — never an invented figure for the rest block');
    assert.equal(practiceRemainderLabel(fit), '60 rest of practice');
  });
  it('with no end time the line has no "of" and no remainder', () => {
    assert.equal(practicePlannedLabel(practicePlanFit(planOf([{ title: 'A', duration: { minutes: 15 } }]), null)), '15 min planned');
    assert.equal(practiceRemainderLabel(practicePlanFit(planOf([{ title: 'A', duration: { minutes: 15 } }]), null)), null);
    assert.equal(practicePlannedLabel(practicePlanFit(emptyPracticePlan(), null)), 'Nothing planned yet');
  });
});

describe('practiceStarted — the start time has passed (stage 1, D7)', () => {
  it('true from the start instant on; false before; false with no start', () => {
    assert.equal(practiceStarted(at(0), NOW), true);
    assert.equal(practiceStarted(at(-60_000), NOW), true);
    assert.equal(practiceStarted(at(60_000), NOW), false);
    assert.equal(practiceStarted(null, NOW), false);
    assert.equal(practiceStarted('not a date', NOW), false);
  });
  it('is not the run window — three hours early is inside the window but not started', () => {
    assert.equal(isInRunWindow(at(2 * H), NOW), true);
    assert.equal(practiceStarted(at(2 * H), NOW), false);
  });
});

describe('the run window has BOTH edges — three hours after the END, not the start (/review, stage 5)', () => {
  it('a four-hour practice keeps its doors to the last minute', () => {
    const start = at(-3.5 * H);            // started three and a half hours ago
    const end = at(0.5 * H);               // ends in half an hour
    assert.equal(isInRunWindow(start, NOW), false, 'by the start alone the window shut half an hour ago');
    assert.equal(isInRunWindow(start, NOW, end), true, 'with the end it is open');
    assert.equal(isInRunWindow(start, NOW + 3.5 * H, end), true, 'three hours after the end is still inside');
    assert.equal(isInRunWindow(start, NOW + 3.5 * H + 1000, end), false);
  });
  it('an end before the start, or none, falls back to the start', () => {
    assert.equal(isInRunWindow(at(-3 * H - 1000), NOW, null), false);
    assert.equal(isInRunWindow(at(-3 * H - 1000), NOW, at(-4 * H)), false, 'an end before the start is no end');
  });
  it('practicePlanState reads the end when the event carries one', () => {
    const planned = planOf([{ title: 'Camp', duration: { minutes: 240 } }]);
    assert.equal(practicePlanState({ practicePlan: planned, startsAt: at(-3.5 * H), endsAt: at(0.5 * H) }, NOW), 'run');
    assert.equal(practicePlanState({ practicePlan: planned, startsAt: at(-3.5 * H) }, NOW), 'planned');
  });
});

// ── Stage 6 · Afterwards & who sees what (owner rulings R1 · R2, 2026-09-18) ────────────────────

describe('practiceIsRecord (R1) — a record from the instant the run window CLOSES, and never before', () => {
  it('before the start, during, and inside the trailing three hours it is NOT a record', () => {
    const start = at(-1 * H), end = at(0.5 * H);
    assert.equal(practiceIsRecord(at(2 * H), NOW), false, 'still ahead');
    assert.equal(practiceIsRecord(start, NOW, end), false, 'in progress');
    assert.equal(practiceIsRecord(start, NOW + 0.5 * H, end), false, 'just ended');
    assert.equal(practiceIsRecord(start, NOW + 3.5 * H, end), false, 'exactly three hours after the end — the window\'s last instant is still live');
  });
  it('one instant after the window shuts it IS a record — the same instant Run practice goes plain', () => {
    const start = at(-1 * H), end = at(0.5 * H);
    const shut = NOW + 3.5 * H + 1000;
    assert.equal(practiceIsRecord(start, shut, end), true);
    assert.equal(isInRunWindow(start, shut, end), false, 'the two predicates share the one edge');
    assert.equal(practiceIsRecord(start, NOW + 30 * 24 * H, end), true, 'and a month later, still');
  });
  it('with no end, the boundary is three hours after the START', () => {
    const start = at(-3 * H);
    assert.equal(practiceIsRecord(start, NOW), false, 'exactly three hours after the start — live');
    assert.equal(practiceIsRecord(start, NOW + 1000), true);
    assert.equal(practiceIsRecord(start, NOW + 1000, null), true);
  });
  it('an end at or before the start is no end — the start rules', () => {
    const start = at(-3 * H);
    assert.equal(practiceIsRecord(start, NOW + 1000, at(-4 * H)), true, 'an end before the start');
    assert.equal(practiceIsRecord(start, NOW + 1000, start), true, 'an end equal to the start');
    assert.equal(practiceIsRecord(start, NOW - 1000, at(-4 * H)), false);
  });
  it('a missing or unreadable start is never a record (nothing to be a record OF)', () => {
    assert.equal(practiceIsRecord(null, NOW), false);
    assert.equal(practiceIsRecord(undefined, NOW), false);
    assert.equal(practiceIsRecord('not a date', NOW), false);
    assert.equal(practiceIsRecord(at(-10 * H), NOW, 'not a date'), true, 'an unreadable END is no end; the start rules');
  });
  it('the three facts stay three: started · in the window · a record', () => {
    // A 7:00–8:30 p.m. practice, read across its evening.
    const start = at(0), end = at(1.5 * H);
    const reads = [
      [-4 * H, false, false, false],   // 3 p.m. — ahead, outside
      [-2 * H, false, true, false],    // 5 p.m. — the window opens three hours early
      [0, true, true, false],          // 7:00 — started
      [1 * H, true, true, false],      // 8:00 — in progress
      [4.5 * H, true, true, false],    // 11:30 — the window's last instant
      [4.5 * H + 60_000, true, false, true], // 11:31 — a record
    ] as const;
    for (const [offset, started, inWindow, record] of reads) {
      const now = NOW + offset;
      assert.equal(practiceStarted(start, now), started, `started at +${offset / H}h`);
      assert.equal(isInRunWindow(start, now, end), inWindow, `in window at +${offset / H}h`);
      assert.equal(practiceIsRecord(start, now, end), record, `record at +${offset / H}h`);
    }
  });
});

describe('practicePlannedLabel on a record (R2) — a fact, never a promise', () => {
  it('"Nothing planned" without its "yet"; every other reading unchanged', () => {
    assert.equal(practicePlannedLabel(practicePlanFit(emptyPracticePlan(), null), { record: true }), 'Nothing planned');
    assert.equal(practicePlannedLabel(practicePlanFit(emptyPracticePlan(), null)), 'Nothing planned yet');
    assert.equal(practicePlannedLabel(practicePlanFit(planOf([{ title: 'A', duration: { minutes: 15 } }]), null), { record: true }), '15 min planned');
    assert.equal(practicePlannedLabel(practicePlanFit(emptyPracticePlan(), 90), { record: true }), '0 of 90 min planned');
  });
});
