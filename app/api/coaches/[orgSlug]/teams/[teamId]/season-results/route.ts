import { NextResponse } from 'next/server';
import { resolveCoachHistoryReadFromRequest } from '@/lib/coach-team-read';
import { getRepTeamEvents } from '@/lib/db';
import { denyUnless, hasRecordAccess, canViewSchedule } from '@/lib/coach-capabilities';
import { tallyResults, WLT_CATEGORIES } from '@/lib/coach-season-record';
import { withObservability } from '@/lib/observability';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "Results" — ONE finished season's games, for its own closed-season page
 * (COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN §3.3, owner-approved 2026-08-18; the mockups are the spec).
 *
 * ⚠⚠ **A HISTORY ENDPOINT.** It may be handed a season by name, which is a decision, not a
 * convenience. The three questions `HISTORY_ENDPOINTS` demands, answered here as well as at the
 * list:
 *
 *   1. **Record or instrument? RECORD, and about as pure a one as exists.** A finished game's
 *      date, opponent and score are facts that happened; nothing here runs a tryout, moves money,
 *      messages a family or configures the team, and there is no write verb in this file at all.
 *      ⚠ It is deliberately NOT the schedule: the schedule is where a coach adds, edits, cancels
 *      and takes attendance, and pointing that at a closed year is the archive-as-a-place the
 *      owner deleted. This route answers one question — what happened — and offers no way to act
 *      on the answer.
 *   2. **Does the whole subtree carry the year? YES, because there is no subtree.** The shelf
 *      renders rows and no drill-ins: no row opens the game, the lineup, the attendance sheet or
 *      the scouting book. That is the same flattening the money shelf accepted, for the same
 *      reason — a record must not be an entrance to a live instrument — and this route cannot
 *      enforce it, so `coach-finished-season-surfaces.test.ts` holds the caller to it.
 *   3. **Could the coach tell which season they are reading? YES, STRUCTURALLY.** Its only
 *      year-passing caller is the closed-season page, which is a page about one named season and
 *      titles itself with that season's name.
 *
 * ⚠ **THE GATE IS THE SCHEDULE'S AS WELL AS THE RECORD'S.** A helper who turned up to run one
 * station holds neither, and the pair is what shuts the door — the same conjunction the practices
 * shelf beside it carries, and for the same reason: this is a second entry point to facts the
 * schedule read has always gated.
 *
 * ⚠ **THE RECORD IS TALLIED BY THE SHARED DEFINITION** (`lib/coach-season-record.ts`). A season
 * must not add up differently depending on which screen asked — that convention was a comment
 * until it became a real defect, and it is shared code now precisely so a fourth surface cannot
 * re-derive it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * ⚠ **NO SILENT CAP** — the lesson the practices shelf paid for. A list headed "Results" that
 * stops short tells a coach their season held fewer games than it did. The read asks for one MORE
 * row than it shows so a full page can be told from a truncated one, and the page says which.
 */
const MAX_ROWS = 300;

/** The event types that can carry a result — the same three the shared record definition names. */
const GAME_TYPES = new Set<string>(WLT_CATEGORIES.map(c => c.key));

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  // The year goes THROUGH the resolver, never around it — resolving it separately is how a route
  // ends up running its access check against the team rather than against the requested season.
  const resolved = await resolveCoachHistoryReadFromRequest(req, orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { programYear, capabilities, isReadOnly } = resolved;

  const denied = denyUnless(
    hasRecordAccess(capabilities) && canViewSchedule(capabilities),
    'You do not have access to this season’s results.',
  );
  if (denied) return denied;

  const all = await getRepTeamEvents(programYear.id);

  /**
   * ⚠ **A CANCELLED GAME DID NOT HAPPEN.** It keeps its row, its opponent and sometimes even a
   * score typed before it was called off — so filtering on the event type alone would put a game
   * nobody played into the season's record. Same rule the practices shelf enforces one shelf up,
   * stated here because this route reads events directly rather than through a shared helper that
   * already holds it.
   *
   * ⚠ **AND A GAME WITH NO RESULT IS NOT A RESULT.** Late-season fixtures nobody got round to
   * scoring are real events but empty rows here; the shelf is headed "Results", and listing a
   * blank against an opponent reads as a nil-nil draw that never took place.
   */
  const games = all
    .filter(e => GAME_TYPES.has(e.eventType) && e.status !== 'cancelled' && e.result !== null)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const truncated = games.length > MAX_ROWS;
  const shown = games.slice(0, MAX_ROWS);

  return NextResponse.json({
    season: { programYearId: programYear.id, name: programYear.name, isReadOnly },
    truncated,
    /**
     * ⚠ Tallied over EVERY decided game, not over the truncated page — a record computed from the
     * rows that happened to fit is a different season's record.
     *
     * ⚠ And tallied over all three game types, deliberately unlike Insights: the coach's
     * scrimmages-count-or-not preference lives in their browser (`wltStorageKey`), and a server
     * that guessed at it would print one record here and a different one on the screen next door.
     * The shelf shows the count of games it is listing; the SEASON'S headline record stays where
     * the coach set that preference.
     */
    tally: tallyResults(games),
    games: shown.map(e => ({
      eventId: e.id,
      startsAt: e.startsAt,
      eventType: e.eventType,
      name: e.name || 'Game',
      opponent: e.opponent,
      homeAway: e.homeAway,
      teamScore: e.teamScore,
      opponentScore: e.opponentScore,
      result: e.result,
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/season-results' });
