import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from './api-auth';
import { refuseWithoutLiveSeat } from './coach-season-refusal';
import { getActiveRepProgramYear, getCoachingAssignmentsForUser, getRepTeam } from './db';
import { denyUnless, type CoachCapabilities } from './coach-capabilities';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { isUuid } from './utils';
import { isFamilyLayerEnabled } from './family-access';
import type { RepTeam } from './types';

/**
 * lib/family-coach-route.ts — the auth chain every COACH-side family route runs.
 *
 * The coaches API's house style is a per-file `resolveCoachContext` (49 routes do it), and
 * that convention is not being changed here. What this replaced was three BYTE-IDENTICAL
 * copies created in a single change — which is a different thing from a convention that grew
 * one route at a time. One of the original three routes remains (the guardians card); the team
 * family-access routes were removed with the family link on 2026-09-12, and the share-a-game
 * route with the public game page on 2026-09-20.
 * Sharing the chain also means the premium gate is part of it rather than a step each family
 * route has to remember, so a further family route cannot be added without it.
 *
 * ⚠ LIVE SEASON ONLY. This deliberately does NOT import `lib/coach-team-read.ts`. Family access
 * is an INSTRUMENT — it configures who may reach the team RIGHT NOW — so it resolves the team's
 * ACTIVE state and cannot serve a season that has ended, let alone one a caller names. Routes
 * using it must never appear in the guard's `HISTORY_ENDPOINTS`.
 *
 * Capability checks stay at the CALL SITE: the guardians card needs guardian-contact access
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
  if (!assignment) return { error: await refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId) };

  // Premium gate (2026-08-01 strategy entry). A coach whose team is not entitled gets a 404,
  // not a paywall: this route does not exist for them.
  if (!(await isFamilyLayerEnabled({ org: ctx.org, repTeamId: teamId }))) {
    return { error: NextResponse.json({ error: 'family_layer_unavailable' }, { status: 404 }) };
  }

  return { ctx, team, assignment };
}

/**
 * The chain above plus what every coach-side "families say if they're coming" route adds (Stage 4b; the room's family read and
 * Remind): 404 while the guardian tier is off, the `attendance` capability (ask 11: coaches who can mark attendance), and the
 * team's LIVE season (no year parameter; an event of another season is the caller's "not found").
 */
export async function resolveFamilyAttendanceContext(
  params: Promise<{ orgSlug: string; teamId: string; eventId: string }>,
): Promise<{ error: Response } | (FamilyCoachContext & { teamId: string; eventId: string; programYearId: string })> {
  if (!GUARDIAN_TIER_ENABLED) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const { orgSlug, teamId, eventId } = await params;
  // A malformed id is "not found", never a database error (the family POST route's rule).
  if (!isUuid(eventId)) return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved;
  const denied = denyUnless(resolved.assignment.capabilities.attendance, 'You do not have access to attendance.');
  if (denied) return { error: denied };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  return { ...resolved, teamId, eventId, programYearId: programYear.id };
}
