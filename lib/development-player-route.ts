import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from './api-auth';
import {
  getCoachingAssignmentsForUser, getRepRosterPlayer, getRepPlayerDevelopmentGoal,
  getRepPlayerMeasurablesForPlayer, getRepPlayerObservationsForPlayer, getRepTeamEventById,
} from './db';
import { denyUnless, canWriteDevelopment, canWriteDevelopmentGoals, DEVELOPMENT_GRANT_MESSAGE } from './coach-capabilities';
import { pastSeasonRefusal } from './development-season-guard';

/**
 * The per-PLAYER development write context, ONE home (development lifecycle Phase 2; /simplify
 * 2026-09-13 — three routes had each declared the same chain by hand, which is how a season guard
 * gets dropped from one of them): the signed-in coach → their assignment on THIS team → the
 * player, proved to be this team's and this org's → the season guard (F04: a finished season's
 * row is read-only beyond navigation) → the write gate.
 *
 * Two gates, because the grant covers results on its own and a coach's written judgement about a
 * child — goals, observations, reviews — needs the grant AND Internal notes (§178 build call 2):
 *   · `'results'` → `canWriteDevelopment`
 *   · `'goals'`   → `canWriteDevelopmentGoals`
 */
export async function resolveDevelopmentPlayerContext(
  orgSlug: string, teamId: string, playerId: string, gate: 'results' | 'goals',
) {
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
  const past = pastSeasonRefusal(player, assignment);
  if (past) return { error: NextResponse.json({ error: past.error }, { status: past.status }) };
  const allowed = gate === 'goals' ? canWriteDevelopmentGoals(assignment.capabilities) : canWriteDevelopment(assignment.capabilities);
  const denied = denyUnless(allowed, DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return { error: denied };
  return { ctx, player, assignment };
}

/**
 * A goal named by id must be THIS player's — one scoped read, never "fetch every goal to find
 * one". Shared by the review route, the status change and an observation's evidence link.
 */
export async function assertGoalBelongsToPlayer(teamId: string, playerId: string, goalId: string | null): Promise<string | null> {
  if (!goalId) return null;
  return (await getRepPlayerDevelopmentGoal(goalId, teamId, playerId)) ? null : 'That goal isn’t on this player’s record.';
}

/**
 * An event named by id must be on THIS season's schedule — one scoped read, never "fetch every
 * event to find one". A general note (mig 296) may say which game or practice it was noticed at.
 */
export async function assertEventBelongsToSeason(programYearId: string, eventId: string | null): Promise<string | null> {
  if (!eventId) return null;
  const ev = await getRepTeamEventById(eventId);
  return ev && ev.programYearId === programYearId ? null : 'That event isn’t on this season’s schedule.';
}

/**
 * A review's evidence — readings and observations named by id — must be THIS player's own records
 * on THIS team. The ids are stored without a foreign key (mig 295: evidence is a pointer, and a
 * removed reading must not take the review with it), so the route is the only place that proves
 * them; every other id this phase accepts is proved the same way.
 */
export async function assertEvidenceBelongsToPlayer(
  teamId: string, playerId: string, evidence: { measurableIds: string[]; observationIds: string[] },
): Promise<string | null> {
  const [readings, observations] = await Promise.all([
    evidence.measurableIds.length ? getRepPlayerMeasurablesForPlayer(playerId) : Promise.resolve([]),
    evidence.observationIds.length ? getRepPlayerObservationsForPlayer(playerId) : Promise.resolve([]),
  ]);
  const own = new Set([...readings, ...observations].filter(r => r.teamId === teamId).map(r => r.id));
  const foreign = [...evidence.measurableIds, ...evidence.observationIds].some(id => !own.has(id));
  return foreign ? 'Evidence must be this player’s own records.' : null;
}
