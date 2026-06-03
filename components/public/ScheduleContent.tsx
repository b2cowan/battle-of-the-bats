'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Calendar, CalendarPlus, Trophy, List, LayoutTemplate, Search, ChevronDown, Star, X, Info } from 'lucide-react';
import { Game, Team, Division, Tournament } from '@/lib/types';
import { formatTime, formatPoolName } from '@/lib/utils';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isPublicPageEnabled } from '@/lib/public-pages';
import YearSelector from '@/components/YearSelector';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import styles from '@/app/[orgSlug]/schedule/schedule.module.css';
import { LogicSyncBracket } from '@/components/bracket/LogicSyncBracket';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import { readFollowedTeamId, clearFollowedTeam, isTournamentInProgress } from '@/lib/follow';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { downloadTeamScheduleICS } from '@/lib/team-calendar';
import FollowAlertsToggle from '@/components/public/FollowAlertsToggle';

// ── bracket helpers ───────────────────────────────────────────────────────────

function bracketPriority(code?: string) {
  if (!code) return 99;
  if (/^QF/i.test(code)) return 1;
  if (/^SF/i.test(code)) return 2;
  if (/^(FIN|IF|3RD)$/i.test(code)) return 3;
  return 4;
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
type ScheduleStage = 'pool' | 'playoff';
type BracketLayout = 'list' | 'bracket';

// ── Scorebug helpers ──────────────────────────────────────────────────────────

function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function teamAvatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  // Shift away from lime-green (80-155) so avatar doesn't clash with the follow star
  return hue < 80 ? hue : hue < 155 ? hue + 75 : hue;
}

function calcTeamRecord(teamId: string, allGames: Game[]) {
  let w = 0, l = 0, t = 0;
  for (const g of allGames) {
    if (g.status !== 'completed' && g.status !== 'submitted') continue;
    if (g.homeScore == null || g.awayScore == null) continue;
    if (g.isPlayoff) continue;
    const isHome = g.homeTeamId === teamId;
    const isAway = g.awayTeamId === teamId;
    if (!isHome && !isAway) continue;
    if (g.homeScore === g.awayScore) { t++; continue; }
    const won = (isHome && g.homeScore > g.awayScore) || (isAway && g.awayScore > g.homeScore);
    if (won) w++; else l++;
  }
  return { w, l, t };
}

interface StandingRow { teamId: string; name: string; w: number; l: number; t: number; pts: number; }

function calcDivisionStandings(divisionId: string, allGames: Game[], allTeams: Team[]): StandingRow[] {
  const divTeams = allTeams.filter(t => t.divisionId === divisionId && t.status !== 'rejected');
  const map = new Map<string, StandingRow>();
  for (const team of divTeams) map.set(team.id, { teamId: team.id, name: team.name, w: 0, l: 0, t: 0, pts: 0 });
  for (const g of allGames) {
    if (g.divisionId !== divisionId || g.isPlayoff) continue;
    if (g.status !== 'completed' && g.status !== 'submitted') continue;
    if (g.homeScore == null || g.awayScore == null) continue;
    const home = map.get(g.homeTeamId);
    const away = map.get(g.awayTeamId);
    if (!home || !away) continue;
    if (g.homeScore === g.awayScore) { home.t++; home.pts++; away.t++; away.pts++; }
    else if (g.homeScore > g.awayScore) { home.w++; home.pts += 2; away.l++; }
    else { away.w++; away.pts += 2; home.l++; }
  }
  return [...map.values()].sort((a, b) => b.pts - a.pts || b.w - a.w);
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  isPreview?: boolean;
  initialData?: PublicTournamentPageData;
}

export default function ScheduleContent({ orgSlug, tournamentSlug, isPreview = false, initialData }: Props) {
  const [games, setGames]           = useState<Game[]>(() => initialData?.games ?? []);
  const [teams, setTeams]           = useState<Team[]>(() => initialData?.teams ?? []);
  const [divisions, setDivisions]   = useState<Division[]>(() => initialData?.divisions ?? []);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>(() => initialData?.tournaments ?? []);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(() => initialData?.tournament ?? null);
  const [activeGroup, setActiveGroup]     = useState<string>(() => {
    const groups = initialData?.divisions ?? [];
    if (groups.length === 0) return '';
    const pref = getDivisionPref(orgSlug);
    const preferred = pref ? groups.find(g => g.name === pref) : null;
    return (preferred ?? groups[0]).id;
  });
  const [viewMode, setViewMode]           = useState<ScheduleStage>('pool');
  const [bracketLayout, setBracketLayout] = useState<BracketLayout>('list');
  const [loading, setLoading]             = useState(!initialData);
  const [requireFinalization, setRequireFinalization] = useState(
    initialData?.organization.requireScoreFinalization ?? initialData?.tournament?.requireScoreFinalization ?? true
  );
  const [contactEmail, setContactEmail] = useState<string | null>(
    () => initialData?.tournament?.contactEmail ?? initialData?.organization?.contactEmail ?? null
  );
  const [teamSearch, setTeamSearch] = useState<string>('');
  const [fanAlertsEnabled, setFanAlertsEnabled] = useState<boolean>(() => initialData?.fanAlertsEnabled ?? false);
  const [followedTeamId, setFollowedTeamId] = useState<string | null>(null);
  const [followedFilterApplied, setFollowedFilterApplied] = useState(false);

  useEffect(() => {
    // Browser-local preference hydrates after the public page renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowedTeamId(readFollowedTeamId(orgSlug, tournamentSlug));
    setFollowedFilterApplied(false);
  }, [orgSlug, tournamentSlug]);

  useEffect(() => {
    if (initialData) return;
    async function init() {
      setLoading(true);
      const data = await fetchPublicTournamentData(orgSlug, tournamentSlug, 'schedule');
      const current = data?.tournament ?? null;
      const groups = data?.divisions ?? [];

      setRequireFinalization(data?.organization.requireScoreFinalization ?? current?.requireScoreFinalization ?? true);
      setContactEmail(current?.contactEmail ?? data?.organization?.contactEmail ?? null);
      setFanAlertsEnabled(data?.fanAlertsEnabled ?? false);
      setAllTournaments(data?.tournaments ?? []);
      setSelectedTournament(current);
      setGames(data?.games ?? []);
      setTeams(data?.teams ?? []);
      setDivisions(groups);
      if (groups.length > 0) {
        const pref = getDivisionPref(orgSlug);
        const preferred = pref ? groups.find(g => g.name === pref) : null;
        setActiveGroup((preferred ?? groups[0]).id);
      }
      setLoading(false);
    }
    init();
  }, [orgSlug, tournamentSlug, initialData]);

  // ── live refresh (game day only) ─────────────────────────────────────────────
  usePublicTournamentLive({
    orgSlug,
    tournamentSlug,
    section: 'schedule',
    enabled: isTournamentInProgress(selectedTournament),
    onData: data => {
      setGames(data.games ?? []);
      setTeams(data.teams ?? []);
      setDivisions(data.divisions ?? []);
    },
  });

  // Flash a score-flip animation on rows whose score/status just changed.
  const prevScoreSigRef = useRef<Map<string, string>>(new Map());
  const [flippedGameIds, setFlippedGameIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const changed = new Set<string>();
    for (const g of games) {
      const sig = `${g.homeScore ?? ''}:${g.awayScore ?? ''}:${g.status}`;
      const prev = prevScoreSigRef.current.get(g.id);
      if (prev !== undefined && prev !== sig) changed.add(g.id);
      prevScoreSigRef.current.set(g.id, sig);
    }
    if (changed.size === 0) return;
    // Transient animation flag driven by incoming live data — intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlippedGameIds(changed);
    const timer = window.setTimeout(() => setFlippedGameIds(new Set()), 1600);
    return () => window.clearTimeout(timer);
  }, [games]);

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

  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const followedTeam = followedTeamId ? teams.find(t => t.id === followedTeamId) ?? null : null;
  const divisionTeams = useMemo(() => {
    return teams
      .filter(team => !activeGroup || team.divisionId === activeGroup)
      .filter(team => team.status !== 'rejected')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeGroup, teams]);
  const activeTeamFilterId =
    followedTeam && teamSearch.trim().toLowerCase() === followedTeam.name.toLowerCase()
      ? followedTeam.id
      : null;

  const isMyTeamFilter = Boolean(followedTeamId && activeTeamFilterId === followedTeamId);

  const teamFiltered = teamSearch
    ? filtered.filter(g => {
        const q = teamSearch.toLowerCase();
        const homeTeam = teamMap.get(g.homeTeamId ?? '');
        const awayTeam = teamMap.get(g.awayTeamId ?? '');
        const homeName = getTeamDisplay(g, true);
        const awayName = getTeamDisplay(g, false);
        // Never surface unresolved "TBD" matchups in a team filter.
        if (homeName === 'TBD' && awayName === 'TBD') return false;

        // "My Team Games" / exact follow match: only games where the followed
        // team is a real, named participant — never a hidden/unresolved (TBD) slot.
        if (activeTeamFilterId) {
          if (homeTeam?.id === activeTeamFilterId && homeName !== 'TBD') return true;
          if (awayTeam?.id === activeTeamFilterId && awayName !== 'TBD') return true;
          return false;
        }
        // Free-text search matches on the names actually shown, plus coach.
        return (
          homeName.toLowerCase().includes(q) ||
          awayName.toLowerCase().includes(q) ||
          homeTeam?.coach?.toLowerCase().includes(q) ||
          awayTeam?.coach?.toLowerCase().includes(q)
        );
      })
    : filtered;

  function formatDividerDate(d: string) {
    if (!d) return 'TBD';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', {
      month: 'short', day: 'numeric',
    }).toUpperCase();
  }

  function formatRowDate(d?: string) {
    if (!d) return 'TBD';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', {
      month: 'short', day: 'numeric',
    });
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
  const homeHref = `/${orgSlug}/${tournamentSlug}`;
  const registerHref = `/${orgSlug}/${tournamentSlug}/register`;
  const teamsHref = `/${orgSlug}/${tournamentSlug}/teams`;
  const canRegister = Boolean(selectedTournament && isPublicPageEnabled(selectedTournament, 'register'));
  const showTeamsPage = Boolean(selectedTournament && isPublicPageEnabled(selectedTournament, 'teams'));
  // ── Scorebug derived data ─────────────────────────────────────────────────

  const followedRecord = useMemo(
    () => (followedTeamId ? calcTeamRecord(followedTeamId, games) : null),
    [followedTeamId, games]
  );

  const followedTeamDiv = followedTeam
    ? divisions.find(d => d.id === followedTeam.divisionId) ?? null
    : null;

  const followedTeamPool = (followedTeam?.poolId && followedTeamDiv?.pools)
    ? (followedTeamDiv.pools.find((p: { id: string; name: string }) => p.id === followedTeam.poolId) ?? null)
    : null;

  // Most recent submitted+scored game today — "live" game for the scorebug
  const followedCurrentGame = useMemo(() => {
    if (!followedTeamId) return null;
    return games
      .filter(g =>
        g.date === today &&
        g.status === 'submitted' &&
        g.homeScore != null && g.awayScore != null &&
        (g.homeTeamId === followedTeamId || g.awayTeamId === followedTeamId)
      )
      .sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))[0] ?? null;
  }, [followedTeamId, games, today]);

  // Next upcoming scheduled game for the followed team
  const followedNextGame = useMemo(() => {
    if (!followedTeamId) return null;
    return games
      .filter(g =>
        g.status === 'scheduled' &&
        (g.homeTeamId === followedTeamId || g.awayTeamId === followedTeamId) &&
        (g.date > today || g.date === today)
      )
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time ?? '').localeCompare(b.time ?? '');
      })[0] ?? null;
  }, [followedTeamId, games, today]);

  const followedContextGame = followedCurrentGame ?? followedNextGame;
  const followedOpponentRawId = followedContextGame
    ? (followedContextGame.homeTeamId === followedTeamId
        ? followedContextGame.awayTeamId
        : followedContextGame.homeTeamId)
    : null;
  const followedOpponentTeam = followedOpponentRawId
    ? (teams.find(t => t.id === followedOpponentRawId) ?? null)
    : null;
  const followedOpponentName = followedOpponentTeam?.name ??
    (followedContextGame
      ? (followedContextGame.homeTeamId === followedTeamId
          ? followedContextGame.awayPlaceholder
          : followedContextGame.homePlaceholder) ?? null
      : null);

  const divisionStandings = useMemo(
    () => (followedTeam ? calcDivisionStandings(followedTeam.divisionId, games, teams) : []),
    [followedTeam, games, teams]
  );

  const railStandings = followedTeamPool
    ? divisionStandings.filter(s => teams.find(t => t.id === s.teamId)?.poolId === followedTeamPool.id)
    : divisionStandings;

  const followedStandingPos = followedTeamId
    ? (railStandings.findIndex(s => s.teamId === followedTeamId) + 1)
    : 0;

  function selectDivision(nextGroup: string, clearTeam = true) {
    setActiveGroup(nextGroup);
    if (clearTeam) setTeamSearch('');
    setDivisionPref(orgSlug, divisions.find(g => g.id === nextGroup)?.name ?? '');
  }


  useEffect(() => {
    if (!followedTeam || followedFilterApplied) return;
    const followedDivision = divisions.find(g => g.id === followedTeam.divisionId);
    if (!followedDivision) return;
    // Jump to the followed team's division; do NOT auto-filter by team name —
    // stars on rows already highlight followed-team games.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveGroup(followedDivision.id);
    setDivisionPref(orgSlug, followedDivision.name);
    setFollowedFilterApplied(true);
  }, [divisions, followedFilterApplied, followedTeam, orgSlug]);

  // Auto-scroll to today's games on first load so the core game-day question
  // ("when/where is my next game") is a glance, not scroll-and-hunt. Runs once.
  const didAutoScrollRef = useRef(false);
  useEffect(() => {
    if (loading || isPreview || didAutoScrollRef.current) return;
    if (typeof window === 'undefined') return;
    const el = document.getElementById('schedule-today');
    if (!el) return;
    didAutoScrollRef.current = true;
    // Defer a frame so the follow-team auto-filter has settled the layout first.
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [loading, isPreview, sortedDates]);

  function showFollowedTeamGames() {
    if (!followedTeam) return;
    const followedDivision = divisions.find(g => g.id === followedTeam.divisionId);
    if (followedDivision) {
      setActiveGroup(followedDivision.id);
      setDivisionPref(orgSlug, followedDivision.name);
    }
    setTeamSearch(followedTeam.name);
  }

  function stopFollowing() {
    const followedName = followedTeam?.name ?? '';
    clearFollowedTeam(orgSlug, tournamentSlug);
    setFollowedTeamId(null);
    if (followedName && teamSearch.trim().toLowerCase() === followedName.toLowerCase()) {
      setTeamSearch('');
    }
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
    const awayName = getTeamDisplay(game, false);
    const homeName = getTeamDisplay(game, true);

    const outcomeColor = {
      win: 'var(--success)',
      tie: 'var(--warning)',
      loss: 'rgba(var(--danger-rgb), 0.72)',
    };
    const homeOutcome = !hasScore ? null
      : winner === 'tie' ? { label: 'T', color: outcomeColor.tie }
      : winner === 'home' ? { label: 'W', color: outcomeColor.win }
      : { label: 'L', color: outcomeColor.loss };
    const awayOutcome = !hasScore ? null
      : winner === 'tie' ? { label: 'T', color: outcomeColor.tie }
      : winner === 'away' ? { label: 'W', color: outcomeColor.win }
      : { label: 'L', color: outcomeColor.loss };

    const isLive = game.status === 'submitted' && game.date === today;
    const statusBadge =
      game.status === 'cancelled' ? <span className="badge badge-danger">Cancelled</span>
      : game.status === 'completed' ? <span className="badge badge-success">Final</span>
      : game.status === 'submitted' ? (
          isLive
            ? <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
            : requireFinalization
              ? <span className="badge badge-warning">Pending</span>
              : <span className="badge badge-success">Final</span>
        )
      : null;

    const isFollowedGame = Boolean(
      followedTeamId &&
      (game.homeTeamId === followedTeamId || game.awayTeamId === followedTeamId)
    );
    const rowClassName = `${styles.gameRow} ${extraClass} ${isFollowedGame ? styles.followedGameRow : ''} ${flippedGameIds.has(game.id) ? styles.scoreFlip : ''}`;
    const gameHref = `${homeHref}/schedule/${game.id}`;
    const gameLabel = `${formatRowDate(game.date)} ${game.time ? formatTime(game.time) : 'TBD'} ${awayName} vs ${homeName}`;

    const rowContent = (
      <>
        {/* ── Desktop: flat VS row ─────────────────────────────────────── */}
        <div className={styles.timeCell}>
          <div className={styles.gameMetaLine}>
            <span className={styles.gameDateText}>{formatRowDate(game.date)}</span>
            <span className={styles.gameTimeText}>{game.time ? `- ${formatTime(game.time)}` : '- TBD'}</span>
          </div>
        </div>

        <div className={styles.matchupCell}>
          <div className={`${styles.matchSide} ${styles.matchAway}`}>
            {awayOutcome && <span className={styles.resultTag} style={{ color: awayOutcome.color }}>{awayOutcome.label}</span>}
            {hasScore && <span className={styles.matchScore} style={{ color: awayOutcome?.color }}>{game.awayScore}</span>}
            <span className={styles.matchTeam} title={awayName}>{awayName}</span>
          </div>
          <span className={styles.matchVs}>VS</span>
          <div className={`${styles.matchSide} ${styles.matchHome}`}>
            <span className={styles.matchTeam} title={homeName}>{homeName}</span>
            {hasScore && <span className={styles.matchScore} style={{ color: homeOutcome?.color }}>{game.homeScore}</span>}
            {homeOutcome && <span className={styles.resultTag} style={{ color: homeOutcome.color }}>{homeOutcome.label}</span>}
          </div>
        </div>

        <div className={styles.statusCell}>
          {typeLabel}
          <span className={styles.statusBadgeSlot}>{statusBadge}</span>
          <span className={styles.followStarSlot}>
            {isFollowedGame && <Star size={15} fill="currentColor" className={styles.followStar} aria-label="Followed team game" />}
          </span>
        </div>

        {/* ── Mobile: explicit named-area grid — no nested flex, avatars can't collapse ── */}
        <div className={styles.mobileGameLayout}>
          {/* col 1: time, spans both team rows */}
          <div className={styles.mobileTimeCol}>
            <span className={styles.mobileTimePrimary}>{game.time ? formatTime(game.time) : 'TBD'}</span>
          </div>
          {/* col 2: away avatar */}
          <span
            className={styles.mobileAvAway}
            style={{ background: awayName !== 'TBD' ? `hsl(${teamAvatarHue(awayName)}, 58%, 38%)` : 'var(--white-10)' }}
          >
            {awayName !== 'TBD' ? teamInitials(awayName) : '?'}
          </span>
          {/* col 3: away name */}
          <span className={styles.mobileNameAway}>
            {awayName}{isFollowedGame && game.awayTeamId === followedTeamId ? ' ★' : ''}
          </span>
          {/* col 4: away score */}
          <span className={styles.mobileScoreAway} style={{ color: awayOutcome?.color ?? 'var(--white-75)' }}>
            {hasScore ? game.awayScore : ''}
          </span>
          {/* col 2: home avatar */}
          <span
            className={styles.mobileAvHome}
            style={{ background: homeName !== 'TBD' ? `hsl(${teamAvatarHue(homeName)}, 58%, 38%)` : 'var(--white-10)' }}
          >
            {homeName !== 'TBD' ? teamInitials(homeName) : '?'}
          </span>
          {/* col 3: home name */}
          <span className={styles.mobileNameHome}>
            {homeName}{isFollowedGame && game.homeTeamId === followedTeamId ? ' ★' : ''}
          </span>
          {/* col 4: home score + status badge */}
          <div className={styles.mobileScoreHome}>
            <span className={styles.mobileScoreNum} style={{ color: homeOutcome?.color ?? 'var(--white-75)' }}>
              {hasScore ? game.homeScore : ''}
            </span>
            <span className={styles.mobileRowStatus}>{statusBadge ?? typeLabel}</span>
          </div>
        </div>
      </>
    );

    if (isPreview) {
      return (
        <div
          key={game.id}
          data-status={game.status}
          className={rowClassName}
        >
          {rowContent}
        </div>
      );
    }

    return (
      <Link
        key={game.id}
        href={gameHref}
        prefetch={false}
        data-status={game.status}
        className={rowClassName}
        aria-label={`View game details for ${gameLabel}`}
      >
        {rowContent}
      </Link>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  if (!loading && selectedTournament && !isPublicPageEnabled(selectedTournament, 'schedule')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<Calendar size={40} />}
              eyebrow="Schedule"
              title="Schedule unavailable"
              description="The organizer has hidden the schedule for this tournament."
              actions={!isPreview ? [{ href: homeHref, label: 'Tournament Home', variant: 'ghost' as const }] : []}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="public-page-header">
        <div className="container">
          <span className="eyebrow"><Calendar size={12} /> Schedule</span>
          <h1>Tournament Schedule</h1>
          <p className="text-muted">View games by division. All times are local.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {!isPreview && (
            <YearSelector
              tournaments={allTournaments}
              orgSlug={orgSlug}
              currentTournamentSlug={tournamentSlug}
              currentPage="schedule"
            />
          )}

          {/* ── Scorebug strip (mobile) / follow prompt ── */}
          {!isPreview && !loading && (
            <>
              <div className={styles.scorebugBar}>
                {followedTeam ? (
                  <>
                    <div
                      className={styles.scorebugAvatar}
                      style={{ background: `hsl(${teamAvatarHue(followedTeam.name)}, 58%, 38%)` }}
                    >
                      {teamInitials(followedTeam.name)}
                    </div>
                    <div className={styles.scorebugBody}>
                      <div className={styles.scorebugName}>
                        <Star size={11} fill="currentColor" className={styles.scorebugStar} />
                        {followedTeam.name}
                      </div>
                      <div className={styles.scorebugMeta}>
                        <span>
                          {followedRecord
                            ? `${followedRecord.w}-${followedRecord.l}-${followedRecord.t}`
                            : '0-0-0'}
                        </span>
                        {followedStandingPos > 0 && (
                          <>
                            <span className={styles.scorebugDot}>·</span>
                            <span>
                              {ordinal(followedStandingPos)}
                              {followedTeamPool ? ` · ${followedTeamPool.name}` : ''}
                            </span>
                          </>
                        )}
                      </div>
                      {followedOpponentName && (
                        <div className={styles.scorebugOpp}>vs {followedOpponentName}</div>
                      )}
                    </div>
                    <div className={styles.scorebugRight}>
                      {followedCurrentGame ? (
                        <>
                          <span className={styles.scorebugLive}>
                            <span className={styles.scorebugLiveDot} />LIVE
                          </span>
                          <div className={styles.scorebugScoreDisplay}>
                            {followedCurrentGame.awayTeamId === followedTeamId ? (
                              <>{followedCurrentGame.awayScore}<span className={styles.scorebugScoreDash}>-</span>{followedCurrentGame.homeScore}</>
                            ) : (
                              <>{followedCurrentGame.homeScore}<span className={styles.scorebugScoreDash}>-</span>{followedCurrentGame.awayScore}</>
                            )}
                          </div>
                        </>
                      ) : followedNextGame ? (
                        <>
                          <div className={styles.scorebugNextUp}>NEXT UP</div>
                          <div className={styles.scorebugNextTime}>
                            {followedNextGame.time ? formatTime(followedNextGame.time) : 'TBD'}
                          </div>
                        </>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={styles.scorebugStop}
                      onClick={stopFollowing}
                      aria-label={`Stop following ${followedTeam.name}`}
                      title="Stop following"
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <div className={styles.noFollowPrompt}>
                    <Star size={13} className={styles.noFollowStar} />
                    <span>Follow a team to pin its score &amp; next game here.</span>
                  </div>
                )}
              </div>
              {followedTeam && (
                <div className={styles.followQuickActions}>
                  {!isMyTeamFilter && (
                    <button
                      type="button"
                      className={styles.myGamesLink}
                      onClick={showFollowedTeamGames}
                    >
                      <Star size={11} /> My Team Games
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.myGamesLink}
                    onClick={handleAddToCalendar}
                  >
                    <CalendarPlus size={11} /> Add to Calendar
                  </button>
                  {fanAlertsEnabled && selectedTournament && (
                    <FollowAlertsToggle
                      orgSlug={orgSlug}
                      tournamentSlug={tournamentSlug}
                      tournamentId={selectedTournament.id}
                      team={{ id: followedTeam.id, name: followedTeam.name }}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Desktop two-column layout when following a team ── */}
          <div className={followedTeam && !loading ? styles.scheduleLayout : ''}>
            <div className={followedTeam && !loading ? styles.scheduleMain : ''}>

          {allUnpublished ? (
            <PublicTournamentState
              icon={<Calendar size={40} />}
              eyebrow="Schedule"
              title="Schedule coming soon"
              description="The tournament schedule has not been published yet. Check back before game day."
              contactEmail={contactEmail}
              actions={!isPreview ? [
                ...(canRegister ? [{ href: registerHref, label: 'Register', variant: 'lime' as const }] : []),
                ...(showTeamsPage ? [{ href: teamsHref, label: 'View Teams', variant: 'ghost' as const }] : []),
                { href: homeHref, label: 'Tournament Home', variant: 'ghost' as const },
              ] : []}
            />
          ) : (
          <>

          <div className={`${styles.scheduleControls} ${styles.mobileScheduleControls}`}>
            <div className={styles.mobileControlBar}>
              {divisions.length > 1 ? (
                <div className={`select-wrapper ${styles.mobileDivisionSelect}`}>
                  <select
                    className="form-select"
                    aria-label="Division"
                    value={activeGroup}
                    onChange={e => selectDivision(e.target.value)}
                  >
                    {divisions.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="select-icon" />
                </div>
              ) : (
                <div className={styles.mobileDivisionPill}>{activeG?.name ?? 'Division'}</div>
              )}
              <div className={styles.mobileStageControl} role="group" aria-label="Schedule stage">
                <button
                  type="button"
                  className={`${styles.mobileStageBtn} ${viewMode === 'pool' ? styles.mobileStageBtnActive : ''}`}
                  aria-pressed={viewMode === 'pool'}
                  onClick={() => setViewMode('pool')}
                >
                  Pool Play
                </button>
                <button
                  type="button"
                  className={`${styles.mobileStageBtn} ${viewMode === 'playoff' ? styles.mobileStageBtnActive : ''}`}
                  aria-pressed={viewMode === 'playoff'}
                  onClick={() => setViewMode('playoff')}
                >
                  Playoffs
                </button>
              </div>
            </div>
            {/* Search + List/Bracket on the same row */}
            {activeVisibility !== 'unpublished' && (
              <div className={styles.mobileSearchBracketRow}>
                <div className={`${styles.teamFilter} ${styles.mobileTeamFilter}`}>
                  <Search size={14} className={styles.teamFilterIcon} />
                  <input
                    type="text"
                    className="form-input"
                    list="schedule-mobile-team-options"
                    placeholder="Search team or coach..."
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                  />
                  <datalist id="schedule-mobile-team-options">
                    {divisionTeams.map(team => (
                      <option key={team.id} value={team.name}>{team.coach}</option>
                    ))}
                  </datalist>
                  {teamSearch && (
                    <button type="button" className={styles.clearFilter} onClick={() => setTeamSearch('')} aria-label="Clear team filter">x</button>
                  )}
                </div>
                {viewMode === 'playoff' && (
                  <div className={`${styles.segmentedControl} ${styles.mobileBracketInline}`} role="group" aria-label="Playoff view">
                    <button
                      type="button"
                      className={`${styles.segmentButton} ${bracketLayout === 'list' ? styles.segmentActive : ''}`}
                      aria-pressed={bracketLayout === 'list'}
                      onClick={() => setBracketLayout('list')}
                    >
                      <List size={14} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.segmentButton} ${bracketLayout === 'bracket' ? styles.segmentActive : ''}`}
                      aria-pressed={bracketLayout === 'bracket'}
                      onClick={() => setBracketLayout('bracket')}
                    >
                      <LayoutTemplate size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`${styles.scheduleControls} ${styles.desktopScheduleControls}`}>
            <div className={styles.primaryControls}>
              {divisions.length > 1 && (
                <div className={`select-wrapper ${styles.divisionSelect}`}>
                  <select
                    className="form-select"
                    aria-label="Division"
                    value={activeGroup}
                    onChange={e => {
                      selectDivision(e.target.value);
                    }}
                  >
                    {divisions.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="select-icon" />
                </div>
              )}
              <div className={styles.segmentedControl} role="group" aria-label="Schedule stage">
                <button
                  type="button"
                  className={`${styles.segmentButton} ${viewMode === 'pool' ? styles.segmentActive : ''}`}
                  aria-pressed={viewMode === 'pool'}
                  onClick={() => setViewMode('pool')}
                >
                  Pool Play
                </button>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${viewMode === 'playoff' ? styles.segmentActive : ''}`}
                  aria-pressed={viewMode === 'playoff'}
                  onClick={() => setViewMode('playoff')}
                >
                  Playoffs
                </button>
              </div>
            </div>

            <div className={styles.secondaryControls}>
              {activeVisibility !== 'unpublished' && (
                <div className={styles.teamFilter}>
                  <Search size={14} className={styles.teamFilterIcon} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search team or coach..."
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                  />
                  {teamSearch && (
                    <button type="button" className={styles.clearFilter} onClick={() => setTeamSearch('')} aria-label="Clear team filter">x</button>
                  )}
                </div>
              )}

              {viewMode === 'playoff' && (
                <div className={styles.segmentedControl} role="group" aria-label="Playoff view">
                  <button
                    type="button"
                    className={`${styles.segmentButton} ${bracketLayout === 'list' ? styles.segmentActive : ''}`}
                    aria-pressed={bracketLayout === 'list'}
                    onClick={() => setBracketLayout('list')}
                  >
                    <List size={14} /> List
                  </button>
                  <button
                    type="button"
                    className={`${styles.segmentButton} ${bracketLayout === 'bracket' ? styles.segmentActive : ''}`}
                    aria-pressed={bracketLayout === 'bracket'}
                    onClick={() => setBracketLayout('bracket')}
                  >
                    <LayoutTemplate size={14} /> Bracket
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* My Team Games banner — shown when filtering to followed team's games */}
          {isMyTeamFilter && followedTeam && (
            <div className={styles.myTeamBanner}>
              <Star size={13} fill="currentColor" />
              <span className={styles.myTeamBannerText}>
                Showing <strong>{followedTeam.name}</strong> games only
              </span>
              <span className={styles.myTeamCount}>{teamFiltered.length}</span>
              <button
                type="button"
                className={styles.myTeamBannerClear}
                onClick={() => setTeamSearch('')}
                aria-label="Show all games"
              >
                <X size={12} />
              </button>
            </div>
          )}
          {teamSearch && !isMyTeamFilter && (
            <p className={styles.filterLabel}>
              Filtering by: <strong>&ldquo;{teamSearch}&rdquo;</strong>
            </p>
          )}

          {/* Placeholder-published: times/fields are committed, matchups are not.
             Set expectations so a TBD grid isn't read as a finalized schedule. */}
          {activeVisibility === 'published_generic' && (
            <div className={styles.tbaNotice}>
              <Info size={16} />
              <span>Game times and locations are set — matchups will be announced soon.</span>
            </div>
          )}

          {/* ── main content ── */}
          {activeVisibility === 'unpublished' ? (
            <PublicTournamentState
              icon={<Calendar size={40} />}
              eyebrow="Schedule"
              title="Division schedule coming soon"
              description="This division has not been published yet. Other divisions may already be available."
              contactEmail={contactEmail}
              compact
            />
          ) : loading ? (
            <div className={styles.skeletonContainer}>
              <div className={`${styles.skeleton} ${styles.skeletonPulse}`} />
              <div className={`${styles.skeleton} ${styles.skeletonPulse}`} />
              <div className={`${styles.skeleton} ${styles.skeletonPulse}`} />
            </div>
          ) : sortedDates.length === 0 && !(viewMode === 'playoff' && bracketLayout === 'bracket') && !(viewMode === 'pool' && pools.length >= 2) && !(viewMode === 'playoff' && hasPoolPlaceholders) ? (
            <PublicTournamentState
              icon={<Calendar size={40} />}
              eyebrow="Schedule"
              title={teamSearch ? 'No games match that search' : `No ${viewMode === 'playoff' ? 'playoff ' : ''}games yet`}
              description={teamSearch ? 'Try another team name, coach name, or clear the search.' : 'Games will appear here once the organizer adds them.'}
              actions={!teamSearch && !isPreview && showTeamsPage ? [{ href: teamsHref, label: 'View Teams', variant: 'ghost' as const }] : []}
              compact
            >
              {teamSearch ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTeamSearch('')}>Clear Search</button>
              ) : null}
            </PublicTournamentState>
          ) : (
            (() => {
              // ── BRACKET VIEW ─────────────────────────────────────────────
              if (viewMode === 'playoff' && bracketLayout === 'bracket') {
                if (bracketGames.length === 0) {
                  return (
                    <PublicTournamentState
                      icon={<Trophy size={40} />}
                      eyebrow="Playoffs"
                      title="No playoff games yet"
                      description="Playoff games will appear here once they are scheduled."
                      compact
                    />
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
                              highlightTeamId={undefined}
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
                    highlightTeamId={undefined}
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
                        <div key={date} id={date === today ? 'schedule-today' : undefined} className={`${styles.dateGroup} ${date === today ? styles.todayGroup : ''}`}>
                          <div className={styles.dateLabel}>
                            {formatDividerDate(date)}
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
                            <div key={date} id={date === today ? 'schedule-today' : undefined} className={`${styles.dateGroup} ${date === today ? styles.todayGroup : ''}`}>
                              <div className={styles.dateLabel}>
                                {formatDividerDate(date)}
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
                <div key={date} id={date === today ? 'schedule-today' : undefined} className={`${styles.dateGroup} ${date === today ? styles.todayGroup : ''}`}>
                  <div className={styles.dateLabel}>
                    {formatDividerDate(date)}
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
            </div>{/* /scheduleMain */}

            {/* ── Desktop right rail (scorebug card + standings) ── */}
            {followedTeam && !loading && (
              <div className={styles.scheduleRail}>
                {/* Scorebug card */}
                <div className={styles.railCard}>
                  <div className={styles.railCardHeader}>
                    <div
                      className={styles.railAvatar}
                      style={{ background: `hsl(${teamAvatarHue(followedTeam.name)}, 58%, 38%)` }}
                    >
                      {teamInitials(followedTeam.name)}
                    </div>
                    <div className={styles.railTeamInfo}>
                      <div className={styles.railTeamName}>
                        <Star size={11} fill="currentColor" className={styles.railTeamStar} />
                        {followedTeam.name}
                      </div>
                      <div className={styles.railTeamMeta}>
                        <span>
                          {followedRecord
                            ? `${followedRecord.w}-${followedRecord.l}-${followedRecord.t}`
                            : '0-0-0'}
                        </span>
                        {followedStandingPos > 0 && (
                          <>
                            <span>·</span>
                            <span>
                              {ordinal(followedStandingPos)}
                              {followedTeamPool ? ` · ${followedTeamPool.name}` : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={styles.railScoreArea}>
                      {followedCurrentGame ? (
                        <>
                          <span className={styles.scorebugLive} style={{ fontSize: '0.52rem' }}>
                            <span className={styles.scorebugLiveDot} />LIVE
                          </span>
                          <div className={styles.railScoreNum}>
                            {followedCurrentGame.awayTeamId === followedTeamId ? (
                              <>{followedCurrentGame.awayScore}<span className={styles.railScoreDash}>-</span>{followedCurrentGame.homeScore}</>
                            ) : (
                              <>{followedCurrentGame.homeScore}<span className={styles.railScoreDash}>-</span>{followedCurrentGame.awayScore}</>
                            )}
                          </div>
                        </>
                      ) : followedNextGame ? (
                        <>
                          <div className={styles.railNextUp}>NEXT UP</div>
                          <div className={styles.railNextTime}>
                            {followedNextGame.time ? formatTime(followedNextGame.time) : 'TBD'}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {followedOpponentName && (
                    <div className={styles.railCardBody}>
                      <div className={styles.railOpp}>vs {followedOpponentName}</div>
                    </div>
                  )}
                </div>

                {fanAlertsEnabled && selectedTournament && (
                  <FollowAlertsToggle
                    orgSlug={orgSlug}
                    tournamentSlug={tournamentSlug}
                    tournamentId={selectedTournament.id}
                    team={{ id: followedTeam.id, name: followedTeam.name }}
                  />
                )}

                <button type="button" className={styles.railCalendarBtn} onClick={handleAddToCalendar}>
                  <CalendarPlus size={13} /> Add My Games to Calendar
                </button>

                <button type="button" className={styles.stopFollowingBtn} onClick={stopFollowing}>
                  <X size={12} /> Unfollow {followedTeam.name}
                </button>
              </div>
            )}
          </div>{/* /scheduleLayout */}
        </div>
      </div>
    </div>
  );
}
