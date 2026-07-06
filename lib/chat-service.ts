import 'server-only';

import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
import { isReactionEmoji, type MessageReactionsMap, type ReactionSummary } from './chat-reactions';
import {
  extractPoll,
  validatePollInput,
  type PollDefinition,
  type PollTalliesMap,
  type PollTally,
} from './chat-polls';
import {
  resolveTournamentChatParticipants,
  resolveTournamentsForCoach,
  isTournamentChatParticipant,
  type PendingChatCoach,
} from './chat-resolvers';

/**
 * lib/chat-service.ts — server-side service layer for Tournament Chat.
 *
 * The chat ENGINE (migration 141) grants `authenticated` only column-scoped writes; EVERYTHING that
 * creates or mutates rooms / memberships / moderation goes through the service role here. Posting and
 * mark-read are also routed server-side so we can attach notifications, rate-limits, and mute / closed
 * enforcement in code (an RLS WITH CHECK can't compare old-vs-new, so it can't police those).
 *
 * ROOM MODEL — "Division Rooms" (channels):
 *   • The default "All coaches" room has `ref_sub_id = NULL` (one per tournament, zero-config, never
 *     deletable). Its membership is every coach in the tournament.
 *   • Organizer-created division rooms each get an opaque `ref_sub_id` (a fresh uuid) and carry their
 *     covered-division set in `settings.divisionIds`. Membership = organizers + every coach whose team
 *     is in one of those divisions, AUTO-MAINTAINED as teams register (the resolver re-derives it).
 *   `roomDivisionIds(room)` is the single source of truth for a room's scope (NULL ⇒ all divisions).
 */

export const CHAT_SURFACE_TOURNAMENT = 'tournament';

/** Max mute duration the surface allows (owner decision: ≤72h). */
export const MAX_MUTE_HOURS = 72;

export class ChatError extends Error {
  code: 'room_closed' | 'not_member' | 'muted' | 'empty' | 'too_long' | 'not_found' | 'invalid' | 'forbidden';
  status: number;
  constructor(code: ChatError['code'], message: string, status: number) {
    super(message);
    this.name = 'ChatError';
    this.code = code;
    this.status = status;
  }
}

export const MAX_MESSAGE_LENGTH = 4000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatRoom = {
  id: string;
  orgId: string;
  surface: string;
  refId: string;
  refSubId: string | null;
  name: string;
  isArchived: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
};

/** A server-derived quote of the message being replied to (rebuilt from the real row — never trusted
 *  from the client — so a reply can't fake what someone said). Rides chat_messages.metadata jsonb. */
export type ReplyRef = { id: string; name: string; snippet: string };

/** A resolved @mention (server-derived name from the real member row). Rides metadata.mentions. */
export type MentionRef = { userId: string; name: string };

export type ChatMessageView = {
  id: string;
  roomId: string;
  senderUserId: string | null;
  senderName: string;
  body: string;
  deletedAt: string | null;
  sentAt: string;
  replyTo: ReplyRef | null;
  mentions: MentionRef[];
  pinnedAt: string | null;
  /** Present when this message is a poll (question = body; options + settings ride metadata). */
  poll: PollDefinition | null;
};

export type ChatMemberView = {
  userId: string;
  name: string;
  email: string | null;
  role: 'member' | 'moderator';
  status: 'active' | 'pending' | 'muted' | 'removed';
  mutedUntil: string | null;
  lastReadAt: string | null;
  joinedAt: string;
};

export type ChatRoomListItem = {
  room: ChatRoom;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  isModerator: boolean;
  /** the caller's own mute expiry, if muted (composer disable) */
  selfMutedUntil: string | null;
  readOnly: boolean;
  /** the tournament name this room belongs to — a secondary label so a coach can tell apart several
   *  rooms in one tournament (e.g. "All coaches" vs "Championship") and same-named rooms across events. */
  contextLabel: string | null;
};

type RoomRow = {
  id: string;
  org_id: string;
  surface: string;
  ref_id: string;
  ref_sub_id: string | null;
  name: string;
  is_archived: boolean;
  settings: Record<string, unknown> | null;
  created_at: string;
};

function mapRoom(row: RoomRow): ChatRoom {
  return {
    id: row.id,
    orgId: row.org_id,
    surface: row.surface,
    refId: row.ref_id,
    refSubId: row.ref_sub_id,
    name: row.name,
    isArchived: row.is_archived,
    settings: row.settings ?? {},
    createdAt: row.created_at,
  };
}

const ROOM_COLS = 'id, org_id, surface, ref_id, ref_sub_id, name, is_archived, settings, created_at';

/** Max length for an organizer-chosen division-room name. */
export const MAX_ROOM_NAME_LENGTH = 80;

/**
 * The division set a tournament room covers — the single source of truth for a room's scope:
 *   • the "All coaches" room (`ref_sub_id === null`) → `null` (ALL divisions).
 *   • a division room → its `settings.divisionIds` (an empty/garbage set → `[]`, i.e. nobody; a
 *     mis-scoped sub-room never silently widens to "all").
 */
export function roomDivisionIds(room: ChatRoom): string[] | null {
  if (room.refSubId == null) return null;
  const raw = (room.settings as Record<string, unknown> | null)?.divisionIds;
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
}

// ── Display-name hydration ──────────────────────────────────────────────────

/**
 * Turn an email local-part into a readable name fallback, e.g. "john.doe.coach" → "John Doe Coach",
 * "jsmith42" → "Jsmith". Splits on separators + digit runs, title-cases, caps at 40 chars. Returns ""
 * when nothing usable remains (so the caller falls through to "Coach"). Display formatting only.
 */
function prettifyEmailLocalPart(email: string): string {
  const local = email.split('@')[0] ?? '';
  const words = local
    .split(/[._\-+]+|\d+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.join(' ').slice(0, 40).trim();
}

/** Best-available display name for a set of user_ids (auth metadata → tidied email local-part → "Coach"). */
export async function hydrateUserDisplay(
  userIds: string[],
): Promise<Map<string, { name: string; email: string | null }>> {
  const map = new Map<string, { name: string; email: string | null }>();
  const unique = [...new Set(userIds.filter(Boolean))];
  // Parallel — the auth-admin lookups are independent; sequential was O(members) round-trips.
  await Promise.all(unique.map(async (userId) => {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
      const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const email = data?.user?.email ?? null;
      const name =
        (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta.name === 'string' && meta.name.trim()) ||
        (email ? prettifyEmailLocalPart(email) : '') ||
        'Coach';
      map.set(userId, { name, email });
    } catch {
      map.set(userId, { name: 'Coach', email: null });
    }
  }));
  return map;
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

/** The default "All coaches" room for a tournament (ref_sub_id IS NULL), or null. */
export async function getTournamentChatRoom(tournamentId: string): Promise<ChatRoom | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_rooms')
    .select(ROOM_COLS)
    .eq('surface', CHAT_SURFACE_TOURNAMENT)
    .eq('ref_id', tournamentId)
    .is('ref_sub_id', null)
    // Deterministic + duplicate-tolerant: if a TOCTOU race ever created two rooms, always resolve
    // the oldest (limit(1) keeps maybeSingle from throwing on >1 row); the second is orphaned/empty.
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<RoomRow>();
  if (error) throw error;
  return data ? mapRoom(data) : null;
}

export async function getRoomById(roomId: string): Promise<ChatRoom | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_rooms')
    .select(ROOM_COLS)
    .eq('id', roomId)
    .maybeSingle<RoomRow>();
  if (error) throw error;
  return data ? mapRoom(data) : null;
}

/** Create the tournament room if it does not exist yet (idempotent). */
export async function ensureTournamentChatRoom(params: {
  tournamentId: string;
  createdByUserId: string;
}): Promise<ChatRoom> {
  const existing = await getTournamentChatRoom(params.tournamentId);
  if (existing) return existing;

  const { data: tournament, error: tErr } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, org_id')
    .eq('id', params.tournamentId)
    .maybeSingle<{ id: string; name: string; org_id: string }>();
  if (tErr) throw tErr;
  if (!tournament) throw new ChatError('not_found', 'Tournament not found.', 404);

  const name = tournament.name ? `${tournament.name} — Coaches` : 'Tournament Coaches';
  const { data, error } = await supabaseAdmin
    .from('chat_rooms')
    .insert({
      org_id: tournament.org_id,
      surface: CHAT_SURFACE_TOURNAMENT,
      ref_id: params.tournamentId,
      name,
      created_by_user_id: params.createdByUserId,
    })
    .select(ROOM_COLS)
    .single<RoomRow>();
  // A concurrent create may have won the race (no unique constraint on surface+ref_id) — re-fetch.
  if (error) {
    const raced = await getTournamentChatRoom(params.tournamentId);
    if (raced) return raced;
    throw error;
  }
  return mapRoom(data);
}

/**
 * Every chat room for a tournament — the "All coaches" room (ref_sub_id NULL) FIRST, then the
 * organizer-created division rooms oldest-first. Read-only; does not create the default room.
 */
export async function listTournamentChatRooms(tournamentId: string): Promise<ChatRoom[]> {
  const { data, error } = await supabaseAdmin
    .from('chat_rooms')
    .select(ROOM_COLS)
    .eq('surface', CHAT_SURFACE_TOURNAMENT)
    .eq('ref_id', tournamentId);
  if (error) throw error;
  const rooms = (data ?? []).map((r) => mapRoom(r as RoomRow));
  rooms.sort((a, b) => {
    // All-coaches (ref_sub_id NULL) always first; the rest by creation order.
    if ((a.refSubId == null) !== (b.refSubId == null)) return a.refSubId == null ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
  return rooms;
}

/** Fetch a room and confirm it belongs to this tournament (surface=tournament, ref_id=tournamentId). */
export async function getTournamentRoomById(tournamentId: string, roomId: string): Promise<ChatRoom | null> {
  const room = await getRoomById(roomId);
  if (!room || room.surface !== CHAT_SURFACE_TOURNAMENT || room.refId !== tournamentId) return null;
  return room;
}

/**
 * Create an organizer-composed division room (a fresh opaque `ref_sub_id` + `settings.divisionIds`),
 * then sync its membership. Validates the name and that the chosen divisions belong to the tournament.
 * The mig-149 partial-unique guard keys on (surface, ref_id, ref_sub_id), and ref_sub_id is a fresh
 * uuid, so two division rooms never collide (even with identical division sets or names).
 */
export async function createTournamentDivisionRoom(params: {
  tournamentId: string;
  name: string;
  divisionIds: string[];
  createdByUserId: string;
}): Promise<ChatRoom> {
  const name = params.name.trim();
  if (!name) throw new ChatError('invalid', 'Room name is required.', 400);
  if (name.length > MAX_ROOM_NAME_LENGTH) {
    throw new ChatError('invalid', `Room name is too long (max ${MAX_ROOM_NAME_LENGTH} characters).`, 400);
  }
  const requested = [...new Set(params.divisionIds.filter(Boolean))];
  if (requested.length === 0) throw new ChatError('invalid', 'Pick at least one division.', 400);

  const { data: tournament, error: tErr } = await supabaseAdmin
    .from('tournaments')
    .select('id, org_id')
    .eq('id', params.tournamentId)
    .maybeSingle<{ id: string; org_id: string }>();
  if (tErr) throw tErr;
  if (!tournament) throw new ChatError('not_found', 'Tournament not found.', 404);

  // Only divisions that actually belong to this tournament (anti-tamper).
  const { data: divRows, error: dErr } = await supabaseAdmin
    .from('divisions')
    .select('id')
    .eq('tournament_id', params.tournamentId)
    .in('id', requested);
  if (dErr) throw dErr;
  const divisionIds = (divRows ?? []).map((r) => r.id as string);
  if (divisionIds.length === 0) {
    throw new ChatError('invalid', 'None of the selected divisions belong to this tournament.', 400);
  }

  const { data, error } = await supabaseAdmin
    .from('chat_rooms')
    .insert({
      org_id: tournament.org_id,
      surface: CHAT_SURFACE_TOURNAMENT,
      ref_id: params.tournamentId,
      ref_sub_id: randomUUID(),
      name,
      settings: { divisionIds },
      created_by_user_id: params.createdByUserId,
    })
    .select(ROOM_COLS)
    .single<RoomRow>();
  if (error) throw error;

  const room = mapRoom(data);
  await syncTournamentChatRoom({ room });
  return room;
}

/** Rename a room (organizer). Trims + length-checks; works on any room. */
export async function renameChatRoom(roomId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new ChatError('invalid', 'Room name is required.', 400);
  if (trimmed.length > MAX_ROOM_NAME_LENGTH) {
    throw new ChatError('invalid', `Room name is too long (max ${MAX_ROOM_NAME_LENGTH} characters).`, 400);
  }
  const { error } = await supabaseAdmin.from('chat_rooms').update({ name: trimmed }).eq('id', roomId);
  if (error) throw error;
}

/**
 * Delete a division room. PROTECTED two ways:
 *   • the default "All coaches" room (ref_sub_id NULL) can never be deleted (there is always a home room);
 *   • a room with ANY messages can never be deleted — only closed — so conversation history is never
 *     destroyed. Delete is therefore a cleanup tool for a mis-created (empty) room only.
 * (Membership + reactions/votes cascade on room_id FK; an empty room has none of consequence.)
 */
export async function deleteTournamentChatRoom(room: ChatRoom): Promise<void> {
  if (room.refSubId == null) {
    throw new ChatError('forbidden', 'The All coaches room can be closed but not deleted.', 403);
  }
  const { count, error: countErr } = await supabaseAdmin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id);
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) {
    throw new ChatError('forbidden', 'A room with messages can be closed but not deleted.', 403);
  }
  const { error } = await supabaseAdmin.from('chat_rooms').delete().eq('id', room.id);
  if (error) throw error;
}

// ── Membership ──────────────────────────────────────────────────────────────

type MemberRow = {
  user_id: string;
  member_role: 'member' | 'moderator';
  status: 'active' | 'pending' | 'muted' | 'removed';
  muted_until: string | null;
  last_read_at: string | null;
  joined_at: string;
};

const MEMBER_COLS = 'user_id, member_role, status, muted_until, last_read_at, joined_at';

export async function getMembership(roomId: string, userId: string): Promise<MemberRow | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_room_members')
    .select(MEMBER_COLS)
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle<MemberRow>();
  if (error) throw error;
  return data ?? null;
}

/** Active member user_ids (notification recipients / live-stream audience). Includes moderators. */
export async function getActiveMemberUserIds(roomId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []).map(r => r.user_id as string);
}

/** Org owners + admins, who become moderators of the room. */
async function getHostModeratorUserIds(orgId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin']);
  if (error) throw error;
  return [...new Set((data ?? []).map(r => r.user_id as string).filter(Boolean))];
}

/**
 * Reconcile chat_room_members against the resolved participant set. Idempotent + safe to re-run:
 *   • Org owners/admins are ensured as active MODERATORS.
 *   • Resolved coaches are ensured as active members — but a member an admin previously REMOVED or
 *     whose row is otherwise non-active is LEFT ALONE (sync must never silently undo moderation).
 *   • Nobody is pruned (a coach who later withdraws keeps read access — low-risk; revisit later).
 * Returns the active count + the "Not yet joined" pending teams.
 */
export async function syncTournamentChatRoom(params: {
  room: ChatRoom;
}): Promise<{ activeCount: number; pending: PendingChatCoach[] }> {
  const { room } = params;
  // Scope is derived from the room itself: NULL ref_sub_id ⇒ all coaches; a division room ⇒ only the
  // coaches in its covered divisions. The "Not yet joined" list is scoped the same way.
  const { userIds: coachIds, pending } = await resolveTournamentChatParticipants(
    room.refId,
    roomDivisionIds(room),
  );
  const moderatorIds = await getHostModeratorUserIds(room.orgId);

  const { data: existingRows, error: exErr } = await supabaseAdmin
    .from('chat_room_members')
    .select('user_id, member_role, status')
    .eq('room_id', room.id);
  if (exErr) throw exErr;
  const existing = new Map(
    (existingRows ?? []).map(r => [r.user_id as string, { role: r.member_role as string, status: r.status as string }]),
  );

  const toInsert: Array<{ room_id: string; user_id: string; member_role: string; status: string }> = [];

  // Moderators (org owners/admins): always active moderators.
  for (const userId of moderatorIds) {
    const cur = existing.get(userId);
    if (!cur) {
      toInsert.push({ room_id: room.id, user_id: userId, member_role: 'moderator', status: 'active' });
    } else if (cur.role !== 'moderator' || cur.status !== 'active') {
      // Re-assert active moderator AND clear any stale mute (an organizer is never post-restricted).
      await supabaseAdmin
        .from('chat_room_members')
        .update({ member_role: 'moderator', status: 'active', muted_until: null })
        .eq('room_id', room.id)
        .eq('user_id', userId);
    }
  }

  // Coaches: insert missing as active members; never touch an existing (possibly-moderated) row.
  const moderatorSet = new Set(moderatorIds);

  // Demote stale organizers: a 'moderator' row whose user is no longer an active org owner/admin
  // is an ex-admin (there is no coach→moderator promotion path). If they still resolve as a coach,
  // drop them to 'member'; otherwise leave the row alone (admin may have removed them deliberately).
  const coachSet = new Set(coachIds);
  for (const [userId, cur] of existing) {
    if (cur.role === 'moderator' && !moderatorSet.has(userId) && coachSet.has(userId)) {
      await supabaseAdmin
        .from('chat_room_members')
        .update({ member_role: 'member' })
        .eq('room_id', room.id)
        .eq('user_id', userId);
    }
  }

  for (const userId of coachIds) {
    if (moderatorSet.has(userId)) continue; // already handled as a moderator
    if (!existing.has(userId)) {
      toInsert.push({ room_id: room.id, user_id: userId, member_role: 'member', status: 'active' });
    }
  }

  if (toInsert.length > 0) {
    // Ignore unique-violation races (a concurrent sync inserted the same row).
    const { error: insErr } = await supabaseAdmin.from('chat_room_members').insert(toInsert);
    if (insErr && (insErr as { code?: string }).code !== '23505') throw insErr;
  }

  const activeCount = await getActiveMemberUserIds(room.id).then(ids => ids.length);
  return { activeCount, pending };
}

/** Insert an active member row if absent; respect a removed/existing row. NO participation check. */
async function ensureMembershipRow(roomId: string, userId: string): Promise<'present' | 'removed' | 'inserted'> {
  const membership = await getMembership(roomId, userId);
  if (membership) return membership.status === 'removed' ? 'removed' : 'present';
  const { error } = await supabaseAdmin
    .from('chat_room_members')
    .insert({ room_id: roomId, user_id: userId, member_role: 'member', status: 'active' });
  if (error && (error as { code?: string }).code !== '23505') throw error;
  return 'inserted';
}

/**
 * Self-heal a coach into EVERY tournament room they belong to: the "All coaches" room + each division
 * room whose covered divisions include the coach's team(s). Self-guarding PER ROOM — division rooms are
 * gated by the scoped resolver (the coach must resolve as a participant within that room's divisions),
 * so a wrong insert can't leak a room the coach isn't in (membership is the sole access key). Never
 * revives an admin-removed row. `participationConfirmed` skips the All-coaches participation re-check
 * when the caller already established it (the listRoomsForUser hot path). Returns the tournament's rooms.
 *
 * NOTE: a division room currently costs one scoped resolver call here. Rooms-per-tournament is small
 * and this only runs when a coach opens their chat list; resolving the coach's divisions once is a
 * future optimization if room counts ever grow.
 */
async function healCoachTournamentMemberships(
  userId: string,
  tournamentId: string,
  opts: { participationConfirmed: boolean },
): Promise<ChatRoom[]> {
  const rooms = await listTournamentChatRooms(tournamentId);
  let tournamentParticipant: boolean | null = opts.participationConfirmed ? true : null;
  await Promise.all(
    rooms.map(async (room) => {
      const divisionIds = roomDivisionIds(room);
      if (divisionIds === null) {
        // All-coaches room — gated on tournament participation (only one such room, so the lazy check runs once).
        if (tournamentParticipant === null) {
          tournamentParticipant = await isTournamentChatParticipant(userId, tournamentId);
        }
        if (tournamentParticipant) await ensureMembershipRow(room.id, userId);
      } else {
        const { userIds } = await resolveTournamentChatParticipants(tournamentId, divisionIds);
        if (userIds.includes(userId)) await ensureMembershipRow(room.id, userId);
      }
    }),
  );
  return rooms;
}

/**
 * Self-heal one coach's memberships across all of a tournament's rooms (see
 * healCoachTournamentMemberships). Returns the "All coaches" room when the coach has (non-removed)
 * access to it, else null — preserving this helper's original contract for any caller.
 */
export async function ensureCoachMembership(userId: string, tournamentId: string): Promise<ChatRoom | null> {
  const rooms = await healCoachTournamentMemberships(userId, tournamentId, { participationConfirmed: false });
  const allRoom = rooms.find((r) => r.refSubId == null) ?? null;
  if (!allRoom) return null;
  const membership = await getMembership(allRoom.id, userId);
  return membership && membership.status !== 'removed' ? allRoom : null;
}

/**
 * Assistant Coaches Phase 4 — the INVERSE of healCoachTournamentMemberships. After a coach loses a
 * team assignment (removed from a team's staff), drop them from any TOURNAMENT chat room they no longer
 * belong to — `syncTournamentChatRoom` only ADDS coaches, it never removes a stale one, so without this
 * a removed coach lingers and can still read the room until the next sync.
 *
 * Safe by construction:
 *  - only the coach's own `member` seats (org-admin `moderator` seats are role-based → left alone);
 *  - any non-`removed` status (a `muted`/`pending` seat still yields a room-list entry → clean it too);
 *  - revoke a seat ONLY when the coach no longer participates in that TOURNAMENT, resolved once against
 *    ALL their remaining teams/claims — so a coach still on ANOTHER team in the same tournament keeps
 *    their access. Tournament-level (not per-division) so it never over-revokes a division seat while
 *    tournament participation persists.
 *
 * Limitation (accepted): `resolveTournamentsForCoach` is fail-open — a transient sub-query error
 * silently under-reports participation, so during a DB-degraded window this could revoke a coach who is
 * in fact still a participant via the failed source. Rare + recoverable (re-invite / admin re-add); the
 * whole call is best-effort. Call AFTER the coach row is deleted. Returns how many seats were revoked.
 */
export async function revokeStaleChatMembershipsForCoach(userId: string): Promise<number> {
  const { data: seats, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('room_id')
    .eq('user_id', userId)
    .eq('member_role', 'member')
    .neq('status', 'removed');
  if (error) throw error;
  if (!seats || seats.length === 0) return 0;

  const stillIn = new Set(await resolveTournamentsForCoach(userId));

  let revoked = 0;
  for (const seat of seats) {
    const room = await getRoomById(seat.room_id as string);
    if (!room || room.surface !== CHAT_SURFACE_TOURNAMENT) continue;
    if (stillIn.has(room.refId)) continue; // still a participant of this tournament → keep the seat
    await supabaseAdmin
      .from('chat_room_members')
      .update({ status: 'removed' })
      .eq('room_id', room.id)
      .eq('user_id', userId);
    revoked++;
  }
  return revoked;
}

// ── Room list (coach-facing) ────────────────────────────────────────────────

async function unreadCountForMember(
  roomId: string,
  lastReadAt: string | null,
  userId: string,
): Promise<number> {
  let q = supabaseAdmin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .is('deleted_at', null)
    // A message you sent is never "unread" to you — exclude own messages so posting doesn't
    // self-badge. Keep system messages (null sender) counted.
    .or(`sender_user_id.is.null,sender_user_id.neq.${userId}`);
  if (lastReadAt) q = q.gt('sent_at', lastReadAt);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function lastMessageFor(roomId: string): Promise<{ at: string; preview: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('body, sent_at, deleted_at')
    .eq('room_id', roomId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ body: string; sent_at: string; deleted_at: string | null }>();
  if (error) throw error;
  if (!data) return null;
  const preview = data.deleted_at ? 'Message removed' : data.body.slice(0, 120);
  return { at: data.sent_at, preview };
}

/**
 * Every tournament chat room the coach can see, with unread counts. Self-heals memberships first so
 * a coach who signed in after the organizer opened chat still finds their room.
 */
export async function listRoomsForUser(userId: string): Promise<ChatRoomListItem[]> {
  // Self-heal: ensure a membership row in every room the coach belongs to — the All-coaches room PLUS
  // each division room covering their team's division — for every tournament they participate in.
  // tournamentIds are already participation-confirmed by resolveTournamentsForCoach (so the All-coaches
  // heal is cheap); division rooms are gated by the scoped resolver inside the helper.
  const tournamentIds = await resolveTournamentsForCoach(userId);
  await Promise.all(tournamentIds.map(async (tid) => {
    try {
      await healCoachTournamentMemberships(userId, tid, { participationConfirmed: true });
    } catch (err) {
      console.error('[chat-service] membership self-heal failed (non-fatal):', err);
    }
  }));

  // List from the membership table (covers both freshly-healed + previously-existing rooms).
  const { data: memberships, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('room_id, member_role, status, muted_until, last_read_at')
    .eq('user_id', userId)
    .neq('status', 'removed');
  if (error) throw error;
  if (!memberships || memberships.length === 0) return [];

  const roomIds = [...new Set(memberships.map(m => m.room_id as string))];
  const { data: roomRows, error: roomErr } = await supabaseAdmin
    .from('chat_rooms')
    .select(ROOM_COLS)
    .in('id', roomIds)
    .eq('surface', CHAT_SURFACE_TOURNAMENT);
  if (roomErr) throw roomErr;
  const roomById = new Map((roomRows ?? []).map(r => [r.id, mapRoom(r as RoomRow)]));

  // Tournament names for the rooms' subjects → a per-room context label (one batched lookup).
  const tournamentIdsForRooms = [...new Set([...roomById.values()].map((r) => r.refId))];
  const tournamentNameById = new Map<string, string>();
  if (tournamentIdsForRooms.length > 0) {
    const { data: tRows, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('id, name')
      .in('id', tournamentIdsForRooms);
    // Non-fatal: a failure just means rooms render without their context label.
    if (tErr) console.error('[chat-service] room context-label lookup failed (non-fatal):', tErr);
    for (const t of tRows ?? []) tournamentNameById.set(t.id as string, t.name as string);
  }

  // Per-room last-message + unread in parallel (was O(rooms) sequential round-trips).
  const items = (await Promise.all(memberships.map(async (m) => {
    const room = roomById.get(m.room_id as string);
    if (!room) return null;
    const [last, unreadCount] = await Promise.all([
      lastMessageFor(room.id),
      unreadCountForMember(room.id, m.last_read_at as string | null, userId),
    ]);
    const mutedUntil = m.muted_until as string | null;
    return {
      room,
      unreadCount,
      lastMessageAt: last?.at ?? null,
      lastMessagePreview: last?.preview ?? null,
      isModerator: m.member_role === 'moderator',
      selfMutedUntil: mutedUntil && new Date(mutedUntil) > new Date() ? mutedUntil : null,
      readOnly: room.isArchived,
      contextLabel: tournamentNameById.get(room.refId) ?? null,
    } as ChatRoomListItem;
  }))).filter((x): x is ChatRoomListItem => x !== null);
  // Most-recently-active room first; rooms with no messages sink to the bottom.
  items.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  return items;
}

/** Total unread across all the coach's rooms (portal sidebar badge). Does NOT self-heal (cheap). */
export async function getUnreadTotalForUser(userId: string): Promise<number> {
  const { data: memberships, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('room_id, last_read_at')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;
  const counts = await Promise.all((memberships ?? []).map(m =>
    unreadCountForMember(m.room_id as string, m.last_read_at as string | null, userId)));
  return counts.reduce((sum, c) => sum + c, 0);
}

// ── Messages ──────────────────────────────────────────────────────────────────

type MessageRow = {
  id: string;
  room_id: string;
  sender_user_id: string | null;
  body: string;
  deleted_at: string | null;
  sent_at: string;
  metadata: Record<string, unknown> | null;
  pinned_at: string | null;
};

const REPLY_SNIPPET_MAX = 140;

/** Pull a typed replyTo out of a message's metadata jsonb (defensive — tolerates any shape). */
function extractReplyTo(metadata: Record<string, unknown> | null): ReplyRef | null {
  const r = (metadata?.replyTo ?? null) as { id?: unknown; name?: unknown; snippet?: unknown } | null;
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : 'Coach',
    snippet: typeof r.snippet === 'string' ? r.snippet : '',
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pull typed @mentions out of a message's metadata jsonb (defensive). */
function extractMentions(metadata: Record<string, unknown> | null): MentionRef[] {
  const arr = metadata?.mentions;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((m) => (m && typeof m === 'object' ? (m as { userId?: unknown; name?: unknown }) : null))
    .filter((m): m is { userId: string; name?: unknown } => !!m && typeof m.userId === 'string')
    .map((m) => ({ userId: m.userId, name: typeof m.name === 'string' ? m.name : 'Coach' }));
}

/** Active members with display names, for the @mention picker. Names are the same shown on messages. */
export async function getRoomMemberDirectory(roomId: string): Promise<MentionRef[]> {
  const ids = await getActiveMemberUserIds(roomId);
  const display = await hydrateUserDisplay(ids);
  return ids
    .map((id) => ({ userId: id, name: display.get(id)?.name ?? 'Coach' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Build an authoritative reply snippet from the REAL referenced message (same room, not deleted). */
async function buildReplyRef(roomId: string, messageId: string): Promise<ReplyRef | null> {
  if (!UUID_RE.test(messageId)) return null; // malformed id → drop the quote (don't fail the send)
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender_user_id, body, deleted_at')
    .eq('id', messageId)
    .eq('room_id', roomId)
    .maybeSingle<{ id: string; sender_user_id: string | null; body: string; deleted_at: string | null }>();
  if (error) throw error;
  if (!data || data.deleted_at) return null; // don't quote a missing / removed / cross-room message
  const name = data.sender_user_id
    ? (await hydrateUserDisplay([data.sender_user_id])).get(data.sender_user_id)?.name ?? 'Coach'
    : 'Coach';
  return { id: data.id, name, snippet: data.body.slice(0, REPLY_SNIPPET_MAX) };
}

/**
 * Paginated message history (newest-first window, returned oldest-first for rendering). Pass
 * `before` (an ISO sent_at cursor) to page backwards. Includes a participant name map so the client
 * can label both historical and realtime messages (the realtime payload carries only a user_id).
 */
export async function getRoomMessages(
  roomId: string,
  opts: { before?: string | null; limit?: number } = {},
): Promise<{ messages: ChatMessageView[]; participants: Record<string, string>; hasMore: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  let q = supabaseAdmin
    .from('chat_messages')
    .select('id, room_id, sender_user_id, body, deleted_at, sent_at, metadata, pinned_at')
    .eq('room_id', roomId)
    .order('sent_at', { ascending: false })
    .limit(limit + 1);
  if (opts.before) q = q.lt('sent_at', opts.before);
  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as MessageRow[];
  const hasMore = rows.length > limit;
  const windowRows = hasMore ? rows.slice(0, limit) : rows;

  const senderIds = windowRows.map(r => r.sender_user_id).filter((v): v is string => Boolean(v));
  const display = await hydrateUserDisplay(senderIds);
  const participants: Record<string, string> = {};
  for (const [id, info] of display) participants[id] = info.name;

  const messages: ChatMessageView[] = windowRows
    .slice()
    .reverse() // oldest-first for append-friendly rendering
    .map(r => ({
      id: r.id,
      roomId: r.room_id,
      senderUserId: r.sender_user_id,
      senderName: r.sender_user_id ? display.get(r.sender_user_id)?.name ?? 'Coach' : 'Coach',
      body: r.deleted_at ? '' : r.body,
      deletedAt: r.deleted_at,
      sentAt: r.sent_at,
      replyTo: r.deleted_at ? null : extractReplyTo(r.metadata),
      mentions: r.deleted_at ? [] : extractMentions(r.metadata),
      pinnedAt: r.pinned_at,
      poll: r.deleted_at ? null : extractPoll(r.metadata),
    }));

  return { messages, participants, hasMore };
}

/** Post a message (service role) with archived / removed / mute enforcement, then notify the room. */
export async function postChatMessage(params: {
  roomId: string;
  senderUserId: string;
  body: string;
  /** id of the message being replied to (validated + snippet rebuilt server-side; ignored if invalid). */
  replyToId?: string | null;
  /** user ids @mentioned (validated against active members + names resolved server-side). */
  mentionUserIds?: string[] | null;
}): Promise<ChatMessageView> {
  const body = params.body.trim();
  if (!body) throw new ChatError('empty', 'Message cannot be empty.', 400);
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new ChatError('too_long', `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`, 400);
  }

  const room = await getRoomById(params.roomId);
  if (!room) throw new ChatError('not_found', 'Conversation not found.', 404);
  if (room.isArchived) throw new ChatError('room_closed', 'This conversation is closed.', 403);

  const membership = await getMembership(params.roomId, params.senderUserId);
  if (!membership || membership.status === 'removed') {
    throw new ChatError('not_member', 'You are not a member of this conversation.', 403);
  }
  if (membership.muted_until && new Date(membership.muted_until) > new Date()) {
    throw new ChatError('muted', 'You are muted in this conversation.', 403);
  }

  // Reply: rebuild the quote from the real referenced message (anti-spoof); drop it if invalid.
  const replyTo = params.replyToId ? await buildReplyRef(params.roomId, params.replyToId) : null;

  // Mentions: keep only ids that are REAL active members; resolve display names server-side (anti-spoof).
  const activeIds = await getActiveMemberUserIds(params.roomId);
  let mentions: MentionRef[] = [];
  if (params.mentionUserIds?.length) {
    const activeSet = new Set(activeIds);
    const valid = [...new Set(params.mentionUserIds)].filter(id => activeSet.has(id) && id !== params.senderUserId);
    if (valid.length > 0) {
      const disp = await hydrateUserDisplay(valid);
      mentions = valid.map(id => ({ userId: id, name: disp.get(id)?.name ?? 'Coach' }));
    }
  }

  const metadata: Record<string, unknown> = {};
  if (replyTo) metadata.replyTo = replyTo;
  if (mentions.length > 0) metadata.mentions = mentions;
  const hasMetadata = Object.keys(metadata).length > 0;

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      room_id: params.roomId,
      sender_user_id: params.senderUserId,
      body,
      ...(hasMetadata ? { metadata } : {}),
    })
    .select('id, room_id, sender_user_id, body, deleted_at, sent_at, metadata, pinned_at')
    .single<MessageRow>();
  if (error) throw error;

  const senderDisplay = (await hydrateUserDisplay([params.senderUserId])).get(params.senderUserId);
  const senderName = senderDisplay?.name ?? 'Coach';

  // Notify (in-app bell + web push; chat defaults push ON, no email; no deep-link in V1). Mentioned
  // members get the DISTINCT `chat_mention` event (reaches them even if they muted general chat) and
  // are removed from the general fan-out so nobody is double-notified for one message.
  try {
    const mentionedIds = new Set(mentions.map(m => m.userId));
    const general = activeIds.filter(id => id !== params.senderUserId && !mentionedIds.has(id));
    if (general.length > 0) {
      await notify({
        orgId: room.orgId,
        tournamentId: room.refId,
        eventType: 'chat_message',
        title: room.name,
        body: `${senderName}: ${body.slice(0, 140)}`,
        userIds: general,
        excludeUserIds: [params.senderUserId],
        requiredFeature: 'tournament_chat',
      });
    }
    if (mentionedIds.size > 0) {
      await notify({
        orgId: room.orgId,
        tournamentId: room.refId,
        eventType: 'chat_mention',
        title: room.name,
        body: `${senderName} mentioned you: ${body.slice(0, 120)}`,
        userIds: [...mentionedIds],
        excludeUserIds: [params.senderUserId],
        requiredFeature: 'tournament_chat',
      });
    }
  } catch (err) {
    console.error('[chat-service] notify failed (non-fatal):', err);
  }

  return {
    id: data.id,
    roomId: data.room_id,
    senderUserId: data.sender_user_id,
    senderName,
    body: data.body,
    deletedAt: data.deleted_at,
    sentAt: data.sent_at,
    replyTo,
    mentions,
    pinnedAt: data.pinned_at,
    poll: null,
  };
}

export async function markRoomRead(roomId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('chat_room_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Aggregate "read by N of M" for the caller's own message: how many OTHER active members have a read
 * watermark at or past `sinceIso` (read the message), out of the total other active members (M). Counts
 * ONLY — no identities leave the server; the per-member "last seen" is organizer-only (the roster).
 * Reuses the per-member last_read_at watermark — no per-message receipts table.
 */
export async function getReadByCount(
  roomId: string,
  excludeUserId: string,
  sinceIso: string,
): Promise<{ readBy: number; memberCount: number }> {
  const since = new Date(sinceIso).getTime();
  const { data, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('user_id, last_read_at')
    .eq('room_id', roomId)
    .eq('status', 'active');
  if (error) throw error;
  const others = (data ?? []).filter((r) => r.user_id !== excludeUserId);
  const readBy = Number.isNaN(since)
    ? 0
    : others.filter((r) => r.last_read_at && new Date(r.last_read_at as string).getTime() >= since).length;
  return { readBy, memberCount: others.length };
}

// ── Moderation (service role) ───────────────────────────────────────────────

/** Mute a member for `hours` (capped at MAX_MUTE_HOURS). They keep READ access; posting is blocked. */
export async function muteMember(params: {
  roomId: string;
  targetUserId: string;
  hours: number;
}): Promise<string> {
  const hours = Math.min(Math.max(params.hours, 1), MAX_MUTE_HOURS);
  const until = new Date(Date.now() + hours * 3_600_000).toISOString();
  const { error } = await supabaseAdmin
    .from('chat_room_members')
    .update({ muted_until: until })
    .eq('room_id', params.roomId)
    .eq('user_id', params.targetUserId);
  if (error) throw error;
  return until;
}

export async function unmuteMember(params: { roomId: string; targetUserId: string }): Promise<void> {
  const { error } = await supabaseAdmin
    .from('chat_room_members')
    .update({ muted_until: null })
    .eq('room_id', params.roomId)
    .eq('user_id', params.targetUserId);
  if (error) throw error;
}

/** Soft-delete a message (moderator). Body is retained in the row but hidden by the read path. */
export async function softDeleteMessage(params: {
  roomId: string;
  messageId: string;
  byUserId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('chat_messages')
    .update({ deleted_at: new Date().toISOString(), deleted_by_user_id: params.byUserId })
    .eq('id', params.messageId)
    .eq('room_id', params.roomId);
  if (error) throw error;
}

/**
 * Delete YOUR OWN message. Verifies (server-side) that the caller is the message's sender and that the
 * message belongs to the room before soft-deleting — the column grants let a member write only the
 * delete columns, and RLS lets only moderators do so, so a member's own-delete must run service-role
 * with the ownership check enforced here. Idempotent: re-deleting an already-deleted message is a no-op.
 * Returns 'ok' | 'not_found' (no such message in the room) | 'forbidden' (not the sender).
 */
export async function deleteOwnMessage(params: {
  roomId: string;
  messageId: string;
  userId: string;
}): Promise<'ok' | 'not_found' | 'forbidden'> {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender_user_id, deleted_at')
    .eq('id', params.messageId)
    .eq('room_id', params.roomId)
    .maybeSingle<{ id: string; sender_user_id: string | null; deleted_at: string | null }>();
  if (error) throw error;
  if (!data) return 'not_found';
  // An orphaned message (sender account deleted → sender_user_id NULL) is unownable by anyone; treat
  // as not-found rather than implying the caller could own it.
  if (!data.sender_user_id) return 'not_found';
  if (data.sender_user_id !== params.userId) return 'forbidden';
  if (data.deleted_at) return 'ok'; // already removed — idempotent
  await softDeleteMessage({ roomId: params.roomId, messageId: params.messageId, byUserId: params.userId });
  return 'ok';
}

/** Pin or unpin a message (moderator). Pin/unpin is an UPDATE → propagates live on the realtime
 *  publication. Won't pin a deleted message. Service-role only (browsers can't write pinned_*). */
export async function setPinned(params: {
  roomId: string;
  messageId: string;
  byUserId: string;
  pinned: boolean;
}): Promise<void> {
  const patch = params.pinned
    ? { pinned_at: new Date().toISOString(), pinned_by_user_id: params.byUserId }
    : { pinned_at: null, pinned_by_user_id: null };
  const { error } = await supabaseAdmin
    .from('chat_messages')
    .update(patch)
    .eq('id', params.messageId)
    .eq('room_id', params.roomId)
    .is('deleted_at', null);
  if (error) throw error;
}

/** The room's currently-pinned messages (newest pin first), for the pinned banner. Excludes deleted. */
export async function getPinnedMessages(roomId: string): Promise<ChatMessageView[]> {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, room_id, sender_user_id, body, deleted_at, sent_at, metadata, pinned_at')
    .eq('room_id', roomId)
    .not('pinned_at', 'is', null)
    .is('deleted_at', null)
    .order('pinned_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as MessageRow[];
  const senderIds = rows.map(r => r.sender_user_id).filter((v): v is string => Boolean(v));
  const display = await hydrateUserDisplay(senderIds);
  return rows.map(r => ({
    id: r.id,
    roomId: r.room_id,
    senderUserId: r.sender_user_id,
    senderName: r.sender_user_id ? display.get(r.sender_user_id)?.name ?? 'Coach' : 'Coach',
    body: r.body,
    deletedAt: r.deleted_at,
    sentAt: r.sent_at,
    replyTo: extractReplyTo(r.metadata),
    mentions: extractMentions(r.metadata),
    pinnedAt: r.pinned_at,
    poll: extractPoll(r.metadata),
  }));
}

// ── Reactions (service role) ────────────────────────────────────────────────
// chat_message_reactions (mig 147) is the SECOND realtime-published table. Writes are service-role
// ONLY (the table grants `authenticated` SELECT only), and un-react is a SOFT-DELETE (removed_at) —
// never a hard DELETE — because Supabase realtime does not RLS-gate hard-DELETE events (it leaks to
// non-members). All reads are scoped to the room via the denormalized room_id so a member cannot pull
// counts/reactors for a message in a room they're not in.

type ReactionRow = { message_id: string; emoji: string; user_id: string };

/**
 * Active-reaction roll-up for a set of messages IN ONE ROOM: per message, per emoji → { count, mine }.
 * Only messages with ≥1 active (removed_at IS NULL) reaction appear. Used for the initial history
 * paint AND the realtime refresh-on-event signal (a reaction INSERT/UPDATE tells the client "re-pull
 * these messages' summaries"; the live payload is never trusted to mutate counts). Room-scoped so a
 * crafted messageIds list can't read another room's reactions.
 */
export async function getReactionsForMessages(
  roomId: string,
  messageIds: string[],
  selfUserId: string,
): Promise<MessageReactionsMap> {
  const ids = [...new Set(messageIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data, error } = await supabaseAdmin
    .from('chat_message_reactions')
    .select('message_id, emoji, user_id')
    .eq('room_id', roomId)
    .in('message_id', ids)
    .is('removed_at', null);
  if (error) throw error;
  const map: MessageReactionsMap = {};
  for (const r of (data ?? []) as ReactionRow[]) {
    const summary = (map[r.message_id] ??= {});
    const cell = (summary[r.emoji] ??= { count: 0, mine: false });
    cell.count += 1;
    if (r.user_id === selfUserId) cell.mine = true;
  }
  return map;
}

/**
 * Toggle the caller's reaction on a message. Enforces (service role) the same gate as posting — room
 * exists + not archived, caller is an active (non-removed) member, not muted — then:
 *   • no row yet         → INSERT (reacted = true)
 *   • row exists, active → soft-remove via removed_at (reacted = false)
 *   • row exists, removed→ revive (removed_at = NULL, reacted = true)
 * Soft-delete toggle (never a hard DELETE) keeps every realtime event RLS-correct. Returns the new
 * state + the message's recomputed summary (authoritative — the client replaces its optimistic value).
 */
export async function toggleReaction(params: {
  roomId: string;
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<{ reacted: boolean; summary: ReactionSummary }> {
  if (!isReactionEmoji(params.emoji)) throw new ChatError('invalid', 'Unsupported reaction.', 400);

  const room = await getRoomById(params.roomId);
  if (!room) throw new ChatError('not_found', 'Conversation not found.', 404);
  if (room.isArchived) throw new ChatError('room_closed', 'This conversation is closed.', 403);

  const membership = await getMembership(params.roomId, params.userId);
  if (!membership || membership.status === 'removed') {
    throw new ChatError('not_member', 'You are not a member of this conversation.', 403);
  }
  if (membership.muted_until && new Date(membership.muted_until) > new Date()) {
    throw new ChatError('muted', 'You are muted in this conversation.', 403);
  }

  // The reacted-to message must exist in THIS room and not be deleted.
  const { data: msg, error: msgErr } = await supabaseAdmin
    .from('chat_messages')
    .select('id, deleted_at')
    .eq('id', params.messageId)
    .eq('room_id', params.roomId)
    .maybeSingle<{ id: string; deleted_at: string | null }>();
  if (msgErr) throw msgErr;
  if (!msg || msg.deleted_at) throw new ChatError('not_found', 'Message not found.', 404);

  const { data: existing, error: exErr } = await supabaseAdmin
    .from('chat_message_reactions')
    .select('id, removed_at')
    .eq('message_id', params.messageId)
    .eq('user_id', params.userId)
    .eq('emoji', params.emoji)
    .maybeSingle<{ id: string; removed_at: string | null }>();
  if (exErr) throw exErr;

  if (existing) {
    const removeIt = existing.removed_at == null; // currently active → remove; removed → revive
    const { error } = await supabaseAdmin
      .from('chat_message_reactions')
      .update({ removed_at: removeIt ? new Date().toISOString() : null })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from('chat_message_reactions')
      .insert({ room_id: params.roomId, message_id: params.messageId, user_id: params.userId, emoji: params.emoji });
    if (error) {
      // A concurrent insert won the UNIQUE race — revive whatever is there now (idempotent toggle-on).
      if ((error as { code?: string }).code === '23505') {
        await supabaseAdmin
          .from('chat_message_reactions')
          .update({ removed_at: null })
          .eq('message_id', params.messageId)
          .eq('user_id', params.userId)
          .eq('emoji', params.emoji);
      } else {
        throw error;
      }
    }
  }

  // Re-read the authoritative summary and DERIVE `reacted` from it, so the returned flag can never
  // contradict the DB even if a concurrent toggle raced the write above (the client uses the summary,
  // but a truthful flag keeps any future consumer correct).
  const map = await getReactionsForMessages(params.roomId, [params.messageId], params.userId);
  const summary = map[params.messageId] ?? {};
  return { reacted: Boolean(summary[params.emoji]?.mine), summary };
}

/** The coaches who currently react to a message with a given emoji (the "who reacted" popover).
 *  Room-scoped via the denormalized room_id so it can't read a message from another room. */
export async function getReactionReactors(params: {
  roomId: string;
  messageId: string;
  emoji: string;
}): Promise<MentionRef[]> {
  if (!isReactionEmoji(params.emoji)) return [];
  const { data, error } = await supabaseAdmin
    .from('chat_message_reactions')
    .select('user_id')
    .eq('room_id', params.roomId)
    .eq('message_id', params.messageId)
    .eq('emoji', params.emoji)
    .is('removed_at', null);
  if (error) throw error;
  const ids = (data ?? []).map(r => r.user_id as string);
  const display = await hydrateUserDisplay(ids);
  return ids
    .map(id => ({ userId: id, name: display.get(id)?.name ?? 'Coach' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Polls (service role) ─────────────────────────────────────────────────────
// A poll IS a chat message: question = body, options + settings ride metadata.poll, so creating +
// closing a poll are chat_messages INSERT/UPDATE (they ride the EXISTING realtime). The only new live
// store is the VOTES (chat_poll_votes, mig 148) — SELECT-only to browsers, soft-delete toggle, same
// discipline as reactions. Owner decisions (2026-06-23): organizers create + close; the creator picks
// single-vs-multiple per poll; voters are VISIBLE; voting is any active member.

type PollVoteRow = { message_id: string; option_id: string; user_id: string };

/** Active-vote tallies for a set of poll messages IN ONE ROOM: per message, per option → {count, mine}.
 *  Room-scoped (via denormalized room_id) so a crafted messageIds list can't read another room's votes. */
export async function getPollTallies(
  roomId: string,
  messageIds: string[],
  selfUserId: string,
): Promise<PollTalliesMap> {
  const ids = [...new Set(messageIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data, error } = await supabaseAdmin
    .from('chat_poll_votes')
    .select('message_id, option_id, user_id')
    .eq('room_id', roomId)
    .in('message_id', ids)
    .is('removed_at', null);
  if (error) throw error;
  const map: PollTalliesMap = {};
  for (const v of (data ?? []) as PollVoteRow[]) {
    const tally = (map[v.message_id] ??= {});
    const cell = (tally[v.option_id] ??= { count: 0, mine: false });
    cell.count += 1;
    if (v.user_id === selfUserId) cell.mine = true;
  }
  return map;
}

/** The coaches who currently voted a given option (visible-voter polls). Room-scoped via room_id. */
export async function getPollVoters(params: {
  roomId: string;
  messageId: string;
  optionId: string;
}): Promise<MentionRef[]> {
  const { data, error } = await supabaseAdmin
    .from('chat_poll_votes')
    .select('user_id')
    .eq('room_id', params.roomId)
    .eq('message_id', params.messageId)
    .eq('option_id', params.optionId)
    .is('removed_at', null);
  if (error) throw error;
  const uids = (data ?? []).map((r) => r.user_id as string);
  const display = await hydrateUserDisplay(uids);
  return uids
    .map((id) => ({ userId: id, name: display.get(id)?.name ?? 'Coach' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Create a poll (organizer only). Inserts a poll MESSAGE (question = body; options [with generated
 * uuids] + settings ride metadata.poll), notifies the room, and returns the message view. The INSERT
 * rides the existing chat_messages realtime so the poll appears live in everyone's stream.
 */
export async function createPoll(params: {
  roomId: string;
  byUserId: string;
  question: string;
  options: string[];
  multiple: boolean;
}): Promise<ChatMessageView> {
  const room = await getRoomById(params.roomId);
  if (!room) throw new ChatError('not_found', 'Conversation not found.', 404);
  if (room.isArchived) throw new ChatError('room_closed', 'This conversation is closed.', 403);

  const membership = await getMembership(params.roomId, params.byUserId);
  if (!membership || membership.status === 'removed') {
    throw new ChatError('not_member', 'You are not a member of this conversation.', 403);
  }
  if (membership.member_role !== 'moderator') {
    throw new ChatError('forbidden', 'Only organizers can create a poll.', 403);
  }

  const valid = validatePollInput(params.question, params.options);
  if (!valid.ok) throw new ChatError('invalid', valid.error, 400);

  const poll: PollDefinition = {
    options: valid.options.map((text) => ({ id: randomUUID(), text })),
    multiple: params.multiple === true,
    closedAt: null,
  };

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({ room_id: params.roomId, sender_user_id: params.byUserId, body: valid.question, metadata: { poll } })
    .select('id, room_id, sender_user_id, body, deleted_at, sent_at, metadata, pinned_at')
    .single<MessageRow>();
  if (error) throw error;

  const senderName = (await hydrateUserDisplay([params.byUserId])).get(params.byUserId)?.name ?? 'Coach';

  // Notify the room (an organizer asking for input is worth a ping). Reuse the chat_message event so it
  // lands in the same stream as a normal message.
  try {
    const recipients = (await getActiveMemberUserIds(params.roomId)).filter((id) => id !== params.byUserId);
    if (recipients.length > 0) {
      await notify({
        orgId: room.orgId,
        tournamentId: room.refId,
        eventType: 'chat_message',
        title: room.name,
        body: `${senderName} posted a poll: ${valid.question.slice(0, 120)}`,
        userIds: recipients,
        excludeUserIds: [params.byUserId],
        requiredFeature: 'tournament_chat',
      });
    }
  } catch (err) {
    console.error('[chat-service] poll notify failed (non-fatal):', err);
  }

  return {
    id: data.id, roomId: data.room_id, senderUserId: data.sender_user_id, senderName,
    body: data.body, deletedAt: data.deleted_at, sentAt: data.sent_at,
    replyTo: null, mentions: [], pinnedAt: data.pinned_at, poll: extractPoll(data.metadata),
  };
}

/**
 * Cast / change / retract MY vote on a poll option (any active member). Enforces membership / mute /
 * archived / poll-open, validates the option against the poll, applies single-vs-multiple, and uses a
 * soft-delete toggle (revote/un-vote sets removed_at). Returns the poll's recomputed tally.
 */
export async function castVote(params: {
  roomId: string;
  messageId: string;
  userId: string;
  optionId: string;
}): Promise<{ tally: PollTally }> {
  const room = await getRoomById(params.roomId);
  if (!room) throw new ChatError('not_found', 'Conversation not found.', 404);
  if (room.isArchived) throw new ChatError('room_closed', 'This conversation is closed.', 403);

  const membership = await getMembership(params.roomId, params.userId);
  if (!membership || membership.status === 'removed') {
    throw new ChatError('not_member', 'You are not a member of this conversation.', 403);
  }
  if (membership.muted_until && new Date(membership.muted_until) > new Date()) {
    throw new ChatError('muted', 'You are muted in this conversation.', 403);
  }

  // Load the poll message; it must be a non-deleted, open poll in THIS room, and the option must exist.
  const { data: msg, error: msgErr } = await supabaseAdmin
    .from('chat_messages')
    .select('id, metadata, deleted_at')
    .eq('id', params.messageId)
    .eq('room_id', params.roomId)
    .maybeSingle<{ id: string; metadata: Record<string, unknown> | null; deleted_at: string | null }>();
  if (msgErr) throw msgErr;
  if (!msg || msg.deleted_at) throw new ChatError('not_found', 'Poll not found.', 404);
  const poll = extractPoll(msg.metadata);
  if (!poll) throw new ChatError('not_found', 'Poll not found.', 404);
  if (poll.closedAt) throw new ChatError('room_closed', 'This poll is closed.', 403);
  if (!poll.options.some((o) => o.id === params.optionId)) {
    throw new ChatError('invalid', 'Unknown poll option.', 400);
  }

  const { data: mine, error: mineErr } = await supabaseAdmin
    .from('chat_poll_votes')
    .select('id, removed_at')
    .eq('message_id', params.messageId)
    .eq('option_id', params.optionId)
    .eq('user_id', params.userId)
    .maybeSingle<{ id: string; removed_at: string | null }>();
  if (mineErr) throw mineErr;

  if (mine && mine.removed_at == null) {
    // Toggle this option OFF.
    const { error } = await supabaseAdmin.from('chat_poll_votes')
      .update({ removed_at: new Date().toISOString() }).eq('id', mine.id);
    if (error) throw error;
  } else {
    // Cast THIS option first (revive a previously-removed row of mine, or insert a fresh one)...
    if (mine) {
      const { error } = await supabaseAdmin.from('chat_poll_votes')
        .update({ removed_at: null }).eq('id', mine.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from('chat_poll_votes')
        .insert({ room_id: params.roomId, message_id: params.messageId, option_id: params.optionId, user_id: params.userId });
      if (error) {
        // A concurrent insert won the UNIQUE race — revive whatever is there now (idempotent toggle-on).
        if ((error as { code?: string }).code === '23505') {
          await supabaseAdmin.from('chat_poll_votes').update({ removed_at: null })
            .eq('room_id', params.roomId)
            .eq('message_id', params.messageId)
            .eq('option_id', params.optionId)
            .eq('user_id', params.userId);
        } else {
          throw error;
        }
      }
    }
    // ...THEN, for single-choice, retract any OTHER active option-votes by me. Cast-then-clear means the
    // chosen option always wins and the state converges even if two of my requests race (clear-then-cast
    // could momentarily leave two options active for one voter).
    if (!poll.multiple) {
      const { error: clearErr } = await supabaseAdmin.from('chat_poll_votes')
        .update({ removed_at: new Date().toISOString() })
        .eq('message_id', params.messageId)
        .eq('user_id', params.userId)
        .neq('option_id', params.optionId)
        .is('removed_at', null);
      if (clearErr) throw clearErr;
    }
  }

  const map = await getPollTallies(params.roomId, [params.messageId], params.userId);
  return { tally: map[params.messageId] ?? {} };
}

/**
 * Close (or reopen) a poll — organizer only. Sets/clears metadata.poll.closedAt on the poll message,
 * preserving the rest of metadata. A chat_messages UPDATE → propagates live on the existing realtime
 * publication (so every client flips to the closed/open state without a refetch).
 */
export async function setPollClosed(params: {
  roomId: string;
  messageId: string;
  byUserId: string;
  closed: boolean;
}): Promise<void> {
  const membership = await getMembership(params.roomId, params.byUserId);
  if (!membership || membership.status === 'removed' || membership.member_role !== 'moderator') {
    throw new ChatError('forbidden', 'Only organizers can change a poll.', 403);
  }
  const { data: msg, error: msgErr } = await supabaseAdmin
    .from('chat_messages')
    .select('id, metadata, deleted_at')
    .eq('id', params.messageId)
    .eq('room_id', params.roomId)
    .maybeSingle<{ id: string; metadata: Record<string, unknown> | null; deleted_at: string | null }>();
  if (msgErr) throw msgErr;
  if (!msg || msg.deleted_at) throw new ChatError('not_found', 'Poll not found.', 404);
  const poll = extractPoll(msg.metadata);
  if (!poll) throw new ChatError('not_found', 'Poll not found.', 404);

  const nextMeta = {
    ...(msg.metadata ?? {}),
    poll: { ...poll, closedAt: params.closed ? new Date().toISOString() : null },
  };
  const { error } = await supabaseAdmin
    .from('chat_messages')
    .update({ metadata: nextMeta })
    .eq('id', params.messageId)
    .eq('room_id', params.roomId);
  if (error) throw error;
}

/** Close (archive) or reopen a room. Archived = read-only for everyone (posting blocked in code + RLS). */
export async function setRoomArchived(params: { roomId: string; archived: boolean }): Promise<void> {
  const { error } = await supabaseAdmin
    .from('chat_rooms')
    .update({ is_archived: params.archived })
    .eq('id', params.roomId);
  if (error) throw error;
}

// ── Admin roster (joined members hydrated + "Not yet joined") ────────────────

export async function getRoomRoster(room: ChatRoom): Promise<{
  members: ChatMemberView[];
  pending: PendingChatCoach[];
}> {
  const { data: rows, error } = await supabaseAdmin
    .from('chat_room_members')
    .select(MEMBER_COLS)
    .eq('room_id', room.id);
  if (error) throw error;

  const memberRows = (rows ?? []) as MemberRow[];
  const display = await hydrateUserDisplay(memberRows.map(r => r.user_id));
  const members: ChatMemberView[] = memberRows.map(r => {
    const info = display.get(r.user_id);
    return {
      userId: r.user_id,
      name: info?.name ?? 'Coach',
      email: info?.email ?? null,
      role: r.member_role,
      status: r.status,
      mutedUntil: r.muted_until,
      lastReadAt: r.last_read_at,
      joinedAt: r.joined_at,
    };
  });
  members.sort((a, b) => a.name.localeCompare(b.name));

  // "Not yet joined" — recompute live so newly-resolved coaches drop off automatically. Scoped to the
  // room's divisions so a division room only shows the teams it actually covers.
  const { pending } = await resolveTournamentChatParticipants(room.refId, roomDivisionIds(room));
  return { members, pending };
}

// ── Admin multi-room overview ────────────────────────────────────────────────

/** One row in the organizer room switcher: name, archive state, scope, and live counts. */
export type AdminChatRoomSummary = {
  id: string;
  name: string;
  isArchived: boolean;
  /** null = the default "All coaches" room (undeletable); a uuid = an organizer-created division room. */
  refSubId: string | null;
  /** the divisions this room covers (empty for the All-coaches room). */
  divisionIds: string[];
  /** active members (organizers + resolved coaches). */
  memberCount: number;
  /** teams in scope whose coach hasn't signed in yet. */
  pendingCount: number;
  /** most recent message timestamp (null = no messages yet) — drives the switcher's activity order. */
  lastMessageAt: string | null;
};

/**
 * The organizer's room switcher data: ensures the default room exists, then reconciles membership for
 * EVERY room (so counts are live + newly-registered coaches land in the right rooms) and returns a
 * summary per room. Order: the "All coaches" room is PINNED first (the home/announcements channel),
 * then division rooms by most-recent message (most active first; empty rooms sink).
 */
export async function listTournamentChatRoomSummaries(
  tournamentId: string,
  createdByUserId: string,
): Promise<AdminChatRoomSummary[]> {
  await ensureTournamentChatRoom({ tournamentId, createdByUserId });
  const rooms = await listTournamentChatRooms(tournamentId);
  const summaries = await Promise.all(
    rooms.map(async (room) => {
      const [sync, last] = await Promise.all([syncTournamentChatRoom({ room }), lastMessageFor(room.id)]);
      return {
        id: room.id,
        name: room.name,
        isArchived: room.isArchived,
        refSubId: room.refSubId,
        divisionIds: roomDivisionIds(room) ?? [],
        memberCount: sync.activeCount,
        pendingCount: sync.pending.length,
        lastMessageAt: last?.at ?? null,
      };
    }),
  );
  summaries.sort((a, b) => {
    // All-coaches (ref_sub_id NULL) always pinned first.
    if ((a.refSubId == null) !== (b.refSubId == null)) return a.refSubId == null ? -1 : 1;
    // Then most-recently-active first; rooms with no messages sink to the bottom.
    return (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');
  });
  return summaries;
}

/** A division choice for the "New room" composer: name + how many (non-rejected) teams it holds. */
export type ChatDivisionOption = { id: string; name: string; teamCount: number };

/** The tournament's divisions with team counts, for the division multi-select in the room composer. */
export async function getTournamentDivisionsForChat(tournamentId: string): Promise<ChatDivisionOption[]> {
  const [divRes, teamRes] = await Promise.all([
    supabaseAdmin
      .from('divisions')
      .select('id, name, display_order')
      .eq('tournament_id', tournamentId)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('teams')
      .select('division_id')
      .eq('tournament_id', tournamentId)
      .neq('status', 'rejected'), // match the chat participant spine (a rejected reg is not a member)
  ]);
  if (divRes.error) throw divRes.error;
  if (teamRes.error) throw teamRes.error;
  const countByDivision = new Map<string, number>();
  for (const t of teamRes.data ?? []) {
    const d = t.division_id as string | null;
    if (d) countByDivision.set(d, (countByDivision.get(d) ?? 0) + 1);
  }
  return (divRes.data ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    teamCount: countByDivision.get(d.id as string) ?? 0,
  }));
}
