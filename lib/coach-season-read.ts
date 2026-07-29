import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from './api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getClosedCoachingAssignmentsForUser,
} from './db';
import { isTeamWorkspaceOrg } from './team-workspace-entitlements';
import type { CoachCapabilities } from './coach-capabilities';

/**
 * READ-ONLY coach context that also admits CLOSED seasons (Coach Portal Batch 3, P0 #1).
 *
 * The standard per-route `resolveCoachContext` requires an ACTIVE (draft/active) assignment
 * — correct for the ~49 write-capable routes, which must never see a closed year. This
 * resolver is for the handful of GET-only surfaces a coach keeps after a season closes
 * (Season's End, Wrapped, the Insights history/archive): it accepts an assignment on ANY of
 * the team's program years, preferring the active one when it exists.
 *
 * NEVER use this in a route that writes — that's the exact hole the closed-season access
 * model was designed not to open. The contract is deliberately lean ({ctx, team,
 * capabilities}) — widen it only when a real caller needs more.
 */
export interface CoachSeasonReadContext {
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
  team: NonNullable<Awaited<ReturnType<typeof getRepTeam>>>;
  /** Effective capabilities — from the active assignment, else the newest closed one. */
  capabilities: CoachCapabilities;
}

export async function resolveCoachSeasonReadContext(
  orgSlug: string,
  teamId: string,
): Promise<{ error: Response } | CoachSeasonReadContext> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  // The org's workspace posture is already on ctx.org — skip the lookups' redundant org query.
  const lookupOpts = { isTeamWorkspace: isTeamWorkspaceOrg(ctx.org) };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id, lookupOpts);
  const activeAssignment = assignments.find(a => a.teamId === teamId) ?? null;

  // Only pay for the second query when the active lookup came up empty — the everyday
  // in-season request never touches it.
  const closedAssignment = activeAssignment
    ? null
    : (await getClosedCoachingAssignmentsForUser(ctx.org.id, ctx.user.id, lookupOpts))
        .find(a => a.teamId === teamId) ?? null;

  const anyAssignment = activeAssignment ?? closedAssignment;
  if (!anyAssignment) return { error: forbidden() };

  return { ctx, team, capabilities: anyAssignment.capabilities };
}
