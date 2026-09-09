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

import type { BudgetItemDirection } from './types';
import type { BudgetItemActualSource } from './coach-budget-totals';

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
 * report. It also matches the door it is reached through — *Manage our words*.
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

/**
 * May the CLUB itself file its own budget against this word?
 *
 * Standard words and the club's own — **never a team's**, and never another club's. A club budget
 * line is org-wide; filing it against one team's private vocabulary would put a word on the club's
 * plan that the club cannot see, rename or remove, and that the owning team can.
 *
 * ⚠⚠ THIS EXISTS BECAUSE THE LIST ENFORCED IT AND THE WRITE PATH DID NOT (`/review`, 2026-08-17).
 * The club's taxonomy endpoint has always dropped team-owned rows, so the planner only ever OFFERED
 * standard and club words — but the save took the chosen word straight from the request and stored
 * it unchecked. Any club could therefore file its budget against **any** word in the database,
 * including another club's team-private one. Nothing broke loudly; the cost landed on the other
 * club's coach, as a refusal to remove a word naming records they cannot see and did not create.
 *
 * ⚠ ONE PREDICATE, LIST AND WRITE. That is the whole point — a list offering what a write path
 * refuses (or, as here, a write path accepting what the list would never show) is exactly the drift
 * `itemVisibleToTeam` was written to stop, one tier up.
 */
export function itemOfferedToClub(item: OwnedBudgetItem, orgId: string): boolean {
  if (!item.org_id) return true;                 // platform default — everybody's
  if (item.org_id !== orgId) return false;       // another club's, at any tier
  return !item.team_id;                          // the club's own, never a team's
}

/* ─── CATEGORIES READ THE SAME THREE RULES (mig 277) ──────────────────────────────────────────
 *
 * ⚠⚠ THESE ARE ALIASES, NOT COPIES — assignment, not re-implementation, so there is still exactly
 * ONE definition of each rule and no way for the two levels to drift apart. Migration 277 gave
 * `budget_categories` the same two ownership columns `budget_items` got in 240, which means the
 * predicates above already answer the category question correctly; writing them out again for
 * categories would be the fourth-copy mistake this whole module exists to prevent (read its header).
 *
 * ⚠ THEY ARE ALIASED RATHER THAN CALLED DIRECTLY because `itemVisibleToTeam(category, …)` reads
 * like a bug at the call site — the reader has to stop and work out whether somebody passed the
 * wrong row. A name that matches the thing being asked about costs one line here and saves that
 * stumble at every call site.
 *
 * The rules themselves, restated for categories because the consequences differ one level up:
 *   • platform   — a standard heading. Everyone sees it, nobody renames it.
 *   • club-shared — every team plans under it and the club's own budget files against it, so a
 *                   rename reaches every team at once: Owner/Treasurer only.
 *   • team's own — one team's heading. Only that team is offered it, that team renames it, and the
 *                  club READS it on cross-team reports without ever editing or filing against it
 *                  (owner rulings Q1 + Q3, 2026-09-04).
 */
export const budgetCategoryTier   = budgetItemTier;
export const categoryVisibleToTeam = itemVisibleToTeam;
export const categoryOfferedToClub = itemOfferedToClub;

/** A category row carries the same ownership columns an item does — same shape, honest name. */
export type OwnedBudgetCategory = OwnedBudgetItem;

/* ⚠ MOVED HERE 2026-09-09 (/simplify, reuse + altitude lenses). It lived in
   `coach-budget-items.ts` — which imports `supabase-admin` at module load — so the two SEED
   SCRIPTS that need it each grew their own copy instead, one of them commented "inlined because a
   seed script must not import a route's module". That reason was false twice over: the module is
   not a route, and the real obstacle was the service-role import this very file exists to escape.
   Three spellings of a two-line money-classification rule, on a release that changed it once
   already (mig 285). It is a pure rule over a category row, so it belongs on the pure side. */

/**
 * WHAT A NEWLY-CREATED WORD'S `actual_source` IS (mig 285) — the shelf's answer, or `typed`.
 *
 * ⚠⚠ THE OWNER RULING THIS ENCODES (2026-09-08): *the category a word sits in decides who fills its
 * number in and where it reports.* A word filed on the platform Fundraising shelf is a fundraising
 * word from birth — recorded on the Fundraising tab, reported under Fundraising. Before this, every
 * coach- and club-created word was born `'typed'` whatever shelf it sat on, and `'typed'` derives
 * `other_income` — so a coach's own "Bake sale money" sat in a row reading "Fundraising · …" under a
 * heading reading "Other income", forever, with no way to correct it.
 *
 * ⚠ THE DIRECTION IS ASKED FIRST AND WINS, exactly as `budgetLineKindForItem` asks it first: a
 * money-OUT word is always typed whatever its shelf says (every cost's actual is recorded by the
 * coach, and `budget_items_out_is_typed_check` refuses anything else). That also means a coach
 * adding a SPENDING word to the Fundraising shelf — the raffle's printing, say — is unaffected.
 *
 * ⚠ ONE FUNCTION, TWO WRITE DOORS, and that is the whole reason it exists rather than being inlined
 * twice: the coach's item POST and the club's both create money-in words, and a rule with two
 * spellings on its first day has no chance of surviving its third call site (the exact reasoning
 * `parseBudgetItemDirection` above is under). ⚠ IT NEVER READS A REQUEST BODY — the caller passes
 * the CATEGORY ROW IT ALREADY FETCHED for the visibility check, so nothing a client sends can
 * decide who reports a word's money.
 */
export function budgetItemSourceForCategory(
  direction: BudgetItemDirection,
  category: { income_source?: string | null },
): BudgetItemActualSource {
  if (direction !== 'in') return 'typed';
  const source = category.income_source;
  return source === 'fundraiser' || source === 'sponsor' ? source : 'typed';
}
