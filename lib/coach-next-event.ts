/**
 * The Overview's NEXT EVENT — the first scheduled event whose window has not closed (practices
 * re-evaluation stage 6, owner ruling R7, 2026-09-18).
 *
 * "Next" used to mean "the first start still ahead", so twenty minutes into tonight's practice the
 * Overview's one card looked past it to next week ("In 7 days") while the Practice plans card one
 * click away read "Today · 8:49 p.m. · Run practice" from the run window — three screens, three
 * answers to "is there a practice on?". The fix is not a new window: a practice in progress is
 * next while `isInRunWindow` still holds (three hours after its end), a game while
 * `isInGameDayWindow` holds (the console's own window), and anything else while its start is
 * still ahead. Both windows are the ones every door already reads — a second copy of either here
 * would be the drift the practice-state module exists to remove.
 *
 * ⚠ Named blast radius: a GAME in progress becomes "next" through the same rule, so the Overview's
 * bench-console door (`gameDayOpen`) now stays offered through the game rather than vanishing at
 * first pitch. The console's own face is not redrawn by this; only the pick changes.
 *
 * Pure, so the page's read stays testable at the size that matters (`coach-overview.test.ts`).
 */
import { isInGameDayWindow, toGameDayEventShape } from './coach-game-day';
import { isInRunWindow } from './practice-state';

/** The fields the pick reads — all on `RepTeamEvent`. */
export type NextEventShape = {
  eventType: string;
  status: string;
  startsAt: string;
  endsAt?: string | null;
  arrivalTime?: string | null;
};

/** Has this event's window shut — is it behind the coach? A start still ahead is never shut. */
export function eventWindowOpen(e: NextEventShape, nowMs: number): boolean {
  if (new Date(e.startsAt).getTime() >= nowMs) return true;
  if (e.eventType === 'practice') return isInRunWindow(e.startsAt, nowMs, e.endsAt);
  return isInGameDayWindow(toGameDayEventShape(e), nowMs);
}

/**
 * The scheduled event whose window has not closed and which is ON — or, with nothing on, the next
 * to start. Null when nothing is ahead.
 *
 * ⚠ Among events already STARTED the most RECENTLY started wins, not the earliest (/review,
 * 2026-09-18): a tournament day's 9 a.m. game lingers in its window until 1 p.m., and picking the
 * earliest open window at 11:30 would hand the Overview a game that finished ninety minutes ago
 * over the one in progress. The same rule puts tonight's 7:30 practice ahead of a 7:20 game that
 * shares the evening. Among events still to start, the earliest — that IS "next".
 */
export function nextOpenEvent<E extends NextEventShape>(events: readonly E[], nowMs: number): E | null {
  const open = events.filter(e => e.status === 'scheduled' && eventWindowOpen(e, nowMs));
  const startMs = (e: E) => new Date(e.startsAt).getTime();
  const started = open.filter(e => startMs(e) <= nowMs).sort((a, b) => startMs(b) - startMs(a));
  if (started.length > 0) return started[0];
  return open.sort((a, b) => startMs(a) - startMs(b))[0] ?? null;
}
