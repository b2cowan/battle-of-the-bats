import Link from 'next/link';
import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import {
  getBasicCoachTeamForUser,
  getBasicCoachTournamentHistoryForTeam,
} from '@/lib/basic-coach-teams';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
import { registrationStatusBadge, registrationStatusLabel } from '@/lib/coaches-status';
import { deriveCoachLifecycleChip, lifecycleChipClassKey } from '@/lib/coach-tournament-lifecycle';
import { teamColor, teamInitials } from '@/lib/team-color';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import TeamSectionShell from '@/components/coaches/TeamSectionShell';
import { Trophy } from 'lucide-react';
import FanViewLink from '@/components/shared/FanViewLink';
import portalStyles from '../../../coaches-portal.module.css';
import styles from './tournaments.module.css';

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
  const today = new Date().toISOString().split('T')[0];

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
          {history.map(({ registration, tournament, org }) => {
            const chip = deriveCoachLifecycleChip(tournament?.startDate ?? null, tournament?.endDate ?? null, today);
            const chipKey = lifecycleChipClassKey(chip.state);
            const hasChip = chip.state !== 'unknown' && chipKey !== '';
            const isLive = chip.state === 'live';
            const withDot = chip.state === 'live' || chip.state === 'game_day';
            const name = tournament?.name ?? registration.name;
            return (
              <div key={registration.id} className={styles.entry}>
                <Link href={`${COACHES_TOURNAMENTS_PATH}/${registration.id}`} className={styles.card}>
                  <span className={styles.cardMono} style={{ background: teamColor(name), color: '#0f1123' }} aria-hidden>
                    {teamInitials(name)}
                  </span>
                  <div className={styles.cardMain}>
                    <span className={styles.cardTitle}>{name}</span>
                    <span className={styles.cardMeta}>
                      {org?.name}
                      {!isLive && <> · {registrationStatusLabel(registration.status)}</>}
                    </span>
                  </div>
                  {hasChip ? (
                    <span className={`${portalStyles.coachLifecycleChip} ${portalStyles[`coachLifecycleChip${chipKey}`]}`}>
                      {withDot && <span className={portalStyles.coachLifecycleChipDot} aria-hidden />}
                      {chip.label}
                    </span>
                  ) : (
                    <span className={`badge ${registrationStatusBadge(registration.status)}`}>
                      {registrationStatusLabel(registration.status)}
                    </span>
                  )}
                </Link>
                {/* ⇄ Fan view — the round trip back to the event's public space ("The Flip" P3,
                    shared component). Only for publicly-visible lifecycles — the public route
                    404s draft and archived tournaments (getPublicTournamentBySlug status filter). */}
                {org?.slug && tournament?.slug &&
                  (tournament.status === 'active' || tournament.status === 'completed') && (
                  <FanViewLink orgSlug={org.slug} tournamentSlug={tournament.slug} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </TeamSectionShell>
  );
}
