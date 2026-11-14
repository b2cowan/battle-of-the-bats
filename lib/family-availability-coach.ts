import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { getCoachingAssignmentsForUser } from './db';
import { firstNames, liveSetting, readTeam, type TeamRow } from './family-availability';
import { answeredDayShort, type AnswerWho, type CoachAnswerLine } from './family-availability-words';
import {
  answerOfStatus, familyAnswerState, headcountOf, type Headcount, type LineupFamilyAnswer, type LiveFamilyAnswersSetting,
  type RoomFamilyAnswers,
} from './family-availability-rules';
import type { RepAttendanceSetter, RepAttendanceStatus } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "FAMILIES SAY IF THEY'RE COMING" — WHAT THE COACH'S SIDE READS (Signed-in family accounts Stage 4b, Session 2, Parts 4–5).
 *
 *   scheduleHeadcounts(...)   the schedule rows' "9 of 13 in · 1 out · 1 maybe": COUNTS ONLY, for anyone who sees the schedule
 *   roomFamilyAnswers(...)    the attendance room's family side: who has a parent in the app, and per player who set the answer
 *                             and when, the family's note and the answer before (`answerLines`), for coaches who can mark
 *                             attendance (the route holds the `attendance` capability; ask 11)
 *   answerLines(...)          the same per-player who/when lines, for the attendance PATCH's reply (same capability)
 *   connectedChildIds(...)    which of these children have a parent in the app (verified link with an account)
 *   lineupFamilyAnswers(...)  the game lineup builder / event window: per rostered player whose answer a FAMILY set, that answer
 *                             and when (no note, no name), for coaches who hold BOTH lineups and attendance (Session 3, Part 6)
 *   coachFamilyAnswersSetting the team's live switch (null = nothing about answers exists); every reader above starts here
 *   rosterConnection(...)     Team settings' "N of M players have a parent in the app"
 *   lastRemindedAt(...)       when Remind was last used on an event (the room's card and Remind read the same)
 *   marksFamilyAnswersInOrg   Account → Notifications: whether this coach's "Family answers" row shows (Part 8)
 *
 * ⚠ ONE ATTENDANCE RECORD (mig 483; owner ruling 2026-11-13): every reader here reads the one record (`rep_team_event_attendance`):
 *   one answer per player, with who set it. READ ONLY: writes go through the one writer (the attendance PATCH, the family route).
 *   The family's note and the parents' names leave this file only through `roomFamilyAnswers` / `answerLines`, whose routes hold
 *   the `attendance` capability (ask 11).
 * ⚠ While the guardian tier is off, or the team's switch is off, or the schedule is Staff only, every reader answers "nothing" (null,
 *   [] or false) and the coach's screens are exactly as before (the rename to "Not marked" is the only change for everyone, ask 9).
 * ⚠ Live season only: the callers pass the active season's id; there is no year parameter here.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The team as a caller that already read it (`getRepTeam`) holds it; passing it saves the second `rep_teams` read. */
export interface KnownRepTeam { id: string; orgId: string; scheduleVisibility: string; isArchived: boolean; familyAnswers: string; name?: string }

/** The team's switch when its family answers are live for the coach's screens; null = nothing about them exists. */
export async function coachFamilyAnswersSetting(teamId: string, known?: KnownRepTeam): Promise<LiveFamilyAnswersSetting | null> {
  // Tier off: not even the team is read (every schedule load calls this).
  if (!GUARDIAN_TIER_ENABLED) return null;
  return liveSetting(known
    ? { id: known.id, org_id: known.orgId, schedule_visibility: known.scheduleVisibility, is_archived: known.isArchived, family_answers: known.familyAnswers }
    : await readTeam(teamId));
}

/** When Remind was last used on this event (by anyone on the staff), or null. The one read of the 24-hour slot's last use. */
export async function lastRemindedAt(eventId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('event_availability_reminders').select('reminded_at')
    .eq('event_kind', 'rep_event').eq('event_id', eventId).order('reminded_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as { reminded_at: string } | null)?.reminded_at ?? null;
}

/** The children (of these) with a parent in the app: a verified link that has an account. */
export async function connectedChildIds(childIds: readonly string[]): Promise<Set<string>> {
  const rows = await fetchAllIn<{ child_id: string }>(childIds, (chunk, from, to) =>
    supabaseAdmin.from('family_links').select('child_id')
      .in('child_id', chunk).eq('status', 'verified').not('user_id', 'is', null).order('id').range(from, to));
  return new Set(rows.map(r => r.child_id));
}

async function activeRoster(programYearId: string): Promise<{ id: string; child_id: string }[]> {
  const { data, error } = await supabaseAdmin.from('rep_roster_players')
    .select('id, child_id').eq('program_year_id', programYearId).eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as { id: string; child_id: string }[];
}

/**
 * The schedule's count, per upcoming event the switch covers (not started, not cancelled): ONE count per player, read from the
 * record alone, whoever set it (ask 8; one record). `total` = the active roster (no call-ups). An event nobody marked or answered for is
 * left out (an empty row says nothing). COUNTS ONLY: no name, no note, no per-player status leaves this function (ask 11).
 */
export async function scheduleHeadcounts(params: {
  teamId: string;
  programYearId: string;
  events: readonly { id: string; eventType: string; status: string; startsAt: string }[];
  team?: KnownRepTeam;
  now?: Date;
}): Promise<Record<string, Headcount> | null> {
  const setting = await coachFamilyAnswersSetting(params.teamId, params.team);
  if (!setting) return null;
  const now = params.now ?? new Date();
  const open = params.events.filter(e => familyAnswerState(setting, e, now) === 'open');
  if (open.length === 0) return {};
  const ids = open.map(e => e.id);

  const [roster, marks] = await Promise.all([
    activeRoster(params.programYearId),
    fetchAllIn<{ event_id: string; player_id: string; status: RepAttendanceStatus }>(ids, (chunk, from, to) =>
      supabaseAdmin.from('rep_team_event_attendance').select('event_id, player_id, status').in('event_id', chunk)
        .order('event_id').order('player_id').range(from, to)),
  ]);
  const mark = new Map(marks.map(m => [`${m.event_id}|${m.player_id}`, m.status]));

  const out: Record<string, Headcount> = {};
  for (const id of ids) {
    const c = headcountOf(roster.map(p => ({ status: mark.get(`${id}|${p.id}`) ?? 'unknown' })));
    if (c.in + c.out + c.maybe > 0) out[id] = c;
  }
  return out;
}

/** The record's columns the attendance room's who/when lines read (the caller holds the `attendance` capability). */
interface LineBookRow {
  player_id: string; status: RepAttendanceStatus; set_by_kind: RepAttendanceSetter | null; set_by_user_id: string | null;
  set_at: string | null; family_note: string | null;
  previous_status: RepAttendanceStatus | null; previous_by_kind: RepAttendanceSetter | null; previous_by_user_id: string | null;
  previous_at: string | null;
}
const LINE_COLUMNS = 'player_id, status, set_by_kind, set_by_user_id, set_at, family_note, previous_status, previous_by_kind, ' +
  'previous_by_user_id, previous_at';

/**
 * Per player with an answer on ONE event: who set it and when, the family's note and the answer before (ruling 4). A family setter
 * is named by first name (or "A parent"); anyone on the coach's side reads "Coach". The CALLER holds the `attendance` capability:
 * the note's words and parents' names reach coaches who can mark attendance and nobody else (ask 11). `playerIds` limits the read
 * (the room's roster, or the PATCH's players).
 */
export async function answerLines(eventId: string, playerIds: readonly string[], now: Date = new Date()): Promise<Record<string, CoachAnswerLine>> {
  if (playerIds.length === 0) return {};
  const { data, error } = await supabaseAdmin.from('rep_team_event_attendance').select(LINE_COLUMNS)
    .eq('event_id', eventId).in('player_id', [...playerIds]).neq('status', 'unknown');
  if (error) throw error;
  const rows = ((data ?? []) as unknown as LineBookRow[]).filter(b => b.set_at);
  const names = await firstNames(rows.flatMap(b => [
    b.set_by_kind === 'family' ? b.set_by_user_id : null, b.previous_by_kind === 'family' ? b.previous_by_user_id : null,
  ]).filter((id): id is string => !!id));
  const who = (kind: RepAttendanceSetter | null, by: string | null, at: string): AnswerWho => (kind === 'family'
    ? { by: 'family', name: by ? names.get(by) ?? null : null, day: answeredDayShort(at, now) }
    : { by: 'coach', name: null, day: answeredDayShort(at, now) });
  const out: Record<string, CoachAnswerLine> = {};
  for (const b of rows) {
    const previous = answerOfStatus(b.previous_status);
    out[b.player_id] = {
      ...who(b.set_by_kind, b.set_by_user_id, b.set_at!),
      familyNote: b.family_note,
      previous: previous && b.previous_at ? { ...who(b.previous_by_kind, b.previous_by_user_id, b.previous_at), status: previous } : null,
    };
  }
  return out;
}

/**
 * The attendance room's family side for ONE event of the active season: per rostered player whether a parent is in the app, and
 * the who/when lines (`answerLines`). Null when the switch doesn't cover this event or nothing about answers exists. The CALLER
 * holds the `attendance` capability (ask 11).
 */
export async function roomFamilyAnswers(params: {
  teamId: string;
  programYearId: string;
  event: { id: string; eventType: string; status: string; startsAt: string };
  team?: KnownRepTeam;
  now?: Date;
}): Promise<RoomFamilyAnswers | null> {
  const setting = await coachFamilyAnswersSetting(params.teamId, params.team);
  if (!setting) return null;
  const now = params.now ?? new Date();
  const state = familyAnswerState(setting, params.event, now);
  if (state === 'not_covered') return null;
  if (state === 'cancelled') return { setting, state, rows: [], lines: {}, remindedAt: null };

  const roster = await activeRoster(params.programYearId);
  const [connected, lines, lastRemind] = await Promise.all([
    connectedChildIds(roster.map(p => p.child_id)),
    answerLines(params.event.id, roster.map(p => p.id), now),
    lastRemindedAt(params.event.id),
  ]);
  return {
    setting,
    state,
    remindedAt: lastRemind,
    lines,
    rows: roster.map(p => ({ playerId: p.id, connected: connected.has(p.child_id) })),
  };
}

/**
 * The attendance PATCH's reply: the who/when lines for this event, only where the room shows them (the switch covers the event and
 * it isn't cancelled); null otherwise, and the room keeps the lines it has.
 */
export async function answerLinesForReply(params: {
  teamId: string; team?: KnownRepTeam; event: { id: string; eventType: string; status: string; startsAt: string };
  playerIds: readonly string[];
}): Promise<Record<string, CoachAnswerLine> | null> {
  const setting = await coachFamilyAnswersSetting(params.teamId, params.team);
  if (!setting) return null;
  const state = familyAnswerState(setting, params.event, new Date());
  if (state === 'not_covered' || state === 'cancelled') return null;
  return answerLines(params.event.id, params.playerIds);
}

/** Team settings: how many of the active roster have a parent in the app (the switch's "10 of 13 players have a parent"). */
export async function rosterConnection(programYearId: string): Promise<{ connected: number; roster: number }> {
  const roster = await activeRoster(programYearId);
  const connected = await connectedChildIds(roster.map(p => p.child_id));
  return { connected: roster.filter(p => connected.has(p.child_id)).length, roster: roster.length };
}

// ── The lineup (Session 3, Part 6; ask 13) ───────────────────────────────────────────────────────────────────────────────────


/**
 * The family answers on one game for its lineup (the builder's pool words and warning, the event window's Lineup row). Null when
 * nothing about answers exists here (tier, switch, schedule visibility, a cancelled event, a kind the switch doesn't cover). The
 * CALLER holds lineups AND attendance: a per-player answer reaches only coaches who can mark attendance (ask 11).
 */
export async function lineupFamilyAnswers(params: {
  teamId: string;
  programYearId: string;
  event: { id: string; eventType: string; status: string; startsAt: string };
  now?: Date;
}): Promise<LineupFamilyAnswer[] | null> {
  const setting = await coachFamilyAnswersSetting(params.teamId);
  if (!setting) return null;
  const state = familyAnswerState(setting, params.event, params.now ?? new Date());
  if (state === 'not_covered' || state === 'cancelled') return null;
  const roster = await activeRoster(params.programYearId);
  if (roster.length === 0) return [];
  // The answers a FAMILY set (no note, no name): the builder words a family's Out as theirs. The pool's words read the status
  // itself (`lineupTagWord`).
  const { data, error } = await supabaseAdmin.from('rep_team_event_attendance').select('player_id, status, set_at')
    .eq('event_id', params.event.id).eq('set_by_kind', 'family').in('player_id', roster.map(p => p.id));
  if (error) throw error;
  return ((data ?? []) as { player_id: string; status: RepAttendanceStatus; set_at: string | null }[]).flatMap(b => {
    const status = answerOfStatus(b.status);
    return status && b.set_at ? [{ playerId: b.player_id, status, answeredAt: b.set_at }] : [];
  });
}

/**
 * Account → Notifications (Part 8): does this person mark attendance on a team in this org whose families can answer now? The
 * coach card shows its "Family answers" row only then (a toggle with nothing behind it is what the settings page must not show).
 * False while the guardian tier is off.
 */
export async function marksFamilyAnswersInOrg(orgId: string, userId: string): Promise<boolean> {
  if (!GUARDIAN_TIER_ENABLED) return false;
  const teams = (await getCoachingAssignmentsForUser(orgId, userId)).filter(a => a.capabilities.attendance).map(a => a.teamId);
  if (teams.length === 0) return false;
  // One read for every team, and the gate only for a team whose switch is on (usually none): Account → Notifications loads this.
  const { data, error } = await supabaseAdmin.from('rep_teams')
    .select('id, org_id, schedule_visibility, is_archived, family_answers').in('id', teams).neq('family_answers', 'off');
  if (error) throw error;
  return (await Promise.all(((data ?? []) as TeamRow[]).map(t => liveSetting(t)))).some(Boolean);
}
