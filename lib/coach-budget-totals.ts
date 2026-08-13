/**
 * What a team's budget ADDS UP TO — the single arithmetic every Money surface quotes.
 *
 * A coach's plan can carry three inputs: itemized cost lines, an optional **estimated total**
 * (a planning number set before everything is known), and expected-funding lines (fundraising,
 * sponsorship, a grant). Those are not three independent statistics, they are one sum worked
 * downward, and the summary ladder on the Budget Plan page renders exactly these fields in
 * exactly this order:
 *
 *     line items
 *   + the part of the estimate not itemized yet   (calculated, never typed)
 *   = total planned budget
 *   − expected funding
 *   = funded by players
 *   ÷ active roster
 *   = per player
 *
 * ⚠ THE EFFECTIVE-TOTAL RULE CHANGED 2026-08-12 (owner ruling). It used to be
 * `max(itemized, estimate)`, which meant an estimate set BELOW the lines was stored and then
 * silently ignored by every display — a typed number that does nothing is worse than a refused
 * one. It is now **the estimate whenever one is set**, in both directions: the number you set is
 * the number that counts. Over-planning is surfaced instead, as a negative difference the page
 * draws in red, and it flows honestly into per player and the installment suggestion.
 *
 * This module exists so that rule lives in ONE place. The planner, the Money hub summary and the
 * Budget vs. Actual report all reconcile the same two numbers, and when they each did it inline
 * they were one edit away from disagreeing on the same screen.
 *
 * Pure: no IO, no React, no rounding surprises (every returned figure is already 2-dp rounded).
 */

/** The kind of thing a budget line is. Stored on the line; the amount is always positive and the
 *  kind carries the sign (migration 230). */
export type BudgetLineKind = 'cost' | 'funding';

export const BUDGET_LINE_KINDS: BudgetLineKind[] = ['cost', 'funding'];

/** Coach-facing names. `funding` is deliberately "expected funding", never "income" — nothing has
 *  arrived, and Budget vs. Actual is where expectation meets what was really raised. */
export const LINE_KIND_LABEL: Record<BudgetLineKind, string> = {
  cost:    'A cost',
  funding: 'Expected funding',
};

export const LINE_KIND_HINT: Record<BudgetLineKind, string> = {
  cost:    'Money the team spends',
  funding: 'Money coming in',
};

/** The heading its section carries — in the plan list, in the summary ladder, in the period grid
 *  and in Budget vs. Actual. ONE definition: four hardcoded copies of "Expected funding" is four
 *  places to miss on a rename. */
export const LINE_KIND_SECTION: Record<BudgetLineKind, string> = {
  cost:    'Costs',
  funding: 'Expected funding',
};

/** Anything with an amount and a kind — the plan's line shape, narrowed to what the maths needs,
 *  so callers can pass their own richer rows without a mapping step. */
export interface AmountLine {
  totalAmount: number;
  lineKind?: BudgetLineKind | null;
}

export interface BudgetTotalsInput {
  lines: AmountLine[];
  /** `rep_program_years.budget_amount` — the optional estimated total. Null = not set. */
  estimatedTotal: number | null;
  /** Active roster count. Zero (or absent) means per player cannot be stated. */
  rosterCount?: number;
}

export interface BudgetTotals {
  /** Σ cost lines. The "line items" row. */
  itemized: number;
  /** How many cost lines that sum came from — the ladder captions the row with it. */
  costLineCount: number;
  /** Σ funding lines, POSITIVE. The ladder shows it negated; nothing stores a negative. */
  expectedFunding: number;
  fundingLineCount: number;
  /** The estimate, echoed back so a caller never has to carry it separately. */
  estimatedTotal: number | null;
  /** estimate − itemized. Positive = still to itemize. Negative = the lines have outgrown the
   *  estimate. Zero when no estimate is set (there is nothing to differ from). */
  difference: number;
  /** Is there an estimate, and does it differ from the lines? Drives whether the ladder renders
   *  the difference row at all — a row that would read "$0.00" says nothing. */
  hasDifference: boolean;
  /** True when the lines exceed the estimate: the one state drawn in red. */
  overPlanned: boolean;
  /** THE headline: the estimate when one is set, else the itemized sum. */
  totalPlanned: number;
  /** What dues have to cover. Never below zero — funding above the whole plan would otherwise
   *  produce a negative per player, and "we owe the players money" is not a dues schedule. */
  fundedByPlayers: number;
  rosterCount: number;
  /**
   * fundedByPlayers ÷ roster — or null when there is nothing to state: no roster to divide by, or
   * nothing planned at all.
   *
   * ⚠ Null-ness is decided HERE and nowhere else. The Money hub used to add its own extra
   * condition on top, so a team that had entered only an expected-funding line got "$0.00 per
   * player" on the budget page and no figure at all on the hub — the same data, two answers, which
   * is the drift this module exists to prevent. A planned season that funding covers entirely is
   * different: that really is $0.00 per player, and both surfaces say so.
   */
  perPlayer: number | null;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeBudgetTotals({
  lines, estimatedTotal, rosterCount = 0,
}: BudgetTotalsInput): BudgetTotals {
  let itemized = 0;
  let costLineCount = 0;
  let expectedFunding = 0;
  let fundingLineCount = 0;

  for (const line of lines) {
    // A line with no kind is a cost: every row written before migration 230 is one, and the
    // column defaults to 'cost' for the same reason.
    if (line.lineKind === 'funding') {
      expectedFunding += line.totalAmount;
      fundingLineCount += 1;
    } else {
      itemized += line.totalAmount;
      costLineCount += 1;
    }
  }

  itemized = r2(itemized);
  expectedFunding = r2(expectedFunding);

  const hasEstimate = estimatedTotal != null;
  const difference = hasEstimate ? r2(estimatedTotal - itemized) : 0;
  // ±half a cent, so a rounding tail never renders a row that reads "$0.00" beside two numbers
  // the coach can see are equal.
  const hasDifference = hasEstimate && Math.abs(difference) >= 0.005;

  const totalPlanned = hasEstimate ? r2(estimatedTotal) : itemized;
  const fundedByPlayers = r2(Math.max(0, totalPlanned - expectedFunding));

  return {
    itemized,
    costLineCount,
    expectedFunding,
    fundingLineCount,
    estimatedTotal: hasEstimate ? r2(estimatedTotal) : null,
    difference,
    hasDifference,
    overPlanned: hasDifference && difference < 0,
    totalPlanned,
    fundedByPlayers,
    rosterCount,
    perPlayer: rosterCount > 0 && totalPlanned > 0 ? r2(fundedByPlayers / rosterCount) : null,
  };
}
