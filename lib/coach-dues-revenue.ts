/**
 * PLAYER DUES AS A ROW ON THE STATEMENT (owner ruling 2026-09-04).
 *
 * ⚠⚠ DUES ARE NOT BUDGET LINES, AND THAT IS THE WHOLE REASON THIS MODULE EXISTS. What a season
 * plans to collect in dues is its INSTALMENT SCHEDULE, set on Player Dues — never a row in the
 * budget planner. The Months view already plots those instalments as dated events in its revenue
 * band; the Statement's rollup groups by category + item and has no home for them, so the report
 * counted every cost and left out the largest money coming in. One report answered "what is
 * revenue?" two ways, $11,308.30 apart on the UAT team, with nothing on either screen saying why.
 *
 * ⚠ THE FIX IS A SYNTHETIC CATEGORY, NOT A SYNTHETIC BUDGET LINE. Feeding a fabricated line into
 * the rollup would double-count the moment anyone totals the planner — the plan says so by name.
 * What is built here is a `CategoryRow` carrying the SAME key the Months revenue band already uses
 * for its dues group (`revenue:dues`), assembled after the rollup and injected into the report. It
 * reaches the database in no form at all.
 *
 * ⚠ AND IT CARRIES NO ITEMS, deliberately. The export walks a category and then its items; a lone
 * item repeating its own category's name would print the row twice. It also means there is nothing
 * behind the figures to open, which is why the screen renders this row itself rather than through
 * the ordinary group — an empty drill-in panel is the exact defect `slimCategory` caused two days
 * before this was written.
 */
/* ⚠ THE `.ts` EXTENSION IS LOAD-BEARING, not a slip. This module is imported by
   `scripts/check-money-report-arithmetic.mjs`, which node loads directly — and node resolves a
   relative specifier literally, so an extensionless one that the bundler is happy with fails the
   guard at startup. `allowImportingTsExtensions` is on for exactly this, and
   `coach-budget-months.ts` imports its own dependency the same way for the same reason. */
import type { CategoryRow } from './coach-budget-rollup.ts';
import { revenueCategoryId, revenueGroupLabel } from './coach-budget-months.ts';

/** Money to the cent, the way every money module in this repo rounds. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The half-cent deadband every money comparison on this report uses. A rounding tail must never
 * render as a gap a coach can see is not there.
 */
const EPSILON = 0.005;

/**
 * The dues row's identity, shared with the Months band.
 *
 * ⚠ ONE KEY FOR BOTH VIEWS, ON PURPOSE. The Statement's dues row and the Months view's dues group
 * are the same object read two ways; keying them separately is how two views of one report start
 * disagreeing about what a thing is called. `check:money-report` holds their budgeted figures equal
 * and can only address them by this key.
 */
export const DUES_CATEGORY_ID = revenueCategoryId('dues');

/** Is this the synthetic dues row rather than a real budget category? */
export function isDuesCategory(categoryId: string | null | undefined): boolean {
  return (categoryId ?? '').replace(/^id:/, '') === DUES_CATEGORY_ID;
}

/**
 * Everything the dues row and the sentence beneath the table are built from.
 *
 * ⚠ THE FIGURES ARE READ FROM THE STREAMS THAT FEED MONTHS, never re-derived. `billed` is the sum
 * of the dues events already built for the Months revenue band, and `actual` is the sum of that
 * band's own dues arrivals — so "Total revenue equals Months to the cent" is true by construction
 * rather than by two derivations happening to agree.
 */
export interface DuesRevenue {
  /**
   * Σ the dues INSTALMENTS — what families are actually billed, and the figure the Months view
   * plots. **Null means no schedule exists at all**, which is a different fact from zero: a
   * schedule of nothing has never been set up, and a coach acts on those differently.
   *
   * ⚠ NEVER THE PLAN RESIDUAL (owner ruling). Showing what the plan *needs* from families as
   * revenue would report money nobody has been asked for; the gap between the two is the finding
   * this whole change exists to surface.
   *
   * ⚠⚠ AND IT IS NET OF WHAT HAS BEEN WRITTEN OFF (owner ruling 2026-09-09 — "a bill lowered is not
   * a collection"). A forgiven bill is not still planned: leaving it here made the report plan
   * revenue the coach had themselves cancelled, so a $500 bill written off left the season reading
   * $500 behind for the rest of the year. The netting happens on the INSTALMENT EVENTS this is
   * summed from, in the month holding the bill that was cancelled — never on this figure alone,
   * which is what would break the guard holding this row equal to the Months view.
   */
  billed: number | null;
  /**
   * Σ the dues instalments **due on or before today** — what the row shows under the **To date**
   * basis (owner ruling 2026-09-04).
   *
   * ⚠ THIS BUILD DOES NOT DATE DUES, AND DOES NOT NEED TO. Dues are not budget lines, so the
   * "when does this money move?" question never reaches them — but every instalment already
   * carries a due date, which makes this the ONE revenue row that can answer a to-date question
   * honestly. Without it the whole revenue band would read $0.00 under To date on a season whose
   * families are being billed on schedule.
   *
   * ⚠ ZERO IS A REAL ANSWER HERE, unlike `billed`. A season whose first instalment falls next
   * month has genuinely asked families for nothing yet, and a coach reading "+$3,075.00" against
   * it is being told something true and useful: families have paid ahead. Null still means no
   * schedule exists at all.
   */
  billedToDate: number | null;
  /**
   * What families have CONTRIBUTED to their dues (owner rulings R2–R4, 2026-09-07).
   *
   * ⚠⚠ NO LONGER THE MONTHS BAND'S DUES ACTUAL, AND THE DIVERGENCE IS THE POINT. This was the cash
   * strip's dues arrivals, which made the Statement count a family-paid cost as SPENDING while
   * counting the credit that settled their dues as revenue NOWHERE — $1,379.98 on the UAT fixture,
   * tying to the cent against the reimbursement credits issued. Cash is untouched and still right:
   * it answers what arrived in the account, which is a different and equally true number. The
   * two-truths note under the Months view now says so on both halves.
   */
  actual: number;
  /**
   * The three things `actual` is made of, for the panel behind the figure.
   *
   * ⚠ THEY SUM TO `actual`, AND A COACH CAN SEE THAT THEY DO. Money handed back is in none of them
   * — it is not a fourth line to subtract, it is simply absent, which is what lets three lines
   * reach the total instead of four lines nearly reaching it. See `lib/coach-dues-actual.ts`.
   */
  actualParts: {
    cashKept: number;
    familyPaidCosts: number;
    fundraisingCredited: number;
  };
  /**
   * What the plan needs from families: the effective plan less expected funding, **floored at
   * zero** — the shared derivation (`computeBudgetTotals().fundedByPlayers`) the Budget plan page
   * and the Money hub both read. This build does not touch it.
   */
  planNeeds: number;
  /**
   * ⚠⚠ TRUE WHEN THE FLOOR ACTUALLY BIT — a season whose fundraising and sponsorship exceed the
   * whole plan. It is the one state where the sentence's proof stops being true, so it is carried
   * as a fact rather than re-derived by each reader from figures that no longer say it. See
   * `duesSentenceRenders`.
   */
  planNeedsFloored: boolean;
  /** How many families have a schedule — the row's caption, and nothing else. */
  familyCount: number;
  /**
   * Σ the dues SCHEDULE TOTALS — the **Budget plan page's** own source for the same question.
   *
   * ⚠ IT IS HERE TO BE COMPARED, NOT TO BE SHOWN. Two screens answer "what do dues bill?" from two
   * columns: this report sums the instalments a schedule was broken into, the plan page sums the
   * schedule totals. They are the same number whenever a schedule's instalments add up to its own
   * total, and nothing in the database forces that. The owner ruled the instalments win here; this
   * field exists so `check:money-report` can prove the two have not parted, because a drift is a
   * real defect worth finding rather than a difference worth papering over.
   */
  assessed: number;
  /**
   * WHAT HAS BEEN WRITTEN OFF THE BILLS this season — a forgiven balance or a typed adjustment,
   * counted where it actually cancelled a bill (owner ruling 2026-09-09). `0` on most seasons.
   *
   * ⚠⚠ IT IS THE BRIDGE BETWEEN `billed` AND `assessed`, AND THAT IS ITS FIRST JOB. `billed` is now
   * net of it and `assessed` is still the gross schedule total, so the two are equal only once this
   * is added back — which is exactly what `check:money-report` asserts. Without this field the
   * guard would fire on every team that has ever forgiven a dollar, and the real defect it exists
   * to catch (a schedule whose instalments no longer add up to it) would be lost in the noise.
   *
   * ⚠ ITS SECOND JOB IS THE FOOTNOTE. The report says when its plan side is net, and names the
   * kinds present — the same sentence the dues band's own caption makes, so one season is never
   * described two ways.
   */
  writtenOff: number;
  /** Which kinds are behind `writtenOff`, so the footnote can name them (R5). */
  writtenOffKinds: { forgiven: boolean; adjustment: boolean };
}

/**
 * Does the Player dues row render at all?
 *
 * ⚠ THE RULE IS "OR", AND THE SECOND HALF IS THE ONE THAT MATTERS. Every team is in the second
 * state on day one: costs in the budget, no dues schedule. A `$0.00` dues row would read "nothing
 * owed" when the truth is "not set yet" — so that team gets the row with an em-dash and a door, and
 * a team whose other income covers the whole plan gets no row, because asking families for nothing
 * is not a problem to nag about.
 */
export function duesRowRenders(d: DuesRevenue): boolean {
  return d.billed !== null || d.planNeeds > EPSILON;
}

/**
 * Does the sentence under the table render?
 *
 * ⚠⚠ THE ROW AND THE SENTENCE PART COMPANY IN EXACTLY ONE STATE, and it is the state the approved
 * mockups did not draw: a season whose other income exceeds the whole plan **and which has a dues
 * schedule anyway**. The row must still render — those are real dollars, and dropping them would
 * break the identity with Months that this change exists to create — but `planNeeds` has floored at
 * zero, so `planNeeds − billed` is no longer the budgeted Season net and the sentence's claim would
 * simply be false.
 *
 * The sentence says nothing rather than saying something wrong. It exists to explain a shortfall;
 * with no shortfall to explain, the row speaks for itself. `check:money-report` asserts the
 * suppression rather than trusting it, so this cannot regress into a proof printed on screen that
 * does not hold.
 */
export function duesSentenceRenders(d: DuesRevenue): boolean {
  return duesRowRenders(d) && !d.planNeedsFloored;
}

/** Which of the four approved sentences this season gets. */
export type DuesFundingState = 'unset' | 'short' | 'buffer' | 'covered';

export function duesFundingState(d: DuesRevenue): DuesFundingState {
  if (d.billed === null) return 'unset';
  const gap = r2(d.planNeeds - d.billed);
  if (gap > EPSILON) return 'short';
  if (gap < -EPSILON) return 'buffer';
  return 'covered';
}

/**
 * The gap the sentence names, POSITIVE either way — the words carry the direction ("short" /
 * "buffer"), exactly as the Budget plan page's own closing pair does.
 *
 * ⚠ AND IT IS THE BUDGETED SEASON NET WITH THE SIGN FLIPPED, always, which is why the row that used
 * to print it separately was deleted. With D = dues billed, F = other income budgeted and E = the
 * effective plan: plan needs = E − F, so the gap is (E − F) − D, and the budgeted season net is
 * (D + F) − E — the same figure negated. The sentence claims this out loud, so
 * `check:money-report` proves it on every run.
 */
export function duesGap(d: DuesRevenue): number {
  return r2(d.planNeeds - (d.billed ?? 0));
}

/**
 * The synthetic revenue category the report is given.
 *
 * ⚠ `inPlan` IS "IS THERE A DUES SCHEDULE", which is the honest reading of the flag on this row:
 * every other row uses it for "did anyone budget this?", and a dues schedule is the only plan a
 * dues row can have. It is what makes the file write a blank rather than a `0` in the Budgeted
 * column — the same reason the screen shows an em-dash.
 */
export function buildDuesCategory(d: DuesRevenue): CategoryRow {
  const budgeted = d.billed ?? 0;
  return {
    categoryId: DUES_CATEGORY_ID,
    categoryName: revenueGroupLabel('dues', 'actual'),
    direction: 'in',
    budgeted,
    actual: d.actual,
    // Good-news-positive on the income side (rollup rule 6): more in than planned is the good news.
    variance: r2(d.actual - budgeted),
    inPlan: d.billed !== null,
    items: [],
  };
}
