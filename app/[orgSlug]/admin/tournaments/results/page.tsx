'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Check, ExternalLink, MapPin, Trophy, RefreshCw, X } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
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
  ToolbarMenu,
  ToolbarMenuItem,
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
  const showPdfNudge = canUsePDF && pdfSettings !== null && Object.keys(pdfSettings).length === 0;

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
      setFilterGroup(prev => prev || (groups.length > 0 ? groups[0].id : ''));
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
  const getGameVenueLabel = (g: Game) => {
    if (g.venueId) return getVenueName(g.venueId, g.venueFacilityId) || g.location || 'Unknown venue';
    return g.location?.trim() || 'No venue';
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
        map.set(key, { key, label: getGameVenueLabel(g), count: 1 });
      }
      return map;
    }, new Map<string, { key: string; label: string; count: number }>()),
  ).map(([, option]) => option).sort((a, b) => a.label.localeCompare(b.label));

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

  async function handleExportPDF() {
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

  const statusFilterOptions = [
    { key: 'pending'   as ResultsFilter, label: 'To Be Scored',   count: pendingCount },
    { key: 'submitted' as ResultsFilter, label: 'Pending Review', count: submittedCount },
    { key: 'completed' as ResultsFilter, label: 'Completed',      count: completedCount },
  ];

  const statusChipClass: Record<ResultsFilter, string> = {
    pending: s.chip_pending,
    submitted: s.chip_waitlist,
    completed: s.chip_accepted,
  };

  return (
    <div className={s.page}>
      <TournamentAdminHeader
        icon={<Trophy size={20} />}
        title="Results & Scoring"
        subtitle={currentTournament ? `${currentTournament.name} (${currentTournament.year})` : 'Enter scores and finalize tournament outcomes'}
      />

      <TournamentAdminToolbar ariaLabel="Results controls" className={styles.resultsToolbar}>
        {/* ── Row 1 left: Division first, then view-mode controls ── */}
        <ToolbarGroup align="start">
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

        {/* ── Row 1 right: utility actions — Export · Tools ── */}
        <ToolbarGroup align="end">
          {/* Mobile row 2: Round Robin | Flat — dedicated row, hidden on desktop */}
          <div className={styles.mobileModePair}>
            <label className={styles.mobileModeNative}>
              <span className="sr-only">View</span>
              <select
                className={styles.mobileModeNativeSelect}
                value={viewMode}
                onChange={e => setViewMode(e.target.value as 'pool' | 'playoff')}
              >
                <option value="pool">Round Robin</option>
                <option value="playoff">Playoffs</option>
              </select>
            </label>
            {viewMode === 'pool' && (
              <label className={styles.mobileModeNative}>
                <span className="sr-only">Group</span>
                <select
                  className={styles.mobileModeNativeSelect}
                  value={groupMode}
                  onChange={e => setGroupMode(e.target.value as 'flat' | 'pools')}
                >
                  <option value="flat">Flat</option>
                  <option value="pools">Pools</option>
                </select>
              </label>
            )}
          </div>
          {/* Mobile row 3: venue filter — order:2 flows below mobileModePair, alongside action buttons */}
          <div className={styles.resultsVenueMobile}>
            <VenueFilterMenu
              options={venueFilterOptions}
              selectedKeys={selectedVenueKeys}
              onToggle={key => setSelectedVenueKeys(prev => prev.includes(key) ? prev.filter(v => v !== key) : [...prev, key])}
              onClear={() => setSelectedVenueKeys([])}
            />
          </div>
          <ExportMenu
            formats={['xlsx', 'csv', 'pdf']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            planId={currentOrg?.planId}
            disabled={filtered.length === 0}
          />
          {currentOrg?.slug && (
            <ToolbarMenu label="Tools">
              <ToolbarMenuItem
                icon={<ExternalLink size={14} />}
                label="Open Scorekeeper View"
                hint="Open scoring interface in a new tab"
                onSelect={() => window.open(`/${currentOrg!.slug}/scorekeeper`, '_blank', 'noopener,noreferrer')}
              />
            </ToolbarMenu>
          )}
        </ToolbarGroup>

        {/* ── Row 2: search + venue (desktop) + status filters ── */}
        <ToolbarGroup fullWidth>
          <ToolbarSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search teams..." label="Search games" />
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

      {showPdfNudge && (
        <HelpCallout
          variant="info"
          title="PDF settings not configured"
          body="Your PDF export will use default styling. Set up your header, logo, and footer once and all future PDFs will use those settings."
          cta={{ label: 'Configure PDF Settings', href: `/${currentOrg?.slug}/admin/org/settings/pdf` }}
          dismissible
          localStorageKey="flhq-pdf-nudge-results"
        />
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
              <span className={styles.venueFilterName}>All venues</span>
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
