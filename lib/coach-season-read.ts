import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from './api-auth';
import {
  getRepTeam,
  getRepProgramYear,
  getRepProgramYears,
  getActiveRepProgramYear,
  getLatestClosedRepProgramYear,
} from './db';
import { getEntitledTeamMembership, resolveMembershipCapabilities } from './coach-membership';
import type { CoachCapabilities } from './coach-capabilities';
import type { RepProgramYear } from './types';

/**
 * READ-ONLY coach context for a SPECIFIC season — the single `?year=` read rail.
 *
 * ── ACCESS MODEL REPLACED 2026-08-16 (Design A on M1, "the team is the account") ──
 * The gate is an ACTIVE TEAM MEMBERSHIP (`lib/coach-membership.ts`), and the capabilities handed
 * back are the member's CURRENT ones — in every season. Chunk F's governing rule 1 ("same access
 * as when it was live, resolved from the viewed season's own assignment row") is retired: it
 * existed because access itself was historical, and once only current staff hold access, their
 * current grant is the honest one. Revocation therefore bites here the moment a membership is
 * revoked — for every season at once, not per-row.
 *
 * ⚠ NEVER use this in a route that writes. It is the ONLY thing standing between a `?year=`
 * parameter and a past season's data, and write safety is enforced by a source-level test
 * (tests/unit/coach-season-write-guard.test.ts) that fails the build if a write handler imports it.
 *
 * ⚠ This rail is scheduled for REMOVAL in Phase 2 of COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md
 * (the season-toggle archive is deleted; the few surviving history endpoints re-gate on
 * membership + an explicit year). Until that lands, it stays the one door — do not add callers.
 */
export interface CoachSeasonReadContext {
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
  team: NonNullable<Awaited<ReturnType<typeof getRepTeam>>>;
  /** The season being read — always resolved, never assumed to be the active one. */
  programYear: RepProgramYear;
  /** The member's CURRENT capabilities (owner ruling 2026-08-16: current permissions, everywhere). */
  capabilities: CoachCapabilities;
  /** The season is completed/archived ⇒ every surface renders as a record. Derived from the
   *  SEASON, never from the team: a rolled-forward team is never itself "closed". */
  isReadOnly: boolean;
}

export interface CoachSeasonReadOpts {
  /** Program year to read. Absent ⇒ the active season, else the newest closed one. */
  yearId?: string | null;
}

/** `?year=` is the portal-wide name for the season parameter (Batch 3 shipped it on `wrapped`). */
export function seasonParam(req: Request): string | null {
  const raw = new URL(req.url).searchParams.get('year');
  return raw && raw.trim() ? raw.trim() : null;
}

export async function resolveCoachSeasonReadContext(
  orgSlug: string,
  teamId: string,
  opts: CoachSeasonReadOpts = {},
): Promise<{ error: Response } | CoachSeasonReadContext> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  // The team, the season AND the membership depend only on ids already in hand, so all three
  // resolve together — every coach-portal GET funnels through here, and serialising any of them
  // would add a round trip to the critical path of every page load. The tenancy and membership
  // checks happen after all land, so nothing is decided on a half-resolved context.
  const [team, requestedYear, membership] = await Promise.all([
    getRepTeam(teamId),
    opts.yearId ? getRepProgramYear(opts.yearId) : getActiveRepProgramYear(teamId),
    getEntitledTeamMembership(ctx.org, teamId, ctx.user.id),
  ]);

  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  // ── Resolve WHICH season, before any capability question ──
  let programYear: RepProgramYear | null;
  if (opts.yearId) {
    // Tenancy: a year id from another team (or another org's team) is a 404, not a 403 —
    // the caller must not learn that the id exists.
    programYear = requestedYear;
    if (!programYear || programYear.teamId !== teamId || programYear.orgId !== ctx.org.id) {
      return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    }
  } else {
    // Only pay for the closed lookup when there is genuinely no live season.
    programYear = requestedYear ?? (await getLatestClosedRepProgramYear(teamId));
    if (!programYear) {
      return { error: NextResponse.json({ error: 'No seasons for this team' }, { status: 404 }) };
    }
  }

  // ── The gate: an ACTIVE membership on the team (entitlement posture included) ──
  // Revocation bites HERE, immediately, for every season at once — at the API, not in the nav.
  if (!membership) return { error: forbidden() };

  const isClosed = programYear.status === 'completed' || programYear.status === 'archived';
  return {
    ctx,
    team,
    programYear,
    capabilities: resolveMembershipCapabilities(membership),
    isReadOnly: isClosed,
  };
}

/**
 * The everyday entry point for a section's GET handler: read `?year=` off the request and resolve
 * that season. Absent the parameter it resolves the live season, so a converted route behaves
 * exactly as it did before for a team mid-season.
 *
 * ⚠ GET handlers only. See the class comment — the write-guard test enforces it.
 */
export async function resolveCoachSeasonRead(
  orgSlug: string,
  teamId: string,
  req: Request,
): Promise<{ error: Response } | CoachSeasonReadContext> {
  return resolveCoachSeasonReadContext(orgSlug, teamId, { yearId: seasonParam(req) });
}

/**
 * Multi-season surfaces (tryout memory, the cross-season history list) ask "what may this coach
 * see of year X?" for many years at once.
 *
 * Under M1 the answer stopped varying by year: it is the member's CURRENT capabilities for every
 * season the team has, or nothing at all — `map.get(id)` returning undefined still reads as "no
 * access", which is what a revoked/never member gets for every year. The per-year capability
 * archaeology this used to perform died with governing rule 1 (owner ruling 2026-08-16; the
 * stated widening — e.g. an assistant granted tryouts TODAY now reads prior seasons' tryout
 * pairs — is recorded in COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md §1).
 */
export async function resolveCoachSeasonCapabilityMap(
  org: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>['org'],
  userId: string,
  teamId: string,
): Promise<Map<string, CoachCapabilities>> {
  // Independent lookups — one round trip, not two.
  const [membership, years] = await Promise.all([
    getEntitledTeamMembership(org, teamId, userId),
    getRepProgramYears(teamId),
  ]);
  if (!membership) return new Map();
  const capabilities = resolveMembershipCapabilities(membership);
  return new Map(years.map(y => [y.id, capabilities]));
}
