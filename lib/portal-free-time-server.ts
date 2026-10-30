import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { isGrantRunning, lastDayOfInstant } from './free-time';
import { PORTAL_FREE_TIME_GRANT_TYPE, endedLastDay, portalCustomerFreeTime, type PortalCustomerFreeTime } from './portal-free-time';

/**
 * Free time on a Coaches Portal (Support console Stage 4b): the server's reads. The rules and words are in
 * `lib/portal-free-time.ts`.
 */

export type RunningPortalFreeTime = { overrideId: string; lastDay: string; expiresAt: string };

/**
 * The free time holding this portal open right now, or null. Reads the grant itself, not the switch: a cancel must be
 * refused while a grant exists even on a server where grants are switched off (it would start the retention clock on
 * a portal staff gave). Throws on a read error so a cancel fails closed.
 */
export async function runningPortalFreeTime(orgId: string): Promise<RunningPortalFreeTime | null> {
  const { data, error } = await supabaseAdmin
    .from('org_overrides')
    .select('id, starts_at, expires_at, revoked_at')
    .eq('org_id', orgId)
    .eq('type', PORTAL_FREE_TIME_GRANT_TYPE)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const row = (data ?? []).find(r => r.expires_at && isGrantRunning(r));
  return row ? { overrideId: row.id, lastDay: lastDayOfInstant(row.expires_at!), expiresAt: row.expires_at! } : null;
}

export type EndedPortalFreeTime = { lastDay: string; basicTeamId: string | null };

/**
 * A portal staff gave free time that has since ended (by itself or early), or null. Only while the portal is still
 * billed by nobody (`platform_override`): after Keep Premium it is the coach's own subscription, and its later end is
 * an ordinary one. A Founding portal holds no billing-status grant, so it is never this. `basicTeamId` is the free
 * team the coach goes back to.
 */
export async function endedPortalFreeTime(orgId: string): Promise<EndedPortalFreeTime | null> {
  const [{ data: ws, error: wsError }, { data: grants, error }] = await Promise.all([
    supabaseAdmin
      .from('team_workspaces')
      .select('billing_mode, basic_coach_team_id, free_time_given_at')
      .eq('workspace_org_id', orgId)
      .maybeSingle<{ billing_mode: string | null; basic_coach_team_id: string | null; free_time_given_at: string | null }>(),
    supabaseAdmin
      .from('org_overrides')
      .select('starts_at, expires_at, revoked_at')
      .eq('org_id', orgId)
      .eq('type', PORTAL_FREE_TIME_GRANT_TYPE)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  if (wsError) throw wsError;
  if (error) throw error;
  // The give's mark is required, as `latestFreeTimeGrant` requires it: a comped or cancelled portal with an old grant on
  // it is not "free time that ended", and must not be told "Your free time has ended" (Stage 4b review).
  if (ws?.billing_mode !== 'platform_override' || !ws.free_time_given_at || !grants?.[0]) return null;
  const lastDay = endedLastDay(grants[0]);
  return lastDay ? { lastDay, basicTeamId: ws.basic_coach_team_id } : null;
}

/** The newest free-time grant on a portal staff gave free time and nobody pays for yet; null for any other portal. */
async function latestFreeTimeGrant(orgId: string): Promise<GrantFacts | null> {
  const [{ data: ws, error: wsError }, { data: grants, error }] = await Promise.all([
    supabaseAdmin
      .from('team_workspaces')
      .select('billing_mode, free_time_given_at')
      .eq('workspace_org_id', orgId)
      .maybeSingle<{ billing_mode: string | null; free_time_given_at: string | null }>(),
    supabaseAdmin
      .from('org_overrides')
      .select('starts_at, expires_at, revoked_at')
      .eq('org_id', orgId)
      .eq('type', PORTAL_FREE_TIME_GRANT_TYPE)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  if (wsError) throw wsError;
  if (error) throw error;
  if (ws?.billing_mode !== 'platform_override' || !ws.free_time_given_at) return null;
  return grants?.[0] ?? null;
}

type GrantFacts = { starts_at: string | null; expires_at: string | null; revoked_at: string | null };

/**
 * The coach's free time on this portal, for their Plan & billing page (Part 5): running, the last 14 days, or ended
 * for 30 days. Only a portal staff gave free time and nobody pays for: after Keep Premium it is an ordinary paid portal.
 */
export async function customerPortalFreeTime(orgId: string, now: Date = new Date()): Promise<PortalCustomerFreeTime | null> {
  return portalCustomerFreeTime(await latestFreeTimeGrant(orgId), now);
}

/**
 * The free team's saved Premium portal from free time, for its Overview (Part 5): present while the portal staff gave
 * is still billed by nobody (the coach's Premium work is kept there, Q1), with its free time's state (the day-after band
 * shows only while that reads ended).
 */
export async function savedFreeTimePortalOfTeam(
  basicTeamId: string,
  now: Date = new Date(),
): Promise<{ freeTime: PortalCustomerFreeTime | null } | null> {
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('workspace_org_id')
    .eq('basic_coach_team_id', basicTeamId)
    .not('free_time_given_at', 'is', null)
    .eq('billing_mode', 'platform_override')
    .maybeSingle<{ workspace_org_id: string }>();
  if (error) throw error;
  if (!data) return null;
  return { freeTime: await customerPortalFreeTime(data.workspace_org_id, now) };
}

/**
 * Every Coaches Portal staff gave free time and nobody pays for: the give's own mark (`free_time_given_at`, mig 406)
 * on a workspace still billed `platform_override`. Not a customer (T35): Business numbers, the lead book's New accounts
 * and the Clubs list's Cancelled count leave them out, because the portal is stored cancelled for its whole life. ⚠ Not
 * the workspace's `source`: a Founding or comped portal is `platform_admin` too, and those ARE customers. Keep Premium
 * makes the portal `team_direct`, and from then on it counts like any paid portal.
 */
export async function freeTimePortalOrgIds(): Promise<Set<string>> {
  const { data: ws, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('workspace_org_id')
    .not('free_time_given_at', 'is', null)
    .eq('billing_mode', 'platform_override')
    .limit(5000);
  if (error) throw error;
  return new Set((ws ?? []).map(w => w.workspace_org_id as string));
}

/**
 * What a handful of organizations read as when each may be a portal staff gave free time (Global Find's rows, the lead
 * book's offered clubs): the label for a portal that is, and nothing for any other organization. Throws on a read
 * error, so a caller says "unread" instead of showing the stored cancelled state (Stage 4b review).
 */
export async function freeTimePortalLabelsAmong(orgIds: string[]): Promise<Map<string, 'Free time' | 'Free time ended'>> {
  const out = new Map<string, 'Free time' | 'Free time ended'>();
  if (orgIds.length === 0) return out;
  const [{ data: ws, error: wsError }, { data: grants, error: grantError }] = await Promise.all([
    supabaseAdmin
      .from('team_workspaces')
      .select('workspace_org_id')
      .in('workspace_org_id', orgIds)
      .not('free_time_given_at', 'is', null)
      .eq('billing_mode', 'platform_override'),
    supabaseAdmin
      .from('org_overrides')
      .select('org_id, starts_at, expires_at, revoked_at')
      .in('org_id', orgIds)
      .eq('type', PORTAL_FREE_TIME_GRANT_TYPE)
      .is('revoked_at', null)
      .not('expires_at', 'is', null),
  ]);
  if (wsError) throw wsError;
  if (grantError) throw grantError;
  const running = new Set((grants ?? []).filter(g => isGrantRunning(g)).map(g => g.org_id as string));
  for (const w of ws ?? []) {
    const id = w.workspace_org_id as string;
    out.set(id, running.has(id) ? 'Free time' : 'Free time ended');
  }
  return out;
}

/**
 * Of the portals `freeTimePortalOrgIds` names, the ones whose free time is running right now. The give's mark stays on
 * after the free time ends (Keep Premium leaves it too; the billing mode is what moves), so the Clubs list reads this to
 * tell "Free time" from "Free time ended".
 */
export async function runningFreeTimePortalOrgIds(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id, starts_at, expires_at, revoked_at')
    .eq('type', PORTAL_FREE_TIME_GRANT_TYPE)
    .is('revoked_at', null)
    .not('expires_at', 'is', null)
    .limit(5000);
  if (error) throw error;
  return new Set((data ?? []).filter(r => isGrantRunning(r)).map(r => r.org_id as string));
}
