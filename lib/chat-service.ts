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
 * One room per tournament (ref_sub_id = NULL). Division sub-rooms are a deferred second pass.
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

  // "Not yet joined" — recompute live so newly-resolved coaches drop off automatically.
  const { pending } = await resolveTournamentChatParticipants(room.refId);
  return { members, pending };
}
