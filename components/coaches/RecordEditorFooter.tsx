'use client';
/**
 * THE FOOTER A RECORD'S EDITOR CLOSES WITH — delete on the left, the sheet's own actions on the
 * right, on ONE line.
 *
 * ⚖ IT IS ONE ROW, NOT TWO (owner, 2026-08-30). The delete began life on a rule of its own below
 * the footer and did not earn one: a modal that already scrolls spent a whole row on a control
 * used once in a record's life. Same call the owner made on the bill page at the §114 walk —
 * "delete sits left, the closing affordance right, on the one line that closes the record".
 *
 * ⚖⚖ AND THE REASON WAITS TO BE ASKED (owner, §122 walk 2026-08-30, mockup option A —
 * `claude.ai/code/artifact/7e787b34-9d0f-4512-9601-99fe16ae9bfe`). The refusal used to sit
 * PERMANENTLY above the footer whenever money was on the books, which for any sponsor that has
 * ever been paid is always. The owner's read: *"users have to constantly see why they can't delete
 * something even if they didn't have any intention of deleting it"* — two lines of rent, taken
 * from a form that already scrolls, to answer a question most coaches never ask.
 *
 * So the row answers for itself. Press Delete and it becomes ONE of two things, in the same place
 * and by the same mechanism:
 *   · nothing in the way → the confirm question
 *   · money on the books → the reason, and the way out
 * Cancel and Save stand down while either is open, exactly as the bill page's save strip does.
 *
 * ⚠⚠ THIS COSTS THE DEAD-BUTTON GRAMMAR, DELIBERATELY AND WITH THE OWNER'S EYES OPEN. Delete is
 * no longer disabled — it has to be pressable to answer. That bends the §118 foreseeable-refusal
 * ruling ("show it, don't make them discover it"), and the argument for the bend is that ONE PRESS
 * IS NOT LOST WORK: that ruling exists to stop a coach filling in a form and being bounced, which
 * this does not do. **Do not re-disable this button to "restore" §118** — you would be reinstating
 * the permanent sentence the owner removed, or leaving a dead control with no reason at all.
 *
 * ⚠ A TOOLTIP IS NOT THE ANSWER EITHER (option C, rejected at the same walk): there is no hover on
 * a phone, so on the devices coaches actually use it degrades to a dead button explaining nothing.
 *
 * ⚠ THE SERVER REFUSES REGARDLESS. Everything here is courtesy; the binding refusal is the route's.
 */
import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

type Mode = 'rest' | 'reason' | 'confirm';

export default function RecordEditorFooter({
  refusal,
  confirmTitle,
  confirmBody,
  deleting = false,
  onDelete,
  children,
}: {
  /** When set, Delete explains itself instead of asking: the fact AND the way out. */
  refusal: ReactNode | null;
  confirmTitle: string;
  /** What the delete actually does, in the coach's own figures. Never a bare "Are you sure?". */
  confirmBody: ReactNode;
  deleting?: boolean;
  onDelete: () => void;
  /** The sheet's own actions — Cancel and Save. They sit right; delete sits left. */
  children: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>('rest');
  const refused = refusal != null;

  /* The record can change under an open panel (an arrival undone in another tab, a refetch after a
     save), so the mode is reconciled against the CURRENT refusal rather than trusted. Asking the
     confirm question about a record that just became undeletable is the failure worth preventing. */
  const showing: Mode =
    mode === 'confirm' && refused ? 'reason'
    : mode === 'reason' && !refused ? 'rest'
    : mode;

  if (showing === 'reason') {
    return (
      <div className={styles.modalFooter}>
        <div className={styles.dangerConfirm} role="alertdialog" aria-label="This cannot be deleted yet">
          <p className={styles.dangerConfirmTitle}>This can’t be deleted yet</p>
          <p className={styles.dangerConfirmBody}>{refusal}</p>
          <div className={styles.dangerConfirmActions}>
            <button type="button" className={styles.btnGhost} onClick={() => setMode('rest')}>
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showing === 'confirm') {
    return (
      <div className={styles.modalFooter}>
        <div className={styles.dangerConfirm} role="alertdialog" aria-label={confirmTitle}>
          <p className={styles.dangerConfirmTitle}>{confirmTitle}</p>
          <p className={styles.dangerConfirmBody}>{confirmBody}</p>
          <div className={styles.dangerConfirmActions}>
            <button type="button" className={styles.btnGhost} disabled={deleting} onClick={() => setMode('rest')}>
              Keep it
            </button>
            <button type="button" className={styles.btnDanger} disabled={deleting} onClick={onDelete}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalFooter}>
      {/* ⚠ `type="button"` is load-bearing — this sits inside a <form>, where a bare button submits
          it. A delete control that saves the record instead is worse than one that does nothing. */}
      <button
        type="button"
        className={styles.deleteRecordBtn}
        onClick={() => setMode(refused ? 'reason' : 'confirm')}
        disabled={deleting}
      >
        <Trash2 size={13} aria-hidden /> Delete
      </button>
      {children}
    </div>
  );
}
