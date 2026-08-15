import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildLinePeriodActuals, lineActualsKnowable,
  type PeriodSlot, type PaidEvent,
} from '../../lib/coach-budget-line-actuals.ts';

/** A line's periods, in display order. `[date, sortOrder]` — the amounts play no part here. */
function periods(...slots: Array<[string | null, number]>): PeriodSlot[] {
  return slots.map(([periodDate, sortOrder]) => ({ periodDate, sortOrder }));
}

function paid(date: string | null, amount: number): PaidEvent {
  return { date, amount };
}

describe('lineActualsKnowable', () => {
  it('is true for a category holding exactly one line', () => {
    // Nothing else the category's spending could belong to, so the figure is real and is kept.
    assert.equal(lineActualsKnowable(1), true);
  });

  it('is false the moment a category holds two lines', () => {
    assert.equal(lineActualsKnowable(2), false);
    assert.equal(lineActualsKnowable(3), false);
  });

  it('is false for a category with no lines at all', () => {
    assert.equal(lineActualsKnowable(0), false);
  });
});

describe('buildLinePeriodActuals — the multi-line category (the defect)', () => {
  // ⚠ THE REGRESSION TEST. Facilities holds Dome rental, Field rental and Storage; one $340 dome
  // invoice is paid in November. Every line used to be handed the CATEGORY's $340 mapped onto its
  // own periods, so expanding Field rental showed $340 in green with a favourable variance —
  // against a line with no spending at all, and the same dollar reported three times.
  const dome    = periods(['2026-11-30', 0], ['2026-12-31', 1]);
  const field   = periods(['2027-05-31', 0], ['2027-06-30', 1]);
  const storage = periods(['2026-11-30', 0]);
  const novemberInvoice = [paid('2026-11-14', 340)];

  it('reports NOTHING for any line when the category holds three', () => {
    const out = buildLinePeriodActuals([dome, field, storage], novemberInvoice);
    assert.deepEqual(out, [null, null, null]);
  });

  it('says "nobody can say" with null, never a row of zeros', () => {
    // A zero would print identically today and be a different claim: "nothing was spent here".
    const out = buildLinePeriodActuals([dome, field], novemberInvoice);
    for (const line of out) assert.equal(line, null);
  });

  it('still refuses when the category has spending on none of its lines', () => {
    assert.deepEqual(buildLinePeriodActuals([dome, field], []), [null, null]);
  });
});

describe('buildLinePeriodActuals — the single-line category (kept)', () => {
  it('gives the category\'s spending to its one line', () => {
    const out = buildLinePeriodActuals(
      [periods(['2026-11-30', 0], ['2026-12-31', 1])],
      [paid('2026-11-14', 340)],
    );
    assert.deepEqual(out, [[340, 0]]);
  });

  it('places each expense in the first period falling on or after the day it was paid', () => {
    const out = buildLinePeriodActuals(
      [periods(['2026-09-30', 0], ['2026-10-31', 1], ['2026-11-30', 2])],
      [paid('2026-09-01', 100), paid('2026-10-31', 50), paid('2026-11-02', 25)],
    );
    assert.deepEqual(out, [[100, 50, 25]]);
  });

  it('puts an expense paid after the last period, and one with no date, in the final period', () => {
    const out = buildLinePeriodActuals(
      [periods(['2026-09-30', 0], ['2026-10-31', 1])],
      [paid('2027-03-01', 80), paid(null, 20)],
    );
    assert.deepEqual(out, [[0, 100]]);
  });

  it('returns figures index-aligned with the periods as GIVEN, not with their date order', () => {
    // The route hands periods over in the coach's sort order; the arithmetic sorts by date
    // internally. A version that mapped the answer back by label+date collapsed two
    // same-named periods onto one slot and double-counted it.
    const out = buildLinePeriodActuals(
      [periods(['2026-12-31', 0], ['2026-09-30', 1])],
      [paid('2026-09-05', 60)],
    );
    assert.deepEqual(out, [[0, 60]]);
  });

  it('keeps two identically-dated periods apart rather than folding them together', () => {
    const out = buildLinePeriodActuals(
      [periods([null, 0], [null, 1])],
      [paid(null, 90)],
    );
    // Undated periods are ordered by sort_order, and an undated expense lands in the last one.
    assert.deepEqual(out, [[0, 90]]);
  });

  it('reports an empty list for a line with no periods, never a stray bucket', () => {
    assert.deepEqual(buildLinePeriodActuals([[]], [paid('2026-11-14', 340)]), [[]]);
  });

  it('is all zeros when the category has a line but no spending', () => {
    assert.deepEqual(
      buildLinePeriodActuals([periods(['2026-11-30', 0], ['2026-12-31', 1])], []),
      [[0, 0]],
    );
  });
});
