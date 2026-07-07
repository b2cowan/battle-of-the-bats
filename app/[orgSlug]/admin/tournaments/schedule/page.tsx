'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Calendar, ChevronRight, ChevronDown, Plus, Pencil, X, Check, Sparkles, SlidersHorizontal, Trophy, MapPin, CloudRain, Send, Globe, EyeOff, RefreshCw, AlertTriangle, AlertCircle, Lock, Wrench } from 'lucide-react';
import { formatPoolName } from '@/lib/utils';
import { buildPlaceholderOptions, descendantBracketCodes, findBracketSchedulingViolations, nextManualBracketCode, groupGamesByBracketId } from '@/lib/playoff-bracket';
import { isPlayoffOnly as resolveIsPlayoffOnly } from '@/lib/tournament-phase';
import { formatTime } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { tournamentToday } from '@/lib/timezone';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import { downloadBracketPDF } from '@/lib/export/bracket-pdf';
import ExportMenu from '@/components/admin/ExportMenu';
import ScheduleGenerator from './Generator';
import PlayoffWizard from './PlayoffWizard';
import BracketEditor from './components/BracketEditor';
import GameList from './components/GameList';
import ShiftDayModal from './components/ShiftDayModal';
import ScheduleHealthPanel, { type ScheduleHealthRulesDraft } from './components/ScheduleHealthPanel';
import BracketColumns, { buildBracketColumns } from './components/BracketColumns';
import ScheduleTimeline from './components/ScheduleTimeline';
import { Game, Team, Division, Venue, PoolSlot, ScheduleFacilityLane, PlayoffConfig } from '@/lib/types';
import { checkVenueConflict, type ConflictResult } from '@/lib/schedule-conflict';
import { buildScheduleMetrics, getScheduleHealthRules } from '@/lib/schedule-metrics';
import s from '../../admin-common.module.css';
import styles from './schedule-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import AddVenueModal from '@/components/admin/AddVenueModal';
import {
  TournamentAdminHeader,
  TournamentAdminToolbar,
  ToolbarGroup,
  ToolbarSearch,
  ToolbarSegmentedControl,
  ToolbarSelect,
} from '@/components/admin/tournament/TournamentAdminUI';

type ModalMode = 'add' | 'edit' | null;
type ScheduleStatusFilter = 'scheduled' | 'cancelled' | 'completed';

const STATUS_FILTERS: Array<{ key: ScheduleStatusFilter; label: string }> = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'completed', label: 'Final'     },
];

const STATUS_CHIP_CLASS: Record<string, string | undefined> = {
  scheduled: 'chip_scheduled',
  cancelled: 'chip_cancelled',
  completed: 'chip_completed',
};

// Engine defaults for the Schedule Health rules editor (matches lib/schedule-metrics.ts).
const DEFAULT_HEALTH_RULES: ScheduleHealthRulesDraft = { maxGamesPerDay: 2, minRestMinutes: 15, targetGamesPerTeam: null };

// ── Export column definitions ─────────────────────────────────────────────
// No sensitive fields on this surface — schedule data is operational/public.
const SCHEDULE_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Date',      key: 'date'     },
  { label: 'Time',      key: 'time'     },
  { label: 'Division',  key: 'division' },
  { label: 'Home Team', key: 'homeTeam' },
  { label: 'Away Team', key: 'awayTeam' },
  { label: 'Location',  key: 'location' },
  { label: 'Status',    key: 'status'   },
];

const emptyForm = {
  divisionId: '', homeTeamId: '', awayTeamId: '',
  homeSlotId: '', awaySlotId: '',
  // Playoff bracket participants: a side is either a real team OR a
  // Seed/Winner/Loser placeholder (mutually exclusive).
  homePlaceholder: '', awayPlaceholder: '',
  date: '', time: '09:00', durationMinutes: '' as number | '', location: '', venueId: '', venueFacilityId: '', notes: null as string | null,
};

export default function AdminSchedulePage() {
  const { currentTournament, isLocked, loading: tournamentLoading, setCurrentTournament } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Schedule');
  const tournamentId = currentTournament?.id;
  const orgSlug = currentOrg?.slug;
  const [games, setGames]       = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [teams, setTeams]       = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [facilityLanes, setFacilityLanes] = useState<ScheduleFacilityLane[]>([]);
  const [modalSlots, setModalSlots] = useState<PoolSlot[]>([]);
  const [modalSlotsLoading, setModalSlotsLoading] = useState(false);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Game | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [selection, setSelection] = useState<Set<string> | null>(null); // null = all divisions/pools
  const [viewMode, setViewMode] = useState<'pool' | 'playoff'>('pool');
  const [layout, setLayout] = useState<'list' | 'bracket' | 'timeline'>('list');
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [resolveFacilitiesOpen, setResolveFacilitiesOpen] = useState(false);
  const [facilityLaneSelections, setFacilityLaneSelections] = useState<Record<string, string>>({});
  const [resolvingFacilities, setResolvingFacilities] = useState(false);
  const [resolveFacilitiesError, setResolveFacilitiesError] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showPlayoffWizard, setShowPlayoffWizard] = useState(false);
  const [showShiftDay, setShowShiftDay] = useState(false);
  const [editingBracket, setEditingBracket] = useState(false);
  // When the editor is entered from a List-view playoff row, the game to open + scroll to.
  const [bracketFocusGameId, setBracketFocusGameId] = useState<string | undefined>(undefined);
  // Optional config override passed to the builder — set by "Start from standings".
  const [playoffWizardConfig, setPlayoffWizardConfig] = useState<Partial<PlayoffConfig> | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<ScheduleStatusFilter[]>(['scheduled']);
  const [selectedVenueKeys, setSelectedVenueKeys] = useState<string[]>([]);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false);
  const [addVenueOpen, setAddVenueOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    confirmText?: string;
    items?: Array<{ label: string; note?: string }>;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'primary' });

  const [publishModal, setPublishModal] = useState<{ divisionId: string } | null>(null);

  // ── Schedule Health rules (organizer-defined thresholds) ──────────────────
  // `healthRules` is the live/draft value driving the panel preview; `savedHealthRules`
  // is the last-persisted baseline (for dirty detection + Discard).
  const [healthRules, setHealthRules] = useState<ScheduleHealthRulesDraft>(() => getScheduleHealthRules(currentTournament));
  const [savedHealthRules, setSavedHealthRules] = useState<ScheduleHealthRulesDraft>(healthRules);
  const [savingHealthRules, setSavingHealthRules] = useState(false);

  // PDF settings — fetched once on mount; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);
  const canUsePDF = currentOrg ? hasPlanFeature(currentOrg.planId, 'pdf_exports') : false;
  const [pdfWarningOpen, setPdfWarningOpen] = useState(false);

  // ── Real-time venue conflict check for the Add/Edit modal ────────────────
  // Pure computation from already-loaded state — no extra fetch required.
  const modalConflict = useMemo((): ConflictResult | null => {
    if (!modal) return null;
    if (!form.date || !form.time) return null;
    if (!form.venueId && !form.venueFacilityId) return null;

    return checkVenueConflict({
      proposedGame: {
        id: editing?.id ?? '__new__',
        gameDate: form.date,
        startTime: form.time,
        status: 'scheduled',
        venueId: form.venueId || null,
        venueFacilityId: form.venueFacilityId || null,
        divisionId: form.divisionId || null,
      },
      allGames: games.map(g => ({
        id: g.id,
        gameDate: g.date ?? null,
        startTime: g.time ?? null,
        status: g.status ?? null,
        venueId: g.venueId ?? null,
        venueFacilityId: g.venueFacilityId ?? null,
        scheduleFacilityLaneId: g.scheduleFacilityLaneId ?? null,
        divisionId: g.divisionId ?? null,
      })),
      divisions,
      tournament: currentTournament,
    });
  }, [modal, form.date, form.time, form.venueId, form.venueFacilityId, form.divisionId, editing?.id, games, divisions, currentTournament]);

  const canAutoGenerateSchedule = currentOrg ? hasPlanFeature(currentOrg.planId, 'auto_schedule') : false;
  // Manual playoff bracket building is available on all tournament plans; the
  // auto-schedule optimizer + tiered auto-split inside the wizard stay Plus
  // (gated by `auto_schedule`/`playoff_generator` via canAutoGenerateSchedule).
  const canBuildPlayoffsManually = currentOrg ? hasPlanFeature(currentOrg.planId, 'playoff_manual') : false;
  const canNotify = currentOrg ? hasPlanFeature(currentOrg.planId, 'schedule_notification') : false;
  // Bulk "shift the day" (Rain delay) is a Tournament Plus automation (2026-07-07 decision).
  const canRainDelay = currentOrg ? hasPlanFeature(currentOrg.planId, 'bulk_reschedule') : false;
  const scheduleToday = tournamentToday();
  // Rain delay lives in the Tools menu whenever the event has upcoming (still-scheduled) games.
  const hasUpcomingGames = games.some(g => g.status === 'scheduled' && !!g.date && g.date >= scheduleToday);

  function showScheduleUpgrade(title: string, feature: 'auto_schedule' | 'playoff_generator' | 'bulk_reschedule') {
    setFeedback({
      isOpen: true,
      title,
      message: requiresTournamentPlusCopy(feature),
      type: 'warning',
    });
  }

  function openGenerator() {
    if (resolveIsPlayoffOnly(currentTournament)) return; // no round robin in bracket-only events
    if (!canAutoGenerateSchedule) {
      showScheduleUpgrade('Round-Robin Generator Requires Tournament Plus', 'auto_schedule');
      return;
    }
    setShowGenerator(true);
  }

  // Free, manual bracket builder (starter round + game-by-game canvas). Available
  // on all tournament plans. Opens for a fresh/empty bracket; an existing bracket
  // is managed via Add Game / inline edit / the bracket view.
  // Enter the inline bracket editor (the single manual editing surface, on the main
  // screen). Build mode (empty division) or edit mode (loads the existing bracket).
  function enterBracketEditor(focusGameId?: string, divisionId?: string) {
    if (!canBuildPlayoffsManually || isLocked) return;
    // From an "all divisions" List view, retarget the builder to the clicked
    // game's division (the editor freezes on playoffBuilderDivision at mount).
    if (divisionId && filterGroup !== divisionId) setSelection(new Set([divisionId]));
    if (viewMode !== 'playoff') setViewMode('playoff');
    setBracketFocusGameId(focusGameId);
    setEditingBracket(true);
  }

  // Plus: the full format-based auto-generator (single/double/consolation/placement
  // + crossover, + auto-schedule). Gated to Tournament Plus.
  function openAutoGenerator() {
    if (!canAutoGenerateSchedule) {
      showScheduleUpgrade('Auto-Generate Bracket Requires Tournament Plus', 'playoff_generator');
      return;
    }
    setPlayoffWizardConfig(undefined);
    setShowPlayoffWizard(true);
  }

  // Bulk "shift the day" tool — Tournament Plus (bulk automation). Free orgs get the upgrade
  // prompt (they keep manual single-game edits + the free rain-delay banner).
  function openRainDelay() {
    if (!canRainDelay) {
      showScheduleUpgrade('Rain Delay Requires Tournament Plus', 'bulk_reschedule');
      return;
    }
    setShowShiftDay(true);
  }

  const refresh = useCallback(async () => {
    if (tournamentLoading) return;
    if (!tournamentId) {
      setGames([]);
      setTeams([]);
      setDivisions([]);
      setVenues([]);
      setFacilityLanes([]);
      setGamesLoading(false);
      return;
    }
    const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';

    setGamesLoading(true);
    try {
      const [gamesRes, teamsRes, groupsRes, venuesRes, lanesRes] = await Promise.all([
        fetch(`/api/admin/games?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/teams?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/divisions?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/venues?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/schedule-facility-lanes?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
      ]);

      const games = gamesRes.ok ? await gamesRes.json() : [];
      const allTeams = teamsRes.ok ? await teamsRes.json() : [];
      const groups = groupsRes.ok ? await groupsRes.json() : [];
      const venues = venuesRes.ok ? await venuesRes.json() : [];
      const lanes = lanesRes.ok ? await lanesRes.json() : [];

      setGames(games);
      setTeams(allTeams.filter((t: any) => t.status === 'accepted'));
      setDivisions(groups);
      setVenues(venues);
      setFacilityLanes(lanes);
    } finally {
      setGamesLoading(false);
    }
  }, [tournamentId, tournamentLoading, orgSlug]);
  
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    fetch(`/api/admin/org/pdf-settings${orgQuery}`)
      .then(r => r.ok ? r.json() : {})
      .then(data => setPdfSettings(data as OrgPdfSettings))
      .catch(() => setPdfSettings(null));
  }, [orgSlug]);

  // Switching tournaments exits bracket-edit mode (the frozen editor division would
  // otherwise belong to the previous tournament).
  useEffect(() => { setEditingBracket(false); }, [tournamentId]);

  // Restore filter state from localStorage when tournament changes. Skipped while
  // editing a bracket so a tournament switch can't flip viewMode and unmount the editor.
  useEffect(() => {
    if (!tournamentId || editingBracket) return;
    try {
      const raw = localStorage.getItem(`flhq-schedule-${tournamentId}`);
      if (!raw) return;
      const cached = JSON.parse(raw) as Partial<{
        viewMode: 'pool' | 'playoff';
        layout: 'list' | 'bracket' | 'timeline';
        selectedStatuses: ScheduleStatusFilter[];
        selectedVenueKeys: string[];
      }>;
      if (cached.viewMode === 'pool' || cached.viewMode === 'playoff') setViewMode(cached.viewMode);
      if (cached.layout === 'list' || cached.layout === 'bracket' || cached.layout === 'timeline') setLayout(cached.layout);
      if (Array.isArray(cached.selectedStatuses) && cached.selectedStatuses.length > 0) setSelectedStatuses(cached.selectedStatuses);
      if (Array.isArray(cached.selectedVenueKeys)) setSelectedVenueKeys(cached.selectedVenueKeys);
    } catch {}
  }, [tournamentId, editingBracket]);

  // Persist filter state. Guard: only write once divisions are loaded.
  useEffect(() => {
    if (!tournamentId || divisions.length === 0) return;
    try {
      localStorage.setItem(`flhq-schedule-${tournamentId}`, JSON.stringify({
        viewMode, layout, selectedStatuses, selectedVenueKeys,
      }));
    } catch {}
  }, [tournamentId, viewMode, layout, selectedStatuses, selectedVenueKeys, divisions.length]);

  // The schedule scopes to a single division at a time (matches Teams/Results).
  // Default to the first division and keep the selection valid as divisions load.
  useEffect(() => {
    if (divisions.length === 0) return;
    setSelection(prev => {
      if (prev && prev.size === 1 && divisions.some(d => d.id === [...prev][0])) return prev;
      return new Set([divisions[0].id]);
    });
  }, [divisions]);
  // Bracket only exists under Playoffs — fall back to List if the stage flips to round robin.
  useEffect(() => { if (viewMode === 'pool' && layout === 'bracket') setLayout('list'); }, [viewMode, layout]);

  // Bracket-only tournaments have no round-robin stage — keep the stage on Playoffs.
  const isPlayoffOnly = resolveIsPlayoffOnly(currentTournament);
  useEffect(() => { if (isPlayoffOnly && viewMode === 'pool') setViewMode('playoff'); }, [isPlayoffOnly, viewMode]);

  const groupTeams   = (id: string) => teams.filter(t => t.divisionId === id);
  const getTeamName  = (id: string) => teams.find(t => t.id === id)?.name ?? null;
  const resolveTeam  = (id: string, placeholder?: string) => getTeamName(id) ?? placeholder ?? 'TBD';
  const getGroupName = (id: string) => divisions.find(g => g.id === id)?.name ?? '—';
  const getVenueName = (venueId?: string, facilityId?: string) => {
    const venue = venueId ? venues.find(d => d.id === venueId) : null;
    if (!venue) return '';
    if (!facilityId) return venue.name;
    const facility = venue.facilities?.find(f => f.id === facilityId);
    return facility ? `${venue.name} — ${facility.name}` : venue.name;
  };
  const getGameVenueKey = (g: Game) => {
    // Key by facility when present so each diamond/field is its own filter row.
    // A venue with Diamonds 1–3 then yields three accurate options instead of one
    // whose count spans every diamond under a single facility's sublabel.
    if (g.venueId) return g.venueFacilityId ? `venue:${g.venueId}:${g.venueFacilityId}` : `venue:${g.venueId}`;
    if (g.scheduleFacilityLaneId) return `lane:${g.scheduleFacilityLaneId}`;
    return `custom:${(g.location || '').trim() || '__none__'}`;
  };
  const getGameVenueDisplay = (g: Game): { name: string; sublabel?: string } => {
    if (g.venueId) {
      const venue = venues.find(v => v.id === g.venueId);
      if (!venue) return { name: g.location || 'Unknown venue' };
      if (g.venueFacilityId) {
        const facility = venue.facilities?.find(f => f.id === g.venueFacilityId);
        if (facility) return { name: venue.name, sublabel: facility.name };
      }
      return { name: venue.name };
    }
    if (g.scheduleFacilityLaneId) {
      const lane = facilityLanes.find(item => item.id === g.scheduleFacilityLaneId);
      return { name: lane?.label ?? g.scheduleFacilityLaneLabel ?? g.location ?? 'Temporary facility', sublabel: 'TBD facility' };
    }
    return { name: g.location?.trim() || 'No venue' };
  };

  async function fetchModalSlots(divisionId: string) {
    if (!currentTournament?.id || !divisionId) { setModalSlots([]); return; }
    setModalSlotsLoading(true);
    try {
      const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/pool-slots?tournamentId=${encodeURIComponent(currentTournament.id)}&divisionId=${encodeURIComponent(divisionId)}${orgParam}`);
      setModalSlots(res.ok ? await res.json() : []);
    } catch { setModalSlots([]); }
    finally { setModalSlotsLoading(false); }
  }

  function handlePublishDone(updates: { id: string; scheduleVisibility: 'published' }[]) {
    // Publishing closes registration server-side too (atomic) — reflect both so the UI
    // matches even if the optimistic pre-close was skipped or failed.
    setDivisions(prev => prev.map(g => {
      const u = updates.find(u => u.id === g.id);
      return u ? { ...g, scheduleVisibility: u.scheduleVisibility, isClosed: true } : g;
    }));
    // Modal stays open to show success state; user closes it with "Done"
  }

  function handleDivisionClosed(id: string) {
    setDivisions(prev => prev.map(g => g.id === id ? { ...g, isClosed: true } : g));
  }

  function handleUnpublish(divisionId: string) {
    setFeedback({
      isOpen: true,
      title: 'Unpublish Division?',
      message: 'The schedule for this division will be removed from the public page. Registration stays closed — unpublishing does not reopen it; reopen registration separately if you want new sign-ups.',
      type: 'warning',
      confirmText: 'Unpublish',
      onConfirm: async () => {
        const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
        await fetch(`/api/admin/divisions${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-visibility', data: { id: divisionId, scheduleVisibility: 'unpublished' } }),
        });
        setDivisions(prev => prev.map(g => g.id === divisionId ? { ...g, scheduleVisibility: 'unpublished' } : g));
      },
    });
  }

  function handleUnpublishAll() {
    const published = divisions.filter(g => g.scheduleVisibility && g.scheduleVisibility !== 'unpublished');
    if (published.length === 0) return;
    setFeedback({
      isOpen: true,
      title: `Unpublish all ${published.length} divisions?`,
      message: 'These divisions will be removed from the public schedule page (you can republish them at any time). Registration stays closed — unpublishing does not reopen it; reopen registration separately if you want new sign-ups.',
      items: published.map(g => ({ label: g.name })),
      type: 'warning',
      confirmText: `Unpublish All (${published.length})`,
      onConfirm: async () => {
        const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
        await Promise.all(published.map(g =>
          fetch(`/api/admin/divisions${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set-visibility', data: { id: g.id, scheduleVisibility: 'unpublished' } }),
          })
        ));
        setDivisions(prev => prev.map(g => (g.scheduleVisibility && g.scheduleVisibility !== 'unpublished') ? { ...g, scheduleVisibility: 'unpublished' } : g));
      },
    });
  }

  function openAdd() {
    const divisionId = (filterGroup !== 'all' ? filterGroup : '') || (divisions[0]?.id ?? '');
    setForm({ ...emptyForm, divisionId });
    setVenueSearch('');
    setEditing(null);
    setModal('add');
    fetchModalSlots(divisionId);
  }

  function openEdit(g: Game) {
    setForm({
      divisionId: g.divisionId,
      homeTeamId: g.homeTeamId ?? '',
      awayTeamId: g.awayTeamId ?? '',
      homeSlotId: g.homeSlotId ?? '',
      awaySlotId: g.awaySlotId ?? '',
      homePlaceholder: g.homePlaceholder ?? '',
      awayPlaceholder: g.awayPlaceholder ?? '',
      date: g.date ?? '',
      time: g.time ?? '09:00',
      durationMinutes: typeof g.durationMinutes === 'number' ? g.durationMinutes : '',
      location: g.location ?? '',
      venueId: g.venueId ?? '',
      venueFacilityId: g.venueFacilityId ?? '',
      notes: g.notes ?? '',
    });
    const existingVenue    = g.venueId ? venues.find(d => d.id === g.venueId) : null;
    const existingFacility = g.venueFacilityId ? existingVenue?.facilities?.find(f => f.id === g.venueFacilityId) : null;
    setVenueSearch(
      existingFacility ? `${existingVenue!.name} — ${existingFacility.name}` :
      (existingVenue?.name ?? g.location ?? '')
    );
    setEditing(g);
    setModal('edit');
    fetchModalSlots(g.divisionId);
  }

  // All schedule writes go through the service-role games API. Direct browser-client
  // writes 403 — the `authenticated` role has no INSERT/UPDATE/DELETE grant on `games`.
  async function gamesApi(method: 'POST' | 'PATCH', body: Record<string, unknown>) {
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    const res = await fetch(`/api/admin/games${orgQuery}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || 'The request failed. Please try again.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Hard block: do not allow saving when a true overlap exists.
    if (modalConflict?.kind === 'overlap') return;
    // Playoffs wire participants by Seed/Winner/Loser placeholders, not pool slots.
    const isPlayoffGame = editing ? !!editing.isPlayoff : viewMode === 'playoff';
    const slotMode = !isPlayoffGame && modalSlots.length > 0;
    const homeSlot = slotMode ? modalSlots.find(s => s.id === form.homeSlotId) : null;
    const awaySlot = slotMode ? modalSlots.find(s => s.id === form.awaySlotId) : null;
    // Bracket codes are internal wiring, never user-typed. Editing a playoff game
    // KEEPS its existing code (so downstream Winner/Loser refs stay valid); a new
    // hand-added game gets a fresh, collision-free code assigned by the system.
    const effectiveBracketCode = isPlayoffGame
      ? (editing?.isPlayoff
          ? (editing.bracketCode || undefined)
          : nextManualBracketCode(
              games.filter(g => g.isPlayoff && g.divisionId === form.divisionId && g.id !== editing?.id),
              form.homePlaceholder,
              form.awayPlaceholder,
            ))
      : undefined;
    const data: Omit<Game, 'id'> = {
      tournamentId:    currentTournament?.id ?? '',
      divisionId:      form.divisionId,
      homeTeamId:      slotMode ? '' : (form.homeTeamId || ''),
      awayTeamId:      slotMode ? '' : (form.awayTeamId || ''),
      homeSlotId:      homeSlot?.id,
      awaySlotId:      awaySlot?.id,
      homePlaceholder: homeSlot?.displayName,
      awayPlaceholder: awaySlot?.displayName,
      date:              form.date,
      time:              form.time,
      durationMinutes:   form.durationMinutes === '' ? null : form.durationMinutes,
      location:          form.location,
      venueId:           form.venueId           || undefined,
      venueFacilityId:   form.venueFacilityId   || undefined,
      notes:             form.notes             || undefined,
      status:          editing?.status || 'scheduled',
      bracketCode:     effectiveBracketCode,
    };
    const w = data as Record<string, unknown>;

    if (isPlayoffGame) {
      // Persist the picker's choice directly. The picker's setSide already clears
      // the other side when a slot is actively changed, so we never need to force a
      // side to null here — and a resolved bracket game legitimately carries BOTH a
      // team id (filled by advancePlayoffs) and its source placeholder ("Winner
      // SF1"); force-nulling would wipe still-valid wiring when only the time/venue
      // is edited. Canonical placeholder strings are what advancePlayoffs resolves.
      w.isPlayoff = true;
      w.homeTeamId = form.homeTeamId || null;
      w.awayTeamId = form.awayTeamId || null;
      w.homePlaceholder = form.homePlaceholder || null;
      w.awayPlaceholder = form.awayPlaceholder || null;
      // Single-bracket inheritance: a hand-added game joins the division's existing
      // bracket so connectors + advancement resolve. The FIRST hand-added game (no
      // existing bracket) mints a fresh bracketId so its Winner/Loser advancement
      // stays scoped (advancePlayoffs guards by bracketId) and can't later leak into
      // an auto-generated bracket sharing the same codes. Multi-bracket (tiered/
      // split) manual single-game add is out of scope for V1 → left null.
      if (editing?.bracketId) {
        w.bracketId = editing.bracketId;
      } else {
        const ids = Array.from(new Set(
          games
            .filter(g => g.isPlayoff && g.divisionId === form.divisionId && g.id !== editing?.id && g.bracketId)
            .map(g => g.bracketId)
        ));
        w.bracketId = ids.length === 1 ? ids[0] : (ids.length === 0 ? crypto.randomUUID() : null);
      }
    }

    // Empty team ids must be null (nullable uuid column), never '' — saveGame
    // inserts the value raw and an '' would fail uuid validation. Covers playoff
    // placeholder sides and team-less / slot-based round-robin games alike.
    if (!w.homeTeamId) w.homeTeamId = null;
    if (!w.awayTeamId) w.awayTeamId = null;

    // A playoff game can't be scheduled on/before a game that feeds it (or moved so
    // a game it feeds would precede it). Validate this game against the division's bracket.
    if (isPlayoffGame && effectiveBracketCode) {
      const others = games
        .filter(g => g.isPlayoff && g.divisionId === form.divisionId && g.id !== editing?.id)
        .map(g => ({ code: g.bracketCode, home: g.homePlaceholder, away: g.awayPlaceholder, date: g.date, time: g.time }));
      const candidate = { code: effectiveBracketCode, home: w.homePlaceholder as string | null, away: w.awayPlaceholder as string | null, date: form.date, time: form.time };
      const involved = findBracketSchedulingViolations([...others, candidate])
        .filter(v => v.game === effectiveBracketCode || v.feeder === effectiveBracketCode);
      if (involved.length > 0) {
        setFeedback({
          isOpen: true,
          title: 'Fix the bracket order first',
          message: involved.map(v => v.reason === 'earlier-date'
            ? `${v.game} is on an earlier day than ${v.feeder}, which feeds it.`
            : `${v.game} must start after ${v.feeder} (same day) — set a later time, or move it to a later day.`).join('\n'),
          type: 'warning',
        });
        return;
      }
    }

    const dw = data as Record<string, unknown>;
    try {
      // Writes go through the service-role API: the `authenticated` role has no
      // INSERT/UPDATE/DELETE grant on `games`, so direct client writes 403.
      if (modal === 'add') {
        await gamesApi('POST', { action: 'create', tournamentId: currentTournament?.id, games: [data] });
      } else if (editing) {
        await gamesApi('PATCH', {
          action: 'update', id: editing.id,
          date: data.date || undefined,
          time: data.time || undefined,
          durationMinutes: data.durationMinutes ?? undefined,
          venueId: data.venueId,
          venueFacilityId: data.venueFacilityId,
          location: data.location,
          notes: data.notes,
          homeTeamId: dw.homeTeamId,
          awayTeamId: dw.awayTeamId,
          homePlaceholder: dw.homePlaceholder,
          awayPlaceholder: dw.awayPlaceholder,
          bracketCode: data.bracketCode,
        });
      }
      setModal(null);
      refresh();
    } catch (e) {
      setModal(null);
      setFeedback({
        isOpen: true,
        title: 'Could not save game',
        message: e instanceof Error ? e.message : 'Saving the game failed. Please try again.',
        type: 'warning',
      });
    }
  }

  async function markCancelled(id: string) {
    const orgParam = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    await fetch(`/api/admin/games${orgParam}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', id }),
    });
    refresh();
  }
  async function markScheduled(id: string) {
    const orgParam = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    await fetch(`/api/admin/games${orgParam}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revert-to-scheduled', id }),
    });
    refresh();
  }

  async function toggleGeneratorLock(id: string, nextLocked: boolean) {
    const orgParam = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    const res = await fetch(`/api/admin/games${orgParam}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, generatorLocked: nextLocked }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFeedback({
        isOpen: true,
        title: nextLocked ? 'Could Not Keep Game' : 'Could Not Release Game',
        message: data.error || 'The schedule could not be updated. Confirm the latest schedule migration has been applied, then try again.',
        type: 'warning',
      });
      return;
    }
    refresh();
  }

  async function handleSaveGame(gameId: string, data: { date: string; time: string; venueId: string; venueFacilityId: string; notes: string; homeTeamId: string; awayTeamId: string; homePlaceholder?: string; awayPlaceholder?: string }) {
    const orgParam = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    // Only playoff games wire participants by placeholder. Never forward placeholder
    // fields for round-robin/slot games — that would null-clobber a slot's stored
    // label (slot games keep their slot displayName in home/away_placeholder).
    const self = games.find(g => g.id === gameId);
    const isPlayoffGame = !!self?.isPlayoff;
    // Block scheduling a playoff game on/before a game that feeds it (or vice versa).
    if (isPlayoffGame && self?.bracketCode) {
      const others = games
        .filter(g => g.isPlayoff && g.divisionId === self.divisionId && g.id !== gameId)
        .map(g => ({ code: g.bracketCode, home: g.homePlaceholder, away: g.awayPlaceholder, date: g.date, time: g.time }));
      const candidate = { code: self.bracketCode, home: data.homePlaceholder ?? self.homePlaceholder, away: data.awayPlaceholder ?? self.awayPlaceholder, date: data.date, time: data.time };
      const involved = findBracketSchedulingViolations([...others, candidate])
        .filter(v => v.game === self.bracketCode || v.feeder === self.bracketCode);
      if (involved.length > 0) {
        setFeedback({
          isOpen: true,
          title: 'Fix the bracket order first',
          message: involved.map(v => v.reason === 'earlier-date'
            ? `${v.game} is on an earlier day than ${v.feeder}, which feeds it.`
            : `${v.game} must start after ${v.feeder} (same day) — set a later time, or move it to a later day.`).join('\n'),
          type: 'warning',
        });
        throw new Error('bracket-order'); // keep the inline row open
      }
    }
    const venue    = data.venueId ? venues.find(d => d.id === data.venueId) : null;
    const facility = data.venueFacilityId ? venue?.facilities?.find(f => f.id === data.venueFacilityId) : null;
    // Build a human-readable location string: "Lions Park — Diamond 1" or just "Lions Park"
    const locationStr = facility
      ? `${venue!.name} — ${facility.name}`
      : (venue?.name || undefined);
    await fetch(`/api/admin/games${orgParam}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:           'update',
        id:               gameId,
        date:             data.date             || undefined,
        time:             data.time             || undefined,
        venueId:          data.venueId          || undefined,
        venueFacilityId:  data.venueFacilityId  || undefined,
        location:         locationStr,
        notes:            data.notes            || undefined,
        homeTeamId:       data.homeTeamId,
        awayTeamId:       data.awayTeamId,
        // Playoff matchup wiring from the inline editor (mutually exclusive with team).
        homePlaceholder:  isPlayoffGame ? (data.homePlaceholder ?? undefined) : undefined,
        awayPlaceholder:  isPlayoffGame ? (data.awayPlaceholder ?? undefined) : undefined,
      }),
    });
    await refresh();
  }

  // Drag-to-move on the Timeline (D2.2) — optimistic, then persist via handleSaveGame.
  async function handleMoveGame(gameId: string, target: { date: string; time: string; venueId: string; venueFacilityId: string }) {
    const game = games.find(g => g.id === gameId);
    if (!game) return;
    setGames(prev => prev.map(g => g.id === gameId
      ? { ...g, date: target.date || g.date, time: target.time, venueId: target.venueId || undefined, venueFacilityId: target.venueFacilityId || undefined }
      : g));
    try {
      await handleSaveGame(gameId, {
        date: target.date || game.date,
        time: target.time,
        venueId: target.venueId,
        venueFacilityId: target.venueFacilityId,
        notes: game.notes ?? '',
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
      });
    } catch {
      // The save was blocked (e.g. dragging a playoff game on/before the game that
      // feeds it — handleSaveGame already showed the reason) or failed. Roll the
      // optimistic move back to the game's pre-drag position so the Timeline never
      // shows an unpersisted placement. (Previously this rejection escaped unhandled.)
      setGames(prev => prev.map(g => g.id === gameId ? game : g));
    }
  }

  function handleDeleteRequest(id: string) {
    const game = games.find(g => g.id === id);
    const code = game?.isPlayoff ? game.bracketCode : undefined;
    // Later bracket games whose Seed/Winner/Loser slot points at THIS game's
    // winner/loser. Removing this game would orphan them, so we reset those slots
    // to TBD (cascade-clear) to keep the bracket consistent. Scoped to the same
    // bracket so split/tiered pools with shared codes don't cross-clear.
    const refsFor = (g: Game, side: 'home' | 'away') => {
      const ph = side === 'home' ? g.homePlaceholder : g.awayPlaceholder;
      return ph === `Winner ${code}` || ph === `Loser ${code}`;
    };
    const dependents = code
      ? games.filter(g =>
          g.id !== id && g.isPlayoff && g.divisionId === game!.divisionId &&
          (game!.bracketId ? g.bracketId === game!.bracketId : true) &&
          (refsFor(g, 'home') || refsFor(g, 'away')))
      : [];
    const items = dependents.flatMap(d => {
      const out: { label: string }[] = [];
      if (refsFor(d, 'home')) out.push({ label: `${d.bracketCode || 'Game'} — Home (${d.homePlaceholder}) → TBD` });
      if (refsFor(d, 'away')) out.push({ label: `${d.bracketCode || 'Game'} — Away (${d.awayPlaceholder}) → TBD` });
      return out;
    });

    setFeedback({
      isOpen: true,
      title: dependents.length ? 'Remove game and reset linked slots?' : 'Remove Game?',
      message: dependents.length
        ? 'This game feeds later bracket games. Removing it resets those slots back to TBD so the bracket stays consistent — you can rewire them afterward.'
        : 'This will permanently remove the game from the schedule.',
      items: dependents.length ? items : undefined,
      type: 'danger',
      confirmText: dependents.length ? 'Remove & reset' : undefined,
      onConfirm: async () => {
        try {
          for (const d of dependents) {
            const updates: Record<string, unknown> = { action: 'update', id: d.id };
            if (refsFor(d, 'home')) { updates.homePlaceholder = null; updates.homeTeamId = null; }
            if (refsFor(d, 'away')) { updates.awayPlaceholder = null; updates.awayTeamId = null; }
            await gamesApi('PATCH', updates);
          }
          await gamesApi('POST', { action: 'delete-game', tournamentId: currentTournament?.id, gameIds: [id] });
          refresh();
        } catch (e) {
          setFeedback({
            isOpen: true,
            title: 'Could not remove game',
            message: e instanceof Error ? e.message : 'Removing the game failed. Please try again.',
            type: 'warning',
          });
        }
      }
    });
  }

  // Delete the whole playoff bracket for the active division (then "Build Bracket"
  // reappears so the organizer can rebuild it).
  function handleClearBracket() {
    const divId = playoffBuilderDivisionId;
    const count = games.filter(g => g.isPlayoff && g.divisionId === divId).length;
    if (!divId || count === 0) return;
    setFeedback({
      isOpen: true,
      title: 'Clear the whole bracket?',
      message: `This permanently removes all ${count} playoff game${count === 1 ? '' : 's'} for this division, including any scores already recorded — this cannot be undone. You can build a new bracket afterward.`,
      type: 'danger',
      confirmText: 'Clear bracket',
      onConfirm: async () => {
        try {
          await gamesApi('POST', { action: 'delete-division-playoff-games', divisionId: divId });
          // Clear now lives inside the bracket editor — exit it once the bracket is emptied.
          setEditingBracket(false);
          setBracketFocusGameId(undefined);
          refresh();
        } catch (e) {
          setFeedback({
            isOpen: true,
            title: 'Could not clear bracket',
            message: e instanceof Error ? e.message : 'Clearing the bracket failed. Please try again.',
            type: 'warning',
          });
        }
      },
    });
  }

  async function handleVenueSaved(saved: Venue) {
    const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
    const res = await fetch(`/api/admin/venues?tournamentId=${encodeURIComponent(currentTournament!.id)}${orgParam}`);
    const updated: Venue[] = res.ok ? await res.json() : [];
    setVenues(updated);
    setForm(f => ({ ...f, venueId: saved.id, location: saved.name }));
    setVenueSearch(saved.name);
    setAddVenueOpen(false);
  }

  const facilityLaneById = useMemo(() => new Map(facilityLanes.map(lane => [lane.id, lane])), [facilityLanes]);
  const scheduled = useMemo(() => games.map(game => {
    if (!game.scheduleFacilityLaneId || game.scheduleFacilityLaneLabel) return game;
    const lane = facilityLaneById.get(game.scheduleFacilityLaneId);
    return lane ? { ...game, scheduleFacilityLaneLabel: lane.label } : game;
  }), [games, facilityLaneById]);

  // ── Scope (divisions) derivations ─────────────────────────────────────────────
  // `selection` (null = all) holds the selected division ids and drives visibility;
  // `filterGroup` is derived for the per-division features ('all' unless exactly one).
  const stageGames = useMemo(
    () => scheduled.filter(g => (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)),
    [scheduled, viewMode],
  );
  // Show every division in the picker (not just ones that already have games in
  // this stage), so a new/empty division can be selected to start building games
  // or to preview its bracket before any games are scheduled.
  const scopeDivisions = useMemo(
    () => divisions.map(d => ({ id: d.id, name: d.name })),
    [divisions],
  );
  const isGameInScope = (g: Game) => selection === null || selection.has(g.divisionId || '');
  const selectedDivisionIds = selection === null ? new Set(divisions.map(d => d.id)) : selection;
  const filterGroup = selectedDivisionIds.size === 1 ? Array.from(selectedDivisionIds)[0] : 'all';

  // Bracket is per-division — when it's selected while 'all' is in scope, snap to the first division.
  useEffect(() => {
    if (layout === 'bracket' && filterGroup === 'all') {
      const first = scopeDivisions[0];
      if (first) setSelection(new Set([first.id]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, filterGroup, scopeDivisions]);

  // Division + view slice (no search, no status) — used for status chip counts
  const divisionGames = scheduled.filter(g =>
    isGameInScope(g) &&
    (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)
  );
  const unresolvedLaneGameCounts = divisionGames.reduce((map, game) => {
    if (game.scheduleFacilityLaneId && !game.venueId && !game.venueFacilityId) {
      map.set(game.scheduleFacilityLaneId, (map.get(game.scheduleFacilityLaneId) ?? 0) + 1);
    }
    return map;
  }, new Map<string, number>());
  const unresolvedFacilityLanes = facilityLanes
    .filter(lane => selectedDivisionIds.has(lane.divisionId) && !lane.resolvedVenueId && unresolvedLaneGameCounts.has(lane.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  const statusCounts: Record<string, number> = {
    scheduled: divisionGames.filter(g => g.status === 'scheduled').length,
    cancelled: divisionGames.filter(g => g.status === 'cancelled').length,
    completed: divisionGames.filter(g => g.status === 'completed').length,
  };
  const savedScheduleMetrics = useMemo(() => {
    if (!currentTournament || !filterGroup || filterGroup === 'all' || divisionGames.length === 0) return null;
    return buildScheduleMetrics({
      games: divisionGames,
      teams,
      divisions,
      venues,
      tournament: currentTournament,
      divisionId: filterGroup,
      includePlayoffs: viewMode === 'playoff',
      // Draft rules drive the live preview as the organizer adjusts them.
      maxGamesPerDay: healthRules.maxGamesPerDay,
      minRestMinutes: healthRules.minRestMinutes,
      expectedGamesPerParticipant: healthRules.targetGamesPerTeam ?? undefined,
    });
  }, [currentTournament, viewMode, filterGroup, divisionGames, teams, divisions, venues, healthRules]);

  // Re-seed the rules editor from the tournament's saved settings when the tournament changes.
  useEffect(() => {
    const resolved = getScheduleHealthRules(currentTournament);
    setHealthRules(resolved);
    setSavedHealthRules(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTournament?.id]);

  const healthRulesDirty =
    healthRules.maxGamesPerDay !== savedHealthRules.maxGamesPerDay ||
    healthRules.minRestMinutes !== savedHealthRules.minRestMinutes ||
    healthRules.targetGamesPerTeam !== savedHealthRules.targetGamesPerTeam;

  async function saveHealthRules() {
    if (!tournamentId) return;
    setSavingHealthRules(true);
    try {
      const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'patch-settings', id: tournamentId, data: { settings: { schedule_health_rules: healthRules } } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFeedback({
          isOpen: true,
          title: 'Could Not Save Rules',
          message: data.error || 'The schedule health rules could not be saved. Please try again.',
          type: 'warning',
        });
        return;
      }
      setSavedHealthRules(healthRules);
      // Keep the in-memory tournament fresh so the auto-Generator seeds from the new rules.
      if (currentTournament) {
        setCurrentTournament({ ...currentTournament, settings: { ...currentTournament.settings, schedule_health_rules: healthRules } });
      }
    } finally {
      setSavingHealthRules(false);
    }
  }
  const conflictCount = (savedScheduleMetrics?.venueConflictCount ?? 0) + (savedScheduleMetrics?.bufferConflictCount ?? 0);
  const hasConflicts = conflictCount > 0;
  useEffect(() => {
    if (!hasConflicts && conflictsOnly) setConflictsOnly(false);
  }, [hasConflicts, conflictsOnly]);
  const venueFilterOptions = Array.from(
    divisionGames.reduce((map, g) => {
      const key = getGameVenueKey(g);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        const display = getGameVenueDisplay(g);
        map.set(key, { key, label: display.name, sublabel: display.sublabel, count: 1 });
      }
      return map;
    }, new Map<string, { key: string; label: string; sublabel?: string; count: number }>()),
  ).map(([, option]) => option).sort((a, b) => a.label.localeCompare(b.label));
  const totalVenueCount = venueFilterOptions.reduce((t, o) => t + o.count, 0);

  // Mobile settings sheet: venue label + summary strip text
  const venueLabel = selectedVenueKeys.length === 0
    ? 'All venues'
    : selectedVenueKeys.length === 1
      ? (venueFilterOptions.find(o => o.key === selectedVenueKeys[0])?.label ?? '1 venue')
      : `${selectedVenueKeys.length} venues`;

  const settingsSummary = [
    layout === 'list' ? 'List' : layout === 'bracket' ? 'Bracket' : 'Timeline',
    venueFilterOptions.length > 1 ? venueLabel : null,
  ].filter(Boolean).join(' · ');

  const filtered  = scheduled.filter(g => {
    const matchesDivision = isGameInScope(g);
    const matchesView = viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff;
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(g.status as ScheduleStatusFilter);
    const matchesVenue = selectedVenueKeys.length === 0 || selectedVenueKeys.includes(getGameVenueKey(g));
    const q = search.toLowerCase();
    const matchesSearch = q === '' ||
      resolveTeam(g.homeTeamId, g.homePlaceholder).toLowerCase().includes(q) ||
      resolveTeam(g.awayTeamId, g.awayPlaceholder).toLowerCase().includes(q);
    return matchesDivision && matchesView && matchesStatus && matchesVenue && matchesSearch;
  });

  // True when the division+stage has games but the active search/status/venue
  // filters hide all of them — drives a "Clear filters" recovery empty state,
  // distinct from a division that genuinely has no games scheduled yet.
  const filtersHidingGames = filtered.length === 0 && divisionGames.length > 0;

  function clearScheduleFilters() {
    setSearch('');
    setSelectedVenueKeys([]);
    setSelectedStatuses(STATUS_FILTERS.map(f => f.key));
    setConflictsOnly(false);
  }

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Export handlers ────────────────────────────────────────────────────
  function buildScheduleRows() {
    return filtered.map(g => ({
      date:     g.date ?? '',
      time:     formatTime(g.time),
      division: getGroupName(g.divisionId),
      homeTeam: resolveTeam(g.homeTeamId, g.homePlaceholder),
      awayTeam: resolveTeam(g.awayTeamId, g.awayPlaceholder),
      location: (() => {
        const display = getGameVenueDisplay(g);
        return display.sublabel ? `${display.name} - ${display.sublabel}` : display.name;
      })(),
      status:   g.status,
    }));
  }

  async function handleExportXLSX() {
    await downloadXLSX(
      buildFilename({ org: currentOrg?.slug, dataset: 'schedule', scope: String(currentTournament?.year ?? '') }, 'xlsx'),
      serializeHeaders(SCHEDULE_EXPORT_COLS),
      serializeRows(buildScheduleRows(), SCHEDULE_EXPORT_COLS),
      'Schedule',
    );
  }

  function handleExportCSV() {
    const headers = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const rows    = serializeRows(buildScheduleRows(), SCHEDULE_EXPORT_COLS);
    downloadCSVBlob(
      buildFilename({ org: currentOrg?.slug, dataset: 'schedule', scope: String(currentTournament?.year ?? '') }, 'csv'),
      generateCSV(headers, rows),
    );
  }


  async function doPdfExport() {
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
      // Schedule always exports landscape + compact regardless of org default
      orientation: 'landscape',
      reportDensity: 'compact',
    };
    const headers = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const rows    = serializeRows(buildScheduleRows(), SCHEDULE_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'schedule', scope: String(currentTournament?.year ?? '') },
      'pdf',
    );
    await downloadPDF(filename, 'Tournament Schedule', currentTournament?.name, headers, rows, settings);
  }

  async function handleExportPDF() {
    // Context-aware: when the bracket is on screen, export the visual bracket;
    // List/Timeline export the schedule game table.
    if (layout === 'bracket') {
      await handleExportBracketPDF();
      return;
    }
    if (
      canUsePDF &&
      pdfSettings !== null &&
      Object.keys(pdfSettings).length === 0 &&
      !localStorage.getItem('flhq-pdf-setup-warned')
    ) {
      setPdfWarningOpen(true);
      return;
    }
    await doPdfExport();
  }

  async function handleExportBracketPDF(blank: boolean = false) {
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
      orientation: 'landscape',
    };
    const bracketGames = divisionGames.filter(g => g.isPlayoff);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: blank ? 'bracket-blank' : 'bracket', scope: activeDivision?.name ?? String(currentTournament?.year ?? '') },
      'pdf',
    );
    await downloadBracketPDF(
      filename,
      `${activeDivision?.name ?? 'Division'} — Playoff Bracket${blank ? ' (Blank)' : ''}`,
      currentTournament?.name,
      bracketGames,
      teams,
      settings,
      blank,
    );
  }

  function statusBadge(status: string) {
    if (status === 'completed') return <span className="badge badge-success">Final</span>;
    if (status === 'cancelled') return <span className="badge badge-danger">Cancelled</span>;
    return <span className="badge badge-warning">Scheduled</span>;
  }

  function openResolveFacilities() {
    setResolveFacilitiesError(null);
    setFacilityLaneSelections(Object.fromEntries(unresolvedFacilityLanes.map(lane => [
      lane.id,
      lane.resolvedVenueFacilityId
        ? `facility:${lane.resolvedVenueFacilityId}`
        : lane.resolvedVenueId
          ? `venue:${lane.resolvedVenueId}`
          : '',
    ])));
    setResolveFacilitiesOpen(true);
  }

  function parseFacilitySelection(value: string): { venueId: string | null; venueFacilityId: string | null } {
    if (!value) return { venueId: null, venueFacilityId: null };
    const [kind, id] = value.split(':');
    if (kind === 'facility') {
      const venue = venues.find(item => item.facilities?.some(facility => facility.id === id));
      return { venueId: venue?.id ?? null, venueFacilityId: id };
    }
    return { venueId: id, venueFacilityId: null };
  }

  async function resolveTemporaryFacilities() {
    setResolveFacilitiesError(null);
    const mappings = unresolvedFacilityLanes.map(lane => ({
      laneId: lane.id,
      ...parseFacilitySelection(facilityLaneSelections[lane.id] ?? ''),
    }));
    if (mappings.some(mapping => !mapping.venueId)) {
      setResolveFacilitiesError('Select a venue or facility for every temporary facility.');
      return;
    }

    setResolvingFacilities(true);
    try {
      const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const res = await fetch(`/api/admin/schedule-facility-lanes${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          tournamentId,
          divisionId: filterGroup,
          mappings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve temporary facilities');
      if (Array.isArray(data.lanes)) setFacilityLanes(data.lanes);
      setResolveFacilitiesOpen(false);
      await refresh();
    } catch (error) {
      setResolveFacilitiesError(error instanceof Error ? error.message : 'Failed to resolve temporary facilities');
    } finally {
      setResolvingFacilities(false);
    }
  }

  const activeDivision = divisions.find(g => g.id === filterGroup);
  // Default each generator to the selected division (if exactly one), otherwise to
  // the first division that still lacks that stage's schedule (round robin vs playoffs).
  const firstWithoutRoundRobin = divisions.find(d => !games.some(g => !g.isPlayoff && g.divisionId === d.id));
  const firstWithoutPlayoffs = divisions.find(d => !games.some(g => g.isPlayoff && g.divisionId === d.id));
  const roundRobinDefaultDivisionId = (filterGroup !== 'all' ? filterGroup : (firstWithoutRoundRobin?.id ?? divisions[0]?.id ?? ''));
  const playoffDefaultDivisionId = (filterGroup !== 'all' ? filterGroup : (firstWithoutPlayoffs?.id ?? divisions[0]?.id ?? ''));
  // The division the manual bracket builder targets (selected division, else the first without a bracket).
  const playoffBuilderDivisionId = playoffDefaultDivisionId;
  const playoffBuilderDivision = divisions.find(d => d.id === playoffBuilderDivisionId) ?? null;

  return (
    <div className={s.page}>
      <TournamentAdminHeader
        icon={<Calendar size={20} />}
        help={{
          module: 'tournaments',
          sectionIds: ['recipe-build-tournament-schedule', 'schedule-playoffs'],
          label: 'Schedule',
          fullGuideHref: currentOrg ? `/${currentOrg.slug}/admin/help/tournaments#recipe-build-tournament-schedule` : undefined,
        }}
        title={(
          <>
            <span className={styles.desktopTitle}>Schedule Management</span>
            <span className={styles.mobileTitle}>Schedule</span>
          </>
        )}
        subtitle={currentTournament ? (
          <>
            <span className={styles.desktopSubtitle}>{currentTournament.name} ({currentTournament.year})</span>
            <span className={styles.mobileSubtitle}>{currentTournament.name}</span>
          </>
        ) : 'Plan tournament games'}
        meta={(() => {
          // Per-division publish STATUS — lives under the subtitle (left), the
          // orientation layer. Plain dot + text, never a button: it shares no row
          // with the action buttons, which fixes the prior height-mismatch. Only
          // rendered once a division is published (the unpublished resting state
          // has no status to report — its action sits in `actions`).
          const ag = divisions.find(g => g.id === filterGroup);
          if (!ag) return null;
          const vis = ag.scheduleVisibility ?? 'unpublished';
          if (vis === 'unpublished') return null;
          return (
            <span
              className={styles.publishStatusText}
              title="Published with real team names"
            >
              <span className={styles.publishStatusDot} aria-hidden />{' '}
              Published
            </span>
          );
        })()}
        mobileActionsInline
        locked={isLocked}
        actions={(
          <>
            {/* Publish/Unpublish + Tools live in the toolbar Row 1 right group; the
                read-only status lives in `meta` (under the subtitle). The header actions
                row carries Export + the stage-aware primary (Add Game in Round Robin,
                Build/Edit Bracket in Playoffs). */}
            <ExportMenu
              className={styles.scheduleExportButton}
              formats={['xlsx', 'csv', 'pdf']}
              onExportXLSX={handleExportXLSX}
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              pdfLabel={layout === 'bracket' ? 'Bracket PDF' : 'PDF report'}
              pdfHint={layout === 'bracket' ? 'Printable visual bracket sheet' : 'Formatted, print-ready document'}
              onExportBlankPDF={layout === 'bracket' ? () => handleExportBracketPDF(true) : undefined}
              blankPdfLabel="Blank bracket PDF"
              blankPdfHint="Empty bracket to print and fill in by hand"
              planId={currentOrg?.planId}
              disabled={filtered.length === 0}
            />
            {/* Stage-aware primary. Round Robin → Add Game (single-game add is hidden in
                Playoffs, where games are managed in the bracket editor). */}
            {!isLocked && viewMode !== 'playoff' && (
              <button
                className={`btn btn-lime btn-data ${styles.addGameButton}`}
                onClick={openAdd}
                disabled={!currentTournament}
                aria-label="Add game"
                title="Add game"
              >
                <Plus size={14} /> <span className={styles.addGameLabel}>Add Game</span>
              </button>
            )}
            {/* Playoffs → Build/Edit Bracket takes the same header slot Add Game holds. */}
            {viewMode === 'playoff' && canBuildPlayoffsManually && !isLocked && !editingBracket && (() => {
              const built = games.some(g => g.isPlayoff && g.divisionId === playoffBuilderDivisionId);
              return (
                <button
                  className={`btn btn-lime btn-data ${styles.addGameButton}`}
                  onClick={() => enterBracketEditor()}
                  disabled={!currentTournament}
                  aria-label={built ? 'Edit bracket' : 'Build bracket'}
                  title={built ? 'Edit the playoff bracket' : 'Build the playoff bracket manually'}
                >
                  {built ? <Pencil size={14} /> : <Trophy size={14} />}{' '}
                  <span className={styles.addGameLabel}>{built ? 'Edit Bracket' : 'Build Bracket'}</span>
                </button>
              );
            })()}
          </>
        )}
      />

      <TournamentAdminToolbar ariaLabel="Schedule controls" className={styles.scheduleToolbar}>
        {/* ── Row 1 left: Division + view mode controls (grow) ── */}
        <ToolbarGroup grow className={`${styles.scheduleDivisionGroup} ${styles.scheduleStartGroup}`}>
          {divisions.length > 0 && !editingBracket && (
            <ToolbarSelect<string>
              className={styles.scheduleDivisionSelect}
              label="Division"
              value={filterGroup !== 'all' ? filterGroup : (divisions[0]?.id ?? '')}
              options={divisions.map(d => ({ value: d.id, label: d.name }))}
              onChange={(id) => setSelection(new Set([id]))}
            />
          )}
          {/* While editing a bracket, the view/stage controls are hidden so they can't
              unmount the editor (and lose edits) — exit via the editor's Cancel/Save. */}
          {/* Mobile: prominent stage toggle (desktop keeps the segmented control below) */}
          {!isPlayoffOnly && !editingBracket && (
          <div className={styles.mobileStageToggle} role="group" aria-label="Stage">
            {(['pool', 'playoff'] as const).map(v => (
              <button
                key={v}
                type="button"
                className={`${styles.mobileStageBtn} ${viewMode === v ? styles.mobileStageActive : ''}`}
                onClick={() => setViewMode(v)}
                aria-pressed={viewMode === v}
              >
                {v === 'pool' ? 'Round Robin' : 'Playoffs'}
              </button>
            ))}
          </div>
          )}
          {/* Stage: Round Robin | Playoffs */}
          {!isPlayoffOnly && !editingBracket && (
          <ToolbarSegmentedControl<'pool' | 'playoff'>
            className={styles.desktopModeControl}
            value={viewMode}
            options={[
              { value: 'pool', label: 'Round Robin' },
              { value: 'playoff', label: 'Playoffs' },
            ]}
            onChange={value => { setViewMode(value); }}
            ariaLabel="Stage"
          />
          )}
          {/* View: stage-dependent (Round Robin → List/Timeline, Playoffs → List/Bracket/Timeline) */}
          {!editingBracket && (
          <ToolbarSegmentedControl<'list' | 'bracket' | 'timeline'>
            className={styles.desktopModeControl}
            value={layout}
            options={viewMode === 'playoff'
              ? [{ value: 'list', label: 'List' }, { value: 'bracket', label: 'Bracket' }, { value: 'timeline', label: 'Timeline' }]
              : [{ value: 'list', label: 'List' }, { value: 'timeline', label: 'Timeline' }]}
            onChange={setLayout}
            ariaLabel="View"
          />
          )}
          {editingBracket && (
            <span className="text-label" style={{ color: 'var(--logic-lime)', alignSelf: 'center', padding: '0 0.5rem' }}>Editing bracket</span>
          )}
        </ToolbarGroup>

        {/* ── Row 1 right: action cluster — [bracket actions ·] Publish · Auto ──
            All actions are one right-aligned cluster (matches the Round Robin look,
            which the owner approved); bracket Build/Edit/Clear lead it in Playoffs.
            Single nowrap group → no mid-row gap, no wrapping to a second line. */}
        <ToolbarGroup align="end" className={`${styles.scheduleActionsGroup} ${styles.scheduleEndGroup}`}>
          {/* Bracket Build/Edit is the stage-aware PRIMARY in the header now (mirrors
              Add Game), so it's no longer duplicated here in the toolbar. */}
          {/* Publish/Unpublish ACTION — division-scoped (covers both stages). The
              read-only status lives in the header meta row (under the subtitle). */}
          {(() => {
            const ag = divisions.find(g => g.id === filterGroup);
            if (!ag || isLocked) return null;
            const vis = ag.scheduleVisibility ?? 'unpublished';
            if (vis === 'unpublished') {
              return (
                <button
                  className={`btn btn-lime btn-data ${styles.publishButton} ${styles.mobileIconButton}`}
                  onClick={() => setPublishModal({ divisionId: filterGroup })}
                  disabled={!currentTournament}
                  aria-label="Publish schedule"
                  title="Publish schedule"
                >
                  <Globe size={10} />
                  <span className={styles.mobileButtonLabel}>Publish</span>
                </button>
              );
            }
            return (
              <UnpublishControl
                className={styles.mobileIconButton}
                publishedCount={divisions.filter(g => g.scheduleVisibility && g.scheduleVisibility !== 'unpublished').length}
                currentLabel={ag.name ?? 'this division'}
                onUnpublishOne={() => handleUnpublish(filterGroup)}
                onUnpublishAll={handleUnpublishAll}
              />
            );
          })()}
          <ScheduleToolsMenu
            className={styles.scheduleToolsMenu}
            disabled={!currentTournament}
            canAutoGenerate={canAutoGenerateSchedule && !isPlayoffOnly}
            onAutoGenerate={openGenerator}
            canAutoBracket={canAutoGenerateSchedule}
            onAutoBracket={openAutoGenerator}
            canRainDelay={canRainDelay}
            onRainDelay={openRainDelay}
            rainDelayAvailable={hasUpcomingGames && !isLocked}
          />
        </ToolbarGroup>

        {/* ── Row 2: search + venue + status filters (hidden in Timeline — it has its own Day + Scope) ── */}
        {layout !== 'timeline' && !editingBracket && (
        <ToolbarGroup fullWidth className={styles.scheduleFilterGroup}>
          <ToolbarSearch className={styles.scheduleSearch} value={search} onChange={setSearch} placeholder="Search teams..." label="Search games" />
          {/* Mobile-only: Publish/Unpublish sits BESIDE the Tools menu (not inside
              it), next to search, so the division selector keeps the full first row.
              The desktop Row-1 action group is hidden on mobile. */}
          {!isLocked && (() => {
            const ag = divisions.find(g => g.id === filterGroup);
            if (!ag) return null;
            const isPub = (ag.scheduleVisibility ?? 'unpublished') !== 'unpublished';
            return (
              <span className={styles.scheduleMobilePublish}>
                {isPub ? (
                  <UnpublishControl
                    className={styles.mobileIconButton}
                    publishedCount={divisions.filter(g => g.scheduleVisibility && g.scheduleVisibility !== 'unpublished').length}
                    currentLabel={ag.name ?? 'this division'}
                    onUnpublishOne={() => handleUnpublish(filterGroup)}
                    onUnpublishAll={handleUnpublishAll}
                  />
                ) : (
                  <button
                    className={`btn btn-lime btn-data ${styles.publishButton} ${styles.mobileIconButton}`}
                    onClick={() => setPublishModal({ divisionId: filterGroup })}
                    disabled={!currentTournament}
                    aria-label="Publish schedule"
                    title="Publish schedule"
                  >
                    <Globe size={10} />
                    <span className={styles.mobileButtonLabel}>Publish</span>
                  </button>
                )}
              </span>
            );
          })()}
          <MobileToolsMenu
            className={styles.scheduleMobileTools}
            canAutoGenerate={canAutoGenerateSchedule && !isPlayoffOnly}
            onAutoGenerate={openGenerator}
            canAutoBracket={canAutoGenerateSchedule}
            onAutoBracket={openAutoGenerator}
            canRainDelay={canRainDelay}
            onRainDelay={openRainDelay}
            rainDelayAvailable={hasUpcomingGames && !isLocked}
          />
          <div className={styles.scheduleVenueDesktop}>
            <VenueFilterMenu
              options={venueFilterOptions}
              selectedKeys={selectedVenueKeys}
              onToggle={key => setSelectedVenueKeys(prev => prev.includes(key) ? prev.filter(value => value !== key) : [...prev, key])}
              onClear={() => setSelectedVenueKeys([])}
            />
          </div>
          <div className={`${s.statusFilters} ${styles.scheduleStatusFilters}`}>
            {STATUS_FILTERS.map(({ key, label }) => {
              const isActive = selectedStatuses.includes(key);
              const chipMod = STATUS_CHIP_CLASS[key];
              const count = statusCounts[key] ?? 0;
              // Dim 0-count chips (shared data-empty convention) so non-zero counts
              // draw the eye, and disable a 0-count chip that isn't already applied so
              // it can't route the user into an empty view. An applied chip stays
              // interactive so it can always be toggled back off.
              const isDisabled = count === 0 && !isActive;
              return (
                <button
                  key={key}
                  type="button"
                  data-empty={count === 0 ? 'true' : undefined}
                  disabled={isDisabled}
                  title={isDisabled ? `No ${label.toLowerCase()} games` : undefined}
                  className={[
                    s.filterChip,
                    styles.scheduleStatusChip,
                    key === 'scheduled' ? styles.scheduleStatusScheduled : '',
                    chipMod ? (s as Record<string, string>)[chipMod] : '',
                    isActive ? s.chipActive : '',
                    isActive ? styles.scheduleStatusActive : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedStatuses(prev => isActive ? prev.filter(status => status !== key) : [...prev, key])}
                >
                  {label.toUpperCase()}
                  <span className={s.chipCount}>{count}</span>
                </button>
              );
            })}
          </div>
        </ToolbarGroup>
        )}
      </TournamentAdminToolbar>

      {/* ── Mobile settings bottom sheet (Schedule) ────────── */}
      {mobileSettingsOpen && (
        <>
          <div className={styles.sheetBackdrop} onClick={() => setMobileSettingsOpen(false)} aria-hidden />
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="View settings">
            <div className={styles.sheetHandle} />
            <div className={styles.sheetBody}>
              {/* Stage (Round Robin / Playoffs) is the primary context switch and
                  lives on-screen via .mobileStageToggle — not duplicated here
                  (this sheet is for passive view config only). */}
              <div className={styles.sheetSection}>
                <div className={styles.sheetSectionLabel}>View</div>
                <div className={styles.sheetSegments}>
                  {(viewMode === 'playoff' ? (['list', 'bracket', 'timeline'] as const) : (['list', 'timeline'] as const)).map(v => (
                    <button key={v} type="button"
                      className={`${styles.sheetSeg} ${layout === v ? styles.sheetSegActive : ''}`}
                      onClick={() => setLayout(v)}
                    >
                      {v === 'list' ? 'List' : v === 'bracket' ? 'Bracket' : 'Timeline'}
                    </button>
                  ))}
                </div>
              </div>
              {venueFilterOptions.length > 1 && (
                <div className={styles.sheetSection}>
                  <div className={styles.sheetSectionLabel}>Venue</div>
                  <button
                    type="button"
                    className={`${styles.venueSheetBtn} ${selectedVenueKeys.length > 0 ? styles.venueSheetBtnActive : ''}`}
                    onClick={() => setVenueModalOpen(true)}
                  >
                    <span>{venueLabel}</span>
                    <ChevronRight size={13} aria-hidden />
                  </button>
                </div>
              )}
              <div className={styles.sheetSection}>
                <div className={styles.sheetSectionLabel}>Game Status</div>
                <div className={styles.sheetSegments}>
                  {STATUS_FILTERS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.sheetSeg} ${selectedStatuses.includes(key) ? styles.sheetSegActive : ''}`}
                      onClick={() => setSelectedStatuses(prev =>
                        prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className={styles.sheetDone} onClick={() => setMobileSettingsOpen(false)}>Done</button>
            </div>
          </div>

          {/* Venue nested modal */}
          {venueModalOpen && (
            <>
              <div className={styles.venueModalBackdrop} onClick={() => setVenueModalOpen(false)} aria-hidden />
              <div className={styles.venueModal} role="dialog" aria-modal="true" aria-label="Filter by venue">
                <div className={styles.venueModalHandle} />
                <div className={styles.venueModalHeader}>
                  <button type="button" className={styles.venueModalBack} onClick={() => setVenueModalOpen(false)}>← Back</button>
                  <span className={styles.venueModalTitle}>Venue</span>
                  {selectedVenueKeys.length > 0 && (
                    <button type="button" className={styles.venueModalClear} onClick={() => setSelectedVenueKeys([])}>Clear</button>
                  )}
                </div>
                <div className={styles.venueModalList}>
                  <button type="button"
                    className={`${styles.venueModalOption} ${selectedVenueKeys.length === 0 ? styles.venueModalOptionActive : ''}`}
                    onClick={() => setSelectedVenueKeys([])}
                  >
                    <span>All venues</span>
                    <span className={styles.venueModalCount}>{totalVenueCount}</span>
                  </button>
                  {venueFilterOptions.map(opt => (
                    <button key={opt.key} type="button"
                      className={`${styles.venueModalOption} ${selectedVenueKeys.includes(opt.key) ? styles.venueModalOptionActive : ''}`}
                      onClick={() => setSelectedVenueKeys(prev => prev.includes(opt.key) ? prev.filter(k => k !== opt.key) : [...prev, opt.key])}
                    >
                      <span>{opt.label}{opt.sublabel ? <span className={styles.venueModalSublabel}> — {opt.sublabel}</span> : ''}</span>
                      <span className={styles.venueModalCount}>{opt.count}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.venueModalFooter}>
                  <button type="button" className={styles.sheetDone} onClick={() => setVenueModalOpen(false)}>Done</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Active settings summary strip (mobile only) ──────── */}
      {currentTournament && !mobileSettingsOpen && !editingBracket && (
        <button
          type="button"
          className={styles.activeSettingsSummary}
          onClick={() => setMobileSettingsOpen(true)}
          aria-label={`View settings: ${settingsSummary}`}
        >
          <span className={styles.activeSettingsSummaryText}>{settingsSummary}</span>
          <span className={styles.summaryRight}>
            <span className={styles.statusCountTally} aria-hidden>
              {STATUS_FILTERS.map(({ key }) => (
                <span
                  key={key}
                  className={[
                    styles.tallyPill,
                    key === 'scheduled' ? styles.tallyScheduled : '',
                    key === 'cancelled' ? styles.tallyCancelled : '',
                    key === 'completed' ? styles.tallyCompleted : '',
                    !selectedStatuses.includes(key) ? styles.tallyInactive : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className={styles.tallyDot} />
                  {statusCounts[key] ?? 0}
                </span>
              ))}
            </span>
            <SlidersHorizontal size={12} className={styles.activeSettingsSummaryIcon} aria-hidden />
          </span>
        </button>
      )}


      {currentTournament && !gamesLoading && games.length === 0 && !editingBracket && (
        <HelpCallout
          variant="info"
          title="No games scheduled yet"
          body={isPlayoffOnly
            ? 'This is a bracket-only tournament. Open the Playoff Bracket Builder to seed your teams and generate the bracket.'
            : canAutoGenerateSchedule
            ? 'Build your schedule by adding games manually, or use the Round-Robin Generator to auto-build games from your teams. For playoffs, use the Playoff Bracket Builder.'
            : 'Build your schedule by adding games manually, or use the Playoff Bracket Builder to seed a bracket. The Round-Robin Generator is available with Tournament Plus or higher.'}
        />
      )}

      {savedScheduleMetrics && (
        <ScheduleHealthPanel
          metrics={savedScheduleMetrics}
          subtitle={`${activeDivision?.name ?? 'Division'} · ${viewMode === 'playoff' ? 'Saved playoffs' : 'Saved round robin'}`}
          defaultOpen={false}
          sticky
          onJumpToConflict={() => {
            document.getElementById('schedule-first-conflict')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          rules={healthRules}
          canEditRules={!isLocked}
          rulesDirty={healthRulesDirty}
          savingRules={savingHealthRules}
          onRuleChange={patch => setHealthRules(prev => ({ ...prev, ...patch }))}
          onSaveRules={saveHealthRules}
          onResetRules={() => setHealthRules(savedHealthRules)}
          onRestoreDefaultRules={() => setHealthRules(DEFAULT_HEALTH_RULES)}
        />
      )}

      {unresolvedFacilityLanes.length > 0 && (
        <div className={styles.facilityResolveBanner}>
          <div className={styles.facilityResolveCopy}>
            <Wrench size={14} />
            <div>
              <strong>{unresolvedFacilityLanes.length} temporary {unresolvedFacilityLanes.length === 1 ? 'facility' : 'facilities'} unresolved</strong>
              <span>{divisionGames.filter(g => g.scheduleFacilityLaneId && !g.venueId && !g.venueFacilityId).length} games are still using TBD facilities.</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-data"
            onClick={venues.length === 0 ? () => setAddVenueOpen(true) : openResolveFacilities}
            disabled={isLocked}
          >
            <MapPin size={13} />
            {venues.length === 0 ? 'Add Venue' : 'Resolve'}
          </button>
        </div>
      )}

      {tournamentLoading || gamesLoading ? (
        <div className="empty-state">
          <RefreshCw size={32} className="spin" style={{ opacity: 0.4 }} />
          <p>{tournamentLoading ? 'Loading tournament...' : 'Loading schedule...'}</p>
        </div>
      ) : editingBracket && viewMode === 'playoff' && currentTournament && playoffBuilderDivision ? (
        <BracketEditor
          division={playoffBuilderDivision}
          tournamentId={currentTournament.id}
          tournament={currentTournament}
          orgSlug={orgSlug ?? ''}
          existingGames={games.filter(g => g.isPlayoff && g.divisionId === playoffBuilderDivision.id)}
          canAutoGenerate={canAutoGenerateSchedule}
          focusGameId={bracketFocusGameId}
          minRestMinutes={healthRules.minRestMinutes}
          onUseAutoGenerator={() => { setEditingBracket(false); setBracketFocusGameId(undefined); openAutoGenerator(); }}
          onDone={(saved) => { setEditingBracket(false); setBracketFocusGameId(undefined); if (saved) refresh(); }}
          onClear={handleClearBracket}
        />
      ) : layout === 'timeline' ? (
        <ScheduleTimeline
          games={stageGames}
          venues={venues}
          divisions={divisions}
          teams={teams}
          tournament={currentTournament}
          selection={selection}
          stage={viewMode}
          onMove={isLocked ? undefined : handleMoveGame}
          onCreateVenue={() => setAddVenueOpen(true)}
        />
      ) : layout === 'bracket' && filterGroup === 'all' ? (
        <div className="empty-state">
          <Calendar size={40} style={{ opacity: 0.2 }} />
          <p>Brackets are per division — pick a division above to view its bracket.</p>
        </div>
      ) : layout === 'bracket' ? (
        <PlayoffBracketView
          games={filtered}
          teams={teams}
          division={activeDivision}
          canBuildManualBracket={canBuildPlayoffsManually && !isLocked}
          onBuildBracket={enterBracketEditor}
          onStartFromStandings={undefined}
          onEdit={(isLocked || !canBuildPlayoffsManually) ? undefined : () => enterBracketEditor()}
          onDelete={isLocked ? undefined : handleDeleteRequest}
          getGroupName={getGroupName}
          formatDate={formatDate}
          statusBadge={statusBadge}
          venues={venues}
        />
      ) : filterGroup === 'all' ? (
        <div className={s.compactList}>
          {filtered.length === 0 ? (
            filtersHidingGames ? (
              <div className="empty-state">
                <Calendar size={40} style={{ opacity: 0.2 }} />
                <p>No games match your filters.</p>
                <button type="button" className="btn btn-outline btn-data" style={{ marginTop: '0.6rem' }} onClick={clearScheduleFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <Calendar size={40} style={{ opacity: 0.2 }} />
                <p>{currentTournament ? 'No games found.' : 'No tournament selected.'}</p>
              </div>
            )
          ) : (
            divisions
              .map(div => ({ div, divGames: filtered.filter(g => g.divisionId === div.id) }))
              .filter(({ divGames }) => divGames.length > 0)
              .map(({ div, divGames }) => (
                <div key={div.id} className={styles.allDivisionSection}>
                  <div className={styles.allDivisionHeader}>
                    <span className={styles.allDivisionName}>{div.name}</span>
                    <span className={styles.allDivisionCount}>{divGames.length}</span>
                  </div>
                  <GameList
                    games={divGames}
                    teams={teams}
                    divisions={divisions}
                    venues={venues}
                    viewMode={viewMode}
                    groupByPool={true}
                    pools={div.pools}
                    onDelete={isLocked ? undefined : handleDeleteRequest}
                    onCancel={isLocked ? undefined : markCancelled}
                    onSchedule={isLocked ? undefined : markScheduled}
                    onToggleGeneratorLock={isLocked ? undefined : toggleGeneratorLock}
                    onSave={isLocked ? undefined : handleSaveGame}
                    onPlayoffEdit={(isLocked || !canBuildPlayoffsManually) ? undefined : (g) => enterBracketEditor(g.id, g.divisionId)}
                    onCreateVenue={() => setAddVenueOpen(true)}
                    mode="planning"
                    conflictsOnly={conflictsOnly}
                    tournament={currentTournament}
                  />
                </div>
              ))
          )}
        </div>
      ) : (
        <div className={s.compactList}>
          {filtered.length === 0 ? (
            filtersHidingGames ? (
              <div className="empty-state">
                <Calendar size={40} style={{ opacity: 0.2 }} />
                <p>No games match your filters.</p>
                <button type="button" className="btn btn-outline btn-data" style={{ marginTop: '0.6rem' }} onClick={clearScheduleFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <Calendar size={40} style={{ opacity: 0.2 }} />
                <p>{currentTournament ? 'No games found for this division.' : 'No tournament selected.'}</p>
              </div>
            )
          ) : (
            <GameList
              games={filtered}
              teams={teams}
              divisions={divisions}
              venues={venues}
              viewMode={viewMode}
              groupByPool={true}
              pools={activeDivision?.pools}
              onDelete={isLocked ? undefined : handleDeleteRequest}
              onCancel={isLocked ? undefined : markCancelled}
              onSchedule={isLocked ? undefined : markScheduled}
              onToggleGeneratorLock={isLocked ? undefined : toggleGeneratorLock}
              onSave={isLocked ? undefined : handleSaveGame}
              onPlayoffEdit={(isLocked || !canBuildPlayoffsManually) ? undefined : (g) => enterBracketEditor(g.id, g.divisionId)}
              onCreateVenue={() => setAddVenueOpen(true)}
              mode="planning"
              conflictsOnly={conflictsOnly}
              tournament={currentTournament}
            />
          )}
        </div>
      )}

      {resolveFacilitiesOpen && (
        <div className="modal-overlay" onClick={() => setResolveFacilitiesOpen(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-data)', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--logic-lime)', margin: 0 }}>
                Resolve Temporary Facilities
              </h3>
              <button className="btn btn-ghost btn-data" onClick={() => setResolveFacilitiesOpen(false)}><X size={16} /></button>
            </div>
            <div className={styles.resolveFacilityList}>
              {unresolvedFacilityLanes.map(lane => (
                <div key={lane.id} className={styles.resolveFacilityRow}>
                  <div>
                    <strong>{lane.label}</strong>
                    <span>{unresolvedLaneGameCounts.get(lane.id) ?? 0} games</span>
                  </div>
                  <select
                    className={styles.formSelect}
                    value={facilityLaneSelections[lane.id] ?? ''}
                    onChange={e => setFacilityLaneSelections(prev => ({ ...prev, [lane.id]: e.target.value }))}
                  >
                    <option value="">Select venue or facility...</option>
                    {venues.map(venue => (
                      <React.Fragment key={venue.id}>
                        <option value={`venue:${venue.id}`}>{venue.name}</option>
                        {(venue.facilities?.length ?? 0) > 0 && (
                          <optgroup label={venue.name}>
                            {venue.facilities!.map(facility => (
                              <option key={facility.id} value={`facility:${facility.id}`}>{facility.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </React.Fragment>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {resolveFacilitiesError && (
              <div className={styles.errorBanner} style={{ margin: '0.75rem 0 0' }}>
                <AlertCircle size={16} /> {resolveFacilitiesError}
              </div>
            )}
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost btn-data" onClick={() => setResolveFacilitiesOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary btn-data"
                onClick={resolveTemporaryFacilities}
                disabled={resolvingFacilities || unresolvedFacilityLanes.some(lane => !facilityLaneSelections[lane.id])}
              >
                {resolvingFacilities ? <><RefreshCw className="spin" size={14} /> Updating...</> : <><Check size={14} /> Update Games</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-data)', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--logic-lime)', margin: 0 }}>
                {modal === 'add' ? 'Add Game' : 'Edit Game'}
              </h3>
              <button className="btn btn-ghost btn-data" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row form-row-3" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Division *</label>
                  <select className="form-select" value={form.divisionId}
                    onChange={e => { setForm(f => ({ ...f, divisionId: e.target.value, homeTeamId: '', awayTeamId: '', homeSlotId: '', awaySlotId: '', homePlaceholder: '', awayPlaceholder: '' })); fetchModalSlots(e.target.value); }} required>
                    <option value="">Select...</option>
                    {divisions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input className="form-input" type="time" value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Game Length (min)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1" max="600" step="5"
                    placeholder="Default"
                    value={form.durationMinutes === '' ? '' : form.durationMinutes}
                    onChange={e => { const v = e.target.value; setForm(f => ({ ...f, durationMinutes: v === '' ? '' : (parseInt(v, 10) || '') })); }}
                  />
                  <small style={{ color: 'var(--white-40)', fontSize: '0.75rem' }}>Leave blank to use the division/event default. Set a value for a longer game (e.g. a final).</small>
                </div>
              </div>
              {(() => {
                if (modalSlotsLoading) {
                  return <div style={{ marginBottom: '1rem', padding: '0.7rem 0.875rem', fontSize: '0.85rem', color: 'var(--white-40)' }}>Loading slots…</div>;
                }

                // Playoffs: wire participants by Seed / Winner-of / Loser-of
                // placeholders (or a known team), not pool slots — so a hand-added
                // game connects into the bracket. Options use the canonical strings
                // advancePlayoffs resolves (buildPlaceholderOptions).
                const isPlayoffContext = editing ? !!editing.isPlayoff : viewMode === 'playoff';
                if (isPlayoffContext) {
                  const pDiv = divisions.find(g => g.id === form.divisionId);
                  const seedCount = pDiv?.playoffConfig?.teamsQualifying || groupTeams(form.divisionId).length || 8;
                  // Scope Winner/Loser codes + the single-use "already assigned" set
                  // to the SAME bracket group (tier) as the game being edited. Tiers
                  // reuse identical codes (QF1, SF1…) and are separated only by
                  // bracketId, so a division-wide scope would let one tier's
                  // "Winner QF1" hide the other tier's from its dropdown. Only scope
                  // when editing a game that already has a bracketId; a brand-new
                  // game (no tier yet) keeps the division-wide list.
                  const groupId = editing?.bracketId ?? null;
                  const sameGroup = (g: Game) => !groupId || g.bracketId === groupId;
                  const groupGames = games.filter(g => g.isPlayoff && g.divisionId === form.divisionId && sameGroup(g));
                  // Codes at or after the game being edited — its feed-graph
                  // descendants — can't feed it: don't offer e.g. "Winner FIN"
                  // for a semifinal (the final is fed by that semifinal, so it
                  // would be an impossible cycle). New games (no code yet) skip this.
                  const blockedCodes = editing?.bracketCode
                    ? descendantBracketCodes(editing.bracketCode, groupGames.map(g => ({ code: g.bracketCode || '', refs: [g.homePlaceholder, g.awayPlaceholder] })))
                    : new Set<string>();
                  const codes = groupGames
                    .filter(g => g.bracketCode && g.id !== editing?.id && !blockedCodes.has(g.bracketCode))
                    .map(g => g.bracketCode as string);
                  const opts = buildPlaceholderOptions(seedCount, codes);
                  const dteams = groupTeams(form.divisionId);
                  // Each Seed / Winner / Loser feeds exactly one slot: hide refs
                  // already wired into another game (and this game's other side).
                  // The side's own current value stays selectable for editing.
                  const assignedElsewhere = new Set(
                    groupGames
                      .filter(g => g.id !== editing?.id)
                      .flatMap(g => [g.homePlaceholder, g.awayPlaceholder])
                      .filter((x): x is string => !!x),
                  );
                  const setSide = (isHome: boolean, v: string) => {
                    const teamId = v.startsWith('team:') ? v.slice(5) : '';
                    const ph = v.startsWith('ph:') ? v.slice(3) : '';
                    setForm(f => isHome
                      ? { ...f, homeTeamId: teamId, homePlaceholder: ph }
                      : { ...f, awayTeamId: teamId, awayPlaceholder: ph });
                  };
                  const renderSide = (isHome: boolean, label: string) => {
                    const teamId = isHome ? form.homeTeamId : form.awayTeamId;
                    const ph = isHome ? form.homePlaceholder : form.awayPlaceholder;
                    const otherPh = isHome ? form.awayPlaceholder : form.homePlaceholder;
                    const value = teamId ? `team:${teamId}` : ph ? `ph:${ph}` : '';
                    const avail = (s: string) => s === ph || (!assignedElsewhere.has(s) && s !== otherPh);
                    const seeds = opts.seeds.filter(avail);
                    const winners = opts.winners.filter(avail);
                    const losers = opts.losers.filter(avail);
                    return (
                      <div className="form-group">
                        <label className="form-label">{label}</label>
                        <select className="form-select" value={value} onChange={e => setSide(isHome, e.target.value)}>
                          <option value="">Select…</option>
                          {seeds.length > 0 && (
                            <optgroup label="Seeds">
                              {seeds.map(s => <option key={s} value={`ph:${s}`}>{s}</option>)}
                            </optgroup>
                          )}
                          {winners.length > 0 && (
                            <optgroup label="Winner of…">
                              {winners.map(s => <option key={s} value={`ph:${s}`}>{s}</option>)}
                            </optgroup>
                          )}
                          {losers.length > 0 && (
                            <optgroup label="Loser of…">
                              {losers.map(s => <option key={s} value={`ph:${s}`}>{s}</option>)}
                            </optgroup>
                          )}
                          {dteams.length > 0 && (
                            <optgroup label="Teams">
                              {dteams.map(t => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    );
                  };
                  return (
                    <>
                      <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.8rem', background: 'var(--white-5)', borderRadius: '2px', fontSize: '0.78rem', color: 'var(--white-40)', lineHeight: 1.5 }}>
                        Pick a <strong>Seed #</strong> or the <strong>Winner / Loser</strong> of an earlier game. Later rounds can then point at this game&rsquo;s winner automatically.
                      </div>
                      <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                        {renderSide(true, 'Home')}
                        {renderSide(false, 'Away')}
                      </div>
                    </>
                  );
                }

                const ag = divisions.find(g => g.id === form.divisionId);
                const mPools = ag?.pools ?? [];

                if (modalSlots.length > 0) {
                  const slotOptions = mPools.length > 0
                    ? mPools.flatMap(pool => {
                        const ps = modalSlots.filter(s => s.poolId === pool.id);
                        return ps.length > 0 ? [{ label: pool.name, slots: ps }] : [];
                      })
                    : [{ label: null, slots: modalSlots }];
                  const renderSlotSelect = (value: string, onChange: (v: string) => void, label: string) => (
                    <div className="form-group">
                      <label className="form-label">{label}</label>
                      <select className="form-select" value={value} onChange={e => onChange(e.target.value)}>
                        <option value="">Select slot...</option>
                        {slotOptions.map(({ label: gLabel, slots }) =>
                          gLabel
                            ? <optgroup key={gLabel} label={gLabel}>{slots.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)}</optgroup>
                            : slots.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)
                        )}
                      </select>
                    </div>
                  );
                  return (
                    <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                      {renderSlotSelect(form.homeSlotId, v => setForm(f => ({ ...f, homeSlotId: v })), 'Home Slot')}
                      {renderSlotSelect(form.awaySlotId, v => setForm(f => ({ ...f, awaySlotId: v })), 'Away Slot')}
                    </div>
                  );
                }

                return (
                  <>
                    <div style={{ marginBottom: '0.75rem', padding: '0.7rem 0.875rem', background: 'var(--white-5)', borderRadius: '2px', fontSize: '0.8rem', color: 'var(--white-40)' }}>
                      No slots configured for this division. Configure pools in Division Settings to use slot-based scheduling.
                    </div>
                    <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Home Team</label>
                        <select className="form-select" value={form.homeTeamId} onChange={e => setForm(f => ({ ...f, homeTeamId: e.target.value }))}>
                          <option value="">Select...</option>
                          {groupTeams(form.divisionId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Away Team</label>
                        <select className="form-select" value={form.awayTeamId} onChange={e => setForm(f => ({ ...f, awayTeamId: e.target.value }))}>
                          <option value="">Select...</option>
                          {groupTeams(form.divisionId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                );
              })()}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Venue *</label>
                  <Link
                    href={`/${orgSlug}/admin/tournaments/venues`}
                    className="btn btn-outline btn-data"
                    style={{ height: '26px', fontSize: '0.75rem', padding: '0 0.6rem', gap: '0.25rem', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                  >
                    <MapPin size={12} /> Manage venues
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <MapPin size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--white-30)', pointerEvents: 'none', zIndex: 1 }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: '2.1rem' }}
                    placeholder={venues.length > 0 ? 'Search venues…' : 'Type a location…'}
                    value={venueSearch}
                    autoComplete="off"
                    required
                    onChange={e => {
                      const v = e.target.value;
                      setVenueSearch(v);
                      setForm(f => ({ ...f, location: v, venueId: '', venueFacilityId: '' }));
                      setVenueDropdownOpen(true);
                    }}
                    onFocus={() => { if (venues.length > 0) setVenueDropdownOpen(true); }}
                    onBlur={() => setTimeout(() => setVenueDropdownOpen(false), 150)}
                  />
                  {venueDropdownOpen && (() => {
                    const q = venueSearch.toLowerCase();
                    // Build a flat list of facility-level entries for search
                    type VenueOption = { venueId: string; facilityId: string; label: string; sublabel?: string };
                    const options: VenueOption[] = [];
                    for (const v of venues) {
                      const facList = v.facilities ?? [];
                      if (facList.length > 0) {
                        for (const f of facList) {
                          const label = `${v.name} — ${f.name}`;
                          if (!q || label.toLowerCase().includes(q) || (v.address || '').toLowerCase().includes(q)) {
                            options.push({ venueId: v.id, facilityId: f.id, label, sublabel: v.address || undefined });
                          }
                        }
                      } else {
                        if (!q || v.name.toLowerCase().includes(q) || (v.address || '').toLowerCase().includes(q)) {
                          options.push({ venueId: v.id, facilityId: '', label: v.name, sublabel: v.address || undefined });
                        }
                      }
                    }
                    if (options.length === 0) return null;
                    return (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200,
                        background: '#0d0f18', border: '1px solid var(--border)',
                        borderRadius: '2px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                        maxHeight: '220px', overflowY: 'auto',
                      }}>
                        {options.map((opt, i) => (
                          <div
                            key={`${opt.venueId}-${opt.facilityId}`}
                            onMouseDown={() => {
                              setForm(f => ({ ...f, venueId: opt.venueId, venueFacilityId: opt.facilityId, location: opt.label }));
                              setVenueSearch(opt.label);
                              setVenueDropdownOpen(false);
                            }}
                            style={{
                              padding: '0.55rem 0.875rem',
                              cursor: 'pointer',
                              borderBottom: i < options.length - 1 ? '1px solid var(--border)' : 'none',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--white-5)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                          >
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--white)' }}>{opt.label}</div>
                            {opt.sublabel && <div style={{ fontSize: '0.73rem', color: 'var(--white-40)', marginTop: '1px' }}>{opt.sublabel}</div>}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                {!form.venueId && (
                  <small style={{ display: 'block', marginTop: '0.35rem', color: 'var(--white-40)', fontSize: '0.72rem' }}>
                    Venues are shared across this tournament — search above before adding, or use “Manage venues” to see the full list.
                  </small>
                )}
                {form.venueId && (
                  <div style={{ marginTop: '0.35rem', fontSize: '0.73rem', color: 'var(--white-40)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Check size={11} style={{ color: 'var(--logic-lime)' }} />
                    {form.venueFacilityId ? 'Linked to saved facility' : 'Linked to saved venue'}
                  </div>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" placeholder="Any additional info" value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* Venue conflict banner */}
              {modalConflict && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.7rem 0.875rem',
                  borderRadius: '2px',
                  background: modalConflict.kind === 'overlap'
                    ? 'rgba(239, 68, 68, 0.08)'
                    : 'rgba(251, 191, 36, 0.08)',
                  border: `1px solid ${modalConflict.kind === 'overlap'
                    ? 'rgba(239, 68, 68, 0.4)'
                    : 'rgba(251, 191, 36, 0.35)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontWeight: 700, fontSize: '0.82rem', margin: 0,
                        color: modalConflict.kind === 'overlap' ? '#f87171' : '#fbbf24',
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                      }}>
                        <AlertTriangle size={13} />
                        {modalConflict.kind === 'overlap' ? 'Venue conflict — game windows overlap' : 'Buffer zone warning'}
                      </p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--white-60)', margin: '0.3rem 0 0', lineHeight: 1.45 }}>
                        {modalConflict.conflictingDivisionName} already has a game at this venue that{' '}
                        {modalConflict.kind === 'overlap'
                          ? 'physically overlaps this time. Change the time to save.'
                          : 'ends within the required buffer window. You can still save or choose a cleaner slot.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-data"
                      style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.8rem' }}
                      onClick={() => setForm(f => ({ ...f, time: modalConflict.availableAt }))}
                    >
                      Use {modalConflict.availableAt} ↑
                    </button>
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost btn-data" onClick={() => setModal(null)}>Cancel</button>
                {modalConflict?.kind === 'buffer' ? (
                  <>
                    <button type="submit" className="btn btn-outline btn-data" id="schedule-save-btn" style={{ borderColor: 'rgba(251,191,36,0.5)', color: '#fbbf24' }}>
                      <Check size={14} /> Save Anyway
                    </button>
                  </>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary btn-data"
                    id="schedule-save-btn"
                    disabled={modalConflict?.kind === 'overlap'}
                    title={modalConflict?.kind === 'overlap' ? 'Resolve the venue conflict before saving' : undefined}
                  >
                    <Check size={14} /> Save Game
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {showGenerator && currentTournament && canAutoGenerateSchedule && (
        <ScheduleGenerator
          tournament={currentTournament}
          orgSlug={orgSlug ?? ''}
          divisions={divisions}
          defaultDivisionId={roundRobinDefaultDivisionId}
          teams={teams}
          venues={venues}
          existingGames={games}
          onCancel={() => setShowGenerator(false)}
          onComplete={() => {
            setShowGenerator(false);
            refresh();
          }}
        />
      )}

      {showPlayoffWizard && currentTournament && canBuildPlayoffsManually && divisions.length > 0 && (
        <PlayoffWizard
          divisions={divisions}
          defaultDivisionId={playoffDefaultDivisionId}
          tournamentId={currentTournament.id}
          tournament={currentTournament}
          orgSlug={orgSlug ?? ''}
          canAutoSchedule={canAutoGenerateSchedule}
          initialConfig={playoffWizardConfig}
          onClose={() => setShowPlayoffWizard(false)}
          onComplete={() => {
            setShowPlayoffWizard(false);
            refresh();
          }}
        />
      )}

      {addVenueOpen && currentTournament && (
        <AddVenueModal
          tournamentId={currentTournament.id}
          orgSlug={orgSlug ?? ''}
          onClose={() => setAddVenueOpen(false)}
          onSaved={handleVenueSaved}
          zIndex={1100}
        />
      )}

      {publishModal && currentTournament && (
        <PublishScheduleModal
          defaultDivisionId={publishModal.divisionId}
          divisions={divisions}
          tournament={currentTournament}
          canNotify={canNotify}
          orgSlug={currentOrg?.slug ?? ''}
          onClose={() => setPublishModal(null)}
          onPublished={handlePublishDone}
          onDivisionClosed={handleDivisionClosed}
        />
      )}

      {showShiftDay && tournamentId && (
        <ShiftDayModal
          tournamentId={tournamentId}
          orgSlug={currentOrg?.slug ?? ''}
          games={games}
          teams={teams}
          divisions={divisions}
          getVenueKey={getGameVenueKey}
          getVenueLabel={getGameVenueDisplay}
          canPushFans={currentOrg?.planId ? hasPlanFeature(currentOrg.planId, 'fan_score_alerts') : false}
          onClose={() => setShowShiftDay(false)}
          onApplied={() => { void refresh(); }}
        />
      )}

      <FeedbackModal
        {...feedback}
        onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))}
      />
      <FeedbackModal
        isOpen={pdfWarningOpen}
        onClose={() => { localStorage.setItem('flhq-pdf-setup-warned', '1'); setPdfWarningOpen(false); }}
        onConfirm={() => { localStorage.setItem('flhq-pdf-setup-warned', '1'); void doPdfExport(); }}
        title="PDF settings not configured"
        message="This export will use default FieldLogicHQ styling — no custom header, logo, or footer. Visit Org Settings → PDF Settings to customize all future exports."
        confirmText="Download anyway"
        cancelText="Not now"
        type="info"
      />
    </div>
  );
}

function VenueFilterMenu({
  options,
  selectedKeys,
  onToggle,
  onClear,
}: {
  options: Array<{ key: string; label: string; sublabel?: string; count: number }>;
  selectedKeys: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedCount = selectedKeys.length;
  const buttonText = selectedCount === 0
    ? 'All venues'
    : selectedCount === 1
      ? options.find(option => option.key === selectedKeys[0])?.label ?? '1 venue'
      : `${selectedCount} venues`;

  return (
    <div className={styles.venueFilterRoot} ref={rootRef}>
      <button
        type="button"
        className={`${styles.venueFilterButton} ${selectedCount > 0 ? styles.venueFilterButtonActive : ''}`}
        onClick={() => setOpen(value => !value)}
        disabled={options.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        title={options.length === 0 ? 'No venues in this view' : 'Filter by venue'}
      >
        <MapPin size={13} />
        <span>{buttonText}</span>
      </button>
      {open && (
        <div className={styles.venueFilterPanel} role="menu">
          <div className={styles.venueFilterHeader}>
            <span>Venues</span>
            {selectedCount > 0 && (
              <button type="button" onClick={onClear}>
                <X size={12} /> Clear
              </button>
            )}
          </div>
          <div className={styles.venueFilterList}>
            <button
              type="button"
              className={`${styles.venueFilterOption} ${selectedCount === 0 ? styles.venueFilterOptionActive : ''}`}
              onClick={onClear}
              role="menuitemcheckbox"
              aria-checked={selectedCount === 0}
            >
              <span className={styles.venueFilterCheck}>{selectedCount === 0 ? <Check size={12} /> : null}</span>
              <span className={styles.venueFilterName}><span className={styles.venueFilterNamePrimary}>All venues</span></span>
              <span className={styles.venueFilterCount}>{options.reduce((total, option) => total + option.count, 0)}</span>
            </button>
            {options.map(option => {
              const isSelected = selectedKeys.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`${styles.venueFilterOption} ${isSelected ? styles.venueFilterOptionActive : ''}`}
                  onClick={() => onToggle(option.key)}
                  role="menuitemcheckbox"
                  aria-checked={isSelected}
                >
                  <span className={styles.venueFilterCheck}>{isSelected ? <Check size={12} /> : null}</span>
                  <span className={styles.venueFilterName}>
                    <span className={styles.venueFilterNamePrimary}>{option.label}</span>
                    {option.sublabel && <span className={styles.venueFilterSublabel}>{option.sublabel}</span>}
                  </span>
                  <span className={styles.venueFilterCount}>{option.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PublishScheduleModal({
  defaultDivisionId,
  divisions,
  tournament,
  canNotify,
  orgSlug,
  onClose,
  onPublished,
  onDivisionClosed,
}: {
  defaultDivisionId: string;
  divisions: import('@/lib/types').Division[];
  tournament: import('@/lib/types').Tournament;
  canNotify: boolean;
  orgSlug: string;
  onClose: () => void;
  onPublished: (updates: { id: string; scheduleVisibility: 'published' }[]) => void;
  onDivisionClosed: (id: string) => void;
}) {
  const publishable = divisions.filter(g => !g.scheduleVisibility || g.scheduleVisibility === 'unpublished');

  const [selectedIds, setSelectedIds] = React.useState<string[]>([defaultDivisionId]);
  const [notify, setNotify] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ notified: number } | null>(null);
  const [showRegCloseWarning, setShowRegCloseWarning] = React.useState(false);

  const targets = publishable.filter(g => selectedIds.includes(g.id));
  const allUnpublishedSelected = publishable.length > 0 && publishable.every(d => selectedIds.includes(d.id));
  // Publishing always uses real names and closes the division (mig 129). Any still-open
  // selected division will be closed as part of publishing.
  const openTargets = targets.filter(g => !g.isClosed);
  const willCloseOnPublish = openTargets.length > 0;

  function toggleDivision(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function doPublish() {
    setLoading(true);
    setError(null);
    try {
      const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const divisionIds = targets.map(g => g.id);

      // Publishing always uses real team names, so close any still-open selected
      // divisions first — stopping new public submissions.
      if (openTargets.length > 0) {
        await Promise.all(openTargets.map(g =>
          fetch(`/api/admin/divisions${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set-closed', id: g.id, data: { isClosed: true } }),
          })
        ));
        openTargets.forEach(g => onDivisionClosed(g.id));
      }

      const res = await fetch(`/api/admin/schedule-publish${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id, divisionIds, visibility: 'published', notify }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to publish');
      const data = await res.json();
      setResult({ notified: data.notified ?? 0 });
      onPublished(divisionIds.map(id => ({ id, scheduleVisibility: 'published' as const })));
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      setShowRegCloseWarning(false);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (willCloseOnPublish) {
      setShowRegCloseWarning(true);
      return;
    }
    void doPublish();
  }

  const titleText = targets.length === 0 ? 'Publish Schedule'
    : targets.length === 1 ? `Publish ${targets[0].name}`
    : `Publish ${targets.length} Divisions`;

  return (
    <div className="modal-overlay" onClick={result ? onClose : undefined}>
      <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={16} style={{ color: 'var(--logic-lime)' }} /> {titleText}
          </h3>
          <button className="btn btn-ghost btn-data" onClick={onClose}><X size={16} /></button>
        </div>

        <div>
          {result ? (
            <div style={{ textAlign: 'center', padding: '0.5rem 0 0.25rem' }}>
              <div style={{
                width: '44px', height: '44px', margin: '0 auto 0.75rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', fontSize: '1.5rem', fontWeight: 700,
                color: 'var(--success)',
                background: 'rgba(var(--success-rgb),0.12)',
                border: '1px solid rgba(var(--success-rgb),0.35)',
              }}>✓</div>
              <p style={{ fontWeight: 700, color: 'var(--logic-lime)', marginBottom: result.notified > 0 ? '0.35rem' : 0 }}>Schedule Published!</p>
              {result.notified > 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--white-60)' }}>
                  Notified {result.notified} team{result.notified !== 1 ? 's' : ''} by email.
                </p>
              )}
              <button className="btn btn-primary btn-data" onClick={onClose} style={{ marginTop: '1.25rem', minWidth: '160px' }}>Done</button>
            </div>
          ) : showRegCloseWarning ? (
            /* ── Registration close confirmation screen ── */
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.65rem', color: 'var(--fl-text)' }}>
                Close registration and publish?
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--white-60)', lineHeight: 1.55, marginBottom: openTargets.length > 1 ? '0.75rem' : '1.25rem' }}>
                {openTargets.length === 1
                  ? `Registration for ${openTargets[0].name} is still open. Publishing will close it — stopping new submissions from the public page.`
                  : `Registration is still open for ${openTargets.length} divisions. Publishing will close them — stopping new submissions from the public page.`}
              </p>
              {openTargets.length > 1 && (
                <div style={{ marginBottom: '1.25rem', background: 'var(--white-5)', border: '1px solid var(--white-8)', borderRadius: '2px', padding: '0.5rem 0.75rem' }}>
                  {openTargets.map(g => (
                    <div key={g.id} style={{ fontSize: '0.83rem', color: 'var(--white-70)', padding: '0.2rem 0' }}>{g.name}</div>
                  ))}
                </div>
              )}
              {error && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.75rem', background: 'rgba(var(--danger-rgb),0.1)', border: '1px solid rgba(var(--danger-rgb),0.3)', borderRadius: '2px', fontSize: '0.82rem', color: '#f87171' }}>
                  {error}
                </div>
              )}
              <div className="modal-footer">
                <button className="btn btn-ghost btn-data" onClick={() => setShowRegCloseWarning(false)} disabled={loading}>Go Back</button>
                <button className="btn btn-primary btn-data" onClick={() => void doPublish()} disabled={loading}>
                  {loading ? 'Publishing…' : 'Close Registration & Publish'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Division selector — shown only when there are multiple unpublished divisions */}
              {publishable.length > 1 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--white-50)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                      Divisions
                    </p>
                    {!allUnpublishedSelected && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-data"
                        style={{ fontSize: '0.65rem', padding: '2px 8px' }}
                        onClick={() => setSelectedIds(publishable.map(d => d.id))}
                      >
                        Select all unpublished
                      </button>
                    )}
                  </div>
                  <div style={{ background: 'var(--white-5)', border: '1px solid var(--white-10)', borderRadius: '2px' }}>
                    {divisions.map(g => {
                      const isLive = g.scheduleVisibility && g.scheduleVisibility !== 'unpublished';
                      const isChecked = selectedIds.includes(g.id);
                      return (
                        <label
                          key={g.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.65rem',
                            padding: '0.5rem 0.75rem',
                            borderBottom: '1px solid var(--white-5)',
                            cursor: isLive ? 'default' : 'pointer',
                            opacity: isLive ? 0.5 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isLive ? false : isChecked}
                            disabled={isLive}
                            onChange={() => !isLive && toggleDivision(g.id)}
                            style={{ flexShrink: 0 }}
                          />
                          <span style={{ flex: 1, fontWeight: 600, fontSize: '0.85rem', color: 'var(--fl-text)' }}>{g.name}</span>
                          {isLive ? (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--success)', background: 'rgba(var(--success-rgb),0.1)', border: '1px solid rgba(var(--success-rgb),0.25)', padding: '1px 6px', borderRadius: '2px' }}>LIVE</span>
                          ) : (
                            <span style={{ fontSize: '0.73rem', color: g.isClosed ? 'var(--logic-lime)' : 'var(--white-30)' }}>
                              {g.isClosed ? 'Reg. closed' : 'Reg. open'}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <p style={{ color: 'var(--white-70)', fontSize: '0.88rem', marginBottom: willCloseOnPublish ? '0.85rem' : '1.25rem', lineHeight: 1.55 }}>
                {targets.length === 0
                  ? 'Select at least one division to publish.'
                  : targets.length === 1
                    ? 'This division\'s schedule will appear on your public tournament page with real team names. Saved edits are visible automatically after publishing.'
                    : `${targets.length} division${targets.length !== 1 ? 's' : ''} will appear on your public tournament page with real team names. Saved edits are visible automatically after publishing.`}
              </p>

              {willCloseOnPublish && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.55rem',
                  marginBottom: '1.25rem', padding: '0.6rem 0.75rem',
                  background: 'rgba(var(--logic-lime-rgb),0.06)',
                  border: '1px solid rgba(var(--logic-lime-rgb),0.25)', borderRadius: '2px',
                }}>
                  <AlertCircle size={14} style={{ color: 'var(--logic-lime)', marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.8rem', color: 'var(--white-70)', lineHeight: 1.45 }}>
                    {openTargets.length === 1
                      ? `Registration for ${openTargets[0].name} is still open and will be closed when you publish.`
                      : `Registration is still open for ${openTargets.length} of the selected divisions and will be closed when you publish.`}
                  </div>
                </div>
              )}

              <div style={{
                borderTop: '1px solid var(--white-8)', paddingTop: '1rem', marginBottom: '1rem',
              }}>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                  cursor: canNotify ? 'pointer' : 'default',
                  opacity: canNotify ? 1 : 0.5,
                }}>
                  <input
                    type="checkbox"
                    checked={notify}
                    onChange={e => canNotify && setNotify(e.target.checked)}
                    disabled={!canNotify}
                    style={{ marginTop: '3px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Send size={12} /> Notify registered teams by email
                      {!canNotify && (
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                          color: 'var(--blueprint-blue)', background: 'rgba(var(--blueprint-blue-rgb),0.12)',
                          border: '1px solid rgba(var(--blueprint-blue-rgb),0.25)',
                          padding: '1px 6px', borderRadius: '2px',
                        }}>Tournament Plus</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--white-50)', marginTop: '0.2rem', lineHeight: 1.45 }}>
                      {canNotify
                        ? 'Send a "schedule is live" email to all accepted team contacts.'
                        : 'Upgrade to Tournament Plus to send schedule notifications.'}
                    </div>
                  </div>
                </label>
              </div>

              {targets.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.55rem',
                  marginBottom: '1rem', padding: '0.6rem 0.75rem',
                  background: 'var(--white-03)',
                  border: '1px solid var(--white-10)', borderRadius: '2px',
                }}>
                  <AlertCircle size={14} style={{ color: 'var(--white-40)', marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.78rem', color: 'var(--white-50)', lineHeight: 1.45 }}>
                    Publishing also schedules a game-day reminder email to each accepted team for the evening before their first game — this is sent even if the box above is left unchecked.
                  </div>
                </div>
              )}

              {error && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.75rem', background: 'rgba(var(--danger-rgb),0.1)', border: '1px solid rgba(var(--danger-rgb),0.3)', borderRadius: '2px', fontSize: '0.82rem', color: '#f87171' }}>
                  {error}
                </div>
              )}

              <div className="modal-footer">
                <button className="btn btn-ghost btn-data" onClick={onClose} disabled={loading}>Cancel</button>
                <button className="btn btn-primary btn-data" onClick={handleConfirm} disabled={loading || targets.length === 0}>
                  {loading ? 'Publishing…' : `Publish${targets.length > 1 ? ` ${targets.length} Divisions` : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Schedule Tools dropdown ────────────────────────────────────────────────────
function UnpublishControl({
  publishedCount,
  currentLabel,
  onUnpublishOne,
  onUnpublishAll,
  className,
}: {
  publishedCount: number;
  currentLabel: string;
  onUnpublishOne: () => void;
  onUnpublishAll: () => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Only one division live → plain single-action button, no dropdown needed.
  if (publishedCount <= 1) {
    return (
      <button
        type="button"
        className={`btn btn-ghost btn-data ${className ?? ''}`}
        onClick={onUnpublishOne}
        title="Remove this division from the public schedule"
        aria-label="Unpublish division"
      >
        <EyeOff size={10} />
        <span className={styles.mobileButtonLabel}>Unpublish</span>
      </button>
    );
  }

  const menuItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%',
    padding: '0.55rem 0.85rem', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-data)',
    color: 'var(--fl-text)',
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        className={`btn btn-ghost btn-data ${className ?? ''}`}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Unpublish options"
      >
        <EyeOff size={10} />
        <span className={styles.mobileButtonLabel}>Unpublish</span>
        <ChevronDown size={10} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100,
            background: 'var(--surface)', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.3)',
            borderRadius: '2px', minWidth: '230px', boxShadow: 'var(--shadow)',
          }}
        >
          <button
            role="menuitem"
            style={menuItem}
            onClick={() => { setOpen(false); onUnpublishOne(); }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--blueprint-blue-rgb),0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <EyeOff size={13} style={{ flexShrink: 0, color: 'var(--data-gray)' }} />
            <span style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>This division</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--data-gray)', marginTop: '1px' }}>{currentLabel}</div>
            </span>
          </button>
          <div style={{ height: '1px', background: 'rgba(var(--blueprint-blue-rgb),0.15)', margin: '0 0.75rem' }} />
          <button
            role="menuitem"
            style={menuItem}
            onClick={() => { setOpen(false); onUnpublishAll(); }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--blueprint-blue-rgb),0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <EyeOff size={13} style={{ flexShrink: 0, color: 'var(--data-gray)' }} />
            <span style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>All published ({publishedCount})</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--data-gray)', marginTop: '1px' }}>Remove every division from the public page</div>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function MobileToolsMenu({
  className,
  canAutoGenerate,
  onAutoGenerate,
  canAutoBracket,
  onAutoBracket,
  canRainDelay,
  onRainDelay,
  rainDelayAvailable,
}: {
  className?: string;
  canAutoGenerate: boolean;
  onAutoGenerate: () => void;
  canAutoBracket: boolean;
  onAutoBracket: () => void;
  canRainDelay: boolean;
  onRainDelay: () => void;
  rainDelayAvailable: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const menuItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%',
    padding: '0.55rem 0.85rem', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-data)',
    color: 'var(--fl-text)',
  };
  const sectionLabel: React.CSSProperties = {
    padding: '0.5rem 0.85rem 0.2rem', fontSize: '0.6rem', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--data-gray)',
    fontFamily: 'var(--font-data)',
  };
  const divider = <div style={{ height: '1px', background: 'rgba(var(--blueprint-blue-rgb),0.15)', margin: '0.35rem 0.75rem' }} />;
  const hoverOn = (e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.background = 'rgba(var(--blueprint-blue-rgb),0.08)');
  const hoverOff = (e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.background = 'none');

  function act(fn: () => void | Promise<void>) {
    setOpen(false);
    void fn();
  }

  function row(opts: {
    icon: React.ReactNode;
    label: string;
    sub?: string;
    onClick?: () => void;
    locked?: boolean;
    lockTitle?: string;
    disabled?: boolean;
  }) {
    const { icon, label, sub, onClick, locked, lockTitle, disabled } = opts;
    const dim = disabled && !locked;
    return (
      <button
        role="menuitem"
        style={{ ...menuItem, opacity: dim ? 0.4 : 1, cursor: dim ? 'not-allowed' : 'pointer' }}
        title={locked ? lockTitle : undefined}
        onClick={() => { if (dim) return; onClick?.(); }}
        onMouseEnter={hoverOn}
        onMouseLeave={hoverOff}
      >
        <span style={{ flexShrink: 0, display: 'inline-flex' }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</div>
          {sub && <div style={{ fontSize: '0.65rem', color: 'var(--data-gray)', marginTop: '1px' }}>{sub}</div>}
        </span>
        {locked && <Lock size={11} style={{ flexShrink: 0, color: 'var(--blueprint-blue)' }} />}
      </button>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }} className={className}>
      <button
        type="button"
        className="btn btn-ghost btn-data"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Schedule tools"
        title="Schedule tools"
      >
        {/* Wrench icon only — drops the "Tools" word to save row space on mobile
            (this menu only renders on mobile). Chevron keeps the menu affordance. */}
        <Wrench size={12} />
        <ChevronDown size={10} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100,
            background: 'var(--surface)', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.3)',
            borderRadius: '2px', minWidth: '240px', maxWidth: 'calc(100vw - 1.5rem)',
            boxShadow: 'var(--shadow)',
            paddingBottom: '0.35rem', maxHeight: '70vh', overflowY: 'auto',
          }}
        >
          {/* Publish/Unpublish is a sibling button beside this menu (not inside) —
              see .scheduleMobilePublish in the toolbar. */}

          <div style={sectionLabel}>Generate</div>
          {row({
            icon: <Sparkles size={13} style={{ color: canAutoGenerate ? 'var(--logic-lime)' : 'var(--data-gray)' }} />,
            label: 'Round-Robin Generator',
            sub: 'Auto-build games from your teams',
            locked: !canAutoGenerate,
            lockTitle: 'Included with Tournament Plus and up',
            onClick: () => act(onAutoGenerate),
          })}
          {row({
            icon: <Trophy size={13} style={{ color: canAutoBracket ? 'var(--logic-lime)' : 'var(--data-gray)' }} />,
            label: 'Auto-Generate Bracket',
            sub: 'Build a full bracket from a format',
            locked: !canAutoBracket,
            lockTitle: 'Included with Tournament Plus and up',
            onClick: () => act(onAutoBracket),
          })}

          {rainDelayAvailable && (
            <>
              {divider}
              <div style={sectionLabel}>Adjust</div>
              {row({
                icon: <CloudRain size={13} style={{ color: canRainDelay ? 'var(--logic-lime)' : 'var(--data-gray)' }} />,
                label: 'Rain delay',
                sub: "Move or cancel a day's games at once",
                locked: !canRainDelay,
                lockTitle: 'Included with Tournament Plus and up',
                onClick: () => act(onRainDelay),
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ScheduleToolsMenu({
  disabled,
  canAutoGenerate,
  onAutoGenerate,
  canAutoBracket,
  onAutoBracket,
  canRainDelay,
  onRainDelay,
  rainDelayAvailable,
  className,
}: {
  disabled: boolean;
  canAutoGenerate: boolean;
  onAutoGenerate: () => void;
  canAutoBracket: boolean;
  onAutoBracket: () => void;
  canRainDelay: boolean;
  onRainDelay: () => void;
  rainDelayAvailable: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const menuItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%',
    padding: '0.55rem 0.85rem', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-data)',
    color: 'var(--fl-text)',
  };
  const sectionLabel: React.CSSProperties = {
    padding: '0.5rem 0.85rem 0.2rem', fontSize: '0.6rem', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--data-gray)',
    fontFamily: 'var(--font-data)',
  };
  const divider = <div style={{ height: '1px', background: 'rgba(var(--blueprint-blue-rgb),0.15)', margin: '0.35rem 0.75rem' }} />;

  function row(opts: {
    icon: React.ReactNode; label: string; sub: string;
    onClick: () => void; locked?: boolean; lockTitle?: string;
  }) {
    const { icon, label, sub, onClick, locked, lockTitle } = opts;
    return (
      <button
        role="menuitem"
        style={menuItem}
        title={locked ? lockTitle : undefined}
        onClick={() => { setOpen(false); onClick(); }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--blueprint-blue-rgb),0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{ flexShrink: 0, display: 'inline-flex' }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--data-gray)', marginTop: '1px' }}>{sub}</div>
        </span>
        {locked && <Lock size={11} style={{ flexShrink: 0, color: 'var(--blueprint-blue)' }} />}
      </button>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }} className={className}>
      <button
        type="button"
        className="btn btn-ghost btn-data"
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Schedule tools"
      >
        <Wrench size={12} />
        <span>Tools</span>
        <ChevronDown size={10} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100,
            background: 'var(--surface)', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.3)',
            borderRadius: '2px', minWidth: '270px', boxShadow: 'var(--shadow)', paddingBottom: '0.35rem',
          }}
        >
          <div style={sectionLabel}>Build</div>
          {row({
            icon: <Sparkles size={13} style={{ color: canAutoGenerate ? 'var(--logic-lime)' : 'var(--data-gray)' }} />,
            label: 'Round-Robin Generator',
            sub: 'Auto-build games from your teams',
            locked: !canAutoGenerate,
            lockTitle: 'Included with Tournament Plus and up',
            onClick: onAutoGenerate,
          })}
          {row({
            icon: <Trophy size={13} style={{ color: canAutoBracket ? 'var(--logic-lime)' : 'var(--data-gray)' }} />,
            label: 'Auto-Generate Bracket',
            sub: 'Build a full bracket from a format',
            locked: !canAutoBracket,
            lockTitle: 'Included with Tournament Plus and up',
            onClick: onAutoBracket,
          })}
          {rainDelayAvailable && (
            <>
              {divider}
              <div style={sectionLabel}>Adjust</div>
              {row({
                icon: <CloudRain size={13} style={{ color: canRainDelay ? 'var(--logic-lime)' : 'var(--data-gray)' }} />,
                label: 'Rain delay',
                sub: "Move or cancel a day's games at once",
                locked: !canRainDelay,
                lockTitle: 'Included with Tournament Plus and up',
                onClick: onRainDelay,
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function inferGamePool(game: any, allGames: any[], pools: any[]): string | null {
  // Direct: placeholder contains "Pool X"
  for (const pool of pools) {
    const bare = pool.name.replace(/^Pool\s+/i, '').trim();
    const tag = `Pool ${bare}`;
    if (game.homePlaceholder?.includes(tag) || game.awayPlaceholder?.includes(tag)) {
      return pool.name;
    }
  }
  // Transitive: "Winner SF1" → find that game's pool.
  // Match by bracketId (set per-pool in executeCreate) to avoid code collisions.
  const ph = game.homePlaceholder || game.awayPlaceholder || '';
  const winnerCode = ph.match(/(?:Winner|Loser) ([\w-]+)/)?.[1];
  if (winnerCode) {
    const source = allGames.find((g: any) =>
      g.bracketCode === winnerCode &&
      g.isPlayoff &&
      g.id !== game.id &&
      (game.bracketId ? g.bracketId === game.bracketId : true)
    );
    if (source) return inferGamePool(source, allGames, pools);
  }
  // BracketId sibling fallback: for manually-added rounds with no placeholder,
  // find any sibling game in the same bracketId group that has a direct pool match.
  if (game.bracketId) {
    for (const sibling of allGames) {
      if (sibling.id === game.id || sibling.bracketId !== game.bracketId || !sibling.isPlayoff) continue;
      for (const pool of pools) {
        const bare = pool.name.replace(/^Pool\s+/i, '').trim();
        const tag = `Pool ${bare}`;
        if (sibling.homePlaceholder?.includes(tag) || sibling.awayPlaceholder?.includes(tag)) {
          return pool.name;
        }
      }
    }
  }
  return null;
}

// Detect split mode from game data: any playoff game whose placeholder names a pool
function hasSplitPoolGames(games: any[], pools: any[]): boolean {
  return pools.length >= 2 && games.some(g =>
    pools.some((p: any) => {
      const bare = p.name.replace(/^Pool\s+/i, '').trim();
      const tag = `Pool ${bare}`;
      return g.homePlaceholder?.includes(tag) || g.awayPlaceholder?.includes(tag);
    })
  );
}

function PlayoffBracketView({ games, teams, division, venues, canBuildManualBracket, onBuildBracket, onStartFromStandings, onEdit, onDelete, getGroupName, formatDate, statusBadge }: any) {
  if (games.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '4rem' }}>
        <Trophy size={48} />
        <p>No playoff bracket yet</p>
        <p className="text-sm text-muted" style={{ maxWidth: '34rem', margin: '0 auto' }}>
          A bracket is rounds of games wired together — each game feeds its winner (or loser) into the next.
          Build one here; the rounds and matchups link up automatically.
        </p>
        {canBuildManualBracket && onBuildBracket && (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-lime btn-data" onClick={onBuildBracket}>
              <Trophy size={14} /> Build Bracket
            </button>
            {onStartFromStandings && (
              <button type="button" className="btn btn-outline btn-data" onClick={onStartFromStandings}>
                Start from standings (1 v 8, 2 v 7…)
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const pools = division?.pools || [];
  const isSplitMode = hasSplitPoolGames(games, pools);

  if (isSplitMode) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '3rem',
        padding: '2rem 0.75rem',
      }}>
        {pools.map((pool: any) => {
          const poolGames = games.filter((g: any) => inferGamePool(g, games, pools) === pool.name);
          if (poolGames.length === 0) return null;
          const columns = buildBracketColumns(poolGames);
          return (
            <div key={pool.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <Trophy size={16} style={{ color: 'var(--logic-lime)' }} />
                <h3 style={{ color: 'var(--logic-lime)', fontFamily: 'var(--font-data)', fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                  {formatPoolName(pool.name)} Playoffs
                </h3>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, var(--blueprint-blue), transparent)' }} />
              </div>
              <BracketColumns columns={columns} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} venues={venues} />
            </div>
          );
        })}
        {(() => {
          const unassigned = games.filter((g: any) => inferGamePool(g, games, pools) === null);
          if (unassigned.length === 0) return null;
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <h3 style={{ color: 'var(--white-40)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Other</h3>
              </div>
              <BracketColumns columns={buildBracketColumns(unassigned)} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} venues={venues} />
            </div>
          );
        })()}
      </div>
    );
  }

  // Tiered (or per-bracket) layout: when pools don't drive the split but the games
  // span ≥2 independent brackets (each tier is its own bracket_id, reusing codes),
  // render one diagram per bracket so tiers don't cross-wire into a single tree.
  const bracketGroups = groupGamesByBracketId(games);
  if (bracketGroups.length > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', padding: '2rem 0.75rem 0' }}>
        {bracketGroups.map((grp, i) => (
          <div key={grp.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <Trophy size={16} style={{ color: 'var(--logic-lime)' }} />
              <h3 style={{ color: 'var(--logic-lime)', fontFamily: 'var(--font-data)', fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                {grp.label || `Bracket ${i + 1}`}
              </h3>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, var(--blueprint-blue), transparent)' }} />
            </div>
            <BracketColumns columns={buildBracketColumns(grp.games)} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} venues={venues} />
          </div>
        ))}
      </div>
    );
  }

  // Standard flat layout
  const columns = buildBracketColumns(games);
  return (
    <div style={{ padding: '2rem 0.75rem 0' }}>
      <BracketColumns columns={columns} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} venues={venues} />
    </div>
  );
}
