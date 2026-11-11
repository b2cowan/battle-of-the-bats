import { supabaseAdmin } from './supabase-admin';
import { isTeamWorkspaceOrg } from './team-workspace-kind';

/**
 * "LOST YOUR PHONE?" — which version the person sees (Board Ready · two-step sign-in, Part 2; drawings tab 4). Decided by
 * the account's seats AFTER the password matched, so the screen never tells a stranger anything; and even then it never
 * names the club or anyone in it.
 *
 *   club     a seat in exactly one organization (not a coach's own team): "Ask your club" (its owner or an admin can
 *            reset it, ask 3), plus "Are you the club's owner?" (support, with the 24-hour wait)
 *   support  everyone else: a coach's own team, a parent, an account in more than one organization (a club resets only
 *            people whose account reaches no other organization)
 *
 * ⚠ ONE PLACE PART 3 CHANGES: the club version points at Part 3's reset door, which does not exist yet. Until it does,
 * everyone gets the support version (`CLUB_RESET_DOOR_BUILT`). Part 3 flips it, and refines "reaches no other
 * organization" to the rule its reset applies, so the screen and the door can never disagree.
 */
export const CLUB_RESET_DOOR_BUILT = false;

export type LostPhoneVersion = 'club' | 'support';

type Row = { organization_id: string; organizations: { account_kind: string | null; plan_id: string | null } | null };

export async function lostPhoneVersion(userId: string, doorBuilt: boolean = CLUB_RESET_DOOR_BUILT): Promise<LostPhoneVersion> {
  if (!doorBuilt) return 'support';
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, organizations(account_kind, plan_id)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .returns<Row[]>();
  if (error) return 'support';
  const orgs = new Map((data ?? []).map(r => [r.organization_id, r.organizations]));
  if (orgs.size !== 1) return 'support';
  const [org] = [...orgs.values()];
  if (!org || isTeamWorkspaceOrg({ accountKind: org.account_kind, planId: org.plan_id })) return 'support';
  return 'club';
}
