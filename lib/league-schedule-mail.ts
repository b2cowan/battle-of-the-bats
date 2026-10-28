import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { chunked, fetchAll, fetchAllIn } from './supabase-paging';
import { getOrgPlaceNames, getSeasonGamesEveryStatus } from './db';
import { sendFamilyServiceBatch, type FamilyServiceMessage } from './family-email';
import { leagueScheduleNoticeHtml } from './email';
import { systemMailFace, type ClubEmailOrg } from './club-email-context';
import { seasonEmailReason, SEASON_EMAIL_WORDS as SW } from './families-words';
import { timesInZoneSentence } from './timezone';
import { memberDisplayName } from './member-names';
import { coachCopyWords, leagueCoachesToCopy, sendCoachCopies } from './families-email-coaches';
import { asLastSent, heldChangesOf, sendHeldChanges, snapshotOf, type HeldGameOf, type SendHeldResult } from './league-game-changes-server';
import { netChangeOf, publicState, type GameSnapshot, type HeldChange, type NetChange } from './league-game-changes';
import { changeLine, publishedLine, scheduleEmailWords, type PlaceText, type SchedulePart } from './league-schedule-email';
import { SCHEDULE_EMAIL_WORDS } from './league-schedule-words';
import type { EmailWords } from './club-schedule-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE FAMILIES' GAME EMAILS (House League 9d-2b Part 4; frames f3, f4; rulings 9d2·1, 9d2·2; mig 409 + 410).
 *
 * A fact first, an email second, as Publish teams (9c): Publish schedule and a division's send write the notice and one
 * `league_schedule_emails` row per family in ONE transaction; only then does this send. Each row is CLAIMED first
 * (`league_schedule_emails_claim`, mig 410 — the mig 378 pattern), so the send and "Send to the N it missed" on the
 * season's Email families history can race and still never email a family twice; each row's outcome is written back, and
 * the notice's reached / failed are recounted from the rows after every send.
 *
 *   · SERVICE notices (`sendFamilyServiceBatch`): about the family's own children, so a family who left club news still
 *     gets them (9c·4's ground). Never counted toward a cap (Q12c).
 *   · ⚖ WHAT A "GAMES CHANGED" EMAIL SAYS IS READ FROM THE ROWS THE SEND STAMPED (`league_game_changes.notice_id`): each
 *     game's net effect from its earliest `before` to its latest `after` — what was SENT, so a resend days later says the
 *     same thing, not whatever the game has become. A game played since is left out (its result is the news).
 *   · "Schedule published" lists each child's team's games as families now know them (`asLastSent`; on games only).
 *   · The coaches of a changed game's two teams get a copy on the FIRST send (Changes to send's foot: "The {6} teams'
 *     coaches get a copy"), never on a resend. Publish copies nobody: its coaches see their games on their team page.
 *   · No bell here: 9d2·13's bell to the league admins is the CLUB's send (Part 5), not a league admin's own send.
 * Dev sends no email: the rows' statuses, the notice's counts and the server log say who would have been mailed.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ScheduleMailOrg extends ClubEmailOrg { slug: string }
export interface ScheduleMailSeason { id: string; name: string; slug: string }

/** A notice's families after a send: how many it was going to, how many it reached, how many didn't send. */
export interface ScheduleSendOutcome { families: number; reached: number; failed: number }

type NoticeKind = 'schedule_published' | 'games_changed';
interface NoticeRow { id: string; kind: NoticeKind; division_id: string | null; season_id: string; family_count: number }
interface EmailRow { id: string; guardian_email: string; registration_ids: string[] }
interface RegRow {
  id: string; player_first_name: string; player_last_name: string; guardian_first_name: string | null; team_id: string | null;
  status: string;
}

const schedulePath = (org: ScheduleMailOrg, season: ScheduleMailSeason) =>
  `/${encodeURIComponent(org.slug)}/league/${encodeURIComponent(season.slug)}/schedule`;

/** A game's place as families read it: "Maple Grove Park · Diamond 1", or what was typed. */
async function placeReader(orgId: string): Promise<PlaceText> {
  const places = await getOrgPlaceNames(orgId);
  return s => {
    const venue = s.venueId ? places.venues.get(s.venueId) : null;
    if (!venue) return s.location?.trim() ?? '';
    const facility = s.facilityId ? places.facilities.get(s.facilityId) : null;
    return facility ? `${venue.name} · ${facility}` : venue.name;
  };
}

async function teamNames(divisionId: string): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin.from('league_teams').select('id, name').eq('division_id', divisionId);
  if (error) throw new Error(`Couldn't read the teams for the email: ${error.message}`);
  return new Map((data ?? []).map(t => [t.id as string, t.name as string]));
}

const gameTitle = (names: ReadonlyMap<string, string>, home: string, away: string) =>
  `${names.get(home) ?? ''} vs ${names.get(away) ?? ''}`;

/** Each team's lines for "Schedule published": its games families now know of, on, in date order. */
async function publishedLinesByTeam(seasonId: string, divisionId: string, names: ReadonlyMap<string, string>, placeOf: PlaceText) {
  const [games, held] = await Promise.all([getSeasonGamesEveryStatus(seasonId), heldChangesOf(seasonId, divisionId)]);
  const known = asLastSent(games.filter(g => g.divisionId === divisionId), held)
    .filter(g => publicState(g.status) === 'on' && g.scheduledAt)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
  const out = new Map<string, string[]>();
  for (const g of known) {
    const line = publishedLine(snapshotOf(g), gameTitle(names, g.homeTeamId, g.awayTeamId), placeOf);
    for (const t of [g.homeTeamId, g.awayTeamId]) (out.get(t) ?? out.set(t, []).get(t)!).push(line);
  }
  return out;
}

/** A changed game with the two teams it tells. */
export interface TeamsNet { net: NetChange; homeTeamId: string; awayTeamId: string }

/** Each team's lines for "Games changed", in the order the games are played. */
export function changedLinesByTeam(nets: readonly TeamsNet[], names: ReadonlyMap<string, string>, placeOf: PlaceText) {
  const at = (n: TeamsNet) => n.net.now.scheduledAt ?? n.net.before?.scheduledAt ?? '';
  const out = new Map<string, string[]>();
  for (const n of [...nets].sort((a, b) => at(a).localeCompare(at(b)))) {
    const line = changeLine(n.net, gameTitle(names, n.homeTeamId, n.awayTeamId), placeOf);
    if (!line) continue;
    for (const t of new Set([n.homeTeamId, n.awayTeamId])) (out.get(t) ?? out.set(t, []).get(t)!).push(line);
  }
  return out;
}

/** What a sent "games changed" notice told families: each game's net effect over the rows the send stamped. */
async function sentNets(noticeId: string): Promise<TeamsNet[]> {
  const rows = await fetchAll<{ id: string; game_id: string; kind: HeldChange['kind']; before: GameSnapshot | null; after: GameSnapshot; source: HeldChange['source']; created_at: string }>(
    (a, b) => supabaseAdmin.from('league_game_changes').select('id, game_id, kind, before, after, source, created_at')
      .eq('notice_id', noticeId).order('created_at').order('id').range(a, b));
  const byGame = new Map<string, HeldChange[]>();
  for (const r of rows) {
    const c: HeldChange = { id: r.id, gameId: r.game_id, kind: r.kind, before: r.before, after: r.after, source: r.source, createdAt: r.created_at };
    (byGame.get(r.game_id) ?? byGame.set(r.game_id, []).get(r.game_id)!).push(c);
  }
  if (!byGame.size) return [];
  const games = await fetchAllIn<{ id: string; home_team_id: string; away_team_id: string; status: string }>(
    [...byGame.keys()], (c, a, b) => supabaseAdmin.from('league_games').select('id, home_team_id, away_team_id, status').in('id', c).order('id').range(a, b));
  const out: TeamsNet[] = [];
  for (const g of games) {
    if (g.status === 'completed') continue;
    const list = byGame.get(g.id)!;
    const net = netChangeOf(list, list[list.length - 1].after);
    if (net) out.push({ net, homeTeamId: g.home_team_id, awayTeamId: g.away_team_id });
  }
  return out;
}

/** One family's parts: each of its children still on a team whose games are in this email. */
function partsOf(regIds: readonly string[], regs: ReadonlyMap<string, RegRow>, names: ReadonlyMap<string, string>, linesByTeam: ReadonlyMap<string, string[]>): SchedulePart[] {
  const parts: SchedulePart[] = [];
  for (const id of regIds) {
    const r = regs.get(id);
    if (!r || r.status !== 'active' || !r.team_id) continue;
    const lines = linesByTeam.get(r.team_id);
    if (!lines?.length) continue;
    parts.push({ child: r.player_first_name.trim() || `${r.player_first_name} ${r.player_last_name}`.trim(), team: names.get(r.team_id) ?? '', lines });
  }
  return parts;
}

async function readRegs(seasonId: string, regIds: readonly string[]): Promise<Map<string, RegRow>> {
  const rows = await fetchAllIn<RegRow>([...new Set(regIds)], (c, a, b) => supabaseAdmin.from('league_registrations')
    .select('id, player_first_name, player_last_name, guardian_first_name, team_id, status')
    .in('id', c).eq('season_id', seasonId).order('id').range(a, b));
  return new Map(rows.map(r => [r.id, r]));
}

/** Write an outcome onto rows this send still holds (`sending`): a newer send that took them over is never overwritten. */
async function recordOutcome(ids: readonly string[], status: 'sent' | 'failed' | 'skipped'): Promise<void> {
  for (const chunk of chunked([...ids])) {
    const { error } = await supabaseAdmin.from('league_schedule_emails')
      .update({ status, updated_at: new Date().toISOString() }).in('id', chunk).eq('status', 'sending');
    if (error) console.error('[league-schedule-mail] an outcome was not recorded:', error.message);
  }
}

/**
 * The notice's reached / failed, recounted from its rows (a resend included). ⚖ `failed` is every family still to reach —
 * failed, or never tried (a send that stopped before it) — so it is exactly what "Send to the N it missed" can send; a
 * family with nothing left to say (`skipped`) is neither. Never throws: the emails have gone.
 */
async function refreshCounts(notice: Pick<NoticeRow, 'id' | 'family_count'>): Promise<ScheduleSendOutcome> {
  const fallback = { families: notice.family_count, reached: 0, failed: 0 };
  try {
    const rows = await fetchAll<{ id: string; status: string }>((a, b) => supabaseAdmin.from('league_schedule_emails')
      .select('id, status').eq('notice_id', notice.id).order('id').range(a, b));
    const reached = rows.filter(r => r.status === 'sent').length;
    const failed = rows.filter(r => r.status === 'failed' || r.status === 'pending' || r.status === 'sending').length;
    const { error } = await supabaseAdmin.from('league_season_notices')
      .update({ reached_count: reached, failed_count: failed }).eq('id', notice.id);
    if (error) throw error;
    return { families: notice.family_count, reached, failed };
  } catch (err) {
    console.error('[league-schedule-mail] a notice\'s counts were not updated (the emails went):', err instanceof Error ? err.message : String(err));
    return fallback;
  }
}

/** The facts every email of a notice is built from: the teams, each team's lines, the face and the close. */
async function noticeFacts(org: ScheduleMailOrg, season: ScheduleMailSeason, notice: NoticeRow) {
  const divisionId = notice.division_id;
  if (!divisionId) throw new Error('A schedule notice has no division');
  const [names, placeOf] = await Promise.all([teamNames(divisionId), placeReader(org.id)]);
  const nets = notice.kind === 'games_changed' ? await sentNets(notice.id) : [];
  const linesByTeam = notice.kind === 'games_changed'
    ? changedLinesByTeam(nets, names, placeOf)
    : await publishedLinesByTeam(season.id, divisionId, names, placeOf);
  return { names, linesByTeam };
}

const wordsFor = (org: ScheduleMailOrg, season: ScheduleMailSeason, kind: NoticeKind, guardianFirst: string | null, parts: readonly SchedulePart[]) =>
  scheduleEmailWords({
    kind: kind === 'schedule_published' ? 'published' : 'changed', club: org.name, season: season.name, guardianFirst, parts,
    zoneSentence: timesInZoneSentence(), schedulePath: schedulePath(org, season),
  });

/**
 * Send a notice's families their emails: every row not yet sent (pending, failed, or left `sending` by a send that died).
 * `copyCoachesFor` (the actor) on a "games changed" notice's FIRST send only. NEVER THROWS — the publish or the send has
 * landed by the time this runs: a failure after the claim marks the rows `failed`; one before it leaves them `pending`.
 * Either way they are the history's "Send to the N it missed", and the answer's `reached` says how many went.
 */
export async function sendScheduleNotice(p: {
  org: ScheduleMailOrg; season: ScheduleMailSeason; noticeId: string; copyCoachesFor?: string;
}): Promise<ScheduleSendOutcome> {
  try {
    return await sendNotice(p);
  } catch (err) {
    console.error('[league-schedule-mail] a notice\'s emails didn\'t start (its families wait to be sent):', err instanceof Error ? err.message : String(err));
    // Recounted, so the families never tried read as "didn't send" and the history offers them again.
    const { data } = await supabaseAdmin.from('league_season_notices').select('family_count').eq('id', p.noticeId).maybeSingle();
    return refreshCounts({ id: p.noticeId, family_count: (data?.family_count as number | undefined) ?? 0 });
  }
}

async function sendNotice(p: {
  org: ScheduleMailOrg; season: ScheduleMailSeason; noticeId: string; copyCoachesFor?: string;
}): Promise<ScheduleSendOutcome> {
  const { data: n, error: nErr } = await supabaseAdmin.from('league_season_notices')
    .select('id, kind, division_id, season_id, family_count').eq('id', p.noticeId).eq('org_id', p.org.id).eq('season_id', p.season.id).maybeSingle();
  if (nErr) throw new Error(`Couldn't read the notice: ${nErr.message}`);
  if (!n || (n.kind !== 'schedule_published' && n.kind !== 'games_changed')) throw new Error('Not a schedule notice');
  const notice = n as NoticeRow;

  const { data: unsent, error: uErr } = await supabaseAdmin.from('league_schedule_emails').select('id')
    .eq('notice_id', notice.id).in('status', ['pending', 'failed', 'sending']);
  if (uErr) throw new Error(`Couldn't read the emails: ${uErr.message}`);
  const { data: claimed, error: claimError } = await supabaseAdmin.rpc('league_schedule_emails_claim', {
    p_org: p.org.id, p_ids: (unsent ?? []).map(r => r.id as string),
  });
  if (claimError) throw new Error(`Couldn't claim the emails: ${claimError.message}`);
  const ids = ((claimed ?? []) as unknown[]).map(v => (typeof v === 'string' ? v : (v as Record<string, string>).league_schedule_emails_claim));
  if (ids.length === 0) return refreshCounts(notice);

  try {
    await sendClaimed(p, notice, ids);
  } catch (err) {
    console.error('[league-schedule-mail] a send failed after its claim (its rows are marked failed):', err instanceof Error ? err.message : String(err));
    await recordOutcome(ids, 'failed');
  }
  return refreshCounts(notice);
}

async function sendClaimed(p: { org: ScheduleMailOrg; season: ScheduleMailSeason; copyCoachesFor?: string }, notice: NoticeRow, ids: readonly string[]) {
  const rows = await fetchAllIn<EmailRow>([...ids], (c, a, b) => supabaseAdmin.from('league_schedule_emails')
    .select('id, guardian_email, registration_ids').in('id', c).order('id').range(a, b));
  const [regs, facts, face] = await Promise.all([
    readRegs(p.season.id, rows.flatMap(r => r.registration_ids)),
    noticeFacts(p.org, p.season, notice),
    systemMailFace(p.org),
  ]);

  const messages: FamilyServiceMessage[] = [];
  const messageRows: { id: string; teams: string[] }[] = [];
  const nothingToSay: string[] = [];
  for (const row of rows) {
    const parts = partsOf(row.registration_ids, regs, facts.names, facts.linesByTeam);
    if (!parts.length) { nothingToSay.push(row.id); continue; }
    const first = regs.get(row.registration_ids[0])?.guardian_first_name ?? null;
    const w = wordsFor(p.org, p.season, notice.kind, first, parts);
    messages.push({
      to: row.guardian_email, subject: w.subject,
      html: leagueScheduleNoticeHtml({ greeting: w.greeting, lists: w.lists, link: w.link, outro: w.outro, foot: w.foot ?? null, reason: seasonEmailReason(p.season.name), face }),
    });
    messageRows.push({ id: row.id, teams: [...new Set(row.registration_ids.map(id => regs.get(id)?.team_id).filter((t): t is string => !!t))] });
  }

  const results = messages.length === 0 ? [] : await sendFamilyServiceBatch({
    kind: notice.kind === 'schedule_published' ? 'house_league_schedule_published' : 'house_league_games_changed',
    messages, fromName: face?.sendOpts.fromName ?? null, replyTo: face?.sendOpts.replyTo ?? null,
  });
  const byStatus = new Map<'sent' | 'failed' | 'skipped', string[]>([['sent', []], ['failed', []], ['skipped', [...nothingToSay]]]);
  const reachedByTeam = new Map<string, number>();
  results.forEach((r, i) => {
    const status = r.status === 'sent' ? 'sent' : r.status === 'skipped' ? 'skipped' : 'failed';
    byStatus.get(status)!.push(messageRows[i].id);
    if (status === 'sent') for (const t of messageRows[i].teams) reachedByTeam.set(t, (reachedByTeam.get(t) ?? 0) + 1);
  });
  for (const [status, list] of byStatus) if (list.length) await recordOutcome(list, status);

  if (notice.kind === 'games_changed' && p.copyCoachesFor) {
    await copyCoaches(p.org, p.season, p.copyCoachesFor, facts, new Set(rows.map(r => r.guardian_email)), reachedByTeam, face?.sendOpts.replyTo ?? null);
  }
}

/**
 * The coaches' copy (9d2·2: "copy their coaches"): each changed team's coaches get that team's changes, once per team,
 * never the sender, never a coach who is also a parent this send reached (they had the family email). Colleague mail
 * (lib/families-email-coaches.ts), the 9d-1 coach copy's words. Never throws: the families' emails have gone.
 */
async function copyCoaches(org: ScheduleMailOrg, season: ScheduleMailSeason, actorId: string,
  facts: { names: ReadonlyMap<string, string>; linesByTeam: ReadonlyMap<string, string[]> },
  familyAddresses: ReadonlySet<string>, reachedByTeam: ReadonlyMap<string, number>, replyTo: string | null) {
  try {
    const sender = (await memberDisplayName(org.id, actorId)) ?? org.name;
    for (const [teamId, lines] of facts.linesByTeam) {
      const team = facts.names.get(teamId);
      if (!team || !lines.length) continue;
      const coaches = await leagueCoachesToCopy(org.id, season.id, [teamId], actorId, familyAddresses);
      if (!coaches.length) continue;
      await sendCoachCopies(coaches, c => coachCopyWords({
        orgName: org.name, audience: team, families: reachedByTeam.get(teamId) ?? 0,
        subject: SCHEDULE_EMAIL_WORDS.changedSubject([team]), body: lines.map(l => l.replace(/\n/g, ' · ')).join('\n\n'),
        sender, coachName: c.name, league: true,
      }), replyTo);
    }
  } catch (err) {
    console.error('[league-schedule-mail] the coaches\' copies failed (the families\' emails went):', err instanceof Error ? err.message : String(err));
  }
}

/**
 * SEND THE CHANGES AND TELL FAMILIES (f2, and f5's one urgent game): the claim (`sendHeldChanges`), then the emails from
 * the rows it wrote, the coaches copied. `reached` / `failed` are the families' outcome ("Reached 64 of 66 families").
 */
export async function sendChangesAndTell(p: {
  org: ScheduleMailOrg; season: ScheduleMailSeason; divisionId: string; actorId: string; changeIds: readonly string[];
}): Promise<Exclude<SendHeldResult, { refusal: null }> | (Extract<SendHeldResult, { refusal: null }> & ScheduleSendOutcome)> {
  const r = await sendHeldChanges({ orgId: p.org.id, seasonId: p.season.id, divisionId: p.divisionId, actorId: p.actorId, changeIds: p.changeIds });
  if (r.refusal !== null) return r;
  if (!r.notice) return { ...r, reached: 0, failed: 0 };
  const sent = await sendScheduleNotice({ org: p.org, season: p.season, noticeId: r.notice, copyCoachesFor: p.actorId });
  return { ...r, ...sent };
}

/** How many of a notice's families are still to reach (the history's "Send to the N it missed"). */
export async function noticeMissed(noticeId: string): Promise<number> {
  const { count, error } = await supabaseAdmin.from('league_schedule_emails').select('id', { count: 'exact', head: true })
    .eq('notice_id', noticeId).in('status', ['pending', 'failed', 'sending']);
  if (error) throw error;
  return count ?? 0;
}

// ── "See the email" (e2) and "See their email" (f2) ─────────────────────────────────────────────────────────────

/** A sample family's email before the press: `teams` are the teams the email is about. */
export interface ScheduleSample { to: string; words: EmailWords }

async function sampleFor(org: ScheduleMailOrg, season: ScheduleMailSeason, kind: NoticeKind, teamIds: ReadonlySet<string>,
  names: ReadonlyMap<string, string>, linesByTeam: ReadonlyMap<string, string[]>, pick?: (families: RegRow[][]) => RegRow[] | undefined): Promise<ScheduleSample | null> {
  const regs = await fetchAllIn<RegRow & { guardian_email: string | null }>([...teamIds], (c, a, b) => supabaseAdmin.from('league_registrations')
    .select('id, player_first_name, player_last_name, guardian_first_name, team_id, status, guardian_email')
    .eq('season_id', season.id).eq('status', 'active').in('team_id', c).order('id').range(a, b));
  const families = new Map<string, RegRow[]>();
  for (const r of regs) {
    const email = (r.guardian_email ?? '').trim().toLowerCase();
    if (email) (families.get(email) ?? families.set(email, []).get(email)!).push(r);
  }
  const list = [...families.values()].map(f => f.sort((a, b) => `${a.player_first_name} ${a.player_last_name}`.localeCompare(`${b.player_first_name} ${b.player_last_name}`)));
  // The family with the most children (the email's fullest shape), then by name — or the caller's own pick.
  const family = pick?.(list) ?? [...list].sort((a, b) => b.length - a.length || a[0].player_first_name.localeCompare(b[0].player_first_name))[0];
  if (!family) return null;
  const byId = new Map(family.map(r => [r.id, r]));
  const parts = partsOf(family.map(r => r.id), byId, names, linesByTeam);
  if (!parts.length) return null;
  return {
    to: family[0].player_last_name ? SW.oneFamilyTo(family[0].player_last_name) : (family[0].guardian_first_name ?? ''),
    words: wordsFor(org, season, kind, family[0].guardian_first_name, parts),
  };
}

/** e2's "See the email": the division's family with the most children, as Publish would email them now. */
export async function publishSample(org: ScheduleMailOrg, season: ScheduleMailSeason, divisionId: string): Promise<ScheduleSample | null> {
  const [names, placeOf] = await Promise.all([teamNames(divisionId), placeReader(org.id)]);
  const linesByTeam = await publishedLinesByTeam(season.id, divisionId, names, placeOf);
  return sampleFor(org, season, 'schedule_published', new Set(names.keys()), names, linesByTeam);
}

/** f2's "See their email": the family with children on two of the changed games' teams (else the fullest one). */
export async function changesSample(org: ScheduleMailOrg, season: ScheduleMailSeason, divisionId: string, held: readonly HeldGameOf[]): Promise<ScheduleSample | null> {
  const nets: TeamsNet[] = held.filter(h => h.news).map(h => ({ net: h.news!, homeTeamId: h.homeTeamId, awayTeamId: h.awayTeamId }));
  if (!nets.length) return null;
  const [names, placeOf] = await Promise.all([teamNames(divisionId), placeReader(org.id)]);
  const linesByTeam = changedLinesByTeam(nets, names, placeOf);
  const teams = new Set([...linesByTeam.keys()]);
  return sampleFor(org, season, 'games_changed', teams, names, linesByTeam,
    list => list.filter(f => new Set(f.map(r => r.team_id)).size > 1).sort((a, b) => a[0].player_first_name.localeCompare(b[0].player_first_name))[0]);
}
