import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getOrganizationBySlug, getPublicTournamentBySlug } from './db';

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

/** True only if `teamId` is a real team in the tournament named by the slugs (public, live org). */
export async function teamBelongsToTournament(
  orgSlug: string,
  tournamentSlug: string,
  teamId: string,
): Promise<boolean> {
  if (!UUID_RE.test(teamId)) return false;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.subscriptionStatus === 'canceled') return false;
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
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
