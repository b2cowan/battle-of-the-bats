'use client';
import React, { useState, useEffect } from 'react';
import { Trophy, X, Check, Search, RefreshCw, Users, Download } from 'lucide-react';
import { getGames, updateGame, getTeams, getAgeGroups, getDiamonds } from '@/lib/db';
import { downloadCSV, formatTime } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { Game, Team, AgeGroup, Diamond } from '@/lib/types';
import GameList from '../schedule/components/GameList';
import s from '../admin-common.module.css';
import styles from '../schedule/schedule-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';

type ResultsFilter = 'pending' | 'submitted' | 'completed';

export default function AdminResultsPage() {
  const { currentTournament } = useTournament();
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

  async function refresh() {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;

    setLoading(true);
    const [allGames, allTeams, groups, allDiamonds] = await Promise.all([
      getGames(tournamentId),
      getTeams(tournamentId),
      getAgeGroups(tournamentId),
      getDiamonds(tournamentId)
    ]);

    setGames(allGames);
    setTeams(allTeams.filter(t => t.status === 'accepted'));
    setAgeGroups(groups);
    if (groups.length > 0 && !filterGroup) {
      setFilterGroup(groups[0].id);
    }
    setDiamonds(allDiamonds);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [currentTournament?.id]);

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

  async function handleSaveScore() {
    if (!editing) return;
    if (scores.home === '' || scores.away === '') {
      setShowErrors(true);
      return;
    }
    await updateGame(editing.id, {
      homeScore: Number(scores.home),
      awayScore: Number(scores.away),
      status: 'completed'
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
        await updateGame(id, { status: 'scheduled', homeScore: null, awayScore: null });
        refresh();
      }
    });
  }

  async function finalizeGame(id: string) {
    await updateGame(id, { status: 'completed' });
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

  function exportToCSV() {
    const headers = ['Date', 'Time', 'Division', 'Home Team', 'Home Score', 'Away Team', 'Away Score', 'Status'];
    const rows = filtered.map(g => [
      g.date,
      formatTime(g.time),
      getGroupName(g.ageGroupId),
      getTeamName(g.homeTeamId),
      g.homeScore !== null && g.homeScore !== undefined ? String(g.homeScore) : '',
      getTeamName(g.awayTeamId),
      g.awayScore !== null && g.awayScore !== undefined ? String(g.awayScore) : '',
      g.status,
    ]);
    const filename = `results-${currentTournament?.year || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
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
          <button className="btn btn-outline btn-sm" onClick={exportToCSV} disabled={filtered.length === 0}>
            <Download size={14} /> Export
          </button>
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

      {loading ? (
        <div className="empty-state"><RefreshCw size={32} className="spin opacity-40" /><p>Loading games...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Trophy size={40} style={{ opacity: 0.2 }} />
          <p>{searchQuery ? 'No games matching search.' : 'No games found.'}</p>
        </div>
      ) : (
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
      )}

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
