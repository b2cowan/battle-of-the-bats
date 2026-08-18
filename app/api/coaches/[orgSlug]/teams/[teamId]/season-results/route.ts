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

  /**
   * ⚠⚠ **THE SUMMARY IS COMPUTED OVER EVERY DECIDED GAME, NEVER OVER THE PAGE OF ROWS BELOW IT.**
   * This is the whole reason it is here rather than in the browser: the row list is capped, and a
   * record derived from the rows that happened to fit is a different season's record. It would also
   * be wrong in the direction nobody checks — quietly a few games short, on a page a coach opens
   * once a year to find out how the season went.
   */
  const of = (t: string) => games.filter(g => g.eventType === t);
  /**
   * ⚠ **ONLY GAMES THAT CARRY BOTH NUMBERS.** A result can be recorded with no score at all — a
   * coach who logged a W on the drive home and never went back — and treating that absence as a
   * nil-nil would quietly drag the season's scoring down by a game nobody mis-recorded. The count
   * rides out beside the totals so the page can say what they are drawn from.
   */
  const withScores = games.filter(g => g.teamScore != null && g.opponentScore != null);
  const scored = withScores.reduce((s, g) => s + (g.teamScore ?? 0), 0);
  const allowed = withScores.reduce((s, g) => s + (g.opponentScore ?? 0), 0);

  return NextResponse.json({
    season: { programYearId: programYear.id, name: programYear.name, isReadOnly },
    truncated,
    /**
     * The answer a coach opens this shelf for, so they never have to read the list to get it.
     *
     * ⚠ **BY COMPETITION, because that is the question "how did we do?" actually means.** A league
     * record and a tournament record are different claims about a team, and the flat list mixed
     * them into one number.
     *
     * ⚠ It is the three types the RECORD counts, and nothing else. An `external_tournament` row is
     * the container for a weekend rather than a game, and never enters `games` at all — so this
     * split is exhaustive of what is HERE, not of everything tournament-shaped. (An earlier version
     * of this comment said those rows were folded in with tournament games. They are not —
     * corrected by `/review`, 2026-08-18.)
     *
     * ⚠ Unlike the practices route beside it, this summary really is the whole season:
     * `getRepTeamEvents` applies no limit, so nothing here is capped.
     */
    summary: {
      /**
       * The season's record, and the ONLY copy of it. It used to ride out a second time as a
       * sibling `tally` field with its own client state — two summaries of one array that had to
       * agree forever, with nothing tying them together (`/simplify`, 2026-08-18).
       */
      /**
       * ⚠ Tallied over EVERY decided game, not over the truncated page — a record computed from
       * the rows that happened to fit is a different season's record.
       *
       * ⚠ And over all three game types, deliberately unlike Insights: the coach's
       * scrimmages-count-or-not preference lives in their browser (`wltStorageKey`), and a server
       * that guessed at it would print one record here and a different one on the screen next
       * door. The split below is what lets a coach see the scrimmages separately instead.
       */
      overall: tallyResults(games),
      /**
       * ⚠ **DERIVED FROM `WLT_CATEGORIES`, NOT HAND-LISTED** (`/simplify`, 2026-08-18). This was
       * three literal keys, while the page's own label lookup read the shared list — which is
       * exactly the "convention two files must agree by hand" that `lib/coach-season-record.ts`
       * exists to end, recreated one file away from it. Adding a category there now reaches this
       * split for free, and the split can no longer name a competition the record does not count.
       */
      byType: WLT_CATEGORIES
        .map(c => ({ type: c.key, tally: tallyResults(of(c.key)) }))
        /** A season that never scrimmaged shows two lines, not three with a 0–0. */
        .filter(r => r.tally.w + r.tally.l + r.tally.t > 0),
      home: tallyResults(games.filter(g => g.homeAway === 'home')),
      away: tallyResults(games.filter(g => g.homeAway === 'away')),
      /**
       * ⚠⚠ **HOW MANY GAMES THE HOME/AWAY PAIR ACTUALLY COVERS** (`/review`, 2026-08-18). A game
       * can be at a NEUTRAL site, or have no side recorded at all, and those fall into neither
       * bucket — so a tournament-heavy season could print "Home 6–2 · Away 4–3" while five of its
       * twenty games were in neither number, with nothing on screen saying so. The scoring line one
       * clause later already discloses exactly this kind of gap; this is the fact that lets the
       * home/away line do the same instead of implying a completeness it does not have.
       */
      homeAwayKnown: games.filter(g => g.homeAway === 'home' || g.homeAway === 'away').length,
      scored,
      allowed,
      /** How many games those two totals are drawn from — see the note above. */
      scoresKnown: withScores.length,
      /**
       * ⚠⚠ **THE SEASON'S TRUE GAME COUNT, because the client's list is CAPPED and the page has to
       * compare against something that is not** (`/review`, 2026-08-18). The page used
       * `games.length` — the rows it received — as the denominator for "from N of M with a score".
       * On a season past the cap that is wrong twice over: the caveat can be suppressed entirely
       * (330 known < 300 shown reads false), and when it does render it names the cap rather than
       * the season. Both are the "quietly a few short" failure this summary exists to prevent.
       */
      totalGames: games.length,
    },
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
