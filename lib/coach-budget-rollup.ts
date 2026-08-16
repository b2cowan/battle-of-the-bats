/**
 * A budget is TWO LEVELS DEEP: category, then item. This module is that rule.
 *
 * ⚠ THE ITEM NAMES THE ROW — NOT THE DESCRIPTION (owner ruling 2026-08-15). The screen that forced
 * this: a coach picked the item "Entry Fees" and their plan rendered a row called "test", because
 * the row was named by whatever free text had been typed. The shared taxonomy was invisible, the
 * typed words were the identity, and nothing downstream could match on them. **Two reports cannot
 * line up on words somebody typed.** So the item is the key, the description is a note, and this
 * module never reads one.
 *
 * The four rules it encodes, in the owner's words:
 *
 *   1. Group two levels and no further — category, then item.
 *   2. The item names the row.
 *   3. **Two lines on the same item SUM into one row** (including their payment periods).
 *   4. Spending carries the item too, so an item that was **charged but never budgeted** appears as
 *      its own row rather than disappearing into a list.
 *
 * ⚠ RULE 3 IS WHY THE EXPENSE→LINE LINK WAS RETIRED one day after it was built. That design existed
 * because two lines sharing an item were ambiguous — actuals could not be split between them. Summed
 * lines are one row, so there is nothing to split, and the category+item pair became a complete
 * answer on its own. See COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md §2.
 *
 * ⚠ WHETHER SOMETHING WAS BUDGETED IS DERIVED, NEVER STORED. A row is "in the plan" when a budget
 * line exists for its category+item, and not when it doesn't. Nothing asks the coach to declare it,
 * which is what let the old "Not in the budget" control be deleted outright.
 *
 * Pure: no IO, no React, no Date. Dates are `YYYY-MM-DD` strings compared as strings, so a coach in
 * Toronto and a server in UTC place a cost in the same period.
 */

/** The bucket a cost with no item falls into, inside its own category. Never a real item id. */
export const NO_ITEM = '__no_item__';

/** What a category with no name at all is called — one spelling, used by every surface. */
export const NO_CATEGORY_LABEL = 'No category';

/** What an item-less row inside a real category is called. It is a prompt, not a name. */
export const NO_ITEM_LABEL = 'Not itemized';

/** One payment period on a budget line, before any merging. */
export interface RollupPeriod {
  label: string;
  /** `YYYY-MM-DD`, or null for a period entered in "just names" mode. */
  date: string | null;
  amount: number;
  sortOrder: number;
}

/** A COST line from the plan. Funding and sponsorship lines never reach this module. */
export interface RollupLine {
  id: string;
  categoryId: string | null;
  /** Display name; null becomes `NO_CATEGORY_LABEL`. */
  categoryName: string | null;
  itemId: string | null;
  itemName: string | null;
  totalAmount: number;
  /** Carried through for the plan list's expanded detail. ⚠ NEVER a grouping key. */
  description: string;
  notes: string | null;
  periods: RollupPeriod[];
}

/** One paid amount, already resolved to the taxonomy it belongs to. */
export interface RollupSpend {
  id: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  itemId: string | null;
  itemName: string | null;
  /** The amount actually PAID. A payable's deposit and balance arrive summed, on the earliest date. */
  amount: number;
  /** `YYYY-MM-DD`, or null when nothing recorded a date. */
  paidDate: string | null;
}

export interface ItemRow {
  /** Null = the `NO_ITEM` bucket: costs or lines in this category that name no item. */
  itemId: string | null;
  itemName: string;
  budgeted: number;
  actual: number;
  /** budgeted − actual. Positive = under. */
  variance: number;
  /** How many budget lines were summed into this row. Two or more is worth captioning. */
  lineCount: number;
  /** How many paid costs were summed into this row. */
  costCount: number;
  /** ⚠ DERIVED: is there a budget line for this category+item? False = charged, never budgeted. */
  inPlan: boolean;
  /** The merged payment schedule — same date from two lines is ONE period carrying the sum. */
  periods: Array<{ label: string; date: string | null; amount: number; actual: number }>;
  /** The individual lines behind the row, so the plan list can still edit one of them. */
  lines: Array<{ id: string; description: string; notes: string | null; totalAmount: number }>;
  /** The individual costs behind the row, for the drill-in. */
  costs: Array<{ id: string; description: string; amount: number; paidDate: string | null }>;
}

export interface CategoryRow {
  categoryId: string | null;
  categoryName: string;
  budgeted: number;
  actual: number;
  variance: number;
  /** False when nothing in this category was ever budgeted — the whole category is unplanned. */
  inPlan: boolean;
  items: ItemRow[];
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Category identity. The id when there is one; otherwise the lowercased name, so two costs typing
 *  the same category text land together rather than making two rows that look identical. */
function categoryKey(categoryId: string | null, categoryName: string | null): string {
  if (categoryId) return `id:${categoryId}`;
  const name = (categoryName ?? '').trim().toLowerCase();
  return name ? `name:${name}` : 'none';
}

interface Bucket {
  categoryId: string | null;
  categoryName: string;
  items: Map<string, {
    itemId: string | null;
    itemName: string;
    lines: RollupLine[];
    costs: RollupSpend[];
  }>;
}

/**
 * Roll a season's plan and its paid spending into category → item rows.
 *
 * A row appears when EITHER side has something in it, which is the whole point: an item with a plan
 * and no spending reports what is still to come, and an item with spending and no plan is the
 * "charged but never budgeted" row this design exists to produce.
 *
 * @param lines COST lines only — money-in lines carry no category or item by design and are
 *              reported separately (owner ruling 2026-08-13).
 * @param spend paid amounts only. Nothing unpaid is an actual.
 */
export function rollupBudget(lines: RollupLine[], spend: RollupSpend[]): CategoryRow[] {
  const buckets = new Map<string, Bucket>();

  const bucketFor = (categoryId: string | null, categoryName: string | null): Bucket => {
    const key = categoryKey(categoryId, categoryName);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        categoryId,
        categoryName: (categoryName ?? '').trim() || NO_CATEGORY_LABEL,
        items: new Map(),
      };
      buckets.set(key, bucket);
    }
    // A cost may name a category the plan also names; whichever arrives with an id wins, so the
    // row carries a real category rather than a string that happens to match.
    if (!bucket.categoryId && categoryId) bucket.categoryId = categoryId;
    return bucket;
  };

  const itemFor = (bucket: Bucket, itemId: string | null, itemName: string | null) => {
    const key = itemId ?? NO_ITEM;
    let entry = bucket.items.get(key);
    if (!entry) {
      entry = {
        itemId,
        itemName: itemId ? ((itemName ?? '').trim() || NO_ITEM_LABEL) : NO_ITEM_LABEL,
        lines: [],
        costs: [],
      };
      bucket.items.set(key, entry);
    }
    if (entry.itemId && itemName && entry.itemName === NO_ITEM_LABEL) entry.itemName = itemName.trim();
    return entry;
  };

  for (const line of lines) {
    itemFor(bucketFor(line.categoryId, line.categoryName), line.itemId, line.itemName).lines.push(line);
  }
  for (const cost of spend) {
    itemFor(bucketFor(cost.categoryId, cost.categoryName), cost.itemId, cost.itemName).costs.push(cost);
  }

  const categories: CategoryRow[] = [];
  for (const bucket of buckets.values()) {
    const items: ItemRow[] = [];
    for (const entry of bucket.items.values()) {
      const budgeted = r2(entry.lines.reduce((s, l) => s + l.totalAmount, 0));
      const actual   = r2(entry.costs.reduce((s, c) => s + c.amount, 0));
      items.push({
        itemId: entry.itemId,
        itemName: entry.itemName,
        budgeted,
        actual,
        variance: r2(budgeted - actual),
        lineCount: entry.lines.length,
        costCount: entry.costs.length,
        inPlan: entry.lines.length > 0,
        periods: mergePeriods(entry.lines, entry.costs),
        lines: entry.lines.map(l => ({
          id: l.id, description: l.description, notes: l.notes, totalAmount: l.totalAmount,
        })),
        costs: entry.costs.map(c => ({
          id: c.id, description: c.description, amount: c.amount, paidDate: c.paidDate,
        })),
      });
    }

    // Planned items first, then unplanned; alphabetical inside each, with the "Not itemized"
    // prompt last wherever it falls — it is a gap to close, not a row to read.
    items.sort((a, b) => {
      if (a.inPlan !== b.inPlan) return a.inPlan ? -1 : 1;
      if ((a.itemId === null) !== (b.itemId === null)) return a.itemId === null ? 1 : -1;
      return a.itemName.localeCompare(b.itemName);
    });

    const budgeted = r2(items.reduce((s, i) => s + i.budgeted, 0));
    const actual   = r2(items.reduce((s, i) => s + i.actual, 0));
    categories.push({
      categoryId: bucket.categoryId,
      categoryName: bucket.categoryName,
      budgeted,
      actual,
      variance: r2(budgeted - actual),
      inPlan: items.some(i => i.inPlan),
      items,
    });
  }

  // Same rule one level up: categories the team planned for, then categories it only spent in.
  categories.sort((a, b) => {
    if (a.inPlan !== b.inPlan) return a.inPlan ? -1 : 1;
    return a.categoryName.localeCompare(b.categoryName);
  });
  return categories;
}

/**
 * Merge the payment schedules of every line on one item, and place the paid costs against them.
 *
 * ⚠ THE SAME DATE FROM TWO LINES IS ONE PERIOD CARRYING THE SUM. Two lines on one item is now an
 * ordinary shape (rule 3), and listing "Nov 30" twice would report one month as two — the visual
 * twin of the per-line double-count fixed on 2026-08-15.
 *
 * Undated periods collapse into a single bucket, because a period with no date has nothing to be
 * merged BY, and two lines' worth of "just names" periods cannot be reconciled with each other.
 * That matches the month grid, which has always kept undated budget out of the month columns and
 * said so rather than smearing it.
 */
function mergePeriods(
  lines: RollupLine[],
  costs: RollupSpend[],
): Array<{ label: string; date: string | null; amount: number; actual: number }> {
  const byDate = new Map<string, { label: string; date: string | null; amount: number }>();
  for (const line of lines) {
    for (const p of line.periods) {
      const key = p.date ?? '__undated__';
      const existing = byDate.get(key);
      if (existing) {
        existing.amount = r2(existing.amount + p.amount);
        // Two lines rarely label the same month identically; the first label wins and the second is
        // dropped rather than concatenated into something no coach wrote.
      } else {
        byDate.set(key, { label: p.label, date: p.date, amount: p.amount });
      }
    }
  }
  if (byDate.size === 0) return [];

  const periods = [...byDate.values()].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  // Each cost lands in the first period falling on or after the day it was paid; anything paid after
  // the last dated period, and anything with no date at all, lands in the final period. Identical to
  // the rule the retired per-line module encoded, applied to a MERGED schedule instead of one line.
  const actuals = new Array<number>(periods.length).fill(0);
  const last = periods.length - 1;
  for (const cost of costs) {
    if (!cost.amount) continue;
    let placed = false;
    if (cost.paidDate) {
      for (let i = 0; i < periods.length; i++) {
        if (!periods[i].date || periods[i].date! >= cost.paidDate) {
          actuals[i] += cost.amount;
          placed = true;
          break;
        }
      }
    }
    if (!placed) actuals[last] += cost.amount;
  }

  return periods.map((p, i) => ({ ...p, actual: r2(actuals[i]) }));
}
