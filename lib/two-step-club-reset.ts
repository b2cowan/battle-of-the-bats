import { supabaseAdmin } from './supabase-admin';
import { isPlatformAdminEmail } from './platform-auth';
import { isTeamWorkspaceOrg } from './team-workspace-kind';

/**
 * WHO A CLUB MAY RESET (Board Ready · two-step sign-in, Part 3; drawings tab 6; ask 3, and the "any live tie" ruling of
 * 2026-11-11). The authenticator is the PERSON's, not the club's, so a club resets only someone whose account reaches no
 * other place. Read by the club's door (Members' Manage window, the team staff page's person window) AND by "Lost your
 * phone?" (lib/two-step-lost-phone.ts), so the screen and the door can never disagree.
 *
 * "Reaches another place" = any live tie, and when unsure, support resets it:
 *   - a seat in another organization, in ANY status (invited, active, suspended) — a coach's own Premium team is its own
 *     organization, so it counts here;
 *   - a free Coaches Portal team (it has no organization, but it is the person's own place);
 *   - coaching a house-league team in another club (that seat creates no club membership);
 *   - a family link to another club (anything but declined or revoked).
 * Platform staff are never the club's to reset.
 */

/** True when the account reaches anywhere beyond `orgId`, or when that could not be read (fails toward support). */
export async function accountReachesAnotherPlace(userId: string, orgId: string): Promise<boolean> {
  const [members, basic, league, family] = await Promise.all([
    supabaseAdmin.from('organization_members').select('organization_id', { count: 'exact', head: true })
      .eq('user_id', userId).neq('organization_id', orgId),
    supabaseAdmin.from('basic_coach_team_users').select('basic_coach_team_id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'active'),
    supabaseAdmin.from('league_team_coaches').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).neq('org_id', orgId).is('removed_at', null),
    supabaseAdmin.from('family_links').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).neq('org_id', orgId).not('status', 'in', '(declined,revoked)'),
  ]);
  for (const r of [members, basic, league, family]) {
    if (r.error || r.count === null) return true;
    if (r.count > 0) return true;
  }
  return false;
}

/** Is this account one a club could ever reset (not staff)? */
export async function accountIsClubResettable(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return !(await isPlatformAdminEmail(email));
}

export type ClubResetDoor =
  /** No door and nothing said: the viewer can't reset, it's yourself or the owner, or two-step is off. */
  | 'none'
  /** Two-step is on, but only support can reset it: one line, no reason given to the club. */
  | 'support'
  /**
   * The door would show, but the VIEWER's own two-step is off (owner ruling 2026-11-11, Part 3 /review call 1): one line,
   * "turn on two-step sign-in for your own account first". A stolen password for an unprotected admin must not be able to
   * strip someone else's protection.
   */
  | 'own_first'
  /** The door. */
  | 'club';

export const CLUB_RESET_VIEWER_ROLES = ['owner', 'admin'] as const;

/**
 * The door, decided from facts the caller has already read. Pure, so the window's GET and the reset's POST apply the
 * same rule (`clubResetDoorFor` below reads the facts).
 */
export function clubResetDoorRule(facts: {
  viewerRole: string | null | undefined;
  isSelf: boolean;
  targetRole: string | null | undefined;
  targetOn: boolean;
  orgIsTeamWorkspace: boolean;
  resettableAccount: boolean;
  reachesAnotherPlace: boolean;
  /** The viewer's own two-step is on (a working authenticator). */
  viewerOn: boolean;
}): ClubResetDoor {
  if (!CLUB_RESET_VIEWER_ROLES.includes(facts.viewerRole as typeof CLUB_RESET_VIEWER_ROLES[number])) return 'none';
  if (facts.isSelf) return 'none'; // yourself: a backup code, or support
  if (facts.targetRole === 'owner') return 'none'; // the owner: support only (tab 7)
  if (!facts.targetOn) return 'none';
  if (facts.orgIsTeamWorkspace || !facts.resettableAccount || facts.reachesAnotherPlace) return 'support';
  if (!facts.viewerOn) return 'own_first';
  return 'club';
}

/** The club, as the request's context carries it (lib/types.ts Organization). */
export type OrgFacts = { id: string; accountKind?: string | null; planId?: string | null };

/** Reads what the rule needs about the target. `targetOn` comes from lib/two-step-reset.ts `twoStepFactsFor`. */
export async function clubResetDoorFor(args: {
  org: OrgFacts;
  viewer: { userId: string; role: string | null | undefined };
  target: { userId: string; email: string | null; role: string | null | undefined; on: boolean };
}): Promise<ClubResetDoor> {
  const { org, viewer, target } = args;
  const base = {
    viewerRole: viewer.role,
    isSelf: viewer.userId === target.userId,
    targetRole: target.role,
    targetOn: target.on,
    orgIsTeamWorkspace: isTeamWorkspaceOrg({ accountKind: org.accountKind ?? null, planId: org.planId ?? null }),
  };
  // Nothing more to read when the answer is already "no door".
  if (clubResetDoorRule({ ...base, resettableAccount: true, reachesAnotherPlace: false, viewerOn: true }) === 'none') return 'none';
  const [resettableAccount, reachesAnotherPlace, viewerOn] = await Promise.all([
    accountIsClubResettable(target.email),
    accountReachesAnotherPlace(target.userId, org.id),
    accountHasWorkingAuthenticator(viewer.userId),
  ]);
  return clubResetDoorRule({ ...base, resettableAccount, reachesAnotherPlace, viewerOn });
}

/** A verified authenticator on the account (read with the service role; an unreadable account reads as "no"). */
export async function accountHasWorkingAuthenticator(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return false;
  return (data.user.factors ?? []).some(f => f.status === 'verified');
}
