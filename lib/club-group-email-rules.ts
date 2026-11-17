/**
 * CLUB COMMUNICATIONS — THE RULES (Stage 1, Session 1). Pure and table-testable: who a seat may email, which groups it is
 * offered, how a group is chosen from the live people, what the recount compares, who may read a sent email and what a
 * record shows each reader. The routes and the reader call ONLY these, so a hidden button never decides anything.
 *
 * Spec: docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md §2c (the route table and "what each seat may read") + addendum
 * 2026-11-17; coach drawing asks 1, 2, 4, 8, 11; board asks 15–17. Plan: docs/projects/active/CLUB_COMMUNICATIONS_PLAN.md.
 */
import { LINES, NAMELESS, RECORD, SAY, BOARD_SEATS, type BoardSeat, type ColleagueBasis, type ColleagueKind, type ReplyMode } from './club-group-email-words';
import { usableContactEmail } from './email-club-identity';
import type { OrgRole } from './types';

// ── The seat ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SeatFacts {
  role: OrgRole;
  /** module_communications for this person (the switch, ruling 11 / ask 5). */
  switchOn: boolean;
  /** A member limited to some rep team groups (refused in Stage 1, as Families refuses them). */
  teamLimited: boolean;
  /** The plan carries nothing beyond tournaments: no club portal, so no place. */
  tournamentOnly: boolean;
  planRep: boolean;
  planLeague: boolean;
  /** The person may open House league (a league seat reaches house-league coaches only when it runs the house league). */
  leagueModule: boolean;
}

export interface Seat {
  role: OrgRole;
  /** Which coach groups this seat may send to, or null for none. */
  coaches: { rep: boolean; league: boolean } | null;
  /** May email the board (every board seat, ask 16). Whether anyone ELSE is on the board is the audience's question. */
  board: boolean;
  /** Has any group at all: reads the place's rows (each still filtered by `canReadSend`). */
  any: boolean;
}

const LEAGUE_SEATS: readonly OrgRole[] = ['league_admin', 'league_registrar'];
export const isBoardSeat = (role: string): role is BoardSeat => (BOARD_SEATS as readonly string[]).includes(role);

/** Coach ask 1 + board ask 16 + legal §2c's common refusals (switch, limited, plan). */
export function seatOf(f: SeatFacts): Seat {
  const none: Seat = { role: f.role, coaches: null, board: false, any: false };
  if (!f.switchOn || f.teamLimited || f.tournamentOnly) return none;
  let coaches: Seat['coaches'] = null;
  if (f.role === 'owner' || f.role === 'admin') coaches = { rep: f.planRep, league: f.planLeague };
  else if (LEAGUE_SEATS.includes(f.role)) coaches = { rep: false, league: f.planLeague && f.leagueModule };
  if (coaches && !coaches.rep && !coaches.league) coaches = null;
  const board = isBoardSeat(f.role);
  return { role: f.role, coaches, board, any: !!coaches || board };
}

// ── Groups ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type CoachGroup =
  | { kind: 'coaches'; group: 'coaches_all' }
  | { kind: 'coaches'; group: 'rep_staff' }
  | { kind: 'coaches'; group: 'rep_head' }
  | { kind: 'coaches'; group: 'league_season'; seasonId: string }
  | { kind: 'coaches'; group: 'league_division'; seasonId: string; divisionId: string }
  | { kind: 'coaches'; group: 'coaches_picked'; keys: string[] };
export type BoardGroup = { kind: 'board'; group: 'board_all' } | { kind: 'board'; group: 'board_picked'; keys: string[] };
export type ColleagueGroup = CoachGroup | BoardGroup;
export type GroupKind = ColleagueGroup['group'];

/** May this seat send to this kind of group at all? (The audience then checks the group's own parameters.) */
export function groupOffered(seat: Seat, group: GroupKind): boolean {
  const c = seat.coaches;
  switch (group) {
    case 'coaches_all': return !!c && c.rep && c.league; // drawn only when two or more groups are
    case 'rep_staff': case 'rep_head': return !!c && c.rep;
    case 'league_season': case 'league_division': return !!c && c.league;
    case 'coaches_picked': return !!c;
    case 'board_all': case 'board_picked': return seat.board;
  }
}

/** The fields only a family send carries: a request holding any of them is not colleague mail (legal §2a.1, T7). */
const FAMILY_ONLY_FIELDS = ['teamIds', 'list', 'personId', 'personIds', 'divisionIds', 'statuses', 'copyCoaches', 'families'];
const FAMILY_KINDS = ['every', 'teams', 'season', 'list', 'season_divisions', 'season_teams', 'season_statuses', 'season_families'];
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const isKey = (v: unknown): v is string => typeof v === 'string' && /^[uc]:[0-9a-f-]{36}$/i.test(v);

/** Does a FAMILY send's body also name a colleague audience? Then the family route refuses it (T7). */
export function namesColleagueAudience(body: Record<string, unknown>): boolean {
  return body.kind === 'coaches' || body.kind === 'board' || body.group !== undefined || body.keys !== undefined;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; status: number; code: string; error: string };
const no = (status: number, code: string, error: string): { ok: false; status: number; code: string; error: string } => ({ ok: false, status, code, error });

/** A colleague request's group, from its body — never trusted beyond its shape; the seat and the audience decide the rest. */
export function parseColleagueGroup(body: Record<string, unknown>): Parsed<ColleagueGroup> {
  if (FAMILY_KINDS.includes(String(body.kind)) || FAMILY_ONLY_FIELDS.some(f => body[f] !== undefined)) return no(400, 'both_paths', SAY.bothPaths);
  const keys = Array.isArray(body.keys) ? body.keys : null;
  if (body.kind === 'board') {
    if (body.group === 'board_all') return { ok: true, value: { kind: 'board', group: 'board_all' } };
    if (body.group === 'board_picked') {
      if (!keys || !keys.every(isKey) || keys.length === 0) return no(400, 'pick_required', SAY.pickMembers);
      return { ok: true, value: { kind: 'board', group: 'board_picked', keys: [...new Set(keys as string[])] } };
    }
    return no(400, 'group', SAY.failed);
  }
  if (body.kind !== 'coaches') return no(400, 'kind', SAY.failed);
  switch (body.group) {
    case 'coaches_all': case 'rep_staff': case 'rep_head':
      return { ok: true, value: { kind: 'coaches', group: body.group } };
    case 'league_season':
      return isId(body.seasonId) ? { ok: true, value: { kind: 'coaches', group: 'league_season', seasonId: body.seasonId } } : no(400, 'season_required', SAY.pickSeason);
    case 'league_division':
      return isId(body.seasonId) && isId(body.divisionId)
        ? { ok: true, value: { kind: 'coaches', group: 'league_division', seasonId: body.seasonId, divisionId: body.divisionId } }
        : no(400, 'season_required', SAY.pickSeason);
    case 'coaches_picked':
      if (!keys || !keys.every(isKey) || keys.length === 0) return no(400, 'pick_required', SAY.pickCoaches);
      return { ok: true, value: { kind: 'coaches', group: 'coaches_picked', keys: [...new Set(keys as string[])] } };
  }
  return no(400, 'group', SAY.failed);
}

/** A short, stable fingerprint of a pick (the just-sent check compares groups; a pick of other people is another group). */
function pickPrint(keys: readonly string[]): string {
  let h = 5381;
  for (const ch of [...keys].sort().join(',')) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return `${keys.length}:${h.toString(36)}`;
}

/** The group with its parameters, as one string (the just-sent check's key). */
export function groupKey(g: ColleagueGroup): string {
  switch (g.group) {
    case 'league_season': return `league_season:${g.seasonId}`;
    case 'league_division': return `league_division:${g.seasonId}:${g.divisionId}`;
    case 'coaches_picked': case 'board_picked': return `${g.group}:${pickPrint(g.keys)}`;
    default: return g.group;
  }
}

// ── People ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface RepRow { userId: string; teamId: string; teamName: string; word: string; head: boolean; name: string | null; email: string | null }
export interface LeagueRow {
  leagueCoachId: string; userId: string | null; seasonId: string; seasonName: string; divisionId: string | null;
  divisionName: string | null; teamName: string; name: string | null; email: string | null;
}
export interface CoachPerson {
  /** `u:<account id>` when any source row has an account, else `c:<house-league coach row id>`. Never an address. */
  key: string;
  /** Every key the person is known by (their account, each house-league coach row): picks and the recount match on these. */
  aliases: string[];
  userId: string | null;
  leagueCoachId: string | null;
  name: string | null;
  /** INTERNAL: the send reads it; no response ever carries it (legal §2c, T17). */
  email: string | null;
  rep: RepRow[];
  league: LeagueRow[];
}

const norm = (e: string | null | undefined) => (e ?? '').trim().toLowerCase() || null;
/** A name is a name: blank, or anything holding an '@', names nobody (T17: never an address). */
export const cleanName = (n: string | null | undefined): string | null => { const t = (n ?? '').trim(); return t && !t.includes('@') ? t : null; };

/**
 * The coach union (coach asks 2, 4, 8): every rep team's active staff on a team that isn't archived, and every house-league
 * coach of a live season, each PERSON once — by account first, then by trimmed lower-cased address (/review 2026-11-17: one
 * account whose house-league row carries a different typed address is still one person). A row with no address and no
 * account is its own person (left out of every send, counted). Deterministic: the same rows give the same keys.
 */
export function unionCoaches(rep: readonly RepRow[], league: readonly LeagueRow[]): CoachPerson[] {
  const byUser = new Map<string, CoachPerson>();
  const byEmail = new Map<string, CoachPerson>();
  const all: CoachPerson[] = [];
  const into = (userId: string | null, email: string | null): CoachPerson => {
    let p = (userId ? byUser.get(userId) : undefined) ?? (email ? byEmail.get(email) : undefined);
    if (!p) { p = { key: '', aliases: [], userId: null, leagueCoachId: null, name: null, email: null, rep: [], league: [] }; all.push(p); }
    if (userId) { p.userId ??= userId; byUser.set(userId, p); }
    if (email) { p.email ??= email; if (!byEmail.has(email)) byEmail.set(email, p); }
    return p;
  };
  for (const r of rep) { const p = into(r.userId, norm(r.email)); p.rep.push(r); p.name ??= cleanName(r.name); }
  for (const l of [...league].sort((a, b) => a.leagueCoachId.localeCompare(b.leagueCoachId))) {
    const p = into(l.userId, norm(l.email)); p.league.push(l);
    p.leagueCoachId ??= l.leagueCoachId; p.name ??= cleanName(l.name);
  }
  for (const p of all) {
    p.rep.sort((a, b) => Number(b.head) - Number(a.head) || a.teamName.localeCompare(b.teamName));
    p.key = p.userId ? `u:${p.userId}` : `c:${p.leagueCoachId}`;
    // Every key this person has been or could be known by: a coach row that has since gained an account keeps its old key.
    p.aliases = [...new Set([p.key, ...(p.userId ? [`u:${p.userId}`] : []), ...p.rep.map(r => `u:${r.userId}`), ...p.league.flatMap(l => [`c:${l.leagueCoachId}`, ...(l.userId ? [`u:${l.userId}`] : [])])])];
  }
  return all.sort((a, b) => (a.name ?? '￿').localeCompare(b.name ?? '￿') || a.key.localeCompare(b.key));
}

/** The person's one line, as sent: their first rep team (head coach first), else their house-league team. */
export function coachLine(p: CoachPerson): string | null {
  const r = p.rep[0];
  if (r) return LINES.repTeam(r.teamName, r.word);
  const l = p.league[0];
  return l ? LINES.leagueTeam(l.teamName, l.divisionName) : null;
}

/** Why this coach got it, from their own role (C8): staff wins over house league; a pick is a pick. */
export function coachBasis(p: CoachPerson, group: GroupKind): ColleagueBasis {
  if (group === 'coaches_picked') return 'picked';
  return p.rep.length > 0 ? 'rep_staff' : 'house_league';
}

export interface Sender { userId: string; email: string | null }
/** The sender is never a recipient: by account, or by the address they sign in with. */
export const isSender = (p: { userId: string | null; email: string | null }, s: Sender) =>
  (!!p.userId && p.userId === s.userId) || (!!p.email && p.email === norm(s.email));

/** The people this seat may pick from: a league seat only house-league coaches (coach drawing tab 5). */
export function pickable(people: readonly CoachPerson[], seat: Seat): CoachPerson[] {
  const c = seat.coaches;
  if (!c) return [];
  return people.filter(p => (c.rep && p.rep.length > 0) || (c.league && p.league.length > 0));
}

export type Chosen<T> = { ok: true; people: T[]; noAddress: T[] } | { ok: false; status: number; code: string; error: string };

/**
 * The group, chosen from the live people (never the window's list). A group the seat was not offered, or a pick naming a
 * person the seat may not pick: refused 'not_offered', nothing chosen (T10). A season no longer under way: 'not_live'. A
 * picked person who is no longer a coach of the club is simply not chosen — the recount then names them (coach ask 11).
 */
export function chooseCoaches(people: readonly CoachPerson[], g: CoachGroup, seat: Seat, sender: Sender, liveSeasons: readonly { id: string; divisionIds: readonly string[] }[]): Chosen<CoachPerson> {
  if (!groupOffered(seat, g.group)) return no(403, 'not_offered', SAY.notOffered);
  let chosen: CoachPerson[];
  switch (g.group) {
    case 'coaches_all': chosen = people.filter(p => p.rep.length > 0 || p.league.length > 0); break;
    case 'rep_staff': chosen = people.filter(p => p.rep.length > 0); break;
    case 'rep_head': chosen = people.filter(p => p.rep.some(r => r.head)); break;
    case 'league_season': case 'league_division': {
      const season = liveSeasons.find(s => s.id === g.seasonId);
      if (!season || (g.group === 'league_division' && !season.divisionIds.includes(g.divisionId))) return no(409, 'not_live', SAY.seasonGone);
      chosen = people.filter(p => p.league.some(l => l.seasonId === g.seasonId && (g.group === 'league_season' || l.divisionId === g.divisionId)));
      break;
    }
    case 'coaches_picked': {
      const byAlias = new Map<string, CoachPerson>();
      for (const p of people) for (const a of p.aliases) if (!byAlias.has(a)) byAlias.set(a, p);
      const may = new Set(pickable(people, seat).map(p => p.key));
      const named = [...new Set(g.keys.map(k => byAlias.get(k)).filter((p): p is CoachPerson => !!p))];
      if (named.some(p => !may.has(p.key))) return no(403, 'not_offered', SAY.notOffered);
      chosen = named;
      break;
    }
  }
  chosen = chosen.filter(p => !isSender(p, sender));
  return { ok: true, people: chosen.filter(p => !!p.email), noAddress: chosen.filter(p => !p.email) };
}

export interface BoardMember { userId: string; role: BoardSeat; name: string | null; email: string | null; status: 'active' | 'invited' }

/**
 * Board ask 15: the active board seats, the sender not counted. A pick is chosen only from them: a key that is not an active
 * board seat now (left, suspended, never one) is not chosen, and the recount names who changed (T15).
 */
export function chooseBoard(members: readonly BoardMember[], g: BoardGroup, seat: Seat, sender: Sender): Chosen<BoardMember> {
  if (!groupOffered(seat, g.group)) return no(403, 'not_offered', SAY.notOffered);
  const others = members.filter(m => m.status === 'active' && m.userId !== sender.userId);
  let chosen = others;
  if (g.group === 'board_picked') {
    const may = new Map(others.map(m => [`u:${m.userId}`, m]));
    chosen = [...new Set(g.keys.map(k => may.get(k)).filter((m): m is BoardMember => !!m))];
  }
  return { ok: true, people: chosen.filter(m => !!m.email), noAddress: chosen.filter(m => !m.email) };
}

// ── The recount (coach ask 11) ───────────────────────────────────────────────────────────────────────────────────────────

export interface Seen { key: string; name?: string | null }

/**
 * Compares the PEOPLE: a swap at the same total is held; up to three changed people are named; past three, the count. A
 * person is matched by any key they are known by (`aliases`), so a coach who signed in between the two reads is not "taken
 * off and added".
 */
export function recount(expected: readonly Seen[], now: readonly { key: string; name: string | null; aliases?: readonly string[] }[], kind: ColleagueKind): { same: true } | { same: false; error: string; count: number } {
  const was = new Map(expected.map(e => [e.key, e.name ?? null]));
  const matched = new Set<string>();
  const added: { name: string | null }[] = [];
  for (const p of now) {
    const hit = [p.key, ...(p.aliases ?? [])].find(k => was.has(k) && !matched.has(k));
    if (hit) matched.add(hit); else added.push(p);
  }
  const removed = [...was].filter(([k]) => !matched.has(k)).map(([, name]) => name);
  if (added.length === 0 && removed.length === 0) return { same: true };
  const nameless = kind === 'board' ? 'A board member' : NAMELESS.coach;
  const changes = added.length + removed.length <= 3
    ? [...removed.map(n => SAY.takenOff(n ?? nameless)), ...added.map(p => SAY.added(p.name ?? nameless))].join(' and ')
    : null;
  return { same: false, error: SAY.changed(kind, now.length, was.size, changes), count: now.length };
}

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SendFacts { kind: ColleagueKind; groupKind: string; reachesRep: boolean; sentBy: string | null }

/** Coach rows a league seat reads: All coaches, any house-league group, a pick made only from house-league coaches. */
function leagueSeatReadsCoachRow(row: SendFacts): boolean {
  return row.groupKind === 'coaches_all' || row.groupKind.startsWith('league_') || (row.groupKind === 'coaches_picked' && !row.reachesRep);
}

/**
 * Who may read a sent coach or board email (legal §2c). The BOARD is its own branch, chosen by kind BEFORE any program rule
 * (C2): its sender, a recipient, the owner and the admins — nobody else, a later joiner included. Evaluated now: a reader
 * whose switch is off, or who was suspended, has no seat and reads nothing.
 */
export function canReadSend(seat: Seat, viewerId: string, row: SendFacts, isRecipient: boolean): boolean {
  if (!seat.any) return false;
  if (row.kind === 'board') return row.sentBy === viewerId || isRecipient || seat.role === 'owner' || seat.role === 'admin';
  if (seat.role === 'owner' || seat.role === 'admin') return true;
  if (LEAGUE_SEATS.includes(seat.role)) return !!seat.coaches?.league && leagueSeatReadsCoachRow(row);
  return false;
}

/** Ask 14 + the board's narrower rule: anyone who may send to that group NOW; a board email its sender, the owner, an admin. */
export function canFinish(seat: Seat, viewerId: string, row: SendFacts): boolean {
  if (row.kind === 'board') return seat.board && (row.sentBy === viewerId || seat.role === 'owner' || seat.role === 'admin');
  const c = seat.coaches;
  if (!c) return false;
  if (row.groupKind === 'coaches_all') return c.rep && c.league;
  if (row.groupKind.startsWith('rep_')) return c.rep;
  if (row.groupKind.startsWith('league_')) return c.league;
  if (row.groupKind === 'coaches_picked') return row.reachesRep ? c.rep : (c.rep || c.league);
  return false;
}

export interface StoredRecipient {
  name: string | null; line: string | null; basis: ColleagueBasis; boardRole: string | null; houseLeague: boolean;
  /** Also rep staff: a league seat sees them named (they coach in its house league) but never their rep-team line. */
  rep: boolean;
  status: 'pending' | 'sent' | 'failed';
}
export interface RecordPerson { name: string; line: string | null; status: StoredRecipient['status'] }
export interface RecordOthers { label: string; sub: string; sent: number; failed: number; pending: number }

/** The name a reader sees: as sent, or the nameless word — never an address (T17). */
export function displayName(r: Pick<StoredRecipient, 'name' | 'boardRole'>, kind: ColleagueKind): string {
  if (r.name) return r.name;
  return kind === 'board' && r.boardRole && isBoardSeat(r.boardRole) ? NAMELESS.boardMember(r.boardRole) : NAMELESS.coach;
}

/**
 * "Who it went to", shaped FOR THIS READER (names withheld in the reader, never on the screen — T13): a league seat reading a
 * coach email sees its house-league coaches named and everyone else as one counted line; owners and admins, and every reader
 * of a board email, see every name.
 */
export function shapeRecipients(seat: Seat, kind: ColleagueKind, rows: readonly StoredRecipient[]): { people: RecordPerson[]; others: RecordOthers | null } {
  const person = (r: StoredRecipient): RecordPerson => ({ name: displayName(r, kind), line: r.line, status: r.status });
  if (kind === 'coaches' && LEAGUE_SEATS.includes(seat.role)) {
    const outside = rows.filter(r => !r.houseLeague);
    return {
      // /review 2026-11-17: a coach who is ALSO rep staff was stored with their rep-team line; a league seat never reads it.
      people: rows.filter(r => r.houseLeague).map(r => ({ ...person(r), line: r.rep ? null : r.line })),
      others: outside.length === 0 ? null : {
        label: RECORD.outsideRep(outside.length),
        sub: RECORD.outsideRepSub,
        sent: outside.filter(r => r.status === 'sent').length,
        failed: outside.filter(r => r.status === 'failed').length,
        pending: outside.filter(r => r.status === 'pending').length,
      },
    };
  }
  return { people: rows.map(person), others: null };
}

/**
 * The address the email promises replies reach (R2), or the refusal: club mode needs the club's public contact, "Replies come
 * to me" needs the sender's own usable address. Never switched quietly from one to the other (legal addendum 5, T21).
 */
export function replyTarget(mode: ReplyMode, senderEmail: string | null | undefined, clubContact: string | null): { ok: true; replyTo: string } | { ok: false; status: number; code: string; error: string } {
  if (mode === 'club') return clubContact ? { ok: true, replyTo: clubContact } : no(409, 'no_club_contact', SAY.noClubContact);
  const mine = usableContactEmail(senderEmail);
  return mine ? { ok: true, replyTo: mine } : no(409, 'no_sender_address', SAY.noSenderAddress);
}

/** A board member who hasn't accepted is NAMED only to an owner or admin sender (C1); everyone else gets the count. */
export function namesPending(seat: Seat): boolean {
  return seat.role === 'owner' || seat.role === 'admin';
}
