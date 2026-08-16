import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden, type AuthContext } from './api-auth';
import {
  getRepTeam, getCoachingAssignmentsForUser, getActiveRepProgramYear, type CoachingAssignment,
} from './db';
import type { RepTeam, RepProgramYear } from './types';

/**
 * Both resolvers return a DISCRIMINATED union, spelled out rather than inferred.
 *
 * ⚠ Inference produced a third, phantom member here — `'error' in resolved` narrowing left a
 * `{ctx, team, assignment}` shape WITHOUT `programYear` in the live variant's union, so the first
 * caller to actually read `programYear` (the Phase-2 tryout-baselines route) failed to compile
 * against a resolver that plainly returns it. Stating the two shapes keeps `'error' in resolved`
 * narrowing to exactly two answers at every call site.
 */
export type CoachTeamContext = { ctx: AuthContext; team: RepTeam; assignment: CoachingAssignment };
/** `Response`, not `NextResponse` — `unauthorized()`/`forbidden()`/`denyUnless()` return the
 *  platform type, and route handlers accept it just the same. */
export type CoachRouteResult<T> = { error: Response } | T;

/**
 * "Is this caller a coach of THIS team, in THIS org?" — the prefix a live-season coach route
 * starts with, in ONE place.
 *
 * ⚠ **Why this exists.** The same four-step chain — resolve auth, match the org slug, prove the
 * team belongs to that org, find the caller's assignment — is hand-declared in ~53 coach route
 * files. Practice Plans Phase 3 was about to make it 56, and by the third new copy it had already
 * silently dropped a step the other two had. Four copies of an auth chain is four places for one
 * of them to quietly stop checking something.
 *
 * ⚠ **It stops deliberately short of resolving a program year.** Some callers require an ACTIVE
 * season — a tag vocabulary describes the season you are in — and some must work without one: a
 * plan-template library belongs to the TEAM, so a coach between seasons must still be able to
 * manage it. Baking the season check in here would quietly impose the stricter rule on both, which
 * is how a coach loses their template room every autumn.
 *
 * ⚠ **Deliberately NOT the working-season read** (`lib/coach-team-read.ts`). That resolver admits a
 * FINISHED season by design and is read-only infrastructure; a route built on this one resolves the
 * LIVE team, which is what keeps a write out of a season that has ended. A source-level test
 * (`tests/unit/coach-history-endpoint-guard.test.ts`) enforces the split.
 *
 * This is not a migration of the other ~53 routes — it is the shared home the next one should use.
 */
export async function resolveCoachTeamAssignment(
  orgSlug: string, teamId: string,
): Promise<CoachRouteResult<CoachTeamContext>> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  // Tenancy: a team id from another org is a 404, not a 403 — the caller must not learn it exists.
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  return { ctx, team, assignment };
}

/**
 * The above, PLUS an ACTIVE program year.
 *
 * For routes whose subject is the season itself. With no live season there is nothing to describe,
 * so the route says so rather than writing into a vacuum.
 */
export async function resolveLiveCoachTeamContext(
  orgSlug: string, teamId: string,
): Promise<CoachRouteResult<CoachTeamContext & { programYear: RepProgramYear }>> {
  const resolved = await resolveCoachTeamAssignment(orgSlug, teamId);
  if ('error' in resolved) return resolved;

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ...resolved, programYear };
}
