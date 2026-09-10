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
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 2026-08-17 — **MONEY ARITHMETIC HAS ONE HOME PER QUESTION**, and this module is the report's.
 *
 * The platform works out three money questions. Each has exactly one answer, deliberately:
 *
 *   · **"how much cash do we have?"** → `cashOnHandCents` (lib/coach-register.ts). Already one: the
 *     register and `money-summary` both call it, so a source added to one and not the other is a
 *     missing argument rather than a silent drift.
 *   · **"what is left to settle at season's end?"** → `lib/coach-season-settlement.ts`.
 *     ⛔ **Deliberately separate, and it stays that way.** Pure and dependency-free, it runs under
 *     plain `node --test`, which is why it is the best-tested money module here. Do not fold it in.
 *   · **"how did we do against plan?"** → HERE, and only here. Every figure on Budget vs. Actual —
 *     the statement, the Months grid, the cumulative chart — is a reading of THIS pass. **A feed on
 *     that report that walks the raw records for itself is a defect, not an optimisation.** It was
 *     three separate walks until this date; two of the three already disagreed with each other.
 *
 * The one honest exception: the report's **Scheduled** lens keeps its own raw feed, because this
 * module only knows money that has MOVED and the statement has no committed column to grow one from.
 * It is stated in the route rather than left as an omission.
 *
 * ⚠ THE HISTORY AND THE TEETH ARE NOT RESTATED HERE — they live in
 * `tests/unit/money-one-arithmetic-guard.test.ts` (the rule over the source) and
 * `scripts/check-money-report-arithmetic.mjs` (the rule over a real season's numbers). Read either
 * before adding a kind of money to that report.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Pure: no IO, no React, no Date. Dates are `YYYY-MM-DD` strings compared as strings, so a coach in
 * Toronto and a server in UTC place a cost in the same period.
 */

/** The bucket a cost with no item falls into, inside its own category. Never a real item id. */
const NO_ITEM = '__no_item__';

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
  /**
   * ALWAYS POSITIVE.
   *
   * ⚠⚠ ONE RECORD PER MOVEMENT — a payable's deposit and balance arrive as TWO of these, each on the
   * day it was actually paid. **This comment used to say they arrive "summed, on the earliest date",
   * and that was retired on 2026-08-17 for being a fiction**: no such payment was ever made, and
   * every feed that read dates off the merged record put a July balance in May. If you are here
   * because a caller looks like it is doing extra work to split a payable — that IS the work. Do not
   * merge them back.
   */
  amount: number;
  /** `YYYY-MM-DD`, or null when nothing recorded a date. */
  paidDate: string | null;
  /** Defaults to `out`. */
  direction?: MoneyDirection;
  /**
   * Set only on a DRIVE'S OR SPONSOR'S row, which is the one kind of movement here that is not one
   * movement: it sums every arrival that record has taken (owner ruling 2026-09-07 — one row per
   * drive or sponsor, so the figure opens into something with a name rather than a pool).
   *
   * ⚠⚠ IDENTITY AND DATES IN ONE FIELD BECAUSE THEY ARE ONE FACT — "this row is a roll-up of a
   * fundraising record's arrivals". Both things the panel does with it (say when the money landed,
   * and open the record) are only correct on a row where this is set.
   *
   * ⚠⚠ AND `paidDate` STAYS NULL BESIDE IT. It is genuinely not one day, and it is the dated grain
   * every month and chart feed reads — synthesising a value there would place derived money a
   * second time on feeds the cash strip already places it on correctly.
   */
  derived?: DerivedArrivals | null;
}

/**
 * How many arrivals one drive or sponsor row sums, and the days they landed between.
 *
 * ⚠ `firstDay` / `lastDay` come from the CASH STRIP'S OWN fallback (`receivedDate ?? the org-day of
 * createdAt`). Any other reading re-opens the defect this exists to close one level down: the
 * statement and the Months grid would agree on the count and disagree on the day for a legacy row.
 */
export interface DerivedArrivals {
  /** The drive or sponsor — the room this row opens to. */
  recordId: string;
  kind: 'fundraiser' | 'sponsor';
  /** How many arrivals were summed. Never 0. */
  count: number;
  /** `YYYY-MM-DD`. Equal to each other when every arrival landed on one day. */
  firstDay: string;
  lastDay: string;
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
  /** The merged payment schedule — same date from two lines is ONE period carrying the sum.
   *
   *  ⚠⚠ IT CARRIES NO `actual`, AND THAT FIELD IS DELETED RATHER THAN LEFT UNREAD (owner ruling
   *  2026-09-10, "Things, not dates"). Real money used to be PLACED against these planned dates —
   *  each amount landing in the first planned slot on or AFTER the day it moved, anything later or
   *  undated landing in the last one — so a row planned once in February reported August money as
   *  February. The plan is dated on one side and the money SWEPT onto it on the other, and the fold
   *  that displayed the result is now gone from both report shapes. The placement rule goes with
   *  it: a figure nobody can date honestly, left in the payload, is a wrong figure waiting for its
   *  next reader.
   *
   *  ⚠ THE DATES THEMSELVES STAY AND ARE LOAD-BEARING. They are the PLAN's own schedule; they drive
   *  the report's **to date** comparison basis (`budgetedOn`), and they are the list behind a
   *  Budget figure. Delete them and every to-date reading silently becomes a whole-season one. */
  periods: Array<{ label: string; date: string | null; amount: number }>;
  /** The individual lines behind the row, so the plan list can still edit one of them. */
  lines: Array<{ id: string; description: string; notes: string | null; totalAmount: number }>;
  /** The individual amounts behind the row, for the drill-in. ⚠ `derived` rides along or the panel
   *  cannot tell a one-payment record from a roll-up of eight — see `RollupSpend.derived`. */
  costs: Array<{
    id: string; description: string; amount: number; paidDate: string | null;
    derived?: DerivedArrivals | null;
  }>;
  /** The money back behind the row. Separate from `costs` on purpose — merging them would hide
   *  which records were spending and which were repayment, and one of those is the out-of-pocket
   *  trap the money-back plan's §2 exists to keep apart. */
  refunds: Array<{ id: string; description: string; amount: number; receivedDate: string | null }>;
  /**
   * ⚠⚠ ONE FAMILY'S DUES CONTRIBUTION, SPLIT — **present on a Player dues row and on nothing else**
   * (owner ruling 2026-09-10, "Things, not dates").
   *
   * ⚠ THIS ROLLUP NEVER PRODUCES IT. Dues are not budget lines and reach no rollup; the synthetic
   * dues category is assembled after the fact in `lib/coach-dues-revenue.ts` from the route's own
   * per-family pass. The field lives on this type only because a dues family row IS an `ItemRow` —
   * it has to be, or it could not sit in `CategoryRow.items` and be drawn by the one row component
   * both report shapes share, which is the entire reason Player dues stopped being a hand-rolled
   * special case.
   *
   * ⚠ IT IS WHAT THE ROW'S **ACTUAL** FIGURE OPENS, and it is the reason a player row opens a
   * different panel from every other row: an ordinary row's Actual is a list of RECORDS, a family's
   * is three kinds of contribution. The three sum to `actual` by construction.
   *
   * ⚠ DO NOT REACH FOR IT ON AN ORDINARY ROW — its absence is how the screen tells the two apart.
   */
  duesParts?: { cashKept: number; familyPaidCosts: number; fundraisingCredited: number };
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

/**
 * What a category is CALLED when it has no name — one spelling, one owner.
 *
 * ⚠ THIS RULE WAS WRITTEN OUT FOUR TIMES (`/simplify`, 2026-08-17): here, in `bucketFor`, and twice
 * in `coach-budget-months`. All four agreed, which is exactly how the last one got away with being
 * different — the grid said "Uncategorized" where the statement said "No category" and one bucket
 * read as two rows. A rule spelled four times has no owner; this is the owner.
 */
export function displayCategoryName(categoryName: string | null | undefined): string {
  return (categoryName ?? '').trim() || NO_CATEGORY_LABEL;
}

/**
 * Category identity. The id when there is one; otherwise the lowercased name, so two costs typing
 * the same category text land together rather than making two rows that look identical.
 *
 * ⚠⚠ IT NORMALISES THE NAMELESS CASE ITSELF, and that is load-bearing rather than tidy
 * (`/simplify` altitude pass, 2026-08-17). `null` and `NO_CATEGORY_LABEL` are the SAME category.
 * Before this, `categoryKey(null, null)` gave `'none'` while `categoryKey(null, 'No category')` gave
 * `'name:no category'`: **two identities for one fact.** The report's raw feeds only landed on the
 * right one because a caller remembered to pre-normalise, so the fix for the split-bucket defect was
 * a CONVENTION — and the next caller that forgot would reintroduce it invisibly. Deciding it here
 * makes forgetting impossible.
 *
 * ⚠ TWO PATHS ARRIVE CARRYING THE LABEL, and the merge is right for both (`/review`, 2026-08-17 —
 * two lenses read the first reason, correctly noticed it does not cover the second, and concluded
 * the merge was a regression):
 *   1. **a name this module already produced.** Every `CategoryRow` comes back carrying the label, so
 *      anything fed back through — the grid's rows, the report's own movements — has it by then.
 *   2. **raw free text that happens to BE the label.** A coach can type "No category" into an
 *      expense's category field, or an import can echo the platform's own placeholder back. That
 *      never had an id, so before this change it became its own bucket — and since `bucketFor` labels
 *      the nameless bucket identically, the statement rendered **two rows both called "No category"**
 *      with nothing to tell them apart. That is the duplicate-heading defect this release exists to
 *      remove, not a distinction worth keeping: the difference between "typed those two words" and
 *      "typed nothing" is invisible to a coach, and the drill-in still lists the costs individually.
 * ⚠ CASE-INSENSITIVELY, for the same reason. An exact-string test merged "No category" and left
 * "no category" as its own row — two near-identical headings, the same bug one keystroke away.
 *
 * ⚠⚠ EXPORTED BECAUSE THE MONTH GRID HAD ITS OWN, WEAKER ANSWER (2026-08-17). `coach-budget-months`
 * keyed categories by lowercased NAME alone, so the two views of one report bucketed it two
 * different ways and the same screen could show:
 *   · **one grid row where the statement shows two** — `budget_categories.name` carries no unique
 *     index, and an org's list is platform defaults ∪ its own customs, so one name with two ids is
 *     a shape the product cannot even reject (DATA_DICTIONARY, that table's `name`);
 *   · **two grid rows where the statement shows one** — spending with no category at all reached the
 *     grid as `null` (bucket "Uncategorized") while its own rows arrived from here as
 *     `NO_CATEGORY_LABEL` ("No category"), so a cost and the refund netting against it landed under
 *     two different headings. That one was live.
 * One function, both modules. Two reports cannot line up on identity they each derive privately.
 */
/**
 * A MONEY-IN line's GROUP is its CATEGORY (owner ruling 2026-09-09) — the same identity a cost line
 * already has here, so the plan list, the by-period grid, both plan files and the Months view cannot
 * group one funding line four ways. Before this the plan grouped money in by its stored KIND (who
 * fills the number in), the Statement by category and Months by source — and a coach who filed a
 * concession stand under Tournaments found the word "Tournaments" nowhere on the funding side.
 *
 * Keyed by ID, never by name (two categories may share a name — see `categoryKey`); a line with no
 * category at all lands in the nameless bucket under the one spelling every surface uses.
 */
export interface CategoryGroupRef {
  key: string;
  name: string;
  categoryId: string | null;
}
export function categoryGroupOf(
  line: { categoryId?: string | null; categoryName?: string | null },
): CategoryGroupRef {
  const categoryId = line.categoryId ?? null;
  return {
    key: categoryKey(categoryId, line.categoryName ?? null),
    name: displayCategoryName(line.categoryName),
    categoryId,
  };
}

/**
 * Order groups the way the picker lists categories — sort order, then name — with the nameless
 * bucket last. `order` is the picker's category id → sort_order map; a group whose order is unknown
 * (a category the list has no row for) sorts after the known ones, alphabetically. With no map at
 * all the order is alphabetical — the List's own rule for cost categories.
 */
export function compareCategoryGroups(
  order?: ReadonlyMap<string, number>,
): (a: CategoryGroupRef, b: CategoryGroupRef) => number {
  const orderOf = (id: string | null) => (id ? order?.get(id) : undefined);
  return (a, b) => {
    const aNone = a.key === 'none';
    const bNone = b.key === 'none';
    if (aNone !== bNone) return aNone ? 1 : -1;
    const ao = orderOf(a.categoryId);
    const bo = orderOf(b.categoryId);
    if (ao !== undefined && bo !== undefined && ao !== bo) return ao - bo;
    if ((ao === undefined) !== (bo === undefined)) return ao === undefined ? 1 : -1;
    return a.name.localeCompare(b.name);
  };
}

/**
 * Bucket anything that carries a category by its category, in the picker's order — THE one shape
 * every surface that lists money in by category reads (the plan list's funding sections and its
 * forgetting-list index, both plan files). Written once because it was written three times in one
 * release, and a grouping rule that lives in three places is three places to miss on a fix.
 */
export function groupByCategory<T>(
  items: readonly T[],
  refOf: (item: T) => CategoryGroupRef,
  order?: ReadonlyMap<string, number>,
): Array<{ ref: CategoryGroupRef; items: T[] }> {
  const byKey = new Map<string, { ref: CategoryGroupRef; items: T[] }>();
  for (const item of items) {
    const ref = refOf(item);
    const bucket = byKey.get(ref.key) ?? { ref, items: [] };
    bucket.items.push(item);
    byKey.set(ref.key, bucket);
  }
  const cmp = compareCategoryGroups(order);
  return [...byKey.values()].sort((a, b) => cmp(a.ref, b.ref));
}

/** One row on a plan list: the WORD, and every line filed against it. */
export interface ItemGroup<T> {
  /** Stable row key. `item:<id>`, or `line:<id>` for a line carrying no word at all. */
  key: string;
  itemId: string | null;
  /** What the row is CALLED. The item's name; for a word-less line, its own stored text. */
  itemName: string;
  total: number;
  lines: T[];
}

/**
 * Bucket plan lines by the WORD they are filed against — rule 2 and rule 3, applied to a flat list.
 *
 * ⚠⚠ WHY THIS EXISTS RATHER THAN A SECOND COPY IN THE PANEL (owner ruling 2026-09-09). The money-in
 * side of the plan listed one row per LINE, named by a typed description, while the by-period grid
 * merged the same lines by item and Budget vs. Actual merged them too. One plan, three shapes. The
 * cost side has grouped by item since 2026-08-15 through `rollupBudget`; this is the same rule for
 * the money-in list and both plan exports, written ONCE so those two cannot drift apart the way the
 * three surfaces above did.
 *
 * ⚠ ALPHABETICAL, and the money-in list changes order because of it (owner ruling, decision A1). It
 * previously kept the coach's creation order. One rule for the whole table was chosen over a
 * special case for half of it; `buildCategoryRow`'s item sort is the same comparison.
 *
 * ⚠ A LINE WITH NO WORD STAYS ITS OWN ROW, keyed on the line, and wears its stored text — it has
 * nothing else to be named by. These are pre-mig-243 money-in lines; they sort last, exactly as the
 * report's nameless bucket does. **Never merge them together**: two word-less lines have two
 * different stored texts and no honest way to choose between them.
 *
 * ⚠ IDS, NEVER NAMES. Two words can legitimately share a name across ownership tiers; merging on the
 * name is the 2026-08-15 "Officials twice" defect wearing a new hat.
 */
export function groupByItem<T extends {
  id: string;
  itemId: string | null;
  itemName?: string | null;
  description: string;
  totalAmount: number;
}>(lines: readonly T[]): Array<ItemGroup<T>> {
  const byKey = new Map<string, ItemGroup<T>>();
  lines.forEach((line, i) => {
    /* ⚠⚠ THE INDEX IS A TIEBREAKER, NOT DECORATION (`/review`, blast-radius lens, 2026-09-09,
       REPRODUCED BY EXECUTION). A word-less line keys on its own id — but a caller that omits
       `id` gave EVERY word-less line the key `line:undefined`, and two unrelated rows silently
       SUMMED into one. It happened on the PDF exhibit fixture the moment this function took over
       the money-in side: a $1,800 fundraiser and a $1,500 sponsorship became one $3,300 row and
       the sponsorship vanished from the page meant to demonstrate this very feature. The type
       says `id: string`, but that fixture is untypechecked JS, so nothing said a word.
       ⚠ MERGING TWO ROWS IS THE ONE THING THIS FUNCTION MUST NEVER DO BY ACCIDENT, so it no
       longer trusts the caller for the only key that can collide. */
    const key = line.itemId ? `item:${line.itemId}` : `line:${line.id ?? `#${i}`}`;
    const bucket = byKey.get(key) ?? {
      key,
      itemId: line.itemId,
      itemName: (line.itemId ? line.itemName?.trim() : '') || line.description,
      total: 0,
      lines: [] as T[],
    };
    bucket.lines.push(line);
    bucket.total = r2(bucket.total + (Number(line.totalAmount) || 0));
    byKey.set(key, bucket);
  });
  return [...byKey.values()].sort(compareItemRows);
}

/**
 * HOW ITEM ROWS ORDER, in one place — alphabetical, with the word-less bucket last.
 *
 * ⚠ IT WAS WRITTEN TWICE. `groupByItem` above and `buildCategoryRow` below sorted with the same
 * two comparisons, and `groupByItem`'s own comment admitted it ("buildCategoryRow's item sort is
 * the same comparison") rather than resolving it. `compareCategoryGroups` is the precedent one
 * level up: the category order is an exported comparator, and the item order had no equivalent.
 *
 * ⚠ THE PLANNED/UNPLANNED SPLIT IS THE REPORT'S ALONE and stays at its call site — a plan list has
 * no unplanned rows to sort, so folding `inPlan` in here would be a term one caller can never use.
 */
export function compareItemRows(
  a: { itemId: string | null; itemName: string },
  b: { itemId: string | null; itemName: string },
): number {
  if ((a.itemId === null) !== (b.itemId === null)) return a.itemId === null ? 1 : -1;
  return a.itemName.localeCompare(b.itemName);
}

/** The category id a grid/report key carries, when it carries one — the inverse of `categoryKey`
 *  for id-keyed rows, so no reader parses the `id:` prefix for itself. Null for a name-keyed or
 *  nameless row. */
export function categoryIdOfKey(key: string | null | undefined): string | null {
  return key && key.startsWith('id:') ? key.slice(3) : null;
}

export function categoryKey(categoryId: string | null, categoryName: string | null): string {
  if (categoryId) return `id:${categoryId}`;
  const name = displayCategoryName(categoryName).toLowerCase();
  return name === NO_CATEGORY_LABEL.toLowerCase() ? 'none' : `name:${name}`;
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
        categoryName: displayCategoryName(categoryName),
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
        /* ⚠ A ROW WITH NO ITEM MAY STILL KNOW WHAT IT IS (owner ruling 2026-09-07). "Not itemized"
           is right for a COST filed under no item — the name is a prompt to go and plan one, and the
           figure still opens into real records. It was wrong for the derived revenue pool, which has
           no budget item by construction and yet knows perfectly well that it is sponsor money: the
           season's second-largest revenue line read "Not itemized" while the panel behind it already
           said "From your sponsors". A supplied name now wins; `null` still falls back, so every
           cost behaves exactly as before. */
        itemName: (itemName ?? '').trim() || NO_ITEM_LABEL,
        lines: [], costs: [], refunds: [],
      };
      side.set(key, entry);
    }
    if (itemName && entry.itemName === NO_ITEM_LABEL) entry.itemName = itemName.trim();
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
    // Same ruling as the statement's — one report, one place for the nameless bucket.
    const nameless = Number(isNamelessCategory(a)) - Number(isNamelessCategory(b));
    if (nameless !== 0) return nameless;
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

/**
 * Is this the bucket for money filed under no category at all?
 *
 * Asked through `categoryKey` rather than by comparing the label, because that function is the one
 * owner of "these two facts are the same category" — a coach who types the placeholder's own words
 * into a category field lands in the same bucket, and this has to agree with that or the row it
 * sorts is not the row it tested.
 */
function isNamelessCategory(row: { categoryId: string | null; categoryName: string }): boolean {
  return categoryKey(row.categoryId, row.categoryName) === 'none';
}

/**
 * ⚠ THE NAMELESS BUCKET SORTS LAST (owner ruling 2026-09-04, QA §133) — it is not a category, it is
 * the absence of one, so it does not take its turn in the alphabet. This rule already existed one
 * level DOWN, where "Not itemized" is pushed to the end of its group with the reason stated: *a gap
 * to close, not a row to read.* The category level simply never got it, which is why "No category"
 * jumped ahead of "Tournaments" in Revenue while looking correctly last under Expenses — the same
 * comparator, flattered by the alphabet on one side and exposed by it on the other.
 *
 * In full: planned categories first, then the ones the team only moved money in; alphabetical
 * inside each, and the nameless bucket last wherever it falls.
 */
function compareCategories(a: CategoryRow, b: CategoryRow): number {
  if (a.inPlan !== b.inPlan) return a.inPlan ? -1 : 1;
  const nameless = Number(isNamelessCategory(a)) - Number(isNamelessCategory(b));
  if (nameless !== 0) return nameless;
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
/**
 * ⚠ EXPORTED SINCE 2026-09-10 (`/simplify`), and the reason is worth keeping: the synthetic
 * Player-dues rows are assembled OUTSIDE this module (`lib/coach-dues-revenue.ts`) and were
 * hand-deriving the income branch of this formula — `r2(actual - budgeted)` — with rule 6 cited by
 * name in a comment beside it. Rule 6 was then named in three places and codified in one, which is
 * the "two derivations that happen to agree" shape this report has twice been consolidated to
 * remove. Anything building a row for this report calls this rather than restating it.
 */
export function varianceFor(direction: MoneyDirection, budgeted: number, actual: number): number {
  return direction === 'in' ? r2(actual - budgeted) : r2(budgeted - actual);
}

/**
 * ⚰ `rowLabel` STOOD HERE AND IS GONE (owner ruling 2026-09-09). It was the ONE amendment to "the
 * item names the row": a revenue row wore the coach's TYPED description when its item held exactly
 * one line — ruled 2026-09-06 (QA §146) after the owner saw the Budget list say "Chocolate sale"
 * while Budget vs. Actual said "Fundraising drive".
 *
 * ⚠⚠ IT WAS UNREACHABLE FOR ANYTHING A COACH COULD CREATE, which is why it went rather than being
 * fixed. The money-in Description input was deleted on 2026-08-16, when mig 243 made a category and
 * an item required in both directions — three weeks BEFORE the amendment was ruled. From that day
 * the form stored the ITEM'S OWN NAME in that column, so the amendment read it back and printed
 * "Fundraising drive": the exact label the ruling called worse. Only seeded rows and rows written
 * before 2026-08-16 could ever show anything else.
 *
 * ⚠ THE INTENT SURVIVES BY A BETTER ROUTE. A coach who wants their plan to say "Chocolate sale"
 * CREATES that word; it then names the row on every surface, is offered to the next drive, and
 * survives the rollover. One record, one name.
 *
 * **Do not reinstate a label that reads a description.** The 2026-08-15 defect it re-opens is a
 * coach picking "Entry Fees" and their plan rendering a row called "test". Two rules from the old
 * essay survive and are worth keeping: match on IDS, never names (two words legitimately share a
 * spelling across tiers), and never rename "Not itemized" — that row is a gap to close, not a line
 * with a name.
 */

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
      // The WORD names the row, in both directions (owner ruling 2026-09-09).
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
      periods: mergeSchedules(entry.lines),
      lines: entry.lines.map(l => ({
        id: l.id, description: l.description, notes: l.notes, totalAmount: l.totalAmount,
      })),
      costs: entry.costs.map(c => ({
        id: c.id, description: c.description, amount: c.amount, paidDate: c.paidDate,
        derived: c.derived ?? null,
      })),
      refunds: entry.refunds.map(b => ({
        id: b.id, description: b.description, amount: b.amount, receivedDate: b.receivedDate,
      })),
    });
  }

  // Planned items first, then unplanned; alphabetical inside each, with the "Not itemized"
  // prompt last wherever it falls — it is a gap to close, not a row to read.
  items.sort((a, b) => {
    // Planned rows lead; everything below that is the shared item order.
    if (a.inPlan !== b.inPlan) return a.inPlan ? -1 : 1;
    return compareItemRows(a, b);
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
 * Merge the payment schedules of every line on one item — the PLAN's own dates, and nothing else.
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
 * ⚠⚠ IT USED TO PLACE THE ACTUALS TOO, AND IT WAS CALLED `mergePeriods` FOR IT (deleted by owner
 * ruling 2026-09-10, "Things, not dates"). Each amount that moved landed in the first planned slot
 * on or after the day it moved, and anything after the last dated slot — or with no date at all —
 * landed in the final one. On a line planned across five months that read correctly and usefully;
 * on a line with ONE planned slot in February it reported August money as February, which is what
 * the owner hit on the §157 walk. The proof that it could not be repaired is short: dating one side
 * honestly requires dating the other, and dating the other means a row per line per month on both
 * halves of a report meant to be read in one screen.
 *
 * ⚠ SO THE ONE HONEST HOME FOR "WHEN DID THIS MOVE?" IS THE **MONTHS VIEW**, where both sides are
 * dated the same way — and the one honest home for "what is this figure made of?" is the panel
 * behind the figure, where a date belongs to the RECORD that carries it. If you are about to bring
 * the placement back for a good local reason, those two are the reason you do not need to.
 *
 * ⚠ THE REFUND NOTE THAT LIVED HERE WENT WITH THE ARITHMETIC: money back was placed by the day it
 * arrived and SUBTRACTED, so a period could go negative. Nothing reads a period's actual now, so
 * there is nothing for a refund to be netted out of.
 */
function mergeSchedules(
  lines: RollupLine[],
): Array<{ label: string; date: string | null; amount: number }> {
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

  return [...byDate.values()].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
}
