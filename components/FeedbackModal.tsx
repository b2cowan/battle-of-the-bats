'use client';

import { useEffect, useId, useRef } from 'react';
import { AlertCircle, X, CheckCircle, Info } from 'lucide-react';
import { useOverlayOpenIfAvailable } from '@/lib/coaches-overlay';
import styles from './FeedbackModal.module.css';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void; // If provided, shows Cancel button and acts as confirm
  title: string;
  message: string;
  /**
   * Optional list shown below the message (e.g. team names in a bulk action).
   * Items with a `note` are rendered dimmed with the note in warning colour —
   * use for ineligible entries (missing email, wrong status, etc.).
   */
  items?: Array<{ label: string; note?: string }>;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'primary' | 'warning' | 'success' | 'info';
}

export default function FeedbackModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  items,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'primary'
}: FeedbackModalProps) {
  const titleId = useId();
  // Inside the coaches portal this registers with the shared overlay signal (nav hides +
  // scroll locks while a confirm/feedback dialog is up — the layout's documented contract);
  // everywhere else (admin, scorekeeper, consumer) the tolerant variant no-ops.
  useOverlayOpenIfAvailable(isOpen);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Latest-ref for onClose so the focus/Escape effect can key on `isOpen` ALONE.
  // Callers pass an inline-arrow onClose (new identity each render); keying the
  // effect on it would tear down + restore focus on every re-render-while-open
  // (focus churn). The ref keeps Escape calling the current onClose without that.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    // Remember what had focus so we can restore it when the dialog closes,
    // then move focus to the non-destructive Cancel/Close button.
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      /* ⚠ TAB STAYS IN THE DIALOG (/review, 2026-09-24). Without this, Tab walked out of an open
         confirm into the page behind it — and when the page behind was itself a trapped dialog (a
         practice block's sheet asking "Delete Skills circuit?"), that dialog's own trap then held
         focus AWAY from the question: a keyboard coach could not get back to Keep it or Delete,
         and Escape closed the question and the sheet together. The floor under a sheet
         (`useDialogFloor`) ignores keys from outside its panel, so this trap never fights it. */
      if (e.key !== 'Tab') return;
      const box = dialogRef.current;
      if (!box) return;
      const focusables = Array.from(box.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && box.contains(active);
      if (e.shiftKey && (!inside || active === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertCircle size={16} className="text-danger" />;
      case 'warning': return <AlertCircle size={16} className="text-warning" />;
      case 'success': return <CheckCircle size={16} className="text-success" />;
      default: return <Info size={16} className="text-primary" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        ref={dialogRef}
        className={`modal ${styles.dialog}`}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 480 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <div className="flex items-center gap-2">
            {getIcon()}
            <h3 id={titleId} className={styles.title} style={{ margin: 0 }}>{title}</h3>
          </div>
          <button className="btn btn-ghost btn-data" aria-label="Close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className={styles.message}>
          {message}
          {items && items.length > 0 && (
            <ul style={{
              margin: '0.75rem 0 0',
              padding: '0.5rem 0.75rem',
              listStyle: 'none',
              background: 'var(--white-05)',
              borderRadius: 0,
              maxHeight: 200,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
            }}>
              {items.map((item, i) => {
                const ineligible = !!item.note;
                return (
                  <li key={i} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                      background: ineligible ? 'rgba(var(--warning-rgb,220,150,50),0.5)' : 'var(--white-30)',
                    }} />
                    <span style={{ color: ineligible ? 'var(--white-30)' : 'var(--white-70)', flex: 1 }}>
                      {item.label}
                    </span>
                    {item.note && (
                      <span style={{ color: 'rgba(var(--warning-rgb,220,150,50),0.8)', fontSize: '0.72rem', flexShrink: 0 }}>
                        {item.note}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="modal-footer">
          <button ref={cancelRef} className={`btn btn-ghost btn-data ${styles.actionBtn}`} onClick={onClose}>
            {onConfirm ? cancelText : 'Close'}
          </button>
          {onConfirm && (
            <button
              className={`btn btn-${type === 'danger' ? 'danger' : 'lime'} btn-data ${styles.actionBtn}`}
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
