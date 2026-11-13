import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { firstNames, liveSetting, readTeam } from './family-availability';
import { answeredDayShort, type FamilyAnswer } from './family-availability-words';
import {
  familyAnswerState, headcountOf, type Headcount, type LiveFamilyAnswersSetting, type RoomFamilyAnswers,
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
  if (state === 'cancelled') return { setting, state, rows: [] };

  const roster = await activeRoster(params.programYearId);
  const childIds = roster.map(p => p.child_id);
  const [connected, answers] = await Promise.all([
    connectedChildIds(childIds),
    childIds.length
      ? supabaseAdmin.from('event_availability_answers')
        .select('child_id, answer, note, answered_by_user_id, answered_at, previous_answer, previous_by_user_id, previous_at')
        .eq('event_kind', 'rep_event').eq('event_id', params.event.id).in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (answers.error) throw answers.error;
  const rows = (answers.data ?? []) as AnswerRow[];
  const names = await firstNames(rows.flatMap(a => [a.answered_by_user_id, a.previous_by_user_id]).filter((id): id is string => !!id));
  const nameOf = (id: string | null) => (id ? names.get(id) ?? null : null);
  const byChild = new Map(rows.map(a => [a.child_id, a]));

  return {
    setting,
    state,
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
