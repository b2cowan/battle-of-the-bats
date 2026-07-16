'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle, ChevronDown, Clock, Star, Trophy } from 'lucide-react';
import CoinTossRecorder from '@/components/admin/CoinTossRecorder';
import { resolveTieBreakers, BREAKER_LABELS } from '@/lib/tie-breakers';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { Division, Game, PublicTeam, Tournament, Venue } from '@/lib/types';
import YearSelector from '@/components/YearSelector';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import { TieredBracket } from '@/components/bracket/TieredBracket';
import { bracketRoundLabel } from '@/lib/playoff-bracket';
import { formatPoolName, formatTime, splitTeamQualifier } from '@/lib/utils';
import styles from '@/app/[orgSlug]/standings/standings.module.css';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import { readFollowedTeamId, isTournamentInProgress } from '@/lib/follow';
import { isGameLive, isGameUpcoming, gameStartMs, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { tournamentToday } from '@/lib/timezone';
import MyTeamCard, { type MyTeamCardStatus } from '@/components/public/MyTeamCard';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';

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
  /** True uncapped run differential (rf - ra). Equals rd when no per-game cap is set. */
  rdRaw?: number;
  pts: number;
  hasPendingGame?: boolean;
  /** Set by getStandings when 'coin' is the deciding breaker and no result is recorded yet. */
  needsCoinToss?: boolean;
  coinTossGroupKey?: string | null;
  /** Active run-diff-per-game cap (null = none). Same value on every row of a division. */
  runDiffCap?: number | null;
};

type StandingRow = StandingResult & { id: string; name: string };

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  isPreview?: boolean;
  initialData?: PublicTournamentPageData;
  /** Admin-only: render the inline coin-toss recorder when a tied group needs one. */
  enableCoinTossAdmin?: boolean;
}

function formatShortDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });
}

/** Column abbreviations explained beneath each standings table. `vis` mirrors the
 *  table column's own responsive visibility so the legend only defines columns the
 *  current breakpoint actually shows (mobile = REC/RD/PTS + RF/RA behind the swipe;
 *  desktop = W/L/T/RF/RA/RD/PTS) — J6-031, R2-3. */
const STAT_LEGEND: { abbr: string; label: string; vis?: 'mobile' | 'desktop' }[] = [
  { abbr: 'REC', label: 'Record (W-L-T)', vis: 'mobile' },
  { abbr: 'W',   label: 'Wins', vis: 'desktop' },
  { abbr: 'L',   label: 'Losses', vis: 'desktop' },
  { abbr: 'T',   label: 'Ties', vis: 'desktop' },
  { abbr: 'RF',  label: 'Runs For' },
  { abbr: 'RA',  label: 'Runs Against' },
  { abbr: 'RD',  label: 'Run Differential' },
  { abbr: 'PTS', label: 'Points' },
];

export default function StandingsContent({ orgSlug, tournamentSlug, isPreview = false, initialData, enableCoinTossAdmin = false }: Props) {
  const [divisions, setDivisions]           = useState<Division[]>(() => initialData?.divisions ?? []);
  const [games, setGames]                   = useState<Game[]>(() => initialData?.games ?? []);
  const [teams, setTeams]                   = useState<PublicTeam[]>(() => initialData?.teams ?? []);
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
  const [standingsByDivision, setStandingsByDivision] = useState<Record<string, StandingResult[]>>(
    () => (initialData?.standingsByDivision as Record<string, StandingResult[]>) ?? {}
  );
  // True once data has been fetched (or immediately when initialData is present) —
  // gates the empty states so they don't flash during the initial client fetch (J6-026).
  const [loaded, setLoaded] = useState(() => !!initialData);
  // Transient ▲/▼ markers when a live result changes a team's pool rank.
  const [rankChanges, setRankChanges] = useState<Map<string, 'up' | 'down'>>(() => new Map());
  // Divisions whose collapsed bracket disclosure has been opened at least once —
  // the bracket mounts on first reveal (see bracketDisclosure) and then stays.
  const [revealedBrackets, setRevealedBrackets] = useState<Set<string>>(() => new Set());
  const prevRanksRef = useRef<Map<string, number>>(new Map());

  // Admin coin-toss: optimistically reorder the (contiguous) tied block by the
  // recorded order and clear the needs-coin-toss flag, so the table updates
  // immediately. The result is also persisted server-side, so future loads agree.
  const applyCoinToss = useCallback((divisionId: string, groupKey: string, orderedTeamIds: string[]) => {
    setStandingsByDivision(prev => {
      const rows = prev[divisionId];
      if (!rows) return prev;
      const rank = new Map(orderedTeamIds.map((id, i) => [id, i] as const));
      const inGroup = (r: StandingResult) => r.coinTossGroupKey === groupKey && rank.has(r.teamId);
      const reordered = rows
        .filter(inGroup)
        .slice()
        .sort((a, b) => rank.get(a.teamId)! - rank.get(b.teamId)!)
        .map(r => ({ ...r, needsCoinToss: false, coinTossGroupKey: null }));
      if (reordered.length === 0) return prev;
      let gi = 0;
      const next = rows.map(r => (inGroup(r) ? reordered[gi++] : r));
      return { ...prev, [divisionId]: next };
    });
  }, []);

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
      setLoaded(true);
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
      setStandingsByDivision((data.standingsByDivision as Record<string, StandingResult[]>) ?? {});
    },
  });

  const currentGroup = divisions.find(g => g.id === activeGroup);
  const standings: StandingRow[] = activeGroup
    ? (standingsByDivision[activeGroup] ?? []).map(s => ({ ...s, id: s.teamId, name: s.teamName }))
    : [];
  const pools = currentGroup?.pools || [];

  const homeHref = `/${orgSlug}/${tournamentSlug}`;
  const scheduleHref = `/${orgSlug}/${tournamentSlug}/schedule`;
  const teamsHref = `/${orgSlug}/${tournamentSlug}/teams`;
  const teamProfileBaseHref = `/${orgSlug}/${tournamentSlug}/teams`;
  const showSchedulePage = Boolean(selectedTournament && isPublicPageEnabled(selectedTournament, 'schedule'));
  const showTeamsPage = Boolean(selectedTournament && isPublicPageEnabled(selectedTournament, 'teams'));
  const isCompletedTournament = selectedTournament?.status === 'completed';
  const teamMap = useMemo(() => new Map(teams.map(team => [team.id, team])), [teams]);
  const getTeamName = (id?: string) => id ? teamMap.get(id)?.name ?? 'TBD' : 'TBD';
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

  const hasPlayoffGames = activeGames.some(g => g.isPlayoff);
  const gamesStarted = standings.some(s => s.gp > 0);

  // Once the knockout stage is underway (or the event is over), the bracket is the
  // headline — surface it above the pool tables. A bracket that only exists as
  // not-yet-played placeholders during pool play stays below the standings, where
  // seeding is still the relevant thing to watch.
  const playoffsUnderway = activeGames.some(
    g => g.isPlayoff && (g.status !== 'scheduled' || isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES)),
  );
  const bracketOnTop = hasPlayoffGames && (isCompletedTournament || playoffsUnderway);

  // "On track to advance" (J6-027): the set of teams currently holding a playoff spot,
  // plus the rule caption. Combined cutoff for crossover/single-pool formats, per-pool
  // otherwise — matching how the bracket actually seeds.
  const playoffCfg = currentGroup?.playoffConfig;
  const teamsQualifying = playoffCfg?.teamsQualifying ?? 0;
  const combinePools = (playoffCfg?.crossover ?? 'none') !== 'none' || pools.length <= 1;
  const advanceCaption = teamsQualifying > 0
    ? (combinePools ? `Top ${teamsQualifying} of ${standings.length} advance` : `Top ${teamsQualifying} per pool advance`)
    : '';
  const advancingTeamIds = (() => {
    const ids = new Set<string>();
    if (teamsQualifying <= 0 || !gamesStarted) return ids;
    // `standings` already arrives in the engine's full tie-breaker order (head-to-head,
    // run-diff cap, coin toss …). Slice that order directly — do NOT re-sort by pts/rd
    // alone, which would mismark the cut when teams are tied on pts+rd but separated by
    // a lower tie-breaker.
    if (combinePools) {
      standings.slice(0, teamsQualifying).forEach(r => ids.add(r.teamId));
    } else {
      pools.forEach(pool =>
        standings.filter(s => s.poolId === pool.id).slice(0, teamsQualifying).forEach(r => ids.add(r.teamId)),
      );
    }
    return ids;
  })();

  const followedTeam = followedTeamId ? teams.find(team => team.id === followedTeamId) ?? null : null;
  // Reserve dock clearance only when the dock can actually render (J6-041 review).
  const dockActive = isTournamentInProgress(selectedTournament) && !!followedTeamId;
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
  // TODO: this live/next/final selection duplicates lib/game-status.ts's selectTeamGames()
  // (added for the cross-tournament Following feed, unified-app Phase 2 Slice 2), which
  // also fixes a gap here — `latestFollowedScore` below only checks completed/submitted,
  // missing forfeited games. Left un-migrated for now (blast radius on this verified page).
  const followedGames = followedTeam
    ? games
        .filter(game => game.status !== 'cancelled')
        .filter(game => game.homeTeamId === followedTeam.id || game.awayTeamId === followedTeam.id)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return (a.time || '').localeCompare(b.time || '');
        })
    : [];
  const today = tournamentToday();
  const liveFollowedGame = followedGames.find(
    game => isGameLive(game, game.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES),
  ) ?? null;
  const nextFollowedGame = followedGames.find(
    game => game.status === 'scheduled' && (gameStartMs(game) == null ? game.date >= today : isGameUpcoming(game)),
  );
  const latestFollowedScore = [...followedGames]
    .filter(game =>
      (game.status === 'completed' || game.status === 'submitted') &&
      game.homeScore != null &&
      game.awayScore != null &&
      !isGameLive(game, game.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES)
    )
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.time || '').localeCompare(a.time || '');
    })[0] ?? null;

  function handleDivisionChange(id: string) {
    setActiveGroup(id);
    setDivisionPref(orgSlug, divisions.find(g => g.id === id)?.name ?? '');
  }

  // ── Followed-team card (shared MyTeamCard) ────────────────────────────────
  // Standings shows rank within DIVISION; the single most-relevant status is
  // live > next > final (last result), matching the Schedule scorebug.
  function ordinalRank(n: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
  }
  // TODO: duplicates lib/utils.ts's relativeDayLabel() — same "Today/Tomorrow/short
  // date" logic, extracted for the Following feed (unified-app Phase 2 Slice 2).
  function myTeamDateLabel(date: string): string {
    if (date === today) return 'Today';
    const tmrw = new Date(today + 'T12:00:00');
    tmrw.setDate(tmrw.getDate() + 1);
    if (date === tmrw.toISOString().slice(0, 10)) return 'Tomorrow';
    return new Date(date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }
  const myTeamContextGame = liveFollowedGame ?? nextFollowedGame ?? null;
  const myTeamOpponentName = (myTeamContextGame && followedTeam)
    ? (() => {
        const isHome = myTeamContextGame.homeTeamId === followedTeam.id;
        const oppId = isHome ? myTeamContextGame.awayTeamId : myTeamContextGame.homeTeamId;
        return teams.find(t => t.id === oppId)?.name
          ?? (isHome ? myTeamContextGame.awayPlaceholder : myTeamContextGame.homePlaceholder)
          ?? null;
      })()
    : null;
  const myTeamScore = (game: Game) => {
    const isHome = followedTeam ? game.homeTeamId === followedTeam.id : false;
    return { my: isHome ? game.homeScore : game.awayScore, opp: isHome ? game.awayScore : game.homeScore };
  };
  let myTeamStatus: MyTeamCardStatus;
  if (liveFollowedGame) {
    const s = myTeamScore(liveFollowedGame);
    myTeamStatus = { kind: 'live', myScore: s.my, oppScore: s.opp };
  } else if (nextFollowedGame) {
    myTeamStatus = {
      kind: 'next',
      dateLabel: nextFollowedGame.date ? myTeamDateLabel(nextFollowedGame.date) : null,
      timeLabel: nextFollowedGame.time ? formatTime(nextFollowedGame.time) : 'TBD',
    };
  } else if (latestFollowedScore) {
    const s = myTeamScore(latestFollowedScore);
    myTeamStatus = { kind: 'final', myScore: s.my ?? 0, oppScore: s.opp ?? 0 };
  } else {
    myTeamStatus = { kind: 'none' };
  }

  function getResultStatusLabel(game: Game) {
    if (game.status === 'submitted' && requireFinalization) return 'Unofficial';
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

  function getOpponentName(game: Game, team: PublicTeam) {
    if (game.homeTeamId === team.id) return getTeamName(game.awayTeamId);
    return getTeamName(game.homeTeamId);
  }

  function renderScoreCard(game: Game) {
    const winner = getWinner(game);
    const isPending = game.status === 'submitted' && requireFinalization;
    return (
      <div key={game.id} className={`${styles.scoreCard} ${isPending ? styles.scoreCardPending : ''}`}>
        <div className={styles.scoreMeta}>
          <span className={styles.scoreMetaLeft}>
            {/* The whole section already reads "Final Score Record" — only flag the
                exceptions (Unofficial / pending), not every final game. */}
            {isPending && (
              <span className="badge badge-warning">{getResultStatusLabel(game)}</span>
            )}
            <span>{formatShortDate(game.date)}</span>
            {game.time && <span>{formatTime(game.time)}</span>}
          </span>
          {game.isPlayoff && (
            <span className="badge badge-primary">{bracketRoundLabel(game.bracketCode)}</span>
          )}
        </div>

        {/* Stacked rows (away over home) keep the scores in a fixed right-hand
            column, so they line up across every card no matter how long a name
            wraps. Winner row stays bright with a trophy + green score; loser dims. */}
        <div className={styles.scoreMatchup}>
          <div className={`${styles.scoreRow} ${winner === 'away' ? styles.scoreWinner : winner === 'home' ? styles.scoreLoser : ''}`}>
            <span className={styles.scoreWinIconSlot}>
              {winner === 'away' && <Trophy size={14} aria-label="Winner" />}
            </span>
            <span className={styles.scoreTeamName}>{game.awayTeamId ? getTeamName(game.awayTeamId) : (game.awayPlaceholder ?? 'TBD')}</span>
            <strong className={styles.scoreNum}>{game.awayScore}</strong>
          </div>
          <div className={`${styles.scoreRow} ${winner === 'home' ? styles.scoreWinner : winner === 'away' ? styles.scoreLoser : ''}`}>
            <span className={styles.scoreWinIconSlot}>
              {winner === 'home' && <Trophy size={14} aria-label="Winner" />}
            </span>
            <span className={styles.scoreTeamName}>{game.homeTeamId ? getTeamName(game.homeTeamId) : (game.homePlaceholder ?? 'TBD')}</span>
            <strong className={styles.scoreNum}>{game.homeScore}</strong>
          </div>
        </div>

        {winner === 'tie' && (
          <div className={styles.scoreFooter}>
            <span className={styles.tieTag}>Tie game</span>
          </div>
        )}
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
  const tieredBracket = hasPlayoffGames ? (
    <TieredBracket
      games={activeGames.filter(g => g.isPlayoff)}
      teams={teams}
      pools={pools}
      tournamentId={selectedTournament!.id}
      orgSlug={orgSlug}
      tournamentSlug={tournamentSlug ?? ''}
      venues={venues}
      highlightTeamId={followedTeamId ?? undefined}
      requireFinalization={requireFinalization}
    />
  ) : null;

  // Playoff day / completed: the bracket is the headline — expanded on top, as shipped.
  const bracketSection = hasPlayoffGames ? (
    <div className={styles.bracketSection}>
      <div className={styles.bracketSectionHeader}>
        <Trophy size={16} className={styles.bracketSectionIcon} />
        <span className={styles.bracketSectionTitle}>PLAYOFF BRACKET</span>
      </div>
      {tieredBracket}
    </div>
  ) : null;

  // Pool play: the same bracket folds behind a one-row disclosure (R2-1) so the
  // tables and recent scores aren't pushed below a wall of unplayed placeholders.
  // The bracket mounts on FIRST open (per division): mounting inside a closed
  // <details> would measure a zero-width box for the fit-zoom, and ResizeObserver's
  // display:none→visible transition isn't reliable on every engine. Once revealed
  // it stays mounted, so zoom state survives later collapses. Keyed per division so
  // each division starts at the documented collapsed default.
  const bracketDisclosure = hasPlayoffGames ? (
    <details
      key={activeGroup}
      className={`${styles.bracketSection} ${styles.bracketDetails}`}
      onToggle={e => {
        if ((e.target as HTMLDetailsElement).open) {
          setRevealedBrackets(prev => (prev.has(activeGroup) ? prev : new Set(prev).add(activeGroup)));
        }
      }}
    >
      <summary className={styles.bracketSummary}>
        <Trophy size={16} className={styles.bracketSectionIcon} />
        <span className={styles.bracketSectionTitle}>PLAYOFF BRACKET</span>
        <span className={styles.bracketSummaryHint}>
          <span className={styles.hintClosed}>Set · tap to preview</span>
          <span className={styles.hintOpen}>Tap to collapse</span>
        </span>
        <ChevronDown size={16} className={styles.bracketSummaryChevron} aria-hidden="true" />
      </summary>
      {revealedBrackets.has(activeGroup) ? tieredBracket : null}
    </details>
  ) : null;

  return (
    <div className={`page-content ${dockActive ? styles.dockClear : ''}`}>
      <div className="public-page-header">
        <div className="container">
          {/* Eyebrow carries the event name (context the H1 doesn't) instead of repeating
              the H1 verbatim (J6-031). */}
          <span className="eyebrow"><Trophy size={12} /> {selectedTournament?.name ?? 'Standings'}</span>
          <h1>{isCompletedTournament ? 'Final Results & Standings' : 'Results & Standings'}</h1>
          <p className="text-muted">
            {isCompletedTournament
              ? 'Review the final public record by division.'
              : 'Track final scores, unofficial results, and live pool standings.'}
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

            </div>
          )}

          {followedTeam && (
            <>
              <MyTeamCard
                layout="strip"
                teamName={followedTeam.name}
                teamHref={`${teamProfileBaseHref}/${followedTeam.id}`}
                recordLabel={followedStanding ? `${followedStanding.w}-${followedStanding.l}-${followedStanding.t}` : '0-0-0'}
                rankLabel={followedRank != null ? `${ordinalRank(followedRank)}${followedDivision ? ` · ${followedDivision.name}` : ''}` : null}
                opponentName={myTeamOpponentName}
                status={myTeamStatus}
              />
              {!!followedDivision && activeGroup !== followedDivision.id && (
                <div className={styles.myTeamActions}>
                  <button type="button" className={styles.myTeamJump} onClick={showFollowedDivision}>
                    View my division
                  </button>
                </div>
              )}
            </>
          )}

          {activeGroup && (
            /* Result chips speak the badge language with per-meaning colors (D8):
               final = settled green, pending = amber, remaining = quiet neutral. */
            <div className={styles.resultsSummaryLine}>
              <span className={`badge ${styles.summaryChipFinal}`}><CheckCircle size={13} /> <strong>{finalGames.length}</strong> final</span>
              <span className={`badge ${styles.summaryChipPending}`}><Clock size={13} /> <strong>{pendingReviewGames.length}</strong> {requireFinalization ? 'pending' : 'submitted'}</span>
              <span className="badge badge-neutral"><Calendar size={13} /> <strong>{unscoredGames.length}</strong> remaining</span>
            </div>
          )}

          {loaded && divisions.length === 0 && (
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

              {/* ── Standings table ───────────────────────────────────────── */}
              <>
                {/* Knockout stage / completed event — lead with the bracket (the headline);
                    the pool tables become reference material below. */}
                {bracketOnTop && bracketSection}
                {/* Advancement rule — one line above the full tables; the on-track teams
                    are marked with a green check in the rows below (J6-027). Suppressed once
                    the playoffs are underway/decided — it's no longer a prediction. */}
                {!bracketOnTop && advanceCaption && (
                  <div className={styles.playoffAdvanceNote}>
                    <Trophy size={13} /> {advanceCaption} to playoffs
                  </div>
                )}
                {/* Standings table */}
                  {(pools.length >= 2 ? pools : [{ id: 'default', name: 'All Teams' }]).map(pool => {
                    const poolStandings = pools.length >= 2
                      ? standings.filter(s => s.poolId === pool.id)
                      : standings;

                    if (poolStandings.length === 0) return null;

                    const hasPendingStandings = poolStandings.some(s => s.hasPendingGame);
                    const gStarted = poolStandings.some(s => s.gp > 0);
                    // Bar scales off the TRUE differential (the headline number), so the
                    // longest bar matches the biggest real margin — not the capped one.
                    const maxAbsRd = Math.max(1, ...poolStandings.map(s => Math.abs(s.rdRaw ?? s.rd)));
                    // Mirror getStandings exactly (division override → tournament default → legacy,
                    // coin pinned last) so the displayed order matches the order actually applied.
                    const tieBreakerOrder = resolveTieBreakers(currentGroup?.playoffConfig, selectedTournament?.settings)
                      .map(b => BREAKER_LABELS[b]);
                    const activeRunDiffCap = poolStandings.find(s => s.runDiffCap)?.runDiffCap ?? null;
                    // Tied groups awaiting a coin toss (admin only), keyed by coinTossGroupKey.
                    const coinTossGroups: Record<string, StandingRow[]> = {};
                    if (enableCoinTossAdmin) {
                      for (const s of poolStandings) {
                        if (s.needsCoinToss && s.coinTossGroupKey) {
                          (coinTossGroups[s.coinTossGroupKey] ??= []).push(s);
                        }
                      }
                    }

                    return (
                      <div key={pool.id} className={styles.summarySection}>
                        <div className={styles.summaryHeader}>
                          <div className={styles.summaryHeaderMain}>
                            <div className={styles.summaryTitle}>
                              <Trophy size={18} />
                              <h2>
                                Standings{pools.length >= 2 ? ` · ${formatPoolName(pool.name)}` : ''}
                              </h2>
                            </div>
                          </div>
                        </div>

                        <div className={`table-wrap ${styles.tableFrame}`}>
                          <table className={styles.standingsTable}>
                            <thead>
                              {/* Two column sets share one DOM order (R2-3). Phones show
                                  TEAM · REC · RD · PTS with no sideways scroll — the ranking
                                  columns stay on screen; RF/RA sit behind the existing swipe.
                                  Desktop keeps all seven columns exactly as before. */}
                              <tr>
                                <th className={styles.stickyCol}>Team</th>
                                <th className={`${styles.statCenter} ${styles.mobileOnly}`}>REC</th>
                                <th className={`${styles.statCenter} ${styles.mobileOnly}`}>RD</th>
                                <th className={`${styles.ptsCol} ${styles.statCenter} ${styles.mobileOnly}`}>PTS</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>W</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>L</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>T</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>RF</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>RA</th>
                                <th className={`${styles.statCenter} ${styles.desktopOnly}`}>RD</th>
                                <th className={`${styles.ptsCol} ${styles.statCenter} ${styles.desktopOnly}`}>PTS</th>
                                <th className={`${styles.statCenter} ${styles.mobileOnly}`}>RF</th>
                                <th className={`${styles.statCenter} ${styles.mobileOnly}`}>RA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {poolStandings.map((team, idx) => {
                                const isFirst   = idx === 0 && gStarted && poolStandings.length > 1 && team.w >= team.l;
                                const isFollowed = !isPreview && team.id === followedTeamId;
                                const isInPlayoffSpot = advancingTeamIds.has(team.teamId);
                                const rowClass = [
                                  isFirst ? styles.topRow : '',
                                  isFollowed ? styles.followedTeamRow : '',
                                ].filter(Boolean).join(' ');
                                // Trailing "(Coach)" qualifier drops to a quiet second line so
                                // rows stop wrapping at full name weight (D3).
                                const nameParts = splitTeamQualifier(team.name);
                                // RD + PTS cell contents render in BOTH column sets (R2-3) —
                                // one element reused so the two can never drift.
                                const rdCell = (
                                  <>
                                    {(() => {
                                      // Headline = TRUE run differential; the seeding-capped value
                                      // rides in brackets only when a cap is active AND it differs.
                                      const trueRd = team.rdRaw ?? team.rd;
                                      const showCapped = team.runDiffCap != null && team.runDiffCap > 0 && team.rd !== trueRd;
                                      return (
                                        <span className={styles.rdValue}>
                                          <span className={trueRd > 0 ? styles.rdPositive : trueRd < 0 ? styles.rdNegative : ''}>
                                            {trueRd > 0 ? `+${trueRd}` : trueRd}
                                          </span>
                                          {showCapped && (
                                            <span
                                              className={styles.rdCapped}
                                              title={`Playoff-seeding differential — capped at ±${team.runDiffCap} per game`}
                                            >
                                              ({team.rd > 0 ? `+${team.rd}` : team.rd})
                                            </span>
                                          )}
                                        </span>
                                      );
                                    })()}
                                    {/* The diverging bar only means something once a game's been played —
                                       hide the empty track on a not-yet-started pool. */}
                                    {gStarted && (
                                      <span className={`${styles.rdBar} ${styles.desktopOnly}`} aria-hidden="true">
                                        <span
                                          className={styles.rdBarFill}
                                          data-dir={(team.rdRaw ?? team.rd) >= 0 ? 'pos' : 'neg'}
                                          style={{ width: `${(Math.abs(team.rdRaw ?? team.rd) / maxAbsRd) * 50}%` }}
                                        />
                                      </span>
                                    )}
                                  </>
                                );
                                const ptsCell = <span className="badge badge-primary">{team.pts}</span>;
                                return (
                                  <tr key={team.id} className={rowClass}>
                                    <td className={styles.stickyCol}>
                                      <div className={`${styles.teamCell} ${rankChanges.get(team.id) ? styles.teamCellMoved : ''}`}>
                                        {isFirst && <Trophy size={14} className={styles.topIcon} />}
                                        {isFollowed && <Star size={12} fill="currentColor" style={{ color: 'var(--primary-light)', flexShrink: 0 }} aria-label="My team" />}
                                        {rankChanges.get(team.id) && (
                                          <span className={styles.rankArrow} data-dir={rankChanges.get(team.id)} aria-label={rankChanges.get(team.id) === 'up' ? 'Moved up' : 'Moved down'}>
                                            {rankChanges.get(team.id) === 'up' ? '▲' : '▼'}
                                          </span>
                                        )}
                                        <span className={styles.teamNameWrap}>
                                          {nameParts.base}
                                          {nameParts.qualifier && <span className={styles.teamQualifier}>{nameParts.qualifier}</span>}
                                        </span>
                                        {isInPlayoffSpot && <CheckCircle size={12} className={styles.advancingIcon} aria-label="In a playoff spot" />}
                                        {/* Pending marker: full pill on desktop; on phones it compacts to the
                                            amber clock glyph (the "N pending" chip's own icon+color, so the
                                            meaning stays linked) — the pill was wrapping long names to 4 lines
                                            inside the sticky column. */}
                                        {team.hasPendingGame ? (
                                          <>
                                            <span className={styles.pendingTeamBadge}>Pending</span>
                                            <Clock size={13} className={styles.pendingTeamIcon} aria-label="Includes an unofficial score" />
                                          </>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.mobileOnly}`}>{team.w}-{team.l}-{team.t}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.mobileOnly}`}>{rdCell}</td>
                                    <td className={`${styles.ptsCol} ${styles.statCenter} ${styles.mobileOnly}`}>{ptsCell}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.desktopOnly}`}>{team.w}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.desktopOnly}`}>{team.l}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.desktopOnly}`}>{team.t}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.desktopOnly}`}>{team.rf}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.desktopOnly}`}>{team.ra}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.desktopOnly}`}>{rdCell}</td>
                                    <td className={`${styles.ptsCol} ${styles.statCenter} ${styles.desktopOnly}`}>{ptsCell}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.mobileOnly}`}>{team.rf}</td>
                                    <td className={`${styles.statValue} ${styles.statCenter} ${styles.mobileOnly}`}>{team.ra}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className={styles.standingsFooter}>
                          <dl className={styles.statLegend}>
                            {STAT_LEGEND.map(item => (
                              <div
                                key={item.abbr}
                                className={`${styles.statLegendItem} ${item.vis === 'mobile' ? styles.mobileOnly : item.vis === 'desktop' ? styles.desktopOnly : ''}`}
                              >
                                <dt>{item.abbr}</dt>
                                <dd>{item.label}</dd>
                              </div>
                            ))}
                          </dl>
                          <p className={styles.tieBreakerNote}>
                            <span>Tie-breaker order</span>
                            <strong>{tieBreakerOrder.join(' > ')}</strong>
                          </p>
                          {activeRunDiffCap ? (
                            <p className={styles.pendingNote}>
                              RD shows the true run differential, with the playoff-seeding value in brackets — capped at ±{activeRunDiffCap}{' '}per game. Seeding uses the capped figure, so a bigger RD doesn&apos;t always mean a higher seed.
                            </p>
                          ) : null}
                          {hasPendingStandings && (
                            <p className={styles.pendingNote}>
                              Unofficial scores are included here for visibility. Standings may change once the organizer confirms them.
                            </p>
                          )}
                        </div>

                        {enableCoinTossAdmin && currentGroup && Object.entries(coinTossGroups).map(([groupKey, rows]) => (
                          <CoinTossRecorder
                            key={groupKey}
                            orgSlug={orgSlug}
                            divisionId={currentGroup.id}
                            groupKey={groupKey}
                            teams={rows.map(r => ({ id: r.teamId, name: r.teamName }))}
                            onRecorded={ordered => applyCoinToss(currentGroup.id, groupKey, ordered)}
                          />
                        ))}
                      </div>
                    );
                  })}

                  {/* Playoff bracket — collapsed disclosure below the pool tables during
                      pool play (R2-1); moves above them, expanded, once the knockout
                      stage starts (see bracketOnTop). */}
                  {!bracketOnTop && bracketDisclosure}
              </>

              {loaded && standings.length === 0 && (
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
              <div className={styles.scoreSection}>
                  <div className={styles.scoreSectionHeader}>
                    <div>
                      <span className="eyebrow"><CheckCircle size={12} /> Recent Scores</span>
                      <h2>{standingsFinal || isCompletedTournament ? 'Final Score Record' : 'Latest Scores'}</h2>
                      <p>
                        {recentScores.length > 0
                          ? standingsPending
                            ? 'Scores marked Unofficial are visible, but not final until the organizer confirms them.'
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
