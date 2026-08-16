'use client';
import { useState, useEffect } from 'react';
import type { BudgetCategoryWithItems, BudgetItem } from '@/lib/types';
import styles from './BudgetItemPicker.module.css';

export interface BudgetItemSelection {
  categoryId: string;
  categoryName: string;
  itemId: string | null;    // null when "Misc" or a free-text custom description is used
  itemName: string;
  suggestedAmount: number | null;
}

interface Props {
  categories: BudgetCategoryWithItems[];
  value: BudgetItemSelection | null;
  onChange: (v: BudgetItemSelection) => void;
  // API path for creating new items. Differs between admin and coach contexts:
  //   admin:  /api/admin/accounting/budget-categories
  //   coach:  /api/coaches/[orgSlug]/budget-items
  createItemEndpoint: string;
  // For admin route the endpoint needs [catId] in the path; for coach it's a body field.
  // Specify which pattern to use.
  createItemMode: 'admin' | 'coach';
  /** Coach mode: which team owns an item created here (mig 240). An item belongs to ONE team and
   *  appears in no other team's picker, so the server requires this and refuses without it. */
  teamId?: string;
  // Coach mode only: allow creating a new top-level category inline (posts
  // { newCategoryName } to createItemEndpoint). Owner decision 2026-07-09.
  allowCreateCategory?: boolean;
  /** Lets a caller point its "you must pick one" message at the first select. */
  selectId?: string;
  /** Draw the controls as at fault — the picker is a required field since mig 240. */
  invalid?: boolean;
  disabled?: boolean;
}

export default function BudgetItemPicker({
  categories,
  value,
  onChange,
  createItemEndpoint,
  createItemMode,
  teamId,
  allowCreateCategory = false,
  selectId,
  invalid = false,
  disabled = false,
}: Props) {
  const [selectedCatId, setSelectedCatId] = useState<string>(value?.categoryId ?? '');
  /* ⚠ NO "MISC" DEFAULT ANY MORE (owner ruling 2026-08-15). Choosing a category used to silently
     select that category's Misc item, so a coach could complete the picker without ever making the
     choice — which was harmless while the description named the row and is not now the ITEM does.
     A report row called "Misc" answers nothing. The item starts unchosen and the form refuses to
     save until it isn't. */
  const [selectedItemId, setSelectedItemId] = useState<string>(value?.itemId ?? '');

  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');

  // Local categories list that can be extended after a custom item is created
  const [localCategories, setLocalCategories] = useState<BudgetCategoryWithItems[]>(categories);

  useEffect(() => { setLocalCategories(categories); }, [categories]);

  const selectedCat = localCategories.find(c => c.id === selectedCatId) ?? null;
  const itemsForCat: BudgetItem[] = selectedCat?.items ?? [];

  function handleCatChange(catId: string) {
    if (catId === '__addcat__') {
      setAddingCategory(true);
      setNewCatName('');
      setCatError('');
      return;
    }
    setAddingCategory(false);
    setSelectedCatId(catId);
    setSelectedItemId('');
    setAddingItem(false);
    setSaveError('');

    /* ⚠ CHOOSING A CATEGORY NO LONGER CHOOSES AN ITEM. It used to auto-select that category's
       "Misc" row, which meant a coach could leave the picker having made half the decision and not
       know it. Now the selection is reported with a null item so the caller's own validation can
       say what is still missing — and the item select below opens on "choose an item". */
    const cat = localCategories.find(c => c.id === catId);
    if (cat) {
      onChange({
        categoryId:      cat.id,
        categoryName:    cat.name,
        itemId:          null,
        itemName:        '',
        suggestedAmount: null,
      });
    }
  }

  function handleItemChange(itemId: string) {
    if (itemId === '__add__') {
      setAddingItem(true);
      setNewItemName('');
      setNewItemAmount('');
      setSaveError('');
      return;
    }
    setAddingItem(false);
    setSelectedItemId(itemId);
    const item = itemsForCat.find(i => i.id === itemId);
    if (item && selectedCat) {
      onChange({
        categoryId:      selectedCat.id,
        categoryName:    selectedCat.name,
        itemId:          item.id,
        itemName:        item.name,
        suggestedAmount: item.suggestedAmount,
      });
    }
  }

  async function handleSaveCustomItem() {
    const name = newItemName.trim();
    if (!name || !selectedCatId) return;
    setSaving(true);
    setSaveError('');

    try {
      let url: string;
      let body: Record<string, unknown>;

      if (createItemMode === 'admin') {
        url  = `${createItemEndpoint}/${selectedCatId}/items`;
        body = { name, suggestedAmount: newItemAmount ? Number(newItemAmount) : null };
      } else {
        url  = createItemEndpoint;
        // ⚠ `teamId` IS REQUIRED BY THE SERVER (mig 240) — a coach's item belongs to their team and
        // appears in no other team's picker. Omitting it used to mean "org-wide", which is the
        // behaviour this replaced, so the server refuses rather than assuming.
        body = { categoryId: selectedCatId, teamId, name, suggestedAmount: newItemAmount ? Number(newItemAmount) : null };
      }

      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create item');

      const newItem: BudgetItem = data.item;

      // Inject the new item into localCategories. (Misc items are no longer offered at all, so
      // there is nothing to keep pinned to the bottom of the list.)
      setLocalCategories(prev => prev.map(c =>
        c.id !== selectedCatId ? c : { ...c, items: [...c.items, newItem] }
      ));

      setSelectedItemId(newItem.id);
      setAddingItem(false);

      onChange({
        categoryId:      selectedCatId,
        categoryName:    selectedCat?.name ?? '',
        itemId:          newItem.id,
        itemName:        newItem.name,
        suggestedAmount: newItem.suggestedAmount,
      });
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to create item');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCustomCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setCatSaving(true);
    setCatError('');

    try {
      const res = await fetch(createItemEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCategoryName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create category');

      const newCat: BudgetCategoryWithItems = data.category;
      setLocalCategories(prev => [...prev, newCat]);
      setAddingCategory(false);
      setSelectedCatId(newCat.id);
      setSelectedItemId('');
      // A brand-new category has no items yet, so the choice is genuinely half-made: report a null
      // item and let the caller's validation ask for the other half.
      onChange({
        categoryId:      newCat.id,
        categoryName:    newCat.name,
        itemId:          null,
        itemName:        '',
        suggestedAmount: null,
      });
    } catch (e: unknown) {
      setCatError(e instanceof Error ? e.message : 'Failed to create category');
    } finally {
      setCatSaving(false);
    }
  }

  return (
    <div className={styles.picker}>
      {/* Category select */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Category</label>
          <select
            id={selectId}
            className={`${styles.select} ${invalid ? styles.selectBad : ''}`}
            value={addingCategory ? '__addcat__' : selectedCatId}
            onChange={e => handleCatChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">— select category —</option>
            {localCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            {allowCreateCategory && <option value="__addcat__">+ Add custom category…</option>}
          </select>
        </div>

        {/* Item select — only shown once a category is picked */}
        {selectedCat && (
          <div className={styles.field}>
            <label className={styles.label}>Item</label>
            <select
              className={`${styles.select} ${invalid ? styles.selectBad : ''}`}
              value={addingItem ? '__add__' : selectedItemId}
              onChange={e => handleItemChange(e.target.value)}
              disabled={disabled}
            >
              {/* Present until something is chosen — the picker no longer answers for the coach. */}
              <option value="">— select item —</option>
              {itemsForCat.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
              <option value="__add__">+ Add custom item…</option>
            </select>
          </div>
        )}
      </div>

      {/* Inline custom-category form */}
      {addingCategory && (
        <div className={styles.addForm}>
          <div className={styles.addFormRow}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Category name</label>
              <input
                className={styles.input}
                type="text"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value.slice(0, 80))}
                placeholder="e.g. Sponsorships"
                maxLength={80}
                autoFocus
                disabled={catSaving}
              />
            </div>
          </div>
          {catError && <p className={styles.error}>{catError}</p>}
          <div className={styles.addFormActions}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setAddingCategory(false); setCatError(''); }}
              disabled={catSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-lime"
              onClick={handleSaveCustomCategory}
              disabled={catSaving || !newCatName.trim()}
            >
              {catSaving ? 'Saving…' : 'Add Category'}
            </button>
          </div>
          <p className={styles.hint}>
            This category will be saved to your org&apos;s library and become selectable for all coaches.
          </p>
        </div>
      )}

      {/* Inline custom-item form */}
      {addingItem && selectedCat && (
        <div className={styles.addForm}>
          <div className={styles.addFormRow}>
            <div className={styles.field} style={{ flex: 2 }}>
              <label className={styles.label}>Item name</label>
              <input
                className={styles.input}
                type="text"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value.slice(0, 80))}
                placeholder={`e.g. Batting Cage Rental`}
                maxLength={80}
                autoFocus
                disabled={saving}
              />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Suggested $ <span className={styles.optional}>(optional)</span></label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={newItemAmount}
                onChange={e => setNewItemAmount(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </div>
          </div>
          {saveError && <p className={styles.error}>{saveError}</p>}
          <div className={styles.addFormActions}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setAddingItem(false); setSaveError(''); }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-lime"
              onClick={handleSaveCustomItem}
              disabled={saving || !newItemName.trim()}
            >
              {saving ? 'Saving…' : 'Add Item'}
            </button>
          </div>
          <p className={styles.hint}>
            {/* ⚠ THIS SENTENCE WAS A LIE FROM THE MOMENT mig 240 SHIPPED, and it is the exact copy
                two separate code comments predicted would be missed. A coach's item belongs to
                THEIR TEAM now and appears in no other team's list until a club admin publishes it;
                an admin's belongs to the club from the start. */}
            {createItemMode === 'coach'
              ? 'This item is saved to this team’s list — no other team will see it unless your club chooses to share it.'
              : 'This item will be saved to your org’s library and become selectable for all coaches.'}
          </p>
        </div>
      )}
    </div>
  );
}
