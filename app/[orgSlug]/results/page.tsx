'use client';
import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { useParams } from 'next/navigation';
import { getGames, getTeams, getAgeGroups, getDiamonds, getStandings, getOrganizationBySlug, getTournamentsByOrg } from '@/lib/db';
import { Game, Team, AgeGroup, Diamond, Tournament } from '@/lib/types';
import LocationLink from '@/components/LocationLink';
import YearSelector from '@/components/YearSelector';
import { formatTime, formatPoolName } from '@/lib/utils';
import styles from './results.module.css';

export default function ResultsPage() {
  const params   = useParams();
  const orgSlug  = params.orgSlug as string;
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
      const org = await getOrganizationBySlug(orgSlug);
      const ts  = org ? await getTournamentsByOrg(org.id) : [];
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
  }, [orgSlug]);

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

  const completed = games.filter(g => g.status === 'completed' || g.status === 'submitted');
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
                      <div className="flex-between" style={{ width: '100%' }}>
                        <div className="flex gap-2">
                          <Trophy size={18} style={{ color: 'var(--primary-light)' }} />
                          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                            Standings Summary {pools.length >= 2 ? `— ${formatPoolName(pool.name)}` : ''}
                          </h2>
                        </div>
                        <div className={styles.rulesInfo} title="Tie-Breaker Hierarchy">
                          Tie Breaker: {(currentGroup?.playoffConfig?.tieBreakers || ['h2h', 'rd', 'rf', 'ra']).map(b => b.toUpperCase()).join(' → ')}
                        </div>
                      </div>
                    </div>
                    <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                      <table className={styles.standingsTable}>
                        <thead>
                          <tr>
                            <th className={styles.stickyCol}>Team</th>
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
                          {poolStandings.map((team, idx) => {
                            const gamesStarted = poolStandings.some(s => s.gp > 0);
                            const isFirst = idx === 0 && gamesStarted;

                            return (
                              <tr key={team.id} className={isFirst ? styles.topRow : ''}>
                                <td className={styles.stickyCol}>
                                  <div className={styles.teamCell}>
                                    {isFirst && <Trophy size={14} style={{ color: 'var(--warning)' }} />}
                                    {team.name}{team.hasPendingGame ? ' *' : ''}
                                  </div>
                                </td>
                              <td style={{ textAlign: 'center' }} className={styles.statValue}>{team.w}</td>
                              <td style={{ textAlign: 'center' }} className={styles.statValue}>{team.l}</td>
                              <td style={{ textAlign: 'center' }} className={styles.statValue}>{team.t}</td>
                              <td style={{ textAlign: 'center' }}>{team.rf}</td>
                              <td style={{ textAlign: 'center' }}>{team.ra}</td>
                              <td style={{ textAlign: 'center', color: team.rd > 0 ? 'var(--success)' : team.rd < 0 ? 'var(--danger)' : 'inherit' }}>
                                {team.rd > 0 ? `+${team.rd}` : team.rd}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badge badge-primary">{team.pts}</span>
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                    {poolStandings.some(s => s.hasPendingGame) && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--white-40)', padding: '0.5rem 1rem 0.75rem', margin: 0 }}>
                        * Standings include scores pending admin finalization. Stats may change.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {playoffGames.length > 0 && (() => {
            function inferPool(game: Game, allGames: Game[]): string | null {
              for (const pool of pools) {
                const bare = pool.name.replace(/^Pool\s+/i, '').trim();
                const tag = `Pool ${bare}`;
                if (game.homePlaceholder?.includes(tag) || game.awayPlaceholder?.includes(tag)) return pool.name;
              }
              const ph = game.homePlaceholder || game.awayPlaceholder || '';
              const winnerCode = ph.match(/Winner (\w+)/)?.[1];
              if (winnerCode) {
                const source = allGames.find(g =>
                  g.bracketCode === winnerCode &&
                  g.isPlayoff &&
                  g.id !== game.id &&
                  (game.bracketId ? g.bracketId === game.bracketId : true)
                );
                if (source) return inferPool(source, allGames);
              }
              // BracketId sibling fallback for manually-added rounds with no placeholder
              if (game.bracketId) {
                for (const sibling of allGames) {
                  if (sibling.id === game.id || sibling.bracketId !== game.bracketId || !sibling.isPlayoff) continue;
                  for (const pool of pools) {
                    const bare = pool.name.replace(/^Pool\s+/i, '').trim();
                    const tag = `Pool ${bare}`;
                    if (sibling.homePlaceholder?.includes(tag) || sibling.awayPlaceholder?.includes(tag)) return pool.name;
                  }
                }
              }
              return null;
            }

            const isSplitMode = pools.length >= 2 && playoffGames.some(g =>
              pools.some(p => {
                const bare = p.name.replace(/^Pool\s+/i, '').trim();
                const tag = `Pool ${bare}`;
                return g.homePlaceholder?.includes(tag) || g.awayPlaceholder?.includes(tag);
              })
            );

            if (isSplitMode) {
              return (
                <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {pools.map(pool => {
                    const poolPlayoffGames = playoffGames.filter(g => inferPool(g, playoffGames) === pool.name);
                    if (poolPlayoffGames.length === 0) return null;
                    return (
                      <div key={pool.id} className={styles.summarySection} style={{ margin: 0 }}>
                        <div className={styles.summaryHeader}>
                          <Trophy size={18} style={{ color: 'var(--primary-light)' }} />
                          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatPoolName(pool.name)} Playoff Results</h2>
                        </div>
                        <div className={styles.resultsList} style={{ padding: '1rem' }}>
                          {poolPlayoffGames.map(game => {
                            const winner = getWinner(game);
                            return (
                              <div key={game.id} className={`card ${styles.resultCard}`}>
                                <div className={styles.resultMeta}>
                                  <span className={`badge ${game.status === 'submitted' ? 'badge-warning' : 'badge-success'}`}>
                                    {game.status === 'submitted' ? 'Pending' : 'Final'}
                                  </span>
                                  <span className={styles.resultDate}>{formatDate(game.date)}</span>
                                  {game.time && <span className={styles.resultTime}>{formatTime(game.time)}</span>}
                                  <span className="badge badge-primary">{game.bracketCode || 'Playoff'}</span>
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
                      </div>
                    );
                  })}
                </div>
              );
            }

            return (
              <div className={styles.summarySection} style={{ marginTop: '2rem' }}>
                <div className={styles.summaryHeader}>
                  <Trophy size={18} style={{ color: 'var(--primary-light)' }} />
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Playoff Results</h2>
                </div>
                <div className={styles.resultsList} style={{ padding: '1rem' }}>
                  {playoffGames.map(game => {
                    const winner = getWinner(game);
                    return (
                      <div key={game.id} className={`card ${styles.resultCard}`}>
                        <div className={styles.resultMeta}>
                          <span className="badge badge-success">Final</span>
                          <span className={styles.resultDate}>{formatDate(game.date)}</span>
                          {game.time && <span className={styles.resultTime}>{formatTime(game.time)}</span>}
                          <span className="badge badge-primary">{game.bracketCode || 'Playoff'}</span>
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
              </div>
            );
          })()}

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
                    {pools.map(p => <option key={p.id} value={p.id}>{formatPoolName(p.name)}</option>)}
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
                      <span className={`badge ${game.status === 'submitted' ? 'badge-warning' : 'badge-success'}`}>
                        {game.status === 'submitted' ? 'Pending' : 'Final'}
                      </span>
                      <span className={styles.resultDate}>{formatDate(game.date)}</span>
                      {game.time && <span className={styles.resultTime}>{formatTime(game.time)}</span>}
                      <span className="badge badge-primary">
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
