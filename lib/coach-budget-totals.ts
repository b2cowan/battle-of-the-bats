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
export type BudgetLineKind = 'cost' | 'funding' | 'sponsorship';

export const BUDGET_LINE_KINDS: BudgetLineKind[] = ['cost', 'funding', 'sponsorship'];

/**
 * The two money-IN kinds, for any reader that must treat them together.
 *
 * ⚠ THEY DIFFER ONLY IN REPORTING. Both subtract from what the season costs, identically, so
 * per-player dues and the installment generator must count BOTH or silently under-count what
 * families are being asked for. Anywhere that used to test `kind === 'funding'` to mean "money in"
 * is a place this list belongs instead.
 */
export const FUNDING_LINE_KINDS: BudgetLineKind[] = ['funding', 'sponsorship'];
export function isFundingKind(kind: string | null | undefined): boolean {
  return kind === 'funding' || kind === 'sponsorship';
}

/**
 * A raw `line_kind` from the database, narrowed — the ONE place that decision is made.
 *
 * ⚠ THIS EXISTS BECAUSE THE OBVIOUS SHORTHAND IS DANGEROUS. Nineteen readers were written as
 * `row.line_kind === 'funding' ? 'funding' : 'cost'`, which was correct while there were exactly
 * two kinds and became silently wrong the moment `sponsorship` existed: it lands every sponsorship
 * line in the COST bucket, so instead of reducing what families fund it would ADD to it and
 * inflate every player's dues. TypeScript cannot see it — both sides are strings. Anything
 * reading the column goes through here.
 */
export function normalizeBudgetLineKind(raw: string | null | undefined): BudgetLineKind {
  return raw === 'funding' || raw === 'sponsorship' ? raw : 'cost';
}

/** Coach-facing names. `funding` is deliberately "expected FUNDRAISING", never "income" and no
 *  longer "funding" (owner ruling 2026-08-13: player dues are also funding, so the generic word
 *  made the section read as if dues belonged in it). It USED to cover sponsors and grants too —
 *  which is exactly why `sponsorship` was split out on 2026-08-15: a plan that folded them
 *  together could not answer "did our sponsorship hit the number?", because sponsorship money was
 *  in every budget invisibly. Both stay "expected": nothing has arrived, and Budget vs. Actual is
 *  where expectation meets what was really raised. */
export const LINE_KIND_LABEL: Record<BudgetLineKind, string> = {
  cost:        'A cost',
  funding:     'Expected fundraising',
  sponsorship: 'Expected sponsorship',
};

export const LINE_KIND_HINT: Record<BudgetLineKind, string> = {
  cost:        'Money the team spends',
  funding:     'Money the team raises',
  sponsorship: 'A sponsor or grant, given directly',
};

/**
 * Where a line's ACTUAL comes from (mig 243).
 *
 * ⚠ AN EXHAUSTIVE NAMED RECORD, NOT A COMPARISON, and the difference is enforced. `kind ===
 * 'sponsorship' ? 'sponsor' : 'fundraiser'` is the exact shape `budget-line-kind-guard` bans: a
 * fourth kind would fall silently into the else branch, where this makes it a compile error.
 *
 * `typed` = a coach records the actual themselves (every cost, and every income row the fundraiser
 * machinery does not already answer for). The other two are DERIVED — fundraisers and sponsors
 * report their own realised figures and player rebates are computed from them, so a typed record
 * on the same row would count the same dollar twice. See lib/coach-money-derived.ts.
 */
export const LINE_KIND_ACTUAL_SOURCE: Record<BudgetLineKind, 'typed' | 'fundraiser' | 'sponsor'> = {
  cost:        'typed',
  funding:     'fundraiser',
  sponsorship: 'sponsor',
};

/** The heading its section carries — in the plan list, in the summary ladder, in the period grid
 *  and in Budget vs. Actual. ONE definition: four hardcoded copies of "Expected fundraising" is
 *  four places to miss on a rename. */
export const LINE_KIND_SECTION: Record<BudgetLineKind, string> = {
  cost:        'Costs',
  funding:     'Expected fundraising',
  sponsorship: 'Expected sponsorship',
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
    // ⚠ BOTH money-in kinds subtract, identically — sponsorship differs from fundraising only in
    // reporting, so testing for 'funding' alone would count a sponsor's money as a COST and
    // inflate every player's dues by its amount (2026-08-15).
    if (isFundingKind(line.lineKind)) {
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

/* ────────────────────────────────────────────────────────────────────────────────────────────
   WHERE AN INSTALLMENT AMOUNT COMES FROM (owner ruling 2026-08-13)

   The Generate Player Installments sheet offers three answers, and the first two are the same
   subtraction against two different tops: what the coach ITEMIZED, and what they ESTIMATED.

   ⚠ EXPECTED FUNDING COMES OFF BOTH. Budgeting a fundraiser exists precisely so dues come down by
   it, so "split the estimate" is deliberately NOT estimate ÷ roster — each card on screen prints
   its own arithmetic rather than leaving that to be inferred.

   ⚠ This is NOT `totalPlanned`. That figure answers "what is this season's headline number" and
   the estimate wins it whenever one is set (see the ruling above). Here the coach is choosing
   BETWEEN the two tops, so both must stay separately addressable — collapsing them back onto
   `totalPlanned` would make two of the three choices produce the same schedule.
   ──────────────────────────────────────────────────────────────────────────────────────────── */

/** Which of the three answers the sheet is currently using. */
export type InstallmentBasis = 'budget' | 'estimate' | 'manual';

export interface BasisOption {
  /** What players fund on this basis. Null when the basis has no number to offer at all. */
  amount: number | null;
  /** amount ÷ roster, or null when either half is missing. */
  perPlayer: number | null;
  /**
   * Why this basis cannot be used, in the coach's words — null when it can.
   *
   * ⚠ A basis is never offered as "$0.00". Three real states arrive here (no lines yet, funding
   * covering everything, an estimate of zero) and each used to be a DEAD END for the whole sheet;
   * they are now reasons attached to one option while the others stay live.
   */
  unavailable: string | null;
}

export interface InstallmentBases {
  budget: BasisOption;
  estimate: BasisOption;
}

function basisOption(
  amount: number | null,
  rosterCount: number,
  unavailable: string | null,
): BasisOption {
  return {
    amount,
    perPlayer: unavailable === null && amount != null && rosterCount > 0 ? r2(amount / rosterCount) : null,
    unavailable,
  };
}

/** The two even-split bases, each either usable or carrying the reason it is not. */
export function describeInstallmentBases(totals: BudgetTotals): InstallmentBases {
  const { itemized, costLineCount, expectedFunding, estimatedTotal, rosterCount } = totals;

  const budgetAmount = r2(Math.max(0, itemized - expectedFunding));
  const budgetWhyNot =
    costLineCount === 0
      ? 'No cost lines yet — add what the season costs and this splits it for you.'
      : budgetAmount <= 0
        ? 'Your expected fundraising already covers every line item.'
        : null;

  const estimateAmount = estimatedTotal == null ? null : r2(Math.max(0, estimatedTotal - expectedFunding));
  const estimateWhyNot =
    estimatedTotal == null
      ? 'No season estimate set — add one on the Budget Plan to split against it.'
      : estimatedTotal <= 0
        ? 'Your season estimate is $0.'
        : (estimateAmount ?? 0) <= 0
          ? 'Your expected fundraising already covers the estimate.'
          : null;

  return {
    budget:   basisOption(budgetAmount, rosterCount, budgetWhyNot),
    estimate: basisOption(estimateAmount, rosterCount, estimateWhyNot),
  };
}

/**
 * One player's total, cut into `count` dated chunks that re-add to exactly the whole.
 *
 * $680 over three dates is 226.67 / 226.67 / 226.66 — the odd cents ride on the EARLIEST chunks, so
 * the last payment is never the largest and the parts always sum back to the total.
 *
 * ⚠ WORKS IN WHOLE CENTS, and that is the point. The obvious version — round the quotient, then let
 * the last chunk absorb `total − base × (count−1)` — produces a NEGATIVE final installment whenever
 * the per-chunk rounding goes up: six cents over twelve dates rounds each chunk to $0.01, spends
 * $0.11 across the first eleven, and hands the twelfth **−$0.05**. That number then reached a
 * family's dues through a preview table whose money formatter prints absolute values, so it
 * displayed as a perfectly ordinary "$0.05" while the write endpoint refused the whole schedule on
 * `amount > 0`. Flooring and handing out the remainder a cent at a time cannot do that: every chunk
 * is `floor` or `floor + 1`, so nothing is ever negative and nothing is ever more than a cent off
 * its neighbours.
 *
 * Chunks CAN still be zero when there is less than one cent per date to give (six cents over twelve
 * dates is six cents and six nothings). That is a real refusal, not a rounding artefact, and the
 * preview endpoint rejects it by name rather than letting the write path fail generically.
 *
 * Shared because the sheet fills its own boxes from this while the preview endpoint builds the
 * table from it, and a coach who saw one number in the form and another in the preview is the exact
 * defect this whole change exists to close.
 */
export function splitPerPlayer(perPlayer: number, count: number): number[] {
  if (count < 1) return [];
  const totalCents = Math.round(perPlayer * 100);
  const base  = Math.floor(totalCents / count);
  const extra = totalCents - base * count;   // 0 … count-1 spare cents
  return Array.from({ length: count }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}
