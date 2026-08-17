import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from './api-auth';
import { getRepTeam, getRepProgramYear } from './db';
import {
  getEntitledTeamMembership,
  resolveMembershipCapabilities,
  resolveWorkingProgramYear,
} from './coach-membership';
import type { CoachCapabilities } from './coach-capabilities';
import type { Organization, RepProgramYear } from './types';

/**
 * READ-ONLY coach context for the team's WORKING season — the shared prefix of every coach GET.
 *
 * ── THERE IS NO SEASON DIAL ANY MORE (Design A, owner ruling 2026-08-16; P2 of
 *    COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md) ──
 * This module is the former season-read RAIL with its `?year=` taken away. Chunk F's archive was a
 * PLACE — a switcher that steered the whole portal into a past year, a second nav, and ~30 routes
 * that would serve whichever season the query string named. That place is deleted. What survives is
 * the resolver underneath it, because it is genuinely shared: team + working season + membership +
 * read-only, resolved in ONE round trip on the critical path of every coach page load. Twenty-six
 * routes hand-rolling P1's team-route pattern instead is the drift this repo has paid for before.
 *
 * ⚠ **THE WORKING SEASON IS NOT ALWAYS LIVE, and read-only is NOT deleted.** A team between seasons
 * has a working season that has FINISHED, and every record surface still renders it — as a record,
 * with no write control. `isReadOnly` is a fact about the SEASON, never about the team: a team
 * rolled forward into a new year is never itself "closed". What died is season CHOICE, not
 * read-only rendering.
 *
 * ⚠ **A YEAR PARAMETER IS NOW A DECISION, and there are exactly two of them.** Season's End and
 * Season Wrapped address a finished year explicitly (`resolveCoachHistoryRead` below), reached from
 * the compare list — that is the whole look-back layer. Every other coach route resolves the
 * working season and cannot address another one at all. `tests/unit/coach-history-endpoint-guard.test.ts`
 * fails the build when a route joins or leaves that set, which is the decision point.
 */
export interface CoachTeamReadContext {
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
  team: NonNullable<Awaited<ReturnType<typeof getRepTeam>>>;
  /** The season being read — the team's working one, or the explicit year on a history endpoint. */
  programYear: RepProgramYear;
  /** The member's CURRENT capabilities (owner ruling 2026-08-16: current permissions, everywhere). */
  capabilities: CoachCapabilities;
  /** The season is completed/archived ⇒ every surface renders as a record. Derived from the
   *  SEASON, never from the team: a rolled-forward team is never itself "closed". */
  isReadOnly: boolean;
}

async function resolve(
  orgSlug: string,
  teamId: string,
  yearId: string | null,
): Promise<{ error: Response } | CoachTeamReadContext> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  // The team, the season AND the membership depend only on ids already in hand, so all three
  // resolve together — every coach-portal GET funnels through here, and serialising any of them
  // would add a round trip to the critical path of every page load. The tenancy and membership
  // checks happen after all land, so nothing is decided on a half-resolved context.
  const [team, resolvedYear, membership] = await Promise.all([
    getRepTeam(teamId),
    yearId ? getRepProgramYear(yearId) : resolveWorkingProgramYear(teamId),
    getEntitledTeamMembership(ctx.org, teamId, ctx.user.id),
  ]);

  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  if (!resolvedYear) {
    return { error: NextResponse.json({ error: 'No seasons for this team' }, { status: 404 }) };
  }
  // Tenancy: a year id from another team (or another org's team) is a 404, not a 403 — the caller
  // must not learn that the id exists. Asserted for the working season too, cheaply, so the two
  // paths cannot diverge on it.
  if (resolvedYear.teamId !== teamId || resolvedYear.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  // ── The gate: an ACTIVE membership on the team (entitlement posture included) ──
  // Revocation bites HERE, immediately, for every season at once — at the API, not in the nav.
  if (!membership) return { error: forbidden() };

  const isClosed = resolvedYear.status === 'completed' || resolvedYear.status === 'archived';
  return {
    ctx,
    team,
    programYear: resolvedYear,
    capabilities: resolveMembershipCapabilities(membership),
    isReadOnly: isClosed,
  };
}

/**
 * The everyday entry point for a section's GET handler: the team's working season, gated on an
 * active membership.
 *
 * ⚠ GET handlers only. A write must address a LIVE season — a finished one is a record — so writes
 * keep `resolveLiveCoachTeamContext` / their own active-year resolver, and a source-level test
 * (`tests/unit/coach-history-endpoint-guard.test.ts`) fails the build if a write handler resolves
 * through here.
 */
export async function resolveCoachTeamRead(
  orgSlug: string,
  teamId: string,
): Promise<{ error: Response } | CoachTeamReadContext> {
  return resolve(orgSlug, teamId, null);
}

/**
 * ⚠ **THE LOOK-BACK DOOR — the ONLY resolver that addresses a season the coach names.**
 *
 * Season's End and Season Wrapped are the surviving history surfaces: one finished season's
 * ceremony, reached from the compare list at the bottom of the results report. `yearId` may be
 * null, which resolves the working season — the ordinary case, where a team's own finished season
 * is what Season's End is describing.
 *
 * ⚠ Adding a caller is an ARCHITECTURAL decision, not a convenience: it puts a feature back into
 * the business of serving history, which the owner deleted as a place. The guard test's
 * `HISTORY_ENDPOINTS` list is where that decision has to be written down.
 */
export async function resolveCoachHistoryRead(
  orgSlug: string,
  teamId: string,
  yearId: string | null,
): Promise<{ error: Response } | CoachTeamReadContext> {
  return resolve(orgSlug, teamId, yearId);
}

/**
 * The same door, reading the year off the REQUEST — what every history endpoint actually wants.
 *
 * ⚠ Added 2026-08-16 (`/simplify`) once the third history endpoint appeared and all three had
 * hand-written the identical two lines: `searchParams.get('year')?.trim()`, then `|| null`. That
 * pair encodes a real decision — **an empty or whitespace `?year=` means "the working season", not
 * "not found"** — and a decision spelled out at each call site is one that drifts. A fourth
 * endpoint (P4's money book is the next candidate) now inherits it.
 *
 * ⚠ Adding a caller is still the ARCHITECTURAL decision `resolveCoachHistoryRead` describes; this
 * wrapper makes the plumbing shared, never the permission. `HISTORY_ENDPOINTS` in
 * `tests/unit/coach-history-endpoint-guard.test.ts` is where joining the look-back layer is
 * recorded, and that guard matches this name too — an extraction that hid three routes from it
 * would be worse than the duplication it removed.
 */
export async function resolveCoachHistoryReadFromRequest(
  req: Request,
  orgSlug: string,
  teamId: string,
): Promise<{ error: Response } | CoachTeamReadContext> {
  const rawYear = new URL(req.url).searchParams.get('year')?.trim();
  return resolveCoachHistoryRead(orgSlug, teamId, rawYear || null);
}

/**
 * "May this coach open this team, and with what?" — for the cross-season surfaces that span EVERY
 * season at once rather than resolving one (the compare list, the tryout memory strip).
 *
 * Under M1 the answer stopped varying by year: it is the member's CURRENT capabilities, or nothing
 * at all. The per-year capability map this replaced performed archaeology that governing rule 1
 * required and Design A retired (owner ruling 2026-08-16) — the stated widening (e.g. an assistant
 * granted tryouts TODAY reads prior seasons' tryout pairs) is recorded in
 * COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md §1.
 */
export async function resolveCoachTeamCapabilities(
  org: Pick<Organization, 'id' | 'planId' | 'accountKind'>,
  userId: string,
  teamId: string,
): Promise<CoachCapabilities | null> {
  const membership = await getEntitledTeamMembership(org, teamId, userId);
  return membership ? resolveMembershipCapabilities(membership) : null;
}
