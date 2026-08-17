/**
 * WHAT POINTS AT A BUDGET WORD, AND WHAT A COACH CALLS IT — the pure half, safe on the client.
 *
 * ⚠⚠ THIS FILE IS SPLIT OUT FOR THE SAME REASON `coach-budget-item-tiers.ts` IS, and that reason is
 * one import line: `lib/coach-budget-items.ts` holds these rules plus the database reads, and it
 * imports `supabase-admin` — which constructs the SERVICE-ROLE client and runs an environment
 * assertion at module load. The fold's confirmation is written in the browser ("2 budget lines,
 * 3 recorded costs and 1 money in"), so a `'use client'` component has to reach `describeBudgetItemUsage`
 * — and reaching it through the server module would have pulled that whole graph into the bundle of
 * every screen with an item picker, silently. So the RULE is the import direction: this module
 * imports nothing at all. The server module re-exports everything here, so server callers keep one
 * door and there is still exactly one definition of each rule.
 *
 * ⚠ The phrasing lives here rather than being rebuilt per surface because the four record kinds must
 * never be named four different ways: a refusal that says "money in", a confirmation that says
 * "income records" and an export that says "arrivals" are three answers to one question.
 */

/**
 * ⚠⚠ EVERYTHING THAT POINTS AT A BUDGET WORD — the single list every guard and the fold count from.
 *
 * All four foreign keys are `ON DELETE SET NULL`, which is deliberate for a genuine deletion (a
 * record keeps its money and reads as the honest gap it now is) and catastrophic for a MERGE: the
 * rows must be re-pointed first, or the money survives with its classification silently gone.
 *
 * **This list exists because that is exactly how it went wrong.** The publish route was written
 * when two of these existed, named them both in a careful comment about re-pointing before
 * deleting, and was never revisited when `rep_team_money_in` arrived with migration 243 — so every
 * income and refund filed against an absorbed word lost its item, quietly, on a path that reported
 * success. `org_budget_lines` is the fourth, and today it is safe only by ACCIDENT: publish absorbs
 * team-owned rows only, and the Org Budget can pick nothing but club and platform words. Nothing
 * stated that, which is the same silence the third one lived in.
 *
 * ⚠ `tests/unit/budget-item-references-guard.test.ts` reads the committed schema snapshot and FAILS
 * THE BUILD when a foreign key to `budget_items` exists that this list does not cover, or when a
 * column named here has gone. Adding a table is one edit; forgetting one is a red build instead of
 * silent data loss two releases later.
 */
export interface BudgetItemReference {
  /** The table holding the link. */
  table: string;
  /** The column pointing at `budget_items.id`. */
  column: string;
  /**
   * ⚠⚠ THE CATEGORY IS STORED BESIDE THE ITEM ON EVERY ONE OF THESE ROWS, and it has to travel with
   * it. Each write path derives this column from the chosen item rather than trusting the caller,
   * precisely so the two levels of the report can never disagree about one row.
   *
   * ⚠ AND THE READERS DO NOT AGREE ON WHICH TO TRUST, which is the real reason both must move
   * (/review, data lens, 2026-08-17 — an earlier version of this note claimed the report always
   * prefers the stored column, and that is only true of some of it). Budget vs. Actual's month
   * attribution takes the STORED category first and falls back to the item's; its cost placement
   * derives from the ITEM first and falls back to the stored one. Two readers, two orders — so a
   * fold across categories that moved only `column` would leave the same row reported under two
   * different headings depending on which part of the page was asking, with the money all still
   * there and none of it lining up with the plan it belongs to.
   *
   * That is the original bug — a link the mover forgot — one column to the right. It is in the list
   * for the same reason the tables are.
   */
  categoryColumn: string;
  /**
   * The free-text category NAME, where a table also keeps one (`rep_team_expenses` alone).
   *
   * ⚠ A LEGACY COLUMN THAT IS STILL WRITTEN. Rows saved before the taxonomy existed carry only
   * this, and the report falls back to matching it by name when no category id is set — so leaving a
   * stale name behind would be a second, quieter answer to "what heading is this under?".
   */
  categoryNameColumn?: string;
  /**
   * A NOT NULL text column that the SERVER fills from the item's own name when the coach types
   * nothing — so it is the item's name wearing a different hat, and it has to follow the item.
   *
   * ⚠⚠ ONLY `rep_budget_lines.description`, and only because the product already made this rule
   * explicit: the line editor re-syncs this column whenever a line's item changes and no
   * description was sent, with the comment *"the NOT NULL text column follows the item, so anything
   * reading it raw shows something true."* The Budget Plan renders it raw. A fold is an item change
   * to that same table, so a fold that skipped it would leave the plan showing the name of a word
   * that no longer exists, on a row now filed under a different one.
   *
   * ⚠ IT IS ONLY SAFE TO REWRITE WHERE IT STILL EQUALS THE OLD ITEM'S NAME. Anything else is text a
   * coach typed, and no fold has any business rewriting that.
   */
  autoNameColumn?: string;
  /** What a coach calls these records, for the sentence a refusal or a confirmation has to write. */
  label: string;
}

export const BUDGET_ITEM_REFERENCES: readonly BudgetItemReference[] = [
  { table: 'rep_budget_lines',  column: 'item_id',        categoryColumn: 'category_id',        autoNameColumn: 'description', label: 'budget lines' },
  { table: 'rep_team_expenses', column: 'budget_item_id', categoryColumn: 'budget_category_id', categoryNameColumn: 'category', label: 'recorded costs' },
  { table: 'rep_team_money_in', column: 'budget_item_id', categoryColumn: 'budget_category_id', label: 'money in' },
  { table: 'org_budget_lines',  column: 'item_id',        categoryColumn: 'category_id',        label: 'club budget lines' },
  /* ⚠ THE FIFTH AND SIXTH ARRIVED WITH MIGRATION 250 (money redesign P4), and they are here in the
     same commit as that migration ON PURPOSE — this list is the thing the 2026-08-17 defect was
     about. `rep_team_money_in` was the third table, added by mig 243, and NOT added here; every
     income and refund filed against an absorbed word lost its item silently. Club money is now the
     fourth and fifth kind of record that can point at a coach's budget word, and it reaches Budget
     vs. Actual through that pointer alone — so a fold or a publish that re-pointed the other four
     and skipped these would leave the season's LARGEST line on a club-run team filed under a word
     that no longer exists.

     ⚠ The filing lives on `rep_allocation_splits`, not on `rep_cost_allocations`: the parent is the
     CLUB's object spanning every team it was divided across, and two teams may legitimately file
     one shared cost under different words. The split is this team's share, and the coach files it. */
  { table: 'rep_team_payment_requests', column: 'budget_item_id', categoryColumn: 'budget_category_id', label: 'club requests' },
  { table: 'rep_allocation_splits',     column: 'budget_item_id', categoryColumn: 'budget_category_id', label: 'club bills' },
] as const;

/** How many records of each kind point at these words — the count every guard and the fold need. */
export interface BudgetItemUsage {
  /** Total across every table. Zero means the word is safe to remove. */
  total: number;
  /** Per-kind, in `BUDGET_ITEM_REFERENCES` order, dropping the kinds with nothing in them.
   *  ⚠ READONLY. This is a report, not a working list — and the empty one below is a single shared
   *  instance handed back by reference, so a caller that pushed into it would poison every later
   *  "nothing is filed against this" answer in the process. Those answers decide whether a word can
   *  be removed. Nothing mutates it today; the type is what keeps that true. */
  byKind: ReadonlyArray<{ label: string; count: number }>;
}

/**
 * Nothing filed against anything — the answer for an empty selection, spelled once.
 *
 * ⚠ FROZEN, because it is handed back BY REFERENCE rather than copied. No caller mutates it today
 * (checked), but one that did would poison every later "nothing is filed against this" answer in the
 * process — and those answers decide whether a word can be removed.
 */
export const NO_BUDGET_ITEM_USAGE: BudgetItemUsage = Object.freeze({
  total: 0, byKind: Object.freeze([] as BudgetItemUsage['byKind']),
});

/**
 * Add up what several words hold between them.
 *
 * ⚠ THE FOLD SELECTS MANY WORDS AND CONFIRMS ONCE, so the sentence is about the selection, not about
 * any one word — and the browser already knows each word's own counts. Summing here rather than
 * asking the server again is what keeps the confirmation truthful as a coach ticks boxes.
 *
 * ⚠ ORDERED BY `BUDGET_ITEM_REFERENCES`, never by whichever word happened to be ticked first: the
 * kinds must read in the same order in the confirmation as they do in a refusal.
 */
export function sumBudgetItemUsage(usages: Array<BudgetItemUsage | undefined>): BudgetItemUsage {
  const counts = new Map<string, number>();
  for (const usage of usages) {
    for (const kind of usage?.byKind ?? []) {
      counts.set(kind.label, (counts.get(kind.label) ?? 0) + kind.count);
    }
  }
  const byKind = BUDGET_ITEM_REFERENCES
    .map(ref => ({ label: ref.label, count: counts.get(ref.label) ?? 0 }))
    .filter(k => k.count > 0);
  return { total: byKind.reduce((n, k) => n + k.count, 0), byKind };
}

/** "2 budget lines, 6 recorded costs and 1 money in" — the phrase every refusal and confirmation
 *  builds its sentence around, so the four kinds are never named four different ways. */
export function describeBudgetItemUsage(usage: BudgetItemUsage): string {
  const parts = usage.byKind.map(k => `${k.count} ${k.label}`);
  if (parts.length === 0) return 'nothing';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
