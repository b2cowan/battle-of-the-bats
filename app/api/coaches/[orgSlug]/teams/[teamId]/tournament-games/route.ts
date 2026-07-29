import { NextResponse } from 'next/server';
import { getAuthContext, forbidden, unauthorized } from '@/lib/api-auth';
import {
  getMergedTournamentHistoryForRepTeam,
  getRegistrationGamesForTeam,
} from '@/lib/basic-coach-teams';
import {
  getTeamScopedRepTeamAccess,
  isTeamWorkspaceOrg,
} from '@/lib/team-workspace-entitlements';
import { withObservability } from '@/lib/observability';

/**
 * WI-2B: the rep team's REAL tournament games, for the Premium Schedule tab.
 *
 * ⚠ Batch 4 changed what this list is FOR. Dated tournament games are now MIRRORED into real
 * `rep_team_events` rows (`lib/rep-tournament-game-mirror.ts`) so attendance and lineups work on
 * them, and the Schedule renders those as ordinary events. What this route still uniquely provides
 * is the games that CANNOT be mirrored — undated bracket slots, which have no `starts_at` to hang
 * an event on — plus the public game links. The Schedule drops any entry it already holds as a
 * mirrored event, so nothing renders twice.
 *
 * Batch 4 also fixed a real inconsistency: this route resolved ONLY the workspace bridge
 * (`team_workspaces.basic_coach_team_id`), so an org-created rep team with an admin-linked
 * registration (mig 196) saw its tournament on the Tournaments page but never its GAMES here. It
 * now shares `getMergedTournamentHistoryForRepTeam` with its tournament-history sibling — one
 * bridge-resolution rule for both.
 *
 * Returns an empty list (never an error) when the team has no linked tournament participation.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> }) => {
  const { orgSlug, teamId } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  try {
    const access = await getTeamScopedRepTeamAccess({
      orgId: ctx.org.id,
      repTeamId: teamId,
      userId: ctx.user.id,
      requireCoach: true,
      skipEntitlementCheck: !isTeamWorkspaceOrg(ctx.org),
    });
    if (!access.allowed) return forbidden();

    const { history } = await getMergedTournamentHistoryForRepTeam(teamId);
    if (history.length === 0) {
      return NextResponse.json({ games: [] });
    }

    const games = await getRegistrationGamesForTeam(history);
    return NextResponse.json({ games });
  } catch (error) {
    console.error('[coaches tournament-games] load error:', error);
    // Non-fatal: the Schedule still renders the coach's own events without the tournament games.
    return NextResponse.json({ games: [] });
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tournament-games' });
