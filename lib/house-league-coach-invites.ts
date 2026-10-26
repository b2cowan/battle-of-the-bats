import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { hashAssistantInviteToken } from './assistant-invite-token';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HOUSE-LEAGUE COACH ACCEPTS THEIR INVITE (Club Tier Stage 9c, Part 5; rulings 9c·1, 9c·10).
 *
 * The invite lives on the coach's own league_team_coaches row (mig 377), its token made and hashed exactly as the rep
 * coach invite's (lib/assistant-invite-token.ts — one token machinery). Accepting:
 *   · signs the row with the person's id, ONLY when they are signed in with the invited address;
 *   · is a single conditional update, so a link used twice, an expired one or a removed coach's is refused;
 *   · creates NO club membership. The sign-in card is built from these rows (lib/user-contexts.ts), and a `coach`
 *     member would get a Coaches Portal card on a club with a subscription, the one place 9c never routes a coach.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface LeagueCoachInvite {
  coachId: string;
  status: 'pending' | 'accepted' | 'removed';
  expired: boolean;
  invitedEmail: string;
  /** What the convenor typed, to fill the sign-up form (the coach can edit it). */
  firstName: string;
  lastName: string;
  teamId: string;
  teamName: string;
  orgName: string;
  orgSlug: string;
  seasonSlug: string;
}

type InviteRow = {
  id: string; name: string; first_name: string | null; last_name: string | null; email: string; team_id: string; accepted_at: string | null; removed_at: string | null; expires_at: string | null;
  league_teams: { name: string; league_seasons: { slug: string; organizations: { name: string; slug: string } | null } | null } | null;
};

async function rowByToken(token: string): Promise<InviteRow | null> {
  if (!token) return null;
  const { data, error } = await supabaseAdmin.from('league_team_coaches')
    .select('id, name, first_name, last_name, email, team_id, accepted_at, removed_at, expires_at, league_teams(name, league_seasons(slug, organizations(name, slug)))')
    .eq('token_hash', hashAssistantInviteToken(token)).maybeSingle();
  if (error) throw new Error(`Couldn't read the invite: ${error.message}`);
  return (data as unknown as InviteRow | null) ?? null;
}

/** A row from before mig 381 has only the one typed name: split it at the first space, for the pre-fill alone. */
export function coachNameParts(row: { name: string; first_name: string | null; last_name: string | null }): { firstName: string; lastName: string } {
  if (row.first_name) return { firstName: row.first_name, lastName: row.last_name ?? '' };
  const [first = '', ...rest] = row.name.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(' ') };
}

function toInvite(row: InviteRow, now: Date): LeagueCoachInvite {
  const season = row.league_teams?.league_seasons;
  const { firstName, lastName } = coachNameParts(row);
  return {
    coachId: row.id,
    status: row.removed_at ? 'removed' : row.accepted_at ? 'accepted' : 'pending',
    expired: !row.expires_at || new Date(row.expires_at).getTime() <= now.getTime(),
    invitedEmail: row.email,
    firstName,
    lastName,
    teamId: row.team_id,
    teamName: row.league_teams?.name ?? '',
    orgName: season?.organizations?.name ?? '',
    orgSlug: season?.organizations?.slug ?? '',
    seasonSlug: season?.slug ?? '',
  };
}

export async function getLeagueCoachInviteByToken(token: string, now: Date = new Date()): Promise<LeagueCoachInvite | null> {
  const row = await rowByToken(token);
  return row ? toInvite(row, now) : null;
}

/** Does this token prove this inbox (a live invite addressed to it)? The coach sign-up skips its email link then. */
export async function leagueCoachInviteProvesEmail(token: unknown, email: string): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false;
  const invite = await getLeagueCoachInviteByToken(token);
  return !!invite && invite.status === 'pending' && !invite.expired && invite.invitedEmail === email.trim().toLowerCase();
}

export type AcceptLeagueCoach =
  | { ok: true; orgSlug: string; seasonSlug: string; teamId: string }
  | { ok: false; status: number; error: string };

export async function acceptLeagueCoachInvite(token: string, userId: string, email: string, now: Date = new Date()): Promise<AcceptLeagueCoach> {
  const row = await rowByToken(token);
  if (!row) return { ok: false, status: 404, error: 'This invite link is not valid.' };
  const invite = toInvite(row, now);
  if (invite.status === 'accepted') return { ok: false, status: 409, error: 'This invite has already been used. Sign in to open your team.' };
  if (invite.status === 'removed') return { ok: false, status: 410, error: 'This invite is no longer available. Ask the club to send a new one.' };
  if (invite.expired) return { ok: false, status: 410, error: 'This invite is no longer available. Ask the club to send a new one.' };
  if (invite.invitedEmail !== email.trim().toLowerCase()) {
    return { ok: false, status: 403, error: `This invite was sent to ${invite.invitedEmail}. Sign out, then open the link again and sign in with that address.` };
  }
  // One conditional write: the row must still be this unused, live invite.
  const { data, error } = await supabaseAdmin.from('league_team_coaches')
    .update({ user_id: userId, accepted_at: now.toISOString(), token_hash: null })
    .eq('id', row.id).eq('token_hash', hashAssistantInviteToken(token))
    .is('accepted_at', null).is('removed_at', null).gt('expires_at', now.toISOString())
    .select('id');
  if (error) throw new Error(`Couldn't accept the invite: ${error.message}`);
  if ((data ?? []).length === 0) return { ok: false, status: 409, error: 'This invite has already been used. Sign in to open your team.' };
  return { ok: true, orgSlug: invite.orgSlug, seasonSlug: invite.seasonSlug, teamId: invite.teamId };
}

/** Where a coach's team page lives. Signed in; under the season's public pages, but never public itself. */
export const coachTeamPath = (orgSlug: string, seasonSlug: string, teamId: string) =>
  `/${encodeURIComponent(orgSlug)}/league/${encodeURIComponent(seasonSlug)}/team/${teamId}`;
