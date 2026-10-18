/**
 * ⚖ IN-APP CHAT IS PAUSED (owner ruling 2026-10-18, BUSINESS_DECISIONS.md "In-app chat PAUSES"; the bars' rulings
 * P1–P8 in docs/projects/active/CHAT_PAUSE_BUILD_PROMPT.md §8).
 *
 * ONE switch, read by every chat door and by the server. While it is true:
 *   - no surface renders a way into chat (the home bar, the public tournament bar and strip, both coaches portals, the
 *     tournament admin's bar, rail and More sheet, the scouting book's share, the staff sheet's switch);
 *   - an old chat address lands quietly on that place's home (no "chat is paused" page);
 *   - the server refuses new chat activity (posting, rooms, membership changes) and nothing polls for unread counts.
 * Rooms, members, messages and preferences are KEPT — nothing is deleted, and the plan keys `tournament_chat` /
 * `coach_peer_chat` keep their values: this is a product switch, not a gate change.
 *
 * A code constant on purpose, not an env flag and not a plan key: reversing the pause is one reviewed commit that sets
 * this to false. `tests/unit/chat-pause-guard.test.ts` fails if a door stops reading it.
 *
 * UN-PAUSING — the same commit also: (1) restores the `admin-t-chat` entry in `scripts/layout-screens.mjs` (commented
 * out there); (2) runs `/docs` — the four chat articles come back by the switch, but ~50 passing mentions in
 * lib/help-content were reworded for the pause and must be put back (bars, tiles, staff permissions, the Coaches card);
 * (3) runs `/marketing` on the copy that reads the switch, and a What's New line; (4) re-rules the bars (the Practices tab
 * hands its place back to Chat by the switch — NAV_STANDARD's pause notes say so). Membership needs no repair: seat
 * removals ran throughout; the first chat list after un-pausing heals any seat a pause-time change should have added.
 *
 * Messaging returns later as a different product ("Messages": announcements with replies, for families) — not by
 * flipping this switch.
 */
// Typed as boolean (not the literal `true`) so both branches of every reader stay type-checked while paused.
export const CHAT_PAUSED: boolean = true;

/** The refusal every chat write returns while paused (409: the request is fine, the feature is off). */
export const CHAT_PAUSED_ERROR = 'Chat is paused.';
