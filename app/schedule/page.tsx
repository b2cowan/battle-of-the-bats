'use client';
import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Trophy, List, LayoutTemplate } from 'lucide-react';
import { getGames, getTeams, getAgeGroups, getDiamonds, getTournaments } from '@/lib/db';
import { Game, Team, AgeGroup, Diamond, Tournament } from '@/lib/types';
import LocationLink from '@/components/LocationLink';
import { formatTime, formatPoolName } from '@/lib/utils';
import YearSelector from '@/components/YearSelector';
import styles from './schedule.module.css';

// ── bracket helpers ───────────────────────────────────────────────────────────

function bracketPriority(code?: string) {
  if (!code) return 99;
  if (/^QF/i.test(code)) return 1;
  if (/^SF/i.test(code)) return 2;
  if (/^(FIN|IF|3RD)$/i.test(code)) return 3;
  return 4;
}

function buildBracketColumns(games: Game[]) {
  const standardRounds = [
    { title: 'Quarterfinals', pattern: /^QF/i },
    { title: 'Semifinals',    pattern: /^SF/i },
    { title: 'Finals',        pattern: /^(FIN|IF|3RD)$/i },
  ];
  const columns = standardRounds.map(r => ({
    ...r,
    games: games
      .filter(g => r.pattern.test(g.bracketCode || ''))
      .sort((a, b) => {
        if (/^FIN/i.test(a.bracketCode || '') && /^3RD/i.test(b.bracketCode || '')) return -1;
        if (/^3RD/i.test(a.bracketCode || '') && /^FIN/i.test(b.bracketCode || '')) return 1;
        return (a.bracketCode || '').localeCompare(b.bracketCode || '');
      }),
  })).filter(c => c.games.length > 0);

  const matchedIds = new Set(columns.flatMap(c => c.games.map(g => g.id)));
  const custom = games.filter(g => !matchedIds.has(g.id));
  if (custom.length > 0) {
    const byCode: Record<string, Game[]> = {};
    custom.forEach(g => {
      const key = g.bracketCode || 'EXTRA';
      if (!byCode[key]) byCode[key] = [];
      byCode[key].push(g);
    });
    Object.entries(byCode).forEach(([code, cGames]) => {
      columns.push({ title: code, pattern: new RegExp(`^${code}$`, 'i'), games: cGames });
    });
  }
  return columns;
}

interface BracketColumnsProps {
  columns: ReturnType<typeof buildBracketColumns>;
  getTeamDisplay: (game: Game, isHome: boolean) => string;
  formatDateShort: (d: string) => string;
}

function PublicBracketColumns({ columns, getTeamDisplay, formatDateShort }: BracketColumnsProps) {
  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '0.5rem 0', minHeight: '240px', minWidth: 'max-content', margin: '0 auto' }}>
      {columns.map((col, idx) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', width: '200px', flexShrink: 0 }}>
          <div style={{
            textAlign: 'center',
            color: 'var(--primary-light)',
            fontFamily: 'var(--font-display)',
            fontSize: '0.75rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: '1.25rem',
            opacity: 0.7,
          }}>{col.title}</div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: col.title === 'Finals' ? 'center' : 'space-around',
            flex: 1,
            gap: col.title === 'Finals' ? '2rem' : '1.25rem',
          }}>
            {col.games.map((g, gi) => (
              <div key={g.id} style={{ position: 'relative' }}>
                {idx < columns.length - 1 && (
                  <div style={{
                    position: 'absolute', right: '-2rem', top: '50%',
                    width: '2rem', height: '1px',
                    background: 'var(--primary)', opacity: 0.15, zIndex: 0,
                  }} />
                )}
                <div className="card" style={{
                  padding: '0.65rem',
                  border: '1px solid var(--white-10)',
                  background: 'rgba(15,15,20,0.98)',
                  backdropFilter: 'blur(20px)',
                  position: 'relative', zIndex: 1,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                  borderRadius: '10px',
                }}>
                  {/* code badge */}
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '0.55rem', fontWeight: 900, color: 'var(--primary-light)',
                      background: 'rgba(var(--primary-rgb),0.1)', padding: '2px 7px',
                      borderRadius: '4px', border: '1px solid rgba(var(--primary-rgb),0.2)',
                      letterSpacing: '0.02em',
                    }}>{g.bracketCode || '—'}</span>
                  </div>

                  {/* teams */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '0.6rem' }}>
                    {[false, true].map(isHome => (
                      <div key={String(isHome)} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{
                          width: '26px', fontSize: '0.5rem', fontWeight: 900, color: 'var(--primary-light)',
                          textAlign: 'center', background: 'rgba(var(--primary-rgb),0.1)', padding: '1px 0',
                          borderRadius: '3px', border: '1px solid rgba(var(--primary-rgb),0.2)',
                          flexShrink: 0,
                        }}>{isHome ? 'HOM' : 'VIS'}</div>
                        <div style={{
                          fontWeight: 700, fontSize: '0.8rem', color: '#fff',
                          flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{getTeamDisplay(g, isHome)}</div>
                      </div>
                    ))}
                  </div>

                  {/* meta */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem',
                    paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)',
                    fontSize: '0.65rem', color: 'var(--white-40)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={9} style={{ color: 'var(--primary-light)', opacity: 0.5 }} />
                      {g.date ? formatDateShort(g.date) : 'TBD'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      <Clock size={9} style={{ color: 'var(--primary-light)', opacity: 0.5 }} />
                      {g.time ? formatTime(g.time) : 'TBD'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', gridColumn: 'span 2' }}>
                      <MapPin size={9} style={{ color: 'var(--primary-light)', opacity: 0.5 }} />
                      {g.location || 'TBD'}
                    </div>
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

// ── page component ────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [games, setGames]         = useState<Game[]>([]);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [diamonds, setDiamonds]   = useState<Diamond[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeGroup, setActiveGroup]   = useState<string>('');
  const [viewMode, setViewMode]         = useState<'pool' | 'playoff'>('pool');
  const [bracketLayout, setBracketLayout] = useState<'list' | 'bracket'>('list');
  const [loading, setLoading]           = useState(true);

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
      setLoading(true);
      setGames(await getGames(selectedTournament!.id));
      setTeams(await getTeams(selectedTournament!.id));
      setDiamonds(await getDiamonds(selectedTournament!.id));
      const groups = await getAgeGroups(selectedTournament!.id);
      setAgeGroups(groups);
      if (!activeGroup && groups.length > 0) setActiveGroup(groups[0].id);
      setLoading(false);
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

  const getDiamond = (id?: string) => id ? diamonds.find(d => d.id === id) ?? null : null;

  const filtered = games
    .filter(g =>
      g.ageGroupId === activeGroup &&
      g.status === 'scheduled' &&
      (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)
    )
    .sort((a, b) => {
      if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
      const pd = bracketPriority(a.bracketCode) - bracketPriority(b.bracketCode);
      if (pd !== 0) return pd;
      return (a.time || '').localeCompare(b.time || '');
    });

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }
  function formatDateShort(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  const byDate: Record<string, Game[]> = {};
  filtered.forEach(g => {
    if (!byDate[g.date]) byDate[g.date] = [];
    byDate[g.date].push(g);
  });
  const sortedDates = Object.keys(byDate).sort();

  const today = new Date().toISOString().split('T')[0];

  // ── pool inference (for split playoff view) ───────────────────────────────
  const activeG = ageGroups.find(g => g.id === activeGroup);
  const pools   = activeG?.pools || [];

  function inferPool(game: Game, allGames: Game[]): string | null {
    for (const pool of pools) {
      const bare = pool.name.replace(/^Pool\s+/i, '').trim();
      const tag  = `Pool ${bare}`;
      if (game.homePlaceholder?.includes(tag) || game.awayPlaceholder?.includes(tag)) return pool.name;
    }
    const ph = game.homePlaceholder || game.awayPlaceholder || '';
    const winnerCode = ph.match(/Winner (\w+)/)?.[1];
    if (winnerCode) {
      const source = allGames.find(g =>
        g.bracketCode === winnerCode && g.isPlayoff && g.id !== game.id &&
        (game.bracketId ? g.bracketId === game.bracketId : true)
      );
      if (source) return inferPool(source, allGames);
    }
    if (game.bracketId) {
      for (const sibling of allGames) {
        if (sibling.id === game.id || sibling.bracketId !== game.bracketId || !sibling.isPlayoff) continue;
        for (const pool of pools) {
          const bare = pool.name.replace(/^Pool\s+/i, '').trim();
          if (sibling.homePlaceholder?.includes(`Pool ${bare}`) || sibling.awayPlaceholder?.includes(`Pool ${bare}`)) return pool.name;
        }
      }
    }
    return null;
  }

  const hasPoolPlaceholders = pools.length >= 2 && filtered.some(g =>
    pools.some(p => {
      const bare = p.name.replace(/^Pool\s+/i, '').trim();
      const tag  = `Pool ${bare}`;
      return g.homePlaceholder?.includes(tag) || g.awayPlaceholder?.includes(tag);
    })
  );

  // ── pool-section header ────────────────────────────────────────────────────
  const PoolHeader = ({ name }: { name: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to right, transparent, var(--primary))' }} />
      <h2 className="display-sm" style={{ color: 'var(--primary-light)' }}>{name}</h2>
      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to left, transparent, var(--primary))' }} />
    </div>
  );

  // ── render ─────────────────────────────────────────────────────────────────
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

          {/* ── tab bar ── */}
          <div className="tabs flex-between" style={{ padding: '0.375rem 0.75rem', marginBottom: viewMode === 'playoff' ? '0.75rem' : '2rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {ageGroups.map(g => (
                <button key={g.id}
                  className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                  onClick={() => setActiveGroup(g.id)}
                  style={{ marginBottom: 0 }}
                  id={`schedule-tab-${g.name}`}>{g.name}</button>
              ))}
            </div>
            <div className="segmented-control" style={{ border: 'none', background: 'var(--white-10)', padding: '0.15rem' }}>
              <button className={`segment ${viewMode === 'pool' ? 'active' : ''}`} onClick={() => setViewMode('pool')} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>Pool Play</button>
              <button className={`segment ${viewMode === 'playoff' ? 'active' : ''}`} onClick={() => setViewMode('playoff')} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>Playoffs</button>
            </div>
          </div>

          {/* ── list / bracket toggle (playoffs only) ── */}
          {viewMode === 'playoff' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', padding: '0 0.75rem' }}>
              <div className="segmented-control" style={{ border: 'none', background: 'var(--white-10)', padding: '0.15rem' }}>
                <button
                  className={`segment ${bracketLayout === 'list' ? 'active' : ''}`}
                  onClick={() => setBracketLayout('list')}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <List size={12} /> List
                </button>
                <button
                  className={`segment ${bracketLayout === 'bracket' ? 'active' : ''}`}
                  onClick={() => setBracketLayout('bracket')}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <LayoutTemplate size={12} /> Bracket
                </button>
              </div>
            </div>
          )}

          {/* ── main content ── */}
          {loading ? (
            <div className={styles.skeletonContainer}>
              <div className={`${styles.skeleton} ${styles.skeletonPulse}`} />
              <div className={`${styles.skeleton} ${styles.skeletonPulse}`} />
              <div className={`${styles.skeleton} ${styles.skeletonPulse}`} />
            </div>
          ) : sortedDates.length === 0 && !(viewMode === 'playoff' && bracketLayout === 'bracket') ? (
            <div className="empty-state">
              <Calendar size={48} />
              <p>No scheduled {viewMode === 'playoff' ? 'playoff ' : ''}games found. Check back soon!</p>
            </div>
          ) : (
            (() => {
              // ── BRACKET VIEW ─────────────────────────────────────────────
              if (viewMode === 'playoff' && bracketLayout === 'bracket') {
                if (filtered.length === 0) {
                  return (
                    <div className="empty-state">
                      <Trophy size={48} />
                      <p>No playoff games scheduled yet. Check back soon!</p>
                    </div>
                  );
                }

                const bracketWrap = {
                  display: 'flex',
                  justifyContent: 'flex-start',
                  overflowX: 'auto' as const,
                  padding: '1.5rem',
                  background: 'radial-gradient(circle at 50% 50%, rgba(var(--primary-rgb),0.04) 0%, transparent 70%)',
                  WebkitOverflowScrolling: 'touch' as const,
                };

                if (hasPoolPlaceholders) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                      {pools.map(pool => {
                        const poolGames = filtered.filter(g => inferPool(g, filtered) === pool.name);
                        if (poolGames.length === 0) return null;
                        return (
                          <div key={pool.id}>
                            <PoolHeader name={`${formatPoolName(pool.name)} Playoffs`} />
                            <div style={bracketWrap}>
                              <PublicBracketColumns
                                columns={buildBracketColumns(poolGames)}
                                getTeamDisplay={getTeamDisplay}
                                formatDateShort={formatDateShort}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // single flat bracket
                return (
                  <div style={bracketWrap}>
                    <PublicBracketColumns
                      columns={buildBracketColumns(filtered)}
                      getTeamDisplay={getTeamDisplay}
                      formatDateShort={formatDateShort}
                    />
                  </div>
                );
              }

              // ── LIST VIEW — pool play split ───────────────────────────────
              if (viewMode === 'pool' && pools.length >= 2) {
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
                      <PoolHeader name={formatPoolName(pool.name)} />
                      {poolSortedDates.map(date => (
                        <div key={date} className={`${styles.dateGroup} ${date === today ? styles.todayGroup : ''}`}>
                          <div className={styles.dateLabel}>
                            <Calendar size={14} />
                            {formatDate(date)}
                            {date === today && <span className={styles.todayBadge}>Today</span>}
                          </div>
                          <div className={styles.gamesList}>
                            {poolDateGroups[date].map(game => (
                              <div key={game.id} className={`card ${styles.gameRow}`}>
                                <div className={styles.gameTime}><Clock size={13} />{formatTime(game.time)}</div>
                                <div className={styles.teams}>
                                  <span className={styles.teamA}>{getTeamDisplay(game, true)}</span>
                                  <span className={styles.vsChip}>VS</span>
                                  <span className={styles.teamB}>{getTeamDisplay(game, false)}</span>
                                </div>
                                <div className={styles.gameMeta}>
                                  <span className="badge badge-primary">{activeG?.name ?? ''}</span>
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

              // ── LIST VIEW — playoff split by pool ─────────────────────────
              if (viewMode === 'playoff' && hasPoolPlaceholders) {
                return (
                  <>
                    {pools.map(pool => {
                      const poolGames = filtered.filter(g => inferPool(g, filtered) === pool.name);
                      if (poolGames.length === 0) return null;
                      const poolDateGroups: Record<string, Game[]> = {};
                      poolGames.forEach(g => {
                        if (!poolDateGroups[g.date]) poolDateGroups[g.date] = [];
                        poolDateGroups[g.date].push(g);
                      });
                      const poolSortedDates = Object.keys(poolDateGroups).sort();
                      return (
                        <div key={pool.id} style={{ marginBottom: '3rem' }}>
                          <PoolHeader name={`${formatPoolName(pool.name)} Playoffs`} />
                          {poolSortedDates.map(date => (
                            <div key={date} className={`${styles.dateGroup} ${date === today ? styles.todayGroup : ''}`}>
                              <div className={styles.dateLabel}>
                                <Calendar size={14} />
                                {formatDate(date)}
                                {date === today && <span className={styles.todayBadge}>Today</span>}
                              </div>
                              <div className={styles.gamesList}>
                                {poolDateGroups[date].map(game => (
                                  <div key={game.id} className={`card ${styles.gameRow} ${styles.playoffRow}`}>
                                    <div className={styles.gameTime}><Clock size={13} />{formatTime(game.time)}</div>
                                    <div className={styles.teams}>
                                      <span className={styles.teamA}>{getTeamDisplay(game, true)}</span>
                                      <span className={styles.vsChip}>VS</span>
                                      <span className={styles.teamB}>{getTeamDisplay(game, false)}</span>
                                    </div>
                                    <div className={styles.gameMeta}>
                                      <span className="badge badge-primary">{game.bracketCode || 'Playoff'}</span>
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
                    })}
                  </>
                );
              }

              // ── LIST VIEW — default / flat ────────────────────────────────
              return sortedDates.map(date => (
                <div key={date} className={`${styles.dateGroup} ${date === today ? styles.todayGroup : ''}`}>
                  <div className={styles.dateLabel}>
                    <Calendar size={14} />
                    {formatDate(date)}
                    {date === today && <span className={styles.todayBadge}>Today</span>}
                  </div>
                  <div className={styles.gamesList}>
                    {byDate[date].map(game => (
                      <div key={game.id} className={`card ${styles.gameRow} ${game.isPlayoff ? styles.playoffRow : ''}`}>
                        <div className={styles.gameTime}><Clock size={13} />{formatTime(game.time)}</div>
                        <div className={styles.teams}>
                          <span className={styles.teamA}>{getTeamDisplay(game, true)}</span>
                          <span className={styles.vsChip}>VS</span>
                          <span className={styles.teamB}>{getTeamDisplay(game, false)}</span>
                        </div>
                        <div className={styles.gameMeta}>
                          <span className="badge badge-primary">
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
