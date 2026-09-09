'use client';
import { useMemo } from 'react';
import BudgetItemPicker, { type BudgetItemSelection } from '@/components/accounting/BudgetItemPicker';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import {
  RAISING_FOR_LABEL, RAISING_FOR_HINT, RAISING_FOR_DEFAULT_WORD, type FundraisingKind,
} from '@/lib/coach-fundraising';
import type { BudgetCategoryWithItems } from '@/lib/types';

/**
 * "RAISING FOR" — the field a drive and a sponsor answer with the budget line their money counts
 * towards (mig 285, owner-approved mockup 8aa1e633 screens D and E).
 *
 * ⚠⚠ ONE COMPONENT, FOUR DOORS, and that is the whole reason it is not four `<BudgetItemPicker>`s
 * with a label above each: New fundraiser, Edit fundraiser, Edit sponsor and the recording
 * conversation's new-sponsor branch all ask this, on two different panels in two different folders.
 * The rules it carries are the ones that go quietly wrong when copied — which shelf the list is
 * filtered to, that a new category may not be created from here, and that the field is pre-filled
 * rather than required.
 *
 * ⚠⚠ THE LIST IS FILTERED TO THE RECORD'S OWN SHELF, and the drawing that showed a drive offered
 * sponsorship words was the error the owner caught. A drive raises for a Fundraising word; a sponsor
 * for a Sponsorship one. The server re-checks it (`resolveRaisingForItem`) — this filter is what
 * makes the refusal something a coach never meets.
 *
 * ⚠ IN PRACTICE THAT IS EXACTLY ONE CATEGORY, and the shape is deliberate rather than incidental:
 * only the two PLATFORM shelves carry a non-typed `incomeSource` (a shelf's source is set by
 * migration, never by a coach), so what the coach sees is their shelf's standard words plus every
 * word their team or club has added to it, each with its own tier chip. A coach who wants their own
 * fundraising word adds it to that shelf — which is also what makes it a fundraising word.
 *
 * ⚠ SO `allowCreateCategory` IS OFF, DELIBERATELY. A category a coach invents is `typed` by
 * definition — nothing reports the money on a heading somebody just named — so a new one created
 * from here would vanish from this very list the moment it was saved, and any word filed under it
 * would be refused by the server. Adding a WORD to the shelf on offer is allowed and is the point.
 *
 * ⚠ NO ASTERISK. The field is **pre-filled, neither required nor nudged** (owner ruling
 * 2026-09-08): a coach never has to answer it, only change it.
 */
export default function RaisingForField({
  kind,
  categories,
  value,
  onChange,
  orgSlug,
  teamId,
  disabled = false,
}: {
  kind: FundraisingKind;
  /** The team's whole taxonomy, as `/budget-items` serves it. Filtered here, never by the caller. */
  categories: BudgetCategoryWithItems[];
  value: BudgetItemSelection | null;
  onChange: (v: BudgetItemSelection) => void;
  orgSlug: string;
  teamId: string;
  disabled?: boolean;
}) {
  const shelf = useMemo(() => raisingForShelf(categories, kind), [categories, kind]);

  return (
    <div className={`${styles.field} ${styles.formGridFull}`}>
      <label className={styles.label}>{RAISING_FOR_LABEL}</label>
      <BudgetItemPicker
        categories={shelf}
        value={value}
        onChange={onChange}
        direction="in"
        teamId={teamId}
        createItemEndpoint={`/api/coaches/${orgSlug}/budget-items`}
        createItemMode="coach"
        placeholder={kind === 'sponsor'
          ? 'Search your sponsorship lines — e.g. “grant”'
          : 'Search your fundraising lines — e.g. “merchandise”'}
        manageHint="Rename or remove it later from Budget Plan → Manage our words."
        disabled={disabled}
      />
      <p className={styles.formHint}>{RAISING_FOR_HINT[kind]}</p>
    </div>
  );
}

/**
 * The categories a record of this kind may raise for — its own shelf, and only words on the money-in
 * side of it.
 *
 * ⚠ EMPTY SHELVES ARE DROPPED, so a heading with nothing choosable under it never appears as a
 * group with no rows. In practice the platform shelf always has its standard pair.
 *
 * ⚠ MODULE-PRIVATE ON PURPOSE. Its two callers are the component above and `defaultRaisingFor`
 * below; exporting it would invite a caller to take the raw shelf and rebuild the pre-fill rule
 * beside it, which is the one thing this module exists to keep in one place.
 */
function raisingForShelf(
  categories: BudgetCategoryWithItems[],
  kind: FundraisingKind,
): BudgetCategoryWithItems[] {
  return categories
    .filter(c => c.incomeSource === kind)
    .map(c => ({ ...c, items: c.items.filter(i => i.direction === 'in') }))
    .filter(c => c.items.length > 0);
}

/**
 * What a NEW record's field opens on — the shelf's standard word.
 *
 * ⚠ A NAME MATCH, AND ONLY BECAUSE OF WHAT IT DECIDES (see `RAISING_FOR_DEFAULT_WORD`): this
 * chooses a starting value the coach can see and change in one click, never where money lands.
 * A miss falls back to the shelf's first word rather than to nothing, because an empty field on a
 * question the coach was never asked reads as a question.
 *
 * ⚠ IT RETURNS NULL WHEN THE SHELF IS EMPTY, which is a real state on a team whose library has been
 * cut back — the record is then created raising for nothing, exactly as a legacy one is.
 */
export function defaultRaisingFor(
  categories: BudgetCategoryWithItems[],
  kind: FundraisingKind,
): BudgetItemSelection | null {
  const shelf = raisingForShelf(categories, kind);
  const wanted = RAISING_FOR_DEFAULT_WORD[kind].toLowerCase();
  for (const c of shelf) {
    const item = c.items.find(i => i.name.trim().toLowerCase() === wanted) ?? null;
    if (item) return selectionFor(c, item);
  }
  const first = shelf[0];
  return first ? selectionFor(first, first.items[0]) : null;
}

/** A record's stored link, as the picker's `value` — the shape both Edit sheets pre-select with. */
export function storedRaisingFor(record: {
  budgetItemId: string | null; budgetItemName: string | null;
  budgetCategoryId: string | null; budgetCategoryName: string | null;
}): BudgetItemSelection | null {
  if (!record.budgetItemId || !record.budgetCategoryId) return null;
  return {
    categoryId: record.budgetCategoryId,
    categoryName: record.budgetCategoryName ?? '',
    itemId: record.budgetItemId,
    itemName: record.budgetItemName ?? '',
    suggestedAmount: null,
  };
}

function selectionFor(
  category: BudgetCategoryWithItems,
  item: BudgetCategoryWithItems['items'][number],
): BudgetItemSelection {
  return {
    categoryId: category.id,
    categoryName: category.name,
    itemId: item.id,
    itemName: item.name,
    /* ⚠ NULL, always. `suggestedAmount` pre-fills a BUDGET LINE's planned figure and nothing here
       plans anything — see the picker's own `suggestAmount` note on the four callers that collected
       it and dropped it on the floor. */
    suggestedAmount: null,
    actualSource: item.actualSource,
  };
}
