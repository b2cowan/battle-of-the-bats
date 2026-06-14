import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { canUserAccessTournamentRegistration, findLinkedBasicTeamForRegistration } from '@/lib/basic-coach-teams';
import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
import {
  registrationStatusBadge,
  registrationStatusLabel,
  registrationStatusDesc,
} from '@/lib/coaches-status';
import { buildCoachTournamentStatus } from '@/lib/coach-status-model';
import { deriveCoachTournamentPhase } from '@/lib/coach-tournament-phase';
import { teamColor, teamInitials } from '@/lib/team-color';
import TournamentStatusBlock from '@/components/coaches/TournamentStatusBlock';
import TeamHQ from '@/components/coaches/TeamHQ';
import CoachLiveSchedule, { type CoachScheduleGame } from '@/components/coaches/CoachLiveSchedule';
import TournamentRosterSubmit from '@/components/coaches/TournamentRosterSubmit';
import HeadCoachEditor from '@/components/coaches/HeadCoachEditor';
import ScopeCeilingInterest from '@/components/coaches/ScopeCeilingInterest';
import SharePageButton from '@/components/public/SharePageButton';
import { parseRosterRequirements } from '@/lib/roster-requirements';
import type { GameStatus, TournamentSettings } from '@/lib/types';
import styles from './detail.module.css';

// Empty-slot sentinel some games use instead of NULL for an unassigned team
// (matches the public game page / opengraph image resolution).
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

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
    .select('id, name, coach, email, coach_email, status, registered_at, tournament_id, division_id, payment_status, deposit_paid, total_paid, payment_collected_at, check_in_status, checked_in_at, roster_submitted_at, roster_confirmed_at')
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
    { data: acceptedTeams },
  ] = await Promise.all([
    team.tournament_id
      ? supabaseAdmin
          .from('tournaments')
          .select('id, name, slug, year, start_date, end_date, org_id, status, contact_email, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, settings')
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
          .select('id, game_date, game_time, location, home_team_id, away_team_id, home_score, away_score, status, is_playoff, diamond_id, home_placeholder, away_placeholder')
          .eq('tournament_id', team.tournament_id)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .order('game_date', { ascending: true })
          .order('game_time', { ascending: true })
      : Promise.resolve({ data: [] }),

    // Accepted teams in the tournament → opponent-name lookup for the schedule
    // bridge. Only accepted teams have public profiles, so this is the honest
    // resolution set; null home/away (TBD bracket games) fall back to "TBD".
    team.tournament_id
      ? supabaseAdmin
          .from('teams')
          .select('id, name')
          .eq('tournament_id', team.tournament_id)
          .eq('status', 'accepted')
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
    home_placeholder: string | null;
    away_placeholder: string | null;
  }>;

  // 5i game-day bridge data. Opponent names resolve from the accepted set (only
  // accepted teams have public profiles); null home/away → "TBD".
  const teamNameById = new Map(
    ((acceptedTeams ?? []) as Array<{ id: string; name: string }>).map(t => [t.id, t.name] as const),
  );

  // Matchups are public ONLY under 'published_teams'. 'published_generic' means the
  // organizer published times/locations but deliberately HID who-plays-who — so the
  // coach bridge must mirror the public game page (getTeamDisplay): show the
  // placeholder/TBD, never the real opponent name, or it would leak the hidden
  // identity AND mismatch the page it links to.
  const namesPublished = division?.schedule_visibility === 'published_teams';

  // The live bridge (public deep-links, live scorebug, Follow) additionally
  // requires the tournament to be publicly visible (active|completed) — the public
  // game page + follow dock don't exist for a draft tournament. When the division
  // schedule is published but the tournament isn't yet public, the schedule still
  // renders statically (names + final scores), just without links / polling / follow.
  const tournamentIsPublic = tournament?.status === 'active' || tournament?.status === 'completed';
  const canLinkPublic = Boolean(scheduleVisible && tournamentIsPublic && org?.slug && tournament?.slug);

  const initialGames: CoachScheduleGame[] = teamGames.map(g => {
    const isHome = g.home_team_id === teamId;
    const opponentId = isHome ? g.away_team_id : g.home_team_id;
    const opponentPlaceholder = isHome ? g.away_placeholder : g.home_placeholder;
    // Reveal a real opponent name only when matchups are published AND a real team
    // is assigned; otherwise fall back to the game's placeholder/TBD with a neutral
    // monogram (mirrors the public game page — never leaks a hidden/undecided team).
    const realOpponentId = opponentId && opponentId !== NIL_UUID ? opponentId : null;
    const realOpponentName = namesPublished && realOpponentId ? teamNameById.get(realOpponentId) : undefined;
    const revealed = Boolean(realOpponentName);
    const opponentName = realOpponentName ?? opponentPlaceholder ?? 'TBD';
    return {
      id: g.id,
      href: canLinkPublic ? `/${org!.slug}/${tournament!.slug}/schedule/${g.id}` : null,
      dateLabel: g.game_date
        ? new Date(g.game_date + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
        : 'TBD',
      timeLabel: g.game_time
        ? new Date(`1970-01-01T${g.game_time}`).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
        : null,
      date: g.game_date,
      isHome,
      opponentName,
      opponentInitials: revealed ? teamInitials(opponentName) : '–',
      opponentColor: revealed ? teamColor(opponentName) : 'var(--white-40)',
      location: g.location,
      isPlayoff: g.is_playoff,
      myScore: isHome ? g.home_score : g.away_score,
      oppScore: isHome ? g.away_score : g.home_score,
      status: g.status as GameStatus,
    };
  });

  const showLiveBridge = team.status === 'accepted' && scheduleVisible && initialGames.length > 0;

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

  // 5k roster submit. The organizer's requirements (5f) drive whether the Roster milestone
  // shows in the hero checklist and whether the submit card appears. Show the card for an
  // accepted team when a roster is required OR one was already submitted (so a coach can still
  // view/update it). The card itself fetches the master roster + current snapshot from the 5j API.
  const rosterRequirements = parseRosterRequirements((tournament?.settings ?? null) as TournamentSettings | null);
  const showRosterSubmit = team.status === 'accepted' && (rosterRequirements.required || Boolean(team.roster_submitted_at));

  // 5l head-coach assignment. The registrant assigns/changes the head-coach name (+ optional
  // contact email) for any non-rejected team — pending included, so the contact email can route
  // the acceptance email. Rejected teams have nothing to assign.
  const showHeadCoach = team.status !== 'rejected';

  // 5m afterglow (result phase only). The in-portal afterglow renders for EVERY coach regardless
  // of the organizer's plan (J5-050) — final W-L-T from completed games + a public standings link.
  const isResultPhase = coachPhase === 'result';
  const record = isResultPhase
    ? teamGames.reduce(
        (acc, g) => {
          if (g.status !== 'completed') return acc;
          const isHome = g.home_team_id === teamId;
          const my = isHome ? g.home_score : g.away_score;
          const opp = isHome ? g.away_score : g.home_score;
          if (my == null || opp == null) return acc;
          if (my > opp) acc.wins++;
          else if (my < opp) acc.losses++;
          else acc.ties++;
          return acc;
        },
        { wins: 0, losses: 0, ties: 0 },
      )
    : null;
  // Standings link + team-profile share exist only when the tournament is public (active|completed).
  const canShareAfterglow = Boolean(isResultPhase && tournamentIsPublic && org?.slug && tournament?.slug);
  const standingsHref = canShareAfterglow ? `/${org!.slug}/${tournament!.slug}/standings` : null;
  const shareUrl = canShareAfterglow ? `/${org!.slug}/${tournament!.slug}/teams/${teamId}` : null;
  // The own-team express-interest ask needs the linked basic team id; resolve it only in the
  // result phase (one extra query, afterglow-only) — the single earned ask in the pressure ladder.
  const afterglowBasicTeamId = isResultPhase
    ? await findLinkedBasicTeamForRegistration(user.id, teamId)
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
        rosterRequired={rosterRequirements.required}
        record={record}
        standingsHref={standingsHref}
      />

      {/* 5i game-day bridge — placed directly under the hero so the live scorebug
          + opponents sit in the "hero zone" for accepted teams with a published
          division schedule. Renders static (names, no links/live) when the
          tournament isn't public yet. */}
      {showLiveBridge && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Schedule</h2>
          <CoachLiveSchedule
            orgSlug={org?.slug ?? ''}
            tournamentSlug={tournament?.slug ?? ''}
            teamId={teamId}
            teamName={team.name}
            teamDivisionId={team.division_id}
            live={canLinkPublic}
            pollEnabled={canLinkPublic && coachPhase === 'game_day'}
            isResult={isResultPhase}
            initialGames={initialGames}
          />
        </section>
      )}

      {/* 5m afterglow — the SINGLE earned ask, shown only after the event completes (the rest of
          the coach experience stays pitch-free). Share the result + two express-interest bridges:
          own-team Premium (real capture) and a soft "run your own event" discovery link. */}
      {isResultPhase && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>That&apos;s a wrap</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Thanks for a great event with {team.name}. Share how your team did, and tell us which tools you&apos;d want next — your Coaches Portal stays free between tournaments.
            </p>
            {shareUrl && (
              <SharePageButton
                url={shareUrl}
                title={`${team.name} — ${tournament?.name ?? 'Tournament'}`}
                text={`See how ${team.name} finished at ${tournament?.name ?? 'the tournament'}.`}
                label="Share your team"
              />
            )}
            {afterglowBasicTeamId && <ScopeCeilingInterest basicTeamId={afterglowBasicTeamId} />}
            <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
              Thinking about running your own event?{' '}
              <Link href="/pricing?source=coach_afterglow" style={{ color: 'var(--logic-lime)' }}>See how organizers use FieldLogicHQ &rarr;</Link>
            </p>
          </div>
        </section>
      )}

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

      {/* 5k — per-event roster submit. Only for accepted teams when the organizer requires a
          roster (or one was already submitted). The card fetches the master roster + current
          snapshot from the 5j API and writes the snapshot only (never the master). */}
      {showRosterSubmit && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Your roster</h2>
          <TournamentRosterSubmit teamId={teamId} />
        </section>
      )}

      {/* 5l — head-coach + contact assignment. The registrant sets who coaches this team for
          the event + an optional contact email; writes teams.coach / teams.coach_email. The
          email never overwrites the team's access/claim email. */}
      {showHeadCoach && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Head coach</h2>
          <HeadCoachEditor
            teamId={teamId}
            initialCoach={team.coach ?? ''}
            initialCoachEmail={team.coach_email ?? null}
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

      {/* When there's no live bridge to show, keep the schedule empty/unpublished
          notes in their normal position (the bridge above owns the populated case). */}
      {team.status === 'accepted' && !showLiveBridge && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Schedule</h2>
          <div className="card" style={{ padding: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.88rem' }}>
            {!scheduleVisible
              ? 'The schedule for this division has not been published yet. Check back after the organizer publishes it.'
              : 'No games scheduled for your team yet.'}
          </div>
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
