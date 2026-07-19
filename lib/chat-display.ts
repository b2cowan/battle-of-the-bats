/**
 * Pure, client-safe chat display helpers. Kept OUT of lib/chat-service.ts (which is `server-only`) so
 * BOTH server code and client components can share the same rules — the same pattern as the pure
 * lib/chat-reactions.ts / lib/chat-polls.ts modules. Keep this dependency-free.
 */

/**
 * A room's display name WITHIN its event: the default room (no `ref_sub_id`) reads "All coaches"; a
 * division room reads its own organizer-chosen name. Single source of truth for the room-name rule
 * shared by the consumer inbox, the organizer room switcher, and the admin chat header.
 */
export function roomDisplayName(room: { refSubId: string | null; name: string }): string {
  return room.refSubId == null ? 'All coaches' : room.name;
}
