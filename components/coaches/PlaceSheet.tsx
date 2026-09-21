'use client';
import { useState } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import QuestionShell from './QuestionShell';
import { useDiscardGuard } from './useDiscardGuard';
import { PLACE_NAME_MAX, PLACE_ADDRESS_MAX, PLACE_FIELD_MAX, PLACE_NOTE_MAX } from '@/lib/coach-places';
import type { RepTeamPlace } from '@/lib/types';

/**
 * ADD / EDIT A PLACE (Arrival & Places D7, 2026-09-21) — the small sheet: four things, three optional.
 * Only the name is required, so adding a place is never slower than typing a location was.
 *
 * On EDIT, when the name or the address changes and the place has upcoming events, the sheet asks
 * the offer (D6): "Also update the N upcoming events at this place" — a box, unticked, because the
 * events' text is their own record and the coach decides whether this edit reaches it. The diamond
 * is never pushed (per-game). Past events are never touched.
 */
export default function PlaceSheet({
  basePath,
  editing,
  initialName = '',
  upcomingCount = 0,
  onClose,
  onSaved,
}: {
  /** `/api/coaches/{org}/teams/{team}/places` */
  basePath: string;
  /** The place to edit; absent = add. */
  editing?: RepTeamPlace | null;
  /** What the coach had typed into the Location field — the add sheet opens with it as the name. */
  initialName?: string;
  /** How many of the team's upcoming events are at this place (edit only) — drives the offer. */
  upcomingCount?: number;
  onClose: () => void;
  /** The saved place, and how many upcoming events took the change (0 unless offered and ticked). */
  onSaved: (place: RepTeamPlace, movedEvents: number) => void;
}) {
  const [name, setName] = useState(editing?.name ?? initialName);
  const [address, setAddress] = useState(editing?.address ?? '');
  const [fieldNumber, setFieldNumber] = useState(editing?.fieldNumber ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [updateUpcoming, setUpdateUpcoming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dirty = editing
    ? name !== editing.name || address !== (editing.address ?? '') || fieldNumber !== (editing.fieldNumber ?? '') || note !== (editing.note ?? '')
    : Boolean(name.trim() && name.trim() !== initialName.trim()) || Boolean(address.trim() || fieldNumber.trim() || note.trim());
  const close = useDiscardGuard({ dirty, close: onClose, noun: 'place', detail: name.trim() ? 'a name for this place' : undefined });
  const title = editing ? 'Edit the place' : 'Add a place';
  const identityChanged = !!editing && (name.trim() !== editing.name || (address.trim() || null) !== editing.address);
  const offer = !!editing && upcomingCount > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) { setError('Give the place a name.'); return; }
    setError('');
    setBusy(true);
    try {
      const res = await fetch(editing ? `${basePath}/${editing.id}` : basePath, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: n, address: address.trim() || null, fieldNumber: fieldNumber.trim() || null, note: note.trim() || null,
          ...(editing && offer && updateUpcoming ? { updateUpcoming: true } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? 'Could not save the place.'); return; }
      onSaved(json.place as RepTeamPlace, typeof json.movedEvents === 'number' ? json.movedEvents : 0);
    } catch {
      setError('Could not save the place.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <QuestionShell open onClose={() => { void close(); }} ariaLabel={title} title={title} subtitle={editing?.name} busy={busy}>
      <form className={`${styles.formBody} ${styles.formBodyTight}`} onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="place-name">Name *</label>
          <input id="place-name" className={styles.input} value={name} maxLength={PLACE_NAME_MAX} autoFocus
            placeholder="e.g. Sherwood Park" onChange={e => setName(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="place-address">Address</label>
          <input id="place-address" className={styles.input} value={address} maxLength={PLACE_ADDRESS_MAX}
            placeholder="Street address — powers the “open in Maps” link" onChange={e => setAddress(e.target.value)} />
        </div>
        <div className={styles.formSectionGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="place-field">Field / Diamond</label>
            <input id="place-field" className={styles.input} value={fieldNumber} maxLength={PLACE_FIELD_MAX}
              placeholder="e.g. Diamond 2" onChange={e => setFieldNumber(e.target.value)} />
            <p className={styles.formHint}>The usual one — any game can change it.</p>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="place-note">Note</label>
            <input id="place-note" className={styles.input} value={note} maxLength={PLACE_NOTE_MAX}
              placeholder="e.g. park behind the arena" onChange={e => setNote(e.target.value)} />
            <p className={styles.formHint}>Shows on every event here.</p>
          </div>
        </div>
        {offer && (
          <label className={styles.formCheck}>
            <input type="checkbox" checked={updateUpcoming} disabled={!identityChanged} onChange={e => setUpdateUpcoming(e.target.checked)} />
            <span>Also update the {upcomingCount} upcoming {upcomingCount === 1 ? 'event' : 'events'} at this place</span>
          </label>
        )}
        {offer && (
          <p className={styles.formHint}>Their name and address follow this edit; past events keep what they had, and each game keeps its own diamond.</p>
        )}
        {error && <p className={styles.errorText} role="alert">{error}</p>}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => void close()}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add place'}
          </button>
        </div>
      </form>
    </QuestionShell>
  );
}
