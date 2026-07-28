import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import {
  getBasicCoachTeamForUser,
  getBasicCoachTournamentHistoryForTeam,
} from '@/lib/basic-coach-teams';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachRegistrationCard from '@/components/coaches/CoachRegistrationCard';
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
  const history = await getBasicCoachTournamentHistoryForTeam(basicTeamId);
  const today = tournamentToday();
  // Entries that actually put this team in an event. Used only to gate the B3.2 shelf — the
  // list itself still shows every entry, rejections included, because that IS their record.
  const liveEntryCount = history.filter(({ registration }) => registration.status !== 'rejected').length;

  return (
    <TeamSectionShell
      teamName={team.name}
      title="Tournaments"
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
        <div className={styles.list}>
          {/* A3.3: the shared registration card — the old per-list design (tournament-hashed
              monogram, fainter border, neutral hover) retired in favour of the one anatomy. */}
          {history.map(({ registration, tournament, org }) => (
            <CoachRegistrationCard
              key={registration.id}
              href={`${COACHES_TOURNAMENTS_PATH}/${registration.id}`}
              title={tournament?.name ?? registration.name}
              registrationStatus={registration.status}
              startDate={tournament?.startDate ?? null}
              endDate={tournament?.endDate ?? null}
              today={today}
              metaParts={[org?.name]}
              fanView={
                org?.slug && tournament?.slug &&
                (tournament.status === 'active' || tournament.status === 'completed')
                  ? { orgSlug: org.slug, tournamentSlug: tournament.slug }
                  : null
              }
            />
          ))}
        </div>
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
