'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from './PreviewExitPill.module.css';

/**
 * Fixed "Exit preview → Dashboard" control on the draft-tournament preview shell (The Flip / seam B14).
 * The preview stays otherwise identity-chrome-free (P0-3) — this is navigation, not identity. Same-tab.
 */
export default function PreviewExitPill({ dashboardHref }: { dashboardHref: string }) {
  return (
    <Link href={dashboardHref} className={styles.pill} aria-label="Exit preview and return to the dashboard">
      <ArrowLeft size={14} aria-hidden />
      <span className={styles.label}>Exit preview</span>
    </Link>
  );
}
