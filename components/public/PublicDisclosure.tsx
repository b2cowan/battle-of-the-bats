'use client';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { X } from 'lucide-react';
import kit from './ClubKit.module.css';
import styles from './PublicDisclosure.module.css';

/** The frame's desktop breakpoint (the sidebar layout). */
const DESKTOP = '(min-width: 1024px)';
const subscribeDesktop = (notify: () => void) => {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const isDesktop = () => window.matchMedia(DESKTOP).matches;

/**
 * Shared tap-open row, wearing the link row's look (the club kit's list row — Public page layout standard R7): the name,
 * an optional dim line, the drawn chevron. Only the look is shared; it opens in place or in a window. `modalOnDesktop`
 * keeps the row a dropdown on a phone but opens its content in a window on a desk, so reading it never pushes the page
 * below it down.
 *
 * ONE LIST (R5, A8; Public page layout standard Part 3). A row is an item of a framed list: on its own it is a list of
 * one; with `joined` it is one item of the caller's `PublicLinkList`, beside other link rows (Rules' eight, Standings'
 * "How the table is ranked" + the bracket). Opened in place — every phone, and a desk without `modalOnDesktop` — the
 * content drops open INSIDE the same list, directly under its row, between hairlines: the list's frame stays whole and
 * no second box is drawn in it. The caller's content is plain; the panel (or the window) pads it.
 */
export default function PublicDisclosure({ title, sub, icon, action, children, modalOnDesktop = false, joined = false, id: anchor, open: controlledOpen, onOpenChange }: {
  title: string; sub?: string; children: ReactNode; modalOnDesktop?: boolean;
  /** One item of the caller's `PublicLinkList` rather than a list of one. */
  joined?: boolean;
  /** The item's own anchor (Rules' deep links scroll to it). */
  id?: string;
  /** A glyph before the title, on the row and in the window's title bar. */
  icon?: ReactNode;
  /** A control that belongs to the section: in the window's title bar on a desk, after the content in a dropdown. */
  action?: ReactNode;
  /** Optional group control (Rules keeps one section open); other callers keep their own state. */
  open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  function setOpen(next: boolean) {
    setLocalOpen(next);
    onOpenChange?.(next);
  }
  const id = useId();
  const desk = useSyncExternalStore(subscribeDesktop, isDesktop, () => false);
  const modal = modalOnDesktop && desk;
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, modal]);

  const item = <section id={anchor} className={styles.item}>
    <button className={`${kit.row} ${styles.toggle}`} type="button" data-modal={modal || undefined}
      aria-expanded={modal ? undefined : open} aria-controls={id} aria-haspopup={modal ? 'dialog' : undefined} onClick={() => setOpen(!open)}>
      {icon && <span className={styles.icon} aria-hidden>{icon}</span>}
      <span className={kit.rowMain}><span className={kit.rowName}>{title}</span>{sub && <span className={kit.rowSub}>{sub}</span>}</span>
    </button>
    {modal
      ? <dialog ref={dialogRef} id={id} className={styles.modal} aria-labelledby={`${id}-title`}
          onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className={styles.modalHead}>
            {icon && <span className={styles.icon} aria-hidden>{icon}</span>}
            <h2 id={`${id}-title`}>{title}{sub && <small>{sub}</small>}</h2>
            <span className={styles.modalActions}>
              {action}
              <button type="button" className={styles.modalClose} aria-label="Close" onClick={() => setOpen(false)}><X size={20} aria-hidden /></button>
            </span>
          </div>
          <div className={styles.modalBody}>{children}</div>
        </dialog>
      : <div id={id} className={styles.content} data-open={open}>{children}{action && <div className={styles.contentAction}>{action}</div>}</div>}
  </section>;
  return joined ? item : <div className={kit.list}>{item}</div>;
}
