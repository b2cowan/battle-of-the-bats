import { NextResponse } from 'next/server';
import { getAuthContext, forbidden, unauthorized } from '@/lib/api-auth';
import {
  findBasicCoachTeamIdForTournamentRegistration,
  getBasicCoachTournamentHistoryForTeam,
  getRegistrationGamesForTeam,
} from '@/lib/basic-coach-teams';
import {
  getTeamScopedRepTeamAccess,
  getTeamWorkspaceForRepTeam,
} from '@/lib/team-workspace-entitlements';
import { withObservability } from '@/lib/observability';

/**
 * WI-2B: the rep team's REAL tournament games, for the Premium Schedule tab (folded in read-only
 * alongside self-entered events). A rep team reaches a tournament registration only through its
 * workspace → linked Basic team → registration (the same chain the tournament-history route uses),
 * so we resolve that Basic team, then reuse the shared `getRegistrationGamesForTeam`. Returns an
 * empty list (never an error) when the team has no linked tournament participation.
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
    });
    if (!access.allowed) return forbidden();

    const workspace = await getTeamWorkspaceForRepTeam(teamId);
    const basicCoachTeamId =
      workspace?.basicCoachTeamId ??
      (workspace?.sourceTournamentTeamId
        ? await findBasicCoachTeamIdForTournamentRegistration(workspace.sourceTournamentTeamId)
        : null);
    if (!basicCoachTeamId) {
      return NextResponse.json({ games: [] });
    }

    const history = await getBasicCoachTournamentHistoryForTeam(basicCoachTeamId);
    const games = await getRegistrationGamesForTeam(history);
    return NextResponse.json({ games });
  } catch (error) {
    console.error('[coaches tournament-games] load error:', error);
    // Non-fatal: the Schedule still renders the coach's own events without the tournament games.
    return NextResponse.json({ games: [] });
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tournament-games' });
