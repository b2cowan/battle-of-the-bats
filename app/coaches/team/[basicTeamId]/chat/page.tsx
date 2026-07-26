import { redirect } from 'next/navigation';

/**
 * A2 (2026-07-25, approved mockups): the free portal's separate Chat section is retired —
 * team chat lives in the GLOBAL consumer Chat tab (same rooms, same conversation; the
 * inbox is account-wide) plus the "Team chat" doorway on the team Overview. This route
 * survives as a redirect so old deep links (notifications, bookmarks) keep working.
 */
export default function CoachTeamChatPage() {
  redirect('/chat');
}
