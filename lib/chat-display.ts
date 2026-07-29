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

/**
 * F2 — the quiet line under a room's name, naming the divisions it covers.
 *
 * Single source of truth for the fallback rules, which are shared by the consumer inbox (server-
 * rendered label) and the coach-portal switcher (client-rendered): an earlier revision implemented
 * them twice and they would have drifted the first time the wording changed.
 *
 *   null / undefined → the All-coaches room. No divisions to name.
 *   []               → division-scoped, but those divisions have since been deleted.
 *   [names]          → the covered divisions, in the room's own stored order.
 */
export function divisionScopeLabel(divisionNames: string[] | null | undefined): string | null {
  if (divisionNames == null) return null;
  if (divisionNames.length === 0) return 'Division room';
  return divisionNames.join(', ');
}
