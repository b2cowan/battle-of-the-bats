'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * ‹ range › — the way sideways through a grid with more columns than the screen.
 *
 * ⚖ ONE CONTROL, TWO GRIDS (owner G3, 2026-09-04). Budget vs. Actual's month window built this
 * first (owner call 2026-08-21: it sits IN the view strip beside View and Showing, and it moves
 * ONE column per press so › then ‹ lands where you started). The By-installment dues grid needed
 * the same answer to the same question, and a second hand-rolled pager per panel is how the
 * budget/bva header CSS forked before — so the control moved here and both grids read it.
 *
 * ⚠ THE RANGE IS NAMED, and it is not decoration. On the month grid `Total` is the WHOLE SEASON,
 * never the visible twelve, so a reader adding up what they can see has to be told why it does
 * not match. On the dues grid the pinned Due next / Balance columns are the whole season for the
 * same reason. The caller writes the sentence; this only draws it.
 *
 * `disabled` on either arrow is the caller's fact (first / last column already in view). The
 * `aria-label`s name the unit — "month", "installment" — so a screen reader hears what a press
 * moves, not "previous".
 */
export default function ColumnPager({
  range,
  unit,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: {
  /** The visible window, already worded — e.g. `<strong>Oct – Sep</strong> · of 14 months`. */
  range: React.ReactNode;
  /** The noun a press moves by: "month", "installment". */
  unit: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
}) {
  return (
    <div className={styles.colPager}>
      <button
        type="button"
        className={styles.colPagerBtn}
        onClick={onPrev}
        disabled={prevDisabled}
        aria-label={`Show the previous ${unit}`}
      >
        <ChevronLeft size={15} aria-hidden />
      </button>
      <span className={styles.colPagerRange}>{range}</span>
      <button
        type="button"
        className={styles.colPagerBtn}
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={`Show the next ${unit}`}
      >
        <ChevronRight size={15} aria-hidden />
      </button>
    </div>
  );
}
