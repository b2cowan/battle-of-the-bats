'use client';
import { useId, useRef, useState } from 'react';
import styles from '../family.module.css';

/**
 * A button that asks ONCE before it acts (Leave, Stop this calendar): a small centred window over a dimmed page (the native
 * dialog: Escape and the scrim's Cancel are "no"). The action runs only on the window's own button.
 */
export default function ConfirmButton({ label, title, body, confirmLabel, cancelLabel, busyLabel, failedText, onConfirm, buttonClassName }: {
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busyLabel: string;
  failedText: string;
  /** Resolves true when done (the caller then navigates or redraws), false to show `failedText`. */
  onConfirm: () => Promise<boolean>;
  buttonClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const titleId = useId();

  async function go() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onConfirm().catch(() => false);
    setBusy(false);
    if (ok) ref.current?.close();
    else setFailed(true);
  }

  return (
    <>
      <button type="button" className={buttonClassName ?? styles.chipGhost} onClick={() => { setFailed(false); ref.current?.showModal(); }}>
        {label}
      </button>
      <dialog ref={ref} className={styles.confirm} aria-labelledby={titleId} onCancel={e => { if (busy) e.preventDefault(); }}>
        <h2 id={titleId}>{title}</h2>
        <p>{body}</p>
        {failed && <p className={styles.error} role="alert">{failedText}</p>}
        <div className={styles.buttonRowEnd}>
          <button type="button" className={styles.chipGhost} onClick={() => ref.current?.close()} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={styles.chip} onClick={go} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
        </div>
      </dialog>
    </>
  );
}
