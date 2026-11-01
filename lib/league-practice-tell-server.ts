import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { chunked, fetchAll, fetchAllIn } from './supabase-paging';
import { getOrgPlaceNames } from './db';
import { sendFamilyServiceBatch, type FamilyServiceMessage } from './family-email';
import { isSendableGuardianEmail, normalizeGuardianEmail } from './guardian-email';
import { leaguePracticesChangedHtml } from './email';
import { systemMailFace, type ClubEmailOrg } from './club-email-context';
import { seasonEmailReason, SEASON_EMAIL_WORDS as SW } from './families-words';
import { formatShortWeekdayDate, mondayOfDay, timesInZoneSentence, utcToZonedInputs } from './timezone';
import { formatTime } from './utils';
import { memberDisplayName } from './member-names';
import { readHouseholds, type Household } from './club-schedule-league-mail';
import {
  changeLines, dateLines, placeOfTold, practiceTimesEmailWords, snapshotOf, teamChange, tellStateOf,
  type CurrentPractice, type TeamTellState, type TellPart, type ToldPractice,
} from './league-practice-tell';
import type { EmailWords } from './club-schedule-words';
import type { LeagueSeason } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TELLING FAMILIES THEIR PRACTICE TIMES, SERVER SIDE (House League Stage 9d-3 Parts 2–3; rulings 9d3·1, 9d3·4, 9d3·6;
 * mig 415). The Tell step's read, the press, the send and "Send again" — the pure rules are lib/league-practice-tell.ts.
 *
 *   · A FACT FIRST, AN EMAIL SECOND (the 9d-2b pattern, lib/league-schedule-mail.ts): the press writes the notice, what it
 *     tells each team and one row per household in ONE transaction (`league_practices_tell`), and only then does this
 *     send. Each row is CLAIMED first, so the send, a double press and "Send again" never email a family twice. A
 *     household's row is marked sent with its teams marked told in the same statement (`league_practice_emails_sent`):
 *     "a family is marked as told only once its email goes".
 *   · ⚖ HOUSEHOLDS COME FROM `readHouseholds` AND NOWHERE ELSE (the build prompt; Stage 3 of
 *     SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md widens that one reader to a second address and every family email follows).
 *   · SERVICE notices (`sendFamilyServiceBatch`): about the family's own children, so a family who left club news still
 *     gets them (9c·4's ground). Never counted toward a cap (Q12c). No link, no button, no unsubscribe link.
 *   · ⚖ WHAT AN EMAIL SAYS IS WHAT THE SEND TOLD (`league_practice_tells`): a first email's dates are the snapshot at the
 *     press; a change is the snapshot against the Was side read under the lock — so "Send again" days later says the same
 *     thing, only the dates already past left out.
 *   · A team counts only once it has families: a team nobody is registered on is never "not told".
 * Dev sends no email: a row the transport skipped there counts as reached (so a walk can see the told state follow), and
 * the server log says who would have been mailed.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface TellMailOrg extends ClubEmailOrg { slug?: string }

const quietTransport = () => process.env.NODE_ENV !== 'production';

interface PracticeRow { team_id: string; scheduled_at: string; ends_at: string | null; org_venue_id: string | null; org_venue_facility_id: string | null; location: string | null; club_schedule_slot_id: string | null }

/** Each team's upcoming practices that are on (not cancelled), as families would be told them. */
export async function readPracticesNow(orgId: string, teamIds: readonly string[]): Promise<Map<string, CurrentPractice[]>> {
  const out = new Map<string, CurrentPractice[]>(teamIds.map(t => [t, []]));
  if (!teamIds.length) return out;
  const rows = await fetchAllIn<PracticeRow & { id: string }>([...teamIds], (c, a, b) => supabaseAdmin.from('league_practices')
    .select('id, team_id, scheduled_at, ends_at, org_venue_id, org_venue_facility_id, location, club_schedule_slot_id')
    .eq('org_id', orgId).in('team_id', c).neq('status', 'cancelled').gt('scheduled_at', new Date().toISOString())
    .order('id').range(a, b));
  for (const r of rows) {
    out.get(r.team_id)?.push({
      s: r.scheduled_at, e: r.ends_at, v: r.org_venue_id, f: r.org_venue_id ? r.org_venue_facility_id : null,
      l: r.org_venue_id ? null : r.location, slot: r.club_schedule_slot_id,
    });
  }
  return out;
}

export interface ToldRow { at: string; snapshot: ToldPractice[] }

/** What each team's families were told (no entry = never told). */
export async function readTold(teamIds: readonly string[]): Promise<Map<string, ToldRow>> {
  if (!teamIds.length) return new Map();
  const rows = await fetchAllIn<{ team_id: string; told_at: string; snapshot: ToldPractice[] }>([...teamIds], (c, a, b) =>
    supabaseAdmin.from('league_team_practices_told').select('team_id, told_at, snapshot').in('team_id', c).order('team_id').range(a, b));
  return new Map(rows.map(r => [r.team_id, { at: r.told_at, snapshot: r.snapshot ?? [] }]));
}

/**
 * The club's practice-change send emailed these teams' families (11b Part 5): a team already told now knows its practices
 * as they are, so its told snapshot follows — or the next hand-out would send them the same change again. A team never
 * told stays untold (its first email lists every date). Never throws: the emails have gone.
 */
export async function refreshToldAfterClubSend(orgId: string, teamIds: readonly string[]): Promise<void> {
  try {
    const told = await readTold(teamIds);
    if (!told.size) return;
    const now = await readPracticesNow(orgId, [...told.keys()]);
    const at = new Date().toISOString();
    for (const teamId of told.keys()) {
      const { error } = await supabaseAdmin.from('league_team_practices_told')
        .update({ told_at: at, snapshot: snapshotOf(now.get(teamId) ?? [], Date.now()), notice_id: null, updated_at: at })
        .eq('team_id', teamId);
      if (error) throw error;
    }
  } catch (err) {
    console.error('[league-practice-tell] a told team was not refreshed after the club\'s send:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * A moved child's new team's dates (9d-3 Part 4, ruled 2026-11-01; owner 2026-10-31: only when that team has been TOLD):
 * every upcoming date FROM THE TOLD SNAPSHOT, one line each, so a later change reaches the moved family through the same
 * change email as everyone else. No entry for a team never told (the family gets that team's first notice).
 */
export async function toldDateLines(orgId: string, teamIds: readonly string[]): Promise<Map<string, string[]>> {
  const told = await readTold([...new Set(teamIds)]);
  if (!told.size) return new Map();
  const placeOf = await placeReader(orgId);
  const nowMs = Date.now();
  return new Map([...told].map(([t, r]) => [t, dateLines(r.snapshot, nowMs, placeOf)] as const).filter(([, lines]) => lines.length > 0));
}

interface TeamRow { id: string; name: string; division_id: string }

async function divisionTeams(seasonId: string, divisionId: string): Promise<TeamRow[]> {
  const { data, error } = await supabaseAdmin.from('league_teams').select('id, name, division_id')
    .eq('season_id', seasonId).eq('division_id', divisionId).order('sort_order').order('created_at');
  if (error) throw error;
  return (data ?? []) as TeamRow[];
}

/** A place's words from the club's places. */
async function placeReader(orgId: string) {
  const places = await getOrgPlaceNames(orgId);
  return placeOfTold({ venue: id => places.venues.get(id)?.name ?? null, facility: id => places.facilities.get(id) ?? null });
}

/** A household that can be emailed: a usable address, and only its children on these teams. */
function sendableHouseholds(all: readonly Household[], seasonId: string, teams: ReadonlySet<string>): Household[] {
  return all
    .filter(h => h.seasonId === seasonId && isSendableGuardianEmail(normalizeGuardianEmail(h.email)))
    .map(h => ({ ...h, children: h.children.filter(c => teams.has(c.teamId)) }))
    .filter(h => h.children.length > 0);
}

/** Who won't get it: an active child on these teams with no email, or one no mail can reach. */
export interface LeftOutFamily { registrationId: string; name: string; team: string; email: string | null }

async function readLeftOut(seasonId: string, teams: ReadonlyMap<string, string>): Promise<LeftOutFamily[]> {
  if (!teams.size) return [];
  const regs = await fetchAllIn<{ id: string; team_id: string; player_first_name: string; player_last_name: string; guardian_email: string | null }>(
    [...teams.keys()], (c, a, b) => supabaseAdmin.from('league_registrations')
      .select('id, team_id, player_first_name, player_last_name, guardian_email')
      .eq('season_id', seasonId).eq('status', 'active').in('team_id', c).order('id').range(a, b));
  return regs
    .filter(r => !isSendableGuardianEmail(normalizeGuardianEmail(r.guardian_email)))
    .map(r => ({ registrationId: r.id, name: `${r.player_first_name} ${r.player_last_name}`.trim(), team: teams.get(r.team_id) ?? '', email: r.guardian_email?.trim() || null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Most practices any team has in one week, upcoming (the step's "{n} practices a week handed out" — the window's count). */
function perWeekOf(now: ReadonlyMap<string, readonly ToldPractice[]>): number {
  let total = 0;
  for (const list of now.values()) {
    const weeks = new Map<string, number>();
    for (const p of list) { const w = mondayOfDay(utcToZonedInputs(p.s).date); weeks.set(w, (weeks.get(w) ?? 0) + 1); }
    total += Math.max(0, ...weeks.values());
  }
  return total;
}

// ── The Tell step's read ─────────────────────────────────────────────────────────────────────────────────────

export interface TellTeam { id: string; name: string; state: TeamTellState; toldAt: string | null; families: number }
/** A team to tell, with the told time the step read (the press refuses when it moved underneath). */
export interface TellSaw { teamId: string; saw: string | null; kind: 'first' | 'change' }

export interface TellRead {
  division: { id: string; name: string };
  finished: boolean;
  teams: TellTeam[];
  tell: TellSaw[];
  /** Households that will be sent (usable address, a child on a team to tell). */
  households: number;
  twoTeams: number;
  /** Of them: households with a child on a CHANGED team; households only on never-told teams. */
  toldHouseholds: number;
  freshHouseholds: number;
  perWeek: number;
  leftOut: LeftOutFamily[];
  /** Teams with families and no practices (frame c1b: "Hand out for them"), and their households. */
  noPractices: { teams: string[]; families: number };
  /** The division's last send: who, how many, when (for "Everyone has been told"). */
  last: { by: string; families: number; date: string; time: string } | null;
  /** The division's last send, still missing families ("Send again"). */
  open: { noticeId: string; families: number; reached: number; missed: number; missedFamilies: LeftOutFamily[] } | null;
  sample: { to: string; words: EmailWords } | null;
}

export async function readTell(org: TellMailOrg, season: LeagueSeason, division: { id: string; name: string }): Promise<TellRead> {
  const teams = await divisionTeams(season.id, division.id);
  const ids = teams.map(t => t.id);
  const nowMs = Date.now();
  const [now, told, all] = await Promise.all([readPracticesNow(org.id, ids), readTold(ids), readHouseholds(ids)]);
  const names = new Map(teams.map(t => [t.id, t.name]));
  const reachable = sendableHouseholds(all, season.id, new Set(ids));
  const familiesOf = (teamId: string) => all.filter(h => h.seasonId === season.id && h.children.some(c => c.teamId === teamId)).length;

  const rows: TellTeam[] = teams.map(t => {
    const tl = told.get(t.id) ?? null;
    return { id: t.id, name: t.name, state: tellStateOf(now.get(t.id) ?? [], tl, nowMs), toldAt: tl?.at ?? null, families: familiesOf(t.id) };
  });
  // A team counts once it has families (anyone registered on it, with an email or not).
  const registered = await registeredTeams(season.id, ids);
  const tell: TellSaw[] = rows.filter(r => (r.state === 'untold' || r.state === 'changed') && registered.has(r.id))
    .map(r => ({ teamId: r.id, saw: r.toldAt, kind: r.state === 'changed' ? 'change' : 'first' }));
  const tellSet = new Set(tell.map(t => t.teamId));
  const changed = new Set(tell.filter(t => t.kind === 'change').map(t => t.teamId));
  const going = sendableHouseholds(all, season.id, tellSet);

  const tellNames = new Map([...tellSet].map(t => [t, names.get(t) ?? '']));
  const [leftOut, lastAndOpen, sample] = await Promise.all([
    readLeftOut(season.id, tellNames),
    readLast(org.id, season.id, division.id, names),
    going.length ? sampleOf(org, season, going, names, now, told, changed, nowMs) : Promise.resolve(null),
  ]);
  const without = rows.filter(r => r.state === 'none' && registered.has(r.id));
  return {
    division,
    finished: season.status === 'completed' || season.status === 'archived',
    teams: rows,
    tell,
    households: going.length,
    twoTeams: going.filter(h => new Set(h.children.map(c => c.teamId)).size > 1).length,
    toldHouseholds: going.filter(h => h.children.some(c => changed.has(c.teamId))).length,
    freshHouseholds: going.filter(h => h.children.every(c => !changed.has(c.teamId))).length,
    perWeek: perWeekOf(new Map([...now].filter(([t]) => tellSet.has(t) || told.has(t)))),
    leftOut,
    noPractices: { teams: without.map(r => r.name), families: reachable.filter(h => h.children.some(c => without.some(w => w.id === c.teamId))).length },
    ...lastAndOpen,
    sample,
  };
}

async function registeredTeams(seasonId: string, teamIds: readonly string[]): Promise<Set<string>> {
  if (!teamIds.length) return new Set();
  const regs = await fetchAllIn<{ team_id: string }>([...teamIds], (c, a, b) => supabaseAdmin.from('league_registrations')
    .select('team_id').eq('season_id', seasonId).eq('status', 'active').in('team_id', c).order('id').range(a, b));
  return new Set(regs.map(r => r.team_id));
}

async function readLast(orgId: string, seasonId: string, divisionId: string, names: ReadonlyMap<string, string>): Promise<Pick<TellRead, 'last' | 'open'>> {
  const { data, error } = await supabaseAdmin.from('league_season_notices')
    .select('id, family_count, reached_count, failed_count, created_by, created_at')
    .eq('org_id', orgId).eq('season_id', seasonId).eq('division_id', divisionId).eq('kind', 'practices_sent')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return { last: null, open: null };
  const by = (data.created_by ? await memberDisplayName(orgId, data.created_by as string) : null) ?? 'A league admin';
  const at = utcToZonedInputs(data.created_at as string);
  const last = { by, families: data.reached_count as number, date: formatShortWeekdayDate(at.date), time: formatTime(at.time) };
  const missed = await missedOf(data.id as string, seasonId, names);
  const open = missed.length
    ? { noticeId: data.id as string, families: data.family_count as number, reached: data.reached_count as number, missed: missed.length, missedFamilies: missed }
    : null;
  return { last, open };
}

/** A send's households still to reach (failed, or never tried), as the See them window names them. */
async function missedOf(noticeId: string, seasonId: string, names: ReadonlyMap<string, string>): Promise<LeftOutFamily[]> {
  const rows = await fetchAll<{ guardian_email: string; registration_ids: string[]; status: string; updated_at: string }>((a, b) =>
    supabaseAdmin.from('league_practice_emails').select('guardian_email, registration_ids, status, updated_at')
      .eq('notice_id', noticeId).in('status', ['failed', 'pending', 'sending']).order('id').range(a, b));
  // A row a live send holds is going, not missed.
  const stale = rows.filter(r => r.status === 'failed' || Date.parse(r.updated_at) < Date.now() - 10 * 60_000);
  if (!stale.length) return [];
  const regs = await fetchAllIn<{ id: string; team_id: string | null; player_first_name: string; player_last_name: string }>(
    stale.map(r => r.registration_ids[0]), (c, a, b) => supabaseAdmin.from('league_registrations')
      .select('id, team_id, player_first_name, player_last_name').eq('season_id', seasonId).in('id', c).order('id').range(a, b));
  const reg = new Map(regs.map(r => [r.id, r]));
  return stale.map(r => {
    const g = reg.get(r.registration_ids[0]);
    return { registrationId: r.registration_ids[0], name: g ? `${g.player_first_name} ${g.player_last_name}`.trim() : r.guardian_email, team: g?.team_id ? names.get(g.team_id) ?? '' : '', email: r.guardian_email };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// ── The email ────────────────────────────────────────────────────────────────────────────────────────────────

interface TellFact { kind: 'first' | 'change'; snapshot: ToldPractice[]; toldBefore: ToldPractice[] | null }
interface RegRow { id: string; player_first_name: string; player_last_name: string; guardian_first_name: string | null; team_id: string | null; status: string }

/** One household's parts: each child on a team of the send, its lines from what the send told it. */
function partsFor(children: readonly { registrationId: string; teamId: string; first: string }[], names: ReadonlyMap<string, string>,
  facts: ReadonlyMap<string, TellFact>, placeOf: ReturnType<typeof placeOfTold>, nowMs: number): TellPart[] {
  const parts: TellPart[] = [];
  for (const c of children) {
    const f = facts.get(c.teamId);
    if (!f) continue;
    if (f.kind === 'first') {
      const lines = dateLines(f.snapshot, nowMs, placeOf);
      if (lines.length) parts.push({ child: c.first, team: names.get(c.teamId) ?? '', kind: 'first', lines, firstDay: null });
    } else {
      const change = teamChange(c.teamId, f.toldBefore ?? [], f.snapshot, nowMs);
      const lines = changeLines(change, placeOf);
      if (lines.length) parts.push({ child: c.first, team: names.get(c.teamId) ?? '', kind: 'change', lines, firstDay: change.firstDay });
    }
  }
  return parts;
}

const firstNameOf = (full: string) => full.split(' ')[0] || full;

function wordsFor(org: TellMailOrg, season: LeagueSeason, guardianFirst: string | null, parts: readonly TellPart[]) {
  return practiceTimesEmailWords({ club: org.name, season: season.name, guardianFirst, parts, zoneSentence: timesInZoneSentence() });
}

/** "See an example": the household with the most children among those that will be sent, as the press would email it. */
async function sampleOf(org: TellMailOrg, season: LeagueSeason, going: readonly Household[], names: ReadonlyMap<string, string>,
  now: ReadonlyMap<string, readonly ToldPractice[]>, told: ReadonlyMap<string, ToldRow>, changed: ReadonlySet<string>, nowMs: number) {
  const h = [...going].sort((a, b) => b.children.length - a.children.length || a.children[0].name.localeCompare(b.children[0].name))[0];
  const placeOf = await placeReader(org.id);
  const facts = new Map<string, TellFact>();
  for (const c of h.children) {
    facts.set(c.teamId, changed.has(c.teamId)
      ? { kind: 'change', snapshot: [...(now.get(c.teamId) ?? [])], toldBefore: told.get(c.teamId)?.snapshot ?? [] }
      : { kind: 'first', snapshot: [...(now.get(c.teamId) ?? [])], toldBefore: null });
  }
  const parts = partsFor(h.children.map(c => ({ registrationId: c.registrationId, teamId: c.teamId, first: firstNameOf(c.name) })), names, facts, placeOf, nowMs);
  if (!parts.length) return null;
  const last = h.children[0].name.split(' ').slice(1).join(' ');
  return { to: last ? SW.oneFamilyTo(last) : (h.guardianFirst ?? h.email), words: wordsFor(org, season, h.guardianFirst, parts) };
}

// ── The press and the send ───────────────────────────────────────────────────────────────────────────────────

export type TellResult =
  | { refusal: null; noticeId: string | null; families: number; reached: number; failed: number }
  | { refusal: 'finished' | 'nothing' | 'nobody' | 'changed' | 'already' | 'sending'; noticeId: null; families: 0; reached: 0; failed: 0 };

const refusedWith = (refusal: Exclude<TellResult['refusal'], null>): TellResult => ({ refusal, noticeId: null, families: 0, reached: 0, failed: 0 });

/**
 * THE PRESS ("Send to {n} families"): read again, check it is what the step showed (`saw` — its teams and their told
 * times — and how many families), write the send in one transaction, then email it. A team's told time moved underneath
 * is `changed` (or `already`, every one told since: the second press).
 */
export async function tellFamilies(p: { org: TellMailOrg; season: LeagueSeason; division: { id: string; name: string }; actorId: string; saw: readonly TellSaw[]; families: number }): Promise<TellResult> {
  const read = await readTell(p.org, p.season, p.division);
  if (read.finished) return refusedWith('finished');
  if (!read.tell.length) return refusedWith(p.saw.length ? 'already' : 'nothing');
  const key = (list: readonly TellSaw[]) => list.map(t => `${t.teamId}@${t.saw ?? ''}#${t.kind}`).sort().join(',');
  if (key(read.tell) !== key(p.saw) || read.households !== p.families) return refusedWith('changed');

  const ids = read.tell.map(t => t.teamId);
  const tellSet = new Set(ids);
  const [now, all] = await Promise.all([readPracticesNow(p.org.id, ids), readHouseholds(ids)]);
  const nowMs = Date.now();
  const households = sendableHouseholds(all, p.season.id, tellSet);
  const { data, error } = await supabaseAdmin.rpc('league_practices_tell', {
    p_org: p.org.id, p_season: p.season.id, p_division: p.division.id, p_actor: p.actorId,
    p_teams: read.tell.map(t => ({ teamId: t.teamId, saw: t.saw, kind: t.kind, snapshot: snapshotOf(now.get(t.teamId) ?? [], nowMs) })),
    p_households: households.map(h => ({
      email: normalizeGuardianEmail(h.email), registrationIds: h.children.map(c => c.registrationId), teamIds: [...new Set(h.children.map(c => c.teamId))],
    })),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { refusal: string | null; notice: string | null; families: number } | null;
  if (!row) throw new Error('The practice-times send returned nothing');
  if (row.refusal) return refusedWith(row.refusal as Exclude<TellResult['refusal'], null>);
  const sent = await sendPracticeNotice({ org: p.org, season: p.season, noticeId: row.notice! });
  return { refusal: null, noticeId: row.notice, ...sent };
}

export interface PracticeSendOutcome { families: number; reached: number; failed: number }

/** Write an outcome onto rows this send still holds (`sending`): a newer send that took them over is never overwritten. */
async function recordOutcome(ids: readonly string[], status: 'failed' | 'skipped'): Promise<void> {
  for (const chunk of chunked([...ids])) {
    const { error } = await supabaseAdmin.from('league_practice_emails')
      .update({ status, updated_at: new Date().toISOString() }).in('id', chunk).eq('status', 'sending');
    if (error) console.error('[league-practice-tell] an outcome was not recorded:', error.message);
  }
}

async function markSent(orgId: string, ids: readonly string[]): Promise<void> {
  const { error } = await supabaseAdmin.rpc('league_practice_emails_sent', { p_org: orgId, p_ids: [...ids] });
  if (error) console.error('[league-practice-tell] a sent email was not recorded (its family may read as missed):', error.message);
}

/** The notice's reached / failed, recounted from its rows (failed = every household still to reach). Never throws. */
async function refreshCounts(noticeId: string): Promise<PracticeSendOutcome> {
  try {
    const rows = await fetchAll<{ status: string }>((a, b) => supabaseAdmin.from('league_practice_emails')
      .select('status').eq('notice_id', noticeId).order('id').range(a, b));
    const reached = rows.filter(r => r.status === 'sent').length;
    const failed = rows.filter(r => r.status === 'failed' || r.status === 'pending' || r.status === 'sending').length;
    const families = rows.filter(r => r.status !== 'skipped').length;
    const { error } = await supabaseAdmin.from('league_season_notices').update({ reached_count: reached, failed_count: failed }).eq('id', noticeId);
    if (error) throw error;
    return { families, reached, failed };
  } catch (err) {
    console.error('[league-practice-tell] a notice\'s counts were not updated (the emails went):', err instanceof Error ? err.message : String(err));
    return { families: 0, reached: 0, failed: 0 };
  }
}

const UNSENT = ['pending', 'failed', 'sending'];

/**
 * Send a practices_sent notice's households every email not yet sent (pending, failed, or left `sending` by a send that
 * died). NEVER THROWS — the press has landed: a failure after the claim marks the rows failed; one before it leaves them
 * pending. Either way they are "Send again".
 */
export async function sendPracticeNotice(p: { org: TellMailOrg; season: LeagueSeason; noticeId: string }): Promise<PracticeSendOutcome> {
  try {
    const unsent = await fetchAll<{ id: string }>((a, b) => supabaseAdmin.from('league_practice_emails')
      .select('id').eq('notice_id', p.noticeId).eq('org_id', p.org.id).in('status', UNSENT).order('id').range(a, b));
    await refreshCounts(p.noticeId);
    if (!unsent.length) return refreshCounts(p.noticeId);
    const { data: claimed, error } = await supabaseAdmin.rpc('league_practice_emails_claim', { p_org: p.org.id, p_ids: unsent.map(r => r.id) });
    if (error) throw new Error(`Couldn't claim the emails: ${error.message}`);
    const ids = ((claimed ?? []) as unknown[]).map(v => (typeof v === 'string' ? v : (v as Record<string, string>).league_practice_emails_claim));
    if (!ids.length) return refreshCounts(p.noticeId);
    try {
      await sendClaimed(p, ids);
    } catch (err) {
      console.error('[league-practice-tell] a send failed after its claim (its rows are marked failed):', err instanceof Error ? err.message : String(err));
      await recordOutcome(ids, 'failed');
    }
    return refreshCounts(p.noticeId);
  } catch (err) {
    console.error('[league-practice-tell] a send didn\'t start (its families wait to be sent):', err instanceof Error ? err.message : String(err));
    return refreshCounts(p.noticeId);
  }
}

async function sendClaimed(p: { org: TellMailOrg; season: LeagueSeason; noticeId: string }, ids: readonly string[]): Promise<void> {
  const rows = await fetchAllIn<{ id: string; guardian_email: string; registration_ids: string[]; team_ids: string[] }>([...ids], (c, a, b) =>
    supabaseAdmin.from('league_practice_emails').select('id, guardian_email, registration_ids, team_ids').in('id', c).order('id').range(a, b));
  const tells = await fetchAll<{ team_id: string; kind: 'first' | 'change'; snapshot: ToldPractice[]; told_before: ToldPractice[] | null }>((a, b) =>
    supabaseAdmin.from('league_practice_tells').select('team_id, kind, snapshot, told_before').eq('notice_id', p.noticeId).order('team_id').range(a, b));
  const facts = new Map(tells.map(t => [t.team_id, { kind: t.kind, snapshot: t.snapshot ?? [], toldBefore: t.told_before } satisfies TellFact]));
  const teamIds = [...facts.keys()];
  const [regRows, teamRows, placeOf, face] = await Promise.all([
    fetchAllIn<RegRow>([...new Set(rows.flatMap(r => r.registration_ids))], (c, a, b) => supabaseAdmin.from('league_registrations')
      .select('id, player_first_name, player_last_name, guardian_first_name, team_id, status').in('id', c).eq('season_id', p.season.id).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string }>(teamIds, (c, a, b) => supabaseAdmin.from('league_teams').select('id, name').in('id', c).order('id').range(a, b)),
    placeReader(p.org.id),
    systemMailFace(p.org),
  ]);
  const regs = new Map(regRows.map(r => [r.id, r]));
  const names = new Map(teamRows.map(t => [t.id, t.name]));
  const nowMs = Date.now();

  const messages: FamilyServiceMessage[] = [];
  const messageRows: string[] = [];
  const nothingToSay: string[] = [];
  for (const row of rows) {
    // Each child still on the team the row is about (a child who moved since is told by the moved email, 9c·12).
    const children = row.registration_ids
      .map(id => regs.get(id))
      .filter((r): r is RegRow => !!r && r.status === 'active' && !!r.team_id && row.team_ids.includes(r.team_id))
      .map(r => ({ registrationId: r.id, teamId: r.team_id!, first: r.player_first_name.trim() || `${r.player_first_name} ${r.player_last_name}`.trim() }));
    const parts = partsFor(children, names, facts, placeOf, nowMs);
    if (!parts.length || !isSendableGuardianEmail(normalizeGuardianEmail(row.guardian_email))) { nothingToSay.push(row.id); continue; }
    const first = regs.get(row.registration_ids[0])?.guardian_first_name ?? null;
    const w = wordsFor(p.org, p.season, first, parts);
    messages.push({
      to: row.guardian_email, subject: w.subject,
      html: leaguePracticesChangedHtml({ greeting: w.greeting, intro: w.paragraphs[0] ?? null, parts: w.lists, outro: w.outro, foot: w.foot ?? null, reason: seasonEmailReason(p.season.name), face }),
    });
    messageRows.push(row.id);
  }
  if (nothingToSay.length) await recordOutcome(nothingToSay, 'skipped');
  if (!messages.length) return;
  await sendFamilyServiceBatch({
    kind: 'house_league_practice_times', messages, fromName: face?.sendOpts.fromName ?? null, replyTo: face?.sendOpts.replyTo ?? null,
    onBatch: async (indexes, result) => {
      const batch = indexes.map(i => messageRows[i]);
      if (result.status === 'sent' || (result.status === 'skipped' && quietTransport())) {
        if (result.status === 'skipped') console.info('[league-practice-tell] dev: would have emailed', indexes.map(i => messages[i].to).join(', '));
        await markSent(p.org.id, batch);
      } else {
        await recordOutcome(batch, 'failed');
      }
    },
  });
  // Anything the batches never answered for is a failure, once (recordOutcome only touches rows still `sending`).
  await recordOutcome(messageRows, 'failed');
}

/**
 * "SEND AGAIN" (the See them window, and the season's Email families history): a household of the send's teams with a
 * usable address now — added since, or fixed after it was refused — joins the send (`league_practice_emails_add`), then
 * every household still to reach is sent. Refuses a finished season.
 */
export async function resendPracticeNotice(p: { org: TellMailOrg; season: LeagueSeason; noticeId: string }): Promise<PracticeSendOutcome | { refusal: 'finished' | 'not_found' }> {
  if (p.season.status === 'completed' || p.season.status === 'archived') return { refusal: 'finished' };
  const { data: notice } = await supabaseAdmin.from('league_season_notices').select('id')
    .eq('id', p.noticeId).eq('org_id', p.org.id).eq('season_id', p.season.id).eq('kind', 'practices_sent').maybeSingle();
  if (!notice) return { refusal: 'not_found' };
  const tells = await fetchAll<{ team_id: string }>((a, b) => supabaseAdmin.from('league_practice_tells')
    .select('team_id').eq('notice_id', p.noticeId).order('team_id').range(a, b));
  const teamIds = tells.map(t => t.team_id);
  const households = sendableHouseholds(await readHouseholds(teamIds), p.season.id, new Set(teamIds));
  const { error } = await supabaseAdmin.rpc('league_practice_emails_add', {
    p_org: p.org.id, p_notice: p.noticeId,
    p_households: households.map(h => ({
      email: normalizeGuardianEmail(h.email), registrationIds: h.children.map(c => c.registrationId), teamIds: [...new Set(h.children.map(c => c.teamId))],
    })),
  });
  if (error) {
    if (/\bfinished\b/.test(error.message ?? '')) return { refusal: 'finished' };
    throw error;
  }
  return sendPracticeNotice(p);
}

// ── The reminder (frame c3) ──────────────────────────────────────────────────────────────────────────────────

/** Each division's teams whose families haven't been told what is there now (never told, or changed), with families. */
export async function readTellReminders(orgId: string, seasonId: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from('league_teams').select('id, division_id').eq('season_id', seasonId);
  if (error) throw error;
  const teams = (data ?? []) as { id: string; division_id: string }[];
  const ids = teams.map(t => t.id);
  const [now, told, registered] = await Promise.all([readPracticesNow(orgId, ids), readTold(ids), registeredTeams(seasonId, ids)]);
  const nowMs = Date.now();
  const out: Record<string, number> = {};
  for (const t of teams) {
    if (!registered.has(t.id)) continue;
    const state = tellStateOf(now.get(t.id) ?? [], told.get(t.id) ?? null, nowMs);
    if (state === 'untold' || state === 'changed') out[t.division_id] = (out[t.division_id] ?? 0) + 1;
  }
  return out;
}
