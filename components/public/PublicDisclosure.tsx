'use client';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
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
 * Shared tap-open row; Schedule finals stay open at the frame's desktop breakpoint. `modalOnDesktop` keeps the row a
 * dropdown on a phone but opens its content in a window on a desk, so reading it never pushes the page below it down.
 */
export default function PublicDisclosure({ title, sub, children, desktopOpen = false, reveal = false, modalOnDesktop = false, open: controlledOpen, onOpenChange }: {
  title: string; sub?: string; children: ReactNode; desktopOpen?: boolean; reveal?: boolean; modalOnDesktop?: boolean;
  /** Optional group control (Rules keeps one section open); other callers keep their own state. */
  open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(reveal);
  const open = controlledOpen ?? localOpen;
  function setOpen(next: boolean) {
    setLocalOpen(next);
    onOpenChange?.(next);
  }
  // A reveal (a deep link to a game inside) opens the row and LEAVES it open: the caller's highlight lasts a couple of
  // seconds, and a row that closed again when it ended would take the game away from the family it was opened for.
  const [wasReveal, setWasReveal] = useState(reveal);
  if (reveal !== wasReveal) {
    setWasReveal(reveal);
    if (reveal) setLocalOpen(true);
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

  return <section className={styles.disclosure} data-desktop-open={desktopOpen || undefined}>
    <button className={styles.toggle} type="button" data-modal={modal || undefined}
      aria-expanded={modal ? undefined : open} aria-controls={id} aria-haspopup={modal ? 'dialog' : undefined} onClick={() => setOpen(!open)}>
      <span>{title}{sub && <small>{sub}</small>}</span><ChevronDown size={20} aria-hidden />
    </button>
    {desktopOpen && <div className={styles.desktopTitle}>{title} · all final</div>}
    {modal
      ? <dialog ref={dialogRef} id={id} className={styles.modal} aria-labelledby={`${id}-title`}
          onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className={styles.modalHead}>
            <h2 id={`${id}-title`}>{title}{sub && <small>{sub}</small>}</h2>
            <button type="button" className={styles.modalClose} aria-label="Close" onClick={() => setOpen(false)}><X size={20} aria-hidden /></button>
          </div>
          <div className={styles.modalBody}>{children}</div>
        </dialog>
      : <div id={id} className={styles.content} data-open={open}>{children}</div>}
  </section>;
}
