'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Clock, Trophy } from 'lucide-react';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import type { DivisionStandingRow } from '@/lib/tie-breakers';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isTournamentInProgress, useFollowedTeam } from '@/lib/follow';
import { competitionShellSignature, hasPublicPlayoffBracket, playoffDoorSub } from '@/lib/public-playoffs';
import { standingsAdvancing, standingsCounts, standingsDivision, standingsRanking, standingsRankChanges } from '@/lib/public-standings';
import { formatPoolName, splitTeamQualifier } from '@/lib/utils';
import { useOrgHref } from '@/lib/use-public-pathname';
import PublicDisclosure from './PublicDisclosure';
import PublicSectionHead from './PublicSectionHead';
import PublicTournamentState from './PublicTournamentState';
import PublicDoorRow from './PublicDoorRow';
import styles from './PublicStandings.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  isPreview?: boolean;
  initialData?: PublicTournamentPageData;
}

function Differential({ row }: { row: DivisionStandingRow }) {
  const actual = row.rdRaw ?? row.rd;
  const capped = (row.runDiffCap ?? 0) > 0 && row.rd !== actual;
  return <span className={styles.differential}>
    <span>{actual > 0 ? `+${actual}` : actual}</span>
    {capped && <span className={styles.capped} title={`Playoff-seeding differential — capped at ±${row.runDiffCap} per game`}>
      ({row.rd > 0 ? `+${row.rd}` : row.rd})
    </span>}
  </span>;
}

/** Preview-only Standings. The bracket is on Playoffs; the legacy body keeps its original bracket. */
export default function PublicStandings({ orgSlug, tournamentSlug, isPreview = false, initialData }: Props) {
  const orgHref = useOrgHref(orgSlug);
  const router = useRouter();
  const [fetched, setFetched] = useState<PublicTournamentPageData | null>(initialData ?? null);
  const [failed, setFailed] = useState(false);
  const [pick, setPick] = useState('');
  const [clock, setClock] = useState<Date | null>(null);
  const [changes, setChanges] = useState<Map<string, 'up' | 'down'>>(() => new Map());
  const initialized = useRef(false);
  const previous = useRef(initialData);
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { followedTeamId } = useFollowedTeam(orgSlug, tournamentSlug);
  const data = isPreview ? initialData ?? null : fetched;
  const division = standingsDivision(data?.divisions ?? [], pick);

  useEffect(() => {
    if (initialData || isPreview) return;
    let cancelled = false;
    fetchPublicTournamentData(orgSlug, tournamentSlug, 'standings-preview').then(next => {
      if (cancelled) return;
      if (!next) { setFailed(true); return; }
      previous.current = next;
      setFetched(next);
      setClock(new Date());
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [orgSlug, tournamentSlug, initialData, isPreview]);

  // Preferences hydrate after paint; cached HTML contains no family's selection or followed-team mark.
  useEffect(() => {
    if (!data || initialized.current || isPreview) return;
    initialized.current = true;
    const preferred = data.divisions.find(d => d.name === getDivisionPref(orgSlug));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the device's remembered division after paint
    if (preferred) setPick(preferred.id);
  }, [data, isPreview, orgSlug]);

  useEffect(() => () => { if (changeTimer.current) clearTimeout(changeTimer.current); }, []);

  usePublicTournamentLive({ orgSlug, tournamentSlug, section: 'standings-preview',
    enabled: !isPreview && isTournamentInProgress(data?.tournament),
    onData: next => {
      if (data && competitionShellSignature(next) !== competitionShellSignature(data)) router.refresh();
      const moved = standingsRankChanges(previous.current?.standingsByDivision[division?.id ?? ''] ?? [],
        next.standingsByDivision[division?.id ?? ''] ?? [], division?.pools);
      previous.current = next;
      setFetched(next); // authoritative replacement: held-back/removed divisions and games disappear together
      setClock(new Date());
      if (changeTimer.current) clearTimeout(changeTimer.current);
      setChanges(moved);
      if (moved.size) changeTimer.current = setTimeout(() => setChanges(new Map()), 2400);
    },
  });

  if (failed || (data && (!data.pageEnabled || !data.tournament))) {
    return <div className={styles.standings} data-public-standings="unavailable">
      <PublicTournamentState title="Standings unavailable" description={failed
        ? 'We couldn’t load the standings. Please try again.'
        : 'The organizer has hidden results and standings for this tournament.'} />
    </div>;
  }
  if (!data?.tournament) return <div className={styles.standings} aria-busy="true"><p className={styles.counts}>Loading standings…</p></div>;

  const tournament = data.tournament;
  const rows = division ? data.standingsByDivision[division.id] ?? [] : [];
  const requireFinalization = data.organization.requireScoreFinalization ?? tournament.requireScoreFinalization ?? true;
  const counts = division ? standingsCounts(tournament, division, data.games, requireFinalization, clock ?? new Date(0)) : '';
  const pools = division?.pools ?? [];
  const groups = pools.length >= 2 ? pools.map(pool => ({ ...pool, rows: rows.filter(row => row.poolId === pool.id) }))
    : [{ id: division?.id ?? '', name: '', rows }];
  const advancing = division ? standingsAdvancing(tournament, division, rows) : new Set<string>();
  const ranking = standingsRanking(division?.playoffConfig, tournament.settings, rows);
  const showPlayoffsDoor = !isPreview && hasPublicPlayoffBracket(tournament, data.divisions, data.games);

  return <div className={styles.standings} data-public-standings-ready data-public-standings={rows.length ? 'table' : 'empty'}>
    {division && <label className={styles.division}>
      <span className={styles.srOnly}>Division</span>
      <select value={division.id} onChange={event => {
        const selected = data.divisions.find(d => d.id === event.target.value);
        if (!selected) return;
        setPick(selected.id);
        setChanges(new Map());
        if (!isPreview) setDivisionPref(orgSlug, selected.name);
      }}>
        {data.divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </label>}
    {counts && <p className={styles.counts} data-standings-counts>{counts}</p>}
    {rows.length > 0 ? <>
      {groups.filter(group => group.rows.length > 0).map(group => {
        const started = group.rows.some(row => row.gp > 0);
        return <section key={group.id} className={styles.pool} aria-label={group.name ? `Standings · ${formatPoolName(group.name)}` : `${division?.name} standings`}>
          {group.name && <PublicSectionHead title={`Standings · ${formatPoolName(group.name)}`} />}
          <div className={styles.tableFrame} role="region" aria-label="Standings table. Swipe to see more columns." tabIndex={0}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>{division?.name}{group.name ? ` · ${formatPoolName(group.name)}` : ''} standings</caption>
              <thead><tr>
                <th scope="col" className={styles.teamCol}>Team</th>
                <th scope="col" className={`${styles.recordCol} ${styles.phoneOnly}`}>REC</th>
                <th scope="col" className={styles.deskOnly}>W</th>
                <th scope="col" className={styles.deskOnly}>L</th>
                <th scope="col" className={styles.deskOnly}>T</th>
                <th scope="col" className={`${styles.rdCol} ${styles.phoneOnly}`}>RD</th>
                <th scope="col" className={styles.runsCol}>RF</th>
                <th scope="col" className={styles.runsCol}>RA</th>
                <th scope="col" className={`${styles.rdCol} ${styles.deskOnly}`}>RD</th>
                <th scope="col" className={styles.ptsCol}>PTS</th>
              </tr></thead>
              <tbody>{group.rows.map((row, index) => {
                const top = index === 0 && started && group.rows.length > 1 && row.w >= row.l;
                const name = splitTeamQualifier(row.teamName);
                const movement = changes.get(row.teamId);
                const differential = <Differential row={row} />;
                return <tr key={row.teamId} data-top={top || undefined}
                  data-followed={!isPreview && row.teamId === followedTeamId || undefined}>
                  <th scope="row" className={styles.teamCol}>
                    <div className={styles.teamName}>
                      {top && <span className={styles.trophy} role="img" aria-label="First place"><Trophy size={12} aria-hidden /></span>}
                      {movement && <span className={styles.movement} aria-label={movement === 'up' ? 'Moved up' : 'Moved down'}>{movement === 'up' ? '▲' : '▼'}</span>}
                      <span className={styles.name}>{name.base}{name.qualifier && <small>{name.qualifier}</small>}</span>
                      {advancing.has(row.teamId) && <span className={styles.advancing} role="img" aria-label="In a playoff spot"><CheckCircle size={12} aria-hidden /></span>}
                      {row.hasPendingGame && <span className={styles.pending} role="img" aria-label="Includes an unofficial score"><Clock size={12} aria-hidden /></span>}
                    </div>
                  </th>
                  <td className={styles.phoneOnly}>{row.w}-{row.l}-{row.t}</td>
                  <td className={styles.deskOnly}>{row.w}</td><td className={styles.deskOnly}>{row.l}</td><td className={styles.deskOnly}>{row.t}</td>
                  <td className={styles.phoneOnly}>{differential}</td>
                  <td>{row.rf}</td><td>{row.ra}</td>
                  <td className={styles.deskOnly}>{differential}</td>
                  <td className={styles.ptsCol}>{row.pts}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </section>;
      })}
      <PublicDisclosure title="How the table is ranked" sub="What each column means, and the tie-breakers">
        <div className={styles.explainer}>
          <dl className={styles.legend}>{ranking.legend.map(item => <div key={item.abbr}
            className={item.vis === 'mobile' ? styles.phoneOnly : item.vis === 'desktop' ? styles.deskOnly : undefined}>
            <dt>{item.abbr}</dt><dd>{item.label}</dd>
          </div>)}</dl>
          <p><strong>Tie-breaker order</strong><br />{ranking.order}</p>
          {ranking.capNote && <p>{ranking.capNote}</p>}
          {ranking.pendingNote && <p>{ranking.pendingNote}</p>}
        </div>
      </PublicDisclosure>
    </> : <PublicTournamentState title="No standings yet" description={division
      ? 'This division has teams, but standings will start once scoreable games are posted.'
      : 'Standings will appear when the organizer publishes the schedule.'} compact />}
    {showPlayoffsDoor && <PublicDoorRow href={orgHref(`/${tournamentSlug}/playoffs`)} label="The playoff bracket"
      sub={division ? playoffDoorSub({ ...data, tournament, requireFinalization }, division.id, clock ?? new Date(0)) : null} />}
  </div>;
}
