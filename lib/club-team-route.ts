import 'server-only';
import { NextResponse } from 'next/server';
import {
  getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard, type AuthContextWithRole,
} from './api-auth';
import { hasCapability } from './roles';
import { hasModuleEntitlement } from './module-entitlements';
import { getActiveRepProgramYear, getRepTeam } from './db';
import { isLiveSeasonStatus } from './season-live';
import { supabaseAdmin } from './supabase-admin';
import type { RepProgramYear, RepTeam } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S GATE FOR ONE TEAM — shared by the Stage 2 club routes (seasons, coaches, invitations).
 *
 * Every rep-teams admin route hand-declares the same five steps (org from the query's orgSlug,
 * fail-closed; the Rep Teams capability; the plan's Rep Teams module; the team belongs to this
 * org; the member's team-group limit). The Stage 2 routes share one copy instead of adding four
 * more, and state the write rule once:
 *
 *   `write: true` → the OWNER, or an ADMIN with Rep Teams — never a treasurer (Club Tier Stage 2,
 *   Ask 1: the rep-teams write gate). A treasurer who holds Rep Teams still reads.
 *
 * A team from another org is a 404, never a 403 — the caller must not learn it exists.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export async function resolveClubTeam(
  req: Request,
  teamId: string,
  opts: { write: boolean },
): Promise<{ error: Response } | { ctx: AuthContextWithRole; team: RepTeam }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return { error: forbidden() };
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return { error: forbidden() };
  if (opts.write && ctx.role !== 'owner' && ctx.role !== 'admin') return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const scoped = repGroupScopeGuard(ctx, team.groupId);
  if (scoped) return { error: scoped };
  return { ctx, team };
}

/**
 * A club write that belongs to ONE season — its tryouts, its tryouts-open switch — refuses unless
 * that season is the team's LIVE season (Club Tier B07, Stage 2: tryouts run on the working season).
 * The club's old tryout page acted on whatever season its URL named, so an admin could add or
 * accept a player on a finished season, or open sign-ups on one. Null when the write may go ahead;
 * otherwise a coded 409 in words (`season_not_live`).
 *
 * ⚠ FAILS CLOSED: `getActiveRepProgramYear` reads a failed query as "no live season", which
 * refuses — the safe direction for a write.
 */
export async function refuseUnlessLiveSeason(
  team: Pick<RepTeam, 'id' | 'name'>,
  programYear: Pick<RepProgramYear, 'id' | 'name' | 'status'>,
  consequence: string,
): Promise<Response | null> {
  const live = await getActiveRepProgramYear(team.id);
  if (live && live.id === programYear.id) return null;
  const error = isLiveSeasonStatus(programYear.status)
    ? `The ${programYear.name} isn’t ${team.name}’s current season, so ${consequence}.`
    : `The ${programYear.name} is closed, so ${consequence}.`;
  return NextResponse.json(
    { error, code: 'season_not_live', seasonName: programYear.name },
    { status: 409 },
  );
}

/**
 * The team ids a group-limited member may see, or null when they may see every team (owner, admin,
 * treasurer, or a member with no group limit). For reads that list many teams' records at once —
 * a single team's route uses `repGroupScopeGuard` instead.
 */
export async function teamIdsInScope(ctx: AuthContextWithRole): Promise<Set<string> | null> {
  if (!ctx.repGroupIds) return null;
  const { data, error } = await supabaseAdmin
    .from('rep_teams').select('id').eq('org_id', ctx.org.id).in('group_id', ctx.repGroupIds);
  if (error) throw error;
  return new Set((data ?? []).map((t: { id: string }) => t.id));
}

/**
 * Is `teamId` one of THIS org's teams, and one the member may act on? For a write that names a
 * team in its body (a document template's "applies to", Club Tier B11 / J4-009): the old create
 * wrote any id it was handed, including another club's team. Null when it may go ahead.
 */
export async function refuseTeamOutsideClub(ctx: AuthContextWithRole, teamId: string): Promise<Response | null> {
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'That team isn’t one of this club’s.', code: 'team_not_in_club' }, { status: 400 });
  }
  return repGroupScopeGuard(ctx, team.groupId);
}
