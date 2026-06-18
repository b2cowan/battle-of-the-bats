'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import { getHelpSections } from '@/lib/help-content/registry';
import type { HelpRequest } from './help-drawer-context';
import HelpSectionBlock from './HelpSectionBlock';
import styles from './help.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), summary, input, [tabindex]:not([tabindex="-1"])';

/**
 * Right-edge slide-over that renders the guide section(s) a work page maps to,
 * in-context — no navigate-away. Follows the platform overlay conventions
 * (BottomSheet): portal to <body>, Escape + backdrop close, body scroll-lock,
 * role=dialog/aria-modal, focus into the panel on open. Adds a focus trap and
 * focus-restore-on-close (FeedbackModal pattern). The slide animation settles
 * instantly under the global prefers-reduced-motion guard.
 */
export default function HelpDrawer({
  request,
  onClose,
}: {
  request: HelpRequest | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Keep onClose in a ref so the keydown/scroll-lock effect (keyed on `open`
  // only) doesn't re-run on inline-arrow churn but always calls the latest.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const open = request !== null;

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        // Nothing to cycle to — keep focus on the panel so it can't escape the modal.
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined' || !request) return null;

  const sections = getHelpSections(request.module, request.sectionIds);
  const headerTitle = request.label ?? 'Help';

  return createPortal(
    <div className={styles.helpDrawerBackdrop} onClick={() => onCloseRef.current()}>
      <aside
        ref={panelRef}
        tabIndex={-1}
        className={styles.helpDrawer}
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.helpDrawerHead}>
          <div>
            <p className={styles.helpDrawerEyebrow}>Help · on this page</p>
            <h2 className={styles.helpDrawerTitle}>{headerTitle}</h2>
          </div>
          <button
            type="button"
            className={styles.helpDrawerClose}
            onClick={() => onCloseRef.current()}
            aria-label="Close help"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className={styles.helpDrawerBody}>
          {sections.length === 0 ? (
            <p className={styles.helpDrawerEmpty}>Help for this page is coming soon.</p>
          ) : (
            sections.map(({ section, id }) => (
              <div key={id} className={styles.helpDrawerSection}>
                <HelpSectionBlock section={section} sectionId={id} headingLevel={3} />
              </div>
            ))
          )}
        </div>

        {request.fullGuideHref && (
          <div className={styles.helpDrawerFoot}>
            <Link
              href={request.fullGuideHref}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.helpDrawerFullLink}
            >
              Open the full guide <ExternalLink size={13} aria-hidden />
            </Link>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
