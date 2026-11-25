'use client';
import { useRef, useState } from 'react';
import kit from './ClubKit.module.css';

/** The one word for closing a list opened in place (Club Website Stage 1; plan §10). */
export const SHOW_FEWER = 'Show fewer';

/**
 * A list that opens the rest of itself IN PLACE (the standard's R7; Club Website Stage 1: Open now's "N more open now", the
 * games part's "N more live now"). Closing brings `ref`'s element (the list, or its band's heading) back into view, so
 * the page does not jump past it.
 */
export function useShowMore<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'nearest' }));
  };
  return { open, ref, toggle: open ? close : () => setOpen(true) };
}

/** The row that does it: "N more …" with what they are, its chevron down; open, "Show fewer" pointing up. */
export default function ClubMoreRow({ open, title, sub, onToggle, className }: {
  open: boolean; title: string; sub: string | null; onToggle: () => void; className?: string;
}) {
  return (
    <button type="button" className={`${kit.row} ${kit.rowMore}${className ? ` ${className}` : ''}`} aria-expanded={open} onClick={onToggle}>
      <span className={kit.rowMain}>
        <span className={kit.rowName}>{open ? SHOW_FEWER : title}</span>
        {!open && sub && <span className={kit.rowSub}>{sub}</span>}
      </span>
    </button>
  );
}
