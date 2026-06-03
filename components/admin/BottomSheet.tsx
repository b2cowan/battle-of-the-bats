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

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the sheet for keyboard users.
    sheetRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

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
