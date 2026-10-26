import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Home, BookOpen } from 'lucide-react';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail, getStandings } from '@/lib/db';
import { findRepTeamAccessForRegistration, resolveEventHeadCoachAccess } from '@/lib/coach-registration-access';
import { canUserAccessTournamentRegistration } from '@/lib/basic-coach-teams';
import { formatGameDateLabel, formatGameTimeLabel } from '@/lib/game-clock-labels';
import { canEditEventHeadCoach } from '@/lib/coach-event-head-coach';
import { buildCoachTournamentStatus } from '@/lib/coach-status-model';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';
import { isOurTournamentTeam } from '@/lib/club-own-tournament-team';
import { deriveCoachTournamentPhase } from '@/lib/coach-tournament-phase';
import { deriveCoachLifecycleChip, isFinishedLifecycle } from '@/lib/coach-tournament-lifecycle';
import {
  finishFromStandings,
  finishLabel,
  registrationChip,
  OWN_CLUB_TOURNAMENT_HOST,
  type TournamentChipTone,
  type TournamentFinish,
} from '@/lib/coach-tournament-rows';
import { isGameLive, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { possessive } from '@/lib/utils';

import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import TournamentRegistrationCard from '@/components/coaches/TournamentRegistrationCard';
import CoachLiveSchedule, { type CoachScheduleGame, SCHEDULE_ALERT_SLOT_ID } from '@/components/coaches/CoachLiveSchedule';
import CoachTeamAutoFollow from '@/components/coaches/CoachTeamAutoFollow';
import TournamentRosterSubmit from '@/components/coaches/TournamentRosterSubmit';
import HeadCoachEditor from '@/components/coaches/HeadCoachEditor';
import ScopeCeilingInterest from '@/components/coaches/ScopeCeilingInterest';
import CoachWelcomeBanner from '@/components/coaches/CoachWelcomeBanner';
import CoachMeetTheField from '@/components/coaches/CoachMeetTheField';
import { CoachRow, CoachRowList } from '@/components/coaches/CoachRowList';
import { CoachTournamentChip } from '@/components/coaches/CoachTournamentRows';
import { CoachShareRow } from '@/components/coaches/CoachTournamentRecordParts';
import HelpButton from '@/components/help/HelpButton';
import FlipPill from '@/components/shared/FlipPill';
import { resolveFlip, primaryTarget, HAT_LABEL, publicHref, publicGamePageHref } from '@/lib/flip-twins';
import { getTournamentViewer } from '@/lib/tournament-viewer-hats';
import { parseRosterRequirements } from '@/lib/roster-requirements';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import type { GameStatus, TournamentSettings, PlayoffConfig } from '@/lib/types';
import { isPublicPageEnabled, type PublicPageKey } from '@/lib/public-pages';
import styles from './CoachTournamentRecord.module.css';
import { tournamentToday, formatEventDateRange, formatShortWeekdayDate, formatStoredDate, daysBetweenDateStrings } from '@/lib/timezone';

// Empty-slot sentinel some games use instead of NULL for an unassigned team
// (matches the public game page / opengraph image resolution).
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * The coach's page for ONE tournament entry — shared by the free Coaches Portal
 * (`/coaches/tournaments/[teamId]`) and the paid portal (`/{orgSlug}/coaches/teams/[teamId]/tournaments/
 * [registrationId]`): one page, two shells (Ask 12), never a fork.
 *
 * ═══ Club Tier Stage 7d (drawing 7, T1–T10) ═══
 * Titled by the TOURNAMENT, the team in the meta; one status chip under the title (the tinted hero and
 * the second "Accepted" are gone); "Games on your Schedule", a plain door row onto the team's Schedule
 * on the tournament's first day; Your games with Standings beside the heading; ONE Registration card;
 * Head coach for this event (an autosaving form for whoever the one rule lets change it, a line for
 * everyone else); From the organizer as rows; one help door. The phone order is the story; on a
 * computer the same sections sit in two columns inside the 960 reading column — games left,
 * registration and the event's head coach right. No section exists in only one layout.
 *
 * Caller resolves auth + passes the verified user; this component re-checks access to the registration
 * and `notFound()`s if the user can't see it. `suppressUpsell` hides the free-tier asks; `backHref`
 * renders the back door; `hideHeader` is the free shell (its sticky header names the tournament).
 */
type RecordProps = {
  registrationId: string;
  userId: string;
  email: string;
  suppressUpsell?: boolean;
  welcome?: boolean;
  /**
   * WI-5 (security): when true (a money='off' assistant in the paid portal), neutralize ALL fee signals.
   * Defaults false so the free-portal caller is unchanged.
   */
  moneyRedacted?: boolean;
  backHref?: string;
  /**
   * The FREE portal's shell renders the tournament's identity + Flip in its persistent header, so the
   * free call site hides this page's title. Defaults false — the paid shell has no event header.
   */
  hideHeader?: boolean;
  /**
   * Part D (2026-09-13): let a coach who is NOT a member of the linked free team open the record on the
   * strength of a configuring coaching assignment. ONLY the paid page passes true — it computes
   * `moneyRedacted` from that same assignment.
   */
  allowAssignmentAccess?: boolean;
  /** The team's Schedule (no query) — "Games on your Schedule" opens it on the tournament's first day.
   *  Absent: no door (a registration-only coach with no team to open). */
  scheduleHref?: string | null;
  /** The full coaches guide, for the help door's "open the whole guide". */
  helpGuideHref: string;
  /** The paid shell's page header (titled by the tournament), drawn by the PAGE so its "?" is the masthead's. */
  headerSlot?: React.ReactNode;
};

export default async function CoachTournamentRecord({
  registrationId,
  userId,
  email,
  suppressUpsell = false,
  welcome = false,
  moneyRedacted = false,
  backHref,
  hideHeader = false,
  allowAssignmentAccess = false,
  scheduleHref = null,
  helpGuideHref,
  headerSlot,
}: RecordProps) {
  // Access and team identity are the same fact: the linked free team this user owns.
  const ownedBasicTeamId = await canUserAccessTournamentRegistration({
    userId,
    email: email.toLowerCase(),
    registrationId,
  });
  // The record follows the list (2026-09-13, Part D): staff on the team the entry belongs to.
  const repAccess = ownedBasicTeamId || !allowAssignmentAccess ? null : await findRepTeamAccessForRegistration(userId, registrationId);
  if (!ownedBasicTeamId && !repAccess) {
    notFound();
  }

  // The registration row id is the `teams.id` (a tournament registration is a team row).
  const teamId = registrationId;

  const { data: team, error: teamError } = await supabaseAdmin
    .from('teams')
    .select('id, name, coach, email, coach_email, status, registered_at, tournament_id, division_id, payment_status, deposit_paid, total_paid, entry_lowered, payment_collected_at, check_in_status, checked_in_at, roster_submitted_at, roster_confirmed_at')
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
    headCoachAccess,
  ] = await Promise.all([
    team.tournament_id
      ? supabaseAdmin
          .from('tournaments')
          .select('id, name, slug, year, start_date, end_date, org_id, status, contact_email, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, settings, public_hidden_pages, logo_url')
          .eq('id', team.tournament_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    team.division_id
      ? supabaseAdmin
          .from('divisions')
          // `playoff_config` carries the division's tie-breaker overrides and coin tosses — without it
          // the finish disagrees with the public standings for exactly the ties a human settled.
          .select('id, name, schedule_visibility, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, playoff_config')
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
          .select('id, game_date, game_time, duration_minutes, location, home_team_id, away_team_id, home_score, away_score, status, is_playoff, diamond_id, home_placeholder, away_placeholder')
          .eq('tournament_id', team.tournament_id)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .order('game_date', { ascending: true })
          .order('game_time', { ascending: true })
      : Promise.resolve({ data: [] }),

    // Accepted teams → opponent names (only accepted teams have public profiles) and "Meet the field".
    team.tournament_id
      ? supabaseAdmin
          .from('teams')
          .select('id, name, division_id')
          .eq('tournament_id', team.tournament_id)
          .eq('status', 'accepted')
      : Promise.resolve({ data: [] }),

    // Who may change the event's head coach — the SAME rule the PATCH route refuses with (Ask 10).
    resolveEventHeadCoachAccess(userId, registrationId),
  ]);
  const canEditHeadCoach = canEditEventHeadCoach(headCoachAccess);

  let org: { slug: string; name: string; logo_url: string | null } | null = null;
  if (tournament?.org_id) {
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('slug, name, logo_url')
      .eq('id', tournament.org_id)
      .maybeSingle();
    org = orgData;
  }
  // Our own team owes no entry fee on every plan (owner 2026-10-21): no plan gate.
  const clubOwnTeam = Boolean(tournament?.org_id && await isOurTournamentTeam(tournament.org_id, registrationId));

  // The organizer's contact for coaches — respects their "Communication with coaches" toggle.
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
    duration_minutes: number | null;
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

  const teamNameById = new Map(
    ((acceptedTeams ?? []) as Array<{ id: string; name: string }>).map(t => [t.id, t.name] as const),
  );

  // The live bridge (public deep-links, polling, Follow) needs the tournament publicly visible.
  const tournamentIsPublic = tournament?.status === 'active' || tournament?.status === 'completed';
  const publicCtx = tournamentIsPublic && org?.slug && tournament?.slug
    ? { orgSlug: org.slug, tournamentSlug: tournament.slug }
    : null;
  const canLinkPublic = Boolean(scheduleVisible && publicCtx);

  const opponentOf = (g: (typeof teamGames)[number]) => {
    const isHome = g.home_team_id === teamId;
    const opponentId = isHome ? g.away_team_id : g.home_team_id;
    const placeholder = isHome ? g.away_placeholder : g.home_placeholder;
    // A real name only when the schedule is published AND a real team is assigned — never an
    // undecided team or a bye (mirrors the public game page).
    const realId = opponentId && opponentId !== NIL_UUID ? opponentId : null;
    const real = scheduleVisible && realId ? teamNameById.get(realId) : undefined;
    return { isHome, name: real ?? placeholder ?? 'TBD' };
  };

  const initialGames: CoachScheduleGame[] = teamGames.map(g => {
    const { isHome, name } = opponentOf(g);
    return {
      id: g.id,
      href: canLinkPublic ? publicGamePageHref(publicCtx!, g.id) : null,
      dateLabel: formatGameDateLabel(g.game_date),
      timeLabel: formatGameTimeLabel(g.game_time),
      date: g.game_date,
      time: g.game_time,
      durationMinutes: g.duration_minutes,
      isHome,
      opponentName: name,
      location: g.location,
      isPlayoff: g.is_playoff,
      myScore: isHome ? g.home_score : g.away_score,
      oppScore: isHome ? g.away_score : g.home_score,
      status: g.status as GameStatus,
    };
  });

  const showLiveBridge = team.status === 'accepted' && scheduleVisible && initialGames.length > 0;

  const today = tournamentToday();
  // Check-in only matters from game day onward.
  const isGameDayOrLater = Boolean(tournament?.start_date && today >= tournament.start_date);

  // "Not tracked here": no fee, amount, due date, "Paid" or how-to-pay text anywhere on this page.
  const tracksPayments = tournamentTracksPayments(tournament?.settings);
  const feeHidden = moneyRedacted || !tracksPayments;

  const coachStatus = team.status === 'accepted'
    ? buildCoachTournamentStatus({
        team: {
          divisionId: team.division_id,
          paymentStatus: team.payment_status ?? null,
          depositPaid: team.deposit_paid ?? null,
          totalPaid: team.total_paid ?? null,
          entryLowered: team.entry_lowered ?? null,
          checkInStatus: team.check_in_status ?? null,
          checkedInAt: team.checked_in_at ?? null,
          rosterSubmittedAt: team.roster_submitted_at ?? null,
          rosterConfirmedAt: team.roster_confirmed_at ?? null,
          paymentCollectedAt: team.payment_collected_at ?? null,
        },
        tournament: tournament
          ? {
              feeMode: tournament.fee_schedule_mode ?? null,
              tracksPayments,
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

  // WI-5 (security): ONE neutralization point — flattening the fee hides every fee signal at once. The
  // club's own team owes no fee (Stage 7a), so it takes the same flattening.
  if (coachStatus && (moneyRedacted || clubOwnTeam)) {
    coachStatus.fee = {
      ...coachStatus.fee,
      hasSchedule: false,
      isPaid: false,
      totalFee: null,
      amountDue: null,
      dueDate: null,
      collectedAt: null,
    };
  }

  const coachPhase = deriveCoachTournamentPhase({
    registrationStatus: team.status,
    scheduleVisible,
    tournamentStatus: tournament?.status ?? null,
    startDate: tournament?.start_date ?? null,
    endDate: tournament?.end_date ?? null,
    today,
  });
  // The pending entry-fee preview — the organizer's scheduled fee, "due if accepted".
  const pendingFeeRaw = division?.total_fee_amount ?? tournament?.total_fee_amount ?? null;
  const pendingFeeNum = pendingFeeRaw != null ? Number(pendingFeeRaw) : null;
  const pendingFeeAmount =
    coachPhase === 'pending' && pendingFeeNum != null && Number.isFinite(pendingFeeNum) && pendingFeeNum > 0
      ? pendingFeeNum
      : null;

  // Roster submit (5k): the organizer's requirements decide whether the card appears.
  const rosterRequirements = parseRosterRequirements((tournament?.settings ?? null) as TournamentSettings | null);
  const showRosterSubmit = team.status === 'accepted' && (rosterRequirements.required || Boolean(team.roster_submitted_at));

  const isResultPhase = coachPhase === 'result';
  const isRejected = coachPhase === 'rejected';
  const hasFinalRecord = isResultPhase && teamGames.some(g => g.status === 'completed' && g.home_score != null && g.away_score != null);
  // The own-team upgrade ask is a FREE-tier nudge — never for a paying coach (suppressUpsell).
  const afterglowBasicTeamId = isResultPhase && !suppressUpsell ? ownedBasicTeamId : null;
  const upgradeCheckoutOpen = afterglowBasicTeamId ? !(await getPlanGatingMap()).team : false;

  const hiddenPages: string[] = Array.isArray(tournament?.public_hidden_pages)
    ? (tournament!.public_hidden_pages as string[])
    : [];
  const showWelcome =
    welcome && (team.status === 'pending' || team.status === 'waitlist') && Boolean(org?.slug && tournament?.slug);

  // From the organizer (drawing 7: three rows). The links exist once the tournament is public, or for a
  // pending/waitlisted team whose event may not be public yet; a rejected team never had them.
  const resourcesOpen = Boolean(
    org?.slug && tournament?.slug && team.status !== 'rejected' &&
    (tournamentIsPublic || team.status === 'pending' || team.status === 'waitlist'),
  );
  const resCtx = resourcesOpen ? { orgSlug: org!.slug, tournamentSlug: tournament!.slug as string } : null;
  const sharePublicHref = publicCtx && !isRejected ? publicHref(publicCtx, 'overview') : null;

  // "Meet the field" — the pre-schedule state of Your games.
  const fieldTeams = (acceptedTeams ?? []) as Array<{ id: string; name: string; division_id: string | null }>;
  const showMeetTheField = team.status === 'accepted' && !hiddenPages.includes('teams') && fieldTeams.length > 1;
  const fieldDivisionCount = team.division_id ? fieldTeams.filter(t => t.division_id === team.division_id).length : 0;
  const fieldSampleNames = fieldTeams
    .filter(t => t.id !== teamId)
    .sort((a, b) => Number(b.division_id === team.division_id) - Number(a.division_id === team.division_id))
    .map(t => t.name);
  const teamsHref = publicCtx && !hiddenPages.includes('teams') ? publicHref(publicCtx, 'teams') : null;

  // Standings: the finish ("2nd of 4") on the status chip, and the Standings box beside Your games —
  // both only when the organizer shows standings publicly (which also rules out a bracket-only event).
  const standingsPublicallyOn = isPublicPageEnabled(
    { publicHiddenPages: hiddenPages as PublicPageKey[], settings: tournament?.settings as TournamentSettings },
    'standings',
  );
  let finish: TournamentFinish | null = null;
  if (isResultPhase && team.tournament_id && team.division_id && standingsPublicallyOn && showLiveBridge) {
    const rows = await getStandings(
      team.tournament_id,
      team.division_id,
      (division?.playoff_config as PlayoffConfig | null) ?? undefined,
      { admin: true },
      tournament?.settings ?? undefined,
    );
    finish = finishFromStandings(rows, teamId);
  }
  const standingsPublicHref = publicCtx && standingsPublicallyOn && showLiveBridge ? publicHref(publicCtx, 'standings') : null;

  // ── The chips under the title (T4): the entry's status, then what the event is doing.
  const statusChip = registrationChip(team.status);
  let eventChip: { label: string; tone: TournamentChipTone } | null = null;
  if (team.status === 'accepted' && tournament) {
    const life = deriveCoachLifecycleChip(tournament.start_date, tournament.end_date, today, tournament.status).state;
    const playingNow = initialGames.some(g => isGameLive(
      { status: g.status, date: g.date, time: g.time },
      g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES,
    ));
    if (isFinishedLifecycle(life)) {
      eventChip = { label: finish ? `Finished · ${finishLabel(finish)}` : 'Finished', tone: 'mute' };
    } else if (playingNow) {
      eventChip = { label: 'Playing now', tone: 'live' };
    } else if (life === 'live' || life === 'game_day') {
      eventChip = { label: 'Game day', tone: 'live' };
    } else if (tournament.start_date && today < tournament.start_date) {
      const days = daysBetweenDateStrings(today, tournament.start_date);
      eventChip = { label: `In ${days} ${days === 1 ? 'day' : 'days'}`, tone: 'mute' };
    }
  }

  // The meta under the title: team · dates · host (R4). The club's own tournament says so.
  const dateRange = formatEventDateRange(tournament?.start_date, tournament?.end_date, false);
  const host = clubOwnTeam ? OWN_CLUB_TOURNAMENT_HOST : org?.name ?? null;
  const metaLine = [team.name, dateRange, host].filter(Boolean).join(' · ');

  // "Games on your Schedule" — the team's Schedule opened on the tournament's first day (a DAY in the
  // link, never a year: the Schedule moves its own cursor; CLAUDE.md's year rule is untouched).
  const firstDay = tournament?.start_date ?? initialGames.find(g => g.date)?.date ?? null;
  const scheduleDoor = scheduleHref && showLiveBridge && firstDay
    ? {
        href: `${scheduleHref}?day=${firstDay}`,
        caption: `${initialGames.length} ${initialGames.length === 1 ? 'game' : 'games'} · opens on ${formatShortWeekdayDate(firstDay)}`,
      }
    : null;

  const help = { module: 'coaches' as const, sectionIds: ['tournaments'], label: 'Tournaments', fullGuideHref: helpGuideHref };

  // The paid header's Fan view: the public page, or a chooser for someone wearing another hat here.
  const otherRoleHats =
    !hideHeader && publicCtx && org && tournament?.org_id && tournament?.id
      ? ((await getTournamentViewer({
          orgSlug: org.slug,
          orgId: tournament.org_id,
          orgName: org.name,
          tournamentId: tournament.id,
        }).catch(() => null))?.hats ?? []).filter(hat => !(hat.kind === 'coach' && hat.teamId === teamId))
      : [];
  const fanView = !hideHeader && publicCtx ? (
    <FlipPill
      resolution={(() => {
        const toPublic = resolveFlip({ direction: 'to-public', hat: 'coach', ctx: publicCtx });
        if (otherRoleHats.length === 0) return toPublic;
        return {
          kind: 'multi' as const,
          label: 'Roles',
          targets: [
            primaryTarget(toPublic),
            ...otherRoleHats.map(hat => ({ href: hat.href, label: HAT_LABEL[hat.kind], sublabel: hat.label })),
          ],
        };
      })()}
    />
  ) : null;

  const headCoachName = team.coach?.trim() || null;

  return (
    <>
      {/* B2.2 ◆V1 — an accepted coach becomes a RECIPIENT of schedule alerts here (renders nothing). */}
      {team.status === 'accepted' && org?.slug && tournament?.slug && (
        <CoachTeamAutoFollow
          orgSlug={org.slug}
          tournamentSlug={tournament.slug}
          teamId={teamId}
          teamName={team.name}
          teamDivisionId={team.division_id}
          enabled
        />
      )}

      <div className={hideHeader ? styles.page : `${styles.page} ${styles.pageInShell}`}>
        {!hideHeader && headerSlot}
        {hideHeader && backHref && (
          <Link href={backHref} className={styles.backLink}><ArrowLeft size={14} aria-hidden /> Tournaments</Link>
        )}

        <div className={styles.identity}>
          {!hideHeader && metaLine && <p className={styles.meta}>{metaLine}</p>}
          <div className={styles.chips}>
            <CoachTournamentChip {...statusChip} />
            {eventChip && <CoachTournamentChip {...eventChip} />}
            {/* The tournament's public page (⇄ Fan view) — the title's companion in the paid shell; the free
                shell's header carries its own. Navigation, so never a page-header action. */}
            {fanView && <span className={styles.fanView}>{fanView}</span>}
            {/* The free shell has no masthead to publish a "?" to: its one help door sits here. */}
            {hideHeader && (
              <span className={styles.helpDoor}><HelpButton iconOnly label="Tournaments" help={help} /></span>
            )}
          </div>
        </div>

        {showWelcome && (
          <CoachWelcomeBanner
            teamName={team.name}
            tournamentName={tournament?.name ?? null}
            status={team.status === 'waitlist' ? 'waitlist' : 'pending'}
            shareHref={sharePublicHref}
          />
        )}

        {/* The afterglow — free tier only; a paying coach is past these asks. */}
        {isResultPhase && !suppressUpsell && (
          <div className={`card ${styles.afterglow}`}>
            <p className={styles.afterglowLede}>
              {hasFinalRecord
                ? <>That&apos;s the first line of <strong>{possessive(team.name)}</strong> season history.</>
                : <>That&apos;s a wrap for <strong>{team.name}</strong>.</>}
            </p>
            <p className={styles.afterglowText}>
              Your Coaches Portal stays free between tournaments — {hasFinalRecord
                ? 'but the record, who played and who earned an award go with the event unless you keep them.'
                : 'but who played and who earned an award go with the event unless you keep them.'}
            </p>
            {afterglowBasicTeamId && (
              <ScopeCeilingInterest basicTeamId={afterglowBasicTeamId} checkoutOpen={upgradeCheckoutOpen} />
            )}
            <p className={styles.afterglowOrg}>
              Thinking about running your own event?{' '}
              <Link href="/pricing?source=coach_afterglow">See how organizers use FieldLogicHQ &rarr;</Link>
            </p>
          </div>
        )}

        <div className={styles.grid}>
          {/* ── Left on a computer: the door, the games, the organizer ── */}
          <div className={styles.col}>
            {scheduleDoor && (
              <div className={styles.door}>
                <CoachRowList label="Your Schedule">
                  <CoachRow as="link" href={scheduleDoor.href} title="Games on your Schedule" caption={scheduleDoor.caption} door="chevron" />
                </CoachRowList>
              </div>
            )}

            {!isRejected && (
              <section id="schedule" className={styles.games} aria-labelledby="games-heading">
                {/* id="schedule": the game-changed notifications (bell, push) link to `…#schedule`. */}
                {/* B2.1: the "Schedule updated" bar is hoisted ABOVE the heading (CoachLiveSchedule portals it here). */}
                {showLiveBridge && <div id={SCHEDULE_ALERT_SLOT_ID} />}
                <div className={styles.sectionHead}>
                  <h2 id="games-heading" className={styles.sectionTitle}>Your games</h2>
                  {standingsPublicHref && (
                    <Link href={standingsPublicHref} className={styles.standingsBox}>Standings</Link>
                  )}
                </div>

                {showLiveBridge ? (
                  <>
                    <CoachLiveSchedule
                      orgSlug={org?.slug ?? ''}
                      tournamentSlug={tournament?.slug ?? ''}
                      teamId={teamId}
                      // B2.1 window: from schedule publication until the event is over.
                      pollEnabled={canLinkPublic && !isResultPhase}
                      pollIntervalMs={coachPhase === 'game_day' ? 30_000 : 120_000}
                      alertSlotId={SCHEDULE_ALERT_SLOT_ID}
                      initialGames={initialGames}
                    />
                  </>
                ) : team.status === 'accepted' ? (
                  <>
                    <CoachEmptyState
                      quiet
                      headline={!scheduleVisible ? 'Schedule not published yet' : 'No games scheduled yet'}
                      description={
                        !scheduleVisible
                          ? 'The schedule for this division has not been published. Check back after the organizer publishes it.'
                          : 'No games have been scheduled for your team yet.'
                      }
                    />
                    {showMeetTheField && (
                      <CoachMeetTheField
                        totalTeams={fieldTeams.length}
                        divisionTeams={fieldDivisionCount}
                        divisionName={division?.name ?? null}
                        sampleNames={fieldSampleNames}
                        teamsHref={teamsHref}
                      />
                    )}
                  </>
                ) : (
                  <CoachEmptyState
                    quiet
                    headline="Nothing scheduled yet"
                    description="Your games appear here once you're accepted and the organizer publishes the schedule."
                  />
                )}
              </section>
            )}

            <section className={styles.organizer} aria-labelledby="organizer-heading">
              <h2 id="organizer-heading" className={styles.sectionTitle}>From the organizer</h2>
              {(resCtx || sharePublicHref) && (
                <CoachRowList label="From the organizer">
                  {resCtx && (
                    <CoachRow as="link" href={publicHref(resCtx, 'overview')} mark={<Home size={15} />} title="Tournament home" titleWeight="plain" door="chevron" />
                  )}
                  {resCtx && !hiddenPages.includes('rules') && (
                    <CoachRow as="link" href={publicHref(resCtx, 'rules')} mark={<BookOpen size={15} />} title="Rules" titleWeight="plain" door="chevron" />
                  )}
                  {sharePublicHref && (
                    <CoachShareRow
                      url={sharePublicHref}
                      title={tournament?.name ?? 'Tournament'}
                      text={`${team.name} is playing at ${tournament?.name ?? 'this tournament'}.`}
                    />
                  )}
                </CoachRowList>
              )}
              {relevantAnnouncements.length === 0 ? (
                <p className={styles.quiet}>No announcements from the organizer.</p>
              ) : (
                <CoachRowList label="Announcements">
                  {relevantAnnouncements.map(a => (
                    <CoachRow
                      key={a.id}
                      as="static"
                      lead={formatStoredDate(a.created_at, { withYear: false })}
                      title={a.title}
                      note={a.body ?? undefined}
                    />
                  ))}
                </CoachRowList>
              )}
            </section>
          </div>

          {/* ── Right on a computer: the registration and the event's head coach ── */}
          <div className={styles.col}>
            <div className={styles.registration}>
              <TournamentRegistrationCard
                phase={coachPhase}
                status={coachStatus}
                contactEmail={coachContactEmail}
                showCheckIn={isGameDayOrLater}
                registeredAt={team.registered_at ?? null}
                paymentInstructions={feeHidden ? null : paymentInstructionsOf(tournament?.settings, team.status)}
                hideFeeRow={feeHidden}
                clubOwnTeam={clubOwnTeam}
                pendingFeeAmount={feeHidden || clubOwnTeam ? null : pendingFeeAmount}
                rosterPointer={showRosterSubmit && canEditHeadCoach && !team.roster_submitted_at}
                waitlisted={team.status === 'waitlist'}
              />
            </div>

            {/* Roster submission stays where the organizer requires it (drawing 7's tag). */}
            {showRosterSubmit && (
              <div className={styles.roster}>
                <TournamentRosterSubmit teamId={teamId} />
              </div>
            )}

            {!isRejected && (
              <section className={styles.headCoach} aria-labelledby="head-coach-heading">
                <h2 id="head-coach-heading" className={styles.cardTitle}>Head coach for this event</h2>
                {canEditHeadCoach ? (
                  <HeadCoachEditor
                    teamId={teamId}
                    initialCoach={team.coach ?? ''}
                    initialCoachEmail={team.coach_email ?? null}
                    registrationEmail={team.email ?? null}
                  />
                ) : (
                  /* Everyone the rule does not name reads a line (the server refuses their save). */
                  <p className={styles.headCoachLine}>
                    Head coach for this event: <strong>{headCoachName ?? 'Not set yet'}</strong>
                    <span className={styles.quiet}> · Ask the head coach to change this.</span>
                  </p>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** The organizer's "how to pay" text, for an ACCEPTED coach. */
function paymentInstructionsOf(settings: unknown, status: string): string | null {
  const raw = (settings as Record<string, unknown> | null)?.payment_instructions;
  return status === 'accepted' && typeof raw === 'string' ? raw.trim() || null : null;
}
