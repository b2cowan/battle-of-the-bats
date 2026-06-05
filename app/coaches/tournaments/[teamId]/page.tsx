import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canUserAccessTournamentRegistration } from '@/lib/basic-coach-teams';
import { getUserAccessContexts } from '@/lib/user-contexts';
import {
  COACHES_START_PATH,
  COACHES_TOURNAMENTS_PATH,
} from '@/lib/coaches-portal-routes';
import styles from './detail.module.css';

type RouteParams = { params: Promise<{ teamId: string }> };

const STATUS_LABEL: Record<string, string> = {
  accepted: 'Accepted',
  pending:  'Pending Review',
  waitlist: 'Waitlisted',
  rejected: 'Not Accepted',
};

const STATUS_BADGE: Record<string, string> = {
  accepted: 'badge-success',
  pending:  'badge-warning',
  waitlist: 'badge-info',
  rejected: 'badge-danger',
};

const STATUS_DESC: Record<string, string> = {
  accepted: 'Your team has been accepted into this tournament. Check below for your schedule and announcements.',
  pending:  'Your registration is pending review by the tournament director. You will receive an email when your status is updated.',
  waitlist: 'The division is currently full. Your team is on the waitlist and will be notified if a spot opens up.',
  rejected: 'Your team was not accepted into this tournament. Contact the organizer for more information.',
};

export async function generateMetadata({ params }: RouteParams) {
  const { teamId } = await params;
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .maybeSingle();
  return { title: team?.name ?? 'Tournament Record' };
}

export default async function CoachTournamentRecordDetailPage({ params }: RouteParams) {
  const { teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/auth/login?next=${COACHES_TOURNAMENTS_PATH}/${teamId}`);
  }

  const email = user.email.toLowerCase();

  const access = await canUserAccessTournamentRegistration({
    userId: user.id,
    email,
    registrationId: teamId,
  });

  if (!access) {
    notFound();
  }

  const contexts = await getUserAccessContexts({ id: user.id, email });
  const hasPremiumAccess = contexts.some(context => context.kind === 'coaches_premium');

  const { data: team, error: teamError } = await supabaseAdmin
    .from('teams')
    .select('id, name, coach, email, status, registered_at, tournament_id, division_id')
    .eq('id', teamId)
    .maybeSingle();

  if (teamError || !team) {
    notFound();
  }

  const [
    { data: tournament },
    { data: division },
    { data: announcements },
    { data: games },
  ] = await Promise.all([
    team.tournament_id
      ? supabaseAdmin
          .from('tournaments')
          .select('id, name, slug, year, start_date, end_date, org_id, status, contact_email')
          .eq('id', team.tournament_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    team.division_id
      ? supabaseAdmin
          .from('divisions')
          .select('id, name, schedule_visibility')
          .eq('id', team.division_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    team.tournament_id
      ? supabaseAdmin
          .from('announcements')
          .select('id, title, body, created_at, division_ids')
          .eq('tournament_id', team.tournament_id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),

    team.tournament_id
      ? supabaseAdmin
          .from('games')
          .select('id, game_date, game_time, location, home_team_id, away_team_id, home_score, away_score, status, is_playoff, diamond_id')
          .eq('tournament_id', team.tournament_id)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .order('game_date', { ascending: true })
          .order('game_time', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  let org: { slug: string; name: string } | null = null;
  if (tournament?.org_id) {
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('slug, name')
      .eq('id', tournament.org_id)
      .maybeSingle();
    org = orgData;
  }

  const relevantAnnouncements = ((announcements ?? []) as Array<{
    id: string; title: string; body: string | null; created_at: string; division_ids: string[] | null;
  }>).filter(a => {
    if (!a.division_ids || a.division_ids.length === 0) return true;
    return team.division_id && a.division_ids.includes(team.division_id);
  });

  const scheduleVisible =
    division?.schedule_visibility === 'published_teams' ||
    division?.schedule_visibility === 'published_generic';

  const teamGames = (games ?? []) as Array<{
    id: string;
    game_date: string | null;
    game_time: string | null;
    location: string | null;
    home_team_id: string | null;
    away_team_id: string | null;
    home_score: number | null;
    away_score: number | null;
    status: string;
    is_playoff: boolean;
    diamond_id: string | null;
  }>;

  const statusBadge = STATUS_BADGE[team.status] ?? 'badge-info';
  const statusLabel = STATUS_LABEL[team.status] ?? team.status;
  const statusDesc  = STATUS_DESC[team.status] ?? '';

  const dateRange = tournament?.start_date
    ? tournament.end_date
      ? `${new Date(tournament.start_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} - ${new Date(tournament.end_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : new Date(tournament.start_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href={COACHES_TOURNAMENTS_PATH}>Back to Coaches Portal</Link>
      </nav>

      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{team.name}</h1>
          {tournament && (
            <p className={styles.tournamentName}>
              {tournament.name} {tournament.year && `(${tournament.year})`}
              {org && ` - ${org.name}`}
            </p>
          )}
        </div>
        <span className={`badge ${statusBadge} ${styles.statusBadge}`}>{statusLabel}</span>
      </div>

      <div className={`card ${styles.statusCard}`}>
        <p className={styles.statusDesc}>{statusDesc}</p>
        {team.status === 'accepted' && tournament?.contact_email && (
          <p className={styles.contactLine}>
            Questions? <a href={`mailto:${tournament.contact_email}`}>{tournament.contact_email}</a>
          </p>
        )}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Registration Details</h2>
        <div className="card">
          <dl className={styles.detailGrid}>
            <dt>Team</dt><dd>{team.name}</dd>
            {team.coach && <><dt>Coach</dt><dd>{team.coach}</dd></>}
            {division && <><dt>Division</dt><dd>{division.name}</dd></>}
            {dateRange && <><dt>Dates</dt><dd>{dateRange}</dd></>}
            <dt>Registered</dt>
            <dd>{new Date(team.registered_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
          </dl>
        </div>
      </section>

      {team.status === 'accepted' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Schedule</h2>
          {!scheduleVisible ? (
            <div className="card" style={{ padding: '1.5rem', color: 'var(--text-2)', textAlign: 'center', fontSize: '0.88rem' }}>
              The schedule for this division has not been published yet. Check back after the organizer publishes it.
            </div>
          ) : teamGames.length === 0 ? (
            <div className="card" style={{ padding: '1.5rem', color: 'var(--text-2)', textAlign: 'center', fontSize: '0.88rem' }}>
              No games scheduled for your team yet.
            </div>
          ) : (
            <div className={styles.gameList}>
              {teamGames.map(game => {
                const isHome = game.home_team_id === teamId;
                const myScore   = isHome ? game.home_score : game.away_score;
                const oppScore  = isHome ? game.away_score : game.home_score;
                const hasResult = myScore !== null && oppScore !== null;
                const gameDate  = game.game_date
                  ? new Date(game.game_date + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
                  : '-';
                const gameTime  = game.game_time
                  ? new Date(`1970-01-01T${game.game_time}`).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
                  : null;

                return (
                  <div key={game.id} className={styles.gameRow}>
                    <div className={styles.gameDate}>{gameDate}{gameTime ? ` - ${gameTime}` : ''}</div>
                    <div className={styles.gameOpponent}>{isHome ? 'Home' : 'Away'}{game.is_playoff ? ' (Playoff)' : ''}</div>
                    {game.location && <div className={styles.gameLocation}>{game.location}</div>}
                    {hasResult && (
                      <div className={styles.gameScore}>{myScore}-{oppScore}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Announcements</h2>
        {relevantAnnouncements.length === 0 ? (
          <div className="card" style={{ padding: '1.5rem', color: 'var(--text-2)', textAlign: 'center', fontSize: '0.88rem' }}>
            No announcements yet from the organizer.
          </div>
        ) : (
          <div className={styles.announcementList}>
            {relevantAnnouncements.map(a => (
              <div key={a.id} className={`card ${styles.announcementCard}`}>
                <div className={styles.announcementTitle}>{a.title}</div>
                {a.body && <p className={styles.announcementBody}>{a.body}</p>}
                <div className={styles.announcementDate}>
                  {new Date(a.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={styles.ctaSection}>
        {team.status === 'accepted' && !hasPremiumAccess && (
          <div className={styles.ctaCard}>
            <div className={styles.ctaLabel}>For your team</div>
            <div className={styles.ctaTitle}>Take your team further</div>
            <p className={styles.ctaDesc}>
              Run your team year-round — roster, lineups, schedule, dues, budget, and documents in one place. It carries over automatically if your organization joins FieldLogicHQ.
            </p>
            <Link href={COACHES_START_PATH} className="btn btn-outline btn-sm">Express interest</Link>
          </div>
        )}
        <div className={styles.ctaCardSecondary}>
          <span className={styles.ctaSecondaryText}>Run your own tournament with FieldLogicHQ.</span>
          <Link href="/pricing" className="btn btn-ghost btn-sm">See tournament plans</Link>
        </div>
      </div>
    </div>
  );
}
