import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { canUserAccessTournamentRegistration } from '@/lib/basic-coach-teams';
import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
import {
  registrationStatusBadge,
  registrationStatusLabel,
  registrationStatusDesc,
} from '@/lib/coaches-status';
import { buildCoachTournamentStatus } from '@/lib/coach-status-model';
import { deriveCoachTournamentPhase } from '@/lib/coach-tournament-phase';
import TournamentStatusBlock from '@/components/coaches/TournamentStatusBlock';
import TeamHQ from '@/components/coaches/TeamHQ';
import styles from './detail.module.css';

type RouteParams = { params: Promise<{ teamId: string }> };

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

  const { data: team, error: teamError } = await supabaseAdmin
    .from('teams')
    .select('id, name, coach, email, status, registered_at, tournament_id, division_id, payment_status, deposit_paid, total_paid, payment_collected_at, check_in_status, checked_in_at, roster_submitted_at, roster_confirmed_at')
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
          .select('id, name, slug, year, start_date, end_date, org_id, status, contact_email, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
          .eq('id', team.tournament_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    team.division_id
      ? supabaseAdmin
          .from('divisions')
          .select('id, name, schedule_visibility, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
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

  // Contact shown to the coach in this portal respects the "Communication with coaches" toggle
  // and resolves the selected contact member (then legacy contact_email, then org owner — the
  // same chain the coach emails use). Null when the organizer hid the contact from coaches.
  const coachContactEmail = tournament?.id
    ? await resolveTournamentContactEmail(
        tournament.id,
        tournament.org_id ? (await getOrgOwnerEmail(tournament.org_id)) ?? null : null,
        'coach',
      )
    : null;

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

  const statusBadge = registrationStatusBadge(team.status);
  const statusLabel = registrationStatusLabel(team.status);
  const statusDesc  = registrationStatusDesc(team.status);

  const today = new Date().toISOString().split('T')[0];
  // Check-in only matters from game day onward; default 'not_arrived' otherwise reads as a
  // problem all season. (5h/5i derive a richer phase; this is the simple gate for 5b.)
  const isGameDayOrLater = Boolean(tournament?.start_date && today >= tournament.start_date);

  const coachStatus = team.status === 'accepted'
    ? buildCoachTournamentStatus({
        team: {
          divisionId: team.division_id,
          paymentStatus: team.payment_status ?? null,
          depositPaid: team.deposit_paid ?? null,
          totalPaid: team.total_paid ?? null,
          checkInStatus: team.check_in_status ?? null,
          checkedInAt: team.checked_in_at ?? null,
          rosterSubmittedAt: team.roster_submitted_at ?? null,
          rosterConfirmedAt: team.roster_confirmed_at ?? null,
          paymentCollectedAt: team.payment_collected_at ?? null,
        },
        tournament: tournament
          ? {
              feeMode: tournament.fee_schedule_mode ?? null,
              depositAmount: tournament.deposit_amount ?? null,
              depositDueDate: tournament.deposit_due_date ?? null,
              totalFeeAmount: tournament.total_fee_amount ?? null,
              totalFeeDueDate: tournament.total_fee_due_date ?? null,
            }
          : null,
        division: division
          ? {
              id: division.id,
              name: division.name,
              depositAmount: division.deposit_amount ?? null,
              depositDueDate: division.deposit_due_date ?? null,
              totalFeeAmount: division.total_fee_amount ?? null,
              totalFeeDueDate: division.total_fee_due_date ?? null,
            }
          : null,
        today,
      })
    : null;

  const dateRange = tournament?.start_date
    ? tournament.end_date
      ? `${new Date(tournament.start_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} - ${new Date(tournament.end_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : new Date(tournament.start_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  // 5h phase-adaptive hero. Pending/waitlist/rejected reuse the existing status copy;
  // accepted gets the prep narrative + countdown + a read-only checklist HUD. No public
  // links / Follow here (honesty rule — pending teams have no public profile; 5i adds the
  // game-day bridge for published, accepted divisions only).
  const coachPhase = deriveCoachTournamentPhase({
    registrationStatus: team.status,
    scheduleVisible,
    tournamentStatus: tournament?.status ?? null,
    startDate: tournament?.start_date ?? null,
    endDate: tournament?.end_date ?? null,
    today,
  });
  const registeredDateLabel = team.registered_at
    ? new Date(team.registered_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
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
        {/* Status now lives in the phase-aware hero pill below (no duplicate header badge). */}
      </div>

      <TeamHQ
        variant="tournament"
        phase={coachPhase}
        statusLabel={statusLabel}
        statusBadgeClass={statusBadge}
        statusDesc={statusDesc}
        teamName={team.name}
        tournamentName={tournament?.name ?? null}
        orgName={org?.name ?? null}
        startDate={tournament?.start_date ?? null}
        dateRangeLabel={dateRange}
        contactEmail={coachContactEmail}
        status={coachStatus}
        showCheckIn={isGameDayOrLater}
        registeredDateLabel={registeredDateLabel}
      />

      {coachStatus && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Your status</h2>
          <TournamentStatusBlock
            status={coachStatus}
            contactEmail={coachContactEmail}
            showCheckIn={isGameDayOrLater}
          />
        </section>
      )}

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
            <div className="card" style={{ padding: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.88rem' }}>
              The schedule for this division has not been published yet. Check back after the organizer publishes it.
            </div>
          ) : teamGames.length === 0 ? (
            <div className="card" style={{ padding: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.88rem' }}>
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
          <div className="card" style={{ padding: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.88rem' }}>
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

      {/* Pressure ladder (Phase 5·0): pre-event surfaces stay pitch-free. The earned
          upsell (own-team Premium + run-your-own-tournament) returns at the afterglow — Phase 5m. */}
    </div>
  );
}
