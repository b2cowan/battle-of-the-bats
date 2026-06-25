'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Search, ChevronDown, Star } from 'lucide-react';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { Game, PublicTeam, Division, Tournament } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import YearSelector from '@/components/YearSelector';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import styles from '@/app/[orgSlug]/teams/teams.module.css';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import { readFollowedTeamId, saveFollowedTeam, clearFollowedTeam, isTournamentInProgress } from '@/lib/follow';
import { isGameLive, gameStartMs, isGameUpcoming } from '@/lib/game-status';
import { tournamentToday } from '@/lib/timezone';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { teamColor, teamInitials } from '@/lib/team-color';
import type { DivisionStandingRow } from '@/lib/tie-breakers';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  isPreview?: boolean;
  initialData?: PublicTournamentPageData;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function cleanTeamName(name: string) {
  return name.replace(/\s*\(.*?\)\s*/g, '').trim();
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

// Team avatar colour + monogram come from lib/team-color so a team's identity is
// identical here, on the schedule, scorebug, dock, broadcast card and team profile.

// Team standings rows come from the canonical engine (computeTournamentStandings,
// via the public payload's standingsByDivision) — the SAME ranking the Standings
// table uses (H2H, run-diff cap, coin toss). No local re-compute here, so a team
// card can't show a rank that contradicts the standings table (J6-032).

// ── Live-game detection ───────────────────────────────────────────────────────

function getGameDuration(division: Division, tournament: Tournament | null): number {
  return division.settings?.game_duration_minutes
    ?? tournament?.settings?.game_duration_minutes
    ?? 90;
}

// ── Team Avatar ───────────────────────────────────────────────────────────────

function TeamAvatar({ name, size = 48 }: { name: string; size?: number }) {
  // `name` is the full team name (incl. any parenthetical) so the hue + monogram
  // match the same team elsewhere; teamInitials strips the parenthetical itself.
  return (
    <div
      className={styles.teamAvatar}
      style={{ background: teamColor(name), width: size, height: size, fontSize: size * 0.33 }}
      aria-hidden
    >
      {teamInitials(name)}
    </div>
  );
}

// ── Team Card ─────────────────────────────────────────────────────────────────

function TeamCard({
  team,
  division,
  tournament,
  games,
  teams,
  standings,
  isFollowed,
  isPreview,
  orgSlug,
  tournamentSlug,
  onFollow,
  onUnfollow,
}: {
  team: PublicTeam;
  division: Division;
  tournament: Tournament | null;
  games: Game[];
  teams: PublicTeam[];
  standings: DivisionStandingRow[];
  isFollowed: boolean;
  isPreview: boolean;
  orgSlug: string;
  tournamentSlug: string;
  onFollow: (team: PublicTeam) => void;
  onUnfollow: () => void;
}) {
  const name = cleanTeamName(team.name);
  const stats = standings.find(s => s.teamId === team.id);
  const record = stats ? `${stats.w}-${stats.l}-${stats.t}` : '0-0-0';

  // Pool rank
  const poolRows = team.poolId
    ? standings.filter(s => s.poolId === team.poolId)
    : standings;
  const rankIdx = poolRows.findIndex(s => s.teamId === team.id);
  const rankLabel = rankIdx >= 0 ? ordinal(rankIdx + 1) : null;
  const pts = stats?.pts ?? 0;
  // Rank is only meaningful once a game's been played — otherwise it's just
  // arbitrary list order presented as a standing.
  const poolStarted = poolRows.some(s => s.w + s.l + s.t > 0);

  // Pool name
  const poolName = division.pools?.find(p => p.id === team.poolId)?.name ?? null;

  // Live / next game
  const durationMin = getGameDuration(division, tournament);
  const teamGames = games.filter(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
  // Per-game duration override wins over the division/tournament default, so the live
  // window matches every other surface (which all key off game.durationMinutes first).
  const liveGame = teamGames.find(g => isGameLive(g, g.durationMinutes ?? durationMin));
  const today = tournamentToday();
  const todayDate = new Date(today + 'T12:00:00');
  todayDate.setDate(todayDate.getDate() + 1);
  const tomorrow = todayDate.toISOString().slice(0, 10);
  function gameDay(date: string): string {
    if (date === today) return 'Today';
    if (date === tomorrow) return 'Tomorrow';
    return new Date(date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }
  const nextGame = !liveGame
    ? teamGames
        .filter(g => {
          if (g.status !== 'scheduled') return false;
          return gameStartMs(g) == null ? g.date >= today : isGameUpcoming(g);
        })
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))[0]
    : null;

  const liveOpponent = liveGame
    ? liveGame.homeTeamId === team.id
      ? teams.find(t => t.id === liveGame.awayTeamId)?.name ?? liveGame.awayPlaceholder ?? 'TBD'
      : teams.find(t => t.id === liveGame.homeTeamId)?.name ?? liveGame.homePlaceholder ?? 'TBD'
    : null;

  const nextOpponent = nextGame
    ? nextGame.homeTeamId === team.id
      ? teams.find(t => t.id === nextGame.awayTeamId)?.name ?? nextGame.awayPlaceholder ?? 'TBD'
      : teams.find(t => t.id === nextGame.homeTeamId)?.name ?? nextGame.homePlaceholder ?? 'TBD'
    : null;

  const poolPlayDone =
    !liveGame &&
    !nextGame &&
    teamGames.filter(g => !g.isPlayoff && (g.status === 'completed' || g.status === 'submitted')).length > 0 &&
    teamGames.filter(g => !g.isPlayoff && g.status === 'scheduled').length === 0;

  return (
    <div className={`${styles.teamCard} ${isFollowed ? styles.teamCardFollowed : ''}`}>
      {/* Whole-card link — clicking anywhere navigates to the team page; the
          Follow button sits above it (z-index) so it stays independently clickable. */}
      {!isPreview && (
        <Link
          href={`/${orgSlug}/${tournamentSlug}/teams/${team.id}`}
          prefetch={false}
          className={styles.cardLink}
          aria-label={`View ${name} team page`}
        />
      )}
      <div className={styles.cardTop}>
        <TeamAvatar name={team.name} size={48} />
        <div className={styles.cardMeta}>
          <div className={styles.cardNameRow}>
            <span className={styles.cardName}>{name}</span>
            <span className={styles.cardNameRight}>
              <span className={styles.cardRecord}>{record}</span>
              {!isPreview && <span className={styles.cardChevron} aria-hidden>›</span>}
            </span>
          </div>
          <div className={styles.cardSubRow}>
            {poolName && <span className={styles.cardPool}>· {poolName}</span>}
            {poolStarted && rankLabel && (
              <span className={styles.cardRank}>
                {rankLabel} · {pts} {pts === 1 ? 'pt' : 'pts'}
              </span>
            )}
          </div>
          {team.coach && <span className={styles.cardCoach}>Coach: {team.coach}</span>}
        </div>
      </div>

      <div className={styles.cardBottom}>
        <div className={styles.cardStatus}>
          {liveGame && (
            <span className={styles.liveLine}>
              <span className={styles.liveBadge}>
                <span className={styles.liveDot} />{' '}
                LIVE
              </span>
              <span className={styles.liveOpp}>vs {liveOpponent ? cleanTeamName(liveOpponent) : 'TBD'}</span>
            </span>
          )}
          {!liveGame && nextGame && (
            <span className={styles.nextGame}>
              {gameDay(nextGame.date)}{nextGame.time ? ` · ${formatTime(nextGame.time)}` : ''} vs {nextOpponent ? cleanTeamName(nextOpponent) : 'TBD'}
            </span>
          )}
          {poolPlayDone && (
            <span className={styles.poolDone}>Pool play complete</span>
          )}
        </div>

        {!isPreview && (
          <div className={styles.cardActions}>
            <button
              type="button"
              className={`${styles.followBtn} ${isFollowed ? styles.followBtnActive : ''}`}
              onClick={() => isFollowed ? onUnfollow() : onFollow(team)}
              aria-pressed={isFollowed}
            >
              <Star size={12} fill={isFollowed ? 'currentColor' : 'none'} />
              {isFollowed ? 'Following' : 'Follow'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeamsContent({ orgSlug, tournamentSlug, isPreview = false, initialData }: Props) {
  const [teams, setTeams]           = useState<PublicTeam[]>(() => initialData?.teams ?? []);
  const [divisions, setDivisions]   = useState<Division[]>(() => initialData?.divisions ?? []);
  // True once fetched (or immediately with initialData) — gates the empty state so it
  // doesn't flash during the initial client fetch (J6-026).
  const [loaded, setLoaded] = useState(() => !!initialData);
  const [games, setGames]           = useState<Game[]>(() => initialData?.games ?? []);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>(() => initialData?.tournaments ?? []);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(() => initialData?.tournament ?? null);
  const [contactEmail, setContactEmail] = useState<string | null>(
    () => initialData?.tournament?.contactEmail ?? initialData?.organization?.contactEmail ?? null
  );
  const [activeDivisionId, setActiveDivisionId] = useState<string>(() => {
    const groups = initialData?.divisions ?? [];
    if (groups.length === 0) return '';
    const pref = getDivisionPref(orgSlug);
    const preferred = pref ? groups.find(g => g.name === pref) : null;
    return preferred?.id ?? groups[0]?.id ?? '';
  });
  const [search, setSearch]         = useState('');
  const [followedTeamId, setFollowedTeamId] = useState<string | null>(null);
  const [standingsByDivision, setStandingsByDivision] = useState<Record<string, DivisionStandingRow[]>>(
    () => initialData?.standingsByDivision ?? {},
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowedTeamId(readFollowedTeamId(orgSlug, tournamentSlug));
  }, [orgSlug, tournamentSlug]);

  useEffect(() => {
    if (initialData) return;
    async function init() {
      const data = await fetchPublicTournamentData(orgSlug, tournamentSlug, 'teams');
      const current = data?.tournament ?? null;
      setAllTournaments(data?.tournaments ?? []);
      setSelectedTournament(current);
      setContactEmail(current?.contactEmail ?? data?.organization?.contactEmail ?? null);
      setTeams(data?.teams ?? []);
      setGames(data?.games ?? []);
      setStandingsByDivision(data?.standingsByDivision ?? {});
      const groups = data?.divisions ?? [];
      setDivisions(groups);
      if (groups.length > 0) {
        const pref = getDivisionPref(orgSlug);
        const preferred = pref ? groups.find(g => g.name === pref) : null;
        setActiveDivisionId(preferred?.id ?? groups[0]?.id ?? '');
      }
      setLoaded(true);
    }
    init();
  }, [orgSlug, tournamentSlug, initialData]);

  // ── live refresh (game day only) ─────────────────────────────────────────────
  usePublicTournamentLive({
    orgSlug,
    tournamentSlug,
    section: 'teams',
    enabled: isTournamentInProgress(selectedTournament),
    onData: data => {
      setTeams(data.teams ?? []);
      setGames(data.games ?? []);
      setDivisions(data.divisions ?? []);
      setStandingsByDivision(data.standingsByDivision ?? {});
    },
  });

  const activeDivision = divisions.find(d => d.id === activeDivisionId) ?? divisions[0] ?? null;

  // Coach names are stripped from the payload when the organizer's public-site toggle is off
  // (mig 150) — so their presence in the data tells us whether to mention coaches in the UI.
  const showCoachNames = teams.some(t => !!t.coach);

  const filtered = teams
    .filter(t => !activeDivision || t.divisionId === activeDivision.id)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || (t.coach && t.coach.toLowerCase().includes(q));
    });

  const divisionStandings = activeDivision
    ? (standingsByDivision[activeDivision.id] ?? [])
    : [];

  // Order cards by standing once the division has results; before that, fall back
  // to alphabetical (a standings sort would just be arbitrary registration order).
  // The followed team is always pinned to the top of its pool.
  const standingRank = new Map(divisionStandings.map((s, i) => [s.teamId, i]));
  const sortForDisplay = (arr: PublicTeam[]): PublicTeam[] => {
    // "Started?" is judged per group (the rows actually being sorted), not
    // division-wide — otherwise a not-yet-played pool in a multi-pool division
    // would sort by arbitrary registration order instead of alphabetically.
    const groupStarted = arr.some(t => {
      const s = divisionStandings.find(r => r.teamId === t.id);
      return s ? s.w + s.l + s.t > 0 : false;
    });
    const base = groupStarted
      ? [...arr].sort((a, b) => (standingRank.get(a.id) ?? 999) - (standingRank.get(b.id) ?? 999))
      : [...arr].sort((a, b) => cleanTeamName(a.name).localeCompare(cleanTeamName(b.name)));
    const idx = followedTeamId ? base.findIndex(t => t.id === followedTeamId) : -1;
    if (idx > 0) base.unshift(base.splice(idx, 1)[0]);
    return base;
  };

  // Only reserve dock clearance when the dock can actually render (game day + a
  // followed team) — matches MyTeamDock's own gate so we don't leave dead space
  // at the bottom for everyone else (J6-041 review).
  const dockActive = isTournamentInProgress(selectedTournament) && !!followedTeamId;
  const homeHref = `/${orgSlug}/${tournamentSlug}`;
  const registerHref = `/${orgSlug}/${tournamentSlug}/register`;
  const scheduleHref = `/${orgSlug}/${tournamentSlug}/schedule`;
  const canRegister = Boolean(selectedTournament && isPublicPageEnabled(selectedTournament, 'register'));
  const showSchedulePage = Boolean(selectedTournament && isPublicPageEnabled(selectedTournament, 'schedule'));

  function followTeam(team: PublicTeam) {
    saveFollowedTeam(orgSlug, tournamentSlug, team);
    setFollowedTeamId(team.id);
    if (team.divisionId) {
      setActiveDivisionId(team.divisionId);
      setDivisionPref(orgSlug, divisions.find(g => g.id === team.divisionId)?.name ?? '');
    }
  }

  function stopFollowing() {
    clearFollowedTeam(orgSlug, tournamentSlug);
    setFollowedTeamId(null);
  }

  if (selectedTournament && !isPublicPageEnabled(selectedTournament, 'teams')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<Users size={40} />}
              eyebrow="Teams"
              title="Teams unavailable"
              description="The organizer has hidden the public teams page for this tournament."
              actions={!isPreview ? [{ href: homeHref, label: 'Tournament Home', variant: 'ghost' as const }] : []}
            />
          </div>
        </div>
      </div>
    );
  }

  // Build pool groups within the active division
  const poolGroups: { poolId: string | null; poolName: string; teams: PublicTeam[] }[] = [];
  if (activeDivision) {
    const hasPools = (activeDivision.poolCount ?? 0) >= 2 && (activeDivision.pools?.length ?? 0) >= 2;
    if (hasPools) {
      (activeDivision.pools ?? []).forEach(p => {
        const poolTeams = sortForDisplay(filtered.filter(t => t.poolId === p.id));
        if (poolTeams.length > 0) poolGroups.push({ poolId: p.id, poolName: p.name, teams: poolTeams });
      });
      const poolIds = new Set((activeDivision.pools ?? []).map(p => p.id));
      const unassigned = sortForDisplay(filtered.filter(t => !t.poolId || !poolIds.has(t.poolId)));
      if (unassigned.length > 0) poolGroups.push({ poolId: null, poolName: 'Awaiting Assignment', teams: unassigned });
    } else {
      if (filtered.length > 0) poolGroups.push({ poolId: null, poolName: '', teams: sortForDisplay(filtered) });
    }
  }

  const teamCardProps = {
    tournament: selectedTournament,
    games,
    teams,
    standings: divisionStandings,
    isPreview,
    orgSlug,
    tournamentSlug,
    onFollow: followTeam,
    onUnfollow: stopFollowing,
  };

  return (
    <div className={`page-content ${dockActive ? styles.dockClear : ''}`}>
      <div className="section">
        <div className="container">

          {!isPreview && (
            <YearSelector
              tournaments={allTournaments}
              orgSlug={orgSlug}
              currentTournamentSlug={tournamentSlug}
              currentPage="teams"
            />
          )}

          {/* Page heading */}
          <div className={styles.pageHeading}>
            <h1 className={styles.pageTitle}>
              <Users size={20} />
              Teams
              {teams.length > 0 && <span className={styles.teamCount}>· {teams.length}</span>}
            </h1>
          </div>

          {/* Division filter + search */}
          <div className={styles.filterRow}>
            {divisions.length > 1 && (
              <div className={`select-wrapper ${styles.divisionSelect}`}>
                <select
                  className="form-select"
                  value={activeDivisionId}
                  onChange={e => {
                    setActiveDivisionId(e.target.value);
                    const div = divisions.find(d => d.id === e.target.value);
                    if (div) setDivisionPref(orgSlug, div.name);
                  }}
                >
                  {divisions.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({teams.filter(t => t.divisionId === d.id).length})
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="select-icon" />
              </div>
            )}
            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder={showCoachNames ? 'Search teams or coaches...' : 'Search teams...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Content */}
          {loaded && filtered.length === 0 ? (
            <PublicTournamentState
              icon={<Users size={40} />}
              eyebrow="Teams"
              title={search ? 'No teams match that search' : 'No approved teams yet'}
              description={
                search
                  ? 'Try another team name, coach name, or clear the search.'
                  : canRegister
                    ? 'Approved teams will appear here after registration review.'
                    : 'Teams will appear here after the organizer confirms them.'
              }
              contactEmail={contactEmail}
              actions={!isPreview ? [
                ...(!search && canRegister ? [{ href: registerHref, label: 'Register', variant: 'lime' as const }] : []),
                ...(showSchedulePage ? [{ href: scheduleHref, label: 'View Schedule', variant: 'ghost' as const }] : []),
              ] : []}
              compact
            />
          ) : activeDivision ? (
            <div className={styles.divisionLayout}>
              {poolGroups.map(pg => (
                <div key={pg.poolId ?? '__none'} className={styles.poolSection}>
                  {pg.poolName && (
                    <h2 className={styles.poolHeading}>
                      {pg.poolName.replace(/^Pool\s+/i, '').trim()} Pool
                    </h2>
                  )}
                  <div className={styles.teamGrid}>
                    {pg.teams.map(team => (
                      <TeamCard
                        key={team.id}
                        team={team}
                        isFollowed={followedTeamId === team.id}
                        {...teamCardProps}
                        division={activeDivision}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
