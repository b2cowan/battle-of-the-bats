/**
 * Which of the attendance report's states is on screen — the whole decision, as one pure
 * function.
 *
 * ⚠ WHY THIS IS NOT INLINE IN THE PAGE. The screen this serves was reported for showing three
 * "nothing here" blocks at once, because three regions each decided independently that they had
 * nothing to show. The fix was to make it ONE decision — and a decision that matters that much
 * should be executable by a test, not re-read by the next person. The `/review` of 2026-08-15
 * then found a real defect in the first version of exactly this logic (see `settled` below),
 * which is the argument settled: this is pinned by `tests/unit/coach-attendance-view.test.ts`.
 *
 * The page renders four things and nothing else:
 *   'loading' → skeletons only. Makes no claim.
 *   'error'   → the failure, said plainly. Never dressed up as "nothing here".
 *   'solo'    → ONE empty state, and it is the only thing on the page.
 *   'report'  → the shortcut card (live seasons only), the table, and the folded methodology.
 */

export interface AttendanceViewInput {
  /** The season report fetch is still in flight. */
  loading: boolean;
  /** The season report fetch failed. */
  error: boolean;
  /** How many active roster players came back. */
  rowCount: number;
  /** At least one player has a definite present/absent signal this season. */
  hasAnyData: boolean;
  /** The events lookup (for the "Take attendance" shortcut) is still in flight. */
  markTargetLoading: boolean;
  /** The events lookup failed — we do NOT know whether the schedule is empty. */
  markTargetFailed: boolean;
  /** An attendance-eligible event was found. */
  hasMarkTarget: boolean;
}

export type AttendanceViewState = 'loading' | 'error' | 'solo' | 'report';

export interface AttendanceView {
  state: AttendanceViewState;
  /** Which empty state, when `state === 'solo'`. */
  soloKind: 'no-roster' | 'no-schedule' | null;
  /** The "Nothing recorded yet" caption belongs above the dashed table. */
  showNothingYetNote: boolean;
}

export function resolveAttendanceView(i: AttendanceViewInput): AttendanceView {
  // An error outranks everything: a failed load must never be reported as "nothing here".
  if (i.error) return { state: 'error', soloKind: null, showNothingYetNote: false };

  /**
   * ⚠⚠ BOTH LOOKUPS, AND IT GATES THE RENDER — NOT JUST THE BRANCH VALUE.
   *
   * The first version of this guarded only the empty-state DECISION on both fetches, and let
   * the report branch paint real content off the roster fetch alone. A team with players and an
   * empty schedule, whose report happened to land first, drew the whole table — every name, a
   * column of dashes, the caption and the disclosure — and then had it yanked away and replaced
   * by the lone empty card when the events lookup came back. Whichever fetch won the race
   * decided whether the coach saw a clean settle or a table that appeared and vanished.
   *
   * That is the confident-answer-before-we-looked pattern this page already had one guard
   * against, displaced onto the whole page. The rule, stated once: **a skeleton may render
   * before we know; anything that makes a claim may not.**
   */
  if (i.loading || i.markTargetLoading) {
    return { state: 'loading', soloKind: null, showNothingYetNote: false };
  }

  // ⚠ A FAILED events lookup is not an empty schedule. We do not know, so we do not say —
  // the report still stands on its own, it just loses the shortcut.
  const scheduleIsEmpty = !i.markTargetFailed && !i.hasMarkTarget;

  // Nobody to take a register of. This wins over the schedule question: with no players there
  // is nothing to show whether or not games exist.
  if (i.rowCount === 0) return { state: 'solo', soloKind: 'no-roster', showNothingYetNote: false };

  /**
   * ⚠ `!hasAnyData` is load-bearing. Attendance rows outlive the events that produced them —
   * delete a game and its figures remain — so an empty schedule alone must never hide a
   * coach's real numbers behind "nothing to take attendance for yet".
   */
  if (scheduleIsEmpty && !i.hasAnyData) {
    return { state: 'solo', soloKind: 'no-schedule', showNothingYetNote: false };
  }

  // The report. The caption appears only while every figure is still a dash — it is what
  // replaced the second empty state, and it must not linger once real numbers arrive.
  return { state: 'report', soloKind: null, showNothingYetNote: !i.hasAnyData };
}
