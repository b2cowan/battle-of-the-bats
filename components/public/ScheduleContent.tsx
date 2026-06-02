'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Calendar, Trophy, List, LayoutTemplate, Search, ChevronDown, Star, X, SlidersHorizontal, Info } from 'lucide-react';
import { Game, Team, Division, Venue, Tournament } from '@/lib/types';
import LocationLink from '@/components/LocationLink';
import { formatTime, formatPoolName } from '@/lib/utils';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isPublicPageEnabled } from '@/lib/public-pages';
import YearSelector from '@/components/YearSelector';
import styles from '@/app/[orgSlug]/schedule/schedule.module.css';
import { LogicSyncBracket } from '@/components/bracket/LogicSyncBracket';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';

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

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  isPreview?: boolean;
  initialData?: PublicTournamentPageData;
}

function followKey(orgSlug: string, tournamentSlug: string) {
  return `fl_follow_team_${orgSlug}_${tournamentSlug}`;
}

function readFollowedTeamId(orgSlug: string, tournamentSlug: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(followKey(orgSlug, tournamentSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed.id ?? null;
  } catch {
    return null;
  }
}

function clearFollowedTeam(orgSlug: string, tournamentSlug: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(followKey(orgSlug, tournamentSlug));
}

export default function ScheduleContent({ orgSlug, tournamentSlug, isPreview = false, initialData }: Props) {
  const [games, setGames]           = useState<Game[]>(() => initialData?.games ?? []);
  const [teams, setTeams]           = useState<Team[]>(() => initialData?.teams ?? []);
  const [divisions, setDivisions]   = useState<Division[]>(() => initialData?.divisions ?? []);
  const [venues, setVenues]         = useState<Venue[]>(() => initialData?.venues ?? []);
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
  const [followedTeamId, setFollowedTeamId] = useState<string | null>(null);
  const [followedFilterApplied, setFollowedFilterApplied] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftViewMode, setDraftViewMode] = useState<ScheduleStage>('pool');
  const [draftBracketLayout, setDraftBracketLayout] = useState<BracketLayout>('list');
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

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
  }, [orgSlug, tournamentSlug, initialData]);

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
  const activeFilterCount =
    (viewMode === 'playoff' ? 1 : 0) +
    (viewMode === 'playoff' && bracketLayout === 'bracket' ? 1 : 0);
  const activeViewSummary = viewMode === 'playoff'
    ? `Playoffs - ${bracketLayout === 'bracket' ? 'Bracket' : 'List'}`
    : 'Pool Play';

  function selectDivision(nextGroup: string, clearTeam = true) {
    setActiveGroup(nextGroup);
    if (clearTeam) setTeamSearch('');
    setDivisionPref(orgSlug, divisions.find(g => g.id === nextGroup)?.name ?? '');
  }

  function openFilterSheet() {
    setDraftViewMode(viewMode);
    setDraftBracketLayout(bracketLayout);
    setFilterSheetOpen(true);
  }

  function closeFilterSheet() {
    setFilterSheetOpen(false);
  }

  function resetDraftFilters() {
    setDraftViewMode('pool');
    setDraftBracketLayout('list');
  }

  function applyDraftFilters() {
    setViewMode(draftViewMode);
    setBracketLayout(draftBracketLayout);
    closeFilterSheet();
  }

  function handleSheetKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFilterSheet();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const nodes = Array.from(focusable ?? []).filter(node => !node.hasAttribute('disabled'));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    if (!filterSheetOpen || typeof document === 'undefined') return;
    const returnFocusTo = filterButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => sheetRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      returnFocusTo?.focus();
    };
  }, [filterSheetOpen]);

  useEffect(() => {
    if (!followedTeam || followedFilterApplied) return;
    const followedDivision = divisions.find(g => g.id === followedTeam.divisionId);
    if (!followedDivision) return;
    // Apply the browser-local team preference once after public data loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveGroup(followedDivision.id);
    setDivisionPref(orgSlug, followedDivision.name);
    if ((followedDivision.scheduleVisibility ?? 'unpublished') !== 'published_generic') {
      setTeamSearch(followedTeam.name);
    }
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

    const statusBadge =
      game.status === 'cancelled' ? <span className="badge badge-danger">Cancelled</span>
      : game.status === 'completed' ? <span className="badge badge-success">Final</span>
      : game.status === 'submitted' ? (requireFinalization
          ? <span className="badge badge-warning">Pending</span>
          : <span className="badge badge-success">Final</span>)
      : null;

    const isFollowedGame = Boolean(
      followedTeamId &&
      (game.homeTeamId === followedTeamId || game.awayTeamId === followedTeamId)
    );

    const mobileStatusLabel =
      game.status === 'cancelled' ? 'Cancelled'
      : game.status === 'completed' || (game.status === 'submitted' && !requireFinalization) ? 'Final'
      : game.status === 'submitted' ? 'Pending'
      : 'Scheduled';

    return (
      <div
        key={game.id}
        data-status={game.status}
        className={`${styles.gameRow} ${extraClass} ${isFollowedGame ? styles.followedGameRow : ''}`}
      >
        <div className={styles.timeCell}>
          <div className={styles.gameMetaLine}>
            <span className={styles.gameDateText}>{formatRowDate(game.date)}</span>
            <span className={styles.gameTimeText}>{game.time ? `- ${formatTime(game.time)}` : '- TBD'}</span>
          </div>
          <span className={styles.mobileStatusText} data-status={game.status}>{mobileStatusLabel}</span>
        </div>

        <div className={styles.locationCell}>
          <LocationLink location={game.location} venue={getVenue(game.venueId)} size="sm" />
        </div>

        {/* Away on the left, home on the right; scores flank the team names. */}
        <div className={styles.matchupCell}>
          <div className={`${styles.matchSide} ${styles.matchAway}`}>
            {awayOutcome && <span className={styles.resultTag} style={{ color: awayOutcome.color }}>{awayOutcome.label}</span>}
            {hasScore && <span className={styles.matchScore} style={{ color: awayOutcome?.color }}>{game.awayScore}</span>}
            <span className={styles.matchTeam}>{getTeamDisplay(game, false)}</span>
          </div>
          <span className={styles.matchVs}>VS</span>
          <div className={`${styles.matchSide} ${styles.matchHome}`}>
            <span className={styles.matchTeam}>{getTeamDisplay(game, true)}</span>
            {hasScore && <span className={styles.matchScore} style={{ color: homeOutcome?.color }}>{game.homeScore}</span>}
            {homeOutcome && <span className={styles.resultTag} style={{ color: homeOutcome.color }}>{homeOutcome.label}</span>}
          </div>
        </div>

        <div className={styles.statusCell}>
          {typeLabel}
          <span className={styles.desktopStatusSlot}>{statusBadge}</span>
          <span className={styles.followStarSlot}>
            {isFollowedGame && <Star size={15} fill="currentColor" className={styles.followStar} aria-label="Followed team game" />}
          </span>
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
              {!isPreview && <Link href={homeHref} className="btn btn-ghost btn-sm">Tournament Home</Link>}
            </div>
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

          {!isPreview && followedTeam && (
            <div className={styles.followBar}>
              <div className={styles.followMain}>
                <Star size={16} fill="currentColor" />
                <span>Following</span>
                <strong>{followedTeam.name}</strong>
              </div>
              <div className={styles.followActions}>
                <button type="button" className="btn btn-lime btn-sm" onClick={showFollowedTeamGames}>
                  <Calendar size={14} /> My Team Games
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={stopFollowing}>
                  <X size={14} /> Clear
                </button>
              </div>
            </div>
          )}

          {allUnpublished ? (
            <div className="empty-state" style={{ padding: '2.5rem 0' }}>
              <Calendar size={48} style={{ opacity: 0.3 }} />
              <p>
                The schedule for this tournament hasn&apos;t been published yet. Check back soon.
                {contactEmail ? <> Questions? Contact <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</> : null}
              </p>
              {!isPreview && (
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {canRegister && <Link href={registerHref} className="btn btn-lime btn-sm">Register</Link>}
                  {showTeamsPage && <Link href={teamsHref} className="btn btn-ghost btn-sm">View Teams</Link>}
                </div>
              )}
            </div>
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
              <button
                ref={filterButtonRef}
                type="button"
                className={`btn btn-outline ${styles.mobileFilterButton}`}
                onClick={openFilterSheet}
                aria-haspopup="dialog"
                aria-expanded={filterSheetOpen}
              >
                <SlidersHorizontal size={16} />
                Filters
                {activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
              </button>
            </div>
            <p className={styles.mobileFilterSummary}>
              View <strong>{activeViewSummary}</strong>
            </p>
            {activeVisibility !== 'unpublished' && (
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

          {filterSheetOpen && (
            <div className={styles.sheetLayer}>
              <button
                type="button"
                className={styles.sheetBackdrop}
                aria-label="Close filters"
                onClick={closeFilterSheet}
              />
              <div
                ref={sheetRef}
                className={styles.filterSheet}
                role="dialog"
                aria-modal="true"
                aria-labelledby="schedule-filter-sheet-title"
                tabIndex={-1}
                onKeyDown={handleSheetKeyDown}
              >
                <div className={styles.sheetHandle} aria-hidden="true" />
                <div className={styles.sheetHeader}>
                  <div>
                    <span>Schedule</span>
                    <h2 id="schedule-filter-sheet-title">Filters</h2>
                  </div>
                  <button type="button" className={styles.sheetClose} onClick={closeFilterSheet} aria-label="Close filters">
                    <X size={18} />
                  </button>
                </div>

                <div className={styles.sheetBody}>
                  <div className={styles.sheetField}>
                    <span className={styles.sheetControlLabel}>Stage</span>
                    <div className={`${styles.segmentedControl} ${styles.sheetSegmented}`} role="group" aria-label="Schedule stage">
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${draftViewMode === 'pool' ? styles.segmentActive : ''}`}
                        aria-pressed={draftViewMode === 'pool'}
                        onClick={() => setDraftViewMode('pool')}
                      >
                        Pool Play
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${draftViewMode === 'playoff' ? styles.segmentActive : ''}`}
                        aria-pressed={draftViewMode === 'playoff'}
                        onClick={() => setDraftViewMode('playoff')}
                      >
                        Playoffs
                      </button>
                    </div>
                  </div>

                  {draftViewMode === 'playoff' && (
                    <div className={styles.sheetField}>
                      <span className={styles.sheetControlLabel}>Playoff view</span>
                      <div className={`${styles.segmentedControl} ${styles.sheetSegmented}`} role="group" aria-label="Playoff view">
                        <button
                          type="button"
                          className={`${styles.segmentButton} ${draftBracketLayout === 'list' ? styles.segmentActive : ''}`}
                          aria-pressed={draftBracketLayout === 'list'}
                          onClick={() => setDraftBracketLayout('list')}
                        >
                          <List size={14} /> List
                        </button>
                        <button
                          type="button"
                          className={`${styles.segmentButton} ${draftBracketLayout === 'bracket' ? styles.segmentActive : ''}`}
                          aria-pressed={draftBracketLayout === 'bracket'}
                          onClick={() => setDraftBracketLayout('bracket')}
                        >
                          <LayoutTemplate size={14} /> Bracket
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.sheetFooter}>
                  <button type="button" className="btn btn-ghost" onClick={resetDraftFilters}>Reset</button>
                  <button type="button" className="btn btn-primary" onClick={applyDraftFilters}>Apply Filters</button>
                </div>
              </div>
            </div>
          )}

          {/* Team filter active label */}
          {teamSearch && (
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
            <div className="empty-state" style={{ padding: '2.5rem 0' }}>
              <Calendar size={48} style={{ opacity: 0.3 }} />
              <p>
                The schedule for this division hasn&apos;t been published yet. Check back soon.
                {contactEmail ? <> Questions? Contact <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</> : null}
              </p>
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
                {teamSearch
                  ? 'No games found for the selected filter.'
                  : `No ${viewMode === 'playoff' ? 'playoff ' : ''}games found. Check back soon.`}
              </p>
              {teamSearch ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTeamSearch('')}>Clear Search</button>
              ) : !isPreview ? (
                showTeamsPage ? <Link href={teamsHref} className="btn btn-ghost btn-sm">View Teams</Link> : null
              ) : null}
            </div>
          ) : (
            (() => {
              // ── BRACKET VIEW ─────────────────────────────────────────────
              if (viewMode === 'playoff' && bracketLayout === 'bracket') {
                if (bracketGames.length === 0) {
                  return (
                    <div className="empty-state">
                      <Trophy size={48} />
                      <p>No playoff games scheduled yet. Check back soon.</p>
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
        </div>
      </div>
    </div>
  );
}
