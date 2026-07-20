import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getOrganizationBySlug, getPublicTournamentBySlug } from './db';
import { resolveFollowableOrgsByIds, type OrgDirectoryResult } from './directory';

/**
 * lib/fan-follows.ts — server-side data layer for account-linked fan follows
 * (unified-app Phase 2). A fan_follows row IS the authorization for "is this user
 * following X"; presence of the row is the gate (mirrors lib/basic-coach-teams).
 * Service-role only (RLS-walled table) — always via supabaseAdmin, never the anon
 * client. Distinct from lib/follow.ts (anonymous device localStorage), which stays.
 */

export type FanFollowEntityType = 'tournament' | 'team' | 'org';
export type FanFollowSource = 'manual' | 'directory' | 'qr' | 'device_reconcile' | 'registration';

/** Matches a canonical UUID (case-insensitive). */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The one public-visibility gate for slug-addressed tournaments: live (non-canceled)
 *  org + publicly-visible tournament (active|completed via getPublicTournamentBySlug).
 *  Shared by every follow read/write so the gate can never drift between them. */
async function resolvePublicTournament(
  orgSlug: string,
  tournamentSlug: string,
): Promise<{ id: string; name: string } | null> {
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.subscriptionStatus === 'canceled') return null;
  return await getPublicTournamentBySlug(org.id, tournamentSlug);
}

/** Resolve a followable WHOLE-TOURNAMENT target from its slugs — the Phase-6 gate before
 *  recording a `tournament` follow (entity_id = tournaments.id). Returns id + display name,
 *  or null when the org/tournament fails the same public-visibility gate every follow read
 *  uses, so a whole-event follow can never point at a draft/hidden/canceled event. */
export async function resolveFollowableTournament(
  orgSlug: string,
  tournamentSlug: string,
): Promise<{ id: string; name: string } | null> {
  const t = await resolvePublicTournament(orgSlug, tournamentSlug);
  return t ? { id: t.id, name: t.name } : null;
}

/** Resolve a tournament id from its slugs REGARDLESS of public-visibility status — used ONLY to
 *  DELETE a follow on unfollow, never to create one. An explicit unfollow must always remove the
 *  row even if the tournament has since gone draft/private; otherwise the row lingers and the
 *  follow silently resurrects if the tournament later becomes eligible again. */
export async function resolveTournamentIdForUnfollow(orgSlug: string, tournamentSlug: string): Promise<string | null> {
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return null;
  const { data } = await supabaseAdmin
    .from('tournaments')
    .select('id')
    .eq('org_id', org.id)
    .eq('slug', tournamentSlug)
    .maybeSingle();
  return data?.id ?? null;
}

/** Resolve an org id from its slug REGARDLESS of eligibility — used ONLY to DELETE a follow on
 *  unfollow (same rationale as resolveTournamentIdForUnfollow). */
export async function resolveOrgIdForUnfollow(orgSlug: string): Promise<string | null> {
  const org = await getOrganizationBySlug(orgSlug);
  return org?.id ?? null;
}

/** True only if `teamId` is a real team in the tournament named by the slugs (public, live org). */
export async function teamBelongsToTournament(
  orgSlug: string,
  tournamentSlug: string,
  teamId: string,
): Promise<boolean> {
  if (!UUID_RE.test(teamId)) return false;
  const tournament = await resolvePublicTournament(orgSlug, tournamentSlug);
  if (!tournament) return false;
  const { data } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('tournament_id', tournament.id)
    .maybeSingle();
  return !!data;
}

export interface FanFollow {
  id: string;
  userId: string;
  entityType: FanFollowEntityType;
  entityId: string;
  source: string;
  createdAt: string;
}

/** A followed team resolved to the info the consumer surfaces need to link + label it. */
export interface FollowedTeamAccount {
  followId: string;
  teamId: string;
  teamName: string;
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
}

interface FanFollowRow {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  source: string;
  created_at: string;
}

function mapFanFollow(row: FanFollowRow): FanFollow {
  return {
    id: row.id,
    userId: row.user_id,
    entityType: row.entity_type as FanFollowEntityType,
    entityId: row.entity_id,
    source: row.source,
    createdAt: row.created_at,
  };
}

/** Every follow this user holds, newest first. */
export async function getFanFollowsForUser(userId: string): Promise<FanFollow[]> {
  const { data, error } = await supabaseAdmin
    .from('fan_follows')
    .select('id, user_id, entity_type, entity_id, source, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapFanFollow);
}

/** Presence-is-authorization check for a single entity. */
export async function isUserFollowing(
  userId: string,
  entityType: FanFollowEntityType,
  entityId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('fan_follows')
    .select('id')
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** How many accounts follow a given entity (follower count). */
export async function countFollowersForEntity(
  entityType: FanFollowEntityType,
  entityId: string,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('fan_follows')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  if (error) throw error;
  return count ?? 0;
}

/** Lightweight summary for the access-context builder (avoids loading every row). */
export async function getFanFollowSummary(userId: string): Promise<{ followCount: number }> {
  const { count, error } = await supabaseAdmin
    .from('fan_follows')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return { followCount: count ?? 0 };
}

/** Idempotent follow (upsert on the (user, entity) unique index). */
export async function followEntity(params: {
  userId: string;
  entityType: FanFollowEntityType;
  entityId: string;
  source?: FanFollowSource;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('fan_follows')
    .upsert(
      {
        user_id: params.userId,
        entity_type: params.entityType,
        entity_id: params.entityId,
        source: params.source ?? 'manual',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,entity_type,entity_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** Remove a follow (hard delete — no soft-unfollow audit trail in Slice 1). */
export async function unfollowEntity(
  userId: string,
  entityType: FanFollowEntityType,
  entityId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('fan_follows')
    .delete()
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  if (error) throw error;
}

/** One account follow scoped to a single tournament (N2 — public-page hydration).
 *  divisionId rides along so a seeded device pin can drive division-scoped surfaces. */
export interface TournamentAccountFollow {
  teamId: string;
  teamName: string;
  divisionId: string | null;
}

/**
 * This user's account follows WITHIN one public tournament, newest-first (N2).
 * Backs GET /api/consumer/follows so signed-in public pages can display merged
 * account+device follow state. Resolves the tournament through the same public
 * gates as teamBelongsToTournament (live org, active|completed tournament) — a
 * draft/hidden tournament returns [] rather than leaking team rows.
 */
export async function getAccountFollowsForTournament(
  userId: string,
  orgSlug: string,
  tournamentSlug: string,
): Promise<TournamentAccountFollow[]> {
  // The user's follow list is independent of the org→tournament resolution chain —
  // run them concurrently. The 500 cap is a guardrail, not a product limit (this
  // fetches the user's follows across ALL tournaments to filter down to one).
  const [tournament, { data: follows, error: followErr }] = await Promise.all([
    resolvePublicTournament(orgSlug, tournamentSlug),
    supabaseAdmin
      .from('fan_follows')
      .select('entity_id, created_at')
      .eq('user_id', userId)
      .eq('entity_type', 'team')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  if (followErr) throw followErr;
  if (!tournament) return [];

  const followedIds = (follows ?? []).map(f => f.entity_id);
  if (followedIds.length === 0) return [];

  const { data: teams, error: teamErr } = await supabaseAdmin
    .from('teams')
    .select('id, name, division_id')
    .eq('tournament_id', tournament.id)
    .in('id', followedIds);
  if (teamErr) throw teamErr;

  const teamById = new Map(
    ((teams ?? []) as Array<{ id: string; name: string; division_id: string | null }>).map(t => [t.id, t] as const),
  );
  // Preserve the newest-first follow order from fan_follows.
  const out: TournamentAccountFollow[] = [];
  for (const id of followedIds) {
    const team = teamById.get(id);
    if (team) out.push({ teamId: team.id, teamName: team.name, divisionId: team.division_id });
  }
  return out;
}

/**
 * Resolve this user's TEAM follows to display info (team + its tournament + org),
 * skipping teams whose tournament/org has vanished or whose org is canceled — so
 * the Follows feed never renders a dead link.
 */
export async function getFollowedTeamsForUser(userId: string): Promise<FollowedTeamAccount[]> {
  const follows = await getFanFollowsForUser(userId);
  const teamFollows = follows.filter(f => f.entityType === 'team');
  if (teamFollows.length === 0) return [];

  const teamIds = Array.from(new Set(teamFollows.map(f => f.entityId)));
  const { data: teamRows, error: teamErr } = await supabaseAdmin
    .from('teams')
    .select('id, name, tournament_id')
    .in('id', teamIds);
  if (teamErr) throw teamErr;
  const teams = teamRows ?? [];
  if (teams.length === 0) return [];

  // Guard every .in() against an empty array — postgrest serializes `in.()` as a malformed
  // filter (not a safe no-op), so an orphaned follow whose team/tournament row is gone must
  // short-circuit rather than throw and 500 the whole Follows feed (mirrors lib/basic-coach-teams).
  const tournamentIds = Array.from(new Set(teams.map(t => t.tournament_id).filter(Boolean)));
  const { data: tournRows, error: tournErr } = tournamentIds.length > 0
    ? await supabaseAdmin.from('tournaments').select('id, name, slug, org_id').in('id', tournamentIds)
    : { data: [], error: null };
  if (tournErr) throw tournErr;
  const tournById = new Map((tournRows ?? []).map(t => [t.id, t]));

  const orgIds = Array.from(new Set((tournRows ?? []).map(t => t.org_id).filter(Boolean)));
  const { data: orgRows, error: orgErr } = orgIds.length > 0
    ? await supabaseAdmin.from('organizations').select('id, slug, subscription_status').in('id', orgIds)
    : { data: [], error: null };
  if (orgErr) throw orgErr;
  const orgById = new Map((orgRows ?? []).map(o => [o.id, o]));

  // Preserve follow order (newest first) from teamFollows.
  const teamById = new Map(teams.map(t => [t.id, t]));
  const out: FollowedTeamAccount[] = [];
  for (const f of teamFollows) {
    const team = teamById.get(f.entityId);
    if (!team) continue;
    const tourn = tournById.get(team.tournament_id);
    if (!tourn) continue;
    const org = orgById.get(tourn.org_id);
    if (!org || org.subscription_status === 'canceled') continue;
    out.push({
      followId: f.id,
      teamId: team.id,
      teamName: team.name,
      orgSlug: org.slug,
      tournamentSlug: tourn.slug,
      tournamentName: tourn.name,
    });
  }
  return out;
}

/* ── Phase 6: whole-tournament + organization follow resolvers ─────────────────
   Same clean-drop posture as getFollowedTeamsForUser — a follow whose entity has
   vanished or whose org is canceled/ineligible is silently dropped so the consumer
   surfaces never render a dead card. These carry NO game status; the status
   vocabulary (lib/entity-follow-status.ts) enriches them separately. */

/** A followed WHOLE tournament resolved to link + label info. */
export interface FollowedTournamentAccount {
  followId: string;
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
}

/** A followed organization resolved to link + label info. */
export interface FollowedOrgAccount {
  followId: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  logoUrl: string | null;
}

/** This user's WHOLE-tournament follows, resolved through the same public-visibility gate as
 *  the team feed — dropping any whose tournament vanished / went non-public or whose org is
 *  canceled. Newest-follow-first (fan_follows order preserved). */
export async function getFollowedTournamentsForUser(userId: string): Promise<FollowedTournamentAccount[]> {
  const follows = (await getFanFollowsForUser(userId)).filter(f => f.entityType === 'tournament');
  if (follows.length === 0) return [];

  const ids = Array.from(new Set(follows.map(f => f.entityId)));
  const { data: tournRows, error: tErr } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, slug, org_id, status')
    .in('id', ids);
  if (tErr) throw tErr;
  // Only public-status tournaments can render a page (mirrors getPublicContext's PUBLIC_STATUSES).
  const tournById = new Map(
    ((tournRows ?? []) as Array<{ id: string; name: string; slug: string; org_id: string; status: string }>)
      .filter(t => t.status === 'active' || t.status === 'completed')
      .map(t => [t.id, t] as const),
  );
  if (tournById.size === 0) return [];

  const orgIds = Array.from(new Set(Array.from(tournById.values()).map(t => t.org_id).filter(Boolean)));
  const { data: orgRows, error: oErr } = orgIds.length > 0
    ? await supabaseAdmin.from('organizations').select('id, slug, subscription_status').in('id', orgIds)
    : { data: [], error: null };
  if (oErr) throw oErr;
  const orgById = new Map(((orgRows ?? []) as Array<{ id: string; slug: string; subscription_status: string | null }>).map(o => [o.id, o]));

  const out: FollowedTournamentAccount[] = [];
  for (const f of follows) {
    const tourn = tournById.get(f.entityId);
    if (!tourn) continue;
    const org = orgById.get(tourn.org_id);
    if (!org || org.subscription_status === 'canceled') continue;
    out.push({ followId: f.id, orgSlug: org.slug, tournamentSlug: tourn.slug, tournamentName: tourn.name });
  }
  return out;
}

/** This user's ORGANIZATION follows, resolved through the shared org-eligibility predicate
 *  (resolveFollowableOrgsByIds) — dropping any org that went private/canceled/team-workspace,
 *  so a stale org follow never renders a dead `/{orgSlug}` card. Newest-follow-first. */
export async function getFollowedOrgsForUser(userId: string): Promise<FollowedOrgAccount[]> {
  const follows = (await getFanFollowsForUser(userId)).filter(f => f.entityType === 'org');
  if (follows.length === 0) return [];

  const ids = Array.from(new Set(follows.map(f => f.entityId)));
  const orgById: Map<string, OrgDirectoryResult> = await resolveFollowableOrgsByIds(ids);

  const out: FollowedOrgAccount[] = [];
  for (const f of follows) {
    const org = orgById.get(f.entityId);
    if (!org) continue;
    out.push({ followId: f.id, orgId: org.id, orgSlug: org.orgSlug, orgName: org.orgName, logoUrl: org.logoUrl });
  }
  return out;
}
