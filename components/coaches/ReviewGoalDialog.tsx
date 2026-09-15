'use client';
import { useState } from 'react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { GOAL_STATUS_LABELS, nextReviewSuggestion, reviewGapWords } from '@/lib/development-goal-history';
import { GOAL_STATUSES } from '@/lib/development-input';
import { formatShortDate, todayLocal } from '@/lib/measurable-format';
import type { RepDevelopmentGoalReview, RepDevelopmentGoalStatus, RepPlayerDevelopmentGoal, RepPlayerObservation } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "Review goal" (development lifecycle Phase 2, mockup screen 4; F08 + F19): a dated event
 * APPENDED to the goal's history — the status is the required choice; the note, the next review
 * date and the evidence are optional. Nothing is overwritten. Evidence links the observations
 * already recorded as evidence for this goal — automatically, named in the hint — so a review
 * never claims evidence the coach did not record.
 *
 * Re-evaluation stage 3 (owner ruling E5, 2026-09-15): the note is "How it's going" — the word
 * "observe" belongs to the button beside this sheet, which writes a different record — and the
 * next review pre-fills to a FUTURE date on the goal's own cadence (`nextReviewSuggestion`: today
 * plus the gap the last review set), never the goal's existing date, which was in the past on
 * every review after the first. The status pre-selects the goal's current one — the pill's fact,
 * seen from the sheet.
 */
export default function ReviewGoalDialog({
  goal, reviews, linkedObservations, busy, error, onSubmit, onClose,
}: {
  goal: RepPlayerDevelopmentGoal;
  /** The player's reviews (any goal's — filtered here) — the cadence is read from this goal's. */
  reviews: readonly RepDevelopmentGoalReview[];
  linkedObservations: RepPlayerObservation[];
  busy: boolean;
  error: string;
  onSubmit: (v: { status: RepDevelopmentGoalStatus; reviewedOn: string; note: string; nextReviewOn: string | null; evidenceObservationIds: string[] }) => void;
  onClose: () => void;
}) {
  const today = todayLocal();
  const suggested = nextReviewSuggestion(goal, reviews, today);
  const [status, setStatus] = useState<RepDevelopmentGoalStatus>(goal.status);
  const [reviewedOn, setReviewedOn] = useState(today);
  const [note, setNote] = useState('');
  const [nextReviewOn, setNextReviewOn] = useState(suggested ?? '');
  const gap = suggested ? reviewGapWords(today, suggested) : null;

  // Typed work a Cancel, an X or Escape would throw away — asked once, never on Save. A changed
  // status or date alone is not typed work: the sheet re-opens on the same facts in one tap.
  const close = useDiscardGuard({ dirty: note.trim().length > 0, close: onClose, noun: 'review', detail: 'how it’s going' });

  return (
    <QuestionShell open onClose={close} ariaLabel="Review the goal" title="Review the goal" subtitle={goal.focusArea} busy={busy}>
        <form className={styles.formBody} onSubmit={e => {
          e.preventDefault();
          onSubmit({ status, reviewedOn, note: note.trim(), nextReviewOn: nextReviewOn || null, evidenceObservationIds: linkedObservations.map(o => o.id) });
        }}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Status after this review</span>
              <select className={styles.select} value={status} onChange={e => setStatus(e.target.value as RepDevelopmentGoalStatus)} required>
                {GOAL_STATUSES.map(s => <option key={s} value={s}>{GOAL_STATUS_LABELS[s]}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Reviewed on</span>
              <input className={styles.input} type="date" value={reviewedOn} onChange={e => setReviewedOn(e.target.value)} required />
            </label>
            <label className={`${styles.field} ${styles.formGridFull}`}>
              <span className={styles.label}>How it’s going (optional)</span>
              <textarea className={styles.textarea} rows={3} maxLength={600} value={note} placeholder="What you’re seeing, and what to try next"
                onChange={e => setNote(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Next review (optional)</span>
              <input className={styles.input} type="date" value={nextReviewOn} onChange={e => setNextReviewOn(e.target.value)} />
              {suggested && nextReviewOn === suggested && (
                <span className={styles.formHint}>{gap ? `${gap} — the gap your last review set.` : 'The gap your last review set.'} Change it, or clear it.</span>
              )}
            </label>
          </div>
          <p className={styles.formHint}>
            {linkedObservations.length > 0
              ? `Evidence linked: ${linkedObservations.map(o => `the ${formatShortDate(o.observedOn)} observation`).join(', ')}. `
              : 'No observation is linked to this goal yet — record one from the goal and it becomes evidence. '}
            This review is added to the goal’s history.
          </p>
          {error && <p className={styles.errorText} role="alert">{error}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} disabled={busy} onClick={() => void close()}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save review'}</button>
          </div>
        </form>
    </QuestionShell>
  );
}
