import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { chunked, fetchAll, fetchAllIn, inParallel } from './supabase-paging';
import { getOrgPlaceNames } from './db';
import { isFinishedLeagueSeason } from './house-league-access';
import { sendFamilyServiceBatch, type FamilyServiceMessage } from './family-email';
import { sendSecondParentServiceCopies } from './league-second-parent-mail';
import { isSendableGuardianEmail, normalizeGuardianEmail } from './guardian-email';
import { leaguePracticesChangedHtml } from './email';
import { systemMailFace, type ClubEmailOrg } from './club-email-context';
import { seasonEmailReason, SEASON_EMAIL_WORDS as SW } from './families-words';
import { formatShortWeekdayDate, timesInZoneSentence, utcToZonedInputs } from './timezone';
import { formatTime } from './utils';
import { memberDisplayName } from './member-names';
import { readHouseholds, type Household } from './club-schedule-league-mail';
import { copyCoachesOnFirstTell } from './league-practice-coach-copy';
import {
  changeLines, dateLines, placeOfTold, practiceSummary, practiceTimesEmailWords, snapshotOf, teamChange, tellStateOf,
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
    await inParallel([...told.keys()], 8, async teamId => {
      const { error } = await supabaseAdmin.from('league_team_practices_told')
        .update({ told_at: at, snapshot: snapshotOf(now.get(teamId) ?? [], Date.now()), notice_id: null, updated_at: at })
        .eq('team_id', teamId);
      if (error) throw error;
    });
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
    .filter(h => h.seasonId === seasonId && isSendableGuardianEmail(h.email))
    .map(h => ({ ...h, children: h.children.filter(c => teams.has(c.teamId)) }))
    .filter(h => h.children.length > 0);
}

/** A household as the send's rows take it (`league_practices_tell`, `league_practice_emails_add`). */
const householdRows = (hs: readonly Household[]) => hs.map(h => ({
  email: normalizeGuardianEmail(h.email), registrationIds: h.children.map(c => c.registrationId), teamIds: [...new Set(h.children.map(c => c.teamId))],
}));

/** A send row that has not gone: still to try, failed, or held by a send that may have died. */
const UNSENT = ['pending', 'failed', 'sending'];

const fullName = (first: string, last: string) => `${first} ${last}`.trim();
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Who won't get it: an active child on these teams with no email, or one no mail can reach. */
export interface LeftOutFamily { registrationId: string; name: string; team: string; email: string | null }

async function readLeftOut(seasonId: string, teams: ReadonlyMap<string, string>): Promise<LeftOutFamily[]> {
  if (!teams.size) return [];
  const regs = await fetchAllIn<{ id: string; team_id: string; player_first_name: string; player_last_name: string; guardian_email: string | null }>(
    [...teams.keys()], (c, a, b) => supabaseAdmin.from('league_registrations')
      .select('id, team_id, player_first_name, player_last_name, guardian_email')
      .eq('season_id', seasonId).eq('status', 'active').in('team_id', c).order('id').range(a, b));
  return regs
    .filter(r => !isSendableGuardianEmail(r.guardian_email))
    .map(r => ({ registrationId: r.id, name: fullName(r.player_first_name, r.player_last_name), team: teams.get(r.team_id) ?? '', email: r.guardian_email?.trim() || null }))
    .sort(byName);
}

// ── The Tell step's read ─────────────────────────────────────────────────────────────────────────────────────

export interface TellTeam { id: string; name: string; state: TeamTellState; toldAt: string | null }
/** A team to tell, with the told time the step read (the press refuses when it moved underneath). */
export interface TellSaw { teamId: string; saw: string | null; kind: 'first' | 'change' }
/** One team being told, as the step lists it: when and where its practices are, and how many families will be emailed. */
export interface TellRow { teamId: string; name: string; kind: 'first' | 'change'; when: string; where: string; families: number }

export interface TellRead {
  division: { id: string; name: string };
  finished: boolean;
  /**
   * ⚖ Families are told their team BEFORE anything about it (the Teams publish is the placement email; the game
   * Publish is gated on it the same way). A division whose teams aren't published has placements that are still a draft,
   * so the step names no one and sends nothing: the window says "Publish {division}'s teams first".
   */
  teamsPublished: boolean;
  teams: TellTeam[];
  tell: TellSaw[];
  /** The same teams, one row each, for the step's list. */
  rows: TellRow[];
  /** Households that will be sent (usable address, a child on a team to tell). */
  households: number;
  twoTeams: number;
  /** Of them: households with a child on a CHANGED team; households only on never-told teams. */
  toldHouseholds: number;
  freshHouseholds: number;
  leftOut: LeftOutFamily[];
  /** Teams with families and no practices (frame c1b: "Hand out for them"), and their households. */
  noPractices: { teams: string[]; families: number };
  /** The division's last send: who, how many, when (for "Everyone has been told"). */
  last: { by: string; families: number; date: string; time: string } | null;
  /** The division's last send, still missing families ("Send again"). */
  open: { noticeId: string; families: number; reached: number; missed: number; missedFamilies: LeftOutFamily[] } | null;
  sample: { to: string; words: EmailWords } | null;
}

/** The divisions of a season whose teams are published (their placements are no longer a draft). */
async function publishedDivisions(seasonId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin.from('league_divisions').select('id, teams_published_at').eq('season_id', seasonId);
  if (error) throw error;
  return new Set((data ?? []).filter(d => d.teams_published_at).map(d => d.id as string));
}

/** A division whose teams aren't published: nothing to tell yet, and nobody named. */
const unpublishedRead = (season: LeagueSeason, division: { id: string; name: string }): TellRead => ({
  division, finished: isFinishedLeagueSeason(season), teamsPublished: false, teams: [], tell: [], rows: [], households: 0, twoTeams: 0,
  toldHouseholds: 0, freshHouseholds: 0, leftOut: [], noPractices: { teams: [], families: 0 }, last: null, open: null, sample: null,
});

export async function readTell(org: TellMailOrg, season: LeagueSeason, division: { id: string; name: string }): Promise<TellRead> {
  if (!(await publishedDivisions(season.id)).has(division.id)) return unpublishedRead(season, division);
  const teams = await divisionTeams(season.id, division.id);
  const ids = teams.map(t => t.id);
  const nowMs = Date.now();
  // A team counts once it has families (`registered`: anyone registered on it, with an email or not).
  const [now, told, all, registered] = await Promise.all([readPracticesNow(org.id, ids), readTold(ids), readHouseholds(ids), registeredTeams(season.id, ids)]);
  const names = new Map(teams.map(t => [t.id, t.name]));
  const reachable = sendableHouseholds(all, season.id, new Set(ids));

  const rows: TellTeam[] = teams.map(t => {
    const tl = told.get(t.id) ?? null;
    return { id: t.id, name: t.name, state: tellStateOf(now.get(t.id) ?? [], tl, nowMs), toldAt: tl?.at ?? null };
  });
  const tell: TellSaw[] = rows.filter(r => (r.state === 'untold' || r.state === 'changed') && registered.has(r.id))
    .map(r => ({ teamId: r.id, saw: r.toldAt, kind: r.state === 'changed' ? 'change' : 'first' }));
  const tellSet = new Set(tell.map(t => t.teamId));
  const changed = new Set(tell.filter(t => t.kind === 'change').map(t => t.teamId));
  const going = sendableHouseholds(all, season.id, tellSet);

  // Who won't get it: on the teams being told — or, once every team is told, on the told teams (so a family with no
  // email can still be given one, and "Send again" then reaches it).
  const leftOutTeams = tellSet.size ? tellSet : new Set(told.keys());
  const leftOutNames = new Map([...leftOutTeams].map(t => [t, names.get(t) ?? '']));
  const [leftOut, lastAndOpen, sample] = await Promise.all([
    readLeftOut(season.id, leftOutNames),
    readLast(org.id, season.id, division.id, names, reachable),
    going.length ? sampleOf(org, season, going, names, now, told, changed, nowMs) : Promise.resolve(null),
  ]);
  const without = rows.filter(r => r.state === 'none' && registered.has(r.id));
  const withoutIds = new Set(without.map(r => r.id));
  const toldHouseholds = going.filter(h => h.children.some(c => changed.has(c.teamId))).length;
  const placeOf = tell.length ? await placeReader(org.id) : null;
  const tellRows: TellRow[] = tell.map(t => ({
    teamId: t.teamId, name: names.get(t.teamId) ?? '', kind: t.kind,
    ...(placeOf ? practiceSummary(now.get(t.teamId) ?? [], nowMs, placeOf) : { when: '', where: '' }),
    families: going.filter(h => h.children.some(c => c.teamId === t.teamId)).length,
  }));
  return {
    division,
    finished: isFinishedLeagueSeason(season),
    teamsPublished: true,
    teams: rows,
    tell,
    rows: tellRows,
    households: going.length,
    twoTeams: going.filter(h => new Set(h.children.map(c => c.teamId)).size > 1).length,
    toldHouseholds,
    // The rest: a household has a child on a changed team, or it hasn't.
    freshHouseholds: going.length - toldHouseholds,
    leftOut,
    noPractices: { teams: without.map(r => r.name), families: reachable.filter(h => h.children.some(c => withoutIds.has(c.teamId))).length },
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

async function readLast(orgId: string, seasonId: string, divisionId: string, names: ReadonlyMap<string, string>, reachable: readonly Household[]): Promise<Pick<TellRead, 'last' | 'open'>> {
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
  // "Send again" also reaches a household of the send's teams that has a usable address now and no email in it — one
  // whose address was added since, or a family placed since (league_practice_emails_add joins them).
  const [teams, rows] = await Promise.all([
    fetchAll<{ team_id: string }>((a, b) => supabaseAdmin.from('league_practice_tells').select('team_id').eq('notice_id', data.id).order('team_id').range(a, b)),
    fetchAll<{ guardian_email: string }>((a, b) => supabaseAdmin.from('league_practice_emails').select('guardian_email').eq('notice_id', data.id).order('id').range(a, b)),
  ]);
  const sentTeams = new Set(teams.map(t => t.team_id));
  const inIt = new Set(rows.map(r => r.guardian_email));
  const joining = reachable.filter(h => h.children.some(c => sentTeams.has(c.teamId)) && !inIt.has(normalizeGuardianEmail(h.email) ?? h.email)).length;
  const open = missed.length + joining > 0
    ? { noticeId: data.id as string, families: data.family_count as number, reached: data.reached_count as number, missed: missed.length + joining, missedFamilies: missed }
    : null;
  return { last, open };
}

/** A send's households still to reach (failed, or never tried), as the See them window names them. */
async function missedOf(noticeId: string, seasonId: string, names: ReadonlyMap<string, string>): Promise<LeftOutFamily[]> {
  const rows = await fetchAll<{ guardian_email: string; registration_ids: string[]; status: string; updated_at: string }>((a, b) =>
    supabaseAdmin.from('league_practice_emails').select('guardian_email, registration_ids, status, updated_at')
      .eq('notice_id', noticeId).in('status', UNSENT).order('id').range(a, b));
  // A row a live send holds is going, not missed.
  const stale = rows.filter(r => r.status === 'failed' || Date.parse(r.updated_at) < Date.now() - 10 * 60_000);
  if (!stale.length) return [];
  const regs = await fetchAllIn<{ id: string; team_id: string | null; player_first_name: string; player_last_name: string }>(
    stale.map(r => r.registration_ids[0]), (c, a, b) => supabaseAdmin.from('league_registrations')
      .select('id, team_id, player_first_name, player_last_name').eq('season_id', seasonId).in('id', c).order('id').range(a, b));
  const reg = new Map(regs.map(r => [r.id, r]));
  return stale.map(r => {
    const g = reg.get(r.registration_ids[0]);
    return { registrationId: r.registration_ids[0], name: g ? fullName(g.player_first_name, g.player_last_name) : r.guardian_email, team: g?.team_id ? names.get(g.team_id) ?? '' : '', email: r.guardian_email };
  }).sort(byName);
}

// ── The email ────────────────────────────────────────────────────────────────────────────────────────────────

interface TellFact { kind: 'first' | 'change'; snapshot: ToldPractice[]; toldBefore: ToldPractice[] | null }
interface RegRow { id: string; player_first_name: string; player_last_name: string; guardian_first_name: string | null; team_id: string | null; status: string }

/** One household's parts: each child on a team of the send, its lines from what the send told it. */
function partsFor(children: readonly { teamId: string; first: string }[], names: ReadonlyMap<string, string>,
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
  // The fullest shape: the household on the most teams (a told team's change beside a new team's first email), then the
  // most children, then by name — the 9d-2b "See their email" pick.
  const teamsOf = (x: Household) => new Set(x.children.map(c => c.teamId)).size;
  const h = [...going].sort((a, b) => teamsOf(b) - teamsOf(a) || b.children.length - a.children.length || a.children[0].name.localeCompare(b.children[0].name))[0];
  const placeOf = await placeReader(org.id);
  const facts = new Map<string, TellFact>();
  for (const c of h.children) {
    const snapshot = [...(now.get(c.teamId) ?? [])];
    facts.set(c.teamId, changed.has(c.teamId)
      ? { kind: 'change', snapshot, toldBefore: told.get(c.teamId)?.snapshot ?? [] }
      : { kind: 'first', snapshot, toldBefore: null });
  }
  const parts = partsFor(h.children.map(c => ({ teamId: c.teamId, first: firstNameOf(c.name) })), names, facts, placeOf, nowMs);
  if (!parts.length) return null;
  const last = h.children[0].name.split(' ').slice(1).join(' ');
  return { to: last ? SW.oneFamilyTo(last) : (h.guardianFirst ?? h.email), words: wordsFor(org, season, h.guardianFirst, parts) };
}

// ── The press and the send ───────────────────────────────────────────────────────────────────────────────────

export type TellResult =
  | { refusal: null; noticeId: string | null; families: number; reached: number; failed: number }
  | { refusal: 'finished' | 'teams_first' | 'nothing' | 'nobody' | 'changed' | 'already' | 'sending'; noticeId: null; families: 0; reached: 0; failed: 0 };

const refusedWith = (refusal: Exclude<TellResult['refusal'], null>): TellResult => ({ refusal, noticeId: null, families: 0, reached: 0, failed: 0 });

/**
 * THE PRESS ("Send to {n} families"): read again, check it is what the step showed (`saw` — its teams and their told
 * times — and how many families), write the send in one transaction, then email it. A team's told time moved underneath
 * is `changed` (or `already`, every one told since: the second press).
 */
export async function tellFamilies(p: { org: TellMailOrg; season: LeagueSeason; division: { id: string; name: string }; actorId: string; saw: readonly TellSaw[]; families: number }): Promise<TellResult> {
  const read = await readTell(p.org, p.season, p.division);
  if (read.finished) return refusedWith('finished');
  if (!read.teamsPublished) return refusedWith('teams_first');
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
    p_households: householdRows(households),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { refusal: string | null; notice: string | null; families: number } | null;
  if (!row) throw new Error('The practice-times send returned nothing');
  if (row.refusal) return refusedWith(row.refusal as Exclude<TellResult['refusal'], null>);
  const sent = await sendPracticeNotice({ org: p.org, season: p.season, noticeId: row.notice! });
  await copyCoachesOnFirstTell({ org: p.org, season: p.season, noticeId: row.notice! });
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

/**
 * The notice's reached / failed, recounted from its rows (failed = every household still to reach). Never throws. A call
 * that took no rows only READS (`write` false): another send holds them, and a stale write here could land after its last
 * one (the schedule notice's rule, lib/league-schedule-mail.ts).
 */
async function refreshCounts(noticeId: string, write = true): Promise<PracticeSendOutcome> {
  try {
    const rows = await fetchAll<{ status: string }>((a, b) => supabaseAdmin.from('league_practice_emails')
      .select('status').eq('notice_id', noticeId).order('id').range(a, b));
    const reached = rows.filter(r => r.status === 'sent').length;
    const failed = rows.filter(r => UNSENT.includes(r.status)).length;
    const families = rows.filter(r => r.status !== 'skipped').length;
    if (write) {
      const { error } = await supabaseAdmin.from('league_season_notices').update({ reached_count: reached, failed_count: failed }).eq('id', noticeId);
      if (error) throw error;
    }
    return { families, reached, failed };
  } catch (err) {
    console.error('[league-practice-tell] a notice\'s counts were not updated (the emails went):', err instanceof Error ? err.message : String(err));
    return { families: 0, reached: 0, failed: 0 };
  }
}

/**
 * Send a practices_sent notice's households every email not yet sent (pending, failed, or left `sending` by a send that
 * died). NEVER THROWS — the press has landed: a failure after the claim marks the rows failed; one before it leaves them
 * pending. Either way they are "Send again".
 */
export async function sendPracticeNotice(p: { org: TellMailOrg; season: LeagueSeason; noticeId: string }): Promise<PracticeSendOutcome> {
  try {
    const unsent = await fetchAll<{ id: string; status: string }>((a, b) => supabaseAdmin.from('league_practice_emails')
      .select('id, status').eq('notice_id', p.noticeId).eq('org_id', p.org.id).in('status', UNSENT).order('id').range(a, b));
    if (!unsent.length) return refreshCounts(p.noticeId);
    // ⚖ Counted BEFORE the first email, so a send that dies partway still reads "stopped" with its "Send again". Only when
    // something is free to send: a call that finds every row held by another send writes nothing.
    if (unsent.some(r => r.status !== 'sending')) await refreshCounts(p.noticeId);
    const { data: claimed, error } = await supabaseAdmin.rpc('league_practice_emails_claim', { p_org: p.org.id, p_ids: unsent.map(r => r.id) });
    if (error) throw new Error(`Couldn't claim the emails: ${error.message}`);
    const ids = ((claimed ?? []) as unknown[]).map(v => (typeof v === 'string' ? v : (v as Record<string, string>).league_practice_emails_claim));
    if (!ids.length) return refreshCounts(p.noticeId, false);
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
  const [rows, tells, placeOf, face] = await Promise.all([
    fetchAllIn<{ id: string; guardian_email: string; registration_ids: string[]; team_ids: string[] }>([...ids], (c, a, b) =>
      supabaseAdmin.from('league_practice_emails').select('id, guardian_email, registration_ids, team_ids').in('id', c).order('id').range(a, b)),
    fetchAll<{ team_id: string; kind: 'first' | 'change'; snapshot: ToldPractice[]; told_before: ToldPractice[] | null }>((a, b) =>
      supabaseAdmin.from('league_practice_tells').select('team_id, kind, snapshot, told_before').eq('notice_id', p.noticeId).order('team_id').range(a, b)),
    placeReader(p.org.id),
    systemMailFace(p.org),
  ]);
  const facts = new Map(tells.map(t => [t.team_id, { kind: t.kind, snapshot: t.snapshot ?? [], toldBefore: t.told_before } satisfies TellFact]));
  const [regRows, teamRows] = await Promise.all([
    fetchAllIn<RegRow>([...new Set(rows.flatMap(r => r.registration_ids))], (c, a, b) => supabaseAdmin.from('league_registrations')
      .select('id, player_first_name, player_last_name, guardian_first_name, team_id, status').in('id', c).eq('season_id', p.season.id).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string }>([...facts.keys()], (c, a, b) => supabaseAdmin.from('league_teams').select('id, name').in('id', c).order('id').range(a, b)),
  ]);
  const regs = new Map(regRows.map(r => [r.id, r]));
  const names = new Map(teamRows.map(t => [t.id, t.name]));
  const nowMs = Date.now();

  const messages: FamilyServiceMessage[] = [];
  const messageRows: string[] = [];
  // Signed-in family accounts Stage 3 (9d-3's "both parents, counted once" lands here): each message's household.
  const households: { firstEmail: string; registrationIds: string[] }[] = [];
  const nothingToSay: string[] = [];
  for (const row of rows) {
    // Each child still on the team the row is about (a child who moved since is told by the moved email, 9c·12).
    const children = row.registration_ids
      .map(id => regs.get(id))
      .filter((r): r is RegRow => !!r && r.status === 'active' && !!r.team_id && row.team_ids.includes(r.team_id))
      .map(r => ({ teamId: r.team_id!, first: r.player_first_name.trim() || fullName(r.player_first_name, r.player_last_name) }));
    const parts = partsFor(children, names, facts, placeOf, nowMs);
    if (!parts.length || !isSendableGuardianEmail(row.guardian_email)) { nothingToSay.push(row.id); continue; }
    const first = regs.get(row.registration_ids[0])?.guardian_first_name ?? null;
    const w = wordsFor(p.org, p.season, first, parts);
    messages.push({
      to: row.guardian_email, subject: w.subject,
      html: leaguePracticesChangedHtml({ greeting: w.greeting, intro: w.paragraphs[0] ?? null, parts: w.lists, outro: w.outro, foot: w.foot ?? null, reason: seasonEmailReason(p.season.name), face }),
    });
    messageRows.push(row.id);
    households.push({ firstEmail: row.guardian_email, registrationIds: row.registration_ids });
  }
  if (nothingToSay.length) await recordOutcome(nothingToSay, 'skipped');
  if (!messages.length) return;
  const answered = new Set<string>();
  const results = await sendFamilyServiceBatch({
    kind: 'house_league_practice_times', messages, fromName: face?.sendOpts.fromName ?? null, replyTo: face?.sendOpts.replyTo ?? null,
    onBatch: async (indexes, result) => {
      const batch = indexes.map(i => messageRows[i]);
      batch.forEach(id => answered.add(id));
      if (result.status === 'sent' || (result.status === 'skipped' && quietTransport())) {
        if (result.status === 'skipped') console.info('[league-practice-tell] dev: would have emailed', indexes.map(i => messages[i].to).join(', '));
        await markSent(p.org.id, batch);
      } else {
        await recordOutcome(batch, 'failed');
      }
    },
  });
  // Anything the batches never answered for is a failure, once (recordOutcome only touches rows still `sending`).
  const unanswered = messageRows.filter(id => !answered.has(id));
  if (unanswered.length) await recordOutcome(unanswered, 'failed');
  // The second parents' copies, after the households are marked (they never change "told", a count or a row's status).
  await sendSecondParentServiceCopies({
    kind: 'house_league_practice_times', orgId: p.org.id, fromName: face?.sendOpts.fromName ?? null, replyTo: face?.sendOpts.replyTo ?? null, results,
    households: households.map((h, i) => ({ ...h, message: messages[i] })),
  });
}

/**
 * "SEND AGAIN" (the See them window, and the season's Email families history): a household of the send's teams with a
 * usable address now — added since, or fixed after it was refused — joins the send (`league_practice_emails_add`), then
 * every household still to reach is sent. Refuses a finished season.
 */
export async function resendPracticeNotice(p: { org: TellMailOrg; season: LeagueSeason; noticeId: string }): Promise<PracticeSendOutcome | { refusal: 'finished' | 'not_found' }> {
  if (isFinishedLeagueSeason(p.season)) return { refusal: 'finished' };
  const { data: notice } = await supabaseAdmin.from('league_season_notices').select('id')
    .eq('id', p.noticeId).eq('org_id', p.org.id).eq('season_id', p.season.id).eq('kind', 'practices_sent').maybeSingle();
  if (!notice) return { refusal: 'not_found' };
  const tells = await fetchAll<{ team_id: string }>((a, b) => supabaseAdmin.from('league_practice_tells')
    .select('team_id').eq('notice_id', p.noticeId).order('team_id').range(a, b));
  const teamIds = tells.map(t => t.team_id);
  const households = sendableHouseholds(await readHouseholds(teamIds), p.season.id, new Set(teamIds));
  const { error } = await supabaseAdmin.rpc('league_practice_emails_add', {
    p_org: p.org.id, p_notice: p.noticeId,
    p_households: householdRows(households),
  });
  if (error) {
    if (/\bfinished\b/.test(error.message ?? '')) return { refusal: 'finished' };
    throw error;
  }
  const sent = await sendPracticeNotice(p);
  // A first send that reached nobody on a team leaves it untold: the send that reaches one copies its coaches.
  await copyCoachesOnFirstTell(p);
  return sent;
}

// ── The reminder (frame c3) ──────────────────────────────────────────────────────────────────────────────────

/** Each division's teams whose families haven't been told what is there now (never told, or changed), with families. */
export async function readTellReminders(orgId: string, seasonId: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from('league_teams').select('id, division_id').eq('season_id', seasonId);
  if (error) throw error;
  const teams = (data ?? []) as { id: string; division_id: string }[];
  const ids = teams.map(t => t.id);
  const [now, told] = await Promise.all([readPracticesNow(orgId, ids), readTold(ids)]);
  const nowMs = Date.now();
  const waiting = teams.filter(t => {
    const state = tellStateOf(now.get(t.id) ?? [], told.get(t.id) ?? null, nowMs);
    return state === 'untold' || state === 'changed';
  });
  // The usual state is "everyone told": no registrations read at all.
  if (!waiting.length) return {};
  // A division whose teams aren't published owes nobody a practice time yet (its placements are a draft).
  const [registered, published] = await Promise.all([registeredTeams(seasonId, waiting.map(t => t.id)), publishedDivisions(seasonId)]);
  const out: Record<string, number> = {};
  for (const t of waiting) if (registered.has(t.id) && published.has(t.division_id)) out[t.division_id] = (out[t.division_id] ?? 0) + 1;
  return out;
}
