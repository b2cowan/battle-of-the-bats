/**
 * ONE WORD, ONE LINE ON A PLAN — the join, and the question it retired.
 * (Owner ruling 2026-09-09; migration 286 makes it true in the database.)
 *
 * A budget word carries exactly one line per season plan. Picking a word that is already there
 * ADDS to that line: the totals add and the two schedules become one. These pin the half of that
 * rule with an edge — what happens when only one side of the join has dates.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { joinPeriodSplits, readPeriodsPayload } from '../../lib/coach-budget-periods-payload.ts';
import { NO_DATE_LABEL } from '../../lib/coach-budget-periods-view.ts';
import { readCode } from './_source-code.ts';

/** The word the product actually prints, never a hand-typed copy — a guard that spells the label
 *  itself passes happily while the product says something else. */
const UNDATED = NO_DATE_LABEL;

const dated = (label: string, date: string, amount: number) =>
  ({ periodLabel: label, periodDate: date, amount });

describe('joining two splits when money is added to a word already on the plan', () => {
  test('two dated schedules become one, in the order they were made', () => {
    const joined = joinPeriodSplits(
      { total: 600, periods: [dated('Nov', '2026-11-01', 600)] },
      { total: 900, periods: [dated('Mar', '2027-03-01', 900)] },
    );
    assert.deepEqual(joined.map(p => [p.periodLabel, p.amount, p.sortOrder]), [
      ['Nov', 600, 0],
      ['Mar', 900, 1],
    ]);
  });

  test('a split is still a split: every period keeps its own date', () => {
    const joined = joinPeriodSplits(
      { total: 1200, periods: [dated('Q1', '2027-01-01', 600), dated('Q2', '2027-04-01', 600)] },
      { total: 300, periods: [dated('Q4', '2027-10-01', 300)] },
    );
    assert.deepEqual(joined.map(p => p.periodDate), ['2027-01-01', '2027-04-01', '2027-10-01']);
  });

  /* ⚠⚠ THE CASE THE WHOLE RULE EXISTS FOR (owner ruling Q4, 2026-09-09). Adding dated money to an
     undated line leaves a line that is only PART scheduled — and every write door enforces "the
     split sums to the total". Left implicit, the coach's very next edit of that line would be
     refused with a 409 about money they never mis-entered. */
  test('adding dated money to an UNDATED line materialises the undated half, so the split still sums', () => {
    const joined = joinPeriodSplits(
      { total: 600, periods: [] },
      { total: 900, periods: [dated('Mar', '2027-03-01', 900)] },
    );
    assert.deepEqual(joined.map(p => [p.periodLabel, p.periodDate, p.amount]), [
      [UNDATED, null, 600],
      ['Mar', '2027-03-01', 900],
    ]);
    // The invariant the write doors actually check, asserted through the checker itself.
    assert.equal(readPeriodsPayload(joined, 1500).ok, true);
  });

  test('and the other way round — undated money added to a DATED line', () => {
    const joined = joinPeriodSplits(
      { total: 900, periods: [dated('Mar', '2027-03-01', 900)] },
      { total: 600, periods: [] },
    );
    assert.deepEqual(joined.map(p => [p.periodLabel, p.amount]), [['Mar', 900], [UNDATED, 600]]);
    assert.equal(readPeriodsPayload(joined, 1500).ok, true);
  });

  /* A line with no periods is already read as wholly undated everywhere. Inventing one covering the
     whole total would turn a lump sum into a "split" the editor then offers to rescale. */
  test('two undated sides stay a lump sum — no split is invented', () => {
    assert.deepEqual(joinPeriodSplits({ total: 600, periods: [] }, { total: 900, periods: [] }), []);
  });

  /* ⚠⚠ THE DEFECT /review FOUND, PINNED. Each side is only ever held to ±$0.02 of its OWN total —
     the tail an even split leaves — so two sides that were each accepted on save can concatenate to
     $0.04 from the joined total, past the tolerance the write door then enforces. The coach would
     have met "Period amounts must sum to the line total" on a save the product built for them. */
  test('two splits each within their own rounding tolerance still join to an EXACT total', () => {
    const joined = joinPeriodSplits(
      { total: 100, periods: [dated('Jan', '2027-01-01', 50.01), dated('Feb', '2027-02-01', 50.01)] },
      { total: 50, periods: [dated('Mar', '2027-03-01', 25.01), dated('Apr', '2027-04-01', 25.01)] },
    );
    assert.equal(joined.reduce((s, p) => s + p.amount, 0), 150);
    // The tail absorbs it — no earlier chunk is touched.
    assert.deepEqual(joined.map(p => p.amount), [50.01, 50.01, 25.01, 24.97]);
    assert.equal(readPeriodsPayload(joined, 150).ok, true);
  });

  test('and in the other direction — a joined split that falls SHORT is topped up on its tail', () => {
    const joined = joinPeriodSplits(
      { total: 100, periods: [dated('Jan', '2027-01-01', 49.99), dated('Feb', '2027-02-01', 49.99)] },
      { total: 50, periods: [dated('Mar', '2027-03-01', 49.99)] },
    );
    assert.equal(joined.reduce((s, p) => s + p.amount, 0), 150);
    assert.equal(readPeriodsPayload(joined, 150).ok, true);
  });

  test('rounds the materialised half to the cent, so a third of a dollar cannot drift the sum', () => {
    const joined = joinPeriodSplits(
      { total: 33.333, periods: [] },
      { total: 10, periods: [dated('Mar', '2027-03-01', 10)] },
    );
    assert.equal(joined[0].amount, 33.33);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════════════════
   THE QUESTION THAT WAS RETIRED WITH THE SECOND LINE
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('"What makes this line different?" is gone from everywhere a coach can read it', () => {
  /* ⚠⚠ IT WAS NEVER A COPY PROBLEM. The form asked a coach to invent a phrase telling two rows
     apart — and nothing downstream could use it, because real money is matched to the WORD and
     never to the line. A phrase-less second line then ended up named after its own month, which
     the When column beside it already printed.

     Guarded across the screen AND the help at once, under the one-spelling rule: a help article
     still describing a control that no longer exists is the same defect as two spellings of one
     word — the coach searches for it and lands on an answer the product cannot honour. */
  const SURFACES = [
    'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx',
    'lib/help-content/coaches.tsx',
    'scripts/seed-demo-coach.mjs',
  ];

  for (const file of SURFACES) {
    test(`${file} does not ask it`, () => {
      const src = readCode(file);
      assert.ok(
        !/what makes this line different/i.test(src),
        `"What makes this line different?" is back in ${file}. One word carries one line since `
        + '2026-09-09 (migration 286), so there is no second line for it to tell apart — and the '
        + 'database refuses one. If a coach needs to say something about a word, that is Notes.',
      );
    });
  }
});
