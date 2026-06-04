'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Calendar, ChevronRight, ChevronDown, Plus, Pencil, Trash2, X, Check, Sparkles, SlidersHorizontal, Trophy, MapPin, Clock, Send, Globe, EyeOff, RefreshCw, AlertTriangle, AlertCircle, Lock, Wrench } from 'lucide-react';
import { formatPoolName } from '@/lib/utils';
import { saveGame, updateGame, deleteGame } from '@/lib/db';
import { formatTime } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, downloadICS,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import ScheduleGenerator from './Generator';
import PlayoffWizard from './PlayoffWizard';
import GameList from './components/GameList';
import ScheduleHealthPanel from './components/ScheduleHealthPanel';
import BracketConnectors from './components/BracketConnectors';
import { Game, Team, Division, Venue, PoolSlot, ScheduleFacilityLane } from '@/lib/types';
import { checkVenueConflict, type ConflictResult } from '@/lib/schedule-conflict';
import { buildScheduleMetrics } from '@/lib/schedule-metrics';
import s from '../../admin-common.module.css';
import styles from './schedule-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import AddVenueModal from '@/components/admin/AddVenueModal';
import {
  TournamentAdminHeader,
  TournamentAdminToolbar,
  ToolbarGroup,
  ToolbarSelect,
  ToolbarSearch,
  ToolbarSegmentedControl,
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
  date: '', time: '09:00', location: '', venueId: '', venueFacilityId: '', notes: null as string | null,
  bracketCode: '',
};

export default function AdminSchedulePage() {
  const { currentTournament, isLocked, loading: tournamentLoading } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Schedule');
  const tournamentId = currentTournament?.id;
  const orgSlug = currentOrg?.slug;
  const [games, setGames]       = useState<Game[]>([]);
  const [teams, setTeams]       = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [facilityLanes, setFacilityLanes] = useState<ScheduleFacilityLane[]>([]);
  const [modalSlots, setModalSlots] = useState<PoolSlot[]>([]);
  const [modalSlotsLoading, setModalSlotsLoading] = useState(false);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Game | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [filterGroup, setFilterGroup] = useState('');
  const [viewMode, setViewMode] = useState<'pool' | 'playoff'>('pool');
  const [groupMode, setGroupMode] = useState<'flat' | 'pools'>('pools');
  const [layoutMode, setLayoutMode] = useState<'list' | 'bracket'>('list');
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [resolveFacilitiesOpen, setResolveFacilitiesOpen] = useState(false);
  const [facilityLaneSelections, setFacilityLaneSelections] = useState<Record<string, string>>({});
  const [resolvingFacilities, setResolvingFacilities] = useState(false);
  const [resolveFacilitiesError, setResolveFacilitiesError] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showPlayoffWizard, setShowPlayoffWizard] = useState(false);
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
  const canGeneratePlayoffs = currentOrg ? hasPlanFeature(currentOrg.planId, 'playoff_generator') : false;
  const canNotify = currentOrg ? hasPlanFeature(currentOrg.planId, 'schedule_notification') : false;

  function showScheduleUpgrade(title: string, feature: 'auto_schedule' | 'playoff_generator') {
    setFeedback({
      isOpen: true,
      title,
      message: requiresTournamentPlusCopy(feature),
      type: 'warning',
    });
  }

  function openGenerator() {
    if (!canAutoGenerateSchedule) {
      showScheduleUpgrade('Round-Robin Generator Requires Tournament Plus', 'auto_schedule');
      return;
    }
    setShowGenerator(true);
  }

  function openPlayoffWizard() {
    if (!canGeneratePlayoffs) {
      showScheduleUpgrade('Playoff Bracket Builder Requires Tournament Plus', 'playoff_generator');
      return;
    }
    if (!filterGroup) {
      setFeedback({
        isOpen: true,
        title: 'Choose a Division First',
        message: 'Select a division before opening the Playoff Bracket Builder.',
        type: 'info',
      });
      return;
    }
    setShowPlayoffWizard(true);
  }

  const refresh = useCallback(async () => {
    if (tournamentLoading) return;
    if (!tournamentId) {
      setGames([]);
      setTeams([]);
      setDivisions([]);
      setVenues([]);
      setFacilityLanes([]);
      return;
    }
    const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';

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
    setFilterGroup(prev => {
      if (prev && groups.some((g: any) => g.id === prev)) return prev;
      try {
        const cachedGroup = (JSON.parse(localStorage.getItem(`flhq-schedule-${tournamentId}`) ?? '{}') as any).filterGroup as string | undefined;
        if (cachedGroup && groups.some((g: any) => g.id === cachedGroup)) return cachedGroup;
      } catch {}
      return groups.length > 0 ? groups[0].id : '';
    });
    setVenues(venues);
    setFacilityLanes(lanes);
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

  // Restore filter state from localStorage when tournament changes.
  useEffect(() => {
    if (!tournamentId) return;
    try {
      const raw = localStorage.getItem(`flhq-schedule-${tournamentId}`);
      if (!raw) return;
      const cached = JSON.parse(raw) as Partial<{
        viewMode: 'pool' | 'playoff';
        groupMode: 'flat' | 'pools';
        layoutMode: 'list' | 'bracket';
        selectedStatuses: ScheduleStatusFilter[];
        selectedVenueKeys: string[];
      }>;
      if (cached.viewMode === 'pool' || cached.viewMode === 'playoff') setViewMode(cached.viewMode);
      if (cached.groupMode === 'flat' || cached.groupMode === 'pools') setGroupMode(cached.groupMode);
      if (cached.layoutMode === 'list' || cached.layoutMode === 'bracket') setLayoutMode(cached.layoutMode);
      if (Array.isArray(cached.selectedStatuses) && cached.selectedStatuses.length > 0) setSelectedStatuses(cached.selectedStatuses);
      if (Array.isArray(cached.selectedVenueKeys)) setSelectedVenueKeys(cached.selectedVenueKeys);
    } catch {}
  }, [tournamentId]);

  // Persist filter state. Guard: only write once divisions are loaded.
  useEffect(() => {
    if (!tournamentId || !filterGroup || divisions.length === 0) return;
    try {
      localStorage.setItem(`flhq-schedule-${tournamentId}`, JSON.stringify({
        filterGroup, viewMode, groupMode, layoutMode, selectedStatuses, selectedVenueKeys,
      }));
    } catch {}
  }, [tournamentId, filterGroup, viewMode, groupMode, layoutMode, selectedStatuses, selectedVenueKeys, divisions.length]);

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
    if (g.venueId) return `venue:${g.venueId}`;
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

  function handlePublishDone(updates: { id: string; scheduleVisibility: 'published_generic' | 'published_teams' }[]) {
    setDivisions(prev => prev.map(g => {
      const u = updates.find(u => u.id === g.id);
      return u ? { ...g, scheduleVisibility: u.scheduleVisibility } : g;
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
      message: 'The schedule for this division will be removed from the public page.',
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
      message: 'These divisions will be removed from the public schedule page. You can republish them at any time.',
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
    const divisionId = filterGroup || (divisions[0]?.id ?? '');
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
      date: g.date ?? '',
      time: g.time ?? '09:00',
      location: g.location ?? '',
      venueId: g.venueId ?? '',
      venueFacilityId: g.venueFacilityId ?? '',
      notes: g.notes ?? '',
      bracketCode: g.bracketCode ?? '',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Hard block: do not allow saving when a true overlap exists.
    if (modalConflict?.kind === 'overlap') return;
    const slotMode = modalSlots.length > 0;
    const homeSlot = slotMode ? modalSlots.find(s => s.id === form.homeSlotId) : null;
    const awaySlot = slotMode ? modalSlots.find(s => s.id === form.awaySlotId) : null;
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
      location:          form.location,
      venueId:           form.venueId           || undefined,
      venueFacilityId:   form.venueFacilityId   || undefined,
      notes:             form.notes             || undefined,
      status:          editing?.status || 'scheduled',
      bracketCode:     form.bracketCode || undefined,
    };
    if (modal === 'add') await saveGame(data);
    else if (editing) await updateGame(editing.id, data);
    setModal(null);
    refresh();
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

  async function handleSaveGame(gameId: string, data: { date: string; time: string; venueId: string; venueFacilityId: string; notes: string; homeTeamId: string; awayTeamId: string }) {
    const orgParam = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
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
      }),
    });
    await refresh();
  }

  function handleDeleteRequest(id: string) {
    setFeedback({
      isOpen: true,
      title: 'Remove Game?',
      message: 'This will permanently remove the game from the schedule.',
      type: 'danger',
      onConfirm: async () => {
        await deleteGame(id);
        refresh();
      }
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

  // Division + view slice (no search, no status) — used for status chip counts
  const divisionGames = scheduled.filter(g =>
    g.divisionId === filterGroup &&
    (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)
  );
  const unresolvedLaneGameCounts = divisionGames.reduce((map, game) => {
    if (game.scheduleFacilityLaneId && !game.venueId && !game.venueFacilityId) {
      map.set(game.scheduleFacilityLaneId, (map.get(game.scheduleFacilityLaneId) ?? 0) + 1);
    }
    return map;
  }, new Map<string, number>());
  const unresolvedFacilityLanes = facilityLanes
    .filter(lane => lane.divisionId === filterGroup && !lane.resolvedVenueId && unresolvedLaneGameCounts.has(lane.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  const statusCounts: Record<string, number> = {
    scheduled: divisionGames.filter(g => g.status === 'scheduled').length,
    cancelled: divisionGames.filter(g => g.status === 'cancelled').length,
    completed: divisionGames.filter(g => g.status === 'completed').length,
  };
  const savedScheduleMetrics = useMemo(() => {
    if (!currentTournament || !filterGroup || divisionGames.length === 0) return null;
    return buildScheduleMetrics({
      games: divisionGames,
      teams,
      divisions,
      venues,
      tournament: currentTournament,
      divisionId: filterGroup,
      includePlayoffs: viewMode === 'playoff',
    });
  }, [currentTournament, viewMode, filterGroup, divisionGames, teams, divisions, venues]);
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
    viewMode === 'pool' ? (groupMode === 'pools' ? 'Pools' : 'Flat') : (layoutMode === 'list' ? 'List' : 'Bracket'),
    venueFilterOptions.length > 1 ? venueLabel : null,
  ].filter(Boolean).join(' · ');

  const filtered  = scheduled.filter(g => {
    const matchesDivision = g.divisionId === filterGroup;
    const matchesView = viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff;
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(g.status as ScheduleStatusFilter);
    const matchesVenue = selectedVenueKeys.length === 0 || selectedVenueKeys.includes(getGameVenueKey(g));
    const q = search.toLowerCase();
    const matchesSearch = q === '' ||
      resolveTeam(g.homeTeamId, g.homePlaceholder).toLowerCase().includes(q) ||
      resolveTeam(g.awayTeamId, g.awayPlaceholder).toLowerCase().includes(q);
    return matchesDivision && matchesView && matchesStatus && matchesVenue && matchesSearch;
  });

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

  async function handleExportICS() {
    const events = filtered
      .filter(g => g.date)
      .map(g => ({
        gameId:   g.id,
        title:    `${resolveTeam(g.homeTeamId, g.homePlaceholder)} vs ${resolveTeam(g.awayTeamId, g.awayPlaceholder)} — ${getGroupName(g.divisionId)}`,
        date:     g.date,
        time:     g.time || undefined,
        location: (() => {
          const display = getGameVenueDisplay(g);
          return display.sublabel ? `${display.name} - ${display.sublabel}` : display.name;
        })(),
        cancelled: g.status === 'cancelled',
      }));
    await downloadICS(
      buildFilename({ org: currentOrg?.slug, dataset: 'schedule', scope: String(currentTournament?.year ?? '') }, 'ics'),
      events,
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
  const publishedDivisionCount = divisions.filter(g => g.scheduleVisibility && g.scheduleVisibility !== 'unpublished').length;
  const activeDivisionPublished = (activeDivision?.scheduleVisibility ?? 'unpublished') !== 'unpublished';

  return (
    <div className={s.page}>
      <TournamentAdminHeader
        icon={<Calendar size={20} />}
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
        mobileActionsInline
        locked={isLocked}
        actions={(
          <>
            {(() => {
              // Per-division publish status — read-only orientation, lives in the
              // header (not the toolbar) so it doesn't compete with the view/action
              // controls. "Published · …" (not "Live") to avoid colliding with the
              // sidebar's tournament-level LIVE dot.
              const ag = divisions.find(g => g.id === filterGroup);
              // No single division selected (e.g. "All Divisions") → no single
              // publish state to report, so show nothing.
              if (!ag) return null;
              const vis = ag.scheduleVisibility ?? 'unpublished';
              if (vis === 'unpublished') {
                return (
                  <span className={`${styles.publishStatus} ${styles.publishStatusDraft}`}>
                    <EyeOff size={10} />
                    Not Published
                  </span>
                );
              }
              return (
                <span className={styles.publishStatus}>
                  <Globe size={10} />
                  {vis === 'published_teams' ? 'Published · Teams' : 'Published · Placeholder'}
                </span>
              );
            })()}
            <ExportMenu
              className={styles.scheduleExportButton}
              formats={['xlsx', 'csv', 'ics', 'pdf']}
              onExportXLSX={handleExportXLSX}
              onExportCSV={handleExportCSV}
              onExportICS={handleExportICS}
              onExportPDF={handleExportPDF}
              planId={currentOrg?.planId}
              disabled={filtered.length === 0}
            />
            {!isLocked && (
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
          </>
        )}
      />

      <TournamentAdminToolbar ariaLabel="Schedule controls" className={styles.scheduleToolbar}>
        {/* ── Row 1 left: Division + view mode controls (grow) ── */}
        <ToolbarGroup grow className={`${styles.scheduleDivisionGroup} ${styles.scheduleStartGroup}`}>
          {divisions.length > 0 && (
            <ToolbarSelect<string>
              className={styles.scheduleDivisionSelect}
              label="Division"
              value={filterGroup}
              options={divisions.map(g => ({ value: g.id, label: g.name }))}
              onChange={value => {
                setFilterGroup(value);
              }}
            />
          )}
          {/* Mobile: prominent stage toggle pulled out of the settings sheet
              (desktop keeps the segmented control below) */}
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
          {/* Desktop: segmented controls; Mobile: compact selects */}
          <ToolbarSegmentedControl<'pool' | 'playoff'>
            className={styles.desktopModeControl}
            value={viewMode}
            options={[
              { value: 'pool', label: 'Round Robin' },
              { value: 'playoff', label: 'Playoffs' },
            ]}
            onChange={value => { setViewMode(value); }}
            ariaLabel="View mode"
          />
          {viewMode === 'pool' && (
            <>
              <ToolbarSegmentedControl<'flat' | 'pools'>
                className={styles.desktopModeControl}
                value={groupMode}
                options={[
                  { value: 'flat', label: 'Flat' },
                  { value: 'pools', label: 'Pools' },
                ]}
                onChange={setGroupMode}
                ariaLabel="Grouping mode"
              />
            </>
          )}
          {viewMode === 'playoff' && (
            <>
              <ToolbarSegmentedControl<'list' | 'bracket'>
                className={styles.desktopModeControl}
                value={layoutMode}
                options={[
                  { value: 'list', label: 'List' },
                  { value: 'bracket', label: 'Bracket' },
                ]}
                onChange={setLayoutMode}
                ariaLabel="Layout mode"
              />
            </>
          )}
        </ToolbarGroup>

        {/* ── Row 1 right: utility actions — Publish · Tools ── */}
        <ToolbarGroup align="end" className={`${styles.scheduleActionsGroup} ${styles.scheduleEndGroup}`}>
          {/* Publish control — only for round-robin view */}
          {viewMode === 'pool' && (() => {
            const ag = divisions.find(g => g.id === filterGroup);
            const vis = ag?.scheduleVisibility ?? 'unpublished';
            const isPublished = vis !== 'unpublished';
            return (
              <>
                {/* Status display moved to the page header (left of Add Game).
                    The toolbar keeps only the Publish/Unpublish action. The
                    Unpublish control splits into a menu (this division / all
                    published) when 2+ divisions are live. */}
                {!isLocked && isPublished && (
                  <UnpublishControl
                    className={styles.mobileIconButton}
                    publishedCount={divisions.filter(g => g.scheduleVisibility && g.scheduleVisibility !== 'unpublished').length}
                    currentLabel={ag?.name ?? 'this division'}
                    onUnpublishOne={() => handleUnpublish(filterGroup)}
                    onUnpublishAll={handleUnpublishAll}
                  />
                )}
                {!isLocked && !isPublished && (
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
              </>
            );
          })()}
          <ScheduleToolsMenu
            className={styles.scheduleToolsMenu}
            disabled={!currentTournament}
            canAutoGenerate={canAutoGenerateSchedule}
            canPlayoffWizard={canGeneratePlayoffs}
            onAutoGenerate={openGenerator}
            onPlayoffWizard={openPlayoffWizard}
          />
        </ToolbarGroup>

        {/* ── Row 2: search + venue + status filters ── */}
        <ToolbarGroup fullWidth className={styles.scheduleFilterGroup}>
          <ToolbarSearch className={styles.scheduleSearch} value={search} onChange={setSearch} placeholder="Search teams..." label="Search games" />
          {/* Mobile-only: publish/generate tools stay in one menu so
              the division selector can take the full first row. Hidden on desktop,
              where those controls remain separate (Row 1 right). */}
          <MobileToolsMenu
            className={styles.scheduleMobileTools}
            showPublishSection={!isLocked && viewMode === 'pool'}
            isPublished={activeDivisionPublished}
            publishedCount={publishedDivisionCount}
            currentDivisionLabel={activeDivision?.name ?? 'this division'}
            canPublish={!!currentTournament}
            onPublish={() => setPublishModal({ divisionId: filterGroup })}
            onUnpublishOne={() => handleUnpublish(filterGroup)}
            onUnpublishAll={handleUnpublishAll}
            canAutoGenerate={canAutoGenerateSchedule}
            canPlayoffWizard={canGeneratePlayoffs}
            onAutoGenerate={openGenerator}
            onPlayoffWizard={openPlayoffWizard}
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
              return (
                <button
                  key={key}
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
                  <span className={s.chipCount}>{statusCounts[key] ?? 0}</span>
                </button>
              );
            })}
          </div>
          {hasConflicts && (
            <button
              type="button"
              className={`${s.filterChip} ${styles.conflictFilterChip}`}
              data-active={conflictsOnly || undefined}
              onClick={() => setConflictsOnly(v => !v)}
              title="Show only games with a venue conflict"
            >
              <AlertTriangle size={11} />
              CONFLICTS
              <span className={s.chipCount}>{conflictCount}</span>
            </button>
          )}
        </ToolbarGroup>
      </TournamentAdminToolbar>

      {/* ── Mobile settings bottom sheet (Schedule) ────────── */}
      {mobileSettingsOpen && (
        <>
          <div className={styles.sheetBackdrop} onClick={() => setMobileSettingsOpen(false)} aria-hidden />
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="View settings">
            <div className={styles.sheetHandle} />
            <div className={styles.sheetBody}>
              <div className={styles.sheetSection}>
                <div className={styles.sheetSectionLabel}>Stage</div>
                <div className={styles.sheetSegments}>
                  {(['pool', 'playoff'] as const).map(v => (
                    <button key={v} type="button"
                      className={`${styles.sheetSeg} ${viewMode === v ? styles.sheetSegActive : ''}`}
                      onClick={() => setViewMode(v)}
                    >
                      {v === 'pool' ? 'Round Robin' : 'Playoffs'}
                    </button>
                  ))}
                </div>
              </div>
              {viewMode === 'pool' && (
                <div className={styles.sheetSection}>
                  <div className={styles.sheetSectionLabel}>Grouping</div>
                  <div className={styles.sheetSegments}>
                    {(['flat', 'pools'] as const).map(v => (
                      <button key={v} type="button"
                        className={`${styles.sheetSeg} ${groupMode === v ? styles.sheetSegActive : ''}`}
                        onClick={() => setGroupMode(v)}
                      >
                        {v === 'flat' ? 'Flat' : 'Pools'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {viewMode === 'playoff' && (
                <div className={styles.sheetSection}>
                  <div className={styles.sheetSectionLabel}>Layout</div>
                  <div className={styles.sheetSegments}>
                    {(['list', 'bracket'] as const).map(v => (
                      <button key={v} type="button"
                        className={`${styles.sheetSeg} ${layoutMode === v ? styles.sheetSegActive : ''}`}
                        onClick={() => setLayoutMode(v)}
                      >
                        {v === 'list' ? 'List' : 'Bracket'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
      {currentTournament && !mobileSettingsOpen && (
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


      {currentTournament && games.length === 0 && (
        <HelpCallout
          variant="info"
          title="No games scheduled yet"
          body={canAutoGenerateSchedule
            ? 'Build your schedule by adding games manually, or use the Round-Robin Generator to auto-build games from your teams. For playoffs, use the Playoff Bracket Builder.'
            : 'Build your schedule by adding games manually. The Round-Robin Generator and Playoff Bracket Builder are available with Tournament Plus or higher.'}
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

      {tournamentLoading ? (
        <div className="empty-state">
          <RefreshCw size={32} className="spin" style={{ opacity: 0.4 }} />
          <p>Loading tournament...</p>
        </div>
      ) : viewMode === 'playoff' && layoutMode === 'bracket' ? (
        <PlayoffBracketView
          games={filtered}
          teams={teams}
          division={activeDivision}
          canGeneratePlayoffs={canGeneratePlayoffs}
          onEdit={isLocked ? undefined : openEdit}
          onDelete={isLocked ? undefined : handleDeleteRequest}
          getGroupName={getGroupName}
          formatDate={formatDate}
          statusBadge={statusBadge}
        />
      ) : (
        <div className={s.compactList}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Calendar size={40} style={{ opacity: 0.2 }} />
              <p>{currentTournament ? 'No games found for this division.' : 'No tournament selected.'}</p>
            </div>
          ) : (
            <GameList
              games={filtered}
              teams={teams}
              divisions={divisions}
              venues={venues}
              viewMode={viewMode}
              groupByPool={groupMode === 'pools'}
              pools={activeDivision?.pools}
              onDelete={isLocked ? undefined : handleDeleteRequest}
              onCancel={isLocked ? undefined : markCancelled}
              onSchedule={isLocked ? undefined : markScheduled}
              onToggleGeneratorLock={isLocked ? undefined : toggleGeneratorLock}
              onSave={isLocked ? undefined : handleSaveGame}
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
                    onChange={e => { setForm(f => ({ ...f, divisionId: e.target.value, homeTeamId: '', awayTeamId: '', homeSlotId: '', awaySlotId: '' })); fetchModalSlots(e.target.value); }} required>
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
              {(() => {
                if (modalSlotsLoading) {
                  return <div style={{ marginBottom: '1rem', padding: '0.7rem 0.875rem', fontSize: '0.85rem', color: 'var(--white-40)' }}>Loading slots…</div>;
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
                  <button
                    type="button"
                    className="btn btn-outline btn-data"
                    style={{ height: '26px', fontSize: '0.75rem', padding: '0 0.6rem', gap: '0.25rem' }}
                    onClick={() => setAddVenueOpen(true)}
                  >
                    <Plus size={12} /> Add venue
                  </button>
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
                {form.venueId && (
                  <div style={{ marginTop: '0.35rem', fontSize: '0.73rem', color: 'var(--white-40)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Check size={11} style={{ color: 'var(--logic-lime)' }} />
                    {form.venueFacilityId ? 'Linked to saved facility' : 'Linked to saved venue'}
                  </div>
                )}
              </div>
              {viewMode === 'playoff' && (
                <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Abbreviation</label>
                    <input
                      className="form-input"
                      placeholder="e.g. SF1, FIN"
                      value={form.bracketCode}
                      maxLength={3}
                      onChange={e => setForm(f => ({ ...f, bracketCode: e.target.value.toUpperCase() }))}
                      style={{ fontFamily: 'var(--font-data)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes (optional)</label>
                    <input className="form-input" placeholder="Any additional info" value={form.notes || ''}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
              )}
              {viewMode !== 'playoff' && (
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label className="form-label">Notes (optional)</label>
                  <input className="form-input" placeholder="Any additional info" value={form.notes || ''}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              )}

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

      {showPlayoffWizard && filterGroup !== '' && canGeneratePlayoffs && (
        <PlayoffWizard
          division={activeDivision!}
          tournamentId={currentTournament?.id || ''}
          tournament={currentTournament}
          orgSlug={orgSlug ?? ''}
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
  onPublished: (updates: { id: string; scheduleVisibility: 'published_generic' | 'published_teams' }[]) => void;
  onDivisionClosed: (id: string) => void;
}) {
  const publishable = divisions.filter(g => !g.scheduleVisibility || g.scheduleVisibility === 'unpublished');

  const [selectedIds, setSelectedIds] = React.useState<string[]>([defaultDivisionId]);
  const [nameMode, setNameMode] = React.useState<'generic' | 'teams'>('generic');
  const [notify, setNotify] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ notified: number } | null>(null);
  const [showRegCloseWarning, setShowRegCloseWarning] = React.useState(false);

  const targets = publishable.filter(g => selectedIds.includes(g.id));
  const allUnpublishedSelected = publishable.length > 0 && publishable.every(d => selectedIds.includes(d.id));
  const openTargets = targets.filter(g => !g.isClosed);
  const willCloseOnPublish = nameMode === 'teams' && openTargets.length > 0;

  function toggleDivision(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function doPublish() {
    setLoading(true);
    setError(null);
    try {
      const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const divisionIds = targets.map(g => g.id);
      const visibility = nameMode === 'teams' ? 'published_teams' : 'published_generic';

      // Close any still-open divisions before publishing with real names
      if (nameMode === 'teams' && openTargets.length > 0) {
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
        body: JSON.stringify({ tournamentId: tournament.id, divisionIds, visibility, notify }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to publish');
      const data = await res.json();
      setResult({ notified: data.notified ?? 0 });
      onPublished(divisionIds.map(id => ({ id, scheduleVisibility: visibility })));
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
                  ? `Registration for ${openTargets[0].name} is still open. Publishing with real team names will close it — stopping new submissions from the public page.`
                  : `Registration is still open for ${openTargets.length} divisions. Publishing with real team names will close them — stopping new submissions from the public page.`}
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

              <p style={{ color: 'var(--white-70)', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.55 }}>
                {targets.length === 0
                  ? 'Select at least one division to publish.'
                  : targets.length === 1
                    ? 'This division\'s schedule will appear on your public tournament page. Saved edits are visible automatically after publishing.'
                    : `${targets.length} division${targets.length !== 1 ? 's' : ''} will appear on your public tournament page. Saved edits are visible automatically after publishing.`}
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--white-50)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
                  Team Names
                </p>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                  padding: '0.75rem', borderRadius: '2px', cursor: 'pointer',
                  background: nameMode === 'generic' ? 'rgba(var(--blueprint-blue-rgb),0.08)' : 'transparent',
                  border: nameMode === 'generic' ? '1px solid rgba(var(--blueprint-blue-rgb),0.3)' : '1px solid transparent',
                  marginBottom: '0.4rem',
                }}>
                  <input type="radio" checked={nameMode === 'generic'} onChange={() => setNameMode('generic')} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.2rem' }}>Placeholder names</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--white-50)', lineHeight: 1.45 }}>
                      Teams appear as "Team 1", "Team 2", etc. Registration stays open.
                    </div>
                  </div>
                </label>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                  padding: '0.75rem', borderRadius: '2px', cursor: 'pointer',
                  background: nameMode === 'teams' ? 'rgba(var(--logic-lime-rgb),0.06)' : 'transparent',
                  border: nameMode === 'teams' ? '1px solid rgba(var(--logic-lime-rgb),0.25)' : '1px solid transparent',
                }}>
                  <input type="radio" checked={nameMode === 'teams'} onChange={() => setNameMode('teams')} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.2rem' }}>Real team names</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--white-50)', lineHeight: 1.45 }}>
                      {willCloseOnPublish
                        ? 'Registration will be closed when you publish.'
                        : 'Registered team names will be visible on the public schedule.'}
                    </div>
                  </div>
                </label>
              </div>

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
  showPublishSection,
  isPublished,
  publishedCount,
  currentDivisionLabel,
  canPublish,
  onPublish,
  onUnpublishOne,
  onUnpublishAll,
  canAutoGenerate,
  canPlayoffWizard,
  onAutoGenerate,
  onPlayoffWizard,
}: {
  className?: string;
  showPublishSection: boolean;
  isPublished: boolean;
  publishedCount: number;
  currentDivisionLabel: string;
  canPublish: boolean;
  onPublish: () => void;
  onUnpublishOne: () => void;
  onUnpublishAll: () => void;
  canAutoGenerate: boolean;
  canPlayoffWizard: boolean;
  onAutoGenerate: () => void;
  onPlayoffWizard: () => void;
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
            borderRadius: '2px', minWidth: '240px', maxWidth: 'calc(100vw - 1.5rem)',
            boxShadow: 'var(--shadow)',
            paddingBottom: '0.35rem', maxHeight: '70vh', overflowY: 'auto',
          }}
        >
          {showPublishSection && (
            <>
              <div style={sectionLabel}>Publish</div>
              {!isPublished
                ? row({
                    icon: <Globe size={13} style={{ color: canPublish ? 'var(--logic-lime)' : 'var(--data-gray)' }} />,
                    label: 'Publish schedule',
                    sub: 'Make this division public',
                    disabled: !canPublish,
                    onClick: () => act(onPublish),
                  })
                : (
                  <>
                    {row({
                      icon: <EyeOff size={13} style={{ color: 'var(--data-gray)' }} />,
                      label: 'Unpublish this division',
                      sub: currentDivisionLabel,
                      onClick: () => act(onUnpublishOne),
                    })}
                    {publishedCount >= 2 && row({
                      icon: <EyeOff size={13} style={{ color: 'var(--data-gray)' }} />,
                      label: `Unpublish all (${publishedCount})`,
                      sub: 'Remove every division from the public page',
                      onClick: () => act(onUnpublishAll),
                    })}
                  </>
                )}
              {divider}
            </>
          )}

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
            icon: <Trophy size={13} style={{ color: canPlayoffWizard ? 'var(--logic-lime)' : 'var(--data-gray)' }} />,
            label: 'Playoff Bracket Builder',
            sub: 'Auto-build brackets from pool results',
            locked: !canPlayoffWizard,
            lockTitle: 'Included with Tournament Plus and up',
            onClick: () => act(onPlayoffWizard),
          })}
        </div>
      )}
    </div>
  );
}

function ScheduleToolsMenu({
  disabled,
  canAutoGenerate,
  canPlayoffWizard,
  onAutoGenerate,
  onPlayoffWizard,
  className,
}: {
  disabled: boolean;
  canAutoGenerate: boolean;
  canPlayoffWizard: boolean;
  onAutoGenerate: () => void;
  onPlayoffWizard: () => void;
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
        <Sparkles size={12} />
        <span>Auto</span>
        <ChevronDown size={10} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100,
            background: 'var(--surface)', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.3)',
            borderRadius: '2px', minWidth: '210px', boxShadow: 'var(--shadow)',
          }}
        >
          <button
            role="menuitem"
            style={menuItem}
            onClick={() => { setOpen(false); onAutoGenerate(); }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--blueprint-blue-rgb),0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Sparkles size={13} style={{ flexShrink: 0, color: canAutoGenerate ? 'var(--logic-lime)' : 'var(--data-gray)' }} />
            <span style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>Round-Robin Generator</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--data-gray)', marginTop: '1px' }}>Auto-build games from your teams</div>
            </span>
            {!canAutoGenerate && <Lock size={11} style={{ flexShrink: 0, color: 'var(--blueprint-blue)' }} />}
          </button>
          <div style={{ height: '1px', background: 'rgba(var(--blueprint-blue-rgb),0.15)', margin: '0 0.75rem' }} />
          <button
            role="menuitem"
            style={menuItem}
            onClick={() => { setOpen(false); onPlayoffWizard(); }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--blueprint-blue-rgb),0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Trophy size={13} style={{ flexShrink: 0, color: canPlayoffWizard ? 'var(--logic-lime)' : 'var(--data-gray)' }} />
            <span style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>Playoff Bracket Builder</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--data-gray)', marginTop: '1px' }}>Auto-build brackets from pool results</div>
            </span>
            {!canPlayoffWizard && <Lock size={11} style={{ flexShrink: 0, color: 'var(--blueprint-blue)' }} />}
          </button>
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
  const winnerCode = ph.match(/Winner (\w+)/)?.[1];
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

function buildBracketColumns(games: any[]) {
  const standardRounds = [
    { title: 'Quarterfinals', pattern: /^QF/i },
    { title: 'Semifinals', pattern: /^SF/i },
    { title: 'Finals', pattern: /^(FIN|IF|3RD)$/i }
  ];

  const columns = standardRounds.map(r => ({
    ...r,
    games: games
      .filter((g: any) => r.pattern.test(g.bracketCode || ''))
      .sort((a: any, b: any) => {
        if (/^FIN/i.test(a.bracketCode) && /^3RD/i.test(b.bracketCode)) return -1;
        if (/^3RD/i.test(a.bracketCode) && /^FIN/i.test(b.bracketCode)) return 1;
        return (a.bracketCode || '').localeCompare(b.bracketCode || '');
      })
  })).filter(c => c.games.length > 0);

  // Group non-standard codes into individual columns, one per unique round
  // (identified by shared bracketCode prefix). Maintains wizard round order
  // and shows the bracketCode as the column title.
  const matchedIds = new Set(columns.flatMap(c => c.games.map((g: any) => g.id)));
  const custom = games.filter((g: any) => !matchedIds.has(g.id));
  if (custom.length > 0) {
    const byCode: Record<string, any[]> = {};
    custom.forEach((g: any) => {
      const key = g.bracketCode || 'EXTRA';
      if (!byCode[key]) byCode[key] = [];
      byCode[key].push(g);
    });
    Object.entries(byCode).forEach(([code, cGames]) => {
      columns.push({
        title: code,
        pattern: new RegExp(`^${code}$`, 'i'),
        games: cGames
      });
    });
  }
  return columns;
}

function BracketColumns({ columns, onEdit, onDelete, formatDate }: any) {
  const [titles, setTitles] = React.useState<Record<number, string>>(() =>
    Object.fromEntries(columns.map((c: any, i: number) => [i, c.title]))
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const connectorMatchups = columns.flatMap((c: any) => c.games).map((g: any) => ({
    id: g.id,
    code: g.bracketCode || '',
    home: { label: g.homePlaceholder || '' },
    away: { label: g.awayPlaceholder || '' },
  }));
  const finalCol = columns.find((c: any) => c.title === 'Finals') ?? columns[columns.length - 1];
  const finalGameIds = new Set<string>((finalCol?.games ?? []).map((g: any) => g.id));

  return (
    <div ref={canvasRef} className={styles.readBracketCanvas}>
      <BracketConnectors canvasRef={canvasRef} matchups={connectorMatchups} finalIds={finalGameIds} />
      {columns.map((col: any, idx: number) => (
        <div key={idx} className={styles.readBracketColumn}>
          <input
            value={titles[idx] ?? col.title}
            onChange={e => setTitles(prev => ({ ...prev, [idx]: e.target.value }))}
            style={{
              textAlign: 'center',
              color: 'var(--logic-lime)',
              fontFamily: 'var(--font-data)',
              fontSize: '0.8rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: '1.5rem',
              opacity: 0.7,
              background: 'transparent',
              border: 'none',
              borderBottom: '1px dashed transparent',
              outline: 'none',
              width: '100%',
              cursor: 'text',
              padding: '2px 4px',
            }}
            onFocus={e => { e.target.style.borderBottomColor = 'rgba(var(--blueprint-blue-rgb),0.4)'; e.target.style.opacity = '1'; }}
            onBlur={e => { e.target.style.borderBottomColor = 'transparent'; e.target.style.opacity = '0.7'; }}
          />

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: col.title === 'Finals' ? 'center' : 'space-around',
            flex: 1,
            gap: col.title === 'Finals' ? '2.5rem' : '1.5rem'
          }}>
            {col.games.map((g: any) => {
              const isFinalGame = finalGameIds.has(g.id);
              return (
              <div key={g.id} style={{ position: 'relative' }}>
                <div className="card" data-matchup-id={g.id} style={{
                  padding: '0.75rem',
                  border: isFinalGame
                    ? '1px solid rgba(var(--logic-lime-rgb), 0.55)'
                    : '1px solid rgba(var(--blueprint-blue-rgb), 0.2)',
                  background: 'var(--surface)',
                  position: 'relative', zIndex: 1,
                  boxShadow: isFinalGame
                    ? '0 0 0 1px rgba(var(--logic-lime-rgb), 0.28), 0 6px 20px rgba(var(--logic-lime-rgb), 0.14)'
                    : 'var(--shadow-sm)',
                  borderRadius: '2px'
                }}>
                  <div className="flex-between" style={{ marginBottom: '7px' }}>
                    <div style={{
                      fontSize: '0.6rem', fontWeight: 900, color: 'var(--logic-lime)',
                      background: 'rgba(var(--blueprint-blue-rgb), 0.1)', padding: '2px 8px',
                      borderRadius: '2px', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.2)', letterSpacing: '0.02em'
                    }}>{g.bracketCode}</div>
                    <div className="flex gap-1.5">
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(g)} title="Edit" style={{
                        height: '24px', width: '24px', padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--white-03)'
                      }}><Pencil size={11} /></button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => onDelete(g.id)} title="Delete" style={{
                        height: '24px', width: '24px', padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--white-03)'
                      }}><Trash2 size={11} /></button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', fontSize: '0.55rem', fontWeight: 900, color: 'var(--data-gray)',
                        textAlign: 'center', background: 'rgba(var(--blueprint-blue-rgb), 0.1)', padding: '1px 0',
                        borderRadius: '2px', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.2)', letterSpacing: '0.02em'
                      }}>VIS</div>
                      <div style={{
                        fontWeight: '700', fontSize: '0.85rem', color: 'var(--white)',
                        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {g.awayPlaceholder || 'TBD'}
                      </div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--white-03)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', fontSize: '0.55rem', fontWeight: 900, color: 'var(--data-gray)',
                        textAlign: 'center', background: 'rgba(var(--blueprint-blue-rgb), 0.1)', padding: '1px 0',
                        borderRadius: '2px', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.2)', letterSpacing: '0.02em'
                      }}>HOM</div>
                      <div style={{
                        fontWeight: '700', fontSize: '0.85rem', color: 'var(--white)',
                        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {g.homePlaceholder || 'TBD'}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.4rem',
                    paddingTop: '0.6rem', borderTop: '1px solid var(--white-5)',
                    fontSize: '0.7rem', color: 'var(--white-40)'
                  }}>
                    <div className="flex items-center" style={{ gap: '5px' }}><Calendar size={10} className="text-primary-light opacity-50" /> {g.date ? formatDate(g.date) : 'TBD'}</div>
                    <div className="flex items-center" style={{ gap: '5px', justifyContent: 'flex-end' }}><Clock size={10} className="text-primary-light opacity-50" /> {g.time ? formatTime(g.time) : 'TBD'}</div>
                    <div className="flex items-center" style={{ gap: '5px', gridColumn: 'span 2' }}><MapPin size={10} className="text-primary-light opacity-50" /> {g.location || 'TBD'}</div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayoffBracketView({ games, teams, division, canGeneratePlayoffs, onEdit, onDelete, getGroupName, formatDate, statusBadge }: any) {
  if (games.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '4rem' }}>
        <Trophy size={48} />
        <p>No playoff games scheduled for this division.</p>
        <p className="text-sm text-muted">
          {canGeneratePlayoffs ? 'Use the Playoff Bracket Builder to generate brackets.' : 'Add playoff games manually, or upgrade to Tournament Plus to use the Playoff Bracket Builder.'}
        </p>
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
              <BracketColumns columns={columns} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} />
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
              <BracketColumns columns={buildBracketColumns(unassigned)} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} />
            </div>
          );
        })()}
      </div>
    );
  }

  // Standard flat layout
  const columns = buildBracketColumns(games);
  return (
    <div style={{ padding: '2rem 0.75rem 0' }}>
      <BracketColumns columns={columns} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} />
    </div>
  );
}
