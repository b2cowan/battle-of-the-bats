import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { isGrantRunning, lastDayOfInstant } from './free-time';
import { PORTAL_FREE_TIME_GRANT_TYPE } from './portal-free-time';

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
