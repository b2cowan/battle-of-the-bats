'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, Info,
  Users, Calendar, Trophy, DollarSign, TrendingUp, Zap, Flag,
  Clock, Activity, Star, Shield, BarChart2, Target, Bell,
  Settings, RotateCcw, Megaphone, GripVertical, X, Plus, Pencil,
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
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import type { RegistrationAttentionSummary } from '@/lib/registration-attention';
import { LiveEventLog } from '@/components/admin/LiveEventLog';
import styles from './dashboard.module.css';
import { copiedSummary } from '@/lib/utils';
import type { CloneCopiedCounts } from '@/lib/types';

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

type GameDayDivisionStat = {
  id: string;
  name: string;
  poolTotal: number;
  poolCompleted: number;
  playoffStarted: boolean;
  latestRound: string | null;
  nextRound: string | null;
};

type GameDayStats = {
  totalGames: number;
  completed: number;
  inProgress: number;
  completedPct: number;
  poolGamesTotal: number;
  poolGamesCompleted: number;
  playoffStarted: boolean;
  playoffGamesTotal: number;
  playoffGamesCompleted: number;
  byDivision: GameDayDivisionStat[];
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
  venueChanges: number;
  facilityChanges: number;
  conflicts: number;
  travelBufferWarnings: number;
  unresolvedFacilities: number;
  minGamesPerParticipant: number;
  maxGamesPerParticipant: number;
  averageGamesPerParticipant: number;
};

type DashboardStats = {
  divisions: number;
  teams: number;
  scheduled: number;
  totalGames: number;
  completed: number;
  communications: CommunicationsStats;
  scheduleHealth: ScheduleHealthDashboardStats;
  isTournamentDay: boolean;
  gameDay: GameDayStats;
  publishChecklist: PublishChecklist;
  registration: {
    totalCapacity: number;
    totalAccepted: number;
    totalPending: number;
    totalWaitlist: number;
    byDivision: DivisionStat[];
    velocity: number;
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
type PanelId = 'registration' | 'payment' | 'communications' | 'scheduleHealth';

type StatCardConfig = { id: StatCardId; label: string; icon: IconKey; visible: boolean; order: number };
type PanelConfig    = { id: PanelId;   label: string;                  visible: boolean; order: number };

type DashboardLayout = {
  version: 1;
  statCards: StatCardConfig[];
  panels: PanelConfig[];
};

const DEFAULT_LAYOUT: DashboardLayout = {
  version: 1,
  statCards: [
    { id: 'teams',     label: 'Teams',     icon: 'Users',    visible: true, order: 0 },
    { id: 'scheduled', label: 'Scheduled', icon: 'Calendar', visible: true, order: 1 },
    { id: 'completed', label: 'Completed', icon: 'Trophy',   visible: true, order: 2 },
    { id: 'days',      label: 'Days Away', icon: 'Clock',    visible: true, order: 3 },
  ],
  panels: [
    { id: 'registration',   label: 'Registration',   visible: true, order: 0 },
    { id: 'payment',        label: 'Payments',       visible: true, order: 1 },
    { id: 'communications', label: 'Communications', visible: true, order: 2 },
    { id: 'scheduleHealth', label: 'Schedule Health', visible: true, order: 3 },
  ],
};

function layoutKey(orgSlug: string) { return `fl_dash_v1_${orgSlug}`; }

function loadLayout(orgSlug: string): DashboardLayout {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(layoutKey(orgSlug));
    if (!raw) return DEFAULT_LAYOUT;
    const p = JSON.parse(raw) as Partial<DashboardLayout>;
    if (p.version !== 1) return DEFAULT_LAYOUT;
    const mergedCards = DEFAULT_LAYOUT.statCards.map(def => {
      const saved = (p.statCards ?? []).find(c => c.id === def.id);
      return saved ? { ...def, ...saved } : def;
    });
    const mergedPanels = DEFAULT_LAYOUT.panels.map(def => {
      const saved = (p.panels ?? []).find(c => c.id === def.id);
      return saved ? { ...def, ...saved } : def;
    });
    return { version: 1, statCards: mergedCards, panels: mergedPanels };
  } catch { return DEFAULT_LAYOUT; }
}

function saveLayout(orgSlug: string, layout: DashboardLayout) {
  try { localStorage.setItem(layoutKey(orgSlug), JSON.stringify(layout)); } catch { /* quota */ }
}

// ── Misc helpers ─────────────────────────────────────────────────────────────

const EMPTY_GAME_DAY: GameDayStats = {
  totalGames: 0, completed: 0, inProgress: 0, completedPct: 0,
  poolGamesTotal: 0, poolGamesCompleted: 0,
  playoffStarted: false, playoffGamesTotal: 0, playoffGamesCompleted: 0,
  byDivision: [],
};

const EMPTY_STATS: DashboardStats = {
  divisions: 0,
  teams: 0,
  scheduled: 0,
  totalGames: 0,
  completed: 0,
  communications: { total: 0, emailsSent: 0, totalRecipients: 0, latestTitle: null, latestDate: null },
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
  gameDay: EMPTY_GAME_DAY,
  publishChecklist: {
    hasDates: false, hasDivisions: false, hasPublicContact: false, hasOpenDivision: false,
    hasBranding: false, hasVenues: false, hasRules: false, hasFees: false,
    hasGameTiming: false, hasTieBreakers: false, ready: false,
  },
  registration: { totalCapacity: 0, totalAccepted: 0, totalPending: 0, totalWaitlist: 0, byDivision: [], velocity: 0 },
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

function fmtDateRange(start?: string, end?: string): string | null {
  if (!start) return null;
  const p = (d: string) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); };
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const full: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  if (!end || end === start) return p(start).toLocaleDateString('en-CA', full);
  const s = p(start), e = p(end);
  return s.getFullYear() === e.getFullYear()
    ? `${s.toLocaleDateString('en-CA', opts)} – ${e.toLocaleDateString('en-CA', full)}`
    : `${s.toLocaleDateString('en-CA', full)} – ${e.toLocaleDateString('en-CA', full)}`;
}

function computeDaysUntil(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = new Date(startDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function GaugeBar({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = danger ? 'var(--danger)' : pct >= 100 ? 'var(--success)' : pct >= 75 ? 'var(--warning)' : 'var(--blueprint-blue)';
  return (
    <div className={styles.gaugeWrap}>
      <div className={styles.gaugeTrack}>
        <div className={styles.gaugeFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.gaugePct} style={{ color }}>{pct}%</span>
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
        subValue: daysUntil === 1 ? 'day to go' : 'days to go',
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
  const { currentTournament, refresh: refreshTournaments } = useTournament();
  const { currentOrg, userRole } = useOrg();
  usePageTitle('Dashboard');
  const router = useRouter();
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments`;
  const subscriptionHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  // ── Core stats ────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [statsError, setStatsError] = useState('');

  // ── Activate / archive ────────────────────────────────────────────────────
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [showOptionalItems, setShowOptionalItems] = useState(false);

  // ── Layout customization ──────────────────────────────────────────────────
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [expandedIconPicker, setExpandedIconPicker] = useState<StatCardId | null>(null);
  const [addMenuZone, setAddMenuZone] = useState<'stat' | 'panel' | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load layout from localStorage after mount (client-only)
  useEffect(() => {
    if (currentOrg?.slug) setLayout(loadLayout(currentOrg.slug));
  }, [currentOrg?.slug]);

  const updateLayout = useCallback((next: DashboardLayout) => {
    setLayout(next);
    if (currentOrg?.slug) saveLayout(currentOrg.slug, next);
  }, [currentOrg?.slug]);

  const toggleCardVisible = (id: StatCardId, visible: boolean) =>
    updateLayout({ ...layout, statCards: layout.statCards.map(c => c.id === id ? { ...c, visible } : c) });
  const togglePanelVisible = (id: PanelId, visible: boolean) =>
    updateLayout({ ...layout, panels: layout.panels.map(p => p.id === id ? { ...p, visible } : p) });
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
  useEffect(() => {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;
    const controller = new AbortController();
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
          scheduleHealth:  data?.scheduleHealth  ?? EMPTY_STATS.scheduleHealth,
          isTournamentDay: data?.isTournamentDay ?? false,
          gameDay:         data?.gameDay         ?? EMPTY_GAME_DAY,
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
          },
          payment: {
            ...(data?.payment ?? EMPTY_STATS.payment),
            byDivision: data?.payment?.byDivision ?? [],
          },
          registrationAttention: data?.registrationAttention ?? EMPTY_STATS.registrationAttention,
        });
        setStatsError('');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStats(EMPTY_STATS);
        setStatsError(err instanceof Error ? err.message : 'Unable to load dashboard stats.');
      }
    }
    void fetchStats(tournamentId);
    return () => controller.abort();
  }, [currentTournament?.id, orgParam]);

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

  async function handleArchive() {
    if (!currentTournament?.id || archiving) return;
    setArchiving(true); setArchiveError(''); setShowArchiveConfirm(false);
    try {
      const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-status', id: currentTournament.id, data: { status: 'archived' } }),
      });
      const json = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to archive tournament.');
      await refreshTournaments();
      router.refresh();
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive tournament.');
    } finally { setArchiving(false); }
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
  const statusColor   = { active: 'var(--logic-lime)', draft: 'var(--white-60)', completed: 'var(--warning)', archived: 'rgba(148,163,184,0.4)' }[status] ?? 'var(--white-60)';

  const visibleStats  = currentTournament?.id ? stats : EMPTY_STATS;
  const checklist     = visibleStats.publishChecklist;
  const reg           = visibleStats.registration;
  const pay           = visibleStats.payment;
  const registrationAttention = visibleStats.registrationAttention;
  const gd            = visibleStats.gameDay;
  const isTournamentDay = visibleStats.isTournamentDay;
  const populateCopiedSummary = copiedSummary(populateCopied);
  const commandCenterAvailable = currentOrg ? hasPlanFeature(currentOrg.planId, 'payment_readiness_tools') : false;
  const registrationFollowUpBuckets = registrationAttention.buckets
    .filter(bucket => bucket.count > 0 && bucket.key !== 'pending_review' && bucket.key !== 'waitlist')
    .slice(0, 3);

  const daysUntil = computeDaysUntil(currentTournament?.startDate);

  // Active sub-states
  const isPreEvent      = isActive && daysUntil !== null && daysUntil > 0;
  const isPostEventActive = isActive && !isTournamentDay && (daysUntil === null || daysUntil <= 0);

  const statusLabel = isPreEvent ? 'Pre-Event' : isTournamentDay ? 'Live' : isPostEventActive ? 'Event Ended' : isCompleted ? 'Completed' : status.charAt(0).toUpperCase() + status.slice(1);

  // Cards that don't apply to the current tournament phase — suppressed regardless of saved layout
  const contextHidden = new Set<StatCardId>();
  if (isActive) {
    if (isPreEvent) contextHidden.add('completed'); // no games played yet
    else            contextHidden.add('days');      // countdown irrelevant once event starts
  }

  // Layout-derived
  const visibleCards  = layout.statCards.filter(c => c.visible).sort((a, b) => a.order - b.order);
  const renderedCards = visibleCards.filter(c => !contextHidden.has(c.id));
  const sortedPanels  = [...layout.panels].sort((a, b) => a.order - b.order).filter(p => p.visible);
  const hiddenStatCards = [...layout.statCards].filter(c => !c.visible).sort((a, b) => a.order - b.order)
    .map(c => ({ id: c.id, label: c.label, icon: c.icon }));
  const hiddenPanels = [...layout.panels].filter(p => !p.visible).sort((a, b) => a.order - b.order)
    .map(p => ({ id: p.id, label: p.label }));

  // Checklist
  const checklistItems = [
    { key: 'dates',         done: checklist.hasDates,        label: 'Tournament dates',                            desc: 'Set a start and end date so teams know when the event runs.',     href: `${base}/settings/event`, action: 'Edit dates'     },
    { key: 'divisions',     done: checklist.hasDivisions,    label: 'At least one division',                       desc: 'Create the divisions teams can register for.',                     href: `${base}/divisions`,      action: 'Add divisions'  },
    { key: 'open-division', done: checklist.hasOpenDivision, label: 'Registration open for at least one division', desc: 'Open a division when you are ready for teams to register.',        href: `${base}/divisions`,      action: 'Open divisions' },
    { key: 'fees',          done: checklist.hasFees,         label: 'Fee approach confirmed',                      desc: 'Confirm how registration fees work — or mark the event as free.', href: `${base}/settings/event`, action: 'Configure fees' },
  ];
  const completedCount = checklistItems.filter(i => i.done).length;

  const optionalItems = [
    { key: 'contact',      done: checklist.hasPublicContact, label: 'Contact email',     desc: checklist.hasPublicContact ? 'A contact email is set for this tournament.' : 'Defaults to your org contact email. Override with a tournament-specific address.',                    href: `${base}/settings/event`, action: 'Review contact →'   },
    { key: 'game-timing',  done: checklist.hasGameTiming,    label: 'Game timing',       desc: checklist.hasGameTiming    ? 'Game timing is configured for this tournament.' : 'Defaults to 90 min games / 15 min buffer, tournament-wide. Customize before building the schedule.', href: `${base}/settings/event`, action: 'Configure timing →' },
    { key: 'tie-breakers', done: checklist.hasTieBreakers,   label: 'Tie-breaker rules', desc: checklist.hasTieBreakers   ? 'Tie-breaker rules are configured for this tournament.' : 'Defaults to H2H → Run Diff → Runs For → Runs Against. Customize before playoffs.',          href: `${base}/settings/event`, action: 'Configure rules →'  },
    { key: 'venues',       done: checklist.hasVenues,        label: 'Venues & fields',   desc: checklist.hasVenues        ? 'Playing fields are set up for this tournament.' : 'Add your playing fields so teams know where to show up.',                                          href: `${base}/venues`,         action: 'Add venues →'       },
    { key: 'rules',        done: checklist.hasRules,         label: 'Rules & resources', desc: checklist.hasRules         ? 'Tournament rules and documents are published.' : 'Upload rulebooks or documents teams need before the tournament.',                                   href: `${base}/rules`,          action: 'Add rules →'        },
    { key: 'branding',     done: checklist.hasBranding,      label: 'Public page',       desc: checklist.hasBranding      ? 'Your public tournament page is live and customized.' : 'Control visibility and public presentation of your tournament page.',                        href: `${base}/branding`,       action: 'Manage page →'      },
  ];
  const optionalDoneCount = optionalItems.filter(i => i.done).length;

  // ── Panel renderers ───────────────────────────────────────────────────────
  function fmtShortDate(iso: string): string {
    const [y, m, d] = iso.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderCommunicationsPanel() {
    const comms = visibleStats.communications;
    return (
      <section className={styles.analyticsPanel}>
        <div className={styles.panelHeader}>
          <Megaphone size={16} style={{ color: 'var(--logic-lime)' }} />
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

  function renderScheduleHealthPanel() {
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

    return (
      <section className={`${styles.analyticsPanel} ${styles.scheduleHealthPanel}`} data-tone={health.tone}>
        <div className={styles.panelHeader}>
          <Activity size={16} style={{ color: 'var(--logic-lime)' }} />
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Schedule Health</h2>
          <Link href={`${base}/schedule`} className={styles.panelLink}>Review -&gt;</Link>
        </div>
        {hasTimedSchedule ? (
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
              <span className={styles.scheduleHealthMiniMetric} data-tone={health.maxGamesInDay > 2 ? 'warning' : 'good'}>
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
            <Link href={`${base}/schedule`} className={styles.panelLink}>Build schedule -&gt;</Link>
          </div>
        )}
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
          <Users size={16} style={{ color: 'var(--logic-lime)' }} />
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Registration</h2>
          {reg.velocity > 0 && (
            <span className={styles.velocityChip}>
              <TrendingUp size={11} />
              +{reg.velocity} this week
            </span>
          )}
          <Link href={`${base}/registrations`} className={styles.panelLink}>View teams →</Link>
        </div>
        <div className={styles.mainGauge}>
          <div className={styles.gaugeFigures}>
            <span className={styles.gaugeMain}>{reg.totalAccepted}</span>
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
          <DollarSign size={16} style={{ color: 'var(--logic-lime)' }} />
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
  function renderEditToolbar() {
    return (
      <div className={styles.editToolbar}>
        <Settings size={14} className={styles.editToolbarIcon} />
        <span className={styles.editToolbarTitle}>Edit Layout</span>
        <span className={styles.editToolbarHint}>Drag to reorder · saved to your browser</span>
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
                  <div className={styles.statNum}>{value}</div>
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
            <div style={{ color: 'var(--data-gray)', fontSize: '0.8rem' }}>
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <header className="flex items-center justify-between border-b border-blueprint-blue/60 pb-4 mb-5" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div className="hud-label mb-1">{currentOrg?.name ?? 'Admin'}</div>
          <h1 className="font-mono font-bold text-xl uppercase tracking-tight" style={{ color: 'var(--logic-lime)' }}>
            {currentTournament?.name ?? currentOrg?.name ?? 'Admin'}
          </h1>
          {fmtDateRange(currentTournament?.startDate, currentTournament?.endDate) && (
            <div className="hud-label mt-1" style={{ color: 'var(--white-50)', textTransform: 'none', letterSpacing: 'normal' }}>
              {fmtDateRange(currentTournament?.startDate, currentTournament?.endDate)}
            </div>
          )}
          {currentTournament?.id && (
            <div className={styles.statusChipMobile}>
              <span className={styles.statusDot} style={{ background: statusColor }} />
              <span style={{ color: statusColor }}>{status.toUpperCase()}</span>
              {isActive && <span className={styles.statusChipSub}>· {statusLabel.toUpperCase()}</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {(isActive || isCompleted) && currentTournament?.id && !isCustomizing && (
            <button
              type="button"
              className={`btn btn-ghost btn-data ${styles.customizeToggleBtn}`}
              onClick={() => { setIsCustomizing(true); setExpandedIconPicker(null); setAddMenuZone(null); }}
            >
              <Settings size={12} />
              Customize
            </button>
          )}
          <div className={styles.statusBlockDesktop} style={{ textAlign: 'right' }}>
            <div className="font-mono text-xs font-bold" style={{ color: statusColor }}>{status.toUpperCase()}</div>
            {isActive && <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--white-40)', letterSpacing: '0.06em', marginTop: '0.15rem' }}>{statusLabel.toUpperCase()}</div>}
          </div>
        </div>
      </header>

      {currentTournament?.id && statsError && (
        <div className="mb-4 text-xs" style={{ color: 'var(--data-gray)' }}>Dashboard counts are unavailable right now.</div>
      )}

      {/* ── EDIT LAYOUT TOOLBAR ──────────────────────────── */}
      {isCustomizing && renderEditToolbar()}

      {/* ── DRAFT DASHBOARD ─────────────────────────────── */}
      {isDraft && !currentTournament?.id && (
        <div style={{ padding: '2rem 0', color: 'var(--data-gray)', fontSize: '0.85rem' }}>
          No tournament selected. Choose a tournament from the selector above to view its dashboard.
        </div>
      )}

      {isDraft && currentTournament?.id && (
        <>
          {otherTournaments.length > 0 && (
            <div className={styles.reuseSetupPrompt}>
              <div className={styles.reusePromptBody}>
                <Copy size={16} className={styles.reusePromptIcon} />
                <div>
                  <strong className={styles.reusePromptTitle}>Reuse setup from a previous tournament</strong>
                  <p>Bring forward divisions, venues, registration questions, fees, rules, and public settings into this draft.</p>
                </div>
              </div>
              <div className={styles.reusePromptActions}>
                {canReuseSetup ? (
                  <button type="button" className="btn btn-outline btn-data" onClick={openPopulateModal}>Reuse setup</button>
                ) : (
                  <Link className="btn btn-lime btn-data" href={subscriptionHref}>Review Tournament Plus</Link>
                )}
              </div>
            </div>
          )}

          {visibleStats.scheduleHealth.timedGames > 0 && (
            <div className={styles.analyticsGrid}>
              {renderScheduleHealthPanel()}
            </div>
          )}

          <section className={`${styles.publishChecklist} ${completedCount === checklistItems.length ? styles.checklistReady : ''}`}>
            <div className={styles.checklistHeader}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className={styles.sectionTitle}>Draft Launch Checklist</h2>
                <p className={styles.checklistSub}>Complete these items before activating registration and the public tournament page.</p>
                <div className={styles.checklistProgress}>
                  <span className={styles.checklistProgressLabel} style={{ color: completedCount === checklistItems.length ? 'var(--logic-lime)' : 'var(--white-40)' }}>
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

            <button type="button" onClick={() => setShowOptionalItems(open => !open)} className={styles.optionalToggle}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Info size={13} />
                Optional setup
                <span style={{ color: optionalDoneCount === optionalItems.length ? 'var(--logic-lime)' : 'var(--data-gray)', marginLeft: '0.15rem' }}>
                  — {optionalDoneCount} of {optionalItems.length} complete
                </span>
              </span>
              {showOptionalItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showOptionalItems && (
              <div className={styles.checklistList} style={{ marginTop: '0.5rem' }}>
                {optionalItems.map(item => {
                  const Icon = item.done ? CheckCircle2 : Info;
                  return (
                    <Link key={item.key} href={item.href} className={`${styles.checklistRow} ${item.done ? styles.checklistRowDone : styles.checklistRowPending}`}>
                      <span className={styles.rowIcon}><Icon size={16} /></span>
                      <span className={styles.rowLabel}>{item.label}</span>
                      <span className={styles.rowOptTag}>Optional</span>
                      <span className={styles.rowStatus}>{item.done ? 'Complete' : item.action}</span>
                      {!item.done && <span className={styles.rowDesc}>{item.desc}</span>}
                    </Link>
                  );
                })}
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
                  <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{activateError}</span>
                </div>
              )
            )}
          </section>
        </>
      )}

      {/* ── LIVE DASHBOARD (active) ──────────────────────── */}
      {isActive && currentTournament?.id && (
        <>
          {/* Stat cards — layout-driven, context-filtered */}
          {(renderedCards.length > 0 || isCustomizing) && renderStatZone(renderedCards)}

          {/* ── TOURNAMENT DAY: game-day metrics ──────── */}
          {isTournamentDay ? (
            <div className={styles.analyticsGrid}>
              <section className={styles.analyticsPanel}>
                <div className={styles.panelHeader}>
                  <Zap size={16} style={{ color: 'var(--logic-lime)' }} />
                  <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Games Progress</h2>
                  <Link href={`${base}/results`} className={styles.panelLink}>Enter scores →</Link>
                </div>
                {gd.totalGames > 0 ? (
                  <>
                    <div className={styles.mainGauge}>
                      <div className={styles.gaugeFigures}>
                        <span className={styles.gaugeMain}>{gd.completed}</span>
                        <span className={styles.gaugeOf}>/ {gd.totalGames}</span>
                        <span className={styles.gaugeLabel}>games complete</span>
                      </div>
                      <GaugeBar value={gd.completed} max={gd.totalGames} />
                    </div>
                    <div className={styles.subStats}>
                      {gd.inProgress > 0 && <span className={styles.subStat}><span className="badge badge-warning">{gd.inProgress}</span> In review</span>}
                      {gd.poolGamesTotal > 0 && <span className={styles.subStat}><span className="badge badge-neutral">{gd.poolGamesCompleted}/{gd.poolGamesTotal}</span> Pool games</span>}
                      {gd.playoffStarted && <span className={styles.subStat}><span className="badge badge-primary">{gd.playoffGamesCompleted}/{gd.playoffGamesTotal}</span> Playoff games</span>}
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyPanel}>
                    <span>No games scheduled yet.</span>
                    <Link href={`${base}/schedule`} className={styles.panelLink}>Build schedule →</Link>
                  </div>
                )}
              </section>

              {renderScheduleHealthPanel()}

              {gd.byDivision.length > 0 && (
                <section className={styles.analyticsPanel}>
                  <div className={styles.panelHeader}>
                    <Flag size={16} style={{ color: 'var(--logic-lime)' }} />
                    <h2 className={styles.sectionTitle} style={{ margin: 0 }}>By Division</h2>
                  </div>
                  <div className={styles.divisionTable}>
                    {gd.byDivision.map(d => {
                      const poolPct = d.poolTotal > 0 ? Math.round((d.poolCompleted / d.poolTotal) * 100) : 0;
                      return (
                        <div key={d.id} className={styles.divisionRow}>
                          <span className={styles.divisionName}>{d.name}</span>
                          <span className={styles.divisionCount}>
                            {d.playoffStarted ? (d.latestRound ?? 'Playoffs') : `${d.poolCompleted}/${d.poolTotal}`}
                          </span>
                          <div className={styles.gaugeWrap}>
                            <div className={styles.gaugeTrack}>
                              <div className={styles.gaugeFill} style={{ width: `${d.playoffStarted ? 100 : poolPct}%`, background: d.playoffStarted ? 'var(--warning)' : poolPct >= 100 ? 'var(--logic-lime)' : 'var(--blueprint-blue)' }} />
                            </div>
                            <span className={styles.gaugePct} style={{ color: d.playoffStarted ? 'var(--warning)' : 'var(--data-gray)' }}>
                              {d.playoffStarted ? (d.nextRound ? `→ ${d.nextRound}` : 'Done') : `${poolPct}%`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {gd.playoffStarted && (
                    <div className={styles.subStats} style={{ marginTop: '0.5rem' }}>
                      <span className={styles.subStat} style={{ color: 'var(--warning)' }}><Trophy size={12} /> Playoffs underway</span>
                    </div>
                  )}
                </section>
              )}
            </div>
          ) : (
            /* ── PRE/POST TOURNAMENT DAY: registration + payment ── */
            renderPanelZone()
          )}

          {/* Post-event nudge: suggest marking complete */}
          {isPostEventActive && (
            <div className={styles.postEventBanner}>
              <Trophy size={15} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <span>The tournament dates have passed. Once all scores and payments are finalized, you can mark this tournament as complete.</span>
            </div>
          )}

          <div className={styles.recentEvents}>
            <LiveEventLog tournamentId={currentTournament.id} orgSlug={currentOrg?.slug} />
          </div>
        </>
      )}

      {/* ── COMPLETED DASHBOARD ──────────────────────────── */}
      {isCompleted && currentTournament?.id && (
        <>
          {renderStatZone(visibleCards.filter(c => c.id !== 'days'))}

          <div className={styles.analyticsGrid}>
            <section className={styles.analyticsPanel}>
              <div className={styles.panelHeader}>
                <Users size={16} style={{ color: 'var(--logic-lime)' }} />
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Final Registration</h2>
                <Link href={`${base}/registrations`} className={styles.panelLink}>View teams →</Link>
              </div>
              <div className={styles.mainGauge}>
                <div className={styles.gaugeFigures}>
                  <span className={styles.gaugeMain}>{reg.totalAccepted}</span>
                  {reg.totalCapacity > 0 && <><span className={styles.gaugeOf}>/ {reg.totalCapacity}</span></>}
                  <span className={styles.gaugeLabel}>teams</span>
                </div>
                {reg.totalCapacity > 0 && <GaugeBar value={reg.totalAccepted} max={reg.totalCapacity} />}
              </div>
              {reg.byDivision.length > 1 && (
                <div className={styles.divisionTable}>
                  {reg.byDivision.map(d => (
                    <div key={d.id} className={styles.divisionRow}>
                      <span className={styles.divisionName}>{d.name}</span>
                      <span className={styles.divisionCount}>{d.accepted}{d.capacity ? `/${d.capacity}` : ''}</span>
                      {d.capacity && <GaugeBar value={d.accepted} max={d.capacity} danger={false} />}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.analyticsPanel}>
              <div className={styles.panelHeader}>
                <DollarSign size={16} style={{ color: 'var(--warning)' }} />
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Final Payments</h2>
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
                      <span>{fmt(pay.totalExpected - pay.totalCollected)} still outstanding</span>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyPanel}><span>No fee schedule was configured.</span></div>
              )}
            </section>
          </div>

          <div className={styles.wrapUpCard}>
            <div className={styles.wrapUpIcon}><Trophy size={22} /></div>
            <div className={styles.wrapUpBody}>
              <h2>Tournament Complete</h2>
              <p>
                {visibleStats.teams} team{visibleStats.teams !== 1 ? 's' : ''} registered
                {visibleStats.completed > 0 ? ` · ${visibleStats.completed} games completed` : ''}
                {pay.hasFeeSchedule && pay.totalExpected > 0 ? ` · ${fmt(pay.totalCollected)} collected` : ''}
              </p>
            </div>
            <Link href={`${base}/results`} className={styles.panelLink} style={{ flexShrink: 0 }}>View results →</Link>
          </div>

          {userRole === 'owner' && (
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              {archiveError && <span style={{ fontSize: '0.8rem', color: 'var(--danger)', marginRight: '0.75rem', alignSelf: 'center' }}>{archiveError}</span>}
              <button type="button" className="btn btn-ghost btn-data" style={{ color: 'var(--white-40)', borderColor: 'var(--border-2)' }} onClick={() => { setArchiveError(''); setShowArchiveConfirm(true); }} disabled={archiving}>
                {archiving ? 'Archiving…' : 'Archive Tournament'}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── ARCHIVED ────────────────────────────────────── */}
      {status === 'archived' && (
        <div style={{ padding: '2rem 0', color: 'var(--data-gray)', fontSize: '0.85rem' }}>
          This tournament is archived. View historical results in{' '}
          <Link href={`${base}/archives`} style={{ color: 'var(--blueprint-blue)' }}>Past Tournaments</Link>.
        </div>
      )}

      {/* ── POPULATE-FROM MODAL ──────────────────────────── */}
      {populateOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
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
                    <div className="alert alert-warning">{reuseUpgradeCopy}</div>
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
                {populateError && <div className="alert alert-danger" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>{populateError}</div>}
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

      {/* ── ARCHIVE CONFIRM ───────────────────────────────── */}
      {showArchiveConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
          <div className="modal" style={{ maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Archive this tournament?</h3>
              <button className="btn btn-ghost btn-data" onClick={() => setShowArchiveConfirm(false)}>✕</button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--data-gray)', margin: '0 0 0.75rem' }}>
              Archiving seals this tournament permanently. Archived tournaments are read-only and appear under Past Tournaments. <strong>This cannot be undone.</strong>
            </p>
            {archiveError && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', margin: '0 0 0.5rem' }}>{archiveError}</p>}
            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={() => setShowArchiveConfirm(false)} disabled={archiving}>Cancel</button>
              <button className="btn btn-danger btn-data" onClick={handleArchive} disabled={archiving}>{archiving ? 'Archiving…' : 'Archive Tournament'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVATE CONFIRM ──────────────────────────────── */}
      {showActivateConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
          <div className="modal" style={{ maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Activate tournament?</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--data-gray)', margin: '0 0 0.5rem' }}>
              This will make the public tournament page live and open registration to teams. You can deactivate it later from Event Settings if needed.
            </p>
            {currentTournament?.slug && (
              <p style={{ fontSize: '0.8rem', color: 'var(--white-40)', margin: '0 0 0.5rem', wordBreak: 'break-all' }}>
                Public URL:{' '}
                <span style={{ color: 'var(--white-60)', fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/{currentOrg?.slug}/tournaments/{currentTournament.slug}
                </span>
              </p>
            )}
            {activateError && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', margin: '0 0 0.5rem' }}>{activateError}</p>}
            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={() => { setShowActivateConfirm(false); setActivateError(''); }} disabled={activating}>Cancel</button>
              <button className="btn btn-lime btn-data" onClick={handleActivate} disabled={activating}>{activating ? 'Activating…' : 'Yes, activate'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
