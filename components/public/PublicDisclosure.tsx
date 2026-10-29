'use client';
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './PublicDisclosure.module.css';

/** Shared tap-open row; Schedule finals stay open at the frame's desktop breakpoint. */
export default function PublicDisclosure({ title, sub, children, desktopOpen = false, reveal = false }: {
  title: string; sub?: string; children: ReactNode; desktopOpen?: boolean; reveal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const expanded = open || reveal;
  return <section className={styles.disclosure} data-desktop-open={desktopOpen || undefined}>
    <button className={styles.toggle} type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setOpen(!expanded)}>
      <span>{title}{sub && <small>{sub}</small>}</span><ChevronDown size={20} aria-hidden />
    </button>
    {desktopOpen && <div className={styles.desktopTitle}>{title} · all final</div>}
    <div id={id} className={styles.content} data-open={expanded}>{children}</div>
  </section>;
}
