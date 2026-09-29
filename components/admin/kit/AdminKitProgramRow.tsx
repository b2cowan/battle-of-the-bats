'use client';
/**
 * AdminKitProgramRow — "In Rep Teams": a program's own pages, one tap away at the top of its first
 * screen on a phone (ratified club Stage 1 specimen 4, third phone). The club phone bar is ONE bar
 * for the whole club, so a program's pages cannot live in it the way today's per-module bars tried
 * to; they live here instead — the same list the desktop rail opens (`lib/admin-kit-nav.ts`).
 *
 * Phone only (the rail carries them above 900 — CSS), and only on a program's FIRST screen, as drawn. A program with one page has nothing to add.
 * The chrome mounts it keyed by the path, so it opens closed on every page.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { isKitLinkActive } from '@/lib/admin-kit-nav';
import { useAdminKitNav } from './useAdminKitNav';
import styles from './AdminKitFrame.module.css';

export default function AdminKitProgramRow() {
  const { pathname, programs, section } = useAdminKitNav();
  const [open, setOpen] = useState(false);

  const program = programs.find(p => p.key === section);
  if (!program || pathname !== program.href || program.pages.length < 2) return null;
  const others = program.pages.slice(1);

  return (
    <div className={styles.programRow}>
      <button
        type="button"
        className={styles.programRowHead}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.programRowText}>
          <span className={styles.programRowTitle}>In {program.label}</span>
          <span className={styles.programRowPages}>{others.map(p => p.label).join(' · ')}</span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden
          className={`${styles.programRowChevron}${open ? ` ${styles.programRowChevronOpen}` : ''}`}
        />
      </button>
      {open && (
        <nav className={styles.programRowList} aria-label={`${program.label} pages`}>
          {others.map(p => (
            <Link
              key={p.key}
              href={p.href}
              className={`${styles.programRowLink}${isKitLinkActive(pathname, p) ? ` ${styles.programRowLinkActive}` : ''}`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
