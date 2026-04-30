'use client';
import { useState, useEffect } from 'react';
import { Calendar, Clock, Filter } from 'lucide-react';
import { getGames, getTeams, getAgeGroups, getDiamonds, getTournaments } from '@/lib/db';
import { Game, Team, AgeGroup, Diamond, Tournament } from '@/lib/types';
import LocationLink from '@/components/LocationLink';
import { formatTime } from '@/lib/utils';
import YearSelector from '@/components/YearSelector';
import styles from './schedule.module.css';

export default function SchedulePage() {
  const [games, setGames]         = useState<Game[]>([]);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [diamonds, setDiamonds]   = useState<Diamond[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [viewMode, setViewMode]     = useState<'pool' | 'playoff'>('pool');
  const [groupByPool, setGroupByPool] = useState<boolean>(true);

  useEffect(() => {
    async function init() {
      const ts = await getTournaments();
      setTournaments(ts);
      const active = ts.find(t => t.isActive);
      const tourn = active ?? ts[0] ?? null;
      setSelectedTournament(tourn);

      const groups = await getAgeGroups(tourn?.id);
      setAgeGroups(groups);
      if (groups.length > 0) setActiveGroup(groups[0].id);
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedTournament) return;
    async function fetchGames() {
      setGames(await getGames(selectedTournament!.id));
      setTeams(await getTeams(selectedTournament!.id));
      setDiamonds(await getDiamonds(selectedTournament!.id));
      const groups = await getAgeGroups(selectedTournament!.id);
      setAgeGroups(groups);
      if (!activeGroup && groups.length > 0) setActiveGroup(groups[0].id);
    }
    fetchGames();
  }, [selectedTournament]);

  const getTeamDisplay = (game: Game, isHome: boolean) => {
    const id = isHome ? game.homeTeamId : game.awayTeamId;
    const ph = isHome ? game.homePlaceholder : game.awayPlaceholder;
    if (id && id !== '00000000-0000-0000-0000-000000000000') {
      return teams.find(t => t.id === id)?.name ?? 'TBD';
    }
    return ph || 'TBD';
  };

  const getDiamond  = (id?: string) => id ? diamonds.find(d => d.id === id) ?? null : null;

  const filtered = games.filter(g => 
    g.ageGroupId === activeGroup && 
    g.status === 'scheduled' &&
    (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)
  );

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  const byDate: Record<string, Game[]> = {};
  filtered.forEach(g => {
    if (!byDate[g.date]) byDate[g.date] = [];
    byDate[g.date].push(g);
  });
  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><Calendar size={12} /> Schedule</span>
          <h1 className="display-lg">Tournament Schedule</h1>
          <p className="text-muted">View upcoming games by age group. All times are local.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <YearSelector
            tournaments={tournaments}
            selected={selectedTournament}
            onSelect={t => { setSelectedTournament(t); }}
          />

          <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="tabs" style={{ flex: 1, minWidth: 200 }}>
              {ageGroups.map(g => (
                <button key={g.id}
                  className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                  onClick={() => setActiveGroup(g.id)}
                  id={`schedule-tab-${g.name}`}>{g.name}</button>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="segmented-control">
                <button className={`segment ${viewMode === 'pool' ? 'active' : ''}`} onClick={() => setViewMode('pool')}>Pool Play</button>
                <button className={`segment ${viewMode === 'playoff' ? 'active' : ''}`} onClick={() => setViewMode('playoff')}>Playoffs</button>
              </div>

              {viewMode === 'pool' && (() => {
                const group = ageGroups.find(g => g.id === activeGroup);
                const pools = group?.pools || [];
                if (pools.length < 2) return null;
                return (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', 
                    padding: '0.25rem 1rem', 
                    background: 'var(--surface)', 
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--white-60)'
                  }}>
                    <label htmlFor="pool-toggle" style={{ cursor: 'pointer', userSelect: 'none' }}>Break Out</label>
                    <input 
                      type="checkbox" 
                      id="pool-toggle" 
                      checked={groupByPool} 
                      onChange={e => setGroupByPool(e.target.checked)}
                      style={{ 
                        cursor: 'pointer',
                        accentColor: 'var(--purple-light)',
                        width: '16px',
                        height: '16px'
                      }}
                    />
                  </div>
                );
              })()}
            </div>
          </div>

          {sortedDates.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} />
              <p>No scheduled {viewMode === 'playoff' ? 'playoff ' : ''}games found. Check back soon!</p>
            </div>
          ) : (
            (() => {
              const activeG = ageGroups.find(g => g.id === activeGroup);
              const pools = activeG?.pools || [];

              if (viewMode === 'pool' && groupByPool && pools.length >= 2) {
                return pools.map(pool => {
                  const poolTeams = teams.filter(t => t.poolId === pool.id).map(t => t.id);
                  const poolGames = filtered.filter(g => poolTeams.includes(g.homeTeamId) || poolTeams.includes(g.awayTeamId));
                  
                  if (poolGames.length === 0) return null;

                  const poolDateGroups: Record<string, Game[]> = {};
                  poolGames.forEach(g => {
                    if (!poolDateGroups[g.date]) poolDateGroups[g.date] = [];
                    poolDateGroups[g.date].push(g);
                  });
                  const poolSortedDates = Object.keys(poolDateGroups).sort();

                  return (
                    <div key={pool.id} className={styles.poolSection} style={{ marginBottom: '3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to right, transparent, var(--purple-main))' }}></div>
                        <h2 className="display-sm" style={{ color: 'var(--purple-light)' }}>Pool {pool.name}</h2>
                        <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to left, transparent, var(--purple-main))' }}></div>
                      </div>
                      
                      {poolSortedDates.map(date => (
                        <div key={date} className={styles.dateGroup}>
                          <div className={styles.dateLabel}>
                            <Calendar size={14} />
                            {formatDate(date)}
                          </div>
                          <div className={styles.gamesList}>
                            {poolDateGroups[date].map(game => (
                              <div key={game.id} className={`card ${styles.gameRow}`}>
                                <div className={styles.gameTime}>
                                  <Clock size={13} />
                                  {formatTime(game.time)}
                                </div>
                                <div className={styles.teams}>
                                  <span className={styles.teamA}>{getTeamDisplay(game, true)}</span>
                                  <span className={styles.vsChip}>VS</span>
                                  <span className={styles.teamB}>{getTeamDisplay(game, false)}</span>
                                </div>
                                <div className={styles.gameMeta}>
                                  <span className="badge badge-purple">
                                    {activeG?.name ?? ''}
                                  </span>
                                  <LocationLink location={game.location} diamond={getDiamond(game.diamondId)} size="sm" />
                                </div>
                                {game.notes && <p className={styles.gameNotes}>{game.notes}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              }

              // Default / Playoff View
              return sortedDates.map(date => (
                <div key={date} className={styles.dateGroup}>
                  <div className={styles.dateLabel}>
                    <Calendar size={14} />
                    {formatDate(date)}
                  </div>
                  <div className={styles.gamesList}>
                    {byDate[date].map(game => (
                      <div key={game.id} className={`card ${styles.gameRow} ${game.isPlayoff ? styles.playoffRow : ''}`}>
                        <div className={styles.gameTime}>
                          <Clock size={13} />
                          {formatTime(game.time)}
                        </div>
                        <div className={styles.teams}>
                          <span className={styles.teamA}>{getTeamDisplay(game, true)}</span>
                          <span className={styles.vsChip}>VS</span>
                          <span className={styles.teamB}>{getTeamDisplay(game, false)}</span>
                        </div>
                        <div className={styles.gameMeta}>
                          <span className="badge badge-purple">
                            {game.isPlayoff ? (game.bracketCode || 'Playoff') : (ageGroups.find(g => g.id === game.ageGroupId)?.name ?? '')}
                          </span>
                          <LocationLink location={game.location} diamond={getDiamond(game.diamondId)} size="sm" />
                        </div>
                        {game.notes && <p className={styles.gameNotes}>{game.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      </div>
    </div>
  );
}
