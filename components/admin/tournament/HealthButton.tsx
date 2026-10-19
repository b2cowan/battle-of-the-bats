'use client';
/**
 * SCHEDULE HEALTH AS A HEADER BUTTON (owner 2026-10-19, A1–A6) — the score in its tone, the name, and the issue count
 * in the rail's amber pill (a count that is a STATUS may wear it, design_decisions: the club clash count). It opens the
 * health window; it no longer sits at the foot of the schedule's day, under every game.
 *
 * On a phone the header's actions are icons (A6): a pulse in the score's tone, the count as its badge, the score said
 * in the spoken name and read in the window. The score stays bare at a desk, as the row's was; the window gives the
 * scale ("78/100").
 *
 * The demo tour's "Break the schedule" step rings this button: a caller passes the anchor as the literal attribute
 * (`data-sandbox-tour="schedule-health"`), which is what the tour-anchor guard's static scan reads.
 */
import { Activity } from 'lucide-react';
import screenParts from './ScreenParts.module.css';
import kit from '@/components/admin/kit/AdminKitFrame.module.css';
import styles from './HealthButton.module.css';

export default function HealthButton({
  score, tone, issues, title, label, onOpen, 'data-sandbox-tour': tourAnchor,
}: {
  /** The health score, or null when there is no timed schedule to score ("—"). */
  score: number | null;
  tone: 'good' | 'warning' | 'danger';
  /** Issues found; none draws no count. */
  issues: number;
  /** The button's words ("Schedule health"). */
  title: string;
  /** The spoken name: the score with its scale, and its issues. */
  label: string;
  onOpen: () => void;
  'data-sandbox-tour'?: string;
}) {
  const shownTone = score != null ? tone : undefined;
  return (
    <button
      type="button"
      className={`btn btn-outline btn-data ${screenParts.headerButton} ${styles.button}`}
      aria-haspopup="dialog"
      aria-label={label}
      title={label}
      onClick={onOpen}
      data-sandbox-tour={tourAnchor}
    >
      <Activity size={18} className={styles.pulse} data-tone={shownTone} aria-hidden />
      <span className={styles.score} data-tone={shownTone} aria-hidden>{score != null ? score : '—'}</span>
      <span className={screenParts.headerButtonLabel}>{title}</span>
      {score != null && issues > 0 && <span className={`${kit.count} ${styles.count}`} aria-hidden>{issues}</span>}
    </button>
  );
}
