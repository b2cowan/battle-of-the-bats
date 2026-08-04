import 'server-only';
import { calendarDaysBetween } from './timezone';
import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import {
  normalizeOpponentName, hasBookContent, pickPracticeWeekOpponentGame,
} from './coach-opponents';
import {
  getRepTeamOpponentByKey, countRepTeamOpponentObservationsForOpponent,
  getRepTeamEvents, getRepTeamOpponentObservations,
} from './db';
import type { MastheadEvent, MastheadScoutingNudge } from './coach-masthead-status';

/**
 * The game-week scouting nudge (Scouting Book P2): when the masthead feed's next event is
 * a GAME inside the coming week whose opponent has observations in the book, hand the
 * masthead one quiet line's worth of facts. Everything else — dismissal (once per game,
 * on-device), the sentence, the link — is the client's.
 *
 * Lives on the FEATURE side, not in lib/coach-masthead: the masthead module is generic
 * chrome every team page depends on, and its one structural rule is that it imports no
 * feature domain. The dependency arrow points book → masthead-shape (this file takes the
 * feed's `MastheadEvent` as plain input), never masthead → book — the next feature that
 * wants a quiet line under the bar should copy THIS shape, not extend the feed.
 *
 * Rides the feed's own posture: only ever computed for the ACTIVE season (the caller
 * passes the feed's `next`, which a closed-only team never has), reads the same
 * schedule-capability-gated data the book's own routes serve, and fails soft — a blip
 * costs the nudge, never the page. Returns null without the `href`; the layout owns URLs.
 */
export async function getScoutingNudgeForNextGame(
  teamId: string, next: MastheadEvent | null,
): Promise<Omit<MastheadScoutingNudge, 'href'> | null> {
  if (!next?.opponent || !COACH_GAME_EVENT_TYPES.includes(next.eventType)) return null;
  // Calendar days in the ORG's zone, matching the status line's own "this week" window.
  const daysAway = calendarDaysBetween(new Date(), new Date(next.startsAt));
  if (daysAway < 0 || daysAway > 6) return null;
  try {
    const key = normalizeOpponentName(next.opponent);
    if (!key) return null;
    const opponent = await getRepTeamOpponentByKey(teamId, key);
    if (!opponent) return null;
    const observationCount = await countRepTeamOpponentObservationsForOpponent(teamId, opponent.id);
    // "Absent when the book is empty": the line quotes an observation count, so a book-line-only
    // entry stays quiet rather than announcing "0 observations".
    if (observationCount < 1) return null;
    return { eventId: next.id, opponentName: next.opponent, observationCount };
  } catch {
    return null;
  }
}

/** What the practice-plan screen shows of the book — one glance, one link, never the editor. */
export interface PracticeWeekScoutingBridge {
  /** The game this practice prepares for. */
  eventId: string;
  opponentName: string;
  /** The OWNING book entry's key (aliases resolved) — the "full book ›" URL segment. */
  opponentKey: string;
  gameStartsAt: string;
  summary: string | null;
  latestObservation: { body: string; tag: string | null; createdByName: string | null } | null;
  observationCount: number;
}

/**
 * The practice-week bridge (Scouting Book P3, plan §4.9): when a practice is being built in
 * a week containing a booked opponent's game AND that opponent's book has content, hand the
 * planner one quiet panel's worth of facts — book line + freshest observation + the link.
 * Saturday's "they bunt the first strike" becomes Tuesday's bunt-defense block.
 *
 * Same posture as the masthead nudge above, same reasons: live season only (the caller's
 * practice-plan route resolves the ACTIVE year, so an archived plan's read-only door never
 * reaches this), the same schedule-capability-gated data the book's own routes serve, and
 * fails soft — a blip costs the panel, never the plan screen.
 *
 * ⚠ Alias-aware BY ROUTE, not by accident: the game's own spelling normalizes to whatever
 * the coach typed, and `getRepTeamOpponentByKey` follows the alias map to the owning entry —
 * a game against "Thunder 12U" still finds the Oakville Thunder book, and the returned
 * `opponentKey` is the OWNER's, so the link lands on the merged card.
 */
export async function getScoutingBridgeForPractice(
  teamId: string, programYearId: string, practiceStartsAt: string,
): Promise<PracticeWeekScoutingBridge | null> {
  try {
    // Coarse fetch bound (8 real days); the 6 ORG-calendar-day game-week rule is the pure
    // picker's, applied with the same day arithmetic the masthead nudge counts in.
    const windowEnd = new Date(Date.parse(practiceStartsAt) + 8 * 24 * 3600 * 1000).toISOString();
    const events = await getRepTeamEvents(programYearId, { from: practiceStartsAt, to: windowEnd });
    const game = pickPracticeWeekOpponentGame(practiceStartsAt, events, calendarDaysBetween);
    if (!game?.opponent) return null;

    const opponent = await getRepTeamOpponentByKey(teamId, normalizeOpponentName(game.opponent));
    if (!opponent) return null;
    // The panel shows ONE observation and a count — fetch exactly that, never the whole log.
    const [[latest = null], observationCount] = await Promise.all([
      getRepTeamOpponentObservations(teamId, opponent.id, { limit: 1 }),
      countRepTeamOpponentObservationsForOpponent(teamId, opponent.id),
    ]);
    // "Absent when the book is empty" — a minted-but-blank entry stays quiet.
    if (!hasBookContent({ summary: opponent.summary, observationCount })) return null;
    return {
      eventId: game.id,
      opponentName: game.opponent,
      opponentKey: opponent.normalizedName,
      gameStartsAt: game.startsAt,
      summary: opponent.summary,
      latestObservation: latest
        ? { body: latest.body, tag: latest.tag, createdByName: latest.createdByName }
        : null,
      observationCount,
    };
  } catch {
    return null;
  }
}
