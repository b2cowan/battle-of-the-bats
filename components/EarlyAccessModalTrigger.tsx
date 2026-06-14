'use client';

import { ReactNode, useEffect, useId, useState } from 'react';
import EarlyAccessForm from './EarlyAccessForm';
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
  children = 'Join Early Access',
  className,
  initialPlanInterest,
  initialFeaturesInterested,
  onClick,
}: EarlyAccessModalTriggerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
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
        <div className={styles.overlay} role="presentation" onMouseDown={() => setOpen(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={event => event.stopPropagation()}
          >
            <div className={styles.header}>
              <div>
                <p className={styles.kicker}>Early Access</p>
                <h2 id={titleId} className={styles.title}>Tell us what you want to see next</h2>
                <p className={styles.copy}>
                  Share a few details and we&apos;ll use them for release updates and early access planning.
                </p>
              </div>
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close early access form">
                X
              </button>
            </div>

            <EarlyAccessForm
              initialPlanInterest={initialPlanInterest}
              initialFeaturesInterested={initialFeaturesInterested}
            />
          </div>
        </div>
      )}
    </>
  );
}
