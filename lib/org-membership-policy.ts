import { supabaseAdmin } from './supabase-admin';

/**
 * Single-org-by-default policy helpers (decision 2026-06-19, see
 * docs/projects/active/ONE_TO_ONE_VS_MULTI_ORG_DECISION_ANALYSIS.md).
 *
 * The platform is "single-org by default, multi-membership by deliberate exception." A user
 * joins a second organization only by a deliberate invite or a Coaches Portal purchase — never
 * by self-creating an empty workspace. A person's OWN Coaches Portal (a `team_workspace` stub
 * org) is always EXEMPT from the one-org rule, so a standalone coach can also hold a club role
 * under a single login. These helpers are the single source of truth for that rule across
 * org-create, invite, and accept.
 */

type OrgRel = {
  id?: string;
  slug?: string | null;
  account_kind?: string | null;
  plan_id?: string | null;
};

function firstRel(o: OrgRel | OrgRel[] | null | undefined): OrgRel | null {
  if (Array.isArray(o)) return o[0] ?? null;
  return o ?? null;
}

/** A standalone Coaches Portal stub org (`account_kind='team_workspace'` / `plan_id='team'`). */
export function isTeamWorkspaceRelation(o: OrgRel | OrgRel[] | null | undefined): boolean {
  const r = firstRel(o);
  return r?.account_kind === 'team_workspace' || r?.plan_id === 'team';
}

/**
 * Does this user already have an ACTIVE membership in a REAL organization other than
 * `excludeOrgId`? Only `active` rows count — a `suspended` membership has no live access, and
 * counting it the same as active would falsely block an invite (and disagree with org-create,
 * which also counts active-only). The user's own Coaches Portal never counts; pending ('invited')
 * rows never count. Pass the org being joined as `excludeOrgId` so a same-org row doesn't self-block.
 */
export async function userBelongsToOtherRealOrg(userId: string, excludeOrgId?: string): Promise<boolean> {
  let query = supabaseAdmin
    .from('organization_members')
    .select('organization_id, organizations(account_kind, plan_id)')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (excludeOrgId) query = query.neq('organization_id', excludeOrgId);

  const { data, error } = await query;
  if (error) {
    // This is a soft product gate, not a security boundary. Don't block a legitimate invite/accept
    // on a transient read error — log and fail open (worst case is a rare extra membership an admin
    // can remove). Never swallow the error silently.
    console.error('[org-membership-policy] userBelongsToOtherRealOrg read failed:', error);
    return false;
  }
  return (data ?? []).some(row => !isTeamWorkspaceRelation(row.organizations as OrgRel | OrgRel[] | null));
}

/** Count of distinct org workspaces the user is an ACTIVE member of (one row per org). */
export async function getActiveOrgWorkspaceCount(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');
  return count ?? 0;
}
