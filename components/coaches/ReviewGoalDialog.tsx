'use client';
import { useState } from 'react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { GOAL_STATUS_LABELS } from '@/lib/development-goal-history';
import { GOAL_STATUSES } from '@/lib/development-input';
import { formatShortDate, todayLocal } from '@/lib/measurable-format';
import type { RepDevelopmentGoalStatus, RepPlayerDevelopmentGoal, RepPlayerObservation } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "Review goal" (development lifecycle Phase 2, mockup screen 4; F08 + F19): a dated event
 * APPENDED to the goal's history — the status is the required choice; the note, the next review
 * date and the evidence are optional. Nothing is overwritten. Evidence links the observations
 * already recorded as evidence for this goal — automatically, named in the hint — so a review
 * never claims evidence the coach did not record.
 */
export default function ReviewGoalDialog({
  goal, linkedObservations, busy, error, onSubmit, onClose,
}: {
  goal: RepPlayerDevelopmentGoal;
  linkedObservations: RepPlayerObservation[];
  busy: boolean;
  error: string;
  onSubmit: (v: { status: RepDevelopmentGoalStatus; reviewedOn: string; note: string; nextReviewOn: string | null; evidenceObservationIds: string[] }) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<RepDevelopmentGoalStatus>(goal.status);
  const [reviewedOn, setReviewedOn] = useState(todayLocal());
  const [note, setNote] = useState('');
  const [nextReviewOn, setNextReviewOn] = useState(goal.reviewOn ?? '');

  return (
    <QuestionShell open onClose={onClose} ariaLabel="Review the goal" title="Review the goal" subtitle={goal.focusArea} busy={busy}>
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
              <span className={styles.label}>What did you observe? (optional)</span>
              <textarea className={styles.textarea} rows={3} maxLength={600} value={note} placeholder="What happened, in which setting?"
                onChange={e => setNote(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Next review (optional)</span>
              <input className={styles.input} type="date" value={nextReviewOn} onChange={e => setNextReviewOn(e.target.value)} />
            </label>
          </div>
          <p className={styles.formHint}>
            {linkedObservations.length > 0
              ? `Evidence linked: ${linkedObservations.map(o => `the ${formatShortDate(o.observedOn)} observation`).join(', ')}. `
              : 'No observation is linked to this goal yet — record one from the Observations view and it becomes evidence. '}
            This review is added to the goal’s history — nothing is overwritten.
          </p>
          {error && <p className={styles.errorText} role="alert">{error}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} disabled={busy} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save review'}</button>
          </div>
        </form>
    </QuestionShell>
  );
}
