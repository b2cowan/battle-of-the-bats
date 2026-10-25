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

export default function RecordWindow({
  title, sentence, children, footNote, cancelLabel = 'Cancel', confirmLabel, danger = false, askWhy = true,
  whyPlaceholder, confirmBlocked = false, onConfirm, onClose,
}: {
  title: string;
  sentence: ReactNode;
  children?: ReactNode;
  footNote?: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  danger?: boolean;
  /** Every live change asks why; a note is its own why. */
  askWhy?: boolean;
  whyPlaceholder?: string;
  /** Something else the window needs first (a typed web name). */
  confirmBlocked?: boolean;
  /** Resolves to an error sentence to show, or null when done (the caller closes the window). */
  onConfirm: (reason: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = (!askWhy || reason.trim().length > 0) && !confirmBlocked;

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
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => void confirm()}
            disabled={!ready || busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      )}
    >
      <div className={styles.windowBody}>
        <div className={styles.sentence}>{sentence}</div>
        {children}
        {askWhy && (
          <label className={kit.fieldGroup}>
            <span className={kit.label}>Why<span className={kit.req} aria-hidden>*</span></span>
            <textarea
              className={kit.textarea}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={whyPlaceholder ?? 'Why are you making this change?'}
              maxLength={1000}
              required
              aria-required
            />
          </label>
        )}
        {error && <p className={kit.fieldError} role="alert">{error}</p>}
      </div>
    </KitDialog>
  );
}
