'use client';
/**
 * The one window every action on a customer record opens (Support console Stage 2; drawings "The pencil, the confirm
 * window, and Put it back"): the kit window (`KitDialog`), the change said in ONE sentence (R3), a required Why (R4), the
 * foot's sentence at the LEFT and its buttons at the right (2026-10-12), one main action — lime, or red for what cannot be
 * undone from the screen (the console's confirm rule, 2026-06-26). Save changes, Put it back, Cancel the subscription,
 * Delete, Make owner, Release, the person's actions: all of them are this.
 */
import { useState, type ReactNode } from 'react';
import KitDialog, { DialogCancel } from '@/components/admin/kit/club/KitDialog';
import kit from './console.module.css';
import styles from './record.module.css';

/**
 * The window turned into its answer (Plans & pricing Stage 2 Part 5, the replay's result and its refusals; drawings tabs 2–3):
 * the same window stays open with the answer's title, its body, at most ONE lime main action and Close when `closeLabel` is
 * given (a refusal is Close alone). No Why, no error line, nothing left to discard. Every other window passes none and is unchanged.
 */
export type RecordWindowAnswer = {
  title: string;
  body: ReactNode;
  footNote?: ReactNode;
  main?: { label: string; onClick: () => void };
  closeLabel?: string;
};

export default function RecordWindow({
  title, sentence, sentenceAfter = false, children, footNote, cancelLabel = 'Cancel', confirmLabel, danger = false, askWhy = true,
  whyPlaceholder, whyMax = 1000, confirmBlocked = false, confirmHidden = false, onConfirm, onClose, answer,
}: {
  title: string;
  sentence: ReactNode;
  /** The sentence after the fields and the Why, for a window whose sentence is built FROM its fields (Give free time):
   *  it is read last, as the confirm, and it changes as they do. */
  sentenceAfter?: boolean;
  children?: ReactNode;
  footNote?: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  danger?: boolean;
  /** Every live change asks why; a note is its own why. */
  askWhy?: boolean;
  whyPlaceholder?: string;
  /** The longest Why the server takes. */
  whyMax?: number;
  /** Something else the window needs first (a typed web name). */
  confirmBlocked?: boolean;
  /** No main action yet (absent beats disabled): a window that refuses its first choice and offers the others. */
  confirmHidden?: boolean;
  /** Resolves to an error sentence to show, or null when done (the caller closes the window). */
  onConfirm: (reason: string) => Promise<string | null>;
  onClose: () => void;
  /** The answer, once there is one: the window stays open and shows it in place of the question. */
  answer?: RecordWindowAnswer | null;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = (!askWhy || reason.trim().length > 0) && !confirmBlocked;

  if (answer) {
    return (
      <KitDialog
        kind="form"
        title={answer.title}
        levelKey="answer" // the question's inputs are gone: re-seat the keyboard in the window rather than on the page behind
        onClose={onClose}
        footerStart={answer.footNote ? <span className={styles.footNote}>{answer.footNote}</span> : undefined}
        footer={(
          <>
            {answer.closeLabel && <DialogCancel className="btn btn-secondary">{answer.closeLabel}</DialogCancel>}
            {answer.main && <button type="button" className="btn btn-primary" onClick={answer.main.onClick}>{answer.main.label}</button>}
          </>
        )}
      >
        <div className={styles.windowBody}>{answer.body}</div>
      </KitDialog>
    );
  }

  async function confirm() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const failed = await onConfirm(reason.trim()).catch(() => 'That did not go through. Try again in a moment.');
    setBusy(false);
    if (failed) setError(failed);
  }

  return (
    <KitDialog
      kind="form"
      title={title}
      onClose={onClose}
      busy={busy}
      dirty={reason.trim().length > 0}
      footerStart={footNote ? <span className={styles.footNote}>{footNote}</span> : undefined}
      footer={(
        <>
          <DialogCancel className="btn btn-secondary">{cancelLabel}</DialogCancel>
          {!confirmHidden && <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => void confirm()}
            disabled={!ready || busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>}
        </>
      )}
    >
      <div className={styles.windowBody}>
        {!sentenceAfter && <div className={styles.sentence}>{sentence}</div>}
        {children}
        {askWhy && (
          <label className={kit.fieldGroup}>
            <span className={kit.label}>Why<span className={kit.req} aria-hidden>*</span></span>
            <textarea
              className={kit.textarea}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={whyPlaceholder ?? 'Why are you making this change?'}
              maxLength={whyMax}
              required
              aria-required
            />
          </label>
        )}
        {sentenceAfter && <div className={styles.sentence}>{sentence}</div>}
        {error && <p className={kit.fieldError} role="alert">{error}</p>}
      </div>
    </KitDialog>
  );
}
