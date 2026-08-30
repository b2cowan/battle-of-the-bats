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
 * ⚖ Two states and nothing between them (the foreseeable-refusal ruling, §118, applied to
 * deleting rather than saving):
 *   · nothing on the books → a live button, then a confirm that RESTATES what goes
 *   · money on the books   → the button is DEAD, with the reason on its own line above the row
 *
 * ⚠ THE REASON GETS ITS OWN LINE, and that is not a hedge against the one-row ruling. It is a
 * SENTENCE about the record — "$200.00 on the team's books across 1 arrival, undo it from the row
 * first" — and it does not fit beside Cancel and Save at any width. Squeezing it into a `title`
 * would make the reason something a coach has to go and find, which is the thing the dead-button
 * grammar exists to prevent. So: dead button in the row, reason on the line above it.
 *
 * ⚠ THE ROW STANDS DOWN WHILE THE DELETE QUESTION IS OPEN — the confirm takes the whole footer,
 * exactly as the bill page's save strip does. A coach being asked about dollars should not be
 * reading a Save button at the same time.
 *
 * ⚠ THE BILL PAGE STILL HAS ITS OWN HAND-ROLLED COPY of this grammar (CommitmentView's delete
 * strip), and it is deliberately NOT folded in here. Its delete is always live, it reverses money
 * rather than refusing, and its confirm button changes label with the amount — absorbing it needs
 * an "always allowed" mode and a label prop, which is a change to a shipped, walked screen and
 * belongs in its own unit of work. **Named here so the second owner is not a surprise:** a tweak
 * to this grammar has to be made in both places until that happens.
 */
import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

export default function RecordEditorFooter({
  refusal,
  confirmTitle,
  confirmBody,
  deleting = false,
  onDelete,
  children,
}: {
  /** When set, delete is dead and this reads on its own line above the row: the fact AND the way out. */
  refusal: ReactNode | null;
  confirmTitle: string;
  /** What the delete actually does, in the coach's own figures. Never a bare "Are you sure?". */
  confirmBody: ReactNode;
  deleting?: boolean;
  onDelete: () => void;
  /** The sheet's own actions — Cancel and Save. They sit right; delete sits left. */
  children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const refused = refusal != null;

  if (confirming && !refused) {
    return (
      <div className={styles.modalFooter}>
        <div className={styles.dangerConfirm} role="alertdialog" aria-label={confirmTitle}>
          <p className={styles.dangerConfirmTitle}>{confirmTitle}</p>
          <p className={styles.dangerConfirmBody}>{confirmBody}</p>
          <div className={styles.dangerConfirmActions}>
            <button type="button" className={styles.btnGhost} disabled={deleting} onClick={() => setConfirming(false)}>
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
    <>
      {refused && <p className={styles.deleteReason}>{refusal}</p>}
      <div className={styles.modalFooter}>
        {/* ⚠ `type="button"` is load-bearing — this sits inside a <form>, where a bare button
            submits it. A delete control that saves the record instead is worse than one that
            does nothing. */}
        {/* ⚠ NO `title` FALLBACK. An earlier cut carried one "in case the reason is a string" —
            but `refusal` is a ReactNode every caller builds as JSX, so the branch could never
            fire, and a tooltip would be the wrong answer anyway: the reason renders as visible
            text directly above this row. A dead branch that implies a tooltip sometimes appears
            costs the next reader more than it ever saved. */}
        <button
          type="button"
          className={styles.deleteRecordBtn}
          onClick={() => setConfirming(true)}
          disabled={refused || deleting}
        >
          <Trash2 size={13} aria-hidden /> Delete
        </button>
        {children}
      </div>
    </>
  );
}
