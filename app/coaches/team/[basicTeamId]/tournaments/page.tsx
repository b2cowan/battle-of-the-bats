import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import {
  getBasicCoachTeamForUser,
  getBasicCoachTournamentHistoryForTeam,
} from '@/lib/basic-coach-teams';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachTournamentRows from '@/components/coaches/CoachTournamentRows';
import { attachTournamentFinishes } from '@/lib/coach-tournament-finish';
import ScopeShelf from '@/components/coaches/ScopeShelf';
import TeamSectionShell from '@/components/coaches/TeamSectionShell';
import { Trophy } from 'lucide-react';
import styles from './tournaments.module.css';
import { tournamentToday } from '@/lib/timezone';

type RouteParams = { params: Promise<{ basicTeamId: string }> };

export async function generateMetadata({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || (user.email && (await isPlatformAdminEmail(user.email)))) return { title: 'Tournaments' };
  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  return { title: team ? `${team.name} — Tournaments` : 'Tournaments' };
}

export default async function CoachTeamTournamentsPage({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const { team } = await resolveCoachTeamPage(basicTeamId, '/tournaments');
  const today = tournamentToday();
  // Stage 7d: the same rows, bands and order as the paid list and the account hub (CoachTournamentRows
  // sorts live-first inside each band — DF-7's one order across the three lists). This list is the free
  // team's LIFETIME record, so "Finished" here reaches past this season; the paid list's does not.
  const history = await attachTournamentFinishes(await getBasicCoachTournamentHistoryForTeam(basicTeamId), today);
  // Entries that actually put this team in an event. Used only to gate the B3.2 shelf — the
  // list itself still shows every entry, rejections included, because that IS their record.
  const liveEntryCount = history.filter(({ registration }) => registration.status !== 'rejected').length;

  return (
    <TeamSectionShell
      teamName={team.name}
      title="Tournaments"
      help={{ module: 'coaches', sectionIds: ['tournaments'], fullGuideHref: '/coaches/help#tournaments' }}
      meta={<span className={styles.count}>{history.length} {history.length === 1 ? 'entry' : 'entries'}</span>}
    >
      {history.length === 0 ? (
        <CoachEmptyState
          compact
          icon={<Trophy size={20} aria-hidden />}
          headline="No tournament entries yet"
          description="When you register this team for a tournament, it shows up here with its status and schedule."
        />
      ) : (
        <CoachTournamentRows
          label="Tournaments"
          today={today}
          entries={history}
          hrefBase={COACHES_TOURNAMENTS_PATH}
        />
      )}

      {/* B3.2 (◆N1): the shelf this portal already runs on roster / schedule / fees /
          announcements, reused verbatim — no new pitch anatomy. Held back until a SECOND
          entry exists: a coach with one tournament hasn't repeated anything yet, so the
          carry-forward argument would be a guess about them rather than an observation.
          REJECTED entries don't count (review finding) — `getBasicCoachTournamentHistoryForTeam`
          applies no status filter, so a coach turned away from event A and accepted to event B
          would otherwise be told "second event, same roster" with no first event behind them. */}
      {liveEntryCount >= 2 && <ScopeShelf basicTeamId={basicTeamId} section="tournaments" />}
    </TeamSectionShell>
  );
}
