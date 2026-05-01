'use client';
import { useState, useEffect } from 'react';
import { Trophy, Filter } from 'lucide-react';
import { getGames, getTeams, getAgeGroups, getDiamonds, getTournaments, getStandings } from '@/lib/db';
import { Game, Team, AgeGroup, Diamond, Tournament } from '@/lib/types';
import LocationLink from '@/components/LocationLink';
import YearSelector from '@/components/YearSelector';
import styles from './results.module.css';

export default function ResultsPage() {
  const [games, setGames]         = useState<Game[]>([]);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [diamonds, setDiamonds]   = useState<Diamond[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [activePool, setActivePool] = useState<string>('all');

  useEffect(() => {
    async function init() {
      const ts = await getTournaments();
      setTournaments(ts);
      const active = ts.find(t => t.isActive);
      const tourn = active ?? ts[0] ?? null;
      setSelectedTournament(tourn);
      
      // Auto-select first age group
      const groups = await getAgeGroups(tourn?.id);
      setAgeGroups(groups);
      if (groups.length > 0) setActiveGroup(groups[0].id);
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedTournament) return;
    async function fetchResults() {
      setGames(await getGames(selectedTournament!.id));
      setTeams(await getTeams(selectedTournament!.id));
      setDiamonds(await getDiamonds(selectedTournament!.id));
      // ageGroups are now fetched in init or when tournament changes
      const groups = await getAgeGroups(selectedTournament!.id);
      setAgeGroups(groups);
      if (!activeGroup && groups.length > 0) setActiveGroup(groups[0].id);
    }
    fetchResults();
  }, [selectedTournament]);

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? 'TBD';
  const getDiamond  = (id?: string): Diamond | null => id ? diamonds.find(d => d.id === id) ?? null : null;

  const completed = games.filter(g => g.status === 'completed');
  const groupResults = completed.filter(g => g.ageGroupId === activeGroup);
  
  // Filtering by pool
  const filtered = activePool === 'all' 
    ? groupResults 
    : groupResults.filter(g => {
        const home = teams.find(t => t.id === g.homeTeamId);
        const away = teams.find(t => t.id === g.awayTeamId);
        return home?.poolId === activePool || away?.poolId === activePool;
      });

  const currentGroup = ageGroups.find(g => g.id === activeGroup);
  const pools = currentGroup?.pools || [];

  const [standings, setStandings]   = useState<any[]>([]);

  useEffect(() => {
    if (!selectedTournament || !activeGroup) return;
    async function fetchStandings() {
      const group = ageGroups.find(g => g.id === activeGroup);
      const results = await getStandings(activeGroup, group?.playoffConfig);
      setStandings(results.map(s => ({
        ...s,
        id: s.teamId,
        name: s.teamName
      })));
    }
    fetchStandings();
  }, [activeGroup, selectedTournament, games]);
  const playoffGames = groupResults.filter(g => g.isPlayoff === true);

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getWinner(game: Game): 'home' | 'away' | 'tie' | null {
    if (game.homeScore == null || game.awayScore == null) return null;
    if (game.homeScore > game.awayScore) return 'home';
    if (game.awayScore > game.homeScore) return 'away';
    return 'tie';
  }

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><Trophy size={12} /> Results</span>
          <h1 className="display-lg">Game Results</h1>
          <p className="text-muted">Completed game scores by age group.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <YearSelector
            tournaments={tournaments}
            selected={selectedTournament}
            onSelect={t => { setSelectedTournament(t); }}
          />

          <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="tabs" style={{ flex: 1, display: 'flex', gap: '8px' }}>
              {ageGroups.map(g => (
                <button key={g.id}
                  className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                  onClick={() => setActiveGroup(g.id)}
                  id={`results-tab-${g.name}`}>{g.name}</button>
              ))}
            </div>
          </div>

          {activeGroup && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {(pools.length >= 2 ? pools : [{ id: 'default', name: 'All Teams' }]).map(pool => {
                const poolStandings = pools.length >= 2 
                  ? standings.filter(s => s.poolId === pool.id)
                  : standings;
                
                if (poolStandings.length === 0) return null;

                return (
                  <div key={pool.id} className={styles.summarySection} style={{ margin: 0 }}>
                    <div className={styles.summaryHeader}>
                      <Trophy size={18} style={{ color: 'var(--purple-light)' }} />
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                        Standings Summary {pools.length >= 2 ? `— ${pool.name}` : ''}
                      </h2>
                    </div>
                    <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                      <table className={styles.standingsTable}>
                        <thead>
                          <tr>
                            <th>Team</th>
                            {pools.length >= 2 && <th>Pool</th>}
                            <th style={{ textAlign: 'center' }}>W</th>
                            <th style={{ textAlign: 'center' }}>L</th>
                            <th style={{ textAlign: 'center' }}>T</th>
                            <th style={{ textAlign: 'center' }}>RF</th>
                            <th style={{ textAlign: 'center' }}>RA</th>
                            <th style={{ textAlign: 'center' }}>RD</th>
                            <th style={{ textAlign: 'center' }}>PTS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poolStandings.map(team => (
                            <tr key={team.id}>
                              <td>
                                <div className={styles.teamCell}>{team.name}</div>
                              </td>
                              {pools.length >= 2 && (
                                <td>
                                  <span className={styles.poolLabel}>
                                    {pools.find(p => p.id === team.poolId)?.name || '—'}
                                  </span>
                                </td>
                              )}
                              <td style={{ textAlign: 'center' }} className={styles.statValue}>{team.w}</td>
                              <td style={{ textAlign: 'center' }} className={styles.statValue}>{team.l}</td>
                              <td style={{ textAlign: 'center' }} className={styles.statValue}>{team.t}</td>
                              <td style={{ textAlign: 'center' }}>{team.rf}</td>
                              <td style={{ textAlign: 'center' }}>{team.ra}</td>
                              <td style={{ textAlign: 'center', color: team.rd > 0 ? 'var(--success)' : team.rd < 0 ? 'var(--danger)' : 'inherit' }}>
                                {team.rd > 0 ? `+${team.rd}` : team.rd}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badge badge-purple">{team.pts}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {playoffGames.length > 0 && (
            <div className={styles.summarySection} style={{ marginTop: '2rem' }}>
              <div className={styles.summaryHeader}>
                <Trophy size={18} style={{ color: 'var(--purple-light)' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Playoff Bracket</h2>
              </div>
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--white-40)' }}>
                Bracket visualization coming soon. View playoff results in the game list below.
              </div>
            </div>
          )}

          <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
            <div className="flex gap-2 mb-2" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Game Results</h3>
              {pools.length > 0 && (
                <div className="flex gap-1" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--white-40)' }}>Filter Pool:</span>
                  <select 
                    className="form-select form-select-sm" 
                    value={activePool} 
                    onChange={e => setActivePool(e.target.value)}
                    style={{ width: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    <option value="all">All Pools</option>
                    {pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <Trophy size={48} />
              <p>No results posted yet.</p>
            </div>
          ) : (
            <div className={styles.resultsList}>
              {filtered.map(game => {
                const winner = getWinner(game);
                return (
                  <div key={game.id} className={`card ${styles.resultCard}`}>
                    <div className={styles.resultMeta}>
                      <span className="badge badge-success">Final</span>
                      <span className={styles.resultDate}>{formatDate(game.date)}</span>
                      <span className="badge badge-purple">
                        {ageGroups.find(g => g.id === game.ageGroupId)?.name}
                      </span>
                      <LocationLink location={game.location} diamond={getDiamond(game.diamondId)} size="sm" />
                    </div>
                    <div className={styles.scoreRow}>
                      <div className={`${styles.teamScore} ${winner === 'home' ? styles.winner : ''}`}>
                        <span className={styles.scoreName}>{getTeamName(game.homeTeamId)}</span>
                        <span className={styles.score}>{game.homeScore ?? '—'}</span>
                        {winner === 'home' && <Trophy size={14} className={styles.winIcon} />}
                      </div>
                      <div className={styles.scoreDash}>—</div>
                      <div className={`${styles.teamScore} ${styles.away} ${winner === 'away' ? styles.winner : ''}`}>
                        {winner === 'away' && <Trophy size={14} className={styles.winIcon} />}
                        <span className={styles.score}>{game.awayScore ?? '—'}</span>
                        <span className={styles.scoreName}>{getTeamName(game.awayTeamId)}</span>
                      </div>
                    </div>
                    {winner === 'tie' && <div className={styles.tieLabel}>TIE GAME</div>}
                  </div>
                );
              })}
            </div>
          )}
            </div>
        </div>
      </div>
    </div>
  );
}
