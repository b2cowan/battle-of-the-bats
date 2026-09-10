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
  DUES_CATEGORY_ID, isDuesCategory, buildDuesCategory, buildDuesFamilyRows,
  duesRowRenders, duesSentenceRenders, duesFundingState, duesGap,
  type DuesRevenue,
} from '../../lib/coach-dues-revenue.ts';
/* ⚠ THE REAL BASIS RULE, not a re-statement of it. The family rows exist partly so the To date
   basis needs no dues special case; asserting that with a local copy of the filter would prove
   nothing about the function the screen actually calls. */
import { budgetedOn } from '../../lib/coach-budget-basis.ts';

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

  it('carries no items when there is no schedule — the "Not set yet" row has nothing to fold to', () => {
    /* ⚠⚠ THIS TEST USED TO ASSERT THE OPPOSITE FOR EVERY SEASON, and reading it is the point. Until
       2026-09-10 the dues category carried NO items at all, deliberately: the export walks a
       category and then its items, and a lone item repeating its own category's name would print
       the row twice. Player dues folds to ONE ROW PER FAMILY now (owner ruling, "Things, not
       dates"), and the export's single row is kept by an explicit, commented exception in
       `lib/coach-money-exports.ts` rather than by the category being empty.

       What survives is the ONE state where empty is still right: a team with no schedule. There is
       nothing to fold to, so the row draws no chevron — a fold onto an empty list is the dead end
       this change exists to remove. */
    assert.deepEqual(buildDuesCategory(dues({ billed: null, actual: 0 })).items, []);
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

/**
 * ONE ROW PER FAMILY — the arithmetic that decides whether the category equals the rows underneath
 * it (owner ruling 2026-09-10, "Things, not dates").
 *
 * ⚠⚠ THIS IS THE HALF THAT CANNOT BE CHECKED BY LOOKING. Every figure on the screen renders
 * perfectly whether or not twelve rows add up to the heading above them — a coach only finds out by
 * summing a column by hand, in front of a board. So the identity is asserted here rather than
 * trusted, and it is asserted in the two directions that can drift apart independently: the sum of
 * the rows against the category, and the category against `billed`.
 *
 * ⚠ IT IS TESTABLE AT ALL ONLY BECAUSE THE ARITHMETIC LEFT THE ROUTE. It was written inline in
 * `app/api/.../budget-vs-actual/route.ts` first, where no test could reach it.
 */
describe('Player dues folds to families, and the fold adds up', () => {
  /** Three families on one team: paid in full, part-paid, and one with a bill written down. */
  function family(over: Partial<{ actual: number; cashKept: number; familyPaid: number; raised: number; lowered: number }> = {}) {
    const o = { actual: 0, cashKept: 0, familyPaid: 0, raised: 0, lowered: 0, ...over };
    return {
      actual: o.actual,
      parts: { cashKept: o.cashKept, familyPaidCosts: o.familyPaid, fundraisingCredited: o.raised },
      billLowered: { forgiven: 0, adjustment: o.lowered, total: o.lowered },
    };
  }
  const NAMES: Record<string, string> = { p1: 'Avery Test', p2: 'Blake Test', p3: 'Casey Test' };
  const nameOf = (id: string) => NAMES[id] ?? 'A family';

  /** Two installments each, October and January. */
  function installments(): Array<{ id: string; playerId: string; number: number; amount: number; dueDate: string | null }> {
    return [
      { id: 'i1', playerId: 'p1', number: 1, amount: 560, dueDate: '2026-10-01' },
      { id: 'i2', playerId: 'p1', number: 2, amount: 560, dueDate: '2027-01-01' },
      { id: 'i3', playerId: 'p2', number: 1, amount: 560, dueDate: '2026-10-01' },
      { id: 'i4', playerId: 'p2', number: 2, amount: 560, dueDate: '2027-01-01' },
      { id: 'i5', playerId: 'p3', number: 1, amount: 470, dueDate: '2026-10-01' },
      { id: 'i6', playerId: 'p3', number: 2, amount: 470, dueDate: '2027-01-01' },
    ];
  }
  function rows(over: Partial<Parameters<typeof buildDuesFamilyRows>[0]> = {}) {
    return buildDuesFamilyRows({
      installments: installments(),
      writtenOffBy: new Map(),
      byFamily: new Map([
        ['p1', family({ actual: 1120, cashKept: 1120 })],
        ['p2', family({ actual: 560, cashKept: 420, familyPaid: 95, raised: 45 })],
        ['p3', family({ actual: 235, cashKept: 235 })],
      ]),
      nameOf,
      ...over,
    });
  }

  it('gives every family a row, named and in roster order', () => {
    assert.deepEqual(rows().map(r => r.itemName), ['Avery Test', 'Blake Test', 'Casey Test']);
  });

  it('bills what the family was billed, credits what came in, and leaves the rest as variance', () => {
    const [avery, blake, casey] = rows();
    // Paid in full: the variance column reads nothing to chase.
    assert.equal(avery.budgeted, 1120);
    assert.equal(avery.actual, 1120);
    assert.equal(avery.variance, 0);
    // Part-paid: the variance IS what they still owe, in the column the report already uses for it.
    assert.equal(blake.budgeted, 1120);
    assert.equal(blake.actual, 560);
    assert.equal(blake.variance, -560);
    assert.equal(casey.variance, -705);
  });

  it('⚠⚠ the category is the SUM of its families, on the figure a board reads', () => {
    /* The identity the whole fold rests on. A heading that disagrees with the rows a coach can open
       underneath it is the one defect a fold cannot survive, and nothing on screen would show it. */
    const items = rows();
    const cat = buildDuesCategory(dues({ billed: 3180, actual: 1915 }), items);
    assert.equal(cat.budgeted, items.reduce((s, i) => s + i.budgeted, 0));
    assert.equal(cat.budgeted, 3180);
    assert.equal(cat.variance, -1265);
  });

  it('⚠ and the sum still holds when a bill has been written down', () => {
    /* A lowered bill is not still planned (owner ruling 2026-09-09). It comes off the family's own
       Budgeted, so the category drops by exactly the same amount — the two figures can only move
       together, which is what keeps this row equal to the Months band. */
    const withWriteOff = rows({
      byFamily: new Map([
        ['p1', family({ actual: 1103, cashKept: 1103, lowered: 17 })],
        ['p2', family({ actual: 560, cashKept: 560 })],
        ['p3', family({ actual: 235, cashKept: 235 })],
      ]),
    });
    assert.equal(withWriteOff[0].budgeted, 1103);
    const cat = buildDuesCategory(dues({ billed: 3163 }), withWriteOff);
    assert.equal(cat.budgeted, 3163);
    assert.equal(cat.budgeted, withWriteOff.reduce((s, i) => s + i.budgeted, 0));
  });

  it('⚠⚠ carries each family\'s own due dates, so the To date basis needs no special case', () => {
    /* The reason `rebaseReport` could delete its dues branch. On 1 November only the October half
       is due, and the ordinary rule (*plan dated on or before today*) has to land on it. */
    const [avery] = rows();
    assert.deepEqual(avery.periods.map(p => p.date), ['2026-10-01', '2027-01-01']);
    assert.equal(budgetedOn('todate', avery.budgeted, avery.periods, '2026-11-01'), 560);
    // And the whole season is still the row's own figure, untouched by the periods.
    assert.equal(budgetedOn('season', avery.budgeted, avery.periods, '2026-11-01'), 1120);
  });

  it('⚠ nets a write-off off the installment it was placed on, in that installment\'s own month', () => {
    const off = rows({ writtenOffBy: new Map([['i2', 17]]) });
    assert.deepEqual(off[0].periods.map(p => p.amount), [560, 543]);
  });

  it('⚠⚠ an installment nobody owns still reaches a row, or the fold stops adding up', () => {
    /* `player_id` is denormalised and null on older rows; when the schedule cannot answer either,
       the empty key collects it. Dropping it would leave the rows quietly short of their heading. */
    const orphaned = buildDuesFamilyRows({
      installments: [...installments(), { id: 'i7', playerId: '', number: 1, amount: 100, dueDate: '2026-10-01' }],
      writtenOffBy: new Map(),
      byFamily: new Map([['p1', family({ actual: 0 })]]),
      nameOf,
    });
    const stray = orphaned.find(r => r.itemName === 'A family');
    assert.ok(stray, 'the unowned installment lost its row');
    assert.equal(stray.budgeted, 100);
    assert.equal(orphaned.reduce((s, r) => s + r.budgeted, 0), 3280);
  });

  it('a family row is a plain BUDGETED figure and a door on its ACTUAL — never the other way round', () => {
    /* ⚠ THE REPORT-WIDE RULE, expressed as data rather than as markup: a family's bill is one
       assessed figure (no `lines`, so the screen draws no plan door), and its contribution is three
       kinds of money (`duesParts`, which is what the screen opens). */
    for (const r of rows()) {
      assert.deepEqual(r.lines, []);
      assert.deepEqual(r.costs, []);
      assert.ok(r.duesParts, 'a family row must carry the three parts its Actual opens onto');
    }
    /* ⚠ THE FIELD IS OPTIONAL ON THE TYPE — deliberately, for the same rolling-deploy reason
       `lines` and `costs` are — so this asserts its presence before reading it rather than
       reaching through it. A non-null assertion here would hide exactly the regression the
       assertion above is for. */
    const blake = rows()[1];
    const parts = blake.duesParts;
    assert.ok(parts, "Blake’s row lost its parts");
    assert.equal(parts.cashKept + parts.familyPaidCosts + parts.fundraisingCredited, blake.actual);
  });
});
