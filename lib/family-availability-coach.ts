import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { getCoachingAssignmentsForUser } from './db';
import { firstNames, liveSetting, readTeam } from './family-availability';
import { answeredDayShort, type FamilyAnswer } from './family-availability-words';
import {
  familyAnswerState, headcountOf, lineupFamilyOuts, type Headcount, type LineupFamilyAnswer, type LiveFamilyAnswersSetting,
  type RoomFamilyAnswers,
} from './family-availability-rules';
import type { RepAttendanceStatus } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "FAMILIES SAY IF THEY'RE COMING" — WHAT THE COACH'S SIDE READS (Signed-in family accounts Stage 4b, Session 2, Parts 4–5).
 *
 *   scheduleHeadcounts(...)   the schedule rows' "9 of 13 in · 1 out · 1 maybe": COUNTS ONLY, for anyone who sees the schedule
 *   roomFamilyAnswers(...)    the attendance room's family lines (answer, note, who, day, earlier), for coaches who can mark
 *                             attendance (the route holds the `attendance` capability; ask 11)
 *   connectedChildIds(...)    which of these children have a parent in the app (verified link with an account)
 *   lineupFamilyAnswers(...)  the game lineup builder / event window: per rostered player, the family's answer and when (no note,
 *                             no name), for coaches who hold BOTH lineups and attendance (Session 3, Part 6)
 *   familyLineupFlagEventIds  the schedule row's lineup triangle: the upcoming games whose saved lineup holds a player a family
 *                             said Out about that the coach hasn't settled (ids only)
 *
 * ⚠ READ ONLY. Nothing here writes the coach's book: the coach copies answers in with a tap, through the attendance PATCH (ask 3).
 * ⚠ While the guardian tier is off, or the team's switch is off, or the schedule is Staff only, every reader answers null and the
 *   coach's screens are exactly as before (the rename to "Not marked" is the only change for everyone, ask 9).
 * ⚠ Live season only: the callers pass the active season's id; there is no year parameter here.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The team as a caller that already read it (`getRepTeam`) holds it; passing it saves the second `rep_teams` read. */
export interface KnownRepTeam { id: string; orgId: string; scheduleVisibility: string; isArchived: boolean; familyAnswers: string }

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
 * The schedule's count, per upcoming event the switch covers (not started, not cancelled): ONE count per player, the coach's mark
 * first, else the family's answer (ask 8). `total` = the active roster (no call-ups). An event nobody marked or answered for is
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

  const [roster, marks, answers] = await Promise.all([
    activeRoster(params.programYearId),
    fetchAllIn<{ event_id: string; player_id: string; status: RepAttendanceStatus }>(ids, (chunk, from, to) =>
      supabaseAdmin.from('rep_team_event_attendance').select('event_id, player_id, status').in('event_id', chunk)
        .order('event_id').order('player_id').range(from, to)),
    fetchAllIn<{ event_id: string; child_id: string; answer: FamilyAnswer }>(ids, (chunk, from, to) =>
      supabaseAdmin.from('event_availability_answers').select('event_id, child_id, answer')
        .eq('event_kind', 'rep_event').in('event_id', chunk).order('event_id').order('child_id').range(from, to)),
  ]);
  const mark = new Map(marks.map(m => [`${m.event_id}|${m.player_id}`, m.status]));
  const said = new Map(answers.map(a => [`${a.event_id}|${a.child_id}`, a.answer]));

  const out: Record<string, Headcount> = {};
  for (const id of ids) {
    const c = headcountOf(roster.map(p => ({
      status: mark.get(`${id}|${p.id}`) ?? 'unknown',
      family: said.get(`${id}|${p.child_id}`) ?? null,
    })));
    if (c.in + c.out + c.maybe > 0) out[id] = c;
  }
  return out;
}

interface AnswerRow {
  child_id: string; answer: FamilyAnswer; note: string | null; answered_by_user_id: string | null; answered_at: string;
  previous_answer: FamilyAnswer | null; previous_by_user_id: string | null; previous_at: string | null;
}

/**
 * The attendance room's family side for ONE event of the active season: per rostered player, whether a parent is in the app and
 * what the family said (answer, the note's words, the answering parent's first name and day, and the answer before). Null when
 * the switch doesn't cover this event or nothing about answers exists. The CALLER holds the `attendance` capability: the note's
 * words reach coaches who can mark attendance and nobody else (ask 11).
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
  if (state === 'cancelled') return { setting, state, rows: [], remindedAt: null };

  const roster = await activeRoster(params.programYearId);
  const childIds = roster.map(p => p.child_id);
  const [connected, answers, lastRemind] = await Promise.all([
    connectedChildIds(childIds),
    childIds.length
      ? supabaseAdmin.from('event_availability_answers')
        .select('child_id, answer, note, answered_by_user_id, answered_at, previous_answer, previous_by_user_id, previous_at')
        .eq('event_kind', 'rep_event').eq('event_id', params.event.id).in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),
    lastRemindedAt(params.event.id),
  ]);
  if (answers.error) throw answers.error;
  const rows = (answers.data ?? []) as AnswerRow[];
  const names = await firstNames(rows.flatMap(a => [a.answered_by_user_id, a.previous_by_user_id]).filter((id): id is string => !!id));
  const nameOf = (id: string | null) => (id ? names.get(id) ?? null : null);
  const byChild = new Map(rows.map(a => [a.child_id, a]));

  return {
    setting,
    state,
    remindedAt: lastRemind,
    rows: roster.map(p => {
      const a = byChild.get(p.child_id);
      return {
        playerId: p.id,
        connected: connected.has(p.child_id),
        answeredAt: a?.answered_at ?? null,
        line: a ? {
          answer: a.answer,
          note: a.note,
          by: nameOf(a.answered_by_user_id),
          day: answeredDayShort(a.answered_at, now),
          previous: a.previous_answer && a.previous_at
            ? { answer: a.previous_answer, by: nameOf(a.previous_by_user_id), day: answeredDayShort(a.previous_at, now) }
            : null,
        } : null,
      };
    }),
  };
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
  const playerOf = new Map(roster.map(p => [p.child_id, p.id]));
  const { data, error } = await supabaseAdmin.from('event_availability_answers').select('child_id, answer, answered_at')
    .eq('event_kind', 'rep_event').eq('event_id', params.event.id).in('child_id', [...playerOf.keys()]);
  if (error) throw error;
  return ((data ?? []) as { child_id: string; answer: FamilyAnswer; answered_at: string }[])
    .map(a => ({ playerId: playerOf.get(a.child_id)!, answer: a.answer, answeredAt: a.answered_at }));
}

/**
 * The schedule row's lineup triangle, the family side (the coach's own mismatch is `getRepTeamLineupAttendanceMismatchEventIds`):
 * the upcoming games (not started, not cancelled, covered by the switch) whose SAVED lineup holds a player a family said Out about
 * that the coach hasn't settled (`lineupFamilyOuts`, the builder's own rule). Ids only. Empty when nothing about answers exists.
 */
export async function familyLineupFlagEventIds(params: {
  teamId: string;
  programYearId: string;
  events: readonly { id: string; eventType: string; status: string; startsAt: string }[];
  team?: KnownRepTeam;
  now?: Date;
}): Promise<string[]> {
  const setting = await coachFamilyAnswersSetting(params.teamId, params.team);
  if (!setting) return [];
  const now = params.now ?? new Date();
  const ids = params.events.filter(e => familyAnswerState(setting, e, now) === 'open').map(e => e.id);
  if (ids.length === 0) return [];

  // Only games with a family Out are worth reading lineups for.
  const outs = await fetchAllIn<{ event_id: string; child_id: string; answered_at: string }>(ids, (chunk, from, to) =>
    supabaseAdmin.from('event_availability_answers').select('event_id, child_id, answered_at')
      .eq('event_kind', 'rep_event').eq('answer', 'out').in('event_id', chunk).order('event_id').order('child_id').range(from, to));
  const withOut = [...new Set(outs.map(o => o.event_id))];
  if (withOut.length === 0) return [];

  const [roster, lineups, marks] = await Promise.all([
    activeRoster(params.programYearId),
    fetchAllIn<{ id: string; event_id: string; updated_at: string }>(withOut, (chunk, from, to) =>
      supabaseAdmin.from('rep_team_lineups').select('id, event_id, updated_at').in('event_id', chunk).order('id').range(from, to)),
    fetchAllIn<{ event_id: string; player_id: string; status: RepAttendanceStatus; marked_at: string | null }>(withOut, (chunk, from, to) =>
      supabaseAdmin.from('rep_team_event_attendance').select('event_id, player_id, status, marked_at').in('event_id', chunk)
        .order('event_id').order('player_id').range(from, to)),
  ]);
  if (lineups.length === 0) return [];
  const entries = await fetchAllIn<{ lineup_id: string; player_id: string }>(lineups.map(l => l.id), (chunk, from, to) =>
    supabaseAdmin.from('rep_team_lineup_entries').select('lineup_id, player_id').in('lineup_id', chunk)
      .order('lineup_id').order('player_id').range(from, to));

  const playerOf = new Map(roster.map(p => [p.child_id, p.id]));
  const lineupOf = new Map(lineups.map(l => [l.event_id, l]));
  const inLineup = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!inLineup.has(e.lineup_id)) inLineup.set(e.lineup_id, new Set());
    inLineup.get(e.lineup_id)!.add(e.player_id);
  }
  const mark = new Map(marks.map(m => [`${m.event_id}|${m.player_id}`, m]));
  const outsOf = new Map<string, typeof outs>();
  for (const o of outs) outsOf.set(o.event_id, [...(outsOf.get(o.event_id) ?? []), o]);
  const flagged: string[] = [];
  for (const eventId of withOut) {
    const lineup = lineupOf.get(eventId);
    if (!lineup) continue;
    const players = (outsOf.get(eventId) ?? []).filter(o => playerOf.has(o.child_id)).map(o => {
      const playerId = playerOf.get(o.child_id)!;
      const m = mark.get(`${eventId}|${playerId}`);
      return {
        playerId, status: m?.status ?? 'unknown' as RepAttendanceStatus, markedAt: m?.marked_at ?? null,
        family: { answer: 'out' as const, answeredAt: o.answered_at },
      };
    });
    if (lineupFamilyOuts(players, inLineup.get(lineup.id) ?? new Set(), lineup.updated_at).length > 0) flagged.push(eventId);
  }
  return flagged;
}

/**
 * Account → Notifications (Part 8): does this person mark attendance on a team in this org whose families can answer now? The
 * coach card shows its "Family answers" row only then (a toggle with nothing behind it is what the settings page must not show).
 * False while the guardian tier is off.
 */
export async function marksFamilyAnswersInOrg(orgId: string, userId: string): Promise<boolean> {
  if (!GUARDIAN_TIER_ENABLED) return false;
  const teams = (await getCoachingAssignmentsForUser(orgId, userId)).filter(a => a.capabilities.attendance).map(a => a.teamId);
  return (await Promise.all(teams.map(teamId => coachFamilyAnswersSetting(teamId)))).some(Boolean);
}
