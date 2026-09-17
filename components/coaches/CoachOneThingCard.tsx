'use client';
import type { ReactNode } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { CoachCard } from '@/components/coaches/kit';

/**
 * The coach portal's "one thing" card — ONE shape for the one situation a screen puts first.
 *
 * Born on the Overview (chunk I, "The One Thing", owner 2026-08-12): a kicker with the WHEN on its
 * right, the headline with the screen's one lime ON its row, the meta with the quiet answers ON
 * its row — instead of each claiming a stacked row of its own (that was a HEIGHT fix: the old
 * card was a third of a phone viewport). The Practice plans hub's next-practice card (practices
 * re-evaluation stage 0, D1, 2026-09-14) is the same card on a second screen, so the shell moved
 * here — a shared CLASS would only have stopped the styling drifting; the markup is the half that
 * drifts (memory: shared-component-beats-shared-class).
 *
 * ⚠ The shell owns the ARRANGEMENT and nothing else. The caller decides what the primary is (a
 * `Link` or a `button`, lime by the shipped `btn btn-lime` language + `onePrimary`), what the
 * answers are (links, dismiss buttons, a tour opener) and what extra rows follow (the Overview's
 * scoreline, prep chips, arm-care line) — those are the screen's, not the card's. A `null` primary
 * is deliberate and means informational: the card keeps its sentence and drops its button, never
 * a disabled control.
 *
 * ⚠ The accent is driven by `kind` ALONE (see the `.oneThing[data-kind]` rules) — `shape` is a
 * pure function of `kind` in the Overview's resolver and is passed through for the same
 * `data-shape` hook the page always had.
 */
export default function CoachOneThingCard({
  kind,
  shape,
  tone,
  kicker,
  when,
  headline,
  primary,
  meta,
  answers,
  children,
}: {
  /** Which situation this is — `data-kind`, the one axis the accent colour reads. */
  kind: string;
  shape?: string;
  /** The kicker's colour register — `work` (default) · `live` · `decide`. */
  tone?: 'work' | 'live' | 'decide';
  kicker: ReactNode;
  /** "Today" · "Tomorrow" · "In 6 days" — right-aligned on the kicker's row; `null` for none. */
  when?: ReactNode | null;
  headline: ReactNode;
  /** The screen's one lime, already dressed by the caller; `null`/`false` renders no button. */
  primary?: ReactNode;
  meta?: ReactNode | null;
  /** The quiet answers — rendered on the meta's row, inside the shared `.oneAnswers` group. */
  answers?: ReactNode | null;
  /** Extra rows under the meta row — the caller's own (scoreline, chips). */
  children?: ReactNode;
}) {
  return (
    <CoachCard accent className={styles.oneThing} data-shape={shape} data-kind={kind}>
      <p className={styles.oneKicker} data-t={tone}>
        {kicker}
        {when && <span className={styles.oneKickerWhen}>{when}</span>}
      </p>
      <div className={styles.oneHeadRow}>
        <p className={styles.oneHeadline}>{headline}</p>
        {primary}
      </div>
      {(meta || answers) && (
        <div className={styles.oneMetaRow}>
          {meta && <p className={styles.oneMeta}>{meta}</p>}
          {answers && <div className={styles.oneAnswers}>{answers}</div>}
        </div>
      )}
      {children}
    </CoachCard>
  );
}
