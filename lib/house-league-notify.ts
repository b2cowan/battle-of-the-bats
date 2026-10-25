import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { canHouseLeague } from './house-league-access';
import type { Organization, OrgRole } from './types';

/**
 * The club's house-league desk — the members a family's house-league ask is for (Club Tier 9b-2: "Ask to withdraw a
 * child"). The one gate decides (`register`: the owner, a club admin, a league admin, a league registrar, holding the
 * house league), never a role list of its own. ⚠ Never hand `notify()` an EMPTY list: it falls back to every member
 * (lib/notify-recipients.ts) — the caller skips the notice when this returns none.
 */
export async function houseLeagueDeskUserIds(org: Organization): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, role, capabilities')
    .eq('organization_id', org.id)   // ⚠ organization_id, not org_id — this table predates the convention
    .eq('status', 'active');
  if (error) throw error;
  const members = (data ?? []) as { user_id: string | null; role: OrgRole; capabilities: Record<string, boolean> | null }[];
  return members
    .filter(m => m.user_id && canHouseLeague({ role: m.role, capabilities: m.capabilities ?? {} }, org, 'register'))
    .map(m => m.user_id!) ;
}
