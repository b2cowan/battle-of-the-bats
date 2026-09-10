/**
 * THE CATEGORIES & ITEMS DIALOG, AS A PURE VIEW (owner rulings 2026-09-09, mockup 43698c62 round 4b).
 *
 * What the coach's vocabulary dialog shows is derived here, from the `categories` the list route
 * hands every money form, so the dialog itself renders and never decides. Three rules, each with the
 * reason it is a rule rather than a rendering choice:
 *
 *   • **The side lives on the item; a shelf earns its side.** No category carries a direction
 *     (there is no column, and rulings Q6 withdrew the idea of adding one). A category appears under
 *     the *Money coming in* band when it holds at least one money-in item and under *Money the team
 *     spends* when it holds a cost — so Tournaments (entry fees AND gate revenue) appears under both
 *     with only that side's items, exactly as the picker (which never filters categories, only
 *     groups them) and the plan already read it. "Uniform hats" can never appear under money in.
 *
 *   • **The filter is by TIER OF ITEM.** Under *Our own* a standard heading appears only because one
 *     of the team's items lives under it, showing only that item. That is what keeps the coach's
 *     handful of rows on the page and the sixty shared words behind a chip — the defect this dialog
 *     replaced put the two editable rows below eleven read-only headings in a box that could not
 *     scroll (see the plan §0).
 *
 *   • **The Category list when adding is ordered, not filtered (Q9).** Headings already taking this
 *     side first; every other heading second, under a label that says the thing a coach is unsure
 *     about ("Not taking money in yet — pick one and it will"); "New category" last. Filtering would
 *     forbid a mixed shelf of the team's own — the Tournaments flexibility the owner asked to keep —
 *     and a coach whose heading shows under the other band would otherwise make a twin of it.
 *
 * ⚠ PURE AND IMPORT-LIGHT, for the reason `coach-budget-item-tiers.ts` spells out in its header: this
 * runs in the browser, so it takes the tier predicates from the pure module and nothing from the
 * server one.
 */
import type { BudgetCategoryWithItems, BudgetItem, BudgetItemDirection } from './types';
import { budgetItemTier, budgetCategoryTier, type BudgetItemTier } from './coach-budget-item-tiers';
import { newMoneyInWordNote, type BudgetItemActualSource } from './coach-budget-totals';

/** The four chips. Three are the tier words the picker's chips already use; the fourth is the lot. */
export type ManagerFilter = BudgetItemTier | 'all';

export const MANAGER_FILTER_ORDER: readonly ManagerFilter[] = ['team', 'club', 'platform', 'all'];

/** ⚠ THE CHIP WORDS, VERBATIM (`ITEM_TIER_LABEL`), so the chip a coach met in the picker is the word
 *  they filter by here. "Everything" rather than "All": it is the answer to "show me everything". */
export const MANAGER_FILTER_LABEL: Record<ManagerFilter, string> = {
  team:     'Our own',
  club:     'Club',
  platform: 'Standard',
  all:      'Everything',
};

/** The two bands — the Add Line form's own two answers, in its words (ruling Q1/Q8). Money coming in
 *  first: the shorter side, and the order the "What am I forgetting?" index already reads in (R2). */
export const SIDE_ORDER: readonly BudgetItemDirection[] = ['in', 'out'];
export const SIDE_BAND_LABEL: Record<BudgetItemDirection, string> = {
  in:  'Money coming in',
  out: 'Money the team spends',
};

/**
 * ⚠⚠ THE SIDE, IN THE WORDS A SENTENCE USES — ONE HOME (owner ruling 2026-09-10). The shared item
 * picker kept its own hand-written pair, and the two drifted into different REGISTERS: one sentence
 * read "Saved as money coming in" on one side and "Saved as an expense" on the other, so one side
 * echoed the coach's own answer back and the other invented an accounting noun for it. Two
 * hand-written pairs is how that happens; there is now one.
 *
 * ⚠ "Money going out", NOT `SIDE_BAND_LABEL`'s "Money the team spends", and that is the whole reason
 * this is a second record rather than a reuse: the band label is the Add Line QUESTION's own answer,
 * and the picker also renders on the club's Org Budget, where "the team" names the wrong body. This
 * pair is symmetric and surface-neutral, so it reads true on all four surfaces.
 *
 * The product's other register — "Revenue" / "Expenses" on the Statement (owner ruling 2026-08-23) —
 * is deliberate and untouched: the product speaks plainly when it ASKS and like a statement when it
 * REPORTS. What is forbidden is mixing the two inside one pair.
 */
export const SIDE_FLOW_LABEL: Record<BudgetItemDirection, string> = {
  in:  'Money coming in',
  out: 'Money going out',
};

/** The same pair with a chip's room — a badge in a list, where the full phrase would wrap. */
export const SIDE_FLOW_SHORT: Record<BudgetItemDirection, string> = {
  in:  'Money in',
  out: 'Money out',
};

/** A category with only ONE side's items, after the tier filter and the search. */
export interface Shelf {
  category: BudgetCategoryWithItems;
  items: BudgetItem[];
}

export interface ManagerView {
  bands: Record<BudgetItemDirection, Shelf[]>;
  /** The team's own headings with nothing under them at all. They have no side to appear under, so
   *  they are listed once, at the foot, where they can be renamed, removed or given an item. Only a
   *  coach's own can be here: a shared heading with no items is not theirs to act on and is hidden. */
  orphans: BudgetCategoryWithItems[];
  /** What each chip would show — headings and items of that tier — so the chips carry counts. */
  counts: Record<ManagerFilter, number>;
  /** "3 of yours" on a band: the team's own headings and items sitting under it. */
  ownPerBand: Record<BudgetItemDirection, number>;
  /** When the current filter matched nothing but the query would under Everything: how many rows.
   *  The dialog turns a non-zero here into the one-line door that switches the chip. Zero otherwise. */
  matchesUnderEverything: number;
}

const byShelfOrder = (a: BudgetCategoryWithItems, b: BudgetCategoryWithItems) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);

function tierOfItem(item: BudgetItem): BudgetItemTier {
  return budgetItemTier({ org_id: item.orgId, team_id: item.teamId });
}
function tierOfCategory(category: BudgetCategoryWithItems): BudgetItemTier {
  return budgetCategoryTier({ org_id: category.orgId, team_id: category.teamId });
}
/** ⚠ "TEAM" TIER MEANS *A* TEAM'S, NOT NECESSARILY THIS ONE. The list route never hands a coach
 *  another team's rows, but this module must not rely on that: a row owned by a different team is
 *  dropped here rather than counted as "ours" — the same fail-closed posture the route takes. */
function mine(row: { teamId?: string | null }, teamId: string): boolean {
  return !row.teamId || row.teamId === teamId;
}

function normalise(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * One pass over the library for one filter and one query.
 * ⚠ `teamId` is what "own" means and is asked of every row through the tier predicate — never a bare
 * `!!item.teamId`, which would call another team's item "ours" on a club read.
 */
function assemble(
  categories: BudgetCategoryWithItems[],
  teamId: string,
  filter: ManagerFilter,
  query: string,
): { bands: Record<BudgetItemDirection, Shelf[]>; orphans: BudgetCategoryWithItems[]; rows: number } {
  const q = normalise(query);
  const passesTier = (tier: BudgetItemTier) => filter === 'all' || tier === filter;
  const bands: Record<BudgetItemDirection, Shelf[]> = { in: [], out: [] };
  const orphans: BudgetCategoryWithItems[] = [];
  let rows = 0;

  for (const category of [...categories].sort(byShelfOrder)) {
    if (!mine(category, teamId)) continue;
    const headingMatches = q === '' || category.name.toLowerCase().includes(q);
    const items = (category.items ?? []).filter(i => mine(i, teamId));

    /* ⚠ AN EMPTY HEADING OF THE TEAM'S OWN IS LISTED, NOT LOST. It is the one state with no side to
       appear under; the dialog's add form cannot create it (a heading is born with its first item),
       so it can only arise by removing a heading's last item — and the coach then needs the row to
       finish the job. Shared empties are not the coach's to act on and stay hidden. */
    if (items.length === 0) {
      if (tierOfCategory(category) === 'team' && (filter === 'team' || filter === 'all') && headingMatches) {
        orphans.push(category);
        rows += 1;
      }
      continue;
    }

    for (const side of SIDE_ORDER) {
      const onSide = items.filter(i => i.direction === side && passesTier(tierOfItem(i)));
      if (onSide.length === 0) continue;
      const shown = headingMatches ? onSide : onSide.filter(i => i.name.toLowerCase().includes(q));
      if (shown.length === 0) continue;
      bands[side].push({ category, items: shown });
      rows += 1 + shown.length;
    }
  }
  return { bands, orphans, rows };
}

export function buildManagerView(
  categories: BudgetCategoryWithItems[],
  teamId: string,
  filter: ManagerFilter,
  query: string,
): ManagerView {
  const { bands, orphans, rows } = assemble(categories, teamId, filter, query);

  /* The chip counts are of the LIBRARY, not of the search — a chip that read "Our own 0" while the
     coach was mid-word would tell them their words had gone. */
  const counts: Record<ManagerFilter, number> = { team: 0, club: 0, platform: 0, all: 0 };
  for (const category of categories) {
    if (!mine(category, teamId)) continue;
    const items = (category.items ?? []).filter(i => mine(i, teamId));
    const catTier = tierOfCategory(category);
    /* A heading counts under its own tier; every heading counts under Everything. Shared headings
       with nothing under them are not shown anywhere and are not counted. */
    if (items.length > 0 || catTier === 'team') { counts[catTier] += 1; counts.all += 1; }
    for (const item of items) { counts[tierOfItem(item)] += 1; counts.all += 1; }
  }

  const ownPerBand: Record<BudgetItemDirection, number> = { in: 0, out: 0 };
  for (const side of SIDE_ORDER) {
    for (const shelf of bands[side]) {
      if (tierOfCategory(shelf.category) === 'team') ownPerBand[side] += 1;
      ownPerBand[side] += shelf.items.filter(i => tierOfItem(i) === 'team').length;
    }
  }

  const matchesUnderEverything =
    rows === 0 && filter !== 'all' && normalise(query) !== ''
      ? assemble(categories, teamId, 'all', query).rows
      : 0;

  return { bands, orphans, counts, ownPerBand, matchesUnderEverything };
}

/**
 * The add form's Category list for one side (ruling Q9): ordered, never filtered.
 * `taking` already holds at least one item on this side; `notYet` is every other heading the team
 * can see, the team's own empties included — a heading of the team's own that only holds costs is
 * exactly the one a coach wants to put a trip fundraiser under.
 */
export function categoryOptionsForSide(
  categories: BudgetCategoryWithItems[],
  side: BudgetItemDirection,
  teamId: string,
): { taking: BudgetCategoryWithItems[]; notYet: BudgetCategoryWithItems[] } {
  const taking: BudgetCategoryWithItems[] = [];
  const notYet: BudgetCategoryWithItems[] = [];
  for (const category of [...categories].sort(byShelfOrder)) {
    if (!mine(category, teamId)) continue;
    const holdsSide = (category.items ?? []).some(i => i.direction === side && mine(i, teamId));
    (holdsSide ? taking : notYet).push(category);
  }
  return { taking, notYet };
}

/** The label under the second group of that list, in the coach's words for the side. */
export function notYetLabel(side: BudgetItemDirection): string {
  return side === 'in'
    ? 'Not taking money in yet — pick one and it will'
    : 'Not holding a cost yet — pick one and it will';
}

/**
 * The one quiet line under the add form saying where the money will report (ruling Q7).
 *
 * ⚠ THE SENTENCE FOLLOWS THE SHELF RULING OF THE SAME DAY (category-is-the-shelf, R1, 2026-09-09): a
 * money-in line reports under ITS CATEGORY'S NAME, so a coach's own "Bake sales" reports as Bake
 * sales — not as Other income, which is what the mockup's first draft said and what was true until
 * that morning. The half that is still true is said too: only the two derived shelves have a drive
 * or a sponsor filling the number in; on every other money-in shelf the coach records each arrival.
 * On the spending side there is nothing to say beyond "saved to this team's list" — every cost
 * reports under its heading and is recorded by the coach, and saying so on each would be noise.
 */
export function reportingLine(
  category: { name: string; incomeSource?: BudgetItemActualSource | null } | null,
  side: BudgetItemDirection,
): string | null {
  if (side !== 'in' || !category) return null;
  const name = category.name.trim();
  if (!name) return null;
  const source = category.incomeSource ?? 'typed';
  if (source === 'fundraiser') return `Under ${name}, a drive fills in its money.`;
  if (source === 'sponsor')    return `Under ${name}, a sponsor fills in its money.`;
  const reports = newMoneyInWordNote({ name, incomeSource: 'typed' }, 'in') ?? `Will report under ${name}.`;
  return `${reports} You record each arrival yourself — only Fundraising and Sponsorship have a drive or a sponsor filling the number in.`;
}
