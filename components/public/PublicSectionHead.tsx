import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './PublicParts.module.css';

/**
 * A section's heading on the public pages (Public tournament pages Stage 2, hub "The end state"): its name, an optional
 * count ("Live now 2"), and an optional door on the right ("Full schedule", "All results") — in the drawing these are the
 * heading's own link, not a row under the list. 44 px tall link, 16 px heading; a division's 18 px. Public page layout
 * standard R4: every section heading on a public tournament page AND a club public page is this part (club round,
 * 2026-11-05) — the club's pages read the same `--club-*` tokens, so it draws in the club's palette there.
 */
export default function PublicSectionHead({ title, count, link, action, id, division }: {
  title: string;
  /** A division's heading ("U11"): 18 px, the top of the three levels (standard R4; 18 px ruled 2026-10-30). */
  division?: boolean;
  count?: number;
  link?: { href: string; label: string };
  /** A control in the right slot instead of a link (a club team's Schedule keeps its Subscribe there, 2026-10-20). */
  action?: ReactNode;
  /** The heading's id, for a section's `aria-labelledby`. */
  id?: string;
}) {
  return (
    <div className={styles.head}>
      <h2 className={division ? `${styles.headTitle} ${styles.divisionTitle}` : styles.headTitle} id={id}>
        {title}
        {count != null && <span className={styles.count}>{count}</span>}
      </h2>
      {link && <Link className={styles.headLink} href={link.href}>{link.label}</Link>}
      {!link && action}
    </div>
  );
}
