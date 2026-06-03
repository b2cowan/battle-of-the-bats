'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Check, ChevronRight, ExternalLink, MapPin, SlidersHorizontal, Trophy, RefreshCw, X } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import { Game, Team, Division, Venue } from '@/lib/types';
import GameList from '../schedule/components/GameList';
import s from '../../admin-common.module.css';
import styles from './results-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import { hasPlanFeature } from '@/lib/plan-features';
import { formatScoreSubmittedAt, scoreSubmissionSourceLabel } from '@/lib/tournament-score-audit';
import {
  StatusLegendPopover,
  ToolbarGroup,
  ToolbarSearch,
  ToolbarSegmentedControl,
  ToolbarSelect,
  TournamentAdminHeader,
  TournamentAdminToolbar,
} from '@/components/admin/tournament/TournamentAdminUI';

// ── Export column definitions ─────────────────────────────────────────────
// Admin-only export now includes score submission audit metadata for review.
const RESULTS_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Date',       key: 'date'      },
  { label: 'Time',       key: 'time'      },
  { label: 'Division',   key: 'division'  },
  { label: 'Home Team',  key: 'homeTeam'  },
  { label: 'Home Score', key: 'homeScore' },
  { label: 'Away Team',  key: 'awayTeam'  },
  { label: 'Away Score', key: 'awayScore' },
  { label: 'Status',     key: 'status'    },
  { label: 'Submitted By', key: 'submittedBy' },
  { label: 'Submitted At', key: 'submittedAt' },
  { label: 'Submission Source', key: 'submissionSource' },
];

type ResultsFilter = 'pending' | 'submitted' | 'completed';

export default function AdminResultsPage() {
  const { currentTournament, loading: tournamentLoading } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Results & Scoring');
  const tournamentId = currentTournament?.id;
  const orgSlug = currentOrg?.slug;
  const requiresFinalization = currentTournament?.requireScoreFinalization ?? currentOrg?.requireScoreFinalization ?? false;
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterGroup, setFilterGroup] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<ResultsFilter[]>(['pending', 'submitted']);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'pool' | 'playoff'>('pool');
  const [groupMode, setGroupMode] = useState<'flat' | 'pools'>('pools');
  const [selectedVenueKeys, setSelectedVenueKeys] = useState<string[]>([]);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'primary' });

  // PDF settings — fetched once; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);
  const canUsePDF = currentOrg ? hasPlanFeature(currentOrg.planId, 'pdf_exports') : false;
  const [pdfWarningOpen, setPdfWarningOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (tournamentLoading) return;
    if (!tournamentId) {
      setGames([]);
      setTeams([]);
      setDivisions([]);
      setVenues([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const [gamesRes, teamsRes, groupsRes, venuesRes] = await Promise.all([
        fetch(`/api/admin/games?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/teams?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/divisions?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/venues?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
      ]);

      const allGames = gamesRes.ok ? await gamesRes.json() : [];
      const allTeams = teamsRes.ok ? await teamsRes.json() : [];
      const groups = groupsRes.ok ? await groupsRes.json() : [];
      const allVenues = venuesRes.ok ? await venuesRes.json() : [];

      setGames(allGames);
      setTeams(allTeams.filter((t: any) => t.status === 'accepted'));
      setDivisions(groups);
      setFilterGroup(prev => {
        // Keep current selection if still valid
        if (prev && groups.some((g: any) => g.id === prev)) return prev;
        // Restore from cache if the stored division still exists in this tournament
        try {
          const cachedGroup = (JSON.parse(localStorage.getItem(`flhq-results-${tournamentId}`) ?? '{}') as any).filterGroup as string | undefined;
          if (cachedGroup && groups.some((g: any) => g.id === cachedGroup)) return cachedGroup;
        } catch {}
        return groups.length > 0 ? groups[0].id : '';
      });
      setVenues(allVenues);
    } finally {
      setLoading(false);
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

  // Restore filter state from localStorage when the tournament changes.
  useEffect(() => {
    if (!tournamentId) return;
    try {
      const raw = localStorage.getItem(`flhq-results-${tournamentId}`);
      if (!raw) return;
      const cached = JSON.parse(raw) as Partial<{
        selectedStatuses: ResultsFilter[];
        viewMode: 'pool' | 'playoff';
        groupMode: 'flat' | 'pools';
        selectedVenueKeys: string[];
      }>;
      if (Array.isArray(cached.selectedStatuses) && cached.selectedStatuses.length > 0) {
        setSelectedStatuses(cached.selectedStatuses);
      }
      if (cached.viewMode === 'pool' || cached.viewMode === 'playoff') setViewMode(cached.viewMode);
      if (cached.groupMode === 'flat' || cached.groupMode === 'pools') setGroupMode(cached.groupMode);
      if (Array.isArray(cached.selectedVenueKeys)) setSelectedVenueKeys(cached.selectedVenueKeys);
    } catch {}
  }, [tournamentId]);

  // Persist filter state to localStorage. Guard: only write once divisions are loaded
  // so we don't overwrite valid cache with empty default state on initial render.
  useEffect(() => {
    if (!tournamentId || !filterGroup || divisions.length === 0) return;
    try {
      localStorage.setItem(`flhq-results-${tournamentId}`, JSON.stringify({
        filterGroup,
        selectedStatuses,
        viewMode,
        groupMode,
        selectedVenueKeys,
      }));
    } catch {}
  }, [tournamentId, filterGroup, selectedStatuses, viewMode, groupMode, selectedVenueKeys, divisions.length]);

  function getTeamName(id: string) {
    return teams.find(t => t.id === id)?.name ?? 'TBD';
  }

  function getGroupName(id: string) {
    return divisions.find(g => g.id === id)?.name ?? '—';
  }

  const getVenueName = (venueId?: string, facilityId?: string) => {
    const venue = venueId ? venues.find(d => d.id === venueId) : null;
    if (!venue) return '';
    if (!facilityId) return venue.name;
    const facility = (venue as any).facilities?.find((f: any) => f.id === facilityId);
    return facility ? `${venue.name} — ${facility.name}` : venue.name;
  };
  const getGameVenueKey = (g: Game) =>
    g.venueId ? `venue:${g.venueId}` : `custom:${(g.location || '').trim() || '__none__'}`;
  const getGameVenueDisplay = (g: Game): { name: string; sublabel?: string } => {
    if (g.venueId) {
      const venue = venues.find(v => v.id === g.venueId);
      if (!venue) return { name: g.location || 'Unknown venue' };
      if (g.venueFacilityId) {
        const facility = (venue as any).facilities?.find((f: any) => f.id === g.venueFacilityId);
        if (facility) return { name: venue.name, sublabel: facility.name };
      }
      return { name: venue.name };
    }
    return { name: g.location?.trim() || 'No venue' };
  };

  async function patchGame(body: Record<string, unknown>) {
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    const res = await fetch(`/api/admin/games${orgQuery}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data?.error === 'string' ? data.error : 'Score update failed');
    }
  }

  async function handleSaveScore(id: string, homeScore: number, awayScore: number) {
    await patchGame({ action: 'submit-score', id, homeScore, awayScore });
    refresh();
  }

  async function markScheduled(id: string) {
    setFeedback({
      isOpen: true,
      title: 'Revert Score?',
      message: 'This will clear the score and mark the game as scheduled. This action cannot be undone.',
      type: 'warning',
      onConfirm: async () => {
        await patchGame({ action: 'revert-score', id });
        refresh();
      }
    });
  }

  async function finalizeGame(id: string) {
    await patchGame({ action: 'finalize', id });
    refresh();
  }

  // Compute counts for filter chips
  const divisionGames = games.filter(g => {
    const matchesGroup = g.divisionId === filterGroup;
    const matchesView = viewMode === 'pool' ? !g.isPlayoff : g.isPlayoff;
    return matchesGroup && matchesView;
  });
  const pendingCount   = divisionGames.filter(g => g.status === 'scheduled').length;
  const submittedCount = divisionGames.filter(g => g.status === 'submitted').length;
  const completedCount = divisionGames.filter(g => g.status === 'completed').length;

  // Venue filter options — built from games in the current division + view mode
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

  const filtered = games.filter(g => {
    const matchesGroup = g.divisionId === filterGroup;
    const matchesStatus = selectedStatuses.length === 0 ||
      selectedStatuses.some(sf =>
        sf === 'pending'    ? g.status === 'scheduled' :
        sf === 'submitted'  ? g.status === 'submitted' :
        g.status === 'completed'
      );

    const hName = getTeamName(g.homeTeamId).toLowerCase();
    const aName = getTeamName(g.awayTeamId).toLowerCase();
    const hPlace = (g.homePlaceholder || '').toLowerCase();
    const aPlace = (g.awayPlaceholder || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = q === '' || hName.includes(q) || aName.includes(q) || hPlace.includes(q) || aPlace.includes(q);

    const matchesView = viewMode === 'pool' ? !g.isPlayoff : g.isPlayoff;
    const matchesVenue = selectedVenueKeys.length === 0 || selectedVenueKeys.includes(getGameVenueKey(g));

    return matchesGroup && matchesStatus && matchesSearch && matchesView && matchesVenue;
  });

  // ── Export handlers ────────────────────────────────────────────────────
  function buildResultsRows() {
    return filtered.map(g => ({
      date:      g.date ?? '',
      time:      formatTime(g.time),
      division:  getGroupName(g.divisionId),
      homeTeam:  getTeamName(g.homeTeamId),
      homeScore: g.homeScore != null ? g.homeScore : '',
      awayTeam:  getTeamName(g.awayTeamId),
      awayScore: g.awayScore != null ? g.awayScore : '',
      status:    g.status,
      submittedBy: g.scoreSubmittedByEmail ?? '',
      submittedAt: formatScoreSubmittedAt(g.scoreSubmittedAt),
      submissionSource: g.scoreSubmissionSource ? scoreSubmissionSourceLabel(g.scoreSubmissionSource) : '',
    }));
  }

  async function handleExportXLSX() {
    await downloadXLSX(
      buildFilename({ org: currentOrg?.slug, dataset: 'results', scope: String(currentTournament?.year ?? '') }, 'xlsx'),
      serializeHeaders(RESULTS_EXPORT_COLS),
      serializeRows(buildResultsRows(), RESULTS_EXPORT_COLS),
      'Results',
    );
  }

  function handleExportCSV() {
    const headers = serializeHeaders(RESULTS_EXPORT_COLS);
    const rows    = serializeRows(buildResultsRows(), RESULTS_EXPORT_COLS);
    downloadCSVBlob(
      buildFilename({ org: currentOrg?.slug, dataset: 'results', scope: String(currentTournament?.year ?? '') }, 'csv'),
      generateCSV(headers, rows),
    );
  }

  async function doPdfExport() {
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    };

    // Build groups: one table per division (all games for that division)
    const allFiltered = games.filter(g => {
      const matchesView = viewMode === 'pool' ? !g.isPlayoff : g.isPlayoff;
      return matchesView && (g.status === 'completed' || g.status === 'submitted' || g.status === 'scheduled');
    });

    const groupMap = new Map<string, typeof allFiltered>();
    for (const ag of divisions) {
      const divGames = allFiltered.filter(g => g.divisionId === ag.id);
      if (divGames.length > 0) groupMap.set(ag.id, divGames);
    }

    const headers = serializeHeaders(RESULTS_EXPORT_COLS);

    // Champions callout: find winner of the last completed game per division
    const champLines: string[] = [];
    for (const ag of divisions) {
      const divGames = (groupMap.get(ag.id) ?? []).filter(g => g.status === 'completed');
      if (divGames.length === 0) continue;
      const last = divGames[divGames.length - 1];
      if (last.homeScore != null && last.awayScore != null) {
        const winner = last.homeScore > last.awayScore
          ? getTeamName(last.homeTeamId)
          : last.awayScore > last.homeScore
            ? getTeamName(last.awayTeamId)
            : null;
        if (winner) champLines.push(`${ag.name}: ${winner}`);
      }
    }
    const subtitle = champLines.length > 0
      ? `Champions — ${champLines.join('  ·  ')}`
      : currentTournament?.name;

    const groups = divisions
      .filter(ag => groupMap.has(ag.id))
      .map(ag => ({
        label: ag.name,
        rows: (groupMap.get(ag.id) ?? []).map(g => [
          g.date ?? '',
          formatTime(g.time),
          getGroupName(g.divisionId),
          getTeamName(g.homeTeamId),
          g.homeScore != null ? g.homeScore : '—',
          getTeamName(g.awayTeamId),
          g.awayScore != null ? g.awayScore : '—',
          g.status,
          g.scoreSubmittedByEmail ?? '',
          formatScoreSubmittedAt(g.scoreSubmittedAt),
          g.scoreSubmissionSource ? scoreSubmissionSourceLabel(g.scoreSubmissionSource) : '',
        ]),
      }));

    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'results', scope: String(currentTournament?.year ?? '') },
      'pdf',
    );

    // Flat fallback if no groups resolved
    const flatRows = serializeRows(buildResultsRows(), RESULTS_EXPORT_COLS);

    await downloadPDF(
      filename,
      'Tournament Results',
      subtitle,
      headers,
      flatRows,
      settings,
      groups.length > 0 ? groups : undefined,
    );
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

  const statusFilterOptions = [
    { key: 'pending'   as ResultsFilter, label: 'Unscored',   count: pendingCount },
    { key: 'submitted' as ResultsFilter, label: 'Reviewing',  count: submittedCount },
    { key: 'completed' as ResultsFilter, label: 'Completed',  count: completedCount },
  ];

  const statusChipClass: Record<ResultsFilter, string> = {
    pending: s.chip_pending,
    submitted: s.chip_waitlist,
    completed: s.chip_accepted,
  };

  // Label shown in the venue button inside the sheet and in the summary strip
  const venueLabel = selectedVenueKeys.length === 0
    ? 'All venues'
    : selectedVenueKeys.length === 1
      ? (venueFilterOptions.find(o => o.key === selectedVenueKeys[0])?.label ?? '1 venue')
      : `${selectedVenueKeys.length} venues`;

  // Always-visible summary of current view settings for the strip outside the sheet
  const settingsSummary = [
    viewMode === 'pool' ? 'Round Robin' : 'Playoffs',
    viewMode === 'pool' ? (groupMode === 'pools' ? 'Pools' : 'Flat') : null,
    venueFilterOptions.length > 1 ? venueLabel : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={s.page}>
      <TournamentAdminHeader
        icon={<Trophy size={20} />}
        title="Results & Scoring"
        subtitle={currentTournament ? `${currentTournament.name} (${currentTournament.year})` : 'Enter scores and finalize tournament outcomes'}
        mobileActionsInline
        actions={(
          <>
            <ExportMenu
              className={styles.resultsExportMenu}
              formats={['xlsx', 'csv', 'pdf']}
              onExportXLSX={handleExportXLSX}
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              planId={currentOrg?.planId}
              disabled={filtered.length === 0}
            />
            {currentOrg?.slug && (
              <button
                type="button"
                className={`btn btn-ghost btn-data ${styles.mobileIconButton}`}
                onClick={() => window.open(`/${currentOrg!.slug}/scorekeeper`, '_blank', 'noopener,noreferrer')}
                title="Open scorekeeper view"
                aria-label="Open scorekeeper view"
              >
                <ExternalLink size={12} />
                <span className={styles.mobileButtonLabel}>Scorekeeper</span>
              </button>
            )}
          </>
        )}
      />

      <TournamentAdminToolbar ariaLabel="Results controls" className={styles.resultsToolbar}>
        {/* ── Row 1 left: Division first, then view-mode controls ── */}
        <ToolbarGroup align="start" className={styles.resultsStartGroup}>
          {/* Division always first — primary context selector, matches Schedule pattern */}
          {divisions.length > 0 && (
            <ToolbarSelect<string>
              label="Division"
              value={filterGroup}
              options={divisions.map(g => ({ value: g.id, label: g.name }))}
              onChange={setFilterGroup}
            />
          )}
          <ToolbarSegmentedControl<'pool' | 'playoff'>
            className={styles.desktopModeControl}
            value={viewMode}
            options={[
              { value: 'pool', label: 'Round Robin' },
              { value: 'playoff', label: 'Playoffs' },
            ]}
            onChange={setViewMode}
            ariaLabel="View mode"
          />
          {viewMode === 'pool' && (
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
          )}
        </ToolbarGroup>

        {/* ── Row 2: search + venue (desktop) + status filters ── */}
        <ToolbarGroup fullWidth>
          <ToolbarSearch className={styles.resultsSearch} value={searchQuery} onChange={setSearchQuery} placeholder="Search teams..." label="Search games" />
          <div className={styles.resultsVenueDesktop}>
            <VenueFilterMenu
              options={venueFilterOptions}
              selectedKeys={selectedVenueKeys}
              onToggle={key => setSelectedVenueKeys(prev => prev.includes(key) ? prev.filter(v => v !== key) : [...prev, key])}
              onClear={() => setSelectedVenueKeys([])}
            />
          </div>
          <div className={`${s.statusFilters} ${styles.resultsStatusFilters}`}>
            {statusFilterOptions.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                className={`${s.filterChip} ${statusChipClass[key]} ${selectedStatuses.includes(key) ? s.chipActive : ''}`}
                data-empty={count === 0 ? 'true' : undefined}
                onClick={() => setSelectedStatuses(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])}
              >
                <span>{label}</span>
                <span className={s.chipCount}>{count}</span>
              </button>
            ))}
            {requiresFinalization && (
              <StatusLegendPopover
                label="Score statuses"
                title="Score Status Guide"
                items={[
                  {
                    label: 'To Be Scored',
                    description: 'Game is scheduled but no score has been submitted yet.',
                    tone: 'neutral',
                  },
                  {
                    label: 'Pending Review',
                    description: 'Score submitted by a scorekeeper - visible to the public but not yet final. Use Finalize to confirm it.',
                    tone: 'warning',
                  },
                  {
                    label: 'Completed',
                    description: 'Score is finalized. Admins can still correct or revert the result if needed.',
                    tone: 'success',
                  },
                ]}
              />
            )}
          </div>
        </ToolbarGroup>
      </TournamentAdminToolbar>

      {/* ── Mobile settings bottom sheet ────────────────────── */}
      {mobileSettingsOpen && (
        <>
          <div
            className={styles.sheetBackdrop}
            onClick={() => setMobileSettingsOpen(false)}
            aria-hidden
          />
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="View settings">
            <div className={styles.sheetHandle} />
            <div className={styles.sheetBody}>
              <div className={styles.sheetSection}>
                <div className={styles.sheetSectionLabel}>Stage</div>
                <div className={styles.sheetSegments}>
                  {(['pool', 'playoff'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
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
                      <button
                        key={v}
                        type="button"
                        className={`${styles.sheetSeg} ${groupMode === v ? styles.sheetSegActive : ''}`}
                        onClick={() => setGroupMode(v)}
                      >
                        {v === 'flat' ? 'Flat' : 'Pools'}
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
                  {statusFilterOptions.map(({ key, label }) => (
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

              <button
                type="button"
                className={styles.sheetDone}
                onClick={() => setMobileSettingsOpen(false)}
              >
                Done
              </button>
            </div>
          </div>

          {/* ── Venue nested modal (slides over the settings sheet) ── */}
          {venueModalOpen && (
            <>
              <div
                className={styles.venueModalBackdrop}
                onClick={() => setVenueModalOpen(false)}
                aria-hidden
              />
              <div className={styles.venueModal} role="dialog" aria-modal="true" aria-label="Filter by venue">
                <div className={styles.venueModalHandle} />
                <div className={styles.venueModalHeader}>
                  <button
                    type="button"
                    className={styles.venueModalBack}
                    onClick={() => setVenueModalOpen(false)}
                  >
                    ← Back
                  </button>
                  <span className={styles.venueModalTitle}>Venue</span>
                  {selectedVenueKeys.length > 0 && (
                    <button
                      type="button"
                      className={styles.venueModalClear}
                      onClick={() => setSelectedVenueKeys([])}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className={styles.venueModalList}>
                  <button
                    type="button"
                    className={`${styles.venueModalOption} ${selectedVenueKeys.length === 0 ? styles.venueModalOptionActive : ''}`}
                    onClick={() => setSelectedVenueKeys([])}
                  >
                    <span>All venues</span>
                    <span className={styles.venueModalCount}>{totalVenueCount}</span>
                  </button>
                  {venueFilterOptions.map(opt => {
                    const isActive = selectedVenueKeys.includes(opt.key);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        className={`${styles.venueModalOption} ${isActive ? styles.venueModalOptionActive : ''}`}
                        onClick={() => setSelectedVenueKeys(prev =>
                          prev.includes(opt.key) ? prev.filter(k => k !== opt.key) : [...prev, opt.key]
                        )}
                      >
                        <span>
                          {opt.label}
                          {opt.sublabel && <span className={styles.venueModalSublabel}> — {opt.sublabel}</span>}
                        </span>
                        <span className={styles.venueModalCount}>{opt.count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className={styles.venueModalFooter}>
                  <button
                    type="button"
                    className={styles.sheetDone}
                    onClick={() => setVenueModalOpen(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Active settings summary strip (mobile only, outside sheet) ── */}
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
              {statusFilterOptions.map(({ key, count }) => (
                <span
                  key={key}
                  className={[
                    styles.tallyPill,
                    key === 'pending'   ? styles.tallyPending   : '',
                    key === 'submitted' ? styles.tallySubmitted : '',
                    key === 'completed' ? styles.tallyCompleted : '',
                    !selectedStatuses.includes(key) ? styles.tallyInactive : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className={styles.tallyDot} />
                  {count}
                </span>
              ))}
            </span>
            <SlidersHorizontal size={12} className={styles.activeSettingsSummaryIcon} aria-hidden />
          </span>
        </button>
      )}


      {!loading && currentTournament && games.length === 0 && (
        <HelpCallout
          variant="info"
          title="No scores submitted yet"
          body="Scores appear here as scorekeepers submit them from the field. Results are live — no refresh needed once a game is scored."
        />
      )}

      {tournamentLoading || loading ? (
        <div className="empty-state"><RefreshCw size={32} className="spin opacity-40" /><p>Loading games...</p></div>
      ) : !currentTournament ? (
        <div className="empty-state">
          <Trophy size={40} style={{ opacity: 0.2 }} />
          <p>No tournament selected.</p>
        </div>
      ) : filtered.length === 0 && games.length > 0 ? (
        <div className="empty-state">
          <Trophy size={40} style={{ opacity: 0.2 }} />
          <p>{searchQuery ? 'No games matching search.' : 'No games found.'}</p>
        </div>
      ) : games.length > 0 ? (
        <div className={s.compactList}>
          <GameList
            games={filtered}
            teams={teams}
            divisions={divisions}
            venues={venues}
            viewMode={viewMode}
            groupByPool={groupMode === 'pools'}
            onSaveScore={handleSaveScore}
            onFinalize={finalizeGame}
            onSchedule={markScheduled}
            mode="scoring"
          />
        </div>
      ) : null}

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

// ── VenueFilterMenu ──────────────────────────────────────────────────────────
// Local component — mirrors the implementation in schedule/page.tsx.
// References `styles` (results-admin.module.css) so all venueFilter* class
// names resolve to the results-specific CSS module.
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
      ? options.find(o => o.key === selectedKeys[0])?.label ?? '1 venue'
      : `${selectedCount} venues`;

  return (
    <div className={styles.venueFilterRoot} ref={rootRef}>
      <button
        type="button"
        className={`${styles.venueFilterButton} ${selectedCount > 0 ? styles.venueFilterButtonActive : ''}`}
        onClick={() => setOpen(v => !v)}
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
              <span className={styles.venueFilterCount}>{options.reduce((t, o) => t + o.count, 0)}</span>
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
