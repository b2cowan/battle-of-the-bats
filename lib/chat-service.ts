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
  resolveStaffRoomParticipants,
  resolveStaffTeamsForCoach,
  type PendingChatCoach,
  type StaffTeamForCoach,
} from './chat-resolvers';
import { roomDisplayName, divisionScopeLabel } from './chat-display';
// F4: room organizer membership is decided by the SAME capability + assignment scope the admin
// chat routes enforce, so a seat in a room can never disagree with what the routes allow.
import { hasCapability } from './roles';
import type { OrgPlan, OrgRole } from './types';
import { hasPlanFeature, type PlanFeature } from './plan-features';
import { getActiveTeamEntitlement } from './team-workspace-entitlements';

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

/**
 * Project 2A — team STAFF rooms (surface reserved in the mig-141 CHECK since day one).
 * Shape: ref_id = the org that owns the rep team (rep_teams.org_id — the workspace org for a
 * standalone Premium team, the club org for an org-native team), ref_sub_id = the rep_team id.
 * The mig-150 dedupe index therefore yields one staff room per team; ref_sub_id NULL stays free
 * for a future org-wide room (deliverable 2B, held for the Club evaluation).
 */
export const CHAT_SURFACE_COACH_PEER = 'coach_peer';

/** A team staff room: coach_peer surface scoped to one rep team. For the TEAM-specific bits only
 *  (team-name kicker, invite nudge, staff sync) — surface-level rules belong on isCoachPeerRoom. */
export function isStaffRoom(room: Pick<ChatRoom, 'surface' | 'refSubId'>): boolean {
  return room.surface === CHAT_SURFACE_COACH_PEER && room.refSubId != null;
}

/** ANY coach_peer room — the staff room today, the org-wide 2B room later. Use THIS for
 *  surface-level rules (member-route moderation, notify scope): keying them on isStaffRoom would
 *  silently forbid the org-wide room's moderator the day 2B ships (its ref_sub_id is NULL). */
export function isCoachPeerRoom(room: Pick<ChatRoom, 'surface'>): boolean {
  return room.surface === CHAT_SURFACE_COACH_PEER;
}

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
 *  from the client — so a reply can't fake what someone said). Rides chat_messages.metadata jsonb.
 *  `hidden` (never persisted — stamped per-viewer at read time) means the quoted message predates
 *  this viewer's history watermark: the client shows a "Not visible to you" stub, never the text. */
export type ReplyRef = { id: string; name: string; snippet: string; hidden?: boolean };

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
  /** WI-1: the room's tournament slug — resolved in the SAME batched tournaments lookup that builds
   *  `contextLabel` (no extra round-trip), consumed by the consumer inbox's return-path event chip. */
  tournamentSlug: string | null;
  /** WI-1: whether the tournament is PUBLISHED (active|completed) and therefore has a public home.
   *  A draft has no public page, so the return-path chip must be hidden for it (not a 404 link). */
  tournamentIsPublic: boolean;
  /** sender of the room's most-recent message (null = no messages / system) — the consumer inbox
   *  turns this into a "Organizer:" / "Coach Dana:" / "You:" preview prefix. Coach/admin surfaces ignore it. */
  lastMessageSenderId?: string | null;
  /** the member's OWN "Mute this room" state (notifications_muted_at set; mig 193). A muted room is
   *  excluded from every unread count and dimmed in the consumer inbox. Coaches can't self-mute today. */
  selfNotifMuted?: boolean;
  /** F2: names of the divisions this room covers, in the room's own stored order. `null` for the
   *  All-coaches room (nothing to disambiguate). An EMPTY array means the room is division-scoped
   *  but its divisions were since deleted — surfaces show a "Division room" fallback, not a blank. */
  divisionNames?: string[] | null;
  // ── Staff rooms (Project 2A) — absent/false on tournament rooms ───────────
  /** this is a team staff room (coach_peer surface) — pins first in the portal list. */
  isStaffRoom?: boolean;
  /** the rep team's name (staff rooms only) — the consumer inbox's group kicker. */
  staffTeamName?: string | null;
  /** the rep team id (staff rooms only) — builds the portal's Staff-page invite link. */
  staffTeamId?: string | null;
  /** the owning org's slug (staff rooms only) — same link; null degrades to no invite CTA. */
  staffOrgSlug?: string | null;
  /** active seats (staff rooms only) — 1 drives the "it's just you in here" first-run nudge. */
  staffMemberCount?: number | null;
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
  /** mig 208 (CH-5 as amended): messages before this instant are invisible to THIS member. NULL =
   *  full history — every tournament-room row, always (only the staff-room sync ever sets it). */
  history_visible_from: string | null;
};

const MEMBER_COLS = 'user_id, member_role, status, muted_until, last_read_at, joined_at, history_visible_from';

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

/** A room's membership rows as user_id → {role, status} — the shared read half of the two
 *  membership syncs (tournament + staff), so the row shape is fetched one way. */
async function fetchExistingMemberRows(roomId: string): Promise<Map<string, { role: string; status: string }>> {
  const { data, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('user_id, member_role, status')
    .eq('room_id', roomId);
  if (error) throw error;
  return new Map(
    (data ?? []).map(r => [r.user_id as string, { role: r.member_role as string, status: r.status as string }]),
  );
}

/** Batch-insert membership rows, tolerating a concurrent sync winning the unique-violation race —
 *  the shared write half of both membership syncs. Upsert-ignore rather than plain insert: a
 *  multi-row INSERT is atomic, so ONE conflicting row (a racer seated user X first) would silently
 *  discard the whole batch including unrelated new seats (review finding). ON CONFLICT DO NOTHING
 *  drops only the colliding row; existing rows are never modified. */
async function insertMemberRows(rows: Array<Record<string, unknown>>): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin
    .from('chat_room_members')
    .upsert(rows, { onConflict: 'room_id,user_id', ignoreDuplicates: true });
  if (error) throw error;
}

/** Active member ids + the subset who self-muted, in ONE query — for the post hot path (recipients +
 *  push-suppression) so a send doesn't pay two round-trips to chat_room_members. */
async function getActiveMembersWithMute(roomId: string): Promise<{ activeIds: string[]; mutedIds: Set<string> }> {
  const { data, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('user_id, notifications_muted_at')
    .eq('room_id', roomId)
    .eq('status', 'active');
  if (error) throw error;
  const activeIds: string[] = [];
  const mutedIds = new Set<string>();
  for (const r of data ?? []) {
    const uid = r.user_id as string;
    activeIds.push(uid);
    if (r.notifications_muted_at) mutedIds.add(uid);
  }
  return { activeIds, mutedIds };
}

/**
 * The org members entitled to moderate THIS tournament's rooms — and therefore to be in them.
 *
 * Was a hardcoded `role IN ('owner','admin')` list, which was wrong twice over (owner ruling F4,
 * 2026-07-29):
 *
 *  1. It excluded `staff`, who carry `module_tournaments` by default and so already pass every
 *     admin chat route's guard. They could create rooms, delete messages, mute coaches and close
 *     rooms while never being a member — so the room's history 403'd for them and posting 403'd.
 *     They could moderate a conversation they could not read.
 *  2. It ignored tournament ASSIGNMENTS entirely. A member restricted to one tournament in the
 *     members UI was still made a moderator of every tournament's rooms in the org — reading and
 *     being notified about events they are explicitly scoped out of, and that `scopeGuard` would
 *     403 them from at the route layer. The members screen showed the restriction; chat ignored it.
 *
 * Entitlement is now the same question the routes ask: does this member hold `module_tournaments`,
 * and does their assignment scope include this tournament? Absence of assignment rows means
 * unrestricted, matching `getAuthContextWithScope`. Owners are always unrestricted and always pass.
 */
async function getHostModeratorUserIds(orgId: string, tournamentId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('id, user_id, role, capabilities')
    .eq('organization_id', orgId)
    .eq('status', 'active');
  if (error) throw error;

  const rows = (data ?? []).filter(r => r.user_id) as Array<{
    id: string;
    user_id: string;
    role: OrgRole;
    capabilities: Record<string, boolean> | null;
  }>;

  // Only members who could moderate this tournament's chat at all.
  const capable = rows.filter(r => hasCapability(r.role, r.capabilities, 'module_tournaments'));
  if (capable.length === 0) return [];

  // Owners can never hold assignment rows (the assignments route blocks it) — no need to check.
  const scopable = capable.filter(r => r.role !== 'owner');
  const assignedByMember = new Map<string, Set<string>>();
  if (scopable.length > 0) {
    const { data: assignments, error: aErr } = await supabaseAdmin
      .from('org_member_tournament_assignments')
      .select('org_member_id, tournament_id')
      .in('org_member_id', scopable.map(r => r.id));
    if (aErr) throw aErr;
    for (const a of assignments ?? []) {
      const key = a.org_member_id as string;
      if (!assignedByMember.has(key)) assignedByMember.set(key, new Set());
      assignedByMember.get(key)!.add(a.tournament_id as string);
    }
  }

  const entitled = capable.filter(r => {
    if (r.role === 'owner') return true;
    const assigned = assignedByMember.get(r.id);
    return !assigned || assigned.size === 0 || assigned.has(tournamentId); // absence = unrestricted
  });

  return [...new Set(entitled.map(r => r.user_id))];
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
  const moderatorIds = await getHostModeratorUserIds(room.orgId, room.refId);

  const existing = await fetchExistingMemberRows(room.id);

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

  // Revoke stale organizers (F4, owner-ratified 2026-07-29). A 'moderator' row whose user is no
  // longer entitled — demoted, restricted to other tournaments, suspended, or gone from the org —
  // must lose the seat. Previously they were only demoted IF they also resolved as a coach, and
  // otherwise left alone entirely: an ex-admin kept a live, notification-receiving seat forever,
  // and because the moderate route refuses to mute a 'moderator', nobody could even silence them.
  //
  // Deliberate asymmetry with coach membership, which is LEFT ALONE when non-active: a removed
  // coach is a MODERATION decision and sync must never undo it. Organizer standing is a DERIVED
  // permission — it tracks current role/capability/assignment, so it revokes here and comes back
  // by itself when the member is re-entitled.
  const coachSet = new Set(coachIds);
  for (const [userId, cur] of existing) {
    if (cur.role !== 'moderator' || moderatorSet.has(userId)) continue;
    if (cur.status === 'removed') continue; // already gone; stay idempotent
    if (coachSet.has(userId)) {
      // Still a legitimate participant — drop the elevated standing, keep ordinary access.
      await supabaseAdmin
        .from('chat_room_members')
        .update({ member_role: 'member' })
        .eq('room_id', room.id)
        .eq('user_id', userId);
    } else {
      // No independent claim to the room at all.
      await supabaseAdmin
        .from('chat_room_members')
        .update({ member_role: 'member', status: 'removed' })
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

  await insertMemberRows(toInsert);

  const activeCount = await getActiveMemberUserIds(room.id).then(ids => ids.length);
  return { activeCount, pending };
}

/**
 * Re-reconcile every EXISTING room of a tournament. Best-effort and never throws — call it beside
 * the writes that change who belongs in a room (a team accepted, rejected, or moved between
 * divisions), so membership and the dashboard's "in the chat" count stop waiting for someone to
 * open the admin chat screen before they become true (F6, owner-ratified 2026-07-29).
 *
 * Uses the read-only room lookup ON PURPOSE. `ensureTournamentChatRoom` would CREATE the
 * "All coaches" room, and a registration edit must never conjure a chat room into existence —
 * the coach portal tells coaches "only the organizer can open a chat", and this would quietly
 * make that untrue. No rooms yet ⇒ nothing to do.
 *
 * Fire-and-forget at the call site: a chat-membership refresh must never fail a registration.
 */
export async function refreshTournamentChatMembership(tournamentId: string): Promise<void> {
  try {
    const rooms = await listTournamentChatRooms(tournamentId);
    if (rooms.length === 0) return;
    for (const room of rooms) {
      try {
        await syncTournamentChatRoom({ room });
      } catch (err) {
        console.error(`[chat] membership refresh failed for room ${room.id}:`, err);
      }
    }
  } catch (err) {
    console.error(`[chat] membership refresh failed for tournament ${tournamentId}:`, err);
  }
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

// ── Staff rooms (Project 2A — one coach_peer room per premium rep team) ─────
// Spec: artifact 50a9d5aa v2 + IN_ORG_COACH_CHAT_RESCOPE_PLAN.md §5 (owner-approved 2026-07-29).
// Auto-created on first chat read by any of the team's current coaches; undeletable (no delete path
// exists); membership is DERIVED from the staff assignment — there is no organizer and no
// membership moderation here, so unlike tournament sync this one both removes a departed coach and
// re-activates a returning one (with a FRESH history watermark: CH-5 as amended, nobody inherits).

/** The staff room for a rep team, or null. Same duplicate-tolerant shape as the tournament lookup. */
export async function getStaffChatRoom(orgId: string, repTeamId: string): Promise<ChatRoom | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_rooms')
    .select(ROOM_COLS)
    .eq('surface', CHAT_SURFACE_COACH_PEER)
    .eq('ref_id', orgId)
    .eq('ref_sub_id', repTeamId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<RoomRow>();
  if (error) throw error;
  return data ? mapRoom(data) : null;
}

/**
 * Does this team qualify for a staff room? The org's plan must include `coach_peer_chat` (Club
 * tiers by rank; the standalone Premium Coaches Portal by explicit grant) — and a standalone
 * workspace additionally needs a LIVE team entitlement, mirroring getTeamScopedRepTeamAccess
 * (a club-tier org entitles its own teams; only the 'team' plan carries per-team billing).
 */
async function staffRoomQualifies(org: { id: string; plan: OrgPlan }, repTeamId: string): Promise<boolean> {
  if (!hasPlanFeature(org.plan, 'coach_peer_chat')) return false;
  if (org.plan === 'team') return Boolean(await getActiveTeamEntitlement(org.id, repTeamId));
  return true;
}

async function getOrgPlanForStaffRoom(orgId: string): Promise<{ id: string; plan: OrgPlan } | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, plan_id')
    .eq('id', orgId)
    .maybeSingle<{ id: string; plan_id: OrgPlan }>();
  if (error) throw error;
  return data ? { id: data.id, plan: data.plan_id } : null;
}

/** Create the team's staff room if absent AND the team qualifies (idempotent; race-tolerant). */
export async function ensureStaffChatRoom(team: StaffTeamForCoach): Promise<ChatRoom | null> {
  const existing = await getStaffChatRoom(team.orgId, team.repTeamId);
  if (existing) return existing; // qualification changes are handled by sync (archive), not delete
  const org = await getOrgPlanForStaffRoom(team.orgId);
  if (!org || !(await staffRoomQualifies(org, team.repTeamId))) return null;
  const { data, error } = await supabaseAdmin
    .from('chat_rooms')
    .insert({
      org_id: team.orgId,
      surface: CHAT_SURFACE_COACH_PEER,
      ref_id: team.orgId,
      ref_sub_id: team.repTeamId,
      // Approved naming rule: "<Team name> staff" — the team name keys the avatar colour/initials
      // and keeps two staff rooms tellable-apart for a multi-team coach (the F2 lesson).
      name: `${team.teamName} staff`,
    })
    .select(ROOM_COLS)
    .single<RoomRow>();
  if (error) {
    // The mig-150 dedupe index makes a concurrent create lose cleanly — re-fetch the winner.
    const raced = await getStaffChatRoom(team.orgId, team.repTeamId);
    if (raced) return raced;
    throw error;
  }
  return mapRoom(data);
}

/**
 * Reconcile a staff room against the team's CURRENT staff. Derivations, per the approved spec:
 *   • head coach → active moderator; assistants → active members (chat is NOT a capability toggle);
 *   • a departed coach's seat is removed (derived membership — this is not a moderation decision);
 *   • a returning coach is re-activated with a FRESH history watermark (sees from the newest join);
 *   • a NEW seat is stamped history_visible_from = now (CH-5 as amended: nobody inherits);
 *   • no current staff (season completed/archived) or a lapsed entitlement → the room goes
 *     READ-ONLY (archived) with seats untouched, and reopens by itself when a season/entitlement
 *     returns — the CH-1 read-only-persistence ruling applied to staff rooms.
 */
export async function syncStaffChatRoom(room: ChatRoom): Promise<{ activeCount: number }> {
  if (!isStaffRoom(room)) return { activeCount: 0 };
  const repTeamId = room.refSubId as string;

  // The org row and the membership rows are independent — fetch them together (one round-trip of
  // serial latency off every chat-list load; the rare no-staff path below still uses the map).
  const [org, existing] = await Promise.all([
    getOrgPlanForStaffRoom(room.orgId),
    fetchExistingMemberRows(room.id),
  ]);
  const qualifies = org ? await staffRoomQualifies(org, repTeamId) : false;
  const staff = qualifies ? await resolveStaffRoomParticipants(repTeamId) : [];

  if (staff.length === 0) {
    if (!room.isArchived) await setRoomArchived({ roomId: room.id, archived: true });
    let activeCount = 0;
    for (const cur of existing.values()) if (cur.status === 'active') activeCount += 1;
    return { activeCount };
  }
  if (room.isArchived) await setRoomArchived({ roomId: room.id, archived: false });

  const nowIso = new Date().toISOString();
  const staffByUser = new Map(staff.map(s => [s.userId, s.isHead]));
  const toInsert: Array<Record<string, unknown>> = [];

  for (const s of staff) {
    const role = s.isHead ? 'moderator' : 'member';
    const cur = existing.get(s.userId);
    if (!cur) {
      toInsert.push({
        room_id: room.id, user_id: s.userId, member_role: role, status: 'active',
        history_visible_from: nowIso,
      });
    } else if (cur.status !== 'active') {
      // Returning staff member: the seat revives, the history does not (fresh watermark).
      await supabaseAdmin
        .from('chat_room_members')
        .update({ status: 'active', member_role: role, muted_until: null, history_visible_from: nowIso })
        .eq('room_id', room.id)
        .eq('user_id', s.userId);
    } else if (cur.role !== role) {
      // Head↔assistant change: standing is derived from the CURRENT coach_role (F4 invariant).
      await supabaseAdmin
        .from('chat_room_members')
        .update({ member_role: role })
        .eq('room_id', room.id)
        .eq('user_id', s.userId);
    }
  }

  for (const [userId, cur] of existing) {
    if (staffByUser.has(userId) || cur.status === 'removed') continue;
    await supabaseAdmin
      .from('chat_room_members')
      .update({ member_role: 'member', status: 'removed' })
      .eq('room_id', room.id)
      .eq('user_id', userId);
  }

  await insertMemberRows(toInsert);

  // After reconcile the active set IS the current staff — every staff seat was inserted,
  // reactivated, or already active, and every non-staff row was just removed. No re-query.
  return { activeCount: staff.length };
}

/** Self-heal every staff room this coach belongs to (ensure + sync). Best-effort per team. */
async function healCoachStaffRooms(userId: string): Promise<void> {
  let teams: StaffTeamForCoach[] = [];
  try {
    teams = await resolveStaffTeamsForCoach(userId);
  } catch (err) {
    console.error('[chat-service] staff-team resolve failed (non-fatal):', err);
    return;
  }
  await Promise.all(teams.map(async (team) => {
    try {
      const room = await ensureStaffChatRoom(team);
      if (room) await syncStaffChatRoom(room);
    } catch (err) {
      console.error('[chat-service] staff-room self-heal failed (non-fatal):', err);
    }
  }));
}

/** Which notification scope a room's messages carry: staff rooms have no tournament and gate on the
 *  coach_peer_chat feature; tournament rooms keep their shipped shape. */
function notifyScopeForRoom(room: ChatRoom): { tournamentId?: string; requiredFeature: PlanFeature } {
  return room.surface === CHAT_SURFACE_COACH_PEER
    ? { requiredFeature: 'coach_peer_chat' }
    : { tournamentId: room.refId, requiredFeature: 'tournament_chat' };
}

// ── Room list (coach-facing) ────────────────────────────────────────────────

async function unreadCountForMember(
  roomId: string,
  lastReadAt: string | null,
  userId: string,
  /** mig 208: the member's history watermark — pre-join messages are never "unread" (they are
   *  invisible), so a freshly-seated coach doesn't land on a badge counting things they can't see. */
  visibleFrom?: string | null,
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
  if (visibleFrom) q = q.gte('sent_at', visibleFrom);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function lastMessageFor(
  roomId: string,
  /** mig 208: clamp the preview to the viewer's history watermark — the room list must never leak a
   *  pre-join message's text ("No messages yet" is the honest read for that member). */
  visibleFrom?: string | null,
): Promise<{ at: string; preview: string; senderUserId: string | null } | null> {
  let q = supabaseAdmin
    .from('chat_messages')
    .select('body, sent_at, deleted_at, sender_user_id')
    .eq('room_id', roomId)
    .order('sent_at', { ascending: false })
    .limit(1);
  if (visibleFrom) q = q.gte('sent_at', visibleFrom);
  const { data, error } = await q
    .maybeSingle<{ body: string; sent_at: string; deleted_at: string | null; sender_user_id: string | null }>();
  if (error) throw error;
  if (!data) return null;
  const preview = data.deleted_at ? 'Message removed' : data.body.slice(0, 120);
  return { at: data.sent_at, preview, senderUserId: data.sender_user_id };
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
  await Promise.all([
    ...tournamentIds.map(async (tid) => {
      try {
        await healCoachTournamentMemberships(userId, tid, { participationConfirmed: true });
      } catch (err) {
        console.error('[chat-service] membership self-heal failed (non-fatal):', err);
      }
    }),
    // Project 2A: the same read also ensures + reconciles the coach's team STAFF rooms (this is the
    // "auto-created on first chat visit" moment; qualification is checked inside).
    healCoachStaffRooms(userId),
  ]);

  // List from the membership table (covers both freshly-healed + previously-existing rooms).
  const { data: memberships, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('room_id, member_role, status, muted_until, last_read_at, notifications_muted_at, history_visible_from')
    .eq('user_id', userId)
    .neq('status', 'removed');
  if (error) throw error;
  if (!memberships || memberships.length === 0) return [];

  const roomIds = [...new Set(memberships.map(m => m.room_id as string))];
  const { data: roomRows, error: roomErr } = await supabaseAdmin
    .from('chat_rooms')
    .select(ROOM_COLS)
    .in('id', roomIds)
    .in('surface', [CHAT_SURFACE_TOURNAMENT, CHAT_SURFACE_COACH_PEER]);
  if (roomErr) throw roomErr;
  const roomById = new Map((roomRows ?? []).map(r => [r.id, mapRoom(r as RoomRow)]));

  // Tournament names + slugs for the rooms' subjects → a per-room context label (WI-1: and the
  // return-path slug) from ONE batched lookup — no separate slug query on the inbox path.
  const tournamentIdsForRooms = [...new Set(
    [...roomById.values()].filter((r) => r.surface === CHAT_SURFACE_TOURNAMENT).map((r) => r.refId),
  )];
  const tournamentNameById = new Map<string, string>();
  const tournamentSlugById = new Map<string, string>();
  // WI-1: only a PUBLISHED tournament (active|completed) has a public home; a draft would 404. Track
  // which are public so the return-path event chip is hidden (not a broken href) for draft events.
  const tournamentPublicById = new Map<string, boolean>();
  if (tournamentIdsForRooms.length > 0) {
    const { data: tRows, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, slug, status')
      .in('id', tournamentIdsForRooms);
    // Non-fatal: a failure just means rooms render without their context label / return-path chip.
    if (tErr) console.error('[chat-service] room context-label lookup failed (non-fatal):', tErr);
    for (const t of tRows ?? []) {
      tournamentNameById.set(t.id as string, t.name as string);
      if (t.slug) tournamentSlugById.set(t.id as string, t.slug as string);
      tournamentPublicById.set(t.id as string, t.status === 'active' || t.status === 'completed');
    }
  }

  // F2 (owner-ratified 2026-07-29) — a coach had NO signal of which divisions a room covered; the
  // organizer's free-text room name was the only clue, so "Championship" was a guess. Resolve the
  // covered division names in ONE batched lookup across every division room (never per room — this
  // function was deliberately refactored away from that pattern; see the note below).
  const allDivisionIds = [...new Set([...roomById.values()].flatMap(r => roomDivisionIds(r) ?? []))];
  const divisionNameById = new Map<string, string>();
  if (allDivisionIds.length > 0) {
    const { data: dRows, error: dErr } = await supabaseAdmin
      .from('divisions')
      .select('id, name')
      .in('id', allDivisionIds);
    // Non-fatal, like the context-label lookup: a failure just drops the label.
    if (dErr) console.error('[chat-service] room division-label lookup failed (non-fatal):', dErr);
    for (const d of dRows ?? []) divisionNameById.set(d.id as string, d.name as string);
  }

  /** Covered division names for a room, in the room's OWN stored order; null for All-coaches. */
  function divisionNamesFor(room: ChatRoom): string[] | null {
    const ids = roomDivisionIds(room);
    if (!ids || ids.length === 0) return null; // All-coaches — its name already says everything
    return ids.map(id => divisionNameById.get(id)).filter((n): n is string => Boolean(n));
  }

  // Project 2A: staff-room enrichment — the team's name (inbox kicker), the org slug + team id (the
  // portal's "Invite an assistant" link), and the active seat count (the staff-of-one nudge). Three
  // BATCHED lookups across all staff rooms; each is non-fatal (a failure only drops its label/CTA).
  const staffRooms = [...roomById.values()].filter(isStaffRoom);
  const staffTeamNameById = new Map<string, string>();
  const staffOrgSlugById = new Map<string, string>();
  const staffCountByRoomId = new Map<string, number>();
  if (staffRooms.length > 0) {
    const teamIds = [...new Set(staffRooms.map(r => r.refSubId as string))];
    const orgIds = [...new Set(staffRooms.map(r => r.orgId))];
    const [teamRes, orgRes, seatRes] = await Promise.all([
      supabaseAdmin.from('rep_teams').select('id, name').in('id', teamIds),
      supabaseAdmin.from('organizations').select('id, slug').in('id', orgIds),
      supabaseAdmin.from('chat_room_members').select('room_id')
        .in('room_id', staffRooms.map(r => r.id)).eq('status', 'active'),
    ]);
    if (teamRes.error) console.error('[chat-service] staff team-name lookup failed (non-fatal):', teamRes.error);
    for (const t of teamRes.data ?? []) if (t.name) staffTeamNameById.set(t.id as string, t.name as string);
    if (orgRes.error) console.error('[chat-service] staff org-slug lookup failed (non-fatal):', orgRes.error);
    for (const o of orgRes.data ?? []) if (o.slug) staffOrgSlugById.set(o.id as string, o.slug as string);
    if (seatRes.error) console.error('[chat-service] staff seat-count lookup failed (non-fatal):', seatRes.error);
    for (const s of seatRes.data ?? []) {
      const rid = s.room_id as string;
      staffCountByRoomId.set(rid, (staffCountByRoomId.get(rid) ?? 0) + 1);
    }
  }

  // Per-room last-message + unread in parallel (was O(rooms) sequential round-trips).
  const items = (await Promise.all(memberships.map(async (m) => {
    const room = roomById.get(m.room_id as string);
    if (!room) return null;
    const visibleFrom = m.history_visible_from as string | null;
    const [last, unreadCount] = await Promise.all([
      lastMessageFor(room.id, visibleFrom),
      unreadCountForMember(room.id, m.last_read_at as string | null, userId, visibleFrom),
    ]);
    const mutedUntil = m.muted_until as string | null;
    const staff = isStaffRoom(room);
    return {
      room,
      unreadCount,
      lastMessageAt: last?.at ?? null,
      lastMessagePreview: last?.preview ?? null,
      lastMessageSenderId: last?.senderUserId ?? null,
      isModerator: m.member_role === 'moderator',
      selfMutedUntil: mutedUntil && new Date(mutedUntil) > new Date() ? mutedUntil : null,
      selfNotifMuted: Boolean(m.notifications_muted_at),
      readOnly: room.isArchived,
      contextLabel: staff ? null : tournamentNameById.get(room.refId) ?? null,
      tournamentSlug: staff ? null : tournamentSlugById.get(room.refId) ?? null,
      tournamentIsPublic: staff ? false : tournamentPublicById.get(room.refId) ?? false,
      divisionNames: staff ? null : divisionNamesFor(room),
      isStaffRoom: staff,
      staffTeamName: staff ? staffTeamNameById.get(room.refSubId as string) ?? null : null,
      staffTeamId: staff ? room.refSubId : null,
      staffOrgSlug: staff ? staffOrgSlugById.get(room.orgId) ?? null : null,
      staffMemberCount: staff ? staffCountByRoomId.get(room.id) ?? null : null,
    } as ChatRoomListItem;
  }))).filter((x): x is ChatRoomListItem => x !== null);

  // F3 (owner-ratified 2026-07-29) — "All coaches" pins to the top for coaches, as it already did
  // for organizers. It is the one room everyone in the event belongs to, and under a plain recency
  // sort it sank below whichever division room happened to be chatty.
  //
  // Pinning is only meaningful WITHIN a tournament, so rooms cluster by event first — otherwise a
  // dormant All-coaches room from a finished event would outrank a live conversation in the event
  // being played today. Clusters order by their most recent activity, so the busy event still
  // surfaces first. For a coach in ONE event (the common case) this reduces exactly to
  // "All coaches first, then by recency".
  const clusterActivity = new Map<string, string>();
  for (const it of items) {
    const cur = clusterActivity.get(it.room.refId) ?? '';
    const mine = it.lastMessageAt ?? '';
    if (mine.localeCompare(cur) > 0) clusterActivity.set(it.room.refId, mine);
  }
  items.sort((a, b) => {
    // Project 2A: staff rooms pin ABOVE the event clusters (approved mockup) — a standing room
    // beats transient event rooms. Among several staff rooms (multi-team coach): recency, id
    // tie-break for determinism.
    const aStaff = Boolean(a.isStaffRoom);
    const bStaff = Boolean(b.isStaffRoom);
    if (aStaff !== bStaff) return aStaff ? -1 : 1;
    if (aStaff && bStaff) {
      const byActivity = (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');
      return byActivity !== 0 ? byActivity : a.room.id.localeCompare(b.room.id);
    }
    if (a.room.refId !== b.room.refId) {
      const byActivity = (clusterActivity.get(b.room.refId) ?? '').localeCompare(clusterActivity.get(a.room.refId) ?? '');
      // Tie-break on the id so clusters stay CONTIGUOUS when several tournaments are equally silent
      // (a coach freshly added to two events — both '' activity). Without it the sort is stable but
      // the rows keep their arbitrary DB order, so one event's rooms can interleave with another's
      // and the inbox's group-by-first-seen ordering becomes incidental rather than the stated rule.
      return byActivity !== 0 ? byActivity : a.room.refId.localeCompare(b.room.refId);
    }
    const aAll = (roomDivisionIds(a.room) ?? []).length === 0;
    const bAll = (roomDivisionIds(b.room) ?? []).length === 0;
    if (aAll !== bAll) return aAll ? -1 : 1; // All-coaches first inside its own event
    return (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');
  });
  return items;
}

/** Total unread across all the coach's rooms (portal + consumer-nav badge). Does NOT self-heal (cheap).
 *  Self-muted rooms (notifications_muted_at set) are EXCLUDED — a muted room never contributes to any
 *  unread count (Unified Home R3-1). Coaches can't self-mute today, so this is a no-op for them. */
/** Cheap "is this user in ANY chat room they'd see in /chat" — drives whether
 *  client-resolved chrome (the tournament strip's fan state) shows a Chat door at all.
 *  Membership, not unread: a fan with a silent team chat still gets the door; a fan with
 *  no rooms never does. Liveness filter matches listRoomsForUser (`neq 'removed'`, the
 *  file's what-the-inbox-shows convention) so the door can never disagree with the inbox. */
export async function userHasChatMembership(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('room_id')
    .eq('user_id', userId)
    .neq('status', 'removed')
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function getUnreadTotalForUser(userId: string): Promise<number> {
  const { data: memberships, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('room_id, last_read_at, history_visible_from')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('notifications_muted_at', null);
  if (error) throw error;
  const counts = await Promise.all((memberships ?? []).map(m =>
    unreadCountForMember(m.room_id as string, m.last_read_at as string | null, userId,
      m.history_visible_from as string | null)));
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

/**
 * Resolve each window row's reply-quote FOR THIS VIEWER (mig 208 review). Two jobs, one batched
 * fetch of the referenced messages:
 *   • id-only quotes (coach_peer rooms persist `{ id }`, never text) are hydrated from the real
 *     target — name + snippet built server-side, exactly like buildReplyRef at send time;
 *   • when the viewer is watermarked, a quote whose target predates the watermark (or is missing)
 *     becomes an anonymous hidden stub — id BLANKED too, because the raw id was the oracle key
 *     that let a watermarked member interrogate other endpoints about the hidden message.
 * Tournament rows (denormalized quotes, no watermark) skip the fetch entirely and pass through.
 * Returns a map keyed by the REPLY message's id; absent key = that row has no (usable) quote.
 */
async function resolveReplyRefsForViewer(
  rows: MessageRow[],
  visibleFrom: string | null | undefined,
): Promise<Map<string, ReplyRef>> {
  const out = new Map<string, ReplyRef>();
  const entries: Array<{ rowId: string; ref: ReplyRef }> = [];
  for (const r of rows) {
    if (r.deleted_at) continue;
    const ref = extractReplyTo(r.metadata);
    if (ref) entries.push({ rowId: r.id, ref });
  }
  if (entries.length === 0) return out;

  const needsFetch = Boolean(visibleFrom) || entries.some(e => !e.ref.snippet);
  if (!needsFetch) {
    for (const e of entries) out.set(e.rowId, e.ref);
    return out;
  }

  const targetIds = [...new Set(entries.map(e => e.ref.id))];
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender_user_id, body, deleted_at, sent_at')
    .in('id', targetIds);
  if (error) throw error;
  const targetById = new Map((data ?? []).map(t => [t.id as string, t as {
    id: string; sender_user_id: string | null; body: string; deleted_at: string | null; sent_at: string;
  }]));

  const cutoff = visibleFrom ? new Date(visibleFrom).getTime() : null;
  const hydrateIds = [...new Set(entries
    .filter(e => !e.ref.snippet)
    .map(e => targetById.get(e.ref.id)?.sender_user_id)
    .filter((v): v is string => Boolean(v)))];
  const display = hydrateIds.length > 0 ? await hydrateUserDisplay(hydrateIds) : new Map<string, { name: string; email: string | null }>();

  for (const e of entries) {
    const target = targetById.get(e.ref.id);
    if (cutoff !== null && (!target || new Date(target.sent_at).getTime() < cutoff)) {
      // Fail closed: a missing target is treated as hidden, never as "show what the metadata says".
      out.set(e.rowId, { id: '', name: '', snippet: '', hidden: true });
    } else if (!e.ref.snippet) {
      // id-only quote → hydrate from the real row; a deleted/missing target degrades to the
      // client's generic "Message" fallback (empty snippet), matching the shipped deleted-quote UX.
      const usable = target && !target.deleted_at;
      const name = usable && target.sender_user_id
        ? display.get(target.sender_user_id)?.name ?? 'Coach'
        : 'Coach';
      out.set(e.rowId, {
        id: e.ref.id,
        name,
        snippet: usable ? target.body.slice(0, REPLY_SNIPPET_MAX) : '',
      });
    } else {
      out.set(e.rowId, e.ref);
    }
  }
  return out;
}

/** Build an authoritative reply snippet from the REAL referenced message (same room, not deleted).
 *  `senderVisibleFrom` (mig 208 review): a WATERMARKED sender may not quote a message they cannot
 *  see — without this, the send response was a one-request oracle returning a pre-join message's
 *  author + snippet. Invisible target → the quote is silently dropped, like any other invalid ref. */
async function buildReplyRef(
  roomId: string,
  messageId: string,
  senderVisibleFrom?: string | null,
): Promise<ReplyRef | null> {
  if (!UUID_RE.test(messageId)) return null; // malformed id → drop the quote (don't fail the send)
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender_user_id, body, deleted_at, sent_at')
    .eq('id', messageId)
    .eq('room_id', roomId)
    .maybeSingle<{ id: string; sender_user_id: string | null; body: string; deleted_at: string | null; sent_at: string }>();
  if (error) throw error;
  if (!data || data.deleted_at) return null; // don't quote a missing / removed / cross-room message
  if (senderVisibleFrom && new Date(data.sent_at).getTime() < new Date(senderVisibleFrom).getTime()) {
    return null;
  }
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
  opts: {
    before?: string | null;
    limit?: number;
    /** mig 208: the CALLER's history watermark (chat_room_members.history_visible_from). The app
     *  reads via the service role, so the RLS predicate doesn't apply here — pass the membership's
     *  value so a watermarked member never receives a pre-join message (or a quote of one). */
    visibleFrom?: string | null;
  } = {},
): Promise<{ messages: ChatMessageView[]; participants: Record<string, string>; hasMore: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  let q = supabaseAdmin
    .from('chat_messages')
    .select('id, room_id, sender_user_id, body, deleted_at, sent_at, metadata, pinned_at')
    .eq('room_id', roomId)
    .order('sent_at', { ascending: false })
    .limit(limit + 1);
  if (opts.before) q = q.lt('sent_at', opts.before);
  if (opts.visibleFrom) q = q.gte('sent_at', opts.visibleFrom);
  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as MessageRow[];
  const hasMore = rows.length > limit;
  const windowRows = hasMore ? rows.slice(0, limit) : rows;

  const senderIds = windowRows.map(r => r.sender_user_id).filter((v): v is string => Boolean(v));
  const display = await hydrateUserDisplay(senderIds);
  const participants: Record<string, string> = {};
  for (const [id, info] of display) participants[id] = info.name;

  // Per-viewer quote resolution (mig 208 review): hydrates id-only coach_peer quotes and replaces
  // quotes of pre-watermark targets with an anonymous hidden stub. One batched fetch, and a no-op
  // pass-through for the common tournament case.
  const replyRefs = await resolveReplyRefsForViewer(windowRows, opts.visibleFrom);

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
      replyTo: r.deleted_at ? null : replyRefs.get(r.id) ?? null,
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

  // Reply: rebuild the quote from the real referenced message (anti-spoof); drop it if invalid —
  // including a target the SENDER's own history watermark hides (mig 208 review).
  const replyTo = params.replyToId
    ? await buildReplyRef(params.roomId, params.replyToId, membership.history_visible_from)
    : null;

  // Mentions: keep only ids that are REAL active members; resolve display names server-side (anti-spoof).
  // One query yields both the recipient set AND who self-muted (for push suppression below).
  const { activeIds, mutedIds } = await getActiveMembersWithMute(params.roomId);
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
  // coach_peer rooms persist the quote as a REFERENCE only ({ id }) — never the quoted text/name.
  // The denormalized snippet is readable by ANY member who can see the reply (direct select, the
  // realtime payload), and a member seated between the target and the reply must not see it
  // (mig 208 review, Critical). Readers get quotes hydrated per-viewer in resolveReplyRefsForViewer;
  // tournament rooms keep the shipped denormalized shape (no watermarks exist there).
  if (replyTo) metadata.replyTo = isCoachPeerRoom(room) ? { id: replyTo.id } : replyTo;
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
    // Members who self-muted this room chose silence — drop them from the general fan-out (a direct
    // @mention still pierces, being targeted). `mutedIds` came free with the recipient query above.
    const general = activeIds.filter(
      id => id !== params.senderUserId && !mentionedIds.has(id) && !mutedIds.has(id),
    );
    // Staff rooms notify without a tournament scope + gate on coach_peer_chat (Project 2A);
    // tournament rooms keep their shipped scope. Same events, same bell/push — no new infra.
    const scope = notifyScopeForRoom(room);
    if (general.length > 0) {
      await notify({
        orgId: room.orgId,
        ...scope,
        eventType: 'chat_message',
        title: room.name,
        body: `${senderName}: ${body.slice(0, 140)}`,
        userIds: general,
        excludeUserIds: [params.senderUserId],
        // WI-2: land the push in the room itself (sw.js opens payload.link; was falling back to '/').
        link: `/chat?room=${params.roomId}`,
      });
    }
    if (mentionedIds.size > 0) {
      await notify({
        orgId: room.orgId,
        ...scope,
        eventType: 'chat_mention',
        title: room.name,
        body: `${senderName} mentioned you: ${body.slice(0, 120)}`,
        userIds: [...mentionedIds],
        excludeUserIds: [params.senderUserId],
        // WI-2: land the push in the conversation itself.
        link: `/chat?room=${params.roomId}`,
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

/**
 * mig 208: does this message exist in the room, and does the member's history watermark allow them
 * to see it? 'not_found' = no such message in this room; a NULL/absent watermark = always visible.
 * Route-facing (the coach_peer moderation routes gate pin/remove on it — "moderate only what you
 * can see"), so the chat_messages access stays in this module.
 */
export async function isMessageVisibleToMember(
  roomId: string,
  messageId: string,
  visibleFrom: string | null | undefined,
): Promise<boolean | 'not_found'> {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('sent_at')
    .eq('id', messageId)
    .eq('room_id', roomId)
    .maybeSingle<{ sent_at: string }>();
  if (error) throw error;
  if (!data) return 'not_found';
  if (!visibleFrom) return true;
  return new Date(data.sent_at).getTime() >= new Date(visibleFrom).getTime();
}

/** mig 208 review hardening: interactions (react, vote, close, quote) may only target a message the
 *  member can SEE. No-op for unwatermarked members — one extra query only when a watermark exists. */
async function assertMessageVisible(
  roomId: string,
  messageId: string,
  visibleFrom: string | null | undefined,
): Promise<void> {
  if (!visibleFrom) return;
  const visible = await isMessageVisibleToMember(roomId, messageId, visibleFrom);
  if (visible !== true) throw new ChatError('forbidden', 'That message is not available to you.', 403);
}

/** mig 208 review hardening: clamp a client-supplied messageIds list to the caller's watermark —
 *  without this, reaction/vote summary endpoints were an oracle for pre-join message metadata. */
async function filterVisibleMessageIds(
  roomId: string,
  ids: string[],
  visibleFrom: string | null | undefined,
): Promise<string[]> {
  if (!visibleFrom || ids.length === 0) return ids;
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id')
    .eq('room_id', roomId)
    .in('id', ids)
    .gte('sent_at', visibleFrom);
  if (error) throw error;
  return (data ?? []).map(r => r.id as string);
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

/** The room's currently-pinned messages (newest pin first), for the pinned banner. Excludes deleted.
 *  `visibleFrom` (mig 208): a pin whose message predates the viewer's watermark is HIDDEN from them
 *  — a pin is a spotlight on a message, and this viewer cannot see the message. */
export async function getPinnedMessages(roomId: string, visibleFrom?: string | null): Promise<ChatMessageView[]> {
  let q = supabaseAdmin
    .from('chat_messages')
    .select('id, room_id, sender_user_id, body, deleted_at, sent_at, metadata, pinned_at')
    .eq('room_id', roomId)
    .not('pinned_at', 'is', null)
    .is('deleted_at', null)
    .order('pinned_at', { ascending: false })
    .limit(20);
  if (visibleFrom) q = q.gte('sent_at', visibleFrom);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as MessageRow[];
  const senderIds = rows.map(r => r.sender_user_id).filter((v): v is string => Boolean(v));
  // Same per-viewer quote rules as history (mig 208 review): a VISIBLE pinned message can still
  // quote a pre-watermark target, and coach_peer pins carry id-only quotes needing hydration.
  const [display, replyRefs] = await Promise.all([
    hydrateUserDisplay(senderIds),
    resolveReplyRefsForViewer(rows, visibleFrom),
  ]);
  return rows.map(r => ({
    id: r.id,
    roomId: r.room_id,
    senderUserId: r.sender_user_id,
    senderName: r.sender_user_id ? display.get(r.sender_user_id)?.name ?? 'Coach' : 'Coach',
    body: r.body,
    deletedAt: r.deleted_at,
    sentAt: r.sent_at,
    replyTo: replyRefs.get(r.id) ?? null,
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
  /** mig 208 review: clamp to the caller's watermark — pre-join messageIds yield nothing. */
  visibleFrom?: string | null,
): Promise<MessageReactionsMap> {
  const ids = await filterVisibleMessageIds(roomId, [...new Set(messageIds.filter(Boolean))], visibleFrom);
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

  // The reacted-to message must exist in THIS room, not be deleted, and be VISIBLE to the caller
  // (mig 208 review: reacting to a pre-watermark message is interacting with hidden history).
  await assertMessageVisible(params.roomId, params.messageId, membership.history_visible_from);
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
  /** mig 208 review: a watermarked caller gets nothing for a pre-join message. */
  visibleFrom?: string | null;
}): Promise<MentionRef[]> {
  if (!isReactionEmoji(params.emoji)) return [];
  if (params.visibleFrom) {
    const visible = await isMessageVisibleToMember(params.roomId, params.messageId, params.visibleFrom);
    if (visible !== true) return [];
  }
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
  /** mig 208 review: clamp to the caller's watermark — pre-join poll ids yield nothing. */
  visibleFrom?: string | null,
): Promise<PollTalliesMap> {
  const ids = await filterVisibleMessageIds(roomId, [...new Set(messageIds.filter(Boolean))], visibleFrom);
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
  /** mig 208 review: a watermarked caller gets nothing for a pre-join poll. */
  visibleFrom?: string | null;
}): Promise<MentionRef[]> {
  if (params.visibleFrom) {
    const visible = await isMessageVisibleToMember(params.roomId, params.messageId, params.visibleFrom);
    if (visible !== true) return [];
  }
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
        ...notifyScopeForRoom(room),
        eventType: 'chat_message',
        title: room.name,
        body: `${senderName} posted a poll: ${valid.question.slice(0, 120)}`,
        userIds: recipients,
        excludeUserIds: [params.byUserId],
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
  // mig 208 review: voting on a pre-watermark poll is interacting with hidden history.
  await assertMessageVisible(params.roomId, params.messageId, membership.history_visible_from);

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
  // mig 208 review: a watermarked moderator moderates only what they can see.
  await assertMessageVisible(params.roomId, params.messageId, membership.history_visible_from);
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

// ── Consumer inbox + self-mute (Unified Home Phase 4) ────────────────────────

/**
 * Toggle the caller's OWN "Mute this room" (Unified Home R3-2). Distinct from the organizer mute
 * (`muted_until`): a self-mute silences pushes + drops the room from every unread count, but the member
 * keeps read AND post access. Service-role write (the member's column grant is `last_read_at` only).
 */
export async function setSelfMute(params: {
  roomId: string;
  userId: string;
  muted: boolean;
}): Promise<{ muted: boolean }> {
  const membership = await getMembership(params.roomId, params.userId);
  if (!membership || membership.status === 'removed') {
    throw new ChatError('not_member', 'You are not a member of this conversation.', 403);
  }
  const { error } = await supabaseAdmin
    .from('chat_room_members')
    .update({ notifications_muted_at: params.muted ? new Date().toISOString() : null })
    .eq('room_id', params.roomId)
    .eq('user_id', params.userId);
  if (error) throw error;
  return { muted: params.muted };
}

/** One conversation in the consumer cross-context inbox — a room, grouped by its event. */
export type ChatInboxRoom = {
  roomId: string;
  /** the room's role within its event ("All coaches" or a division room's name). */
  roomName: string;
  /** grouping key = the tournament this room belongs to (chat_rooms.ref_id). */
  eventId: string;
  /** the event group's mono kicker (tournament name). */
  eventName: string | null;
  /** WI-1: return-path slugs for the open-room header. The event chip links to
   *  `/${orgSlug}/${tournamentSlug}`; both are null-guarded (a suspended org degrades to no chip,
   *  never a broken href). Resolved best-effort — a lookup failure leaves them null. */
  orgSlug: string | null;
  tournamentSlug: string | null;
  /** WI-1: the tournament is published (has a public home). The event chip is hidden when false
   *  (a draft tournament's public page 404s), even though the room + admin door still work. */
  tournamentIsPublic: boolean;
  /** WI-1: the caller moderates this room (org owner/admin) — gates the "Event admin" header link. */
  isModerator: boolean;
  /** Project 2A: a team staff room. The header's "Event admin" link must NOT render for these —
   *  their moderator is the head coach (no admin surface exists), and eventId is not a tournament. */
  isStaffRoom: boolean;
  /** F2: the divisions this room covers, comma-joined ("9U, 10U"); null for the All-coaches room.
   *  "Division room" when the room is division-scoped but those divisions have been deleted. */
  divisionLabel?: string | null;
  /** unread for the caller — forced to 0 when self-muted (a muted room never badges). */
  unreadCount: number;
  selfNotifMuted: boolean;
  readOnly: boolean;
  lastMessageAt: string | null;
  /** sender-prefixed one-line preview: "You: …" / "Organizer: …" / "{name}: …" (plain for system/removed). */
  preview: string | null;
};

export type ChatInbox = { rooms: ChatInboxRoom[]; unreadTotal: number };

/**
 * The signed-in member's cross-context chat inbox (Unified Home Phase 4 / R3-1): every active room
 * across all their tournaments, newest-activity first, grouped by event, with sender-prefixed previews
 * and a mute-excluded unread rollup. Builds on `listRoomsForUser` (which self-heals memberships on
 * load — a coach never sees a false "no chats"), then enriches previews with the last sender's label.
 */
export async function getChatInboxForUser(userId: string): Promise<ChatInbox> {
  const items = await listRoomsForUser(userId);
  if (items.length === 0) return { rooms: [], unreadTotal: 0 };

  // Resolve the last-message sender's label per room: "You" (self), "Organizer" (moderator), or their
  // display name. The role lookup and the name hydration both depend only on senderIds — run them
  // together rather than back-to-back (one round-trip off every inbox load).
  const senderIds = [...new Set(items.map((i) => i.lastMessageSenderId).filter((v): v is string => Boolean(v)))];
  // WI-1: resolve ORG slugs for the return-path header links, alongside the existing sender-label
  // lookups (one more parallel round-trip, not a serial one). The tournament slug already rode in on
  // `items` (from listRoomsForUser's context-label lookup) — no separate query. Non-fatal: a failure
  // leaves the map empty and the header simply renders without the chip / admin link.
  const orgIds = [...new Set(items.map((i) => i.room.orgId).filter(Boolean))];
  const [roleRows, display, orgSlugById] = await Promise.all([
    (async () => {
      if (senderIds.length === 0) return [] as Array<{ room_id: string; user_id: string; member_role: string }>;
      const { data, error } = await supabaseAdmin
        .from('chat_room_members')
        .select('room_id, user_id, member_role')
        .in('room_id', items.map((i) => i.room.id))
        .in('user_id', senderIds);
      if (error) throw error;
      return (data ?? []) as Array<{ room_id: string; user_id: string; member_role: string }>;
    })(),
    hydrateUserDisplay(senderIds),
    (async () => {
      const map = new Map<string, string>();
      if (orgIds.length === 0) return map;
      const { data, error } = await supabaseAdmin
        .from('organizations')
        .select('id, slug')
        .in('id', orgIds);
      if (error) { console.error('[chat-service] inbox org-slug lookup failed (non-fatal):', error); return map; }
      for (const o of data ?? []) if (o.slug) map.set(o.id as string, o.slug as string);
      return map;
    })(),
  ]);
  const roleByRoomUser = new Map<string, string>();
  for (const r of roleRows) roleByRoomUser.set(`${r.room_id}:${r.user_id}`, r.member_role);

  const rooms: ChatInboxRoom[] = items.map((i) => {
    const muted = Boolean(i.selfNotifMuted);
    let preview = i.lastMessagePreview;
    const sid = i.lastMessageSenderId ?? null;
    // Prefix with the sender — but never a system message (no sender) or an already-removed placeholder.
    if (preview && preview !== 'Message removed' && sid) {
      if (sid === userId) {
        preview = `You: ${preview}`;
      } else {
        const role = roleByRoomUser.get(`${i.room.id}:${sid}`);
        // A staff room's moderator is the head coach, not an organizer — always use their name there.
        const label = role === 'moderator' && !i.isStaffRoom ? 'Organizer' : (display.get(sid)?.name ?? 'Coach');
        preview = `${label}: ${preview}`;
      }
    }
    return {
      roomId: i.room.id,
      roomName: roomDisplayName(i.room),
      // Staff rooms group per-ROOM (their ref_id is the org — two teams in one club must not share
      // a kicker), labelled with the team's name (approved mockup 4).
      eventId: i.isStaffRoom ? `staff:${i.room.id}` : i.room.refId,
      // Only the real tournament name is an event label; if the name lookup failed (contextLabel null),
      // leave it null so the client renders its generic "Conversations" kicker — never a lone room's name.
      eventName: i.isStaffRoom ? i.staffTeamName ?? null : i.contextLabel,
      orgSlug: orgSlugById.get(i.room.orgId) ?? null,
      tournamentSlug: i.tournamentSlug,
      tournamentIsPublic: i.tournamentIsPublic,
      isModerator: i.isModerator,
      isStaffRoom: Boolean(i.isStaffRoom),
      unreadCount: muted ? 0 : i.unreadCount,
      selfNotifMuted: muted,
      readOnly: i.readOnly,
      lastMessageAt: i.lastMessageAt,
      preview,
      // F2: which divisions this room covers. The inbox already groups by event, so the tournament
      // name is carried by the group kicker — divisions are the piece a coach was missing. Shared
      // helper so this and the coach-portal switcher can never word the fallback differently.
      divisionLabel: divisionScopeLabel(i.divisionNames),
    };
  });
  // `listRoomsForUser` already sorted newest-activity first; keep that order (the client groups by event,
  // first-seen order = most-recently-active group first).
  const unreadTotal = rooms.reduce((sum, r) => sum + r.unreadCount, 0);
  return { rooms, unreadTotal };
}

// ── Message reports (member → organizer queue; Unified Home Phase 4 / R3-2) ──

/** A reported message as the organizer sees it in the Manage-room panel's Reports queue. */
export type ChatReportView = {
  id: string;
  messageId: string;
  reporterName: string;
  reason: string | null;
  createdAt: string;
  /** the reported message (null if the row is gone); `body` is '' when the message was already removed. */
  message: { senderName: string; body: string; deletedAt: string | null; sentAt: string } | null;
};

/**
 * File a member's report on a message (long-press → "Report to organizers"). Verifies the reporter is
 * an active member of the room and the message belongs to it; you cannot report your own message.
 * Idempotent while a report is OPEN — a repeat report is a no-op ('exists'); once the prior report is
 * resolved the partial-unique index no longer conflicts, so a fresh report is filed ('ok').
 */
export async function createMessageReport(params: {
  roomId: string;
  messageId: string;
  reporterUserId: string;
}): Promise<'ok' | 'exists'> {
  const room = await getRoomById(params.roomId);
  if (!room) throw new ChatError('not_found', 'Conversation not found.', 404);
  const membership = await getMembership(params.roomId, params.reporterUserId);
  if (!membership || membership.status === 'removed') {
    throw new ChatError('not_member', 'You are not a member of this conversation.', 403);
  }
  const { data: msg, error: msgErr } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender_user_id')
    .eq('id', params.messageId)
    .eq('room_id', params.roomId)
    .maybeSingle<{ id: string; sender_user_id: string | null }>();
  if (msgErr) throw msgErr;
  if (!msg) throw new ChatError('not_found', 'Message not found.', 404);
  if (msg.sender_user_id && msg.sender_user_id === params.reporterUserId) {
    throw new ChatError('invalid', 'You cannot report your own message.', 400);
  }

  const { error } = await supabaseAdmin.from('chat_message_reports').insert({
    room_id: params.roomId,
    message_id: params.messageId,
    org_id: room.orgId,
    reporter_user_id: params.reporterUserId,
  });
  if (error) {
    if ((error as { code?: string }).code === '23505') return 'exists'; // one report per member per message
    throw error;
  }
  return 'ok';
}

/** Count of open reports in a room — drives the "Reports · N" badge on the organizer Manage button. */
export async function countOpenReportsForRoom(roomId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('chat_message_reports')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('status', 'open');
  if (error) throw error;
  return count ?? 0;
}

/** The open reports for a room (newest first), each with the reported message + reporter, for the queue. */
export async function listOpenReportsForRoom(roomId: string): Promise<ChatReportView[]> {
  const { data: reports, error } = await supabaseAdmin
    .from('chat_message_reports')
    .select('id, message_id, reporter_user_id, reason, created_at')
    .eq('room_id', roomId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!reports || reports.length === 0) return [];

  const messageIds = [...new Set(reports.map((r) => r.message_id as string))];
  const { data: msgs, error: msgErr } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender_user_id, body, deleted_at, sent_at')
    .in('id', messageIds);
  if (msgErr) throw msgErr;
  const msgById = new Map((msgs ?? []).map((m) => [m.id as string, m]));

  const userIds = [
    ...reports.map((r) => r.reporter_user_id as string),
    ...(msgs ?? []).map((m) => m.sender_user_id as string).filter(Boolean),
  ];
  const display = await hydrateUserDisplay(userIds);

  return reports.map((r) => {
    const m = msgById.get(r.message_id as string);
    return {
      id: r.id as string,
      messageId: r.message_id as string,
      reporterName: display.get(r.reporter_user_id as string)?.name ?? 'A member',
      reason: (r.reason as string | null) ?? null,
      createdAt: r.created_at as string,
      message: m
        ? {
            senderName: m.sender_user_id ? (display.get(m.sender_user_id as string)?.name ?? 'Coach') : 'Coach',
            body: m.deleted_at ? '' : (m.body as string),
            deletedAt: m.deleted_at as string | null,
            sentAt: m.sent_at as string,
          }
        : null,
    };
  });
}

/** The shared resolution patch — one place to change if the schema grows (e.g. a resolution note). */
function reportResolution(status: 'actioned' | 'dismissed', byUserId: string) {
  return { status, resolved_by_user_id: byUserId, resolved_at: new Date().toISOString() };
}

/** Resolve ONE report (dismiss). Scoped to the room so an organizer can only act on their own room's queue. */
export async function resolveMessageReport(params: {
  reportId: string;
  roomId: string;
  status: 'actioned' | 'dismissed';
  byUserId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('chat_message_reports')
    .update(reportResolution(params.status, params.byUserId))
    .eq('id', params.reportId)
    .eq('room_id', params.roomId)
    .eq('status', 'open');
  if (error) throw error;
}

/** Close EVERY open report on a message (used when the organizer removes the reported message → 'actioned'). */
export async function resolveReportsForMessage(params: {
  roomId: string;
  messageId: string;
  status: 'actioned' | 'dismissed';
  byUserId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('chat_message_reports')
    .update(reportResolution(params.status, params.byUserId))
    .eq('room_id', params.roomId)
    .eq('message_id', params.messageId)
    .eq('status', 'open');
  if (error) throw error;
}
