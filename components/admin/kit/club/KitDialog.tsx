'use client';
/**
 * KitDialog — the admin kit's window, in the two kinds the portal's rulings allow (Club Tier Stage 1,
 * screens session; the modal ruling: "a window is for a question or a form"):
 *
 *   question — a small centred window that asks one thing ("Suspend Sam Okafor?", "Move to Club ·
 *              Association?"). A scrim tap or Escape is "no".
 *   form     — a larger window that collects something (Invite, Manage). On a phone it FILLS the
 *              screen and covers the bar, with ← at the top left — the drawer-layers ruling
 *              (2026-09-23): a FORM covers the nav, a MENU sits on top of it. A scrim tap does not
 *              throw a half-filled form away; Cancel, ← and Escape do.
 *
 * A question can open ON TOP of a form (Suspend asks first, from inside Manage): it stacks one
 * layer higher.
 *
 * ⚠ NOT PORTALLED. The admin kit's tokens (the warm palette, R1's colours) live on a wrapper above
 * the shell; a window portalled to <body> would render outside it, in the wrong palette. It renders
 * where it is mounted, `position: fixed`, above the phone bar's layer.
 * ⚠ Kit only: nothing outside the switch mounts it. TOKENS ONLY (the scrim is the one exemption,
 * annotated — the kit's "themed scrim" gap, ADC Phase 0).
 *
 * THE PORTAL'S WINDOW FLOOR (Admin Design Continuity slice 6, owner 2026-09-27: "build it here"). Every
 * window stands on the coaches portal's own `useDialogFloor`: Tab is trapped inside the panel, focus
 * returns to the button that opened it, Escape closes the TOP window only, and the phone's Back closes
 * the top window (one history step per window, the shared Back stack — a question over a form closes
 * alone). All of it holds while `busy`. Before this the club windows hand-rolled Escape and nothing
 * else: a keyboard walked out behind the window, and Back left the page from under it.
 * ⚠ A QUESTION IS role="dialog", as the portal's own questions are (`QuestionShell`). The floor reads an
 * `alertdialog` as a confirmation docked INSIDE a panel and holds Back while one is on screen, so the
 * old role would have made Back do nothing on every club question.
 * ⚠ A BUTTON THAT CLOSES A WINDOW AND NAVIGATES (`router.push`) must navigate with the window still
 * open: the step tidies its history entry one tick after the click, before the router has pushed the
 * new address, and that Back cancels the navigation (`useBackStep`'s header). Settings' "Save your
 * changes?" is the one case today.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import styles from './KitDialog.module.css';

// The page stops scrolling while ANY window is open, and scrolls again only when the LAST one closes.
// A count, not a per-window "put back what I found": a question over a form, both unmounted at once
// (Remove confirmed → the form closes with it), would otherwise each restore the value it saw on
// opening — and whichever cleaned up last could leave the page frozen.
let openWindows = 0;
let pageOverflow = '';
function lockPageScroll() {
  if (openWindows === 0) { pageOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
  openWindows += 1;
}
function unlockPageScroll() {
  openWindows = Math.max(0, openWindows - 1);
  if (openWindows === 0) document.body.style.overflow = pageOverflow;
}

export default function KitDialog({
  kind,
  title,
  eyebrow,
  identity,
  onClose,
  children,
  footer,
  footerStart,
  busy = false,
}: {
  kind: 'question' | 'form';
  title: ReactNode;
  /** The record the window is about, ABOVE the title ("9U A" over "Start the 2027 Season?"). */
  eyebrow?: ReactNode;
  /** A form's identity line under its title (Manage: "sam@example.com · Admin since August 2026").
   *  Not a page header, so it keeps its second line (hub v8). */
  identity?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** The window's own actions, right-aligned: Cancel, then the primary. */
  footer: ReactNode;
  /** The far-left of the footer — a destructive door kept away from Save (Manage's Suspend…). */
  footerStart?: ReactNode;
  /** While a save runs, Escape and the scrim do nothing. */
  busy?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Mounted = open. Called BEFORE the focus effect below, so the floor records the opener while it
  // still has focus, then that effect moves the cursor into the first field.
  useDialogFloor(true, panelRef, { onClose, busy });

  useEffect(() => {
    const panel = panelRef.current;
    // Focus the first field (a form) or the panel itself (a question), so the keyboard is inside.
    const first = panel?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), select, textarea');
    (first ?? panel)?.focus();
    lockPageScroll();
    return unlockPageScroll;
  }, []);

  return (
    <div
      className={`${styles.overlay} ${kind === 'question' ? styles.overlayQuestion : styles.overlayForm}`}
      onPointerDown={e => {
        if (kind === 'question' && e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`${styles.panel} ${kind === 'question' ? styles.question : styles.form}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-kit-dialog=""
      >
        <div className={styles.head}>
          {kind === 'form' && (
            <button type="button" className={styles.back} onClick={onClose} aria-label="Back" disabled={busy}>
              <ArrowLeft size={20} aria-hidden />
            </button>
          )}
          <div className={styles.titleBlock}>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {identity && <p className={styles.identity}>{identity}</p>}
          </div>
          {kind === 'form' && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close" disabled={busy}>
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.foot}>
          {footerStart && <div className={styles.footStart}>{footerStart}</div>}
          <div className={styles.footEnd}>{footer}</div>
        </div>
      </div>
    </div>
  );
}
