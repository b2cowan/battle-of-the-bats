'use client';
/**
 * THE GUARDED DELETE — one control, two answers, and the reason waits to be asked.
 *
 * ⚖⚖ THE REASON WAITS TO BE ASKED (owner, §122 walk 2026-08-30, mockup option A —
 * `claude.ai/code/artifact/7e787b34-9d0f-4512-9601-99fe16ae9bfe`). The refusal used to sit
 * PERMANENTLY beside the control whenever money was on the books, which for any sponsor that has
 * ever been paid is always. The owner's read: *"users have to constantly see why they can't delete
 * something even if they didn't have any intention of deleting it"* — two lines of rent to answer
 * a question most coaches never ask.
 *
 * So the control answers for itself. Press Delete and it becomes ONE of two things, in the same
 * place and by the same mechanism:
 *   · nothing in the way → the confirm question, naming what goes
 *   · money on the books → the reason, and the way out
 *
 * ⚠⚠ THIS COSTS THE DEAD-BUTTON GRAMMAR, DELIBERATELY AND WITH THE OWNER'S EYES OPEN. Delete is
 * not disabled — it has to be pressable to answer. That bends the §118 foreseeable-refusal
 * ruling ("show it, don't make them discover it"), and the argument for the bend is that ONE PRESS
 * IS NOT LOST WORK: that ruling exists to stop a coach filling in a form and being bounced, which
 * this does not do. **Do not re-disable this button to "restore" §118** — you would be reinstating
 * the permanent sentence the owner removed, or leaving a dead control with no reason at all.
 *
 * ⚠ A TOOLTIP IS NOT THE ANSWER EITHER (option C, rejected at the same walk): there is no hover on
 * a phone, so on the devices coaches actually use it degrades to a dead button explaining nothing.
 *
 * WHERE IT LIVES (List · Room · Question Phase B, 2026-09-02): the foot of a record's ROOM — the
 * once-in-a-record door beside the named Prev/Next — which is why it stands alone rather than
 * inside a form's closing row. It began life as `RecordEditorFooter`'s left half when Delete sat in
 * the Edit sheet; the sheet lost the door when the room gained it (a record has one delete, not
 * two), and the mechanism moved here whole. The panel takes the foot's full width while it is open
 * (`RoomShell.module.css` sizes an `alertdialog` in the doors slot).
 *
 * ⚠ THE SERVER REFUSES REGARDLESS. Everything here is courtesy; the binding refusal is the route's.
 */
import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

type Mode = 'rest' | 'reason' | 'confirm';

export default function GuardedDelete({
  label,
  refusal,
  confirmTitle,
  confirmBody,
  confirmLabel = 'Delete',
  deleting = false,
  onDelete,
}: {
  /** The door's own words — "Delete this fundraiser". */
  label: string;
  /** When set, Delete explains itself instead of asking: the fact AND the way out. */
  refusal: ReactNode | null;
  confirmTitle: string;
  /** What the delete actually does, in the coach's own figures. Never a bare "Are you sure?". */
  confirmBody: ReactNode;
  /**
   * The confirming button's own words, when "Delete" is not the whole truth — a bill money has
   * landed on reads **"Delete and reverse"**, because pressing it moves cash as well as removing a
   * record (`/review`, 2026-09-04: the label was lost when the bill's foot adopted this control).
   * ⚠ The DOOR's label is `label`; this is the ANSWER's. Default "Delete".
   */
  confirmLabel?: string;
  deleting?: boolean;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<Mode>('rest');
  const refused = refusal != null;

  /* The record can change under an open panel (a cheque undone, a refetch after a save), so the
     mode is reconciled against the CURRENT refusal rather than trusted. Asking the confirm question
     about a record that just became undeletable is the failure worth preventing. */
  const showing: Mode =
    mode === 'confirm' && refused ? 'reason'
    : mode === 'reason' && !refused ? 'rest'
    : mode;

  if (showing === 'reason') {
    return (
      <div className={styles.dangerConfirm} role="alertdialog" aria-label="This cannot be deleted yet">
        <p className={styles.dangerConfirmTitle}>This can’t be deleted yet</p>
        <p className={styles.dangerConfirmBody}>{refusal}</p>
        <div className={styles.dangerConfirmActions}>
          <button type="button" className={styles.btnGhost} onClick={() => setMode('rest')}>
            Got it
          </button>
        </div>
      </div>
    );
  }

  if (showing === 'confirm') {
    return (
      <div className={styles.dangerConfirm} role="alertdialog" aria-label={confirmTitle}>
        <p className={styles.dangerConfirmTitle}>{confirmTitle}</p>
        {/* ⚠ A DIV, NOT A `<p>` (`/review`, 2026-09-04). A consumer whose consequence has TWO
            clauses — money coming back AND a family's credit going — needs two paragraphs, and a
            `<p>` inside a `<p>` is invalid markup the browser silently unnests, running the two
            sentences together. Same class, same look; the block simply may hold blocks. */}
        <div className={styles.dangerConfirmBody}>{confirmBody}</div>
        <div className={styles.dangerConfirmActions}>
          <button type="button" className={styles.btnGhost} disabled={deleting} onClick={() => setMode('rest')}>
            Keep it
          </button>
          <button type="button" className={styles.btnDanger} disabled={deleting} onClick={onDelete}>
            {deleting ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.deleteRecordBtn}
      onClick={() => setMode(refused ? 'reason' : 'confirm')}
      disabled={deleting}
    >
      <Trash2 size={13} aria-hidden /> {label}
    </button>
  );
}
