import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  getRepTeamMeasurableTypes,
  getRepPlayerMeasurablesForPlayer,
  getRepPlayerDevelopmentGoalsForPlayer,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import {
  denyUnless, canViewDevelopmentGoals, canViewMeasurables, canWriteDevelopment,
} from '@/lib/coach-capabilities';
import { computeTeamSeasonLineupAnalytics } from '@/lib/team-season-analytics';

async function resolveContext(orgSlug: string, teamId: string, playerId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const [assignments, player] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getRepRosterPlayer(playerId),
  ]);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
  }

  return { ctx, player, assignment };
}

/** This-season field/bench innings for ONE player, quoted from the SAME shared engine the
 *  Playing-time fairness report runs (never a parallel computation). Non-fatal by design —
 *  an analytics hiccup must not 500 the Development card — but a real defect must not be
 *  indistinguishable from "no data", hence the console.error. */
async function playerInningsContext(teamId: string, playerId: string) {
  try {
    const result = await computeTeamSeasonLineupAnalytics(teamId);
    const row = result?.analytics.fairPlay.find(r => r.playerId === playerId);
    if (!row || (row.fieldInnings === 0 && row.benchInnings === 0)) return null;
    return { fieldInnings: row.fieldInnings, benchInnings: row.benchInnings };
  } catch (error) {
    console.error('development innings context failed', error);
    return null;
  }
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;
  const caps = assignment.capabilities;

  const showGoals = canViewDevelopmentGoals(caps);
  const showMeasurables = canViewMeasurables(caps);
  if (!showGoals && !showMeasurables) {
    const denied = denyUnless(false, 'You do not have access to player development.');
    return denied!;
  }

  const [types, measurables, goals, innings] = await Promise.all([
    showMeasurables ? getRepTeamMeasurableTypes(teamId, { includeRetired: true }) : Promise.resolve([]),
    showMeasurables ? getRepPlayerMeasurablesForPlayer(playerId) : Promise.resolve([]),
    showGoals ? getRepPlayerDevelopmentGoalsForPlayer(playerId) : Promise.resolve([]),
    // Innings quote the lineup engine → gate on the lineups capability so this GET can't
    // become a side door around the Playing-time report's own gate.
    caps.lineups ? playerInningsContext(teamId, playerId) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    canWrite: canWriteDevelopment(caps),
    showGoals,
    showMeasurables,
    types,
    measurables,
    goals,
    context: innings,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development' });
