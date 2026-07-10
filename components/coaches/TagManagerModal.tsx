'use client';
import { useState } from 'react';
import { X, Pencil, Trash2, GitMerge } from 'lucide-react';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import type { RepTeamTag } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * Rename / merge / delete manager for a team's game-tag library (Coach Tags & Player Awards
 * Phase 1). Merge is the curation tool the plan calls for — it folds one tag's game history into
 * another so drift ("Top teams" vs "top in province") doesn't fork the library — a plain delete
 * does not re-point anything and is only for a tag that was never really used.
 */
export default function TagManagerModal({
  orgSlug,
  teamId,
  tags,
  onClose,
  onChanged,
}: {
  orgSlug: string;
  teamId: string;
  tags: RepTeamTag[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/tags`;

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  function startRename(tag: RepTeamTag) {
    setError('');
    setMergingId(null);
    setRenamingId(tag.id);
    setRenameDraft(tag.name);
  }

  async function saveRename(tagId: string) {
    const name = renameDraft.trim();
    if (!name) return;
    setError('');
    setBusyId(tagId);
    try {
      const res = await fetch(`${base}/${tagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Rename failed');
      }
      setRenamingId(null);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Rename failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(tag: RepTeamTag) {
    const ok = await confirm({
      title: 'Delete tag?',
      message: `Delete "${tag.name}"? Any games tagged with it will just lose that tag — if you'd rather keep their history under a different tag, use Merge instead.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setError('');
    setBusyId(tag.id);
    try {
      const res = await fetch(`${base}/${tag.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Delete failed');
      }
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  function startMerge(tag: RepTeamTag) {
    setError('');
    setRenamingId(null);
    setMergingId(tag.id);
    setMergeTargetId('');
  }

  async function confirmMerge(loser: RepTeamTag) {
    const winner = tags.find(t => t.id === mergeTargetId);
    if (!winner) return;
    const ok = await confirm({
      title: 'Merge tags?',
      message: `Every game tagged "${loser.name}" will be tagged "${winner.name}" instead, and "${loser.name}" will be removed. This can't be undone.`,
      confirmText: 'Merge',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setError('');
    setBusyId(loser.id);
    try {
      const res = await fetch(`${base}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerTagId: winner.id, loserTagId: loser.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Merge failed');
      }
      setMergingId(null);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Merge failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.sheetOnMobile}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Manage game tags</h3>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div className={styles.formBody}>
          {sorted.length === 0 ? (
            <p className={styles.formHint}>No tags yet. Add one from a game&rsquo;s edit screen — it&rsquo;ll show up here to rename, merge, or delete.</p>
          ) : (
            sorted.map(tag => (
              <div key={tag.id} className={styles.tagManagerRow}>
                {renamingId === tag.id ? (
                  <>
                    <input
                      className={`${styles.input} ${styles.tagManagerName}`}
                      value={renameDraft}
                      maxLength={40}
                      autoFocus
                      onChange={e => setRenameDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(tag.id); if (e.key === 'Escape') setRenamingId(null); }}
                    />
                    <div className={styles.tagManagerActions}>
                      <button className={styles.btnSecondary} disabled={busyId === tag.id || !renameDraft.trim()} onClick={() => saveRename(tag.id)}>Save</button>
                      <button className={styles.btnGhost} disabled={busyId === tag.id} onClick={() => setRenamingId(null)}>Cancel</button>
                    </div>
                  </>
                ) : mergingId === tag.id ? (
                  <>
                    <select
                      className={`${styles.select} ${styles.tagManagerName}`}
                      value={mergeTargetId}
                      onChange={e => setMergeTargetId(e.target.value)}
                      autoFocus
                    >
                      <option value="">Merge &ldquo;{tag.name}&rdquo; into…</option>
                      {sorted.filter(t => t.id !== tag.id).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <div className={styles.tagManagerActions}>
                      <button className={styles.btnSecondary} disabled={busyId === tag.id || !mergeTargetId} onClick={() => confirmMerge(tag)}>Merge</button>
                      <button className={styles.btnGhost} disabled={busyId === tag.id} onClick={() => setMergingId(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className={styles.tagManagerName}>{tag.name}</span>
                    <div className={styles.tagManagerActions}>
                      <button title="Rename" disabled={!!busyId} onClick={() => startRename(tag)}><Pencil size={14} /></button>
                      {sorted.length > 1 && (
                        <button title="Merge into another tag" disabled={!!busyId} onClick={() => startMerge(tag)}><GitMerge size={14} /></button>
                      )}
                      <button title="Delete" disabled={!!busyId} onClick={() => handleDelete(tag)}><Trash2 size={14} /></button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
          {error && <p className={styles.errorText}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
