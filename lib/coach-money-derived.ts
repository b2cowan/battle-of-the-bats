/**
 * ⚠⚠ TWO SOURCES FOR ONE ROW (COACH_MONEY_IN_TAXONOMY_PLAN §4.1).
 *
 * Most income rows are typed: a coach records an arrival and it lands on its category+item, exactly
 * as a cost does. But **fundraisers and sponsors already report their own actuals** — realised
 * entries, receipts only, less whatever was rebated to the player who raised it — and **player
 * rebates depend on those figures**. If a coach could also type an income record against the same
 * row, the same dollar would be counted twice and the season would read better than it is.
 *
 * So: **one row, one source.** A WORD whose `actual_source` is `fundraiser` or `sponsor` takes its
 * actual from that machinery, and the money-in write paths refuse a typed record on it and say
 * where to go instead. Every other income row is typed.
 *
 * ⚠⚠ IT USED TO BE "A ROW THAT A BUDGET LINE CLAIMS", and the difference is which team got
 * protected (owner ruling 2026-09-08). The claim-based version refused the team that had budgeted a
 * fundraising line and let the identical double count through on the team that had not — the guard
 * fired on the careful one. The word decides now, whatever the plan says, and the words themselves
 * left the "Other money in" picker entirely: there is nothing to refuse because there is nothing to
 * pick.
 *
 * ⚠ MONEY BACK IS EXEMPT. A refund is not a second source for the row's income — it reduces it. A
 * tournament refunding a registration the team took is a real event on a derived row, and blocking
 * it would leave the coach with no way to record it at all.
 *
 * ── Where the derived pool LANDS — THE LEGACY FALLBACK SINCE MIGRATION 285 ──────────────────────
 *
 * ⚠⚠ READ THIS BEFORE THE RULE BELOW. Everything from here to `placeDerivedActual` describes how
 * raised money was placed when **nothing linked a drive to a budget item**. Since mig 285 a drive
 * and a sponsor each name the line they are *raising for*, so each record's own total lands on its
 * own row, and the pool is what is left over: records written before that migration whose season's
 * plan was too ambiguous to link them safely, and records a coach has deliberately cleared.
 *
 * The rule below is unchanged and still correct for that residue — it is just no longer the normal
 * case. The defect it could not avoid is the one mig 285 exists to remove: **budget two fundraising
 * lines and both rows read blank** while every raised dollar collected under "Not itemized". Placing
 * the pool honestly was the best answer available to a pool; the answer was to stop having one.
 *
 * The fundraiser side produces ONE number per kind. It cannot be split across items, because
 * nothing links THOSE records to a budget item — so `placeDerivedActual` puts it as deep in the
 * taxonomy as the claiming lines actually agree, and no deeper:
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
/**
 * What a derived pool calls itself when NOTHING IN THE PLAN CLAIMS IT (owner ruling 2026-09-07).
 *
 * ⚠⚠ THE ROLLUP'S FALLBACKS WERE WRITTEN FOR A DIFFERENT FACT. A cost with no item reads "No
 * category → Not itemized", and that is right: it still opens into real records, and the blank name
 * is a prompt to go and plan one. Applied to a derived pool it said nothing twice — the season's
 * second-largest revenue line on the UAT fixture read "No category · Not itemized · $2,085.75" while
 * the panel behind it already knew to call the money "From your sponsors". **The row did not use the
 * name its own door knew.**
 *
 * ⚠ THIS SUPPLIES WORDS, IT DOES NOT MOVE MONEY. `placeDerivedActual` still refuses to guess a
 * category — that refusal is the visible gap a coach closes by planning a line, and it stays.
 */
export const UNPLANNED_DERIVED_CATEGORY = 'Not in the plan';

/** The item name for an unclaimed pool — what the money IS, in the words the panel already used. */
export function unplannedDerivedItemName(source: DerivedSource): string {
  return source === 'sponsor' ? 'Sponsor money' : 'Fundraising money';
}

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
 * May a TYPED income record be filed against this row? Null when yes; the coach-facing refusal
 * when no.
 *
 * ⚠⚠ IT ASKS THE WORD, NOT THE PLAN (owner ruling 2026-09-08) — and that is the fix, not a
 * simplification. It used to take the season's budget LINES and refuse only where one of them
 * claimed the row, which meant the same money saved without complaint on a team that had not
 * budgeted for it: **the guard fired on the careful team and not on the careless one.** A word
 * whose actual comes from a drive cannot take a typed figure whether or not anybody planned a line
 * against it, so the word is what decides. Structural, unconditional, both write doors.
 *
 * ⚠ ONE PLACE, TWO WRITE PATHS. Create and edit both have to enforce this — an edit door that
 * skipped it would be the way around the guard — and the rule was written out twice, error string
 * included, before this function existed. It is the load-bearing anti-double-count: the figures it
 * protects are what player rebates are computed from, so counting a dollar twice reaches a
 * family's dues and not just a report.
 *
 * ⚠⚠ THE EDIT DOOR ASKS IT ONLY WHEN THE ITEM IS ACTUALLY CHANGING, and that is deliberate: the
 * money-in form resends the item on every save, so an unconditional check there would freeze a
 * LEGACY record — one written under the old conditional rule — the moment a coach tried to correct
 * its amount or its note. The door closes; history stays correctable (plan §3.8's rule). Re-filing
 * such a record ONTO a derived word is refused like any other, and re-filing it OFF one is exactly
 * the repair a coach should be able to make.
 *
 * ⚠ MONEY BACK NEVER ASKS. A refund reduces such a row rather than being a second source for it —
 * a tournament really can refund a registration the team took — so callers only consult this for
 * `income`.
 *
 * ⚠ THE SENTENCE NAMES THE DOOR, per source. It is now practically unreachable from the product —
 * the words are no longer in the "Other money in" list to pick — so anyone who meets it arrived by
 * API or through a stale screen, and "record it somewhere else" without saying where would be the
 * least useful moment for vagueness.
 */
export function whyIncomeIsRefused(
  item: { name: string; actualSource: 'typed' | DerivedSource },
): string | null {
  if (item.actualSource === 'typed') return null;
  return item.actualSource === 'sponsor'
    ? `${item.name} is filled in from your sponsors. Record it on Fundraising, against the sponsor `
      + 'or grant that gave it — it lands on this line from there.'
    : `${item.name} is filled in from your fundraisers. Record it on Fundraising, against the drive `
      + 'that raised it — for one player, or for the whole team.';
}

/* ⚰ `derivedIncomeKeys(claims)` IS DELETED (owner ruling 2026-09-08). It answered "which
   category+item pairs must the money form refuse?" by reading the season's budget LINES — every
   claiming pair, plus each pool's landing spot, since two fundraising lines in one category put the
   pool in that category's bucket where a typed record would still double-count. Careful, and
   answering a question that turned out to be the wrong one: a word whose actual comes from a drive
   cannot take a typed figure whether or not anybody planned a line against it, so the refusal moved
   onto the WORD (`whyIncomeIsRefused` above) and stopped depending on the plan.

   ⚠ ITS SECOND JOB WENT TOO, and that is the visible half: the keys travelled to the client so the
   picker could grey those rows and explain them. The rows are simply not in the "Other money in"
   list any more, so there is nothing to grey and no note to write.

   Do not restore it as "the client's copy of the rule". `placeDerivedActual` below is the only
   claims reader left, it serves Budget vs. Actual's legacy fallback alone, and a second reader of
   the same claims answering a question the word already answers is how the form and the report
   started disagreeing about one row in the first place. */
