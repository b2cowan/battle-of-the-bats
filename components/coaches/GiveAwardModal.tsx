'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import AwardIconPicker from '@/components/coaches/AwardIconPicker';
import type { RepTeamAwardType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "Give an award" moment (Coach Tags & Player Awards Phase 2) — opened either from a specific
 * game (eventContext set, no game-picker needed since the coach is already looking at it) or
 * generally from the awards report page (eventContext null — a free-text tournament/occasion,
 * or left blank for a general season recognition). Resets after each save so a coach can hand
 * out a second/third award in the same visit without reopening anything.
 */
export default function GiveAwardModal({
  orgSlug,
  teamId,
  players,
  awardTypes,
  eventContext,
  onClose,
  onChanged,
}: {
  orgSlug: string;
  teamId: string;
  players: { id: string; name: string; number: string | null }[];
  awardTypes: RepTeamAwardType[];
  eventContext: { id: string; label: string } | null;
  onClose: () => void;
  // Fired after EITHER a successful save or an inline type-creation — both change what the
  // parent's own awardTypes/awards state should show, so both need to trigger its refetch
  // (a type created here but never followed by a save must not go stale in the parent).
  onChanged: () => void;
}) {
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/awards`;

  const [localTypes, setLocalTypes] = useState(awardTypes.filter(t => t.isActive));
  const [playerId, setPlayerId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [tournamentLabel, setTournamentLabel] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [creatingType, setCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeEmoji, setNewTypeEmoji] = useState<string | null>('🏅');
  const [pickerOpen, setPickerOpen] = useState(false);

  async function handleCreateType() {
    const name = newTypeName.trim();
    if (!name) return;
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/award-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji: newTypeEmoji }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Could not create award type');
      setLocalTypes(prev => [...prev, d.awardType]);
      setTypeId(d.awardType.id);
      setNewTypeName('');
      setNewTypeEmoji('🏅');
      setCreatingType(false);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create award type');
    }
  }

  async function handleSave() {
    setError('');
    if (!playerId) { setError('Pick a player.'); return; }
    if (!typeId) { setError('Pick an award.'); return; }
    setSaving(true);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          awardTypeId: typeId,
          ...(eventContext
            ? { eventId: eventContext.id }
            : { tournamentLabel: tournamentLabel.trim() || undefined }),
          note: note.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Could not save award');

      // Save closes the modal (owner preference) — the underlying screen's own award list
      // already updates via onChanged, so that's the confirmation; giving a second award for
      // the same game is just a re-tap of "Give an award", not a reason to keep this one open.
      onChanged();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save award');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.sheetOnMobile}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Give an award</h3>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div className={styles.formBody}>
          {eventContext ? (
            <p className={styles.formHint}>For: <strong>{eventContext.label}</strong></p>
          ) : (
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Tournament or occasion (optional)</h4>
              <input
                className={styles.input}
                value={tournamentLabel}
                maxLength={80}
                placeholder="e.g. Milton Slo-Pitch Classic — leave blank for a general recognition"
                onChange={e => setTournamentLabel(e.target.value)}
              />
            </div>
          )}

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Player</h4>
            <select className={styles.select} value={playerId} onChange={e => setPlayerId(e.target.value)}>
              <option value="">Choose a player…</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.number ? `#${p.number} ` : ''}{p.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Award</h4>
            <div className={styles.tagChips}>
              {localTypes.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.tagChip} ${typeId === t.id ? styles.tagChipActive : ''}`}
                  onClick={() => setTypeId(t.id)}
                >
                  {t.emoji ? `${t.emoji} ` : ''}{t.name}
                </button>
              ))}
              <button type="button" className={styles.tagChipCreate} onClick={() => setCreatingType(v => !v)}>
                + New
              </button>
            </div>
            {creatingType && (
              <div className={styles.tagPickerRow} style={{ marginTop: '0.5rem' }}>
                <button type="button" className={styles.awardEmojiPickBtn} onClick={() => setPickerOpen(true)}>
                  {newTypeEmoji || '🏅'}
                </button>
                <input
                  className={styles.input}
                  value={newTypeName}
                  maxLength={40}
                  placeholder="New award name"
                  onChange={e => setNewTypeName(e.target.value)}
                />
                <button className={styles.btnSecondary} disabled={!newTypeName.trim()} onClick={handleCreateType}>Add</button>
              </div>
            )}
            {pickerOpen && (
              <AwardIconPicker
                value={newTypeEmoji}
                onClose={() => setPickerOpen(false)}
                onSelect={emoji => { setNewTypeEmoji(emoji); setPickerOpen(false); }}
              />
            )}
          </div>

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Note (optional)</h4>
            <textarea
              className={styles.textarea}
              value={note}
              maxLength={200}
              placeholder="e.g. Diving catch to end the game"
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {error && <p className={styles.errorText}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Close</button>
          <button className={styles.btnPrimary} disabled={saving} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
