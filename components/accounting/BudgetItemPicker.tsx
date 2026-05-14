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
  disabled?: boolean;
}

export default function BudgetItemPicker({
  categories,
  value,
  onChange,
  createItemEndpoint,
  createItemMode,
  disabled = false,
}: Props) {
  const [selectedCatId, setSelectedCatId] = useState<string>(value?.categoryId ?? '');
  const [selectedItemId, setSelectedItemId] = useState<string>(value?.itemId ?? '__misc__');

  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Local categories list that can be extended after a custom item is created
  const [localCategories, setLocalCategories] = useState<BudgetCategoryWithItems[]>(categories);

  useEffect(() => { setLocalCategories(categories); }, [categories]);

  const selectedCat = localCategories.find(c => c.id === selectedCatId) ?? null;
  const itemsForCat: BudgetItem[] = selectedCat?.items ?? [];

  function handleCatChange(catId: string) {
    setSelectedCatId(catId);
    setSelectedItemId('__misc__');
    setAddingItem(false);
    setSaveError('');

    const cat = localCategories.find(c => c.id === catId);
    if (cat) {
      const misc = cat.items.find(i => i.isMisc);
      onChange({
        categoryId:      cat.id,
        categoryName:    cat.name,
        itemId:          misc?.id ?? null,
        itemName:        misc?.name ?? 'Misc',
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
        body = { categoryId: selectedCatId, name, suggestedAmount: newItemAmount ? Number(newItemAmount) : null };
      }

      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create item');

      const newItem: BudgetItem = data.item;

      // Inject the new item into localCategories
      setLocalCategories(prev => prev.map(c =>
        c.id !== selectedCatId ? c : {
          ...c,
          items: [...c.items.filter(i => !i.isMisc), newItem, ...c.items.filter(i => i.isMisc)],
        }
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

  return (
    <div className={styles.picker}>
      {/* Category select */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Category</label>
          <select
            className={styles.select}
            value={selectedCatId}
            onChange={e => handleCatChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">— select category —</option>
            {localCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Item select — only shown once a category is picked */}
        {selectedCat && (
          <div className={styles.field}>
            <label className={styles.label}>Item</label>
            <select
              className={styles.select}
              value={addingItem ? '__add__' : selectedItemId}
              onChange={e => handleItemChange(e.target.value)}
              disabled={disabled}
            >
              {itemsForCat.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
              <option value="__add__">+ Add custom item…</option>
            </select>
          </div>
        )}
      </div>

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
              className="btn btn-primary"
              onClick={handleSaveCustomItem}
              disabled={saving || !newItemName.trim()}
            >
              {saving ? 'Saving…' : 'Add Item'}
            </button>
          </div>
          <p className={styles.hint}>
            This item will be saved to your org&apos;s library and become selectable for all coaches.
          </p>
        </div>
      )}
    </div>
  );
}
