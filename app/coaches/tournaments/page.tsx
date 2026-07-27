import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  getBasicCoachTournamentTeamsForUser,
  type BasicCoachTeamRegistration,
  type BasicCoachTournamentTeam,
} from '@/lib/basic-coach-teams';
import {
  COACHES_HOME_PATH,
  COACHES_TOURNAMENTS_PATH,
} from '@/lib/coaches-portal-routes';
import {
  deriveCoachLifecycleChip,
  type CoachLifecycleChip,
} from '@/lib/coach-tournament-lifecycle';
import CoachRegistrationCard from '@/components/coaches/CoachRegistrationCard';
import styles from './tournaments.module.css';
import { tournamentToday } from '@/lib/timezone';

export const metadata = { title: 'Tournaments - Coaches Portal' };

type TournamentRow = {
  id: string;
  name: string;
  slug: string | null;
  year: number;
  start_date: string | null;
  end_date: string | null;
  org_id: string;
  status: string;
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
};

type Registration = {
  team: BasicCoachTeamRegistration;
  tournament: TournamentRow | null;
  org: OrgRow | null;
};

type CoachTeamGroup = BasicCoachTournamentTeam & {
  active: Registration[];
  past: Registration[];
};

function isActive(tournament: TournamentRow | null): boolean {
  if (!tournament) return false;
  const now = tournamentToday();
  // A single-day event (no end_date) ends on its start_date — otherwise it would
  // sit in "Active & Upcoming" forever while its lifecycle chip reads "Complete"
  // (deriveCoachLifecycleChip uses `end = endDate ?? startDate`). Keep them aligned.
  const effectiveEnd = tournament.end_date ?? tournament.start_date;
  if (effectiveEnd && now > effectiveEnd) return false;
  return true;
}

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

  const registrationList = coachTeams.flatMap(team => team.registrations);

  if (registrationList.length === 0) {
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

  const tournamentIds = [...new Set(registrationList.map(t => t.tournamentId).filter(Boolean))] as string[];
  const { data: tournamentsData } = tournamentIds.length > 0
    ? await supabaseAdmin
        .from('tournaments')
        .select('id, name, slug, year, start_date, end_date, org_id, status')
        .in('id', tournamentIds)
    : { data: [] };

  const tournamentMap = new Map<string, TournamentRow>(
    ((tournamentsData ?? []) as TournamentRow[]).map(t => [t.id, t])
  );

  const orgIds = [...new Set(((tournamentsData ?? []) as TournamentRow[]).map(t => t.org_id).filter(Boolean))];
  const { data: orgsData } = orgIds.length > 0
    ? await supabaseAdmin.from('organizations').select('id, slug, name').in('id', orgIds)
    : { data: [] };

  const orgMap = new Map<string, OrgRow>(
    ((orgsData ?? []) as OrgRow[]).map(o => [o.id, o])
  );

  const registrationMap = new Map<string, Registration>();
  for (const team of registrationList) {
    const tournament = team.tournamentId ? tournamentMap.get(team.tournamentId) ?? null : null;
    const org = tournament?.org_id ? orgMap.get(tournament.org_id) ?? null : null;
    registrationMap.set(team.id, { team, tournament, org });
  }

  // Live-first sort (§3c/§3d): order Active & Upcoming by the lifecycle chip rank
  // (live → game-day → upcoming → future), so a coach opening the portal on game day
  // sees today's event first, not buried under later registrations. Ties keep the
  // soonest start date first. The chip itself is rendered per card below.
  const today = tournamentToday();
  const chipFor = (r: Registration): CoachLifecycleChip =>
    deriveCoachLifecycleChip(r.tournament?.start_date ?? null, r.tournament?.end_date ?? null, today);

  const teamGroups: CoachTeamGroup[] = coachTeams
    .map(team => {
      const registrations = team.registrations
        .map(registration => registrationMap.get(registration.id))
        .filter(Boolean) as Registration[];

      const active = registrations
        .filter(r => isActive(r.tournament))
        .sort((a, b) => {
          const rankDiff = chipFor(a).rank - chipFor(b).rank;
          if (rankDiff !== 0) return rankDiff;
          // Same lifecycle bucket → soonest start first (null dates sort last).
          const aStart = a.tournament?.start_date ?? '9999-12-31';
          const bStart = b.tournament?.start_date ?? '9999-12-31';
          return aStart.localeCompare(bStart);
        });

      return {
        ...team,
        active,
        past: registrations.filter(r => !isActive(r.tournament)),
      };
    })
    .filter(team => team.active.length > 0 || team.past.length > 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {/* This is the Tournaments tab's destination — title it as such ("Coaches Portal"
            here read as a disorienting third name for the same place). */}
        <h1 className={styles.title}>Tournaments</h1>
        <p className={styles.sub}>Teams and tournament history linked to <strong>{email}</strong></p>
      </div>

      <div className={styles.teamList}>
        {teamGroups.map(team => (
          <section key={team.id} className={styles.teamGroup}>
            <div className={styles.teamGroupHeader}>
              <div>
                <h2 className={styles.teamGroupTitle}>{team.name}</h2>
                <p className={styles.teamGroupMeta}>
                  {team.registrations.length === 1 ? '1 tournament record' : `${team.registrations.length} tournament records`}
                  {team.primaryCoachName ? ` · ${team.primaryCoachName}` : ''}
                </p>
              </div>
            </div>

            {team.active.length > 0 && (
              <div className={styles.teamSection}>
                <h3 className={styles.sectionTitle}>Active &amp; Upcoming</h3>
                <div className={styles.list}>
                  {team.active.map(r => (
                    <RegistrationCard key={r.team.id} reg={r} today={today} />
                  ))}
                </div>
              </div>
            )}

            {team.past.length > 0 && (
              <div className={styles.teamSection}>
                <h3 className={styles.sectionTitle}>Past Tournaments</h3>
                <div className={styles.list}>
                  {team.past.map(r => (
                    <RegistrationCard key={r.team.id} reg={r} today={today} />
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function RegistrationCard({ reg, today }: { reg: Registration; today: string }) {
  const { team, tournament, org } = reg;

  // ⇄ Fan view ("The Flip" P3, owner call 2026-07-23): this cross-team list joins the per-row flip
  // treatment. Publicly-visible lifecycles only (the public route 404s draft/archived).
  const canFanView = Boolean(org?.slug && tournament?.slug &&
    (tournament.status === 'active' || tournament.status === 'completed'));

  // A3.3: this card's treatment was promoted to the shared CoachRegistrationCard —
  // the cross-team hub keeps the team name in the meta (the other two lists are
  // already team-scoped and skip it).
  return (
    <CoachRegistrationCard
      href={`${COACHES_TOURNAMENTS_PATH}/${team.id}`}
      title={tournament?.name ?? team.name}
      registrationStatus={team.status}
      startDate={tournament?.start_date ?? null}
      endDate={tournament?.end_date ?? null}
      today={today}
      metaParts={tournament ? [team.name, org?.name] : []}
      fanView={canFanView ? { orgSlug: org!.slug, tournamentSlug: tournament!.slug! } : null}
    />
  );
}

// Pressure ladder (Phase 5·0): the always-on pre-event upsell cards (CtaCards) were
// removed from this surface. The earned ask returns at the afterglow (completed events) — Phase 5m.
