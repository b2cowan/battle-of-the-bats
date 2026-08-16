import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from './api-auth';
import { getCoachingAssignmentsForUser, getRepTeam } from './db';
import { isFamilyLayerEnabled } from './family-access';
import type { CoachCapabilities } from './coach-capabilities';
import type { RepTeam } from './types';

/**
 * lib/family-coach-route.ts — the auth chain every COACH-side family route runs.
 *
 * The coaches API's house style is a per-file `resolveCoachContext` (49 routes do it), and
 * that convention is not being changed here. What this replaces is three BYTE-IDENTICAL
 * copies created in a single change — which is a different thing from a convention that grew
 * one route at a time. Sharing them also means the premium gate is part of the chain rather
 * than a step each family route has to remember, so a fourth family route cannot be added
 * without it.
 *
 * ⚠ LIVE SEASON ONLY. This deliberately does NOT import `lib/coach-team-read.ts`. Family access
 * is an INSTRUMENT — it configures who may reach the team RIGHT NOW — so it resolves the team's
 * ACTIVE state and cannot serve a season that has ended, let alone one a caller names. Routes
 * using it must never appear in the guard's `HISTORY_ENDPOINTS`.
 *
 * Capability checks stay at the CALL SITE: the panel routes need guardian-contact access
 * (`rosterPii`) while sharing a game needs schedule access, and folding those together here
 * would grant one route the other's permission.
 */

export interface FamilyCoachContext {
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
  team: RepTeam;
  assignment: { teamId: string; capabilities: CoachCapabilities };
}

/** `unauthorized()` / `forbidden()` return plain `Response`, so the error slot is the wider
 *  type — every caller just returns it. */
export async function resolveFamilyCoachContext(
  orgSlug: string,
  teamId: string,
): Promise<{ error: Response } | FamilyCoachContext> {
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

  // Premium gate (2026-08-01 strategy entry). A coach whose team is not entitled gets a 404,
  // not a paywall: this route does not exist for them.
  if (!(await isFamilyLayerEnabled({ org: ctx.org, repTeamId: teamId }))) {
    return { error: NextResponse.json({ error: 'family_layer_unavailable' }, { status: 404 }) };
  }

  return { ctx, team, assignment };
}
