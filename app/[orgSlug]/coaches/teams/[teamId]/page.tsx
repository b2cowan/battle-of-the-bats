'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCoaches, resolveClosedAssignment } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import { Archive, ArrowRight, Building2, Calendar, CalendarCheck, CheckCircle2, ChevronDown, Circle, DollarSign, LayoutDashboard, ListOrdered, MinusCircle, TrendingUp, TriangleAlert, Trophy, Users, Wallet, X } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachSeasonFinishedNotice from '@/components/coaches/CoachSeasonFinishedNotice';
import CoachHelperHome from '@/components/coaches/CoachHelperHome';
import UpgradeSummaryBanner from '@/components/coaches/UpgradeSummaryBanner';
import StartNextSeasonModal from '@/components/coaches/StartNextSeasonModal';
import CoachTournamentAwarenessBanner from '@/components/marketing/CoachTournamentAwarenessBanner';
// Loaded on demand, mirroring HelpDrawerProvider's treatment of the help drawer: the tour is a
// one-time offer most returning coaches have already dismissed, so it shouldn't sit in the
// Overview bundle (already one of the portal's heaviest) for everyone who never opens it.
const CoachPortalTour = dynamic(() => import('@/components/coaches/CoachPortalTour'), { ssr: false });
import { useDismissable, useViewportFit } from '@/lib/overlay-hooks';
import { pickFanViewRegistration, type FanViewRegistration } from '@/lib/coach-alert-registration';
import CoachLiveEventCard from '@/components/coaches/CoachLiveEventCard';
import { deriveRepPhase } from '@/lib/coach-rep-phase';
import {
  resolveOverviewAnchor,
  resolveBoard,
  resolveCoachingTilesShown,
  summariseAttendance,
  summarisePlayingTime,
  type AttendanceSummary,
  type PlayingTimeSummary,
  type TileKey,
} from '@/lib/coach-overview';
import { hasNoTeamRecordAccess, hasRecordAccess } from '@/lib/coach-capabilities';
import { readWltPreference, tallyResults, formatRecord, WLT_CATEGORIES } from '@/lib/coach-season-record';
import { calendarDaysBetween, tournamentToday, daysBetweenDateStrings, formatInOrgZone } from '@/lib/timezone';
import { armCareCopy, type ArmCareConcern } from '@/lib/coach-arm-care';
import { fieldNounFor } from '@/lib/sports';
import { gameDayEntryHref, isInGameDayWindow, toGameDayEventShape } from '@/lib/coach-game-day';
import HelpTooltip from '@/components/help/HelpTooltip';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import { getCoachGuidance } from '@/lib/coach-guidance';
import { isMirroredEvent } from '@/lib/coach-tournament-games';
import { EVENT_WORD } from '@/lib/coach-schedule-vocab';
import { isNeverPaidPlayer } from '@/lib/dues-status';
import { moneySectionHref } from '@/lib/coach-money-links';
import styles from '../../coaches.module.css';
import type { RepRosterPlayer, RepTeamEvent, RepEventType } from '@/lib/types';

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];

/**
 * Coach-scoped (NOT team-scoped) onboarding preferences — a coach with three teams decides once.
 * Deliberately keyless of teamId, unlike the per-team `coach-setup-skipped:` / `coach-season-cue:`
 * keys below, which record facts about a season rather than a preference.
 *
 * ✅ Phase C2 (migration 209): the two COACH preferences — setup hints off, tour dismissed — now
 * live on the account (`user_preferences`), read and written through
 * /api/coaches/onboarding-preferences. They follow the coach across every team AND every device,
 * which is what "skip ends the tour permanently" always required. The device-local keys are gone;
 * only the per-TEAM step skips below remain local, because those are season facts, not preferences.
 */

/** Setup-chip progress ring geometry — derived, so resizing the ring can't desync the arc. */
const RING_R = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

const STATUS_CSS: Record<string, string> = {
  draft: styles.badgeDraft,
  active: styles.badgeActive,
  completed: styles.badgeCompleted,
  archived: styles.badgeArchived,
};

interface SetupStats {
  activeRosterCount: number;
  positionedRosterCount: number;
  eventCount: number;
  gameCount: number;
  budgetSet: boolean;
}

/**
 * First-week signals from /milestones — only the ones the page can't already derive from the
 * roster/events fetches it makes anyway. `null` = this coach's capabilities hide the area.
 * Whether a STEP is shown is decided from `assignment.capabilities` (see `SetupItem.visible`),
 * never from these nulls — that would flash ineligible steps until the fetch resolves.
 */
interface Milestones {
  hasLineup: boolean | null;
  hasSentAnnouncement: boolean | null;
  moneyStarted: boolean | null;
  assistants: number | null;
  teamDocuments: number | null;
}

interface SetupItem {
  /** Stable id used for skip persistence. */
  key: string;
  label: string;
  /** Live status line shown once complete (e.g. "5 active players"). */
  detail: string;
  /** What/why one-liner shown while the step is still open. */
  desc: string;
  /** Verb shown on the right while the step is open (e.g. "Add players"). */
  action: string;
  href: string;
  complete: boolean;
  /** 'core' gates "you're ready"; 'optional' is skippable and never nags. */
  group: 'core' | 'optional';
  /**
   * Whether this coach can act on the step at all. Computed straight from `capabilities` at
   * declaration time (defaults to shown) so a restricted assistant never sees a step they can't
   * complete — not even for the moment before an async fetch lands.
   */
  visible?: boolean;
  /**
   * Administrative context rather than a step: always complete, nothing to act on. Kept in the
   * list because `requiredDone` depends on it, but never rendered as a checklist row and never
   * counted — a row that can only ever say "Done" is noise. Declared here, on the item that knows
   * why, so every consumer gets the exclusion instead of each one re-deriving it from the key.
   */
  contextOnly?: boolean;
  help: { title: string; body: string };
  /**
   * The headline steps ("Essentials"). Carries the short label + live value the milestone
   * rendering uses; steps without one fall into the "When you're ready" group.
   */
  milestone?: { order: number; short: string; value: string };
}

/* The "Also in your portal" chips are RETIRED (Quiet Mode Phase B, 2026-07-29). A chip could name
   a section but never explain it — the job now belongs to each section's own empty state, which
   teaches at the moment the coach is actually curious. Removed only once every section in scope
   carried its teaching copy, so no discovery window opened in between. */

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** C0: the org's calendar day, not the reader's — a 9 PM game is tomorrow in UTC and would have
 *  named the wrong weekday on the card announcing it. */
function formatEventDate(value: string): string {
  return formatInOrgZone(value, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "HH:mm" (24h, as arrival_time is stored) → a friendly clock ("5:15 PM"). */
function fmtClockLabel(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
}

export default function TeamOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, closedAssignments, loading, refresh: refreshAssignments, onboardingPrefs, setOnboardingPrefs } = useCoaches();
  const { currentOrg } = useOrg();
  const { openHelp } = useHelpDrawer();
  const router = useRouter();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  // Season's End access (Batch 3, P0 #1): a team whose only season is CLOSED has no live
  // Overview — its landing is the read-only Season's End page (redirect below, never a
  // wall). Computed HERE, above the data effects, so they can skip their fetches: every
  // endpoint this page reads is active-year-scoped and would just 403/404 for a closed
  // team. Shared predicate with the navs (lib/coaches-context.tsx).
  const closedAssignment = !loading ? resolveClosedAssignment(assignments, closedAssignments, teamId) : null;
  /**
   * ⚠ A HELPER HAS NO ARCHIVE (Phase 4, /review finding, 2026-08-03).
   *
   * A closed team lands on Season's End — which serves Season Wrapped, and Wrapped labels **every
   * player on the roster by first name and jersey number**, gated on nothing. That is correct for
   * a coach looking back at their own season. It is not something a parent volunteer invited to
   * run one station on one Tuesday was ever meant to receive, and nobody would have decided to
   * give it to them: they would simply have been redirected into it the day the season closed.
   *
   * The house rule for exactly this shape is "if a surface is not archive-ready, hide its entry
   * point in an archive rather than letting it dead-end" (CLAUDE.md). So a helper is not redirected
   * at all — they get the plain truth below, and the redirect stays for everyone it was built for.
   */
  const closedCapsAreHelperShaped = !!closedAssignment && hasNoTeamRecordAccess(closedAssignment.capabilities);
  const isClosedTeam = !loading && !!closedAssignment && !closedCapsAreHelperShaped;
  // Clock snapshot (render must stay pure) — see the schedule and lineups pages' twin notes.
  // Decides whether the anchor may offer the game-day console. ⚠ Unlike those two pages this one
  // REFRESHES it; see the sync effect below for why a once-per-mount snapshot is not enough here.
  const [gameDayNowMs, setGameDayNowMs] = useState(() => Date.now());
  /**
   * WHICH EVENT the two game-prep reads have actually answered for.
   *
   * Keyed by event id rather than a pair of booleans so it resets ITSELF the moment the next event
   * changes — no reset call in an effect body, which is exactly where this file already carries its
   * cascading-render warnings.
   *
   * The anchor card is held back until these land (see `eventPrepSettled`). Without that, a coach
   * who had already built the lineup AND taken attendance watched the card offer "Build lineup",
   * then "Take attendance", then drop its button entirely as the two reads landed — three paints,
   * two of them the exact false prompt this whole change exists to delete.
   */
  const [prepAnsweredFor, setPrepAnsweredFor] = useState<{ lineup: string | null; attendance: string | null }>(
    { lineup: null, attendance: null },
  );
  const [setupStats, setSetupStats] = useState<SetupStats | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupError, setSetupError] = useState('');
  const [teamDivision, setTeamDivision] = useState<string | null>(null);
  // Run-mode snapshot ("Your team at a glance")
  const [nextEvent, setNextEvent] = useState<RepTeamEvent | null>(null);
  // Whole days until the next event (computed at load; null when nothing upcoming) → stat strip.
  const [nextEventDays, setNextEventDays] = useState<number | null>(null);
  const [seasonGames, setSeasonGames] = useState<RepTeamEvent[]>([]);
  // The next 7 days of events, chronological — ONE piece of state serving both the "This week" tile
  // (which wants counts) and the reference rail (which wants the list). Null until the fetch lands,
  // so an unloaded week still reads as unknown rather than as an empty one. Two states set from the
  // same array in the same line was a desync waiting for the next person to edit one path.
  const [weekEvents, setWeekEvents] = useState<RepTeamEvent[] | null>(null);
  // The "This week" tile's counts — DERIVED from that one list, never stored beside it. Null while
  // the week is unknown, which is the distinction the tile's "…" state depends on.
  const weekSummary = (() => {
    if (!weekEvents) return null;
    const games = weekEvents.filter(e => GAME_EVENT_TYPES.includes(e.eventType)).length;
    const practices = weekEvents.filter(e => e.eventType === 'practice').length;
    return { games, practices, other: weekEvents.length - games - practices, total: weekEvents.length };
  })();
  // Active players with no guardian email (blocks dues reminders + announcements) → Roster nudge.
  const [missingEmailCount, setMissingEmailCount] = useState(0);
  // Whether the next game already has a lineup set → Next-up tile flag (null = unknown / not a game).
  const [nextLineupReady, setNextLineupReady] = useState<boolean | null>(null);
  const [duesOutstanding, setDuesOutstanding] = useState<number | null>(null);
  const [duesOverdueCount, setDuesOverdueCount] = useState(0);
  // Players who have paid NOTHING toward their dues (zero-paid) — distinct from "overdue".
  const [duesUnpaidCount, setDuesUnpaidCount] = useState(0);
  // Season setup lives in a header chip now, not a full-width panel — this is its popover.
  const [setupOpen, setSetupOpen] = useState(false);
  // "Turn off setup hints" and "tour already offered" are account-scoped and SSR-seeded — they live
  // on the coaches context, not in local state here (see `hintsOff` / `tourSeen` below). Only the
  // drawer's open/closed is genuine local UI state.
  const [tourOpen, setTourOpen] = useState(false);
  // Paid vs total dues installments → the Dues snapshot mini-gauge.
  const [duesProgress, setDuesProgress] = useState<{ paid: number; total: number } | null>(null);
  // Season budget vs actual spend → Budget tile.
  const [budget, setBudget] = useState<{ amount: number | null; spent: number } | null>(null);
  // Player birthdays in the next 7 days → a small "this week" touch.
  const [birthdays, setBirthdays] = useState<{ name: string; inDays: number }[]>([]);
  // In/Late/Out/No-reply headcount for the next event → Next-up tile.
  const [nextAttendance, setNextAttendance] = useState<{ in: number; late: number; out: number; noReply: number } | null>(null);
  /** Chunk C (wow #2) — arm-care concerns for the anchor game, and the sport's period noun. */
  const [gameDayArmCare, setGameDayArmCare] = useState<ArmCareConcern[]>([]);
  const [periodLabelPlural, setPeriodLabelPlural] = useState('Innings');
  // Tournament registrations summary → Tournaments tile.
  const [tournaments, setTournaments] = useState<{ count: number; pending: number; nextDate: string | null; liveNow: boolean; owed: number; owingCount: number } | null>(null);
  // P3: the ⇄ Fan view door's eligibility — any registration in a live public event,
  // shared rule with the free overview so the two tiers can't drift.
  const [overviewFanView, setOverviewFanView] = useState<FanViewRegistration | null>(null);
  // Optional setup steps the coach has chosen to skip (per-team, remembered locally).
  const [skippedSteps, setSkippedSteps] = useState<Set<string>>(new Set());
  // First-week milestones — one capability-aware read that also fixes the lineup step's
  // false negative (it used to ask "does the NEXT event have a lineup", which blanks out
  // whenever the next event is a practice).
  const [milestones, setMilestones] = useState<Milestones | null>(null);
  // Contextual org-invite banner (only when an org has actually invited this team)
  const [orgInvite, setOrgInvite] = useState<{ orgName: string } | null>(null);
  // Last-season preview tile (record + dues + expenses) — money-gated, links into Past Seasons.
  const [lastSeason, setLastSeason] = useState<{ name: string; record: string | null; duesCollected: number; totalExpenses: number } | null>(null);
  // Safety-tier Insights bridge: the ONE finding category that shouldn't wait for a couch
  // session (a pitcher over their arm-care cap) echoes as a single quiet line here.
  const [armCareFlag, setArmCareFlag] = useState<{ name: string; overCapGames: number } | null>(null);
  // The coaching pair (chunk I, D13) — the two season-health tiles a coach WITHOUT money access
  // gets in slots 5–6. Both ride fetches this page already makes, so neither costs a request.
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [playingTime, setPlayingTime] = useState<PlayingTimeSummary | null>(null);
  // Open development goals → the Playing time slot's fallback when a coach has no lineup access.
  const [openGoalCount, setOpenGoalCount] = useState<number | null>(null);
  // The coach's remembered record scope (League / Tournament / Scrimmage), set on Insights and read
  // by every surface that shows a record — so the board's glance and the Insights band can never
  // report different numbers for the same season.
  const [wltScope, setWltScope] = useState<Record<string, boolean> | null>(null);
  // Winding-down cue (Batch 3, P1 f5-1): when the season quietly stops, say so — once.
  const [lastPastEventAt, setLastPastEventAt] = useState<string | null>(null);
  const [seasonCueDismissed, setSeasonCueDismissed] = useState(false);
  // Season year + who may close it — from the team GET this page already makes for division.
  const [seasonMeta, setSeasonMeta] = useState<{ year: number | null; canManageSeasons: boolean }>({ year: null, canManageSeasons: false });
  const [rolloverOpen, setRolloverOpen] = useState(false);

  const loadSetup = useCallback(async () => {
    setSetupLoading(true);
    setSetupError('');
    try {
      // Assistant Coaches: skip the finance fetches when this coach has no money access,
      // otherwise the (correct) 403 would read as a broken dashboard on their landing page.
      const a = assignments.find(x => x.teamId === teamId);
      // Fail CLOSED if assignments haven't resolved yet (a === undefined): skip the finance
      // fetch so a no-money assistant never flashes a 403 error; it re-runs once caps load.
      const canMoney = !!a && a.capabilities.money !== 'off';
      // Guardian contacts + player DOB are PII-redacted server-side unless this coach has the
      // rosterPii grant. Without it, guardianEmail/DOB come back null — so a "missing email" count
      // or birthday list computed from them would be false. Gate both on canPii (head coaches: on).
      const canPii = !!a && a.capabilities.rosterPii;
      // Same rule as the money guard above, which roster and schedule never got: an assistant whose
      // head coach hid Roster or turned Schedule off had those (correct) 403s counted as a total
      // failure, so the whole dashboard reported "Setup status could not be loaded" — and every
      // tile then read empty, telling a coach with a full squad and a full season that they had
      // "0 players" and "Nothing scheduled". Don't ask for what this coach isn't allowed to see;
      // the tiles that depend on the answer hide themselves (see `visible` on the snapshot cards).
      const canRoster = !!a && hasRecordAccess(a.capabilities);
      const canSchedule = !!a && a.capabilities.schedule;
      const [rosterRes, eventsRes, budgetRes, duesRes] = await Promise.all([
        canRoster ? fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster`) : Promise.resolve(null),
        canSchedule ? fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`) : Promise.resolve(null),
        canMoney ? fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget`) : Promise.resolve(null),
        canMoney ? fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues`) : Promise.resolve(null),
      ]);

      if ((canRoster && !rosterRes!.ok) || (canSchedule && !eventsRes!.ok) || (canMoney && !budgetRes!.ok)) {
        throw new Error('Setup status could not be loaded');
      }

      const rosterData: { players?: RepRosterPlayer[] } = canRoster ? await rosterRes!.json() : {};
      const eventsData: { events?: RepTeamEvent[] } = canSchedule ? await eventsRes!.json() : {};
      const budgetData: { budgetAmount?: number | null; totalExpenses?: number } =
        canMoney && budgetRes!.ok ? await budgetRes!.json() : { budgetAmount: null, totalExpenses: 0 };
      const activePlayers = (rosterData.players ?? []).filter(player => player.status === 'active');
      const events = eventsData.events ?? [];
      const games = events.filter(event => GAME_EVENT_TYPES.includes(event.eventType));
      setSeasonGames(games);
      setMissingEmailCount(canPii ? activePlayers.filter(p => !p.guardianEmail?.trim()).length : 0);

      setSetupStats({
        activeRosterCount: activePlayers.length,
        positionedRosterCount: activePlayers.filter(player => (
          Boolean(player.playerNumber) && (Boolean(player.primaryPosition) || Boolean(player.secondaryPosition))
        )).length,
        // Batch 4: COACH-CREATED events only. Real tournament games are now mirrored onto the
        // calendar automatically, and counting them here would tick the "Build your schedule"
        // setup step — a step whose whole copy is "Add practices, games, and team events" — for a
        // coach who has never opened Schedule. A milestone that lies about work not done is the
        // same false-"done" Batch 2's review removed from the lineup step.
        eventCount: events.filter(e => !isMirroredEvent(e)).length,
        gameCount: games.length,
        budgetSet: budgetData.budgetAmount != null,
      });
      setBudget(canMoney ? { amount: budgetData.budgetAmount ?? null, spent: budgetData.totalExpenses ?? 0 } : null);

      // Next upcoming event for the snapshot
      const now = Date.now();
      const upcoming = events
        .filter(e => e.status === 'scheduled' && new Date(e.startsAt).getTime() >= now)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      const nextUp = upcoming[0] ?? null;
      setNextEvent(nextUp);
      // Calendar-day gap in the org timezone (Toronto), not a rolling-24h count — so a game
      // later *today* reads 0 ("Today"), not 1 ("Tomorrow"), and game-day can actually fire.
      setNextEventDays(nextUp ? Math.max(0, calendarDaysBetween(new Date(), new Date(nextUp.startsAt))) : null);

      // Most recent PAST activity of any kind (practices count — a team still practicing is
      // not winding down). Feeds the season winding-down cue's quiet-days floor (f5-1).
      const lastPast = events
        .filter(e => e.status !== 'cancelled' && new Date(e.startsAt).getTime() < now)
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0] ?? null;
      setLastPastEventAt(lastPast?.startsAt ?? null);

      // Events in the next 7 days — chronological, and the ONE source for both the "This week"
      // tile's counts and the rail's list.
      const weekAhead = now + 7 * 86400000;
      const thisWeek = events.filter(e => {
        const t = new Date(e.startsAt).getTime();
        return e.status === 'scheduled' && t >= now && t <= weekAhead;
      });
      setWeekEvents([...thisWeek].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));

      // Player birthdays in the next 7 days (active roster).
      // Dated in the ORG timezone, not the viewer's device, so a coach travelling out of
      // province sees the same "birthday in 3 days" as everyone else on the team.
      const todayStr = tournamentToday();
      const thisYear = Number(todayStr.slice(0, 4));
      const upcomingBdays = activePlayers
        .map(p => {
          const dob = p.playerDateOfBirth;
          if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null;
          const monthDay = dob.slice(5, 10);
          let next = `${thisYear}-${monthDay}`;
          if (next < todayStr) next = `${thisYear + 1}-${monthDay}`;
          const inDays = daysBetweenDateStrings(todayStr, next);
          return inDays >= 0 && inDays <= 7 ? { name: (p.playerFirstName || 'Player').trim(), inDays } : null;
        })
        .filter((b): b is { name: string; inDays: number } => b !== null)
        .sort((a, b) => a.inDays - b.inDays);
      setBirthdays(canPii ? upcomingBdays : []);

      // Dues outstanding + overdue count (best-effort — dues failure never breaks the page)
      if (canMoney && duesRes && duesRes.ok) {
        // `paidAmount` is declared here on purpose: `isNeverPaidPlayer` REQUIRES payment dollars
        // (mig 232 — the stamps are only a coverage projection), and this local shape is what
        // turns "the payload happened to carry the field" into a compiler-checked contract.
        // `paidAmount` and `leftToSend` are declared here on purpose (mig 232 / credit model
        // 2026-08-14) — the local shape turns "the payload happened to carry the field" into a
        // compiler-checked contract, so a payload rename cannot silently revert this badge to
        // credit-blind counting.
        const duesData: { players?: Array<{ outstanding?: number; paidAmount: number; leftToSend: number; installments?: Array<{ paidAt: string | null; dueDate: string; remainingAmount?: number; amount?: number }> }> } = await duesRes.json();
        const players = duesData.players ?? [];
        // The tile quotes what families are actually ASKED TO SEND — net of credits applied.
        const totalOutstanding = players.reduce((s, p) => s + (p.leftToSend ?? p.outstanding ?? 0), 0);
        // Overdue is a CALENDAR question in the org's timezone — comparing date strings avoids
        // the device-zone skew that flagged dues late the evening before they were due. A row
        // with nothing left to send (remainingAmount is the NET figure) is not late for anyone.
        const orgToday = tournamentToday();
        const overdue = players.reduce((n, p) => n + (p.installments ?? []).filter(i =>
          !i.paidAt && i.dueDate < orgToday && (i.remainingAmount ?? i.amount ?? 1) > 0.005).length, 0);
        // "Who's paid nothing" — a player who owes dues but has zero payments recorded.
        // Distinct from "overdue" (a specific installment past its due date): a coach wants
        // to know who hasn't started paying at all, not just which instalments slipped.
        // Shared predicate with the Money → Player Dues "Haven't paid anything yet" panel,
        // so this badge count and that named list can never drift apart.
        const unpaid = players.filter(isNeverPaidPlayer).length;
        let paidInst = 0; let totalInst = 0;
        players.forEach(p => (p.installments ?? []).forEach(i => { totalInst += 1; if (i.paidAt) paidInst += 1; }));
        setDuesOutstanding(Math.round(totalOutstanding * 100) / 100);
        setDuesOverdueCount(overdue);
        setDuesUnpaidCount(unpaid);
        setDuesProgress(totalInst > 0 ? { paid: paidInst, total: totalInst } : null);
      } else {
        setDuesOutstanding(null);
        setDuesProgress(null);
        // Reset the overdue count too, else a prior success could leave the Dues card
        // tinted danger ("—" in red) after a later dues-only fetch failure.
        setDuesOverdueCount(0);
        setDuesUnpaidCount(0);
      }
    } catch (error: unknown) {
      setSetupError(errorMessage(error, 'Setup status could not be loaded'));
    } finally {
      setSetupLoading(false);
    }
  }, [orgSlug, teamId, assignments]);

  // Every fetch on this page is active-year-scoped — skip the whole fan-out for a closed
  // team (it's mid-redirect to Season's End; the requests would only 403/404 into the logs).
  useEffect(() => {
    if (!loading && !isClosedTeam) void Promise.resolve().then(loadSetup);
  }, [loading, isClosedTeam, loadSetup]);

  // Hydrate the remembered record scope (per team). Read-only here — Insights owns setting it.
  useEffect(() => {
    void Promise.resolve().then(() => setWltScope(readWltPreference(teamId)));
  }, [teamId]);

  // Hydrate skipped optional steps (per team). Best-effort — never breaks the page.
  const skipStorageKey = `coach-setup-skipped:${teamId}`;
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem(skipStorageKey);
        if (raw) setSkippedSteps(new Set(JSON.parse(raw) as string[]));
      } catch { /* ignore */ }
    });
  }, [skipStorageKey]);

  // Account-level preferences (Phase C2) come SSR-seeded through the coaches context — read once
  // by the layout for the whole portal, so there's no client round-trip here, no loading flash,
  // and no identical re-fetch when the coach switches teams.
  const hintsOff = onboardingPrefs.hintsOff;
  const tourSeen = onboardingPrefs.tourDismissed;

  const turnOffHints = useCallback(() => {
    setSetupOpen(false);
    setOnboardingPrefs({ hintsOff: true });
  }, [setOnboardingPrefs]);

  const turnOnHints = useCallback(() => {
    setOnboardingPrefs({ hintsOff: false });
  }, [setOnboardingPrefs]);

  // Open the tour drawer. Opening does NOT retire the offer — only finishing or skipping does
  // (`finishPortalTour`), so a coach who opens it and immediately hits Escape still gets offered it.
  const openPortalTour = useCallback(() => {
    setSetupOpen(false);
    setTourOpen(true);
  }, []);

  /** Skip or Done — the permanent, account-level decision. NOT fired by merely opening the tour,
   *  nor by following a card's deep link (see CoachPortalTour). */
  const finishPortalTour = useCallback(() => {
    setTourOpen(false);
    setOnboardingPrefs({ tourDismissed: true });
  }, [setOnboardingPrefs]);

  // The full guide stays reachable forever, independent of the tour's one-time offer.
  const openPortalGuide = useCallback(() => {
    setSetupOpen(false);
    openHelp({
      module: 'coaches',
      sectionIds: ['premium-portal-tour', 'premium'],
      label: 'Portal tour',
      fullGuideHref: `/${orgSlug}/coaches/help#premium-portal-tour`,
    });
  }, [openHelp, orgSlug]);

  // Close the setup popover on outside click / Escape — it sits in the page header, so an
  // un-closable popover would sit over the page title.
  // Dismiss behaviour + viewport fit now come from the shared primitives (Phase C0). The fit hook
  // is the capability the hand-rolled version lacked: on a short window the popover could open with
  // its footer — including the off-switch — below the fold.
  const setupChipRef = useRef<HTMLDivElement | null>(null);
  const setupPopRef = useRef<HTMLDivElement | null>(null);
  useDismissable(setupOpen, setupChipRef, () => setSetupOpen(false));
  useViewportFit(setupOpen, setupPopRef);

  const toggleSkip = useCallback((key: string) => {
    setSkippedSteps(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(skipStorageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, [skipStorageKey]);

  useEffect(() => {
    if (loading || isClosedTeam) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json?.team) return;
        setTeamDivision(json.team.division ?? null);
        // Same response carries the season + the caller's season-management scope — the
        // winding-down cue needs both (year → default for "next season"; scope → which
        // cue variant renders). No extra request.
        setSeasonMeta({
          year: json.season?.year ?? null,
          canManageSeasons: !!json.scope?.canManageSeasons,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, isClosedTeam, orgSlug, teamId]);

  // Winding-down cue dismissal — per team + season, remembered locally (same pattern as
  // setup-step skips). Any newly scheduled event clears the trigger anyway; the stored
  // dismissal just keeps a quiet season quiet after one "Not yet".
  const cueStorageKey = `coach-season-cue:${teamId}:${assignments.find(a => a.teamId === teamId)?.programYearId ?? ''}`;
  useEffect(() => {
    void Promise.resolve().then(() => {
      try { setSeasonCueDismissed(localStorage.getItem(cueStorageKey) === '1'); } catch { /* ignore */ }
    });
  }, [cueStorageKey]);
  const dismissSeasonCue = useCallback(() => {
    setSeasonCueDismissed(true);
    try { localStorage.setItem(cueStorageKey, '1'); } catch { /* ignore */ }
  }, [cueStorageKey]);

  // First-week milestones. Fail-silent: the trail simply doesn't render if this can't load —
  // Overview never blocks on onboarding data.
  useEffect(() => {
    if (loading || isClosedTeam) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/milestones`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => { if (!cancelled && json?.milestones) setMilestones(json.milestones as Milestones); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, isClosedTeam, orgSlug, teamId]);

  // Next-game lineup readiness for the "Next up" tile — only when the next event is a game.
  // "Ready" = at least one player has a position assigned in the saved lineup.
  useEffect(() => {
    setNextLineupReady(null);
    if (!nextEvent || !GAME_EVENT_TYPES.includes(nextEvent.eventType)) return;
    const eventId = nextEvent.id;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${nextEvent.id}/lineup`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json) return;
        const entries = (json.entries ?? []) as { inningPositions?: Record<string, string> }[];
        setNextLineupReady(entries.some(e => Object.values(e.inningPositions ?? {}).some(Boolean)));
      })
      .catch(() => {})
      // ⚠ `.finally`, not the success path: a 403 (no lineup access) resolves to a null body and a
      // network error rejects, and BOTH have to count as answered — otherwise the anchor card,
      // which now waits on this, would never appear for the coaches those cases describe.
      .finally(() => { if (!cancelled) setPrepAnsweredFor(p => ({ ...p, lineup: eventId })); });
    return () => { cancelled = true; };
    // Keyed on the event's id/type (not the object identity) so a fresh loadSetup doesn't re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, teamId, nextEvent?.id, nextEvent?.eventType]);

  // In/Late/Out/No-reply headcount for the next event → shown on the Next-up tile (once the coach
  // has marked at least one player). Active players with no mark count as "no reply".
  useEffect(() => {
    setNextAttendance(null);
    if (!nextEvent) return;
    const eventId = nextEvent.id;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${nextEvent.id}/attendance`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json) return;
        const rows = (json.attendance ?? []) as { status?: string }[];
        const total = ((json.players ?? []) as unknown[]).length;
        const c = { in: 0, late: 0, out: 0, noReply: 0 };
        rows.forEach(r => {
          if (r.status === 'attending') c.in += 1;
          else if (r.status === 'late') c.late += 1;
          else if (r.status === 'absent') c.out += 1;
        });
        c.noReply = Math.max(0, total - c.in - c.late - c.out);
        setNextAttendance(c.in + c.late + c.out > 0 ? c : null);
      })
      .catch(() => {})
      // See the lineup read's note: a denied or failed read still counts as answered.
      .finally(() => { if (!cancelled) setPrepAnsweredFor(p => ({ ...p, attendance: eventId })); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, teamId, nextEvent?.id]);

  /**
   * Keep the game-day clock honest.
   *
   * The console door opens on a WINDOW (call time, or two hours before the start, until three hours
   * after the end), and this is the one page a coach leaves open on a game morning. A snapshot taken
   * once at 9am still says "not yet" at 4pm — so on the single screen where that door matters most,
   * it would never appear without a reload. It also goes stale on a TEAM SWITCH: the App Router
   * reuses this component across a `[teamId]` change (no `key` anywhere in the coach layouts), so a
   * `useState` initializer does not run again.
   *
   * ⚠ The tick re-renders only when the ANSWER changes, never merely because a minute has passed.
   * Nothing here touches the network, and it does not run at all unless a game is pending.
   */
  useEffect(() => {
    if (!nextEvent || !GAME_EVENT_TYPES.includes(nextEvent.eventType)) return;
    const shape = toGameDayEventShape(nextEvent);
    const sync = () => setGameDayNowMs(prev => {
      const now = Date.now();
      return isInGameDayWindow(shape, prev) === isInGameDayWindow(shape, now) ? prev : now;
    });
    // Immediately (catches the team switch above), then once a minute while the game is pending.
    const first = setTimeout(sync, 0);
    const timer = setInterval(sync, 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextEvent?.id, nextEvent?.eventType, nextEvent?.startsAt, nextEvent?.endsAt, nextEvent?.arrivalTime]);

  // Tournament registrations summary (count, next date, pending, live today) → Tournaments tile.
  useEffect(() => {
    if (loading || isClosedTeam) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tournament-history`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json) return;
        const hist = (json.history ?? []) as {
          registration: { id: string; status: string };
          org?: { slug?: string | null } | null;
          tournament: { slug?: string | null; status?: string | null; name?: string | null; startDate: string | null; endDate: string | null } | null;
          amountDue?: number | null;
        }[];
        const todayStr = tournamentToday();
        let count = 0; let pending = 0; let liveNow = false; let nextDate: string | null = null;
        let owed = 0; let owingCount = 0;
        for (const h of hist) {
          count += 1;
          if (h.registration.status === 'pending') pending += 1;
          const s = h.tournament?.startDate ?? null;
          const e = h.tournament?.endDate ?? s;
          if (s && e && s <= todayStr && todayStr <= e) liveNow = true;
          if (s && (e ?? s) >= todayStr && (!nextDate || s < nextDate)) nextDate = s;
          if ((h.amountDue ?? 0) > 0) { owed += h.amountDue ?? 0; owingCount += 1; }
        }
        setTournaments({ count, pending, nextDate, liveNow, owed, owingCount });
        setOverviewFanView(pickFanViewRegistration(hist));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, isClosedTeam, orgSlug, teamId]);

  // Last season at a glance — newest completed/archived season (record + dues + expenses). Money-
  // gated (mirrors the History/Season Review nav gate) so a no-money assistant never sees dues.
  useEffect(() => {
    if (loading || isClosedTeam) return;
    const a = assignments.find(x => x.teamId === teamId);
    if (!a || a.capabilities.money === 'off') { setLastSeason(null); return; }
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/history`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json?.history?.length) return;
        const years = [...json.history].sort((x: { year?: number }, y: { year?: number }) => (y.year ?? 0) - (x.year ?? 0));
        const y = years[0];
        const record = (y.wins || y.losses || y.ties) ? `${y.wins}–${y.losses}–${y.ties}` : null;
        setLastSeason({
          name: (y.name ?? String(y.year ?? '')).trim() || 'Last season',
          record,
          duesCollected: y.accounting?.duesCollected ?? 0,
          totalExpenses: y.accounting?.totalExpenses ?? 0,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, isClosedTeam, orgSlug, teamId, assignments]);

  // ── Has this team started using money AT ALL? ─────────────────────────────
  // Declared HERE, above the effects, because two things need the same answer and must not derive
  // it separately: the board's D16 collapse, and the fetch gates below. The server computes this
  // authoritatively (`milestones.moneyStarted`); the budget/dues fallback only covers that read
  // failing silently, using data this page already holds. While the first read is in flight, assume
  // UNDERWAY — an established coach flashing "set up your money" is a worse lie than the reverse.
  // `null` until a real answer lands. Guessing makes two tiles change identity after first paint —
  // dues/budget → money-setup/attendance for a brand-new coach, or the reverse for an established
  // one — which is the reshuffle the fixed-set rule exists to prevent. The board renders neutral
  // placeholders instead while this is null.
  //
  // The server's `milestones.moneyStarted` is authoritative. The budget/dues fallback exists only
  // for that fail-silent read failing, and it is deliberately BROADER than the server's definition
  // (which counts dues SCHEDULES; this counts generated installments) — so it is consulted only
  // once milestones has had its chance, never as a competing signal.
  const moneySignalSettled = !setupLoading && (milestones !== null || !!setupError);
  const moneyStarted: boolean | null = !moneySignalSettled
    ? null
    : (milestones?.moneyStarted === true
        || (budget?.amount != null)
        || (duesProgress != null && duesProgress.total > 0)
        // A failed money read leaves us genuinely unable to tell. Treat an established team as the
        // default — showing "set up your money" to a coach who already has is the worse lie, and
        // the tiles themselves render "—" rather than a fabricated figure.
        || (!!setupError && budget === null));

  // Exactly which coaching tiles the board will draw — the same function the board uses, so the
  // fetch gate and the board cannot disagree in EITHER direction (unit-tested both ways). These two
  // tiles are the only ones backed by their own request; firing for a tile that is never drawn is a
  // wasted round trip on the portal's landing page.
  const teamAssignment = assignments.find(a => a.teamId === teamId);
  const coachingTiles = teamAssignment
    ? resolveCoachingTilesShown(teamAssignment.capabilities, moneyStarted)
    : [];
  const needsAttendanceRead = coachingTiles.includes('attendance');
  const needsDevelopmentRead = coachingTiles.includes('development');

  // Season lineup analytics — ONE fetch, two consumers:
  //   • the safety bridge (design log 2026-07-09): an over-cap pitcher as one quiet line, and
  //   • the Playing time tile (chunk I, D13): where the game's minutes are going.
  // Lineups-gated; fail-silent (the Overview never blocks on analytics). Deliberately NOT a second
  // request for the tile — the payload already carries what both need.
  useEffect(() => {
    if (loading || isClosedTeam) return;
    const a = assignments.find(x => x.teamId === teamId);
    if (!a || !a.capabilities.lineups) return; // never fetched ⇒ flag + tile stay null
    let cancelled = false;
    // Chunk C: when the anchor is a GAME, ask the same call for today's arm-care concerns rather
    // than adding a second round trip. It answers only from what the coach's own settings and
    // saved lineups prove — their per-game cap, and days since that player last pitched.
    const armCareParam = nextEvent && GAME_EVENT_TYPES.includes(nextEvent.eventType)
      ? `?armCareForEvent=${encodeURIComponent(nextEvent.id)}`
      : '';
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-analytics${armCareParam}`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled) return;
        const over = (json?.analytics?.armCare ?? []).find((r: { overCapGames: number }) => r.overCapGames > 0);
        setArmCareFlag(over ? { name: over.name, overCapGames: over.overCapGames } : null);
        setGameDayArmCare((json?.armCare ?? []) as ArmCareConcern[]);
        setPeriodLabelPlural(json?.periodLabelPlural ?? 'Innings');
        const fairPlay = (json?.analytics?.fairPlay ?? []) as { fieldInnings: number; benchInnings: number }[];
        setPlayingTime(summarisePlayingTime(fairPlay, json?.analytics?.gamesWithLineup ?? 0));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // Keyed on the anchor event's id/type so a new game day re-asks; the object identity churns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isClosedTeam, orgSlug, teamId, assignments, nextEvent?.id, nextEvent?.eventType]);

  // Season attendance reliability → the Attendance tile (chunk I, D13). Fired ONLY when the board
  // will actually draw the tile — see `needsAttendanceRead` above.
  useEffect(() => {
    if (loading || isClosedTeam || !needsAttendanceRead) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/attendance`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json?.players) return;
        setAttendanceSummary(summariseAttendance(json.players as { games: { attended: number; known: number }; practices: { attended: number; known: number } }[]));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, isClosedTeam, orgSlug, teamId, needsAttendanceRead]);

  // Open development goals → the Playing time slot's documented fallback for a coach with no
  // lineup access. Fired ONLY when the board will actually draw the tile.
  useEffect(() => {
    if (loading || isClosedTeam || !needsDevelopmentRead) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/board`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        // The route returns the roster under `rows` (NOT `players`) and reports whether goals were
        // included at all via `showGoals` — it redacts them for a coach without the notes grant.
        // Trusting a redacted-empty array would print a confident "No goals yet" at someone who is
        // simply not cleared to see them.
        if (cancelled || !json?.rows || !json.showGoals) return;
        // 'working' is the only OPEN status — 'achieved' and 'parked' are both settled, and
        // counting a parked goal as outstanding would nag about work the coach deliberately shelved.
        const open = (json.rows as { goals?: { status?: string }[] }[])
          .reduce((n, p) => n + (p.goals ?? []).filter(g => g.status === 'working').length, 0);
        setOpenGoalCount(open);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, isClosedTeam, orgSlug, teamId, needsDevelopmentRead]);

  // Org-invite banner — show only when an organization has actually invited this team
  // to connect (org-initiated). Self-serve linking lives quietly in Settings otherwise.
  const isWorkspaceOrg = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  useEffect(() => {
    if (loading || isClosedTeam || !isWorkspaceOrg) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/team-links`, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json?.links) return;
        const invited = (json.links as Array<{ status: string; linkedOrg?: { name?: string } | null }>).find(l => l.status === 'invited');
        if (invited) setOrgInvite({ orgName: invited.linkedOrg?.name ?? 'An organization' });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, isClosedTeam, isWorkspaceOrg, orgSlug]);

  useEffect(() => {
    if (isClosedTeam) router.replace(`${base}/season-end`);
  }, [isClosedTeam, router, base]);

  if (loading) return <p className={styles.muted}>Loading...</p>;
  if (isClosedTeam) return <p className={styles.muted}>Opening Season&apos;s End…</p>;

  /**
   * The helper's end of the road. Their whole reason to be here was a practice on a live season;
   * with the season closed there is no practice, and every archive surface is deliberately shut to
   * them. Say so plainly rather than redirecting them into a season review of other people's
   * children — and offer no door, because there genuinely isn't one.
   */
  if (closedCapsAreHelperShaped) {
    // ⚠ Shared with Season's End (2026-08-03) — that page is where the portal-root redirect and
    // both team switchers actually send a helper, so the two must say the same thing.
    return <CoachSeasonFinishedNotice />;
  }

  const assignment = assignments.find(a => a.teamId === teamId);

  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  /**
   * ⚠ THE HELPER'S HOME (Practice Plans Phase 4, 2026-08-03, frames H1 / H4 / H5).
   *
   * The Overview below is a board of six tiles about the roster, attendance, playing time, dues and
   * lineups. When a coach holds NONE of the capabilities those tiles read, every one of them
   * resolves to nothing and the screen becomes a page of empty boxes with a setup checklist they
   * cannot action — which is what a HELPER would have met on their first sign-in.
   *
   * ⚠ **Keyed on the capabilities themselves, not on "is this person a helper".** There is no helper
   * role to ask about, and there must not be: a bundle that can render the board gets the board, and
   * one that can't gets the thing it CAN do. If a head coach later grants a helper the roster, this
   * branch stops matching by itself and they get the ordinary Overview — no list to update, nothing
   * to keep in step.
   *
   * This grants nothing and hides nothing the server would have served: it chooses an altitude.
   */
  if (hasNoTeamRecordAccess(assignment.capabilities) && assignment.capabilities.schedule) {
    return (
      // No zone passed, exactly as every other date on this page does it: the helpers default to
      // the org zone, and the date-correctness guardrail exists to stop anyone reaching for `new
      // Date()` arithmetic instead.
      <CoachHelperHome
        orgSlug={orgSlug}
        teamId={teamId}
        teamName={assignment.teamName ?? 'Your team'}
      />
    );
  }

  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  // Assistant Coaches: hide finance-driven dashboard pieces (budget/dues tiles + the "Set budget"
  // setup step) from a coach with no money access — head coaches always have it.
  const canViewMoney = assignment.capabilities.money !== 'off';
  // Gate the deep-link CTAs so a restricted assistant is never dropped straight onto the lineup
  // builder / schedule tab they can't use (mirrors the nav hiding those items). Both default ON.
  const canViewLineup = assignment.capabilities.lineups;
  const canSchedule = assignment.capabilities.schedule;
  // Record access gates both the roster fetch and every roster-derived tile — the same rule the
  // sidebar uses to hide the Roster item. (A1 2026-08-03: was roster visibility, now retired.)
  const canViewRoster = hasRecordAccess(assignment.capabilities);
  const helpHref = `/${orgSlug}/coaches/help`;
  // Division is real information only when the team's NAME doesn't already carry it as a WHOLE
  // WORD — "Riverdale Ridge 12U" + a "12U" chip is the masthead's fact stated twice, but a bare
  // substring test would also hide "AA" inside "AAA" (/review finding; same whole-word lesson as
  // stripTeamNamePrefix).
  const divisionInTeamName = !!teamDivision && new RegExp(
    `(^|[^a-z0-9])${teamDivision.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`,
    'i',
  ).test(assignment.teamName);
  // Required = the spine of a team (season is automatic, roster is the one true must).
  // Everything else is OPTIONAL: pointed to, auto-checks when done, skippable, and never
  // blocks the header chip from going quiet.
  const setupItems: SetupItem[] = [
    {
      key: 'season',
      label: 'Confirm season',
      detail: `${assignment.programYearName} is active`,
      desc: 'Your current season — everything below is tracked against it.',
      action: 'View',
      href: base,
      complete: true,
      group: 'core',
      contextOnly: true,
      help: { title: 'Season', body: 'A season groups your roster, schedule, dues, and budget for one year. When the year ends you start a new season from Settings and last year becomes read-only history.' },
    },
    {
      key: 'roster',
      label: 'Add your roster',
      detail: setupStats ? `${setupStats.activeRosterCount} active player${setupStats.activeRosterCount === 1 ? '' : 's'}` : 'Roster status',
      desc: 'Add your players — everything else (schedule, dues, lineups, announcements) builds on the roster.',
      action: 'Add players',
      href: `${base}/roster`,
      complete: (setupStats?.activeRosterCount ?? 0) > 0,
      group: 'core',
      // Gated on the capability that lets you COMPLETE the step, not merely see the page.
      // Assistants never get roster write in V1, so "Add players" was a nag they could never
      // clear — and because roster is `core` it carried no per-step Skip either, leaving the
      // global off-switch as an assistant's only escape from a step meant for the head coach.
      visible: assignment.capabilities.rosterWrite,
      help: { title: 'Roster', body: 'Your team list. Paste it in all at once, or add players one at a time with a jersey number, positions, and a parent/guardian contact email (needed for dues reminders and announcements).' },
      milestone: { order: 1, short: 'Roster', value: setupStats ? `${setupStats.activeRosterCount} player${setupStats.activeRosterCount === 1 ? '' : 's'}` : '' },
    },
    {
      key: 'schedule',
      label: 'Build your schedule',
      detail: setupStats ? `${setupStats.eventCount} event${setupStats.eventCount === 1 ? '' : 's'} scheduled` : 'Schedule status',
      desc: 'Add practices, games, and team events to one calendar your whole season reads from.',
      action: 'Add events',
      href: `${base}/schedule`,
      complete: (setupStats?.eventCount ?? 0) > 0,
      group: 'optional',
      // The sidebar already hides Schedule without this grant, and the events API 403s — so an
      // ungated step pointed a schedule-restricted assistant at a door that bounces them.
      visible: canSchedule,
      help: { title: 'Schedule', body: 'One calendar for practices, games, and events. On Premium you can set repeating events and sync the calendar to your phone. Games here are what you take attendance and set lineups on.' },
      milestone: { order: 2, short: 'Schedule', value: setupStats ? `${setupStats.eventCount} event${setupStats.eventCount === 1 ? '' : 's'}` : '' },
    },
    {
      key: 'positions',
      label: 'Add jerseys & positions',
      detail: setupStats ? `${setupStats.positionedRosterCount} of ${setupStats.activeRosterCount} player${setupStats.activeRosterCount === 1 ? '' : 's'} set up` : 'Roster details',
      desc: 'Add jersey numbers and field positions so lineups and game sheets fill in automatically.',
      action: 'Add details',
      href: `${base}/roster`,
      complete: Boolean(setupStats && setupStats.activeRosterCount > 0 && setupStats.positionedRosterCount === setupStats.activeRosterCount),
      group: 'optional',
      // Same reason as the roster step — editing jersey/position is a roster write.
      visible: assignment.capabilities.rosterWrite,
      help: { title: 'Jerseys & positions', body: 'A jersey number and one or two positions per player. They flow into your game-day lineups and batting order so you are not retyping them each game.' },
    },
    {
      key: 'lineups',
      label: 'Prepare game lineups',
      // Completion now means "this team has saved a lineup this season" (from /milestones), not
      // "the NEXT event has one" — the old next-game-scoped check read null whenever the next
      // event was a practice, so a coach who HAD built lineups was shown an unfinished step.
      // `nextLineupReady` still drives the Next-up tile's per-game flag; it just no longer decides
      // whether this step is done.
      detail: milestones?.hasLineup
        ? 'Lineup saved'
        : (setupStats?.gameCount ?? 0) > 0 ? 'Your next game needs a lineup' : 'No games scheduled yet',
      desc: (setupStats?.gameCount ?? 0) > 0
        ? 'Set the batting order and field positions for your next game before game day.'
        : 'Add a game to your schedule, then set the batting order and field positions before game day.',
      action: (setupStats?.gameCount ?? 0) > 0 ? 'Set lineup' : 'Add a game',
      href: (setupStats?.gameCount ?? 0) > 0 ? `${base}/lineups` : `${base}/schedule`,
      complete: milestones?.hasLineup === true,
      group: 'optional',
      visible: canViewLineup,
      help: { title: 'Game lineups', body: 'Open a game from your Lineups page to set the batting order and positions per inning, then print or share the lineup card. Needs at least one game on the calendar first.' },
      milestone: { order: 3, short: 'Lineup', value: milestones?.hasLineup ? 'Saved' : '' },
    },
    {
      key: 'announcements',
      label: 'Tell your families',
      detail: 'First announcement sent',
      desc: 'Email families reaches every guardian on your roster at once — the season dates, the first practice, a rain-out.',
      action: 'Write one',
      href: `${base}/announcements`,
      complete: milestones?.hasSentAnnouncement === true,
      group: 'optional',
      visible: assignment.capabilities.announcementsSend,
      // Chunk B: names the door as it is now labelled, and describes Chat honestly — it carries the
      // coach's own standing staff room as well as the tournament rooms.
      help: { title: 'Email families', body: 'A one-way email to every guardian on your active roster. Different from Chat, which is a conversation with your own coaching staff and, during a tournament, the organizer. Drafts stay private until you send.' },
      milestone: { order: 4, short: 'Families', value: milestones?.hasSentAnnouncement ? 'Sent' : '' },
    },
    {
      key: 'budget',
      label: 'Set a budget',
      detail: milestones?.moneyStarted ? 'Money is set up' : setupStats?.budgetSet ? 'Budget is set' : 'No budget yet',
      desc: 'Set a season budget and dues to track who has paid and send automatic reminders.',
      action: 'Set budget',
      href: `${base}/accounting`,
      complete: milestones?.moneyStarted === true || Boolean(setupStats?.budgetSet),
      group: 'optional',
      visible: canViewMoney,
      help: { title: 'Budget & dues', body: 'Plan your season costs, charge dues per player (one-off or installments), and track payments. Premium can email overdue reminders automatically.' },
      milestone: { order: 5, short: 'Money', value: milestones?.moneyStarted ? 'Started' : '' },
    },
    {
      key: 'staff',
      label: 'Invite assistant coaches',
      detail: milestones?.assistants ? `${milestones.assistants} assistant${milestones.assistants === 1 ? '' : 's'}` : 'No assistants yet',
      desc: 'Invite your assistants and choose exactly what each one can do — they start with the safe basics.',
      action: 'Invite',
      href: `${base}/staff`,
      complete: (milestones?.assistants ?? 0) > 0,
      group: 'optional',
      visible: assignment.capabilities.isHeadCoach,
      help: { title: 'Staff', body: 'Invite assistant coaches by email. Each one gets the everyday coaching tools; money, family contact details, and sending announcements are granted one at a time by you.' },
    },
    {
      key: 'documents',
      label: 'Add team documents',
      detail: milestones?.teamDocuments ? `${milestones.teamDocuments} document${milestones.teamDocuments === 1 ? '' : 's'}` : 'No documents yet',
      desc: 'Keep waivers, medical forms, and team info in one place your families can be pointed at.',
      action: 'Upload',
      href: `${base}/documents`,
      complete: (milestones?.teamDocuments ?? 0) > 0,
      group: 'optional',
      // Uploading needs manage rights, not just the view access the nav gate checks.
      visible: assignment.capabilities.documents === 'manage' || assignment.capabilities.isHeadCoach,
      help: { title: 'Documents', body: 'Your team’s file library — waivers, medical forms, codes of conduct. You can also track which players have returned a signed copy from each player’s profile.' },
    },
  ];
  // A step nobody can complete is a nag, not guidance. Each item carries its own `visible`
  // predicate, so adding a step means editing one place — and the answer is known synchronously
  // from capabilities rather than inferred from an async response's nulls.
  const visibleSetupItems = setupItems.filter(item => item.visible ?? true);
  const coreItems = visibleSetupItems.filter(item => item.group === 'core');
  // Required (roster) gates "you're ready"; the chip only goes quiet once EVERY step is
  // done-or-skipped, so the coach explicitly clears each optional step.
  const requiredDone = coreItems.every(item => item.complete);
  // The headline steps — rendered as "Essentials" and counted by the header chip. Everything else
  // (bar the context-only season row) falls into "When you're ready".
  const ringItems = [...visibleSetupItems]
    .filter((item): item is SetupItem & { milestone: NonNullable<SetupItem['milestone']> } => Boolean(item.milestone))
    .sort((a, b) => a.milestone.order - b.milestone.order);
  // There is no separate "required steps" list: the roster step IS essentials step 1, driven by the
  // next-action line's single lime CTA, so rendering it again as a required row said it twice.
  const rowItems = visibleSetupItems.filter(item => !item.milestone);
  // A step is settled when it's done OR (for optional steps) deliberately skipped — skipping IS
  // a decision, so it clears the step rather than leaving it to nag forever.
  const isSkipped = (item: SetupItem) => item.group === 'optional' && !item.complete && skippedSteps.has(item.key);
  const isSatisfied = (item: SetupItem) => item.complete || isSkipped(item);

  // While the roster is missing, lead with the "build your roster" guidance; after that
  // the remaining items are all optional, so the header just labels them as such.
  const guidance = getCoachGuidance('roster', { base, helpHref });

  // ── The board (chunk I) ───────────────────────────────────────────────────
  // A FIXED set of six tiles in a VARIABLE order, so a coach keeps their spatial memory as the
  // season changes state. WHICH tiles is decided by the pure resolver (lib/coach-overview);
  // everything below is the copy and the numbers for a tile that has already been chosen.
  //
  // While the first load is in flight a tile shows a neutral "…" rather than flashing a misleading
  // "Nothing scheduled" / "$0" before the data arrives.
  type TileTone = 'default' | 'danger' | 'muted';
  interface Tile {
    key: TileKey;
    label: string;
    icon: typeof Users;
    value: string;
    sub: string;
    href: string;
    tone: TileTone;
    flag?: { text: string; tone: 'ok' | 'warn' | 'mute' } | null;
    progress?: { value: number; total: number; label: string; title: string; tone: 'default' | 'danger' } | null;
    /** Last-5 W/L/T pips — the record tile's equivalent of a progress bar. */
    pips?: { result: string }[] | null;
  }

  const pct = (share: number) => `${Math.round(share * 100)}%`;

  const buildTile = (key: TileKey): Tile => {
    switch (key) {
      case 'record': {
        // The record moved OUT of its own half-width band and into the board (D5): a name and a
        // date range were taking full page width while six real numbers floated beside dead space.
        // The League/Tournament/Scrimmage scope chips live on Insights — a configuration control is
        // not a glanceable fact (owner ruling 2026-07-30) — but the coach's CHOICE still governs
        // this number, or the glance here and the band there would report different seasons.
        const scope = wltScope ?? {};
        const decided = finalizedGames.filter(e => scope[e.eventType]);
        const tally = tallyResults(decided);
        const countedLabels = WLT_CATEGORIES.filter(c => scope[c.key]).map(c => c.label);
        // A coach who has switched every category OFF has not played no games — they have chosen to
        // count none. Saying "No games yet · fills in as you finalize scores" to a team mid-season
        // would be a confident falsehood, and the setting that caused it lives on another page.
        const noneCounted = wltScope !== null && countedLabels.length === 0;
        return {
          key, label: 'Record', icon: Trophy,
          value: setupLoading || wltScope === null ? '…'
            : noneCounted ? 'Not counted'
              : decided.length === 0 ? 'No games yet'
                : formatRecord(tally),
          sub: noneCounted ? 'No game types selected — choose them in Insights'
            : decided.length === 0 ? 'Fills in as you finalize scores'
              : countedLabels.join(' + '),
          href: `${base}/history`,
          tone: noneCounted || decided.length === 0 ? 'muted' : 'default',
          pips: decided.slice(-5).map(e => ({ result: e.result ?? '' })),
        };
      }
      case 'roster':
        return {
          key, label: 'Roster', icon: Users,
          value: setupLoading ? '…' : String(setupStats?.activeRosterCount ?? 0),
          sub: 'active players',
          href: `${base}/roster`,
          tone: 'default',
          flag: (!setupLoading && missingEmailCount > 0)
            ? { text: `${missingEmailCount} missing email`, tone: 'warn' }
            : null,
          progress: (!setupLoading && setupStats && setupStats.activeRosterCount > 0)
            ? {
                value: setupStats.positionedRosterCount,
                total: setupStats.activeRosterCount,
                label: `${setupStats.positionedRosterCount}/${setupStats.activeRosterCount}`,
                title: `${setupStats.positionedRosterCount} of ${setupStats.activeRosterCount} players have a jersey number and position`,
                tone: 'default',
              }
            : null,
        };
      case 'schedule': {
        // Two faces, one slot. When the anchor is already about what's next, repeating it here is
        // the "say it three times" defect — so the slot reports a DIFFERENT fact instead of being
        // removed, which would leave a five-tile board in the most common state of all.
        if (board.scheduleFace === 'thisWeek') {
          const parts = [
            weekSummary && weekSummary.games > 0 ? `${weekSummary.games} game${weekSummary.games === 1 ? '' : 's'}` : null,
            weekSummary && weekSummary.practices > 0 ? `${weekSummary.practices} practice${weekSummary.practices === 1 ? '' : 's'}` : null,
            weekSummary && weekSummary.other > 0 ? `${weekSummary.other} other` : null,
          ].filter(Boolean) as string[];
          return {
            key, label: 'This week', icon: Calendar,
            value: setupLoading ? '…' : (parts[0] ?? 'Nothing else'),
            sub: parts.slice(1).join(' · ') || 'in the next 7 days',
            href: `${base}/schedule`,
            tone: parts.length === 0 ? 'muted' : 'default',
            flag: birthdays.length > 0
              ? {
                  text: birthdays.length === 1
                    ? `${birthdays[0].name}’s birthday${birthdays[0].inDays === 0 ? ' today' : birthdays[0].inDays === 1 ? ' tomorrow' : ''}`
                    : `${birthdays.length} birthdays this week`,
                  tone: 'mute',
                }
              : null,
          };
        }
        return {
          key, label: 'Next up', icon: Calendar,
          value: setupLoading ? '…' : nextEvent ? formatEventDate(nextEvent.startsAt) : 'Nothing',
          sub: nextEvent
            ? (nextEvent.opponent ? `vs ${nextEvent.opponent}` : (nextEvent.name || 'Upcoming event'))
            : 'scheduled ahead',
          href: `${base}/schedule`,
          tone: nextEvent ? 'default' : 'muted',
          // "Set / Not set", matching the anchor's chip above and the Lineups hub's own row flags.
          // This tile said "Lineup ready" while the card said "Lineup set" about the SAME lineup,
          // on the same screen — one fact needs one word (owner 2026-08-12).
          flag: (nextEvent && GAME_EVENT_TYPES.includes(nextEvent.eventType) && nextLineupReady !== null)
            ? (nextLineupReady ? { text: 'Lineup set', tone: 'ok' } : { text: 'Lineup not set', tone: 'warn' })
            : null,
        };
      }
      case 'tournaments':
        return {
          key, label: 'Tournaments', icon: Trophy,
          value: tournaments == null ? '…'
            : tournaments.liveNow ? 'Live now'
              : tournaments.count > 0 ? String(tournaments.count)
                : 'None yet',
          sub: tournaments && tournaments.count > 0
            ? (tournaments.nextDate
                ? `next ${formatEventDate(`${tournaments.nextDate}T00:00:00`)}`
                : `registered${tournaments.pending > 0 ? ` · ${tournaments.pending} pending` : ''}`)
            : 'Register for a tournament',
          href: `${base}/tournaments`,
          tone: (tournaments && tournaments.count > 0) ? 'default' : 'muted',
          // Tournament fees owed are a money figure — gate on money view (this tile isn't in the
          // money pair, so the flag needs its own guard).
          flag: (canViewMoney && tournaments && tournaments.owingCount > 0)
            ? { text: `${formatMoney(tournaments.owed)} in fees due`, tone: 'warn' }
            : null,
        };
      case 'dues':
        return {
          key, label: 'Dues', icon: DollarSign,
          value: setupLoading ? '…' : duesOutstanding == null ? '—' : duesOutstanding > 0 ? formatMoney(duesOutstanding) : 'All paid',
          sub: duesOutstanding == null
            ? 'Set up dues'
            : duesOverdueCount > 0
              ? `outstanding · ${duesOverdueCount} overdue`
              : duesOutstanding > 0
                ? `outstanding${duesUnpaidCount > 0 ? ` · ${duesUnpaidCount} unpaid` : ''}`
                : 'nothing owed',
          href: `${base}/accounting`,
          tone: duesOverdueCount > 0 ? 'danger' : 'default',
          progress: (!setupLoading && duesProgress)
            ? {
                value: duesProgress.paid,
                total: duesProgress.total,
                label: `${duesProgress.paid}/${duesProgress.total} paid`,
                title: `${duesProgress.paid} of ${duesProgress.total} dues installments paid`,
                tone: duesOverdueCount > 0 ? 'danger' : 'default',
              }
            : null,
        };
      case 'budget':
        return {
          key, label: 'Budget', icon: Wallet,
          value: setupLoading ? '…'
            : (!budget || budget.amount == null) ? 'Not set'
              : formatMoney(budget.amount - budget.spent),
          sub: (!budget || budget.amount == null)
            ? 'Track what the season costs'
            : `${formatMoney(budget.spent)} of ${formatMoney(budget.amount)} spent`,
          href: moneySectionHref(base, 'budget-vs-actual'),
          tone: (!budget || budget.amount == null) ? 'muted'
            : budget.spent > budget.amount ? 'danger' : 'default',
          progress: (!setupLoading && budget && budget.amount != null && budget.amount > 0)
            ? {
                value: Math.min(budget.spent, budget.amount),
                total: budget.amount,
                label: `${Math.round((budget.spent / budget.amount) * 100)}%`,
                title: `${formatMoney(budget.spent)} spent of ${formatMoney(budget.amount)} budget`,
                tone: budget.spent > budget.amount ? 'danger' : 'default',
              }
            : null,
        };
      case 'moneySetup':
        // D16 — while a money-capable coach has NEITHER dues nor a budget, the pair collapses to
        // this one tile and the freed slot goes to a coaching tile. Two muted tiles side by side
        // spent a third of a phone screen saying "not set", which reads as a broken product to the
        // exact coach least able to judge.
        return {
          key, label: 'Money', icon: DollarSign,
          value: 'Not set up',
          sub: 'Dues, a budget, and who has paid',
          href: `${base}/accounting`,
          tone: 'muted',
        };
      case 'attendance': {
        const s = attendanceSummary;
        return {
          key, label: 'Attendance', icon: CalendarCheck,
          value: s == null ? '…' : s.share == null ? 'Not enough yet' : pct(s.share),
          sub: s == null || s.share == null
            ? 'Take attendance to see the season trend'
            : 'season average',
          href: `${base}/attendance`,
          tone: s?.share == null ? 'muted' : 'default',
          flag: (s && s.lowCount > 0)
            ? { text: `${s.lowCount} player${s.lowCount === 1 ? '' : 's'} under ${pct(0.7)}`, tone: 'warn' }
            : null,
          progress: (s && s.share != null)
            ? {
                value: Math.round(s.share * 100),
                total: 100,
                label: `${s.sessions} recorded`,
                title: `${pct(s.share)} attendance across ${s.sessions} recorded player-sessions`,
                tone: 'default',
              }
            : null,
        };
      }
      case 'playingTime': {
        const p = playingTime;
        return {
          key, label: 'Playing time', icon: ListOrdered,
          value: p == null ? '…'
            : p.verdict === 'insufficient' ? 'Not enough yet'
              : p.verdict === 'even' ? 'Evenly spread' : 'Leans on a few',
          sub: p == null || p.verdict === 'insufficient'
            ? 'Save a few lineups to see the balance'
            : `across ${p.games} game${p.games === 1 ? '' : 's'}`,
          href: `${base}/history/playing-time`,
          tone: p == null || p.verdict === 'insufficient' ? 'muted' : 'default',
          flag: (p && p.belowCount > 0)
            ? { text: `${p.belowCount} player${p.belowCount === 1 ? '' : 's'} well below`, tone: 'warn' }
            : null,
        };
      }
      case 'development':
        // The documented fallback when a coach has no lineup access — never a ranked list, so the
        // board cannot reshuffle underneath them week to week.
        return {
          key, label: 'Development', icon: TrendingUp,
          value: openGoalCount == null ? '…' : openGoalCount === 0 ? 'No goals yet' : String(openGoalCount),
          // Null (still loading) must not borrow the zero copy — the value would read "…" beside a
          // caption that has already decided the answer is none.
          sub: openGoalCount == null ? 'Checking…'
            : openGoalCount > 0 ? 'goals in progress' : 'Set a focus for each player',
          href: `${base}/development`,
          tone: openGoalCount ? 'default' : 'muted',
        };
    }
  };


  const renderSetupRow = (item: SetupItem) => {
    const skipped = isSkipped(item);
    const Icon = item.complete ? CheckCircle2 : skipped ? MinusCircle : Circle;
    const descText = setupLoading
      ? 'Checking…'
      : item.complete
        ? item.detail
        : skipped
          ? 'Skipped — you can set this up anytime.'
          : item.desc;
    return (
      <div
        key={item.key}
        className={styles.setupItem}
        data-complete={item.complete ? 'true' : 'false'}
        data-skipped={skipped ? 'true' : 'false'}
      >
        <Icon size={16} className={item.complete ? styles.setupIconDone : styles.setupIconTodo} />
        <span className={styles.setupItemText}>
          <span className={styles.setupItemHead}>
            <Link href={item.href} className={styles.setupItemLabel}>{item.label}</Link>
            <HelpTooltip title={item.help.title} body={item.help.body} />
          </span>
          <span className={styles.setupItemDesc}>{descText}</span>
        </span>
        {item.complete ? (
          <span className={styles.setupItemDone}>Done</span>
        ) : item.group === 'optional' ? (
          skipped ? (
            <button type="button" className={styles.setupItemSkipUndo} onClick={() => toggleSkip(item.key)}>
              Skipped · Undo
            </button>
          ) : (
            <span className={styles.setupItemOptActions}>
              <Link href={item.href} className={styles.setupItemAction}>{item.action} →</Link>
              <button type="button" className={styles.setupItemSkip} onClick={() => toggleSkip(item.key)}>Skip</button>
            </span>
          )
        ) : (
          <Link href={item.href} className={styles.setupItemAction}>{item.action} →</Link>
        )}
      </div>
    );
  };

  // ── Phase-adaptive "Right now" anchor + graceful setup recede ─────────────
  // Finalized (result set, non-cancelled) games drive the record + the result phase.
  const finalizedGames = seasonGames.filter(e => e.result && e.status !== 'cancelled');
  const hasFinalizedGame = finalizedGames.length > 0;
  const nextIsGame = !!nextEvent && GAME_EVENT_TYPES.includes(nextEvent.eventType);
  // A registered tournament that's upcoming or live today keeps the team "in season" even
  // when nothing is on the game schedule (tournaments are tracked separately from events).
  const hasUpcomingTournament = Boolean(tournaments?.nextDate || tournaments?.liveNow);
  const phase = deriveRepPhase({
    programYearStatus: assignment.programYearStatus,
    // An UNKNOWN roster is not an EMPTY one. A zero count short-circuits the phase straight to
    // pre-season, so a coach who simply isn't permitted to see the roster would be shown "set up
    // your team" on a game day. Where the roster is hidden, hand the phase a non-zero count so it
    // falls through to the schedule-driven branches it can actually answer from.
    rosterCount: canViewRoster ? (setupStats?.activeRosterCount ?? 0) : 1,
    nextEvent: nextEvent ? { eventType: nextEvent.eventType, startsAt: nextEvent.startsAt } : null,
    nextEventDays,
    hasFinalizedGame,
    hasUpcomingTournament,
  });

  // The first still-open setup step, for the pre-season anchor's single next action. Ring steps
  // come first so "Next:" names a first-week milestone before a config chore.
  const nextSetupItem = [...ringItems, ...coreItems, ...rowItems].find(i => !i.complete && !isSkipped(i)) ?? null;
  const ringSatisfied = ringItems.filter(isSatisfied).length;
  // One ratio drives both the chip's arc and "are the essentials done" — an empty essentials list
  // (a capability-restricted assistant) reads as complete rather than as 0%.
  const ringRatio = ringItems.length ? ringSatisfied / ringItems.length : 1;
  const essentialsDone = ringRatio === 1;
  const whenReadyItems = rowItems.filter(item => !item.contextOnly);
  const actionableItems = [...ringItems, ...whenReadyItems];
  const everythingSatisfied = actionableItems.every(isSatisfied);

  // Setup guidance no longer owns the canvas: progress lives in a header chip and, while the
  // essentials are open, ONE next-action line under the header. The chip's count can't be trusted
  // until the milestone read lands (every milestone reads incomplete until then), so wait for it —
  // except when the roster is empty, which is knowable from the roster fetch alone and is the one
  // case worth guiding immediately.
  const setupDecided = !setupLoading && (!requiredDone || milestones !== null);
  // A coach whose capabilities leave them nothing to do gets no chip at all — a progress meter
  // over steps you can't complete is a nag, not guidance.
  const showSetupChip = setupDecided && actionableItems.length > 0 && !everythingSatisfied;
  // Quiet = the chip is a doorway, not a counter: essentials cleared, or hints turned off.
  const setupChipQuiet = essentialsDone || hintsOff;
  // The pre-season card's sentence. While the roster is missing it speaks in the roster guidance's
  // voice, after that it speaks for the next open step. One branch, not four — splitting this across
  // inline ternaries let the headline/body pair and the CTA pair guard on subtly different
  // conditions. (Chunk I: this is no longer a separate BAND — it is the pre-season anchor's copy.
  // The old always-on "next action" line, which shared a rule with the unrelated tour offer, is
  // retired; the tour now lives only in the Season setup chip, its one permanent home.)
  const setupLine = nextSetupItem && (!requiredDone
    ? {
        head: guidance.headline,
        desc: guidance.context,
        href: guidance.cta?.href ?? nextSetupItem.href,
        label: guidance.cta?.label ?? nextSetupItem.action,
      }
    : {
        head: nextSetupItem.label,
        desc: nextSetupItem.desc,
        href: nextSetupItem.href,
        label: nextSetupItem.action,
      });

  // Season setup — progress as a header control, not a panel. It opens on demand and never
  // occupies the canvas; the canvas belongs to the coach's team. Kept out of the header JSX so
  // the header still reads as title + subtitle + controls at a glance.
  const renderSetupChip = () => {
    if (!showSetupChip) return null;
    return (
      <div className={styles.setupChipWrap} ref={setupChipRef}>
        <button
          type="button"
          className={styles.setupChip}
          data-quiet={setupChipQuiet ? 'true' : 'false'}
          aria-expanded={setupOpen}
          onClick={() => setSetupOpen(open => !open)}
        >
          <svg className={styles.setupChipRing} viewBox="0 0 20 20" aria-hidden>
            <circle cx="10" cy="10" r={RING_R} className={styles.setupChipRingTrack} />
            <circle
              cx="10" cy="10" r={RING_R}
              className={styles.setupChipRingFill}
              strokeDasharray={`${ringRatio * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            />
          </svg>
          <span className={styles.setupChipLabel}>Season setup</span>
          {!setupChipQuiet && <span className={styles.setupChipCount}>{ringSatisfied}/{ringItems.length}</span>}
          <ChevronDown size={13} aria-hidden />
        </button>

        {/* A disclosure, not a modal: it doesn't trap focus or inert the page, so it must not
            claim dialog semantics a screen reader would then enforce. The button's aria-expanded
            plus a labelled group is the honest description of what this actually is. */}
        {setupOpen && (
          <div className={styles.setupPop} ref={setupPopRef} role="group" aria-label="Season setup">
            <div className={styles.setupPopHead}>
              <p className={styles.setupPopKicker}>Season setup · {ringSatisfied} of {ringItems.length}</p>
              <button type="button" className={styles.setupPopClose} onClick={() => setSetupOpen(false)} aria-label="Close season setup">
                <X size={15} aria-hidden />
              </button>
            </div>

            {/* Progress only — the labelled steps are the rows below, so these dots carry no
                text and no step can read as listed twice. */}
            <div className={styles.setupPopTrail} aria-hidden>
              {ringItems.map(item => (
                <span key={item.key} className={styles.setupPopDot} data-state={item.complete ? 'done' : isSkipped(item) ? 'skipped' : 'open'} />
              ))}
            </div>

            {ringItems.length > 0 && (
              <>
                <p className={styles.setupGroupLabel}>Essentials</p>
                <div className={styles.setupList}>{ringItems.map(renderSetupRow)}</div>
              </>
            )}

            {whenReadyItems.length > 0 && (
              <>
                <p className={styles.setupGroupLabel}>When you&apos;re ready</p>
                <div className={styles.setupList}>{whenReadyItems.map(renderSetupRow)}</div>
              </>
            )}

            {setupError && <p className={styles.errorText}>{setupError}</p>}

            <div className={styles.setupPopFoot}>
              {/* Permanently available here, whether or not the one-time offer has been used —
                  a coach who skipped the tour must still be able to go find it. */}
              <button type="button" className={styles.setupGuideLink} onClick={openPortalTour}>
                Take the 2-minute portal tour →
              </button>
              <button type="button" className={styles.setupPopMuted} onClick={openPortalGuide}>
                Open the full guide
              </button>
              {hintsOff ? (
                <button type="button" className={styles.setupPopMuted} onClick={turnOnHints}>Turn setup hints back on</button>
              ) : (
                <button type="button" className={styles.setupPopMuted} onClick={turnOffHints}>Turn off setup hints</button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Winding-down cue (Batch 3, P1 f5-1; D5 thresholds owner-ratified) ─────
  // Renders ONLY when the evidence is strong: a real game was played, nothing is scheduled
  // ahead, no registered tournament is coming, and the team has been quiet ≥14 days (a
  // mid-season break or tournament gap stays silent). One dismiss ends it for the season;
  // any newly scheduled event clears the trigger automatically.
  const daysSinceLastEvent = lastPastEventAt
    ? Math.max(0, calendarDaysBetween(new Date(lastPastEventAt), new Date()))
    : null;
  // A scrimmage-only season would satisfy hasFinalizedGame but produce an empty Wrapped
  // (scrimmages are excluded from the canonical record) — the cue's "unlocks your Season
  // Wrapped" promise must only be made when a real-competition game was played.
  const hasRealFinalizedGame = finalizedGames.some(e => e.eventType !== 'scrimmage');
  // The winding-down PREDICATE. Whether it WINS the anchor slot is the resolver's call — this is
  // only "is the evidence strong enough to say it at all". Note it is a strict superset of the
  // in-season lull's condition, which is exactly why the two used to contradict each other.
  const seasonWindingDown = phase === 'in_season'
    && !nextEvent
    && hasRealFinalizedGame
    && !hasUpcomingTournament
    && daysSinceLastEvent != null
    && daysSinceLastEvent >= 14
    && !seasonCueDismissed;

  const attendanceTotal = nextAttendance ? nextAttendance.in + nextAttendance.late + nextAttendance.out + nextAttendance.noReply : 0;

  /**
   * WHERE the game is. ⚠ This used to be `fieldNumber || location`, which meant the field number
   * REPLACED the venue — so the coach whose event carried both (the normal case) was shown a naked
   * "1" and lost "Lab Field" entirely. Both now render, and the number gets the sport's own noun
   * from the ONE derivation every field-picking label uses (Diamond / Rink / Court / Pitch), rather
   * than arriving as a digit with nothing to say what it counts.
   */
  const placeLabel = (() => {
    if (!nextEvent) return null;
    const venue = nextEvent.location?.trim() || null;
    const field = nextEvent.fieldNumber?.trim() || null;
    // A field value that already names itself ("Diamond 2", "Court A") must not become
    // "Diamond Diamond 2" — only a bare number takes the noun.
    // ⚠ A bare code takes the noun — "1" and "1A" alike, since a letter suffix is a common way to
    // number a surface and is no more self-describing than a digit. Anything that already names
    // itself ("Diamond 2", "North Court") is left exactly as the coach typed it.
    const surface = field ? (/^\d+[A-Za-z]?$/.test(field) ? `${fieldNounFor(assignment.teamSport)} ${field}` : field) : null;
    return [venue, surface].filter(Boolean).join(', ') || null;
  })();

  /**
   * ── The next game's PREP STATE, for the anchor resolver ───────────────────────────────────
   * `nextAttendance` is null both while the read is in flight AND when nobody has been marked, so
   * it answers "taken?" correctly in the only direction that matters: not-yet-known reads as
   * not-taken, which offers the work rather than claiming it is done.
   */
  const attendanceTaken = nextAttendance !== null;
  /**
   * Both prep reads have ANSWERED for the event now on screen — so the card can be built from
   * facts rather than from the absence of them. Without this the card renders three times on a cold
   * load, and two of those paints ask a fully-prepared coach for work they have already done.
   *
   * A non-game needs only the attendance answer; there is no lineup to wait for.
   */
  const eventPrepSettled = !nextEvent
    || (prepAnsweredFor.attendance === nextEvent.id
        && (!nextIsGame || prepAnsweredFor.lineup === nextEvent.id));
  // The console's live window, from the same predicate the schedule row and lineups hub use.
  // Clock snapshot taken once per mount so render stays pure (the schedule page's twin note).
  const gameDayOpen = !!nextEvent && isInGameDayWindow(toGameDayEventShape(nextEvent), gameDayNowMs);
  // C0: the ORG'S clock, never the device's. A coach travelling, or a family in another province,
  // must see the game's local start time — the one that means anything.
  const nextTimeLabel = nextEvent
    ? formatInOrgZone(nextEvent.startsAt, { hour: 'numeric', minute: '2-digit' })
    : null;

  // ── THE ONE THING (chunk I) ───────────────────────────────────────────────
  // Exactly one card, chosen by ONE ordered rule. Before this, nine bands each tested their own
  // predicate in source order — and the lull card and the winding-down cue, whose predicates are
  // general and specific versions of the same state, both drew: "Add an event" stacked on top of
  // "Close out the season". Selection is pure and unit-tested (lib/coach-overview); only the copy
  // and the hrefs live here.
  //
  // Held back until the first read lands, so the page never renders a confident card built on data
  // it does not have yet.
  const anchor = (setupLoading || !eventPrepSettled) ? null : resolveOverviewAnchor({
    phase,
    hasNextEvent: !!nextEvent,
    nextIsGame,
    seasonWindingDown,
    // Pre-season only names a step this coach can actually finish — `visibleSetupItems` is already
    // capability-filtered, so an assistant is never told to "Add players" (a step only a head coach
    // can complete) and then dropped on a read-only roster.
    hasOpenSetupStep: setupDecided && !hintsOff && !!nextSetupItem,
    hasUpcomingTournament,
    caps: assignment.capabilities,
    canManageSeasons: seasonMeta.canManageSeasons,
    // Chunk B (P1 #12) — a paying coach who never had a free team, on their first visit. Requires
    // setupStats to have actually LOADED: on a failed fetch the counts are unknown, and welcoming an
    // established coach is a worse error than not welcoming a new one, so unknown resolves to false.
    //
    // `!hintsOff` is load-bearing, not defensive. The tour flag and the hints switch are INDEPENDENT
    // account preferences: turning hints off never sets `tourDismissed`. So a coach who explicitly
    // switched hints off on one team and then picks up a second would have been met by an
    // onboarding card — the precise interruption Quiet Mode exists to remove, re-introduced by the
    // one card on the page. A welcome is a hint; it obeys the hint switch.
    isColdStart:
      !tourSeen && !hintsOff && !!setupStats
      && setupStats.activeRosterCount === 0 && setupStats.eventCount === 0,
    // Game prep (owner 2026-08-12) — so the button is the first thing NOT DONE rather than
    // whatever this coach happens to be allowed to do. See the input's own note for the defect.
    lineupReady: nextLineupReady,
    attendanceTaken,
    gameDayOpen,
  });

  /**
   * The card's THREE TEXT SLOTS, one set per situation (owner 2026-08-12).
   *
   * The six situations used to each render their own kicker/headline/meta markup, which is how the
   * card ended up with five stacked rows: every variant repeated the structure, so nobody could see
   * that the structure was the cost. Naming the slots once means the arrangement is decided in ONE
   * place — the same reason the portal's headers became a component.
   *
   * ⚠ Copy is unchanged from what shipped, deliberately: this is a layout pass, and every one of
   * these sentences was ruled on separately (the welcome's team-naming, the season check's
   * can/cannot-close split, the lull's tournament variant). Only the arrangement moves.
   */
  const anchorSlots: {
    tone: 'work' | 'live' | 'decide';
    kicker: React.ReactNode;
    when: React.ReactNode | null;
    headline: React.ReactNode;
    meta: React.ReactNode | null;
  } = (() => {
    switch (anchor?.kind) {
      // Chunk B (P1 #12) — the first thing a cold-signup coach ever sees. Names the team so it
      // reads as THEIR portal, not a product tour, and lists the areas rather than selling them.
      case 'welcome':
        return {
          tone: 'work', kicker: 'Welcome', when: null,
          headline: <>This is your team&apos;s portal</>,
          meta: <>
            Roster, schedule, lineups, attendance and money for {assignment.teamName} — all in
            one place. Two minutes to see what&apos;s here.
          </>,
        };
      case 'game_day':
        return {
          tone: 'live',
          kicker: <><span className={styles.oneLiveDot} aria-hidden>●</span> Game day</>,
          when: 'Today',
          headline: nextEvent?.opponent ? `vs ${nextEvent.opponent}` : (nextEvent?.name || 'Game day'),
          // On a mirrored tournament game the event's NAME is the tournament, and the headline has
          // already taken the opponent — so name it here or it disappears entirely.
          meta: nextEvent && (nextTimeLabel || placeLabel || isMirroredEvent(nextEvent))
            ? [isMirroredEvent(nextEvent) ? nextEvent.name : null, nextTimeLabel, placeLabel].filter(Boolean).join(' · ')
            : null,
        };
      case 'next_event':
        return {
          tone: 'work',
          kicker: `Next ${nextIsGame ? 'game' : 'event'}`,
          when: nextEventDays == null ? null
            : nextEventDays === 0 ? 'Today' : nextEventDays === 1 ? 'Tomorrow' : `in ${nextEventDays} days`,
          headline: nextEvent
            ? `${formatEventDate(nextEvent.startsAt)}${nextTimeLabel ? `, ${nextTimeLabel}` : ''}${nextEvent.opponent ? ` vs ${nextEvent.opponent}` : ''}`
            : '',
          meta: nextEvent
            ? ([nextEvent.opponent ? null : (nextEvent.name || 'Upcoming event'), placeLabel].filter(Boolean).join(' · ') || 'On your schedule')
            : null,
        };
      case 'season_check':
        return {
          tone: 'decide', kicker: 'Season check', when: null,
          headline: anchor.primary ? 'Is the season over?' : 'Your season looks finished',
          meta: <>
            No games in {daysSinceLastEvent === null ? 'a while' : `${Math.floor((daysSinceLastEvent ?? 0) / 7)} weeks`} and nothing scheduled.{' '}
            {anchor.primary
              ? <>Closing it out locks your record and unlocks your <strong>Season Wrapped</strong>.</>
              : <>{currentOrg?.name ?? 'Your club'} closes the season — your <strong>Season Wrapped</strong> appears here when they do.</>}
          </>,
        };
      case 'lull':
        return {
          tone: 'work',
          kicker: hasUpcomingTournament ? <><Trophy size={13} aria-hidden /> Next up</> : 'In season',
          when: hasUpcomingTournament && tournaments?.nextDate
            ? (tournaments.liveNow ? 'Live now' : formatEventDate(`${tournaments.nextDate}T00:00:00`))
            : null,
          headline: hasUpcomingTournament
            ? (tournaments?.liveNow ? 'Your tournament is on' : 'Tournament coming up')
            : 'Nothing on your schedule',
          meta: hasUpcomingTournament
            ? 'Add your games and practices so attendance, lineups and your record keep up.'
            : 'Add your next game or practice to track attendance, lineups, and your record.',
        };
      case 'preseason':
        return {
          tone: 'work', kicker: 'Next step', when: null,
          headline: setupLine?.head ?? '', meta: setupLine?.desc ?? null,
        };
      default:
        return { tone: 'work', kicker: '', when: null, headline: '', meta: null };
    }
  })();

  // ── The board ─────────────────────────────────────────────────────────────
  // `moneyStarted` is computed once, above the effects, so the board and the fetch gates share one
  // definition and cannot disagree about whether the coaching pair is needed.
  const board = resolveBoard({
    phase,
    anchorKind: anchor?.kind ?? null,
    caps: assignment.capabilities,
    moneyStarted,
  });

  // The anchor's action set → labels and destinations. Kept in ONE place so a card can't offer a
  // door its resolver never granted, and `null` genuinely renders nothing (never a disabled button).
  const anchorHref = (action: string): string => {
    switch (action) {
      case 'build_lineup': return nextEvent ? `${base}/lineups/${nextEvent.id}` : `${base}/lineups`;
      case 'take_attendance': return nextEvent ? `${base}/schedule?event=${nextEvent.id}&tab=attendance` : `${base}/schedule`;
      // The console's ONE address, via the same helper the schedule row and lineups hub use — it
      // returns null outside the live window, which the resolver has already ruled out here.
      case 'open_game_day':
        return (nextEvent && gameDayEntryHref(orgSlug, teamId, nextEvent, gameDayNowMs)) || `${base}/schedule`;
      case 'open_schedule': return `${base}/schedule`;
      case 'add_event': return `${base}/schedule`;
      case 'view_tournaments': return `${base}/tournaments`;
      case 'setup_step': return setupLine?.href ?? base;
      default: return base;
    }
  };
  const ANCHOR_LABEL: Record<string, string> = {
    build_lineup: 'Build lineup',
    take_attendance: 'Take attendance',
    open_game_day: 'Open game day',
    open_schedule: 'Open schedule',
    add_event: 'Add an event',
    view_tournaments: 'View tournaments',
    close_season: 'Close out the season',
    setup_step: setupLine?.label ?? 'Get started',
    take_tour: 'Show me around',
  };
  const ANSWER_LABEL: Record<string, string> = {
    ...ANCHOR_LABEL,
    // D2 — a state that replaces another inherits the door it replaced, and says so plainly.
    add_event: anchor?.kind === 'season_check' ? 'Add an event instead' : 'Add an event',
    setup_step: anchor?.kind === 'welcome'
      ? `${setupLine?.label ?? 'Get started'} instead`
      : (setupLine?.label ?? 'Get started'),
    not_yet: 'Not yet',
    got_it: 'Got it',
    skip_step: 'Skip this step',
  };

  /**
   * ── THE PREP ROW (owner 2026-08-12, mockup artifact 137039b5 option B) ────────────────────
   *
   * ONE row replacing TWO: the read-only readiness strip AND the text answers row, on
   * game-shaped cards only. Those were two renderings of a single subject — the strip reported
   * prep state in words you could not tap, and the answers row offered doors that had no idea
   * whether the work was already done. That is how the card came to show "Lineup ready" beside a
   * "Build lineup" button and "Take attendance" beside a headcount proving attendance was taken.
   * Each chip now carries the state AND the door for its own item, so the two cannot disagree:
   * there is only one of them left.
   *
   * ⚠ WHO SEES WHAT, and why it is not a judgement call: both prep reads are capability-gated at
   * the API (`denyUnless(capabilities.attendance)` / `.lineups`), so for a coach without the duty
   * there is simply no answer to show — and a chip is suppressed rather than guessed. The old strip
   * got this wrong in the one direction that lies: with the attendance read denied it printed
   * "Attendance not taken" at a coach who could not have known either way. Nothing real is lost
   * here — call time and uniform ride the event itself and still show to everyone on staff.
   *
   * Where a chip DOES appear, it is a LINK only if this coach can act on it; otherwise it stays a
   * plain fact. That is D14 applied one level down.
   *
   * ⚠ Order is FIXED, never "outstanding first". A row that re-sorts itself as the morning
   * progresses moves the thing a coach is reaching for while they reach for it.
   */
  const prepChips: { key: string; state: 'done' | 'todo' | 'fact'; href: string | null; body: React.ReactNode }[] = [];
  if (nextEvent && nextIsGame && (anchor?.kind === 'game_day' || anchor?.kind === 'next_event')) {
    const chipCaps = assignment.capabilities;
    /**
     * ⚠ NO CAPABILITY, NO CLAIM. The next-event attendance read is denied outright to a coach
     * without the attendance duty, so `nextAttendance` is null for them for a reason that has
     * nothing to do with whether attendance was taken. Rendering the "not taken" chip there would
     * be a confident wrong answer — the very thing this card's resolver refuses to do about the
     * schedule one level up — and this pass makes it an AMBER warning chip, which shouts it.
     * They see no attendance chip at all, which is honest: we do not know.
     */
    const attendanceHref = chipCaps.attendance ? anchorHref('take_attendance') : null;
    if (chipCaps.attendance) {
      prepChips.push(nextAttendance
        ? { key: 'attendance', state: 'done', href: attendanceHref,
            body: <><CheckCircle2 size={13} aria-hidden /> <strong>{nextAttendance.in}</strong> of {attendanceTotal} in</> }
        : { key: 'attendance', state: 'todo', href: attendanceHref,
            body: <><TriangleAlert size={13} aria-hidden /> Attendance not taken</> });
    }
    // Only once the read has landed — `null` is "not known yet", and a card that guesses about the
    // lineup is the whole defect this row exists to remove.
    if (nextLineupReady !== null) {
      const lineupHref = chipCaps.lineups ? anchorHref('build_lineup') : null;
      prepChips.push(nextLineupReady
        ? { key: 'lineup', state: 'done', href: lineupHref, body: <><CheckCircle2 size={13} aria-hidden /> Lineup set</> }
        : { key: 'lineup', state: 'todo', href: lineupHref, body: <><TriangleAlert size={13} aria-hidden /> Lineup not set</> });
    }
    // ⚠ "10 of 12 in" alone hides WHY the other two are missing — two who said they are out and two
    // who never answered are different mornings, and one of each is a third. So the gap is accounted
    // for IN FULL rather than partially: every non-"in" state with anyone in it gets a chip, and the
    // numbers on this row always add up to the total. Only once attendance has actually been taken.
    if (nextAttendance) {
      ([
        ['late', nextAttendance.late, 'late'],
        ['out', nextAttendance.out, 'out'],
        ['noreply', nextAttendance.noReply, 'no reply'],
      ] as const).forEach(([key, count, word]) => {
        if (count > 0) prepChips.push({ key, state: 'fact', href: attendanceHref, body: <>{count} {word}</> });
      });
    }
    if (nextEvent.arrivalTime) prepChips.push({ key: 'call', state: 'fact', href: null, body: <>Call {fmtClockLabel(nextEvent.arrivalTime)}</> });
    if (nextEvent.uniform) prepChips.push({ key: 'uniform', state: 'fact', href: null, body: <>{nextEvent.uniform}</> });
  }

  // ⚠ THE OVERVIEW HAS NO REFERENCE RAIL, DELIBERATELY (owner ruling 2026-08-03, after seeing it
  // built). Every line of it restated a tile the board already carries — the week's counts, the
  // missing-guardian-email count, the overdue-dues count — in a second column beside those very
  // tiles. This page answers ONE question at a time; a parallel column of the same answers works
  // against that, and it read as crowded. The lineup builder and Dues keep their rails, because
  // those carry facts that are genuinely not on screen. If a rail is proposed here again, it has
  // to hold something the six tiles cannot.

  return (
    <div className={styles.page}>
      <UpgradeSummaryBanner orgSlug={orgSlug} teamId={teamId} />

      {/* Contextual org invitation — only when an org actually invited this team */}
      {orgInvite && (
        <div className={styles.orgInviteBanner} role="status">
          <Building2 size={18} className={styles.orgInviteIcon} aria-hidden />
          <div className={styles.orgInviteText}>
            <p className={styles.orgInviteTitle}>{orgInvite.orgName} invited your team to connect</p>
            <p className={styles.orgInviteBody}>Review the invitation to join their organization, or keep running independently.</p>
          </div>
          {/* Outlined (not lime) so the phase anchor keeps the single lime action per CP-1 — the
              invite is a notification, not the page's primary task. */}
          <Link href={`/${orgSlug}/coaches/link-org`} className="btn btn-outline btn-sm">Review invite</Link>
        </div>
      )}

      {/* Page-header ruling 2026-08-11: title + chips + actions + help, NOTHING under the title.
          The masthead directly above owns the team name, season and the coach's role. */}
      {/* ⚠ The page-header ruling's ONE exception, RETIRED by the owner 2026-08-12. The approved
          mockup drew Overview title-only — the reasoning being that an icon marks a SECTION, and the
          hub's front door has no sibling to be distinguished from. That holds only if you see the
          screens side by side; a coach meets them one after another, and in sequence the thing that
          registers is the title jumping 44px left and back. Consistency was the point of the ruling,
          and one exception in forty read as an oversight — which is exactly how the owner read it.
          Do not "restore" the exception: it was tried, shipped, and rejected on sight. */}
      <CoachPageHeader
        icon={LayoutDashboard}
        title="Overview"
        titleChips={
          <>
            {isTeamWorkspace && <span className={styles.titlePremiumBadge}>Premium</span>}
            {/* Status badge only when it's NOT the everyday "active" case — an active team
                needs no label; draft/completed/archived seasons get one so it's noticed. */}
            {assignment.programYearStatus !== 'active' && (
              <span className={`${styles.badge} ${STATUS_CSS[assignment.programYearStatus] ?? styles.badgeDraft}`}>
                {STATUS_LABEL[assignment.programYearStatus] ?? assignment.programYearStatus}
              </span>
            )}
            {teamDivision && !divisionInTeamName && (
              <span className={`${styles.badge} ${styles.badgeManual}`}>{teamDivision}</span>
            )}
          </>
        }
        actions={renderSetupChip()}
        helpLabel="Premium Coaches Portal"
        help={{ module: 'coaches', sectionIds: ['premium-portal-tour', 'premium'], fullGuideHref: `${helpHref}#premium-portal-tour` }}
      />

      {/* A failed dashboard read has to say so ON the page. Moving setup into the popover left this
          message behind a click — and for a coach whose chip is hidden, behind nothing at all. The
          tiles below would then quietly show zeros for data that simply failed to load. */}
      {!setupLoading && setupError && (
        <p className={styles.loadErrorLine} role="status">
          <TriangleAlert size={15} aria-hidden /> {setupError} — some figures below may be
          incomplete. <button type="button" className={styles.loadErrorRetry} onClick={() => void loadSetup()}>Try again</button>
        </p>
      )}

      {/* ══ THE ONE THING ══════════════════════════════════════════════════════
          Exactly one card. Which one is the resolver's decision; this renders it in one of three
          shapes. A `null` primary is deliberate and means informational — the card keeps its
          sentence and drops its button, never a disabled control. */}
      {anchor && (
        <div className={styles.oneThing} data-shape={anchor.shape} data-kind={anchor.kind}>
          {/* ── ONE SHAPE, six situations (owner 2026-08-12) ───────────────────────────────────
              Each situation contributes a KICKER, a HEADLINE and a META, and the card renders them
              in one arrangement: the primary action sits ON the headline's row and the answers sit
              ON the meta's row, instead of each claiming a stacked row of its own.

              ⚠ This is a HEIGHT fix, not an information one. The card was 228px on a desktop and
              267px on a phone — a third of the viewport — which pushed the Dues/Budget/Record row
              past the fold on the screen coaches open most. Five stacked rows were carrying one
              fact and one action.

              ⚠ The date STAYS in the headline, though the sticky team bar also carries it. The
              mockup proposed dropping it as a duplicate; the bar's right slot is `display:none`
              once the phone header collapses on scroll, so the "duplicate" vanishes the moment a
              coach scrolls and the card would be the only copy — of a fact that had just been
              deleted. A duplicate that disappears is not a duplicate.

              Game day keeps whatever height it earns: the scoreline, readiness and arm-care rows
              are facts a coach opens the portal FOR on a game morning, and they still render below
              in full. */}
          {/* Chunk B (P1 #12) — the first thing a cold-signup coach ever sees. Names the team so it
              reads as THEIR portal, not a product tour, and lists the areas rather than selling
              them. No colour rule needed: `.oneThing`'s base accent already applies, which is the
              same treatment the pre-season card this replaces was using. */}
          <p className={styles.oneKicker} data-t={anchorSlots.tone}>
            {anchorSlots.kicker}
            {anchorSlots.when && <span className={styles.oneKickerWhen}>{anchorSlots.when}</span>}
          </p>

          <div className={styles.oneHeadRow}>
            <p className={styles.oneHeadline}>{anchorSlots.headline}</p>
            {/* The shipped lime CTA language + a layout-only modifier, so warm-theme handling and
                the single-lime-action rule are inherited rather than re-implemented.
                A `null` primary is deliberate and means informational — the card keeps its
                sentence and drops its button, never a disabled control. */}
            {anchor.primary && (
              anchor.primary === 'close_season' ? (
                <button type="button" className={`btn btn-lime ${styles.onePrimary}`} onClick={() => setRolloverOpen(true)}>
                  {ANCHOR_LABEL[anchor.primary]}
                </button>
              ) : anchor.primary === 'take_tour' ? (
                // Opens the tour DRAWER in place — not a navigation. Opening deliberately does not
                // retire the offer; only finishing or skipping does (the shipped Quiet Mode rule),
                // so an accidental Escape doesn't cost the coach their one welcome.
                <button type="button" className={`btn btn-lime ${styles.onePrimary}`} onClick={openPortalTour}>
                  {ANCHOR_LABEL[anchor.primary]}
                </button>
              ) : (
                <Link href={anchorHref(anchor.primary)} className={`btn btn-lime ${styles.onePrimary}`}>
                  {ANCHOR_LABEL[anchor.primary]} <ArrowRight size={15} aria-hidden />
                </Link>
              )
            )}
          </div>

          {(anchorSlots.meta || anchor.answers.length > 0 || (anchor.kind === 'preseason' && !tourSeen)) && (
            <div className={styles.oneMetaRow}>
              {anchorSlots.meta && <p className={styles.oneMeta}>{anchorSlots.meta}</p>}
              {(anchor.answers.length > 0 || (anchor.kind === 'preseason' && !tourSeen)) && (
                <div className={styles.oneAnswers}>
                  {anchor.answers.map(answer => {
                    if (answer === 'not_yet' || answer === 'got_it') {
                      return (
                        <button key={answer} type="button" className={styles.oneAnswerMuted} onClick={dismissSeasonCue}>
                          {ANSWER_LABEL[answer]}
                        </button>
                      );
                    }
                    if (answer === 'skip_step') {
                      return (
                        <button key={answer} type="button" className={styles.oneAnswerMuted} onClick={() => nextSetupItem && toggleSkip(nextSetupItem.key)}>
                          {ANSWER_LABEL[answer]}
                        </button>
                      );
                    }
                    return (
                      <Link key={answer} href={anchorHref(answer)} className={styles.oneAnswer}>
                        {ANSWER_LABEL[answer]}
                      </Link>
                    );
                  })}
                  {/* The tour is offered ONCE, and only beside the pre-season step — the one moment
                      it is actually relevant. It no longer shares a rule with this season's next
                      task. */}
                  {anchor.kind === 'preseason' && !tourSeen && (
                    <button type="button" className={styles.oneAnswer} onClick={openPortalTour}>
                      Take the 2-minute tour
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* The scoreline. Once a score is entered on game day this is the single most-wanted
              fact on the page, and dropping it in the rewrite would have made the Overview go
              quiet at exactly the moment it matters most. */}
          {anchor.kind === 'game_day' && nextEvent
            && nextEvent.teamScore != null && nextEvent.opponentScore != null && (
            <p className={styles.oneScoreline}>
              {nextEvent.teamScore} – {nextEvent.opponentScore}
              {nextEvent.result && (
                <span className={styles.oneScoreResult}>
                  {' · '}{nextEvent.result === 'win' ? 'Win' : nextEvent.result === 'loss' ? 'Loss' : 'Tie'}
                </span>
              )}
            </p>
          )}

          {/* Readiness rides the card on BOTH working shapes — it is the whole reason a coach
              opens the portal on a game morning, and it used to sit three scrolls down.
              Chunk C's two extra facts (call time, uniform) ride here too. Everything about WHAT
              this row contains and who gets a tappable version of it is decided in `prepChips`
              above; this only draws it. */}
          {prepChips.length > 0 && (
            <div className={styles.oneChips}>
              {prepChips.map(c => (c.href
                ? <Link key={c.key} href={c.href} className={styles.oneChip} data-state={c.state}>{c.body}</Link>
                : <span key={c.key} className={styles.oneChip} data-state={c.state}>{c.body}</span>
              ))}
            </div>
          )}

          {/* Arm care (wow #2, D-C7). Decision SUPPORT: it warns, never blocks, never changes a
              lineup, and never tells the coach what to do. It claims ONLY what the coach's own
              settings and saved lineups prove — their per-game cap, and days since that player
              last pitched. There is no season innings ceiling in this product, so it does not
              imply one; a fabricated threshold here would cost a child's arm. */}
          {(anchor.kind === 'game_day' || anchor.kind === 'next_event') && nextIsGame
            && gameDayArmCare.length > 0 && (
            <div className={styles.oneArmCare} role="note">
              {gameDayArmCare.slice(0, 2).map(concern => {
                const copy = armCareCopy(concern, periodLabelPlural);
                return (
                  <p key={concern.playerId} className={styles.oneArmCareRow}>
                    <TriangleAlert size={14} aria-hidden />
                    <span>
                      <strong>{copy.headline}</strong>
                      {copy.detail && <span className={styles.oneArmCareDetail}>{copy.detail}</span>}
                    </span>
                  </p>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ══ THE BOARD ══════════════════════════════════════════════════════════
          Six tiles, fixed set, variable order — the coach's own numbers, directly under the one
          thing rather than below the fold at the bottom of the page. */}
      <section aria-labelledby="board-title">
        <p className={styles.sectionKicker} id="board-title">Your team at a glance</p>
        {/* The shipped tile language, unchanged — this band gained tiles and moved up the page, so
            re-skinning it would have been a second card system for no reason. */}
        <div className={styles.snapshotGrid}>
          {board.slots.map(key => {
            const tile = buildTile(key);
            const Icon = tile.icon;
            return (
              <Link key={tile.key} href={tile.href} className={styles.snapshotCard} data-tone={tile.tone}>
                <span className={styles.snapshotHead}>
                  <span className={styles.snapshotHeadLabel}><Icon size={13} aria-hidden /> {tile.label}</span>
                  <ArrowRight size={13} className={styles.snapshotHeadArrow} aria-hidden />
                </span>
                <span className={styles.snapshotValue} data-tone={tile.tone}>{tile.value}</span>
                <span className={styles.snapshotSub}>{tile.sub}</span>
                {tile.pips && tile.pips.length > 0 && (
                  // The same W/L/T pips the record widget and Insights use — one pip language.
                  <span className={styles.wltFormPips} aria-hidden>
                    {tile.pips.map((p, i) => (
                      <span key={i} className={styles.wltPip} data-r={p.result || undefined}>
                        {p.result === 'win' ? 'W' : p.result === 'loss' ? 'L' : 'T'}
                      </span>
                    ))}
                  </span>
                )}
                {tile.progress && (
                  <span className={styles.snapshotBar} title={tile.progress.title}>
                    <span className={styles.snapshotBarTrack}>
                      <span
                        className={styles.snapshotBarFill}
                        data-tone={tile.progress.tone}
                        style={{ width: `${tile.progress.total > 0 ? Math.round((tile.progress.value / tile.progress.total) * 100) : 0}%` }}
                      />
                    </span>
                    <span className={styles.snapshotBarPct}>{tile.progress.label}</span>
                  </span>
                )}
                {tile.flag && <span className={styles.snapshotFlag} data-tone={tile.flag.tone}>{tile.flag.text}</span>}
              </Link>
            );
          })}
          {/* Undecided slots hold their space without claiming an identity, so resolving them into
              real tiles is not a reshuffle. A placeholder that said "Dues" and then became "Money —
              not set up" would be exactly the identity flip the fixed-set rule forbids. */}
          {Array.from({ length: board.pendingSlots }, (_, i) => (
            <div key={`pending-${i}`} className={styles.snapshotCard} data-tone="muted" aria-hidden>
              <span className={styles.snapshotHead}><span className={styles.snapshotHeadLabel}>&nbsp;</span></span>
              <span className={styles.snapshotValue} data-tone="muted">…</span>
            </div>
          ))}
        </div>
      </section>

      {/* Safety-tier bridge from Insights — the ONE finding category that shouldn't wait for a
          couch session. Kept as its own line rather than folded into the tail: an arm-care breach
          is a warning, and the tail is where quiet things go. */}
      {armCareFlag && (
        <p className={styles.insightsBridge}>
          <span className={styles.insightsBridgeIcon} aria-hidden>⚠</span>
          Worth a look: {armCareFlag.name} went over the pitching cap in {armCareFlag.overCapGames} game{armCareFlag.overCapGames === 1 ? '' : 's'}.{' '}
          <Link href={`${base}/history/playing-time`}>Season insights →</Link>
        </p>
      )}

      {/* ══ THE TAIL ═══════════════════════════════════════════════════════════
          Everything that is not today's work, in one quiet list: a tappable row list on a phone, a
          single ruled line on desktop. Replaces four scattered bands (the full-width tournament
          strip, the fan-view link floating on the page ground, the last-season card and the
          this-week strip) that between them out-weighted the coach's actual numbers. */}
      {(overviewFanView || lastSeason) && (
        <div className={styles.tail}>
          {/* The SAME component the free portal renders, in its row layout — so the lifecycle
              states, their labels and the ⇄ Fan view door stay in one place. A hand-rolled row here
              would have meant a future state landing on one tier only. */}
          {overviewFanView && <CoachLiveEventCard event={overviewFanView} layout="row" />}

          {lastSeason && (
            <Link href={`${base}/history`} className={styles.tailRow} key="last-season">
              <Archive size={15} className={styles.tailIcon} aria-hidden />
              <span className={styles.tailLabel}>Last season · {lastSeason.name}</span>
              <span className={styles.tailMeta}>
                {[
                  lastSeason.record ? `${lastSeason.record} record` : null,
                  `${formatMoney(lastSeason.duesCollected)} collected`,
                  `${formatMoney(lastSeason.totalExpenses)} spent`,
                ].filter(Boolean).join(' · ')}
              </span>
              <ArrowRight size={14} className={styles.tailArrow} aria-hidden />
            </Link>
          )}
        </div>
      )}

      {/* Tournament-acquisition awareness — moved here from the retired My Teams hub (its
          only surface; the hub is now a pure redirector). Quiet, below all content, self-
          gating (only orgs with the entitlement and no tournaments yet) and dismissible. */}
      <div style={{ marginTop: '1.25rem' }}>
        <CoachTournamentAwarenessBanner orgSlug={orgSlug} isTeamWorkspace={isTeamWorkspace} />
      </div>

      {/* "Close out the season" from the winding-down cue — the SAME rollover sheet Settings
          opens (closing and starting next season are one honest action). */}
      {rolloverOpen && (
        <StartNextSeasonModal
          orgSlug={orgSlug}
          teamId={teamId}
          currentSeasonName={assignment.programYearName}
          defaultNextYear={(seasonMeta.year ?? new Date().getFullYear()) + 1}
          onClose={() => setRolloverOpen(false)}
          onDone={async () => {
            setRolloverOpen(false);
            // refreshAssignments changes the assignments identity, which re-keys loadSetup
            // and re-fires its effect with a FRESH closure — calling loadSetup here too
            // would run a second, stale-closured copy in parallel (adversarial review).
            await refreshAssignments();
          }}
        />
      )}

      {/* The offered portal tour (Phase C1). Non-modal side drawer — the sidebar it describes stays
          visible behind it. Never auto-opens: `tourOpen` only goes true from an explicit link.
          Render-GATED, not just prop-gated: `next/dynamic` fetches the chunk as soon as the element
          is mounted, so mounting it always would have loaded the tour for every coach who never
          opens it — defeating the whole point of the lazy import (same gate HelpDrawerProvider
          uses on its drawer). */}
      {tourOpen && (
        <CoachPortalTour
          open
          basePath={base}
          capabilities={assignment.capabilities}
          onClose={() => setTourOpen(false)}
          onFinish={finishPortalTour}
        />
      )}
    </div>
  );
}
