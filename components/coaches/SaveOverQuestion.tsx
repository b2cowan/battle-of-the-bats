'use client';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './SaveOverQuestion.module.css';

/**
 * SAVE OVER — the "are you sure" every library save asks before it overwrites one you have: the
 * lineup builder's Save as template (D13–D15) and the practice page's Save as template, Save to my
 * drills and Save to my circuits (COACH_PRACTICE_SAVE_OVER_PLAN.md, D1, 2026-10-02).
 *
 * ⚖ A SECOND VIEW INSIDE THE WINDOW, NEVER A POP-UP. A confirm dialog opened from a window is what
 * used to close the lineup's old Templates drawer behind it (Mobile plan §13.6 #5). The caller swaps
 * its form for this, owns the Back step (`useBackStep`) and supplies the window around it.
 *
 * ⚖ It NAMES what changes — Now / After — because overwriting is the one thing here no Undo takes
 * back; the confirm is the portal's red button and "Keep it" returns to the form.
 *
 * Renders a FRAGMENT: its pieces become items of the caller's own column, so each window keeps its
 * own rhythm (the lineup's tight 0.45rem, the practice dialogs' 0.7rem).
 */
export default function SaveOverQuestion({
  question, sub, now, after, children, warning = 'This can’t be undone.',
  confirmLabel, busyLabel, busy, error, onConfirm, onBack,
}: {
  question: string;
  /** What the saved one takes from this one, in a line. */
  sub: string;
  now: ReactNode;
  after: ReactNode;
  /** Anything the question must also say — what else the save reaches, or what it does not. */
  children?: ReactNode;
  warning?: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  error?: string;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <button type="button" className={styles.back} onClick={onBack} disabled={busy}>
        <ChevronLeft size={17} aria-hidden /> Back
      </button>
      <div className={styles.question}>
        <strong>{question}</strong>
        <span>{sub}</span>
      </div>
      <dl className={styles.facts}>
        <dt>Now</dt><dd>{now}</dd>
        <dt>After</dt><dd>{after}</dd>
      </dl>
      {children}
      <p className={styles.warn}>{warning}</p>
      <div className={styles.actions}>
        <button type="button" className={shared.btnDanger} disabled={busy} onClick={onConfirm}>
          {busy ? busyLabel : confirmLabel}
        </button>
        <button type="button" className={shared.btnSecondary} disabled={busy} onClick={onBack}>Keep it</button>
      </div>
      {error && <p className={shared.errorText} role="alert">{error}</p>}
    </>
  );
}

/**
 * "Your templates · tap one to replace it" — the head and the scrolling well under a save window's
 * field. The rows are the caller's (`CoachRowList inset`); `bleedClassName` takes the well out to the
 * window's own edges, which differ by window.
 */
export function SaveOverList({ label, bleedClassName, children }: { label: string; bleedClassName?: string; children: ReactNode }) {
  return (
    <>
      <p className={styles.listHead}>{label}</p>
      <div className={`${styles.list}${bleedClassName ? ` ${bleedClassName}` : ''}`}>{children}</div>
    </>
  );
}

/** "You already have a … called this. Saving replaces it." — the line under a name that matches. */
export function SaveOverMatchLine({ children }: { children: ReactNode }) {
  return <p className={styles.warn}>{children}</p>;
}
