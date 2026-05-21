'use client';
import React, { useState, useEffect } from 'react';
import { Trophy, X, Check, Search, RefreshCw } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import { Game, Team, AgeGroup, Diamond } from '@/lib/types';
import GameList from '../schedule/components/GameList';
import s from '../../admin-common.module.css';
import styles from '../schedule/schedule-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import { hasPlanFeature } from '@/lib/plan-features';

// ── Export column definitions ─────────────────────────────────────────────
// No sensitive fields on this surface — results data is public/operational.
const RESULTS_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Date',       key: 'date'      },
  { label: 'Time',       key: 'time'      },
  { label: 'Division',   key: 'division'  },
  { label: 'Home Team',  key: 'homeTeam'  },
  { label: 'Home Score', key: 'homeScore' },
  { label: 'Away Team',  key: 'awayTeam'  },
  { label: 'Away Score', key: 'awayScore' },
  { label: 'Status',     key: 'status'    },
];

type ResultsFilter = 'pending' | 'submitted' | 'completed';

export default function AdminResultsPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const requiresFinalization = currentOrg?.requireScoreFinalization ?? false;
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Game | null>(null);
  const [scores, setScores] = useState({ home: '', away: '' });
  const [showErrors, setShowErrors] = useState(false);

  const [filterGroup, setFilterGroup] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<ResultsFilter[]>(['pending', 'submitted']);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'pool' | 'playoff'>('pool');
  const [groupMode, setGroupMode] = useState<'flat' | 'pools'>('pools');
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

  async function refresh() {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;

    setLoading(true);
    const [gamesRes, teamsRes, groupsRes, diamondsRes] = await Promise.all([
      fetch(`/api/admin/games?tournamentId=${encodeURIComponent(tournamentId)}`),
      fetch(`/api/admin/teams?tournamentId=${encodeURIComponent(tournamentId)}`),
      fetch(`/api/admin/age-groups?tournamentId=${encodeURIComponent(tournamentId)}`),
      fetch(`/api/admin/diamonds?tournamentId=${encodeURIComponent(tournamentId)}`),
    ]);

    const allGames = gamesRes.ok ? await gamesRes.json() : [];
    const allTeams = teamsRes.ok ? await teamsRes.json() : [];
    const groups = groupsRes.ok ? await groupsRes.json() : [];
    const allDiamonds = diamondsRes.ok ? await diamondsRes.json() : [];

    setGames(allGames);
    setTeams(allTeams.filter((t: any) => t.status === 'accepted'));
    setAgeGroups(groups);
    if (groups.length > 0 && !filterGroup) {
      setFilterGroup(groups[0].id);
    }
    setDiamonds(allDiamonds);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [currentTournament?.id]);

  useEffect(() => {
    fetch('/api/admin/org/pdf-settings')
      .then(r => r.ok ? r.json() : {})
      .then(data => setPdfSettings(data as OrgPdfSettings))
      .catch(() => setPdfSettings(null));
  }, []);

  function getTeamName(id: string) {
    return teams.find(t => t.id === id)?.name ?? 'TBD';
  }

  function getGroupName(id: string) {
    return ageGroups.find(g => g.id === id)?.name ?? '—';
  }

  function openScore(g: Game) {
    setScores({
      home: g.homeScore !== null && g.homeScore !== undefined ? String(g.homeScore) : '',
      away: g.awayScore !== null && g.awayScore !== undefined ? String(g.awayScore) : ''
    });
    setShowErrors(false);
    setEditing(g);
  }

  async function patchGame(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data?.error === 'string' ? data.error : 'Score update failed');
    }
  }

  async function handleSaveScore() {
    if (!editing) return;
    if (scores.home === '' || scores.away === '') {
      setShowErrors(true);
      return;
    }
    await patchGame({
      action: 'submit-score',
      id: editing.id,
      homeScore: Number(scores.home),
      awayScore: Number(scores.away),
    });
    setEditing(null);
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
    const matchesGroup = g.ageGroupId === filterGroup;
    const matchesView = viewMode === 'pool' ? !g.isPlayoff : g.isPlayoff;
    return matchesGroup && matchesView;
  });
  const pendingCount   = divisionGames.filter(g => g.status === 'scheduled').length;
  const submittedCount = divisionGames.filter(g => g.status === 'submitted').length;
  const completedCount = divisionGames.filter(g => g.status === 'completed').length;

  const filtered = games.filter(g => {
    const matchesGroup = g.ageGroupId === filterGroup;
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

    return matchesGroup && matchesStatus && matchesSearch && matchesView;
  });

  // ── Export handlers ────────────────────────────────────────────────────
  function buildResultsRows() {
    return filtered.map(g => ({
      date:      g.date ?? '',
      time:      formatTime(g.time),
      division:  getGroupName(g.ageGroupId),
      homeTeam:  getTeamName(g.homeTeamId),
      homeScore: g.homeScore != null ? g.homeScore : '',
      awayTeam:  getTeamName(g.awayTeamId),
      awayScore: g.awayScore != null ? g.awayScore : '',
      status:    g.status,
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
    for (const ag of ageGroups) {
      const divGames = allFiltered.filter(g => g.ageGroupId === ag.id);
      if (divGames.length > 0) groupMap.set(ag.id, divGames);
    }

    const headers = serializeHeaders(RESULTS_EXPORT_COLS);

    // Champions callout: find winner of the last completed game per division
    const champLines: string[] = [];
    for (const ag of ageGroups) {
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

    const groups = ageGroups
      .filter(ag => groupMap.has(ag.id))
      .map(ag => ({
        label: ag.name,
        rows: (groupMap.get(ag.id) ?? []).map(g => [
          g.date ?? '',
          formatTime(g.time),
          getGroupName(g.ageGroupId),
          getTeamName(g.homeTeamId),
          g.homeScore != null ? g.homeScore : '—',
          getTeamName(g.awayTeamId),
          g.awayScore != null ? g.awayScore : '—',
          g.status,
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

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div className={s.headerLeft}>
          <div className={s.headerIcon}><Trophy size={20} /></div>
          <div>
            <h1 className={s.pageTitle}>Results & Scoring</h1>
            <p className={s.pageSub}>Enter scores and finalize tournament outcomes</p>
          </div>
        </div>
        <div className={s.headerActions}>
          <ExportMenu
            formats={['xlsx', 'csv', 'pdf']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            planId={currentOrg?.planId}
            disabled={filtered.length === 0}
          />
        </div>
      </div>

      <div className={s.controlsBar}>
        <div className={s.controlsLeft}>
          <div className={s.viewToggle}>
            <button className={`${s.toggleBtn} ${viewMode === 'pool' ? s.toggleActive : ''}`} onClick={() => setViewMode('pool')}>Round Robin</button>
            <button className={`${s.toggleBtn} ${viewMode === 'playoff' ? s.toggleActive : ''}`} onClick={() => setViewMode('playoff')}>Playoffs</button>
          </div>
        </div>
        <div className={s.controlsRight}>
          <div className={s.controlGroup}>
            <label className={s.controlLabel}>Division:</label>
            <select className={`${s.controlSelect} form-input`} value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
              {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          {viewMode === 'pool' && (
            <div className={s.viewToggle}>
              <button className={`${s.toggleBtn} ${groupMode === 'flat' ? s.toggleActive : ''}`} onClick={() => setGroupMode('flat')}>Flat</button>
              <button className={`${s.toggleBtn} ${groupMode === 'pools' ? s.toggleActive : ''}`} onClick={() => setGroupMode('pools')}>Pools</button>
            </div>
          )}
        </div>
      </div>

      <div className={s.filtersRow}>
        <div className={s.statusFilters}>
          {([
            { key: 'pending'   as ResultsFilter, label: 'TO BE SCORED',    count: pendingCount },
            { key: 'submitted' as ResultsFilter, label: 'PENDING REVIEW',  count: submittedCount },
            { key: 'completed' as ResultsFilter, label: 'COMPLETED',       count: completedCount },
          ]).map(({ key, label, count }) => (
            <button key={key} className={`${s.filterChip} ${selectedStatuses.includes(key) ? s.chipActive : ''}`} onClick={() => setSelectedStatuses(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])}>
              {label} ({count})
            </button>
          ))}
        </div>
        <div className={s.searchWrapper}>
          <Search size={16} className={s.searchIcon} />
          <input type="text" placeholder="Search teams..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={s.searchInput} />
        </div>
      </div>

      {requiresFinalization && (
        <p style={{ fontSize: '0.78rem', color: 'var(--white-30)', margin: '0.5rem 0 1rem', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--warning, #f59e0b)' }}>Pending Review</strong> — score submitted by a field official; visible to the public but not yet final. Use <em>Finalize</em> to mark it complete.
          {' '}<strong style={{ color: 'var(--success, #4ade80)' }}>Completed</strong> — score is final and locked.
        </p>
      )}

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
          body="Scores appear here as officials submit them from the field. Results are live — no refresh needed once a game is scored."
        />
      )}

      {loading ? (
        <div className="empty-state"><RefreshCw size={32} className="spin opacity-40" /><p>Loading games...</p></div>
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
            ageGroups={ageGroups}
            diamonds={diamonds}
            viewMode={viewMode}
            groupByPool={groupMode === 'pools'}
            onScore={openScore}
            onFinalize={finalizeGame}
            onSchedule={markScheduled}
            mode="scoring"
          />
        </div>
      ) : null}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Enter Score</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}><X size={16} /></button>
            </div>
            <div className={styles.scoreInputArea}>
              <div className={styles.scoreTeam}>
                <div className={styles.scoreTeamName}>{getTeamName(editing.homeTeamId) || editing.homePlaceholder}</div>
                <input 
                  className={`form-input ${styles.scoreInput} ${showErrors && scores.home === '' ? 'border-danger' : ''}`} 
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={scores.home} 
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      setScores(s => ({ ...s, home: val }));
                    }
                  }} 
                  autoFocus 
                  style={showErrors && scores.home === '' ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 1px var(--danger)' } : {}}
                />
                <div className={styles.scoreTeamLabel}>Home</div>
              </div>
              <div className={styles.scoreSep}>–</div>
              <div className={styles.scoreTeam}>
                <div className={styles.scoreTeamName}>{getTeamName(editing.awayTeamId) || editing.awayPlaceholder}</div>
                <input 
                  className={`form-input ${styles.scoreInput} ${showErrors && scores.away === '' ? 'border-danger' : ''}`} 
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={scores.away} 
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      setScores(s => ({ ...s, away: val }));
                    }
                  }}
                  style={showErrors && scores.away === '' ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 1px var(--danger)' } : {}}
                />
                <div className={styles.scoreTeamLabel}>Away</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveScore}>
                <Check size={14} /> Save Result
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal 
        {...feedback} 
        onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))} 
      />
    </div>
  );
}
