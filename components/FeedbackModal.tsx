'use client';

import { useEffect, useId, useRef } from 'react';
import { AlertCircle, X, CheckCircle, Info } from 'lucide-react';

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
  const cancelRef = useRef<HTMLButtonElement>(null);
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
      if (e.key === 'Escape') onCloseRef.current();
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
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 480 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <div className="flex items-center gap-2">
            {getIcon()}
            <h3 id={titleId} style={{ margin: 0 }}>{title}</h3>
          </div>
          <button className="btn btn-ghost btn-data" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '0.75rem 0', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--white-70)', lineHeight: 1.55 }}>
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
          <button ref={cancelRef} className="btn btn-ghost btn-data" onClick={onClose}>
            {onConfirm ? cancelText : 'Close'}
          </button>
          {onConfirm && (
            <button
              className={`btn btn-${type === 'danger' ? 'danger' : 'lime'} btn-data`}
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
