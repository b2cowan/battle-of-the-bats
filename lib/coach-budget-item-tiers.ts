/**
 * WHO OWNS A BUDGET WORD — the pure half, safe on the client.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE OF ONE IMPORT LINE. `lib/coach-budget-items.ts` holds the same rules
 * plus the database reads, and it imports `supabase-admin` — which constructs the SERVICE-ROLE
 * client and runs an environment assertion **at module load**. The moment a `'use client'`
 * component imported `budgetItemTier` from there, that whole graph joined the browser bundle.
 *
 * It would not have thrown, and that is exactly why it is worth a file: the service key is not a
 * `NEXT_PUBLIC_` variable so nothing leaks, the assertion passes in both dev and production, and
 * the only symptom is `@supabase/supabase-js` and an admin client quietly riding into the client
 * bundle of every screen that shows the item picker. Nothing would ever have told us.
 *
 * ⚠ SO THE RULE IS THE IMPORT DIRECTION: this module imports nothing but types. The server module
 * re-exports everything here, so server callers keep one door and there is still exactly one
 * definition of each rule.
 *
 * Three tiers, and the rule is one-directional:
 *
 *   • **platform** — ours. Everyone sees it, nobody edits it.
 *   • **club**     — an org admin's. Every team in that org sees it.
 *   • **team**     — a coach's. **That team's picker only.**
 */

export type BudgetItemTier = 'platform' | 'club' | 'team';

/** Anything with the ownership columns and the sport tag — all any reader here needs. */
export interface OwnedBudgetItem {
  org_id?: string | null;
  team_id?: string | null;
  /** mig 241 — which sports this is offered to. Null/absent = every sport, the common case. */
  sports?: string[] | null;
}

/** Which tier an item belongs to. ONE definition: four surfaces label these and they must agree. */
export function budgetItemTier(item: OwnedBudgetItem): BudgetItemTier {
  if (!item.org_id) return 'platform';
  return item.team_id ? 'team' : 'club';
}

/**
 * Coach-facing tier names — the words on the chips in the picker and the item manager.
 *
 * ⚠ "Club" is deliberately not "Org": a coach reads their club's name, not the product's word for a
 * tenant.
 *
 * ⚠ "Our own", not "This team" (owner mockup 484b5971, 2026-08-17). Every surface showing this is a
 * coach looking at their OWN team's list, where "This team" reads like a column header on a club
 * report. It also matches the door it is reached through — *Manage our items*.
 *
 * ⚠⚠ THESE CHIPS ARE WHAT PAY FOR PUBLISHING NO LONGER DELETING. Since the item-integrity ruling a
 * club's *Grant* and a team's own *Grant* are two legitimate rows rather than something to merge
 * away — which is only safe while a coach can tell them apart at the moment of choosing.
 */
export const ITEM_TIER_LABEL: Record<BudgetItemTier, string> = {
  platform: 'Standard',
  club:     'Club',
  team:     'Our own',
};

/**
 * May this team see this item in its picker?
 *
 * ⚠ THE WHOLE RULE IN ONE PREDICATE, because "which items can I pick?" is asked by the item list,
 * the budget-line write path AND the expense write path, and a list that offers what a write path
 * refuses is the drift this exists to stop.
 */
export function itemVisibleToTeam(item: OwnedBudgetItem, orgId: string, teamId: string): boolean {
  if (!item.org_id) return true;                 // platform default
  if (item.org_id !== orgId) return false;       // another club's, at any tier
  return !item.team_id || item.team_id === teamId;
}
