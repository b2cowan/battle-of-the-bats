import 'server-only';
import { toldDateLines } from './league-practice-tell-server';
import { PRACTICE_TELL_WORDS } from './league-practice-tell';
import { timesInZoneSentence } from './timezone';
import { supabaseAdmin } from './supabase-admin';
import { chunked } from './supabase-paging';
import { sendFamilyServiceBatch, type FamilyServiceMessage } from './family-email';
import { leagueTeamChangesHtml, leagueTeamMovedHtml, leagueTeamsPlacedHtml, type PlacedTeamLine, type TeamChangeLine } from './email';
import { TC_MAIL } from './house-league-team-changes-words';
import { readClubEmailOrg, systemMailFace, type ClubEmailOrg } from './club-email-context';
import { leaguePayUrl } from './league-pay-link';
import { signupsOwingNow } from './league-pay-facts';
import { movedMail, placedMail } from './house-league-teams-words';
import { sendSecondParentServiceCopies } from './league-second-parent-mail';
import { placementInviteMailer, placementMailerFor } from './family-invitation-mail';
import { fillInvitationSlots, type MailChild } from './family-invitation-panel';
import { invitationSenderOf, issuePlacementInvitation, placedSignupsOf, planPlacementInvitations } from './family-invitation';
import { assertGuardianTier } from './family-guardian';
import { normalizeGuardianEmail } from './guardian-email';
import { secondParentCopy } from './league-second-parent';
import { withSecondParentStop } from './league-second-parent-footer';

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
  id: string; kind: 'placed' | 'moved' | 'changes'; guardian_email: string; registration_ids: string[];
  from_team_id: string | null; division_id: string;
  /** A `changes` row's snapshot of each child's from-team (mig 459); null on placed / moved rows. */
  changes: { registration_id: string; from_team_id: string | null }[] | null;
}
interface RegRow {
  id: string; player_first_name: string; player_last_name: string; guardian_first_name: string | null;
  guardian_last_name: string | null; team_id: string | null; status: string; link_version: number;
}

export interface SendOutcome { sent: number; failed: number; skipped: number }

/**
 * The family's "Your sign-up" button (Signed-in family accounts Stage 1, ask 3; drawing tab 5): only while their sign-up
 * owes money — a paid family's placement email carries no link. No secret here, no button (never the plain page).
 */
function signupUrl(org: MailOrg, season: MailSeason, reg: RegRow, owing: ReadonlySet<string>): string | null {
  if (!owing.has(reg.id)) return null;
  return leaguePayUrl(SITE_URL, { orgSlug: org.slug, seasonSlug: season.slug, registrationId: reg.id, version: Number(reg.link_version ?? 0) });
}

/** Team names and each team's coaches, for the teams these rows name. */
export async function readTeamFacts(teamIds: readonly string[]): Promise<{ names: Map<string, string>; coaches: Map<string, string[]> }> {
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
    .select('id, kind, guardian_email, registration_ids, from_team_id, division_id, changes').in('id', [...ids]);
  if (rowError) throw new Error(`Couldn't read the emails: ${rowError.message}`);
  const rows = (rowData ?? []) as EmailRow[];

  const regIds = [...new Set(rows.flatMap(r => r.registration_ids))];
  const regs = new Map<string, RegRow>();
  for (const chunk of chunked(regIds)) {
    const { data, error } = await supabaseAdmin.from('league_registrations')
      .select('id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, team_id, status, link_version')
      .in('id', chunk).eq('season_id', season.id);
    if (error) throw new Error(`Couldn't read the children for the email: ${error.message}`);
    for (const r of (data ?? []) as RegRow[]) regs.set(r.id, r);
  }
  const { data: divisions } = await supabaseAdmin.from('league_divisions').select('id, name')
    .in('id', [...new Set(rows.map(r => r.division_id))]);
  const divisionName = new Map((divisions ?? []).map(d => [d.id as string, d.name as string]));
  const teamIds = [...regs.values()].map(r => r.team_id).filter((t): t is string => !!t)
    .concat(rows.map(r => r.from_team_id).filter((t): t is string => !!t))
    .concat(rows.flatMap(r => (r.changes ?? []).map(c => c.from_team_id)).filter((t): t is string => !!t));
  // 9d-3 Part 4: a moved child's new team's practice dates, when that team's families have been told them (a team-change
  // email keeps that for every child it names).
  const movedTo = rows.filter(r => r.kind === 'moved' || r.kind === 'changes')
    .flatMap(r => r.registration_ids.map(id => regs.get(id)?.team_id)).filter((t): t is string => !!t);
  // Each message's link is its first named child's; ask once, for all of them, whether that sign-up owes.
  const anchors = rows.map(row => row.registration_ids.map(id => regs.get(id)).find(c => !!c && c.status === 'active' && !!c.team_id)?.id)
    .filter((id): id is string => !!id);
  // Signed-in family accounts Stage 4a, Part 5: the invitation each address gets (null = none anywhere, today's email: the tier
  // is off, or the club cannot yet be named). Asked once for every child this send names.
  const named = rows.flatMap(row => row.registration_ids.map(id => regs.get(id)).filter((r): r is RegRow => !!r && r.status === 'active' && !!r.team_id));
  const [facts, face, toldLines, owing, mailer] = await Promise.all([
    readTeamFacts(teamIds), systemMailFace(org), toldDateLines(org.id, movedTo),
    // A failed read sends the emails without the button (a missing link beats a missing placement).
    signupsOwingNow(org.id, season.id, anchors).catch(err => { console.error('[house-league-placement-mail] owing was not read:', err instanceof Error ? err.message : String(err)); return new Set<string>(); }),
    placementInviteMailer(org.id, named.map(r => r.id)).catch(err => {
      // A failed invitation read sends today's email: a missing panel beats a missing placement.
      console.error('[house-league-placement-mail] the invitations were not read (the emails go without them):', err instanceof Error ? err.message : String(err));
      return null;
    }),
  ]);

  const messages: FamilyServiceMessage[] = [];
  const messageRows: string[] = [];
  // Signed-in family accounts Stage 3: each message's household, so the second parents' copies follow the first batch
  // (lib/league-second-parent-mail.ts): its first address and the children it names, plus what the invitation's second copy needs —
  // the message as built before its first parent's slots were filled (the second parents fill their own), the children the
  // message names, and the first parent's name for the who-added line.
  const households: { firstEmail: string; registrationIds: string[]; unfilled: string; own: MailChild[]; firstParent: string }[] = [];
  const nothingToSay: string[] = [];
  for (const row of rows) {
    // Only children still accepted and on a team are named; a child moved off since is not news.
    const children = row.registration_ids.map(id => regs.get(id)).filter((r): r is RegRow => !!r && r.status === 'active' && !!r.team_id);
    if (children.length === 0) { nothingToSay.push(row.id); continue; }
    const division = divisionName.get(row.division_id) ?? '';
    const guardianFirstName = children[0].guardian_first_name?.trim() || 'there';
    const url = signupUrl(org, season, children[0], owing);
    const asMail = mailChildrenOf(children, facts.names);
    // A move stays a move email when its old team has since been deleted: the family reads "their old team", never
    // "The teams are set".
    if (row.kind === 'changes') {
      // TC·5: only the children that changed, one block each. "Moved from" is the team the family was last TOLD, taken when
      // the row was made, so a resend still says it. A from-team that has since been deleted reads "their old team".
      const fromOf = new Map((row.changes ?? []).map(c => [c.registration_id, c.from_team_id]));
      const lines: TeamChangeLine[] = children.map(c => {
        const from = fromOf.get(c.id) ?? null;
        const team = facts.names.get(c.team_id!) ?? '';
        return {
          child: `${c.player_first_name} ${c.player_last_name}`, team, coaches: facts.coaches.get(c.team_id!) ?? [],
          movedFrom: from === null ? null : (facts.names.get(from) ?? 'their old team'),
          practices: toldLines.has(c.team_id!) ? {
            heading: PRACTICE_TELL_WORDS.firstOpening(c.player_first_name, team),
            lines: toldLines.get(c.team_id!)!, zone: timesInZoneSentence(),
          } : null,
        };
      });
      messages.push({
        to: row.guardian_email,
        subject: TC_MAIL.subject(children.map(c => c.player_first_name), season.name),
        html: leagueTeamChangesHtml({
          guardianFirstName, seasonName: season.name, divisionName: division, clubName: org.name, lines,
          signupUrl: url, contactEmail: face?.contact ?? null, face, invitationSlots: !!mailer,
        }),
      });
    } else if (row.kind === 'moved') {
      const child = children[0];
      messages.push({
        to: row.guardian_email,
        subject: movedMail.subject(child.player_first_name, season.name),
        html: leagueTeamMovedHtml({
          guardianFirstName, childName: `${child.player_first_name} ${child.player_last_name}`, seasonName: season.name,
          divisionName: division, clubName: org.name,
          fromTeam: (row.from_team_id && facts.names.get(row.from_team_id)) || 'their old team', toTeam: facts.names.get(child.team_id!) ?? '',
          coaches: facts.coaches.get(child.team_id!) ?? [], signupUrl: url, contactEmail: face?.contact ?? null, face,
          invitationSlots: !!mailer,
          practices: toldLines.has(child.team_id!) ? {
            heading: PRACTICE_TELL_WORDS.firstOpening(child.player_first_name, facts.names.get(child.team_id!) ?? ''),
            lines: toldLines.get(child.team_id!)!, zone: timesInZoneSentence(),
          } : null,
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
          signupUrl: url, contactEmail: face?.contact ?? null, face, invitationSlots: !!mailer,
        }),
      });
    }
    // The first parent's own slots (the moved email names one child: the message's first).
    const last = messages[messages.length - 1];
    const own = row.kind === 'moved' ? asMail.slice(0, 1) : asMail;
    households.push({
      firstEmail: row.guardian_email, registrationIds: children.map(c => c.id),
      unfilled: last.html, own, firstParent: guardianFullName(children[0]),
    });
    if (mailer) last.html = fillInvitationSlots(last.html, await mailer.firstFill(row.guardian_email, own));
    messageRows.push(row.id);
  }

  const results = messages.length === 0 ? [] : await sendFamilyServiceBatch({
    kind: 'house_league_placement',
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
  // After the households' rows are recorded: the second parents' copies never change an outcome or a count.
  await sendSecondParentServiceCopies({
    kind: 'house_league_placement', orgId: org.id, fromName: face?.sendOpts.fromName ?? null, replyTo: face?.sendOpts.replyTo ?? null,
    households: households.map((h, i) => ({ firstEmail: h.firstEmail, registrationIds: h.registrationIds, message: { ...messages[i], html: h.unfilled } })), results,
    // Each second parent's copy filled for their own address: the who-added line names the household's first parent.
    finish: mailer ? (household: number, to: string, html: string) =>
      mailer.finishSecondCopy(to, html, households[household]?.firstParent ?? 'A parent', households[household]?.own ?? []) : undefined,
  });
  return outcome;
}

/** The children an email names, as the invitation's slots take them. */
function mailChildrenOf(children: readonly RegRow[], teamNames: ReadonlyMap<string, string>): MailChild[] {
  return children.map(c => ({ registrationId: c.id, firstName: c.player_first_name, team: teamNames.get(c.team_id!) ?? '' }));
}

/** A sign-up's first parent as the second parent's who-added line names them. */
function guardianFullName(r: Pick<RegRow, 'guardian_first_name' | 'guardian_last_name'>): string {
  return [r.guardian_first_name?.trim(), r.guardian_last_name?.trim()].filter(Boolean).join(' ') || 'A parent';
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

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE PLACEMENT EMAIL AGAIN, FOR ONE ADDRESS, WITH A FRESH INVITATION (Signed-in family accounts Stage 4a, ruling 9). D's "Email
 * me a new invitation" on the accept page, the club's Send again (Part 8, `reconnects`), and the emailed sign-up page's "Email me
 * an invitation" (Part 6). Never a separate "create an account" email: it IS the placement email — one per division the address
 * has a placed child in, each naming that address's children there — sent to THIS address only (never the household's other
 * parent), and every copy carries the same one fresh invitation (issuing replaces the old one, so a second issue would kill the
 * first email's button). The first-parent form where the address is the first parent on those sign-ups, the second parent's copy
 * (greeting, Stop footer, who-added line, sender line) where it is the second. Nothing is written to the outbox and no count moves.
 * Returns whether an email went; callers that answer a stranger (D, Part 6) answer the same either way.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export async function resendPlacementInvitation(params: {
  orgId: string; email: string; sentByUserId: string | null; reconnects?: boolean;
}): Promise<boolean> {
  assertGuardianTier();
  const email = normalizeGuardianEmail(params.email);
  if (!email) return false;
  // The placed rule has one home (lib/family-invitation.ts); the read below adds what the email needs.
  const [sender, placed] = await Promise.all([invitationSenderOf(params.orgId), placedSignupsOf(params.orgId, email)]);
  if (!sender.ready) return false;
  const placedIds = new Set(placed.map(s => s.registrationId));
  if (placedIds.size === 0) return false;
  const { data: regData, error: regError } = await supabaseAdmin.from('league_registrations')
    .select('id, season_id, division_id, guardian_email, guardian_email_2, player_first_name, player_last_name, guardian_first_name, guardian_last_name, team_id, status, link_version')
    .in('id', [...placedIds]);
  if (regError) throw new Error(`Couldn't read the sign-ups for the email: ${regError.message}`);
  type ResendRow = RegRow & { season_id: string; division_id: string; guardian_email: string | null; guardian_email_2: string | null };
  const regs = (regData ?? []) as ResendRow[];

  const plans = await planPlacementInvitations(params.orgId, regs.map(r => r.id), { reconnects: params.reconnects === true });
  if (!plans.get(email)?.children.some(c => c.decision === 'invite')) return false;
  const issued = await issuePlacementInvitation({
    orgId: params.orgId, email, sentByUserId: params.sentByUserId, reconnects: params.reconnects === true,
  });
  if (!issued) return false;
  const mailer = placementMailerFor({ orgId: params.orgId, sender, plans, tokenFor: async () => issued.token });

  const org: MailOrg = await readClubEmailOrg(params.orgId);

  const seasonIds = [...new Set(regs.map(r => r.season_id))];
  const divisionIds = [...new Set(regs.map(r => r.division_id))];
  const [seasons, divisions, facts, face] = await Promise.all([
    supabaseAdmin.from('league_seasons').select('id, name, slug').in('id', seasonIds),
    supabaseAdmin.from('league_divisions').select('id, name').in('id', divisionIds),
    readTeamFacts(regs.map(r => r.team_id).filter((t): t is string => !!t)),
    systemMailFace(org),
  ]);
  if (seasons.error || divisions.error) throw new Error(`Couldn't read the season for the email: ${(seasons.error ?? divisions.error)!.message}`);
  const seasonOf = new Map((seasons.data ?? []).map(s => [s.id as string, s as MailSeason]));
  const divisionName = new Map((divisions.data ?? []).map(d => [d.id as string, d.name as string]));

  const messages: FamilyServiceMessage[] = [];
  for (const seasonId of seasonIds) {
    const season = seasonOf.get(seasonId);
    if (!season) continue;
    const inSeason = regs.filter(r => r.season_id === seasonId);
    const owing = await signupsOwingNow(params.orgId, seasonId, inSeason.map(r => r.id)).catch(() => new Set<string>());
    for (const divisionId of [...new Set(inSeason.map(r => r.division_id))]) {
      for (const role of ['first', 'second'] as const) {
        const children = inSeason.filter(r => r.division_id === divisionId
          && normalizeGuardianEmail(role === 'first' ? r.guardian_email : r.guardian_email_2) === email);
        if (children.length === 0) continue;
        const asMail = mailChildrenOf(children, facts.names);
        const html = leagueTeamsPlacedHtml({
          guardianFirstName: children[0].guardian_first_name?.trim() || 'there',
          seasonName: season.name, divisionName: divisionName.get(divisionId) ?? '', clubName: org.name,
          lines: children.map(c => ({ child: `${c.player_first_name} ${c.player_last_name}`, team: facts.names.get(c.team_id!) ?? '', coaches: facts.coaches.get(c.team_id!) ?? [] })),
          signupUrl: signupUrl(org, season, children[0], owing), contactEmail: face?.contact ?? null, face, invitationSlots: true,
        });
        messages.push({
          to: email,
          subject: placedMail.subject(season.name),
          html: role === 'first'
            ? fillInvitationSlots(html, await mailer.firstFill(email, asMail))
            : await mailer.finishSecondCopy(email, withSecondParentStop(secondParentCopy(html), params.orgId, email), guardianFullName(children[0]), asMail),
        });
      }
    }
  }
  if (messages.length === 0) return false;
  const results = await sendFamilyServiceBatch({
    kind: 'house_league_placement', messages, fromName: face?.sendOpts.fromName ?? null, replyTo: face?.sendOpts.replyTo ?? null,
  });
  return results.some(r => r.status === 'sent' || r.status === 'skipped');
}
