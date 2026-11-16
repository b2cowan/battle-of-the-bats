import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { canGate, canScore } from './volunteer-jobs';
import { volunteerShut } from './invite-only-event';
import { hasCapability } from './roles';
import { LEAGUE_RUNNER_ROLES, canHouseLeague } from './house-league-access';
import { isDemoOrganizerEmail } from './demo-org';
import type { Organization, OrgRole } from './types';

/**
 * WHO CAN ACT ON IT (Needs attention clears itself, owner ruling 2026-10-16, folded into that build). `notify()` with no
 * `userIds` reaches every active member of the club, any role — so a club's failed card payment and a no-show reached
 * its coaches, and their bells listed them. Each such notice now names the people who can act, read from the same check
 * its action makes. ⚠ A caller that gets an EMPTY list must not call `notify()` with it: an empty list falls back to
 * every member.
 */

/** The club's owners — billing is owner-only (`app/api/billing/*`). */
export async function orgOwnerUserIds(orgId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('organization_members').select('user_id')
    .eq('organization_id', orgId).eq('status', 'active').eq('role', 'owner');
  if (error) throw error;
  return [...new Set((data ?? []).map(m => m.user_id as string).filter(Boolean))];
}

/** One owner an email about the plan or billing goes to. */
export type OwnerRecipient = { userId: string; email: string };

/**
 * EVERY ACTIVE OWNER'S EMAIL (GST/HST Stage 6 step 6.4, owner ruling Q4 2026-11-13: "every owner, not one"). The one reader for an
 * email about the club's plan or billing: the purchase email, the yearly reminder, a trial ending, a plan ending, welcome back, the
 * retention notice and the online-payments notices. A coach's Premium workspace's owner is the coach. A demo account's address
 * (`isDemoOrganizerEmail`) is never one: `sendEmail` skips only `.local`, and the demo accounts are `@example.com`.
 *
 * ⚠ It replaced `getOrgOwnerEmail` for these emails, which read ONE owner with `.single()`: a club with two owners got an error,
 * no address and NO email at all. Throws on a failed read; an owner whose sign-in cannot be read (or has no email) is left out.
 */
export async function orgOwnerEmails(orgId: string): Promise<OwnerRecipient[]> {
  const out: OwnerRecipient[] = [];
  for (const userId of await orgOwnerUserIds(orgId)) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = data?.user?.email?.trim();
    if (email && !isDemoOrganizerEmail(email) && !out.some(r => r.email.toLowerCase() === email.toLowerCase())) out.push({ userId, email });
  }
  return out;
}

/** The people who may add teams to this tournament (`create_tournaments`, the Teams page's own question), with a staff member
 *  limited to their assigned tournaments as `notify()` limits them. Club Tier Stage 7b: the club entering its own teams tells
 *  them, never the club's coaches (a coach learns from their own Tournaments list). */
export async function tournamentTeamAdderUserIds(orgId: string, tournamentId: string): Promise<string[]> {
  return tournamentMembersWho(orgId, tournamentId, m => hasCapability(m.role, m.capabilities, 'create_tournaments'));
}

type Member = { id: string; user_id: string | null; role: OrgRole; capabilities: Record<string, boolean> | null };

/** The club's active members who pass `keep`, with a staff member limited to their assigned tournaments (the one read the
 *  tournament-scoped lists below share). Throws on a failed read. */
async function tournamentMembersWho(orgId: string, tournamentId: string, keep: (m: Member) => boolean): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('organization_members').select('id, user_id, role, capabilities')
    .eq('organization_id', orgId).eq('status', 'active');
  if (error) throw error;
  return scopedToTournament(((data ?? []) as Member[]).filter(m => m.user_id && keep(m)), tournamentId);
}

/** A staff member with tournament assignments hears only about those tournaments (no rows = every tournament). */
async function scopedToTournament(members: Member[], tournamentId: string): Promise<string[]> {
  const staff = members.filter(m => m.role === 'staff');
  const assigned = new Map<string, Set<string>>();
  if (staff.length) {
    const { data: rows, error: aErr } = await supabaseAdmin.from('org_member_tournament_assignments')
      .select('org_member_id, tournament_id').in('org_member_id', staff.map(m => m.id));
    if (aErr) throw aErr;
    for (const r of (rows ?? []) as { org_member_id: string; tournament_id: string }[]) {
      (assigned.get(r.org_member_id) ?? assigned.set(r.org_member_id, new Set()).get(r.org_member_id)!).add(r.tournament_id);
    }
  }
  return [...new Set(members
    .filter(m => m.role !== 'staff' || !assigned.get(m.id)?.size || assigned.get(m.id)!.has(tournamentId))
    .map(m => m.user_id as string))];
}

/** The people who run check-in for this tournament: who may work the gate (`canGate`, the check-in route's own
 *  question), with a staff member limited to their assigned tournaments as `notify()` limits them (no rows =
 *  every tournament). */
export async function checkInUserIds(orgId: string, tournamentId: string): Promise<string[]> {
  return tournamentMembersWho(orgId, tournamentId, m => canGate(m.role, m.capabilities));
}

/** The people who can open this tournament's Results screen — who may enter scores (`canScore`, the score routes' own
 *  question; Results is the `submit_scores` screen), a volunteer only on a plan that has volunteers (`volunteerShut`), a
 *  staff member limited to their assigned tournaments as `notify()` limits them. "Score submitted" goes to them, not to the
 *  whole club (Notifications read at a glance Stage 5, owner Q6 2026-11-15). */
export async function resultsUserIds(org: Pick<Organization, 'id' | 'planId'>, tournamentId: string): Promise<string[]> {
  return tournamentMembersWho(org.id, tournamentId, m => canScore(m.role, m.capabilities) && !volunteerShut(org.planId, m.role));
}

/**
 * EVERYONE WHO RUNS HOUSE LEAGUE — owners, admins and league admins (LEAGUE_RUNNER_ROLES; owner 2026-10-27: a club whose owner
 * runs house league with no league admin is told too). The list that hears the club's changes to house league's practices
 * and games (Stage 11b Part 5) and the time it gives (Stage 13d). ⚠ Never hand `notify()` an EMPTY list.
 */
export async function houseLeagueRunnerUserIds(orgId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('organization_members').select('user_id')
    .eq('organization_id', orgId).eq('status', 'active').in('role', [...LEAGUE_RUNNER_ROLES]);
  if (error) throw error;
  return [...new Set((data ?? []).map(m => m.user_id as string).filter(Boolean))];
}

/**
 * The club's house-league desk — the members a family's house-league ask is for (Club Tier 9b-2: "Ask to withdraw a
 * child"). The one gate decides (`register`: the owner, a club admin, a league admin, a league registrar, holding the
 * house league), never a role list of its own. ⚠ Never hand `notify()` an EMPTY list: it falls back to every member
 * — the caller skips the notice when this returns none.
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
    .map(m => m.user_id!);
}
