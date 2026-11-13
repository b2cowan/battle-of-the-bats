import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { getEnabledFamilyOrg, getFamilyReach, isVisibleToFamilies } from './family-access';
import { FAMILY_AVAILABILITY_WORDS, answeredDayWords, type FamilyAnswer } from './family-availability-words';
import {
  cleanFamilyNote, familyAnswersCover, familyAnswerState, firstNameOf, normalizeFamilyAnswers, type FamilyAnswersSetting,
} from './family-availability-rules';
import type { FamilyScheduleEntry } from './family-view';

export { familyAnswersCover, isFamilyAnswer, normalizeFamilyAnswers, type FamilyAnswersSetting } from './family-availability-rules';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "FAMILIES SAY IF THEY'RE COMING" — WHO MAY ANSWER, AND WHAT A PARENT READS (Signed-in family accounts Stage 4b, Parts 1–3;
 * plan SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md, Stage 4, "RULED 2026-11-13"; build prompt SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md).
 *
 *   familyAnswersCover(setting, type)   the team's switch → which events families answer (ask 1)
 *   writeFamilyAnswer(...)              the ONE writer of a family answer (the parent's route calls it)
 *   readFamilyAnswers(...)              the parent's page: the account's OWN children's answers on one team, and nothing else
 *
 * ⚠ A FAMILY ANSWER IS NOT THE COACH'S BOOK. This module never reads or writes the attendance book (a guard test holds it to that):
 *   the coach copies answers in with a tap (ask 3).
 * ⚠ REACH IS RE-DERIVED ON EVERY WRITE from the signed-in account (`getFamilyReach`), never from a team, event or child id the
 *   client sent; a parent who left, was removed or was stopped holds no verified link and is refused, stale tab or not.
 *   (`getVerifiedLinkForUserTeam` returns the FIRST matching link, so it is never used for a per-child write.)
 * ⚠ WHAT A PARENT READS (ask 5): their own child's answer, the other connected parent's first name and answer and day, whether
 *   that parent left a note (never its words), and their own note. No teammate, no coach mark, nobody else's note
 *   (tests/unit/family-availability-payload.test.ts holds the allow-list).
 * ⚠ Rep teams only in 4b (ask 4). The record can hold a house-league event (`event_kind`); nothing here writes one.
 * ⚠ While the guardian tier is off, nothing here answers: the read is null and the writer refuses.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

// ── The parent's view (ask 5's allow-list) ────────────────────────────────────────────────────────────────────────────────

/** One child on one event, as the parent's page shows it. EVERY field that reaches the browser is named here. */
export interface FamilyAnswerRow {
  eventId: string;
  childId: string;
  /** The account's own child, by first name. */
  child: string;
  /** Answers are open until the start time (then the row shows the answer and no control). */
  open: boolean;
  answer: FamilyAnswer | null;
  /** The answer is this account's own. */
  mine: boolean;
  /** When it is the OTHER parent's: their first name (null when their account holds none: the words say "the other parent"). */
  byFirstName: string | null;
  /** "on Tuesday" — the day, never the clock time (ask 6). Null when unanswered. */
  dayWords: string | null;
  /** This account's OWN note, or null. Never another parent's words. */
  note: string | null;
  /** The other parent left a note (the sheet says so, without its words). */
  otherHasNote: boolean;
}

export interface FamilyAnswersView {
  setting: Exclude<FamilyAnswersSetting, 'off'>;
  rows: FamilyAnswerRow[];
  /** Per child: the other connected parent's first name (or the fallback words), or null when nobody else is connected. */
  otherParent: Record<string, string | null>;
}

export interface TeamRow { id: string; org_id: string; schedule_visibility: string | null; is_archived: boolean; family_answers: string | null }
interface AnswerRow {
  event_id: string; child_id: string; answer: FamilyAnswer; note: string | null;
  answered_by_user_id: string | null; answered_at: string;
}

export async function readTeam(teamId: string): Promise<TeamRow | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams').select('id, org_id, schedule_visibility, is_archived, family_answers').eq('id', teamId).maybeSingle();
  if (error) throw error;
  return (data as TeamRow | null) ?? null;
}

/** The team's switch when families may answer on it at all now (tier on, not archived, schedule shared, family layer on). */
export async function liveSetting(team: TeamRow | null): Promise<Exclude<FamilyAnswersSetting, 'off'> | null> {
  if (!GUARDIAN_TIER_ENABLED || !team || team.is_archived) return null;
  const setting = normalizeFamilyAnswers(team.family_answers);
  if (setting === 'off' || !isVisibleToFamilies(team.schedule_visibility)) return null;
  if (!(await getEnabledFamilyOrg(team.org_id, team.id))) return null;
  return setting;
}

export async function firstNames(userIds: readonly string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  await Promise.all([...new Set(userIds)].map(async id => {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    out.set(id, error || !data?.user ? null : firstNameOf(data.user.user_metadata));
  }));
  return out;
}

/**
 * The parent's page: for each upcoming event the switch covers and each of the account's OWN children on this rep team, that
 * child's answer. The caller passes the children it already proved this account reaches here (`readFamilyTeam`'s reach) and the
 * team's family schedule; this re-checks the team's switch and gates. Null = nothing about answers exists on this page.
 */
export async function readFamilyAnswers(params: {
  userId: string;
  teamId: string;
  kind: 'rep' | 'league';
  children: readonly { childId: string; firstName: string }[];
  entries: readonly FamilyScheduleEntry[];
  now?: Date;
}): Promise<FamilyAnswersView | null> {
  if (!GUARDIAN_TIER_ENABLED || params.kind !== 'rep' || params.children.length === 0) return null;
  const setting = await liveSetting(await readTeam(params.teamId));
  if (!setting) return null;
  const now = params.now ?? new Date();

  // Upcoming or under way: not cancelled (kept, hidden) and not over. A started one shows its answer, closed.
  const events = params.entries.filter(e => e.status === 'scheduled' && !e.completed && familyAnswersCover(setting, e.eventType));
  const childIds = params.children.map(c => c.childId);

  const [answers, links, seasons] = await Promise.all([
    events.length
      ? supabaseAdmin.from('event_availability_answers')
        .select('event_id, child_id, answer, note, answered_by_user_id, answered_at')
        .eq('event_kind', 'rep_event').in('event_id', events.map(e => e.id)).in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),
    // The other connected parents of these children (joined: verified, with an account).
    supabaseAdmin.from('family_links').select('child_id, user_id')
      .in('child_id', childIds).eq('status', 'verified').not('user_id', 'is', null).neq('user_id', params.userId),
    events.length ? childSeasons(params.userId, params.teamId, events.map(e => e.id)) : Promise.resolve(null),
  ]);
  if (answers.error) throw answers.error;
  if (links.error) throw links.error;
  const answerRows = (answers.data ?? []) as AnswerRow[];
  const linkRows = (links.data ?? []) as { child_id: string; user_id: string }[];

  const names = await firstNames([
    ...linkRows.map(l => l.user_id),
    ...answerRows.map(a => a.answered_by_user_id).filter((id): id is string => !!id && id !== params.userId),
  ]);

  const otherParent: Record<string, string | null> = {};
  for (const c of params.children) {
    const other = linkRows.find(l => l.child_id === c.childId);
    otherParent[c.childId] = other ? (names.get(other.user_id) ?? FAMILY_AVAILABILITY_WORDS.otherParentFallback) : null;
  }

  const byKey = new Map(answerRows.map(a => [`${a.event_id}|${a.child_id}`, a]));
  const rows: FamilyAnswerRow[] = [];
  for (const e of events) {
    for (const c of params.children) {
      // Only an event of the season this child is rostered in (a team with two seasons open never offers a pill the writer
      // would refuse; Session 1 review, item d).
      if (!seasons || !seasons.child.get(c.childId)?.has(seasons.event.get(e.id) ?? '')) continue;
      rows.push({
        ...rowOf(e.id, c.childId, byKey.get(`${e.id}|${c.childId}`) ?? null, familyAnswerState(setting, e, now) === 'open', params.userId, names, now),
        child: c.firstName,
      });
    }
  }
  return { setting, rows, otherParent };
}

/** Each event's season, and the seasons each of this account's children is rostered in on this team (through the account's OWN
 *  reach, the writer's rule), so the page offers a pill only where the writer would take the answer. */
async function childSeasons(userId: string, teamId: string, eventIds: readonly string[]): Promise<{
  event: Map<string, string>; child: Map<string, Set<string>>;
}> {
  const reach = await getFamilyReach(userId);
  const entries = reach.flatMap(r => r.teams.filter(t => t.kind === 'rep' && t.teamId === teamId).map(t => ({ childId: r.link.childId, entryId: t.entryId })));
  const [events, roster] = await Promise.all([
    supabaseAdmin.from('rep_team_events').select('id, program_year_id').in('id', [...eventIds]),
    entries.length
      ? supabaseAdmin.from('rep_roster_players').select('id, program_year_id').in('id', entries.map(e => e.entryId))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (events.error) throw events.error;
  if (roster.error) throw roster.error;
  const seasonOfEntry = new Map(((roster.data ?? []) as { id: string; program_year_id: string }[]).map(r => [r.id, r.program_year_id]));
  const child = new Map<string, Set<string>>();
  for (const e of entries) {
    const season = seasonOfEntry.get(e.entryId);
    if (!season) continue;
    if (!child.has(e.childId)) child.set(e.childId, new Set());
    child.get(e.childId)!.add(season);
  }
  return {
    event: new Map(((events.data ?? []) as { id: string; program_year_id: string }[]).map(e => [e.id, e.program_year_id])),
    child,
  };
}

/** A row without the child's name: the page adds it; a save's response never carries it (the sheet already holds it). */
export type FamilyAnswerFields = Omit<FamilyAnswerRow, 'child'>;

function rowOf(
  eventId: string, childId: string, a: AnswerRow | null, open: boolean,
  userId: string, names: Map<string, string | null>, now: Date,
): FamilyAnswerFields {
  const mine = !!a && a.answered_by_user_id === userId;
  return {
    eventId,
    childId,
    open,
    answer: a?.answer ?? null,
    mine,
    byFirstName: a && !mine && a.answered_by_user_id ? (names.get(a.answered_by_user_id) ?? null) : null,
    dayWords: a ? answeredDayWords(a.answered_at, now) : null,
    note: mine ? a?.note ?? null : null,
    otherHasNote: !!a && !mine && !!a.note,
  };
}

// ── The one writer ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type FamilyAnswerWrite =
  | { ok: true; row: FamilyAnswerFields }
  /** not_found: nothing this account may answer here (no reach, wrong team, the switch doesn't cover it, the tier is off).
   *  closed: the event started or was cancelled. bad_note: longer than 200 characters, or not text. */
  | { ok: false; code: 'not_found' | 'closed' | 'bad_note' };

interface EventRow { id: string; team_id: string; program_year_id: string; event_type: string; status: string; starts_at: string }

/**
 * Save (or clear, `answer: null`) one child's answer on one event. Every gate is checked here, on the server, from the signed-in
 * account: the tier; a VERIFIED link of this account to THIS child; the child live on THIS rep team (the reach) in the season the
 * event belongs to; the event on this team; the switch covers its kind; the schedule shared with families; the club's family
 * layer on; not cancelled; not started.
 *
 * A write replaces answer and note wholesale (so a second parent's change clears the first's note, ask 6). A CHANGED answer
 * keeps the one before it in `previous_*`; re-sending the same answer changes only the note (and whose it is).
 */
export async function writeFamilyAnswer(params: {
  userId: string; teamId: string; eventId: string; childId: string; answer: FamilyAnswer | null; note?: unknown; now?: Date;
}): Promise<FamilyAnswerWrite> {
  if (!GUARDIAN_TIER_ENABLED) return { ok: false, code: 'not_found' };
  const cleaned = cleanFamilyNote(params.note);
  if (!cleaned.ok) return { ok: false, code: 'bad_note' };
  const now = params.now ?? new Date();

  const reach = await getFamilyReach(params.userId);
  // Any verified link of this account to this child that reaches THIS team (never just the first link).
  const isThisTeam = (t: { kind: string; teamId: string }) => t.kind === 'rep' && t.teamId === params.teamId;
  const hold = reach.find(r => r.link.childId === params.childId && r.teams.some(isThisTeam));
  const reached = hold?.teams.find(isThisTeam);
  if (!hold || !reached) return { ok: false, code: 'not_found' };

  const [team, event, entry] = await Promise.all([
    readTeam(params.teamId),
    supabaseAdmin.from('rep_team_events').select('id, team_id, program_year_id, event_type, status, starts_at')
      .eq('id', params.eventId).maybeSingle(),
    supabaseAdmin.from('rep_roster_players').select('program_year_id').eq('id', reached.entryId).maybeSingle(),
  ]);
  if (event.error) throw event.error;
  if (entry.error) throw entry.error;
  const ev = event.data as EventRow | null;
  const season = (entry.data as { program_year_id: string } | null)?.program_year_id ?? null;
  // The event must be this team's, in the season the child is live on (never an old season's, never another team's).
  if (!ev || ev.team_id !== params.teamId || !season || ev.program_year_id !== season) return { ok: false, code: 'not_found' };
  if (!team || team.org_id !== hold.link.orgId) return { ok: false, code: 'not_found' };
  const setting = await liveSetting(team);
  if (!setting) return { ok: false, code: 'not_found' };
  const state = familyAnswerState(setting, { eventType: ev.event_type, status: ev.status, startsAt: ev.starts_at }, now);
  if (state === 'not_covered') return { ok: false, code: 'not_found' };
  if (state !== 'open') return { ok: false, code: 'closed' };

  const key = { event_kind: 'rep_event', event_id: ev.id, child_id: params.childId };
  const stamp = now.toISOString();

  if (params.answer === null) {
    const { error } = await supabaseAdmin.from('event_availability_answers').delete().match(key);
    if (error) throw error;
    return { ok: true, row: rowOf(ev.id, params.childId, null, true, params.userId, new Map(), now) };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: existing, error: readError } = await supabaseAdmin.from('event_availability_answers')
      .select('id, answer, answered_by_user_id, answered_at').match(key).maybeSingle();
    if (readError) throw readError;
    const prior = existing as { id: string; answer: FamilyAnswer; answered_by_user_id: string | null; answered_at: string } | null;

    if (!prior) {
      const { error } = await supabaseAdmin.from('event_availability_answers').insert({
        ...key, answer: params.answer, note: cleaned.note,
        answered_by_user_id: params.userId, answered_at: stamp, updated_at: stamp,
      });
      // The other parent's first answer landed between the read and the insert: go again as a change.
      if (error?.code === '23505' && attempt === 0) continue;
      if (error) throw error;
    } else {
      const changed = prior.answer !== params.answer;
      const sameWriter = prior.answered_by_user_id === params.userId;
      const patch = changed
        ? {
          previous_answer: prior.answer, previous_by_user_id: prior.answered_by_user_id, previous_at: prior.answered_at,
          answer: params.answer, note: cleaned.note, answered_by_user_id: params.userId, answered_at: stamp, updated_at: stamp,
        }
        // The same answer: only the note changes. When the other parent re-sends it, the note is theirs now, so the answer is too.
        : { note: cleaned.note, updated_at: stamp, ...(sameWriter ? {} : { answered_by_user_id: params.userId, answered_at: stamp }) };
      // Only if the row is still the one we read: a parent who answered a moment ago keeps their "earlier" intact; go again.
      const { data: updated, error } = await supabaseAdmin.from('event_availability_answers').update(patch)
        .eq('id', prior.id).eq('answered_at', prior.answered_at).eq('answer', prior.answer).select('id');
      if (error) throw error;
      if (!updated?.length) {
        if (attempt === 0) continue;
        throw new Error('The answer could not be saved.');
      }
    }
    const saved: AnswerRow = {
      event_id: ev.id, child_id: params.childId, answer: params.answer, note: cleaned.note,
      answered_by_user_id: params.userId,
      answered_at: prior && prior.answer === params.answer && prior.answered_by_user_id === params.userId ? prior.answered_at : stamp,
    };
    return { ok: true, row: rowOf(ev.id, params.childId, saved, true, params.userId, new Map(), now) };
  }
  throw new Error('The answer could not be saved.');
}
