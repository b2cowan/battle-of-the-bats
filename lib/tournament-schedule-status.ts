/**
 * lib/tournament-schedule-status.ts
 *
 * The words the tournament SCHEDULE calls a game's state — used by the screen's status filter and
 * by the printed schedule, so the two can never disagree about what a game is called. Same pattern
 * and same reason as `lib/tournament-phase-display.ts`.
 *
 * ⚠ SCOPE, honestly stated: this is the schedule's vocabulary, NOT a canonical map for every
 * surface. The public game page and the bracket resolve `submitted` to **Unofficial** or **Final**
 * depending on whether the event requires finalization, and the scorekeeper and standings have
 * their own rules again. Those are different questions with different answers, and merging them
 * into this map would be wrong rather than tidy. Widening this is its own piece of work.
 */

/** The three states the schedule screen lets an organizer filter by, in filter-row order. */
export const SCHEDULE_STATUS_ORDER = ['scheduled', 'cancelled', 'completed'] as const;

export type ScheduleStatusFilter = (typeof SCHEDULE_STATUS_ORDER)[number];

/**
 * What a game's stored state is CALLED on this screen and on its printed copy.
 *
 * ⚠ WIDER THAN THE FILTER ROW ON PURPOSE. `GameStatus` carries `submitted` and `forfeit` as well,
 * and they DO reach the paper: the status filter passes everything when a coordinator switches all
 * three chips off, so a game awaiting a score review would otherwise print a word the screen never
 * uses. The screen's own badge says "Pending review" for a submitted score (/review, 2026-08-25).
 *
 * ⚠ The screen can say more than the paper for one sub-case: a submitted score that arrived as a
 * FORFEIT reads "Forfeit — pending" there, because the screen has the submission source and a
 * printed schedule row does not. "Pending review" is the honest shared word, not a wrong one.
 */
export const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  cancelled: 'Cancelled',
  completed: 'Final',
  submitted: 'Pending review',
  forfeit:   'Forfeit',
};

/**
 * What to call a stored status on a schedule.
 *
 * ⚠ An unrecognised status is sentence-cased rather than dropped or passed through raw. A state
 * added later must not leak a lower-case database word onto a printed page: the worst this can do
 * is print a new state's own name with a capital letter.
 */
export function scheduleStatusWord(status: string): string {
  const known = SCHEDULE_STATUS_LABELS[status];
  if (known) return known;
  const s = status.replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
