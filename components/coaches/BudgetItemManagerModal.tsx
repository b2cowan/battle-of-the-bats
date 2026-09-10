'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pencil, Trash2, Plus, Search } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { budgetItemTier, ITEM_TIER_LABEL } from '@/lib/coach-budget-item-tiers';
/* ⚠⚠ FROM THE PURE MODULES, NEVER FROM `lib/coach-budget-items.ts`. That one imports
   `supabase-admin`, which builds the service-role client at module load — so a single import line,
   taken from the wrong door, would put an admin client in the browser bundle of every screen that
   shows an item picker. It would not throw and nothing would report it. */
import {
  describeBudgetItemUsage, sumBudgetItemUsage, NO_BUDGET_ITEM_USAGE, type BudgetItemUsage,
} from '@/lib/coach-budget-item-usage';
import {
  buildManagerView, categoryOptionsForSide, reportingLine, notYetLabel,
  MANAGER_FILTER_ORDER, MANAGER_FILTER_LABEL, SIDE_ORDER, SIDE_BAND_LABEL, SIDE_FLOW_SHORT,
  type ManagerFilter, type Shelf,
} from '@/lib/coach-budget-manager-view';
import type { BudgetCategoryWithItems, BudgetItem, BudgetItemDirection } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';

/**
 * CATEGORIES & ITEMS — the coach's vocabulary dialog (owner rulings 2026-09-09, mockup 43698c62
 * round 4b, plan `COACH_BUDGET_CATEGORIES_AND_ITEMS_DOOR_PLAN.md`).
 *
 * ⚠⚠ ONE NAME ON EVERY SURFACE (ruling Q1). The door is `MANAGE_DOOR_LABEL`, the dialog is
 * `MANAGER_TITLE`, and the three group words are the picker's chip words. The toolbar button, the
 * picker's last row, the three forms' hints and the help article all read from these two constants
 * — "Manage our words" was a fifth name for one thing, on the only screen that used it.
 *
 * ⚠⚠ READ BY SIDE, AND THE SIDE LIVES ON THE ITEM (rulings Q6 withdrawn, Q8). Two bands in the Add
 * Line form's own words, money coming in first; a heading appears under a band when it holds items
 * on that side, so Tournaments sits under both with half each and Team Gear never under money in.
 * The rules are in `lib/coach-budget-manager-view.ts`, which is what this file renders.
 *
 * ⚠⚠ THIS DIALOG REPLACED ONE THAT HID ITS OWN PURPOSE. The previous version listed every shared
 * heading first and every shared word last, at full row height, around the one or two rows a coach
 * could change — inside a frame on the scrolling-body recipe whose body was not one of the recipe's
 * scrolling shapes. Measured on the demo world: 4,296px of content in an 810px box, the wheel doing
 * nothing, "Our items" 81px below the edge. The owner read it as "my item isn't editable". Two
 * answers here: the body is a `scrollPane` (the recipe's generalisation), and *Our own* is the
 * default filter so the shared library is behind a chip rather than on the page (ruling Q4).
 *
 * ⚠ ADDING LIVES ON THE BAND, AND A HEADING IS ONLY EVER BORN WITH AN ITEM (rulings Q2, Q9, Q10).
 * One "+ Item" per band; the form asks Category and Item name in the words the form label already
 * uses; the category list is ORDERED, never filtered — this side's shelves first, every other
 * heading under a label saying it can take this side too, "New category" last — so a coach whose
 * heading shows under the other band picks it rather than making a twin. Choosing New category
 * unfolds one field and the two are saved together (the server does both, or neither).
 *
 * ⚠ RENAMING IS RETROACTIVE, AND THAT IS WHY IT IS THE REMEDY EVERY REFUSAL OFFERS. The item NAMES
 * the row (mig 240), so a rename reaches every budget line, cost and money-in record pointing at it.
 * ⚠⚠ MOVING AN ITEM BETWEEN SIDES IS GONE (retracted 2026-08-17): remove and re-add is the honest
 * fix, and an item with history cannot be removed at all. ⚠ A HEADING OF THE TEAM'S OWN CAN NOW BE
 * REMOVED WHILE IT HOLDS NOTHING (ruling Q3) — the same rule items live by; the server counts every
 * table that can name a category, not just the items.
 *
 * ⚠⚠ NOTHING HERE KEEPS ITS OWN COPY OF THE LIBRARY. Every list is derived from the `categories`
 * PROP on each render, and every write asks the parent to re-read (`onChanged`). The picker's local
 * copy produced the money form's P2 Critical; a fold removes several items and moves records onto
 * another, so a local copy would offer items that no longer exist.
 */

/** The door's words — read by the toolbar button, the picker's last row and the forms' hints. */
export const MANAGE_DOOR_LABEL = 'Manage categories & items';
/** The dialog's title. */
export const MANAGER_TITLE = 'Categories & items';

/** One item with its category beside it — what the fold screen's lists are made of. */
interface Row { item: BudgetItem; categoryName: string }

const NEW_CATEGORY = '__new__';

/** The usage line under a row — the shared sentence, plus the two states it has no words for. */
function usageLine(usage: BudgetItemUsage | undefined, counted: boolean): string {
  if (!counted) return 'Counting…';
  if (!usage || usage.total === 0) return 'Nothing filed yet';
  return describeBudgetItemUsage(usage);
}

export default function BudgetItemManagerModal({
  orgSlug,
  teamId,
  categories,
  onClose,
  onChanged,
}: {
  orgSlug: string;
  teamId: string;
  categories: BudgetCategoryWithItems[];
  onClose: () => void;
  onChanged: () => void;
}) {
  // Parent conditionally mounts this only while open — one unit for the whole mount.
  useOverlayOpen(true);

  const [filter, setFilter] = useState<ManagerFilter>('team');
  const [query, setQuery] = useState('');

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  /** Renaming a HEADING is its own row state — a category id and an item id can never be the same
   *  row, and sharing one would light up an item's input when a coach edits the heading above it. */
  const [renamingCatId, setRenamingCatId] = useState<string | null>(null);
  const [renameCatDraft, setRenameCatDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  /** What the last write did, in the coach's words — kept on the list they return to. */
  const [notice, setNotice] = useState('');

  /**
   * How many records are filed against each of this team's own items — WITH the library those
   * counts were read against.
   *
   * ⚠⚠ THE ANSWER IS CARRIED WITH THE QUESTION IT ANSWERED (/review, concurrency lens, 2026-08-17),
   * rather than a separate "loaded" flag: `categories` changes whenever ANY mounted money tab writes,
   * so a coach filing a cost in another tab against one of the very items being folded refreshes this
   * list underneath the open confirmation. An identity comparison cannot fail to notice that.
   *
   * ⚠ IT DISABLES THE BIN; THE SERVER IS WHAT REFUSES. A coach in another tab can file a cost between
   * this fetch and the click, so every write path counts again and returns the real sentence.
   */
  const [counted, setCounted] = useState<
    { of: BudgetCategoryWithItems[]; usage: Record<string, BudgetItemUsage> } | null>(null);
  const usage = counted?.of === categories ? counted.usage : null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/budget-items?teamId=${teamId}&usage=1`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.usage) setCounted({ of: categories, usage: d.usage }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [orgSlug, teamId, categories]);

  /* ── The view — derived, never kept ────────────────────────────────────────────────────────── */
  const view = useMemo(
    () => buildManagerView(categories, teamId, filter, query),
    [categories, teamId, filter, query]);

  const isOwn = (row: { orgId: string | null; teamId?: string | null }) =>
    budgetItemTier({ org_id: row.orgId, team_id: row.teamId }) === 'team';

  /** Flattened and split for the fold screen — the same shape it has always worked on. */
  const byCategoryThenName = (a: Row, b: Row) =>
    a.categoryName.localeCompare(b.categoryName) || a.item.name.localeCompare(b.item.name);
  const { ours, theirs } = useMemo(() => {
    const rows: Row[] = categories.flatMap(c => (c.items ?? []).map(item => ({ item, categoryName: c.name })));
    return {
      ours:   rows.filter(r => r.item.teamId === teamId).sort(byCategoryThenName),
      theirs: rows.filter(r => r.item.teamId !== teamId).sort(byCategoryThenName),
    };
  }, [categories, teamId]);

  /* ── Adding, under the band you tapped (Q2, Q9, Q10) ───────────────────────────────────────── */
  const [adding, setAdding] = useState<BudgetItemDirection | null>(null);
  const [addCatId, setAddCatId] = useState('');
  const [addNewCat, setAddNewCat] = useState('');
  const [addName, setAddName] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');

  function openAdd(side: BudgetItemDirection) {
    setAdding(side);
    setAddCatId('');
    setAddNewCat('');
    setAddName('');
    setAddError('');
    setNotice('');
  }

  const addOptions = useMemo(
    () => adding ? categoryOptionsForSide(categories, adding, teamId) : null,
    [categories, adding, teamId]);

  /** The heading the item is going under — or the one being typed — for the reporting line. */
  const addTarget = useMemo(() => {
    if (!adding) return null;
    if (addCatId === NEW_CATEGORY) return addNewCat.trim() ? { name: addNewCat.trim(), incomeSource: 'typed' as const } : null;
    return categories.find(c => c.id === addCatId) ?? null;
  }, [adding, addCatId, addNewCat, categories]);

  async function submitAdd() {
    const side = adding;
    /* ⚠ RE-ENTRANT GUARD (/review, concurrency lens 2026-09-09). Enter held down, or Enter then a
       fast click on Add, sent two requests before the first returned — and a NEW category has no
       database uniqueness behind it, so two headings with one name could be born, each holding one
       of the two items. The button's disabled state arrives a render too late to stop that. */
    if (!side || addBusy) return;
    const name = addName.trim();
    const newCat = addNewCat.trim();
    if (!addCatId) { setAddError('Pick a category, or choose “New category”.'); return; }
    if (addCatId === NEW_CATEGORY && !newCat) { setAddError('Give the new category a name.'); return; }
    if (!name) { setAddError('Give the item a name.'); return; }
    setAddError('');
    setAddBusy(true);
    try {
      const body = addCatId === NEW_CATEGORY
        ? { teamId, newCategoryName: newCat, name, direction: side }
        : { teamId, categoryId: addCatId, name, direction: side };
      const res = await fetch(`/api/coaches/${orgSlug}/budget-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Could not add that item');
      setNotice(`Added “${d.item?.name ?? name}” under ${addTarget?.name ?? ''}.`);
      setAdding(null);
      onChanged();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Could not add that item');
    } finally {
      setAddBusy(false);
    }
  }

  /* ── Rename, remove ─────────────────────────────────────────────────────────────────────────── */
  /** Rename one of this team's own headings. Same shape as `patch` below, its own door on the
   *  server — a category is not an item and the two routes refuse for different reasons. */
  async function patchCategory(cat: BudgetCategoryWithItems, name: string) {
    setError('');
    setBusyId(cat.id);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/budget-categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not save that change');
      }
      setRenamingCatId(null);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save that change');
    } finally {
      setBusyId(null);
    }
  }

  /** Remove one of this team's own headings (ruling Q3). The server refuses if anything sits under
   *  it or names it, and says what — shown as-is, because that sentence is written for the coach. */
  async function removeCategory(cat: BudgetCategoryWithItems) {
    if (busyId) return;
    setError('');
    setNotice('');
    setBusyId(cat.id);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/budget-categories/${cat.id}?teamId=${teamId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not remove that category');
      }
      setNotice(`Removed “${cat.name}”.`);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not remove that category');
    } finally {
      setBusyId(null);
    }
  }

  async function patch(item: BudgetItem, body: Record<string, unknown>) {
    setError('');
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/budget-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, ...body }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not save that change');
      }
      setRenamingId(null);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save that change');
    } finally {
      setBusyId(null);
    }
  }

  /** Remove one of this team's own items. The server refuses if anything is filed against it and
   *  says what — shown as-is, because that sentence is written for the coach. */
  async function remove(item: BudgetItem) {
    if (busyId) return;
    setError('');
    setNotice('');
    setBusyId(item.id);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/budget-items/${item.id}?teamId=${teamId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not remove that item');
      }
      setNotice(`Removed “${item.name}”.`);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not remove that item');
    } finally {
      setBusyId(null);
    }
  }

  /* ── Use a shared item instead ─────────────────────────────────────────────────────────────────
     ⚠ A SEPARATE SCREEN INSIDE THE MODAL, not a row action. The fold is many-onto-one, so its unit
     is a selection rather than the row a coach is standing on — and mixing tick boxes into a list
     whose other affordances act on a single row would make "which of these does Remove apply
     to?" a real question. */
  const [folding, setFolding] = useState(false);
  const [foldSources, setFoldSources] = useState<string[]>([]);
  const [foldTargetId, setFoldTargetId] = useState('');
  const [foldBusy, setFoldBusy] = useState(false);

  /**
   * The fold, derived fresh on every render from the `categories` PROP.
   * ⚠⚠ THE SELECTION IS FILTERED AGAINST THE LIVE LIST, never trusted as remembered. After a fold
   * the parent re-reads and several of these items no longer exist; a selection held as ids alone
   * would keep naming them, and the confirmation would count records against items that are gone.
   */
  const fold = useMemo(() => {
    const selected = ours.filter(r => foldSources.includes(r.item.id));
    /* ⚠ THE SIDE COMES FROM WHAT IS ALREADY TICKED, and it locks the rest of the screen: the target
       must be on the same side, so a cross-side fold is impossible by construction — which is what
       keeps "no money changes" true. */
    const side = selected[0]?.item.direction ?? null;
    const targets = side ? theirs.filter(r => r.item.direction === side) : [];
    const target = targets.find(r => r.item.id === foldTargetId) ?? null;
    const moving = sumBudgetItemUsage(selected.map(r => usage?.[r.item.id]));
    const reFiled = target ? selected.filter(r => r.categoryName !== target.categoryName) : [];
    return { selected, side, targets, target, moving, reFiled };
  }, [ours, theirs, foldSources, foldTargetId, usage]);

  function leaveFold() {
    setFolding(false);
    setFoldSources([]);
    setFoldTargetId('');
    setError('');
  }

  /** Fold the ticked items into the chosen shared one. The server re-points every record before it
   *  removes anything and refuses in one sentence if it cannot; that sentence is shown as-is. */
  async function runFold() {
    const target = fold.target;
    if (!target || fold.selected.length === 0) return;
    setError('');
    setFoldBusy(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/budget-items/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          sourceIds: fold.selected.map(r => r.item.id),
          targetId: target.item.id,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Those items could not be folded together');
      const moved = (d.moved ?? NO_BUDGET_ITEM_USAGE) as BudgetItemUsage;
      setNotice(moved.total > 0
        ? `Done — ${describeBudgetItemUsage(moved)} now use “${target.item.name}”.`
        : `Done — ${fold.selected.length === 1 ? 'that item was' : 'those items were'} removed. `
          + 'Nothing was filed against them.');
      leaveFold();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Those items could not be folded together');
      /* ⚠⚠ A FAILED FOLD RE-READS TOO (/review, concurrency lens, 2026-08-17). The server has one
         refusal that leaves the world CHANGED: the records re-pointed and the items not removed.
         Re-read, and the confirmation describes what is actually left to do. */
      onChanged();
    } finally {
      setFoldBusy(false);
    }
  }

  /* ── Pieces ─────────────────────────────────────────────────────────────────────────────────── */
  /**
   * The one modal shell both screens sit in.
   * ⚠⚠ A FUNCTION RETURNING MARKUP, DELIBERATELY NOT A NESTED COMPONENT. A component declared inside
   * this one gets a fresh identity on every render, so React would unmount and remount its whole
   * subtree on each keystroke — the rename input would lose focus mid-word.
   * ⚠⚠ THE BODY IS THE RECIPE'S SCROLLING PANE. `.modalScrollBody` is overflow-hidden and expects
   * exactly one child that scrolls; this dialog's body used to be a plain `.formBody`, which is not
   * one of the recipe's shapes, so everything past the box's bottom edge was unreachable (plan §0).
   */
  function frame(title: string, subtitle: string, body: ReactNode, footer: ReactNode) {
    /* ⚠ THE BACKDROP AND THE X ARE DEAD WHILE A FOLD IS IN FLIGHT (/review, 2026-08-17): a coach
       who clicked outside mid-fold would have had it complete for real with its sentence never shown. */
    const close = () => { if (!foldBusy && !addBusy) onClose(); };
    return (
      <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
        <div className={`${styles.modal} ${styles.modalScrollBody} ${styles.sheetOnMobile}`} onClick={e => e.stopPropagation()}>
          <CoachModalHeader title={title} subtitle={subtitle} onClose={close} />
          <div className={`${styles.formBody} ${styles.scrollPane}`}>{body}</div>
          <div className={styles.modalFooter}>{footer}</div>
        </div>
      </div>
    );
  }

  /** Standard, Club or Our own — the picker's chip words, never colour alone. Takes the two
   *  ownership columns, so one helper serves headings and items alike. */
  function tierChip(row: { orgId: string | null; teamId?: string | null }) {
    const tier = budgetItemTier({ org_id: row.orgId, team_id: row.teamId });
    return (
      <span className={`${styles.badge} ${tier === 'team' ? styles.badgeActive : tier === 'club' ? styles.badgeDraft : styles.badgeArchived}`}>
        {ITEM_TIER_LABEL[tier]}
      </span>
    );
  }

  function pencil(label: string, onClick: () => void) {
    return (
      <button type="button" title={label} aria-label={label} disabled={!!busyId} onClick={onClick}>
        <Pencil size={14} aria-hidden />
      </button>
    );
  }
  function bin(label: string, disabled: boolean, onClick: () => void) {
    return (
      <button type="button" title={label} aria-label={label} disabled={!!busyId || disabled} onClick={onClick}>
        <Trash2 size={14} aria-hidden />
      </button>
    );
  }

  /** The inline rename — one input, Enter saves, Escape cancels — shared by headings and items. */
  function renameRow(
    key: string, rowClass: string, ariaLabel: string,
    draft: string, setDraft: (v: string) => void, busy: boolean,
    onSave: () => void, onCancel: () => void,
  ) {
    return (
      <div key={key} className={`${styles.tagManagerRow} ${rowClass}`}>
        <input
          className={`${styles.input} ${styles.tagManagerName}`}
          value={draft}
          maxLength={80}
          autoFocus
          aria-label={ariaLabel}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && draft.trim()) onSave();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div className={styles.tagManagerActions}>
          <button type="button" className={styles.btnSecondary} disabled={busy || !draft.trim()} onClick={onSave}>Save</button>
          <button type="button" className={styles.btnGhost} disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  /** A heading row. Own headings rename inline and carry a bin that is grey while anything sits
   *  under them; shared headings are read-only and dim, with their tier chip. */
  function headingRow(cat: BudgetCategoryWithItems) {
    const own = isOwn(cat);
    const holds = (cat.items ?? []).length;
    if (own && renamingCatId === cat.id) {
      return renameRow(
        `h-${cat.id}`, styles.managerHead, 'Category name',
        renameCatDraft, setRenameCatDraft, busyId === cat.id,
        () => patchCategory(cat, renameCatDraft.trim()), () => setRenamingCatId(null),
      );
    }
    return (
      <div key={`h-${cat.id}`} className={`${styles.tagManagerRow} ${styles.managerHead}`}>
        <span className={`${styles.tagManagerName} ${own ? '' : styles.mutedInline}`}>{cat.name}</span>
        {tierChip(cat)}
        {own && (
          <div className={styles.tagManagerActions}>
            {pencil(`Rename ${cat.name}`, () => { setError(''); setRenamingCatId(cat.id); setRenameCatDraft(cat.name); })}
            {bin(
              holds > 0
                ? `${cat.name} can’t be removed while it holds ${holds} item${holds === 1 ? '' : 's'}`
                : `Remove ${cat.name}`,
              holds > 0,
              () => removeCategory(cat),
            )}
          </div>
        )}
      </div>
    );
  }

  /** An item row. Own items carry the usage sub-line (why the bin is grey) and rename inline;
   *  shared items are read-only. The tier chip appears only under Everything, where tiers mix. */
  function itemRow(item: BudgetItem) {
    const own = isOwn(item);
    const showTier = filter === 'all';
    if (own && renamingId === item.id) {
      return renameRow(
        item.id, styles.managerItem, 'Item name',
        renameDraft, setRenameDraft, busyId === item.id,
        () => patch(item, { name: renameDraft.trim() }), () => setRenamingId(null),
      );
    }
    const used = usage?.[item.id];
    return (
      <div key={item.id} className={`${styles.tagManagerRow} ${styles.managerItem}`}>
        <span className={`${styles.tagManagerName} ${own ? '' : styles.mutedInline}`}>
          {item.name}
          {own && <span className={styles.managerSub}>{usageLine(used, !!usage)}</span>}
        </span>
        {showTier && tierChip(item)}
        {own && (
          <div className={styles.tagManagerActions}>
            {pencil(`Rename ${item.name}`, () => { setError(''); setRenamingId(item.id); setRenameDraft(item.name); })}
            {bin(
              used?.total
                ? `${item.name} can’t be removed — ${describeBudgetItemUsage(used)} ${used.total === 1 ? 'is' : 'are'} filed against it`
                : `Remove ${item.name}`,
              !!used?.total,
              () => remove(item),
            )}
          </div>
        )}
      </div>
    );
  }

  function shelfBlock(shelf: Shelf) {
    return (
      <div key={shelf.category.id} className={styles.managerShelf}>
        {headingRow(shelf.category)}
        {shelf.items.map(itemRow)}
      </div>
    );
  }

  /** The inline add form under a band — Category, Item name, the reporting line. */
  function addForm(side: BudgetItemDirection) {
    if (adding !== side || !addOptions) return null;
    const isNew = addCatId === NEW_CATEGORY;
    const optionLabel = (c: BudgetCategoryWithItems) => isOwn(c) ? `${c.name} · yours` : c.name;
    const report = reportingLine(addTarget, side);
    return (
      <div className={styles.managerAddForm}>
        <p className={styles.managerAddTitle}>New item, {SIDE_BAND_LABEL[side].toLowerCase()}</p>
        {addError && <p className={styles.errorText}>{addError}</p>}
        <label className={styles.label} htmlFor="manager-add-category">Category</label>
        <select
          id="manager-add-category"
          className={styles.select}
          value={addCatId}
          disabled={addBusy}
          onChange={e => { setAddError(''); setAddCatId(e.target.value); }}
        >
          <option value="">— pick a category —</option>
          {addOptions.taking.length > 0 && (
            <optgroup label={side === 'in' ? 'Already take money in' : 'Already hold a cost'}>
              {addOptions.taking.map(c => <option key={c.id} value={c.id}>{optionLabel(c)}</option>)}
            </optgroup>
          )}
          {addOptions.notYet.length > 0 && (
            <optgroup label={notYetLabel(side)}>
              {addOptions.notYet.map(c => <option key={c.id} value={c.id}>{optionLabel(c)}</option>)}
            </optgroup>
          )}
          <option value={NEW_CATEGORY}>+ New category…</option>
        </select>
        {isNew && (
          <div className={styles.managerAddUnfold}>
            <label className={styles.label} htmlFor="manager-add-newcat">New category name</label>
            <input
              id="manager-add-newcat"
              className={styles.input}
              value={addNewCat}
              maxLength={80}
              autoFocus
              disabled={addBusy}
              placeholder="e.g. Provincials Trip"
              onChange={e => { setAddError(''); setAddNewCat(e.target.value); }}
            />
            <p className={styles.formHint}>A heading of your own — no other team sees it.</p>
          </div>
        )}
        <label className={styles.label} htmlFor="manager-add-name">Item name</label>
        <input
          id="manager-add-name"
          className={styles.input}
          value={addName}
          maxLength={80}
          autoFocus={!isNew}
          disabled={addBusy}
          placeholder={side === 'in' ? 'e.g. Bottle drive' : 'e.g. Charter bus'}
          onChange={e => { setAddError(''); setAddName(e.target.value); }}
          onKeyDown={e => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') setAdding(null); }}
        />
        <p className={styles.formHint}>
          Saved to this team’s list only.{report ? ` ${report}` : ''}
        </p>
        <div className={styles.managerAddActions}>
          <button type="button" className={styles.btnGhost} disabled={addBusy} onClick={() => setAdding(null)}>Cancel</button>
          <button type="button" className={styles.btnPrimary} disabled={addBusy} onClick={submitAdd}>
            {addBusy ? 'Adding…' : 'Add item'}
          </button>
        </div>
      </div>
    );
  }

  function band(side: BudgetItemDirection) {
    const shelves = view.bands[side];
    const own = view.ownPerBand[side];
    const showOwnCount = filter === 'team' || filter === 'all';
    return (
      <div key={side}>
        <div className={styles.managerBand}>
          <span className={styles.managerBandTitle}>{SIDE_BAND_LABEL[side]}</span>
          {showOwnCount && (
            <span className={styles.managerBandCount}>{own === 0 ? 'none of yours yet' : `${own} of yours`}</span>
          )}
          <button
            type="button"
            className={styles.managerAdd}
            disabled={!!busyId || addBusy}
            onClick={() => openAdd(side)}
          >
            <Plus size={13} aria-hidden /> Item
          </button>
        </div>
        {addForm(side)}
        {/* ⚠ SILENT WHILE A SEARCH IS RUNNING — the one line above the bands answers a miss for
            both sides at once; a second "nothing matches" under each band said it three times. */}
        {shelves.length === 0 && adding !== side && !query.trim() && (
          <p className={`${styles.formHint} ${styles.managerEmpty}`}>
            {filter === 'team'
              ? 'Nothing of yours on this side yet — “+ Item” adds one.'
              : 'Nothing on this side.'}
          </p>
        )}
        {shelves.map(shelfBlock)}
      </div>
    );
  }

  /* ══ Use a shared item instead ═════════════════════════════════════════════════════════════════ */
  if (folding) {
    const { selected, side, targets, target, moving, reFiled } = fold;
    /* ⚠ THE CHIP'S OWN WORD, read from `SIDE_FLOW_SHORT` — this line used to say "money in" on
       one side and "expense" on the other, the same mixed-register bug the picker had. */
    const sideWord = side ? SIDE_FLOW_SHORT[side] : '';
    return frame(
      'Use a shared item instead',
      'Fold your team’s items into one your club or FieldLogicHQ already shares',
      (
        <>
          {error && <p className={styles.errorText}>{error}</p>}

          <h4 className={styles.formSectionTitle}>Which of our items?</h4>
          <p className={styles.formHint}>
            Pick as many as you like — they all move onto the same shared item. Once you&rsquo;ve
            picked one, the rest of the list narrows to items on the <strong>same side</strong> of
            the books, because an item can only be folded into another that points the same way.
          </p>
          {ours.map(({ item, categoryName }) => {
            const checked  = foldSources.includes(item.id);
            /* ⚠ DISABLED RATHER THAN HIDDEN — greyed out with a reason is the answer to the question
               a coach who ticked an expense and cannot find their income item is actually asking. */
            const wrongSide = side != null && item.direction !== side && !checked;
            const count = usage?.[item.id]?.total ?? 0;
            return (
              <label
                key={item.id}
                className={`${styles.tagManagerRow} ${styles.foldPick}`}
                data-disabled={wrongSide ? 'true' : undefined}
                title={wrongSide
                  ? `“${item.name}” is on the other side of the books — fold those separately`
                  : undefined}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={wrongSide || foldBusy}
                  onChange={e => {
                    setError('');
                    setFoldSources(prev => e.target.checked
                      ? [...prev, item.id]
                      : prev.filter(id => id !== item.id));
                    /* ⚠ THE TARGET IS DROPPED WHEN THE SIDE COULD HAVE CHANGED — un-ticking the last
                       item re-opens both sides, and a target chosen under the old one could be a word
                       the new selection may not reach. */
                    if (!e.target.checked) setFoldTargetId('');
                  }}
                />
                <span className={styles.tagManagerName}>
                  <span className={styles.mutedInline}>{categoryName} · </span>{item.name}
                </span>
                <span className={styles.foldCount}>
                  {count === 0 ? 'nothing filed' : `${count} record${count === 1 ? '' : 's'}`}
                </span>
                <span className={`${styles.badge} ${item.direction === 'in' ? styles.badgeActive : styles.badgeDraft}`}>
                  {SIDE_FLOW_SHORT[item.direction]}
                </span>
              </label>
            );
          })}

          <h4 className={styles.formSectionTitle} style={{ marginTop: '1.25rem' }}>
            Replace them with
          </h4>
          {selected.length === 0 ? (
            <p className={styles.formHint}>Pick at least one of your items above first.</p>
          ) : targets.length === 0 ? (
            <p className={styles.formHint}>
              There are no standard or club items on the <strong>{sideWord}</strong> side to fold
              these into yet. Your club can share one from its own budget items, and it will appear
              here.
            </p>
          ) : (
            <div className={styles.tagManagerRow}>
              <select
                className={`${styles.select} ${styles.tagManagerName}`}
                value={foldTargetId}
                disabled={foldBusy}
                onChange={e => { setError(''); setFoldTargetId(e.target.value); }}
              >
                <option value="">Choose a shared item…</option>
                {targets.map(({ item, categoryName }) => (
                  <option key={item.id} value={item.id}>{categoryName} · {item.name}</option>
                ))}
              </select>
              {target && tierChip(target.item)}
            </div>
          )}

          {target && selected.length > 0 && !usage && (
            <p className={styles.formHint}>Counting what&rsquo;s filed against those items…</p>
          )}
          {target && selected.length > 0 && usage && (
            <div className={styles.foldConfirm}>
              {moving.total > 0 ? (
                <p>
                  <strong>{moving.total} record{moving.total === 1 ? '' : 's'}</strong> move onto{' '}
                  <strong>{target.item.name}</strong> — {describeBudgetItemUsage(moving)}.
                </p>
              ) : (
                <p>
                  Nothing is filed against {selected.length === 1 ? 'that item' : 'those items'} yet,
                  so no records move.
                </p>
              )}
              <p className={styles.formHint}>
                Your {selected.length === 1 ? 'item is' : `${selected.length} items are`} removed
                afterwards. <strong>No money changes</strong> — only what it&rsquo;s filed under.
              </p>
              {reFiled.length > 0 && (
                /* ⚠⚠ THE ONE CONSEQUENCE A COACH CANNOT SEE COMING (owner ruling 2026-08-17): folding
                   across categories re-files those records under a different heading on Budget vs.
                   Actual. Said before the button, in the words of the actual items involved. */
                <div className={styles.foldHeadsUp}>
                  {reFiled.map(({ item, categoryName }) => (
                    <p key={item.id}>
                      <strong>Heads up:</strong> “{item.name}” sits under {categoryName}. Its
                      records will move to {target.categoryName}, where “{target.item.name}” lives.
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ),
      (
        <>
          <button type="button" className={styles.btnGhost} disabled={foldBusy} onClick={leaveFold}>Cancel</button>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={foldBusy || !target || selected.length === 0 || !usage}
            onClick={runFold}
          >
            {foldBusy ? 'Moving…'
              : moving.total > 0
                ? `Move ${moving.total} record${moving.total === 1 ? '' : 's'}`
                : `Remove ${selected.length} item${selected.length === 1 ? '' : 's'}`}
          </button>
        </>
      ),
    );
  }

  /* ══ The dialog ════════════════════════════════════════════════════════════════════════════════ */
  const nothingShown = view.bands.in.length === 0 && view.bands.out.length === 0 && view.orphans.length === 0;
  return frame(
    MANAGER_TITLE,
    'What your budget lines are filed under. Yours to change; the rest shown on request.',
    (
      <>
        {error && <p className={styles.errorText}>{error}</p>}
        {notice && <p className={styles.formHint}>{notice}</p>}

        <div className={styles.managerSearch}>
          <Search size={15} aria-hidden />
          <input
            className={styles.input}
            type="search"
            value={query}
            placeholder="Find a category or item"
            aria-label="Find a category or item"
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* ⚠ THE CHIP WORDS, WITH COUNTS OF THE LIBRARY. Our own is the default (ruling Q4). */}
        <div className={styles.managerFilters} role="group" aria-label="Show">
          {MANAGER_FILTER_ORDER.map(f => (
            <button
              key={f}
              type="button"
              className={`${styles.managerChip} ${filter === f ? styles.managerChipOn : ''}`}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {MANAGER_FILTER_LABEL[f]}{f !== 'all' && <b>{view.counts[f]}</b>}
            </button>
          ))}
        </div>

        {nothingShown && query.trim() && (
          <p className={styles.formHint}>
            Nothing in {MANAGER_FILTER_LABEL[filter]} matches “{query.trim()}”.
            {view.matchesUnderEverything > 0 && (
              <>
                {' '}
                <button type="button" className={styles.btnGhost} onClick={() => setFilter('all')}>
                  Show {view.matchesUnderEverything} under Everything
                </button>
              </>
            )}
          </p>
        )}

        {SIDE_ORDER.map(band)}

        {view.orphans.length > 0 && (
          <div>
            <div className={styles.managerBand}>
              <span className={styles.managerBandTitle}>Nothing under it yet</span>
              <span className={styles.managerBandCount}>
                {view.orphans.length === 1 ? 'a heading of yours with no items' : 'headings of yours with no items'}
              </span>
            </div>
            <div className={styles.managerShelf}>{view.orphans.map(headingRow)}</div>
          </div>
        )}

        <p className={styles.formHint} style={{ marginTop: '0.5rem' }}>
          Renaming changes the name <strong>everywhere</strong>, including on everything already filed
          against it. An item is removed only while <strong>nothing is filed against it</strong> — once
          something is, rename it or fold it into a shared item. A category of yours is removed only
          while it holds nothing. An item stays on the side it was made on.
        </p>
        <p className={styles.formHint}>
          <strong>Standard</strong> and <strong>Club</strong> headings and items are read-only here —
          switch the chips above to see them. Your club renames its own from its Org Budget.
        </p>
      </>
    ),
    (
      <>
        {/* ⚠ THE FOLD IS THE ONLY WAY A USED ITEM EVER DISAPPEARS, so its door stays within reach of
            the sentence offering it. Hidden with nothing to fold ONTO, or nothing of ours to fold. */}
        {ours.length > 0 && theirs.length > 0 && (
          <button
            type="button"
            className={styles.btnSecondary}
            style={{ marginRight: 'auto' }}
            disabled={!!busyId || addBusy}
            onClick={() => { setError(''); setNotice(''); setFolding(true); }}
          >
            Use a shared item instead
          </button>
        )}
        <button type="button" className={styles.btnGhost} onClick={onClose}>Done</button>
      </>
    ),
  );
}
