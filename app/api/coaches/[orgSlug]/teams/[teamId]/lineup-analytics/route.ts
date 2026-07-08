import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  getRepRosterPlayers,
  getRepTeamEvents,
  getRepTeamSeasonLineups,
  getRepTeamLineupTemplates,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { computeSeasonLineupAnalytics } from '@/lib/lineup-season-analytics';

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();
  const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
  if (denied) return denied;
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  const [lineups, events, players, templates] = await Promise.all([
    getRepTeamSeasonLineups(programYear.id),
    getRepTeamEvents(programYear.id),
    getRepRosterPlayers(programYear.id),
    getRepTeamLineupTemplates(teamId, programYear.id),
  ]);

  const sportPack = getSportPack(team.sport ?? DEFAULT_SPORT);
  const analytics = computeSeasonLineupAnalytics({
    lineups,
    scores: events.map(e => ({ eventId: e.id, teamScore: e.teamScore, opponentScore: e.opponentScore })),
    players: players.map(p => ({
      id: p.id,
      name: playerDisplayName(p),
      isPitcher: !!p.lineupProfile?.pitcher,
      pitcherCap: p.lineupProfile?.pitcher?.maxInnings ?? null,
    })),
    pitcherPosition: sportPack.pitcherPosition,
    seasonPitcherCap: programYear.lineupSettings?.pitcherMaxInningsDefault ?? null,
    templates: templates.map(t => ({
      name: t.name,
      battingOrderPlayerIds: t.entries
        .filter(e => e.battingOrder != null)
        .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number))
        .map(e => e.playerId),
    })),
    fieldPositions: sportPack.fieldPositions,
  });

  return NextResponse.json({ analytics });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/lineup-analytics' });
