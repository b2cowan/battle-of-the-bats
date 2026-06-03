'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Calendar, CalendarPlus, CheckCircle, ChevronDown, Clock, Star, Trophy, X } from 'lucide-react';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { Division, Game, Team, Tournament, Venue } from '@/lib/types';
import YearSelector from '@/components/YearSelector';
import LocationLink from '@/components/LocationLink';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import RaceToPlayoffsView from '@/components/public/RaceToPlayoffsView';
import PublicBracketView from '@/components/public/PublicBracketView';
import { formatPoolName, formatTime } from '@/lib/utils';
import styles from '@/app/[orgSlug]/standings/standings.module.css';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import { readFollowedTeamId, clearFollowedTeam, isTournamentInProgress } from '@/lib/follow';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { downloadTeamScheduleICS } from '@/lib/team-calendar';
import FollowAlertsToggle from '@/components/public/FollowAlertsToggle';

type StandingResult = {
  teamId: string;
  teamName: string;
  poolId?: string;
  gp: number;
  w: number;
  l: number;
  t: number;
  rf: number;
  ra: number;
  rd: number;
  pts: number;
  hasPendingGame?: boolean;
};

type StandingRow = StandingResult & { id: string; name: string };

type ViewMode = 'standard' | 'race';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  isPreview?: boolean;
  initialData?: PublicTournamentPageData;
}

function viewModeKey(orgSlug: string, tournamentSlug: string, divisionId: string) {
  return `fl_standings_view_${orgSlug}_${tournamentSlug}_${divisionId}`;
}

function readViewMode(orgSlug: string, tournamentSlug: string, divisionId: string): ViewMode {
  if (typeof window === 'undefined') return 'standard';
  try {
    const raw = window.localStorage.getItem(viewModeKey(orgSlug, tournamentSlug, divisionId));
    if (raw === 'race') return 'race';
    return 'standard';
  } catch {
    return 'standard';
  }
}

function saveViewMode(orgSlug: string, tournamentSlug: string, divisionId: string, mode: ViewMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(viewModeKey(orgSlug, tournamentSlug, divisionId), mode);
  } catch { /* ignore */ }
}

function formatShortDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });
}

/** Column abbreviations explained beneath each standings table. */
const STAT_LEGEND: { abbr: string; label: string }[] = [
  { abbr: 'REC', label: 'Record (W-L-T)' },
  { abbr: 'W',   label: 'Wins' },
  { abbr: 'L',   label: 'Losses' },
  { abbr: 'T',   label: 'Ties' },
  { abbr: 'RF',  label: 'Runs For' },
  { abbr: 'RA',  label: 'Runs Against' },
  { abbr: 'RD',  label: 'Run Differential' },
  { abbr: 'PTS', label: 'Points' },
];

export default function StandingsContent({ orgSlug, tournamentSlug, isPreview = false, initialData }: Props) {
  const [divisions, setDivisions]           = useState<Division[]>(() => initialData?.divisions ?? []);
  const [games, setGames]                   = useState<Game[]>(() => initialData?.games ?? []);
  const [teams, setTeams]                   = useState<Team[]>(() => initialData?.teams ?? []);
  const [venues, setVenues]                 = useState<Venue[]>(() => initialData?.venues ?? []);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>(() => initialData?.tournaments ?? []);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(() => initialData?.tournament ?? null);
  const [contactEmail, setContactEmail] = useState<string | null>(
    () => initialData?.tournament?.contactEmail ?? initialData?.organization?.contactEmail ?? null
  );
  const [requireFinalization, setRequireFinalization] = useState(
    initialData?.organization.requireScoreFinalization ?? initialData?.tournament?.requireScoreFinalization ?? true
  );
  const [activeGroup, setActiveGroup]       = useState<string>(() => {
    const groups = initialData?.divisions ?? [];
    if (groups.length === 0) return '';
    const pref = getDivisionPref(orgSlug);
    const preferred = pref ? groups.find(g => g.name === pref) : null;
    return (preferred ?? groups[0]).id;
  });
  const [followedTeamId, setFollowedTeamId] = useState<string | null>(null);
  const [fanAlertsEnabled, setFanAlertsEnabled] = useState<boolean>(() => initialData?.fanAlertsEnabled ?? false);
  const [viewMode, setViewMode]             = useState<ViewMode>('standard');
  const [standingsByDivision, setStandingsByDivision] = useState<Record<string, StandingResult[]>>(
    () => (initialData?.standingsByDivision as Record<string, StandingResult[]>) ?? {}
  );
  // Transient ▲/▼ markers when a live result changes a team's pool rank.
  const [rankChanges, setRankChanges] = useState<Map<string, 'up' | 'down'>>(() => new Map());
  const prevRanksRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!activeGroup) return;
    const group = divisions.find(g => g.id === activeGroup);
    const groupPools = group?.pools || [];
    const rows = standingsByDivision[activeGroup] ?? [];
    const newRanks = new Map<string, number>();
    if (groupPools.length >= 2) {
      for (const p of groupPools) {
        rows.filter(r => r.poolId === p.id).forEach((r, i) => newRanks.set(r.teamId, i));
      }
    } else {
      rows.forEach((r, i) => newRanks.set(r.teamId, i));
    }
    const changes = new Map<string, 'up' | 'down'>();
    for (const [id, rank] of newRanks) {
      const prev = prevRanksRef.current.get(id);
      if (prev !== undefined && prev !== rank) changes.set(id, rank < prev ? 'up' : 'down');
    }
    prevRanksRef.current = newRanks;
    if (changes.size === 0) return;
    // Transient animation flags driven by incoming live standings — intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRankChanges(changes);
    const timer = window.setTimeout(() => setRankChanges(new Map()), 2400);
    return () => window.clearTimeout(timer);
  }, [standingsByDivision, activeGroup, divisions]);

  useEffect(() => {
    setFollowedTeamId(readFollowedTeamId(orgSlug, tournamentSlug));
  }, [orgSlug, tournamentSlug]);

  // Restore per-division view mode preference after hydration
  useEffect(() => {
    if (!activeGroup) return;
    setViewMode(readViewMode(orgSlug, tournamentSlug, activeGroup));
  }, [orgSlug, tournamentSlug, activeGroup]);

  useEffect(() => {
    if (initialData) return;
    async function init() {
      const data = await fetchPublicTournamentData(orgSlug, tournamentSlug, 'standings');
      const current = data?.tournament ?? null;
      const groups = data?.divisions ?? [];
      setAllTournaments(data?.tournaments ?? []);
      setSelectedTournament(current);
      setContactEmail(current?.contactEmail ?? data?.organization?.contactEmail ?? null);
      setRequireFinalization(data?.organization.requireScoreFinalization ?? current?.requireScoreFinalization ?? true);
      setFanAlertsEnabled(data?.fanAlertsEnabled ?? false);
      setDivisions(groups);
      setGames(data?.games ?? []);
      setTeams(data?.teams ?? []);
      setVenues(data?.venues ?? []);
      setStandingsByDivision((data?.standingsByDivision as Record<string, StandingResult[]>) ?? {});
      if (groups.length > 0) {
        const pref = getDivisionPref(orgSlug);
        const preferred = pref ? groups.find(g => g.name === pref) : null;
        setActiveGroup((preferred ?? groups[0]).id);
      }
    }
    init();
  }, [orgSlug, tournamentSlug, initialData]);

  // ── live refresh (game day only) ─────────────────────────────────────────────
  usePublicTournamentLive({
    orgSlug,
    tournamentSlug,
    section: 'standings',
    enabled: isTournamentInProgress(selectedTournament),
    onData: data => {
      setGames(data.games ?? []);
      setTeams(data.teams ?? []);
      setDivisions(data.divisions ?? []);
      setVenues(data.venues ?? []);
      setStandingsByDivision((data.standingsByDivision as Record<string, StandingResult[]>) ?? {});
    },
  });

  const currentGroup = divisions.find(g => g.id === activeGroup);
  const standings: StandingRow[] = activeGroup
    ? (standingsByDivision[activeGroup] ?? []).map(s => ({ ...s, id: s.teamId, name: s.teamName }))
    : [];
  const pools = currentGroup?.pools || [];
  const teamsQualifying = currentGroup?.playoffConfig?.teamsQualifying ?? 0;
  const showViewToggle = teamsQualifying > 0 && !isPreview;

  const homeHref = `/${orgSlug}/${tournamentSlug}`;
  const scheduleHref = `/${orgSlug}/${tournamentSlug}/schedule`;
  const teamsHref = `/${orgSlug}/${tournamentSlug}/teams`;
  const teamProfileBaseHref = `/${orgSlug}/${tournamentSlug}/teams`;
  const showSchedulePage = Boolean(selectedTournament && isPublicPageEnabled(selectedTournament, 'schedule'));
  const showTeamsPage = Boolean(selectedTournament && isPublicPageEnabled(selectedTournament, 'teams'));
  const isCompletedTournament = selectedTournament?.status === 'completed';
  const teamMap = useMemo(() => new Map(teams.map(team => [team.id, team])), [teams]);
  const getTeamName = (id?: string) => id ? teamMap.get(id)?.name ?? 'TBD' : 'TBD';
  const getVenue = (id?: string) => id ? venues.find(venue => venue.id === id) ?? null : null;
  const activeGames = games.filter(game => game.divisionId === activeGroup && game.status !== 'cancelled');
  const finalGames = activeGames.filter(game =>
    game.status === 'completed' && game.homeScore != null && game.awayScore != null
  );
  const pendingReviewGames = activeGames.filter(game =>
    game.status === 'submitted' && game.homeScore != null && game.awayScore != null
  );
  const unscoredGames = activeGames.filter(game => game.status === 'scheduled');
  const standingsFinal = activeGames.length > 0 && pendingReviewGames.length === 0 && unscoredGames.length === 0;
  const standingsPending = pendingReviewGames.length > 0 || standings.some(team => team.hasPendingGame);
  const recentScores = [...finalGames, ...pendingReviewGames]
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.time || '').localeCompare(a.time || '');
    })
    .slice(0, 8);

  // Bracket logic
  const playoffGames = activeGames.filter(g => g.isPlayoff);
  const hasPlayoffGames = playoffGames.length > 0;
  const unscoredPoolPlayGames = activeGames.filter(g => !g.isPlayoff && g.status === 'scheduled');
  const playoffPhase = hasPlayoffGames && unscoredPoolPlayGames.length === 0;
  const gamesStarted = standings.some(s => s.gp > 0);

  const followedTeam = followedTeamId ? teams.find(team => team.id === followedTeamId) ?? null : null;
  const followedDivision = followedTeam
    ? divisions.find(group => group.id === followedTeam.divisionId) ?? null
    : null;
  const followedDivisionRows = followedTeam?.divisionId
    ? ((standingsByDivision[followedTeam.divisionId] ?? []) as StandingResult[])
    : [];
  const followedStanding = followedTeam
    ? followedDivisionRows.find(row => row.teamId === followedTeam.id) ?? null
    : null;
  const followedRank = followedStanding
    ? followedDivisionRows.findIndex(row => row.teamId === followedTeam?.id) + 1
    : null;
  const followedGames = followedTeam
    ? games
        .filter(game => game.status !== 'cancelled')
        .filter(game => game.homeTeamId === followedTeam.id || game.awayTeamId === followedTeam.id)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return (a.time || '').localeCompare(b.time || '');
        })
    : [];
  const today = new Date().toISOString().split('T')[0];
  const nextFollowedGame = followedGames.find(game => game.status === 'scheduled' && game.date >= today);
  const latestFollowedScore = [...followedGames]
    .filter(game =>
      (game.status === 'completed' || game.status === 'submitted') &&
      game.homeScore != null &&
      game.awayScore != null
    )
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.time || '').localeCompare(a.time || '');
    })[0] ?? null;

  function stopFollowing() {
    clearFollowedTeam(orgSlug, tournamentSlug);
    setFollowedTeamId(null);
  }

  function handleAddToCalendar() {
    if (!followedTeam || !selectedTournament) return;
    void downloadTeamScheduleICS({
      team: followedTeam,
      games,
      teams,
      divisions,
      tournamentName: selectedTournament.name,
      orgSlug,
      tournamentSlug,
    });
  }

  function handleViewMode(mode: ViewMode) {
    setViewMode(mode);
    if (activeGroup) saveViewMode(orgSlug, tournamentSlug, activeGroup, mode);
  }

  function handleDivisionChange(id: string) {
    setActiveGroup(id);
    setDivisionPref(orgSlug, divisions.find(g => g.id === id)?.name ?? '');
    // Load saved view preference for the new division
    setViewMode(readViewMode(orgSlug, tournamentSlug, id));
  }

  function getResultStatusLabel(game: Game) {
    if (game.status === 'submitted' && requireFinalization) return 'Pending Review';
    return 'Final';
  }

  function getWinner(game: Game): 'home' | 'away' | 'tie' | null {
    if (game.homeScore == null || game.awayScore == null) return null;
    if (game.homeScore > game.awayScore) return 'home';
    if (game.awayScore > game.homeScore) return 'away';
    return 'tie';
  }

  function showFollowedDivision() {
    if (!followedDivision) return;
    setActiveGroup(followedDivision.id);
    setDivisionPref(orgSlug, followedDivision.name);
  }

  function getOpponentName(game: Game, team: Team) {
    if (game.homeTeamId === team.id) return getTeamName(game.awayTeamId);
    return getTeamName(game.homeTeamId);
  }

  function renderScoreCard(game: Game) {
    const winner = getWinner(game);
    const isPending = game.status === 'submitted' && requireFinalization;
    return (
      <div key={game.id} className={`${styles.scoreCard} ${isPending ? styles.scoreCardPending : ''}`}>
        <div className={styles.scoreMeta}>
          <span className={isPending ? 'badge badge-warning' : 'badge badge-success'}>
            {getResultStatusLabel(game)}
          </span>
          <span>{formatShortDate(game.date)}</span>
          {game.time && <span>{formatTime(game.time)}</span>}
          {game.isPlayoff && (
            <span className="badge badge-primary">{game.bracketCode || 'Playoff'}</span>
          )}
        </div>

        <div className={styles.scoreMatchup}>
          <div className={`${styles.scoreTeam} ${winner === 'away' ? styles.scoreWinner : ''}`}>
            <span className={styles.scoreTeamName}>{getTeamName(game.awayTeamId)}</span>
            <strong>{game.awayScore}</strong>
          </div>
          <span className={styles.scoreVs}>at</span>
          <div className={`${styles.scoreTeam} ${styles.scoreTeamHome} ${winner === 'home' ? styles.scoreWinner : ''}`}>
            <span className={styles.scoreTeamName}>{getTeamName(game.homeTeamId)}</span>
            <strong>{game.homeScore}</strong>
          </div>
        </div>

        <div className={styles.scoreFooter}>
          {winner === 'tie' ? <span>Tie game</span> : <span>{winner === 'home' ? getTeamName(game.homeTeamId) : getTeamName(game.awayTeamId)} won</span>}
          <LocationLink location={game.location} venue={getVenue(game.venueId)} size="sm" />
        </div>
      </div>
    );
  }

  if (selectedTournament && !isPublicPageEnabled(selectedTournament, 'standings')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<Trophy size={40} />}
              eyebrow="Standings"
              title="Standings unavailable"
              description="The organizer has hidden results and standings for this tournament."
              actions={!isPreview ? [{ href: homeHref, label: 'Tournament Home', variant: 'ghost' as const }] : []}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Bracket section (shared by both views) ─────────────────────────────────
  const bracketSection = hasPlayoffGames ? (
    <div className={styles.bracketSection}>
      <div className={styles.bracketSectionHeader}>
        <Trophy size={16} className={styles.bracketSectionIcon} />
        <span className={styles.bracketSectionTitle}>PLAYOFF BRACKET</span>
      </div>
      <PublicBracketView
        games={activeGames}
        teams={teams}
        requireFinalization={requireFinalization}
      />
    </div>
  ) : null;

  return (
    <div className="page-content">
      <div className="public-page-header">
        <div className="container">
          <span className="eyebrow"><Trophy size={12} /> Results & Standings</span>
          <h1>{isCompletedTournament ? 'Final Results & Standings' : 'Results & Standings'}</h1>
          <p className="text-muted">
            {isCompletedTournament
              ? 'Review the final public record by division.'
              : 'Track final scores, pending score review, and live pool standings.'}
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {!isPreview && (
            <YearSelector
              tournaments={allTournaments}
              orgSlug={orgSlug}
              currentTournamentSlug={tournamentSlug}
              currentPage="standings"
            />
          )}

          {divisions.length > 0 && (
            <div className={styles.standingsControls}>
              <div className={`select-wrapper ${styles.divisionSelect}`}>
                <select
                  className="form-select"
                  value={activeGroup}
                  onChange={e => handleDivisionChange(e.target.value)}
                >
                  {divisions.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="select-icon" />
              </div>

              {showViewToggle && (
                <div className={styles.viewToggle}>
                  <button
                    type="button"
                    className={`${styles.viewToggleBtn} ${viewMode === 'standard' ? styles.viewToggleBtnActive : ''}`}
                    onClick={() => handleViewMode('standard')}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    className={`${styles.viewToggleBtn} ${viewMode === 'race' ? styles.viewToggleBtnActive : ''}`}
                    onClick={() => handleViewMode('race')}
                  >
                    Race to Playoffs
                  </button>
                </div>
              )}
            </div>
          )}

          {activeGroup && (
            <div className={styles.resultsSummaryLine}>
              <span><CheckCircle size={13} /> <strong>{finalGames.length}</strong> final</span>
              <span><Clock size={13} /> <strong>{pendingReviewGames.length}</strong> {requireFinalization ? 'pending' : 'submitted'}</span>
              <span><Calendar size={13} /> <strong>{unscoredGames.length}</strong> remaining</span>
            </div>
          )}

          {divisions.length === 0 && (
            <PublicTournamentState
              icon={<Trophy size={40} />}
              eyebrow="Standings"
              title="Standings coming soon"
              description="No public divisions are available yet. Standings will appear after divisions and scores are published."
              contactEmail={contactEmail}
              actions={!isPreview ? [
                ...(showSchedulePage ? [{ href: scheduleHref, label: 'View Schedule', variant: 'ghost' as const }] : []),
                { href: homeHref, label: 'Tournament Home', variant: 'ghost' as const },
              ] : []}
            />
          )}

          {activeGroup && (
            <div className={styles.standingsStack}>

              {/* ── Race to Playoffs view ──────────────────────────────────── */}
              {viewMode === 'race' && (
                <div className={styles.summarySection}>
                  <RaceToPlayoffsView
                    standings={standings}
                    pools={pools}
                    playoffConfig={currentGroup?.playoffConfig}
                    followedTeamId={followedTeamId}
                    teams={teams}
                    gamesStarted={gamesStarted}
                  />
                </div>
              )}

              {/* ── Standard view ─────────────────────────────────────────── */}
              {viewMode === 'standard' && (
                <>
                  {/* Bracket floats above standings when pool play is done */}
                  {playoffPhase && bracketSection}

                  {/* Follow bar */}
                  {!isPreview && followedTeam && (
                    <div className={styles.followBar}>
                      <div className={styles.followBarLeft}>
                        <div className={styles.followMain}>
                          <Star size={16} fill="currentColor" />
                          <span className={styles.followLabel}>My Team</span>
                          <strong className={styles.followTeamName}>{followedTeam.name}</strong>
                          {followedRank && (
                            <span className={styles.followRankBadge}>{followedRank}{['st','nd','rd'][followedRank - 1] ?? 'th'}</span>
                          )}
                        </div>
                        {followedStanding && (
                          <div className={styles.followRecord}>
                            {followedStanding.w}-{followedStanding.l}-{followedStanding.t}
                            &nbsp;·&nbsp;{followedStanding.pts} pts
                            &nbsp;·&nbsp;RD {followedStanding.rd > 0 ? `+${followedStanding.rd}` : followedStanding.rd}
                          </div>
                        )}
                      </div>
                      <div className={styles.followBarRight}>
                        {followedRank && (
                          <div className={styles.followFinalPos}>
                            <span className={styles.followFinalLabel}>
                              {isCompletedTournament || standingsFinal ? 'Final' : 'Current'}
                            </span>
                            <span className={styles.followFinalRank}>
                              {followedRank}{['st','nd','rd'][followedRank - 1] ?? 'th'}
                            </span>
                          </div>
                        )}
                        <div className={styles.followStats}>
                          {latestFollowedScore ? (
                            <div className={styles.followResult}>
                              <span>{getResultStatusLabel(latestFollowedScore)}</span>
                              <strong>
                                {latestFollowedScore.homeTeamId === followedTeam.id ? latestFollowedScore.homeScore : latestFollowedScore.awayScore}
                                {' - '}
                                {latestFollowedScore.homeTeamId === followedTeam.id ? latestFollowedScore.awayScore : latestFollowedScore.homeScore}
                              </strong>
                              <span>vs {getOpponentName(latestFollowedScore, followedTeam)}</span>
                            </div>
                          ) : nextFollowedGame ? (
                            <div className={styles.followResult}>
                              <span>Next game</span>
                              <strong>{formatShortDate(nextFollowedGame.date)} {formatTime(nextFollowedGame.time)}</strong>
                              <span>vs {getOpponentName(nextFollowedGame, followedTeam)}</span>
                            </div>
                          ) : null}
                        </div>
                        <div className={styles.followActions}>
                          {followedDivision && followedDivision.id !== activeGroup && (
                            <button type="button" className="btn btn-lime btn-sm" onClick={showFollowedDivision}>
                              Show Division
                            </button>
                          )}
                          {showSchedulePage && <Link href={scheduleHref} className="btn btn-ghost btn-sm">Schedule</Link>}
                          {showTeamsPage && <Link href={`${teamProfileBaseHref}/${followedTeam.id}`} className="btn btn-ghost btn-sm">Profile</Link>}
                          {fanAlertsEnabled && selectedTournament && (
                            <FollowAlertsToggle
                              orgSlug={orgSlug}
                              tournamentSlug={tournamentSlug}
                              tournamentId={selectedTournament.id}
                              team={{ id: followedTeam.id, name: followedTeam.name }}
                            />
                          )}
                          <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddToCalendar}>
                            <CalendarPlus size={14} /> Calendar
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={stopFollowing}>
                            <X size={14} /> Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Standings table */}
                  {(pools.length >= 2 ? pools : [{ id: 'default', name: 'All Teams' }]).map(pool => {
                    const poolStandings = pools.length >= 2
                      ? standings.filter(s => s.poolId === pool.id)
                      : standings;

                    if (poolStandings.length === 0) return null;

                    const hasPendingStandings = poolStandings.some(s => s.hasPendingGame);
                    const maxAbsRd = Math.max(1, ...poolStandings.map(s => Math.abs(s.rd)));
                    const tieBreakerOrder = (currentGroup?.playoffConfig?.tieBreakers || ['h2h', 'rd', 'rf', 'ra'])
                      .map(b => b.toUpperCase());

                    return (
                      <div key={pool.id} className={styles.summarySection}>
                        <div className={styles.summaryHeader}>
                          <div className={styles.summaryHeaderMain}>
                            <div className={styles.summaryTitle}>
                              <Trophy size={18} />
                              <h2>
                                Standings{pools.length >= 2 ? ` - ${formatPoolName(pool.name)}` : ''}
                              </h2>
                            </div>
                          </div>
                        </div>

                        <div className={`table-wrap ${styles.tableFrame}`}>
                          <table className={styles.standingsTable}>
                            <thead>
                              <tr>
                                <th className={styles.stickyCol}>Team</th>
                                <th className={`${styles.recordCol} ${styles.mobileOnly}`}>REC</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>W</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>L</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>T</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>RF</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>RA</th>
                                <th className={styles.statCenter}>RD</th>
                                <th className={`${styles.ptsCol} ${styles.statCenter}`}>PTS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {poolStandings.map((team, idx) => {
                                const gStarted = poolStandings.some(s => s.gp > 0);
                                const isFirst  = idx === 0 && gStarted;
                                return (
                                  <tr key={team.id} className={isFirst ? styles.topRow : ''}>
                                    <td className={styles.stickyCol}>
                                      <div className={`${styles.teamCell} ${rankChanges.get(team.id) ? styles.teamCellMoved : ''}`}>
                                        {isFirst && <Trophy size={14} className={styles.topIcon} />}
                                        {rankChanges.get(team.id) && (
                                          <span className={styles.rankArrow} data-dir={rankChanges.get(team.id)} aria-label={rankChanges.get(team.id) === 'up' ? 'Moved up' : 'Moved down'}>
                                            {rankChanges.get(team.id) === 'up' ? '▲' : '▼'}
                                          </span>
                                        )}
                                        <span>{team.name}</span>
                                        {team.hasPendingGame ? <span className={styles.pendingTeamBadge}>Pending</span> : null}
                                      </div>
                                    </td>
                                    <td className={`${styles.recordCol} ${styles.mobileOnly}`}>
                                      <span className={styles.recordPill}>{team.w}-{team.l}-{team.t}</span>
                                    </td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.desktopOnly}`}>{team.w}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.desktopOnly}`}>{team.l}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.desktopOnly}`}>{team.t}</td>
                                    <td className={`${styles.statCenter} ${styles.desktopOnly}`}>{team.rf}</td>
                                    <td className={`${styles.statCenter} ${styles.desktopOnly}`}>{team.ra}</td>
                                    <td className={styles.statCenter}>
                                      <span className={team.rd > 0 ? styles.rdPositive : team.rd < 0 ? styles.rdNegative : ''}>
                                        {team.rd > 0 ? `+${team.rd}` : team.rd}
                                      </span>
                                      <span className={`${styles.rdBar} ${styles.desktopOnly}`} aria-hidden="true">
                                        <span
                                          className={styles.rdBarFill}
                                          data-dir={team.rd >= 0 ? 'pos' : 'neg'}
                                          style={{ width: `${(Math.abs(team.rd) / maxAbsRd) * 50}%` }}
                                        />
                                      </span>
                                    </td>
                                    <td className={`${styles.ptsCol} ${styles.statCenter}`}>
                                      <span className="badge badge-primary">{team.pts}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className={styles.standingsFooter}>
                          <dl className={styles.statLegend}>
                            {STAT_LEGEND.map(item => (
                              <div key={item.abbr} className={styles.statLegendItem}>
                                <dt>{item.abbr}</dt>
                                <dd>{item.label}</dd>
                              </div>
                            ))}
                          </dl>
                          <p className={styles.tieBreakerNote}>
                            <span>Tie-breaker order</span>
                            <strong>{tieBreakerOrder.join(' > ')}</strong>
                          </p>
                          {hasPendingStandings && (
                            <p className={styles.pendingNote}>
                              Pending Review scores are included here for visibility. Standings may change after admin finalization.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Bracket below standings while pool play is ongoing */}
                  {!playoffPhase && bracketSection}
                </>
              )}

              {standings.length === 0 && (
                <PublicTournamentState
                  icon={<Trophy size={40} />}
                  eyebrow="Standings"
                  title="No standings yet"
                  description="This division has teams, but standings will start once scoreable games are posted."
                  contactEmail={contactEmail}
                  actions={!isPreview ? [
                    ...(showSchedulePage ? [{ href: scheduleHref, label: 'View Schedule', variant: 'ghost' as const }] : []),
                    ...(showTeamsPage ? [{ href: teamsHref, label: 'View Teams', variant: 'ghost' as const }] : []),
                    { href: homeHref, label: 'Tournament Home', variant: 'ghost' as const },
                  ] : []}
                  compact
                />
              )}

              {/* Recent scores — always below everything */}
              {viewMode === 'standard' && (
                <div className={styles.scoreSection}>
                  <div className={styles.scoreSectionHeader}>
                    <div>
                      <span className="eyebrow"><CheckCircle size={12} /> Recent Scores</span>
                      <h2>{standingsFinal || isCompletedTournament ? 'Final Score Record' : 'Latest Scores'}</h2>
                      <p>
                        {recentScores.length > 0
                          ? standingsPending
                            ? 'Scores marked Pending Review are visible, but not final until the organizer reviews them.'
                            : 'Final scores for this division are listed from newest to oldest.'
                          : 'Final scores will appear here once games are completed.'}
                      </p>
                    </div>
                    {showSchedulePage && !isPreview && (
                      <Link href={scheduleHref} className="btn btn-outline btn-sm">
                        Full Schedule
                      </Link>
                    )}
                  </div>

                  {recentScores.length === 0 ? (
                    <PublicTournamentState
                      icon={<Trophy size={36} />}
                      eyebrow="Scores"
                      title="No final scores yet"
                      description={
                        unscoredGames.length > 0
                          ? `${unscoredGames.length} game${unscoredGames.length === 1 ? '' : 's'} still need scores.`
                          : 'Final scores will appear here once games are completed.'
                      }
                      compact
                    />
                  ) : (
                    <div className={styles.scoreList}>
                      {recentScores.map(game => renderScoreCard(game))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
