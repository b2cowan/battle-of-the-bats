import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import CoachChatView from '@/components/chat/CoachChatView';

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
  // render the self-sizing view directly rather than the team section band.
  await resolveCoachTeamPage(basicTeamId, '/chat');
  return <CoachChatView />;
}
