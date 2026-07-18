'use client';

/**
 * Shared admin bottom sheet (Phase A foundation).
 *
 * One portal-rendered sheet for mobile filter/settings/edit panels — replaces the
 * per-page sheet CSS currently duplicated in schedule + registrations (those
 * migrate onto this in a follow-up). Handles backdrop, drag handle, sticky
 * footer, safe-area, Esc-to-close, and body scroll-lock. The slide-up animation
 * settles instantly under the global prefers-reduced-motion guard (globals.css).
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './BottomSheet.module.css';

export default function BottomSheet({
  open,
  onClose,
  title,
  footer,
  children,
  ariaLabel,
  maxHeight,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
  maxHeight?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Read the latest onClose via a ref rather than depending on it directly below.
  // A caller that doesn't memoize onClose (most don't) passes a new function every
  // render — if that render happened because the CALLER's own state changed (e.g.
  // typing into a form field inside the sheet), depending on `onClose` re-ran this
  // effect and called sheetRef.current?.focus() again, yanking focus off the input
  // mid-keystroke and dismissing the mobile keyboard on every character (2026-07-17).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the sheet for keyboard users. Only on the open/close
    // transition — see the ref note above for why onClose isn't a dependency here.
    sheetRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={styles.sheet}
        style={maxHeight ? { maxHeight } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : ariaLabel}
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden />
        {title && (
          <div className={styles.header}>
            <span className={styles.title}>{title}</span>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <X size={16} aria-hidden />
            </button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
