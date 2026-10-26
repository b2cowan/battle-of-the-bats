import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { chunked } from './supabase-paging';
import { sendFamilyServiceBatch, type FamilyServiceMessage } from './family-email';
import { leagueTeamMovedHtml, leagueTeamsPlacedHtml, type PlacedTeamLine } from './email';
import { systemMailFace, type ClubEmailOrg } from './club-email-context';
import { leaguePayUrl } from './league-pay-link';
import { movedMail, placedMail } from './house-league-teams-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE PLACEMENT AND MOVE SENDS (Club Tier Stage 9c, Part 4; rulings 9c·4, 9c·10, 9c·12).
 *
 * Publish is a fact first, an email second (build prompt argument 4): `league_division_publish` writes the division's
 * published-at, one `league_placement_emails` row per family and the coach invites in ONE transaction, and only then does
 * this send. Each row is CLAIMED before it is sent (`league_placement_emails_claim`, mig 378), so a resend racing a send
 * never emails a family twice, and each row's outcome is written back, so "Send the {n} again" survives a reload.
 *
 * The family emails are SERVICE notices (`sendFamilyServiceBatch`): a family who unsubscribed from club news still gets
 * them (owner 2026-10-25), and nothing here counts toward a cap (Q12c). The words are built at send time from the
 * children's current team and coaches.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

export interface MailOrg extends ClubEmailOrg { slug: string }
export interface MailSeason { id: string; name: string; slug: string }

interface EmailRow {
  id: string; kind: 'placed' | 'moved'; guardian_email: string; registration_ids: string[];
  from_team_id: string | null; division_id: string;
}
interface RegRow {
  id: string; player_first_name: string; player_last_name: string; guardian_first_name: string | null;
  team_id: string | null; status: string;
}

export interface SendOutcome { sent: number; failed: number; skipped: number }

/** The family's way back: their status page opened for their sign-up (the signed link), or the plain page. */
function statusUrl(org: MailOrg, season: MailSeason, registrationId: string): string {
  return leaguePayUrl(SITE_URL, { orgSlug: org.slug, seasonSlug: season.slug, registrationId })
    ?? `${SITE_URL}/${encodeURIComponent(org.slug)}/league/${encodeURIComponent(season.slug)}/status`;
}

/** Team names and each team's coaches, for the teams these rows name. */
async function readTeamFacts(teamIds: readonly string[]): Promise<{ names: Map<string, string>; coaches: Map<string, string[]> }> {
  const names = new Map<string, string>();
  const coaches = new Map<string, string[]>();
  for (const chunk of chunked([...new Set(teamIds)])) {
    const [teams, links] = await Promise.all([
      supabaseAdmin.from('league_teams').select('id, name').in('id', chunk),
      supabaseAdmin.from('league_team_coaches').select('team_id, name').in('team_id', chunk).is('removed_at', null).order('created_at'),
    ]);
    if (teams.error || links.error) throw new Error(`Couldn't read the teams for the email: ${(teams.error ?? links.error)!.message}`);
    for (const t of teams.data ?? []) names.set(t.id, t.name);
    for (const c of links.data ?? []) coaches.set(c.team_id, [...(coaches.get(c.team_id) ?? []), c.name]);
  }
  return { names, coaches };
}

/**
 * Send these placement-email rows (the ones still unsent; anything another send holds is left to it). Never throws once
 * it has claimed rows: a failure after the claim marks every claimed row `failed`, so it is counted, shown and sent again
 * by "Send the {n} again" — a claimed row is never left `sending` (/review 2026-10-25).
 */
export async function sendPlacementEmails(org: MailOrg, season: MailSeason, rowIds: readonly string[]): Promise<SendOutcome> {
  if (rowIds.length === 0) return { sent: 0, failed: 0, skipped: 0 };
  const { data: claimed, error: claimError } = await supabaseAdmin.rpc('league_placement_emails_claim', {
    p_org: org.id, p_ids: [...rowIds],
  });
  if (claimError) throw new Error(`Couldn't claim the emails: ${claimError.message}`);
  const ids = ((claimed ?? []) as unknown[]).map(v => (typeof v === 'string' ? v : (v as Record<string, string>).league_placement_emails_claim));
  if (ids.length === 0) return { sent: 0, failed: 0, skipped: 0 };
  try {
    return await sendClaimed(org, season, ids);
  } catch (err) {
    console.error('[house-league-placement-mail] a send failed after its claim (its rows are marked failed):', err instanceof Error ? err.message : String(err));
    await recordOutcome(ids, 'failed');
    return { sent: 0, failed: ids.length, skipped: 0 };
  } finally {
    await refreshNoticeCounts(ids);
  }
}

/**
 * A Publish is one notice on the season's Email families history (9d-1, `league_season_notices`): its reached and
 * failed follow its family emails, recounted from them after every send of them (a "Send again" included). Never
 * throws — the emails have gone; a count that didn't move is logged.
 */
async function refreshNoticeCounts(ids: readonly string[]): Promise<void> {
  try {
    const notices = new Set<string>();
    for (const chunk of chunked([...ids])) {
      const { data, error } = await supabaseAdmin.from('league_placement_emails').select('notice_id').in('id', chunk).not('notice_id', 'is', null);
      if (error) throw error;
      for (const r of data ?? []) notices.add(r.notice_id as string);
    }
    for (const noticeId of notices) {
      const { data, error } = await supabaseAdmin.from('league_placement_emails').select('status').eq('notice_id', noticeId);
      if (error) throw error;
      const rows = data ?? [];
      const { error: upErr } = await supabaseAdmin.from('league_season_notices').update({
        reached_count: rows.filter(r => r.status === 'sent').length,
        failed_count: rows.filter(r => r.status === 'failed').length,
      }).eq('id', noticeId);
      if (upErr) throw upErr;
    }
  } catch (err) {
    console.error('[house-league-placement-mail] a notice\'s counts were not updated (the emails went):', err instanceof Error ? err.message : String(err));
  }
}

/** Write an outcome onto rows this send still holds (`sending`): a newer send that took them over is never overwritten. */
async function recordOutcome(ids: readonly string[], status: 'sent' | 'failed' | 'skipped'): Promise<void> {
  const now = new Date().toISOString();
  for (const chunk of chunked([...ids])) {
    const { error } = await supabaseAdmin.from('league_placement_emails')
      .update({ status, updated_at: now, ...(status === 'failed' ? {} : { sent_at: now }) })
      .in('id', chunk).eq('status', 'sending');
    if (error) console.error('[house-league-placement-mail] an outcome was not recorded:', error.message);
  }
}

async function sendClaimed(org: MailOrg, season: MailSeason, ids: readonly string[]): Promise<SendOutcome> {
  const outcome: SendOutcome = { sent: 0, failed: 0, skipped: 0 };
  const { data: rowData, error: rowError } = await supabaseAdmin.from('league_placement_emails')
    .select('id, kind, guardian_email, registration_ids, from_team_id, division_id').in('id', [...ids]);
  if (rowError) throw new Error(`Couldn't read the emails: ${rowError.message}`);
  const rows = (rowData ?? []) as EmailRow[];

  const regIds = [...new Set(rows.flatMap(r => r.registration_ids))];
  const regs = new Map<string, RegRow>();
  for (const chunk of chunked(regIds)) {
    const { data, error } = await supabaseAdmin.from('league_registrations')
      .select('id, player_first_name, player_last_name, guardian_first_name, team_id, status')
      .in('id', chunk).eq('season_id', season.id);
    if (error) throw new Error(`Couldn't read the children for the email: ${error.message}`);
    for (const r of (data ?? []) as RegRow[]) regs.set(r.id, r);
  }
  const { data: divisions } = await supabaseAdmin.from('league_divisions').select('id, name')
    .in('id', [...new Set(rows.map(r => r.division_id))]);
  const divisionName = new Map((divisions ?? []).map(d => [d.id as string, d.name as string]));
  const teamIds = [...regs.values()].map(r => r.team_id).filter((t): t is string => !!t)
    .concat(rows.map(r => r.from_team_id).filter((t): t is string => !!t));
  const [facts, face] = await Promise.all([readTeamFacts(teamIds), systemMailFace(org)]);

  const messages: FamilyServiceMessage[] = [];
  const messageRows: string[] = [];
  const nothingToSay: string[] = [];
  for (const row of rows) {
    // Only children still accepted and on a team are named; a child moved off since is not news.
    const children = row.registration_ids.map(id => regs.get(id)).filter((r): r is RegRow => !!r && r.status === 'active' && !!r.team_id);
    if (children.length === 0) { nothingToSay.push(row.id); continue; }
    const division = divisionName.get(row.division_id) ?? '';
    const guardianFirstName = children[0].guardian_first_name?.trim() || 'there';
    const url = statusUrl(org, season, children[0].id);
    // A move stays a move email when its old team has since been deleted: the family reads "their old team", never
    // "The teams are set".
    if (row.kind === 'moved') {
      const child = children[0];
      messages.push({
        to: row.guardian_email,
        subject: movedMail.subject(child.player_first_name, season.name),
        html: leagueTeamMovedHtml({
          guardianFirstName, childName: `${child.player_first_name} ${child.player_last_name}`, seasonName: season.name,
          divisionName: division, clubName: org.name,
          fromTeam: (row.from_team_id && facts.names.get(row.from_team_id)) || 'their old team', toTeam: facts.names.get(child.team_id!) ?? '',
          coaches: facts.coaches.get(child.team_id!) ?? [], statusUrl: url, contactEmail: face?.contact ?? null, face,
        }),
      });
    } else {
      const lines: PlacedTeamLine[] = children.map(c => ({
        child: `${c.player_first_name} ${c.player_last_name}`,
        team: facts.names.get(c.team_id!) ?? '',
        coaches: facts.coaches.get(c.team_id!) ?? [],
      }));
      messages.push({
        to: row.guardian_email,
        subject: placedMail.subject(season.name),
        html: leagueTeamsPlacedHtml({
          guardianFirstName, seasonName: season.name, divisionName: division, clubName: org.name, lines,
          statusUrl: url, contactEmail: face?.contact ?? null, face,
        }),
      });
    }
    messageRows.push(row.id);
  }

  const results = messages.length === 0 ? [] : await sendFamilyServiceBatch({
    messages, fromName: face?.sendOpts.fromName ?? null, replyTo: face?.sendOpts.replyTo ?? null,
  });
  const byStatus = new Map<'sent' | 'failed' | 'skipped', string[]>([['sent', []], ['failed', []], ['skipped', [...nothingToSay]]]);
  results.forEach((r, i) => {
    const status = r.status === 'sent' ? 'sent' : r.status === 'skipped' ? 'skipped' : 'failed';
    byStatus.get(status)!.push(messageRows[i]);
  });
  for (const [status, list] of byStatus) {
    if (list.length === 0) continue;
    outcome[status] += list.length;
    await recordOutcome(list, status);
  }
  return outcome;
}

/**
 * Every email of a division not yet sent ("Send the {n} again", copy §7.2): failed, never started (a publish whose send did
 * not run), or held by a send that died. The claim takes only what is free (a `sending` row only after ten minutes).
 */
export async function unsentPlacementEmails(divisionId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('league_placement_emails').select('id')
    .eq('division_id', divisionId).in('status', ['failed', 'pending', 'sending']);
  if (error) throw new Error(`Couldn't read the failed emails: ${error.message}`);
  return (data ?? []).map(r => r.id as string);
}
