'use client';
import { useState } from 'react';
import { X, Pencil, RotateCcw, Archive } from 'lucide-react';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import AwardIconPicker from '@/components/coaches/AwardIconPicker';
import type { RepTeamAwardType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

const MAX_AWARD_TYPES = 30;

/**
 * Edit (name + icon together) / retire / restore manager for a team's award-type library
 * (Coach Tags & Player Awards Phase 2). No merge tool, unlike tags — a coach picks from a
 * short curated list rather than free-typing per game, so name drift isn't the same risk.
 * Retiring never deletes: every past award keeps resolving the type's current name/emoji.
 */
export default function AwardTypeManagerModal({
  orgSlug,
  teamId,
  awardTypes,
  onClose,
  onChanged,
}: {
  orgSlug: string;
  teamId: string;
  awardTypes: RepTeamAwardType[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/award-types`;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<'edit' | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showRetired, setShowRetired] = useState(false);

  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState<string | null>('🏅');
  const [adding, setAdding] = useState(false);

  const active = [...awardTypes].filter(t => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const retired = [...awardTypes].filter(t => !t.isActive).sort((a, b) => a.name.localeCompare(b.name));

  function startEdit(t: RepTeamAwardType) {
    setError('');
    setEditingId(t.id);
    setEditName(t.name);
    setEditEmoji(t.emoji);
  }

  async function patchType(id: string, body: Record<string, unknown>): Promise<boolean> {
    setError('');
    setBusyId(id);
    try {
      const res = await fetch(`${base}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Update failed');
      }
      onChanged();
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    const ok = await patchType(id, { name, emoji: editEmoji });
    if (ok) setEditingId(null);
  }

  async function handleRetire(t: RepTeamAwardType) {
    const ok = await confirm({
      title: 'Retire award?',
      message: `"${t.name}" will drop off the picker for new awards. Every award already given stays exactly as it was.`,
      confirmText: 'Retire',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    await patchType(t.id, { isActive: false });
  }

  async function handleRestore(t: RepTeamAwardType) {
    await patchType(t.id, { isActive: true });
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setError('');
    setAdding(true);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji: newEmoji }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not add award type');
      }
      setNewName('');
      setNewEmoji('🏅');
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not add award type');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.sheetOnMobile}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Manage award types</h3>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div className={styles.formBody}>
          {active.length === 0 ? (
            <p className={styles.formHint}>No award types yet.</p>
          ) : (
            active.map(t => (
              <div key={t.id} className={styles.tagManagerRow}>
                {editingId === t.id ? (
                  <>
                    <button
                      type="button"
                      className={styles.awardEmojiPickBtn}
                      onClick={() => setPickerFor('edit')}
                    >
                      {editEmoji || '🏅'}
                    </button>
                    <input
                      className={`${styles.input} ${styles.tagManagerName}`}
                      value={editName}
                      maxLength={40}
                      autoFocus
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(t.id); if (e.key === 'Escape') setEditingId(null); }}
                    />
                    <div className={styles.tagManagerActions}>
                      <button className={styles.btnSecondary} disabled={busyId === t.id || !editName.trim()} onClick={() => saveEdit(t.id)}>Save</button>
                      <button className={styles.btnGhost} disabled={busyId === t.id} onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                    {pickerFor === 'edit' && (
                      <AwardIconPicker
                        value={editEmoji}
                        onClose={() => setPickerFor(null)}
                        onSelect={emoji => { setEditEmoji(emoji); setPickerFor(null); }}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <span className={styles.tagManagerName}>{t.emoji ? `${t.emoji} ` : ''}{t.name}</span>
                    <div className={styles.tagManagerActions}>
                      <button title="Edit" disabled={!!busyId} onClick={() => startEdit(t)}><Pencil size={14} /></button>
                      <button title="Retire" disabled={!!busyId} onClick={() => handleRetire(t)}><Archive size={14} /></button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
          {error && <p className={styles.errorText}>{error}</p>}

          <p className={styles.formHint}>{active.length} of {MAX_AWARD_TYPES} award types used.</p>

          <div className={styles.tagPickerRow}>
            <button type="button" className={styles.awardEmojiPickBtn} onClick={() => setPickerFor('new')}>
              {newEmoji || '🏅'}
            </button>
            <input
              className={styles.input}
              value={newName}
              maxLength={40}
              placeholder="e.g. Golden Glove"
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <button className={styles.btnSecondary} disabled={adding || !newName.trim() || active.length >= MAX_AWARD_TYPES} onClick={handleAdd}>
              + Add
            </button>
          </div>
          {pickerFor === 'new' && (
            <AwardIconPicker
              value={newEmoji}
              onClose={() => setPickerFor(null)}
              onSelect={emoji => { setNewEmoji(emoji); setPickerFor(null); }}
            />
          )}

          {retired.length > 0 && (
            <>
              <button className={styles.tagManageLink} onClick={() => setShowRetired(v => !v)}>
                Retired ({retired.length}) {showRetired ? '▲' : '▼'}
              </button>
              {showRetired && retired.map(t => (
                <div key={t.id} className={styles.tagManagerRow}>
                  <span className={styles.tagManagerName} style={{ color: 'var(--white-45)', textDecoration: 'line-through' }}>
                    {t.emoji ? `${t.emoji} ` : ''}{t.name}
                  </span>
                  <div className={styles.tagManagerActions}>
                    <button title="Restore" disabled={!!busyId} onClick={() => handleRestore(t)}><RotateCcw size={14} /></button>
                  </div>
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
