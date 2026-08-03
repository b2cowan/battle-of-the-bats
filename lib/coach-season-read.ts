import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from './api-auth';
import {
  getRepTeam,
  getRepProgramYear,
  getActiveRepProgramYear,
  getLatestClosedRepProgramYear,
  getCoachingAssignmentsForUser,
  getClosedCoachingAssignmentsForUser,
  getCoachAssignmentCapabilitiesForTeam,
} from './db';
import { isTeamWorkspaceOrg } from './team-workspace-entitlements';
import type { CoachCapabilities } from './coach-capabilities';
import type { RepProgramYear } from './types';

/**
 * READ-ONLY coach context for a SPECIFIC season — the single read rail for the frozen past
 * season (Chunk F), and the rail Batch 3's closed-season surfaces already ran on.
 *
 * The standard per-route `resolveCoachContext` (hand-declared in ~53 route files) requires an
 * ACTIVE (draft/active) assignment and then resolves `getActiveRepProgramYear` — correct for the
 * write-capable routes, which must never see a closed year. This resolver is the GET-only
 * counterpart: it admits an assignment on ANY of the team's program years and resolves the one
 * the caller asked for.
 *
 * ⚠ NEVER use this in a route that writes. It is the ONLY thing standing between a `?year=`
 * parameter and a past season's data, and Chunk F's write safety is enforced by a source-level
 * test (tests/unit/coach-season-write-guard.test.ts) that fails the build if a write handler imports it.
 * The Staff route is the one declared exception — see governing rule 3.
 *
 * ── Governing rule 1: "same access as when it was live, for everyone who had it" ──
 * Capabilities come from the assignment row recorded against the RESOLVED season, not from the
 * coach's newest assignment. Before Chunk F this resolver took no year at all and fell back to
 * the newest closed assignment, which silently handed a coach their CURRENT capabilities when
 * they opened an older year — the exact leak governing rule 1 exists to prevent.
 */
export interface CoachSeasonReadContext {
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
  team: NonNullable<Awaited<ReturnType<typeof getRepTeam>>>;
  /** The season being read — always resolved, never assumed to be the active one. */
  programYear: RepProgramYear;
  /** Effective capabilities FOR THAT SEASON (rule 1). */
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

  // The team and the season depend only on ids already in hand, so they resolve together —
  // every coach-portal GET now funnels through here, and serialising them would add a round
  // trip to the critical path of every page load. The tenancy cross-checks happen after both
  // land, so nothing is decided on a half-resolved context.
  const [team, requestedYear] = await Promise.all([
    getRepTeam(teamId),
    opts.yearId ? getRepProgramYear(opts.yearId) : getActiveRepProgramYear(teamId),
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

  // ── Capabilities FROM THAT SEASON's assignment row (rule 1) ──
  const lookupOpts = { isTeamWorkspace: isTeamWorkspaceOrg(ctx.org) };
  const isClosed = programYear.status === 'completed' || programYear.status === 'archived';

  // Only pay for the lookup that can match the resolved season's status — the everyday
  // in-season request never touches the closed list.
  const assignment = isClosed
    ? (await getClosedCoachingAssignmentsForUser(ctx.org.id, ctx.user.id, lookupOpts))
        .find(a => a.programYearId === programYear!.id) ?? null
    : (await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id, lookupOpts))
        .find(a => a.programYearId === programYear!.id) ?? null;

  // Rule 3: revoking an assistant from a past season's staff removes the assignment row, so
  // this 403 is what makes revocation bite immediately — at the API, not in the nav.
  if (!assignment) return { error: forbidden() };

  return { ctx, team, programYear, capabilities: assignment.capabilities, isReadOnly: isClosed };
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
 * Rule 1, applied to a surface that spans MANY seasons at once (the Insights archive): a map of
 * program-year id → the capabilities recorded against that year's assignment row.
 *
 * A single boolean can't be right across an archive — an assistant granted money in 2024 and not
 * in 2025 must see 2024's totals and not 2025's. Years the coach holds no assignment on are
 * absent from the map, so `map.get(id)` returning undefined is itself the "no access" answer.
 */
export async function resolveCoachSeasonCapabilityMap(
  org: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>['org'],
  userId: string,
  teamId: string,
): Promise<Map<string, CoachCapabilities>> {
  // ⚠ ONE lean query, not the open+closed assignment pair this used to run (/simplify 2026-08-03).
  // The open lookup also fetches money badges and nav signals — several sequential round trips
  // that a capability question never reads. Callers pay this on ordinary page loads, and two of
  // them now call it alongside a resolver that already loaded assignments for its own reasons.
  const rows = await getCoachAssignmentCapabilitiesForTeam(
    org.id, userId, teamId, { isTeamWorkspace: isTeamWorkspaceOrg(org) },
  );
  return new Map(rows.map(r => [r.programYearId, r.capabilities]));
}
