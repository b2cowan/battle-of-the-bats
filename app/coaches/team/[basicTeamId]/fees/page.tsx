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
  const unpaidFees = fees.filter(fee => fee.status === 'unpaid');
  const unpaid = unpaidFees.length;

  // B3.5 (◆O1): count PLAYERS who still owe, not unpaid rows — fees are per-player and one
  // player can carry several, so "9 unpaid" and "9 people to chase" are different numbers and
  // only the second one is the coach's actual workload. Legacy player-less rows (no linked
  // player) are excluded rather than guessed at. Below the threshold the line doesn't render,
  // so a coach with two stragglers is never told they have a problem.
  // The two-number form is not decoration: this page's own header counts unpaid ROWS, so when a
  // player carries several unpaid fees (or a legacy row has no linked player) the row count and
  // the people count diverge, and a bare "9 players still owe" beside a "12 unpaid" header reads
  // as a contradiction. Stating both reconciles them — and stops the orphaned rows from silently
  // understating what's outstanding. When they agree, the sentence collapses to the short form.
  const TOIL_THRESHOLD = 5;
  const playersWhoOwe = new Set(unpaidFees.map(fee => fee.playerId).filter(Boolean)).size;
  const toilLead = playersWhoOwe >= TOIL_THRESHOLD
    ? playersWhoOwe === unpaid
      ? `${playersWhoOwe} players still owe — that's ${playersWhoOwe} reminders to send by hand.`
      : `${unpaid} unpaid fees across ${playersWhoOwe} players — that's ${playersWhoOwe} reminders to send by hand.`
    : undefined;

  return (
    <TeamSectionShell
      teamName={team.name}
      title="Fees"
      meta={fees.length > 0 ? <span className={styles.rosterCount}>{unpaid} unpaid</span> : undefined}
      help={{ module: 'coaches', sectionIds: ['recipe-track-dues'], fullGuideHref: '/coaches/help#recipe-track-dues' }}
    >
      <FeeEditor basicTeamId={basicTeamId} initialFees={fees} players={players} />
      {fees.length > 0 && <ScopeShelf basicTeamId={basicTeamId} section="fees" lead={toilLead} />}
    </TeamSectionShell>
  );
}
