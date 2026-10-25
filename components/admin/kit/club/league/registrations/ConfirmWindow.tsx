'use client';
/**
 * A BULK PRESS THAT TELLS FAMILIES IS HELD UNTIL THE CONFIRM (Club Tier Stage 9b-2, Part 3; copy §2.1): "Approve 5
 * registrations?" says who is emailed and what, and its button names the act and the count. A question, not a form.
 * The screen runs the loop and closes this window when it has said the result.
 */
import { useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { BULK_WORDS } from '@/lib/house-league-money-words';

export default function ConfirmWindow({ title, body, go, onClose, onConfirm }: {
  title: string;
  body: string;
  /** The primary button: "Approve 5". */
  go: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <KitDialog
      kind="question"
      title={title}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <DialogCancel>{BULK_WORDS.confirm.cancel}</DialogCancel>
          <button type="button" className="btn btn-lime" disabled={busy} onClick={() => { setBusy(true); void onConfirm(); }}>
            {busy ? BULK_WORDS.confirm.working : go}
          </button>
        </>
      )}
    >
      <p className={ck.hint}>{body}</p>
    </KitDialog>
  );
}
