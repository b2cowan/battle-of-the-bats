/**
 * Which SPAN of the plan a Budget vs Actual comparison is measured against — the "Compare" control
 * on the Statement and By activity views (owner ruling 2026-09-04).
 *
 * ## The problem this exists for
 *
 * Mid-season the report set a WHOLE SEASON's plan against actuals SO FAR, so it reported a large
 * "under budget" that was not an achievement but an unfinished season. On the UAT team on
 * 2026-09-04: **$8,690.02 under**, on a season that had spent $4,909.98 of a $6,600.00 plan-to-date
 * and was really **$1,690.02 under**. Both figures are arithmetically correct; only one answers
 * "are we on track right now?"
 *
 * ## Why it lives in its own module
 *
 * The arithmetic is read by the screen, by both export shapes, and by `check:money-report`. It has
 * been true three times on this report that two readers of one fact drifted apart — the screen and
 * the export having had two different formulas for `hasUndated` is the precedent this file's
 * neighbours already cite. One home, pure, no IO and no React.
 *
 * ## The rules, and the one that is easy to get wrong
 *
 * 1. **Only the PLAN column moves.** Actuals are already "so far" by definition; re-cutting them
 *    would be measuring money that has moved against a subset of itself.
 * 2. **BOTH SIDES of the report move together.** Re-cutting only expenses would set a whole
 *    season's revenue plan against part-year actuals — the exact defect this project removes.
 * 3. **⚠⚠ EXCLUDED MONEY HAS TWO CAUSES AND ONLY ONE OF THEM IS A GAP.** Money with **no date** is
 *    excludable and a coach can fix it by answering the line's When question. Money dated **after
 *    today** is correctly not yet compared — that is the basis working, not something missing.
 *    `undatedPlan` names only the first, and the disclosure sentence must say only the first.
 *    Conflating them would tell a coach to go and date money that is already dated.
 * 4. **The undated figure can never reach zero.** A coach who sets a season *estimated total*
 *    before itemising anything has plan money with no lines underneath it and nothing to attach a
 *    month to. That is why "No date yet" stays a legitimate answer on the form rather than
 *    something it nags about.
 */

/** `'season'` is the default and stays the default — flipping it is its own decision, taken after
 *  the owner has seen To date working. Headroom is quoted on five surfaces against the whole-season
 *  plan and pinned by a build gate. */
export type CompareBasis = 'season' | 'todate';

export const COMPARE_BASES: { id: CompareBasis; label: string }[] = [
  { id: 'season', label: 'Whole season' },
  { id: 'todate', label: 'To date' },
];

/** A stored value narrowed — one place, so a corrupt device preference falls back rather than
 *  putting the report into a basis nothing can render. */
export function normalizeBasis(raw: unknown): CompareBasis {
  return raw === 'todate' ? 'todate' : 'season';
}

/**
 * The plan column's heading. It changes with the basis so a reader who scrolled past the control
 * can still tell which span the figures beside it belong to.
 *
 * ⚠ THE WHOLE-SEASON VALUE IS "Budgeted", NOT "Budget", and it was the other way round until
 * 2026-09-05. Nothing ever used it: the screen wanted "Budgeted", so its one caller wrote
 * `basis === 'todate' ? planColumnLabel(basis) : 'Budgeted'` and routed around the helper. That
 * workaround was invisible while the file had a hard-coded header of its own — and the moment the
 * export started asking this function for its heading, the two surfaces would have disagreed on
 * the ordinary basis to fix a bug on the rare one. One word, one home, both callers.
 */
export function planColumnLabel(basis: CompareBasis): string {
  return basis === 'todate' ? 'Plan to date' : 'Budgeted';
}

/**
 * ⚠⚠ THE CLOSING ROW IS RENAMED UNDER `todate`, and the rename is the ruling rather than a nicety
 * (owner, 2026-09-04).
 *
 * Under this basis the figure is a **cash-timing** statement wearing a **profitability** name. On
 * the UAT team every dues instalment falls between October and next March while the costs run
 * January to October, so on 4 September the honest to-date revenue plan is $0.00 and the row reads
 * **($6,600.00)** on a season whose actual position is +$1,429.37. The variance column says the
 * right thing (+$8,029.37, green); the plan column does not, and **dating every budget line cannot
 * move it**, because the dues schedule genuinely starts in October.
 *
 * Rejected alternative: re-cut only the expense side. See rule 2 above.
 */
export function netRowLabel(basis: CompareBasis): string {
  return basis === 'todate' ? 'Net to date' : 'Season net';
}

/** One period of a budget line, as the report ships it. */
export interface BasisPeriod {
  date: string | null;
  amount: number;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * What a row's plan is worth under `basis`.
 *
 * ⚠ `budgeted` IS THE WHOLE-SEASON FIGURE AND IS RETURNED UNTOUCHED on the season basis — including
 * for a row with no periods at all, which is most of them today. Under `todate` a row contributes
 * only the periods it actually has, dated on or before `today`; a row with no periods contributes
 * **nothing**, which is the honest answer and the reason the whole date requirement exists.
 */
export function budgetedOn(
  basis: CompareBasis,
  budgeted: number,
  periods: readonly BasisPeriod[] | undefined,
  today: string,
): number {
  if (basis === 'season') return r2(budgeted);
  return r2((periods ?? [])
    .filter(p => p.date !== null && p.date <= today)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
}

/**
 * Plan money on a row carrying **no date at all** — the figure the disclosure sentence names.
 *
 * ⚠ IT IS `budgeted` MINUS THE DATED PERIODS, not the sum of the undated ones, and the difference
 * matters: a line with NO periods has no undated period to add up, and summing them would report a
 * lump sum as fully dated. One expression covers both shapes — an undated chunk inside a split, and
 * a line that never answered.
 *
 * ⚠ IT DOES NOT COUNT MONEY DATED AFTER TODAY. See rule 3 in this file's header.
 */
export function undatedPlan(budgeted: number, periods: readonly BasisPeriod[] | undefined): number {
  const dated = (periods ?? [])
    .filter(p => p.date !== null)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return Math.max(0, r2(budgeted - dated));
}

/**
 * Good-news-positive variance, per direction — the same rule the rollup applies on the season
 * basis, restated here because a re-cut plan needs a re-cut variance and there is nowhere else the
 * two could agree by construction.
 *
 * Revenue: more money in than planned is good. A cost: less money out than planned is good.
 */
export function varianceOn(direction: 'in' | 'out', budgeted: number, actual: number): number {
  return r2(direction === 'in' ? actual - budgeted : budgeted - actual);
}
