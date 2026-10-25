'use client';
/**
 * UNDO: MARKED RECEIVED BY MISTAKE (Club Tier Stage 9b-2, Part 3; copy §8). A question, not a form: it names the payment it
 * takes back (its amount and day) and sends that line's id, so a registration with more than one payment can never lose
 * the wrong one. It is a mistake fix, not a refund — it voids a payment that never arrived, and the line stays in the
 * season's history marked as voided. Refused once that payment's fiscal year is closed (the server's own words).
 */
import { useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { FormError } from '../../money/MoneyKit';
import { UNDO_WORDS } from '@/lib/house-league-money-words';
import { formatLeagueMoney, type LeagueMoneyLine } from '@/lib/league-money';
import { regDay } from '@/lib/house-league-registrations';
import { patchRegistration } from './api';

export default function UndoWindow({
  regId, name, payment, today, orgQuery, seasonId, onClose, onChanged, onDone,
}: {
  regId: string;
  name: string;
  /** The payment line this takes back. */
  payment: LeagueMoneyLine;
  today: string;
  orgQuery: string;
  seasonId: string;
  onClose: () => void;
  onChanged: () => void;
  onDone: (said: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    const r = await patchRegistration(orgQuery, seasonId, regId, { money: { kind: 'undo', entryId: payment.id } });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      if (r.status === 409) onChanged();
      return;
    }
    onDone(UNDO_WORDS.done(name));
  }

  return (
    <KitDialog
      kind="question"
      title={UNDO_WORDS.title(name)}
      onClose={onClose}
      busy={busy}
      footerStart={<span>{UNDO_WORDS.foot}</span>}
      footer={(
        <>
          <DialogCancel>{UNDO_WORDS.cancel}</DialogCancel>
          <button type="button" className="btn btn-outline" onClick={() => void go()} disabled={busy}>
            {busy ? UNDO_WORDS.working : UNDO_WORDS.submit}
          </button>
        </>
      )}
    >
      <p className={ck.hint}>{UNDO_WORDS.body(name, formatLeagueMoney(payment.amount), regDay(payment.day, today))}</p>
      <p className={ck.hint}>{UNDO_WORDS.not}</p>
      <FormError>{error}</FormError>
    </KitDialog>
  );
}
