import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import {
  getBasicCoachTeamAnnouncements,
  getBasicCoachTeamAnnouncementRecipientSummary,
} from '@/lib/basic-coach-announcements';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import AnnouncementEditor from '@/components/coaches/AnnouncementEditor';
import TeamSectionShell from '@/components/coaches/TeamSectionShell';

type RouteParams = { params: Promise<{ basicTeamId: string }> };

export async function generateMetadata({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || (user.email && (await isPlatformAdminEmail(user.email)))) return { title: 'Announcements' };
  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  return { title: team ? `${team.name} — Announcements` : 'Announcements' };
}

export default async function CoachTeamAnnouncementsPage({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const { team } = await resolveCoachTeamPage(basicTeamId, '/announcements');
  const [announcements, recipientSummary] = await Promise.all([
    getBasicCoachTeamAnnouncements(basicTeamId),
    getBasicCoachTeamAnnouncementRecipientSummary(basicTeamId),
  ]);

  return (
    <TeamSectionShell
      teamName={team.name}
      title="Announcements"
    >
      <AnnouncementEditor
        basicTeamId={basicTeamId}
        initialAnnouncements={announcements}
        initialRecipientSummary={recipientSummary}
      />
    </TeamSectionShell>
  );
}
