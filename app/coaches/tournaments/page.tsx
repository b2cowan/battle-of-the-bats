import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import {
  getBasicCoachTournamentTeamsForUser,
  getBasicCoachTournamentHistoryForRegistrationIds,
  type BasicCoachTournamentTeam,
} from '@/lib/basic-coach-teams';
import {
  COACHES_HOME_PATH,
  COACHES_TOURNAMENTS_PATH,
} from '@/lib/coaches-portal-routes';
import { attachTournamentFinishes } from '@/lib/coach-tournament-finish';
import CoachTournamentRows from '@/components/coaches/CoachTournamentRows';
import styles from './tournaments.module.css';
import { tournamentToday } from '@/lib/timezone';

export const metadata = { title: 'Tournaments - Coaches Portal' };

export default async function CoachTournamentRecordsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/auth/login?next=${COACHES_TOURNAMENTS_PATH}`);
  }

  const email = user.email.toLowerCase();

  let coachTeams: BasicCoachTournamentTeam[] = [];
  try {
    coachTeams = await getBasicCoachTournamentTeamsForUser({ userId: user.id, email });
  } catch (error) {
    console.error('[coaches tournaments] load error:', error);
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Tournaments</h1>
        </div>
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>Could not load your tournament records. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  const registrationIds = [...new Set(coachTeams.flatMap(team => team.registrations.map(r => r.id)))];

  if (registrationIds.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Tournaments</h1>
          <p className={styles.sub}>Basic team profiles and tournament history for <strong>{email}</strong></p>
        </div>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No tournament registrations yet.</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            Register a team for a tournament and it appears here. You can manage your teams from your{' '}
            <Link href={COACHES_HOME_PATH} style={{ color: 'var(--logic-lime)' }}>Coaches Portal home</Link>.
          </p>
        </div>
      </div>
    );
  }

  // Stage 7d (Ask 12; owner ruling 2026-10-22, Put to the owner 3 option (a)): one section per team,
  // each the same row list as the team's own Tournaments tab and the paid portal's — read through the
  // ONE assembler, so a row's words (host, "Your club's tournament", the finish) cannot drift from theirs.
  // The hub's own tournament/org reads and its card wrapper are gone.
  const today = tournamentToday();
  const entries = await attachTournamentFinishes(
    await getBasicCoachTournamentHistoryForRegistrationIds(registrationIds, null),
    today,
  );
  const entryById = new Map(entries.map(e => [e.registration.id, e] as const));

  const teamGroups = coachTeams
    .map(team => ({
      team,
      entries: team.registrations.map(r => entryById.get(r.id)).filter((e): e is (typeof entries)[number] => Boolean(e)),
    }))
    .filter(group => group.entries.length > 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {/* This is the Tournaments tab's destination — title it as such ("Coaches Portal"
            here read as a disorienting third name for the same place). */}
        <h1 className={styles.title}>Tournaments</h1>
        <p className={styles.sub}>Teams and tournament history linked to <strong>{email}</strong></p>
      </div>

      <div className={styles.teamList}>
        {teamGroups.map(({ team, entries: teamEntries }) => (
          <section key={team.id} aria-labelledby={`team-${team.id}`}>
            <h2 id={`team-${team.id}`} className={styles.teamGroupTitle}>{team.name}</h2>
            {team.primaryCoachName && <p className={styles.teamGroupMeta}>{team.primaryCoachName}</p>}
            <CoachTournamentRows
              label={team.name}
              today={today}
              entries={teamEntries}
              hrefBase={COACHES_TOURNAMENTS_PATH}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

// Pressure ladder (Phase 5·0): the always-on pre-event upsell cards (CtaCards) were
// removed from this surface. The earned ask returns at the afterglow (completed events) — Phase 5m.
