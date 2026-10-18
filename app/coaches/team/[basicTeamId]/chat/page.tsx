import { redirect } from 'next/navigation';
import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import { CHAT_PAUSED } from '@/lib/chat-pause';
import { getCoachChatEvents } from '@/lib/chat-service';
import CoachChatView from '@/components/chat/CoachChatView';
import CoachChatWaiting from '@/app/(consumer)/chat/CoachChatWaiting';
import TeamSectionShell from '@/components/coaches/TeamSectionShell';
import styles from './chat.module.css';

export const metadata = { title: 'Chat' };

type RouteParams = { params: Promise<{ basicTeamId: string }> };

/**
 * The free portal's Chat, INSIDE the portal (owner ruling 2026-10-13, Free coach header parity A1): the paid
 * portal's chat screen under the free strip and left menu — every room the coach is in, per person, as in the
 * paid portal. Before the coach is in any room it is the waiting screen the fan app's Chat tab shows a coach
 * (each tournament whose organizer can still open a chat, 2026-10-13). This route was a redirect to /chat from
 * A2 (2026-07-25) until then: opening the fan app put the coach back under the fan-app header the ruling took
 * away. The left menu's row and the phone team bar's Chat tab (2026-10-15) both open it, and both show only
 * when there is a chat or one coming.
 */
export default async function CoachTeamChatPage({ params }: RouteParams) {
  const { basicTeamId } = await params;
  // ⚖ Chat is paused (2026-10-18, lib/chat-pause.ts; ruling P1): the old address lands quietly on the team's Overview.
  if (CHAT_PAUSED) redirect(`/coaches/team/${basicTeamId}`);
  const { userId } = await resolveCoachTeamPage(basicTeamId, '/chat');
  // Read on the server for the empty state only; the room list itself loads in the browser (it self-heals
  // the coach's memberships first, as on the paid portal).
  const events = await getCoachChatEvents(userId).catch(err => {
    console.error('[coaches chat] waiting events failed (non-fatal):', err);
    return [];
  });

  // `data-chat-fullbleed` locks the page scroll so the conversation owns the viewport and only its message
  // list scrolls (globals.css) — the paid portal's chat page does the same.
  // Before any room: the portal's own section frame (mono title + "?" help, as every free section page wears)
  // around the waiting card — not the fan app's page title (/design, 2026-10-14).
  const waiting = (
    <TeamSectionShell
      title="Chat"
      help={{ module: 'coaches', sectionIds: ['recipe-tournament-chat'], fullGuideHref: '/coaches/help#recipe-tournament-chat' }}
    >
      <CoachChatWaiting events={events} bare />
    </TeamSectionShell>
  );

  return (
    <div className={styles.chatWrap} data-chat-fullbleed>
      <CoachChatView empty={waiting} />
    </div>
  );
}
