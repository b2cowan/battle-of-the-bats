'use client';
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './PublicDisclosure.module.css';

/** Shared tap-open row; Schedule finals stay open at the frame's desktop breakpoint. */
export default function PublicDisclosure({ title, sub, children, desktopOpen = false, reveal = false }: {
  title: string; sub?: string; children: ReactNode; desktopOpen?: boolean; reveal?: boolean;
}) {
  const [open, setOpen] = useState(reveal);
  // A reveal (a deep link to a game inside) opens the row and LEAVES it open: the caller's highlight lasts a couple of
  // seconds, and a row that closed again when it ended would take the game away from the family it was opened for.
  const [wasReveal, setWasReveal] = useState(reveal);
  if (reveal !== wasReveal) {
    setWasReveal(reveal);
    if (reveal) setOpen(true);
  }
  const id = useId();
  const expanded = open;
  return <section className={styles.disclosure} data-desktop-open={desktopOpen || undefined}>
    <button className={styles.toggle} type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setOpen(!open)}>
      <span>{title}{sub && <small>{sub}</small>}</span><ChevronDown size={20} aria-hidden />
    </button>
    {desktopOpen && <div className={styles.desktopTitle}>{title} · all final</div>}
    <div id={id} className={styles.content} data-open={expanded}>{children}</div>
  </section>;
}
