import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { isGrantRunning, lastDayOfInstant } from './free-time';
import { PORTAL_FREE_TIME_GRANT_TYPE, endedLastDay } from './portal-free-time';

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
      .select('billing_mode, basic_coach_team_id')
      .eq('workspace_org_id', orgId)
      .maybeSingle<{ billing_mode: string | null; basic_coach_team_id: string | null }>(),
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
  if (ws?.billing_mode !== 'platform_override' || !grants?.[0]) return null;
  const lastDay = endedLastDay(grants[0]);
  return lastDay ? { lastDay, basicTeamId: ws.basic_coach_team_id } : null;
}

/**
 * Every Coaches Portal staff gave free time and nobody pays for (a portal billing-status grant, running or not, on a
 * workspace still billed `platform_override`). Not a customer (T35): Business numbers, the lead book's New accounts
 * and the Clubs list's Cancelled count leave them out, because the portal is stored cancelled for its whole life. ⚠ Not
 * the workspace's `source`: a Founding or comped portal is `platform_admin` too, and those ARE customers. Keep Premium
 * makes the portal `team_direct`, and from then on it counts like any paid portal.
 */
export async function freeTimePortalOrgIds(): Promise<Set<string>> {
  const { data: grants, error } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', PORTAL_FREE_TIME_GRANT_TYPE)
    .limit(5000);
  if (error) throw error;
  const orgIds = [...new Set((grants ?? []).map(g => g.org_id as string))];
  if (orgIds.length === 0) return new Set();
  const { data: ws, error: wsError } = await supabaseAdmin
    .from('team_workspaces')
    .select('workspace_org_id')
    .in('workspace_org_id', orgIds)
    .eq('billing_mode', 'platform_override');
  if (wsError) throw wsError;
  return new Set((ws ?? []).map(w => w.workspace_org_id as string));
}
