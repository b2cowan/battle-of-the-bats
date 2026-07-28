import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail, getStandings } from '@/lib/db';
import {
  canUserAccessTournamentRegistration,
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
import { ArrowLeft, BookOpen, CalendarClock, CalendarDays, ChevronDown, ClipboardList, Home, Megaphone, UserCog, Users } from 'lucide-react';

import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import TournamentStatusBlock from '@/components/coaches/TournamentStatusBlock';
import TeamHQ from '@/components/coaches/TeamHQ';
import CoachLiveSchedule, { type CoachScheduleGame } from '@/components/coaches/CoachLiveSchedule';
import TournamentRosterSubmit from '@/components/coaches/TournamentRosterSubmit';
import HeadCoachEditor from '@/components/coaches/HeadCoachEditor';
import ScopeCeilingInterest from '@/components/coaches/ScopeCeilingInterest';
import CoachWelcomeBanner from '@/components/coaches/CoachWelcomeBanner';
import CoachRecordJumpNav from '@/components/coaches/CoachRecordJumpNav';
import CoachScheduleCalendarButton from '@/components/coaches/CoachScheduleCalendarButton';
import CoachMeetTheField from '@/components/coaches/CoachMeetTheField';
import CoachStandingsSnapshot from '@/components/coaches/CoachStandingsSnapshot';
import SharePageButton from '@/components/public/SharePageButton';
import type { ICSEventInput } from '@/lib/export/ics';
import FlipPill from '@/components/shared/FlipPill';
import { resolveFlip, publicHref, publicGamePageHref, publicTeamPageHref } from '@/lib/flip-twins';
import { parseRosterRequirements } from '@/lib/roster-requirements';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import type { GameStatus, TournamentSettings, PlayoffConfig } from '@/lib/types';
import { isPublicPageEnabled, type PublicPageKey } from '@/lib/public-pages';
import styles from './CoachTournamentRecord.module.css';
import { tournamentToday, formatEventDateRange } from '@/lib/timezone';

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
 * them). `backHref` renders a back link — BOTH shells point it at their team-scoped
 * Tournaments list since A3.3 (the free caller falls back to the account-wide
 * `/coaches/tournaments` hub only for a registration-only coach with no free team).
 */
export default async function CoachTournamentRecord({
  registrationId,
  userId,
  email,
  suppressUpsell = false,
  welcome = false,
  moneyRedacted = false,
  backHref,
  hideHeader = false,
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
  /**
   * A2 (2026-07-25): the FREE portal's shell now renders the tournament identity + Flip in its
   * persistent header, so the free call site hides this page's own title block. Defaults false —
   * the Premium (operator-family) shell has no event header, so it keeps the in-page one.
   */
  hideHeader?: boolean;
}) {
  // Returns the linked Basic coach team id — access and team identity are the same fact, so
  // this ONE lookup gates the page and (below) resolves the afterglow's team. B3 re-base:
  // the record can only render for a coach who owns that link, so the afterglow ask can never
  // silently vanish; the plan's "reliability fix" was for a state that isn't reachable.
  const linkedBasicTeamId = await canUserAccessTournamentRegistration({
    userId,
    email: email.toLowerCase(),
    registrationId,
  });

  if (!linkedBasicTeamId) {
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
          .select('id, name, slug, year, start_date, end_date, org_id, status, contact_email, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, settings, public_hidden_pages, logo_url')
          .eq('id', team.tournament_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    team.division_id
      ? supabaseAdmin
          .from('divisions')
          // B1.6: `playoff_config` carries the division's tie-breaker overrides, run-diff cap
          // AND any coin-toss results the organizer recorded to settle a real tie. Without it
          // the coach's standings snapshot silently disagrees with the public standings page
          // for exactly the ties a human had to intervene on.
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
          // B1.5: `division_id` added to the EXISTING select (no new query) so "Meet the
          // field" can say how many of the accepted teams share the coach's division.
          .select('id, name, division_id')
          .eq('tournament_id', team.tournament_id)
          .eq('status', 'accepted')
      : Promise.resolve({ data: [] }),
  ]);

  let org: { slug: string; name: string; logo_url: string | null } | null = null;
  if (tournament?.org_id) {
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      // B1.4: logo_url so the hero can show the organizer's mark beside the team monogram.
      .select('slug, name, logo_url')
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

  // "The Flip" P3: the one public-site context every public link on this page resolves through
  // (header pill, per-game links, standings, share) — single-sourced so they can't drift apart.
  // Null while the tournament isn't publicly visible (draft/hidden/archived) → no pill, no links.
  const publicCtx = tournamentIsPublic && org?.slug && tournament?.slug
    ? { orgSlug: org.slug, tournamentSlug: tournament.slug }
    : null;
  const canLinkPublic = Boolean(scheduleVisible && publicCtx);

  const initialGames: CoachScheduleGame[] = teamGames.map(g => {
    const isHome = g.home_team_id === teamId;
    const opponentId = isHome ? g.away_team_id : g.home_team_id;
    const opponentPlaceholder = isHome ? g.away_placeholder : g.home_placeholder;
    // Reveal a real opponent name only when the schedule is published AND a real team
    // is assigned; otherwise fall back to the game's placeholder/TBD (mirrors the public
    // game page — never names an undecided team/bye).
    const realOpponentId = opponentId && opponentId !== NIL_UUID ? opponentId : null;
    const realOpponentName = scheduleVisible && realOpponentId ? teamNameById.get(realOpponentId) : undefined;
    const opponentName = realOpponentName ?? opponentPlaceholder ?? 'TBD';
    return {
      id: g.id,
      href: canLinkPublic ? publicGamePageHref(publicCtx!, g.id) : null,
      dateLabel: formatGameDateLabel(g.game_date),
      timeLabel: formatGameTimeLabel(g.game_time),
      date: g.game_date,
      isHome,
      opponentName,
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

  const today = tournamentToday();
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

  // ONE formatter, shared with the free shell's header (lib/timezone.ts). The old hand-rolled
  // version did `new Date('2026-07-16').toLocaleDateString(...)` — UTC midnight rendered in a
  // behind-UTC zone, so the hero printed "Jul 15 - Jul 17" directly under a header reading
  // "Jul 16–18". Same tournament, two answers, on one screen.
  const dateRange = formatEventDateRange(tournament?.start_date, tournament?.end_date, true);

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
  // Did the coach actually finish with a result? Drives BOTH the hero's result card and the
  // afterglow's lead line, so the two can never disagree about whether a record exists.
  const hasFinalRecord = Boolean(record && record.wins + record.losses + record.ties > 0);
  // Standings link + team-profile share exist only when the tournament is public (active|completed).
  const canShareAfterglow = Boolean(isResultPhase && publicCtx);
  const standingsHref = canShareAfterglow ? publicHref(publicCtx!, 'standings') : null;
  const shareUrl = canShareAfterglow ? publicTeamPageHref(publicCtx!, teamId) : null;
  // The own-team upgrade ask is a FREE-tier nudge — never render it for a paying Premium coach
  // (suppressUpsell). Reuses the access gate's team id: no second lookup.
  const afterglowBasicTeamId = isResultPhase && !suppressUpsell ? linkedBasicTeamId : null;
  const upgradeCheckoutOpen = afterglowBasicTeamId ? !(await getPlanGatingMap()).team : false;

  // First-run onboarding banner (free register flow only — Premium passes welcome=false).
  const hiddenPages: string[] = Array.isArray(tournament?.public_hidden_pages)
    ? (tournament!.public_hidden_pages as string[])
    : [];
  const showWelcome =
    welcome && (team.status === 'pending' || team.status === 'waitlist') && Boolean(org?.slug && tournament?.slug);

  // A3: the tournament resource links moved OUT of the welcome banner into the permanent
  // "From the Organizer" zone. Gate: slugs must exist, and the tournament must be public —
  // EXCEPT for a pending/waitlist team, which keeps the prior welcome-banner behavior
  // (a just-registered team may precede the tournament going public).
  const resourceLinks: Array<{ href: string; label: string }> = [];
  if (
    org?.slug && tournament?.slug &&
    team.status !== 'rejected' && // a rejected team never had these links — keep it that way
    (tournamentIsPublic || team.status === 'pending' || team.status === 'waitlist')
  ) {
    const resCtx = { orgSlug: org.slug, tournamentSlug: tournament.slug };
    resourceLinks.push({ href: publicHref(resCtx, 'overview'), label: 'Tournament Home' });
    if (!hiddenPages.includes('schedule')) resourceLinks.push({ href: publicHref(resCtx, 'schedule'), label: 'Schedule' });
    if (!hiddenPages.includes('rules')) resourceLinks.push({ href: publicHref(resCtx, 'rules'), label: 'Tournament Rules' });
  }

  /* ══ B1 quick wins — all three Schedule-zone blocks + the permanent share.
        Every one of them is gated on the organizer's own public-page choices:
        the portal must never surface something they deliberately switched off. ══ */

  // B1.3 (◆J1): a share that OUTLIVES the dismissible welcome banner. Only once the
  // tournament is actually public — sharing a private event link helps nobody.
  const sharePublicHref = publicCtx ? publicHref(publicCtx, 'overview') : null;

  // B1.5: "Meet the field" — counts off the accepted-teams list already loaded above.
  const fieldTeams = (acceptedTeams ?? []) as Array<{ id: string; name: string; division_id: string | null }>;
  const showMeetTheField =
    team.status === 'accepted' && !hiddenPages.includes('teams') && fieldTeams.length > 1;
  const fieldDivisionCount = team.division_id
    ? fieldTeams.filter(t => t.division_id === team.division_id).length
    : 0;
  const fieldSampleNames = fieldTeams
    .filter(t => t.id !== teamId)
    // Prefer the coach's own division — those are the teams they'll actually meet.
    .sort((a, b) => Number(b.division_id === team.division_id) - Number(a.division_id === team.division_id))
    .map(t => t.name);
  const teamsHref = publicCtx && !hiddenPages.includes('teams') ? publicHref(publicCtx, 'teams') : null;

  // B1.1: ICS events built HERE (server) so the client button ships a few small objects
  // instead of the tournament's whole games payload. Cancelled games are intentionally
  // included — `downloadICS` marks them CANCELLED so a re-import cleans the coach's calendar.
  const calendarEvents: ICSEventInput[] = showLiveBridge && tournament && org
    ? teamGames
        .filter(g => g.game_date)
        .map(g => {
          const isHome = g.home_team_id === teamId;
          const oppId = isHome ? g.away_team_id : g.home_team_id;
          const oppReal = oppId && oppId !== NIL_UUID ? teamNameById.get(oppId) : undefined;
          const opponent = oppReal ?? (isHome ? g.away_placeholder : g.home_placeholder) ?? 'TBD';
          return {
            gameId: g.id,
            title: `${team.name} ${isHome ? 'vs' : '@'} ${opponent}`,
            date: g.game_date as string,
            time: g.game_time || undefined,
            location: g.location || undefined,
            description: `${tournament.name}${division?.name ? ` · ${division.name}` : ''}`,
            url: canLinkPublic ? `${publicGamePageHref(publicCtx!, g.id)}` : undefined,
            cancelled: g.status === 'cancelled',
          };
        })
    : [];

  // B1.6: "Where you stand" — the coach's OWN row only (the full table is one tap away on
  // the public site). Scoped to their division, so this is one standings computation, not
  // the whole tournament's. Skipped entirely when the organizer hides standings publicly.
  //
  // Gate via the CANONICAL helper, not a raw `hiddenPages` check: `isPublicPageEnabled`
  // also suppresses standings for a bracket-only tournament (no round-robin to stand in),
  // which every public standings/champions/playoffs call site already honors.
  const standingsPublicallyOn = isPublicPageEnabled(
    { publicHiddenPages: hiddenPages as PublicPageKey[], settings: tournament?.settings as TournamentSettings },
    'standings',
  );
  let standingSnapshot: {
    rank: number; wins: number; losses: number; ties: number;
    runDiff: number | null; groupLabel: string | null; gamesRemaining: number;
  } | null = null;
  if (team.status === 'accepted' && team.division_id && standingsPublicallyOn && showLiveBridge) {
    const rows = await getStandings(
      team.division_id,
      // Same config every other standings caller passes — see the divisions select above.
      (division?.playoff_config as PlayoffConfig | null) ?? undefined,
      { admin: true },
      tournament?.settings ?? undefined,
    );
    const mine = rows.find(r => r.teamId === teamId);
    if (mine && mine.gp > 0) {
      // Rank WITHIN the coach's pool when the division is pooled — telling a Pool A
      // coach they're 7th of 12 across the whole division is a different (and wrong)
      // answer to "where do we stand". getStandings already returns rows in order.
      const group = mine.poolId ? rows.filter(r => r.poolId === mine.poolId) : rows;
      standingSnapshot = {
        rank: group.findIndex(r => r.teamId === teamId) + 1,
        wins: mine.w,
        losses: mine.l,
        ties: mine.t,
        runDiff: mine.rd,
        groupLabel: division?.name ?? null,
        gamesRemaining: teamGames.filter(g => g.status === 'scheduled').length,
      };
    }
  }
  const standingsPublicHref = publicCtx && standingsPublicallyOn ? publicHref(publicCtx, 'standings') : null;

  const isPending = coachPhase === 'pending';

  // Payment instructions (the organizer's "how to pay" text) shown to an ACCEPTED coach who owes.
  const rawPaymentInstructions = (tournament?.settings as Record<string, unknown> | null)?.payment_instructions;
  const paymentInstructions =
    team.status === 'accepted' && typeof rawPaymentInstructions === 'string'
      ? rawPaymentInstructions.trim() || null
      : null;

  const isRejected = coachPhase === 'rejected';

  // A3 result phase: the share action renders INSIDE the hero's result card ("how we
  // finished" + "share it" together — approved mockups, decision ◆C).
  const heroShareSlot = shareUrl ? (
    <SharePageButton
      url={shareUrl}
      title={`${team.name} — ${tournament?.name ?? 'Tournament'}`}
      text={`See how ${team.name} finished at ${tournament?.name ?? 'the tournament'}.`}
      label="Share your team"
      /* Compact pill, not the default full-bleed share block — inside the result card it
         sits beside the record, and a button as wide as the card outweighed the score. */
      className={styles.resultShareBtn}
    />
  ) : null;

  // A3 quick-jump anchors — free A2 chrome only (it offsets against the shell header;
  // Premium's operator shell has none), and not for rejected (only two zones render).
  const jumpItems = [
    { id: 'status', label: 'Status' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'team', label: 'Team' },
    { id: 'organizer', label: 'Organizer' },
  ];

  return (
    <>
      {/* A3 quick-jump: folded into the sticky chrome directly under the A2 tab row. */}
      {hideHeader && !isRejected && <CoachRecordJumpNav items={jumpItems} />}

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
            shareHref={sharePublicHref}
          />
        )}

        {/* Free portal (hideHeader): the shell's persistent header carries team + tournament
            identity and the Flip now. Premium keeps this in-page block — its operator shell
            has no event header (two-family ruling; tournament surface itself stays shared). */}
        {!hideHeader && (
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
            {/* "The Flip" P3: this page IS one event, so it carries the coach corner pill — the
                "check my fees ↔ see us live" loop (landing is context-driven, not page-matched). */}
            {publicCtx && (
              <FlipPill resolution={resolveFlip({ direction: 'to-public', hat: 'coach', ctx: publicCtx })} />
            )}
          </div>
        )}

        {/* A3 hero: identity + status + countdown only — fee, checklist, contact, and the
            today detail live in the zones below (approved mockups 2026-07-26). */}
        <TeamHQ
          variant="tournament"
          phase={coachPhase}
          statusLabel={statusLabel}
          statusBadgeClass={statusBadge}
          statusDesc={statusDesc}
          teamName={team.name}
          tournamentName={tournament?.name ?? null}
          orgName={org?.name ?? null}
          // B1.4: the tournament's own logo wins over the org's — a multi-event org often
          // brands each tournament separately, and this record is about ONE event.
          organizerLogoUrl={tournament?.logo_url ?? org?.logo_url ?? null}
          startDate={tournament?.start_date ?? null}
          dateRangeLabel={dateRange}
          record={record}
          standingsHref={standingsHref}
          todayGames={todayGames}
          shareSlot={heroShareSlot}
        />

        {/* Afterglow strip (◆C) — the old "That's a wrap" section dissolved: share moved into
            the hero's result card; the Founding-Season doorway + organizer line sit here,
            directly under the moment they belong to. Free tier only — Premium's hero already
            carries the record + share, and a paying coach is past these asks. */}
        {isResultPhase && !suppressUpsell && (
          <div className={`card ${styles.afterglow}`}>
            {/* B3.1 (◆K1): the strip does NOT restate the record — the hero card directly above
                owns that number. Its job is to name what happens to the weekend next. Falls back
                to a neutral line when no completed scores were recorded (the hero says so too;
                claiming "the first line of season history" would be a small lie there). */}
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

        {/* ── Zone 1 · Status & Payment — the ONE place fee, due date, how-to-pay, and the
            organizer contact are stated (fee ×3 / contact ×3 → ×1). ───────────────────── */}
        <section id="status" className={`${styles.section} ${styles.zone}`}>
          <ZoneHead
            icon={<ClipboardList size={12} aria-hidden />}
            eyebrow="Your Registration"
            title={moneyRedacted ? 'Status' : 'Status & Payment'}
          />
          <TournamentStatusBlock
            phase={coachPhase}
            statusLabel={statusLabel}
            statusBadgeClass={statusBadge}
            status={coachStatus}
            contactEmail={coachContactEmail}
            showCheckIn={isGameDayOrLater}
            paymentInstructions={moneyRedacted ? null : paymentInstructions}
            hideFeeRow={moneyRedacted}
            pendingFeeAmount={moneyRedacted ? null : pendingFeeAmount}
            rosterPointer={showRosterSubmit && !team.roster_submitted_at}
            waitlisted={team.status === 'waitlist'}
          />
        </section>

        {/* ── Zone 2 · Schedule — one zone for every state (live bridge / unpublished /
            pending). The old second Schedule section + hero today-card merged here. ──── */}
        {!isRejected && (
          <section id="schedule" className={`${styles.section} ${styles.zone}`}>
            <ZoneHead icon={<CalendarDays size={12} aria-hidden />} eyebrow="Your Games" title="Schedule" />

            {/* B1.6 (◆H1) — "Where you stand" leads the zone once there's something to
                stand on: between games it's the first thing a coach checks, and it's the
                answer to the games listed directly below. Renders null before any game
                is played and whenever the organizer hides standings publicly. */}
            {standingSnapshot && (
              <CoachStandingsSnapshot {...standingSnapshot} standingsHref={standingsPublicHref} />
            )}

            {/* B1.1 — calendar export sits above the list it exports. */}
            {calendarEvents.length > 0 && (
              <CoachScheduleCalendarButton
                filename={`${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team'}-schedule.ics`}
                events={calendarEvents}
                gameCount={calendarEvents.length}
              />
            )}

            {showLiveBridge ? (
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
            ) : team.status === 'accepted' ? (
              <>
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
                {/* B1.5 (◆I1) — this zone's PRE-EVENT state. The wait for a schedule is the
                    longest stretch of the coach's relationship with the event; "who else is
                    coming" is the one thing they're curious about, and it steps aside the
                    moment real games arrive (this branch stops rendering). */}
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
                icon={<CalendarClock size={18} aria-hidden />}
                headline="Nothing scheduled yet"
                description="Your games appear here once you're accepted and the organizer publishes the schedule."
              />
            )}
          </section>
        )}

        {/* ── Zone 3 · Your Team — roster submit + the merged entry card (head-coach editor
            + inert registration facts together). ─────────────────────────────────────── */}
        {!isRejected && (
          <section id="team" className={`${styles.section} ${styles.zone}`}>
            <ZoneHead icon={<Users size={12} aria-hidden />} eyebrow="Roster & Coach" title="Your Team" />
            {isPending && (
              <p className={styles.zoneNote}>Optional for now — you can set this anytime before the event.</p>
            )}
            <div className={styles.zoneStack}>
              {showRosterSubmit && <TournamentRosterSubmit teamId={teamId} />}
              <div className={`card ${styles.entryCard}`}>
                <details className={styles.entryDetails} open={!isPending}>
                  <summary className={styles.entrySummary}>
                    <UserCog size={15} aria-hidden />
                    <span>Head coach</span>
                    <ChevronDown size={16} aria-hidden className={styles.entryChevron} />
                  </summary>
                  <div className={styles.entryBody}>
                    <HeadCoachEditor
                      embedded
                      teamId={teamId}
                      initialCoach={team.coach ?? ''}
                      initialCoachEmail={team.coach_email ?? null}
                      registrationEmail={team.email ?? null}
                    />
                  </div>
                </details>
                {/* No Dates row — the hero (and the free shell's header meta) already state
                    the event dates; the facts grid keeps only what appears nowhere else. */}
                <dl className={styles.entryFacts}>
                  <dt>Team</dt><dd>{team.name}</dd>
                  {team.coach && <><dt>Coach</dt><dd>{team.coach}</dd></>}
                  {division && <><dt>Division</dt><dd>{division.name}</dd></>}
                  <dt>Registered</dt>
                  <dd>{new Date(team.registered_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
                </dl>
              </div>
            </div>
          </section>
        )}

        {/* ── Zone 4 · From the Organizer — announcements + the tournament resource links
            (moved out of the welcome banner; now permanent). ─────────────────────────── */}
        <section id="organizer" className={`${styles.section} ${styles.zone}`}>
          <ZoneHead icon={<Megaphone size={12} aria-hidden />} eyebrow="News & Resources" title="From the Organizer" />
          {resourceLinks.length > 0 && (
            <div className={styles.resourceLinks}>
              {resourceLinks.map(r => (
                <Link key={r.href} href={r.href} className={styles.resourcePill}>
                  {resourceIcon(r.label)} {r.label}
                </Link>
              ))}
            </div>
          )}
          {/* B1.3 (◆J1) — the PERMANENT half of the share. The welcome banner carries the
              celebration version, but it's first-visit-only and dismissible, so the most
              shareable thing a coach has would vanish on one tap of the X. This one is
              still here in week three, beside the other event links. */}
          {sharePublicHref && !isRejected && (
            <div className={styles.organizerShare}>
              <SharePageButton
                url={sharePublicHref}
                title={tournament?.name ?? 'Tournament'}
                text={`${team.name} is playing at ${tournament?.name ?? 'this tournament'}.`}
                label="Share this tournament"
                className={styles.resourcePill}
              />
            </div>
          )}
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
    </>
  );
}

/** A3 zone header — the public site's eyebrow + heading grammar at portal scale
 *  (Barlow Condensed pair, accent eyebrow w/ 12px icon; left-aligned — this is an
 *  operating record, not a marketing section). */
function ZoneHead({ icon, eyebrow, title }: { icon: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <div className={styles.zoneHead}>
      <p className={styles.zoneEyebrow}>{icon} {eyebrow}</p>
      <h2 className={styles.zoneTitle}>{title}</h2>
    </div>
  );
}

/** "Riverside U13" → "Riverside U13's"; "Riverside Reds" → "Riverside Reds'". Team names are
 *  coach-entered, so a naive `name + "'s"` produces "Reds's" often enough to notice. */
function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

/** Resource-pill icons (the welcome banner's label-regex idiom, relocated with the pills). */
function resourceIcon(label: string) {
  if (/schedule/i.test(label)) return <CalendarDays size={15} aria-hidden />;
  if (/rule/i.test(label)) return <BookOpen size={15} aria-hidden />;
  return <Home size={15} aria-hidden />;
}
