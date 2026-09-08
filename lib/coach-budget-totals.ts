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
 *  kind carries the sign (migration 230). `other_income` (mig 274, owner Q5 2026-09-02) is money
 *  in that is neither raised nor sponsored — interest, a facility rebate, a plain donation. */
export type BudgetLineKind = 'cost' | 'funding' | 'sponsorship' | 'other_income';

export const BUDGET_LINE_KINDS: BudgetLineKind[] = ['cost', 'funding', 'sponsorship', 'other_income'];

/**
 * The money-IN kinds, for any reader that must treat them together.
 *
 * ⚠ THEY DIFFER ONLY IN REPORTING. All subtract from what the season costs, identically, so
 * per-player dues and the installment generator must count EVERY one or silently under-count what
 * families are being asked for. Anywhere that used to test `kind === 'funding'` to mean "money in"
 * is a place this list belongs instead.
 *
 * ⚠⚠ THE ARRAY DRIVES NOTHING BY ITSELF (adversarial-review finding, 2026-09-02). `isFundingKind`
 * and `normalizeBudgetLineKind` below are hardcoded literal comparisons — the ONE sanctioned home
 * for that shape — and each must be edited BY NAME when a kind is added. `other_income` was added
 * to all three together; a kind in this list that `normalizeBudgetLineKind` has not been taught
 * defaults to 'cost', which silently counts the new income as SPENDING and inflates what families
 * are asked to fund. The unit suite pins all three in step.
 */
export const FUNDING_LINE_KINDS: BudgetLineKind[] = ['funding', 'sponsorship', 'other_income'];
export function isFundingKind(kind: string | null | undefined): boolean {
  return kind === 'funding' || kind === 'sponsorship' || kind === 'other_income';
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
  return raw === 'funding' || raw === 'sponsorship' || raw === 'other_income' ? raw : 'cost';
}

/* ⚰ `LINE_KIND_LABEL` AND `LINE_KIND_HINT` ARE DELETED (mig 280, plan §3.4).
   They were the four answers to "This line is…" — Expense / Expected fundraising / Expected
   sponsorship / Expected other income — and the one-line hint under each. That question is gone:
   the form asks which way the money goes and the ITEM decides the rest, so nothing renders a
   per-kind label a coach CHOOSES any more.

   ⚠ THE WORDS THEMSELVES SURVIVE, IN `LINE_KIND_SECTION` BELOW. They are still what the plan list,
   the summary ladder, the period grid, Budget vs. Actual and the exports CALL those shelves — they
   simply stopped being something a coach picks. Do not reinstate a second copy here: four hardcoded
   spellings of "Expected fundraising" is exactly what the section record exists to prevent. */

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
export const LINE_KIND_ACTUAL_SOURCE: Record<BudgetLineKind, BudgetItemActualSource> = {
  cost:         'typed',
  funding:      'fundraiser',
  sponsorship:  'sponsor',
  // No machinery answers for other income — the coach records each arrival themselves, exactly
  // like a cost's actuals (mig 274). The one money-in kind on the typed path.
  other_income: 'typed',
};

/**
 * WHERE A BUDGET ITEM'S ACTUAL COMES FROM — the same three answers, declared on the WORD (mig 280).
 *
 * ⚠ DECLARED HERE, NOT IN `lib/types.ts`, and the reason is an import edge: `types.ts` imports
 * `BudgetLineKind` FROM this module, so a type this module needs cannot live over there without
 * making a cycle. `BudgetItem.actualSource` takes it from here, exactly as `RepBudgetLine.lineKind`
 * already does.
 */
export type BudgetItemActualSource = 'typed' | 'fundraiser' | 'sponsor';

/**
 * ⚠⚠ THE INVERSE OF `LINE_KIND_ACTUAL_SOURCE`, RESTRICTED TO THE MONEY-IN KINDS — and the two are
 * pinned in step by the unit suite rather than by anybody remembering.
 *
 * This is what lets the add-a-line form ask ONE question (mig 280, plan §3.1). The coach says which
 * way the money goes; the ITEM they pick says who reports its actual; the stored kind falls out of
 * the two. The impossible pairing the old two-question form allowed — *Expected sponsorship* with
 * *Tournaments → Concession revenue*, a row whose actual is sought in sponsor cheques that will
 * never contain concession money — cannot be expressed any more, because there is nothing left for
 * the second answer to contradict.
 *
 * ⚠ WRITTEN OUT RATHER THAN COMPUTED, deliberately. `Object.fromEntries(FUNDING_LINE_KINDS.map(…))`
 * would build it in one line and SILENTLY DROP one of any two kinds that declared the same source —
 * a fifth money-in kind on the typed path would take `other_income`'s place and every "you record
 * it" line would quietly start storing the wrong kind. Named and exhaustive, a new source is a
 * compile error and a colliding kind is a test failure.
 */
export const MONEY_IN_KIND_BY_ACTUAL_SOURCE: Record<BudgetItemActualSource, BudgetLineKind> = {
  typed:      'other_income',
  fundraiser: 'funding',
  sponsor:    'sponsorship',
};

/**
 * The kind a budget line gets, FROM THE WORD IT IS FILED AGAINST. THE one derivation: the form, the
 * create door and the edit door all go through it, so no two of them can disagree about a row.
 *
 * ⚠ THE DIRECTION IS ASKED FIRST AND WINS. A money-out word is always a cost, whatever its source
 * says — which makes the database's `direction = 'in' or actual_source = 'typed'` constraint a belt
 * rather than a load-bearing part, and means no stale row can ever derive a money-in kind onto a
 * spending line.
 *
 * ⚠ `direction` IS TYPED INLINE rather than as `BudgetItemDirection` for the import-edge reason
 * above — the union is identical, and `types.ts` cannot be imported from here.
 */
export function budgetLineKindForItem(
  item: { direction: 'in' | 'out'; actualSource: BudgetItemActualSource },
): BudgetLineKind {
  if (item.direction !== 'in') return 'cost';
  const kind = MONEY_IN_KIND_BY_ACTUAL_SOURCE[item.actualSource];
  /* ⚠⚠ IT THROWS RATHER THAN RETURNING `undefined`, and the difference is a family's dues
     (`/review`, correctness lens, 2026-09-07). A source this map has never heard of — a fifth value
     added to the database CHECK without a matching entry here — indexes to `undefined`, which
     `JSON.stringify` DROPS from the write payload; Postgres then substitutes the column's own
     default and the row is stored as a COST. Money coming in, filed as spending, silently, with
     every family asked for that much more. A loud failure on a developer's own mistake is the
     cheaper of the two. */
  if (!kind) {
    throw new Error(
      `budgetLineKindForItem: no line kind is declared for actual_source "${item.actualSource}". `
      + 'Add it to MONEY_IN_KIND_BY_ACTUAL_SOURCE — a money-in word with no kind would be stored '
      + 'as a cost and inflate what every family is asked to pay.',
    );
  }
  return kind;
}

/**
 * The money-in kinds whose actuals are DERIVED — the lines that CLOSE a row to typed income
 * records (lib/coach-money-derived.ts: one row, one source). ⚠ COMPUTED from the exhaustive
 * record above, never listed by hand: an `other_income` line takes typed arrivals, so putting it
 * in this set would refuse the coach the only way its money can be recorded at all — and a fifth
 * kind lands here correctly by nothing more than its declared source.
 */
export const DERIVED_INCOME_LINE_KINDS: BudgetLineKind[] =
  FUNDING_LINE_KINDS.filter(k => LINE_KIND_ACTUAL_SOURCE[k] !== 'typed');

/** The heading its section carries — in the plan list, in the period grid and in both exports.
 *  ONE definition: four hardcoded copies of a section name is four places to miss on a rename.
 *
 *  ⚠ BARE NOUNS, NO "EXPECTED" (owner ruling 2026-09-08, mockup e94d05d9 round 2). The kind rows
 *  sit under a band that already says FUNDING, and the cost categories beside them never carried a
 *  prefix. "Expected" implied a distinction — money in is less certain than money out — that the
 *  plan does nothing with; every figure on the screen is planned. The one qualifier lives on the
 *  subtotals, and it is the same on both sides: see `PLAN_LADDER_LABEL`. */
export const LINE_KIND_SECTION: Record<BudgetLineKind, string> = {
  cost:         'Costs',
  funding:      'Fundraising',
  sponsorship:  'Sponsorship',
  other_income: 'Other income',
};

/**
 * Every label the plan's LADDER prints — the List, the By-period grid, both exports and the tiles
 * read these and nothing else, so the words cannot fork (owner ruling 2026-09-08).
 *
 * THE RULE: the three tiles above the table are the table's three subtotals, with the same names
 * verbatim — Planned costs · Planned funding · Player installments. The tiles are the headline of
 * the table, not a second summary. `costsLessFunding` is the grid's existing closing label, reused
 * in the list; `shortOfPlan` / `buffer` are the close both surfaces already printed. "Expected" is
 * deliberately absent from every value here — see `LINE_KIND_SECTION`.
 */
export const PLAN_LADDER_LABEL = {
  costsBand:             'Costs',
  fundingBand:           'Funding',
  plannedCosts:          'Planned costs',
  plannedFunding:        'Planned funding',
  /* Under the When filter the List is a SLICE, and a slice may not borrow the tile's name — one
     name, one number (the rule the By-period grid has carried since 2026-08-13). These close the
     two bands over a filtered list; they never reach an export, which always carries the whole
     plan (/review, 2026-09-08). */
  costsShown:            'Costs shown',
  fundingShown:          'Funding shown',
  costsLessFunding:      'Costs less funding',
  costsLessFundingNote:  'What player installments need to cover',
  installments:          'Player installments',
  installmentsEstimated: 'Player installments (estimated)',
  shortOfPlan:           'Short of covering the plan',
  buffer:                'Planned buffer',
  linesSoFar:            'Lines so far',
  stillToItemize:        'Still to itemize',
  overEstimate:          'Over your estimate',
} as const;

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

   The Set-dues-for-all-players sheet offers three answers, and the first two are the same
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
  // "Expected funding", not "expected fundraising": `expectedFunding` aggregates EVERY money-in
  // kind (sponsorship since 237, other income since 274), and the aggregate word must cover them
  // all — the per-kind section headings keep their own names (owner Q5 copy check, 2026-09-02).
  const budgetWhyNot =
    costLineCount === 0
      ? 'No cost lines yet — add what the season costs and this splits it for you.'
      : budgetAmount <= 0
        ? 'Your expected funding already covers every line item.'
        : null;

  const estimateAmount = estimatedTotal == null ? null : r2(Math.max(0, estimatedTotal - expectedFunding));
  const estimateWhyNot =
    estimatedTotal == null
      ? 'No season estimate set — add one on the Budget Plan to split against it.'
      : estimatedTotal <= 0
        ? 'Your season estimate is $0.'
        : (estimateAmount ?? 0) <= 0
          ? 'Your expected funding already covers the estimate.'
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
/**
 * ⚖ IS THIS GAP ANYTHING BUT ROUNDING? (owner, 2026-09-02.)
 *
 * Dividing a budget by a roster almost never lands on a whole cent: $5,100 across 7 players is
 * $728.5714…, which stores as $728.57 and collects $5,099.99. The sheet used to call that
 * "$0.01 short of what players need to fund" — a true sentence about an untrue problem, and the
 * commonest thing a coach sees on this screen.
 *
 * ⚠ THE TEST IS REACHABILITY, NOT SIZE, and that is what makes it safe to be quiet. A coach can
 * only move a per-player amount in whole cents, and one cent per player moves the roster total by
 * `rosterCount` cents. So a gap smaller than that is not a shortfall they are ignoring — it is a
 * shortfall no schedule they could type could close. Anything they CAN act on still speaks.
 *
 * ⚠ SYMMETRIC, DELIBERATELY. The residue falls both ways — $8,000 across 12 players collects
 * $8,000.04 — so a one-sided rule would silence the short case and leave a four-cent "buffer"
 * announcing itself on the next roster.
 *
 * ⚠⚠ AND IT IS THE **MESSAGE** THAT MOVES, NEVER THE MONEY. Two fixes look tempting here and both
 * are worse than the sentence they remove:
 *   • Adding a penny to each installment overshoots — $728.58 × 7 collects six cents OVER to cure
 *     one cent short, and it compounds per installment (three dates puts the roster 21c over).
 *   • Handing the odd penny to ONE player makes the totals exact and breaks two other promises:
 *     this sheet gives every player the SAME schedule, and the roster-wide run reads a player whose
 *     amounts differ from everyone else's as a schedule the coach set BY HAND — so that family
 *     would be named as a per-player arrangement, and offered for keeping, on every future run,
 *     forever, over a rounding cent. (Executed, not assumed: see the unit suite.)
 *
 * Bounded by construction — the residue can never exceed half a cent per player, so this tolerance
 * is at most a few tens of cents on any real roster and cannot hide a shortfall that matters.
 *
 * @param gap          what players must fund MINUS what this schedule collects (either sign).
 * @param rosterCount  how many players the money is divided between.
 */
export function gapIsRoundingOnly(gap: number, rosterCount: number): boolean {
  // Integer cents on both sides: comparing 0.01 < 7/100 in floating point is exactly the kind of
  // arithmetic this whole module exists to keep out of a family's dues.
  const gapCents = Math.abs(Math.round(gap * 100));
  return gapCents < Math.max(1, Math.round(rosterCount));
}

export function splitPerPlayer(perPlayer: number, count: number): number[] {
  if (count < 1) return [];
  const totalCents = Math.round(perPlayer * 100);
  const base  = Math.floor(totalCents / count);
  const extra = totalCents - base * count;   // 0 … count-1 spare cents
  return Array.from({ length: count }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}
