/**
 * WHO OWNS A BUDGET ITEM, AND WHOSE PICKER IT APPEARS IN (mig 240).
 *
 * The item is now the name of a budget row and the key both reports line up on, so the list it is
 * chosen from stopped being decoration. Owner ruling 2026-08-15:
 *
 *   > "custom items are team wide but should be viewable by the club, we shouldn't populate 1
 *   >  team's list with another team. Perhaps we can have an org create ones that they want to send
 *   >  to all teams but not from team to team."
 *
 * Three tiers, and the rule is one-directional:
 *
 *   • **platform** — ours. Everyone sees it, nobody edits it.
 *   • **club**     — an org admin's. Every team in that org sees it.
 *   • **team**     — a coach's. **That team's picker only.**
 *
 * ⚠ A TEAM'S ITEM NEVER REACHES ANOTHER TEAM BY ITSELF. A club admin can see every team's items and
 * PUBLISH one to all teams, which promotes it to the club tier. There is deliberately no reverse:
 * an item a team is already planning against cannot be taken back from it.
 *
 * ⚠ THIS IS WHY THE OLD SENTENCE ON THE COACH'S "+ add custom item" FORM IS NOW A LIE. It promised
 * the item would be "saved to your org's library and become selectable for all coaches", which was
 * true until this migration and is exactly the copy most likely to be missed in this change.
 *
 * Pure except for `resolveBudgetItem`, which is the one place the database is consulted.
 */

import { supabaseAdmin } from './supabase-admin';

export type BudgetItemTier = 'platform' | 'club' | 'team';

/** Anything with the two ownership columns — the shape every reader here needs and no more. */
export interface OwnedBudgetItem {
  org_id?: string | null;
  team_id?: string | null;
}

/** Which tier an item belongs to. ONE definition: three surfaces label these and they must agree. */
export function budgetItemTier(item: OwnedBudgetItem): BudgetItemTier {
  if (!item.org_id) return 'platform';
  return item.team_id ? 'team' : 'club';
}

/** Coach-facing tier names. "Club" is deliberately not "Org" — a coach reads their club's name. */
export const ITEM_TIER_LABEL: Record<BudgetItemTier, string> = {
  platform: 'Standard',
  club:     'Club',
  team:     'This team',
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

export interface ResolvedBudgetItem {
  id: string;
  categoryId: string;
  /** The item's own name — what the budget row is called from now on. */
  name: string;
  /** The category's name, for the free-text `category` column every legacy reader still uses. */
  categoryName: string | null;
}

export type BudgetItemResult =
  /** `item: null` = none chosen. The caller keeps whatever category it was given. */
  | { ok: true; item: ResolvedBudgetItem | null }
  | { ok: false; error: string };

/**
 * Resolve (and authorise) an incoming item id, for any door that writes one.
 *
 * The category is DERIVED from the item rather than trusted from the request — an item belongs to
 * exactly one category, so accepting both would let a caller file a cost under a category its own
 * item does not live in, and the two levels of the report would disagree about the same row.
 */
export async function resolveBudgetItem(
  itemId: unknown,
  orgId: string,
  teamId: string,
): Promise<BudgetItemResult> {
  if (itemId === null || itemId === undefined || itemId === '') return { ok: true, item: null };
  if (typeof itemId !== 'string') {
    return { ok: false, error: 'budgetItemId must be a budget item id, or null' };
  }

  const { data } = await supabaseAdmin
    .from('budget_items')
    .select('id, category_id, org_id, team_id, name, budget_categories(name)')
    .eq('id', itemId)
    .maybeSingle();

  // One message for "another club's", "another team's" and "no such item": they are the same answer
  // to the coach, and separating them would confirm the existence of another team's rows to anyone
  // who guessed an id.
  if (!data || !itemVisibleToTeam(data as OwnedBudgetItem, orgId, teamId)) {
    return { ok: false, error: 'That budget item is not available to this team.' };
  }

  const row = data as Record<string, unknown>;
  return {
    ok: true,
    item: {
      id: row.id as string,
      categoryId: row.category_id as string,
      name: row.name as string,
      categoryName: ((row.budget_categories as { name?: string } | null)?.name) ?? null,
    },
  };
}

/**
 * Every item this team may pick from, newest tier last so a club's own words sit under ours.
 *
 * ⚠ `.or()` cannot express "mine or the club's but not another team's" in one filter without
 * risking a precedence mistake that silently widens it, so the visibility rule is applied in
 * JavaScript through the same predicate the write paths use. The row count here is a library, not
 * a ledger — tens of rows, never thousands.
 */
export async function listVisibleBudgetItems(orgId: string, teamId: string) {
  const { data } = await supabaseAdmin
    .from('budget_items')
    .select('*')
    .or(`org_id.is.null,org_id.eq.${orgId}`);
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter(row => itemVisibleToTeam(row as OwnedBudgetItem, orgId, teamId));
}
