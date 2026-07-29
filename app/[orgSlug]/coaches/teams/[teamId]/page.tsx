'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCoaches, resolveClosedAssignment } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import { Archive, ArrowRight, Building2, Cake, Calendar, CheckCircle2, ChevronDown, Circle, DollarSign, MinusCircle, TriangleAlert, Trophy, Users, Wallet, X } from 'lucide-react';
import UpgradeSummaryBanner from '@/components/coaches/UpgradeSummaryBanner';
import StartNextSeasonModal from '@/components/coaches/StartNextSeasonModal';
import CoachTournamentAwarenessBanner from '@/components/marketing/CoachTournamentAwarenessBanner';
import SeasonRecordWidget from '@/components/coaches/SeasonRecordWidget';
import { pickFanViewRegistration, type FanViewRegistration } from '@/lib/coach-alert-registration';
import CoachLiveEventCard from '@/components/coaches/CoachLiveEventCard';
import { deriveRepPhase } from '@/lib/coach-rep-phase';
import { calendarDaysBetween, tournamentToday, daysBetweenDateStrings } from '@/lib/timezone';
import HelpButton from '@/components/help/HelpButton';
import HelpTooltip from '@/components/help/HelpTooltip';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import { getCoachGuidance } from '@/lib/coach-guidance';
import { isCoachNavItemVisible } from '@/lib/coach-nav-visibility';
import { isNeverPaidPlayer } from '@/lib/dues-status';
import styles from '../../coaches.module.css';
import type { RepRosterPlayer, RepTeamEvent } from '@/lib/types';

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];

/**
 * Coach-scoped (NOT team-scoped) onboarding preferences — a coach with three teams decides once.
 * Deliberately keyless of teamId, unlike the per-team `coach-setup-skipped:` / `coach-season-cue:`
 * keys below, which record facts about a season rather than a preference.
 *
 * ⚠ Phase C seam: both of these move to account-level `user_preferences` columns so they follow the
 * coach across devices. These two constants and the four call sites below are the whole surface.
 */
const HINTS_OFF_KEY = 'coach-setup-hints-off';
const TOUR_SEEN_KEY = 'coach-portal-tour-seen';

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

/**
 * Sections with no honest "done" state, named on Overview so a coach doesn't finish setup without
 * learning they exist (readiness review #6 — five of eleven sections were invisible). Chat's copy
 * is deliberately honest that it's tournament-scoped rather than promising a populated room.
 */
const DISCOVERY_SECTIONS: { key: string; label: string; href: string; title: string; needs?: 'tryouts' }[] = [
  { key: 'chat', label: 'Chat', href: '/chat', title: 'Message organizers and other coaches during a tournament' },
  { key: 'development', label: 'Development', href: '/development', title: 'Player goals, skills tests, and awards' },
  { key: 'insights', label: 'Insights', href: '/history', title: 'Playing time, attendance, and season reports — they fill in on their own' },
  { key: 'tryouts', label: 'Tryouts', href: '/tryouts', title: 'Run tryouts and pick your team', needs: 'tryouts' },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatEventDate(value: string): string {
  return new Date(value).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
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
  const { assignments, closedAssignments, loading, refresh: refreshAssignments } = useCoaches();
  const { currentOrg } = useOrg();
  const { openHelp } = useHelpDrawer();
  const router = useRouter();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  // Season's End access (Batch 3, P0 #1): a team whose only season is CLOSED has no live
  // Overview — its landing is the read-only Season's End page (redirect below, never a
  // wall). Computed HERE, above the data effects, so they can skip their fetches: every
  // endpoint this page reads is active-year-scoped and would just 403/404 for a closed
  // team. Shared predicate with the navs (lib/coaches-context.tsx).
  const isClosedTeam = !loading && !!resolveClosedAssignment(assignments, closedAssignments, teamId);
  const [setupStats, setSetupStats] = useState<SetupStats | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupError, setSetupError] = useState('');
  const [teamDivision, setTeamDivision] = useState<string | null>(null);
  // Run-mode snapshot ("Your team at a glance")
  const [nextEvent, setNextEvent] = useState<RepTeamEvent | null>(null);
  // Whole days until the next event (computed at load; null when nothing upcoming) → stat strip.
  const [nextEventDays, setNextEventDays] = useState<number | null>(null);
  const [seasonGames, setSeasonGames] = useState<RepTeamEvent[]>([]);
  // Events in the next 7 days (grouped) for the "This week" line.
  const [weekSummary, setWeekSummary] = useState<{ practices: number; games: number; other: number; total: number } | null>(null);
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
  // "Turn off setup hints" — silences the next-action line and the chip's count everywhere this
  // coach works. Deliberately NOT team-scoped: a coach with three teams dismisses once.
  const [hintsOff, setHintsOff] = useState(false);
  // Whether this coach has already been offered the portal tour (the offer is one-time).
  const [tourSeen, setTourSeen] = useState(true);
  // Paid vs total dues installments → the Dues snapshot mini-gauge.
  const [duesProgress, setDuesProgress] = useState<{ paid: number; total: number } | null>(null);
  // Season budget vs actual spend → Budget tile.
  const [budget, setBudget] = useState<{ amount: number | null; spent: number } | null>(null);
  // Player birthdays in the next 7 days → a small "this week" touch.
  const [birthdays, setBirthdays] = useState<{ name: string; inDays: number }[]>([]);
  // In/Late/Out/No-reply headcount for the next event → Next-up tile.
  const [nextAttendance, setNextAttendance] = useState<{ in: number; late: number; out: number; noReply: number } | null>(null);
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
      const canRoster = !!a && a.capabilities.roster !== 'off';
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
        eventCount: events.length,
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

      // Events in the next 7 days, grouped for the "This week" line.
      const weekAhead = now + 7 * 86400000;
      const thisWeek = events.filter(e => {
        const t = new Date(e.startsAt).getTime();
        return e.status === 'scheduled' && t >= now && t <= weekAhead;
      });
      const wkGames = thisWeek.filter(e => GAME_EVENT_TYPES.includes(e.eventType)).length;
      const wkPractices = thisWeek.filter(e => e.eventType === 'practice').length;
      setWeekSummary({ games: wkGames, practices: wkPractices, other: thisWeek.length - wkGames - wkPractices, total: thisWeek.length });

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
        const duesData: { players?: Array<{ outstanding?: number; installments?: Array<{ paidAt: string | null; dueDate: string }> }> } = await duesRes.json();
        const players = duesData.players ?? [];
        const totalOutstanding = players.reduce((s, p) => s + (p.outstanding ?? 0), 0);
        // Overdue is a CALENDAR question in the org's timezone — comparing date strings avoids
        // the device-zone skew that flagged dues late the evening before they were due.
        const orgToday = tournamentToday();
        const overdue = players.reduce((n, p) => n + (p.installments ?? []).filter(i => !i.paidAt && i.dueDate < orgToday).length, 0);
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

  // Until the Phase C account-level store lands, a browser profile stands in for the coach —
  // true for every real single-user device.
  useEffect(() => {
    void Promise.resolve().then(() => {
      // `tourSeen` starts true so the offer can't flash in and vanish for a coach who has already
      // taken it. That default must NOT survive a storage failure, though: blocked localStorage
      // (locked-down or private-mode browsers) would then suppress the one-time tour forever. Both
      // prefs are resolved into locals first and written unconditionally, so an unreadable store
      // fails toward offering help rather than silently withholding it.
      let hints = false;
      let seen = false;
      try {
        hints = localStorage.getItem(HINTS_OFF_KEY) === '1';
        seen = localStorage.getItem(TOUR_SEEN_KEY) === '1';
      } catch { /* storage unavailable — fall through with the show-guidance defaults */ }
      setHintsOff(hints);
      setTourSeen(seen);
    });
  }, []);

  const turnOffHints = useCallback(() => {
    setHintsOff(true);
    setSetupOpen(false);
    try { localStorage.setItem(HINTS_OFF_KEY, '1'); } catch { /* ignore */ }
  }, []);

  const turnOnHints = useCallback(() => {
    setHintsOff(false);
    try { localStorage.removeItem(HINTS_OFF_KEY); } catch { /* ignore */ }
  }, []);

  // Interim tour door (Phase A): opens the existing "Getting around your Premium portal" guide in
  // the help drawer, and retires the one-time offer. Phase C replaces the target with the
  // paginated four-card tour; the entry points and the offer-once rule stay exactly as they are.
  const openPortalTour = useCallback(() => {
    setTourSeen(true);
    try { localStorage.setItem(TOUR_SEEN_KEY, '1'); } catch { /* ignore */ }
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
  const setupChipRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!setupOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (setupChipRef.current && !setupChipRef.current.contains(e.target as Node)) setSetupOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSetupOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [setupOpen]);

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
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${nextEvent.id}/lineup`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json) return;
        const entries = (json.entries ?? []) as { inningPositions?: Record<string, string> }[];
        setNextLineupReady(entries.some(e => Object.values(e.inningPositions ?? {}).some(Boolean)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // Keyed on the event's id/type (not the object identity) so a fresh loadSetup doesn't re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, teamId, nextEvent?.id, nextEvent?.eventType]);

  // In/Late/Out/No-reply headcount for the next event → shown on the Next-up tile (once the coach
  // has marked at least one player). Active players with no mark count as "no reply".
  useEffect(() => {
    setNextAttendance(null);
    if (!nextEvent) return;
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
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, teamId, nextEvent?.id]);

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

  // Safety bridge (design log 2026-07-09): surface an over-cap pitcher as one quiet line
  // linking into Insights. Lineups-gated; fail-silent (Overview never blocks on analytics).
  useEffect(() => {
    if (loading || isClosedTeam) return;
    const a = assignments.find(x => x.teamId === teamId);
    if (!a || !a.capabilities.lineups) return; // never fetched ⇒ flag stays null
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-analytics`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled) return;
        const over = (json?.analytics?.armCare ?? []).find((r: { overCapGames: number }) => r.overCapGames > 0);
        setArmCareFlag(over ? { name: over.name, overCapGames: over.overCapGames } : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, isClosedTeam, orgSlug, teamId, assignments]);

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

  const assignment = assignments.find(a => a.teamId === teamId);

  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
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
  // Roster visibility gates both the roster fetch and every roster-derived tile — the same rule
  // the sidebar uses to hide the Roster item.
  const canViewRoster = assignment.capabilities.roster !== 'off';
  const helpHref = `/${orgSlug}/coaches/help`;
  // The season label drops a leading copy of the team name so the subtitle doesn't repeat the
  // title — orgs often name a program year "<Team> <Year>" (e.g. "Blue Jays 2026").
  const teamNameTrim = assignment.teamName?.trim() ?? '';
  const yearNameTrim = assignment.programYearName?.trim() ?? '';
  // Only strip when the team name is a WHOLE-WORD prefix (next char is a separator or the end),
  // so a team like "Jay" doesn't mangle a season "Jays 2026" into "s 2026".
  const afterTeam = teamNameTrim && yearNameTrim.toLowerCase().startsWith(teamNameTrim.toLowerCase())
    ? yearNameTrim.slice(teamNameTrim.length)
    : null;
  const seasonLabel = afterTeam !== null && (afterTeam === '' || /^[\s\-–—]/.test(afterTeam))
    ? (afterTeam.replace(/^[\s\-–—]+/, '').trim() || yearNameTrim)
    : yearNameTrim;
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
      desc: 'Announcements email every guardian on your roster at once — the season dates, the first practice, a rain-out.',
      action: 'Write one',
      href: `${base}/announcements`,
      complete: milestones?.hasSentAnnouncement === true,
      group: 'optional',
      visible: assignment.capabilities.announcementsSend,
      help: { title: 'Announcements', body: 'A one-way email to every guardian on your active roster. Different from Chat, which talks to tournament organizers and other coaches. Drafts stay private until you send.' },
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

  // Snapshot ("Your team at a glance") cards — real data, link into each section.
  // While the first load is in flight, show a neutral "…" rather than flashing a
  // misleading "Nothing scheduled" / "—" before the data arrives.
  //
  // Each card declares its own `visible` predicate for the same reason the setup steps do: a tile
  // whose source data this coach isn't allowed to fetch must HIDE, never render a confident zero.
  // "0 active players" to an assistant whose head coach hid the roster is worse than no tile — it
  // isn't a permission message, it's a wrong answer.
  const snapshotCards = [
    {
      key: 'roster',
      label: 'Roster',
      icon: Users,
      value: setupLoading ? '…' : String(setupStats?.activeRosterCount ?? 0),
      sub: 'active players',
      href: `${base}/roster`,
      visible: canViewRoster,
      tone: 'default' as const,
      flag: (!setupLoading && missingEmailCount > 0)
        ? { text: `${missingEmailCount} missing email`, tone: 'warn' as 'ok' | 'warn' }
        : null,
      headcount: null as { in: number; late: number; out: number; noReply: number } | null,
      // Jersey + position readiness across the active roster.
      progress: (!setupLoading && setupStats && setupStats.activeRosterCount > 0)
        ? {
            value: setupStats.positionedRosterCount,
            total: setupStats.activeRosterCount,
            label: `${setupStats.positionedRosterCount}/${setupStats.activeRosterCount}`,
            title: `${setupStats.positionedRosterCount} of ${setupStats.activeRosterCount} players have a jersey number and position`,
            tone: 'default' as 'default' | 'danger',
          }
        : null,
    },
    {
      key: 'schedule',
      label: 'Next up',
      icon: Calendar,
      value: setupLoading ? '…' : nextEvent ? formatEventDate(nextEvent.startsAt) : 'Nothing scheduled',
      sub: nextEvent ? (nextEvent.opponent ? `vs ${nextEvent.opponent}` : (nextEvent.name || 'Upcoming event')) : 'Add an event',
      href: `${base}/schedule`,
      visible: canSchedule,
      tone: 'default' as const,
      flag: (nextEvent && GAME_EVENT_TYPES.includes(nextEvent.eventType) && nextLineupReady !== null)
        ? (nextLineupReady
            ? { text: 'Lineup ready', tone: 'ok' as 'ok' | 'warn' }
            : { text: 'Lineup not set', tone: 'warn' as 'ok' | 'warn' })
        : null,
      headcount: nextAttendance,
      progress: null,
    },
    {
      key: 'dues',
      label: 'Dues',
      icon: DollarSign,
      value: setupLoading ? '…' : duesOutstanding == null ? '—' : duesOutstanding > 0 ? formatMoney(duesOutstanding) : 'All paid',
      sub: duesOutstanding == null
        ? 'Set up dues'
        : duesOverdueCount > 0
          ? `${duesOverdueCount} overdue`
          : duesOutstanding > 0 ? 'outstanding' : 'nothing owed',
      href: `${base}/accounting`,
      visible: canViewMoney,
      tone: (duesOverdueCount > 0 ? 'danger' : 'default') as 'default' | 'danger',
      // "N unpaid" = players who've paid nothing at all — the coach's real "who do I chase"
      // question, surfaced on the tile (separate from the overdue count in the sub line).
      flag: (!setupLoading && duesUnpaidCount > 0)
        ? { text: `${duesUnpaidCount} unpaid`, tone: 'warn' as 'ok' | 'warn' }
        : null,
      headcount: null as { in: number; late: number; out: number; noReply: number } | null,
      // Paid vs total installments collected this season.
      progress: (!setupLoading && duesProgress)
        ? {
            value: duesProgress.paid,
            total: duesProgress.total,
            label: `${duesProgress.paid}/${duesProgress.total} paid`,
            title: `${duesProgress.paid} of ${duesProgress.total} dues installments paid`,
            tone: (duesOverdueCount > 0 ? 'danger' : 'default') as 'default' | 'danger',
          }
        : null,
    },
    {
      key: 'budget',
      label: 'Budget',
      icon: Wallet,
      value: setupLoading ? '…'
        : (!budget || budget.amount == null) ? 'No budget'
          : formatMoney(budget.amount - budget.spent),
      sub: (!budget || budget.amount == null)
        ? 'Set a budget'
        : `${formatMoney(budget.spent)} of ${formatMoney(budget.amount)} spent`,
      href: `${base}/accounting/budget-vs-actual`,
      visible: canViewMoney,
      tone: (budget && budget.amount != null && budget.spent > budget.amount ? 'danger' : 'default') as 'default' | 'danger',
      flag: null as { text: string; tone: 'ok' | 'warn' } | null,
      headcount: null as { in: number; late: number; out: number; noReply: number } | null,
      // Spent vs budgeted this season.
      progress: (!setupLoading && budget && budget.amount != null && budget.amount > 0)
        ? {
            value: Math.min(budget.spent, budget.amount),
            total: budget.amount,
            label: `${Math.round((budget.spent / budget.amount) * 100)}%`,
            title: `${formatMoney(budget.spent)} spent of ${formatMoney(budget.amount)} budget`,
            tone: (budget.spent > budget.amount ? 'danger' : 'default') as 'default' | 'danger',
          }
        : null,
    },
    {
      key: 'tournaments',
      label: 'Tournaments',
      icon: Trophy,
      value: tournaments == null ? '…'
        : tournaments.liveNow ? 'Live now'
          : tournaments.nextDate ? formatEventDate(`${tournaments.nextDate}T00:00:00`)
            : tournaments.count > 0 ? 'None upcoming'
              : 'None yet',
      sub: tournaments && tournaments.count > 0
        ? `${tournaments.count} registered${tournaments.pending > 0 ? ` · ${tournaments.pending} pending` : ''}`
        : 'Register for a tournament',
      href: `${base}/tournaments`,
      visible: true,
      tone: 'default' as const,
      // Tournament fees owed are a money figure — gate on money view (the tournaments tile itself
      // isn't in the dues/budget money filter, so this flag needs its own guard).
      flag: (canViewMoney && tournaments && tournaments.owingCount > 0)
        ? { text: `${formatMoney(tournaments.owed)} in fees due · ${tournaments.owingCount} to pay`, tone: 'warn' as 'ok' | 'warn' }
        : null,
      headcount: null as { in: number; late: number; out: number; noReply: number } | null,
      progress: null,
    },
  ];

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
  const resultWord = (r?: string | null) => (r === 'win' ? 'Win' : r === 'loss' ? 'Loss' : r === 'tie' ? 'Tie' : '');

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
  // Chips route through the SAME visibility rule as the sidebar, so a coach can never be pointed
  // at a section their capabilities hide. Tryouts additionally waits for the conditional nav signal
  // rather than advertising a seasonal area a team hasn't opened.
  const discoverySections = DISCOVERY_SECTIONS.filter(section =>
    isCoachNavItemVisible(assignment.capabilities, section.label)
    && (section.needs !== 'tryouts' || assignment.hasTryoutSignal),
  );

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
  const showSetupLine = setupDecided && !hintsOff && !essentialsDone && !!nextSetupItem;
  // One branch, not four: while the roster is missing the line speaks in the roster guidance's
  // voice, after that it speaks for the next open step. Splitting this across four inline ternaries
  // let the headline/body pair and the CTA pair guard on subtly different conditions.
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
  // Every "Right now" anchor variant (game day, next event, in-season lull, the winding-down cue)
  // is schedule-derived. A coach without schedule access has no event data, so those cards would
  // confidently announce "Nothing on your schedule" to someone simply not permitted to see it.
  const showAnchor = !setupLoading && requiredDone && canSchedule;
  // The preseason anchor says the same sentence as the next-action line — never both, and never
  // one then the other. `showAnchor` clears as soon as the roster/events read lands, but
  // `showSetupLine` additionally waits on the separate milestones read; without `setupDecided`
  // here, a returning coach in preseason saw the anchor card render and then get swapped out for
  // the line milliseconds later. Waiting for both reads costs a beat of blank space instead.
  const showPreseasonAnchor = setupDecided && showAnchor && phase === 'preseason' && !showSetupLine;

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
          <div className={styles.setupPop} role="group" aria-label="Season setup">
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

            {/* The sections with no honest "done" state still get named, so a coach can't finish
                setup without learning they exist. Phase B replaces these with real teaching at
                each section's own empty state. */}
            {discoverySections.length > 0 && (
              <div className={styles.discoverRow}>
                <p className={styles.discoverLabel}>Also in your portal</p>
                <div className={styles.discoverChips}>
                  {discoverySections.map(section => (
                    <Link key={section.key} href={`${base}${section.href}`} className={styles.discoverChip} title={section.title}>
                      {section.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.setupPopFoot}>
              <button type="button" className={styles.setupGuideLink} onClick={openPortalTour}>
                Take the 2-minute portal tour →
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
  const showSeasonCue = showAnchor
    && phase === 'in_season'
    && !nextEvent
    && hasRealFinalizedGame
    && !hasUpcomingTournament
    && daysSinceLastEvent != null
    && daysSinceLastEvent >= 14
    && !seasonCueDismissed;
  // Which variant: the coach who can actually close the season gets the door; everyone else
  // gets the honest expectation (club seasons are closed by the org admin).
  const cueCanClose = seasonMeta.canManageSeasons;

  const attendanceTotal = nextAttendance ? nextAttendance.in + nextAttendance.late + nextAttendance.out + nextAttendance.noReply : 0;
  const fieldOrLoc = nextEvent ? (nextEvent.fieldNumber || nextEvent.location || null) : null;
  const nextTimeLabel = nextEvent ? new Date(nextEvent.startsAt).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }) : null;

  // Phase-ordered tiles (most time-sensitive first for that phase).
  const TILE_ORDER: Record<string, string[]> = {
    preseason: ['roster', 'schedule', 'dues', 'budget', 'tournaments'],
    in_season: ['dues', 'roster', 'budget', 'tournaments', 'schedule'],
    game_day: ['dues', 'roster', 'budget', 'tournaments', 'schedule'],
    result: ['tournaments', 'dues', 'roster', 'budget', 'schedule'],
  };
  const tileOrder = TILE_ORDER[phase] ?? TILE_ORDER.in_season;
  const orderedCards = [...snapshotCards].sort((a, b) => tileOrder.indexOf(a.key) - tileOrder.indexOf(b.key));

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

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 className={styles.pageTitle}>{assignment.teamName}</h1>
              {isTeamWorkspace && <span className={styles.titlePremiumBadge}>Premium</span>}
              {/* Status badge only when it's NOT the everyday "active" case — an active team
                  needs no label; draft/completed/archived seasons get one so it's noticed. */}
              {assignment.programYearStatus !== 'active' && (
                <span className={`${styles.badge} ${STATUS_CSS[assignment.programYearStatus] ?? styles.badgeDraft}`}>
                  {STATUS_LABEL[assignment.programYearStatus] ?? assignment.programYearStatus}
                </span>
              )}
              {teamDivision && (
                <span className={`${styles.badge} ${styles.badgeManual}`}>{teamDivision}</span>
              )}
            </div>
            <p className={styles.pageSub}>
              {seasonLabel} -{' '}
              {assignment.coachRole === 'head_coach' ? 'Head Coach' : 'Assistant Coach'}
            </p>
          </div>
        </div>
        <div className={styles.identityHelp}>
          {renderSetupChip()}
          <HelpButton
            iconOnly
            label="Premium Coaches Portal"
            help={{ module: 'coaches', sectionIds: ['premium-portal-tour', 'premium'], fullGuideHref: `${helpHref}#premium-portal-tour` }}
          />
        </div>
      </div>

      {/* A failed dashboard read has to say so ON the page. Moving setup into the popover left this
          message behind a click — and for a coach whose chip is hidden, behind nothing at all. The
          tiles below would then quietly show zeros for data that simply failed to load. */}
      {!setupLoading && setupError && (
        <p className={styles.loadErrorLine} role="status">
          <TriangleAlert size={15} aria-hidden /> {setupError} — some figures below may be
          incomplete. <button type="button" className={styles.loadErrorRetry} onClick={() => void loadSetup()}>Try again</button>
        </p>
      )}

      {/* One line, not a panel. Names the single next action, offers the tour once, and its ✕
          ends all setup prompting for this coach on every team they hold. */}
      {showSetupLine && setupLine && (
        <div className={styles.setupLine}>
          <span className={styles.setupLineBody}>
            <span className={styles.setupLineHead}>{setupLine.head}</span>
            <span className={styles.setupLineDesc}>{setupLine.desc}</span>
          </span>
          <span className={styles.setupLineActions}>
            <Link href={setupLine.href} className="btn btn-lime btn-sm">
              {setupLine.label} <ArrowRight size={14} />
            </Link>
            {!tourSeen && (
              <button type="button" className={styles.setupLineTour} onClick={openPortalTour}>
                New here? Take the 2-minute tour
              </button>
            )}
          </span>
          <button type="button" className={styles.setupLineDismiss} onClick={turnOffHints} aria-label="Turn off setup hints">
            <X size={15} aria-hidden />
          </button>
        </div>
      )}

      {/* ── "Right now" anchor — the phase-adaptive "what matters now" surface.
          Ports the TeamHQ phase LOGIC into the operating-tool card language (no hero). */}
      {showAnchor && phase === 'game_day' && nextEvent && (
        <div className={`${styles.nowCard} ${styles.nowGameDay}`}>
          <p className={styles.nowEyebrow}><span className={styles.nowLiveDot} aria-hidden>●</span> Game day <span className={styles.nowEyebrowCount}>Today</span></p>
          <p className={styles.nowHeadline}>{nextEvent.opponent ? `vs ${nextEvent.opponent}` : (nextEvent.name || 'Game day')}</p>
          {(nextTimeLabel || fieldOrLoc) && <p className={styles.nowMeta}>{[nextTimeLabel, fieldOrLoc].filter(Boolean).join(' · ')}</p>}
          {nextEvent.teamScore != null && nextEvent.opponentScore != null && (
            <p className={styles.nowScoreline}>{nextEvent.teamScore} – {nextEvent.opponentScore}{nextEvent.result ? <span className={styles.nowScoreResult}> · {resultWord(nextEvent.result)}</span> : null}</p>
          )}
          {(nextAttendance || nextLineupReady !== null) && (
            <>
              <div className={styles.nowDivider} />
              <div className={styles.nowStatsRow}>
                {nextAttendance && <span><span className={styles.nowStatIn}>{nextAttendance.in}</span> of {attendanceTotal} in</span>}
                {nextLineupReady === true && <span className={styles.nowStatOk}><CheckCircle2 size={14} aria-hidden /> Lineup ready</span>}
                {nextLineupReady === false && <span className={styles.nowStatWarn}><TriangleAlert size={14} aria-hidden /> Lineup not set</span>}
              </div>
            </>
          )}
          <div className={styles.nowActions}>
            <Link href={`${base}/schedule`} className="btn btn-lime btn-sm">Open game day <ArrowRight size={14} /></Link>
          </div>
        </div>
      )}

      {showAnchor && phase === 'in_season' && nextEvent && (
        <div className={`${styles.nowCard} ${styles.nowInSeason}`}>
          <p className={styles.nowEyebrow}>Next {nextIsGame ? 'game' : 'event'}
            {nextEventDays != null && <span className={styles.nowEyebrowCount}>{nextEventDays === 0 ? 'Today' : nextEventDays === 1 ? 'Tomorrow' : `in ${nextEventDays} days`}</span>}
          </p>
          <p className={styles.nowHeadline}>{formatEventDate(nextEvent.startsAt)}{nextTimeLabel ? ` · ${nextTimeLabel}` : ''}</p>
          <p className={styles.nowMeta}>{nextEvent.opponent ? `vs ${nextEvent.opponent}` : (nextEvent.name || 'Upcoming event')}{fieldOrLoc ? ` · ${fieldOrLoc}` : ''}</p>
          {nextIsGame && (
            <>
              <div className={styles.nowDivider} />
              <div className={styles.nowStatsRow}>
                {nextAttendance
                  ? <span><span className={styles.nowStatIn}>{nextAttendance.in}</span> of {attendanceTotal} in</span>
                  : <span className={styles.nowStatMuted}>Attendance not taken</span>}
                {nextLineupReady === true && <span className={styles.nowStatOk}><CheckCircle2 size={14} aria-hidden /> Lineup ready</span>}
                {nextLineupReady === false && <span className={styles.nowStatWarn}><TriangleAlert size={14} aria-hidden /> Lineup not set</span>}
              </div>
            </>
          )}
          {canViewMoney && duesOverdueCount > 0 && (
            <p className={styles.nowMoneyAlert}><DollarSign size={14} aria-hidden /> {duesOverdueCount} {duesOverdueCount === 1 ? 'player' : 'players'} overdue{duesOutstanding && duesOutstanding > 0 ? ` · ${formatMoney(duesOutstanding)}` : ''}</p>
          )}
          <div className={styles.nowActions}>
            <Link href={nextIsGame && canViewLineup ? `${base}/lineups/${nextEvent.id}` : `${base}/schedule`} className="btn btn-lime btn-sm">{nextIsGame ? 'Build lineup' : 'Open schedule'} <ArrowRight size={14} /></Link>
            {nextIsGame && <Link href={canSchedule ? `${base}/schedule?event=${nextEvent.id}&tab=attendance` : `${base}/schedule`} className={styles.nowSecondary}>Take attendance <ArrowRight size={13} /></Link>}
          </div>
        </div>
      )}

      {/* In season, but nothing on the game schedule — a lull or a tournament-only stretch.
          NOT the afterglow (which needs an explicitly-closed season). */}
      {showAnchor && phase === 'in_season' && !nextEvent && (
        <div className={`${styles.nowCard} ${styles.nowInSeason}`}>
          {hasUpcomingTournament && tournaments?.nextDate ? (
            <>
              <p className={styles.nowEyebrow}><Trophy size={13} aria-hidden /> Next up
                <span className={styles.nowEyebrowCount}>{tournaments.liveNow ? 'Live now' : formatEventDate(`${tournaments.nextDate}T00:00:00`)}</span>
              </p>
              <p className={styles.nowHeadline}>{tournaments.liveNow ? 'Your tournament is on' : 'Tournament coming up'}</p>
              <p className={styles.nowMeta}>Add your games and practices to your schedule to plan around it.</p>
            </>
          ) : (
            <>
              <p className={styles.nowEyebrow}>In season</p>
              <p className={styles.nowHeadline}>Nothing on your schedule</p>
              <p className={styles.nowMeta}>Add your next game or practice to track attendance, lineups, and your record.</p>
            </>
          )}
          {canViewMoney && duesOverdueCount > 0 && (
            <p className={styles.nowMoneyAlert}><DollarSign size={14} aria-hidden /> {duesOverdueCount} {duesOverdueCount === 1 ? 'player' : 'players'} overdue{duesOutstanding && duesOutstanding > 0 ? ` · ${formatMoney(duesOutstanding)}` : ''}</p>
          )}
          <div className={styles.nowActions}>
            <Link href={`${base}/schedule`} className="btn btn-lime btn-sm">Add an event <ArrowRight size={14} /></Link>
            {hasUpcomingTournament && <Link href={`${base}/tournaments`} className={styles.nowSecondary}>View tournaments <ArrowRight size={13} /></Link>}
          </div>
        </div>
      )}

      {/* Winding-down cue (f5-1) — one quiet, dismissible card; never a modal or toast. */}
      {showSeasonCue && (
        <div className={styles.seasonCue} role="status">
          <p className={styles.seasonCueEyebrow}>Season check</p>
          {cueCanClose ? (
            <>
              <p className={styles.seasonCueBody}>
                No games in {daysSinceLastEvent === null ? 'a while' : `${Math.floor((daysSinceLastEvent ?? 0) / 7)} weeks`} and
                nothing scheduled — looks like the season may be winding down. Closing it out
                unlocks your <strong>Season Wrapped</strong>.
              </p>
              <div className={styles.seasonCueActions}>
                <button type="button" className="btn btn-lime btn-sm" onClick={() => setRolloverOpen(true)}>
                  Close out the season
                </button>
                <button type="button" className={styles.seasonCueDismiss} onClick={dismissSeasonCue}>Not yet</button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.seasonCueBody}>
                No games in {daysSinceLastEvent === null ? 'a while' : `${Math.floor((daysSinceLastEvent ?? 0) / 7)} weeks`} and
                nothing scheduled — the season may be winding down. When {currentOrg?.name ?? 'your club'} closes
                it, your <strong>Season Wrapped</strong> appears here.
              </p>
              <div className={styles.seasonCueActions}>
                <button type="button" className={styles.seasonCueDismiss} onClick={dismissSeasonCue}>Got it</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* The old `result`-phase afterglow card was removed in Batch 3: it was unreachable
          (assignments are draft|active-filtered, so `phase` can never be 'result' here) and
          its job now belongs to the Season's End page this page redirects closed teams to. */}

      {showPreseasonAnchor && (
        <div className={`${styles.nowCard} ${styles.nowPreseason}`}>
          {/* No progress count here any more — the header chip is the single place setup progress
              is reported, so the two can't disagree. */}
          <p className={styles.nowEyebrow}>Your roster&apos;s ready</p>
          <p className={styles.nowHeadline}>{nextSetupItem ? nextSetupItem.label : 'Add your first game'}</p>
          <p className={styles.nowMeta}>{nextSetupItem ? nextSetupItem.desc : 'Put a game or practice on the schedule to start tracking attendance, lineups, and your season record.'}</p>
          <div className={styles.nowActions}>
            <Link href={nextSetupItem ? nextSetupItem.href : `${base}/schedule`} className="btn btn-lime btn-sm">{nextSetupItem ? nextSetupItem.action : 'Add an event'} <ArrowRight size={14} /></Link>
          </div>
        </div>
      )}

      {/* P3 rev-5 (owner call): the compact "your tournament" block — an event card naming the
          live/upcoming public event + its ⇄ Fan view door. No alerts/follow affordance here —
          the public side already carries those; the portal doesn't push follow at the coach.
          Self-contained context: the phase anchor above isn't always about the tournament. */}
      {overviewFanView && (
        <div style={{ marginBottom: '1.25rem' }}>
          <CoachLiveEventCard event={overviewFanView} />
        </div>
      )}

      {/* Season record — moved UP to sit under the anchor (was stranded at page bottom).
          Self-hides until a finalized game exists (pre-season shows nothing). Schedule-gated:
          without event access the games list is empty, which would read as "no record" rather
          than "not yours to see". */}
      {canSchedule && <SeasonRecordWidget events={seasonGames} teamId={teamId} insightsHref={`${base}/history`} />}

      {/* Safety-tier bridge from Insights — the only finding category that crosses over (CP-1
          safe: a quiet blueprint link, never lime). */}
      {armCareFlag && (
        <p className={styles.insightsBridge}>
          <span className={styles.insightsBridgeIcon} aria-hidden>⚠</span>
          Worth a look: {armCareFlag.name} went over the pitching cap in {armCareFlag.overCapGames} game{armCareFlag.overCapGames === 1 ? '' : 's'}.{' '}
          <Link href={`${base}/history/playing-time`}>Season insights →</Link>
        </p>
      )}

      {/* Your team at a glance — run-mode snapshot of real data (replaces the old
          quick-links grid, which just duplicated the sidebar). */}
      <section aria-labelledby="snapshot-title">
        <p className={styles.sectionKicker} id="snapshot-title">Your team at a glance</p>
        <div className={styles.snapshotGrid}>
          {orderedCards.filter(card => card.visible).map(card => {
            const Icon = card.icon;
            return (
              <Link
                key={card.key}
                href={card.href}
                className={styles.snapshotCard}
              >
                <span className={styles.snapshotHead}>
                  <span className={styles.snapshotHeadLabel}><Icon size={14} aria-hidden /> {card.label}</span>
                  <ArrowRight size={13} className={styles.snapshotHeadArrow} aria-hidden />
                </span>
                <span className={styles.snapshotValue} data-tone={card.tone}>{card.value}</span>
                <span className={styles.snapshotSub}>{card.sub}</span>
                {card.progress && (
                  <span className={styles.snapshotBar} title={card.progress.title}>
                    <span className={styles.snapshotBarTrack}>
                      <span
                        className={styles.snapshotBarFill}
                        data-tone={card.progress.tone}
                        style={{ width: `${card.progress.total > 0 ? Math.round((card.progress.value / card.progress.total) * 100) : 0}%` }}
                      />
                    </span>
                    <span className={styles.snapshotBarPct}>{card.progress.label}</span>
                  </span>
                )}
                {card.flag && (
                  <span className={styles.snapshotFlag} data-tone={card.flag.tone}>{card.flag.text}</span>
                )}
                {card.headcount && (
                  <span className={styles.snapshotHeadcount} aria-label="Attendance for the next event">
                    <span data-s="in">{card.headcount.in} in</span>
                    {card.headcount.late > 0 && <span data-s="late">{card.headcount.late} late</span>}
                    <span data-s="out">{card.headcount.out} out</span>
                    {card.headcount.noReply > 0 && <span data-s="noreply">{card.headcount.noReply} no&nbsp;reply</span>}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Last season — a small proactive handle on resonant history (money-gated), links into
          Past Seasons. Only renders once a completed/archived season exists. */}
      {lastSeason && (
        <Link href={`${base}/history`} className={styles.lastSeasonCard}>
          <Archive size={20} className={styles.lastSeasonIcon} aria-hidden />
          <span className={styles.lastSeasonBody}>
            <span className={styles.lastSeasonLabel}>Last season</span>
            <span className={styles.lastSeasonName}>{lastSeason.name}</span>
            <span className={styles.lastSeasonStats}>
              {lastSeason.record && <span><strong>{lastSeason.record}</strong> record</span>}
              <span><strong>{formatMoney(lastSeason.duesCollected)}</strong> collected</span>
              <span><strong>{formatMoney(lastSeason.totalExpenses)}</strong> spent</span>
            </span>
          </span>
          <ArrowRight size={16} className={styles.lastSeasonArrow} aria-hidden />
        </Link>
      )}

      {/* This week — events in the next 7 days + any player birthdays. */}
      {((weekSummary && weekSummary.total > 0) || birthdays.length > 0) && (
        <div className={styles.weekStrip}>
          {weekSummary && weekSummary.total > 0 && (
            <span className={styles.weekItem}>
              <Calendar size={13} aria-hidden /> This week:{' '}
              {[
                weekSummary.games > 0 ? `${weekSummary.games} game${weekSummary.games === 1 ? '' : 's'}` : null,
                weekSummary.practices > 0 ? `${weekSummary.practices} practice${weekSummary.practices === 1 ? '' : 's'}` : null,
                weekSummary.other > 0 ? `${weekSummary.other} other` : null,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
          {birthdays.length > 0 && (
            <span className={styles.weekItem}>
              <Cake size={13} aria-hidden />{' '}
              {birthdays.length === 1
                ? `${birthdays[0].name}’s birthday${birthdays[0].inDays === 0 ? ' today' : birthdays[0].inDays === 1 ? ' tomorrow' : ''}`
                : `${birthdays.length} birthdays this week`}
            </span>
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
    </div>
  );
}
