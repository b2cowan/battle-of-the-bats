import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { getBasicCoachTeamFees } from '@/lib/basic-coach-fees';
import { getBasicCoachTeamPlayers } from '@/lib/basic-coach-roster';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import FeeEditor from '@/components/coaches/FeeEditor';
import ScopeShelf from '@/components/coaches/ScopeShelf';
import TeamSectionShell from '@/components/coaches/TeamSectionShell';
import styles from '../team.module.css';

type RouteParams = { params: Promise<{ basicTeamId: string }> };

export async function generateMetadata({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || (user.email && (await isPlatformAdminEmail(user.email)))) return { title: 'Fees' };
  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  return { title: team ? `${team.name} — Fees` : 'Fees' };
}

export default async function CoachTeamFeesPage({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const { team } = await resolveCoachTeamPage(basicTeamId, '/fees');
  const [fees, players] = await Promise.all([
    getBasicCoachTeamFees(basicTeamId),
    getBasicCoachTeamPlayers(basicTeamId),
  ]);
  const unpaid = fees.filter(fee => fee.status === 'unpaid').length;

  return (
    <TeamSectionShell
      teamName={team.name}
      title="Fees"
      meta={fees.length > 0 ? <span className={styles.rosterCount}>{unpaid} unpaid</span> : undefined}
      help={{ module: 'coaches', sectionIds: ['recipe-track-dues'], fullGuideHref: '/coaches/help#recipe-track-dues' }}
    >
      <FeeEditor basicTeamId={basicTeamId} initialFees={fees} players={players} />
      {fees.length > 0 && <ScopeShelf basicTeamId={basicTeamId} section="fees" />}
    </TeamSectionShell>
  );
}
