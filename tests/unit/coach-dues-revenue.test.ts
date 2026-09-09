/**
 * PLAYER DUES ON THE STATEMENT (lib/coach-dues-revenue.ts) — the rules that decide whether the row
 * and the sentence appear, and which of the four approved sentences a season gets.
 *
 * The arithmetic here is one subtraction, so the tests are not really about the sum. They pin the
 * three rules that a later tidy-up would reverse without any figure looking wrong:
 *
 *   1. **Null is not zero.** No dues schedule renders an em-dash and a door, never `$0.00`. Every
 *      team is in that state on day one, and "nothing owed" and "not set up yet" are different
 *      facts a treasurer acts on differently.
 *   2. **The row and the sentence part company in exactly one state** — the season whose other
 *      income exceeds the whole plan AND which has a dues schedule anyway. `planNeeds` floors at
 *      zero there, so the sentence's identity stops holding and it must say nothing rather than say
 *      something false. The row still renders: those are real dollars, and dropping them would
 *      break the Statement-equals-Months identity the whole change exists to create.
 *   3. **The gap IS the budgeted Season net, negated** — the claim the sentence prints on screen,
 *      and the entire justification for deleting the "Funded by players" row. Stated here as
 *      algebra over the three inputs; `check:money-report` states it again over a real season,
 *      which is the pair that makes it hard to break quietly.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DUES_CATEGORY_ID, isDuesCategory, buildDuesCategory,
  duesRowRenders, duesSentenceRenders, duesFundingState, duesGap,
  type DuesRevenue,
} from '../../lib/coach-dues-revenue.ts';

/** The UAT team's real shape: the plan needs $11,650 and dues bill $11,308.30.
 *  ⚠ `billedToDate` IS 0 ON THIS TEAM AND THAT IS NOT A PLACEHOLDER — every one of its instalments
 *  falls between 2026-10-01 and 2027-03-01, so on the September the basis was built for, families
 *  have genuinely been asked for nothing yet while $3,075 has already arrived. It is the case that
 *  made "Net to date" need its own name. */
function dues(over: Partial<DuesRevenue> = {}): DuesRevenue {
  return {
    billed: 11308.30,
    billedToDate: 0,
    /* ⚠ WHAT FAMILIES CONTRIBUTED, not the cash that arrived (owner rulings R2–R4, 2026-09-07) —
       $2,775.00 of cash they sent and kept, $1,379.98 of team bills they paid themselves, $852.65
       of fundraising credited against their dues. The cash figure ($3,075.00) is still what the
       Months band shows; these two are meant to differ now. */
    actual: 5007.63,
    actualParts: { cashKept: 2775, familyPaidCosts: 1379.98, fundraisingCredited: 852.65 },
    planNeeds: 11650,
    planNeedsFloored: false,
    familyCount: 12,
    assessed: 11308.30,
    writtenOff: 0,
    writtenOffKinds: { forgiven: false, adjustment: false },
    ...over,
  };
}

describe('the dues row renders when there is something to say', () => {
  it('renders with figures when the season has a dues schedule', () => {
    assert.equal(duesRowRenders(dues()), true);
  });

  it('renders with NO schedule when the plan still needs money from families', () => {
    // Day one for every team: costs in the budget, dues not set up. The row is how a coach finds out.
    assert.equal(duesRowRenders(dues({ billed: null, actual: 0, assessed: 0 })), true);
  });

  it('does NOT render when there is no schedule and the plan needs nothing from families', () => {
    // Fundraising and sponsorship cover the whole plan. A permanent "not set yet" prompt here would
    // be nagging a coach to fix something that is not broken.
    assert.equal(
      duesRowRenders(dues({ billed: null, actual: 0, assessed: 0, planNeeds: 0 })),
      false);
  });

  it('STILL renders when the plan needs nothing but dues were billed anyway', () => {
    // ⚠ The state the approved mockups did not draw. Dropping this row would take real billed
    // dollars off the report and break the identity with the Months view.
    assert.equal(
      duesRowRenders(dues({ planNeeds: 0, planNeedsFloored: true })),
      true);
  });
});

describe('the sentence is silent exactly where its proof stops holding', () => {
  it('renders alongside an ordinary row', () => {
    assert.equal(duesSentenceRenders(dues()), true);
  });

  it('renders on a team that has set no dues, because that is the case it has most to say to', () => {
    assert.equal(duesSentenceRenders(dues({ billed: null, actual: 0, assessed: 0 })), true);
  });

  it('is SILENT when the plan residual was floored, even though the row renders', () => {
    // The identity `gap = −netBudget` is false here: `planNeeds` was clamped up to zero, so the
    // subtraction the sentence prints no longer arrives at the figure it names. Saying nothing is
    // the only honest option — the alternative is a proof on screen that does not hold.
    const floored = dues({ planNeeds: 0, planNeedsFloored: true });
    assert.equal(duesRowRenders(floored), true);
    assert.equal(duesSentenceRenders(floored), false);
  });

  it('is silent when there is no row either', () => {
    assert.equal(
      duesSentenceRenders(dues({ billed: null, actual: 0, assessed: 0, planNeeds: 0 })),
      false);
  });
});

describe('the four approved sentences, one per state', () => {
  it('short — dues bill less than the plan needs', () => {
    assert.equal(duesFundingState(dues()), 'short');
    assert.equal(duesGap(dues()), 341.70);
  });

  it('buffer — a coach collecting above the plan is not "-$350 short"', () => {
    const over = dues({ billed: 12000 });
    assert.equal(duesFundingState(over), 'buffer');
    // ⚠ POSITIVE EITHER WAY. The words carry the direction, exactly as the Budget plan page's own
    // "Planned buffer" / "Short of covering the plan" pair does; a negative here would reach the
    // screen as "a -$350.00 buffer".
    assert.equal(Math.abs(duesGap(over)), 350);
  });

  it('covered — dues bill exactly what the plan needs', () => {
    assert.equal(duesFundingState(dues({ billed: 11650 })), 'covered');
  });

  it('covered on a half-cent tail, rather than a gap a coach can see is not there', () => {
    // The deadband every money comparison on this report uses. Without it a rounding remainder
    // renders as "the $0.00 gap".
    assert.equal(duesFundingState(dues({ billed: 11650.004 })), 'covered');
    assert.equal(duesFundingState(dues({ billed: 11649.996 })), 'covered');
  });

  it('unset — no schedule, whatever the plan needs', () => {
    assert.equal(duesFundingState(dues({ billed: null })), 'unset');
    assert.equal(duesFundingState(dues({ billed: null, planNeeds: 0 })), 'unset');
  });
});

describe('the gap IS the budgeted Season net, negated — the claim that deleted a row', () => {
  /**
   * With D = dues billed, F = other income budgeted and E = the effective plan:
   *   plan needs   = E − F        (unfloored)
   *   the gap      = (E − F) − D
   *   Season net   = (D + F) − E  = −the gap
   * Checked over a spread of seasons rather than the one that prompted the change, because "it
   * works on this team" is exactly how an identity ships that is really a coincidence.
   */
  for (const [D, F, E] of [
    [11308.30, 1950, 13600],   // the UAT team: short
    [12000, 1950, 13600],      // over-billed: a buffer
    [11650, 1950, 13600],      // exactly covered
    [0, 1950, 13600],          // nothing billed yet
    [4000.55, 0, 4000.55],     // no other income at all, and an odd cent
  ] as Array<[number, number, number]>) {
    it(`holds for dues ${D} · other income ${F} · plan ${E}`, () => {
      const planNeedsRaw = Math.round((E - F) * 100) / 100;
      const d = dues({ billed: D, planNeeds: Math.max(0, planNeedsRaw), planNeedsFloored: planNeedsRaw < -0.005 });
      // `|| 0` normalises the negative zero JavaScript hands back for an exactly-covered season —
      // `-0` and `0` are the same money and `assert.equal` is the only thing that disagrees.
      const seasonNetBudgeted = Math.round(((D + F) - E) * 100) / 100;
      assert.equal(duesSentenceRenders(d), true);
      assert.equal(duesGap(d) || 0, -seasonNetBudgeted || 0);
    });
  }

  it('and BREAKS where the floor bites, which is why that season gets no sentence', () => {
    // Other income ($6,000) exceeds the whole plan ($5,200): plan needs clamps to 0.
    const [D, F, E] = [900, 6000, 5200];
    const planNeedsRaw = Math.round((E - F) * 100) / 100;   // −800
    const d = dues({ billed: D, planNeeds: Math.max(0, planNeedsRaw), planNeedsFloored: true });
    const seasonNetBudgeted = Math.round(((D + F) - E) * 100) / 100;
    assert.notEqual(duesGap(d), -seasonNetBudgeted);
    assert.equal(duesSentenceRenders(d), false);
  });
});

describe('the synthetic category the report is handed', () => {
  it('carries the SAME key the Months revenue band uses for its dues group', () => {
    // One key for both views: the Statement's row and the Months group are one thing read two ways,
    // and `check:money-report` can only hold them equal by addressing them the same way.
    assert.equal(DUES_CATEGORY_ID, 'revenue:dues');
    assert.equal(isDuesCategory('revenue:dues'), true);
    // The grid hands its keys back prefixed; both spellings must answer.
    assert.equal(isDuesCategory('id:revenue:dues'), true);
    assert.equal(isDuesCategory('revenue:fundraising'), false);
    assert.equal(isDuesCategory(null), false);
  });

  it('is good-news-positive on the income side, like every other revenue row', () => {
    const cat = buildDuesCategory(dues());
    assert.equal(cat.direction, 'in');
    assert.equal(cat.budgeted, 11308.30);
    // ⚠ WHAT FAMILIES CONTRIBUTED, not the $3,075.00 of cash — see the fixture's own note.
    assert.equal(cat.actual, 5007.63);
    // actual − budgeted: raising LESS than planned must read as the unfavourable number.
    assert.equal(cat.variance, -6300.67);
  });

  it('carries NO items, so the export prints one row rather than the same figures twice', () => {
    assert.deepEqual(buildDuesCategory(dues()).items, []);
  });

  it('is `inPlan` only when a schedule exists — which is what makes the file write a blank', () => {
    assert.equal(buildDuesCategory(dues()).inPlan, true);
    const unset = buildDuesCategory(dues({ billed: null, actual: 0 }));
    assert.equal(unset.inPlan, false);
    // ⚠ And its budgeted figure is a plain zero rather than anything exotic: the SCREEN and the
    // FILE both decide what to draw from `inPlan`, never from the number.
    assert.equal(unset.budgeted, 0);
  });
});
