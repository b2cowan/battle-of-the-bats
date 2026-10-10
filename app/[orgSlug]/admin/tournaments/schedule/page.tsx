'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, ChevronRight, Plus, Pencil, X, SlidersHorizontal, Trophy, MapPin, Globe, RefreshCw, Wrench } from 'lucide-react';
import { findBracketSchedulingViolations, nextManualBracketCode } from '@/lib/playoff-bracket';
import { hasPlayoffs as resolveHasPlayoffs, hasRoundRobin as resolveHasRoundRobin } from '@/lib/tournament-phase';
import { useTournament } from '@/lib/tournament-context';
import { tournamentToday } from '@/lib/timezone';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature, hasOrgVenueLibrary, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { SCHEDULE_REFUSAL, SCHEDULE_REFUSAL_TITLE, readRefusal } from '@/lib/schedule-words';
import { isSandboxRefusal } from '@/lib/coach-sandbox-refusal';
import {
  SCHEDULE_STATUS_ORDER, SCHEDULE_STATUS_LABELS, type ScheduleStatusFilter as ScheduleStatus,
} from '@/lib/tournament-schedule-status';
import ExportMenu from '@/components/admin/ExportMenu';
import ScheduleGenerator from './Generator';
import PlayoffWizard from './PlayoffWizard';
import BracketEditor from './components/BracketEditor';
import GameList from './components/GameList';
import ShiftDayModal from './components/ShiftDayModal';
import ScheduleHealthPanel, { type ScheduleHealthRulesDraft } from './components/ScheduleHealthPanel';
import PlayoffBracketView from './components/PlayoffBracketView';
import ScheduleTimeline from './components/ScheduleTimeline';
import { Game, Venue, PoolSlot, PlayoffConfig } from '@/lib/types';
import { fieldNounFor } from '@/lib/sports';
import { checkVenueConflict, toConflictGame, type ConflictResult } from '@/lib/schedule-conflict';
import { hasKnownPlacement } from '@/lib/venue-identity';
import { formatVenueLocation } from '@/lib/venue-label';
import { fieldPickerValueForGame } from './components/TournamentFieldPicker';
import ZeroVenuePrompt from './components/ZeroVenuePrompt';
import ResolveLocationsModal from './components/ResolveLocationsModal';
import { buildLocationResolvePlan, type LocationResolvePlan } from '@/lib/tournament-location-resolve';
import { buildScheduleMetrics, getScheduleHealthRules } from '@/lib/schedule-metrics';
import s from '../../admin-common.module.css';
import styles from './schedule-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
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
import { useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK } from '@/components/admin/kit/kit-inline';
// The page's own parts (Stage 3 Part 0 split them out; none brings a stylesheet the lines above don't).
import GameFormModal, { emptyForm, type ModalMode } from './components/GameFormModal';
import PublishScheduleModal from './components/PublishScheduleModal';
import ResolveFacilitiesModal from './components/ResolveFacilitiesModal';
import { MobileToolsMenu, ScheduleToolsMenu, UnpublishControl } from './components/ScheduleMenus';
import VenueFilterMenu from './components/VenueFilterMenu';
import { useScheduleData } from './useScheduleData';
import { useScheduleExport } from './useScheduleExport';

// The filter's words and the printed schedule's words are ONE list — see
// lib/tournament-schedule-status.ts for why this is not a canonical map for every surface.
type ScheduleStatusFilter = ScheduleStatus;

const STATUS_FILTERS: Array<{ key: ScheduleStatusFilter; label: string }> =
  SCHEDULE_STATUS_ORDER.map(key => ({ key, label: SCHEDULE_STATUS_LABELS[key] }));

const STATUS_CHIP_CLASS: Record<string, string | undefined> = {
  scheduled: 'chip_scheduled',
  cancelled: 'chip_cancelled',
  completed: 'chip_completed',
};

// Engine defaults for the Schedule Health rules editor (matches lib/schedule-metrics.ts).
const DEFAULT_HEALTH_RULES: ScheduleHealthRulesDraft = { maxGamesPerDay: 2, minRestMinutes: 15, targetGamesPerTeam: null };

export default function AdminSchedulePage() {
  const { currentTournament, isLocked, loading: tournamentLoading, setCurrentTournament } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Schedule');
  // Admin Design Continuity slice 4c — the kit switch. `kx` patches every hand-set inline
  // colour below while the switch is off (no className swap needed at this level).
  const kx = useKitStyle();
  const tournamentId = currentTournament?.id;
  const orgSlug = currentOrg?.slug;
  const {
    games, setGames, gamesLoading, teams, divisions, setDivisions, venues, setVenues, facilityLanes, setFacilityLanes,
    refresh, reloadGames,
  } = useScheduleData({ tournamentId, tournamentLoading, orgSlug });
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
  const [resolveLocationsOpen, setResolveLocationsOpen] = useState(false);
  const [locationBannerDismissed, setLocationBannerDismissed] = useState(false);
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
  // Modal field picker: true = the explicit "Somewhere else (type it)" choice is active.
  const [venueTextMode, setVenueTextMode] = useState(false);
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

  // ── Real-time venue conflict check for the Add/Edit modal ────────────────
  // Pure computation from already-loaded state — no extra fetch required.
  const modalConflict = useMemo((): ConflictResult | null => {
    if (!modal) return null;
    if (!form.date || !form.time) return null;

    // This is the main door free text comes in through, so gating the check on a picked venue was
    // the single biggest hole — an organizer could type the same field name onto two games at one
    // time and the modal would not say a word. `location` is passed as-is; a picked venue already
    // shadows it inside the placement rules, so the precedence lives in one place.
    const proposedGame = toConflictGame({
      id: editing?.id ?? '__new__',
      date: form.date,
      time: form.time,
      status: 'scheduled',
      venueId: form.venueId || null,
      venueFacilityId: form.venueFacilityId || null,
      location: form.location,
      divisionId: form.divisionId || null,
      // The form offers a per-game length (a 3-hour final in a 90-minute division). Without it the
      // check measured the proposed game at the division default and missed the back half of a
      // longer game — a real overlap that saved without a word.
      durationMinutes: form.durationMinutes === '' ? null : form.durationMinutes,
    });
    if (!hasKnownPlacement(proposedGame)) return null;

    return checkVenueConflict({
      proposedGame,
      allGames: games.map(toConflictGame),
      divisions,
      tournament: currentTournament,
    });
  }, [modal, form.date, form.time, form.venueId, form.venueFacilityId, form.location, form.divisionId, form.durationMinutes, editing?.id, games, divisions, currentTournament]);

  // Sport-pack surface noun for every field-picking label (never hard-coded — R "sport-neutral").
  const fieldNoun = fieldNounFor(currentTournament?.sport);
  // Org venue library exists on League/Club plans only — drives the zero-venue prompt's
  // "Import from your Venue Library" lead (owner ruling 2026-08-08).
  const hasOrgLibrary = hasOrgVenueLibrary(currentOrg?.planId);

  const canAutoGenerateSchedule = currentOrg ? hasPlanFeature(currentOrg.planId, 'auto_schedule') : false;
  // Manual playoff bracket building is available on all tournament plans; the playoff generator (its doors, and
  // the optimizer + tiered auto-split inside it) reads its OWN feature, `playoff_generator` — the one the games
  // route gates the generated bracket on. It used to read `auto_schedule` (Stage 3 defects pass, item 7; both sit
  // at Tournament Plus today, so no one's access changed).
  const canAutoBracket = currentOrg ? hasPlanFeature(currentOrg.planId, 'playoff_generator') : false;
  const canBuildPlayoffsManually = currentOrg ? hasPlanFeature(currentOrg.planId, 'playoff_manual') : false;
  const canNotify = currentOrg ? hasPlanFeature(currentOrg.planId, 'schedule_notification') : false;
  // Bulk "shift the day" (Rain delay) is a Tournament Plus automation (2026-07-07 decision).
  const canRainDelay = currentOrg ? hasPlanFeature(currentOrg.planId, 'bulk_reschedule') : false;
  // B2.3: whether moving a published game actually reaches anyone's phone.
  const canAlertFollowers = currentOrg ? hasPlanFeature(currentOrg.planId, 'fan_score_alerts') : false;
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
    if (!resolveHasRoundRobin(currentTournament)) return; // no round robin in bracket-only events
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
    if (!canAutoBracket) {
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

  // The game-day board's "Running late?" door (Tournament admin redesign G8) lands here with
  // `?tool=rain-delay` and opens the rain-delay window on arrival — once per visit (ref-guarded, as
  // Results reads `?gameId=`), after the games load so the window has days to offer. With nothing left
  // to move (or a completed event) it opens nothing; the board hides the door in both cases anyway.
  const searchParams = useSearchParams();
  const toolParam = searchParams.get('tool');
  const toolOpenedRef = useRef(false);
  useEffect(() => {
    // …and after the org is known, so the plan check reads the real plan, not "no org yet".
    if (toolParam !== 'rain-delay' || toolOpenedRef.current || tournamentLoading || gamesLoading || !tournamentId || !currentOrg) return;
    toolOpenedRef.current = true;
    if (hasUpcomingGames && !isLocked) openRainDelay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolParam, tournamentLoading, gamesLoading, tournamentId, currentOrg, hasUpcomingGames, isLocked]);

  // Switching tournaments exits bracket-edit mode (the frozen editor division would
  // otherwise belong to the previous tournament).
  useEffect(() => { setEditingBracket(false); }, [tournamentId]);

  // Same reason: the locations panel holds the previous tournament's names and its own undo
  // history. Leaving it open across a switch would show one tournament's rows while addressing
  // another's id — every action would fail, for no reason the admin could see.
  useEffect(() => { setResolveLocationsOpen(false); }, [tournamentId]);

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

  // The format pins the stage: a bracket-only event has no round-robin stage (stay on Playoffs);
  // an Exhibition has no playoff stage (stay on Round Robin). The Stage toggle renders only when
  // both stages exist — a switch to an empty stage is a promise the event cannot keep.
  const hasRoundRobinStage = resolveHasRoundRobin(currentTournament);
  const hasPlayoffStage = resolveHasPlayoffs(currentTournament);
  const showStageToggle = hasRoundRobinStage && hasPlayoffStage;
  useEffect(() => { if (!hasRoundRobinStage && viewMode === 'pool') setViewMode('playoff'); }, [hasRoundRobinStage, viewMode]);
  useEffect(() => { if (!hasPlayoffStage && viewMode === 'playoff') setViewMode('pool'); }, [hasPlayoffStage, viewMode]);

  const groupTeams   = (id: string) => teams.filter(t => t.divisionId === id);
  const getTeamName  = (id: string) => teams.find(t => t.id === id)?.name ?? null;
  const resolveTeam  = (id: string, placeholder?: string) => getTeamName(id) ?? placeholder ?? 'TBD';
  const getGroupName = (id: string) => divisions.find(g => g.id === id)?.name ?? '—';
  const getVenueName = (venueId?: string, facilityId?: string) => {
    const venue = venueId ? venues.find(d => d.id === venueId) : null;
    if (!venue) return '';
    const facility = facilityId ? venue.facilities?.find(f => f.id === facilityId) : null;
    return formatVenueLocation(venue.name, facility?.name);
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
        const res = await fetch(`/api/admin/divisions${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-visibility', data: { id: divisionId, scheduleVisibility: 'unpublished' } }),
        });
        // F71: a refusal used to be dropped AND the division shown unpublished anyway.
        if (await refusedWrite(res, SCHEDULE_REFUSAL_TITLE.unpublish, SCHEDULE_REFUSAL.divisionFallback)) return;
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
        const replies = await Promise.all(published.map(g =>
          fetch(`/api/admin/divisions${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set-visibility', data: { id: g.id, scheduleVisibility: 'unpublished' } }),
          }).catch(() => null) // a dropped connection: that division is still published, the rest still count
        ));
        // F71: one request per division, so it can partly succeed. Show unpublished only what the server
        // unpublished; name the divisions still published, with the server's reason.
        const went = (r: Response | null) => !!r && (r.ok || isSandboxRefusal(r));
        const done = new Set(published.filter((_, i) => went(replies[i])).map(g => g.id));
        setDivisions(prev => prev.map(g => done.has(g.id) ? { ...g, scheduleVisibility: 'unpublished' } : g));
        const refusedAt = replies.findIndex(r => !went(r));
        if (refusedAt >= 0) {
          const fallback = done.size === 0 ? SCHEDULE_REFUSAL.divisionFallback : SCHEDULE_REFUSAL.partialFallback;
          const refused = replies[refusedAt];
          setFeedback({
            isOpen: true,
            title: SCHEDULE_REFUSAL_TITLE.unpublishAll,
            message: refused ? await readRefusal(refused, fallback) : fallback,
            items: published.filter(g => !done.has(g.id)).map(g => ({ label: g.name })),
            type: 'warning',
          });
        }
      },
    });
  }

  function openAdd() {
    const divisionId = (filterGroup !== 'all' ? filterGroup : '') || (divisions[0]?.id ?? '');
    setForm({ ...emptyForm, divisionId });
    setVenueTextMode(false);
    setEditing(null);
    setModal('add');
    fetchModalSlots(divisionId);
  }

  function openEdit(g: Game) {
    const picker = fieldPickerValueForGame(g);
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
      location: picker.location,
      venueId: picker.venueId,
      venueFacilityId: picker.venueFacilityId,
      notes: g.notes ?? '',
    });
    setVenueTextMode(picker.textMode);
    setEditing(g);
    setModal('edit');
    fetchModalSlots(g.divisionId);
  }

  // All schedule writes go through the service-role games API. Direct browser-client
  // writes 403 — the `authenticated` role has no INSERT/UPDATE/DELETE grant on `games`.
  /**
   * F71 (Stage 3 defects pass): a single write the server refused says why, through the page's message window — the
   * route's own reason, or our words when it has none (lib/schedule-words.ts). The sandbox's by-design refusal is not
   * a refusal here (its chrome speaks). True when the write was refused, so the caller stops.
   */
  async function refusedWrite(res: Response, title: string, fallback?: string): Promise<boolean> {
    if (res.ok || isSandboxRefusal(res)) return false;
    setFeedback({ isOpen: true, title, message: await readRefusal(res, fallback), type: 'warning' });
    return true;
  }

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
      // Venue decision, stated in full: a picked venue (its display string is derived
      // server-side), or typed text via the explicit "somewhere else" mode, or nothing.
      // Typed text is only sent while text mode is active, so stale words never ride
      // along with a picked venue or a cleared one.
      location:          venueTextMode ? form.location : '',
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
          // Explicit nulls, never absent keys: the API treats a PRESENT venueId as the
          // venue decision (null = clear), so clearing genuinely clears — the old
          // `|| undefined` coalescing made the key vanish and the stored venue survive.
          venueId: data.venueId ?? null,
          venueFacilityId: data.venueFacilityId ?? null,
          location: data.location || null,
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

  // F71: Cancel Game and Reinstate used to drop a refusal (a final result, a completed event) without a word.
  async function patchGameStatus(id: string, action: 'cancel' | 'revert-to-scheduled') {
    const orgParam = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    const res = await fetch(`/api/admin/games${orgParam}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    });
    await refusedWrite(res, action === 'cancel' ? SCHEDULE_REFUSAL_TITLE.cancelGame : SCHEDULE_REFUSAL_TITLE.reinstateGame);
    refresh();
  }
  const markCancelled = (id: string) => patchGameStatus(id, 'cancel');
  const markScheduled = (id: string) => patchGameStatus(id, 'revert-to-scheduled');

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
        title: nextLocked ? SCHEDULE_REFUSAL_TITLE.keepGame : SCHEDULE_REFUSAL_TITLE.releaseGame,
        message: data.error || 'The schedule could not be updated. Confirm the latest schedule migration has been applied, then try again.',
        type: 'warning',
      });
      return;
    }
    refresh();
  }

  async function handleSaveGame(gameId: string, data: { date: string; time: string; venueId: string; venueFacilityId: string; location?: string; notes: string; homeTeamId: string; awayTeamId: string; homePlaceholder?: string; awayPlaceholder?: string }) {
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
    const typedLocation = !data.venueId && !data.venueFacilityId ? (data.location?.trim() || null) : null;
    const saveRes = await fetch(`/api/admin/games${orgParam}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:           'update',
        id:               gameId,
        date:             data.date             || undefined,
        time:             data.time             || undefined,
        // Explicit nulls, never absent keys: a PRESENT venueId is the venue decision
        // (null = clear), and the display string is DERIVED server-side from the picked
        // venue — the client no longer authors it. Typed text rides along only when
        // nothing is picked (the explicit "somewhere else" path).
        venueId:          data.venueId          || null,
        venueFacilityId:  data.venueFacilityId  || null,
        location:         typedLocation,
        notes:            data.notes            || undefined,
        homeTeamId:       data.homeTeamId,
        awayTeamId:       data.awayTeamId,
        // Playoff matchup wiring from the inline editor (mutually exclusive with team).
        homePlaceholder:  isPlayoffGame ? (data.homePlaceholder ?? undefined) : undefined,
        awayPlaceholder:  isPlayoffGame ? (data.awayPlaceholder ?? undefined) : undefined,
      }),
    });

    // ── "See it live" sandbox: keep the move, skip the refresh ────────────────────────────────
    // The write was refused BY DESIGN (lib/demo-guard.ts), and the banner said so before the
    // visitor touched anything — so this is not an error path. Two things happen here, and the
    // second is the one that matters:
    //
    //   • the change is applied to the in-memory list, so a hands-on edit stays on screen;
    //   • we do NOT refresh, because refreshing pulls the server's untouched copy back and snaps
    //     the card home — the "looks broken" failure the whole drag beat exists to avoid.
    //
    // The schedule-health engine recomputes in the browser against this same list, so a
    // moved-but-unsaved game scores correctly with no new maths. The "nothing is saved" toast is
    // raised by the shared sandbox chrome, which watches every fetch for this same marker.
    if (saveRes.headers.get('X-Sandbox-Blocked') === '1') {
      // Mirror the server's derived display string on the in-memory copy (the real write
      // was sandbox-refused by design, so the label has to be computed here).
      const sandboxVenue    = data.venueId ? venues.find(d => d.id === data.venueId) : null;
      const sandboxFacility = data.venueFacilityId ? sandboxVenue?.facilities?.find(f => f.id === data.venueFacilityId) : null;
      setGames(prev => prev.map((g): Game => {
        if (g.id !== gameId) return g;
        const moved: Game = {
          ...g,
          date:            data.date || g.date,
          time:            data.time,
          venueId:         data.venueId || undefined,
          venueFacilityId: data.venueFacilityId || undefined,
          location:        sandboxVenue ? formatVenueLocation(sandboxVenue.name, sandboxFacility?.name) : (typedLocation ?? ''),
          notes:           data.notes || undefined,
          homeTeamId:      data.homeTeamId,
          awayTeamId:      data.awayTeamId,
        };
        if (isPlayoffGame) {
          moved.homePlaceholder = data.homePlaceholder ?? g.homePlaceholder;
          moved.awayPlaceholder = data.awayPlaceholder ?? g.awayPlaceholder;
        }
        return moved;
      }));
      return;
    }

    // F71 — a refused save (a final result, a completed event, a venue the event doesn't have, a role that can't
    // move games) used to fall through to the refresh below and snap back without a word. Say why, and throw so
    // the inline row stays open and a drag or the phone's move sheet rolls back to where the server has the game —
    // the same contract as 'bracket-order' above.
    if (await refusedWrite(saveRes, SCHEDULE_REFUSAL_TITLE.saveGame)) {
      // The refusal can be BECAUSE the game changed (scored a moment ago): re-read the games, so the list shows the
      // truth rather than the pre-drag copy the move puts back — quietly, so the open inline row stays open.
      void reloadGames();
      throw new Error('refused');
    }

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
    // The create-venue modal serves SIX doors (game modal, timeline, both zero-venue
    // prompts, every inline row). Auto-select the new venue only where the game modal is
    // actually open — blindly writing it into the modal's form from an inline-row door
    // would stage a venue nobody picked for the NEXT modal open. Inline rows get the new
    // venue in their (refreshed) picker list and choose it themselves.
    if (modal) {
      setForm(f => ({ ...f, venueId: saved.id, venueFacilityId: '', location: '' }));
      setVenueTextMode(false);
    }
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
  // Phase 3 — hand-typed field names awaiting review. Tournament-wide (not division-scoped), so
  // resolving a name never leaves a puzzling remainder behind the division filter.
  //
  // Derived here rather than fetched: the review model is a pure function of games + venues, both
  // of which this page already loads on every refresh, so asking the server for it would re-read
  // the same two tables on every schedule action for a panel most tournaments never open.
  const locationPlan: LocationResolvePlan | null = useMemo(() => {
    if (games.length === 0) return null;
    return buildLocationResolvePlan(games, {
      venues: venues.map(venue => ({ id: venue.id, name: venue.name })),
      facilities: venues.flatMap(venue =>
        (venue.facilities ?? []).map(facility => ({ id: facility.id, venueId: venue.id, name: facility.name })),
      ),
    });
  }, [games, venues]);

  // Phase 3 — "leave as typed text" is a legitimate answer, but nothing in the database can
  // remember it (Phases 1-3 are migration-free by design), so an organizer who deliberately
  // keeps their typed names would be nagged forever. Dismissal is keyed to the EXACT set of
  // names, so a newly typed one raises the banner again rather than hiding behind the old
  // decision. Browser-scoped and deliberately so — this is a nudge, not a record.
  const locationTokenSignature = useMemo(
    () => (locationPlan?.typedGroups ?? []).map(group => group.token).sort().join('|'),
    [locationPlan],
  );
  const locationDismissKey = tournamentId ? `flhq.locresolve.dismissed.${tournamentId}` : null;
  useEffect(() => {
    if (!locationDismissKey || !locationTokenSignature) {
      setLocationBannerDismissed(false);
      return;
    }
    try {
      setLocationBannerDismissed(window.localStorage.getItem(locationDismissKey) === locationTokenSignature);
    } catch {
      setLocationBannerDismissed(false);
    }
  }, [locationDismissKey, locationTokenSignature]);
  const dismissLocationBanner = useCallback(() => {
    setLocationBannerDismissed(true);
    if (!locationDismissKey) return;
    try { window.localStorage.setItem(locationDismissKey, locationTokenSignature); } catch { /* private mode */ }
  }, [locationDismissKey, locationTokenSignature]);

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
      // Playoffs only: lets a "Seed #N" bracket slot resolve against LIVE round-robin standings
      // when the organizer never typed a seed number in Teams admin (the common case). Needs the
      // tournament's full, unfiltered game list — divisionGames above is already view-scoped.
      standingsGames: viewMode === 'playoff' ? games : undefined,
      // Draft rules drive the live preview as the organizer adjusts them.
      maxGamesPerDay: healthRules.maxGamesPerDay,
      minRestMinutes: healthRules.minRestMinutes,
      expectedGamesPerParticipant: healthRules.targetGamesPerTeam ?? undefined,
    });
  }, [currentTournament, viewMode, filterGroup, divisionGames, games, teams, divisions, venues, healthRules]);

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

  const { handleExportXLSX, handleExportCSV, handleExportPDF, handleExportBracketPDF } = useScheduleExport({
    currentOrg, currentTournament, orgSlug, layout, filtered, divisionGames, activeDivision, teams,
    getGroupName, resolveTeam, getGameVenueDisplay,
  });

  // Row-invariant kit patches — the two plain-window titles below share one recipe (the global
  // kit's `.modal-header h3` is written at zero weight so a page's own skin wins; these inline
  // titles need the same patch restated here to reach the kit's display face + text-primary).
  const modalTitleStyle = kx(
    { fontFamily: 'var(--font-data)', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--logic-lime)', margin: 0 } as React.CSSProperties,
    { fontFamily: 'var(--font-display)', fontSize: 'var(--type-heading)', fontWeight: 700, textTransform: 'none', letterSpacing: 'normal', color: 'var(--text-primary)', margin: 0 },
  );

  return (
    <div className={s.page}>
      {/* Same-tab flips (The Flip) can now navigate away from unsaved Schedule Health rule edits that
          the old new-tab "View Site" behavior accidentally protected — warn before leaving them. */}
      <UnsavedChangesGuard
        active={healthRulesDirty}
        message="You have unsaved changes to the Schedule Health rules. Leave without saving them?"
      />
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
        kitTitle={(
          <>
            <span className={styles.desktopTitle}>Schedule management</span>
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
              onExportSecondaryPDF={layout === 'bracket' ? () => handleExportBracketPDF(true) : undefined}
              secondaryPdfLabel="Blank bracket PDF"
              secondaryPdfHint="Empty bracket to print and fill in by hand"
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
          {showStageToggle && !editingBracket && (
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
          {/* Stage: Round Robin | Playoffs — only when the format has both */}
          {showStageToggle && !editingBracket && (
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
            <span className="text-label" style={kx({ color: 'var(--logic-lime)', alignSelf: 'center', padding: '0 0.5rem' }, KIT_INK.accent)}>Editing bracket</span>
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
            showAutoGenerate={hasRoundRobinStage}
            canAutoGenerate={canAutoGenerateSchedule}
            onAutoGenerate={openGenerator}
            showAutoBracket={hasPlayoffStage}
            canAutoBracket={canAutoBracket}
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
            showAutoGenerate={hasRoundRobinStage}
            canAutoGenerate={canAutoGenerateSchedule}
            onAutoGenerate={openGenerator}
            showAutoBracket={hasPlayoffStage}
            canAutoBracket={canAutoBracket}
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
          body={!hasRoundRobinStage
            ? 'This is a bracket-only tournament. Open the Playoff Bracket Builder to seed your teams and generate the bracket.'
            : !hasPlayoffStage
            ? (canAutoGenerateSchedule
              ? 'Add your games by hand — a day of scrimmages is a handful of rows — or use the Round-Robin Generator to build them from your teams.'
              : 'Add your games by hand — a day of scrimmages is a handful of rows. The Round-Robin Generator can build them from your teams with Tournament Plus.')
            : canAutoGenerateSchedule
            ? 'Build your schedule by adding games manually, or use the Round-Robin Generator to auto-build games from your teams. For playoffs, use the Playoff Bracket Builder.'
            : 'Build your schedule by adding games manually, or use the Playoff Bracket Builder to seed a bracket. The Round-Robin Generator is available with Tournament Plus or higher.'}
        />
      )}

      {savedScheduleMetrics && (
        <ScheduleHealthPanel
          metrics={savedScheduleMetrics}
          subtitle={`${activeDivision?.name ?? 'Division'} · ${viewMode === 'playoff' ? 'Saved playoffs' : hasPlayoffStage ? 'Saved round robin' : 'Saved games'}`}
          defaultOpen={false}
          showTeamTable
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
          // The sandbox's own undo. Nothing was ever persisted, so "put it back" is simply a
          // re-read of the server's untouched copy — which also means a visitor can never wedge
          // the demo for themselves. The panel renders this only inside a demo org.
          onSandboxReset={() => { void refresh(); }}
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

      {/* Phase 3 — field names typed by hand, tournament-wide. Same shape as the banner above
          on purpose: both are a small pile of work with a button on it. */}
      {/* Hidden while a reload is in flight: during a tournament switch the id has already changed
          while games still describe the previous one, and a dismissal taken in that window would
          file the old tournament's names under the new tournament's key. */}
      {locationPlan && locationPlan.typedGroups.length > 0 && !locationBannerDismissed && !gamesLoading && (
        <div className={styles.facilityResolveBanner}>
          <div className={styles.facilityResolveCopy}>
            <MapPin size={14} />
            <div>
              <strong>
                {locationPlan.typedGroups.length} {locationPlan.typedGroups.length === 1 ? 'location' : 'locations'} typed by hand
              </strong>
              <span>
                {locationPlan.typedGameCount} {locationPlan.typedGameCount === 1 ? 'game names' : 'games name'} a{' '}
                {fieldNoun.toLowerCase()} as text, so {locationPlan.typedGameCount === 1 ? "it isn't" : "they aren't"} checked
                against your real {fieldNoun.toLowerCase()}s.
              </span>
            </div>
          </div>
          <div className={styles.locationResolveActions}>
            <button
              type="button"
              className="btn btn-outline btn-data"
              onClick={() => setResolveLocationsOpen(true)}
              disabled={isLocked}
            >
              <MapPin size={13} /> Review
            </button>
            <button
              type="button"
              className={styles.locationResolveDismiss}
              onClick={dismissLocationBanner}
              aria-label="Hide this notice"
              title="Hide this notice until a new location is typed"
            >
              <X size={13} />
            </button>
          </div>
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
          canAutoGenerate={canAutoBracket}
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
          zeroVenuePrompt={
            <ZeroVenuePrompt
              orgSlug={orgSlug ?? ''}
              hasOrgLibrary={hasOrgLibrary}
              onCreateVenue={() => setAddVenueOpen(true)}
            />
          }
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
                <div key={div.id}>
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
              conflictsOnly={conflictsOnly}
              tournament={currentTournament}
            />
          )}
        </div>
      )}

      {resolveFacilitiesOpen && (
        <ResolveFacilitiesModal
          setResolveFacilitiesOpen={setResolveFacilitiesOpen} modalTitleStyle={modalTitleStyle}
          unresolvedFacilityLanes={unresolvedFacilityLanes} unresolvedLaneGameCounts={unresolvedLaneGameCounts}
          facilityLaneSelections={facilityLaneSelections} setFacilityLaneSelections={setFacilityLaneSelections}
          venues={venues} resolveFacilitiesError={resolveFacilitiesError} resolvingFacilities={resolvingFacilities}
          resolveTemporaryFacilities={resolveTemporaryFacilities}
        />
      )}

      {resolveLocationsOpen && locationPlan && (
        <ResolveLocationsModal
          plan={locationPlan}
          venues={venues}
          noun={fieldNoun}
          orgSlug={orgSlug ?? ''}
          tournamentId={tournamentId ?? ''}
          onClose={() => setResolveLocationsOpen(false)}
          onGamesChanged={refresh}
          onCreateVenue={() => { setResolveLocationsOpen(false); setVenueModalOpen(true); }}
        />
      )}

      {(modal === 'add' || modal === 'edit') && (
        <GameFormModal
          modal={modal} setModal={setModal} editing={editing} form={form} setForm={setForm}
          handleSubmit={handleSubmit} fetchModalSlots={fetchModalSlots} divisions={divisions} teams={teams} games={games}
          modalSlots={modalSlots} modalSlotsLoading={modalSlotsLoading} viewMode={viewMode} orgSlug={orgSlug}
          venues={venues} venueTextMode={venueTextMode} setVenueTextMode={setVenueTextMode} hasOrgLibrary={hasOrgLibrary}
          setAddVenueOpen={setAddVenueOpen} fieldNoun={fieldNoun} modalConflict={modalConflict}
          canAlertFollowers={canAlertFollowers} groupTeams={groupTeams} modalTitleStyle={modalTitleStyle} kx={kx}
        />
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
          onStale={() => { void reloadGames(); }}
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
          canAutoSchedule={canAutoBracket}
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
          planId={currentOrg?.planId ?? null}
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
    </div>
  );
}

