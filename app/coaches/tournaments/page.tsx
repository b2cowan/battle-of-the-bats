import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  getBasicCoachTournamentTeamsForUser,
  type BasicCoachTeamRegistration,
  type BasicCoachTournamentTeam,
} from '@/lib/basic-coach-teams';
import { getUserAccessContexts } from '@/lib/user-contexts';
import {
  COACHES_START_PATH,
  COACHES_TOURNAMENTS_PATH,
} from '@/lib/coaches-portal-routes';
import styles from '../../my/registrations/registrations.module.css';

export const metadata = { title: 'Coaches Portal - Tournament Records' };

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

const STATUS_LABEL: Record<string, string> = {
  accepted:  'Accepted',
  pending:   'Pending Review',
  waitlist:  'Waitlisted',
  rejected:  'Not Accepted',
};

const STATUS_BADGE: Record<string, string> = {
  accepted: 'badge-success',
  pending:  'badge-warning',
  waitlist: 'badge-info',
  rejected: 'badge-danger',
};

function isActive(tournament: TournamentRow | null): boolean {
  if (!tournament) return false;
  const now = new Date().toISOString().split('T')[0];
  if (tournament.end_date && now > tournament.end_date) return false;
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
  let hasPremiumAccess = false;
  try {
    const [teams, contexts] = await Promise.all([
      getBasicCoachTournamentTeamsForUser({ userId: user.id, email }),
      getUserAccessContexts({ id: user.id, email }),
    ]);
    coachTeams = teams;
    hasPremiumAccess = contexts.some(context => context.kind === 'coaches_premium');
  } catch (error) {
    console.error('[coaches tournaments] load error:', error);
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Coaches Portal</h1>
        </div>
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-2)' }}>
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
          <h1 className={styles.title}>Coaches Portal</h1>
          <p className={styles.sub}>Basic team profiles and tournament history for <strong>{email}</strong></p>
        </div>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-2)', marginBottom: '0.5rem' }}>No tournament records found for your account.</p>
          <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
            When you register for a tournament, it will appear here automatically.
          </p>
        </div>
        <div className={styles.ctaSection}>
          <CtaCards hasPremiumAccess={hasPremiumAccess} />
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

  const teamGroups: CoachTeamGroup[] = coachTeams
    .map(team => {
      const registrations = team.registrations
        .map(registration => registrationMap.get(registration.id))
        .filter(Boolean) as Registration[];

      return {
        ...team,
        active: registrations.filter(r => isActive(r.tournament)),
        past: registrations.filter(r => !isActive(r.tournament)),
      };
    })
    .filter(team => team.active.length > 0 || team.past.length > 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Coaches Portal</h1>
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
                    <RegistrationCard key={r.team.id} reg={r} />
                  ))}
                </div>
              </div>
            )}

            {team.past.length > 0 && (
              <div className={styles.teamSection}>
                <h3 className={styles.sectionTitle}>Past Tournaments</h3>
                <div className={styles.list}>
                  {team.past.map(r => (
                    <RegistrationCard key={r.team.id} reg={r} />
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      <div className={styles.ctaSection}>
        <CtaCards hasPremiumAccess={hasPremiumAccess} />
      </div>
    </div>
  );
}

function RegistrationCard({ reg }: { reg: Registration }) {
  const { team, tournament, org } = reg;
  const statusBadge = STATUS_BADGE[team.status] ?? 'badge-info';
  const statusLabel = STATUS_LABEL[team.status] ?? team.status;
  const detailHref  = `${COACHES_TOURNAMENTS_PATH}/${team.id}`;

  const dateRange = tournament?.start_date
    ? tournament.end_date
      ? `${new Date(tournament.start_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} - ${new Date(tournament.end_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : new Date(tournament.start_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <Link href={detailHref} className={styles.card}>
      <div className={styles.cardMain}>
        <div className={styles.cardTitle}>{tournament?.name ?? team.name}</div>
        {tournament && (
          <div className={styles.cardMeta}>
            <span>{team.name}</span>
            {org && <span>{org.name}</span>}
            {dateRange && <span>{dateRange}</span>}
          </div>
        )}
      </div>
      <div className={styles.cardStatus}>
        <span className={`badge ${statusBadge}`}>{statusLabel}</span>
      </div>
    </Link>
  );
}

function CtaCards({ hasPremiumAccess }: { hasPremiumAccess: boolean }) {
  return (
    <div className={styles.ctaGrid}>
      {!hasPremiumAccess && (
        <div className={styles.ctaCard}>
          <div className={styles.ctaLabel}>Take your season further</div>
          <div className={styles.ctaTitle}>Coaches Portal Premium</div>
          <p className={styles.ctaDesc}>
            Manage your team year-round with roster, schedule, dues, budget, documents, and lineups in one place.
          </p>
          <Link href={COACHES_START_PATH} className="btn btn-outline btn-sm">Explore Premium</Link>
        </div>
      )}
      <div className={styles.ctaCard}>
        <div className={styles.ctaLabel}>Ready to run your own event?</div>
        <div className={styles.ctaTitle}>Host a Tournament</div>
        <p className={styles.ctaDesc}>
          FieldLogicHQ makes it easy to run divisions, pools, schedules, and registration all from one dashboard.
        </p>
        <Link href="/pricing" className="btn btn-ghost btn-sm">See Tournament Plans</Link>
      </div>
    </div>
  );
}
