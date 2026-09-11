'use client';
import { useState } from 'react';
import AwardIconPicker from '@/components/coaches/AwardIconPicker';
import TagManagerDrawer from '@/components/coaches/TagManagerDrawer';
import { AWARD_TAG_MANAGE, type ComboTag } from '@/components/coaches/TagSearchCombobox';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import type { RepTeamAwardType, RepPlayerAward } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';

/**
 * "Give an award" moment (Coach Tags & Player Awards Phase 2) — opened either from a specific
 * game (eventContext set, no game-picker needed since the coach is already looking at it) or
 * generally from the awards report page (eventContext null — a free-text tournament/occasion,
 * or left blank for a general season recognition). Resets after each save so a coach can hand
 * out a second/third award in the same visit without reopening anything.
 *
 * ⚠ EDIT MODE (`editing` set — Awards One Tag Idiom Part A, 2026-09-11): the same form fixes a
 * mis-given award instead of creating a new one. Pre-filled from `editing`, titled "Edit award",
 * PATCHes `editing.id` rather than POSTing. Which GAME the award is for is NOT editable — a wrong
 * game is remove-and-re-give, same as a tag on the wrong event — so the caller must pass an
 * `eventContext` that matches `editing` itself (or null for a general award). ⚠ R0 (owner
 * ruling): this form carries no delete control of its own — removing an award is the row's own
 * trash icon with its own confirm, one job per control.
 */
export default function GiveAwardModal({
  orgSlug,
  teamId,
  players,
  awardTypes,
  eventContext,
  editing,
  onClose,
  onChanged,
}: {
  orgSlug: string;
  teamId: string;
  players: { id: string; name: string; number: string | null }[];
  awardTypes: RepTeamAwardType[];
  eventContext: { id: string; label: string } | null;
  /** Set to edit an already-given award in place instead of giving a new one. */
  editing?: RepPlayerAward | null;
  onClose: () => void;
  // Fired after EITHER a successful save or an inline type-creation — both change what the
  // parent's own awardTypes/awards state should show, so both need to trigger its refetch
  // (a type created here but never followed by a save must not go stale in the parent).
  onChanged: () => void;
}) {
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/awards`;
  // Parent conditionally mounts this component only while open — one unit for the whole mount.
  useOverlayOpen(true);

  // The active library, PLUS the award's own current type even if it has since been retired —
  // an edit must never refuse to show the award's own type just because it fell out of the
  // picker for NEW awards (same "keep what it already has" rule the route enforces).
  const [localTypes, setLocalTypes] = useState(() => {
    const active = awardTypes.filter(t => t.isActive);
    if (editing && !active.some(t => t.id === editing.awardTypeId)) {
      const current = awardTypes.find(t => t.id === editing.awardTypeId) ?? editing.awardType;
      if (current) return [...active, current];
    }
    return active;
  });
  const [playerId, setPlayerId] = useState(editing?.playerId ?? '');
  const [typeId, setTypeId] = useState(editing?.awardTypeId ?? '');
  const [tournamentLabel, setTournamentLabel] = useState(editing?.tournamentLabel ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [creatingType, setCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeEmoji, setNewTypeEmoji] = useState<string | null>('🏅');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  // Re-reads the library after a rename/merge/retire/delete in the drawer — the form's own chip
  // row (localTypes) is a one-time snapshot from mount, not derived from the awardTypes prop each
  // render, so it would otherwise go stale the instant the drawer changes anything while open.
  async function refetchTypes() {
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/award-types`);
      if (!res.ok) return;
      const d = await res.json().catch(() => null);
      if (!d || !Array.isArray(d.tags)) return;
      const library = d.tags as RepTeamAwardType[];
      const active = library.filter(t => t.isActive);
      if (typeId && !active.some(t => t.id === typeId)) {
        const current = library.find(t => t.id === typeId);
        if (current) { setLocalTypes([...active, current]); return; }
      }
      setLocalTypes(active);
    } catch { /* the form keeps whatever chips it already has */ }
  }

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
      const res = editing
        ? await fetch(`${base}/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId,
              awardTypeId: typeId,
              ...(eventContext ? {} : { tournamentLabel: tournamentLabel.trim() || null }),
              note: note.trim() || null,
            }),
          })
        : await fetch(base, {
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
    <>
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (onClose)?.(); }}>
      <div className={`${styles.modal} ${styles.sheetOnMobile}`} onClick={e => e.stopPropagation()}>
        <CoachModalHeader title={editing ? 'Edit award' : 'Give an award'} onClose={onClose} />

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
            <button type="button" className={styles.tagManageLink} onClick={() => setManageOpen(true)}>
              {AWARD_TAG_MANAGE.door}
            </button>
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
          <button className={styles.btnPrimary} disabled={saving} onClick={handleSave}>{editing ? 'Save changes' : 'Save'}</button>
        </div>
      </div>
    </div>
    {manageOpen && (
      <TagManagerDrawer
        teamId={teamId}
        tags={awardTypes as ComboTag[]}
        title={AWARD_TAG_MANAGE.title}
        itemNoun={AWARD_TAG_MANAGE.itemNoun}
        countNoun={AWARD_TAG_MANAGE.countNoun}
        basePath={`/api/coaches/${orgSlug}/teams/${teamId}/award-types`}
        policy={{ icon: true, inUseRemove: 'merge-or-retire' }}
        onClose={() => setManageOpen(false)}
        onChanged={() => { void refetchTypes(); onChanged(); }}
      />
    )}
    </>
  );
}
