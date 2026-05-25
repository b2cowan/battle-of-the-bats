'use client';
import { useState, useEffect } from 'react';
import { Calendar, Clock, Trophy, List, LayoutTemplate } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Game, Team, Division, Venue, Tournament } from '@/lib/types';
import LocationLink from '@/components/LocationLink';
import { formatTime, formatPoolName } from '@/lib/utils';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isPublicPageEnabled } from '@/lib/public-pages';
import YearSelector from '@/components/YearSelector';
import styles from '../../schedule/schedule.module.css';
import { LogicSyncBracket } from '@/components/bracket/LogicSyncBracket';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import { downloadICS, buildFilename, type ICSEventInput } from '@/lib/export';

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
  const params         = useParams();
  const orgSlug        = params.orgSlug as string;
  const tournamentSlug = params.tournamentSlug as string;

  const [games, setGames]           = useState<Game[]>([]);
  const [teams, setTeams]           = useState<Team[]>([]);
  const [divisions, setDivisions]   = useState<Division[]>([]);
  const [venues, setVenues]         = useState<Venue[]>([]);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeGroup, setActiveGroup]     = useState<string>('');
  const [viewMode, setViewMode]           = useState<'pool' | 'playoff'>('pool');
  const [bracketLayout, setBracketLayout] = useState<'list' | 'bracket'>('list');
  const [loading, setLoading]             = useState(true);
  const [requireFinalization, setRequireFinalization] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  useEffect(() => {
    async function init() {
      setLoading(true);
      const data = await fetchPublicTournamentData(orgSlug, tournamentSlug, 'schedule');
      const current = data?.tournament ?? null;
      const groups = data?.divisions ?? [];

      setRequireFinalization(data?.organization.requireScoreFinalization ?? current?.requireScoreFinalization ?? true);
      setAllTournaments(data?.tournaments ?? []);
      setSelectedTournament(current);
      setGames(data?.games ?? []);
      setTeams(data?.teams ?? []);
      setVenues(data?.venues ?? []);
      setDivisions(groups);
      if (groups.length > 0) {
        const pref = getDivisionPref(orgSlug);
        const preferred = pref ? groups.find(g => g.name === pref) : null;
        setActiveGroup((preferred ?? groups[0]).id);
      }
      setLoading(false);
    }
    init();
  }, [orgSlug, tournamentSlug]);

  // ── helper fns ─────────────────────────────────────────────────────────────

  const getTeamDisplay = (game: Game, isHome: boolean) => {
    const id = isHome ? game.homeTeamId : game.awayTeamId;
    const ph = isHome ? game.homePlaceholder : game.awayPlaceholder;
    const vis = divisions.find(g => g.id === game.divisionId)?.scheduleVisibility ?? 'unpublished';
    if (vis !== 'published_generic' && id && id !== NIL_UUID) {
      return teams.find(t => t.id === id)?.name ?? ph ?? 'TBD';
    }
    return ph ?? 'TBD';
  };

  const getVenue = (id?: string) => id ? venues.find(d => d.id === id) ?? null : null;

  function getWinner(game: Game): 'home' | 'away' | 'tie' | null {
    if (game.homeScore == null || game.awayScore == null) return null;
    if (game.homeScore > game.awayScore) return 'home';
    if (game.awayScore > game.homeScore) return 'away';
    return 'tie';
  }

  // ── derived data ───────────────────────────────────────────────────────────

  const bracketGames = games.filter(g =>
    g.divisionId === activeGroup &&
    g.status !== 'cancelled' &&
    !!g.isPlayoff
  );

  const filtered = games
    .filter(g =>
      g.divisionId === activeGroup &&
      (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)
    )
    .sort((a, b) => {
      if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
      const pd = bracketPriority(a.bracketCode) - bracketPriority(b.bracketCode);
      if (pd !== 0) return pd;
      return (a.time || '').localeCompare(b.time || '');
    });

  const teamFiltered = selectedTeamId
    ? filtered.filter(g => g.homeTeamId === selectedTeamId || g.awayTeamId === selectedTeamId)
    : filtered;

  // ── iCal export ───────────────────────────────────────────────────────────────

  async function handleExportICS() {
    if (!teamFiltered.length) return;
    const activeGroupName = activeG?.name ?? 'schedule';
    const selectedTeam    = selectedTeamId ? teams.find(t => t.id === selectedTeamId) : undefined;
    const scope           = selectedTeam
      ? `${activeGroupName}-${selectedTeam.name}`
      : activeGroupName;
    const scheduleUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/${orgSlug}/${tournamentSlug}/schedule`
      : undefined;

    const events: ICSEventInput[] = teamFiltered
      .filter(g => !!g.date)
      .map(g => ({
        gameId:   g.id,
        title:    `${getTeamDisplay(g, true)} vs ${getTeamDisplay(g, false)}${activeG ? ` — ${activeG.name}` : ''}`,
        date:     g.date,
        time:     g.time ?? undefined,
        location: g.location ?? getVenue(g.venueId)?.name ?? undefined,
        url:      scheduleUrl,
        cancelled: g.status === 'cancelled',
      }));

    await downloadICS(
      buildFilename({ tournament: tournamentSlug, dataset: 'schedule', scope }, 'ics'),
      events,
    );
  }

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

  const activeG = divisions.find(g => g.id === activeGroup);
  const pools   = activeG?.pools || [];
  const activeVisibility = activeG?.scheduleVisibility ?? 'unpublished';
  const allUnpublished = divisions.length > 0 && divisions.every(g => (g.scheduleVisibility ?? 'unpublished') === 'unpublished');

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

  const divisionTeamIds = new Set(
    games
      .filter(g => g.divisionId === activeGroup)
      .flatMap(g => [g.homeTeamId, g.awayTeamId])
      .filter((id): id is string => !!id && id !== NIL_UUID)
  );
  const divisionTeams = teams
    .filter(t => divisionTeamIds.has(t.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const PoolHeader = ({ name }: { name: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to right, transparent, var(--primary))' }} />
      <h2 className="display-sm" style={{ color: 'var(--primary-light)' }}>{name}</h2>
      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to left, transparent, var(--primary))' }} />
    </div>
  );

  function renderGameCard(game: Game, extraClass: string, typeLabel: React.ReactNode) {
    const hasScore = (game.status === 'completed' || game.status === 'submitted') &&
      game.homeScore != null && game.awayScore != null;
    const winner = getWinner(game);

    const homeClass = winner === 'home' ? styles.winTeam : winner === 'away' ? styles.loseTeam : '';
    const awayClass = winner === 'away' ? styles.winTeam : winner === 'home' ? styles.loseTeam : '';

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
          <LocationLink location={game.location} venue={getVenue(game.venueId)} size="sm" />
        </div>

        {game.notes && <p className={styles.gameNotes}>{game.notes}</p>}
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  if (!loading && selectedTournament && !isPublicPageEnabled(selectedTournament, 'schedule')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <div className="empty-state">
              <Calendar size={48} />
              <p>Schedule is not available for this tournament.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><Calendar size={12} /> Schedule</span>
          <h1 className="display-lg">Tournament Schedule</h1>
          <p className="text-muted">View games by division. All times are local.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <YearSelector
            tournaments={allTournaments}
            orgSlug={orgSlug}
            currentTournamentSlug={tournamentSlug}
            currentPage="schedule"
          />

          {allUnpublished ? (
            <div className="empty-state" style={{ padding: '4rem 0' }}>
              <Calendar size={48} style={{ opacity: 0.3 }} />
              <p>The schedule for this tournament hasn&apos;t been published yet. Check back soon!</p>
            </div>
          ) : (
          <>

          {/* ── division tab bar ── */}
          <div className="tabs flex-between" style={{ padding: '0.375rem 0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {divisions.map(g => (
                <button key={g.id}
                  className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                  onClick={() => { setActiveGroup(g.id); setSelectedTeamId(''); setDivisionPref(orgSlug, g.name); }}
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
            {activeVisibility === 'published_generic' || activeVisibility === 'unpublished' ? (
              <div />
            ) : (
            <div className={styles.teamFilter}>
              <select
                className="form-select form-select-sm"
                value={selectedTeamId}
                onChange={e => setSelectedTeamId(e.target.value)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', minWidth: '160px' }}
              >
                <option value="">All Teams</option>
                {divisionTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedTeamId && (
                <button className={styles.clearFilter} onClick={() => setSelectedTeamId('')}>×</button>
              )}
            </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {viewMode === 'playoff' && (
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
              )}
              {teamFiltered.length > 0 && activeVisibility !== 'unpublished' && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.3rem 0.75rem' }}
                  onClick={handleExportICS}
                >
                  📅 {selectedTeamId
                    ? `${teams.find(t => t.id === selectedTeamId)?.name ?? ''} Schedule`
                    : 'Add to Calendar'}
                </button>
              )}
            </div>
          </div>

          {/* Team filter active label */}
          {selectedTeamId && (
            <p className={styles.filterLabel}>
              Showing games for: <strong>{teams.find(t => t.id === selectedTeamId)?.name}</strong>
            </p>
          )}

          {/* ── main content ── */}
          {activeVisibility === 'unpublished' ? (
            <div className="empty-state" style={{ padding: '3rem 0' }}>
              <Calendar size={48} style={{ opacity: 0.3 }} />
              <p>The schedule for this division hasn&apos;t been published yet. Check back soon!</p>
            </div>
          ) : loading ? (
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
                  const bare = pool.name.replace(/^Pool\s+/i, '').trim();
                  const tag  = `Pool ${bare}`;
                  const poolTeamIds = teams.filter(t => t.poolId === pool.id).map(t => t.id);
                  const poolGames = teamFiltered.filter(g =>
                    g.homePlaceholder?.includes(tag) || g.awayPlaceholder?.includes(tag) ||
                    poolTeamIds.includes(g.homeTeamId) || poolTeamIds.includes(g.awayTeamId)
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
          </>
          )}
        </div>
      </div>
    </div>
  );
}
