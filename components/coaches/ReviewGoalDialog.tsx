'use client';
import { useState } from 'react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import SheetRemoveButton from '@/components/coaches/SheetRemoveButton';
import { GOAL_STATUS_LABELS, nextReviewSuggestion, reviewGapWords } from '@/lib/development-goal-history';
import { GOAL_STATUSES } from '@/lib/development-input';
import { formatShortDate, todayLocal } from '@/lib/measurable-format';
import type { RepDevelopmentGoalReview, RepDevelopmentGoalStatus, RepPlayerDevelopmentGoal, RepPlayerObservation } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "Review goal" (development lifecycle Phase 2, mockup screen 4; F08 + F19): a dated event on the
 * goal's history — the status is the required choice; the note, the next review date and the
 * evidence are optional. Evidence links the observations already recorded as evidence for this
 * goal — automatically, named in the hint — so a review never claims evidence the coach did not
 * record.
 *
 * Re-evaluation stage 3 (owner ruling E5, 2026-09-15): the note is "How it's going" — the word
 * "observe" belongs to the button beside this sheet, which writes a different record. A new
 * review's status pre-selects the goal's current one — the pill's fact, seen from the sheet.
 *
 * ⚠ NEXT REVIEW STARTS BLANK (owner, 2026-09-16, reversing part of E5's own build): the field
 * itself is never pre-filled. `nextReviewSuggestion` (today plus the gap the last review set) is
 * shown as a ONE-TAP offer beside the empty field instead — the gap is whatever a coach happened
 * to set last time, not a real recommendation, so carrying it forward silently risked a coach
 * saving a review with a date they never chose and didn't notice was there.
 *
 * `editing` (owner ruling 2026-09-16 — a coach's own working record, not an audit log a mistake
 * should have to live in forever) opens this same sheet on an existing review's own facts instead
 * of a fresh one, with Remove at the footer; the host recomputes the goal's status pill from
 * whichever review is now latest, same as it always has on write.
 */
export default function ReviewGoalDialog({
  goal, editing, reviews, linkedObservations, busy, error, onSubmit, onClose, onRemove,
}: {
  goal: RepPlayerDevelopmentGoal;
  editing: RepDevelopmentGoalReview | null;
  /** The player's reviews (any goal's — filtered here) — the cadence is read from this goal's. */
  reviews: readonly RepDevelopmentGoalReview[];
  linkedObservations: RepPlayerObservation[];
  busy: boolean;
  error: string;
  onSubmit: (v: { status: RepDevelopmentGoalStatus; reviewedOn: string; note: string; nextReviewOn: string | null; evidenceObservationIds: string[] }) => void;
  onClose: () => void;
  onRemove?: () => void;
}) {
  const today = todayLocal();
  const suggested = !editing ? nextReviewSuggestion(goal, reviews, today) : null;
  const initial = {
    status: editing?.status ?? goal.status,
    reviewedOn: editing?.reviewedOn ?? today,
    note: editing?.note ?? '',
    nextReviewOn: editing?.nextReviewOn ?? '',
  };
  const [status, setStatus] = useState(initial.status);
  const [reviewedOn, setReviewedOn] = useState(initial.reviewedOn);
  const [note, setNote] = useState(initial.note);
  const [nextReviewOn, setNextReviewOn] = useState(initial.nextReviewOn);
  const gap = suggested ? reviewGapWords(today, suggested) : null;

  // Typed work a Cancel, an X or Escape would throw away — asked once, never on Save. A changed
  // status or date alone is not typed work: the sheet re-opens on the same facts in one tap. In
  // edit mode "typed work" is anything that differs from the review as it stood on open.
  const dirty = editing
    ? status !== initial.status || reviewedOn !== initial.reviewedOn || note !== initial.note || nextReviewOn !== initial.nextReviewOn
    : note.trim().length > 0;
  const close = useDiscardGuard({ dirty, close: onClose, noun: 'review', detail: 'how it’s going' });

  return (
    <QuestionShell open onClose={close} ariaLabel={editing ? 'Edit the review' : 'Review the goal'}
      title={editing ? 'Edit review' : 'Review the goal'} subtitle={goal.focusArea} busy={busy}>
        <form className={`${styles.formBody} ${styles.formBodyTight}`} onSubmit={e => {
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
              {suggested && !nextReviewOn && (
                <span className={styles.formHint}>
                  <button type="button" className={styles.linkBtnAccent} onClick={() => setNextReviewOn(suggested)}>
                    {gap ?? 'Use the last gap'} · {formatShortDate(suggested)}
                  </button>
                  {' '}— the gap your last review set, if you want the same one.
                </span>
              )}
            </label>
          </div>
          <p className={styles.formHint}>
            {linkedObservations.length > 0
              ? `Evidence linked: ${linkedObservations.map(o => `the ${formatShortDate(o.observedOn)} observation`).join(', ')}. `
              : 'No observation is linked to this goal yet — record one from the goal and it becomes evidence. '}
            {editing ? 'This review is on the goal’s history.' : 'This review is added to the goal’s history.'}
          </p>
          {error && <p className={styles.errorText} role="alert">{error}</p>}
          <div className={styles.modalFooter}>
            {editing && onRemove && <SheetRemoveButton label="Remove review" busy={busy} onRemove={onRemove} />}
            <button type="button" className={styles.btnSecondary} disabled={busy} onClick={() => void close()}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? 'Saving…' : editing ? 'Save' : 'Save review'}</button>
          </div>
        </form>
    </QuestionShell>
  );
}
