import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { getEnabledFamilyOrg, getFamilyReach, isVisibleToFamilies } from './family-access';
import { FAMILY_AVAILABILITY_WORDS, answeredDayShort, type AnswerSetLine, type AnswerStatus, type AnswerWho } from './family-availability-words';
import {
  answerOfStatus, cleanFamilyNote, familyAnswersCover, familyAnswerState, firstNameOf, normalizeFamilyAnswers,
  type LiveFamilyAnswersSetting,
} from './family-availability-rules';
import type { RepAttendanceSetter, RepAttendanceStatus } from './types';
import type { FamilyScheduleEntry } from './family-view';

// The parent's save route reads its one guard from here (every other caller imports the rules file itself).
export { isAnswerStatus } from './family-availability-rules';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "FAMILIES SAY IF THEY'RE COMING" — WHO MAY ANSWER, AND WHAT A PARENT READS (Signed-in family accounts Stage 4b, Parts 1–3;
 * plan SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md, Stage 4, "RULED 2026-11-13"; build prompt SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md).
 *
 *   familyAnswersCover(setting, type)   the team's switch → which events families answer (ask 1)
 *   writeFamilyAnswer(...)              the family's side of THE ONE WRITER (the parent's route calls it)
 *   readFamilyAnswers(...)              the parent's page: the account's OWN children's answers on one team, and nothing else
 *
 * ⚠ ONE ATTENDANCE RECORD (owner ruling 2026-11-13, mig 483; plan ONE_ATTENDANCE_RECORD_PLAN.md): the family's answer IS the
 *   player's attendance, the same row the coach sets, through the same database writer (`rep_attendance_write`). Latest change
 *   wins. The family never writes the coach's note or the coach's audit column. Stage 4b's separate record (mig 476) is retired.
 * ⚠ REACH IS RE-DERIVED ON EVERY WRITE from the signed-in account (`getFamilyReach`), never from a team, event or child id the
 *   client sent; a parent who left, was removed or was stopped holds no verified link and is refused, stale tab or not.
 *   (`getVerifiedLinkForUserTeam` returns the FIRST matching link, so it is never used for a per-child write.)
 * ⚠ WHAT A PARENT READS (ask 5, re-signed by ruling 4): their own child's CURRENT answer and who set it and when — "Coach" for
 *   the coach's change (never a coach's name), the other connected parent's first name, "You" — and the answer before it, whether
 *   the other parent left a note (never its words), and their own note. No teammate, never the coach's note, nobody else's words
 *   (tests/unit/family-availability.test.ts, "the payload", holds the allow-list).
 * ⚠ An INACTIVE roster entry (a player who left the team) answers nothing (owner, S2): the coach's room lists the active roster
 *   only, so an answer there would be one the coach never sees. The team page itself is the reach's (unchanged).
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
  /** The answer as it stands, whoever set it (latest wins): In · Late · Maybe · Out, or null (Not marked). */
  answer: AnswerStatus | null;
  /** The answer is this account's own (tapping it again clears it; another's is not cleared by a tap). */
  mine: boolean;
  /** Who set it and when, and the answer before (ruling 4): "Coach, today · earlier: In (You, Nov 1)". Null when unanswered. */
  setBy: AnswerSetLine | null;
  /** This account's OWN note, or null. Never another parent's words. */
  note: string | null;
  /** The other parent left a note (the sheet says so, without its words). */
  otherHasNote: boolean;
}

export interface FamilyAnswersView {
  setting: LiveFamilyAnswersSetting;
  rows: FamilyAnswerRow[];
  /** Per child: the other connected parent's first name (or the fallback words), or null when nobody else is connected. */
  otherParent: Record<string, string | null>;
}

export interface TeamRow { id: string; org_id: string; schedule_visibility: string | null; is_archived: boolean; family_answers: string | null }
/** The record's columns the family side reads: the answer, who set it and when, and the family's note. Never the coach's note. */
interface BookRow {
  event_id: string; player_id: string; status: RepAttendanceStatus;
  set_by_kind: RepAttendanceSetter | null; set_by_user_id: string | null; set_at: string | null;
  previous_status: RepAttendanceStatus | null; previous_by_kind: RepAttendanceSetter | null; previous_by_user_id: string | null;
  previous_at: string | null;
  family_note: string | null; family_note_by_user_id: string | null;
}
const FAMILY_BOOK_COLUMNS = 'event_id, player_id, status, set_by_kind, set_by_user_id, set_at, previous_status, previous_by_kind, ' +
  'previous_by_user_id, previous_at, family_note, family_note_by_user_id';

export async function readTeam(teamId: string): Promise<TeamRow | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams').select('id, org_id, schedule_visibility, is_archived, family_answers').eq('id', teamId).maybeSingle();
  if (error) throw error;
  return (data as TeamRow | null) ?? null;
}

/** The team's switch when families may answer on it at all now (tier on, not archived, schedule shared, family layer on). */
export async function liveSetting(team: TeamRow | null): Promise<LiveFamilyAnswersSetting | null> {
  if (!GUARDIAN_TIER_ENABLED || !team || team.is_archived) return null;
  const setting = normalizeFamilyAnswers(team.family_answers);
  if (setting === 'off' || !isVisibleToFamilies(team.schedule_visibility)) return null;
  if (!(await getEnabledFamilyOrg(team.org_id, team.id))) return null;
  return setting;
}

/**
 * A parent's first name by account id, from the auth admin API (one HTTP call each). One attendance record S2 put this on the
 * coach window's AUTOSAVE (every tap's reply carries the who/when lines) and the game console's every tap, so a roster of answered
 * players meant a burst of auth calls per tap. A found name is remembered for a few minutes (a first name rarely changes, and a
 * stale one for that long costs nothing); a miss or an error is never remembered.
 */
const FIRST_NAME_TTL_MS = 10 * 60 * 1000;
const FIRST_NAME_CACHE_MAX = 500;
const firstNameCache = new Map<string, { name: string | null; at: number }>();

export async function firstNames(userIds: readonly string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const now = Date.now();
  await Promise.all([...new Set(userIds)].map(async id => {
    const hit = firstNameCache.get(id);
    if (hit && now - hit.at < FIRST_NAME_TTL_MS) { out.set(id, hit.name); return; }
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    const found = !error && !!data?.user;
    const name = found ? firstNameOf(data.user.user_metadata) : null;
    out.set(id, name);
    if (found) {
      if (firstNameCache.size >= FIRST_NAME_CACHE_MAX) firstNameCache.delete(firstNameCache.keys().next().value as string);
      firstNameCache.set(id, { name, at: now });
    }
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

  const [links, seasons] = await Promise.all([
    // The other connected parents of these children (joined: verified, with an account).
    supabaseAdmin.from('family_links').select('child_id, user_id')
      .in('child_id', childIds).eq('status', 'verified').not('user_id', 'is', null).neq('user_id', params.userId),
    events.length ? childSeasons(params.userId, params.teamId, events.map(e => e.id)) : Promise.resolve(null),
  ]);
  if (links.error) throw links.error;
  const linkRows = (links.data ?? []) as { child_id: string; user_id: string }[];
  // The record, by the roster entry each child holds in each event's season (the account's OWN reach, the writer's rule).
  const entryIds = seasons ? [...new Set([...seasons.child.values()].flatMap(m => [...m.values()]))] : [];
  const { data: bookData, error: bookError } = events.length && entryIds.length
    ? await supabaseAdmin.from('rep_team_event_attendance').select(FAMILY_BOOK_COLUMNS)
      .in('event_id', events.map(e => e.id)).in('player_id', entryIds)
    : { data: [], error: null };
  if (bookError) throw bookError;
  const byKey = new Map(((bookData ?? []) as BookRow[]).map(b => [`${b.event_id}|${b.player_id}`, b]));

  // Only a parent STILL connected to the child is named: a parent who left, was removed or stopped reads as "the other parent"
  // (their answer stays, ask 15; the sheet's hint no longer names them as connected). The coach's side keeps the name.
  const names = await firstNames(linkRows.map(l => l.user_id));
  const connected = new Set(linkRows.map(l => `${l.child_id}|${l.user_id}`));
  const nameOf = (userId: string, childId: string) => (connected.has(`${childId}|${userId}`) ? names.get(userId) ?? null : null);

  const otherParent: Record<string, string | null> = {};
  for (const c of params.children) {
    const other = linkRows.find(l => l.child_id === c.childId);
    otherParent[c.childId] = other ? (names.get(other.user_id) ?? FAMILY_AVAILABILITY_WORDS.otherParentFallback) : null;
  }

  const rows: FamilyAnswerRow[] = [];
  for (const e of events) {
    for (const c of params.children) {
      // Only an event of the season this child is rostered in (a team with two seasons open never offers a pill the writer
      // would refuse; Session 1 review, item d).
      const entryId = seasons?.child.get(c.childId)?.get(seasons.event.get(e.id) ?? '');
      if (!entryId) continue;
      rows.push({
        ...rowOf(e.id, c.childId, byKey.get(`${e.id}|${entryId}`) ?? null, familyAnswerState(setting, e, now) === 'open', params.userId, nameOf, now),
        child: c.firstName,
      });
    }
  }
  return { setting, rows, otherParent };
}

/** Each event's season, and per child of this account rostered on this team, its roster entry in each season (through the
 *  account's OWN reach, the writer's rule), so the page offers a pill only where the writer would take the answer and reads the
 *  record by the entry the writer writes. */
async function childSeasons(userId: string, teamId: string, eventIds: readonly string[]): Promise<{
  event: Map<string, string>; child: Map<string, Map<string, string>>;
}> {
  const reach = await getFamilyReach(userId);
  const entries = reach.flatMap(r => r.teams.filter(t => t.kind === 'rep' && t.teamId === teamId).map(t => ({ childId: r.link.childId, entryId: t.entryId })));
  const [events, roster] = await Promise.all([
    supabaseAdmin.from('rep_team_events').select('id, program_year_id').in('id', [...eventIds]),
    entries.length
      // Active entries only: an inactive one (the player left the team) answers nothing (owner, S2).
      ? supabaseAdmin.from('rep_roster_players').select('id, program_year_id').in('id', entries.map(e => e.entryId)).eq('status', 'active')
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (events.error) throw events.error;
  if (roster.error) throw roster.error;
  const seasonOfEntry = new Map(((roster.data ?? []) as { id: string; program_year_id: string }[]).map(r => [r.id, r.program_year_id]));
  const child = new Map<string, Map<string, string>>();
  for (const e of entries) {
    const season = seasonOfEntry.get(e.entryId);
    if (!season) continue;
    if (!child.has(e.childId)) child.set(e.childId, new Map());
    child.get(e.childId)!.set(season, e.entryId);
  }
  return {
    event: new Map(((events.data ?? []) as { id: string; program_year_id: string }[]).map(e => [e.id, e.program_year_id])),
    child,
  };
}

/** A row without the child's name: the page adds it; a save's response never carries it (the sheet already holds it). */
export type FamilyAnswerFields = Omit<FamilyAnswerRow, 'child'>;

const noName = () => null;

/** Who set one answer, as THIS parent reads it: "You", the other parent's first name (still connected; else null and the words say
 *  "the other parent"), or "Coach" for anyone on the coach's side (a coach is never named to a family). */
function whoFor(
  kind: RepAttendanceSetter | null, by: string | null, at: string, userId: string, childId: string,
  nameOf: (userId: string, childId: string) => string | null, now: Date,
): AnswerWho {
  const day = answeredDayShort(at, now);
  if (kind === 'family') return by === userId ? { by: 'you', name: null, day } : { by: 'family', name: by ? nameOf(by, childId) : null, day };
  return { by: 'coach', name: null, day };
}

function rowOf(
  eventId: string, childId: string, b: BookRow | null, open: boolean,
  userId: string, nameOf: (userId: string, childId: string) => string | null, now: Date,
): FamilyAnswerFields {
  const answer = answerOfStatus(b?.status);
  const mine = !!b && !!answer && b.set_by_kind === 'family' && b.set_by_user_id === userId;
  const noteMine = !!b?.family_note && b.family_note_by_user_id === userId;
  const previous = answerOfStatus(b?.previous_status);
  return {
    eventId,
    childId,
    open,
    answer,
    mine,
    // Ruling 4: the coach's change shows on the parent's OWN child, with who and when (never the coach's note or name).
    setBy: answer && b!.set_at ? {
      ...whoFor(b!.set_by_kind, b!.set_by_user_id, b!.set_at, userId, childId, nameOf, now),
      previous: previous && b!.previous_at
        ? { ...whoFor(b!.previous_by_kind, b!.previous_by_user_id, b!.previous_at, userId, childId, nameOf, now), status: previous }
        : null,
    } : null,
    note: noteMine ? b!.family_note : null,
    otherHasNote: !!b?.family_note && !noteMine,
  };
}

/** Does any of these accounts hold a family answer (or a family note) on any of these children? The Leave and Stop confirms say
 *  what happens to them only then (Stage 4b /legal closeout). False while the tier is off, and for empty input. */
export async function answeredByAccounts(userIds: readonly string[], childIds: readonly string[]): Promise<boolean> {
  if (!GUARDIAN_TIER_ENABLED || userIds.length === 0 || childIds.length === 0) return false;
  const { data: entries, error: entryError } = await supabaseAdmin.from('rep_roster_players').select('id').in('child_id', [...childIds]);
  if (entryError) throw entryError;
  const players = ((entries ?? []) as { id: string }[]).map(e => e.id);
  if (players.length === 0) return false;
  const users = [...userIds];
  const [set, noted] = await Promise.all([
    supabaseAdmin.from('rep_team_event_attendance').select('id', { count: 'exact', head: true })
      .in('player_id', players).eq('set_by_kind', 'family').in('set_by_user_id', users),
    supabaseAdmin.from('rep_team_event_attendance').select('id', { count: 'exact', head: true })
      .in('player_id', players).in('family_note_by_user_id', users),
  ]);
  if (set.error) throw set.error;
  if (noted.error) throw noted.error;
  return (set.count ?? 0) + (noted.count ?? 0) > 0;
}

// ── The one writer ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What a save changed, for the coach's bell (Part 8). Server-only: the route never sends it to the browser. */
export interface FamilyAnswerChange { prior: AnswerStatus | null; next: AnswerStatus | null; hasNote: boolean; startsAt: string }

export type FamilyAnswerWrite =
  | { ok: true; row: FamilyAnswerFields; change: FamilyAnswerChange }
  /** not_found: nothing this account may answer here (no reach, wrong team, the switch doesn't cover it, the tier is off).
   *  closed: the event started or was cancelled. bad_note: longer than 200 characters, or not text. */
  | { ok: false; code: 'not_found' | 'closed' | 'bad_note' };

interface EventRow { id: string; team_id: string; program_year_id: string; event_type: string; status: string; starts_at: string }

/**
 * Save (or clear, `answer: null`) one child's answer on one event, through THE ONE WRITER (mig 483's `rep_attendance_write`,
 * kind 'family'). Every gate is checked here, on the server, from the signed-in account: the tier; a VERIFIED link of this account
 * to THIS child; the child live on THIS rep team (the reach) in the season the event belongs to; the event on this team; the
 * switch covers its kind; the schedule shared with families; the club's family layer on; not cancelled; not started. The database
 * refuses a family write after the start on its own too (ruling 2), so no door can get round the lock.
 *
 * Latest wins: the answer replaces whatever is there (a coach's included), and the one before it is kept as "earlier" only when it
 * changed. A family write replaces the family's note when it carries one (a second parent's change clears the first's, ask 6; an
 * "agree" that sends no note leaves it); a clear only takes away a FAMILY's answer, never a coach's. It never writes
 * the coach's note or the coach's audit column. Reach is to THIS team's roster entry, so a call-up (no family link) stays the
 * coach's alone.
 */
export async function writeFamilyAnswer(params: {
  userId: string; teamId: string; eventId: string; childId: string; answer: AnswerStatus | null; note?: unknown; now?: Date;
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

  // The team's gate runs ALONGSIDE the event and entry reads (its org must be the link's; Stage 4b /simplify).
  const [setting, event, entry] = await Promise.all([
    readTeam(params.teamId).then(team => (team && team.org_id === hold.link.orgId ? liveSetting(team) : null)),
    supabaseAdmin.from('rep_team_events').select('id, team_id, program_year_id, event_type, status, starts_at')
      .eq('id', params.eventId).maybeSingle(),
    supabaseAdmin.from('rep_roster_players').select('program_year_id, status').eq('id', reached.entryId).maybeSingle(),
  ]);
  if (event.error) throw event.error;
  if (entry.error) throw entry.error;
  const ev = event.data as EventRow | null;
  const held = entry.data as { program_year_id: string; status: string } | null;
  const season = held?.program_year_id ?? null;
  // The event must be this team's, in the season the child is live on (never an old season's, never another team's), and the
  // entry ACTIVE: a player who left the team (inactive) is not in the coach's room, so their family answers nothing (owner, S2).
  if (!ev || ev.team_id !== params.teamId || !season || ev.program_year_id !== season || held?.status !== 'active') {
    return { ok: false, code: 'not_found' };
  }
  if (!setting) return { ok: false, code: 'not_found' };
  const state = familyAnswerState(setting, { eventType: ev.event_type, status: ev.status, startsAt: ev.starts_at }, now);
  if (state === 'not_covered') return { ok: false, code: 'not_found' };
  if (state !== 'open') return { ok: false, code: 'closed' };

  const { data, error } = await supabaseAdmin.rpc('rep_attendance_write', {
    p_event: ev.id,
    p_player: reached.entryId,
    p_kind: 'family',
    p_by: params.userId,
    // The answer IS the status (null clears it to Not marked); the family page picks Late itself (ruling 1).
    p_status: params.answer ?? 'unknown',
    p_family_note: params.answer === null ? null : cleaned.note,
    // A clear always blanks the note; an answer writes the note only when the request carries one (a bare "agree" with another
    // parent's answer leaves their note alone).
    p_set_family_note: params.answer === null || params.note !== undefined,
    // A family CLEAR takes away a family's answer only: a coach's answer set since this page loaded (it never re-reads) stays.
    p_only_if_set_by: params.answer === null ? 'family' : null,
  });
  // The start passed between the gate above and the write: the database's own lock refused it.
  if (error?.message?.includes('attendance_closed')) return { ok: false, code: 'closed' };
  if (error) throw error;
  const result = data as { row: BookRow; prior: RepAttendanceStatus | null } | null;
  if (!result?.row) throw new Error('The answer could not be saved.');
  return {
    ok: true,
    row: rowOf(ev.id, params.childId, result.row, true, params.userId, noName, now),
    change: {
      prior: answerOfStatus(result.prior),
      // What the record holds now (a refused clear leaves the coach's answer, and the bell must not call that a clear).
      next: answerOfStatus(result.row.status),
      hasNote: params.answer !== null && !!cleaned.note,
      startsAt: ev.starts_at,
    },
  };
}
