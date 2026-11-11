import { supabaseAdmin } from './supabase-admin';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { accountIsClubResettable, accountReachesAnotherPlace } from './two-step-club-reset';

/**
 * "LOST YOUR PHONE?" — which version the person sees (Board Ready · two-step sign-in, Parts 2 and 3; drawings tab 4).
 * Decided by the account's seats AFTER the password matched, so the screen never tells a stranger anything; and even then
 * it never names the club or anyone in it.
 *
 *   club     the club's reset can reach this account: a seat in exactly one organization (not a coach's own team), and
 *            nothing beyond it (lib/two-step-club-reset.ts, the SAME rule the club's door applies). "Ask your club", plus
 *            "Are you the club's owner?" (support, with the 24-hour wait) — the owner reads the same screen, so it says
 *            nothing about which seat this account holds.
 *   support  everyone else: a coach's own team, a parent, an account that reaches another organization, platform staff.
 *
 * The club's door exists since Part 3 (`CLUB_RESET_DOOR_BUILT`), so the club version is live.
 */
export const CLUB_RESET_DOOR_BUILT = true;

export type LostPhoneVersion = 'club' | 'support';

type Row = { organization_id: string; organizations: { account_kind: string | null; plan_id: string | null } | null };

export async function lostPhoneVersion(
  userId: string,
  email: string | null | undefined,
  doorBuilt: boolean = CLUB_RESET_DOOR_BUILT,
): Promise<LostPhoneVersion> {
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
  const [[orgId, org]] = [...orgs.entries()];
  if (!org || isTeamWorkspaceOrg({ accountKind: org.account_kind, planId: org.plan_id })) return 'support';
  const [resettable, elsewhere] = await Promise.all([
    accountIsClubResettable(email),
    accountReachesAnotherPlace(userId, orgId),
  ]);
  return resettable && !elsewhere ? 'club' : 'support';
}
