'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Calendar, CalendarPlus, Trophy, List, LayoutTemplate, Search, ChevronDown, ChevronRight, Star, X, Megaphone } from 'lucide-react';
import { Game, PublicTeam, Division, Tournament, Announcement } from '@/lib/types';
import { formatTime, formatPoolName } from '@/lib/utils';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isPublicPageEnabled } from '@/lib/public-pages';
import YearSelector from '@/components/YearSelector';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import styles from '@/app/[orgSlug]/schedule/schedule.module.css';
import { LogicSyncBracket } from '@/components/bracket/LogicSyncBracket';
import { bracketRoundInfo, bracketRoundLabel, groupGamesByBracketId } from '@/lib/playoff-bracket';
import { computePlacementStandings } from '@/lib/playoff-standings';
import { isPlayoffOnly as resolveIsPlayoffOnly } from '@/lib/tournament-phase';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import { readFollowedTeamId, clearFollowedTeam, isTournamentInProgress, followKey } from '@/lib/follow';
import { isGameLive, gameStartMs, isGameUpcoming, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { tournamentToday } from '@/lib/timezone';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { downloadTeamScheduleICS } from '@/lib/team-calendar';
import FollowAlertsToggle from '@/components/public/FollowAlertsToggle';
import FollowTeamPicker from '@/components/public/FollowTeamPicker';
import RollingNumber from '@/components/public/RollingNumber';
import { teamAvatarHue, teamInitials } from '@/lib/team-color';

// ── bracket helpers ───────────────────────────────────────────────────────────

function bracketPriority(code?: string) {
  // Shared round ordering: single-elim rounds first, then double-elim
  // winners → losers → grand final, then consolation.
  return code ? bracketRoundInfo(code).rank : 99;
}

/** Plain-language label for a division's bracket elimination format. */
function playoffFormatLabel(format?: string): string | null {
  if (format === 'double') return 'Double Elimination';
  if (format === 'consolation') return '2-Game Guarantee';
  if (format === 'placement') return 'Full Placement';
  if (format === 'single') return 'Single Elimination';
  return null;
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
type ScheduleStage = 'pool' | 'playoff';
type BracketLayout = 'list' | 'bracket';

// ── Scorebug helpers ──────────────────────────────────────────────────────────

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

function calcDivisionStandings(divisionId: string, allGames: Game[], allTeams: PublicTeam[]): StandingRow[] {
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
  const [teams, setTeams]           = useState<PublicTeam[]>(() => initialData?.teams ?? []);
  const [divisions, setDivisions]   = useState<Division[]>(() => initialData?.divisions ?? []);
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => initialData?.announcements ?? []);
  // Session-only dismissal — a pinned rain-delay notice returns on the next visit
  // until the organizer unpins it (we don't let fans permanently bury urgent news).
  const [dismissedAnnIds, setDismissedAnnIds] = useState<Set<string>>(() => new Set());
  const [allTournaments, setAllTournaments] = useState<Tournament[]>(() => initialData?.tournaments ?? []);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(() => initialData?.tournament ?? null);
  const [activeGroup, setActiveGroup]     = useState<string>(() => {
    const groups = initialData?.divisions ?? [];
    if (groups.length === 0) return '';
    const pref = getDivisionPref(orgSlug);
    const preferred = pref ? groups.find(g => g.name === pref) : null;
    return (preferred ?? groups[0]).id;
  });
  const [viewMode, setViewMode]           = useState<ScheduleStage>(() => resolveIsPlayoffOnly(initialData?.tournament) ? 'playoff' : 'pool');
  const [bracketLayout, setBracketLayout] = useState<BracketLayout>(() => resolveIsPlayoffOnly(initialData?.tournament) ? 'bracket' : 'list');
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

  // Bracket-only tournaments have no round-robin stage — never sit on the empty
  // pool stage, and the pool/playoff toggle is hidden below.
  const isPlayoffOnly = resolveIsPlayoffOnly(selectedTournament);
  useEffect(() => {
    if (isPlayoffOnly && viewMode === 'pool') setViewMode('playoff');
  }, [isPlayoffOnly, viewMode]);

  useEffect(() => {
    // Browser-local preference hydrates after the public page renders — and must
    // stay in sync when the inline picker (same tab) or another tab changes the
    // followed team. Without the `fl-follow-change` subscription, picking a team
    // writes localStorage but ScheduleContent never re-reads it, so the pin
    // silently fails (dropdown closes, nothing follows).
    const sync = () => {
      setFollowedTeamId(readFollowedTeamId(orgSlug, tournamentSlug));
      setFollowedFilterApplied(false);
    };
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === followKey(orgSlug, tournamentSlug)) sync();
    };
    window.addEventListener('fl-follow-change', sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('fl-follow-change', sync);
      window.removeEventListener('storage', onStorage);
    };
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
      setAnnouncements(data?.announcements ?? []);
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
      setAnnouncements(data.announcements ?? []);
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
    // Published schedules always show real team names (mig 129). Fall back to the
    // placeholder only for a genuinely unassigned slot (bye / unseeded bracket spot).
    if (id && id !== NIL_UUID) {
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

  // Coach names are stripped from the payload when the organizer's public-site toggle is off
  // (mig 150); their presence tells us whether to mention coaches in the search affordances.
  const showCoachNames = teams.some(t => !!t.coach);

  function nextUpDateLabel(date: string): string {
    if (date === today) return 'Today';
    const tmrw = new Date(today + 'T12:00:00');
    tmrw.setDate(tmrw.getDate() + 1);
    if (date === tmrw.toISOString().slice(0, 10)) return 'Tomorrow';
    return new Date(date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

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

  const today = tournamentToday();

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

  // Live game for the scorebug — in its time-window (J6-013), matching the dock (any
  // in-window game, score or not; the scorebug renders a missing score as 0–0).
  const followedCurrentGame = useMemo(() => {
    if (!followedTeamId) return null;
    return games
      .filter(g =>
        isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES) &&
        (g.homeTeamId === followedTeamId || g.awayTeamId === followedTeamId)
      )
      .sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))[0] ?? null;
  }, [followedTeamId, games]);

  // Next upcoming scheduled game for the followed team — time-aware so a past-due
  // unscored game stops pinning as NEXT all day (J6-039).
  const followedNextGame = useMemo(() => {
    if (!followedTeamId) return null;
    return games
      .filter(g => {
        if (g.status !== 'scheduled') return false;
        if (g.homeTeamId !== followedTeamId && g.awayTeamId !== followedTeamId) return false;
        return gameStartMs(g) == null ? g.date >= today : isGameUpcoming(g);
      })
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
    const winnerCode = ph.match(/(?:Winner|Loser) ([\w-]+)/)?.[1];
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

  function renderDateLabel(date: string, dayGames: Game[]) {
    const total = dayGames.length;
    const done = dayGames.filter(g =>
      (g.status === 'completed' || g.status === 'submitted') &&
      g.homeScore != null && g.awayScore != null
    ).length;
    return (
      <div className={styles.dateLabel}>
        <span className={styles.dateLabelText}>{formatDividerDate(date)}</span>
        {date === today && <span className={styles.todayBadge}>Today</span>}
        <span className={styles.dateLabelRule} />
        {total > 0 && (
          <span className={styles.dateProgress} data-complete={done === total ? 'true' : undefined}>
            {done}/{total}
          </span>
        )}
      </div>
    );
  }

  function renderGameCard(game: Game, extraClass: string, typeLabel: React.ReactNode) {
    const hasScore = (game.status === 'completed' || game.status === 'submitted') &&
      game.homeScore != null && game.awayScore != null;
    const winner = getWinner(game);
    const awayName = getTeamDisplay(game, false);
    const homeName = getTeamDisplay(game, true);

    // Mobile rows mirror the Recent-Scores cards: winner score green, loser dimmed
    // (not red), tie gold; the winning side also gets a trophy.
    const mobileScoreStyle = (side: 'home' | 'away') =>
      !hasScore ? { color: 'var(--white-75)' }
      : winner === 'tie' ? { color: 'var(--warning)' }
      : { color: winner === side ? 'var(--success)' : 'var(--white-40)' };
    const mobileNameStyle = (side: 'home' | 'away') =>
      hasScore && winner !== 'tie' && winner !== side ? { color: 'var(--white-40)' } : undefined;

    const isLive = isGameLive(game, game.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES);
    const statusBadge =
      isLive ? <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
      : game.status === 'cancelled' ? <span className="badge badge-danger">Cancelled</span>
      : game.status === 'completed' ? <span className="badge badge-success">Final</span>
      : game.status === 'submitted'
        ? (requireFinalization
            ? <span className="badge badge-warning">Unofficial</span>
            : <span className="badge badge-success">Final</span>)
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
          <div className={`${styles.matchRow} ${winner === 'away' ? styles.matchWin : winner === 'home' ? styles.matchLose : ''}`}>
            <span className={styles.matchWinSlot}>{hasScore && winner === 'away' && <Trophy size={14} aria-label="Winner" />}</span>
            <span className={styles.matchTeam} title={awayName}>{awayName}</span>
            <span className={styles.matchScore}>{hasScore ? game.awayScore : ''}</span>
          </div>
          <div className={`${styles.matchRow} ${winner === 'home' ? styles.matchWin : winner === 'away' ? styles.matchLose : ''}`}>
            <span className={styles.matchWinSlot}>{hasScore && winner === 'home' && <Trophy size={14} aria-label="Winner" />}</span>
            <span className={styles.matchTeam} title={homeName}>{homeName}</span>
            <span className={styles.matchScore}>{hasScore ? game.homeScore : ''}</span>
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
          {/* away row: name · score */}
          <span className={styles.mobileNameAway} style={mobileNameStyle('away')}>
            {awayName}{isFollowedGame && game.awayTeamId === followedTeamId ? ' ★' : ''}
          </span>
          {/* col 4: away score (winner: trophy + green) */}
          <span className={styles.mobileScoreAway} style={mobileScoreStyle('away')}>
            {hasScore && winner === 'away' && <Trophy size={12} className={styles.mobileWinIcon} aria-label="Winner" />}
            {hasScore ? game.awayScore : ''}
          </span>
          {/* home row: name · score + status badge */}
          <span className={styles.mobileNameHome} style={mobileNameStyle('home')}>
            {homeName}{isFollowedGame && game.homeTeamId === followedTeamId ? ' ★' : ''}
          </span>
          {/* col 4: home score + status badge */}
          <div className={styles.mobileScoreHome}>
            <span className={styles.mobileScoreNum} style={mobileScoreStyle('home')}>
              {hasScore && winner === 'home' && <Trophy size={12} className={styles.mobileWinIcon} aria-label="Winner" />}
              {hasScore ? game.homeScore : ''}
            </span>
            <span className={styles.mobileRowStatus}>{statusBadge ?? typeLabel}</span>
          </div>
        </div>
      </>
    );

    // ── Broadcast card — the marquee treatment, reserved for LIVE games so a
    //    finished day doesn't become a wall of giant cards. Final/scheduled keep
    //    the dense row above.
    const awayTotal = (game.awayScore ?? 0);
    const homeTotal = (game.homeScore ?? 0);
    const scoreSum = awayTotal + homeTotal;
    const awayShare = scoreSum > 0 ? Math.round((awayTotal / scoreSum) * 100) : 50;
    const awayHue = awayName !== 'TBD' ? `hsl(${teamAvatarHue(awayName)}, 58%, 42%)` : 'var(--white-20)';
    const homeHue = homeName !== 'TBD' ? `hsl(${teamAvatarHue(homeName)}, 58%, 42%)` : 'var(--white-20)';

    const broadcastContent = (
      <>
        <div className={styles.bcTop}>
          <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
          <span className={styles.bcTime}>{game.time ? formatTime(game.time) : 'TBD'}</span>
          {typeLabel && <span className={styles.bcType}>{typeLabel}</span>}
          {isFollowedGame && <Star size={14} fill="currentColor" className={styles.bcStar} aria-label="Followed team game" />}
        </div>
        <div className={styles.bcBody}>
          <div className={`${styles.bcTeam} ${winner === 'away' ? styles.bcLead : ''}`}>
            <span className={styles.bcAvatar} style={{ background: awayHue }}>
              {awayName !== 'TBD' ? teamInitials(awayName) : '?'}
            </span>
            <span className={styles.bcName} title={awayName}>{awayName}</span>
            <RollingNumber value={game.awayScore ?? 0} className={styles.bcScore} />
          </div>
          <div className={`${styles.bcTeam} ${winner === 'home' ? styles.bcLead : ''}`}>
            <span className={styles.bcAvatar} style={{ background: homeHue }}>
              {homeName !== 'TBD' ? teamInitials(homeName) : '?'}
            </span>
            <span className={styles.bcName} title={homeName}>{homeName}</span>
            <RollingNumber value={game.homeScore ?? 0} className={styles.bcScore} />
          </div>
        </div>
        <div className={styles.bcBar} aria-hidden="true">
          <span className={styles.bcBarSeg} style={{ width: `${awayShare}%`, background: awayHue }} />
          <span className={styles.bcBarSeg} style={{ width: `${100 - awayShare}%`, background: homeHue }} />
        </div>
      </>
    );

    const broadcastClass = `${styles.broadcastCard} ${extraClass} ${isFollowedGame ? styles.followedBroadcast : ''} ${flippedGameIds.has(game.id) ? styles.scoreFlip : ''}`;
    const wrapperClass = isLive ? broadcastClass : rowClassName;
    const content = isLive ? broadcastContent : rowContent;

    if (isPreview) {
      return (
        <div
          key={game.id}
          data-status={game.status}
          className={wrapperClass}
        >
          {content}
        </div>
      );
    }

    return (
      <Link
        key={game.id}
        href={gameHref}
        prefetch={false}
        data-status={game.status}
        className={wrapperClass}
        aria-label={`View game details for ${gameLabel}`}
      >
        {content}
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

      {/* Pinned announcements surface here on game day so a rain-delay/urgent notice
          is seen without hunting for the News tab (J6-033). Session-dismissible. */}
      {isTournamentInProgress(selectedTournament) &&
        announcements.some(a => a.pinned && !dismissedAnnIds.has(a.id)) && (
        <div className="section" style={{ paddingBottom: 0 }}>
          <div className="container">
            {announcements
              .filter(a => a.pinned && !dismissedAnnIds.has(a.id))
              .map(a => (
                <div
                  key={a.id}
                  role="alert"
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
                    padding: '0.8rem 0.9rem', marginBottom: '0.75rem', borderRadius: 10,
                    border: '1px solid rgba(var(--warning-rgb), 0.35)',
                    background: 'rgba(var(--warning-rgb), 0.1)',
                  }}
                >
                  <Megaphone size={18} style={{ flexShrink: 0, color: 'var(--warning)', marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 0.15rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--white)' }}>{a.title}</p>
                    {a.body && (
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--white-55)', lineHeight: 1.45 }}>
                        {a.body.slice(0, 240)}{a.body.length > 240 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissedAnnIds(prev => new Set(prev).add(a.id))}
                    aria-label="Dismiss announcement"
                    style={{ flexShrink: 0, background: 'transparent', border: 'none', color: 'var(--white-55)', cursor: 'pointer', padding: 2 }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

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
                    <Link
                      href={`/${orgSlug}/${tournamentSlug}/teams/${followedTeam.id}`}
                      className={styles.scorebugLink}
                      aria-label={`${followedTeam.name} — view team page`}
                    >
                    <div
                      className={styles.scorebugAvatar}
                      style={{ background: `hsl(${teamAvatarHue(followedTeam.name)}, 58%, 38%)` }}
                    >
                      {teamInitials(followedTeam.name)}
                    </div>
                    <div className={styles.scorebugBody}>
                      <div className={styles.scorebugName}>
                        <span className={styles.scorebugNameText}>{followedTeam.name}</span>
                        <ChevronRight size={13} className={styles.scorebugGo} aria-hidden="true" />
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
                            <RollingNumber value={followedCurrentGame.awayTeamId === followedTeamId ? followedCurrentGame.awayScore : followedCurrentGame.homeScore} />
                            <span className={styles.scorebugScoreDash}>-</span>
                            <RollingNumber value={followedCurrentGame.awayTeamId === followedTeamId ? followedCurrentGame.homeScore : followedCurrentGame.awayScore} />
                          </div>
                        </>
                      ) : followedNextGame ? (
                        <>
                          <div className={styles.scorebugNextUp}>NEXT UP</div>
                          {followedNextGame.date && (
                            <div className={styles.scorebugNextDate}>{nextUpDateLabel(followedNextGame.date)}</div>
                          )}
                          <div className={styles.scorebugNextTime}>
                            {followedNextGame.time ? formatTime(followedNextGame.time) : 'TBD'}
                          </div>
                        </>
                      ) : null}
                    </div>
                    </Link>
                    <button
                      type="button"
                      className={styles.scorebugStop}
                      onClick={stopFollowing}
                      aria-label={`Following ${followedTeam.name} — tap to unfollow`}
                      title="Following — tap to unfollow"
                    >
                      <Star size={16} fill="currentColor" />
                    </button>
                  </>
                ) : (
                  <FollowTeamPicker
                    orgSlug={orgSlug}
                    tournamentSlug={tournamentSlug}
                    teams={divisionTeams}
                  />
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
                      <Star size={11} /> My Games
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.myGamesLink}
                    onClick={handleAddToCalendar}
                  >
                    <CalendarPlus size={11} /> Calendar
                  </button>
                  {fanAlertsEnabled && selectedTournament && selectedTournament.status !== 'completed' && (
                    <FollowAlertsToggle
                      orgSlug={orgSlug}
                      tournamentSlug={tournamentSlug}
                      tournamentId={selectedTournament.id}
                      team={{ id: followedTeam.id, name: followedTeam.name }}
                      variant="pill"
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
            </div>
            {/* Stage toggle anchored left; the playoff List/Bracket display toggle
                grows in to its right — kept off the search row so search never shrinks. */}
            {(!isPlayoffOnly || viewMode === 'playoff') && (
              <div className={styles.mobileStageRow}>
                {!isPlayoffOnly && (
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
                )}
                {viewMode === 'playoff' && (
                  <div className={`${styles.segmentedControl} ${styles.mobileBracketInline}`} role="group" aria-label="Playoff view">
                    <button
                      type="button"
                      className={`${styles.segmentButton} ${bracketLayout === 'list' ? styles.segmentActive : ''}`}
                      aria-pressed={bracketLayout === 'list'}
                      onClick={() => setBracketLayout('list')}
                      aria-label="List view"
                      title="List view"
                    >
                      <List size={14} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.segmentButton} ${bracketLayout === 'bracket' ? styles.segmentActive : ''}`}
                      aria-pressed={bracketLayout === 'bracket'}
                      onClick={() => setBracketLayout('bracket')}
                      aria-label="Bracket view"
                      title="Bracket view"
                    >
                      <LayoutTemplate size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Search on its own full-width row. Plain free-text filter — no native
                datalist, so it reads as a search box, not a dropdown. Hidden in the
                bracket diagram (search is useless against it). */}
            {activeVisibility !== 'unpublished' && !(viewMode === 'playoff' && bracketLayout === 'bracket') && (
              <div className={`${styles.teamFilter} ${styles.mobileTeamFilter} ${styles.mobileSearchRow}`}>
                <Search size={14} className={styles.teamFilterIcon} />
                <input
                  type="text"
                  className="form-input"
                  placeholder={showCoachNames ? 'Search team or coach...' : 'Search team...'}
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                />
                {teamSearch && (
                  <button type="button" className={styles.clearFilter} onClick={() => setTeamSearch('')} aria-label="Clear team filter"><X size={12} /></button>
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
              {!isPlayoffOnly && (
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
              )}
              {/* List/Bracket display toggle — sits beside the stage toggle (Playoffs only). */}
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

            <div className={styles.secondaryControls}>
              {/* Search is useless in the bracket diagram → hide it there. */}
              {activeVisibility !== 'unpublished' && !(viewMode === 'playoff' && bracketLayout === 'bracket') && (
                <div className={styles.teamFilter}>
                  <Search size={14} className={styles.teamFilterIcon} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder={showCoachNames ? 'Search team or coach...' : 'Search team...'}
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                  />
                  {teamSearch && (
                    <button type="button" className={styles.clearFilter} onClick={() => setTeamSearch('')} aria-label="Clear team filter"><X size={12} /></button>
                  )}
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

          {/* Bracket format badge — per-division, shown on the Playoffs stage. */}
          {viewMode === 'playoff' && activeVisibility !== 'unpublished' && (() => {
            const label = playoffFormatLabel(activeG?.playoffConfig?.format);
            if (!label) return null;
            return (
              <div style={{ marginBottom: '0.85rem' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.32rem 0.7rem', borderRadius: '999px',
                  background: 'rgba(var(--primary-rgb), 0.12)',
                  border: '1px solid rgba(var(--primary-rgb), 0.3)',
                  color: 'var(--primary-light)', fontSize: '0.72rem', fontWeight: 700,
                  letterSpacing: '0.03em', textTransform: 'uppercase',
                }}>
                  <Trophy size={12} /> {label}
                </span>
              </div>
            );
          })()}

          {/* Full-placement final standings — every team ranked 1..N once decided. */}
          {viewMode === 'playoff' && activeVisibility !== 'unpublished' && activeG?.playoffConfig?.format === 'placement' && (() => {
            const standings = computePlacementStandings(
              games.filter(g => g.divisionId === activeG.id && g.isPlayoff),
              teams,
            );
            if (!standings.some(r => r.teamName)) return null;
            return (
              <div style={{
                marginBottom: '1.25rem', borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(var(--primary-rgb), 0.25)', background: 'var(--surface)',
                boxShadow: 'var(--highlight-top)', overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.65rem 1rem', background: 'rgba(var(--primary-rgb), 0.08)',
                  borderBottom: '1px solid rgba(var(--primary-rgb), 0.18)',
                  fontFamily: 'var(--font-data)', fontWeight: 800, fontSize: '0.72rem',
                  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--primary-light)',
                }}>
                  <Trophy size={14} /> Final Standings
                </div>
                <ol style={{ margin: 0, padding: '0.4rem 0', listStyle: 'none' }}>
                  {standings.map(r => (
                    <li key={r.place} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.4rem 1rem',
                      borderTop: r.place > 1 ? '1px solid var(--white-10)' : undefined,
                    }}>
                      <span style={{
                        minWidth: '2.2rem', fontFamily: 'var(--font-data)', fontWeight: 800,
                        fontSize: '0.85rem', color: r.place <= 3 ? 'var(--primary-light)' : 'var(--white-50)',
                      }}>{ordinal(r.place)}</span>
                      <span style={{ fontWeight: r.place === 1 ? 800 : 600, color: r.teamName ? 'var(--white)' : 'var(--white-40)' }}>
                        {r.teamName ?? 'TBD'}
                      </span>
                      {r.place === 1 && r.teamName && <Trophy size={13} style={{ color: 'var(--warning)' }} />}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })()}

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
              {[0, 1].map(group => (
                <div key={group} className={styles.skelGroup}>
                  <div className={`${styles.skelLabel} ${styles.skeletonPulse}`} />
                  {[0, 1, 2].map(row => (
                    <div key={row} className={styles.skelRow}>
                      <div className={`${styles.skelAvatar} ${styles.skeletonPulse}`} />
                      <div className={styles.skelLines}>
                        <div className={`${styles.skelLineWide} ${styles.skeletonPulse}`} />
                        <div className={`${styles.skelLineNarrow} ${styles.skeletonPulse}`} />
                      </div>
                      <div className={`${styles.skelScore} ${styles.skeletonPulse}`} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : sortedDates.length === 0 && !(viewMode === 'playoff' && bracketLayout === 'bracket') && !(viewMode === 'pool' && pools.length >= 2) && !(viewMode === 'playoff' && hasPoolPlaceholders) ? (
            <PublicTournamentState
              icon={<Calendar size={40} />}
              eyebrow="Schedule"
              title={teamSearch ? 'No games match that search' : `No ${viewMode === 'playoff' ? 'playoff ' : ''}games yet`}
              description={teamSearch ? `Try another team name${showCoachNames ? ', coach name' : ''}, or clear the search.` : 'Games will appear here once the organizer adds them.'}
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
                              highlightTeamId={followedTeamId ?? undefined}
                              requireFinalization={requireFinalization}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Tiered (or per-bracket) split: pools don't drive it, but the games
                // span ≥2 independent brackets (each tier its own bracket_id, reusing
                // codes) — render one bracket per group so tiers stay separate.
                const bracketGroups = groupGamesByBracketId(bracketGames);
                if (bracketGroups.length > 1) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                      {bracketGroups.map((grp, i) => (
                        <div key={grp.key}>
                          <PoolHeader name={grp.label || `Bracket ${i + 1}`} />
                          <LogicSyncBracket
                            games={grp.games}
                            teams={teams}
                            tournamentId={selectedTournament!.id}
                            highlightTeamId={followedTeamId ?? undefined}
                            requireFinalization={requireFinalization}
                          />
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <LogicSyncBracket
                    games={bracketGames}
                    teams={teams}
                    tournamentId={selectedTournament!.id}
                    highlightTeamId={followedTeamId ?? undefined}
                    requireFinalization={requireFinalization}
                  />
                );
              }

              // ── LIST VIEW — pool play split ───────────────────────────────
              if (viewMode === 'pool' && pools.length >= 2) {
                // Attribution for dedup so a cross-pool game renders in exactly one section:
                // the HOME slot's pool wins (by team or placeholder); the away slot only
                // claims a game when the home slot belongs to no pool (J6-016).
                const teamPoolId = new Map(teams.filter(t => t.poolId).map(t => [t.id, t.poolId!] as [string, string]));
                const allPoolTags = pools.map(p => `Pool ${p.name.replace(/^Pool\s+/i, '').trim()}`);
                return pools.map(pool => {
                  const bare = pool.name.replace(/^Pool\s+/i, '').trim();
                  const tag  = `Pool ${bare}`;
                  const poolGames = teamFiltered.filter(g => {
                    const homeInPool = !!g.homePlaceholder?.includes(tag);
                    const awayInPool = !!g.awayPlaceholder?.includes(tag);
                    if (homeInPool || awayInPool) {
                      // Home placeholder's pool wins; away claims it only when the home
                      // placeholder isn't tied to any pool — so a cross-pool seeded game
                      // (home "Pool A #1", away "Pool B #2") renders once, under A.
                      if (homeInPool) return true;
                      const homeInAnyPool = allPoolTags.some(t2 => g.homePlaceholder?.includes(t2));
                      return awayInPool && !homeInAnyPool;
                    }
                    const homePool = g.homeTeamId ? teamPoolId.get(g.homeTeamId) : undefined;
                    const awayPool = g.awayTeamId ? teamPoolId.get(g.awayTeamId) : undefined;
                    if (homePool) return homePool === pool.id;
                    if (awayPool) return awayPool === pool.id;
                    return false;
                  });
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
                          {renderDateLabel(date, poolDateGroups[date])}
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
                              {renderDateLabel(date, poolDateGroups[date])}
                              <div className={styles.gamesList}>
                                {poolDateGroups[date].map(game => renderGameCard(
                                  game,
                                  styles.playoffRow,
                                  <span className="badge badge-primary">{bracketRoundLabel(game.bracketCode)}</span>
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
                  {renderDateLabel(date, byDate[date])}
                  <div className={styles.gamesList}>
                    {byDate[date].map(game => renderGameCard(
                      game,
                      game.isPlayoff ? styles.playoffRow : '',
                      game.isPlayoff
                        ? <span className="badge badge-primary">{bracketRoundLabel(game.bracketCode)}</span>
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
                    <Link
                      href={`/${orgSlug}/${tournamentSlug}/teams/${followedTeam.id}`}
                      className={styles.railIdentityLink}
                      aria-label={`${followedTeam.name} — view team page`}
                    >
                    <div
                      className={styles.railAvatar}
                      style={{ background: `hsl(${teamAvatarHue(followedTeam.name)}, 58%, 38%)` }}
                    >
                      {teamInitials(followedTeam.name)}
                    </div>
                    <div className={styles.railTeamInfo}>
                      <div className={styles.railTeamName}>
                        <Star size={11} fill="currentColor" className={styles.railTeamStar} />
                        <span className={styles.railTeamNameText}>{followedTeam.name}</span>
                        <ChevronRight size={12} className={styles.scorebugGo} aria-hidden="true" />
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
                    </Link>
                    <div className={styles.railScoreArea}>
                      {followedCurrentGame ? (
                        <>
                          <span className={styles.scorebugLive} style={{ fontSize: '0.52rem' }}>
                            <span className={styles.scorebugLiveDot} />LIVE
                          </span>
                          <div className={styles.railScoreNum}>
                            <RollingNumber value={followedCurrentGame.awayTeamId === followedTeamId ? followedCurrentGame.awayScore : followedCurrentGame.homeScore} />
                            <span className={styles.railScoreDash}>-</span>
                            <RollingNumber value={followedCurrentGame.awayTeamId === followedTeamId ? followedCurrentGame.homeScore : followedCurrentGame.awayScore} />
                          </div>
                        </>
                      ) : followedNextGame ? (
                        <>
                          <div className={styles.railNextUp}>NEXT UP</div>
                          {followedNextGame.date && (
                            <div className={styles.railNextDate}>{nextUpDateLabel(followedNextGame.date)}</div>
                          )}
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

                {fanAlertsEnabled && selectedTournament && selectedTournament.status !== 'completed' && (
                  <FollowAlertsToggle
                    orgSlug={orgSlug}
                    tournamentSlug={tournamentSlug}
                    tournamentId={selectedTournament.id}
                    team={{ id: followedTeam.id, name: followedTeam.name }}
                  />
                )}

                {!isMyTeamFilter && (
                  <button type="button" className={styles.railCalendarBtn} onClick={showFollowedTeamGames}>
                    <Star size={13} /> My Team Games
                  </button>
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
