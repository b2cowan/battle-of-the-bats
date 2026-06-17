import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { getBasicCoachTeamEvents } from '@/lib/basic-coach-schedule';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import ScheduleEditor from '@/components/coaches/ScheduleEditor';
import ScopeShelf from '@/components/coaches/ScopeShelf';
import TeamSectionShell from '@/components/coaches/TeamSectionShell';
import styles from '../team.module.css';

type RouteParams = { params: Promise<{ basicTeamId: string }> };

export async function generateMetadata({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || (user.email && (await isPlatformAdminEmail(user.email)))) return { title: 'Schedule' };
  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  return { title: team ? `${team.name} — Schedule` : 'Schedule' };
}

export default async function CoachTeamSchedulePage({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const { team } = await resolveCoachTeamPage(basicTeamId, '/schedule');
  const events = await getBasicCoachTeamEvents(basicTeamId);

  return (
    <TeamSectionShell
      teamName={team.name}
      title="Schedule"
      meta={<span className={styles.rosterCount}>{events.length} {events.length === 1 ? 'event' : 'events'}</span>}
    >
      <ScheduleEditor basicTeamId={basicTeamId} initialEvents={events} />
      {events.length > 0 && <ScopeShelf basicTeamId={basicTeamId} section="schedule" />}
    </TeamSectionShell>
  );
}
