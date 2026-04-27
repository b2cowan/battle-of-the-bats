'use client';
import { useState, useEffect } from 'react';
import { Trophy, Check, X, AlertCircle } from 'lucide-react';
import { getGames, updateGame, getTeams, getAgeGroups } from '@/lib/db';
import { useTournament } from '@/lib/tournament-context';
import { Game, Team, AgeGroup } from '@/lib/types';
import styles from './results-admin.module.css';

export default function AdminResultsPage() {
  const { currentTournament } = useTournament();
  const [games, setGames]       = useState<Game[]>([]);
  const [teams, setTeams]       = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [modal, setModal]       = useState<Game | null>(null);
  const [scores, setScores]     = useState({ home: '', away: '' });
  const [filterGroup, setFilterGroup] = useState('all');

  async function refresh() {
    setGames(await getGames(currentTournament?.id));
    const allTeams = await getTeams(currentTournament?.id);
    setTeams(allTeams.filter(t => t.status === 'accepted'));
    setAgeGroups(await getAgeGroups());
  }
  useEffect(() => { refresh(); }, [currentTournament?.id]);

  const getTeamName  = (id: string) => teams.find(t => t.id === id)?.name ?? 'TBD';
  const getGroupName = (id: string) => ageGroups.find(g => g.id === id)?.name ?? '—';

  function openScoreModal(g: Game) {
    setScores({ home: g.homeScore !== undefined ? String(g.homeScore) : '', away: g.awayScore !== undefined ? String(g.awayScore) : '' });
    setModal(g);
  }

  async function handleSave() {
    if (!modal) return;
    await updateGame(modal.id, { homeScore: Number(scores.home), awayScore: Number(scores.away), status: 'completed' });
    setModal(null);
    refresh();
  }

  async function markCancelled(id: string) { await updateGame(id, { status: 'cancelled' }); refresh(); }
  async function markScheduled(id: string) { await updateGame(id, { status: 'scheduled', homeScore: undefined, awayScore: undefined }); refresh(); }

  const allGames = filterGroup === 'all' ? games : games.filter(g => g.ageGroupId === filterGroup);

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  function statusBadge(status: string) {
    if (status === 'completed') return <span className="badge badge-success">Final</span>;
    if (status === 'cancelled') return <span className="badge badge-danger">Cancelled</span>;
    return <span className="badge badge-warning">Scheduled</span>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Trophy size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Results</h1>
            <p className={styles.pageSub}>
              {currentTournament
                ? <>Scores for <strong style={{ color: 'var(--purple-light)' }}>{currentTournament.name}</strong></>
                : 'Enter scores and manage game outcomes'}
            </p>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab-btn ${filterGroup === 'all' ? 'active' : ''}`} onClick={() => setFilterGroup('all')}>All</button>
        {ageGroups.map(g => (
          <button key={g.id} className={`tab-btn ${filterGroup === g.id ? 'active' : ''}`} onClick={() => setFilterGroup(g.id)}>{g.name}</button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Division</th><th>Home</th><th>Score</th><th>Away</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {allGames.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>
                {currentTournament ? 'No games found.' : 'No tournament selected.'}
              </td></tr>
            ) : allGames.map(g => (
              <tr key={g.id}>
                <td>{formatDate(g.date)}</td>
                <td><span className="badge badge-purple">{getGroupName(g.ageGroupId)}</span></td>
                <td>{getTeamName(g.homeTeamId)}</td>
                <td>
                  {g.status === 'completed'
                    ? <strong style={{ color: 'var(--purple-light)', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{g.homeScore} – {g.awayScore}</strong>
                    : '—'}
                </td>
                <td>{getTeamName(g.awayTeamId)}</td>
                <td>{statusBadge(g.status)}</td>
                <td>
                  <div className="flex gap-1">
                    {g.status !== 'completed' && (
                      <button className="btn btn-primary btn-sm" onClick={() => openScoreModal(g)} id={`enter-score-${g.id}`}>
                        <Trophy size={12} /> Score
                      </button>
                    )}
                    {g.status === 'completed' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => openScoreModal(g)}>Edit</button>
                    )}
                    {g.status === 'scheduled' && (
                      <button className="btn btn-danger btn-sm" onClick={() => markCancelled(g.id)}><X size={12} /></button>
                    )}
                    {(g.status === 'cancelled' || g.status === 'completed') && (
                      <button className="btn btn-ghost btn-sm" onClick={() => markScheduled(g.id)} title="Revert to Scheduled">
                        <AlertCircle size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Enter Score</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className={styles.scoreInputArea}>
              <div className={styles.scoreTeam}>
                <div className={styles.scoreTeamName}>{getTeamName(modal.homeTeamId)}</div>
                <input className={`form-input ${styles.scoreInput}`} type="number" min="0" placeholder="0"
                  value={scores.home} onChange={e => setScores(s => ({ ...s, home: e.target.value }))} id="score-home" autoFocus />
                <div className={styles.scoreTeamLabel}>Home</div>
              </div>
              <div className={styles.scoreSep}>–</div>
              <div className={styles.scoreTeam}>
                <div className={styles.scoreTeamName}>{getTeamName(modal.awayTeamId)}</div>
                <input className={`form-input ${styles.scoreInput}`} type="number" min="0" placeholder="0"
                  value={scores.away} onChange={e => setScores(s => ({ ...s, away: e.target.value }))} id="score-away" />
                <div className={styles.scoreTeamLabel}>Away</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={scores.home === '' || scores.away === ''} id="save-score-btn">
                <Check size={14} /> Save Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
