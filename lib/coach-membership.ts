import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getAuthContext, unauthorized, forbidden } from './api-auth';
import { NextResponse } from 'next/server';
import {
  addRepTeamCoach,
  getRepTeam,
  getRepTeamCoachForUserYear,
  getActiveRepProgramYear,
  getLatestClosedRepProgramYear,
  resolveCoachUserIdentities,
} from './db';
import {
  resolveCoachCapabilities,
  denyUnless,
  type AssistantCapabilityGrants,
  type CoachCapabilities,
} from './coach-capabilities';
import { isTeamWorkspaceOrg, getActiveTeamEntitledRepTeamIds } from './team-workspace-entitlements';
import type { Organization, RepProgramYear } from './types';

/**
 * M1 — staff membership lives on the TEAM (owner ruling 2026-08-16, Design A on M1).
 *
 * `rep_team_staff_memberships` is the ONLY source of truth for who may open a team and with what
 * capabilities. `rep_team_coaches` remains as (a) the immutable per-season RECORD of who coached
 * each year, and (b) a live-season PROJECTION this module keeps in sync so the ~54 write routes
 * that resolve "an assignment row on the active year" keep working unchanged.
 *
 * ⚠ THE PROJECTION INVARIANT: the live season's row for a member mirrors the membership's role AND
 * capabilities on every membership write. The write routes gate on the row's capabilities, so a
 * stale mirror would gate writes on yesterday's grants. Nothing may read access truth from a season
 * row when a membership exists — season rows answer "who coached that season", never "who gets in".
 *
 * ⚠ REVOCATION SEMANTICS (ruled): revoke flips `status`, never deletes — the record survives and
 * re-adding reactivates it (grants where they were left, unless the caller passes new ones). The
 * LIVE season's projection row IS deleted on revoke: that person is no longer on this season's
 * staff, and deleting it is precisely what makes every write route refuse them immediately.
 * Closed seasons' rows are never touched — they are the record.
 *
 * ⚠ ORDERING IS THE SAFETY PROPERTY (adversarial review, 2026-08-16). Removal deletes the live
 * row FIRST and flips the membership second, so every partial failure lands CLOSED (worst case: a
 * member still listed whose writes are already refused, and a retry completes it). The reverse
 * order failed OPEN — revoked on every screen while the row silently kept admitting their writes
 * for the rest of the season, with nothing left that could heal it. For the same reason the sync
 * below re-checks the membership after inserting a row and treats a REVOKED membership as "delete
 * any row", so whichever of two racing writers lands last converges the pair to the truth.
 */
export interface TeamStaffMembership {
  id: string;
  orgId: string;
  teamId: string;
  userId: string;
  coachRole: 'head_coach' | 'assistant_coach';
  capabilities: AssistantCapabilityGrants | null;
  status: 'active' | 'revoked';
  createdAt: string;
  revokedAt: string | null;
}

interface MembershipRow {
  id: string;
  org_id: string;
  team_id: string;
  user_id: string;
  coach_role: 'head_coach' | 'assistant_coach';
  capabilities: AssistantCapabilityGrants | null;
  status: 'active' | 'revoked';
  created_at: string;
  revoked_at: string | null;
}

function mapMembership(r: MembershipRow): TeamStaffMembership {
  return {
    id: r.id,
    orgId: r.org_id,
    teamId: r.team_id,
    userId: r.user_id,
    coachRole: r.coach_role,
    capabilities: r.capabilities,
    status: r.status,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  };
}

/** The member's effective capabilities — their CURRENT ones, everywhere (owner ruling). */
export function resolveMembershipCapabilities(m: TeamStaffMembership): CoachCapabilities {
  return resolveCoachCapabilities(m.coachRole, m.capabilities);
}

/**
 * The team's WORKING season: the live (draft/active) year, else the newest finished one — the
 * between-seasons state is ordinary, never a lock-out. This is access-model vocabulary, named
 * once: reads that say "the season the team is on right now" call this instead of hand-rolling
 * the fallback. (Writes that must address a LIVE season only keep calling
 * `getActiveRepProgramYear` directly — a finished season is a record.)
 */
export async function resolveWorkingProgramYear(teamId: string): Promise<RepProgramYear | null> {
  return (await getActiveRepProgramYear(teamId)) ?? getLatestClosedRepProgramYear(teamId);
}

/**
 * The live (draft/active) year, STRICT: a query error THROWS instead of reading as "no season".
 * `getActiveRepProgramYear` swallows errors to null — fine for page reads, lethal for the
 * access-critical writes below, where null means "nothing to delete/project": a transient DB
 * error would silently skip the one write that blocks a removed coach, and the caller would
 * report success (adversarial review, 2026-08-16 — the Critical).
 */
async function getLiveRepProgramYearIdStrict(teamId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .select('id')
    .eq('team_id', teamId)
    .in('status', ['draft', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return data?.id ?? null;
}

/** Point delete of one member's projection row on one year — the (year, user) unique index. */
async function deleteProjectionRow(programYearId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_team_coaches')
    .delete()
    .eq('program_year_id', programYearId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getActiveTeamMembership(
  orgId: string,
  teamId: string,
  userId: string,
): Promise<TeamStaffMembership | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_staff_memberships')
    .select('*')
    .eq('org_id', orgId)
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle<MembershipRow>();
  if (error) throw error;
  return data ? mapMembership(data) : null;
}

/**
 * Same question, with the standalone-workspace entitlement posture applied (a lapsed Team
 * workspace serves no portal — the identical filter `loadCoachAssignmentRows` applies to
 * assignment lookups, so membership can't become a back door around a lapsed plan).
 */
export async function getEntitledTeamMembership(
  org: Pick<Organization, 'id' | 'planId' | 'accountKind'>,
  teamId: string,
  userId: string,
): Promise<TeamStaffMembership | null> {
  const membership = await getActiveTeamMembership(org.id, teamId, userId);
  if (!membership) return null;
  if (isTeamWorkspaceOrg(org)) {
    const entitled = await getActiveTeamEntitledRepTeamIds(org.id);
    if (!entitled.has(teamId)) return null;
  }
  return membership;
}

/**
 * The staff routes' shared gate: signed in → this org → this team → ACTIVE head-coach membership.
 * The team and membership lookups are independent, so they run together — this is the resolver
 * three staff routes (list, per-member, invite) used to hand-copy, one serial await apiece.
 */
export async function requireHeadCoachMembership(
  orgSlug: string,
  teamId: string,
  deniedMessage = 'Only the head coach manages the coaching staff.',
): Promise<
  | { error: Response }
  | {
      ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
      team: NonNullable<Awaited<ReturnType<typeof getRepTeam>>>;
      membership: TeamStaffMembership;
      capabilities: CoachCapabilities;
    }
> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const [team, membership] = await Promise.all([
    getRepTeam(teamId),
    getEntitledTeamMembership(ctx.org, teamId, ctx.user.id),
  ]);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  if (!membership) return { error: forbidden() };

  const capabilities = resolveMembershipCapabilities(membership);
  const denied = denyUnless(capabilities.isHeadCoach, deniedMessage);
  if (denied) return { error: denied };

  return { ctx, team, membership, capabilities };
}

export async function getActiveMembershipsForUser(
  orgId: string,
  userId: string,
): Promise<TeamStaffMembership[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_staff_memberships')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []).map(r => mapMembership(r as MembershipRow));
}

/** Team ids this user may open in this org — the one-call filter for nav/context lists. */
export async function getActiveMembershipTeamIds(
  orgId: string,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_staff_memberships')
    .select('team_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;
  return new Set((data ?? []).map(r => r.team_id as string));
}

export async function getTeamStaffMembershipById(id: string): Promise<TeamStaffMembership | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_staff_memberships')
    .select('*')
    .eq('id', id)
    .maybeSingle<MembershipRow>();
  if (error) throw error;
  return data ? mapMembership(data) : null;
}

/** Every ACTIVE member of a team's staff (head coach first, then assistants oldest-first). */
export async function getTeamStaffMembershipList(teamId: string): Promise<TeamStaffMembership[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_staff_memberships')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? [])
    .map(r => mapMembership(r as MembershipRow))
    .sort((a, b) => {
      if (a.coachRole !== b.coachRole) return a.coachRole === 'head_coach' ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export interface TeamStaffPanelMember extends TeamStaffMembership {
  displayName: string | null;
  email: string | null;
}

/** The staff panel's list: active memberships + display identities (one shared recipe in db.ts). */
export async function getTeamStaffPanelList(
  teamId: string,
  orgId: string,
): Promise<TeamStaffPanelMember[]> {
  const members = await getTeamStaffMembershipList(teamId);
  if (members.length === 0) return [];
  const identities = await resolveCoachUserIdentities(orgId, members.map(m => m.userId));
  return members.map(m => ({
    ...m,
    displayName: identities.get(m.userId)?.displayName ?? null,
    email: identities.get(m.userId)?.email ?? null,
  }));
}

/**
 * Write a program year's staff RECORD rows from the team's active memberships (role +
 * capabilities, one insert per member). Called by both rollover paths when a new season is
 * created, so every season names its staff and the write routes see their rows. Returns the ids
 * of rows THIS call created.
 *
 * ⚠ Deliberately SEQUENTIAL: the standalone rollover accumulates the returned ids into its
 * revert-on-failure cleanup, and a parallel fan-out that fails midway would strand rows it never
 * learned the ids of. Staff lists are small; correctness of the revert wins over the round trips.
 *
 * ⚠ COLLISION-TOLERANT (adversarial review): the moment the new year exists it is "the live
 * season", so any concurrent membership write (a grant toggle, an invite acceptance) may project
 * the same member onto it first. That used to surface as a unique-key throw, which the callers'
 * failure handling then answered by DELETING THE WHOLE JUST-CREATED YEAR — cascading away the
 * concurrent writer's already-committed row. A duplicate here now converges instead of throwing.
 */
export async function projectMembershipsOntoProgramYear(
  teamId: string,
  orgId: string,
  programYearId: string,
): Promise<string[]> {
  const members = await getTeamStaffMembershipList(teamId);
  const createdIds: string[] = [];
  for (const m of members) {
    try {
      const created = await addRepTeamCoach(
        programYearId, teamId, orgId, m.userId, m.coachRole, m.capabilities,
      );
      createdIds.push(created.id);
    } catch (e) {
      if ((e as { code?: string })?.code !== '23505') throw e;
      // A concurrent sync won the insert — converge the row to the membership instead.
      const existing = await getRepTeamCoachForUserYear(programYearId, m.userId);
      if (existing) await patchProjectionRow(existing.id, m, existing);
    }
  }
  return createdIds;
}

export interface AddStaffMemberInput {
  orgId: string;
  teamId: string;
  userId: string;
  coachRole: 'head_coach' | 'assistant_coach';
  /** Initial grants. Omit/null on a REACTIVATION to restore the stored ones ("nothing was destroyed"). */
  capabilities?: AssistantCapabilityGrants | null;
}

/**
 * Add someone to the team's staff — or reactivate their revoked membership. Also writes the
 * live-season projection row (when the team currently has a draft/active year) so the write
 * routes admit them immediately.
 *
 * One upsert on the `(team_id, user_id)` unique key. `capabilities` is sent only when the caller
 * provided real grants: on a fresh insert an omitted column lands as NULL (role defaults), and on
 * a reactivation an unsent column is left exactly as stored — which is the ruling's "re-adding
 * restores their access" with no second read. An EMPTY grants object is treated as "none
 * provided" — `{}` and NULL read identically through `resolveCoachCapabilities`, but as an upsert
 * payload `{}` would overwrite (and thereby erase) the stored bundle.
 */
export async function addStaffMember(input: AddStaffMemberInput): Promise<TeamStaffMembership> {
  const payload: Record<string, unknown> = {
    org_id: input.orgId,
    team_id: input.teamId,
    user_id: input.userId,
    coach_role: input.coachRole,
    status: 'active',
    revoked_at: null,
    revoked_by: null,
  };
  if (input.capabilities && Object.keys(input.capabilities).length > 0) {
    payload.capabilities = input.capabilities;
  }
  const { data, error } = await supabaseAdmin
    .from('rep_team_staff_memberships')
    .upsert(payload, { onConflict: 'team_id,user_id' })
    .select('*')
    .single<MembershipRow>();
  if (error) throw error;
  const membership = mapMembership(data);

  await syncLiveSeasonProjection(membership);
  return membership;
}

/**
 * Remove someone from the team — everywhere, at once.
 *
 * ORDER MATTERS (see the module header): (1) delete the live season's projection row — the write
 * routes' key — then (2) flip the membership to revoked (the read gate), then (3) best-effort
 * guest-org-membership cleanup. Every prefix of that sequence is safe, and re-running heals a
 * half-done removal because step 1 runs UNCONDITIONALLY — it never asks the membership first.
 * Returns whether an active membership was actually revoked (false = there was nothing active;
 * the row cleanup still ran, which is what makes a second click a repair rather than a no-op).
 */
export async function removeStaffMember(
  orgId: string,
  teamId: string,
  userId: string,
  revokedBy: string,
): Promise<boolean> {
  const liveYearId = await getLiveRepProgramYearIdStrict(teamId);
  if (liveYearId) await deleteProjectionRow(liveYearId, userId);

  const { data, error } = await supabaseAdmin
    .from('rep_team_staff_memberships')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_by: revokedBy })
    .eq('org_id', orgId)
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .select('id')
    .maybeSingle<{ id: string }>();
  if (error) throw error;

  // Best-effort: the removal itself is complete; a failed guest-row cleanup must not 500 an
  // action that succeeded (it only leaves a capability-less org membership to clean up later).
  await cleanupOrphanedGuestOrgMembership(orgId, userId).catch((e) => {
    console.error('[coach-membership] guest org-membership cleanup failed (removal succeeded):', e);
  });
  return !!data;
}

/**
 * Update an assistant's grants — on the membership AND its live-season projection row.
 *
 * The WHERE re-asserts everything the caller believes about the target (house discipline —
 * check-then-act races land here): still this team's row, still ACTIVE, still an assistant.
 * Returns null when no such row exists any more — e.g. the assistant was removed after the
 * caller's screen loaded — so the route can answer honestly instead of silently editing a
 * revoked record (whose stored grants a future reactivation would then resurrect).
 */
export async function updateStaffMemberCapabilities(
  membershipId: string,
  teamId: string,
  grants: AssistantCapabilityGrants,
): Promise<TeamStaffMembership | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_staff_memberships')
    .update({ capabilities: grants })
    .eq('id', membershipId)
    .eq('team_id', teamId)
    .eq('status', 'active')
    .eq('coach_role', 'assistant_coach')
    .select('*')
    .maybeSingle<MembershipRow>();
  if (error) throw error;
  if (!data) return null;
  const membership = mapMembership(data);
  await syncLiveSeasonProjection(membership);
  return membership;
}

/** Mirror one field set onto an existing projection row when it diverges from the membership. */
async function patchProjectionRow(
  rowId: string,
  membership: TeamStaffMembership,
  existing: { coachRole: 'head_coach' | 'assistant_coach'; capabilities: AssistantCapabilityGrants | null },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (existing.coachRole !== membership.coachRole) patch.coach_role = membership.coachRole;
  if (JSON.stringify(existing.capabilities ?? null) !== JSON.stringify(membership.capabilities ?? null)) {
    patch.capabilities = membership.capabilities;
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin
      .from('rep_team_coaches')
      .update(patch)
      .eq('id', rowId);
    if (error) throw error;
  }
}

/**
 * Reconcile the LIVE season's `rep_team_coaches` row with a membership (role + capabilities).
 * No live season ⇒ nothing to project (the between-seasons state). A REVOKED membership deletes
 * any lingering row — so a sync arriving after a concurrent removal converges to "out", instead
 * of leaving a stray key behind (adversarial review: the race that used to strand a revoked
 * coach's write access for a whole season).
 */
export async function syncLiveSeasonProjection(membership: TeamStaffMembership): Promise<void> {
  const liveYearId = await getLiveRepProgramYearIdStrict(membership.teamId);
  if (!liveYearId) return;

  if (membership.status !== 'active') {
    await deleteProjectionRow(liveYearId, membership.userId);
    return;
  }

  const existing = await getRepTeamCoachForUserYear(liveYearId, membership.userId);
  if (existing) {
    await patchProjectionRow(existing.id, membership, existing);
    return;
  }

  try {
    await addRepTeamCoach(
      liveYearId, membership.teamId, membership.orgId, membership.userId,
      membership.coachRole, membership.capabilities,
    );
  } catch (e) {
    if ((e as { code?: string })?.code !== '23505') throw e;
    // Lost an insert race (e.g. a season-creation projection loop) — converge instead.
    const row = await getRepTeamCoachForUserYear(liveYearId, membership.userId);
    if (row) await patchProjectionRow(row.id, membership, row);
    return;
  }

  // Post-insert compensation: if a concurrent removal revoked this membership between our
  // status read and the insert, the row we just wrote is a stray key — take it back out. One
  // point read on a rare path buys convergence in every interleaving of add vs remove.
  const still = await getActiveTeamMembership(membership.orgId, membership.teamId, membership.userId);
  if (!still) await deleteProjectionRow(liveYearId, membership.userId);
}

/**
 * Drop a user's capability-less `role='coach'` org membership once they hold NO active team
 * membership in the org. (The db.ts sibling of this check reads `rep_team_coaches` rows — a
 * premise M1 expired: closed seasons' rows are permanent now, so "any row remains" stopped
 * meaning "still coaches something". Membership is the question.)
 */
async function cleanupOrphanedGuestOrgMembership(orgId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_staff_memberships')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);
  if (error) throw error;
  if (data && data.length > 0) return; // still on a team's staff in this org
  await supabaseAdmin
    .from('organization_members')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('role', 'coach');
}
