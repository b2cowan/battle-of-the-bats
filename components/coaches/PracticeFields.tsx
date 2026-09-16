'use client';
import { X } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The two field pieces the practice editor, the station modal and the drill library's editor
 * share (practices re-evaluation stage 3, owner ruling D7, 2026-09-15 — stage 2's D10 finished):
 * a field's small-caps label, and Coaching points as ONE field, one point per line.
 *
 * Three surfaces, one recipe. The block took the single field at stage 2 while the station and the
 * drill editor kept numbered rows "for one stage" — two shapes for one idea. This is the one shape,
 * moved out of the plan editor so the drill library can read it without importing the editor.
 */

export function FieldLabel({ children, onRemove, removeLabel }: {
  children: React.ReactNode;
  /** A quiet "×" beside the label, in the row instead of a line of its own (owner ask,
   *  2026-09-15) — only for a field that is itself an addition the coach opened; it closes the
   *  door, it never deletes data, so it is only ever passed while the field holds nothing. */
  onRemove?: () => void;
  removeLabel?: string;
}) {
  if (!onRemove) return <span className={styles.ppFieldLabel}>{children}</span>;
  return (
    <span className={styles.ppFieldLabelRow}>
      <span className={styles.ppFieldLabel}>{children}</span>
      <button type="button" className={styles.ppIconBtn} aria-label={removeLabel ?? 'Remove'} onClick={onRemove}>
        <X size={13} />
      </button>
    </span>
  );
}

/** One line of text → the stored list: one point per line, capped as the sanitiser caps it, so
 *  what the coach sees typing is what saves. Windows line ends are tolerated. Empty → no points. */
export function splitPoints(text: string, maxPoints: number, maxLen: number): string[] {
  if (text === '') return [];
  return text.split(/\r?\n/).slice(0, maxPoints).map(line => line.slice(0, maxLen));
}

/**
 * ⚠ The label is "Coaching points", NOT "What to watch for" (owner ruling 2026-08-01). The old
 * label collided with the field screen's "What you're watching for", which is the GOAL — two
 * different fields with near-identical names, one screen apart. One name per idea.
 *
 * ONE field, one point per line (stage 2 D10 on the block; stage 3 D7 on the station and in the
 * drill library). The numbered rows — an input, a number, a remove button and an add link per
 * point — were a form inside the form and most of what an open card's height was; the field screen
 * and the sheet already print the points as a list. Stored exactly as before (a list, capped, each
 * line capped): the split happens at patch time and the sanitiser is unchanged.
 */
export function CoachingPointsField({
  points, readOnly, autoFocus, onSet, onRemove, removeLabel, maxPoints, maxLen, noun,
}: {
  points?: string[];
  readOnly?: boolean;
  autoFocus?: boolean;
  onSet: (next: string[]) => void;
  onRemove?: () => void;
  removeLabel?: string;
  /** The caller's own caps — the plan's and the drill library's happen to agree today, and each
   *  keeps naming its own so a change to one cannot silently move the other. */
  maxPoints: number;
  maxLen: number;
  /** The noun the cap hint names — "block", "station", "drill". */
  noun: string;
}) {
  const current = points ?? [];
  return (
    /* ⚠ A `<div>`, not the usual `<label>` wrapper (owner catch, 2026-09-15): a native `<label>`
       with TWO labelable children (this field's remove button, plus the textarea) forwards a click
       ANYWHERE inside it, including one that lands on the textarea, to its first labelable
       descendant — the button — so typing a click into the textarea closed the field instead of
       focusing it. `aria-label` replaces the accessible name the implicit association gave. */
    <div className={styles.ppField}>
      <FieldLabel onRemove={onRemove} removeLabel={removeLabel}>Coaching points</FieldLabel>
      <textarea className={styles.textarea} rows={Math.max(2, current.length)} value={current.join('\n')}
        disabled={readOnly} autoFocus={autoFocus} aria-label="Coaching points"
        maxLength={maxPoints * (maxLen + 1)}
        placeholder="One per line — the two or three things you want to see"
        onChange={e => onSet(splitPoints(e.target.value, maxPoints, maxLen))} />
      {/* At the cap, Enter simply stops doing anything — `splitPoints` drops a line past the cap
          silently, and the textarea's own `maxLength` is a character ceiling, not a line one, so
          it never engages first. The row-numbered predecessor disabled its own "Add a point" at the
          same cap; a single textarea has no such button, so the explanation lives here (/review,
          2026-09-15). */}
      {!readOnly && current.length >= maxPoints && (
        <span className={styles.formHint}>
          That&apos;s the most you can keep on one {noun} ({maxPoints}) — remove a line to add another.
        </span>
      )}
    </div>
  );
}
