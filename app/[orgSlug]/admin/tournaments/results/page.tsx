'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExternalLink, SlidersHorizontal, Trophy, RefreshCw } from 'lucide-react';
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

/**
 * Signal that a game's score just became public (finalize / forfeit) so the mobile AdminContextStrip
 * can offer a one-tap "See it live" nudge to that game on the public schedule (The Flip). The event
 * carries the game's OWN tournament context so the deep-link can't drift if the admin switches
 * tournaments or navigates away before the save resolves and this fires.
 */
function emitScorePublished(detail: { gameId: string; orgSlug: string; tournamentSlug: string; isDraft: boolean }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('flhq:score-published', { detail }));
}

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
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
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
      }>;
      if (Array.isArray(cached.selectedStatuses) && cached.selectedStatuses.length > 0) {
        setSelectedStatuses(cached.selectedStatuses);
      }
      if (cached.viewMode === 'pool' || cached.viewMode === 'playoff') setViewMode(cached.viewMode);
      if (cached.groupMode === 'flat' || cached.groupMode === 'pools') setGroupMode(cached.groupMode);
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
      }));
    } catch {}
  }, [tournamentId, filterGroup, selectedStatuses, viewMode, groupMode, divisions.length]);

  // WI-2: notification deep link (…/results?gameId=…). Once games load, snap division / stage /
  // status filters so the target game is actually in view BEFORE GameList renders (default filters
  // would otherwise hide a completed game entirely), then hand GameList the id to expand + scroll.
  // Runs once per gameId (ref-guarded) so it never fights the user's later filter changes.
  const searchParams = useSearchParams();
  const focusGameId = searchParams.get('gameId');
  const focusSnappedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusGameId || focusSnappedRef.current === focusGameId) return;
    const target = games.find(g => g.id === focusGameId);
    if (!target) return; // wait until the games list has loaded
    focusSnappedRef.current = focusGameId;
    if (target.divisionId) setFilterGroup(target.divisionId);
    setViewMode(target.isPlayoff ? 'playoff' : 'pool');
    const bucket: ResultsFilter =
      target.status === 'scheduled' ? 'pending' : target.status === 'submitted' ? 'submitted' : 'completed';
    setSelectedStatuses(prev => (prev.includes(bucket) ? prev : [...prev, bucket]));
  }, [focusGameId, games]);

  // One toggle for the status filter chips — shared by the desktop chip row, the mobile settings
  // sheet, and the mobile summary-strip Completed chip (all three flip the same `selectedStatuses`).
  const toggleStatus = useCallback((key: ResultsFilter) => {
    setSelectedStatuses(prev => (prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]));
  }, []);

  function getTeamName(id: string) {
    return teams.find(t => t.id === id)?.name ?? 'TBD';
  }

  function getGroupName(id: string) {
    return divisions.find(g => g.id === id)?.name ?? '—';
  }

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

  async function handleForfeit(id: string, winningSide: 'home' | 'away') {
    await patchGame({ action: 'forfeit', id, winningSide });
    emitScorePublished({ gameId: id, orgSlug: orgSlug ?? '', tournamentSlug: currentTournament?.slug ?? '', isDraft: currentTournament?.status === 'draft' });
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
    emitScorePublished({ gameId: id, orgSlug: orgSlug ?? '', tournamentSlug: currentTournament?.slug ?? '', isDraft: currentTournament?.status === 'draft' });
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
  // Forfeits are a final result — group them with completed for counts/filters.
  const completedCount = divisionGames.filter(g => g.status === 'completed' || g.status === 'forfeit').length;

  const filtered = games.filter(g => {
    const matchesGroup = g.divisionId === filterGroup;
    const matchesStatus = selectedStatuses.length === 0 ||
      selectedStatuses.some(sf =>
        sf === 'pending'    ? g.status === 'scheduled' :
        sf === 'submitted'  ? g.status === 'submitted' :
        (g.status === 'completed' || g.status === 'forfeit')
      );

    const hName = getTeamName(g.homeTeamId).toLowerCase();
    const aName = getTeamName(g.awayTeamId).toLowerCase();
    const hPlace = (g.homePlaceholder || '').toLowerCase();
    const aPlace = (g.awayPlaceholder || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = q === '' || hName.includes(q) || aName.includes(q) || hPlace.includes(q) || aPlace.includes(q);

    const matchesView = viewMode === 'pool' ? !g.isPlayoff : g.isPlayoff;

    return matchesGroup && matchesStatus && matchesSearch && matchesView;
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
      return matchesView && (g.status === 'completed' || g.status === 'submitted' || g.status === 'scheduled' || g.status === 'forfeit');
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
      const divGames = (groupMap.get(ag.id) ?? []).filter(g => g.status === 'completed' || g.status === 'forfeit');
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
    pending: s.chip_info,      // Unscored → info-blue (matches scheduled row stripe + tally)
    submitted: s.chip_warning, // Reviewing → warning-amber (matches submitted row + tally)
    completed: s.chip_success, // Completed → success-green
  };

  // Stage label for the mobile summary strip — the grouping sub-mode (Pools/Flat)
  // is one tap away in the sheet, so the strip stays to the coarse context only.
  const settingsSummary = viewMode === 'pool' ? 'Round Robin' : 'Playoffs';

  return (
    <div className={s.page}>
      <TournamentAdminHeader
        icon={<Trophy size={20} />}
        title="Results & Scoring"
        subtitle={currentTournament ? `${currentTournament.name} (${currentTournament.year})` : 'Enter scores and finalize tournament outcomes'}
        mobileActionsInline
        help={{
          module: 'tournaments',
          sectionIds: ['scores-and-results', 'recipe-finalize-tournament-scores'],
          label: 'Results',
          fullGuideHref: currentOrg ? `/${currentOrg.slug}/admin/help/tournaments#scores-and-results` : undefined,
        }}
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

        {/* ── Row 2: search + status filters ── */}
        <ToolbarGroup fullWidth>
          <ToolbarSearch className={styles.resultsSearch} value={searchQuery} onChange={setSearchQuery} placeholder="Search teams..." label="Search games" />
          <div className={`${s.statusFilters} ${styles.resultsStatusFilters}`}>
            {statusFilterOptions.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                className={`${s.filterChip} ${statusChipClass[key]} ${selectedStatuses.includes(key) ? s.chipActive : ''}`}
                data-empty={count === 0 ? 'true' : undefined}
                onClick={() => toggleStatus(key)}
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
                    tone: 'info',
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

              <div className={styles.sheetSection}>
                <div className={styles.sheetSectionLabel}>Game Status</div>
                <div className={styles.sheetSegments}>
                  {statusFilterOptions.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.sheetSeg} ${selectedStatuses.includes(key) ? styles.sheetSegActive : ''}`}
                      onClick={() => toggleStatus(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {requiresFinalization && (
                  <div style={{ marginTop: '0.6rem' }}>
                    <StatusLegendPopover
                      label="What do these mean?"
                      title="Score Status Guide"
                      items={[
                        { label: 'To Be Scored', description: 'Game is scheduled but no score has been submitted yet.', tone: 'info' },
                        { label: 'Pending Review', description: 'Score submitted by a scorekeeper - visible to the public but not yet final. Use Finalize to confirm it.', tone: 'warning' },
                        { label: 'Completed', description: 'Score is finalized. Admins can still correct or revert the result if needed.', tone: 'success' },
                      ]}
                    />
                  </div>
                )}
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
        </>
      )}

      {/* ── Active settings summary strip (mobile only, outside sheet) ──
          WI-4: split from a single strip-button into a wrapper (buttons can't nest) so the new
          Completed chip is independently tappable. The text + sliders both still open the sheet. */}
      {currentTournament && !mobileSettingsOpen && (
        <div className={styles.activeSettingsSummary}>
          <button
            type="button"
            className={styles.activeSettingsSummaryText}
            onClick={() => setMobileSettingsOpen(true)}
            aria-label={`View settings: ${settingsSummary}`}
          >
            {settingsSummary}
          </button>
          <span className={styles.summaryRight}>
            {/* Single "needs action" count — only games awaiting finalize (the one
                number that demands attention); per-row stripes carry the rest. */}
            {submittedCount > 0 && (
              <span className={`${styles.tallyPill} ${styles.tallySubmitted}`} aria-hidden>
                <span className={styles.tallyDot} />
                {submittedCount}
              </span>
            )}
            {/* WI-4: the desktop's Completed chip, now on mobile — one tap reveals finalized games
                (the most common bleachers correction) without opening the settings sheet. */}
            <button
              type="button"
              className={`${s.filterChip} ${s.chip_success} ${styles.summaryCompletedChip} ${selectedStatuses.includes('completed') ? s.chipActive : ''}`}
              data-empty={completedCount === 0 ? 'true' : undefined}
              aria-pressed={selectedStatuses.includes('completed')}
              aria-label={`${selectedStatuses.includes('completed') ? 'Hide' : 'Show'} completed games (${completedCount})`}
              onClick={() => toggleStatus('completed')}
            >
              <span>Completed</span>
              <span className={s.chipCount}>{completedCount}</span>
            </button>
            <button
              type="button"
              className={styles.summarySlidersBtn}
              onClick={() => setMobileSettingsOpen(true)}
              aria-label="Open view settings"
            >
              <SlidersHorizontal size={12} className={styles.activeSettingsSummaryIcon} aria-hidden />
            </button>
          </span>
        </div>
      )}


      {!loading && currentTournament && games.length === 0 && (
        // No games exist yet → the schedule hasn't been built, so promising
        // "scores appear live" is a false promise (J1-087). Point the organizer
        // to build the schedule first; the live-scores reassurance only applies
        // once games exist and are waiting to be scored.
        <HelpCallout
          variant="info"
          title="No schedule built yet"
          body="There are no games to score yet. Build your schedule first — then scores will appear here live as scorekeepers submit them from the field, no refresh needed."
          cta={currentOrg?.slug ? { label: 'Go to Schedule', href: `/${currentOrg.slug}/admin/tournaments/schedule?tournamentId=${currentTournament.id}` } : undefined}
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
            onForfeit={handleForfeit}
            onFinalize={finalizeGame}
            onSchedule={markScheduled}
            focusGameId={focusGameId}
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

