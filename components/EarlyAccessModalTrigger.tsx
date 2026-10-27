'use client';

import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import EarlyAccessForm, { type EarlyAccessSaved } from './EarlyAccessForm';
import styles from './EarlyAccessModalTrigger.module.css';

type EarlyAccessModalTriggerProps = {
  children?: ReactNode;
  className?: string;
  initialPlanInterest?: string[];
  initialFeaturesInterested?: string[];
  /** Fired when the trigger is clicked (before the modal opens). Used for instrumentation; must not
   *  throw. Does not affect the open behaviour. */
  onClick?: () => void;
};

export default function EarlyAccessModalTrigger({
  children = 'Join early access',
  className,
  initialPlanInterest,
  initialFeaturesInterested,
  onClick,
}: EarlyAccessModalTriggerProps) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<EarlyAccessSaved | null>(null);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  function close() {
    setOpen(false);
    setSaved(null);
  }

  // The form is gone once the request is saved; put focus on the new heading so a keyboard or screen-reader
  // user lands on the confirmation instead of on nothing.
  useEffect(() => {
    if (saved) titleRef.current?.focus();
  }, [saved]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button type="button" className={className} onClick={() => { onClick?.(); setOpen(true); }}>
        {children}
      </button>

      {open && (
        <div className={styles.overlay} role="presentation" onMouseDown={close}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={event => event.stopPropagation()}
          >
            <div className={styles.header}>
              <div>
                <p className={styles.kicker}>Early access</p>
                <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
                  {saved ? 'You’re on the list' : 'Tell us what you want to see next'}
                </h2>
                <p className={styles.copy} aria-live="polite">
                  {!saved && 'Share a few details and we’ll use them for release updates and early access planning.'}
                  {saved?.wantsUpdates && <>We&apos;ve saved your request and we&apos;ll write to <strong>{saved.email}</strong> as the areas you picked become ready.</>}
                  {saved && !saved.wantsUpdates && <>We&apos;ve saved your request for early access planning. You won&apos;t get release emails, as you asked.</>}
                </p>
              </div>
              <button type="button" className={styles.close} onClick={close} aria-label={saved ? 'Close' : 'Close early access form'}>
                ×
              </button>
            </div>

            <div className={styles.body}>
              {saved ? (
                <div className={styles.next}>
                  <p className={styles.nextLabel}>While you&apos;re here</p>
                  <Link href="/pricing" className={styles.nextLink} onClick={close}>See plans and pricing</Link>
                  <Link href="/start" className={styles.nextLink} onClick={close}>Browse all the ways to start</Link>
                  <button type="button" className={styles.done} onClick={close}>Done</button>
                </div>
              ) : (
                <EarlyAccessForm
                  initialPlanInterest={initialPlanInterest}
                  initialFeaturesInterested={initialFeaturesInterested}
                  onSaved={setSaved}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
