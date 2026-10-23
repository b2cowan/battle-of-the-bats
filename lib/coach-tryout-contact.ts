import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getOrgMemberDisplayNames, resolveCoachUserIdentities } from './db';
import { getTeamStaffMembershipById, type TeamStaffMembership } from './coach-membership';
import { liveTryoutContactEmail, publicPersonName } from './tryout-contact-rules';

/**
 * lib/coach-tryout-contact.ts — THE HEAD COACH'S TRYOUT QUESTIONS ADDRESS (Club Tier Stage 4c-2 Part B, Asks 1–3; words
 * CLUB_TIER_STAGE4C2_COPY.md §H, §I). The reader and writer of `rep_team_tryout_contacts` (mig 350); the one other
 * writer is the clear on removal and demotion (`lib/coach-tryout-contact-clear.ts`).
 *
 * One address per team, carried across seasons. Any head coach of the team may set, change or remove it, and whoever
 * set it owns it. ⚠ It ENDS WITH THE SETTER'S HEAD-COACH ROLE, twice over: `removeStaffMember` and a demotion in
 * `setStaffMemberRole` clear it, AND every reader here shows it only while the setter's membership is an ACTIVE
 * head_coach seat on THIS team (`liveTryoutContactEmail`). The rules themselves are pure, in `lib/tryout-contact-rules.ts`.
 *
 * ⚠ Families see it on exactly ONE surface: the team's own tryout page while open or not open yet
 * (`getPublicTryoutContact`). Never the footer, the club's Tryouts page, the team page, the sign-up form, a share card,
 * JSON-LD or a link preview — `tests/unit/club-stage4c2b-guard.test.ts`.
 */

interface Live {
  /** The address families would see — null unless the setter is still an active head coach of the team. */
  email: string | null;
  setter: TeamStaffMembership | null;
  resetAt: string | null;
}

/** The stored row and its setter, through the one live rule. No names: each caller resolves only the one it needs. */
async function readLive(orgId: string, teamId: string): Promise<Live> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_tryout_contacts')
    .select('email, set_by_membership_id, reset_at')
    .eq('org_id', orgId)
    .eq('team_id', teamId)
    .maybeSingle<{ email: string | null; set_by_membership_id: string | null; reset_at: string | null }>();
  if (error) throw error;
  if (!data) return { email: null, setter: null, resetAt: null };
  const setter = data.email && data.set_by_membership_id ? await getTeamStaffMembershipById(data.set_by_membership_id) : null;
  const email = liveTryoutContactEmail({ email: data.email, setByMembershipId: data.set_by_membership_id }, setter, teamId);
  return email ? { email, setter, resetAt: null } : { email: null, setter: null, resetAt: data.reset_at };
}

/** What the coach's row and the admin line read: the live address (or null), who set it, and the club's reset. */
export interface TryoutContactView {
  email: string | null;
  /** The setter's membership and name, while the address is live. */
  setter: { membershipId: string; name: string | null } | null;
  /** When the club last put its own address back; null once a head coach sets one again. */
  resetAt: string | null;
}

export async function readTryoutContact(orgId: string, teamId: string): Promise<TryoutContactView> {
  const live = await readLive(orgId, teamId);
  if (!live.email || !live.setter) return { email: null, setter: null, resetAt: live.resetAt };
  // Inside the portal and the admin, a person with no name on file is shown by their address — the staff pages' rule.
  const who = (await resolveCoachUserIdentities(orgId, [live.setter.userId])).get(live.setter.userId);
  return { email: live.email, setter: { membershipId: live.setter.id, name: who?.displayName ?? who?.email ?? null }, resetAt: null };
}

/**
 * The family tryout page's line: the address, and the head coach's NAME only when their own name switch is on.
 * ⚠ Never falls back to the account's email for the name — a public page shows a name or "the head coach".
 */
export async function getPublicTryoutContact(
  orgId: string,
  teamId: string,
): Promise<{ email: string; name: string | null } | null> {
  const live = await readLive(orgId, teamId);
  if (!live.email || !live.setter) return null;
  const name = live.setter.showNamePublic
    ? publicPersonName((await getOrgMemberDisplayNames(orgId, [live.setter.userId]))[live.setter.userId])
    : null;
  return { email: live.email, name };
}

/** A head coach sets or changes it; it becomes theirs, and the club's reset note clears. The route checks the role. */
export async function setTryoutContact(input: {
  orgId: string;
  teamId: string;
  membershipId: string;
  email: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_team_tryout_contacts')
    .upsert({
      team_id: input.teamId,
      org_id: input.orgId,
      email: input.email,
      set_by_membership_id: input.membershipId,
      set_at: new Date().toISOString(),
      reset_at: null,
      reset_by: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'team_id' });
  if (error) throw error;
}

const CLEARED = { email: null, set_by_membership_id: null, set_at: null };

/** A head coach's Remove — no confirm (H13), no reset note (it was not the club). */
export async function removeTryoutContact(orgId: string, teamId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_team_tryout_contacts')
    .update({ ...CLEARED, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('team_id', teamId);
  if (error) throw error;
}

/**
 * The club puts its own address back (the admin Tryouts page's "Use the club's address"). Refused when no live coach
 * address is set (K8: "No coach address is set on this page."), and when the live one is not the address the club's
 * window was opened on — a coach's change landing in between is never wiped by a window that showed the old one.
 * The update repeats both (address and setter), so a change between this read and the write refuses too.
 */
export async function resetTryoutContactByClub(
  orgId: string,
  teamId: string,
  resetBy: string,
  expectedEmail: string,
): Promise<'reset' | 'none' | 'changed'> {
  const { email, setter } = await readLive(orgId, teamId);
  if (!email || !setter) return 'none';
  if (email !== expectedEmail) return 'changed';
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('rep_team_tryout_contacts')
    .update({ ...CLEARED, reset_at: now, reset_by: resetBy, updated_at: now })
    .eq('org_id', orgId)
    .eq('team_id', teamId)
    .eq('email', email)
    .eq('set_by_membership_id', setter.id)
    .select('team_id')
    .maybeSingle();
  if (error) throw error;
  return data ? 'reset' : 'changed';
}
