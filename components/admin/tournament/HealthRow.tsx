'use client';
/**
 * SCHEDULE HEALTH AS ONE ROW ON THE GAME-DAY BOARD — the score as its lead mark, the title, one caption, and a chevron
 * that opens the health window: the very window the Schedule's header button opens, in the middle of the screen (owner
 * 2026-10-19, A5: "not this crammed drop down"). It no longer opens a panel in place. The board keeps a row because the
 * board is cards you can hide and reorder; the Schedule wears a header button instead.
 *
 * The demo tour's "Break the schedule" step rings this row: a caller passes the anchor as the literal attribute
 * (`data-sandbox-tour="schedule-health"`), which is what the tour-anchor guard's static scan reads.
 */
import { ChevronRight } from 'lucide-react';
import styles from './HealthRow.module.css';

export default function HealthRow({
  score, tone, title, caption, onOpen, 'data-sandbox-tour': tourAnchor,
}: {
  /** The health score, or null when there is no timed schedule to score ("—"). */
  score: number | null;
  tone?: 'good' | 'warning' | 'danger';
  title: string;
  caption: string;
  /** Opens the health window. */
  onOpen: () => void;
  'data-sandbox-tour'?: string;
}) {
  return (
    <div className={styles.health} data-sandbox-tour={tourAnchor}>
      <button type="button" className={styles.healthRow} aria-haspopup="dialog" onClick={onOpen}>
        <span className={styles.healthScore} data-tone={score != null ? tone : undefined}>
          {score != null ? score : '—'}
        </span>
        <span className={styles.healthText}>
          <span className={styles.healthTitle}>{title}</span>
          <span className={styles.healthCaption}>{caption}</span>
        </span>
        <ChevronRight size={16} className={styles.healthChevron} aria-hidden />
      </button>
    </div>
  );
}
