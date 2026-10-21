'use client';
/**
 * A CLOSED ROW OF FACT THAT EXPANDS IN PLACE (a down chevron — Ask 8 ruling 3: right opens a place, down opens here),
 * its detail on the paper tone under it (§3.10.8). Today it is Payments' slim line above the team list; it began as
 * the rows of Teams' "At a glance" card, which is gone (owner 2026-10-21: health became a header button and window,
 * registration a chip beside the picker).
 */
import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from '../teams-admin.module.css';

export default function GlanceRow({ title, caption, figure, figureBad = false, open, onToggle, children }: {
  title: ReactNode;
  caption?: ReactNode;
  /** The one figure the row exists to show ("$1,825 past due"). */
  figure?: ReactNode;
  /** Danger ink — ONLY for genuinely bad news (money past due), never a status. */
  figureBad?: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <>
      <button type="button" className={styles.glanceRow} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className={styles.glanceMain}>
          <span className={styles.glanceTitle}>{title}</span>
          {caption != null && <span className={styles.glanceCaption}>{caption}</span>}
        </span>
        {figure != null && <span className={styles.glanceFigure} data-bad={figureBad || undefined}>{figure}</span>}
        <ChevronDown size={16} aria-hidden className={styles.glanceChevron} />
      </button>
      {open && <div id={bodyId} className={styles.glanceBody}>{children}</div>}
    </>
  );
}
