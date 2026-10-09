import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { GROUP_UNSCOPED_ROLES } from './api-auth';
import { isTeamMoneyMember, listActiveStaffForTeams } from './coach-membership';
import { resolveCoachUserIdentities } from './db';
import { canOpenModule } from './member-access';
import { notify } from './notify';
import type { NotificationEventType, OrgRole, Organization } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHO HEARS ABOUT CLUB MONEY, AND THE ONE SENDER (Club Tier Stage 3a, Asks 4 and 5c; S3A-02).
 *
 * Two audiences, each named once:
 *   · THE TEAM'S MONEY PEOPLE — its active head coaches, plus any staff member the head coach has
 *     given money access (`isTeamMoneyMember`). ⚖ Ruled 2026-09-30 (question 2) for reminders; the
 *     money notices use the same people, so "who on a team hears about club money" has one answer.
 *   · THE CLUB'S ACCOUNTING PEOPLE — every active member who can open Accounting
 *     (`canOpenModule(…, 'module_accounting')`: owner, treasurer, admin with Accounting, anyone
 *     granted it), less a group-limited member whose groups don't include the team.
 *
 * ⚠ Never the person who acted (`excludeUserIds`).
 * ⚠ BEST-EFFORT BY DESIGN: the money move has already committed, and a failed bell must not turn a
 * landed payment into an error. Each send is caught and logged.
 * ⚠ Email follows each person's settings (bell on by default, email when they turn it on — the
 * same default every targeted notification has).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface MoneyPerson {
  userId: string;
  name: string | null;
  email: string | null;
  isHeadCoach: boolean;
}

/** Each team's head coaches and money staff, head coaches first, with names — in one read for many teams. */
export async function teamsMoneyPeople(orgId: string, teamIds: readonly string[]): Promise<Map<string, MoneyPerson[]>> {
  const staff = (await listActiveStaffForTeams(teamIds)).filter(isTeamMoneyMember);
  const identities = await resolveCoachUserIdentities(orgId, [...new Set(staff.map(m => m.userId))]);
  const out = new Map<string, MoneyPerson[]>(teamIds.map(id => [id, []]));
  for (const m of staff) {
    out.get(m.teamId)?.push({
      userId: m.userId,
      name: identities.get(m.userId)?.displayName ?? null,
      email: identities.get(m.userId)?.email ?? null,
      isHeadCoach: m.coachRole === 'head_coach',
    });
  }
  return out;
}

/** The club's accounting people who may see this team (a null group = an ungrouped team). */
export async function clubAccountingUserIds(
  org: Organization,
  teamGroupId: string | null,
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('id, user_id, role, capabilities')
    .eq('organization_id', org.id)   // ⚠ organization_id, not org_id — this table predates the convention
    .eq('status', 'active');
  if (error) throw error;
  const members = (data ?? []) as { id: string; user_id: string; role: OrgRole; capabilities: Record<string, boolean> | null }[];
  const holders = members.filter(m => m.user_id && canOpenModule(m, org, 'module_accounting'));
  if (holders.length === 0) return [];

  // A group limit narrows only the roles that can carry one (`GROUP_UNSCOPED_ROLES` never do — the
  // same list `getAuthContextWithRole` reads).
  const limited = holders.filter(m => !GROUP_UNSCOPED_ROLES.includes(m.role));
  const scopes = new Map<string, Set<string>>();
  if (limited.length > 0) {
    const { data: rows, error: sErr } = await supabaseAdmin
      .from('org_member_rep_group_scopes')
      .select('member_id, group_id')
      .in('member_id', limited.map(m => m.id));
    if (sErr) throw sErr;
    for (const r of (rows ?? []) as { member_id: string; group_id: string }[]) {
      const set = scopes.get(r.member_id) ?? new Set<string>();
      set.add(r.group_id);
      scopes.set(r.member_id, set);
    }
  }
  return holders
    .filter(m => {
      const groups = scopes.get(m.id);
      if (!groups || groups.size === 0) return true;
      return !!teamGroupId && groups.has(teamGroupId);
    })
    .map(m => m.user_id);
}

export type CoachMoneyEvent =
  | 'club_money_received' | 'club_money_undone'
  | 'club_request_approved' | 'club_request_declined' | 'club_request_reversed';
export type ClubMoneyEvent = 'team_money_sent' | 'team_request_filed' | 'team_request_holding_payout';

/** Tell a team's money people (the "Your club" notices). Ids only — the bell needs no names. */
export async function tellTeamMoneyPeople(p: {
  org: Pick<Organization, 'id' | 'slug'>;
  teamId: string;
  actorUserId: string;
  event: CoachMoneyEvent;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const userIds = (await listActiveStaffForTeams([p.teamId])).filter(isTeamMoneyMember).map(m => m.userId);
    if (userIds.length === 0) return;
    await notify({
      orgId: p.org.id,
      eventType: p.event satisfies NotificationEventType,
      title: p.title,
      body: p.body,
      userIds,
      excludeUserIds: [p.actorUserId],
      link: `/${p.org.slug}/coaches/teams/${p.teamId}/accounting/club`,
      metadata: { teamId: p.teamId, ...(p.metadata ?? {}) },
    });
  } catch (e) {
    console.error(`[club-money-notify] ${p.event} to the team failed (the money move landed):`, e);
  }
}

/** Tell the club's accounting people (the Accounting notices). */
export async function tellClubAccounting(p: {
  org: Organization;
  teamId: string;
  teamGroupId: string | null;
  actorUserId: string | null;
  event: ClubMoneyEvent;
  title: string;
  body: string;
  link: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const userIds = await clubAccountingUserIds(p.org, p.teamGroupId);
    if (userIds.length === 0) return;
    await notify({
      orgId: p.org.id,
      eventType: p.event satisfies NotificationEventType,
      title: p.title,
      body: p.body,
      userIds,
      excludeUserIds: p.actorUserId ? [p.actorUserId] : [],
      link: p.link,
      metadata: { teamId: p.teamId, ...(p.metadata ?? {}) },
    });
  } catch (e) {
    console.error(`[club-money-notify] ${p.event} to the club failed (the money move landed):`, e);
  }
}

/** Where the club reads a team's money: Accounting's tabs (Club Tier Stage 3a, Ask 2). A notice sent
 *  before a move still lands — the proxy forwards the old addresses (Rep Teams', an allocation's retired page) here. */
export const clubMoneyLinks = {
  /** Allocations with the allocation's WINDOW open (Stage 3d, Ask 5 — "from outside, its home tab with the window
   *  open"); `splitId` opens it at that team's bill. */
  allocation: (orgSlug: string, allocationId: string, splitId?: string) =>
    `/${orgSlug}/admin/accounting/allocations?allocation=${allocationId}${splitId ? `&bill=${splitId}` : ''}`,
  /** `requestId` opens that request on arrival. */
  requests: (orgSlug: string, requestId?: string) =>
    `/${orgSlug}/admin/accounting/payment-requests${requestId ? `?request=${requestId}` : ''}`,
};
