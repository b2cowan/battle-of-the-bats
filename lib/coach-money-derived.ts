/**
 * ⚠⚠ TWO SOURCES FOR ONE ROW (COACH_MONEY_IN_TAXONOMY_PLAN §4.1).
 *
 * Most income rows are typed: a coach records an arrival and it lands on its category+item, exactly
 * as a cost does. But **fundraisers and sponsors already report their own actuals** — realised
 * entries, receipts only, less whatever was rebated to the player who raised it — and **player
 * rebates depend on those figures**. If a coach could also type an income record against the same
 * row, the same dollar would be counted twice and the season would read better than it is.
 *
 * So: **one row, one source.** A category+item that an expected-fundraising or expected-sponsorship
 * budget line claims takes its actual from the fundraiser machinery, and the money form refuses a
 * typed one there and says why. Every other income row is typed.
 *
 * ⚠ MONEY BACK IS EXEMPT. A refund is not a second source for the row's income — it reduces it. A
 * tournament refunding a registration the team took is a real event on a derived row, and blocking
 * it would leave the coach with no way to record it at all.
 *
 * ── Where the derived pool LANDS ────────────────────────────────────────────────────────────────
 *
 * The fundraiser side produces ONE number per kind. It cannot be split across items, because
 * nothing links a drive to a budget item — so `placeDerivedActual` puts it as deep in the taxonomy
 * as the claiming lines actually agree, and no deeper:
 *
 *   · every claiming line on one category AND one item  → that item's row;
 *   · every claiming line in one category, several items → that category's "Not itemized" bucket;
 *   · claiming lines spread across categories, or none at all → no category at all.
 *
 * ⚠ THE HONESTY IS THE POINT. Guessing which of two fundraising items a $1,640 total belongs to
 * would be confident-and-wrong data, and the coach would have no way to tell. "Not itemized" is a
 * visible gap that a coach closes by planning one line, which is exactly the nudge the taxonomy
 * exists to give.
 *
 * Pure: no IO, no React, no Date.
 */

/**
 * Which machinery reports a row's actual for the coach.
 *
 * ⚠ NOT the budget-line kind, deliberately. This module is about WHERE A FIGURE COMES FROM, and
 * keeping the stored enum out of it is what stops a fourth kind having to be understood in two
 * more files — the mapping lives once, in `LINE_KIND_ACTUAL_SOURCE`.
 */
export type DerivedSource = 'fundraiser' | 'sponsor';

/** The claiming half of a money-in budget line — all this module needs to place a pool. */
export interface DerivedClaim {
  source: DerivedSource;
  categoryId: string | null;
  categoryName: string | null;
  itemId: string | null;
  itemName: string | null;
}

/**
 * One category+item pair, as a comparable string.
 *
 * ⚠ IDS ONLY, NEVER NAMES. A typed category name is how two rows that look identical end up being
 * two rows (the 2026-08-15 "Officials twice" defect); here the inputs are always real plan rows,
 * which carry ids or carry nothing.
 */
export function taxonomyKey(categoryId: string | null, itemId: string | null): string {
  return `${categoryId ?? ''}|${itemId ?? ''}`;
}

/**
 * Where a single derived total belongs, given every line that claims it.
 *
 * ⚠ CALL IT PER SOURCE. Drives and sponsors report two separate totals, and merging their claims
 * would place a fundraising figure using a sponsorship line's category — the answer would look
 * precise and be wrong.
 */
export function placeDerivedActual(claims: DerivedClaim[]): Omit<DerivedClaim, 'source'> {
  const none = { categoryId: null, categoryName: null, itemId: null, itemName: null };
  if (claims.length === 0) return none;

  const categories = new Set(claims.map(c => c.categoryId ?? ''));
  if (categories.size !== 1 || !claims[0].categoryId) return none;

  const items = new Set(claims.map(c => c.itemId ?? ''));
  const first = claims[0];
  if (items.size === 1 && first.itemId) {
    return {
      categoryId: first.categoryId, categoryName: first.categoryName,
      itemId: first.itemId, itemName: first.itemName,
    };
  }
  return { categoryId: first.categoryId, categoryName: first.categoryName, itemId: null, itemName: null };
}

/**
 * Every category+item pair a typed income record must NOT be filed against.
 *
 * Both the pairs the claiming lines name AND each pool's landing spot: with one line per item those
 * coincide, but two fundraising lines in one category put that pool in the category's bucket, and a
 * typed record landing there would still double-count.
 *
 * ⚠ TAKES EVERY CLAIM, BOTH SOURCES. Unlike placement, the refusal does not care which machinery
 * answers for a row — only that something already does.
 */
/**
 * May a TYPED income record be filed against this row? Null when yes; the coach-facing refusal
 * when no.
 *
 * ⚠ ONE PLACE, TWO WRITE PATHS. Create and edit both have to enforce this — an edit door that
 * skipped it would be the way around the guard — and the rule was written out twice, error string
 * included, before this function existed. It is the load-bearing anti-double-count: the figures it
 * protects are what player rebates are computed from, so counting a dollar twice reaches a
 * family's dues and not just a report.
 *
 * ⚠ MONEY BACK NEVER ASKS. A refund reduces such a row rather than being a second source for it —
 * a tournament really can refund a registration the team took — so callers only consult this for
 * `income`.
 */
export function whyIncomeIsRefused(
  claims: DerivedClaim[],
  item: { id: string; categoryId: string; name: string },
): string | null {
  if (!derivedIncomeKeys(claims).has(taxonomyKey(item.categoryId, item.id))) return null;
  return `${item.name}'s actual already comes from your fundraisers and sponsors. `
    + 'Record the money there and it will appear here — logging it twice would count it twice.';
}

export function derivedIncomeKeys(claims: DerivedClaim[]): Set<string> {
  if (claims.length === 0) return new Set();
  const keys = new Set(claims.map(c => taxonomyKey(c.categoryId, c.itemId)));
  for (const source of ['fundraiser', 'sponsor'] as const) {
    const landing = placeDerivedActual(claims.filter(c => c.source === source));
    if (landing.categoryId || landing.itemId) keys.add(taxonomyKey(landing.categoryId, landing.itemId));
  }
  return keys;
}
