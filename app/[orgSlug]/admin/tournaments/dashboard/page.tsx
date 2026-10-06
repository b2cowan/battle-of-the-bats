'use client';
import { useState, useEffect, useCallback, useRef, useSyncExternalStore, Fragment, type CSSProperties } from 'react';
import CountUp from '@/components/admin/CountUp';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, Info,
  Users, Calendar, Trophy, DollarSign, TrendingUp, Zap, Flag,
  Clock, Activity, Star, Shield, BarChart2, Target, Bell,
  Settings, RotateCcw, Megaphone, GripVertical, X, Plus, Pencil,
  MessageCircle,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useTournament } from '@/lib/tournament-context';
import { useVisiblePoll } from '@/lib/hooks/useVisiblePoll';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import type { RegistrationAttentionSummary } from '@/lib/registration-attention';
import { LiveEventLog } from '@/components/admin/LiveEventLog';
import HelpTooltip from '@/components/help/HelpTooltip';
import GuidanceRail from '@/components/admin/tournament/GuidanceRail';
import PersonaPanel from '@/components/admin/tournament/PersonaPanel';
import { getGuidance, getStageShortcuts, type GuidanceStage } from '@/lib/tournament-guidance';
import styles from './dashboard.module.css';
import { copiedSummary } from '@/lib/utils';
import type { CloneCopiedCounts } from '@/lib/types';
import { hasPlayoffs, isReadyToFinalize } from '@/lib/tournament-phase';
import { tournamentToday, daysBetweenDateStrings } from '@/lib/timezone';
import { useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK } from '@/components/admin/kit/kit-inline';
import { Callout, repKit } from '@/components/admin/kit/club/RepKit';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import type { EventRecap } from '@/lib/event-recap';
import FinishedBoard from './FinishedBoard';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { statusConfirm } from '@/lib/tournament-status-words';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import GameDayBoard, {
  BoardNote, CustomizeLink, EMPTY_GAME_DAY, GAME_DAY_PARTS, type GameDayPartId, type GameDayStats,
} from './GameDayBoard';

// ── Kit ink patches (Admin Design Continuity slice 4b) ──────────────────────
// Shared single-property style objects reused across this page's many inline icon/text colours.
// Kept at module scope per the kx() convention: legacy values never change, only the kit side does.
const ICON_ACCENT_LEGACY: CSSProperties = { color: 'var(--logic-lime)' };
const ICON_MUTED_LEGACY: CSSProperties = { color: 'var(--data-gray)' };
// Two overlay shapes: the populate modal blurs behind it, the confirm dialogs don't — both scrim
// to the kit's `--home-scrim` (the same token `.modal-overlay` uses globally).
const MODAL_OVERLAY_BLUR_LEGACY: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' };
const MODAL_OVERLAY_LEGACY: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' };
const MODAL_OVERLAY_KIT: CSSProperties = { background: 'var(--home-scrim)' };

/** A finished board's "?" — the close-out guide (the help drawer lists the stage's tasks above it). */
const FINISHED_BOARD_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['recipe-closeout-tournament'] };

// ── Domain types ────────────────────────────────────────────────────────────

type DivisionStat = {
  id: string;
  name: string;
  capacity: number | null;
  accepted: number;
  pending: number;
  waitlist: number;
};

type CommunicationsStats = {
  total: number;
  emailsSent: number;
  totalRecipients: number;
  latestTitle: string | null;
  latestDate: string | null;
};

type PaymentDivisionStat = {
  id: string;
  name: string;
  paid: number;
  depositPaid: number;
  pending: number;
  pastDue: number;
  total: number;
};

type PaymentCounts = {
  paid: number;
  depositPaid: number;
  pending: number;
  pastDue: number;
  noSchedule: number;
};

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

type DivisionChampion = {
  divisionId: string;
  divisionName: string;
  championTeamName: string;
};

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
  coinTossNeeded: { divisionId: string; divisionName: string; teamNames: string[] }[];
  publishChecklist: PublishChecklist;
  registration: {
    totalCapacity: number;
    totalAccepted: number;
    totalPending: number;
    totalWaitlist: number;
    byDivision: DivisionStat[];
    velocity: number;
    weeklyTrend: number[];
  };
  checkIn: {
    accepted: number;
    checkedIn: number;
    noShow: number;
  };
  payment: {
    hasFeeSchedule: boolean;
    totalExpected: number;
    totalCollected: number;
    counts: PaymentCounts;
    byDivision: PaymentDivisionStat[];
  };
  registrationAttention: RegistrationAttentionSummary;
};

type PublishChecklist = {
  hasDates: boolean;
  hasDivisions: boolean;
  hasPublicContact: boolean;
  hasOpenDivision: boolean;
  hasBranding: boolean;
  hasVenues: boolean;
  hasRules: boolean;
  hasFees: boolean;
  hasGameTiming: boolean;
  hasTieBreakers: boolean;
  ready: boolean;
};

// ── Layout customization ─────────────────────────────────────────────────────

const ICON_MAP = {
  Users, Calendar, Trophy, Clock, DollarSign, TrendingUp,
  Zap, Flag, Activity, Star, Shield, BarChart2, Target, Bell,
} as const;

type IconKey = keyof typeof ICON_MAP;
const AVAILABLE_ICONS = Object.keys(ICON_MAP) as IconKey[];

type StatCardId = 'teams' | 'scheduled' | 'completed' | 'days';
type PanelId = 'registration' | 'payment' | 'communications' | 'tournamentChat' | 'scheduleHealth';
// The game-day board's panels BEFORE Stage 1 (v1–v3 layouts): read only to carry an organizer's
// hide choices onto the new board's parts (below).
type LegacyGameDayPanelId = 'nowPlaying' | 'upNext' | 'needsScore' | 'gamesProgress' | 'checkIn' | 'gdScheduleHealth' | 'byDivision';

type StatCardConfig = { id: StatCardId; label: string; icon: IconKey; visible: boolean; order: number };
type PanelConfig    = { id: PanelId;   label: string;                  visible: boolean; order: number };
/** The game-day board's parts: shown or hidden only — the order is the day's (owner 2026-09-29). */
type GameDayPartConfig = { id: GameDayPartId; visible: boolean };

type DashboardLayout = {
  version: 4;
  statCards: StatCardConfig[];
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

const DEFAULT_LAYOUT: DashboardLayout = {
  version: 4,
  statCards: [
    { id: 'teams',     label: 'Teams',     icon: 'Users',    visible: true, order: 0 },
    { id: 'scheduled', label: 'Scheduled', icon: 'Calendar', visible: true, order: 1 },
    { id: 'completed', label: 'Completed', icon: 'Trophy',   visible: true, order: 2 },
    { id: 'days',      label: 'Days Away', icon: 'Clock',    visible: true, order: 3 },
  ],
  panels: [
    { id: 'tournamentChat', label: 'Coach Sign-ups & Chat', visible: true, order: 0 },
    { id: 'registration',   label: 'Registration',   visible: true, order: 1 },
    { id: 'payment',        label: 'Payments',       visible: true, order: 2 },
    { id: 'communications', label: 'Communications', visible: true, order: 3 },
    { id: 'scheduleHealth', label: 'Schedule Health', visible: true, order: 4 },
  ],
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
      statCards?: StatCardConfig[];
      panels?: PanelConfig[];
      gameDayPanels?: Array<{ id: LegacyGameDayPanelId; visible: boolean }>;
      gameDayParts?: GameDayPartConfig[];
    };
    // Accept v1–v4 — default-merge fills any missing set, so an older saved layout gains new
    // cards/panels without being discarded.
    const savedVersion = p.version;
    if (savedVersion !== 1 && savedVersion !== 2 && savedVersion !== 3 && savedVersion !== 4) return DEFAULT_LAYOUT;
    const mergeBy = <T extends { id: string }>(defs: T[], saved: T[] | undefined): T[] =>
      defs.map(def => {
        const hit = (saved ?? []).find(c => c.id === def.id);
        return hit ? { ...def, ...hit } : def;
      });
    return {
      version: 4,
      statCards: mergeBy(DEFAULT_LAYOUT.statCards, p.statCards),
      panels: mergeBy(DEFAULT_LAYOUT.panels, p.panels),
      gameDayParts: savedVersion === 4
        ? mergeBy(DEFAULT_GAME_DAY_PARTS, p.gameDayParts)
        : gameDayPartsFromLegacy(p.gameDayPanels),
    };
  } catch { return DEFAULT_LAYOUT; }
}

function saveLayout(orgSlug: string, layout: DashboardLayout) {
  try { localStorage.setItem(layoutKey(orgSlug), JSON.stringify(layout)); } catch { /* quota */ }
}

// ── Misc helpers ─────────────────────────────────────────────────────────────

/* ── Minute clock (external store) ───────────────────────────────────────────
   Backs the chat reminder's cooldown countdown. Defined at module scope so the three function
   identities are stable across renders — passing inline closures to useSyncExternalStore would
   re-subscribe on every render. */
function subscribeToMinuteTick(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}
/** Quantized to the minute so repeat calls compare equal and React doesn't spin. */
function getMinuteNow(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}
/** No clock during SSR; 0 reads as "still cooling down", the safe default for an email gate. */
function getMinuteNowServer(): number {
  return 0;
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
  registration: { totalCapacity: 0, totalAccepted: 0, totalPending: 0, totalWaitlist: 0, byDivision: [], velocity: 0, weeklyTrend: [] },
  checkIn: { accepted: 0, checkedIn: 0, noShow: 0 },
  payment: { hasFeeSchedule: false, totalExpected: 0, totalCollected: 0, counts: { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, noSchedule: 0 }, byDivision: [] },
  registrationAttention: { total: 0, buckets: [] },
};

const REUSE_SETUP_INCLUDED = [
  'Divisions, pools, and empty schedule slots',
  'Venues and playing surfaces',
  'Registration questions and fee setup',
  'Public page settings, branding, rules, and resources',
  'Welcome content for the draft',
];

const REUSE_SETUP_EXCLUDED = [
  'Teams, registrations, and waitlists',
  'Games, scores, standings, and champions',
  'Payments, uploaded files, reminders, and message history',
  'Archived summaries and private admin notes',
];

const REUSE_SETUP_COPY_GROUPS = ['structure', 'venues', 'registration', 'publicPresence', 'content'];

function getTournamentStatusLabel(status?: string | null) {
  if (!status) return 'Status unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getSourceSortRank(status?: string | null) {
  if (status === 'completed') return 0;
  if (status === 'active') return 1;
  if (status === 'draft') return 2;
  return 3;
}

function fmt(n: number) {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
}

// Counted in the ORG timezone, not the viewer's device — otherwise an out-of-province organizer
// sees a different countdown than the host org for the same tournament.
function computeDaysUntil(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  return daysBetweenDateStrings(tournamentToday(), startDate);
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2 || data.every(v => v === 0)) return null;
  const w = 72, h = 22;
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 3) - 1}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={styles.sparkline} aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--logic-lime)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// A gauge's tone. Today the fill and its %-label share the base tone (plain progress in the platform
// navy). On the kit the fill keeps its base tone — AA-safe as a fill — with plain progress moving to
// `--info`, and the %-label, which is TEXT, takes `KIT_INK`'s `-light` tier (a bare state token
// fails AA as ink on the Dark ground).
type GaugeTone = 'danger' | 'success' | 'warning' | 'info';
const GAUGE_TONE: Record<GaugeTone, string> = { danger: 'var(--danger)', success: 'var(--success)', warning: 'var(--warning)', info: 'var(--blueprint-blue)' };
const GAUGE_KIT_FILL: Record<GaugeTone, string> = { ...GAUGE_TONE, info: 'var(--info)' };

function GaugeBar({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const kx = useKitStyle();
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tone: GaugeTone = danger ? 'danger' : pct >= 100 ? 'success' : pct >= 75 ? 'warning' : 'info';
  return (
    <div className={styles.gaugeWrap}>
      <div className={styles.gaugeTrack}>
        <div className={styles.gaugeFill} style={kx({ width: `${pct}%`, background: GAUGE_TONE[tone] }, { background: GAUGE_KIT_FILL[tone] })} />
      </div>
      <span className={styles.gaugePct} style={kx({ color: GAUGE_TONE[tone] }, KIT_INK[tone])}>{pct}%</span>
    </div>
  );
}

// ── Stat card value resolver ─────────────────────────────────────────────────

function getCardDisplay(id: StatCardId, stats: DashboardStats, daysUntil: number | null): {
  value: string | number;
  subValue: string | null;
  href: string | null;
} {
  switch (id) {
    case 'teams':
      return { value: stats.teams, subValue: null, href: 'registrations' };
    case 'scheduled':
      return {
        value: stats.scheduled,
        subValue: stats.totalGames > 0 ? `/ ${stats.totalGames} total` : null,
        href: 'schedule',
      };
    case 'completed':
      return { value: stats.completed, subValue: null, href: 'results' };
    case 'days':
      if (daysUntil === null) return { value: '—', subValue: 'date not set', href: null };
      if (daysUntil <= 0)    return { value: '—', subValue: 'underway', href: null };
      return {
        value: daysUntil,
        subValue: null,
        href: null,
      };
  }
}

// ── In-place edit components (drag / remove / add / icon) ────────────────────

function ctxHiddenNote(id: StatCardId): string | null {
  if (id === 'completed') return 'Appears once games are played';
  if (id === 'days')      return 'Hidden during the event';
  return null;
}

/** A sortable stat card in edit mode: grip + remove + click-to-edit icon. */
function SortableStatCard({
  card, display, iconOpen, onRemove, onIconEdit, onPickIcon,
}: {
  card: StatCardConfig;
  display: { value: string | number; subValue: string | null };
  iconOpen: boolean;
  onRemove: () => void;
  onIconEdit: () => void;
  onPickIcon: (icon: IconKey) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 1, opacity: isDragging ? 0.5 : 1 };
  const IconComp = ICON_MAP[card.icon];
  return (
    <div ref={setNodeRef} style={style} className={`card ${styles.statCard} ${styles.statCardEditing} ${isDragging ? styles.cardDragging : ''}`}>
      <button type="button" className={styles.cardGrip} {...attributes} {...listeners} aria-label="Drag to reorder"><GripVertical size={14} /></button>
      <button type="button" className={styles.cardRemove} onClick={onRemove} aria-label={`Remove ${card.label} card`}><X size={13} /></button>
      <button type="button" className={styles.statIconEdit} onClick={onIconEdit} title="Change icon" aria-label="Change icon">
        <IconComp size={22} />
        <span className={styles.iconEditBadge}><Pencil size={9} /></span>
      </button>
      <div>
        <div className={styles.statNum}>{display.value}</div>
        <div className={styles.statLabel}>{card.label}</div>
        {display.subValue && <div className={styles.statSubValue}>{display.subValue}</div>}
      </div>
      {iconOpen && (
        <div className={styles.iconPopover}>
          <div className={styles.iconPickerGrid}>
            {AVAILABLE_ICONS.map(key => {
              const Ic = ICON_MAP[key];
              return (
                <button key={key} type="button" title={key} className={`${styles.iconPickerBtn} ${card.icon === key ? styles.iconPickerBtnActive : ''}`} onClick={() => onPickIcon(key)}>
                  <Ic size={13} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** A sortable analytics panel in edit mode: grip + remove overlay; body is inert. */
function SortablePanel({ id, label, onRemove, children }: {
  id: PanelId;
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 1, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={`${styles.panelSortable} ${isDragging ? styles.cardDragging : ''}`}>
      <div className={styles.panelEditControls}>
        <button type="button" className={styles.panelGrip} {...attributes} {...listeners} aria-label="Drag to reorder"><GripVertical size={14} /></button>
        <button type="button" className={styles.panelRemove} onClick={onRemove} aria-label={`Remove ${label} panel`}><X size={14} /></button>
      </div>
      {children}
    </div>
  );
}

/** The "+ Add" ghost tile at the end of a zone, with its add-menu popover. */
function AddTile({ kind, items, open, onToggle, onAdd }: {
  kind: 'stat' | 'panel';
  items: Array<{ id: string; label: string; icon?: IconKey }>;
  open: boolean;
  onToggle: () => void;
  onAdd: (id: string) => void;
}) {
  return (
    <div className={`${styles.addTile} ${kind === 'panel' ? styles.addTilePanel : ''}`}>
      <button type="button" className={styles.addTileBtn} onClick={onToggle} aria-expanded={open}>
        <Plus size={kind === 'panel' ? 20 : 18} />
        <span className={styles.addTileLabel}>{kind === 'panel' ? 'Add panel' : 'Add card'}</span>
      </button>
      {open && (
        <div className={styles.addMenu}>
          {items.length === 0 ? (
            <div className={styles.addMenuEmpty}>Everything is shown</div>
          ) : (
            items.map(it => {
              const Icon = it.icon ? ICON_MAP[it.icon] : null;
              const note = kind === 'stat' ? ctxHiddenNote(it.id as StatCardId) : null;
              return (
                <button key={it.id} type="button" className={styles.addMenuRow} onClick={() => onAdd(it.id)}>
                  <span className={styles.addMenuRowTop}>
                    {Icon && <span className={styles.addMenuIcon}><Icon size={14} /></span>}
                    {it.label}
                  </span>
                  {note && <span className={styles.addMenuNote}><Clock size={11} />{note}</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { currentTournament, tournaments, isLocked, refresh: refreshTournaments } = useTournament();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  usePageTitle('Dashboard');
  const router = useRouter();
  const kx = useKitStyle();
  // The rain-delay tool (the board's "Running late?" door) is Tournament Plus (2026-07-07 decision).
  const canRainDelay = currentOrg ? hasPlanFeature(currentOrg.planId, 'bulk_reschedule') : false;
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments`;
  const subscriptionHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  // ── Core stats ────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [statsError, setStatsError] = useState('');
  /** Bumped by a panel-level "Try again" so the stats effect re-runs without a page reload. */
  const [statsReloadKey, setStatsReloadKey] = useState(0);
  /**
   * Which fetch attempt has settled, as `${tournamentId}:${reloadKey}`. Compared against the
   * current attempt rather than reset on change, so switching tournaments (or hitting Try again)
   * returns to LOADING without setting state inside the effect body.
   *
   * Before it settles a panel is LOADING; after it settles with an error it has genuinely FAILED.
   * Previously both rendered the same sentence, so a slow connection looked like an outage.
   */
  const [statsSettledFor, setStatsSettledFor] = useState<string | null>(null);

  // ── Activate / archive ────────────────────────────────────────────────────
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [showOptionalItems, setShowOptionalItems] = useState(false);

  // ── Mark complete (one-click finalize from the "ready" guidance card) ──────
  const [completing, setCompleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completeError, setCompleteError] = useState('');

  // ── Chat adoption: one-click "remind not-yet-joined teams" ────────────────
  /**
   * Which tournament has a reminder send in flight, or null. Deliberately an id rather than a
   * boolean: a bare flag made a click on a DIFFERENT event silently do nothing while a long batch
   * was still running elsewhere — the button looked enabled and simply ignored you.
   */
  const [remindingChatFor, setRemindingChatFor] = useState<string | null>(null);
  /**
   * The outcome of a reminder sent in THIS session, tagged with the tournament it belongs to so
   * switching events drops it without an effect having to clear it.
   *
   * `sentAt` is held locally as well as polled (S1-A) so the cooldown lands the instant a send
   * returns, rather than up to 30s later on the next poll — otherwise the button re-enables and
   * invites exactly the double-send it exists to prevent.
   */
  const [chatRemindSession, setChatRemindSession] = useState<
    { tournamentId: string; message: string | null; failed: boolean; sentAt: string | null } | null
  >(null);
  /**
   * Ticking clock for the reminder cooldown countdown — the wall clock is genuinely an external
   * store, so this is `useSyncExternalStore` rather than `Date.now()` during render (impure, and
   * only advances when something else happens to re-render).
   *
   * The snapshot is QUANTIZED to the minute deliberately: `getSnapshot` runs on every render and
   * React compares results, so returning a raw `Date.now()` would never compare equal and would
   * spin. Minute granularity is ample for an hours-granularity countdown. Server snapshot is 0,
   * which reads as "cooldown still running" rather than "send away" — the safe direction for an
   * email gate.
   */
  const nowMs = useSyncExternalStore(subscribeToMinuteTick, getMinuteNow, getMinuteNowServer);

  // ── Layout customization ──────────────────────────────────────────────────
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [expandedIconPicker, setExpandedIconPicker] = useState<StatCardId | null>(null);
  const [addMenuZone, setAddMenuZone] = useState<'stat' | 'panel' | null>(null);
  const [reuseDismissed, setReuseDismissed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load layout from localStorage after mount (client-only)
  useEffect(() => {
    if (currentOrg?.slug) setLayout(loadLayout(currentOrg.slug));
  }, [currentOrg?.slug]);

  // Reuse-setup banner: remember the "no thanks" decision per tournament (client-only).
  useEffect(() => {
    const id = currentTournament?.id;
    if (!id) { setReuseDismissed(false); return; }
    try {
      setReuseDismissed(localStorage.getItem(`flhq-help-dismissed-reuse-setup-${id}`) === '1');
    } catch { setReuseDismissed(false); }
  }, [currentTournament?.id]);

  function dismissReuseSetup() {
    const id = currentTournament?.id;
    if (!id) return;
    try { localStorage.setItem(`flhq-help-dismissed-reuse-setup-${id}`, '1'); } catch { /* ignore */ }
    setReuseDismissed(true);
  }

  const updateLayout = useCallback((next: DashboardLayout) => {
    setLayout(next);
    if (currentOrg?.slug) saveLayout(currentOrg.slug, next);
  }, [currentOrg?.slug]);

  const toggleCardVisible = (id: StatCardId, visible: boolean) =>
    updateLayout({ ...layout, statCards: layout.statCards.map(c => c.id === id ? { ...c, visible } : c) });
  const togglePanelVisible = (id: PanelId, visible: boolean) =>
    updateLayout({ ...layout, panels: layout.panels.map(p => p.id === id ? { ...p, visible } : p) });
  const toggleGameDayPartVisible = (id: GameDayPartId, visible: boolean) =>
    updateLayout({ ...layout, gameDayParts: layout.gameDayParts.map(p => p.id === id ? { ...p, visible } : p) });
  const setCardIcon = (id: StatCardId, icon: IconKey) =>
    updateLayout({ ...layout, statCards: layout.statCards.map(c => c.id === id ? { ...c, icon } : c) });

  function reorderById<T extends { id: string; order: number }>(arr: T[], activeId: string, overId: string): T[] {
    const sorted = [...arr].sort((a, b) => a.order - b.order);
    const oldIndex = sorted.findIndex(x => x.id === activeId);
    const newIndex = sorted.findIndex(x => x.id === overId);
    if (oldIndex < 0 || newIndex < 0) return arr;
    return arrayMove(sorted, oldIndex, newIndex).map((x, i) => ({ ...x, order: i }));
  }
  const onStatDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    updateLayout({ ...layout, statCards: reorderById(layout.statCards, String(active.id), String(over.id)) });
  };
  const onPanelDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    updateLayout({ ...layout, panels: reorderById(layout.panels, String(active.id), String(over.id)) });
  };
  const exitCustomize = () => { setIsCustomizing(false); setExpandedIconPicker(null); setAddMenuZone(null); };

  // ── Populate-from (draft only) ────────────────────────────────────────────
  type OtherTournament = { id: string; name: string; year: number | null; status: string | null };
  const [otherTournaments, setOtherTournaments] = useState<OtherTournament[]>([]);
  const [populateOpen, setPopulateOpen] = useState(false);
  const [populateSelected, setPopulateSelected] = useState<OtherTournament | null>(null);
  const [populateStep, setPopulateStep] = useState<'pick' | 'confirm'>('pick');
  const [populateWorking, setPopulateWorking] = useState(false);
  const [populateError, setPopulateError] = useState('');
  const [populateDone, setPopulateDone] = useState(false);
  const [populateCopied, setPopulateCopied] = useState<CloneCopiedCounts | null>(null);

  const canReuseSetup = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'tournament_cloning'));
  const reuseUpgradeCopy = requiresTournamentPlusCopy('tournament_cloning');

  // ── Fetch stats ───────────────────────────────────────────────────────────
  /** The current read, for the live refresh below (null while there is no tournament). */
  const pollStatsRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;
    const controller = new AbortController();
    const attemptKey = `${tournamentId}:${statsReloadKey}`;
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
          publishChecklist: {
            hasDates:         data?.publishChecklist?.hasDates         ?? false,
            hasDivisions:     data?.publishChecklist?.hasDivisions     ?? false,
            hasPublicContact: data?.publishChecklist?.hasPublicContact ?? false,
            hasOpenDivision:  data?.publishChecklist?.hasOpenDivision  ?? false,
            hasBranding:      data?.publishChecklist?.hasBranding      ?? false,
            hasVenues:        data?.publishChecklist?.hasVenues        ?? false,
            hasRules:         data?.publishChecklist?.hasRules         ?? false,
            hasFees:          data?.publishChecklist?.hasFees          ?? false,
            hasGameTiming:    data?.publishChecklist?.hasGameTiming    ?? false,
            hasTieBreakers:   data?.publishChecklist?.hasTieBreakers   ?? false,
            ready:            data?.publishChecklist?.ready            ?? false,
          },
          registration: {
            ...(data?.registration ?? EMPTY_STATS.registration),
            velocity: data?.registration?.velocity ?? 0,
            weeklyTrend: data?.registration?.weeklyTrend ?? [],
          },
          checkIn: data?.checkIn ?? EMPTY_STATS.checkIn,
          payment: {
            ...(data?.payment ?? EMPTY_STATS.payment),
            byDivision: data?.payment?.byDivision ?? [],
          },
          registrationAttention: data?.registrationAttention ?? EMPTY_STATS.registrationAttention,
        });
        setStatsError('');
        setStatsSettledFor(attemptKey);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStats(EMPTY_STATS);
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
  }, [currentTournament?.id, orgParam, statsReloadKey]);

  // Live auto-refresh (J1-086, and G6's shared rule): the board's figures move on their own every 30 s
  // while the tab is visible, and at once when it comes back. Cheap (one cached GET).
  // A finished event's board does not poll (Stage 4): nothing on it can change once results are locked,
  // and each read of a finished event also reads its recap — it reads fresh on every visit instead.
  const boardIsFinished = currentTournament?.status === 'completed' || currentTournament?.status === 'archived';
  useVisiblePoll(() => pollStatsRef.current?.(), { enabled: Boolean(currentTournament?.id) && !boardIsFinished });

  // Fetch other tournaments for populate-from
  useEffect(() => {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;
    fetch(`/api/admin/tournaments${orgQuery}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        const others = (data as Array<{ id: string; name: string; year: number | null; status: string | null }>)
          .filter(t => t.id !== tournamentId && t.status !== 'archived')
          .sort((a, b) => {
            const rankDiff = getSourceSortRank(a.status) - getSourceSortRank(b.status);
            if (rankDiff !== 0) return rankDiff;
            return (b.year ?? 0) - (a.year ?? 0);
          });
        setOtherTournaments(others);
      })
      .catch(() => {});
  }, [currentTournament?.id, orgQuery]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleActivate() {
    if (!currentTournament?.id || activating) return;
    setActivating(true); setActivateError(''); setShowActivateConfirm(false);
    try {
      const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-status', id: currentTournament.id, data: { status: 'active' } }),
      });
      const json = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to activate tournament.');
      await refreshTournaments();
      router.refresh();
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : 'Failed to activate tournament.');
    } finally { setActivating(false); }
  }

  /** Archive (the Tournament plan's finished board — FinishedBoard asks first). Throws the route's words. */
  async function archiveEvent() {
    if (!currentTournament?.id) return;
    const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-status', id: currentTournament.id, data: { status: 'archived' } }),
    });
    const json = await res.json().catch(() => null) as { error?: string } | null;
    if (!res.ok) throw new Error(json?.error ?? 'Couldn’t archive the tournament.');
    await refreshTournaments();
    router.refresh();
  }

  // Marks the tournament complete via the SAME server action as Settings, so the
  // results-summary email + read-only lock fire identically no matter where it's
  // triggered (the notify email is sent server-side on the transition to completed).
  async function handleComplete() {
    if (!currentTournament?.id || completing) return;
    // The question stays open until the change lands: a refusal is said in it (it used to close first,
    // so a refused Mark complete said nothing anywhere).
    setCompleting(true); setCompleteError('');
    try {
      const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-status', id: currentTournament.id, data: { status: 'completed' } }),
      });
      const json = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to mark tournament complete.');
      setShowCompleteConfirm(false);
      await refreshTournaments();
      // The finished board reads its recap on a fresh read (the poll is off once finished), so read again.
      setStatsReloadKey(k => k + 1);
      router.refresh();
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Failed to mark tournament complete.');
    } finally { setCompleting(false); }
  }

  async function handlePopulateConfirm() {
    if (!populateSelected || !currentTournament?.id) return;
    setPopulateWorking(true); setPopulateError('');
    try {
      const res = await fetch(
        `/api/admin/tournaments/${encodeURIComponent(currentTournament.id)}/populate-from${orgQuery}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceTournamentId: populateSelected.id,
            analytics: { sourceSurface: 'draft_dashboard', selectedCopyGroups: REUSE_SETUP_COPY_GROUPS, warningCount: 0, warningKeys: [] },
          }),
        },
      );
      const json = await res.json() as { copied?: CloneCopiedCounts; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to populate tournament.');
      setPopulateCopied(json.copied ?? null);
      setPopulateDone(true);
      await refreshTournaments();
      router.refresh();
    } catch (err) {
      setPopulateError(err instanceof Error ? err.message : 'Failed to populate tournament.');
    } finally { setPopulateWorking(false); }
  }

  function openPopulateModal() {
    setPopulateSelected(null); setPopulateStep('pick'); setPopulateError('');
    setPopulateDone(false); setPopulateCopied(null); setPopulateOpen(true);
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const status        = currentTournament?.status ?? 'draft';
  const isDraft       = status === 'draft';
  const isActive      = status === 'active';
  const isCompleted   = status === 'completed';
  // Completed, or archived (the context lists no archived event, so the second is a moment at most).
  const isFinished    = isCompleted || status === 'archived';

  const visibleStats  = currentTournament?.id ? stats : EMPTY_STATS;
  const checklist     = visibleStats.publishChecklist;
  const reg           = visibleStats.registration;
  const checkIn       = visibleStats.checkIn;
  const pay           = visibleStats.payment;
  const registrationAttention = visibleStats.registrationAttention;
  const gd            = visibleStats.gameDay;
  const isTournamentDay = visibleStats.isTournamentDay;
  const isGameDay = visibleStats.isGameDay;
  const populateCopiedSummary = copiedSummary(populateCopied);
  const commandCenterAvailable = currentOrg ? hasPlanFeature(currentOrg.planId, 'payment_readiness_tools') : false;
  const hasSummary = currentOrg ? hasPlanFeature(currentOrg.planId, 'post_tournament_summary') : false;
  const champions = visibleStats.champions;
  const registrationFollowUpBuckets = registrationAttention.buckets
    .filter(bucket => bucket.count > 0 && bucket.key !== 'pending_review' && bucket.key !== 'waitlist')
    .slice(0, 3);

  const daysUntil = computeDaysUntil(currentTournament?.startDate);

  // "Ready to finalize" — every non-cancelled game is in a terminal state AND, when the format
  // ends in a bracket, a playoff bracket exists (so a round robin whose bracket isn't built yet
  // never trips it early — see DASHBOARD_COMPLETION_GUIDANCE_PLAN, decision #2). An Exhibition
  // has no bracket to wait for. The rule itself lives in lib/tournament-phase (unit-tested);
  // this is what the guidance rail keys off to stop showing the live "game day" card once the
  // event is genuinely finished but still active (awaiting a manual complete).
  const tournamentHasPlayoffs = hasPlayoffs(currentTournament);
  const readyToFinalize = isReadyToFinalize({
    isActive,
    totalGames: gd.totalGames,
    resolvedGames: gd.resolved,
    playoffGamesTotal: gd.playoffGamesTotal,
    hasPlayoffs: tournamentHasPlayoffs,
  });
  // Active sub-states
  const isPreEvent      = isActive && daysUntil !== null && daysUntil > 0;
  const isPostEventActive = isActive && !isTournamentDay && (daysUntil === null || daysUntil <= 0);

  // ── Discovery & Orientation rail (help Layer 3) ─────────────────────────────
  // One stage-aware "what's next" card pinned at the top of each dashboard stage.
  // 'ready' wins over 'live' so a finished-but-active tournament is steered to finalize.
  const guidanceStage: GuidanceStage | null =
    isDraft ? 'draft'
    : isActive ? (readyToFinalize ? 'ready' : isGameDay ? 'live' : isPreEvent ? 'pre' : 'post')
    : null; // archived → no rail
  const guidanceRail = (guidanceStage && currentOrg?.slug && currentTournament?.id) ? (() => {
    const ctx = {
      orgSlug: currentOrg.slug,
      tournamentSlug: currentTournament.slug,
      planId: currentOrg.planId,
      daysUntil,
      checklist: { hasDates: checklist.hasDates, hasDivisions: checklist.hasDivisions, ready: checklist.ready },
      hasPlayoffs: tournamentHasPlayoffs,
    };
    return (
      <GuidanceRail
        guidance={getGuidance(guidanceStage, ctx)}
        shortcuts={getStageShortcuts(guidanceStage, ctx)}
        tournamentId={currentTournament.id}
        live={guidanceStage === 'live'}
        ready={guidanceStage === 'ready'}
        collapsible={guidanceStage === 'live' || guidanceStage === 'pre'}
        onAction={(actionId) => { if (actionId === 'complete') { setCompleteError(''); setShowCompleteConfirm(true); } }}
      />
    );
  })() : null;

  // Persona panel ("what everyone else sees") — DRAFT only. It's pre-launch
  // orientation (its cards say "Once you activate…"), so it retires the moment the
  // tournament goes live — at that point the live board IS what everyone sees, and
  // keeping this panel just pushes the game-day metrics below the fold.
  const personaPanel = (currentOrg?.slug && currentTournament?.id && isDraft) ? (
    <PersonaPanel
      orgSlug={currentOrg.slug}
      tournamentSlug={currentTournament.slug}
      tournamentId={currentTournament.id}
      planId={currentOrg.planId}
      isDraft={isDraft}
    />
  ) : null;

  // Cards that don't apply to the current tournament phase — suppressed regardless of saved layout
  const contextHidden = new Set<StatCardId>();
  if (isActive) {
    if (!isGameDay) contextHidden.add('completed'); // no games played yet
    else            contextHidden.add('days');      // countdown irrelevant once underway
  }

  // Layout-derived
  const visibleCards  = layout.statCards.filter(c => c.visible).sort((a, b) => a.order - b.order);
  const renderedCards = visibleCards.filter(c => !contextHidden.has(c.id));
  const sortedPanels  = [...layout.panels].sort((a, b) => a.order - b.order).filter(p => p.visible);
  const hiddenStatCards = [...layout.statCards].filter(c => !c.visible).sort((a, b) => a.order - b.order)
    .map(c => ({ id: c.id, label: c.label, icon: c.icon }));
  const hiddenPanels = [...layout.panels].filter(p => !p.visible).sort((a, b) => a.order - b.order)
    .map(p => ({ id: p.id, label: p.label }));
  const gameDayPartShown = (id: GameDayPartId) => layout.gameDayParts.find(p => p.id === id)?.visible ?? true;

  // Checklist
  type ChecklistItem = { key: string; done: boolean; label: string; desc: string; href: string; action: string; help?: { title: string; body: string } };
  const checklistItems: ChecklistItem[] = [
    { key: 'dates',         done: checklist.hasDates,        label: 'Tournament dates',                            desc: 'Set a start and end date so teams know when the event runs.',     href: `${base}/settings/event?section=overview`, action: 'Edit dates'     },
    { key: 'divisions',     done: checklist.hasDivisions,    label: 'At least one division',                       desc: 'Create the divisions teams can register for.',                     href: `${base}/divisions`,      action: 'Add divisions',  help: { title: 'Divisions', body: 'The group teams register into — usually by age or skill, e.g. U12 Boys or Competitive. You need at least one before going live.' } },
  ];
  const completedCount = checklistItems.filter(i => i.done).length;

  // Optional items are grouped into three tiers so the drawer reads as guidance, not a junk drawer:
  //   recommended — worth doing before go-live (no defaults; skipping leaves a real gap)
  //   defaults    — already work out of the box; always show the current value so it's discoverable + tunable
  //   choice      — genuine workflow forks (open online vs. load teams yourself; fees), not chores
  type OptionalItem = {
    key: string;
    group: 'recommended' | 'defaults' | 'choice';
    done: boolean;
    label: string;
    href: string;
    desc?: string;
    subLabel?: string;
    action?: string;
    help?: { title: string; body: string };
  };
  const optionalItems: OptionalItem[] = [
    // ── Recommended before go-live ──────────────────────────────────────────
    { key: 'venues',   group: 'recommended', done: checklist.hasVenues,   label: 'Venues & fields',   desc: 'Add your playing fields so teams know where to show up.',                 href: `${base}/venues`,   action: 'Add venues →',  help: { title: 'Venues & fields', body: "Save your fields once and reuse them across games. They appear on the public schedule and each game so teams and fans know where to go — you can still type a one-off location on a single game." } },
    { key: 'branding', group: 'recommended', done: checklist.hasBranding, label: 'Public page',       desc: 'Control visibility and public presentation of your tournament page.',    href: `${base}/branding`, action: 'Manage page →', help: { title: 'Public page', body: "The page fans and teams see — schedule, standings, teams, and news. Control what's visible, and (on Tournament Plus) its branding." } },
    { key: 'rules',    group: 'recommended', done: checklist.hasRules,    label: 'Rules & resources', desc: 'Upload rulebooks or documents teams need before the tournament.',         href: `${base}/rules`,    action: 'Add rules →',   help: { title: 'Rules & resources', body: 'Post rulebooks, waivers, or documents teams need. They show on your public tournament site.' } },
    // ── Defaults you can fine-tune (always show the value in the sub-label) ──
    { key: 'game-timing',  group: 'defaults', done: checklist.hasGameTiming,  label: 'Game timing',       subLabel: '90 min games / 15 min buffer, tournament-wide', href: `${base}/settings/event?section=schedule`, help: { title: 'Game timing', body: 'Sets the default game length and the buffer between games — used when the schedule is built. The default is 90-minute games with a 15-minute turnaround.' } },
    { key: 'tie-breakers', group: 'defaults', done: checklist.hasTieBreakers, label: 'Tie-breaker rules', subLabel: 'H2H → Run Diff → Runs For → Runs Against',      href: `${base}/settings/event?section=schedule`, help: { title: 'Tie-breaker rules', body: 'When teams finish with the same record, these rules decide their ranking — head-to-head first, then run differential, and so on. The defaults suit most tournaments.' } },
    { key: 'contact',      group: 'defaults', done: checklist.hasPublicContact, label: 'Contact email',   subLabel: 'Defaults to your org contact email — override optional', href: `${base}/settings/event?section=contact`, help: { title: 'Contact email', body: "The address teams reach you at. It shows on the public tournament page and is included in emails to coaches and teams. Defaults to your organization's contact email if you don't set a specific one." } },
    // ── Registration & fees — your call ─────────────────────────────────────
    { key: 'open-division', group: 'choice', done: checklist.hasOpenDivision, label: 'Open public registration', desc: 'Open a division when you want teams to register online — skip this if you are loading or inviting teams yourself.', href: `${base}/divisions`, action: 'Open divisions →', help: { title: 'Open public registration', body: "Open a division to let teams sign up through your public registration form. Skip it if you're adding or inviting teams yourself." } },
    { key: 'fees',          group: 'choice', done: checklist.hasFees,          label: 'Fee approach',             desc: 'Confirm how registration fees work — or mark the event as free. You can activate without this.',                href: `${base}/settings/event?section=fees`, action: 'Configure fees →', help: { title: 'Fee approach', body: 'Choose how teams pay — a single fee, a deposit plus balance, or free. Teams see this at registration; you can activate without setting it.' } },
  ];
  const optionalGroups = [
    { key: 'recommended', label: 'Recommended before go-live',         tag: 'Recommended' },
    { key: 'defaults',    label: 'Defaults you can fine-tune',         tag: 'Default'     },
    { key: 'choice',      label: 'Registration & fees — your call',    tag: 'Your call'   },
  ] as const;

  // Schedule row — flag colored/iconed by schedule health rather than a simple done/pending.
  const scheduleHealth = visibleStats.scheduleHealth;
  const scheduleIsSetUp = scheduleHealth.timedGames > 0;
  const scheduleStatus: {
    tone: 'good' | 'warning' | 'danger' | 'neutral';
    statusText: string;
    desc: string;
  } = !scheduleIsSetUp
    ? { tone: 'neutral', statusText: 'Not set up', desc: 'Build a timed schedule so teams know when and where they play.' }
    : scheduleHealth.tone === 'danger'
      ? { tone: 'danger', statusText: 'Needs work', desc: `${scheduleHealth.timedGames}/${scheduleHealth.totalGames} timed · ${scheduleHealth.issueCount} issue${scheduleHealth.issueCount === 1 ? '' : 's'} to resolve.` }
      : scheduleHealth.tone === 'warning'
        ? { tone: 'warning', statusText: 'Review', desc: `${scheduleHealth.timedGames}/${scheduleHealth.totalGames} timed · ${scheduleHealth.issueCount} issue${scheduleHealth.issueCount === 1 ? '' : 's'} to review.` }
        : { tone: 'good', statusText: 'Healthy', desc: `${scheduleHealth.timedGames}/${scheduleHealth.totalGames} timed games · no major issues.` };

  // A built schedule with real conflicts is the most consequential pre-launch gap — lift it
  // out of the collapsed drawer to above the toggle, but ONLY when it's actually broken.
  const scheduleFloatsUp = scheduleIsSetUp && (scheduleStatus.tone === 'warning' || scheduleStatus.tone === 'danger');

  // Drawer "N reviewed" count includes the schedule row (named in the toggle label), so the
  // count stays honest with what the drawer contains. Schedule counts once it's been built.
  const optionalTotalCount = optionalItems.length + 1;
  const optionalReviewedCount = optionalItems.filter(i => i.done).length + (scheduleIsSetUp ? 1 : 0);

  // Activate-confirm summary: recommended items still missing + defaults that will apply as-is.
  const recommendedGaps = [
    !scheduleIsSetUp ? 'Tournament schedule' : scheduleFloatsUp ? 'Tournament schedule — review issues' : null,
    !checklist.hasVenues ? 'Venues & fields' : null,
    !checklist.hasBranding ? 'Public page' : null,
    !checklist.hasRules ? 'Rules & resources' : null,
  ].filter((g): g is string => g !== null);
  const defaultsApplying = [
    !checklist.hasGameTiming ? 'Game timing: 90 min games / 15 min buffer' : null,
    !checklist.hasTieBreakers ? 'Tie-breakers: H2H → Run Diff → Runs For → Runs Against' : null,
  ].filter((d): d is string => d !== null);

  // Schedule row — shared between the float-up slot and the in-drawer Recommended group.
  // Label-as-link (row is a <div>) so the concept tooltip's <button> isn't nested in an <a>.
  function renderScheduleRow() {
    return (
      <div
        key="schedule"
        className={`${styles.checklistRow} ${scheduleStatus.tone === 'good' ? styles.checklistRowDone : styles.checklistRowPending}`}
      >
        <span className={styles.rowIcon} data-sched-tone={scheduleStatus.tone}>
          {scheduleStatus.tone === 'good' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        </span>
        <Link href={`${base}/schedule`} className={styles.rowLabelLink}>Tournament schedule</Link>
        <span className={styles.rowHelp}><HelpTooltip title="Tournament schedule" body="Build the games teams play — a round robin, pool play, or a playoff bracket. Teams and fans see it on the public schedule with times and locations." /></span>
        <span className={styles.rowOptTag}>Recommended</span>
        <span className={styles.rowStatus} data-sched-tone={scheduleStatus.tone}>{scheduleStatus.statusText}</span>
        <span className={styles.rowDesc}>{scheduleStatus.desc}</span>
      </div>
    );
  }

  // One optional row. Every row makes the LABEL the link (so a concept "?" tooltip can sit beside
  // it without nesting a <button> in an <a>); the tooltip carries the "what/why/where" context,
  // distinct from the short action nudge shown while the item is undone.
  function renderOptionalRow(item: OptionalItem, tag: string) {
    const isDefault = item.group === 'defaults';
    const Icon = item.done ? CheckCircle2 : isDefault ? Settings : item.group === 'recommended' ? AlertCircle : Info;
    // Amber only for recommended gaps; defaults + "your call" stay neutral (no nag tone).
    const muteIcon = !item.done && item.group !== 'recommended';
    const statusText = item.done ? (isDefault ? 'Customized' : 'Done') : isDefault ? 'Review →' : item.action;
    return (
      <div key={item.key} className={`${styles.checklistRow} ${item.done ? styles.checklistRowDone : styles.checklistRowPending}`}>
        <span className={`${styles.rowIcon} ${muteIcon ? styles.rowIconMuted : ''}`}><Icon size={16} /></span>
        <Link href={item.href} className={styles.rowLabelLink}>{item.label}</Link>
        {item.help && <span className={styles.rowHelp}><HelpTooltip title={item.help.title} body={item.help.body} /></span>}
        <span className={styles.rowOptTag}>{tag}</span>
        <span className={styles.rowStatus}>{statusText}</span>
        {item.subLabel
          ? <span className={styles.rowDesc}>{item.subLabel}</span>
          : (!item.done && item.desc) ? <span className={styles.rowDesc}>{item.desc}</span> : null}
      </div>
    );
  }

  // ── Compact metric strip (replaces stat cards on active/completed) ──────
  function renderMetricStrip() {
    const items: Array<{ value: number; label: string }> = [
      { value: visibleStats.teams, label: 'Teams' },
      { value: visibleStats.scheduled, label: 'Scheduled' },
    ];
    if (isActive && daysUntil !== null && daysUntil > 0) {
      items.push({ value: daysUntil, label: 'Days Away' });
    }
    if (isCompleted) {
      items.push({ value: visibleStats.completed, label: 'Completed' });
    }
    return (
      <div className={styles.metricStrip}>
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && <span className={styles.metricSep} aria-hidden>·</span>}
            <span className={styles.metricItem}>
              <span className={styles.metricValue}><CountUp value={item.value} /></span>
              <span className={styles.metricLabel}>{item.label}</span>
            </span>
          </Fragment>
        ))}
      </div>
    );
  }

  // ── Panel renderers ───────────────────────────────────────────────────────
  /**
   * S1-A (owner, 2026-07-29): the chat sign-up reminder stands down for 24h per tournament.
   * Must match REMINDER_COOLDOWN_MS in the send route — the server is authoritative; this only
   * decides whether the button is offered.
   */
  const CHAT_REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  /** "Reminded just now" / "Reminded 3 hours ago" — the disabled button's own label. */
  function formatRemindedAgo(sentMs: number, now: number): string {
    const mins = Math.floor(Math.max(0, now - sentMs) / 60_000);
    if (mins < 1)  return 'Reminded just now';
    if (mins < 60) return `Reminded ${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    return `Reminded ${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  }

  function fmtShortDate(iso: string): string {
    const [y, m, d] = iso.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function sendChatSignupReminders() {
    const tid = currentTournament?.id;
    // Only block a repeat click on the SAME event; a different event's send is its own business.
    if (!tid || remindingChatFor === tid) return;
    setRemindingChatFor(tid);
    setChatRemindSession({ tournamentId: tid, message: null, failed: false, sentAt: null });
    try {
      const res = await fetch(`/api/admin/tournaments/${tid}/chat/remind-signups${orgQuery}`, { method: 'POST' });
      const data = await res.json().catch(() => null) as
        { sent?: number; failed?: number; userMessage?: string; cooldown?: boolean; reminderLastSentAt?: string | null } | null;
      if (!res.ok) {
        // Show ONLY `userMessage` — the server's explicit "safe to show a person" channel (cooldown,
        // finished event). Everything else, including raw driver errors and bare status words like
        // "Forbidden", falls back to the generic line.
        const safe = typeof data?.userMessage === 'string' ? data.userMessage.trim() : '';
        setChatRemindSession({
          tournamentId: tid,
          message: safe || 'Could not send reminders. Please try again.',
          failed: true,
          // A cooldown rejection carries the stamp that caused it — adopt it so the button settles
          // into its stood-down state immediately instead of staying clickable.
          sentAt: data?.cooldown ? data.reminderLastSentAt ?? null : null,
        });
        return;
      }
      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      setChatRemindSession({
        tournamentId: tid,
        message: sent === 0 && failed === 0
          ? 'No teams to remind right now.'
          : `Reminder sent to ${sent} team${sent !== 1 ? 's' : ''}${failed ? ` · ${failed} couldn't be sent` : ''}.`,
        failed: failed > 0,
        sentAt: data?.reminderLastSentAt ?? null,
      });
    } catch {
      setChatRemindSession({
        tournamentId: tid,
        message: 'Could not send reminders. Please try again.',
        failed: true,
        sentAt: null,
      });
    } finally {
      // Clear only if this send is still the one in flight — a later send for another event owns
      // the flag now and must not be cancelled by this one finishing.
      setRemindingChatFor(prev => (prev === tid ? null : prev));
    }
  }

  function renderTournamentChatPanel() {
    const ca = visibleStats.chatAdoption;
    const statsSettled = statsSettledFor === `${currentTournament?.id}:${statsReloadKey}`;
    // Reminder outcome from this session, but only if it belongs to the tournament on screen.
    const remindSession = chatRemindSession?.tournamentId === currentTournament?.id ? chatRemindSession : null;
    // In-flight only counts for the event that started it.
    const sending = remindingChatFor != null && remindingChatFor === currentTournament?.id;

    // STILL LOADING — this tournament's fetch hasn't settled. Deliberately NOT `!ca && !settled`:
    // `stats` keeps the previous tournament's numbers until the new fetch lands, so gating on `ca`
    // alone would show one event's sign-up figures under another event's name.
    if (!statsSettled) {
      return (
        <section className={styles.analyticsPanel}>
          <div className={styles.panelHeader}>
            <MessageCircle size={16} style={kx(ICON_MUTED_LEGACY, KIT_INK.tertiary)} />
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Coach Sign-ups &amp; Chat</h2>
          </div>
          <div className={styles.chatSkeleton} aria-busy="true" aria-label="Loading coach sign-up figures">
            <span className={`${styles.chatSkelBar} ${styles.chatSkelNum}`} />
            <span className={`${styles.chatSkelBar} ${styles.chatSkelGauge}`} />
            <span className={`${styles.chatSkelBar} ${styles.chatSkelLine}`} />
            <span className={`${styles.chatSkelBar} ${styles.chatSkelLineShort}`} />
          </div>
        </section>
      );
    }

    // GENUINELY FAILED — always render the card, never `return null`.
    //
    // An earlier revision suppressed this whenever the page-level error banner was showing, to
    // avoid saying it twice. That was wrong: the banner fires for ANY failure of the combined
    // stats endpoint, which is the common case, so the panel simply vanished — and in Customize
    // mode left an unlabelled drag box behind. A duplicated sentence is a far smaller problem
    // than a panel that disappears, and this is the only place offering a retry.
    if (!ca) {
      return (
        <section className={styles.analyticsPanel}>
          <div className={styles.panelHeader}>
            <MessageCircle size={16} style={kx(ICON_MUTED_LEGACY, KIT_INK.tertiary)} />
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Coach Sign-ups &amp; Chat</h2>
          </div>
          <div className={styles.emptyPanel}>
            <span>Couldn&rsquo;t load coach sign-up figures. Your coaches and the chat room are unaffected.</span>
            <button
              type="button"
              className={styles.chatRetryBtn}
              onClick={() => setStatsReloadKey(k => k + 1)}
            >
              Try again
            </button>
          </div>
        </section>
      );
    }

    // LOCKED — the host org's plan doesn't include Tournament Chat. Doubles as discovery: the
    // link lands on the chat page's UpgradeGate, which carries the real upgrade CTA.
    if (!ca.eligible) {
      return (
        <section className={styles.analyticsPanel}>
          <div className={styles.panelHeader}>
            <MessageCircle size={16} style={kx(ICON_MUTED_LEGACY, KIT_INK.tertiary)} />
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Coach Sign-ups &amp; Chat</h2>
          </div>
          <div className={styles.emptyPanel}>
            <span>{ca.upsellCopy ?? 'Tournament Chat is included with Tournament Plus, League Plus, and Club.'}</span>
            <Link href={`${base}/chat`} className={styles.panelLink}>See Tournament Chat →</Link>
          </div>
        </section>
      );
    }

    const denom = ca.teamsTotal;
    const teamsNoEmail = Math.max(0, ca.teamsTotal - ca.teamsWithEmail);

    // Who may actually send. Mirrors the send route's own guard exactly, so nobody is offered a
    // button that will bounce — the server check stays authoritative either way.
    const canRemind =
      hasCapability(userRole ?? 'official', userCapabilities, 'manage_registrations') ||
      hasCapability(userRole ?? 'official', userCapabilities, 'create_tournaments');

    // S1-A — 24h per-tournament stand-down. Prefer the stamp this session just produced over the
    // polled one so the button stands down immediately rather than on the next 30s refresh.
    const lastSentIso = remindSession?.sentAt ?? ca.reminderLastSentAt;
    const lastSentMs = lastSentIso ? Date.parse(lastSentIso) : NaN;
    const cooledUntil = Number.isFinite(lastSentMs) ? lastSentMs + CHAT_REMIND_COOLDOWN_MS : 0;
    const inCooldown = cooledUntil > nowMs;
    // Clamped to 24: `nowMs` is floored to the minute, so a fresh send would otherwise round up to
    // "25 hours" — an hour longer than the cooldown actually is.
    const hoursLeft = inCooldown
      ? Math.min(24, Math.max(1, Math.ceil((cooledUntil - nowMs) / 3_600_000)))
      : 0;
    return (
      <section className={styles.analyticsPanel}>
        <div className={styles.panelHeader}>
          <MessageCircle size={16} style={kx(ICON_ACCENT_LEGACY, KIT_INK.accent)} />
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Coach Sign-ups &amp; Chat</h2>
          <Link href={`${base}/chat`} className={styles.panelLink}>Open Chat →</Link>
        </div>
        {denom === 0 ? (
          <div className={styles.emptyPanel}>
            <span>No teams registered yet. Coaches get a live group chat once they claim their team portal.</span>
          </div>
        ) : (
          <>
            <div className={styles.chatFunnelRow}>
              <span className={styles.commsStatNum}>{ca.coachesSignedUp}</span>
              <span className={styles.chatFunnelOf}>of {denom} coach{denom !== 1 ? 'es' : ''} signed up</span>
            </div>
            <GaugeBar value={ca.coachesSignedUp} max={denom} />

            <div className={styles.commsStats}>
              {ca.roomOpen && (
                <>
                  <span className={styles.commsStat}>
                    <span className={styles.commsStatNum}>{ca.inChat}</span>
                    <span className={styles.commsStatLabel}>in the chat</span>
                  </span>
                  <span className={styles.commsDot} />
                </>
              )}
              <span className={styles.commsStat}>
                <span className={styles.commsStatNum}>{ca.notJoined}</span>
                <span className={styles.commsStatLabel}>not yet joined</span>
              </span>
            </div>

            {teamsNoEmail > 0 && (
              <p className={styles.chatWarn}>
                {teamsNoEmail} team{teamsNoEmail !== 1 ? 's have' : ' has'} no coach email on file —{' '}
                <Link href={`${base}/registrations?attention=missing_email`} className={styles.chatWarnLink}>add one so they can be invited →</Link>
              </p>
            )}

            {!ca.roomOpen ? (
              <p className={styles.chatExplain}>Open chat to give every signed-up coach a group room — they join automatically.</p>
            ) : (
              <>
                <p className={styles.chatExplain}>Signed-up coaches get a live group chat with you, plus their schedule, scores, and your announcements.</p>

                {remindSession?.message && (
                  <p className={`${styles.chatRemindResult} ${remindSession.failed ? styles.chatRemindResultBad : styles.chatRemindResultOk}`}>
                    {remindSession.message}
                  </p>
                )}

                {ca.notJoined === 0 ? (
                  <span className={styles.chatAllIn}>Every team&rsquo;s coach is signed up 🎉</span>
                ) : ca.reminderRetired ? (
                  /* CH-1 — the event has finished. The room stays readable; the chase stops. */
                  <span className={styles.chatExplain}>
                    This tournament has finished — the chat stays open to read, but sign-up reminders are no longer sent.
                  </span>
                ) : !canRemind ? (
                  /* Fix 02 — no button they cannot use, and no bare "Forbidden" when they try. */
                  <span className={styles.chatExplain}>
                    {ca.notJoined} team{ca.notJoined !== 1 ? 's' : ''} haven&rsquo;t signed up yet. An organizer with registration access can send them a reminder.
                  </span>
                ) : ca.notJoinedRemindable === 0 ? (
                  <span className={styles.chatExplain}>
                    The teams not yet joined have no email on file to remind —{' '}
                    <Link href={`${base}/registrations?attention=missing_email`} className={styles.chatExplainLink}>add one →</Link>
                  </span>
                ) : inCooldown ? (
                  /* Fix 01 — stood down so the same coaches can't be mailed again on a second click. */
                  <>
                    <button type="button" className={styles.chatRemindBtn} disabled>
                      {formatRemindedAgo(cooledUntil - CHAT_REMIND_COOLDOWN_MS, nowMs)}
                    </button>
                    <p className={styles.chatExplain}>
                      You can send another reminder in {hoursLeft} hour{hoursLeft !== 1 ? 's' : ''}.
                    </p>
                  </>
                ) : (
                  /* `sending` is scoped to this tournament: a send in flight for a DIFFERENT event
                     must not disable the button here. */
                  <button type="button" className={styles.chatRemindBtn} onClick={sendChatSignupReminders} disabled={sending}>
                    {sending ? 'Sending…' : `Remind ${ca.notJoinedRemindable} team${ca.notJoinedRemindable !== 1 ? 's' : ''} to sign up →`}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </section>
    );
  }

  function renderCommunicationsPanel() {
    const comms = visibleStats.communications;
    return (
      <section className={styles.analyticsPanel}>
        <div className={styles.panelHeader}>
          <Megaphone size={16} style={kx(ICON_ACCENT_LEGACY, KIT_INK.accent)} />
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Communications</h2>
          <Link href={`${base}/communication`} className={styles.panelLink}>Manage →</Link>
        </div>
        {comms.total > 0 ? (
          <>
            <div className={styles.commsStats}>
              <span className={styles.commsStat}>
                <span className={styles.commsStatNum}>{comms.total}</span>
                <span className={styles.commsStatLabel}>announcement{comms.total !== 1 ? 's' : ''}</span>
              </span>
              {comms.emailsSent > 0 && (
                <>
                  <span className={styles.commsDot} />
                  <span className={styles.commsStat}>
                    <span className={styles.commsStatNum}>{comms.emailsSent}</span>
                    <span className={styles.commsStatLabel}>email{comms.emailsSent !== 1 ? 's' : ''} sent</span>
                  </span>
                </>
              )}
              {comms.totalRecipients > 0 && (
                <>
                  <span className={styles.commsDot} />
                  <span className={styles.commsStat}>
                    <span className={styles.commsStatNum}>{comms.totalRecipients}</span>
                    <span className={styles.commsStatLabel}>recipients</span>
                  </span>
                </>
              )}
            </div>
            {comms.latestTitle && (
              <div className={styles.commsLatest}>
                <span className={styles.commsLatestTag}>Latest</span>
                <div className={styles.commsLatestBody}>
                  <span className={styles.commsLatestTitle}>{comms.latestTitle}</span>
                  {comms.latestDate && (
                    <span className={styles.commsLatestDate}>{fmtShortDate(comms.latestDate)}</span>
                  )}
                </div>
              </div>
            )}
            <Link href={`${base}/communication`} className={styles.commsAction}>
              Send announcement →
            </Link>
          </>
        ) : (
          <div className={styles.emptyPanel}>
            <span>No announcements sent yet.</span>
            <Link href={`${base}/communication`} className={styles.panelLink}>Send your first →</Link>
          </div>
        )}
      </section>
    );
  }

  // Schedule health's body — the before-the-event board's panel, and what the game-day board's health
  // row opens in place (G2: "Schedule health as a row that expands in place").
  function renderScheduleHealthBody() {
    const health = visibleStats.scheduleHealth;
    const hasTimedSchedule = health.timedGames > 0;
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
    return hasTimedSchedule ? (
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
        ) : (
          <div className={styles.emptyPanel}>
            <span>No timed schedule generated yet.</span>
            <Link href={`${base}/schedule`} className={styles.panelLink}>Build schedule →</Link>
          </div>
        );
  }

  function renderScheduleHealthPanel() {
    const health = visibleStats.scheduleHealth;
    return (
      // data-sandbox-tour: the beat the "Break the schedule" tour chip points at in the
      // "See it live" sandbox. An inert attribute — nothing reads it outside a demo org.
      <section className={`${styles.analyticsPanel} ${styles.scheduleHealthPanel}`} data-tone={health.tone} data-sandbox-tour="schedule-health">
        <div className={styles.panelHeader}>
          <Activity size={16} style={kx(ICON_ACCENT_LEGACY, KIT_INK.accent)} />
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Schedule Health</h2>
          <Link href={`${base}/schedule`} className={styles.panelLink}>Review →</Link>
        </div>
        {renderScheduleHealthBody()}
      </section>
    );
  }

  function renderRegistrationPanel() {
    const divCapacity = reg.byDivision.reduce((sum, d) => d.capacity != null ? sum + d.capacity : sum, 0);
    const regCapacity = reg.totalCapacity > 0 ? reg.totalCapacity : divCapacity;
    const hasDivCapacity = reg.byDivision.some(d => d.capacity != null && d.capacity > 0);
    return (
      <section className={styles.analyticsPanel}>
        <div className={styles.panelHeader}>
          <Users size={16} style={kx(ICON_ACCENT_LEGACY, KIT_INK.accent)} />
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Registration</h2>
          {reg.velocity > 0 && (
            <span className={styles.velocityChip}>
              <TrendingUp size={11} />
              +{reg.velocity} this week
            </span>
          )}
          <Sparkline data={reg.weeklyTrend} />
          <Link href={`${base}/registrations`} className={styles.panelLink}>View teams →</Link>
        </div>
        <div className={styles.mainGauge}>
          <div className={styles.gaugeFigures}>
            <span className={styles.gaugeMain}><CountUp value={reg.totalAccepted} /></span>
            {regCapacity > 0 && <span className={styles.gaugeOf}>/ {regCapacity}</span>}
            <span className={styles.gaugeLabel}>{regCapacity > 0 ? 'spots filled' : 'accepted'}</span>
          </div>
          {regCapacity > 0 && <GaugeBar value={reg.totalAccepted} max={regCapacity} />}
        </div>

        {reg.byDivision.length > 0 && (
          <div className={styles.registrationStatusTable}>
            <div className={styles.registrationStatusHeader}>
              <span>Division</span>
              <span>Accepted</span>
              <span>Pending</span>
              <span>Waitlist</span>
            </div>
            {reg.byDivision.map(d => (
              <div key={d.id} className={styles.registrationStatusRow}>
                <span className={styles.registrationDivisionName}>{d.name}</span>
                <Link href={`${base}/registrations?division=${encodeURIComponent(d.id)}`} className={styles.registrationStatusCount} data-status="accepted">
                  {hasDivCapacity && d.capacity != null ? `${d.accepted}/${d.capacity}` : d.accepted}
                </Link>
                <Link href={`${base}/registrations?division=${encodeURIComponent(d.id)}&attention=pending_review`} className={styles.registrationStatusCount} data-status="pending">{d.pending}</Link>
                <Link href={`${base}/registrations?division=${encodeURIComponent(d.id)}&attention=waitlist`} className={styles.registrationStatusCount} data-status="waitlist">{d.waitlist}</Link>
              </div>
            ))}
          </div>
        )}

        {registrationFollowUpBuckets.length > 0 && (
          <div className={styles.registrationFollowUps}>
            <AlertCircle size={13} aria-hidden />
            <span>Also needs attention</span>
            <div className={styles.registrationFollowUpChips}>
              {registrationFollowUpBuckets.map(bucket => {
                const locked = Boolean(bucket.plusOnly && !commandCenterAvailable);
                const href = locked ? subscriptionHref : `${base}/registrations?attention=${bucket.key}`;
                return (
                  <Link key={bucket.key} href={href} className={styles.registrationFollowUpChip} data-tone={bucket.tone} data-locked={locked || undefined}>
                    <strong>{bucket.count}</strong>{bucket.shortLabel}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>
    );
  }

  function renderPaymentPanel() {
    const hasDivBreakdown = pay.byDivision.some(d => d.total > 0) && pay.byDivision.length > 1;
    return (
      <section className={styles.analyticsPanel}>
        <div className={styles.panelHeader}>
          <DollarSign size={16} style={kx(ICON_ACCENT_LEGACY, KIT_INK.accent)} />
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Payments</h2>
          <Link href={`${base}/registrations`} className={styles.panelLink}>View teams →</Link>
        </div>
        {pay.hasFeeSchedule ? (
          <>
            <div className={styles.mainGauge}>
              <div className={styles.gaugeFigures}>
                <span className={styles.gaugeMain}>{fmt(pay.totalCollected)}</span>
                <span className={styles.gaugeOf}>/ {fmt(pay.totalExpected)}</span>
                <span className={styles.gaugeLabel}>collected</span>
              </div>
              <GaugeBar value={pay.totalCollected} max={pay.totalExpected} />
            </div>
            {(pay.totalExpected - pay.totalCollected) > 0 && (
              <div className={styles.outstandingRow}>
                <TrendingUp size={13} />
                <span>{fmt(pay.totalExpected - pay.totalCollected)} outstanding</span>
              </div>
            )}
            <div className={styles.paymentBreakdown}>
              {pay.counts.paid        > 0 && <div className={styles.payRow}><span className="badge badge-success">{pay.counts.paid}</span><span>Paid in full</span></div>}
              {pay.counts.depositPaid > 0 && <div className={styles.payRow}><span className="badge badge-info">{pay.counts.depositPaid}</span><span>Deposit paid</span></div>}
              {pay.counts.pending     > 0 && <div className={styles.payRow}><span className="badge badge-warning">{pay.counts.pending}</span><span>Pending</span></div>}
              {pay.counts.pastDue     > 0 && <div className={styles.payRow}><span className="badge badge-danger">{pay.counts.pastDue}</span><span>Past due</span></div>}
            </div>

            {hasDivBreakdown && (
              <div className={styles.payDivTable}>
                <div className={styles.payDivHeader}>
                  <span>Division</span>
                  <span>Paid</span>
                  <span>Deposit</span>
                  <span>Pending</span>
                  <span>Past Due</span>
                </div>
                {pay.byDivision.filter(d => d.total > 0).map(d => (
                  <div key={d.id} className={styles.payDivRow}>
                    <span className={styles.payDivName}>{d.name}</span>
                    <Link href={`${base}/registrations?division=${encodeURIComponent(d.id)}&payment=paid`} className={styles.payDivCell} data-tone={d.paid > 0 ? 'success' : undefined}>{d.paid}</Link>
                    <Link href={`${base}/registrations?division=${encodeURIComponent(d.id)}&payment=deposit`} className={styles.payDivCell} data-tone={d.depositPaid > 0 ? 'info' : undefined}>{d.depositPaid}</Link>
                    <Link href={`${base}/registrations?division=${encodeURIComponent(d.id)}&payment=pending`} className={styles.payDivCell} data-tone={d.pending > 0 ? 'warning' : undefined}>{d.pending}</Link>
                    <Link href={`${base}/registrations?division=${encodeURIComponent(d.id)}&attention=past_due`} className={styles.payDivCell} data-tone={d.pastDue > 0 ? 'danger' : undefined}>{d.pastDue}</Link>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyPanel}>
            <span>No fee schedule configured.</span>
            <Link href={`${base}/manage`} className={styles.panelLink}>Set up fees →</Link>
          </div>
        )}
      </section>
    );
  }

  // ── Edit-mode toolbar ─────────────────────────────────────────────────────
  // On the game-day board Customize shows and hides the board's parts (owner 2026-09-29): one
  // checkbox per part, in the day's order, which Customize never changes. The before-the-event
  // board keeps its drag-to-reorder panels.
  function renderEditToolbar() {
    const gameDayBoard = isActive && isGameDay;
    return (
      <div className={styles.editToolbar}>
        <Settings size={14} className={styles.editToolbarIcon} />
        <span className={styles.editToolbarTitle}>Edit Layout</span>
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
          <button
            type="button"
            className="btn btn-ghost btn-data"
            onClick={() => { updateLayout(DEFAULT_LAYOUT); setExpandedIconPicker(null); setAddMenuZone(null); }}
          >
            <RotateCcw size={11} /> Reset to defaults
          </button>
          <button type="button" className="btn btn-lime btn-data" onClick={exitCustomize}>Done</button>
        </div>
      </div>
    );
  }

  // ── Stat-card zone (edit-aware) ───────────────────────────────────────────
  function renderStatZone(cards: StatCardConfig[]) {
    if (!isCustomizing) {
      return (
        <div className={styles.statsGrid}>
          {cards.map(card => {
            const { value, subValue, href } = getCardDisplay(card.id, visibleStats, daysUntil);
            const IconComp = ICON_MAP[card.icon];
            const inner = (
              <>
                <div className={styles.statIcon}><IconComp size={22} /></div>
                <div>
                  <div className={styles.statNum}>{typeof value === 'number' ? <CountUp value={value} /> : value}</div>
                  <div className={styles.statLabel}>{card.label}</div>
                  {subValue && <div className={styles.statSubValue}>{subValue}</div>}
                </div>
              </>
            );
            return href ? (
              <Link key={card.id} href={`${base}/${href}`} className={`card ${styles.statCard}`} id={`dashboard-${card.id}`}>{inner}</Link>
            ) : (
              <div key={card.id} className={`card ${styles.statCard} ${styles.statCardStatic}`} id={`dashboard-${card.id}`}>{inner}</div>
            );
          })}
        </div>
      );
    }
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStatDragEnd}>
        <SortableContext items={cards.map(c => c.id)} strategy={rectSortingStrategy}>
          <div className={styles.statsGrid}>
            {cards.map(card => {
              const { value, subValue } = getCardDisplay(card.id, visibleStats, daysUntil);
              return (
                <SortableStatCard
                  key={card.id}
                  card={card}
                  display={{ value, subValue }}
                  iconOpen={expandedIconPicker === card.id}
                  onRemove={() => toggleCardVisible(card.id, false)}
                  onIconEdit={() => { setAddMenuZone(null); setExpandedIconPicker(p => p === card.id ? null : card.id); }}
                  onPickIcon={(icon) => { setCardIcon(card.id, icon); setExpandedIconPicker(null); }}
                />
              );
            })}
            {hiddenStatCards.length > 0 && (
              <AddTile
                kind="stat"
                items={hiddenStatCards}
                open={addMenuZone === 'stat'}
                onToggle={() => { setExpandedIconPicker(null); setAddMenuZone(z => z === 'stat' ? null : 'stat'); }}
                onAdd={(id) => { toggleCardVisible(id as StatCardId, true); setAddMenuZone(null); }}
              />
            )}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  // ── Analytics-panel zone (edit-aware) — pre/post-event only ───────────────
  function panelNode(id: PanelId) {
    switch (id) {
      case 'registration':   return renderRegistrationPanel();
      case 'payment':        return renderPaymentPanel();
      case 'communications': return renderCommunicationsPanel();
      case 'tournamentChat': return renderTournamentChatPanel();
      case 'scheduleHealth': return renderScheduleHealthPanel();
    }
  }
  function renderPanelZone() {
    if (!isCustomizing) {
      return (
        <div className={styles.analyticsGrid}>
          {sortedPanels.map(panel => (
            <div key={panel.id} style={{ display: 'contents' }}>{panelNode(panel.id)}</div>
          ))}
          {sortedPanels.length === 0 && (
            <div style={kx({ color: 'var(--data-gray)', fontSize: '0.8rem' }, KIT_INK.tertiary)}>
              All panels are hidden. Click <strong>Customize</strong> to restore them.
            </div>
          )}
        </div>
      );
    }
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onPanelDragEnd}>
        <SortableContext items={sortedPanels.map(p => p.id)} strategy={rectSortingStrategy}>
          <div className={styles.analyticsGrid}>
            {sortedPanels.map(panel => (
              <SortablePanel key={panel.id} id={panel.id} label={panel.label} onRemove={() => togglePanelVisible(panel.id, false)}>
                {panelNode(panel.id)}
              </SortablePanel>
            ))}
            {hiddenPanels.length > 0 && (
              <AddTile
                kind="panel"
                items={hiddenPanels}
                open={addMenuZone === 'panel'}
                onToggle={() => { setExpandedIconPicker(null); setAddMenuZone(z => z === 'panel' ? null : 'panel'); }}
                onAdd={(id) => { togglePanelVisible(id as PanelId, true); setAddMenuZone(null); }}
              />
            )}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  // Customize lives at the foot of an active board ("Customize this board", G1: it left the title
  // band). A completed event's dashboard has nothing to customize, so it offers none.
  const openCustomize = isActive && currentTournament?.id && !isCustomizing
    ? () => { setIsCustomizing(true); setExpandedIconPicker(null); setAddMenuZone(null); }
    : null;

  // The top note (G2): only for a step the lists can't say — the event's dates have passed and not
  // every game is final yet. The kit's card with its accent edge, no counts, no button.
  const datesPassedNote = isPostEventActive && !readyToFinalize ? (
    <BoardNote>
      {GAME_DAY_WORDS.datesPassedNote.fact} <b>{GAME_DAY_WORDS.datesPassedNote.step}</b>
    </BoardNote>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* G1: the event header above names the event and carries its one status chip; the page names
          only itself — no second copy of the name, no ACTIVE/LIVE tags, Customize at the board's foot. */}
      <AdminPageHeader
        title="Dashboard"
        inlineActions
        actions={isFinished ? <HelpButton help={FINISHED_BOARD_HELP} label="Dashboard" iconOnly /> : undefined}
      />

      {currentTournament?.id && statsError && (
        <div className="mb-4 text-xs" style={kx(ICON_MUTED_LEGACY, KIT_INK.tertiary)}>Dashboard counts are unavailable right now.</div>
      )}

      {/* ── COIN TOSS NEEDED — a step the lists can't say, with its one action ── */}
      {currentTournament?.id && visibleStats.coinTossNeeded.length > 0 && (
        <Callout tone="warn" role="note" icon={<AlertCircle size={16} aria-hidden />}>
          <b>Coin toss required</b>
          <span className={repKit.calloutSub}>
            {visibleStats.coinTossNeeded.map(c => `${c.divisionName} — ${c.teamNames.join(' & ')}`).join(' · ')}.
            {' '}Teams are tied; record the coin-toss result to finalize standings &amp; playoff seeding.
          </span>
          <div className={repKit.calloutActions}>
            <Link
              className="btn btn-lime btn-data"
              href={`/${currentOrg?.slug}/admin/tournaments/preview/${currentTournament.slug}/standings`}
            >
              Record coin toss
            </Link>
          </div>
        </Callout>
      )}

      {/* ── EDIT LAYOUT TOOLBAR ──────────────────────────── */}
      {isCustomizing && renderEditToolbar()}

      {/* ── DRAFT DASHBOARD ─────────────────────────────── */}
      {isDraft && !currentTournament?.id && (
        <div style={kx({ padding: '2rem 0', color: 'var(--data-gray)', fontSize: '0.85rem' }, KIT_INK.tertiary)}>
          No tournament selected. Choose a tournament from the selector above to view its dashboard.
        </div>
      )}

      {isDraft && currentTournament?.id && (
        <>
          {otherTournaments.length > 0 && !checklist.hasDivisions && !reuseDismissed && (
            <div className={styles.reuseSetupPrompt}>
              <div className={styles.reusePromptBody}>
                <Copy size={16} className={styles.reusePromptIcon} />
                <div>
                  <strong className={styles.reusePromptTitle}>Reuse setup from a previous tournament</strong>
                  <p>Bring forward divisions, venues, registration questions, fees, rules, and public settings into this draft. You can always reuse a setup later from Manage Tournaments.</p>
                </div>
              </div>
              <div className={styles.reusePromptActions}>
                {canReuseSetup ? (
                  <button type="button" className="btn btn-outline btn-data" onClick={openPopulateModal}>Reuse setup</button>
                ) : (
                  <Link className="btn btn-lime btn-data" href={subscriptionHref}>Review Tournament Plus</Link>
                )}
                <button
                  type="button"
                  onClick={dismissReuseSetup}
                  aria-label="Dismiss"
                  title="Dismiss"
                  style={kx({ background: 'none', border: 0, color: 'var(--white-40)', cursor: 'pointer', padding: '0.25rem', display: 'inline-flex', alignItems: 'center' }, KIT_INK.tertiary)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {guidanceRail}
          {personaPanel}

          <section className={`${styles.publishChecklist} ${completedCount === checklistItems.length ? styles.checklistReady : ''}`}>
            <div className={styles.checklistHeader}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className={styles.sectionTitle}>Draft Launch Checklist</h2>
                <p className={styles.checklistSub}>Complete these items before activating registration and the public tournament page.</p>
                <div className={styles.checklistProgress}>
                  <span className={styles.checklistProgressLabel} style={kx(
                    { color: completedCount === checklistItems.length ? 'var(--logic-lime)' : 'var(--white-40)' },
                    { color: completedCount === checklistItems.length ? 'var(--home-olive)' : 'var(--text-tertiary)' },
                  )}>
                    {completedCount} / {checklistItems.length} required
                  </span>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${(completedCount / checklistItems.length) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.checklistList}>
              {checklistItems.map(item => {
                const Icon = item.done ? CheckCircle2 : AlertCircle;
                // Rows with a concept tooltip use label-as-link (a <div>) so the "?" <button>
                // isn't nested in an <a>; the rest stay full-row links.
                if (item.help) {
                  return (
                    <div key={item.key} className={`${styles.checklistRow} ${item.done ? styles.checklistRowDone : styles.checklistRowPending}`}>
                      <span className={styles.rowIcon}><Icon size={16} /></span>
                      <Link href={item.href} className={styles.rowLabelLink}>{item.label}</Link>
                      <span className={styles.rowHelp}><HelpTooltip title={item.help.title} body={item.help.body} /></span>
                      <span className={styles.rowStatus}>{item.done ? 'Complete' : item.action}</span>
                      {!item.done && <span className={styles.rowDesc}>{item.desc}</span>}
                    </div>
                  );
                }
                return (
                  <Link key={item.key} href={item.href} className={`${styles.checklistRow} ${item.done ? styles.checklistRowDone : styles.checklistRowPending}`}>
                    <span className={styles.rowIcon}><Icon size={16} /></span>
                    <span className={styles.rowLabel}>{item.label}</span>
                    <span className={styles.rowStatus}>{item.done ? 'Complete' : item.action}</span>
                    {!item.done && <span className={styles.rowDesc}>{item.desc}</span>}
                  </Link>
                );
              })}
            </div>

            {/* Broken-schedule float-up: surfaces above the drawer only when there's a real conflict */}
            {scheduleFloatsUp && (
              <div className={styles.checklistList} style={{ marginTop: '0.5rem' }}>
                {renderScheduleRow()}
              </div>
            )}

            <button type="button" onClick={() => setShowOptionalItems(open => !open)} className={styles.optionalToggle}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                <Settings size={13} style={{ flexShrink: 0 }} />
                <span className={styles.optionalToggleLabel}>Schedule, venues, tie-breakers &amp; more</span>
                <span style={kx(
                  { color: optionalReviewedCount === optionalTotalCount ? 'var(--logic-lime)' : 'var(--data-gray)', marginLeft: '0.15rem', flexShrink: 0 },
                  { color: optionalReviewedCount === optionalTotalCount ? 'var(--home-olive)' : 'var(--text-tertiary)' },
                )}>
                  — {optionalReviewedCount} of {optionalTotalCount} reviewed
                </span>
              </span>
              {showOptionalItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showOptionalItems && (
              <div className={styles.checklistList} style={{ marginTop: '0.5rem' }}>
                {optionalGroups.map(group => (
                  <Fragment key={group.key}>
                    <span className={styles.checklistDivider}>{group.label}</span>
                    {group.key === 'recommended' && !scheduleFloatsUp && renderScheduleRow()}
                    {optionalItems.filter(i => i.group === group.key).map(item => renderOptionalRow(item, group.tag))}
                  </Fragment>
                ))}
              </div>
            )}

            {checklist.ready ? (
              <div className={styles.activateBanner}>
                <div className={styles.activateBannerBody}>
                  <CheckCircle2 size={16} className={styles.activateBannerIcon} />
                  <span>All required items complete — your tournament is ready to go live.</span>
                </div>
                {activateError && <span className={styles.activateBannerError}>{activateError}</span>}
                <button type="button" className="btn btn-lime btn-data" onClick={() => setShowActivateConfirm(true)} disabled={activating}>
                  {activating ? 'Activating…' : 'Activate tournament →'}
                </button>
              </div>
            ) : (
              activateError && (
                <div className={styles.checklistFooter}>
                  <span style={kx({ color: 'var(--danger)', fontSize: '0.8rem' }, KIT_INK.danger)}>{activateError}</span>
                </div>
              )
            )}
          </section>
        </>
      )}

      {/* ── GAME DAY (active, and the dates have come or the first game has started) — the Stage 1
          board (G2 · G3 · G8). The live "It's game day" card retired with it: the lists ARE the day.
          Once every game is final the rail's ready card stays, because it has the one button the day
          needs next (Mark complete). */}
      {isActive && currentTournament?.id && isGameDay && (
        <>
          {guidanceStage === 'ready' ? guidanceRail : datesPassedNote}
          <GameDayBoard
            base={base}
            planHref={`${subscriptionHref}?plan=tournament_plus`}
            gd={gd}
            arrived={{ checkedIn: checkIn.checkedIn, accepted: checkIn.accepted }}
            champions={champions}
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
            customizing={isCustomizing}
            onCustomize={openCustomize}
          />
        </>
      )}

      {/* ── BEFORE / AFTER THE EVENT (active, no game day yet or none left) — Stage 4's ── */}
      {isActive && currentTournament?.id && !isGameDay && (
        <>
          {guidanceRail}
          {renderMetricStrip()}
          {renderPanelZone()}
          {datesPassedNote}
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
          canArchive={hasCapability(userRole ?? 'official', userCapabilities, 'create_tournaments')}
          tournamentLimit={currentOrg?.tournamentLimit ?? 9999}
          slotHolders={tournaments.length}
          archive={archiveEvent}
        />
      )}

      {/* ── POPULATE-FROM MODAL ──────────────────────────── */}
      {populateOpen && (
        <div style={kx(MODAL_OVERLAY_BLUR_LEGACY, MODAL_OVERLAY_KIT)}>
          <div className="modal" style={{ maxWidth: 620, width: 'calc(100% - 2rem)', padding: '1.75rem' }} onClick={e => e.stopPropagation()}>
            {populateStep === 'pick' && (
              <>
                <div className="modal-header">
                  <div className={styles.reuseModalTitle}>
                    <Copy size={17} className={styles.reusePromptIcon} />
                    <div>
                      <h3>Reuse setup from a previous tournament</h3>
                      <p>Choose the source setup for this draft.</p>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-data" onClick={() => setPopulateOpen(false)} aria-label="Close">X</button>
                </div>
                {!canReuseSetup ? (
                  <div className={styles.reuseModalBody}>
                    <Callout role="note" flush>{reuseUpgradeCopy}</Callout>
                    <Link className="btn btn-lime btn-data" href={subscriptionHref}>Review Tournament Plus</Link>
                  </div>
                ) : (
                  <div className={styles.sourceList}>
                    {otherTournaments.map(t => (
                      <button key={t.id} type="button" onClick={() => { setPopulateSelected(t); setPopulateStep('confirm'); }} className={styles.sourceButton}>
                        <span>
                          <span className={styles.sourceName}>{t.name}</span>
                          <span className={styles.sourceMeta}>{t.year ? `${t.year} - ` : ''}{getTournamentStatusLabel(t.status)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="modal-footer">
                  <button className="btn btn-ghost btn-data" onClick={() => setPopulateOpen(false)}>Cancel</button>
                </div>
              </>
            )}

            {populateStep === 'confirm' && populateSelected && !populateDone && (
              <>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>Replace this draft setup with {populateSelected.name}?</h3>
                  <button className="btn btn-ghost btn-data" onClick={() => setPopulateOpen(false)} aria-label="Close">X</button>
                </div>
                <div className={styles.reuseModalBody}>
                  <p>This will <strong>replace</strong> the setup in <strong>{currentTournament?.name}</strong> with reusable setup from <strong>{populateSelected.name}</strong>. Tournament name, URL, and dates stay the same.</p>
                  <div className={styles.reuseCopyGrid}>
                    <div className={styles.reuseCopyPanel}>
                      <h4>Carried forward</h4>
                      <ul className={styles.reuseCopyList}>{REUSE_SETUP_INCLUDED.map(item => <li key={item}><span className={styles.checkDot} />{item}</li>)}</ul>
                    </div>
                    <div className={styles.reuseCopyPanel}>
                      <h4>Never copied</h4>
                      <ul className={styles.reuseCopyList}>{REUSE_SETUP_EXCLUDED.map(item => <li key={item}><span className={styles.neverDot} />{item}</li>)}</ul>
                    </div>
                  </div>
                  <p className={styles.modalNote}>This cannot be undone from the dashboard.</p>
                </div>
                {populateError && <Callout tone="bad" role="alert">{populateError}</Callout>}
                <div className="modal-footer">
                  <button className="btn btn-ghost btn-data" onClick={() => setPopulateStep('pick')} disabled={populateWorking}>Back</button>
                  <button className="btn btn-danger btn-data" onClick={handlePopulateConfirm} disabled={populateWorking}>{populateWorking ? 'Replacing...' : 'Replace draft setup'}</button>
                </div>
              </>
            )}

            {populateDone && (
              <>
                <div className="modal-header"><h3 style={{ margin: 0 }}>Draft setup reused</h3></div>
                <div className={styles.reuseModalBody}>
                  <p><strong>{currentTournament?.name}</strong> now uses reusable setup from <strong>{populateSelected?.name}</strong>. Review your divisions and launch checklist before publishing.</p>
                  {populateCopiedSummary.length > 0 && (
                    <ul className={styles.copiedSummaryList}>{populateCopiedSummary.map(item => <li key={item}><span className={styles.checkDot} />{item}</li>)}</ul>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-lime btn-data" onClick={() => setPopulateOpen(false)}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIVATE CONFIRM ──────────────────────────────── */}
      {showActivateConfirm && (
        <div style={kx(MODAL_OVERLAY_LEGACY, MODAL_OVERLAY_KIT)}>
          <div className="modal" style={{ maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Activate tournament?</h3>
            </div>
            <p style={kx({ fontSize: '0.875rem', color: 'var(--data-gray)', margin: '0 0 0.5rem' }, KIT_INK.tertiary)}>
              This will make the public tournament page live and open registration to teams. You can deactivate it later from Event Settings if needed.
            </p>
            {currentTournament?.slug && (
              <p style={kx({ fontSize: '0.8rem', color: 'var(--white-40)', margin: '0 0 0.5rem', wordBreak: 'break-all' }, KIT_INK.tertiary)}>
                Public URL:{' '}
                <span style={kx({ color: 'var(--white-60)', fontFamily: 'monospace' }, KIT_INK.secondary)}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/{currentOrg?.slug}/{currentTournament.slug}
                </span>
              </p>
            )}
            {(recommendedGaps.length > 0 || defaultsApplying.length > 0) && (
              <div className={styles.activateSummary}>
                {recommendedGaps.length > 0 && (
                  <div className={styles.activateSummaryBlock}>
                    <span className={styles.activateSummaryHead}>Not yet set up</span>
                    <ul className={styles.activateSummaryList}>
                      {recommendedGaps.map(g => <li key={g}>{g}</li>)}
                    </ul>
                  </div>
                )}
                {defaultsApplying.length > 0 && (
                  <div className={styles.activateSummaryBlock}>
                    <span className={styles.activateSummaryHead}>Defaults that will apply</span>
                    <ul className={styles.activateSummaryList}>
                      {defaultsApplying.map(d => <li key={d}>{d}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {activateError && <p style={kx({ fontSize: '0.8rem', color: 'var(--danger)', margin: '0 0 0.5rem' }, KIT_INK.danger)}>{activateError}</p>}
            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={() => { setShowActivateConfirm(false); setActivateError(''); }} disabled={activating}>Cancel</button>
              <button className="btn btn-lime btn-data" onClick={handleActivate} disabled={activating}>{activating ? 'Activating…' : 'Yes, activate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MARK COMPLETE — the "ready" card's one button asks first, in the kit's question window, with the
          record's own sentence (Tournament admin redesign Stage 4, P5: one home for every status sentence;
          it says the results email only when it will send). ── */}
      {showCompleteConfirm && currentTournament && (() => {
        const q = statusConfirm('complete', {
          name: currentTournament.name,
          startDate: currentTournament.startDate ?? null,
          today: tournamentToday(),
          finiteSlots: (currentOrg?.tournamentLimit ?? 9999) < 9999,
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
