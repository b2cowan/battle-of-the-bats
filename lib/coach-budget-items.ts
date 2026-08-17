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
import { normalizeSportId } from './sports';
import type { BudgetItem, BudgetItemDirection } from './types';

/* ⚠⚠ THE TIER RULES MOVED TO `coach-budget-item-tiers.ts` (2026-08-17) AND ARE RE-EXPORTED HERE, so
   every existing server caller keeps one door. The split is not tidying: THIS module imports
   `supabase-admin`, which builds the service-role client and runs an environment assertion at module
   load — so the moment a `'use client'` component imported `budgetItemTier` from here, that whole
   graph joined the browser bundle. It would not have thrown and nothing would have reported it. Read
   that file's header before moving anything back. */
export {
  budgetItemTier, itemVisibleToTeam, ITEM_TIER_LABEL,
  type BudgetItemTier, type OwnedBudgetItem,
} from './coach-budget-item-tiers';
import { budgetItemTier, itemVisibleToTeam, type OwnedBudgetItem } from './coach-budget-item-tiers';

/**
 * ⚠⚠ EVERYTHING THAT POINTS AT A BUDGET WORD — the single list every guard counts from.
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
 * THE BUILD when a foreign key to `budget_items` exists that this list does not cover. Adding a
 * table here is one edit; forgetting one is a red build instead of silent data loss two releases
 * later.
 */
export interface BudgetItemReference {
  /** The table holding the link. */
  table: string;
  /** The column pointing at `budget_items.id`. */
  column: string;
  /** What a coach calls these records, for the sentence a refusal has to write. */
  label: string;
}

export const BUDGET_ITEM_REFERENCES: readonly BudgetItemReference[] = [
  { table: 'rep_budget_lines',  column: 'item_id',        label: 'budget lines' },
  { table: 'rep_team_expenses', column: 'budget_item_id', label: 'recorded costs' },
  { table: 'rep_team_money_in', column: 'budget_item_id', label: 'money in' },
  { table: 'org_budget_lines',  column: 'item_id',        label: 'club budget lines' },
] as const;

/** How many records of each kind point at these words — the count every guard and the fold need. */
export interface BudgetItemUsage {
  /** Total across every table. Zero means the word is safe to remove. */
  total: number;
  /** Per-kind, in `BUDGET_ITEM_REFERENCES` order, dropping the kinds with nothing in them. */
  byKind: Array<{ label: string; count: number }>;
}

/**
 * Count what is filed against one or more words.
 *
 * ⚠ COUNTS EVERY TABLE IN THE LIST, ALWAYS. A guard that counts three of the four is the original
 * bug wearing a newer comment — which is why this takes no "which tables" parameter.
 */
export async function countBudgetItemUsage(itemIds: string[]): Promise<BudgetItemUsage> {
  if (itemIds.length === 0) return { total: 0, byKind: [] };

  const counts = await Promise.all(BUDGET_ITEM_REFERENCES.map(async ref => {
    const { count } = await supabaseAdmin
      .from(ref.table)
      .select('id', { count: 'exact', head: true })
      .in(ref.column, itemIds);
    return { label: ref.label, count: count ?? 0 };
  }));

  return {
    total:  counts.reduce((n, c) => n + c.count, 0),
    byKind: counts.filter(c => c.count > 0),
  };
}

/** "2 budget lines, 6 recorded costs and 1 money in" — the phrase every refusal and confirmation
 *  builds its sentence around, so the four kinds are never named four different ways. */
export function describeBudgetItemUsage(usage: BudgetItemUsage): string {
  const parts = usage.byKind.map(k => `${k.count} ${k.label}`);
  if (parts.length === 0) return 'nothing';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * WHICH SIDE OF THE BOOKS A WORD BELONGS TO (mig 243, mandatory since mig 246).
 *
 * ⚠ NOT NULLABLE, and that is the migration's whole point — see the note on `BudgetItem.direction`.
 * Re-exported from here because this module owns every RULE about it (the parser, the refusal
 * sentence, the mapper), so a caller reaching for those takes the type from the same door.
 */
export type { BudgetItemDirection };

/**
 * Read a direction off an untrusted request body.
 *
 * ⚠ ONE PARSER, THREE WRITE DOORS (/simplify, altitude + reuse lenses, 2026-08-16). The coach item
 * POST, the club-admin item POST and the coach item PATCH each hand-rolled this check on the day
 * they were written, and the three had **already drifted on arrival**: two normalised-then-tested
 * for null with one sentence, the third tested for inequality with a different one. A rule with
 * three spellings on its first day has no chance of surviving its fourth call site.
 */
export function parseBudgetItemDirection(raw: unknown): BudgetItemDirection | null {
  return raw === 'in' || raw === 'out' ? raw : null;
}

/** The one sentence every door refuses with, so a coach meets one wording wherever they are. */
export const BUDGET_ITEM_DIRECTION_REQUIRED =
  'direction is required and must be "in" or "out" — an item has to belong to one side';

/**
 * A `budget_items` row → the shape every client reads.
 *
 * ⚠ ONE MAPPER, THREE ROUTES (/simplify, 2026-08-16). This was copied byte-for-byte into the coach
 * items route, the club-admin items route and (by this very release) the new coach item PATCH — and
 * the duplication had already gone wrong in the way duplication does: two of the copies carried a
 * comment describing `direction` as a nullable sorting hint, thirty lines above validation in the
 * same file that now REQUIRES it and filters by it. A reader trusts the comment beside the field.
 * It lives here because this module already owns `budgetItemTier` and `itemVisibleToTeam` for the
 * same reason — one definition, every surface.
 */
export function mapBudgetItem(row: Record<string, unknown>): BudgetItem {
  return {
    id:              row.id as string,
    categoryId:      row.category_id as string,
    orgId:           row.org_id as string | null,
    teamId:          (row.team_id as string | null) ?? null,
    name:            row.name as string,
    suggestedAmount: row.suggested_amount as number | null,
    sortOrder:       row.sort_order as number,
    isDefault:       row.is_default as boolean,
    isMisc:          row.is_misc as boolean,
    direction:       row.direction as BudgetItemDirection,
    createdAt:       row.created_at as string,
  };
}

/**
 * Is this word part of THIS sport's vocabulary? (mig 241.)
 *
 * ⚠ THE DEFAULT LIBRARY WAS DIAMOND-SHAPED AND THE PLATFORM IS NOT. Bats, Batting Cages, Diamond
 * Permits, Umpire Fees — survivable while the item was an optional label, and not survivable once
 * mig 240 made the item the NAME of every budget row: a basketball club's whole plan would read in
 * someone else's language.
 *
 * ⚠ NULL MEANS EVERY SPORT, and most rows are null. Travel, insurance, league registration and
 * bank fees cost the same whatever is being played; only genuinely sport-shaped words are tagged.
 * That default also means everything written before this behaves exactly as it did.
 *
 * ⚠ COMPARED THROUGH `normalizeSportId`. `rep_teams.sport` holds mixed casing in live data —
 * "Baseball" and "baseball" both exist — so a raw string compare would hide half a club's library
 * from half its teams, silently, and only for the teams whose row was written by the other path.
 */
export function offeredForSport(row: { sports?: string[] | null }, teamSport: string | null | undefined): boolean {
  if (!row.sports || row.sports.length === 0) return true;
  const sport = normalizeSportId(teamSport);
  return row.sports.some(s => normalizeSportId(s) === sport);
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
  /** The team's sport (mig 241). Omit to skip the sport gate — for callers that have no team sport
   *  in hand and only need the ownership check; the picker always passes it. */
  teamSport?: string | null,
): Promise<BudgetItemResult> {
  if (itemId === null || itemId === undefined || itemId === '') return { ok: true, item: null };
  if (typeof itemId !== 'string') {
    return { ok: false, error: 'budgetItemId must be a budget item id, or null' };
  }

  const { data } = await supabaseAdmin
    .from('budget_items')
    .select('id, category_id, org_id, team_id, sports, name, budget_categories(name, sports)')
    .eq('id', itemId)
    .maybeSingle();

  // One message for "another club's", "another team's", "another sport's" and "no such item": they
  // are the same answer to the coach, and separating them would confirm the existence of another
  // team's rows to anyone who guessed an id.
  const category = (data?.budget_categories ?? null) as { sports?: string[] | null } | null;
  const wrongSport = data != null && teamSport !== undefined && (
    !offeredForSport(data as OwnedBudgetItem, teamSport)
    || (category != null && !offeredForSport(category, teamSport))
  );
  if (!data || wrongSport || !itemVisibleToTeam(data as OwnedBudgetItem, orgId, teamId)) {
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
