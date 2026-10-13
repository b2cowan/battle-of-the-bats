'use client';
/**
 * THE TOURNAMENT'S BOARD — one page, four boards, by where the event is (Tournament admin redesign, Stages 1, 4 and 5):
 *
 *   a Draft                        DraftBoard        (Stage 5, E2: one checklist, every row a door, Ready to activate)
 *   Active, before its game day    WeeksBeforeBoard  (Stage 5, E2: one note, five kit cards, every row a door)
 *   Active, its game day           GameDayBoard      (Stage 1, G2 · G3 · G8: four lists in the order of the day)
 *   Completed                      FinishedBoard     (Stage 4, D1: How it finished · Next year · Summary)
 *
 * Each board has its "?" in the title band (A56), opening its own help sub-topic. The page reads the board's figures
 * (app/api/admin/tournament-dashboard), refreshes them every 30 s while the tab is visible, and keeps the organizer's
 * Customize choices (the weeks-before cards' order and the game-day parts) in their browser.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, CheckCircle2, RotateCcw, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTournament } from '@/lib/tournament-context';
import { useVisiblePoll } from '@/lib/hooks/useVisiblePoll';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature } from '@/lib/plan-features';
import type { RegistrationAttentionSummary } from '@/lib/registration-attention';
import { LiveEventLog } from '@/components/admin/LiveEventLog';
import GuidanceRail from '@/components/admin/tournament/GuidanceRail';
import { daysUntilStart, getGuidance } from '@/lib/tournament-guidance';
import styles from './dashboard.module.css';
import { hasPlayoffs, isGameDay as isGameDayRule, isReadyToFinalize } from '@/lib/tournament-phase';
import { tournamentToday } from '@/lib/timezone';
import { EmptyCard } from '@/components/admin/kit/club/RepKit';
import CoinTossRecorder, { CoinTossNote } from '@/components/admin/CoinTossRecorder';
import type { PendingToss } from '@/lib/coin-toss';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import type { EventRecap } from '@/lib/event-recap';
import FinishedBoard from './FinishedBoard';
import DraftBoard, { type DraftChecklist } from './DraftBoard';
import WeeksBeforeBoard, { type PanelConfig, type PanelId } from './WeeksBeforeBoard';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { statusConfirm } from '@/lib/tournament-status-words';
import { hasFiniteSlots, holdsSlot } from '@/lib/tournament-slot';
import { useSetupWizard } from '@/components/admin/tournament/SetupWizardOpener';
import { DRAFT_BOARD_WORDS, type BoardFees, type DraftSetup } from '@/lib/tournament-board-words';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import GameDayBoard, {
  BoardNote, CustomizeLink, EMPTY_GAME_DAY, GAME_DAY_PARTS, type GameDayPartId, type GameDayStats,
} from './GameDayBoard';
import LoadingState from '@/components/shared/LoadingState';

// ── Each board's "?" (A56): its own help sub-topic ─────────────────────────────────────────────────────────────
const DRAFT_BOARD_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['recipe-open-tournament-registration'], subtopicId: 'launch-draft-board' };
const WEEKS_BEFORE_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['recipe-open-tournament-registration'], subtopicId: 'launch-weeks-before' };
const GAME_DAY_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['recipe-finalize-tournament-scores'], subtopicId: 'results-game-day-board' };
/** A finished board's "?" — the close-out guide (the help drawer lists the stage's tasks above it). */
const FINISHED_BOARD_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['recipe-closeout-tournament'], subtopicId: 'closeout-finished-board' };

// ── Domain types ────────────────────────────────────────────────────────────

type DivisionStat = { id: string; name: string; capacity: number | null; accepted: number; pending: number; waitlist: number };

type CommunicationsStats = { total: number; emailsSent: number; totalRecipients: number; latestTitle: string | null; latestDate: string | null };

type PaymentCounts = { paid: number; depositPaid: number; pending: number; pastDue: number; noSchedule: number };

type ScheduleHealthDashboardStats = {
  score: number;
  tone: 'good' | 'warning' | 'danger';
  issueCount: number;
  topIssue: string | null;
  totalGames: number;
  timedGames: number;
  participantCount: number;
  backToBack: number;
  maxGamesInDay: number;
  maxGamesPerDay: number;
  venueChanges: number;
  facilityChanges: number;
  conflicts: number;
  travelBufferWarnings: number;
  unresolvedFacilities: number;
  minGamesPerParticipant: number;
  maxGamesPerParticipant: number;
  averageGamesPerParticipant: number;
};

type DivisionChampion = { divisionId: string; divisionName: string; championTeamName: string };

type ChatAdoptionStats = {
  /** whether the host org's plan includes Tournament Chat (Tournament Plus+) */
  eligible: boolean;
  /** whether the organizer has opened chat (the "All coaches" room exists) */
  roomOpen: boolean;
  teamsTotal: number;
  teamsWithEmail: number;
  /** teams whose coach has a completed portal login (chat prerequisite) */
  coachesSignedUp: number;
  /** teams with no signed-up coach yet */
  notJoined: number;
  /** of notJoined, how many have a contact email we can remind */
  notJoinedRemindable: number;
  /** coaches (not org moderators) currently in the All-coaches room */
  inChat: number;
  /** upgrade copy when !eligible, else null */
  upsellCopy: string | null;
  /** ISO stamp of the last reminder batch; null = never sent (S1-A/S1-B, owner 2026-07-29) */
  reminderLastSentAt: string | null;
  /** CH-1 — event has finished; the room stays readable but no longer chases sign-ups */
  reminderRetired: boolean;
};

type PublishChecklist = DraftChecklist & { hasOpenDivision: boolean; hasFees: boolean };

type DashboardStats = {
  divisions: number;
  teams: number;
  scheduled: number;
  totalGames: number;
  completed: number;
  communications: CommunicationsStats;
  chatAdoption: ChatAdoptionStats | null;
  scheduleHealth: ScheduleHealthDashboardStats;
  isTournamentDay: boolean;
  isGameDay: boolean;
  gameDay: GameDayStats;
  champions: DivisionChampion[];
  /** A finished event's "How it finished" and the event in numbers (lib/event-recap — the same read as Summary). */
  recap: EventRecap | null;
  /** Whether marking complete will email a results summary to team contacts (mirrors the confirm copy). */
  notifyTeamsOnComplete: boolean;
  /** Coin tosses still owed (lib/coin-toss — the Bracket view's and Results' one reading). */
  coinTossNeeded: PendingToss[];
  publishChecklist: PublishChecklist;
  /** How the fees are set up (both boards before the event say it). */
  fees: BoardFees;
  /** A draft's setup, as its board's rows say it (null for any other status). */
  setup: DraftSetup | null;
  publicPageCount: number;
  registration: {
    totalCapacity: number;
    totalAccepted: number;
    totalPending: number;
    totalWaitlist: number;
    byDivision: DivisionStat[];
    velocity: number;
    weeklyTrend: number[];
  };
  checkIn: { accepted: number; checkedIn: number; noShow: number };
  payment: {
    hasFeeSchedule: boolean;
    totalExpected: number;
    totalCollected: number;
    counts: PaymentCounts;
  };
  registrationAttention: RegistrationAttentionSummary;
};

// ── Layout customization ─────────────────────────────────────────────────────

/** The weeks-before cards' names — said here, never stored (a saved layout from before Stage 5 carries the old ones). */
const PANEL_LABELS: Record<PanelId, string> = {
  registration: 'Registration',
  payment: 'Payments',
  tournamentChat: 'Coaches',
  communications: 'Messages',
  scheduleHealth: 'Schedule',
};

// The game-day board's panels BEFORE Stage 1 (v1–v3 layouts): read only to carry an organizer's
// hide choices onto the new board's parts (below).
type LegacyGameDayPanelId = 'nowPlaying' | 'upNext' | 'needsScore' | 'gamesProgress' | 'checkIn' | 'gdScheduleHealth' | 'byDivision';

/** The game-day board's parts: shown or hidden only — the order is the day's (owner 2026-09-29). */
type GameDayPartConfig = { id: GameDayPartId; visible: boolean };

/** v4 also held the stat cards, which nothing has drawn since Stage 1; a saved copy of them is ignored. */
type DashboardLayout = {
  version: 4;
  panels: PanelConfig[];
  gameDayParts: GameDayPartConfig[];
};

const DEFAULT_GAME_DAY_PARTS: GameDayPartConfig[] = GAME_DAY_PARTS.map(p => ({ id: p.id, visible: true }));

/**
 * A v1–v3 layout's game-day panels → the Stage 1 board's parts, keeping what an organizer hid: the
 * three lists and health by their own ids; To finalize (which came OUT of Now playing) with Now
 * playing; the summary card (which replaced Games progress, Team check-in and By division) unless
 * all three were hidden. The rain-delay door is new, so it shows.
 */
function gameDayPartsFromLegacy(saved: Array<{ id: LegacyGameDayPanelId; visible: boolean }> | undefined): GameDayPartConfig[] {
  const shown = (id: LegacyGameDayPanelId) => (saved ?? []).find(p => p.id === id)?.visible ?? true;
  const legacy: Partial<Record<GameDayPartId, boolean>> = {
    toFinalize: shown('nowPlaying'),
    needsScore: shown('needsScore'),
    playingNow: shown('nowPlaying'),
    upNext: shown('upNext'),
    summary: shown('gamesProgress') || shown('checkIn') || shown('byDivision'),
    gdScheduleHealth: shown('gdScheduleHealth'),
  };
  return DEFAULT_GAME_DAY_PARTS.map(p => ({ id: p.id, visible: legacy[p.id] ?? true }));
}

// The drawing's order (Stage 5): Registration, Payments, Coaches, Messages, Schedule.
const DEFAULT_LAYOUT: DashboardLayout = {
  version: 4,
  panels: (['registration', 'payment', 'tournamentChat', 'communications', 'scheduleHealth'] as PanelId[])
    .map((id, order) => ({ id, label: PANEL_LABELS[id], visible: true, order })),
  gameDayParts: DEFAULT_GAME_DAY_PARTS,
};

function layoutKey(orgSlug: string) { return `fl_dash_v1_${orgSlug}`; }

function loadLayout(orgSlug: string): DashboardLayout {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(layoutKey(orgSlug));
    if (!raw) return DEFAULT_LAYOUT;
    const p = JSON.parse(raw) as {
      version?: number;
      panels?: PanelConfig[];
      gameDayPanels?: Array<{ id: LegacyGameDayPanelId; visible: boolean }>;
      gameDayParts?: GameDayPartConfig[];
    };
    // Accept v1–v4 — default-merge fills any missing set, so an older saved layout gains new
    // cards/panels without being discarded.
    const savedVersion = p.version;
    if (savedVersion !== 1 && savedVersion !== 2 && savedVersion !== 3 && savedVersion !== 4) return DEFAULT_LAYOUT;
    return {
      version: 4,
      // What an organizer chose (shown, order) is kept; the name is always today's.
      panels: DEFAULT_LAYOUT.panels.map(def => {
        const hit = (p.panels ?? []).find(c => c.id === def.id);
        return hit ? { ...def, visible: hit.visible !== false, order: typeof hit.order === 'number' ? hit.order : def.order } : def;
      }),
      gameDayParts: savedVersion === 4
        ? DEFAULT_GAME_DAY_PARTS.map(def => ({ ...def, ...((p.gameDayParts ?? []).find(c => c.id === def.id) ?? {}) }))
        : gameDayPartsFromLegacy(p.gameDayPanels),
    };
  } catch { return DEFAULT_LAYOUT; }
}

function saveLayout(orgSlug: string, layout: DashboardLayout) {
  try { localStorage.setItem(layoutKey(orgSlug), JSON.stringify(layout)); } catch { /* quota */ }
}

const EMPTY_STATS: DashboardStats = {
  divisions: 0,
  teams: 0,
  scheduled: 0,
  totalGames: 0,
  completed: 0,
  communications: { total: 0, emailsSent: 0, totalRecipients: 0, latestTitle: null, latestDate: null },
  chatAdoption: null,
  scheduleHealth: {
    score: 0,
    tone: 'good',
    issueCount: 0,
    topIssue: null,
    totalGames: 0,
    timedGames: 0,
    participantCount: 0,
    backToBack: 0,
    maxGamesInDay: 0,
    maxGamesPerDay: 2,
    venueChanges: 0,
    facilityChanges: 0,
    conflicts: 0,
    travelBufferWarnings: 0,
    unresolvedFacilities: 0,
    minGamesPerParticipant: 0,
    maxGamesPerParticipant: 0,
    averageGamesPerParticipant: 0,
  },
  isTournamentDay: false,
  isGameDay: false,
  gameDay: EMPTY_GAME_DAY,
  champions: [],
  recap: null,
  notifyTeamsOnComplete: false,
  coinTossNeeded: [],
  publishChecklist: {
    hasDates: false, hasDivisions: false, hasPublicContact: false, hasOpenDivision: false,
    hasBranding: false, hasVenues: false, hasRules: false, hasFees: false,
    hasGameTiming: false, hasTieBreakers: false, ready: false,
  },
  fees: { scope: null, mode: 'tournament', total: null, deposit: null, divisionFees: 0 },
  setup: null,
  publicPageCount: 6,
  registration: { totalCapacity: 0, totalAccepted: 0, totalPending: 0, totalWaitlist: 0, byDivision: [], velocity: 0, weeklyTrend: [] },
  checkIn: { accepted: 0, checkedIn: 0, noShow: 0 },
  payment: { hasFeeSchedule: false, totalExpected: 0, totalCollected: 0, counts: { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, noSchedule: 0 } },
  registrationAttention: { total: 0, buckets: [] },
};

// ── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { currentTournament, tournaments, isLocked, loading: tournamentLoading, refresh: refreshTournaments } = useTournament();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { openInto } = useSetupWizard();
  usePageTitle('Dashboard');
  const router = useRouter();
  // The rain-delay tool (the board's "Running late?" door) is Tournament Plus (2026-07-07 decision).
  const canRainDelay = currentOrg ? hasPlanFeature(currentOrg.planId, 'bulk_reschedule') : false;
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments`;
  const subscriptionHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const canCreate = hasCapability(userRole ?? 'official', userCapabilities, 'create_tournaments');

  // ── Core stats ────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [statsError, setStatsError] = useState('');
  /** Bumped by a panel-level "Try again" (and by "into this draft" landing) so the stats effect re-runs. */
  const [statsReloadKey, setStatsReloadKey] = useState(0);
  // The coin toss being recorded from the nudge (S7: it opens the recorder in place, not the standings preview).
  const [tossOpen, setTossOpen] = useState<PendingToss | null>(null);
  /**
   * Which fetch attempt has settled (`statsAttemptKey`: tournament · reload · finished). Compared against the
   * current attempt rather than reset on change, so switching tournaments (or hitting Try again)
   * returns to LOADING without setting state inside the effect body.
   *
   * Before it settles a panel is LOADING; after it settles with an error it has genuinely FAILED.
   */
  const [statsSettledFor, setStatsSettledFor] = useState<string | null>(null);
  /**
   * Which event the figures in `stats` belong to — null until a read has landed. Nothing is drawn
   * from figures that are not this event's: the board used to draw from the placeholder zeros, so a
   * game day opened as the after-the-event board ("All the games are done") until its read landed,
   * and switching events drew the last event's board under the new one's name.
   */
  const [statsFor, setStatsFor] = useState<string | null>(null);

  // ── Mark complete (one-click finalize from the "ready" guidance card) ──────
  const [completing, setCompleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completeError, setCompleteError] = useState('');

  // ── Layout customization ──────────────────────────────────────────────────
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Load layout from localStorage after mount (client-only)
  useEffect(() => {
    if (currentOrg?.slug) setLayout(loadLayout(currentOrg.slug));
  }, [currentOrg?.slug]);

  const updateLayout = useCallback((next: DashboardLayout) => {
    setLayout(next);
    if (currentOrg?.slug) saveLayout(currentOrg.slug, next);
  }, [currentOrg?.slug]);

  const setPanelVisible = (id: PanelId, visible: boolean) =>
    updateLayout({ ...layout, panels: layout.panels.map(p => p.id === id ? { ...p, visible } : p) });
  const toggleGameDayPartVisible = (id: GameDayPartId, visible: boolean) =>
    updateLayout({ ...layout, gameDayParts: layout.gameDayParts.map(p => p.id === id ? { ...p, visible } : p) });
  const reorderPanels = (activeId: PanelId, overId: PanelId) => {
    const sorted = [...layout.panels].sort((a, b) => a.order - b.order);
    const from = sorted.findIndex(x => x.id === activeId);
    const to = sorted.findIndex(x => x.id === overId);
    if (from < 0 || to < 0) return;
    const [moved] = sorted.splice(from, 1);
    sorted.splice(to, 0, moved);
    updateLayout({ ...layout, panels: sorted.map((x, order) => ({ ...x, order })) });
  };
  const exitCustomize = () => setIsCustomizing(false);

  // ── Fetch stats ───────────────────────────────────────────────────────────
  /** The current read, for the live refresh below (null while there is no tournament). */
  const pollStatsRef = useRef<(() => void) | null>(null);
  const boardIsFinished = currentTournament?.status === 'completed' || currentTournament?.status === 'archived';
  // Finished-or-not is part of the read: only a finished event's read carries its recap, and nothing polls once
  // finished, so the event turning finished (Mark complete, or wherever the tournament list learns it) reads again.
  const statsAttemptKey = `${currentTournament?.id}:${statsReloadKey}:${boardIsFinished ? 'finished' : 'open'}`;
  useEffect(() => {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;
    const controller = new AbortController();
    const attemptKey = statsAttemptKey;
    async function fetchStats(id: string) {
      try {
        const res = await fetch(`/api/admin/tournament-dashboard?tournamentId=${encodeURIComponent(id)}${orgParam}`, { signal: controller.signal });
        const data = await res.json().catch(() => null) as Partial<DashboardStats> & { error?: string } | null;
        if (!res.ok) throw new Error(data?.error ?? 'Unable to load dashboard stats.');
        setStats({
          divisions:       data?.divisions       ?? 0,
          teams:           data?.teams           ?? 0,
          scheduled:       data?.scheduled       ?? 0,
          totalGames:      data?.totalGames      ?? 0,
          completed:       data?.completed       ?? 0,
          communications:  data?.communications  ?? EMPTY_STATS.communications,
          chatAdoption:    data?.chatAdoption    ?? null,
          scheduleHealth:  data?.scheduleHealth  ?? EMPTY_STATS.scheduleHealth,
          isTournamentDay: data?.isTournamentDay ?? false,
          isGameDay:       data?.isGameDay       ?? false,
          gameDay:         { ...EMPTY_GAME_DAY, ...(data?.gameDay ?? {}) },
          champions:       data?.champions       ?? [],
          recap:           data?.recap           ?? null,
          notifyTeamsOnComplete: data?.notifyTeamsOnComplete ?? false,
          coinTossNeeded:  data?.coinTossNeeded  ?? [],
          publishChecklist: { ...EMPTY_STATS.publishChecklist, ...(data?.publishChecklist ?? {}) },
          fees:            data?.fees            ?? EMPTY_STATS.fees,
          setup:           data?.setup           ?? null,
          publicPageCount: data?.publicPageCount ?? EMPTY_STATS.publicPageCount,
          registration: {
            ...(data?.registration ?? EMPTY_STATS.registration),
            velocity: data?.registration?.velocity ?? 0,
            weeklyTrend: data?.registration?.weeklyTrend ?? [],
          },
          checkIn: data?.checkIn ?? EMPTY_STATS.checkIn,
          payment: data?.payment ?? EMPTY_STATS.payment,
          registrationAttention: data?.registrationAttention ?? EMPTY_STATS.registrationAttention,
        });
        setStatsFor(id);
        setStatsError('');
        setStatsSettledFor(attemptKey);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // A failed refresh keeps the last figures that landed: zeroing them redrew a game day as the
        // after-the-event board until the next read 30 s later.
        setStatsError(err instanceof Error ? err.message : 'Unable to load dashboard stats.');
        setStatsSettledFor(attemptKey);
      }
    }
    void fetchStats(tournamentId);
    pollStatsRef.current = () => { void fetchStats(tournamentId); };

    return () => {
      controller.abort();
      pollStatsRef.current = null;
    };
  }, [currentTournament?.id, orgParam, statsAttemptKey]);

  // Live auto-refresh (J1-086, and G6's shared rule): the board's figures move on their own every 30 s
  // while the tab is visible, and at once when it comes back. Cheap (one cached GET).
  // A finished event's board does not poll (Stage 4): nothing on it can change once results are locked,
  // and each read of a finished event also reads its recap — it reads fresh on every visit instead.
  useVisiblePoll(() => pollStatsRef.current?.(), { enabled: Boolean(currentTournament?.id) && !boardIsFinished });

  // ── Actions ───────────────────────────────────────────────────────────────
  async function setStatus(status: 'active' | 'archived' | 'completed', fallback: string) {
    if (!currentTournament?.id) return;
    const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-status', id: currentTournament.id, data: { status } }),
    });
    const json = await res.json().catch(() => null) as { error?: string } | null;
    if (!res.ok) throw new Error(json?.error ?? fallback);
    await refreshTournaments();
    router.refresh();
  }

  /** Activate (the draft's Ready to activate — DraftBoard asks first). Throws the route's words. The board reads itself
   *  again at once: draft → active keeps the same attempt key, which would otherwise wait for the next poll. */
  const activateEvent = async () => {
    await setStatus('active', 'Couldn’t activate the tournament.');
    setStatsReloadKey(k => k + 1);
  };
  /** Archive (the Tournament plan's finished board — FinishedBoard asks first). Throws the route's words. */
  const archiveEvent = () => setStatus('archived', 'Couldn’t archive the tournament.');

  // Marks the tournament complete via the SAME server action as Settings, so the results-summary email + read-only
  // lock fire identically no matter where it's triggered (the notify email is sent server-side on the transition).
  async function handleComplete() {
    if (!currentTournament?.id || completing) return;
    // The question stays open until the change lands: a refusal is said in it.
    setCompleting(true); setCompleteError('');
    try {
      await setStatus('completed', 'Failed to mark tournament complete.');
      setShowCompleteConfirm(false);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Failed to mark tournament complete.');
    } finally { setCompleting(false); }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const status        = currentTournament?.status ?? 'draft';
  const isDraft       = status === 'draft';
  const isActive      = status === 'active';
  // Completed, or archived (the context lists no archived event, so the second is a moment at most).
  const isFinished    = status === 'completed' || status === 'archived';

  const statsReady    = Boolean(currentTournament?.id) && statsFor === currentTournament?.id;
  const visibleStats  = statsReady ? stats : EMPTY_STATS;
  // The board waits for this event's read — a finished event for the read that carries its recap (right
  // after Mark complete the figures on hand are still the active event's). Until then: one quiet line.
  const boardWaiting  = Boolean(currentTournament?.id) && (!statsReady || (isFinished && !visibleStats.recap));
  const boardFailed   = boardWaiting && Boolean(statsError) && statsSettledFor === statsAttemptKey;
  const gd            = visibleStats.gameDay;
  // Before the read lands, the event's own dates and first game say which board it is (G1's one rule).
  const isGameDay = statsReady
    ? visibleStats.isGameDay
    : isGameDayRule({ startDate: currentTournament?.startDate, endDate: currentTournament?.endDate, firstGameStarted: Boolean(currentTournament?.firstGameStarted) });
  const hasSummary = currentOrg ? hasPlanFeature(currentOrg.planId, 'post_tournament_summary') : false;
  const canReuseSetup = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'tournament_cloning'));
  // One count of days, the board's and the help drawer's (the org's own day, lib/tournament-guidance).
  const daysUntil = daysUntilStart(currentTournament?.startDate);

  // "Ready to finalize" — every non-cancelled game is in a terminal state AND, when the format ends in a bracket, a
  // playoff bracket exists (lib/tournament-phase, unit-tested). The guidance card's Mark complete keys off it.
  const tournamentHasPlayoffs = hasPlayoffs(currentTournament);
  const readyToFinalize = isReadyToFinalize({
    isActive,
    totalGames: gd.totalGames,
    resolvedGames: gd.resolved,
    playoffGamesTotal: gd.playoffGamesTotal,
    hasPlayoffs: tournamentHasPlayoffs,
  });
  const isPreEvent = isActive && daysUntil !== null && daysUntil > 0;
  const isPostEventActive = isActive && !isGameDay && (daysUntil === null || daysUntil <= 0);

  // The one guidance card left (Stage 5): "ready to finalize", because it holds the one button the day needs next
  // (Mark complete). Every other stage's card became its board's note or its "?".
  const guidanceRail = (readyToFinalize && currentOrg?.slug && currentTournament?.id) ? (() => {
    const ctx = {
      orgSlug: currentOrg.slug,
      tournamentSlug: currentTournament.slug,
      planId: currentOrg.planId,
      daysUntil,
      checklist: { hasDates: true, hasDivisions: true, ready: true },
      hasPlayoffs: tournamentHasPlayoffs,
    };
    return (
      <GuidanceRail
        guidance={getGuidance('ready', ctx)}
        tournamentId={currentTournament.id}
        ready
        onAction={(actionId) => { if (actionId === 'complete') { setCompleteError(''); setShowCompleteConfirm(true); } }}
      />
    );
  })() : null;

  // The top note (G2): only for a step the lists can't say — the event's dates have passed and not
  // every game is final yet. The kit's card with its accent edge, no counts, no button.
  const datesPassedNote = isPostEventActive && !readyToFinalize ? (
    <BoardNote>
      {GAME_DAY_WORDS.datesPassedNote.fact} <b>{GAME_DAY_WORDS.datesPassedNote.step}</b>
    </BoardNote>
  ) : null;

  const gameDayPartShown = (id: GameDayPartId) => layout.gameDayParts.find(p => p.id === id)?.visible ?? true;
  const registrationFollowUps = visibleStats.registrationAttention.buckets
    .filter(bucket => bucket.count > 0 && bucket.key !== 'pending_review' && bucket.key !== 'waitlist')
    .slice(0, 3);
  const otherEvents = tournaments.filter(t => t.id !== currentTournament?.id);

  // Schedule health's body — what the game-day board's health row opens in place (G2: "Schedule health as a row that
  // expands in place").
  function renderScheduleHealthBody() {
    const health = visibleStats.scheduleHealth;
    const healthLabel = health.tone === 'good' ? 'Healthy' : health.tone === 'warning' ? 'Review' : 'Needs work';
    const gameRange = health.participantCount === 0
      ? 'No teams'
      : health.minGamesPerParticipant === health.maxGamesPerParticipant
        ? `${health.minGamesPerParticipant} games each`
        : `${health.minGamesPerParticipant}-${health.maxGamesPerParticipant} games`;
    const attentionMetric = health.unresolvedFacilities > 0
      ? { value: health.unresolvedFacilities, label: 'TBD facilities', tone: 'warning' as const }
      : health.travelBufferWarnings > 0
        ? { value: health.travelBufferWarnings, label: 'Travel buffer', tone: 'warning' as const }
        : { value: health.conflicts, label: 'Conflicts', tone: health.conflicts > 0 ? 'danger' as const : 'good' as const };
    if (health.timedGames === 0) {
      return (
        <div className={styles.emptyPanel}>
          <span>No games have times yet.</span>
          <Link href={`${base}/schedule`} className={styles.panelLink}>Open the schedule →</Link>
        </div>
      );
    }
    return (
      <>
        <div className={styles.scheduleHealthTopline}>
          <div className={styles.scheduleHealthScore} data-tone={health.tone}>
            <span>{health.score}</span>
            <small>/100</small>
          </div>
          <div className={styles.scheduleHealthSummary}>
            <strong>{healthLabel}</strong>
            <span>{health.timedGames}/{health.totalGames} timed games - {gameRange}</span>
          </div>
          <span className={styles.scheduleHealthIssuePill} data-tone={health.issueCount > 0 ? health.tone : 'good'}>
            {health.issueCount} issue{health.issueCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className={styles.scheduleHealthMiniGrid}>
          <span className={styles.scheduleHealthMiniMetric} data-tone={health.backToBack > 0 ? 'warning' : 'good'}>
            <strong>{health.backToBack}</strong>
            <small>Back-to-back</small>
          </span>
          <span className={styles.scheduleHealthMiniMetric} data-tone={health.maxGamesInDay > (health.maxGamesPerDay || 2) ? 'warning' : 'good'}>
            <strong>{health.maxGamesInDay}</strong>
            <small>Max/day</small>
          </span>
          <span className={styles.scheduleHealthMiniMetric} data-tone={health.venueChanges > 0 ? 'info' : 'good'}>
            <strong>{health.venueChanges}</strong>
            <small>Venue moves</small>
          </span>
          <span className={styles.scheduleHealthMiniMetric} data-tone={attentionMetric.tone}>
            <strong>{attentionMetric.value}</strong>
            <small>{attentionMetric.label}</small>
          </span>
        </div>
        {health.topIssue ? (
          <Link href={`${base}/schedule`} className={styles.scheduleHealthIssueLink} data-tone={health.tone}>
            <AlertCircle size={13} />
            <span>{health.topIssue}</span>
          </Link>
        ) : (
          <div className={styles.scheduleHealthIssueLink} data-tone="good">
            <CheckCircle2 size={13} />
            <span>No major schedule health issues.</span>
          </div>
        )}
      </>
    );
  }

  // ── Customize's toolbar ───────────────────────────────────────────────────
  // On the game-day board Customize shows and hides the board's parts (owner 2026-09-29): one checkbox per part, in
  // the day's order, which Customize never changes. The weeks-before board keeps its drag-to-reorder cards.
  function renderEditToolbar() {
    const gameDayBoard = isActive && isGameDay;
    return (
      <div className={styles.editToolbar}>
        <Settings size={14} className={styles.editToolbarIcon} />
        <span className={styles.editToolbarTitle}>{GAME_DAY_WORDS.customize}</span>
        <span className={styles.editToolbarHint}>{gameDayBoard ? GAME_DAY_WORDS.customizeHint : 'Drag to reorder · saved to your browser'}</span>
        {gameDayBoard && (
          <div className={styles.editToolbarParts} role="group" aria-label={GAME_DAY_WORDS.customize}>
            {GAME_DAY_PARTS.map(part => (
              <label key={part.id} className={styles.editToolbarPart}>
                <input
                  type="checkbox"
                  checked={gameDayPartShown(part.id)}
                  onChange={e => toggleGameDayPartVisible(part.id, e.target.checked)}
                />
                {part.label}
              </label>
            ))}
          </div>
        )}
        <div className={styles.editToolbarActions}>
          <button type="button" className="btn btn-ghost btn-data" onClick={() => updateLayout(DEFAULT_LAYOUT)}>
            <RotateCcw size={11} /> Reset to defaults
          </button>
          <button type="button" className="btn btn-lime btn-data" onClick={exitCustomize}>Done</button>
        </div>
      </div>
    );
  }

  // Customize lives at the foot of an active board ("Customize this board", G1: it left the title band). It belongs to
  // that board: switching to a draft or a finished event never leaves its toolbar open over a board with nothing to move.
  const customizing = isCustomizing && isActive;
  const openCustomize = isActive && currentTournament?.id && !customizing
    ? () => setIsCustomizing(true)
    : null;

  // Each board's "?" (A56), once the page knows which board it is.
  const boardHelp = !currentTournament?.id ? null
    : isFinished ? FINISHED_BOARD_HELP
      : isDraft ? DRAFT_BOARD_HELP
        : isGameDay ? GAME_DAY_HELP : WEEKS_BEFORE_HELP;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* G1: the event header above names the event and carries its one status chip; the page names
          only itself — no second copy of the name, no ACTIVE/LIVE tags, Customize at the board's foot. */}
      <AdminPageHeader
        title="Dashboard"
        inlineActions
        actions={boardHelp ? <HelpButton help={boardHelp} label="Dashboard" iconOnly /> : undefined}
      />

      {statsReady && !boardWaiting && statsError && (
        <p className={styles.staleLine}>Couldn’t refresh the dashboard — these figures may be out of date.</p>
      )}

      {boardWaiting && (boardFailed ? (
        <div className={styles.boardWaiting} role="alert">
          <span>Couldn’t load the dashboard.</span>
          <button type="button" className="btn btn-outline btn-data" onClick={() => setStatsReloadKey(k => k + 1)}>Try again</button>
        </div>
      ) : (
        <LoadingState label="Loading the dashboard…" />
      ))}

      {/* ── A COIN TOSS STILL OWED — the bracket's note, with its one action: the recorder, here (S7) ── */}
      {currentTournament?.id && visibleStats.coinTossNeeded.map(t => (
        <CoinTossNote key={t.groupKey} toss={t} named onRecord={setTossOpen} />
      ))}
      {tossOpen && (
        <CoinTossRecorder
          orgSlug={currentOrg?.slug ?? ''}
          toss={tossOpen}
          onClose={() => setTossOpen(null)}
          onRecorded={() => { setTossOpen(null); setStatsReloadKey(k => k + 1); }}
        />
      )}

      {customizing && renderEditToolbar()}

      {/* ── NO TOURNAMENT CHOSEN (J1-021) — while the tournament itself loads, the board's own wait instead ── */}
      {!currentTournament?.id && tournamentLoading && <LoadingState label="Loading the dashboard…" />}
      {!currentTournament?.id && !tournamentLoading && (
        <EmptyCard
          title={DRAFT_BOARD_WORDS.noTournament}
          action={<Link className="btn btn-outline" href={`${base}/manage`}>{DRAFT_BOARD_WORDS.openTournaments}</Link>}
        />
      )}

      {/* ── A DRAFT — Stage 5's board (E2) ── */}
      {isDraft && currentTournament?.id && !boardWaiting && (
        <DraftBoard
          base={base}
          orgSlug={currentOrg?.slug ?? ''}
          tournament={{
            id: currentTournament.id,
            name: currentTournament.name,
            slug: currentTournament.slug,
            startDate: currentTournament.startDate ?? null,
            endDate: currentTournament.endDate ?? null,
          }}
          checklist={visibleStats.publishChecklist}
          setup={visibleStats.setup}
          fees={visibleStats.fees}
          divisions={visibleStats.registration.byDivision}
          games={visibleStats.totalGames}
          publicPageCount={visibleStats.publicPageCount}
          finiteSlots={hasFiniteSlots(currentOrg?.tournamentLimit)}
          canActivate={canCreate}
          startFrom={!visibleStats.publishChecklist.hasDivisions && otherEvents.length > 0 && canCreate
            ? canReuseSetup
              ? {
                kind: 'open',
                onOpen: () => openInto(
                  { id: currentTournament.id, name: currentTournament.name, year: currentTournament.year ?? null },
                  () => setStatsReloadKey(k => k + 1),
                ),
              }
              : { kind: 'plan', href: subscriptionHref }
            : null}
          onActivate={activateEvent}
        />
      )}

      {/* ── GAME DAY (active, and the dates have come or the first game has started) — the Stage 1
          board (G2 · G3 · G8). Once every game is final the guidance card stays, because it has the one
          button the day needs next (Mark complete). */}
      {isActive && currentTournament?.id && !boardWaiting && isGameDay && (
        <>
          {guidanceRail ?? datesPassedNote}
          <GameDayBoard
            base={base}
            planHref={`${subscriptionHref}?plan=tournament_plus`}
            gd={gd}
            arrived={{ checkedIn: visibleStats.checkIn.checkedIn, accepted: visibleStats.checkIn.accepted }}
            champions={visibleStats.champions}
            health={visibleStats.scheduleHealth}
            healthBody={
              <>
                {renderScheduleHealthBody()}
                <Link href={`${base}/schedule`} className={styles.panelLink}>Review →</Link>
              </>
            }
            canRainDelay={canRainDelay}
            locked={isLocked}
            visible={gameDayPartShown}
            customizing={customizing}
            onCustomize={openCustomize}
          />
        </>
      )}

      {/* ── THE WEEKS BEFORE (active, no game day yet) — and after its dates, before Mark complete — Stage 5's ── */}
      {isActive && currentTournament?.id && !boardWaiting && !isGameDay && (
        <>
          {guidanceRail ?? datesPassedNote}
          <WeeksBeforeBoard
            key={currentTournament.id}
            base={base}
            daysUntil={isPreEvent ? daysUntil : null}
            tournamentId={currentTournament.id}
            orgQuery={orgQuery}
            subscriptionHref={subscriptionHref}
            paymentTools={currentOrg ? hasPlanFeature(currentOrg.planId, 'payment_readiness_tools') : false}
            reg={visibleStats.registration}
            followUps={registrationFollowUps}
            pay={visibleStats.payment}
            fees={visibleStats.fees}
            chat={visibleStats.chatAdoption}
            chatSettled={statsSettledFor === statsAttemptKey}
            onRetryChat={() => setStatsReloadKey(k => k + 1)}
            canRemind={
              hasCapability(userRole ?? 'official', userCapabilities, 'manage_registrations')
              || canCreate
            }
            comms={visibleStats.communications}
            health={visibleStats.scheduleHealth}
            teams={visibleStats.teams}
            divisions={visibleStats.divisions}
            panels={layout.panels}
            customizing={customizing}
            onReorder={reorderPanels}
            onHide={id => setPanelVisible(id, false)}
            onShow={id => setPanelVisible(id, true)}
          />
          <LiveEventLog tournamentId={currentTournament.id} orgSlug={currentOrg?.slug} className={styles.recentEvents} />
          {openCustomize && <CustomizeLink onClick={openCustomize} />}
        </>
      )}

      {/* ── AFTER THE EVENT (completed; archived is unreachable — the context lists no archived event) —
          Stage 4's finished board (D1, D6): How it finished · Next year · Summary's door. ── */}
      {isFinished && currentTournament?.id && visibleStats.recap && (
        <FinishedBoard
          recap={visibleStats.recap}
          tournament={{
            id: currentTournament.id,
            name: currentTournament.name,
            year: currentTournament.year ?? null,
            status,
            startDate: currentTournament.startDate ?? null,
          }}
          base={base}
          planHref={`${subscriptionHref}?plan=tournament_plus`}
          hasSummary={hasSummary}
          canClone={canReuseSetup}
          canArchive={canCreate}
          tournamentLimit={currentOrg?.tournamentLimit ?? 9999}
          slotHolder={(otherEvents.find(t => t.status === 'active') ?? otherEvents.find(t => holdsSlot(t.status)))?.name ?? null}
          archive={archiveEvent}
        />
      )}

      {/* ── MARK COMPLETE — the "ready" card's one button asks first, in the kit's question window, with the
          record's own sentence (Stage 4, P5: one home for every status sentence; it says the results email only
          when it will send). ── */}
      {showCompleteConfirm && currentTournament && (() => {
        const q = statusConfirm('complete', {
          name: currentTournament.name,
          startDate: currentTournament.startDate ?? null,
          today: tournamentToday(),
          finiteSlots: hasFiniteSlots(currentOrg?.tournamentLimit),
          willEmailTeams: visibleStats.notifyTeamsOnComplete,
        });
        const close = () => { if (!completing) { setShowCompleteConfirm(false); setCompleteError(''); } };
        return (
          <KitDialog
            kind="question"
            title={q.title}
            onClose={close}
            busy={completing}
            footer={(
              <>
                <button type="button" className="btn btn-outline" onClick={close} disabled={completing}>Cancel</button>
                <button type="button" className="btn btn-lime" onClick={handleComplete} disabled={completing}>{q.action}</button>
              </>
            )}
          >
            <p>{q.body}</p>
            {completeError && <p role="alert">{completeError}</p>}
          </KitDialog>
        );
      })()}
    </div>
  );
}
