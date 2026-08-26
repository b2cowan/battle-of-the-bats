'use client';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * A failed load, with the way out of it.
 *
 * ⚠ IT EXISTS BECAUSE MONEY WAS A DEAD END (UX review 2026-08-26). All seven Money tabs plus the
 * hub printed the error sentence and stopped — no retry, no way back. A coach whose read failed
 * (a dropped connection on a phone at a rink is the ordinary case, not the exotic one) had exactly
 * one recovery: reload the browser. Flow-completeness check 5.
 *
 * The markup is the portal's existing inline pattern — the sentence, then a quiet link-button on
 * the same line. Copied from the drive-detail error the Transactions panel already shipped, which
 * is the one place that had it right.
 */
export default function CoachLoadError({
  message,
  onRetry,
  label = 'Try again',
}: {
  message: string;
  /** Re-runs the load. Callers pass the LOUD load — a retry the coach asked for must show that
   *  something is happening, which is the one thing a quiet background refresh must not do. */
  onRetry: () => void;
  label?: string;
}) {
  return (
    <p className={styles.errorText} role="alert">
      {message}{' '}
      <button type="button" className={styles.retryBtn} onClick={onRetry}>
        {label}
      </button>
    </p>
  );
}
