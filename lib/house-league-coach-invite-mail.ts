import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { chunked } from './supabase-paging';
import { leagueCoachInviteHtml, leagueCoachInviteSubject, sendEmail } from './email';
import { generateAssistantInviteToken, hashAssistantInviteToken } from './assistant-invite-token';
import type { MailOrg, MailSeason } from './house-league-placement-mail';

/**
 * A HOUSE-LEAGUE COACH'S INVITE (Club Tier Stage 9c, Part 4; ruling 9c·10): sent at Publish, or when the convenor confirms
 * a coach added after it. Mail to a COACH (the address the convenor typed), never a guardian's, so it is not family mail;
 * it mirrors the club's rep coach invite (button, 7-day link). The token is made and hashed as the rep invite's is.
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

/** A fresh invite token for each coach: the raw token to email, the hash to store. */
export function mintCoachTokens(coachIds: readonly string[]): { ids: string[]; raw: Map<string, string>; hashes: string[] } {
  const raw = new Map<string, string>();
  const hashes: string[] = [];
  for (const id of coachIds) {
    const token = generateAssistantInviteToken();
    raw.set(id, token);
    hashes.push(hashAssistantInviteToken(token));
  }
  return { ids: [...coachIds], raw, hashes };
}

/** The accept link of a house-league coach invite. */
export const coachInviteUrl = (rawToken: string) => `${SITE_URL}/auth/accept-league-coach?token=${encodeURIComponent(rawToken)}`;

/** A coach who was invited, as the publish result names them ("Pat Volunteer invited to coach Cardinals"). */
export interface InvitedCoach { name: string; team: string }

/**
 * Email the invites these coaches were just given (their rows already carry the token's hash). One email each, on the
 * club's warm envelope, one after the other (the single-send transport has no rate-limit retry, and a division has a
 * handful of coaches). A coach who was removed or has already signed in in the meantime is not emailed. A send that
 * fails is recorded on the row (`invite_failed_at`, mig 379): the card reads "Invite didn't send · Send again", never
 * "Invited" over a link nobody received. Returns the coaches emailed, for the result line.
 */
export async function sendCoachInvites(
  org: MailOrg, season: MailSeason, coachIds: readonly string[], rawTokens: ReadonlyMap<string, string>,
): Promise<InvitedCoach[]> {
  if (coachIds.length === 0) return [];
  const { data, error } = await supabaseAdmin.from('league_team_coaches')
    .select('id, name, email, team_id, league_teams(name, division_id, league_divisions(name))')
    .in('id', [...coachIds]).eq('org_id', org.id).is('removed_at', null).is('accepted_at', null);
  if (error) throw new Error(`Couldn't read the coaches to invite: ${error.message}`);
  const rows = (data ?? []) as unknown as {
    id: string; name: string; email: string; team_id: string;
    league_teams: { name: string; league_divisions: { name: string } | null } | null;
  }[];
  const counts = new Map<string, number>();
  for (const chunk of chunked([...new Set(rows.map(r => r.team_id))])) {
    const { data: regs } = await supabaseAdmin.from('league_registrations').select('team_id')
      .in('team_id', chunk).eq('status', 'active');
    for (const r of regs ?? []) counts.set(r.team_id as string, (counts.get(r.team_id as string) ?? 0) + 1);
  }
  const sent: InvitedCoach[] = [];
  for (const row of rows) {
    const token = rawTokens.get(row.id);
    if (!token) continue;
    const teamName = row.league_teams?.name ?? '';
    let ok = false;
    try {
      const result = await sendEmail(row.email, leagueCoachInviteSubject({ teamName, seasonName: season.name }), leagueCoachInviteHtml({
        clubName: org.name, teamName, seasonName: season.name, divisionName: row.league_teams?.league_divisions?.name ?? '',
        playerCount: counts.get(row.team_id) ?? 0, invitedEmail: row.email, inviteUrl: coachInviteUrl(token),
      }));
      ok = result.status !== 'provider_error';
    } catch (err) {
      console.error('[house-league-coach-invite-mail] a coach invite did not send:', err instanceof Error ? err.message : String(err));
    }
    const { error: markError } = await supabaseAdmin.from('league_team_coaches')
      .update({ invite_failed_at: ok ? null : new Date().toISOString() }).eq('id', row.id);
    if (markError) console.error('[house-league-coach-invite-mail] the invite outcome was not recorded:', markError.message);
    if (ok) sent.push({ name: row.name, team: teamName });
  }
  return sent;
}

/**
 * Give these coaches a fresh 7-day invite and send it. The token is written only onto a row that is still a live coach
 * who has not signed in (and, with `onlyNew`, has never been invited): a coach removed or accepted in the meantime gets
 * no email, and only the rows actually written are emailed, so no email ever carries a link the database doesn't hold.
 */
export async function issueCoachInvites(
  org: MailOrg, season: MailSeason, coachIds: readonly string[], actorId: string, opts: { onlyNew: boolean },
): Promise<InvitedCoach[]> {
  if (coachIds.length === 0) return [];
  const tokens = mintCoachTokens(coachIds);
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const written: string[] = [];
  for (let i = 0; i < tokens.ids.length; i++) {
    let q = supabaseAdmin.from('league_team_coaches').update({
      token_hash: tokens.hashes[i], invited_at: now.toISOString(), expires_at: expires.toISOString(),
      invited_by: actorId, invite_failed_at: null,
    }).eq('id', tokens.ids[i]).eq('org_id', org.id).is('removed_at', null).is('accepted_at', null);
    if (opts.onlyNew) q = q.is('invited_at', null);
    const { data, error } = await q.select('id');
    if (error) throw new Error(`Couldn't write the invite: ${error.message}`);
    if ((data ?? []).length > 0) written.push(tokens.ids[i]);
  }
  return sendCoachInvites(org, season, written, tokens.raw);
}

/** The division's coaches who have never been invited (a coach added while the Publish window was open). */
export async function waitingCoachIds(divisionId: string): Promise<string[]> {
  const { data: teams } = await supabaseAdmin.from('league_teams').select('id').eq('division_id', divisionId);
  const ids = (teams ?? []).map(t => t.id as string);
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin.from('league_team_coaches').select('id')
    .in('team_id', ids).is('removed_at', null).is('invited_at', null);
  if (error) throw new Error(`Couldn't read the division's coaches: ${error.message}`);
  return (data ?? []).map(r => r.id as string);
}
