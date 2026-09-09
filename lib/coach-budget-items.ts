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
import type { BudgetItemActualSource } from './coach-budget-totals';

/* ⚠⚠ THE TIER RULES MOVED TO `coach-budget-item-tiers.ts` (2026-08-17) AND ARE RE-EXPORTED HERE, so
   every existing server caller keeps one door. The split is not tidying: THIS module imports
   `supabase-admin`, which builds the service-role client and runs an environment assertion at module
   load — so the moment a `'use client'` component imported `budgetItemTier` from here, that whole
   graph joined the browser bundle. It would not have thrown and nothing would have reported it. Read
   that file's header before moving anything back. */
export {
  budgetItemTier, itemVisibleToTeam, itemOfferedToClub, ITEM_TIER_LABEL,
  /* Categories read the same three rules since mig 277 — aliases of the three above, not copies. */
  budgetCategoryTier, categoryVisibleToTeam, categoryOfferedToClub,
  type BudgetItemTier, type OwnedBudgetItem, type OwnedBudgetCategory,
} from './coach-budget-item-tiers';
import {
  itemVisibleToTeam, itemOfferedToClub, categoryVisibleToTeam, categoryOfferedToClub,
  type OwnedBudgetItem, type OwnedBudgetCategory,
} from './coach-budget-item-tiers';

/* ⚠⚠ THE REFERENCE LIST AND THE USAGE PHRASING MOVED TO `coach-budget-item-usage.ts` (2026-08-17)
   AND ARE RE-EXPORTED HERE, so every existing caller keeps one door. Same reason as the tier split
   above, and the same trap: the fold's confirmation is written in the BROWSER, so a `'use client'`
   component now needs `describeBudgetItemUsage` — and importing it from here would have pulled
   `supabase-admin` and its service-role client into the bundle of every screen with an item picker,
   without throwing and without anything reporting it. Read that file's header before moving
   anything back. */
export {
  BUDGET_ITEM_REFERENCES, NO_BUDGET_ITEM_USAGE, describeBudgetItemUsage, sumBudgetItemUsage,
  type BudgetItemReference, type BudgetItemUsage,
} from './coach-budget-item-usage';
import {
  BUDGET_ITEM_REFERENCES, NO_BUDGET_ITEM_USAGE, sumBudgetItemUsage, type BudgetItemUsage,
} from './coach-budget-item-usage';

/**
 * Count what is filed against a set of words, TOGETHER — one answer for the whole set.
 *
 * ⚠ COUNTS EVERY TABLE IN THE LIST, ALWAYS. A guard that counts all but one of them is the original
 * bug wearing a newer comment — which is why this takes no "which tables" parameter.
 */
export async function countBudgetItemUsage(itemIds: string[]): Promise<BudgetItemUsage> {
  if (itemIds.length === 0) return NO_BUDGET_ITEM_USAGE;

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

/**
 * The same counts, but PER WORD — one query per table, never one per word (/simplify, efficiency
 * lens, 2026-08-17).
 *
 * ⚠⚠ THIS EXISTS BECAUSE THE OBVIOUS SHAPE WAS QUADRATIC. The manage screen wants a count beside
 * every one of the team's own words, and asking `countBudgetItemUsage` once per word issued ONE QUERY PER REFERENCED TABLE
 * queries per word — forty round trips for a team with ten words of its own, on every open of the
 * modal and again after every rename, remove or fold. The tables here are libraries, not ledgers,
 * and the ids are already in hand: read the item column once per table and tally in JavaScript.
 *
 * ⚠ IT STILL WALKS THE SAME LIST, which is the whole point of the list. A per-word counter that
 * hand-picked its tables would be the original publish bug in a second place — so this and the
 * set-wide counter above are two shapes of one enumeration, never two enumerations.
 */
export async function countBudgetItemUsageByItem(
  itemIds: string[],
): Promise<Record<string, BudgetItemUsage>> {
  if (itemIds.length === 0) return {};

  /** [itemId → its counts, per table] — filled table by table, then folded per word. */
  const perTable = await Promise.all(BUDGET_ITEM_REFERENCES.map(async ref => {
    const tally = new Map<string, number>();
    /**
     * ⚠⚠ PAGED, AND THE FIRST DRAFT WAS NOT (/review, correctness lens, 2026-08-17).
     *
     * The set-wide counter above asks the database to count (`head: true`), so no row limit can
     * reach it. This one has to read the actual ids to know WHICH word each row belongs to — and a
     * single read is capped, silently. Over the cap a word's rows simply stop arriving, and the
     * count beside it reads lower than the truth, or zero: the manage screen would offer to remove
     * a word with history behind it, and the fold's confirmation — the sentence a coach agrees to
     * before their words are removed — would understate what moves. The server refuses the removal
     * either way, but being told "nothing is filed against this" about a word holding nine records
     * is the failure this whole feature exists to prevent.
     *
     * ⚠ The loop stops on a short page, so the common case (tens of rows) is still ONE request per
     * table, which is the whole point of this function.
     */
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from(ref.table)
        .select(ref.column)
        .in(ref.column, itemIds)
        .range(from, from + PAGE - 1);
      if (error) break;
      /* ⚠ THROUGH `unknown`. The column is chosen from the reference list at runtime, so the
         client's generated types cannot know which one it is and infer an error shape. */
      const rows = ((data ?? []) as unknown) as Array<Record<string, unknown>>;
      for (const row of rows) {
        const id = row[ref.column] as string | null;
        if (id) tally.set(id, (tally.get(id) ?? 0) + 1);
      }
      if (rows.length < PAGE) break;
    }
    return { label: ref.label, tally };
  }));

  /* ⚠ THROUGH `sumBudgetItemUsage`, so a single word's counts read in `BUDGET_ITEM_REFERENCES`
     order and drop their empty kinds exactly as the set-wide counter's do. The confirmation adds
     these up again in the browser; two different orderings of the same kinds would show a
     coach one sentence in the tooltip and another on the button. */
  const usage: Record<string, BudgetItemUsage> = {};
  for (const id of itemIds) {
    usage[id] = sumBudgetItemUsage(perTable.map(t => {
      const count = t.tally.get(id) ?? 0;
      return count > 0 ? { total: count, byKind: [{ label: t.label, count }] } : undefined;
    }));
  }
  return usage;
}

/**
 * FOLD ONE OR MORE WORDS INTO ANOTHER — re-point every record, in every table, before anything is
 * removed. The database half of the team-chosen merge (owner ruling 2026-08-17).
 *
 * ⚠⚠ RE-POINT FIRST, AND ONLY DELETE IF EVERY RE-POINT SUCCEEDED. Each link is `ON DELETE SET
 * NULL`, so a delete after a failed re-point does not error — it quietly unclassifies exactly the
 * records the fold promised to keep. This function therefore never deletes; it reports what moved
 * and the caller decides, which is the shape P1's guarded delete already uses.
 *
 * ⚠ THE CATEGORY MOVES WITH THE ITEM. Every one of these tables stores the category beside the item,
 * derived from the item at save time so the report's two levels cannot disagree — and Budget vs.
 * Actual prefers that stored category over the item's own. Moving only the item would leave a cost
 * filed under the heading the folded word used to live under while its plan line sits under
 * another: all the money still there, and none of it lining up.
 *
 * ⚠⚠ SCOPED TO THE ACTING ORG, AND THE FIRST DRAFT WAS NOT (/review, security lens, 2026-08-17).
 * It filtered on the item alone, reasoning that any row pointing at a team-owned word must belong to
 * that team. **That reasoning was wrong, and the plan had written it down as fact.** The club's own
 * budget-line writer (`app/api/admin/accounting/budget-plan/lines`) takes `itemId` straight from the
 * request body and inserts it with **no validation whatsoever** — no ownership check, no tier check,
 * not even `resolveBudgetItem`. So an owner or treasurer in ANOTHER org can point one of their org
 * budget lines at this team's word, and an unscoped re-point would then rewrite that other tenant's
 * row — its item AND its category — as a side effect of a coach here tidying their vocabulary.
 * Cross-tenant corruption, triggered by someone with no relationship to the row.
 *
 * ⚠ `org_id` IS NOT NULL ON EVERY REFERENCED TABLE (verified against the committed dev snapshot — including the two club tables migration 250 added), so this
 * filter cannot silently skip a legitimate row. And if it ever did, the caller's re-count before the
 * delete would see the leftovers and refuse to remove the words — the fold stops rather than
 * blanking what it could not move.
 *
 * ⚠ No `team_id` filter, though: one of them (`org_budget_lines`) has no team column, and org
 * scoping is the boundary that actually matters here. The table stays in the loop rather than being
 * skipped as "impossible" — it was called impossible once already, and it was not.
 */
/* ⚠ THE SAME SHAPE EVERY WRITE PATH ALREADY DERIVES (/simplify, altitude lens). "An item plus the
   category derived from it" is what `resolveBudgetItem` hands every cost, money-in and budget-line
   route — the fold needs exactly that, minus the name. Taken as a `Pick` rather than re-declared,
   so a field the category-derivation rule grows cannot be added to one and forgotten on the other.
   ⚠ The VALIDATION deliberately stays separate: `resolveBudgetItem` accepts the team's own items,
   which a fold target may never be. Same shape, different rule. */
export type BudgetItemRepointTarget = Pick<ResolvedBudgetItem, 'id' | 'categoryId' | 'categoryName' | 'name'>;

export async function repointBudgetItemReferences(
  /** The words being folded away — ids AND names, because an auto-filled label has to follow. */
  sources: Array<{ id: string; name: string }>,
  target: BudgetItemRepointTarget,
  /** The org whose records may be touched. Every referenced table carries it, NOT NULL. */
  orgId: string,
): Promise<{ ok: true } | { ok: false; movedLabels: string[]; failedLabel: string; error: string }> {
  const sourceIds = sources.map(s => s.id);
  const movedLabels: string[] = [];

  for (const ref of BUDGET_ITEM_REFERENCES) {
    /**
     * ⚠⚠ THE AUTO-FILLED LABEL MOVES FIRST, WHILE THE ROWS CAN STILL BE FOUND (/review, data lens,
     * 2026-08-17). `rep_budget_lines.description` is NOT NULL and the server fills it from the
     * item's name when a coach types nothing — and the Budget Plan renders it raw. Skipping it left
     * a line reading *"Public grants"* while filed under *"Grants"*: the folded-away word still on
     * screen, on the product's main money page.
     *
     * ⚠ ONLY WHERE IT STILL EQUALS THE OLD NAME. Anything else is text the coach typed, and no fold
     * has any business rewriting that. This is the same rule the line editor already applies when a
     * line's item changes — it just had no way to reach a fold.
     *
     * ⚠ BEFORE the item re-point below, not after: once `column` points at the target these rows no
     * longer match `source.id`, and the rename would find nothing.
     */
    if (ref.autoNameColumn) {
      for (const source of sources) {
        const { error } = await supabaseAdmin
          .from(ref.table)
          .update({ [ref.autoNameColumn]: target.name })
          .eq(ref.column, source.id)
          .eq(ref.autoNameColumn, source.name)
          .eq('org_id', orgId);
        if (error) return { ok: false, movedLabels, failedLabel: ref.label, error: error.message };
      }
    }

    const patch: Record<string, unknown> = {
      [ref.column]: target.id,
      [ref.categoryColumn]: target.categoryId,
    };
    if (ref.categoryNameColumn) patch[ref.categoryNameColumn] = target.categoryName;

    const { error } = await supabaseAdmin
      .from(ref.table)
      .update(patch)
      .in(ref.column, sourceIds)
      .eq('org_id', orgId);
    if (error) return { ok: false, movedLabels, failedLabel: ref.label, error: error.message };
    movedLabels.push(ref.label);
  }
  return { ok: true };
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
    /* ⚠ NEVER DEFAULTED HERE (mig 280). The column is NOT NULL with a database default of 'typed',
       so a row always carries one; coalescing in the mapper would hide a select that forgot to ask
       for it behind a plausible answer, and the budget form derives a line's KIND from this. */
    actualSource:    row.actual_source as BudgetItemActualSource,
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
  /**
   * ⚠ THE TWO HALVES A BUDGET LINE'S KIND IS DERIVED FROM (mig 280). Carried on the RESOLVED item
   * rather than read back separately by each door, because the resolve is already the one place
   * that authorises the word — and the kind must be worked out from the row the server fetched,
   * never from anything the request said about it. See `budgetLineKindForItem`.
   */
  direction: BudgetItemDirection;
  actualSource: BudgetItemActualSource;
  /**
   * The SHELF's answer to who fills its money-in words in (mig 285), carried beside the word's own.
   *
   * ⚠ IT IS HERE FOR THE FUNDRAISERS' "Raising for" CHECK, which is a question about the shelf and
   * not about the word: a `kind='fundraiser'` record may raise only for a word on a `fundraiser`
   * shelf. Reading `actualSource` instead would work today — mig 285 part 3 pins the two in step —
   * and would be the wrong question asked of the right answer, which is how a rule survives until
   * the day the two can differ.
   */
  categoryIncomeSource: BudgetItemActualSource;
}

/**
 * What a resolver hands back: the authorised item, `null` for "none chosen" (the caller keeps
 * whatever category it was given), or the coach-facing refusal.
 *
 * ⚠ ONE WRAPPER, TWO ALIASES — the same anti-drift reasoning `ResolvedOrgBudgetItem`'s `Pick` is
 * under, one level out. Mig 280 widened the coach-side item shape and left the club side narrower,
 * which spelled this union twice; a shared generic means a third door cannot invent a third spelling
 * of "ok, item or nothing, else a sentence".
 */
export type ItemResolveResult<T> =
  | { ok: true; item: T | null }
  | { ok: false; error: string };

export type BudgetItemResult = ItemResolveResult<ResolvedBudgetItem>;

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
    .select('id, category_id, org_id, team_id, sports, name, direction, actual_source, budget_categories(name, sports, income_source)')
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
      direction: row.direction as BudgetItemDirection,
      actualSource: row.actual_source as BudgetItemActualSource,
      /* Through the same rule the create doors use, so "what does this shelf report?" is answered
         once. The direction is the item's own, so a money-out word on the Fundraising shelf reads
         `typed` here as well — which is what it is. */
      categoryIncomeSource: budgetItemSourceForCategory(
        row.direction as BudgetItemDirection,
        (row.budget_categories ?? {}) as { income_source?: string | null },
      ),
    },
  };
}

/**
 * Resolve the word a DRIVE OR A SPONSOR is "raising for" (mig 285) — `resolveBudgetItem` plus the
 * one rule that is about the record rather than the word: **the shelf has to match the kind.**
 *
 * ⚠⚠ THE FILTER IN THE PICKER IS NOT THE GUARD. The forms offer a fundraiser only `fundraiser`-shelf
 * words and a sponsor only `sponsor`-shelf ones, and that is what a coach experiences — but a filter
 * is a courtesy and this is the rule. Without it the API would accept a drive raising for *Team
 * sponsorship*, and Budget vs. Actual would then land bottle-drive money on the sponsorship row
 * while the sponsorship line read as unmet: the report would be confidently wrong with nothing on
 * screen to say why, which is the exact failure mig 280 removed one level up.
 *
 * ⚠ IT ASKS THE SHELF (`categoryIncomeSource`), NOT THE WORD (`actualSource`). Mig 285 part 3 keeps
 * the two in step, so today either answers — and "may a drive raise for this?" is a question about
 * where the word is FILED. Asking the right question of the right column is what keeps the rule
 * correct on the day they can differ.
 *
 * ⚠ `kind` IS TYPED INLINE rather than as `FundraisingKind`, the same reason `budgetLineKindForItem`
 * types `direction` inline: the union is identical and this module has no other need of the
 * fundraising vocabulary.
 *
 * ⚠ NULL IS A LEGITIMATE ANSWER — "Raising for" is pre-filled, not required (owner, 2026-09-08), and
 * every record written before this migration starts NULL. `{ ok: true, item: null }` means the
 * record raises for nothing in particular and places by the legacy pool rule.
 */
export async function resolveRaisingForItem(
  itemId: unknown,
  kind: 'fundraiser' | 'sponsor',
  orgId: string,
  teamId: string,
  teamSport?: string | null,
): Promise<BudgetItemResult> {
  const resolved = await resolveBudgetItem(itemId, orgId, teamId, teamSport);
  if (!resolved.ok || !resolved.item) return resolved;

  if (resolved.item.direction !== 'in' || resolved.item.categoryIncomeSource !== kind) {
    return {
      ok: false,
      error: kind === 'sponsor'
        ? 'A sponsor can only raise for a word on your Sponsorship shelf. Add one there on the Budget Plan first.'
        : 'A fundraiser can only raise for a word on your Fundraising shelf. Add one there on the Budget Plan first.',
    };
  }
  return resolved;
}

/**
 * The same resolution, one tier up: authorise an item id a CLUB is filing its own budget against.
 *
 * ⚠⚠ THIS IS THE MISSING CHECK, ADDED 2026-08-17 (`/review`, security lens). The club's budget-line
 * routes took `itemId` from the request body and stored it with **no validation at all** — no
 * ownership, no tier, nothing — while every coach-side write path went through `resolveBudgetItem`
 * above. So a club could file its budget against any word in the database, including another club's
 * team-private one, and the damage surfaced somewhere else entirely: that stray row counts as usage
 * of the word, so the owning team's coach is refused when they try to remove it, with a sentence
 * naming records they cannot see, on a screen they cannot open, in a club they have never heard of.
 *
 * ⚠ THE CATEGORY IS DERIVED HERE TOO, for the same reason it is derived for a coach: an item belongs
 * to exactly one category, so trusting a separately-supplied one lets the two levels of the report
 * disagree about the same row. The club routes accepted both independently before this.
 *
 * ⚠ NO SPORT GATE, and that is the difference from `resolveBudgetItem`. A club spans sports; its own
 * plan is not written from one team's vocabulary, and the club taxonomy endpoint does not filter by
 * sport either. Adding one here would refuse a word the club's own list had just offered.
 */
/* ⚠ A NARROWER RESULT THAN THE COACH'S (mig 280). `resolveBudgetItem` now also carries the two
   fields a TEAM budget line's kind is derived from; a CLUB line's kind is a question the club
   answers for itself (mig 271), so this door has no use for them and does not read them. Stated as
   a `Pick` of the same shape rather than a second interface, so the two cannot drift into being
   different ideas of "a resolved item". */
export type ResolvedOrgBudgetItem = Pick<ResolvedBudgetItem, 'id' | 'categoryId' | 'name' | 'categoryName'>;
export type OrgBudgetItemResult = ItemResolveResult<ResolvedOrgBudgetItem>;

export async function resolveOrgBudgetItem(
  itemId: unknown,
  orgId: string,
): Promise<OrgBudgetItemResult> {
  if (itemId === null || itemId === undefined || itemId === '') return { ok: true, item: null };
  if (typeof itemId !== 'string') {
    return { ok: false, error: 'itemId must be a budget item id, or null' };
  }

  const { data } = await supabaseAdmin
    .from('budget_items')
    .select('id, category_id, org_id, team_id, name, budget_categories(name)')
    .eq('id', itemId)
    .maybeSingle();

  // One message for "another club's", "a team's own" and "no such item" — the same reasoning the
  // coach-side resolver uses: separating them confirms the existence of rows the caller cannot see.
  if (!data || !itemOfferedToClub(data as OwnedBudgetItem, orgId)) {
    return {
      ok: false,
      error: 'That budget item is not available to this organization. A club plan can use standard '
        + 'items and the ones your club shares — never a word one of its teams invented.',
    };
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

/**
 * Every CATEGORY this team may pick from — one tier up, same rule, same reason (mig 277).
 *
 * ⚠ THE CREATE PATH NEEDS THIS, not just the list. A coach naming a new category is refused when the
 * name already exists, and the moment categories can be private that refusal has to be scoped to
 * what the asking team can SEE: otherwise team B types "Provincials Trip", team A invented one last
 * week, and team B is refused a name it cannot find, open or use. Items hit this exact wall between
 * migrations 240 and 248.
 */
export async function listVisibleBudgetCategories(orgId: string, teamId: string) {
  const { data } = await supabaseAdmin
    .from('budget_categories')
    .select('*')
    .or(`org_id.is.null,org_id.eq.${orgId}`);
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter(row => categoryVisibleToTeam(row as OwnedBudgetCategory, orgId, teamId));
}

/**
 * Authorise a bare category id a CLUB is filing its own budget line against.
 *
 * ⚠⚠ THIS IS THE HOLE MIGRATION 277 OPENS IF IT SHIPS ALONE, and it is the same hole `/review`
 * found for items on 2026-08-17 — one level up and three weeks later. The club's budget-line write
 * path derives its category from the chosen ITEM (`resolveOrgBudgetItem`), which is checked — but a
 * club line may name a category and NO item, and that id went to the database unvalidated. While
 * every category was org-wide that was harmless: there was nothing a club could name that was not
 * already the club's. The moment one team's heading is private, an unvalidated id lets the club file
 * its own plan under a word it cannot see, rename or remove, and that the owning team can — which is
 * the precise failure the item-level predicate exists to prevent.
 *
 * ⚠ NO SPORT GATE, matching `resolveOrgBudgetItem`: a club spans sports and its own plan is not
 * written out of one team's vocabulary.
 */
export async function resolveOrgBudgetCategory(
  categoryId: unknown,
  orgId: string,
): Promise<{ ok: true; categoryId: string | null } | { ok: false; error: string }> {
  if (categoryId === null || categoryId === undefined || categoryId === '') {
    return { ok: true, categoryId: null };
  }
  if (typeof categoryId !== 'string') {
    return { ok: false, error: 'categoryId must be a budget category id, or null' };
  }

  const { data } = await supabaseAdmin
    .from('budget_categories')
    .select('id, org_id, team_id')
    .eq('id', categoryId)
    .maybeSingle();

  // One message for "another club's", "a team's own" and "no such category" — separating them
  // confirms the existence of rows the caller cannot see.
  if (!data || !categoryOfferedToClub(data as OwnedBudgetCategory, orgId)) {
    return {
      ok: false,
      error: 'That category is not available to this organization. A club plan can use standard '
        + 'categories and the ones your club shares — never a heading one of its teams invented.',
    };
  }

  return { ok: true, categoryId: data.id as string };
}
