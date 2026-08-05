import { NextResponse } from 'next/server';
import {
  getRepTeamGameEventsForOpponentBook,
  getRepTeamOpponents,
  getRepTeamOpponentAliases,
  getRepTeamOpponentObservationCounts,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canViewScoutingBook } from '@/lib/coach-capabilities';
import { buildOpponentBook } from '@/lib/coach-opponents';
import { resolveClubBookAccessFor } from '@/lib/coach-club-book';
import { resolveClubContentKeys } from '@/lib/coach-club-book-server';

/**
 * Opponent Scouting Book — the grouped book list (owner-approved plan
 * COACH_OPPONENT_SCOUTING_BOOK_PLAN.md, ratified 2026-08-04).
 *
 * ⚠ INSTRUMENT, not record: reads game events from EVERY season (team-scoped, the
 * drills-past-seasons pattern) to feed the LIVE season's preparation, and is deliberately
 * OFF the season-read rail — never add resolveCoachSeasonRead here, never add this route
 * to APPROVED_SEASON_AWARE_ROUTES (asserted by tests/unit/coach-season-write-guard.test.ts).
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, assignment } = resolved;
  const denied = denyUnless(canViewScoutingBook(assignment.capabilities), 'You do not have access to the scouting book.');
  if (denied) return denied;

  const bookPromise = Promise.all([
    getRepTeamGameEventsForOpponentBook(teamId),
    getRepTeamOpponents(teamId),
    getRepTeamOpponentAliases(teamId),
    getRepTeamOpponentObservationCounts(teamId),
  ]).then(([events, opponents, aliases, observationCounts]) => buildOpponentBook({
    events, opponents, aliases, observationCounts,
    nowIso: new Date().toISOString(),
  }));

  /**
   * Club Shared Book: which rows the club has something to say about. ONE batched lookup for
   * the whole list — never a query per row — and only for a team that is itself sharing
   * (reciprocity, decided server-side). A non-sharing team gets an empty list, so no client
   * can infer what the club knows from a payload it was not entitled to.
   *
   * Started ALONGSIDE the team's own reads, not after them: the club lookup needs the viewer's
   * entries only for its final combine, so awaiting them first would spend a whole round trip
   * on a dependency that does not exist until the last step.
   */
  const clubAccess = resolveClubBookAccessFor(ctx.org, team);
  const clubKeysPromise = clubAccess.canSeeClubLayer
    ? resolveClubContentKeys({
        orgId: ctx.org.id,
        viewerTeamId: teamId,
        viewerEntries: bookPromise.then(es => es.map(e => ({ key: e.key, aliasKeys: e.aliasKeys }))),
      })
    : Promise.resolve<string[]>([]);

  const [entries, clubKeys] = await Promise.all([bookPromise, clubKeysPromise]);

  // Deliberately just the entries (+ the club badge keys): tags + writer capabilities belong
  // to the card route, where they are actually consumed — nothing in the list reads them.
  return NextResponse.json({ opponents: entries, clubKeys });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/opponents' });
