import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { resolveCoachUserIdentities } from './db';
import { listActiveHeadCoachesForTeams } from './coach-membership';
import { WRAPPED_RECORD_EVENT_TYPES } from './season-wrapped';
import { isLiveSeasonStatus, latestClosedSeasonOf, liveSeasonOf } from './season-live';
import { countsOnRoster, hasDecidedGames, rosterCountOf, seasonRecordOf } from './team-season-figures';
import { formatRecord, type WltTally } from './coach-season-record';
import { hasEveryForm, templatesForTeam } from './forms-coverage';
import type { RepProgramYearStatus } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S READ OF ITS TEAMS — the Rep Teams health board and the team page (Club Tier Stage 2,
 * B08/B09, Ask 5 — owner ruling 2026-09-28; specimens 1 and 2).
 *
 * One row per team: its season (Live or Closed) with its record, its head coach (or the pending
 * head-coach invitation), its roster, its next event, its Documents count, and its group. No money
 * column until Stage 3 (D1). Nothing here reads attendance, lineups, awards, development or
 * opponents — the club reads what it already read, plus who signed the club's own forms.
 *
 * ⚠ ONE RULE PER FIGURE: the roster is `rosterCountOf` (active on the LIVE season, never a call-up),
 * the record is `seasonRecordOf` (finalized games that count). Both live in the pure
 * `lib/team-season-figures.ts`; nothing here counts by hand.
 * ⚠ BATCHED: a fixed number of reads for the whole club, not a handful per team — the old cards ran
 * three queries a team, which is how a long list starts timing out.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ClubBoardSeason {
  id: string;
  name: string;
  year: number;
  status: RepProgramYearStatus;
  isLive: boolean;
  record: WltTally;
  /** "12-8-1", or null when the season has no decided game yet ("No games yet"). */
  recordText: string | null;
}

export interface ClubBoardHeadCoach {
  /** Active head coaches (memberships). Empty = the board's red "No head coach"… */
  people: Array<{ userId: string; name: string | null; email: string | null }>;
  /** …unless a head-coach invitation is out (amber "Invited"). Only the club's door sends these. */
  invited: Array<{ inviteId: string; email: string; invitedAt: string; expiresAt: string; expired: boolean }>;
}

export interface ClubBoardNextEvent {
  id: string;
  eventType: string;
  isScrimmage: boolean;
  startsAt: string;
  /** The event's own name (a tournament's, a team event's), or null. */
  name: string | null;
  /** The opponent, for a game. */
  opponent: string | null;
  /** 'home' | 'away' as the coach set it, or null. */
  homeAway: string | null;
}

export interface ClubBoardRow {
  teamId: string;
  groupId: string | null;
  groupName: string | null;
  /** The live season, else the newest closed one, else null (a team with no season yet). */
  season: ClubBoardSeason | null;
  headCoach: ClubBoardHeadCoach;
  /** Players on the LIVE season (the one roster rule); null when the team has no live season. */
  rosterCount: number | null;
  nextEvent: ClubBoardNextEvent | null;
  /**
   * Players on the live season who have EVERY active club form that applies to the team on file
   * (`lib/forms-coverage.ts`, the Families book's rule). Null when there is no live season, no
   * player, or no form applies — the board's "—".
   */
  documents: { signed: number; of: number } | null;
  /** Tryout applications waiting on the LIVE season (tryouts run there and nowhere else). */
  pendingTryouts: number;
}

type TeamInput = { id: string; groupId: string | null; groupName?: string | null };

export type BoardSeasonRow = { id: string; team_id: string; name: string; year: number; status: RepProgramYearStatus; created_at: string };
type SeasonRow = BoardSeasonRow;

/** Roster counts per season, by THE ROSTER RULE — for any set of seasons (live or closed). */
export async function loadRosterCounts(programYearIds: readonly string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (programYearIds.length === 0) return out;
  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .select('program_year_id, status')
    .in('program_year_id', [...programYearIds]);
  if (error) throw error;
  const byYear = new Map<string, { status: string }[]>();
  for (const r of (data ?? []) as { program_year_id: string; status: string }[]) {
    const list = byYear.get(r.program_year_id) ?? [];
    list.push(r);
    byYear.set(r.program_year_id, list);
  }
  for (const id of programYearIds) out.set(id, rosterCountOf(byYear.get(id) ?? []));
  return out;
}

/** Records per season, by THE RECORD RULE. The SQL only narrows the rows; the rule decides. */
export async function loadSeasonRecords(programYearIds: readonly string[]): Promise<Map<string, WltTally>> {
  const out = new Map<string, WltTally>();
  if (programYearIds.length === 0) return out;
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .select('program_year_id, event_type, is_scrimmage, result, status')
    .in('program_year_id', [...programYearIds])
    .in('event_type', WRAPPED_RECORD_EVENT_TYPES)
    .not('result', 'is', null);
  if (error) throw error;
  const byYear = new Map<string, { eventType: string; isScrimmage: boolean; result: string | null; status: string }[]>();
  for (const r of (data ?? []) as { program_year_id: string; event_type: string; is_scrimmage: boolean | null; result: string | null; status: string }[]) {
    const list = byYear.get(r.program_year_id) ?? [];
    list.push({ eventType: r.event_type, isScrimmage: !!r.is_scrimmage, result: r.result, status: r.status });
    byYear.set(r.program_year_id, list);
  }
  for (const id of programYearIds) out.set(id, seasonRecordOf(byYear.get(id) ?? []));
  return out;
}

export function seasonShape(s: SeasonRow, record: WltTally | undefined): ClubBoardSeason {
  const tally = record ?? { w: 0, l: 0, t: 0 };
  return {
    id: s.id, name: s.name, year: s.year, status: s.status, isLive: isLiveSeasonStatus(s.status),
    record: tally, recordText: hasDecidedGames(tally) ? formatRecord(tally) : null,
  };
}

/** Every season of the given teams, as the board needs them. */
export async function loadTeamSeasons(teamIds: readonly string[]): Promise<Map<string, SeasonRow[]>> {
  const out = new Map<string, SeasonRow[]>();
  if (teamIds.length === 0) return out;
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .select('id, team_id, name, year, status, created_at')
    .in('team_id', [...teamIds]);
  if (error) throw error;
  for (const r of (data ?? []) as SeasonRow[]) {
    const list = out.get(r.team_id) ?? [];
    list.push(r);
    out.set(r.team_id, list);
  }
  return out;
}

const withCreatedAt = (rows: SeasonRow[]) => rows.map(r => ({ ...r, createdAt: r.created_at }));

/** Active head coaches + pending head-coach invitations, per team. (Shared with the club's money reads
 *  and reminders, so "a head coach" and "an invited one" mean one thing on every club screen.) */
export async function loadHeadCoaches(orgId: string, teamIds: readonly string[]): Promise<Map<string, ClubBoardHeadCoach>> {
  const out = new Map<string, ClubBoardHeadCoach>();
  for (const id of teamIds) out.set(id, { people: [], invited: [] });
  if (teamIds.length === 0) return out;
  const [headRows, invites] = await Promise.all([
    listActiveHeadCoachesForTeams(teamIds),
    supabaseAdmin
      .from('assistant_invite_tokens')
      .select('id, team_id, invited_email, created_at, expires_at')
      .in('team_id', [...teamIds])
      .eq('coach_role', 'head_coach')
      .in('status', ['pending', 'pending_approval'])
      .order('created_at', { ascending: false }),
  ]);
  if (invites.error) throw invites.error;
  const identities = await resolveCoachUserIdentities(orgId, [...new Set(headRows.map(h => h.userId))]);
  for (const h of headRows) {
    const who = identities.get(h.userId);
    out.get(h.teamId)?.people.push({ userId: h.userId, name: who?.displayName ?? null, email: who?.email ?? null });
  }
  const now = Date.now();
  for (const i of (invites.data ?? []) as { id: string; team_id: string; invited_email: string; created_at: string; expires_at: string }[]) {
    out.get(i.team_id)?.invited.push({
      inviteId: i.id, email: i.invited_email, invitedAt: i.created_at, expiresAt: i.expires_at,
      expired: new Date(i.expires_at).getTime() < now,
    });
  }
  return out;
}

/** The next scheduled event on each live season — one small read per season, in parallel. */
async function loadNextEvents(liveYearIds: readonly string[]): Promise<Map<string, ClubBoardNextEvent>> {
  const out = new Map<string, ClubBoardNextEvent>();
  const nowIso = new Date().toISOString();
  await Promise.all(liveYearIds.map(async (yearId) => {
    const { data, error } = await supabaseAdmin
      .from('rep_team_events')
      .select('id, event_type, is_scrimmage, starts_at, name, opponent, home_away')
      .eq('program_year_id', yearId)
      .eq('status', 'scheduled')
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const d = data as { id: string; event_type: string; is_scrimmage: boolean | null; starts_at: string; name: string | null; opponent: string | null; home_away: string | null };
      out.set(yearId, {
        id: d.id, eventType: d.event_type, isScrimmage: !!d.is_scrimmage, startsAt: d.starts_at,
        name: d.name ?? null, opponent: d.opponent ?? null, homeAway: d.home_away ?? null,
      });
    }
  }));
  return out;
}

/** Documents coverage on each live season (see `ClubBoardRow.documents`). */
async function loadDocuments(
  orgId: string,
  liveByTeam: Map<string, string>,
): Promise<Map<string, { signed: number; of: number } | null>> {
  const out = new Map<string, { signed: number; of: number } | null>();
  const liveIds = [...liveByTeam.values()];
  if (liveIds.length === 0) return out;
  const [templatesRes, rosterRes] = await Promise.all([
    supabaseAdmin
      .from('rep_document_templates')
      .select('team_id, document_type')
      .eq('org_id', orgId)
      .eq('is_active', true),
    supabaseAdmin
      .from('rep_roster_players')
      .select('id, program_year_id, status')
      .in('program_year_id', liveIds),
  ]);
  if (templatesRes.error) throw templatesRes.error;
  if (rosterRes.error) throw rosterRes.error;
  const templates = (templatesRes.data ?? []) as { team_id: string | null; document_type: string }[];
  // The roster rule decides who is on the team (never a call-up or an inactive player).
  const players = ((rosterRes.data ?? []) as { id: string; program_year_id: string; status: string }[])
    .filter(countsOnRoster);
  const docTypes = new Map<string, Set<string>>();
  if (players.length > 0) {
    const { data: docs, error } = await supabaseAdmin
      .from('rep_player_documents')
      .select('player_id, document_type')
      .eq('org_id', orgId)
      .in('player_id', players.map(p => p.id));
    if (error) throw error;
    for (const d of (docs ?? []) as { player_id: string; document_type: string }[]) {
      const set = docTypes.get(d.player_id) ?? new Set<string>();
      set.add(d.document_type);
      docTypes.set(d.player_id, set);
    }
  }
  for (const [teamId, yearId] of liveByTeam) {
    const applies = templatesForTeam(templates, teamId);
    const onTeam = players.filter(p => p.program_year_id === yearId);
    if (applies.length === 0 || onTeam.length === 0) { out.set(teamId, null); continue; }
    const signed = onTeam.filter(p => hasEveryForm(docTypes.get(p.id) ?? new Set(), applies)).length;
    out.set(teamId, { signed, of: onTeam.length });
  }
  return out;
}

/**
 * The board's rows for these teams (already scoped to what the caller may see).
 *
 * `prefetched`: a caller that has ALREADY read these teams' seasons, roster counts or records (the
 * team page reads every season's) hands them in rather than have them read twice. Each map must
 * cover the seasons the board needs (every season of every team passed).
 */
export async function loadClubBoard(
  orgId: string,
  teams: readonly TeamInput[],
  prefetched?: {
    seasonsByTeam?: Map<string, BoardSeasonRow[]>;
    rosterCounts?: Map<string, number>;
    records?: Map<string, WltTally>;
  },
): Promise<Map<string, ClubBoardRow>> {
  const teamIds = teams.map(t => t.id);
  const seasonsByTeam = prefetched?.seasonsByTeam ?? await loadTeamSeasons(teamIds);

  const liveByTeam = new Map<string, string>();
  const shownByTeam = new Map<string, SeasonRow>();
  for (const id of teamIds) {
    const rows = withCreatedAt(seasonsByTeam.get(id) ?? []);
    const live = liveSeasonOf(rows);
    const shown = live ?? latestClosedSeasonOf(rows);
    if (live) liveByTeam.set(id, live.id);
    if (shown) shownByTeam.set(id, shown);
  }
  const liveIds = [...liveByTeam.values()];
  const shownIds = [...shownByTeam.values()].map(s => s.id);

  const [records, rosters, heads, nextEvents, documents, tryouts] = await Promise.all([
    prefetched?.records ?? loadSeasonRecords(shownIds),
    prefetched?.rosterCounts ?? loadRosterCounts(liveIds),
    loadHeadCoaches(orgId, teamIds),
    loadNextEvents(liveIds),
    loadDocuments(orgId, liveByTeam),
    liveIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin
          .from('rep_tryout_registrations')
          .select('program_year_id')
          .in('program_year_id', liveIds)
          .eq('status', 'pending_review'),
  ]);
  if (tryouts.error) throw tryouts.error;
  const pending = new Map<string, number>();
  for (const r of (tryouts.data ?? []) as { program_year_id: string }[]) {
    pending.set(r.program_year_id, (pending.get(r.program_year_id) ?? 0) + 1);
  }

  const out = new Map<string, ClubBoardRow>();
  for (const t of teams) {
    const shown = shownByTeam.get(t.id) ?? null;
    const liveId = liveByTeam.get(t.id) ?? null;
    out.set(t.id, {
      teamId: t.id,
      groupId: t.groupId,
      groupName: t.groupName ?? null,
      season: shown ? seasonShape(shown, records.get(shown.id)) : null,
      headCoach: heads.get(t.id) ?? { people: [], invited: [] },
      rosterCount: liveId ? (rosters.get(liveId) ?? 0) : null,
      nextEvent: liveId ? (nextEvents.get(liveId) ?? null) : null,
      documents: liveId ? (documents.get(t.id) ?? null) : null,
      pendingTryouts: liveId ? (pending.get(liveId) ?? 0) : 0,
    });
  }
  return out;
}
