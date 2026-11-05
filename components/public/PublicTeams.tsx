'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Star } from 'lucide-react';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { isTournamentInProgress, useFollowedTeam, useAccountFollowedTeamIds, unfollowTeamEverywhere } from '@/lib/follow';
import { competitionShellSignature } from '@/lib/public-playoffs';
import { teamMoment, teamPlace, teamRowLine, teamsGroups, TEAM_SCHEDULE_WITHHELD } from '@/lib/public-teams';
import { splitTeamQualifier } from '@/lib/utils';
import { isStandalonePWA } from '@/lib/device';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { useOrgHref } from '@/lib/use-public-pathname';
import type { PublicTeam } from '@/lib/types';
import PublicTournamentState from './PublicTournamentState';
import UnfollowConfirmSheet from './UnfollowConfirmSheet';
import PublicPage from './PublicPage';
import PublicSectionHead from './PublicSectionHead';
import PublicDoorRow from './PublicDoorRow';
import kit from './ClubKit.module.css';
import parts from './PublicParts.module.css';
import styles from './PublicTeams.module.css';

function TeamsState({ title, description }: { title: string; description: string }) {
  return <PublicTournamentState title={title} description={description} />;
}

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  isPreview?: boolean;
  initialData?: PublicTournamentPageData;
  initialNow?: string;
}

/** Preview-only Teams. Its server feed and authoritative replacements contain published divisions only. */
export default function PublicTeams({ orgSlug, tournamentSlug, isPreview = false, initialData, initialNow }: Props) {
  const orgHref = useOrgHref(orgSlug);
  const router = useRouter();
  const [fetched, setData] = useState(initialData ?? null);
  const [clock, setClock] = useState(() => initialNow ? new Date(initialNow) : null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [divisionId, setDivisionId] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [unfollowId, setUnfollowId] = useState<string | null>(null);
  const { followedTeamId, follow } = useFollowedTeam(orgSlug, tournamentSlug);
  const accountIds = useAccountFollowedTeamIds(orgSlug, tournamentSlug);
  const data = isPreview ? initialData ?? null : fetched;
  // A withdrawn division falls back without a preference write or a follow changing the filter.
  const selectedDivision = data?.divisions.some(d => d.id === divisionId) ? divisionId : '';
  const unfollowTarget = !isPreview ? data?.teams.find(t => t.id === unfollowId) : null;

  useEffect(() => {
    if (initialData || isPreview) return;
    let cancelled = false;
    void fetchPublicTournamentData(orgSlug, tournamentSlug, 'teams-preview').then(next => {
      if (cancelled) return;
      if (!next) { setFailed(true); return; }
      setData(next); setClock(new Date());
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [orgSlug, tournamentSlug, isPreview, initialData, attempt]);

  usePublicTournamentLive({ orgSlug, tournamentSlug, section: 'teams-preview',
    enabled: !isPreview && isTournamentInProgress(data?.tournament ?? null), onData: next => {
      if (data && competitionShellSignature(next) !== competitionShellSignature(data)) router.refresh();
      setData(next); setClock(new Date());
      if (divisionId && !next.divisions.some(d => d.id === divisionId)) setDivisionId('');
      if (unfollowId && !next.teams.some(t => t.id === unfollowId)) setUnfollowId(null);
    } });

  function toggleFollow(team: PublicTeam) {
    if (isPreview || !isStandalonePWA()) return;
    if (followedTeamId === team.id || accountIds.has(team.id)) setUnfollowId(team.id);
    else follow(team);
  }

  // The admin preview is re-rendered by the server with a fresh clock; the public page keeps the clock of its last feed.
  const nowMs = isPreview && initialNow ? Date.parse(initialNow) : clock?.getTime() ?? 0;
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const standingsShown = isPublicPageEnabled(data?.tournament, 'standings') && isPublicPageEnabled(data?.tournament, 'schedule');
  // Each team's moment reads the whole schedule, so it is built once per feed, not per keystroke or filter change.
  const moments = useMemo(() => new Map((data?.teams ?? []).map(team => [team.id, teamMoment({ ...data!, teamId: team.id,
    requireFinalization: data!.organization.requireScoreFinalization ?? data!.tournament?.requireScoreFinalization ?? true, now })])), [data, now]);
  // Standard R8: name what the box matches — coaches only where the club shows them (lib/public-teams matches t.coach).
  const searchWords = data?.teams.some(t => t.coach) ? 'Search teams or coaches' : 'Search teams';
  const groups = data ? teamsGroups({ ...data, divisionId: selectedDivision, query }) : [];  const state = failed ? 'failed' : !data ? 'loading' : !data.pageEnabled || !data.tournament ? 'unavailable'
    : !data.teams.length ? data.teamsWithheld && !data.divisions.length ? 'withheld' : 'empty' : 'ready';
  return <PublicPage data-public-teams={state} data-public-teams-ready={data ? true : undefined}>
    {state === 'loading' ? <p className={styles.loading}>Loading teams…</p>
      : state === 'failed' ? <>
        <TeamsState title="Teams unavailable" description="Check your connection and try again." />
        <button type="button" className={styles.retry} onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>Try again</button>
      </>
      : state === 'unavailable' ? <TeamsState title="Teams unavailable"
        description="The organizer has hidden the public teams page for this tournament." />
      : state === 'empty' ? <TeamsState title="No teams yet" description="Accepted teams will appear here." />
      : state === 'withheld' ? <TeamsState title={TEAM_SCHEDULE_WITHHELD} description="Teams will appear when their division is published." />
      : data && <>
        <div className={styles.filters}>
          <select aria-label="Division" value={selectedDivision} onChange={event => setDivisionId(event.target.value)}>
            <option value="">All divisions</option>
            {data.divisions.map(division => <option key={division.id} value={division.id}>{division.name}</option>)}
          </select>
          <button type="button" className={styles.searchToggle} aria-label={searchOpen ? 'Close search' : 'Search teams'} aria-expanded={searchOpen}
            aria-controls="public-teams-search" onClick={() => { setSearchOpen(!searchOpen); setQuery(''); }}><Search size={22} aria-hidden="true" /></button>
          <input id="public-teams-search" className={styles.search} data-open={searchOpen || undefined} type="search" aria-label={searchWords}
            placeholder={searchWords} value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        {groups.length ? <div className={styles.groups}>
          {groups.map(({ division, groups: pools, count }) => <section key={division.id} className={styles.division} aria-labelledby={`teams-${division.id}`}>
            {/* Standard R4: the division heading (18 px, count pill); the division is ONE framed list, each pool a band in it. */}
            <PublicSectionHead division id={`teams-${division.id}`} title={division.name} count={count} />
            <div className={kit.list}>{pools.map(pool => <Fragment key={pool.id}>
              {pool.name && <h3 className={`${kit.listBand} ${styles.band}`}>{pool.name}</h3>}
              {pool.teams.map(team => {
                const name = splitTeamQualifier(team.name);
                const standings = data.standingsByDivision[division.id] ?? [];
                const record = standings.find(row => row.teamId === team.id);
                const moment = moments.get(team.id)!;
                const line = teamRowLine(record, teamPlace(team, division, standings), moment, now, standingsShown);
                const liveAt = line.indexOf('Live now');
                // A8: a link row, two lines — the name, then "{coach} · {record} · {place} · {next}". The coach is the
                // bracketed part of the team's public name, so the club's coach-names rule is already applied to it.
                const summary = moment.kind === 'live' && liveAt >= 0
                  ? <>{line.slice(0, liveAt)}<span className={styles.live}>Live now</span>{line.slice(liveAt + 'Live now'.length)}</> : line;
                const sub = name.qualifier ? <>{name.qualifier}{line && ' · '}{summary}</> : summary;
                const isFollowed = followedTeamId === team.id || accountIds.has(team.id);
                return <div key={team.id} className={styles.teamRow} data-public-team-row={team.id}>
                  <PublicDoorRow className={styles.teamLink} href={isPreview ? null : orgHref(`/${tournamentSlug}/teams/${team.id}`)}
                    label={name.base} sub={sub} />
                  {!isPreview && <span className={`${parts.appOnly} ${styles.starWrap}`}>
                    <button type="button" className={styles.star} aria-label={`Follow ${team.name}`} aria-pressed={isFollowed}
                      onClick={() => toggleFollow(team)}><Star size={22} aria-hidden="true" /></button>
                  </span>}
                </div>;
              })}
            </Fragment>)}</div>
          </section>)}
        </div> : <TeamsState title="No teams match"
          description="Try another team name or choose All divisions. Teams appear once their division's schedule is published." />}
      </>}
    {!isPreview && <UnfollowConfirmSheet open={!!unfollowTarget} teamName={unfollowTarget?.name ?? ''}
      onCancel={() => setUnfollowId(null)} onConfirm={() => {
        if (unfollowTarget && isStandalonePWA()) unfollowTeamEverywhere(orgSlug, tournamentSlug, unfollowTarget.id);
        setUnfollowId(null);
      }} />}
  </PublicPage>;
}
