'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarPlus, Search, Star, X } from 'lucide-react';
import type { Game } from '@/lib/types';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { isTournamentInProgress, readFollowedTeamId, useFollowedTeam } from '@/lib/follow';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { tournamentToday, formatShortWeekdayDate, formatStoredDate } from '@/lib/timezone';
import { gameStartMs, publicGameState } from '@/lib/game-status';
import { computePlacementStandings } from '@/lib/playoff-standings';
import { hasPlayoffs, hasRoundRobin } from '@/lib/tournament-phase';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { getRegistrationState } from '@/lib/registration-state';
import { resolveGameFieldLabel } from '@/lib/venue-label';
import { fanPlaceholder, gameRowView, gameSideNames, liveCardView } from '@/lib/public-game-row';
import { gameDirections, getPlayoffStakes, publicGameRound } from '@/lib/public-game-detail';
import { changedScheduleGameIds, groupPoolPlayoffs, scheduleGames, scheduleInitialSelection, scheduleLandingDay, SCHEDULE_BRACKET_DOOR, splitEarlierToday, visibleScheduleGames, type ScheduleStage } from '@/lib/public-schedule';
import { downloadTeamScheduleICS } from '@/lib/team-calendar';
import { useOrgHref } from '@/lib/use-public-pathname';
import { formatTime } from '@/lib/utils';
import PublicDoorRow from './PublicDoorRow';
import PublicDisclosure from './PublicDisclosure';
import { PublicGameRow } from './PublicGameRow';
import PublicLiveCard from './PublicLiveCard';
import PublicSectionHead from './PublicSectionHead';
import parts from './PublicParts.module.css';
import kit from './ClubKit.module.css';
import styles from './PublicSchedule.module.css';

/** Frame-on body only. ScheduleContent remains the switch-off body, including its own styles and behaviour. */
export default function PublicSchedule({ orgSlug, tournamentSlug, isPreview = false, initialData }: {
  orgSlug: string; tournamentSlug: string; isPreview?: boolean; initialData?: PublicTournamentPageData;
}) {
  const orgHref = useOrgHref(orgSlug);
  const [data, setData] = useState(initialData ?? null);
  const [failed, setFailed] = useState(false);
  const [division, setDivision] = useState('');
  const [stage, setStage] = useState<ScheduleStage>('pool');
  const [day, setDay] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [myGames, setMyGames] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [highlight, setHighlight] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const [clock, setClock] = useState<Date | null>(null);
  const previous = useRef(initialData);
  const initialized = useRef(false);
  const pendingHighlight = useRef<string | null | undefined>(undefined);
  const highlightOwnsSelection = useRef(false);
  const appliedFollow = useRef<string | null>(null);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const { followedTeamId } = useFollowedTeam(orgSlug, tournamentSlug);

  useEffect(() => {
    // Strict Mode replays mount effects after the URL has already been cleaned. Capture only once.
    if (pendingHighlight.current === undefined) {
      const params = new URLSearchParams(window.location.search);
      pendingHighlight.current = isPreview ? null : params.get('highlightGameId');
      if (params.has('highlightGameId') && !isPreview) {
        params.delete('highlightGameId');
        const rest = params.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
      }
    }
    return () => { if (flipTimer.current) clearTimeout(flipTimer.current); };
  }, [isPreview]);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    fetchPublicTournamentData(orgSlug, tournamentSlug, 'schedule').then(next => {
      if (cancelled) return;
      if (!next) { setFailed(true); return; }
      previous.current = next;
      setData(next);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [orgSlug, tournamentSlug, initialData]);

  usePublicTournamentLive({ orgSlug, tournamentSlug, section: 'schedule',
    enabled: !isPreview && isTournamentInProgress(data?.tournament ?? null),
    onData: next => {
      const changed = changedScheduleGameIds(previous.current?.games ?? [], next.games);
      previous.current = next;
      setData(next); // whole authoritative payload: removed games disappear, new ids appear exactly once
      setClock(new Date());
      if (changed.length) {
        if (flipTimer.current) clearTimeout(flipTimer.current);
        setFlipped(new Set(changed));
        flipTimer.current = setTimeout(() => setFlipped(new Set()), 1600);
      }
    },
  });

  // Hydrate device preferences after paint; none enter the HTML cached by the service worker.
  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    const followId = isPreview ? null : readFollowedTeamId(orgSlug, tournamentSlug);
    const now = new Date();
    const pick = scheduleInitialSelection({ ...data, preference: isPreview ? null : getDivisionPref(orgSlug),
      followedTeamId: followId, highlightId: pendingHighlight.current ?? null, today: tournamentToday(), now });
    highlightOwnsSelection.current = Boolean(pick.highlight);
    appliedFollow.current = followId;
    setDivision(pick.division);
    setStage(pick.stage);
    setDay(pick.day);
    setHighlight(pick.highlight);
    setClock(now);
    if (!isPreview && pick.division && (pick.highlight || followId)) {
      setDivisionPref(orgSlug, data.divisions.find(d => d.id === pick.division)?.name ?? '');
    }
  }, [data, isPreview, orgSlug, tournamentSlug]);

  useEffect(() => {
    if (isPreview || !data || !followedTeamId || followedTeamId === appliedFollow.current || highlightOwnsSelection.current) return;
    const team = data.teams.find(t => t.id === followedTeamId);
    if (!team) return;
    appliedFollow.current = followedTeamId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same-tab and cross-tab follow synchronization
    setDivision(team.divisionId);
    setDivisionPref(orgSlug, data.divisions.find(d => d.id === team.divisionId)?.name ?? '');
  }, [followedTeamId, data, isPreview, orgSlug]);

  useEffect(() => {
    if (!highlight) return;
    const scroll = window.setTimeout(() => {
      document.getElementById(`public-game-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    const clear = window.setTimeout(() => setHighlight(null), 2600);
    return () => { clearTimeout(scroll); clearTimeout(clear); };
  }, [highlight]);

  const today = tournamentToday();
  const games = useMemo(() => visibleScheduleGames(data?.games ?? [], data?.divisions ?? []), [data]);
  const followed = !isPreview ? data?.teams.find(t => t.id === followedTeamId) : undefined;
  const effectiveStage = !hasRoundRobin(data?.tournament) ? 'playoff' : !hasPlayoffs(data?.tournament) ? 'pool' : stage;
  const selection = useMemo(() => scheduleGames({ games, teams: data?.teams ?? [], divisions: data?.divisions ?? [],
    division, stage: effectiveStage, query, myTeamId: myGames ? followed?.id : null }), [games, data, division, effectiveStage, query, myGames, followed?.id]);
  const effectiveDay = scheduleLandingDay(selection.dates, today, day, Boolean(query.trim() || myGames));
  const datesVisible = selection.dates.length > 1 && !query.trim() && !myGames;
  // The rail only exists once the page has left "Loading", so that moment is a dependency too.
  const ready = Boolean(data && clock);
  useEffect(() => {
    if (ready && datesVisible && selection.dates.length > 5) rail.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [ready, datesVisible, selection.dates.length, effectiveDay]);

  if (failed) return <div className={styles.schedule}><div className={styles.state} role="alert">The schedule could not be loaded. Please refresh to try again.</div></div>;
  if (!data || !clock) return <div className={styles.schedule} role="status">Loading schedule…</div>;
  const { tournament, divisions, teams, venues } = data;
  if (!tournament || !data.pageEnabled) return <div className={styles.schedule}><div className={styles.state}>The schedule is not available.</div></div>;
  // The data layer already lays the tournament's own rule over the organization's.
  const requireFinalization = data.organization.requireScoreFinalization ?? true;
  const allWithheld = divisions.length > 0 && divisions.every(d => d.scheduleVisibility !== 'published');
  const divisionWithheld = Boolean(division && divisions.find(d => d.id === division)?.scheduleVisibility !== 'published');
  const canRegister = isPublicPageEnabled(tournament, 'register') && Boolean(getRegistrationState(tournament, divisions, []).cta);
  const basePath = `/${tournamentSlug}`;
  const gameHref = (id: string) => isPreview ? undefined : orgHref(`${basePath}/schedule/${id}`);
  const names = (g: Game) => gameSideNames(g, id => teams.find(t => t.id === id)?.name ?? 'TBD', fanPlaceholder);
  const divisionName = (g: Game) => divisions.find(d => d.id === g.divisionId)?.name ?? '';
  const round = (g: Game) => g.isPlayoff ? publicGameRound(g) : null;
  // Same live venue resolver as the Overview; compact rows show the facility, maps use its parent address/name.
  const field = (g: Game) => resolveGameFieldLabel(g, venues) || 'Location TBD';
  const mapHref = (g: Game) => isPreview ? null : gameDirections(g, venues);
  const row = (g: Game) => {
    const state = publicGameState(g, requireFinalization, clock);
    const context = [divisionName(g), field(g)].filter(Boolean).join(' · ');
    if (state === 'live') {
      const when = g.time ? formatTime(g.time) : 'TBD';
      const lead = round(g) || divisionName(g);
      const stakes = getPlayoffStakes(g, games, true);
      return <PublicLiveCard view={liveCardView(g, names(g), lead, field(g), mapHref(g))} href={gameHref(g.id)}
        time={when} topLine={[when, lead, field(g)].join(' · ')} foot={stakes?.gold ? stakes.text : undefined} />;
    }
    return <ul className={parts.rows}><PublicGameRow view={gameRowView(g, names(g), context, today,
      { state, round: round(g), poolTag: selection.poolTags.get(g.id), schedule: true })}
      schedule href={gameHref(g.id)} directions={mapHref(g)} field={field(g)} /></ul>;
  };
  const gameBlock = (g: Game) => <div key={g.id} id={`public-game-${g.id}`} data-game-id={g.id} data-highlighted={highlight === g.id || undefined}
    data-flipped={flipped.has(g.id) || undefined} className={styles.gameBlock}>{row(g)}</div>;
  // Adjacent rows share one card; headings and live cards break it at their actual time slot.
  // "Up next" names the slot after Live now on game day: only today, and only for a game that has not started (an
  // unscored game whose time has passed is not "next", and a later day already has its date heading).
  const renderGames = (input: Game[], slotHeads = true, upNextToday = false) => {
    const list = slotHeads && effectiveStage === 'playoff' ? groupPoolPlayoffs(input, selection.poolTags) : input;
    const blocks: ReactNode[] = [];
    let rows: Game[] = [];
    let upNextShown = false;
    const flush = () => {
      if (!rows.length) return;
      blocks.push(<div key={`rows-${rows[0].id}`} className={styles.rowGroup}>{rows.map(gameBlock)}</div>);
      rows = [];
    };
    list.forEach((g, index) => {
      const pool = selection.poolTags.get(g.id);
      const prev = list[index - 1];
      const poolHead = slotHeads && effectiveStage === 'playoff' && pool && (pool !== selection.poolTags.get(prev?.id ?? '') || prev?.divisionId !== g.divisionId);
      const state = publicGameState(g, requireFinalization, clock);
      const nextHead = slotHeads && upNextToday && !upNextShown && state === 'upcoming' && (gameStartMs(g) ?? 0) > clock.getTime();
      if (poolHead || nextHead || state === 'live') flush();
      if (poolHead) blocks.push(<PublicSectionHead key={`pool-${g.id}`} title={`${!division ? `${divisionName(g)} · ` : ''}${pool} Playoffs`} />);
      if (nextHead) { upNextShown = true; blocks.push(<PublicSectionHead key={`next-${g.id}`} title="Up next" />); }
      if (state === 'live') blocks.push(gameBlock(g));
      else rows.push(g);
    });
    flush();
    return blocks;
  };
  const dayGames = selection.games.filter(g => effectiveDay === 'all' || g.date === effectiveDay || !g.date);
  const dateKeys = [...new Set(dayGames.map(g => g.date || ''))].sort((a, b) => (a || '9999').localeCompare(b || '9999'));
  const activeDivisions = divisions.filter(d => (!division || d.id === division) && d.scheduleVisibility === 'published');
  const notices = isTournamentInProgress(tournament) ? (data.announcements ?? []).filter(a => a.pinned && !dismissed.has(a.id)) : [];
  const heldBackDoors = !isPreview && <>
    {isPublicPageEnabled(tournament, 'teams') && <PublicDoorRow href={orgHref(`${basePath}/teams`)} label="Teams" />}
    {canRegister && <PublicDoorRow href={orgHref(`${basePath}/register`)} label="Register" />}
  </>;

  return <div className={styles.schedule} data-public-schedule-ready>
    {notices.map(a => <aside key={a.id} className={styles.notice} aria-label="Tournament notice"><div><strong>{a.title}</strong><p>{a.body}</p></div>
      <button type="button" className={styles.symbol} aria-label={`Dismiss announcement: ${a.title}`} onClick={() => setDismissed(new Set([...dismissed, a.id]))}><X size={22} aria-hidden /></button></aside>)}
    {allWithheld ? <><div className={styles.state}><h2>Schedule coming soon</h2><p>The organizer has not posted the schedule yet.</p></div>{heldBackDoors}</> : <>
      <div className={styles.controls}>
        <div className={styles.controlRow}>
          <label className={styles.division}><span className={kit.srOnly}>Division</span><select aria-label="Division" value={division} onChange={e => {
            setDivision(e.target.value); setQuery(''); setMyGames(false);
            if (!isPreview) setDivisionPref(orgSlug, divisions.find(d => d.id === e.target.value)?.name ?? '');
          }}><option value="">All divisions</option>{divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          {followed && <span className={`${parts.appOnly} ${styles.myGamesSlot}`}><button type="button" className={styles.myGames} aria-pressed={myGames} onClick={() => {
            setMyGames(!myGames); setQuery(''); setDivision(followed.divisionId);
            setDivisionPref(orgSlug, divisions.find(d => d.id === followed.divisionId)?.name ?? '');
          }}><Star size={18} aria-hidden />My games</button></span>}
        </div>
        <div className={styles.controlRow}>
          {hasRoundRobin(tournament) && hasPlayoffs(tournament) && <div className={styles.track} role="group" aria-label="Schedule stage">
            {(['pool', 'playoff'] as const).map(s => <button key={s} type="button" aria-pressed={effectiveStage === s} onClick={() => setStage(s)}>{s === 'pool' ? 'Pool play' : 'Playoffs'}</button>)}
          </div>}
          <button type="button" className={`${styles.symbol} ${styles.searchToggle}`} aria-label={searchOpen ? 'Close search' : 'Search teams'} aria-expanded={searchOpen} aria-controls="public-schedule-search" onClick={() => { setSearchOpen(!searchOpen); setQuery(''); }}><Search size={22} aria-hidden /></button>
          {followed && <span className={`${parts.appOnly} ${styles.calendarSlot}`}><button type="button" className={`${styles.symbol} ${styles.calendarButton}`} aria-label="Add my team's schedule to my calendar" onClick={() => void downloadTeamScheduleICS({ team: followed, games, teams, divisions, tournamentName: tournament.name, orgSlug, tournamentSlug })}><CalendarPlus size={22} aria-hidden /><span className={styles.desktopLabel}>Calendar</span></button></span>}
        </div>
        <input id="public-schedule-search" className={styles.search} data-open={searchOpen || undefined} type="search" aria-label={teams.some(t => t.coach) ? 'Search team or coach' : 'Search team'} placeholder={teams.some(t => t.coach) ? 'Search team or coach…' : 'Search team…'} value={query} onChange={e => { setQuery(e.target.value); setMyGames(false); }} />
      </div>
      {!divisionWithheld && datesVisible && <div className={styles.days} data-rail={selection.dates.length > 5 || undefined} role="group" aria-label="Game day" ref={rail}>
        <button type="button" aria-pressed={effectiveDay === 'all'} onClick={() => setDay('all')}>All</button>
        {selection.dates.map(d => <button type="button" key={d} aria-pressed={effectiveDay === d} data-today={d === today || undefined} onClick={() => setDay(d)}>
          {d === today ? 'Today' : formatShortWeekdayDate(d).split(',')[0]}<small>{formatStoredDate(d, { withYear: false })}</small>
        </button>)}
      </div>}
      {divisionWithheld ? <div className={styles.state}><h2>Division schedule coming soon</h2><p>The organizer has not posted this division’s schedule yet.</p></div> : <>
        {effectiveStage === 'playoff' && activeDivisions.filter(d => d.playoffConfig?.format === 'placement').map(d => {
          const standings = computePlacementStandings(games.filter(g => g.divisionId === d.id && g.isPlayoff), teams);
          return standings.some(r => r.teamName) ? <section key={d.id} className={styles.state}><PublicSectionHead title={`Final standings${!division ? ` · ${d.name}` : ''}`} /><ol className={styles.placements}>{standings.map(r => <li key={r.place}><span>{r.place}.</span> {r.teamName ?? 'TBD'}</li>)}</ol></section> : null;
        })}
        {dateKeys.map(date => {
          const dated = dayGames.filter(g => (g.date || '') === date);
          const { earlier, remaining } = date === today ? splitEarlierToday(dated, today, requireFinalization, clock) : { earlier: [], remaining: dated };
          return <section key={date} className={styles.dateGroup}>
            {(effectiveDay === 'all' || !date) && <PublicSectionHead title={date ? date === today ? 'Today' : formatShortWeekdayDate(date) : 'Date to be confirmed'} />}
            {earlier.length > 0 && <PublicDisclosure title="Earlier today" sub={`${earlier.length} ${earlier.length === 1 ? 'game' : 'games'}, all final`} desktopOpen reveal={earlier.some(g => g.id === highlight)}>{renderGames(earlier, false)}</PublicDisclosure>}
            {renderGames(remaining, true, date === today)}
          </section>;
        })}
        {dayGames.length === 0 && <div className={styles.state}><h2>{query.trim() || myGames ? 'No matching games' : 'No games scheduled'}</h2><p>{query.trim() || myGames ? 'Try another team or clear the search.' : 'Games will appear here once the organizer posts them.'}</p></div>}
        {effectiveStage === 'playoff' && !isPreview && isPublicPageEnabled(tournament, 'standings') && <PublicDoorRow href={orgHref(`${basePath}/${SCHEDULE_BRACKET_DOOR.path}`)} label={SCHEDULE_BRACKET_DOOR.label} sub={SCHEDULE_BRACKET_DOOR.sub} />}
      </>}
    </>}
  </div>;
}
