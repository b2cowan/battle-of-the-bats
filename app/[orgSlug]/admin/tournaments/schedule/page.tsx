'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Pencil, Trash2, X, Check, Sparkles, Trophy, MapPin, Clock, Send, Globe, EyeOff, RefreshCw } from 'lucide-react';
import { formatPoolName } from '@/lib/utils';
import { saveGame, updateGame, deleteGame } from '@/lib/db';
import { formatTime } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
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
import { Game, Team, Division, Venue, PoolSlot } from '@/lib/types';
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
  ToolbarMenu,
  ToolbarMenuItem,
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
  const { currentTournament, loading: tournamentLoading } = useTournament();
  const { currentOrg } = useOrg();
  const tournamentId = currentTournament?.id;
  const orgSlug = currentOrg?.slug;
  const [games, setGames]       = useState<Game[]>([]);
  const [teams, setTeams]       = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [modalSlots, setModalSlots] = useState<PoolSlot[]>([]);
  const [modalSlotsLoading, setModalSlotsLoading] = useState(false);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Game | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [filterGroup, setFilterGroup] = useState('');
  const [viewMode, setViewMode] = useState<'pool' | 'playoff'>('pool');
  const [groupMode, setGroupMode] = useState<'flat' | 'pools'>('pools');
  const [layoutMode, setLayoutMode] = useState<'list' | 'bracket'>('list');
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
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'primary' });

  const [publishModal, setPublishModal] = useState<{
    mode: 'single' | 'all';
    divisionId?: string;
  } | null>(null);

  // PDF settings — fetched once on mount; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);
  const canUsePDF = currentOrg ? hasPlanFeature(currentOrg.planId, 'pdf_exports') : false;
  const showPdfNudge = canUsePDF && pdfSettings !== null && Object.keys(pdfSettings).length === 0;

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
      showScheduleUpgrade('Auto-Generate Requires Tournament Plus', 'auto_schedule');
      return;
    }
    setShowGenerator(true);
  }

  function openPlayoffWizard() {
    if (!canGeneratePlayoffs) {
      showScheduleUpgrade('Playoff Wizard Requires Tournament Plus', 'playoff_generator');
      return;
    }
    if (!filterGroup) {
      setFeedback({
        isOpen: true,
        title: 'Choose a Division First',
        message: 'Select a division before opening the Playoff Wizard.',
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
      return;
    }
    const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';

    const [gamesRes, teamsRes, groupsRes, venuesRes] = await Promise.all([
      fetch(`/api/admin/games?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
      fetch(`/api/admin/teams?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
      fetch(`/api/admin/divisions?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
      fetch(`/api/admin/venues?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
    ]);

    const games = gamesRes.ok ? await gamesRes.json() : [];
    const allTeams = teamsRes.ok ? await teamsRes.json() : [];
    const groups = groupsRes.ok ? await groupsRes.json() : [];
    const venues = venuesRes.ok ? await venuesRes.json() : [];

    setGames(games);
    setTeams(allTeams.filter((t: any) => t.status === 'accepted'));
    setDivisions(groups);
    setFilterGroup(prev => prev || (groups.length > 0 ? groups[0].id : ''));
    setVenues(venues);
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
  const getGameVenueKey = (g: Game) => g.venueId ? `venue:${g.venueId}` : `custom:${(g.location || '').trim() || '__none__'}`;
  const getGameVenueLabel = (g: Game) => {
    if (g.venueId) return getVenueName(g.venueId, g.venueFacilityId) || g.location || 'Unknown venue';
    return g.location?.trim() || 'No venue';
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

  const scheduled = games;

  // Division + view slice (no search, no status) — used for status chip counts
  const divisionGames = scheduled.filter(g =>
    g.divisionId === filterGroup &&
    (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)
  );
  const statusCounts: Record<string, number> = {
    scheduled: divisionGames.filter(g => g.status === 'scheduled').length,
    cancelled: divisionGames.filter(g => g.status === 'cancelled').length,
    completed: divisionGames.filter(g => g.status === 'completed').length,
  };
  const venueFilterOptions = Array.from(
    divisionGames.reduce((map, g) => {
      const key = getGameVenueKey(g);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { key, label: getGameVenueLabel(g), count: 1 });
      }
      return map;
    }, new Map<string, { key: string; label: string; count: number }>()),
  ).map(([, option]) => option).sort((a, b) => a.label.localeCompare(b.label));

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
      location: g.venueId ? getVenueName(g.venueId, g.venueFacilityId) : (g.location ?? ''),
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
        location: g.venueId ? getVenueName(g.venueId, g.venueFacilityId) : (g.location || undefined),
        cancelled: g.status === 'cancelled',
      }));
    await downloadICS(
      buildFilename({ org: currentOrg?.slug, dataset: 'schedule', scope: String(currentTournament?.year ?? '') }, 'ics'),
      events,
    );
  }

  async function handleExportPDF() {
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

  function statusBadge(status: string) {
    if (status === 'completed') return <span className="badge badge-success">Final</span>;
    if (status === 'cancelled') return <span className="badge badge-danger">Cancelled</span>;
    return <span className="badge badge-warning">Scheduled</span>;
  }

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
        actions={
          <button
            className={`btn btn-lime btn-data ${styles.addGameButton}`}
            onClick={openAdd}
            disabled={!currentTournament}
            aria-label="Add game"
            title="Add game"
          >
            <Plus size={14} /> <span className={styles.addGameLabel}>Add Game</span>
          </button>
        }
      />

      <TournamentAdminToolbar ariaLabel="Schedule controls" className={styles.scheduleToolbar}>
        {/* ── Row 1: context controls (left/grow) ── */}
        <ToolbarGroup grow className={styles.scheduleDivisionGroup}>
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
        </ToolbarGroup>

        <ToolbarGroup className={styles.scheduleModeGroup}>
          <ToolbarSegmentedControl<'pool' | 'playoff'>
            className={styles.desktopModeControl}
            value={viewMode}
            options={[
              { value: 'pool', label: 'Round Robin' },
              { value: 'playoff', label: 'Playoffs' },
            ]}
            onChange={value => {
              setViewMode(value);
            }}
            ariaLabel="View mode"
          />
          <ToolbarSelect<'pool' | 'playoff'>
            className={styles.mobileModeSelect}
            label="View"
            value={viewMode}
            options={[
              { value: 'pool', label: 'Round Robin' },
              { value: 'playoff', label: 'Playoffs' },
            ]}
            onChange={value => {
              setViewMode(value);
            }}
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
              <ToolbarSelect<'flat' | 'pools'>
                className={styles.mobileModeSelect}
                label="Group"
                value={groupMode}
                options={[
                  { value: 'flat', label: 'Flat' },
                  { value: 'pools', label: 'Pools' },
                ]}
                onChange={setGroupMode}
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
              <ToolbarSelect<'list' | 'bracket'>
                className={styles.mobileModeSelect}
                label="Layout"
                value={layoutMode}
                options={[
                  { value: 'list', label: 'List' },
                  { value: 'bracket', label: 'Bracket' },
                ]}
                onChange={setLayoutMode}
              />
            </>
          )}
        </ToolbarGroup>

        {/* ── Row 1: utility actions (right/end) — Publish · Export · Tools ── */}
        <ToolbarGroup align="end" className={styles.scheduleActionsGroup}>
          {/* Publish control — only for round-robin view */}
          {viewMode === 'pool' && (() => {
            const ag = divisions.find(g => g.id === filterGroup);
            const vis = ag?.scheduleVisibility ?? 'unpublished';
            const isPublished = vis !== 'unpublished';
            const canPublish = Boolean(currentTournament) && !isPublished;
            return (
              <>
                {isPublished && (
                  <span className={styles.publishStatus}>
                    <Globe size={10} />
                    {vis === 'published_teams' ? 'Live · Teams' : 'Live · Generic'}
                  </span>
                )}
                <button
                  className={`btn btn-lime btn-data ${styles.publishButton} ${styles.mobileIconButton}`}
                  onClick={() => setPublishModal({ mode: 'single', divisionId: filterGroup })}
                  disabled={!canPublish}
                  aria-label={isPublished ? 'Schedule already published' : 'Publish schedule'}
                  title={isPublished ? 'Schedule is already published. Saved edits are visible publicly.' : 'Publish schedule'}
                >
                  <Globe size={10} />
                  <span className={styles.mobileButtonLabel}>{isPublished ? 'Published' : 'Publish'}</span>
                </button>
              </>
            );
          })()}
          <ExportMenu
            formats={['xlsx', 'csv', 'ics', 'pdf']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            onExportICS={handleExportICS}
            onExportPDF={handleExportPDF}
            planId={currentOrg?.planId}
            disabled={filtered.length === 0}
          />
          <ToolbarMenu label="Tools">
            {viewMode === 'pool' ? (
              <ToolbarMenuItem
                icon={<Sparkles size={14} />}
                label="Auto-Generate"
                hint="Create a round-robin schedule from pools"
                locked={!canAutoGenerateSchedule}
                lockTitle="Automated schedule generation is included with Tournament Plus, League, and Club."
                disabled={!currentTournament}
                onSelect={openGenerator}
              />
            ) : (
              <ToolbarMenuItem
                icon={<Trophy size={14} />}
                label="Playoff Wizard"
                hint="Generate a playoff bracket"
                locked={!canGeneratePlayoffs}
                lockTitle="The playoff bracket generator is included with Tournament Plus, League, and Club."
                disabled={!currentTournament}
                onSelect={openPlayoffWizard}
              />
            )}
            {viewMode === 'pool' && (() => {
              const publishable = divisions.filter(g => !g.scheduleVisibility || g.scheduleVisibility === 'unpublished');
              if (publishable.length === 0) return null;
              return (
                <ToolbarMenuItem
                  icon={<Globe size={14} />}
                  label="Publish All Divisions"
                  hint={`${publishable.length} division${publishable.length !== 1 ? 's' : ''} ready to publish`}
                  disabled={!currentTournament}
                  onSelect={() => setPublishModal({ mode: 'all' })}
                />
              );
            })()}
            {viewMode === 'pool' && (() => {
              const ag = divisions.find(g => g.id === filterGroup);
              const isPublished = (ag?.scheduleVisibility ?? 'unpublished') !== 'unpublished';
              if (!isPublished) return null;
              return (
                <ToolbarMenuItem
                  icon={<EyeOff size={14} />}
                  label="Unpublish Division"
                  hint="Remove this division from the public schedule"
                  onSelect={() => handleUnpublish(filterGroup)}
                />
              );
            })()}
          </ToolbarMenu>
        </ToolbarGroup>

        {/* ── Row 2: status filter chips + search ── */}
        <ToolbarGroup fullWidth className={styles.scheduleFilterGroup}>
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Search teams..." label="Search games" />
          <div className={styles.scheduleRefinementRow}>
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
          </div>
          <VenueFilterMenu
            options={venueFilterOptions}
            selectedKeys={selectedVenueKeys}
            onToggle={key => setSelectedVenueKeys(prev => prev.includes(key) ? prev.filter(value => value !== key) : [...prev, key])}
            onClear={() => setSelectedVenueKeys([])}
          />
        </ToolbarGroup>
      </TournamentAdminToolbar>

      {showPdfNudge && (
        <HelpCallout
          variant="info"
          title="PDF settings not configured"
          body="Your PDF export will use default styling. Set up your header, logo, and footer once and all future PDFs will use those settings."
          cta={{ label: 'Configure PDF Settings', href: `/${currentOrg?.slug}/admin/org/settings/pdf` }}
          dismissible
          localStorageKey="flhq-pdf-nudge-schedule"
        />
      )}

      {currentTournament && games.length === 0 && (
        <HelpCallout
          variant="info"
          title="No games scheduled yet"
          body={canAutoGenerateSchedule
            ? 'Build your schedule by adding games manually, or use Auto-Generate to create a round-robin schedule from your divisions and teams. For playoffs, use the Playoff Wizard.'
            : 'Build your schedule by adding games manually. Auto-Generate and Playoff Wizard are available with Tournament Plus or higher.'}
        />
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
          division={divisions.find(g => g.id === filterGroup)}
          canGeneratePlayoffs={canGeneratePlayoffs}
          onEdit={openEdit}
          onDelete={handleDeleteRequest}
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
              pools={divisions.find(g => g.id === filterGroup)?.pools}
              onDelete={handleDeleteRequest}
              onCancel={markCancelled}
              onSchedule={markScheduled}
              onSave={handleSaveGame}
              onCreateVenue={() => setAddVenueOpen(true)}
              mode="planning"
            />
          )}
        </div>
      )}

      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-data)', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--logic-lime)', margin: 0 }}>
                {modal === 'add' ? 'Add Game' : 'Edit Game'}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
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
                    className="btn btn-outline btn-sm"
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
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="schedule-save-btn"><Check size={14} /> Save Game</button>
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
          onCancel={() => setShowGenerator(false)}
          onComplete={() => {
            setShowGenerator(false);
            refresh();
          }}
        />
      )}

      {showPlayoffWizard && filterGroup !== '' && canGeneratePlayoffs && (
        <PlayoffWizard
          division={divisions.find(g => g.id === filterGroup)!}
          tournamentId={currentTournament?.id || ''}
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
          mode={publishModal.mode}
          divisionId={publishModal.divisionId}
          divisions={divisions}
          tournament={currentTournament}
          canNotify={canNotify}
          orgSlug={currentOrg?.slug ?? ''}
          onClose={() => setPublishModal(null)}
          onPublished={handlePublishDone}
        />
      )}

      <FeedbackModal
        {...feedback}
        onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))}
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
  options: Array<{ key: string; label: string; count: number }>;
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
              <span className={styles.venueFilterName}>All venues</span>
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
                  <span className={styles.venueFilterName}>{option.label}</span>
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
  mode,
  divisionId,
  divisions,
  tournament,
  canNotify,
  orgSlug,
  onClose,
  onPublished,
}: {
  mode: 'single' | 'all';
  divisionId?: string;
  divisions: import('@/lib/types').Division[];
  tournament: import('@/lib/types').Tournament;
  canNotify: boolean;
  orgSlug: string;
  onClose: () => void;
  onPublished: (updates: { id: string; scheduleVisibility: 'published_generic' | 'published_teams' }[]) => void;
}) {
  const targets = mode === 'single'
    ? divisions.filter(g => g.id === divisionId)
    : divisions.filter(g => !g.scheduleVisibility || g.scheduleVisibility === 'unpublished');

  const allClosed = targets.every(g => g.isClosed);
  const someClosed = targets.some(g => g.isClosed);

  const [nameMode, setNameMode] = React.useState<'generic' | 'teams'>(allClosed ? 'teams' : 'generic');
  const [notify, setNotify] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ notified: number } | null>(null);

  const showTeamNamesOption = mode === 'single' ? targets[0]?.isClosed : someClosed;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const divisionIds = targets.map(g => g.id);
      const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';

      // In "all" mode, smart-assign: closed divisions get team names if nameMode is 'teams',
      // open divisions always get generic.
      const allSameVisibility = mode === 'single' || !someClosed || nameMode === 'generic';

      if (allSameVisibility) {
        const visibility = nameMode === 'teams' ? 'published_teams' : 'published_generic';
        const res = await fetch(`/api/admin/schedule-publish${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentId: tournament.id, divisionIds, visibility, notify }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to publish');
        const data = await res.json();
        setResult({ notified: data.notified ?? 0 });
        onPublished(divisionIds.map(id => ({ id, scheduleVisibility: visibility })));
      } else {
        // Mixed: closed → teams, open → generic (two separate requests)
        const closedIds = targets.filter(g => g.isClosed).map(g => g.id);
        const openIds = targets.filter(g => !g.isClosed).map(g => g.id);

        const [r1, r2] = await Promise.all([
          closedIds.length ? fetch(`/api/admin/schedule-publish${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournamentId: tournament.id, divisionIds: closedIds, visibility: 'published_teams', notify }),
          }) : Promise.resolve(null),
          openIds.length ? fetch(`/api/admin/schedule-publish${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournamentId: tournament.id, divisionIds: openIds, visibility: 'published_generic', notify: false }),
          }) : Promise.resolve(null),
        ]);

        if (r1 && !r1.ok) throw new Error((await r1.json()).error ?? 'Failed to publish');
        if (r2 && !r2.ok) throw new Error((await r2.json()).error ?? 'Failed to publish');

        const n1 = r1 ? (await r1.json()).notified ?? 0 : 0;
        setResult({ notified: n1 });

        const updates = [
          ...closedIds.map(id => ({ id, scheduleVisibility: 'published_teams' as const })),
          ...openIds.map(id => ({ id, scheduleVisibility: 'published_generic' as const })),
        ];
        onPublished(updates);
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const titleText = mode === 'single'
    ? `Publish ${targets[0]?.name ?? 'Division'} Schedule`
    : 'Publish All Divisions';

  return (
    <div className="modal-overlay" onClick={result ? onClose : undefined}>
      <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={16} style={{ color: 'var(--logic-lime)' }} /> {titleText}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          {result ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✓</div>
              <p style={{ fontWeight: 700, color: 'var(--logic-lime)', marginBottom: '0.5rem' }}>Schedule Published!</p>
              {result.notified > 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--white-60)' }}>
                  Notified {result.notified} team{result.notified !== 1 ? 's' : ''} by email.
                </p>
              )}
              <button className="btn btn-primary btn-sm" onClick={onClose} style={{ marginTop: '1rem' }}>Done</button>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--white-70)', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.55 }}>
                {mode === 'single'
                  ? 'This division\'s schedule will appear on your public tournament page. After publishing, saved schedule edits are visible automatically.'
                  : `${targets.length} unpublished division${targets.length !== 1 ? 's' : ''} will appear on your public tournament page. After publishing, saved schedule edits are visible automatically.`}
              </p>

              {mode === 'all' && targets.length > 0 && (
                <div style={{
                  background: 'var(--white-5)', border: '1px solid var(--white-10)',
                  borderRadius: '2px', padding: '0.75rem 1rem', marginBottom: '1.25rem',
                }}>
                  {targets.map(g => (
                    <div key={g.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.3rem 0', fontSize: '0.83rem', color: 'var(--white-70)',
                    }}>
                      <span style={{ fontWeight: 600 }}>{g.name}</span>
                      <span style={{ fontSize: '0.73rem', color: g.isClosed ? 'var(--logic-lime)' : 'var(--white-40)' }}>
                        {g.isClosed ? 'Registration closed' : 'Registration open'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

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
                      Teams appear as "Team 1", "Team 2", etc.
                      {mode === 'single' && !targets[0]?.isClosed ? ' Recommended — registration is still open.' : ''}
                    </div>
                  </div>
                </label>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                  padding: '0.75rem', borderRadius: '2px',
                  cursor: showTeamNamesOption ? 'pointer' : 'not-allowed',
                  opacity: showTeamNamesOption ? 1 : 0.45,
                  background: nameMode === 'teams' ? 'rgba(var(--logic-lime-rgb),0.06)' : 'transparent',
                  border: nameMode === 'teams' ? '1px solid rgba(var(--logic-lime-rgb),0.25)' : '1px solid transparent',
                }}>
                  <input
                    type="radio"
                    checked={nameMode === 'teams'}
                    onChange={() => showTeamNamesOption && setNameMode('teams')}
                    disabled={!showTeamNamesOption}
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.2rem' }}>Real team names</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--white-50)', lineHeight: 1.45 }}>
                      {showTeamNamesOption
                        ? mode === 'all' && someClosed && !allClosed
                          ? 'Divisions with closed registration will show team names. Open divisions will use placeholders.'
                          : 'Registered team names will be visible on the public schedule.'
                        : 'Close registration for this division first.'}
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

              <div className="modal-footer" style={{ padding: 0, marginTop: 0 }}>
                <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
                <button className="btn btn-primary" onClick={handleConfirm} disabled={loading || targets.length === 0}>
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
  return (
    <div style={{
      display: 'flex',
      gap: '2.5rem',
      overflowX: 'auto',
      padding: '1.5rem 0',
      minHeight: '300px',
    }}>
      {columns.map((col: any, idx: number) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', width: '210px', flexShrink: 0 }}>
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
            {col.games.map((g: any) => (
              <div key={g.id} style={{ position: 'relative' }}>
                {idx < columns.length - 1 && (
                  <div style={{
                    position: 'absolute', right: '-2.5rem', top: '50%',
                    width: '2.5rem', height: '1px',
                    background: 'var(--blueprint-blue)', opacity: 0.3, zIndex: 0
                  }} />
                )}
                <div className="card" style={{
                  padding: '0.75rem',
                  border: '1px solid rgba(var(--blueprint-blue-rgb), 0.2)',
                  background: 'var(--surface)',
                  position: 'relative', zIndex: 1,
                  boxShadow: 'var(--shadow-sm)',
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
            ))}
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
          {canGeneratePlayoffs ? 'Use the Playoff Wizard to generate brackets.' : 'Add playoff games manually, or upgrade to generate brackets.'}
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
    <div style={{
      display: 'flex',
      gap: '2.5rem',
      overflowX: 'auto',
      padding: '2rem 0.75rem',
      minHeight: '500px',
    }}>
      <BracketColumns columns={columns} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} />
    </div>
  );
}
