'use client';
/**
 * SCHEDULE HEALTH AS ONE ROW — the score as its lead mark, the title, one caption, and a down chevron that opens the
 * panel in place. Drawn for the game-day board (Tournament admin redesign Stage 1) and worn at the foot of the
 * schedule's day (Stage 3, S1: "Schedule health as Stage 1's board draws it") — one row, never a second.
 *
 * The demo tour's "Break the schedule" step rings this row: a caller passes the anchor as the literal attribute
 * (`data-sandbox-tour="schedule-health"`), which is what the tour-anchor guard's static scan reads.
 */
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './HealthRow.module.css';

export default function HealthRow({
  score, tone, title, caption, open, onToggle, children, 'data-sandbox-tour': tourAnchor,
}: {
  /** The health score, or null when there is no timed schedule to score ("—"). */
  score: number | null;
  tone?: 'good' | 'warning' | 'danger';
  title: string;
  caption: string;
  open: boolean;
  onToggle: () => void;
  /** The panel, opened in place under the row. */
  children: ReactNode;
  'data-sandbox-tour'?: string;
}) {
  return (
    <div className={styles.health} data-sandbox-tour={tourAnchor}>
      <button type="button" className={styles.healthRow} aria-expanded={open} onClick={onToggle}>
        <span className={styles.healthScore} data-tone={score != null ? tone : undefined}>
          {score != null ? score : '—'}
        </span>
        <span className={styles.healthText}>
          <span className={styles.healthTitle}>{title}</span>
          <span className={styles.healthCaption}>{caption}</span>
        </span>
        <ChevronDown size={16} className={styles.healthChevron} aria-hidden />
      </button>
      {open && <div className={styles.healthBody}>{children}</div>}
    </div>
  );
}
