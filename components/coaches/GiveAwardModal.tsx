'use client';
import { useState } from 'react';
import { useAwardTypePicker } from '@/components/coaches/AwardTypePicker';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import type { RepTeamAwardType, RepPlayerAward } from '@/lib/types';
import { awardNotePlaceholder } from '@/lib/rep-award-occasion';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';

/**
 * "Give an award" moment (Coach Tags & Player Awards Phase 2) — opened either from a specific
 * event (eventContext set, no event-picker needed since the coach is already looking at it) or
 * generally from the awards report page (eventContext null — a free-text tournament/occasion,
 * or left blank for a general season recognition). Save closes it (owner, 2026-07-12); a second
 * award for the same event is a re-tap of "Give an award".
 *
 * ⚠ ANY EVENT (owner, 2026-09-25) — a practice, a team event or a whole tournament as well as a
 * game. The caller builds `eventContext.label` with `awardOccasionLabel` (never "vs …" by hand)
 * and passes the event's type, which only picks the note's example text here.
 *
 * ⚠ EDIT MODE (`editing` set — Awards One Tag Idiom Part A, 2026-09-11): the same form fixes a
 * mis-given award instead of creating a new one. Pre-filled from `editing`, titled "Edit award",
 * PATCHes `editing.id` rather than POSTing. Which EVENT the award is for is NOT editable — a wrong
 * event is remove-and-re-give, same as a tag on the wrong event — so the caller must pass an
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
  eventContext: { id: string; label: string; eventType?: string | null } | null;
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

  const [playerId, setPlayerId] = useState(editing?.playerId ?? '');
  const [typeId, setTypeId] = useState(editing?.awardTypeId ?? '');
  const [tournamentLabel, setTournamentLabel] = useState(editing?.tournamentLabel ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // The chips, "+ New" and the library's door — shared with the award's own sheet on a phone
  // (`AwardTypePicker`). `overlays` renders OUTSIDE this window, as the drawer always has.
  const picker = useAwardTypePicker({
    orgSlug, teamId, awardTypes,
    value: typeId,
    onChange: setTypeId,
    keepType: editing?.awardType ?? null,
    onLibraryChanged: onChanged,
  });

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
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <CoachModalHeader title={editing ? 'Edit award' : 'Give an award'} onClose={onClose} />

        <div className={styles.formBody}>
          {eventContext ? (
            <p className={styles.formHint}>For: <strong>{eventContext.label}</strong></p>
          ) : (
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Tournament or occasion</h4>
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
            {picker.chips}
          </div>

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Note</h4>
            <textarea
              className={styles.textarea}
              value={note}
              maxLength={200}
              placeholder={awardNotePlaceholder(!!eventContext, eventContext?.eventType)}
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
    {picker.overlays}
    </>
  );
}
