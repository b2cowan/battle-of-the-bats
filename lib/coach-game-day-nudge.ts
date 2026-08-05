import 'server-only';
import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import { isInGameDayWindow, toGameDayEventShape } from './coach-game-day';
import { getRepTeamEventById } from './db';
import type { MastheadEvent, MastheadGameDayConsole } from './coach-masthead-status';

/**
 * Game-Day Mode (P1) — the masthead's console link, on the FEATURE side of the chrome seam.
 *
 * Same posture as `lib/coach-opponent-nudge.ts`, the shape this file deliberately copies: the
 * masthead module is generic chrome that imports no feature domain, so the dependency arrow
 * points console → masthead-shape (this file takes the feed's `MastheadEvent` as plain input),
 * never masthead → console. Returns without the `href`; the layout owns URLs.
 *
 * The feed's event shape carries no end time or arrival time — the two fields the live-window
 * arithmetic needs — so the full row is fetched here rather than widening the chrome's shape
 * for one feature. One extra read, only on a day the masthead already says "Game day".
 *
 * Absent (null) outside the live window, for cancelled games, and for non-game events — the
 * masthead line then stays plain text, an entry point that simply isn't there rather than a
 * door that scolds.
 */
export async function getGameDayConsoleForNextGame(
  next: MastheadEvent | null,
): Promise<Omit<MastheadGameDayConsole, 'href'> | null> {
  if (!next || !COACH_GAME_EVENT_TYPES.includes(next.eventType)) return null;
  const event = await getRepTeamEventById(next.id);
  if (!event) return null;
  return isInGameDayWindow(toGameDayEventShape(event), Date.now()) ? { eventId: event.id } : null;
}
