'use client';

/**
 * Shared admin bottom sheet (Phase A foundation).
 *
 * One portal-rendered sheet for mobile filter/settings/edit panels — replaces the
 * per-page sheet CSS currently duplicated in schedule + registrations (those
 * migrate onto this in a follow-up). Handles backdrop, drag handle, sticky
 * footer, safe-area, Esc-to-close, and body scroll-lock. The slide-up animation
 * settles instantly under the global prefers-reduced-motion guard (globals.css).
 *
 * On the Sheet Frame's terms since Tournament admin redesign Stage 6 (A29, ruled 2026-10-07 — "the next
 * time it is touched", Sheet Frame D4): its own component still, with the frame's 18px corners and the
 * portal's dim, a RECORD head (the record's name at 16/700 and, when given, one context line under it —
 * `subtitle`) and the plain × in a 44px tap area (the 2026-10-07 ruling). One sheet, FIVE users, all moved
 * together: the check-in board (the gate's and the organizer's), Teams' view settings on a phone, the
 * schedule's reschedule sheet, and the public site's two follow sheets (the public skin keeps its own
 * colours; only the shape is shared).
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PortalKitRoot } from './AdminKitProvider';
import styles from './BottomSheet.module.css';

export default function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
  ariaLabel,
  maxHeight,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** The record head's one context line under the title ("U11 Girls · Not arrived"). */
  subtitle?: ReactNode;
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

  // Admin Design Continuity slice 4c — this sheet `createPortal`s to `document.body`, a SIBLING of the
  // admin shell, so no `[data-admin-kit]` rule could reach it (nor the caller's content inside it: the
  // schedule timeline's reschedule sheet, the check-in board's detail). `PortalKitRoot` carries the
  // marker on a wrapper ABOVE the backdrop (a marker on the backdrop itself cannot satisfy the
  // backdrop's own `[data-admin-kit] .backdrop` rule) — nothing with the switch off, and nothing inside a
  // public preview (the island turns the kit off, R2): this sheet also serves two public components.
  return createPortal(
    <PortalKitRoot>
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
            <div className={styles.headText}>
              <span className={styles.title}>{title}</span>
              {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <X size={20} aria-hidden />
            </button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
    </PortalKitRoot>,
    document.body,
  );
}
