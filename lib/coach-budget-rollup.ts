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
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 2026-08-16 — THE SAME RULE, IN BOTH DIRECTIONS (COACH_MONEY_IN_TAXONOMY_PLAN.md)
 *
 * Money arriving is not one thing, so three more rules join the four above:
 *
 *   5. **A row is REVENUE or an EXPENSE**, and the direction lives on the row. One item can carry
 *      both — the library's direction tag is a picker HINT, never a constraint — and then it is
 *      TWO rows, one in each section. Netting them would report a $6,400 gate and a $2,400 entry
 *      fee as $4,000 of something with no name.
 *   6. ⚠⚠ **VARIANCE IS ALWAYS GOOD-NEWS-POSITIVE.** The formula genuinely differs by direction —
 *      revenue is `actual − budgeted`, a cost is `budgeted − actual` — and the previous design put
 *      both behind one column heading with a two-letter tag as the only distinguisher (plan §8).
 *      Deciding it HERE, from the row's own direction, is what lets the screen render one colour
 *      rule and change only the WORDING per section ("+$400" against "$150 under").
 *   7. **Money back NETS into the row it repaid** — one row, never two, never income. The row it
 *      lands on is the EXPENSE row for its item when that item has an expense side, otherwise the
 *      revenue row, otherwise a new expense row (see `sideForRefund`). Gross and refund stay
 *      separately readable so a screen can print "$2,400 paid · $150 back".
 *
 * Both report shapes come off ONE grouping pass: the statement (Revenue / Expenses / Net) and the
 * by-activity lens (per category: revenue, costs, net). They end on the same season net because
 * they are the same rows read two ways — build them apart and they will disagree.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠ THIS MODULE NEVER MENTIONS THE STORED KIND. Callers convert `line_kind` to a direction with
 * `isFundingKind()` (lib/coach-budget-totals.ts) before handing rows over — the enum has three
 * members and adding a fourth must stay one edit in one file, which is what
 * `tests/unit/budget-line-kind-guard.test.ts` enforces over the whole tree.
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

/** Which way the money moves. `out` is a cost; `in` is revenue. Refunds carry neither — they take
 *  the direction of the row they repay (rule 7). */
export type MoneyDirection = 'in' | 'out';

/** One payment period on a budget line, before any merging. */
export interface RollupPeriod {
  label: string;
  /** `YYYY-MM-DD`, or null for a period entered in "just names" mode. */
  date: string | null;
  amount: number;
  sortOrder: number;
}

/** A line from the plan — a cost, or money the team plans to bring in. */
export interface RollupLine {
  id: string;
  categoryId: string | null;
  /** Display name; null becomes `NO_CATEGORY_LABEL`. */
  categoryName: string | null;
  itemId: string | null;
  itemName: string | null;
  /** ALWAYS POSITIVE. The direction carries the sign, never the amount (migration 230's rule). */
  totalAmount: number;
  /** Carried through for the plan list's expanded detail. ⚠ NEVER a grouping key. */
  description: string;
  notes: string | null;
  periods: RollupPeriod[];
  /** Defaults to `out`: every line written before money-in gained a taxonomy is a cost. */
  direction?: MoneyDirection;
}

/** One amount that actually moved — paid out, or received in. */
export interface RollupSpend {
  id: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  itemId: string | null;
  itemName: string | null;
  /** ALWAYS POSITIVE. A payable's deposit and balance arrive summed, on the earliest date. */
  amount: number;
  /** `YYYY-MM-DD`, or null when nothing recorded a date. */
  paidDate: string | null;
  /** Defaults to `out`. */
  direction?: MoneyDirection;
}

/**
 * Money coming BACK on something already recorded — a refund, a credit, a reimbursement.
 *
 * ⚠ IT HAS NO DIRECTION OF ITS OWN. It reduces whatever it repaid, which is the entire reason it
 * is not "income": a refunded tournament entry means the team spent $150 less, not that it earned
 * $150. Booking it the other way overstates both sides and corrupts every per-item cost figure.
 */
export interface RollupRefund {
  id: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  itemId: string | null;
  itemName: string | null;
  /** ALWAYS POSITIVE. The netting supplies the sign. */
  amount: number;
  /** `YYYY-MM-DD` — the day it ARRIVED. Back-dating it into the month the cost was paid would
   *  rewrite a month already reported on and reconciled. */
  receivedDate: string | null;
}

export interface ItemRow {
  /** Null = the `NO_ITEM` bucket: costs or lines in this category that name no item. */
  itemId: string | null;
  itemName: string;
  /** Which section this row belongs to (rule 5). One item may appear as two rows. */
  direction: MoneyDirection;
  budgeted: number;
  /** What actually moved, AFTER money back is netted off (rule 7). May be negative. */
  actual: number;
  /** What moved before any refund — the "$2,400 paid" half of "$2,400 paid · $150 back". */
  grossActual: number;
  /** How much came back against this row. Positive; already subtracted from `actual`. */
  refundTotal: number;
  /** ⚠ GOOD-NEWS-POSITIVE, per direction (rule 6). Costs: budgeted − actual. Revenue: the reverse. */
  variance: number;
  /** How many budget lines were summed into this row. Two or more is worth captioning. */
  lineCount: number;
  /** How many moved amounts were summed into this row. */
  costCount: number;
  /** ⚠ DERIVED: is there a budget line for this category+item? False = moved, never budgeted. */
  inPlan: boolean;
  /** The merged payment schedule — same date from two lines is ONE period carrying the sum. */
  periods: Array<{ label: string; date: string | null; amount: number; actual: number }>;
  /** The individual lines behind the row, so the plan list can still edit one of them. */
  lines: Array<{ id: string; description: string; notes: string | null; totalAmount: number }>;
  /** The individual amounts behind the row, for the drill-in. */
  costs: Array<{ id: string; description: string; amount: number; paidDate: string | null }>;
  /** The money back behind the row. Separate from `costs` on purpose — merging them would hide
   *  which records were spending and which were repayment, and one of those is the out-of-pocket
   *  trap the money-back plan's §2 exists to keep apart. */
  refunds: Array<{ id: string; description: string; amount: number; receivedDate: string | null }>;
}

export interface CategoryRow {
  categoryId: string | null;
  categoryName: string;
  direction: MoneyDirection;
  budgeted: number;
  /** Net of any money back its items carry. ⚠ There is deliberately no category-level `grossActual`
   *  / `refundTotal`: the "$2,400 paid · $150 back" caption belongs to the ROW a coach reads, and a
   *  category-level pair would be two more numbers shipped on every report that nothing renders. */
  actual: number;
  /** Good-news-positive, per direction. */
  variance: number;
  /** False when nothing in this category was ever budgeted — the whole category is unplanned. */
  inPlan: boolean;
  items: ItemRow[];
}

/** One half of the statement: everything going one way, with its own total. */
export interface ReportSection {
  direction: MoneyDirection;
  categories: CategoryRow[];
  budgeted: number;
  actual: number;
  /** Good-news-positive for THIS direction (rule 6). */
  variance: number;
}

/** One block of the by-activity lens: what a category earned, what it cost, what it netted. */
export interface ActivityBlock {
  categoryId: string | null;
  categoryName: string;
  /** Null when this category has no revenue at all — the block simply has one half. */
  revenue: CategoryRow | null;
  costs: CategoryRow | null;
  /** revenue − costs. Negative on a cost-only category, which is its honest reading. */
  net: { budgeted: number; actual: number; variance: number };
  inPlan: boolean;
}

export interface MoneyReport {
  /** Shape A — the statement. */
  revenue: ReportSection;
  expenses: ReportSection;
  /** Shape B — the same rows, grouped by what the team was doing. */
  activities: ActivityBlock[];
  /** Where BOTH shapes end. Variance is `actual − budgeted`: more net is the good news. */
  net: { budgeted: number; actual: number; variance: number };
}

export interface MoneyReportInput {
  lines: RollupLine[];
  spend: RollupSpend[];
  refunds?: RollupRefund[];
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

interface Entry {
  itemId: string | null;
  itemName: string;
  lines: RollupLine[];
  costs: RollupSpend[];
  refunds: RollupRefund[];
}

interface Bucket {
  categoryId: string | null;
  categoryName: string;
  /** One item map per direction. A category present on both sides appears in both sections of the
   *  statement and as one two-halved block in the by-activity lens. */
  sides: Map<MoneyDirection, Map<string, Entry>>;
}

/**
 * Roll a season's plan and everything that actually moved into both report shapes.
 *
 * A row appears when ANY of the three inputs has something in it, which is the whole point: an item
 * with a plan and no spending reports what is still to come, an item with spending and no plan is
 * the "charged but never budgeted" row this design exists to produce, and an item with nothing but
 * money back is a refund filed against the wrong thing — visible as a negative rather than lost.
 */
export function rollupMoneyReport({ lines, spend, refunds = [] }: MoneyReportInput): MoneyReport {
  const buckets = new Map<string, Bucket>();

  const bucketFor = (categoryId: string | null, categoryName: string | null): Bucket => {
    const key = categoryKey(categoryId, categoryName);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        categoryId,
        categoryName: (categoryName ?? '').trim() || NO_CATEGORY_LABEL,
        sides: new Map(),
      };
      buckets.set(key, bucket);
    }
    // A cost may name a category the plan also names; whichever arrives with an id wins, so the
    // row carries a real category rather than a string that happens to match.
    if (!bucket.categoryId && categoryId) bucket.categoryId = categoryId;
    return bucket;
  };

  const sideOf = (bucket: Bucket, direction: MoneyDirection): Map<string, Entry> => {
    let side = bucket.sides.get(direction);
    if (!side) {
      side = new Map();
      bucket.sides.set(direction, side);
    }
    return side;
  };

  const itemFor = (
    bucket: Bucket, direction: MoneyDirection, itemId: string | null, itemName: string | null,
  ): Entry => {
    const side = sideOf(bucket, direction);
    const key = itemId ?? NO_ITEM;
    let entry = side.get(key);
    if (!entry) {
      entry = {
        itemId,
        itemName: itemId ? ((itemName ?? '').trim() || NO_ITEM_LABEL) : NO_ITEM_LABEL,
        lines: [], costs: [], refunds: [],
      };
      side.set(key, entry);
    }
    if (entry.itemId && itemName && entry.itemName === NO_ITEM_LABEL) entry.itemName = itemName.trim();
    return entry;
  };

  for (const line of lines) {
    itemFor(bucketFor(line.categoryId, line.categoryName), line.direction ?? 'out', line.itemId, line.itemName)
      .lines.push(line);
  }
  for (const cost of spend) {
    itemFor(bucketFor(cost.categoryId, cost.categoryName), cost.direction ?? 'out', cost.itemId, cost.itemName)
      .costs.push(cost);
  }

  /* ⚠ REFUNDS ARE PLACED IN A SECOND PASS, and they have to be. Which side a refund nets into is
     decided by what the item already holds, so every line and every moved amount must be in place
     before the first refund is read. */
  for (const back of refunds) {
    const bucket = bucketFor(back.categoryId, back.categoryName);
    const direction = sideForRefund(bucket, back.itemId);
    itemFor(bucket, direction, back.itemId, back.itemName).refunds.push(back);
  }

  const revenueCats: CategoryRow[] = [];
  const expenseCats: CategoryRow[] = [];
  const blocks: ActivityBlock[] = [];

  for (const bucket of buckets.values()) {
    const built = new Map<MoneyDirection, CategoryRow>();
    for (const direction of ['in', 'out'] as const) {
      const side = bucket.sides.get(direction);
      if (!side || side.size === 0) continue;
      built.set(direction, buildCategoryRow(bucket, direction, side));
    }

    const revenue = built.get('in') ?? null;
    const costs   = built.get('out') ?? null;
    if (revenue) revenueCats.push(revenue);
    if (costs)   expenseCats.push(costs);

    const netBudget = r2((revenue?.budgeted ?? 0) - (costs?.budgeted ?? 0));
    const netActual = r2((revenue?.actual   ?? 0) - (costs?.actual   ?? 0));
    blocks.push({
      categoryId: bucket.categoryId,
      categoryName: bucket.categoryName,
      revenue,
      costs,
      // More net than planned is the good news on a block, whichever halves it has.
      net: { budgeted: netBudget, actual: netActual, variance: r2(netActual - netBudget) },
      inPlan: Boolean(revenue?.inPlan || costs?.inPlan),
    });
  }

  revenueCats.sort(compareCategories);
  expenseCats.sort(compareCategories);

  /* ⚠ THE BY-ACTIVITY LENS LEADS WITH THE CATEGORIES THAT HAVE BOTH HALVES, because they are the
     only ones that can answer the question it exists for — "did hosting the tournament pay for
     itself?" A revenue-only or cost-only block is still worth showing (it reconciles the season
     net), but it says nothing a statement does not already say better. */
  blocks.sort((a, b) => {
    const rank = (x: ActivityBlock) => (x.revenue && x.costs ? 0 : x.revenue ? 1 : 2);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.inPlan !== b.inPlan) return a.inPlan ? -1 : 1;
    return a.categoryName.localeCompare(b.categoryName);
  });

  const revenue = sectionOf('in', revenueCats);
  const expenses = sectionOf('out', expenseCats);
  const netBudget = r2(revenue.budgeted - expenses.budgeted);
  const netActual = r2(revenue.actual - expenses.actual);

  return {
    revenue,
    expenses,
    activities: blocks,
    net: { budgeted: netBudget, actual: netActual, variance: r2(netActual - netBudget) },
  };
}

/**
 * Which side of a category a refund nets into (rule 7).
 *
 * ⚠ THE EXPENSE SIDE WINS WHEN AN ITEM HAS BOTH, and that is deliberate rather than arbitrary.
 * "Money back on something the team paid for" is the base case the feature was asked for; a
 * contra-revenue refund only arises where an item is revenue and nothing else. Defaulting the
 * other way would let a misfiled refund quietly shrink income, where defaulting this way makes it
 * surface as a negative cost — which is exactly the signal a coach needs to notice and re-file.
 */
function sideForRefund(bucket: Bucket, itemId: string | null): MoneyDirection {
  const key = itemId ?? NO_ITEM;
  if (bucket.sides.get('out')?.has(key)) return 'out';
  if (bucket.sides.get('in')?.has(key)) return 'in';
  return 'out';
}

/** Planned categories first, then the ones the team only moved money in; alphabetical inside each. */
function compareCategories(a: CategoryRow, b: CategoryRow): number {
  if (a.inPlan !== b.inPlan) return a.inPlan ? -1 : 1;
  return a.categoryName.localeCompare(b.categoryName);
}

function sectionOf(direction: MoneyDirection, categories: CategoryRow[]): ReportSection {
  const budgeted = r2(categories.reduce((s, c) => s + c.budgeted, 0));
  const actual   = r2(categories.reduce((s, c) => s + c.actual, 0));
  return { direction, categories, budgeted, actual, variance: varianceFor(direction, budgeted, actual) };
}

/**
 * ⚠⚠ THE ONE PLACE THE TWO FORMULAS LIVE (rule 6). Positive always means the good news, so a
 * screen has one colour rule and changes only its wording — revenue varies up and down, costs run
 * over and under. Written twice, this is the defect the report shape was redesigned to remove.
 */
function varianceFor(direction: MoneyDirection, budgeted: number, actual: number): number {
  return direction === 'in' ? r2(actual - budgeted) : r2(budgeted - actual);
}

function buildCategoryRow(
  bucket: Bucket, direction: MoneyDirection, side: Map<string, Entry>,
): CategoryRow {
  const items: ItemRow[] = [];
  for (const entry of side.values()) {
    const budgeted    = r2(entry.lines.reduce((s, l) => s + l.totalAmount, 0));
    const grossActual = r2(entry.costs.reduce((s, c) => s + c.amount, 0));
    const refundTotal = r2(entry.refunds.reduce((s, b) => s + b.amount, 0));
    const actual      = r2(grossActual - refundTotal);
    items.push({
      itemId: entry.itemId,
      itemName: entry.itemName,
      direction,
      budgeted,
      actual,
      grossActual,
      refundTotal,
      variance: varianceFor(direction, budgeted, actual),
      lineCount: entry.lines.length,
      costCount: entry.costs.length,
      inPlan: entry.lines.length > 0,
      periods: mergePeriods(entry.lines, entry.costs, entry.refunds),
      lines: entry.lines.map(l => ({
        id: l.id, description: l.description, notes: l.notes, totalAmount: l.totalAmount,
      })),
      costs: entry.costs.map(c => ({
        id: c.id, description: c.description, amount: c.amount, paidDate: c.paidDate,
      })),
      refunds: entry.refunds.map(b => ({
        id: b.id, description: b.description, amount: b.amount, receivedDate: b.receivedDate,
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
  return {
    categoryId: bucket.categoryId,
    categoryName: bucket.categoryName,
    direction,
    budgeted,
    actual,
    variance: varianceFor(direction, budgeted, actual),
    inPlan: items.some(i => i.inPlan),
    items,
  };
}

/**
 * Roll a season's plan and its paid spending into COST rows only — the plan page's grouping.
 *
 * ⚠ NOT A SECOND ROLLUP. It is the expenses half of `rollupMoneyReport`, so the plan list and
 * Budget vs. Actual cannot group one plan two different ways — the entire reason this module
 * exists. Anything a caller passes with `direction: 'in'` is simply absent from the result, which
 * is the correct answer for a page that is showing what the season COSTS.
 */
export function rollupBudget(lines: RollupLine[], spend: RollupSpend[]): CategoryRow[] {
  return rollupMoneyReport({ lines, spend }).expenses.categories;
}

/**
 * Merge the payment schedules of every line on one item, and place what actually moved against them.
 *
 * ⚠ THE SAME DATE FROM TWO LINES IS ONE PERIOD CARRYING THE SUM. Two lines on one item is now an
 * ordinary shape (rule 3), and listing "Nov 30" twice would report one month as two — the visual
 * twin of the per-line double-count fixed on 2026-08-15.
 *
 * Undated periods collapse into a single bucket, because a period with no date has nothing to be
 * merged BY, and two lines' worth of "just names" periods cannot be reconciled with each other.
 * That matches the month grid, which has always kept undated budget out of the month columns and
 * said so rather than smearing it.
 *
 * ⚠ MONEY BACK IS PLACED BY THE DAY IT ARRIVED and SUBTRACTS, so a period can go negative — $600
 * of permits across July and August with $325 back in September reads 300 / 300 / (325). Placing
 * it against the month the cost was paid would rewrite a month already reconciled.
 */
function mergePeriods(
  lines: RollupLine[],
  costs: RollupSpend[],
  refunds: RollupRefund[],
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

  // Each amount lands in the first period falling on or after the day it moved; anything after the
  // last dated period, and anything with no date at all, lands in the final period. Identical to
  // the rule the retired per-line module encoded, applied to a MERGED schedule instead of one line.
  const actuals = new Array<number>(periods.length).fill(0);
  const last = periods.length - 1;
  const place = (amount: number, date: string | null) => {
    if (!amount) return;
    if (date) {
      for (let i = 0; i < periods.length; i++) {
        if (!periods[i].date || periods[i].date! >= date) {
          actuals[i] += amount;
          return;
        }
      }
    }
    actuals[last] += amount;
  };

  for (const cost of costs) place(cost.amount, cost.paidDate);
  for (const back of refunds) place(-back.amount, back.receivedDate);

  return periods.map((p, i) => ({ ...p, actual: r2(actuals[i]) }));
}
