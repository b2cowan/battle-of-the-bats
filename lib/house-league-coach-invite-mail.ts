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

/**
 * Email the invites these coaches were just given (their rows already carry the token's hash). One email each, on the
 * club's warm envelope; an invite that fails to send shows on the team card as "Invited" and can be sent again once
 * it expires. Returns the names of the coaches emailed, for the result line.
 */
export async function sendCoachInvites(
  org: MailOrg, season: MailSeason, coachIds: readonly string[], rawTokens: ReadonlyMap<string, string>,
): Promise<string[]> {
  if (coachIds.length === 0) return [];
  const { data, error } = await supabaseAdmin.from('league_team_coaches')
    .select('id, name, email, team_id, league_teams(name, division_id, league_divisions(name))')
    .in('id', [...coachIds]).eq('org_id', org.id);
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
  const sent: string[] = [];
  await Promise.all(rows.map(async row => {
    const token = rawTokens.get(row.id);
    if (!token) return;
    const teamName = row.league_teams?.name ?? '';
    try {
      const result = await sendEmail(row.email, leagueCoachInviteSubject({ teamName, seasonName: season.name }), leagueCoachInviteHtml({
        clubName: org.name, teamName, seasonName: season.name, divisionName: row.league_teams?.league_divisions?.name ?? '',
        playerCount: counts.get(row.team_id) ?? 0, invitedEmail: row.email, inviteUrl: coachInviteUrl(token),
      }));
      if (result.status !== 'provider_error') sent.push(row.name);
    } catch (err) {
      console.error('[house-league-placement-mail] a coach invite did not send:', err instanceof Error ? err.message : String(err));
    }
  }));
  return sent;
}
