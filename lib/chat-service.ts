import 'server-only';

import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
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
 * One room per tournament (ref_sub_id = NULL). Division sub-rooms are a deferred second pass.
 */

export const CHAT_SURFACE_TOURNAMENT = 'tournament';

/** Max mute duration the surface allows (owner decision: ≤72h). */
export const MAX_MUTE_HOURS = 72;

export class ChatError extends Error {
  code: 'room_closed' | 'not_member' | 'muted' | 'empty' | 'too_long' | 'not_found';
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

export type ChatMessageView = {
  id: string;
  roomId: string;
  senderUserId: string | null;
  senderName: string;
  body: string;
  deletedAt: string | null;
  sentAt: string;
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

/** The single tournament-level room for a tournament (ref_sub_id IS NULL), or null. */
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
  divisionId?: string | null;
}): Promise<{ activeCount: number; pending: PendingChatCoach[] }> {
  const { room } = params;
  const { userIds: coachIds, pending } = await resolveTournamentChatParticipants(
    room.refId,
    params.divisionId ?? null,
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
 * Self-heal one coach's membership: if a room exists for the tournament and the user is a CURRENT
 * participant, ensure they hold an active member row (unless an admin removed them). Self-guarding —
 * it verifies participation before inserting, so it is safe to call with any (userId, tournamentId)
 * pair (membership is the sole access key, so a wrong insert would leak the room). Returns the room
 * when the coach has access, else null.
 */
export async function ensureCoachMembership(userId: string, tournamentId: string): Promise<ChatRoom | null> {
  const room = await getTournamentChatRoom(tournamentId);
  if (!room) return null;

  const existing = await getMembership(room.id, userId);
  if (existing) return existing.status === 'removed' ? null : room;

  if (!(await isTournamentChatParticipant(userId, tournamentId))) return null;
  const state = await ensureMembershipRow(room.id, userId);
  return state === 'removed' ? null : room;
}

// ── Room list (coach-facing) ────────────────────────────────────────────────

async function unreadCountForMember(roomId: string, lastReadAt: string | null): Promise<number> {
  let q = supabaseAdmin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .is('deleted_at', null);
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
  // Self-heal: ensure a membership row for every tournament the coach participates in that has a
  // room. tournamentIds are already participation-confirmed by resolveTournamentsForCoach, so use
  // the unchecked row helper (avoids re-running the inverse resolver once per tournament).
  const tournamentIds = await resolveTournamentsForCoach(userId);
  await Promise.all(tournamentIds.map(async (tid) => {
    try {
      const room = await getTournamentChatRoom(tid);
      if (room) await ensureMembershipRow(room.id, userId);
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

  // Per-room last-message + unread in parallel (was O(rooms) sequential round-trips).
  const items = (await Promise.all(memberships.map(async (m) => {
    const room = roomById.get(m.room_id as string);
    if (!room) return null;
    const [last, unreadCount] = await Promise.all([
      lastMessageFor(room.id),
      unreadCountForMember(room.id, m.last_read_at as string | null),
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
    unreadCountForMember(m.room_id as string, m.last_read_at as string | null)));
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
};

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
    .select('id, room_id, sender_user_id, body, deleted_at, sent_at')
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
    }));

  return { messages, participants, hasMore };
}

/** Post a message (service role) with archived / removed / mute enforcement, then notify the room. */
export async function postChatMessage(params: {
  roomId: string;
  senderUserId: string;
  body: string;
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

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({ room_id: params.roomId, sender_user_id: params.senderUserId, body })
    .select('id, room_id, sender_user_id, body, deleted_at, sent_at')
    .single<MessageRow>();
  if (error) throw error;

  const senderDisplay = (await hydrateUserDisplay([params.senderUserId])).get(params.senderUserId);
  const senderName = senderDisplay?.name ?? 'Coach';

  // Notify every OTHER active member (in-app bell + web push; chat defaults push ON, no email).
  // No deep-link in V1 (recipients span free coaches, org coaches, and admins across two portals —
  // a single link would mis-route most of them; the unread badge guides them to Chat instead).
  try {
    const recipients = (await getActiveMemberUserIds(params.roomId)).filter(
      id => id !== params.senderUserId,
    );
    if (recipients.length > 0) {
      await notify({
        orgId: room.orgId,
        tournamentId: room.refId,
        eventType: 'chat_message',
        title: room.name,
        body: `${senderName}: ${body.slice(0, 140)}`,
        userIds: recipients,
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

  // "Not yet joined" — recompute live so newly-resolved coaches drop off automatically.
  const { pending } = await resolveTournamentChatParticipants(room.refId);
  return { members, pending };
}
