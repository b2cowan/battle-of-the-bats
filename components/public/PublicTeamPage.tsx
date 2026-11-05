'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarPlus, ChevronLeft, Star } from 'lucide-react';
import { TEAM_SCHEDULE_WITHHELD, type WithheldTeamProfile } from '@/lib/public-teams';
import { teamProfileNextChange, teamProfileView, type PreviewTeamProfile } from '@/lib/public-team-profile';
import { useFollowedTeam, useAccountFollowedTeamIds, unfollowTeamEverywhere } from '@/lib/follow';
import { isStandalonePWA } from '@/lib/device';
import { useOrgHref } from '@/lib/use-public-pathname';
import { downloadTeamScheduleICS } from '@/lib/team-calendar';
import { teamInitials } from '@/lib/team-color';
import { formatPoolName, splitTeamQualifier } from '@/lib/utils';
import type { Division, Game, PublicTeam } from '@/lib/types';
import PublicTournamentState from './PublicTournamentState';
import PublicLiveCard from './PublicLiveCard';
import { PublicGameRow } from './PublicGameRow';
import PublicDoorRow, { PublicLinkList } from './PublicDoorRow';
import UnfollowConfirmSheet from './UnfollowConfirmSheet';
import PublicPage from './PublicPage';
import parts from './PublicParts.module.css';
import styles from './PublicTeamPage.module.css';

type Profile = PreviewTeamProfile | WithheldTeamProfile;
const withheld = (data: Profile): data is WithheldTeamProfile => 'scheduleWithheld' in data && data.scheduleWithheld === true;

function Back({ href }: { href: string }) {
  return <Link href={href} className={styles.back}><ChevronLeft size={16} aria-hidden="true" />All Teams</Link>;
}

/** The rendered page shares its moment/place rule with Teams; the network owner below is its only poll. */
export function PublicTeamBody({ data, now, orgSlug, tournamentSlug }: {
  data: PreviewTeamProfile; now: Date; orgSlug: string; tournamentSlug: string;
}) {
  const orgHref = useOrgHref(orgSlug);
  const { followedTeamId, follow } = useFollowedTeam(orgSlug, tournamentSlug);
  const accountIds = useAccountFollowedTeamIds(orgSlug, tournamentSlug);
  const [confirm, setConfirm] = useState(false);
  const { team, standings, preview } = data;
  const view = useMemo(() => teamProfileView(data, now), [data, now]);
  const live = view.moment.kind === 'live';
  const name = splitTeamQualifier(team.name);
  const followed = followedTeamId === team.id || accountIds.has(team.id);
  const base = orgHref(`/${tournamentSlug}`);
  const hasGames = data.games.length > 0;
  const showRecord = hasGames && preview.standingsShown;
  // The left column opens with a section heading (Live now / Next games / Results) unless a champion banner leads.
  const mainLeadsWithHeading = view.moment.kind !== 'champion' && Boolean(view.focus || view.next.length || view.results.length);
  function toggleFollow() {
    if (!isStandalonePWA()) return;
    if (followed) setConfirm(true);
    else follow(team);
  }
  function calendar() {
    if (!isStandalonePWA() || !hasGames) return;
    const teams = Object.entries(data.teamNames).map(([id, name]) => ({ id, name })) as PublicTeam[];
    void downloadTeamScheduleICS({ team, games: data.games as Game[], teams,
      divisions: [{ id: team.divisionId, name: data.divisionName }] as Division[],
      tournamentName: data.tournamentName, orgSlug, tournamentSlug });
  }
  // The Schedule's own two faces: the live card for a game in play, the game row for one still to come.
  type Item = NonNullable<typeof view.focus>;
  const gameHref = (item: Item) => `${base}/schedule/${item.game.id}`;
  const liveCard = (item: Item) => <div data-public-team-game={item.game.id}><PublicLiveCard view={item.view} href={gameHref(item)}
    schedule={{ time: item.time, division: item.division, pool: item.pool, round: item.round }}
    foot={item.stakes?.gold ? item.stakes.text : undefined} /></div>;
  const gameRows = (items: Item[]) => <ul className={parts.rows}>{items.map(item =>
    <PublicGameRow key={item.game.id} view={item.row} href={gameHref(item)} />)}</ul>;
  return <PublicPage data-public-team={view.moment.kind} data-public-team-ready>
    <Back href={`${base}/teams`} />
    <div>
      <div className={styles.identity}>
        <div className={styles.initials} aria-hidden="true">{teamInitials(team.name)}</div>
        <div className={styles.nameBlock}><div className={styles.titleLine}>
          <h2>{name.base}</h2>{view.chip && <span className={styles.chip}>{view.chip}</span>}
        </div><p className={styles.subtitle}>{data.divisionName}{data.poolName && ` · ${formatPoolName(data.poolName)}`}
          {name.qualifier && ` · ${name.qualifier}`}{team.coach && ` · coach ${team.coach}`}</p></div>
      </div>
      <div className={styles.actions}>
        <span className={parts.appOnly}><button type="button" className={styles.symbol} aria-label={`Follow ${team.name}`} aria-pressed={followed}
          onClick={toggleFollow}><Star size={22} aria-hidden="true" /></button></span>
        {hasGames && <span className={parts.appOnly}><button type="button" className={styles.symbol} aria-label="Add to calendar"
          onClick={calendar}><CalendarPlus size={22} aria-hidden="true" /></button></span>}
      </div>
    </div>
    {view.noMoreGames && <p className={styles.quiet}>No more games</p>}
    {!hasGames ? <div className={styles.stateCard}><PublicTournamentState title="No games scheduled yet"
      description="Check back when the organizer publishes the games." /></div> : <div className={parts.cols}>
      <div className={styles.main}>
        {view.moment.kind === 'champion' && <div className={styles.champion}>Champion · {data.divisionName}</div>}
        {view.focus && <section className={styles.section} aria-label={live ? 'Live now' : 'Up next'}>
          <h3>{live ? 'Live now' : 'Up next'}</h3>{live ? liveCard(view.focus) : gameRows([view.focus])}
        </section>}
        {view.next.length > 0 && <section className={styles.section} aria-label="Next games"><h3>Next games</h3>
          {gameRows(view.next)}
        </section>}
        {view.results.length > 0 && <section className={styles.section} aria-label="Results"><h3>Results</h3>
          <div className={styles.results}>{view.results.map(result => <Link key={result.id} className={styles.result}
            href={`${base}/schedule/${result.id}`}><span>{result.date}</span><span>vs {result.opponent}
              <small>{result.round}{result.unofficial && ' · Unofficial'}</small></span><b>{result.score}</b></Link>)}</div>
        </section>}
      </div>
      {showRecord && <div className={`${styles.side} ${mainLeadsWithHeading ? styles.sideBelowHeading : ''}`}>
        <dl className={styles.record}>
          <div><dt>Record</dt><dd>{standings.w}-{standings.l}-{standings.t}</dd></div>
          {preview.place && <div><dt>{preview.place.label}</dt><dd>{preview.place.value}</dd></div>}
          <div><dt>Points</dt><dd>{standings.pts}</dd></div>
          <div><dt>Run difference</dt><dd>{standings.rd >= 0 ? '+' : ''}{standings.rd}</dd></div>
        </dl>
        <PublicLinkList><PublicDoorRow href={`${base}/standings`} label={view.standingsLabel} /></PublicLinkList>
      </div>}
    </div>}
    <UnfollowConfirmSheet open={confirm} teamName={team.name} onCancel={() => setConfirm(false)}
      onConfirm={() => { if (isStandalonePWA()) unfollowTeamEverywhere(orgSlug, tournamentSlug, team.id); setConfirm(false); }} />
  </PublicPage>;
}

/** One profile request every 30 seconds, with hidden-tab pause, catch-up and no overlapping requests. */
export default function PublicTeamPage({ orgSlug, tournamentSlug, teamId }: {
  orgSlug: string; tournamentSlug: string; teamId: string;
}) {
  const orgHref = useOrgHref(orgSlug);
  const router = useRouter();
  const key = `${orgSlug}/${tournamentSlug}/${teamId}`;
  const [entry, setEntry] = useState<{ key: string; data: Profile | null; error: 'missing' | 'failed' | null; now: Date } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let received = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const query = new URLSearchParams({ orgSlug, tournamentSlug, teamId });
        const response = await fetch(`/api/public/team-profile?${query}`);
        if (cancelled) return;
        if (response.status === 404) { received = true; setEntry({ key, data: null, error: 'missing', now: new Date() }); return; }
        if (!response.ok) throw new Error('Profile read failed');
        const next: Profile = await response.json();
        if (next.team?.id !== teamId || (!withheld(next) && !next.preview)) throw new Error('Incomplete profile');
        if (!cancelled) {
          received = true;
          const signature = withheld(next) ? 'withheld' : `${next.preview.champion}:${next.preview.crownStamp}:${next.preview.standingsShown}`;
          if (previous.current !== null && previous.current !== signature) router.refresh();
          previous.current = signature;
          setEntry({ key, data: next, error: null, now: new Date() });
        }
      } catch {
        if (!cancelled && !received) setEntry({ key, data: null, error: 'failed', now: new Date() });
      }
      finally { inFlight = false; }
    }
    void load();
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(visible, 30_000);
    document.addEventListener('visibilitychange', visible);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [orgSlug, tournamentSlug, teamId, key, router, attempt]);
  const current = entry?.key === key ? entry : null;
  useEffect(() => {
    if (!current?.data || withheld(current.data)) return;
    const tick = () => setEntry(previous => previous?.key === key ? { ...previous, now: new Date() } : previous);
    const change = teamProfileNextChange(current.data, new Date());
    // If a render straddled kickoff, catch up immediately; otherwise wake at the next game boundary.
    const previousChange = teamProfileNextChange(current.data, current.now);
    const due = previousChange !== null && previousChange <= Date.now();
    const timer = change !== null || due ? setTimeout(tick, due ? 0 : Math.min(change! - Date.now() + 10, 2_147_483_647)) : null;
    const visible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', visible);
    return () => { if (timer !== null) clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [current, key]);
  const back = orgHref(`/${tournamentSlug}/teams`);
  if (current?.data && !withheld(current.data)) return <PublicTeamBody key={key} data={current.data} now={current.now}
    orgSlug={orgSlug} tournamentSlug={tournamentSlug} />;
  if (current?.data && withheld(current.data)) return <PublicPage data-public-team="withheld" data-public-team-ready>
    <div className={styles.nameBlock}><h2>{current.data.team.name}</h2><p className={styles.subtitle}>{current.data.divisionName}</p></div>
    <p className={styles.message}>{TEAM_SCHEDULE_WITHHELD}</p>
  </PublicPage>;
  return <PublicPage data-public-team={current?.error ?? 'loading'}><Back href={back} />
    {!current?.error ? <p className={styles.loading}>Loading team…</p> : <div className={styles.stateCard}>
      <PublicTournamentState title={current.error === 'missing' ? 'Team not found' : "Couldn't load this team"}
        description={current.error === 'missing' ? "This team isn't in this tournament." : 'Check your connection and try again.'} />
      {current.error === 'failed' && <button type="button" className={styles.retry} onClick={() => { setEntry(null); setAttempt(n => n + 1); }}>Try again</button>}
    </div>}
  </PublicPage>;
}
