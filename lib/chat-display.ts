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

/**
 * THIS TEAM'S ROOMS FIRST (phone re-evaluation stage 5 · F3, owner ruling 2026-09-23 — option B).
 *
 * The coach portal's room list is per-USER (`/api/chat/rooms` takes no team), so a coach standing
 * in Team A's Chat read every staff room they sit in, newest activity first, with nothing putting
 * Team A's own room first. This reorders it for the team in the address, in three groups, each
 * keeping the server's order within it (a stable partition — never a re-sort):
 *
 *   1. this team's staff room(s);
 *   2. rooms that belong to NO team — the tournament rooms an organizer opens;
 *   3. other teams' staff rooms — the only group the "Your other teams" divider introduces.
 *
 * ⚠ The tournament rooms sit ABOVE the divider on purpose. The drawing's note put them "below both
 * groups", which would have put them under a label saying "Your other teams" — a label that is not
 * true of them. A divider is a claim about what follows it.
 *
 * ⚠⚠ CLIENT-SIDE, AND IT MUST STAY HERE. `listRoomsForUser` also feeds the CONSUMER chat inbox
 * (`getChatInbox`, whose own comment says it relies on the newest-activity order). Sorting in the
 * service would silently reorder that inbox too — and the service could not do it anyway, because
 * it does not know which team the coach is standing in. Guarded in coach-people-phone-guard.
 *
 * `dividerAt` is the index of the first other-team room, or -1 when none is listed (no divider).
 */
export function orderRoomsForTeam<T extends { isStaffRoom?: boolean; staffTeamId?: string | null }>(
  rooms: T[],
  teamId: string | null | undefined,
): { rooms: T[]; dividerAt: number } {
  // No team in the address — nothing to be "other" than. Leave the server's order alone.
  if (!teamId) return { rooms, dividerAt: -1 };
  const mine: T[] = [];
  const unscoped: T[] = [];
  const others: T[] = [];
  for (const r of rooms) {
    if (!r.isStaffRoom || !r.staffTeamId) unscoped.push(r);
    else if (r.staffTeamId === teamId) mine.push(r);
    else others.push(r);
  }
  const ordered = [...mine, ...unscoped, ...others];
  return { rooms: ordered, dividerAt: others.length ? mine.length + unscoped.length : -1 };
}
