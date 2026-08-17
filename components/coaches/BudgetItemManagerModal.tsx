'use client';
import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import type { BudgetCategoryWithItems, BudgetItem } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';

/**
 * OUR OWN WORDS — rename one, or move it to the other side (Money form P2, owner ruling 2026-08-16).
 *
 * ⚠⚠ THIS SCREEN IS WHAT MAKES THE FILTER SAFE TO SHIP. Migration 246 made an item's direction part
 * of what it is, and the picker now offers only the side you are working on — so a word filed on the
 * wrong side is a word a coach cannot reach from the form that needs it. Until this existed, a
 * coach's own item could not be renamed or re-pointed from anywhere in the product: the club-admin
 * editor refuses team-owned rows outright ("only that team can rename it") against a team surface
 * that did not exist. The ruling's "editable afterwards" had no editor.
 *
 * ⚠ THE TEAM'S OWN WORDS ONLY, and the read-only rest is SHOWN rather than hidden. A coach hunting
 * for "Diamond permits" needs to learn that it is a standard word and that is why there is no pencil
 * beside it — an editor that simply omitted everything it could not change would read as a list
 * missing half its contents, and the coach would go looking for a second screen that does not exist.
 *
 * ⚠ RENAMING IS RETROACTIVE AND MOVING IS NOT. The item NAMES the row (mig 240), so a rename reaches
 * every budget line and every recorded cost pointing at it — which is exactly what fixing a typo
 * should do. Moving a word across changes only which list it is offered in: Budget vs. Actual takes
 * a row's direction from what was actually filed against it, so nothing already recorded moves a
 * cent. Both facts are on screen, because a coach cannot consent to what they have not been told.
 */
/** One word with its category beside it — what both lists in this modal are made of. */
interface Row { item: BudgetItem; categoryName: string }

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

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  /**
   * How many records are filed against each of this team's own words.
   *
   * ⚠ FETCHED HERE RATHER THAN PASSED IN, because the panel behind this modal reads the taxonomy on
   * every money form and every budget line and has no business counting usage for all of them. The
   * count is opt-in on the list route (`usage=1`) and only this screen asks for it.
   *
   * ⚠ IT DISABLES THE BUTTON; THE SERVER IS WHAT REFUSES. This can go stale — a coach in another tab
   * can file a cost against a word between this fetch and the click — so the delete route counts
   * again and returns the real sentence. The button state is a courtesy, never the guard.
   */
  const [usage, setUsage] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/budget-items?teamId=${teamId}&usage=1`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.usage) setUsage(d.usage); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [orgSlug, teamId, categories]);

  /** Flattened and split, with each word's category beside it — the same shape the picker searches.
   *  ⚠ MEMOISED, and sorted here rather than at render: the rename `<input>`'s state lives in this
   *  component, so without this every keystroke while renaming re-flattens and re-sorts the whole
   *  library twice. `BudgetItemPicker`, built in the same release, already does exactly this. */
  const byCategoryThenName = (a: Row, b: Row) =>
    a.categoryName.localeCompare(b.categoryName) || a.item.name.localeCompare(b.item.name);

  const { ours, theirs } = useMemo(() => {
    const rows: Row[] = categories.flatMap(c => c.items.map(item => ({ item, categoryName: c.name })));
    return {
      ours:   rows.filter(r => r.item.teamId === teamId).sort(byCategoryThenName),
      theirs: rows.filter(r => r.item.teamId !== teamId).sort(byCategoryThenName),
    };
  }, [categories, teamId]);

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

  /** Remove one of this team's own words. The server refuses if anything is filed against it and
   *  says what — shown as-is, because that sentence is written for the coach. */
  async function remove(item: BudgetItem) {
    setError('');
    setBusyId(item.id);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/budget-items/${item.id}?teamId=${teamId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not remove that word');
      }
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not remove that word');
    } finally {
      setBusyId(null);
    }
  }

  function sideChip(item: BudgetItem) {
    const isIn = item.direction === 'in';
    return (
      <span className={`${styles.badge} ${isIn ? styles.badgeActive : styles.badgeDraft}`}>
        {isIn ? 'Money in' : 'Expense'}
      </span>
    );
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalScrollBody} ${styles.sheetOnMobile}`} onClick={e => e.stopPropagation()}>
        <CoachModalHeader
          title="Manage our items"
          subtitle="The words your team invented. Everything else is read-only."
          onClose={onClose}
        />

        <div className={styles.formBody}>
          {error && <p className={styles.errorText}>{error}</p>}

          {ours.length === 0 ? (
            <p className={styles.formHint}>
              Your team hasn&rsquo;t added any words of its own yet. Add one while building a budget
              line or recording money — it&rsquo;ll show up here to rename or move across.
            </p>
          ) : (
            <>
              <p className={styles.formHint}>
                Renaming one changes what it&rsquo;s called <strong>everywhere</strong> — on your plan,
                on Budget vs. Actual and on everything already recorded against it. A word can only be
                removed while <strong>nothing is filed against it</strong>; once something is, rename it
                instead. A word stays on the side it was made on — put one in the wrong place and the
                fix is to remove it and add it again.
              </p>
              {ours.map(({ item, categoryName }) => (
                <div key={item.id} className={styles.tagManagerRow}>
                  {renamingId === item.id ? (
                    <>
                      <input
                        className={`${styles.input} ${styles.tagManagerName}`}
                        value={renameDraft}
                        maxLength={80}
                        autoFocus
                        onChange={e => setRenameDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && renameDraft.trim()) patch(item, { name: renameDraft.trim() });
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                      />
                      <div className={styles.tagManagerActions}>
                        <button
                          className={styles.btnSecondary}
                          disabled={busyId === item.id || !renameDraft.trim()}
                          onClick={() => patch(item, { name: renameDraft.trim() })}
                        >
                          Save
                        </button>
                        <button className={styles.btnGhost} disabled={busyId === item.id} onClick={() => setRenamingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className={styles.tagManagerName}>
                        <span className={styles.mutedInline}>{categoryName} · </span>{item.name}
                      </span>
                      {sideChip(item)}
                      <div className={styles.tagManagerActions}>
                        <button
                          title={`Rename ${item.name}`}
                          disabled={!!busyId}
                          onClick={() => { setError(''); setRenamingId(item.id); setRenameDraft(item.name); }}
                        >
                          <Pencil size={14} aria-hidden />
                        </button>
                        {/* ⚠⚠ THE "MOVE TO THE OTHER SIDE" BUTTON IS RETRACTED (owner ruling
                            2026-08-17). It shipped here on 2026-08-16 and lasted one day: a category
                            can belong to one side of the books, so a moved word can land under a
                            heading that makes no sense for it. Removing the word and adding it on the
                            other side is the honest answer, and a word with history cannot be removed
                            anyway — which makes a wrong-side word a five-second problem rather than a
                            data one. The server refuses a `direction` outright now, so a stale client
                            is told rather than silently ignored. */}
                        <button
                          title={usage[item.id]
                            ? `${item.name} can’t be removed — ${usage[item.id]} records are filed against it`
                            : `Remove ${item.name}`}
                          disabled={!!busyId || !!usage[item.id]}
                          onClick={() => remove(item)}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}

          {theirs.length > 0 && (
            <>
              <h4 className={styles.formSectionTitle} style={{ marginTop: '1.25rem' }}>
                Standard and club words
              </h4>
              <p className={styles.formHint}>
                These belong to everybody — the standard library and whatever your club shares with
                every team — so they&rsquo;re read-only here. Ask your club to change one.
              </p>
              {theirs.map(({ item, categoryName }) => (
                <div key={item.id} className={styles.tagManagerRow}>
                  <span className={`${styles.tagManagerName} ${styles.mutedInline}`}>
                    {categoryName} · {item.name}
                  </span>
                  {sideChip(item)}
                </div>
              ))}
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
