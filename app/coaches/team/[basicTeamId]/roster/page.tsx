import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { getBasicCoachTeamPlayers } from '@/lib/basic-coach-roster';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import RosterEditor from '@/components/coaches/RosterEditor';
import ScopeShelf from '@/components/coaches/ScopeShelf';
import TeamSectionShell from '@/components/coaches/TeamSectionShell';
import styles from '../team.module.css';

type RouteParams = { params: Promise<{ basicTeamId: string }> };

export async function generateMetadata({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || (user.email && (await isPlatformAdminEmail(user.email)))) return { title: 'Roster' };
  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  return { title: team ? `${team.name} — Roster` : 'Roster' };
}

export default async function CoachTeamRosterPage({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const { team } = await resolveCoachTeamPage(basicTeamId, '/roster');
  const players = await getBasicCoachTeamPlayers(basicTeamId);

  return (
    <TeamSectionShell
      teamName={team.name}
      title="Roster"
      meta={<span className={styles.rosterCount}>{players.length} {players.length === 1 ? 'player' : 'players'}</span>}
    >
      <RosterEditor basicTeamId={basicTeamId} initialPlayers={players} />
      {players.length > 0 && <ScopeShelf basicTeamId={basicTeamId} section="roster" />}
    </TeamSectionShell>
  );
}
