'use client';
/**
 * CAN'T HONOUR (Board Ready Stage 1 Part 2; drawing tab 4). The reason is Different division (filled in when the match
 * is in another division) or Other with a short note, which later reads "Can't honour · {note}". A decline takes an
 * outlined button, so this window has no lime (A13's drawn-in proposal). The family is not told.
 */
import { useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { FormError } from '../../money/MoneyKit';
import { FRIEND_QUEUE_WORDS, type CantHonourReason } from '@/lib/league-friend-queue';

const W = FRIEND_QUEUE_WORDS.cant;
const NOTE_MAX = 280;

export default function CantHonourWindow({ first, asker, asked, otherDivision, onClose, onSave }: {
  /** The asking child's first name, for the title. */
  first: string;
  asker: string;
  /** What the family asked for, as the sub-line says it. */
  asked: string;
  /** The match is in another division: the reason starts there. */
  otherDivision: boolean;
  onClose: () => void;
  onSave: (reason: CantHonourReason, note: string | null) => Promise<string | null>;
}) {
  const [reason, setReason] = useState<CantHonourReason>(otherDivision ? 'different_division' : 'other');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (busy) return;
    const n = note.replace(/\s+/g, ' ').trim();
    if (reason === 'other' && !n) { setError(W.noteNeeded); return; }
    setBusy(true); setError('');
    const refused = await onSave(reason, reason === 'other' ? n : null);
    setBusy(false);
    if (refused) setError(refused);
  }

  return (
    <KitDialog
      kind="question"
      title={W.title(first)}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <DialogCancel>{W.cancel}</DialogCancel>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void save()}>{busy ? W.working : W.go}</button>
        </>
      )}
    >
      <p className={ck.hint}>{W.sub(asker, asked)}</p>
      <FormError>{error}</FormError>
      <label className={ck.field} htmlFor="friend-cant-why">
        <span className={ck.label}>{W.why}</span>
        <select id="friend-cant-why" className={ck.select} value={reason} onChange={e => { setReason(e.target.value as CantHonourReason); setError(''); }}>
          <option value="different_division">{W.reasons.different_division}</option>
          <option value="other">{W.reasons.other}</option>
        </select>
      </label>
      {reason === 'other' && (
        <label className={ck.field} htmlFor="friend-cant-note">
          <span className={ck.label}>{W.note}</span>
          <input id="friend-cant-note" className={ck.input} value={note} maxLength={NOTE_MAX} placeholder={W.notePlaceholder}
            onChange={e => { setNote(e.target.value); setError(''); }} />
        </label>
      )}
      <p className={ck.hint}>{W.hint}</p>
    </KitDialog>
  );
}
