/**
 * The removal's day rules (Club Website Track P, Session P4; owner ruling T11, 2026-11-25; the nightly job and the overdue
 * line ruled by the owner 2026-11-26). Pure: the database's `remove_due_preview` (mig 547) re-checks the same day rule
 * under the claim's locks, so this file only decides what to ASK for and what Today says.
 *
 * The removal day is the meeting's day plus 30 (`removalDay`, never stored: moving the meeting moves it). The nightly run
 * (mig 548, about 3 a.m. Toronto) removes every unclaimed preview whose removal day has come. So a meeting on Tue, Dec 8
 * comes down early on Thu, Jan 7 — the day the room window, the email and the ended page all name.
 */
import { removalDay } from './prospect-clubs';
import { addCalendarDays, tournamentNow, tournamentToday } from './timezone';

export type OpenPreview = { meetingAt: string; claimedAt: string | null; removedAt: string | null };

/** Still a live preview: neither claimed nor removed. */
function isOpen(p: OpenPreview): boolean {
  return !p.claimedAt && !p.removedAt;
}

/** Has this preview's removal day come (in the club's zone)? */
export function isDueForRemoval(meetingAt: string, now: Date = new Date()): boolean {
  return removalDay(meetingAt) <= tournamentToday(now);
}

/**
 * The hour (club's zone) after which a preview still up on its removal day is OVERDUE: the run is scheduled for about
 * 3 a.m. (4 a.m. in summer time), so by 6 a.m. it has had its chance. Before then, today's removals are not yet late.
 */
const OVERDUE_FROM_HOUR = 6;

/** Today's two counts: removed tomorrow (the drawn line), and overdue (a missed or refused removal; owner 2026-11-26). */
export function removalQueueCounts(previews: readonly OpenPreview[], now: Date = new Date()): { tomorrow: number; overdue: number } {
  const today = tournamentToday(now);
  const tomorrow = addCalendarDays(today, 1);
  const hour = Number(tournamentNow(now).time.slice(0, 2));
  let t = 0;
  let o = 0;
  for (const p of previews) {
    if (!isOpen(p)) continue;
    const day = removalDay(p.meetingAt);
    if (day === tomorrow) t++;
    else if (day < today || (day === today && hour >= OVERDUE_FROM_HOUR)) o++;
  }
  return { tomorrow: t, overdue: o };
}

/** Today's rows (owner only, Growth, opening Prospect clubs). */
export const REMOVAL_QUEUE_WORDS = {
  tomorrow: {
    label: 'Removed tomorrow',
    why: 'A preview that removes itself tomorrow, 30 days after its meeting',
    clearLabel: 'removed tomorrow',
  },
  overdue: {
    label: 'Removal overdue',
    why: 'A preview still up after its removal day. Remove it in Prospect clubs.',
    clearLabel: 'removal overdue',
  },
} as const;
