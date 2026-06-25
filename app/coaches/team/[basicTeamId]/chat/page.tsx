import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import CoachChatView from '@/components/chat/CoachChatView';
import styles from './chat.module.css';

type RouteParams = { params: Promise<{ basicTeamId: string }> };

export async function generateMetadata({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || (user.email && (await isPlatformAdminEmail(user.email)))) return { title: 'Chat' };
  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  return { title: team ? `${team.name} — Chat` : 'Chat' };
}

export default async function CoachTeamChatPage({ params }: RouteParams) {
  const { basicTeamId } = await params;
  // Access guard (redirects / notFound for non-owners); the chat itself is full-screen, so we
  // render the self-sizing view rather than the team section band. The full-bleed wrapper lets the
  // shell drop its 100vh page-minimum on this route so the chat owns exactly the chrome-bounded
  // (dynamic) viewport — no phantom scroll / dead space (see chat.module.css).
  await resolveCoachTeamPage(basicTeamId, '/chat');
  // `data-chat-fullbleed` = lock the page scroll (shell + globals); `data-chat-contained` = present
  // the conversation as a centered card on desktop (standalone portal only — see CoachChatView.module.css).
  return (
    <div className={styles.chatWrap} data-chat-fullbleed data-chat-contained>
      <CoachChatView />
    </div>
  );
}
