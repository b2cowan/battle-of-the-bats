import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  getRepCallUpPool,
  getRepRosterPlayer,
  countRepCallUpAppearances,
  deleteRepCallUp,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CALL-UP LIST — the roster page's quiet Call-ups section (mig 309; plan §4.1/§5).
 *
 * Everyone this team has borrowed this season, with the games each has played. The ONE place the
 * saved list is visible without being asked for; the lineup builder shows none of it at rest, and
 * reaches it only through the per-game route.
 *
 * ⚠ The games-played count is not decoration — several leagues cap how many games a borrowed
 * player may appear in, and today a coach tracks that on paper or not at all.
 *
 * ⚠ **No PATCH.** A call-up is deliberately thin: a name, a number, and the games they played.
 * There is no profile, no dues, no development record, and nothing here to edit — a name typed
 * wrong is removed and retyped. See the player-detail route, which 404s on a call-up.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  // R5: the same gate as calling someone up. A coach who can build a lineup can see who is on the
  // list they would be picking from.
  const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
  if (denied) return denied;

  /**
   * ⚠⚠ **TWO FIELDS, AND THE THIRD ONE WAS A PII LEAK.** This route answers exactly one question —
   * "how many games has each call-up played?" — which is the figure the roster page's shelf shows
   * and the one several leagues cap. The page already holds the names, from the roster read.
   *
   * It originally also serialised `playerFirstName`, `playerLastName`, `playerNumber` and
   * **`guardianPhone`**, none of which any caller read. The phone was the real problem: this route
   * gates on `lineups`, which the default ASSISTANT preset has while `rosterPii` it does not — so an
   * assistant coach who is redacted out of guardian contacts everywhere else in the portal was being
   * handed the guardian phone number of every borrowed child in the season. Found by `/review`;
   * the sibling event route was already correct.
   *
   * Do not widen this projection. If a caller ever needs a name here, it needs `redactRoster` with
   * it — which is the thing hand-writing a projection is how you forget.
   */
  const pool = await getRepCallUpPool(programYear.id);
  return NextResponse.json({
    callUps: pool.map(e => ({ playerId: e.player.id, gamesCalledUp: e.gamesCalledUp })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/call-ups' });

/**
 * Remove a call-up from the list — **offered only before their first game.**
 *
 * ⚠⚠ **A CALL-UP WHO HAS PLAYED IS PART OF THE SEASON'S RECORD.** Almost every table that
 * references a roster row cascades, `rep_team_lineup_entries` included, so deleting a call-up who
 * has played would take their lineup row with them: a card printed last month would stop matching
 * the card printed today, and the batting order would gain a hole. An archive that quietly drops a
 * player who was on the field rewrites the season, which is the one thing it must never do.
 *
 * So removal answers only the case it is actually for — a name typed wrong, or somebody added and
 * never used. Both have **no games**, and removing them touches nothing. A coach who wants a name
 * gone after calling someone up takes them off that game first (the sheet's own control), which
 * returns the count to zero and brings this door back. That is one extra step in a rare case, and
 * it is the step that keeps every printed card true.
 */
export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
  if (denied) return denied;

  const playerId = new URL(req.url).searchParams.get('playerId');
  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  // Opts in for the obvious reason: this route exists to remove a call-up.
  const player = await getRepRosterPlayer(playerId, { includeCallUps: true });
  if (!player || player.teamId !== teamId || player.orgId !== ctx!.org.id
      || player.programYearId !== programYear.id || player.status !== 'callup') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const games = await countRepCallUpAppearances(playerId);
  if (games > 0) {
    const first = player.playerFirstName || 'This call-up';
    return NextResponse.json({
      error: `${first} has played ${games} game${games === 1 ? '' : 's'}, so their name stays on `
        + 'those lineups. Take them off each game first if you want them off this list.',
    }, { status: 409 });
  }

  await deleteRepCallUp(playerId);
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/call-ups' });
