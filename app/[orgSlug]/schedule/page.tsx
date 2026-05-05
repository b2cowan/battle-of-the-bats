'use client';
import { useState, useEffect } from 'react';
import { Calendar, Clock, Trophy, List, LayoutTemplate } from 'lucide-react';
import { useParams } from 'next/navigation';
import { getGames, getTeams, getAgeGroups, getDiamonds, getOrganizationBySlug, getTournamentsByOrg } from '@/lib/db';
import { Game, Team, AgeGroup, Diamond, Tournament } from '@/lib/types';
import LocationLink from '@/components/LocationLink';
import { formatTime, formatPoolName } from '@/lib/utils';
import { getAgPref, setAgPref } from '@/lib/age-group-cookie';
import YearSelector from '@/components/YearSelector';
import styles from './schedule.module.css';
import { LogicSyncBracket } from '@/components/bracket/LogicSyncBracket';

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

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// ── page component ────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const params   = useParams();
  const orgSlug  = params.orgSlug as string;
  const [games, setGames]         = useState<Game[]>([]);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [diamonds, setDiamonds]   = useState<Diamond[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeGroup, setActiveGroup]     = useState<string>('');
  const [viewMode, setViewMode]           = useState<'pool' | 'playoff'>('pool');
  const [bracketLayout, setBracketLayout] = useState<'list' | 'bracket'>('list');
  const [loading, setLoading]             = useState(true);
  const [requireFinalization, setRequireFinalization] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  useEffect(() => {
    async function init() {
      const org = await getOrganizationBySlug(orgSlug);
      if (org) setRequireFinalization(org.requireScoreFinalization ?? true);
      const ts  = org ? await getTournamentsByOrg(org.id) : [];
      setTournaments(ts);
      const active = ts.find(t => t.isActive);
      const tourn = active ?? ts[0] ?? null;
      setSelectedTournament(tourn);
      const groups = await getAgeGroups(tourn?.id);
      setAgeGroups(groups);
      if (groups.length > 0) {
        const pref = getAgPref(orgSlug);
        const preferred = pref ? groups.find(g => g.name === pref) : null;
        setActiveGroup((preferred ?? groups[0]).id);
      }
    }
    init();
  }, [orgSlug]);

  useEffect(() => {
    if (!selectedTournament) return;
    async function fetchGames() {
      setLoading(true);
      setGames(await getGames(selectedTournament!.id));
      setTeams(await getTeams(selectedTournament!.id));
      setDiamonds(await getDiamonds(selectedTournament!.id));
      const groups = await getAgeGroups(selectedTournament!.id);
      setAgeGroups(groups);
      if (groups.length > 0) {
        const pref = getAgPref(orgSlug);
        const preferred = pref ? groups.find(g => g.name === pref) : null;
        setActiveGroup((preferred ?? groups[0]).id);
      }
      setLoading(false);
    }
    fetchGames();
  }, [selectedTournament]);

  // Reset team filter when switching age groups
  useEffect(() => {
    setSelectedTeamId('');
  }, [activeGroup]);

  // ── helper fns ─────────────────────────────────────────────────────────────

  const getTeamDisplay = (game: Game, isHome: boolean) => {
    const id = isHome ? game.homeTeamId : game.awayTeamId;
    const ph = isHome ? game.homePlaceholder : game.awayPlaceholder;
    if (id && id !== NIL_UUID) {
      return teams.find(t => t.id === id)?.name ?? 'TBD';
    }
    return ph || 'TBD';
  };

  const getDiamond = (id?: string) => id ? diamonds.find(d => d.id === id) ?? null : null;

  function getWinner(game: Game): 'home' | 'away' | 'tie' | null {
    if (game.homeScore == null || game.awayScore == null) return null;
    if (game.homeScore > game.awayScore) return 'home';
    if (game.awayScore > game.homeScore) return 'away';
    return 'tie';
  }

  // ── derived data ───────────────────────────────────────────────────────────

  // bracket view uses all non-cancelled playoff games (scores shown via LogicSyncBracket)
  const bracketGames = games.filter(g =>
    g.ageGroupId === activeGroup &&
    g.status !== 'cancelled' &&
    !!g.isPlayoff
  );

  // all games for the active group + view mode, all statuses
  const filtered = games
    .filter(g =>
      g.ageGroupId === activeGroup &&
      (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)
    )
    .sort((a, b) => {
      if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
      const pd = bracketPriority(a.bracketCode) - bracketPriority(b.bracketCode);
      if (pd !== 0) return pd;
      return (a.time || '').localeCompare(b.time || '');
    });

  // apply team filter (empty string = no filter)
  const teamFiltered = selectedTeamId
    ? filtered.filter(g => g.homeTeamId === selectedTeamId || g.awayTeamId === selectedTeamId)
    : filtered;

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }
  function formatDateShort(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  const byDate: Record<string, Game[]> = {};
  teamFiltered.forEach(g => {
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

  // uses full `filtered` (not teamFiltered) so pool-split layout doesn't collapse when filter active
  const hasPoolPlaceholders = pools.length >= 2 && filtered.some(g =>
    pools.some(p => {
      const bare = p.name.replace(/^Pool\s+/i, '').trim();
      const tag  = `Pool ${bare}`;
      return g.homePlaceholder?.includes(tag) || g.awayPlaceholder?.includes(tag);
    })
  );

  // Teams visible in the active age group (derived from games, excludes TBD placeholders)
  const ageGroupTeamIds = new Set(
    games
      .filter(g => g.ageGroupId === activeGroup)
      .flatMap(g => [g.homeTeamId, g.awayTeamId])
      .filter((id): id is string => !!id && id !== NIL_UUID)
  );
  const ageGroupTeams = teams
    .filter(t => ageGroupTeamIds.has(t.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── pool section header ────────────────────────────────────────────────────
  const PoolHeader = ({ name }: { name: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to right, transparent, var(--primary))' }} />
      <h2 className="display-sm" style={{ color: 'var(--primary-light)' }}>{name}</h2>
      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to left, transparent, var(--primary))' }} />
    </div>
  );

  // ── game card renderer ─────────────────────────────────────────────────────
  // `typeLabel` is the right-side badge (bracketCode for playoffs; null for pool play).
  function renderGameCard(game: Game, extraClass: string, typeLabel: React.ReactNode) {
    const hasScore = (game.status === 'completed' || game.status === 'submitted') &&
      game.homeScore != null && game.awayScore != null;
    const winner = getWinner(game);

    // Per-team class: winner = bright white, loser = dimmed, tie/scheduled = default
    const homeClass = winner === 'home' ? styles.winTeam : winner === 'away' ? styles.loseTeam : '';
    const awayClass = winner === 'away' ? styles.winTeam : winner === 'home' ? styles.loseTeam : '';

    // Status label + CSS class for the inline badge above the score
    const statusLabel =
      game.status === 'completed' ? 'Final'
      : game.status === 'submitted' ? (requireFinalization ? 'Pending' : 'Final')
      : null;
    const statusCls =
      game.status === 'completed' || (game.status === 'submitted' && !requireFinalization)
        ? 'badge-success'
        : 'badge-warning';

    return (
      <div key={game.id} className={`card ${styles.gameRow} ${extraClass}`}>
        <div className={styles.gameTime}><Clock size={13} />{formatTime(game.time)}</div>

        <div className={styles.teams}>
          {hasScore ? (
            <>
              <span className={`${styles.teamA} ${homeClass}`}>
                {winner === 'home' && <Trophy size={12} className={styles.winIcon} />}
                {getTeamDisplay(game, true)}
              </span>
              <div className={styles.scoreChip}>
                <span className={`badge ${statusCls} ${styles.statusBadgeInline}`}>{statusLabel}</span>
                <div className={styles.scoreNumbers}>
                  <span className={winner === 'home' ? styles.scoreWin : ''}>{game.homeScore}</span>
                  <span className={styles.scoreSep}>–</span>
                  <span className={winner === 'away' ? styles.scoreWin : ''}>{game.awayScore}</span>
                </div>
              </div>
              <span className={`${styles.teamB} ${awayClass}`}>
                {getTeamDisplay(game, false)}
                {winner === 'away' && <Trophy size={12} className={styles.winIcon} />}
              </span>
            </>
          ) : (
            <>
              <span className={styles.teamA}>{getTeamDisplay(game, true)}</span>
              {game.status === 'cancelled' ? (
                <span className={`badge ${styles.badgeCancelled}`}>Cancelled</span>
              ) : (
                <span className={styles.vsChip}>VS</span>
              )}
              <span className={styles.teamB}>{getTeamDisplay(game, false)}</span>
            </>
          )}
        </div>

        <div className={styles.gameMeta}>
          {typeLabel}
          <LocationLink location={game.location} diamond={getDiamond(game.diamondId)} size="sm" />
        </div>

        {game.notes && <p className={styles.gameNotes}>{game.notes}</p>}
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><Calendar size={12} /> Schedule</span>
          <h1 className="display-lg">Tournament Schedule</h1>
          <p className="text-muted">View games by age group. All times are local.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <YearSelector
            tournaments={tournaments}
            selected={selectedTournament}
            onSelect={t => { setSelectedTournament(t); }}
          />

          {/* ── age group tab bar ── */}
          <div className="tabs flex-between" style={{ padding: '0.375rem 0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {ageGroups.map(g => (
                <button key={g.id}
                  className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                  onClick={() => { setActiveGroup(g.id); setAgPref(orgSlug, g.name); }}
                  style={{ marginBottom: 0 }}
                  id={`schedule-tab-${g.name}`}>{g.name}</button>
              ))}
            </div>
            <div className="segmented-control" style={{ border: 'none', background: 'var(--white-10)', padding: '0.15rem' }}>
              <button className={`segment ${viewMode === 'pool' ? 'active' : ''}`} onClick={() => setViewMode('pool')} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>Pool Play</button>
              <button className={`segment ${viewMode === 'playoff' ? 'active' : ''}`} onClick={() => setViewMode('playoff')} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>Playoffs</button>
            </div>
          </div>

          {/* ── team filter + list/bracket toggle row ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className={styles.teamFilter}>
              <select
                className="form-select form-select-sm"
                value={selectedTeamId}
                onChange={e => setSelectedTeamId(e.target.value)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', minWidth: '160px' }}
              >
                <option value="">All Teams</option>
                {ageGroupTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedTeamId && (
                <button className={styles.clearFilter} onClick={() => setSelectedTeamId('')}>×</button>
              )}
            </div>

            {viewMode === 'playoff' ? (
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
            ) : <div />}
          </div>

          {/* Team filter active label */}
          {selectedTeamId && (
            <p className={styles.filterLabel}>
              Showing games for: <strong>{teams.find(t => t.id === selectedTeamId)?.name}</strong>
            </p>
          )}

          {/* ── main content ── */}
          {loading ? (
            <div className={styles.skeletonContainer}>
              <div className={`${styles.skeleton} ${styles.skeletonPulse}`} />
              <div className={`${styles.skeleton} ${styles.skeletonPulse}`} />
              <div className={`${styles.skeleton} ${styles.skeletonPulse}`} />
            </div>
          ) : sortedDates.length === 0 && !(viewMode === 'playoff' && bracketLayout === 'bracket') && !(viewMode === 'pool' && pools.length >= 2) && !(viewMode === 'playoff' && hasPoolPlaceholders) ? (
            <div className="empty-state">
              <Calendar size={48} />
              <p>
                {selectedTeamId
                  ? 'No games found for the selected team.'
                  : `No ${viewMode === 'playoff' ? 'playoff ' : ''}games found. Check back soon!`}
              </p>
            </div>
          ) : (
            (() => {
              // ── BRACKET VIEW ─────────────────────────────────────────────
              if (viewMode === 'playoff' && bracketLayout === 'bracket') {
                if (bracketGames.length === 0) {
                  return (
                    <div className="empty-state">
                      <Trophy size={48} />
                      <p>No playoff games scheduled yet. Check back soon!</p>
                    </div>
                  );
                }

                const bracketHasPools = pools.length >= 2 && bracketGames.some(g =>
                  pools.some(p => {
                    const bare = p.name.replace(/^Pool\s+/i, '').trim();
                    return g.homePlaceholder?.includes(`Pool ${bare}`) || g.awayPlaceholder?.includes(`Pool ${bare}`);
                  })
                );

                if (bracketHasPools) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                      {pools.map(pool => {
                        const poolGames = bracketGames.filter(g => inferPool(g, bracketGames) === pool.name);
                        if (poolGames.length === 0) return null;
                        return (
                          <div key={pool.id}>
                            <PoolHeader name={`${formatPoolName(pool.name)} Playoffs`} />
                            <LogicSyncBracket
                              games={poolGames}
                              teams={teams}
                              tournamentId={selectedTournament!.id}
                              highlightTeamId={selectedTeamId || undefined}
                              requireFinalization={requireFinalization}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <LogicSyncBracket
                    games={bracketGames}
                    teams={teams}
                    tournamentId={selectedTournament!.id}
                    highlightTeamId={selectedTeamId || undefined}
                    requireFinalization={requireFinalization}
                  />
                );
              }

              // ── LIST VIEW — pool play split ───────────────────────────────
              if (viewMode === 'pool' && pools.length >= 2) {
                return pools.map(pool => {
                  const poolTeams = teams.filter(t => t.poolId === pool.id).map(t => t.id);
                  const poolGames = teamFiltered.filter(g =>
                    poolTeams.includes(g.homeTeamId) || poolTeams.includes(g.awayTeamId)
                  );
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
                            {poolDateGroups[date].map(game => renderGameCard(game, '', null))}
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
                      const poolGames = teamFiltered.filter(g => inferPool(g, teamFiltered) === pool.name);
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
                                {poolDateGroups[date].map(game => renderGameCard(
                                  game,
                                  styles.playoffRow,
                                  <span className="badge badge-primary">{game.bracketCode || 'Playoff'}</span>
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
                    {byDate[date].map(game => renderGameCard(
                      game,
                      game.isPlayoff ? styles.playoffRow : '',
                      game.isPlayoff
                        ? <span className="badge badge-primary">{game.bracketCode || 'Playoff'}</span>
                        : null
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
