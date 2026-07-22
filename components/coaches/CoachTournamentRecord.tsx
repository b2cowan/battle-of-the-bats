import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import {
  canUserAccessTournamentRegistration,
  findLinkedBasicTeamForRegistration,
  formatGameDateLabel,
  formatGameTimeLabel,
} from '@/lib/basic-coach-teams';
import {
  registrationStatusBadge,
  registrationStatusLabel,
  registrationStatusDesc,
} from '@/lib/coaches-status';
import { buildCoachTournamentStatus } from '@/lib/coach-status-model';
import { deriveCoachTournamentPhase } from '@/lib/coach-tournament-phase';
import { ArrowLeft, CalendarClock, UserCog } from 'lucide-react';
import { teamColor, teamInitials } from '@/lib/team-color';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import TournamentStatusBlock from '@/components/coaches/TournamentStatusBlock';
import TeamHQ from '@/components/coaches/TeamHQ';
import CoachLiveSchedule, { type CoachScheduleGame } from '@/components/coaches/CoachLiveSchedule';
import TournamentRosterSubmit from '@/components/coaches/TournamentRosterSubmit';
import HeadCoachEditor from '@/components/coaches/HeadCoachEditor';
import ScopeCeilingInterest from '@/components/coaches/ScopeCeilingInterest';
import CoachWelcomeBanner from '@/components/coaches/CoachWelcomeBanner';
import CoachNextSteps, { type CoachNextStep } from '@/components/coaches/CoachNextSteps';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import SharePageButton from '@/components/public/SharePageButton';
import { parseRosterRequirements } from '@/lib/roster-requirements';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import type { GameStatus, TournamentSettings } from '@/lib/types';
import styles from './CoachTournamentRecord.module.css';

// Empty-slot sentinel some games use instead of NULL for an unassigned team
// (matches the public game page / opengraph image resolution).
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * The full coach tournament record (hero, live-updating schedule + scores, status,
 * roster submit, announcements, afterglow). Shared between the org-less free Coaches
 * Portal (`/coaches/tournaments/[teamId]`) and the org-scoped Premium portal
 * (`/{orgSlug}/coaches/teams/[teamId]/tournaments/[registrationId]`) so the record is
 * identical in both shells — a Premium coach never gets bounced into the free portal.
 *
 * Caller resolves auth + passes the verified user; this component re-checks access to
 * the registration and `notFound()`s if the user can't see it. `suppressUpsell` hides
 * the free-tier "express interest / run your own event" asks (a paying coach is past
 * them). `backHref` renders a back link (the Premium shell points it at its
 * Tournaments list; the free portal omits it).
 */
export default async function CoachTournamentRecord({
  registrationId,
  userId,
  email,
  suppressUpsell = false,
  welcome = false,
  moneyRedacted = false,
  backHref,
}: {
  registrationId: string;
  userId: string;
  email: string;
  suppressUpsell?: boolean;
  welcome?: boolean;
  /**
   * WI-5 (security): when true (a money='off' assistant coach in the Premium portal), neutralize
   * ALL fee signals — the hero fee strip, the status Fee row, the "Pay your entry fee" next-step,
   * and the pending fee preview. Defaults false so the free-portal caller is unchanged.
   */
  moneyRedacted?: boolean;
  backHref?: string;
}) {
  const access = await canUserAccessTournamentRegistration({
    userId,
    email: email.toLowerCase(),
    registrationId,
  });

  if (!access) {
    notFound();
  }

  // The registration row id is the `teams.id` (a tournament registration is a team row).
  const teamId = registrationId;

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
          .select('id, name, slug, year, start_date, end_date, org_id, status, contact_email, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, settings, public_hidden_pages')
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

  // Two-state schedule (mig 129): a published division always shows real team names.
  const scheduleVisible = division?.schedule_visibility === 'published';

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
    // Reveal a real opponent name only when the schedule is published AND a real team
    // is assigned; otherwise fall back to the game's placeholder/TBD with a neutral
    // monogram (mirrors the public game page — never names an undecided team/bye).
    const realOpponentId = opponentId && opponentId !== NIL_UUID ? opponentId : null;
    const realOpponentName = scheduleVisible && realOpponentId ? teamNameById.get(realOpponentId) : undefined;
    const revealed = Boolean(realOpponentName);
    const opponentName = realOpponentName ?? opponentPlaceholder ?? 'TBD';
    return {
      id: g.id,
      href: canLinkPublic ? `/${org!.slug}/${tournament!.slug}/schedule/${g.id}` : null,
      dateLabel: formatGameDateLabel(g.game_date),
      timeLabel: formatGameTimeLabel(g.game_time),
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

  // WI-5 (security): a single neutralization point. Everything downstream (TeamHQ fee strip,
  // hero checklist Fee row, "Pay your entry fee" next-step, TournamentStatusBlock) keys off
  // `fee.hasSchedule`, so flattening it to a no-schedule shape hides every fee affordance at once.
  if (coachStatus && moneyRedacted) {
    coachStatus.fee = {
      ...coachStatus.fee,
      hasSchedule: false,
      isPaid: false,
      amountDue: null,
      dueDate: null,
      collectedAt: null,
    };
  }

  const dateRange = tournament?.start_date
    ? tournament.end_date
      ? `${new Date(tournament.start_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} - ${new Date(tournament.end_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : new Date(tournament.start_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  // 5h phase-adaptive hero. Pending/waitlist/rejected reuse the existing status copy;
  // accepted gets the prep narrative + countdown + a read-only checklist HUD.
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

  // Theme 1 (5h) pending entry-fee preview — the organizer's scheduled fee, shown on the
  // pending phase as "due if accepted". Prefer the division fee, fall back to the
  // tournament total; PostgREST returns numerics as strings so coerce before the check.
  const pendingFeeRaw = division?.total_fee_amount ?? tournament?.total_fee_amount ?? null;
  const pendingFeeNum = pendingFeeRaw != null ? Number(pendingFeeRaw) : null;
  const pendingFeeAmount =
    coachPhase === 'pending' && pendingFeeNum != null && Number.isFinite(pendingFeeNum) && pendingFeeNum > 0
      ? pendingFeeNum
      : null;

  // Theme 1 (5i) game-day Today card — games scheduled for today, server-derived
  // (the hero card does NOT poll; the live scorebug lives in CoachLiveSchedule below).
  const todayGames =
    coachPhase === 'game_day'
      ? initialGames
          .filter(g => g.date === today)
          .map(g => ({
            timeLabel: g.timeLabel,
            location: g.location,
            opponentName: g.opponentName,
            isHome: g.isHome,
          }))
      : undefined;

  // 5k roster submit. The organizer's requirements (5f) drive whether the Roster milestone
  // shows in the hero checklist and whether the submit card appears.
  const rosterRequirements = parseRosterRequirements((tournament?.settings ?? null) as TournamentSettings | null);
  const showRosterSubmit = team.status === 'accepted' && (rosterRequirements.required || Boolean(team.roster_submitted_at));

  // 5l head-coach assignment. The registrant assigns/changes the head-coach name for any
  // non-rejected team — pending included, so the contact email can route the acceptance email.
  const showHeadCoach = team.status !== 'rejected';

  // 5m afterglow (result phase only). Final W-L-T from completed games + a public standings link.
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
  // The own-team express-interest ask is a FREE-tier nudge — never resolve it (or render it)
  // for a paying Premium coach (suppressUpsell).
  const afterglowBasicTeamId = isResultPhase && !suppressUpsell
    ? await findLinkedBasicTeamForRegistration(userId, teamId)
    : null;
  const upgradeCheckoutOpen = afterglowBasicTeamId ? !(await getPlanGatingMap()).team : false;

  // First-run onboarding banner (free register flow only — Premium passes welcome=false).
  const hiddenPages: string[] = Array.isArray(tournament?.public_hidden_pages)
    ? (tournament!.public_hidden_pages as string[])
    : [];
  const showWelcome =
    welcome && (team.status === 'pending' || team.status === 'waitlist') && Boolean(org?.slug && tournament?.slug);
  const welcomeResources: Array<{ href: string; label: string }> = [];
  if (showWelcome && org?.slug && tournament?.slug) {
    const base = `/${org.slug}/${tournament.slug}`;
    welcomeResources.push({ href: base, label: 'Tournament Home' });
    if (!hiddenPages.includes('schedule')) welcomeResources.push({ href: `${base}/schedule`, label: 'Schedule' });
    if (!hiddenPages.includes('rules')) welcomeResources.push({ href: `${base}/rules`, label: 'Tournament Rules' });
  }

  const isPending = coachPhase === 'pending';

  // Payment instructions (the organizer's "how to pay" text) shown to an ACCEPTED coach who owes.
  const rawPaymentInstructions = (tournament?.settings as Record<string, unknown> | null)?.payment_instructions;
  const paymentInstructions =
    team.status === 'accepted' && typeof rawPaymentInstructions === 'string'
      ? rawPaymentInstructions.trim() || null
      : null;

  const statusSectionTitle =
    coachStatus && !isGameDayOrLater && coachStatus.roster.state === 'none' ? 'Payment' : 'Your status';

  const acceptedNextSteps: CoachNextStep[] = [];
  if (coachPhase === 'accepted_prep' && coachStatus) {
    const fee = coachStatus.fee;
    if (fee.hasSchedule) {
      acceptedNextSteps.push(
        fee.isPaid
          ? { title: 'Entry fee paid', detail: 'Your organizer has recorded your payment — thank you.', done: true }
          : { title: 'Pay your entry fee', detail: 'See how to pay below.' },
      );
    }
    if (showRosterSubmit) {
      acceptedNextSteps.push(
        team.roster_submitted_at
          ? { title: 'Roster submitted', detail: 'You can still update it until the organizer locks rosters.', done: true }
          : { title: 'Submit your roster', detail: 'Add your players in the roster section below.' },
      );
    }
    acceptedNextSteps.push({
      title: 'Watch for the schedule',
      detail: 'Your games will appear here once the organizer publishes the schedule.',
    });
  }

  return (
    <div className={styles.page}>
      {backHref && (
        <Link href={backHref} className={styles.recordBackLink}>
          <ArrowLeft size={14} aria-hidden /> Tournaments
        </Link>
      )}

      {showWelcome && (
        <CoachWelcomeBanner
          teamName={team.name}
          tournamentName={tournament?.name ?? null}
          status={team.status === 'waitlist' ? 'waitlist' : 'pending'}
          resources={welcomeResources}
        />
      )}

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
        pendingFeeAmount={moneyRedacted ? null : pendingFeeAmount}
        todayGames={todayGames}
      />

      {(team.status === 'pending' || team.status === 'waitlist') && (
        <CoachNextSteps status={team.status === 'waitlist' ? 'waitlist' : 'pending'} />
      )}

      {acceptedNextSteps.length > 0 && (
        <CoachNextSteps steps={acceptedNextSteps} label="What's next" />
      )}

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

      {isResultPhase && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>That&apos;s a wrap</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55 }}>
              {suppressUpsell
                ? `Thanks for a great event with ${team.name}. Share how your team finished.`
                : `Thanks for a great event with ${team.name}. Share how your team did, and tell us which tools you'd want next — your Coaches Portal stays free between tournaments.`}
            </p>
            {shareUrl && (
              <SharePageButton
                url={shareUrl}
                title={`${team.name} — ${tournament?.name ?? 'Tournament'}`}
                text={`See how ${team.name} finished at ${tournament?.name ?? 'the tournament'}.`}
                label="Share your team"
              />
            )}
            {!suppressUpsell && afterglowBasicTeamId && <ScopeCeilingInterest basicTeamId={afterglowBasicTeamId} checkoutOpen={upgradeCheckoutOpen} />}
            {!suppressUpsell && (
              <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                Thinking about running your own event?{' '}
                <Link href="/pricing?source=coach_afterglow" style={{ color: 'var(--logic-lime)' }}>See how organizers use FieldLogicHQ &rarr;</Link>
              </p>
            )}
          </div>
        </section>
      )}

      {coachStatus && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{statusSectionTitle}</h2>
          <TournamentStatusBlock
            status={coachStatus}
            contactEmail={coachContactEmail}
            showCheckIn={isGameDayOrLater}
            paymentInstructions={moneyRedacted ? null : paymentInstructions}
            hideFeeRow={moneyRedacted}
          />
        </section>
      )}

      {team.status === 'accepted' && !showLiveBridge && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Schedule</h2>
          <CoachEmptyState
            quiet
            icon={<CalendarClock size={18} aria-hidden />}
            headline={!scheduleVisible ? 'Schedule not published yet' : 'No games scheduled yet'}
            description={
              !scheduleVisible
                ? 'The schedule for this division has not been published. Check back after the organizer publishes it.'
                : 'No games have been scheduled for your team yet.'
            }
          />
        </section>
      )}

      {showRosterSubmit && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Your roster</h2>
          <TournamentRosterSubmit teamId={teamId} />
        </section>
      )}

      {showHeadCoach && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Your entry</h2>
          {isPending && (
            <p className={styles.zoneNote}>Optional for now — you can set this anytime before the event.</p>
          )}
          <CollapsibleCard
            title="Head coach"
            icon={<UserCog size={15} aria-hidden />}
            defaultOpen={!isPending}
          >
            <HeadCoachEditor
              teamId={teamId}
              initialCoach={team.coach ?? ''}
              initialCoachEmail={team.coach_email ?? null}
              registrationEmail={team.email ?? null}
            />
          </CollapsibleCard>
        </section>
      )}

      {!isPending && (
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
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Announcements</h2>
        {relevantAnnouncements.length === 0 ? (
          <p className={styles.organizerNote}>No announcements yet from the organizer.</p>
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
    </div>
  );
}
