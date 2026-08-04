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
  const { assignment } = resolved;
  const denied = denyUnless(canViewScoutingBook(assignment.capabilities), 'You do not have access to the scouting book.');
  if (denied) return denied;

  const [events, opponents, aliases, observationCounts] = await Promise.all([
    getRepTeamGameEventsForOpponentBook(teamId),
    getRepTeamOpponents(teamId),
    getRepTeamOpponentAliases(teamId),
    getRepTeamOpponentObservationCounts(teamId),
  ]);

  const entries = buildOpponentBook({
    events, opponents, aliases, observationCounts,
    nowIso: new Date().toISOString(),
  });

  // Deliberately just the entries: tags + writer capabilities belong to the card route,
  // where they are actually consumed — nothing in the list surfaces reads them.
  return NextResponse.json({ opponents: entries });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/opponents' });
