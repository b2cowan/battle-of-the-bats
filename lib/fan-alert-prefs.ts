import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getOrganizationBySlug } from './db';
import { getFollowedTeamsForUser } from './fan-follows';
import { hasPlanFeature } from './plan-features';

/**
 * lib/fan-alert-prefs.ts — account-level fan alert preferences (unified-app
 * Phase 2 Slice 3; Business Decisions Log 2026-07-14: alerts require a signed-in
 * account). Two GLOBAL switches per user covering all followed teams; an absent
 * row means BOTH TRUE — only an explicit false suppresses a category. Service-role
 * only (RLS-walled, mirrors lib/fan-follows.ts) — always via supabaseAdmin.
 */

export interface FanAlertPrefs {
  gameAlerts: boolean;
  eventNews: boolean;
}

const FAN_ALERT_DEFAULTS: FanAlertPrefs = { gameAlerts: true, eventNews: true };

/** One user's prefs — defaults (both on) when no row exists. */
export async function getFanAlertPrefs(userId: string): Promise<FanAlertPrefs> {
  const { data, error } = await supabaseAdmin
    .from('fan_alert_prefs')
    .select('game_alerts, event_news')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...FAN_ALERT_DEFAULTS };
  return { gameAlerts: data.game_alerts, eventNews: data.event_news };
}

/**
 * Upsert a partial change (only the provided switches move). Deliberately NOT
 * read-modify-write: the upsert carries ONLY the patched column(s), so postgrest's
 * ON CONFLICT UPDATE touches just those — two near-simultaneous single-switch
 * saves (double-tap, two tabs) can't revert each other. On first INSERT the
 * omitted column takes its DB default (true), matching the absent-row semantics.
 */
export async function setFanAlertPrefs(userId: string, patch: Partial<FanAlertPrefs>): Promise<FanAlertPrefs> {
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (patch.gameAlerts !== undefined) row.game_alerts = patch.gameAlerts;
  if (patch.eventNews !== undefined) row.event_news = patch.eventNews;
  const { error } = await supabaseAdmin
    .from('fan_alert_prefs')
    .upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
  // Read-after-write so the response reflects the full authoritative row.
  return getFanAlertPrefs(userId);
}

/**
 * Dispatch-time filter: of these users, who has the given category ON?
 * Missing rows count as ON (defaults) — only an explicit false excludes.
 */
export async function filterUsersWithCategoryOn(
  userIds: string[],
  category: 'game_alerts' | 'event_news',
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('fan_alert_prefs')
    .select('user_id, game_alerts, event_news')
    .in('user_id', userIds);
  if (error) throw error;
  const off = new Set((data ?? []).filter(row => row[category] === false).map(row => row.user_id));
  return userIds.filter(id => !off.has(id));
}

/**
 * Everything the "Followed teams" card needs, in one call: the user's prefs,
 * how many teams they follow, and which followed events don't offer alerts
 * (the honest-gate line — free-tier orgs lack `fan_score_alerts`). Domain
 * logic lives here, not in the page, so future surfaces (bell, emails) don't
 * re-derive it. Returns null when the user follows nothing (no card to show).
 */
export async function getFanAlertOverview(userId: string): Promise<{
  teamCount: number;
  prefs: FanAlertPrefs;
  noAlertEvents: string[];
} | null> {
  const [follows, prefs] = await Promise.all([
    getFollowedTeamsForUser(userId),
    getFanAlertPrefs(userId),
  ]);
  if (follows.length === 0) return null;

  const uniqueOrgSlugs = Array.from(new Set(follows.map(f => f.orgSlug)));
  const orgs = await Promise.all(uniqueOrgSlugs.map(slug => getOrganizationBySlug(slug)));
  const gatedOrgs = new Set(
    orgs
      .filter((org): org is NonNullable<typeof org> => !!org && !hasPlanFeature(org.planId, 'fan_score_alerts'))
      .map(org => org.slug),
  );
  const noAlertEvents = Array.from(
    new Set(follows.filter(f => gatedOrgs.has(f.orgSlug)).map(f => f.tournamentName)),
  );

  return {
    teamCount: new Set(follows.map(f => f.teamId)).size,
    prefs,
    noAlertEvents,
  };
}
