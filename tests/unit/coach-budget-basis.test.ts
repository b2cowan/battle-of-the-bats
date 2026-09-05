/**
 * The "To date" comparison basis — the arithmetic behind the Compare control on Budget vs Actual.
 *
 * ⚠ THE FIGURES HERE ARE THE UAT TEST TEAM'S REAL ONES, read out of the dev database on
 * 2026-09-04, because the whole reason this feature exists is a number that was misleading a coach
 * on a real screen: the report said the season was **$8,690.02 under budget** in September, which
 * reads as an achievement and was really an unfinished season. Invented figures would let this
 * suite pass while the thing it was written to prove had stopped being true.
 *
 * The team's plan, as seeded:
 *   Winter dome block      5,200  ·  Jan/Feb/Mar, dated        → all before 2026-09-04
 *   Diamond permits        3,200  ·  no periods                → never comparable
 *   Spring classic entry   1,600  ·  no periods                → never comparable
 *   Regional qualifier       900  ·  no periods                → never comparable
 *   Umpire fees            1,200  ·  Q1/Q2/Q3/Q4              → Q4 (Oct 1) is AFTER today
 *   Jersey order           1,500  ·  Mar deposit 500 + undated balance 1,000
 *   ────────────────────────────
 *   13,600 whole season   ·   6,600 to date   ·   6,700 undated   ·   300 dated ahead
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  budgetedOn, undatedPlan, varianceOn, netRowLabel, planColumnLabel, normalizeBasis,
  type BasisPeriod,
} from '../../lib/coach-budget-basis.ts';

/** The September the basis was designed against. Fixed, never `new Date()` — a test whose result
 *  depends on the day it runs is a test that goes green again on its own. */
const TODAY = '2026-09-04';

const dome:    BasisPeriod[] = [
  { date: '2026-01-15', amount: 1733 },
  { date: '2026-02-15', amount: 1733 },
  { date: '2026-03-15', amount: 1734 },
];
const umpires: BasisPeriod[] = [
  { date: '2026-01-01', amount: 300 },
  { date: '2026-04-01', amount: 300 },
  { date: '2026-07-01', amount: 300 },
  { date: '2026-10-01', amount: 300 },
];
const jerseys: BasisPeriod[] = [
  { date: '2026-03-01', amount: 500 },
  { date: null,         amount: 1000 },
];

describe('budgetedOn — which span the plan column covers', () => {
  it('returns the whole-season figure untouched on the season basis, periods or not', () => {
    assert.equal(budgetedOn('season', 3200, undefined, TODAY), 3200);
    assert.equal(budgetedOn('season', 5200, dome, TODAY), 5200);
    assert.equal(budgetedOn('season', 1500, jerseys, TODAY), 1500);
  });

  it('counts only periods dated on or before today', () => {
    assert.equal(budgetedOn('todate', 5200, dome, TODAY), 5200);   // all three months are past
    assert.equal(budgetedOn('todate', 1200, umpires, TODAY), 900); // Q4 falls on Oct 1
  });

  it('counts NOTHING for a line that never answered "when"', () => {
    // The honest answer, and the entire reason the date requirement exists: money with no date
    // cannot be placed on either side of today, so it cannot be compared at all.
    assert.equal(budgetedOn('todate', 3200, undefined, TODAY), 0);
    assert.equal(budgetedOn('todate', 3200, [], TODAY), 0);
  });

  it('counts a partly-dated line by its dated half only', () => {
    // The jersey order: a $500 deposit dated March, a $1,000 balance with no date. This is the
    // row the old Schedule column read as "Mar · 2 chunks" — fully dated, to a coach scanning it.
    assert.equal(budgetedOn('todate', 1500, jerseys, TODAY), 500);
  });

  it('includes a period dated exactly today — the boundary is inclusive', () => {
    // "On or before" is the rule the sentence under the table states, so the edge has to match it:
    // money due today has been asked for, and excluding it would make the plan column disagree
    // with the month grid's current column on the one day it matters most.
    assert.equal(budgetedOn('todate', 500, [{ date: TODAY, amount: 500 }], TODAY), 500);
  });

  it('excludes an undated period even when its siblings are dated', () => {
    assert.equal(budgetedOn('todate', 900, [
      { date: '2026-01-01', amount: 400 },
      { date: null,         amount: 500 },
    ], TODAY), 400);
  });

  it('adds up to the team\'s real to-date expense plan', () => {
    const toDate = budgetedOn('todate', 5200, dome, TODAY)
      + budgetedOn('todate', 3200, [], TODAY)
      + budgetedOn('todate', 1600, [], TODAY)
      + budgetedOn('todate', 900, [], TODAY)
      + budgetedOn('todate', 1200, umpires, TODAY)
      + budgetedOn('todate', 1500, jerseys, TODAY);
    assert.equal(Math.round(toDate * 100) / 100, 6600);
  });
});

describe('undatedPlan — the figure the disclosure sentence names', () => {
  it('is the whole line when it has no periods at all', () => {
    // ⚠ NOT the sum of its undated periods, which is zero — a lump sum has no periods to add up,
    // and summing them would report it as fully dated.
    assert.equal(undatedPlan(3200, undefined), 3200);
    assert.equal(undatedPlan(3200, []), 3200);
  });

  it('is the undated remainder of a partly-dated line', () => {
    assert.equal(undatedPlan(1500, jerseys), 1000);
  });

  it('is zero when every dollar carries a date — including dates in the FUTURE', () => {
    // ⚠⚠ THE RULE THIS FILE EXISTS TO PIN. Umpire fees' Q4 chunk is excluded from the to-date
    // plan, but it is NOT undated: it is dated, and it is simply ahead of today. Counting it here
    // would send a coach off to date money that already has a date — the sentence would be asking
    // for work that cannot be done.
    assert.equal(undatedPlan(5200, dome), 0);
    assert.equal(undatedPlan(1200, umpires), 0);
    assert.notEqual(budgetedOn('todate', 1200, umpires, TODAY), 1200); // still excluded to date
  });

  it('never goes negative when a split over-adds against its own total', () => {
    // A desync the server 409s on, but the screen must not print "−$200 has no date" if one
    // reaches it through a stale payload.
    assert.equal(undatedPlan(1000, [{ date: '2026-01-01', amount: 1200 }]), 0);
  });

  it('adds up to the team\'s real undated plan on the cost side', () => {
    const undated = undatedPlan(5200, dome) + undatedPlan(3200, []) + undatedPlan(1600, [])
      + undatedPlan(900, []) + undatedPlan(1200, umpires) + undatedPlan(1500, jerseys);
    assert.equal(Math.round(undated * 100) / 100, 6700);
  });

  it('and the two figures do NOT have to add up to the season plan', () => {
    // 6,600 to date + 6,700 undated = 13,300, not 13,600. The missing $300 is the Q4 umpire chunk:
    // dated, ahead of today, correctly in neither figure. A reader who expects these to reconcile
    // has misunderstood the basis, and a future "let's make the numbers tie out" change would
    // reintroduce exactly the conflation the sentence is written to avoid.
    assert.equal(6600 + 6700, 13300);
  });
});

describe('varianceOn — good news is positive, per direction', () => {
  it('reads revenue as actual less plan', () => {
    // The dues row under To date on the UAT team: nothing due yet, $3,075 already arrived.
    assert.equal(varianceOn('in', 0, 3075), 3075);
    assert.equal(varianceOn('in', 1800, 778.60), -1021.40);
  });

  it('reads a cost as plan less actual', () => {
    // The whole point, in one assertion: the same season reads $8,690.02 "under" against a whole
    // season's plan and $1,690.02 under against the plan to date. Both are arithmetically right;
    // only the second answers "are we on track right now?"
    assert.equal(varianceOn('out', 13600, 4909.98), 8690.02);
    assert.equal(varianceOn('out', 6600, 4909.98), 1690.02);
  });
});

describe('the labels that move with the basis', () => {
  it('renames the closing row under To date', () => {
    // ⚠ THE RULING, not a nicety. Under this basis the figure is a cash-timing statement wearing a
    // profitability name — the UAT team reads ($6,600.00) with a bank balance of +$1,429.37,
    // because its dues start in October, and no amount of dating budget lines moves that.
    assert.equal(netRowLabel('season'), 'Season net');
    assert.equal(netRowLabel('todate'), 'Net to date');
  });

  it('renames the plan column so a scrolled reader can still tell the span', () => {
    assert.equal(planColumnLabel('todate'), 'Plan to date');
  });

  it('falls back to the season basis for anything a corrupt preference could hold', () => {
    // Whole season is the default and stays it: Headroom is quoted against it on five surfaces.
    assert.equal(normalizeBasis(undefined), 'season');
    assert.equal(normalizeBasis('nonsense'), 'season');
    assert.equal(normalizeBasis(null), 'season');
    assert.equal(normalizeBasis('todate'), 'todate');
  });
});
