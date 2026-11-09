import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { normalizeGuardianEmail } from './guardian-email';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { isLiveLeagueSeasonStatus } from './family-link-reach';
import { endFamilyLink } from './family-invitation';
import { resendPlacementInvitation } from './house-league-placement-mail';
import { ageOn } from './family-invitation-rules';
import { todayEastern } from './free-time';
import type { FamilyAddressStatus, FamilyAppFacts } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S VIEW OF WHO IS IN THE APP, per address on a sign-up (Signed-in family accounts Stage 4a, Part 8.1; ruling 10;
 * drawing 7.2). The registration record window shows ONE status under Email and under Second parent:
 *   joined      "In the app since {date}"        a verified connection of that address to the child
 *   invited     "Invited {date}" · Send again    an invitation to that address that was not cancelled, not yet joined
 *   notInvited  "Not invited yet"                before the teams are published, or none sent (Send again once placed)
 *   left / removed  (not drawn)                  the address left, or the club removed it; only Send again brings it back
 * and nothing for a player 18 or older (no parent invitation exists for them, ruling 12). The 3b "Stopped" line is unchanged:
 * a stopped address is not on the sign-up, so it has no status here. The Families book is unchanged.
 *
 * Send again = the placement email to that ONE address with a fresh invitation (ruling 9, `reconnects`: the one thing that lets
 * a parent who left or was removed back on). Remove a parent = ends a verified connection to this child (`ended_by = 'club'`;
 * the parent is not emailed). Both: anyone who can change registrations (the route's `register` gate, as "Send a new link").
 *
 * ⚠ While the guardian tier is off nothing is attached: the window renders exactly as before (Part 9 guard a).
 * ⚠ This reads family_links and family_invitations only — never second_parent_stops (the 3b guard).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type { FamilyAddressStatus, FamilyAppFacts };

type RegFacts = {
  id: string; child_id: string; status: string; team_id: string | null; player_date_of_birth: string | null;
  league_divisions: { teams_published_at: string | null } | { teams_published_at: string | null }[] | null;
  league_seasons: { status: string } | { status: string }[] | null;
};
type LinkFacts = { id: string; child_id: string; invited_email: string; status: string; ended_by: string | null; approved_at: string | null; revoked_at: string | null; updated_at: string };
type InvFacts = { email: string; created_at: string };
const one = <X>(v: X | X[] | null): X | null => (Array.isArray(v) ? v[0] ?? null : v);

/** 18 or older on the club's clock, from the date of birth the club holds (ruling 12; the age is never shown). */
const isAdult = (dob: string | null, today: string) => !!dob && (ageOn(dob, today) ?? 0) >= 18;

/** Attach `familyApp` to the sign-ups the record window draws. One read per table for the whole page; none with the tier off. */
export async function withFamilyAppStatuses<T extends { id: string; guardianEmail: string; guardianEmail2: string | null }>(
  orgId: string,
  regs: readonly T[],
): Promise<(T & { familyApp?: FamilyAppFacts })[]> {
  if (!GUARDIAN_TIER_ENABLED || regs.length === 0) return [...regs];
  const facts = await fetchAllIn<RegFacts>(
    regs.map(r => r.id),
    (chunk, from, to) => supabaseAdmin.from('league_registrations')
      .select('id, child_id, status, team_id, player_date_of_birth, league_divisions(teams_published_at), league_seasons(status)')
      .in('id', chunk).order('id').range(from, to),
  );
  const factOf = new Map(facts.map(f => [f.id, f]));
  const childIds = [...new Set(facts.map(f => f.child_id))];
  const emails = [...new Set(regs.flatMap(r => [normalizeGuardianEmail(r.guardianEmail), normalizeGuardianEmail(r.guardianEmail2)]).filter((e): e is string => !!e))];
  const [links, invs] = await Promise.all([
    childIds.length ? fetchAllIn<LinkFacts>(
      childIds,
      (chunk, from, to) => supabaseAdmin.from('family_links')
        .select('id, child_id, invited_email, status, ended_by, approved_at, revoked_at, updated_at')
        .eq('org_id', orgId).in('child_id', chunk).order('id').range(from, to),
    ) : Promise.resolve([] as LinkFacts[]),
    emails.length ? fetchAllIn<InvFacts>(
      emails,
      (chunk, from, to) => supabaseAdmin.from('family_invitations')
        .select('email, created_at').eq('org_id', orgId).eq('source', 'placement').is('cancelled_at', null)
        .in('email', chunk).order('created_at', { ascending: false }).range(from, to),
    ) : Promise.resolve([] as InvFacts[]),
  ]);
  const newestInvite = new Map<string, string>();
  for (const i of invs) if (!newestInvite.has(i.email)) newestInvite.set(i.email, i.created_at);
  const today = todayEastern();

  return regs.map(r => {
    const f = factOf.get(r.id);
    if (!f || isAdult(f.player_date_of_birth, today)) return { ...r };
    const placed = f.status === 'active' && !!f.team_id && !!one(f.league_divisions)?.teams_published_at
      && isLiveLeagueSeasonStatus(one(f.league_seasons)?.status);
    const mine = links.filter(l => l.child_id === f.child_id);
    const statusOf = (raw: string | null): FamilyAddressStatus | null => {
      const email = normalizeGuardianEmail(raw);
      if (!email) return null;
      const ofAddress = mine.filter(l => l.invited_email === email);
      const live = ofAddress.find(l => l.status === 'verified');
      if (live) return { kind: 'joined', at: live.approved_at ?? live.updated_at };
      const ended = ofAddress.filter(l => l.status === 'revoked' && (l.ended_by === 'parent' || l.ended_by === 'club'))
        .sort((a, b) => (b.revoked_at ?? '').localeCompare(a.revoked_at ?? ''))[0];
      const invitedAt = newestInvite.get(email);
      if (ended && (!invitedAt || invitedAt < (ended.revoked_at ?? ''))) {
        return { kind: ended.ended_by === 'club' ? 'removed' : 'left', at: ended.revoked_at ?? ended.updated_at, canSend: placed };
      }
      if (invitedAt) return { kind: 'invited', at: invitedAt, canSend: placed };
      return { kind: 'notInvited', canSend: placed };
    };
    return {
      ...r,
      familyApp: {
        first: statusOf(r.guardianEmail),
        second: statusOf(r.guardianEmail2),
        connected: mine.filter(l => l.status === 'verified').map(l => ({ linkId: l.id, email: l.invited_email })),
      },
    };
  });
}

/** Send again (ruling 9): the placement email to ONE address on this sign-up, with a fresh invitation that may reconnect. */
export async function sendFamilyInvitationAgain(params: {
  orgId: string; registration: { guardianEmail: string; guardianEmail2: string | null }; which: 'first' | 'second'; sentByUserId: string;
}): Promise<{ sentTo: string } | { error: 'no_email' | 'not_sent' }> {
  const email = normalizeGuardianEmail(params.which === 'first' ? params.registration.guardianEmail : params.registration.guardianEmail2);
  if (!email) return { error: 'no_email' };
  const sent = await resendPlacementInvitation({ orgId: params.orgId, email, sentByUserId: params.sentByUserId, reconnects: true });
  return sent ? { sentTo: email } : { error: 'not_sent' };
}

/** Remove a parent from the child's team (ruling 7: the club removes). Only a verified connection to THIS registration's child. */
export async function removeFamilyParent(params: { orgId: string; registrationId: string; linkId: string }): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('league_registrations')
    .select('child_id').eq('id', params.registrationId).eq('org_id', params.orgId).maybeSingle();
  if (error) throw error;
  const childId = (data as { child_id: string } | null)?.child_id;
  if (!childId) return false;
  const { data: link, error: linkError } = await supabaseAdmin.from('family_links')
    .select('id').eq('id', params.linkId).eq('org_id', params.orgId).eq('child_id', childId).eq('status', 'verified').maybeSingle();
  if (linkError) throw linkError;
  if (!link) return false;
  return endFamilyLink({ by: 'club', linkId: params.linkId, orgId: params.orgId });
}
