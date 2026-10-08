import { supabaseAdmin } from './supabase-admin';

/**
 * Single-org-by-default policy helpers (decision 2026-06-19, see
 * docs/projects/active/ONE_TO_ONE_VS_MULTI_ORG_DECISION_ANALYSIS.md).
 *
 * The platform is "single-org by default, multi-membership by deliberate exception." A user
 * joins a second organization only by a deliberate invite or a Coaches Portal purchase — never
 * by self-creating an empty workspace. A person's OWN Coaches Portal (a `team_workspace` stub
 * org) is always EXEMPT from the one-org rule, so a standalone coach can also hold a club role
 * under a single login.
 *
 * ⚖ Since 2026-09-25 (Club Tier Stage 1, A03) JOINING is governed by Verified Network (2026-07-24):
 * invite, accept and reinstate ask `checkCrossOrgJoin` below — non-owner membership is open across
 * organizations and only a scorekeeper keeps one home org. `userBelongsToOtherRealOrg` remains the
 * OWNERSHIP-axis question for creating an organization, and nothing else.
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

export type CrossOrgJoinCheck =
  | { blocked: false }
  | {
      blocked: true;
      /** 'scorekeeper_elsewhere': they keep score for another org · 'joining_as_scorekeeper': they
       *  belong to another org and are being made a scorekeeper here. Callers phrase the refusal. */
      reason: 'scorekeeper_elsewhere' | 'joining_as_scorekeeper';
    };

/**
 * MAY THIS PERSON JOIN THIS ORGANIZATION IN THIS ROLE? — invite, accept and reinstate all ask
 * this, and nothing else decides it (A03, Club Tier Stage 1).
 *
 * ⚖ VERIFIED NETWORK (owner ruling 2026-07-24, applied here 2026-09-25 by owner choice over the
 * narrower fix the Stage 1 prompt described): the MEMBERSHIP axis is open. Belonging to, sitting on
 * the board of, or coaching for any number of organizations is free and unlimited — a club
 * treasurer may be another association's admin. The ruling's one exception holds: a SCOREKEEPER
 * keeps one home organization (officiating conflict of interest). So the refusal fires only when
 *   · the role being given here is `official` and they hold another organization's membership, or
 *   · they are a scorekeeper for another organization.
 *
 * What never counts as "another organization": a standalone coach's own Coaches Portal, a
 * `coach`-role row (the capability-less plumbing every staff invite writes since 2026-08-16 — the
 * defect this replaced counted those, so anyone who coached anywhere could not join a club's board),
 * a pending ('invited') row, and a suspended row. The owning axis (a second PAID organization) is
 * decided at org creation, not here.
 *
 * A soft product gate, not a security boundary: a read error logs and allows (as before).
 */
export async function checkCrossOrgJoin(
  userId: string,
  joiningOrgId: string,
  joiningRole: string,
): Promise<CrossOrgJoinCheck> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, role, organizations(account_kind, plan_id)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('organization_id', joiningOrgId);
  if (error) {
    console.error('[org-membership-policy] checkCrossOrgJoin read failed:', error);
    return { blocked: false };
  }
  const elsewhere = (data ?? []).filter(row =>
    row.role !== 'coach' && !isTeamWorkspaceRelation(row.organizations as OrgRel | OrgRel[] | null));
  if (elsewhere.some(row => row.role === 'official')) return { blocked: true, reason: 'scorekeeper_elsewhere' };
  if (joiningRole === 'official' && elsewhere.length > 0) return { blocked: true, reason: 'joining_as_scorekeeper' };
  return { blocked: false };
}

/** The refusal sentence for the admin sending an invite or reinstating someone. */
export function crossOrgJoinRefusalForAdmin(check: Extract<CrossOrgJoinCheck, { blocked: true }>): string {
  return check.reason === 'scorekeeper_elsewhere'
    ? 'This person volunteers for another organization. A volunteer keeps one home organization, so they would need to leave it before joining here.'
    : 'This person belongs to another organization. A volunteer keeps one home organization, so invite them in another role, or ask them to leave it first.';
}

/** The refusal sentence for the person accepting the invitation. */
export function crossOrgJoinRefusalForInvitee(check: Extract<CrossOrgJoinCheck, { blocked: true }>): string {
  return check.reason === 'scorekeeper_elsewhere'
    ? 'You volunteer for another organization, and a volunteer keeps one home organization. Ask that organization to remove you before joining this one.'
    : 'This invitation is for a volunteer, and a volunteer keeps one home organization. Ask the club that invited you to choose another role.';
}

// getActiveOrgWorkspaceCount was removed here (Nav Unification Stage A): its raw
// organization_members count fed the "All Workspaces" gate but missed coach/official-shaped
// places. Stage C then deleted /api/me/workspaces entirely — chrome reads the places list
// client-side via useRoleSummary, derived from the shared context resolver
// (lib/user-contexts filterWorkspaceContexts), the same list Home's Workspaces render.
// Do not reintroduce a parallel count.
