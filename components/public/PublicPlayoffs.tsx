'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Flame, Shield, Swords } from 'lucide-react';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isTournamentInProgress } from '@/lib/follow';
import { qualificationCaption, standingsDivision } from '@/lib/public-standings';
import { competitionShellSignature, nextPlayoffGame } from '@/lib/public-playoffs';
import { buildPlayoffPicture } from '@/lib/playoff-picture';
import { gameDirections, getPlayoffStakes, publicGameRound } from '@/lib/public-game-detail';
import { fanPlaceholder, gameSideNames, liveCardView } from '@/lib/public-game-row';
import { resolveGameVenueLabel } from '@/lib/venue-label';
import { deriveTierChampions } from '@/lib/champions';
import { championCards } from '@/lib/public-host-card';
import { tournamentToday, formatShortWeekdayDate } from '@/lib/timezone';
import { formatTime, formatPoolName } from '@/lib/utils';
import { useOrgHref } from '@/lib/use-public-pathname';
import { TieredBracket } from '@/components/bracket/TieredBracket';
import PublicLiveCard from './PublicLiveCard';
import PublicDisclosure from './PublicDisclosure';
import PublicSectionHead from './PublicSectionHead';
import PublicTournamentState from './PublicTournamentState';
import PublicChampions from './PublicChampions';
import SharePageButton from './SharePageButton';
import styles from './PublicPlayoffs.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  initialData: PublicTournamentPageData;
  initialNow: string;
}

/** The bracket has exactly one preview home. Shared tournament data refreshes; device preferences hydrate separately. */
export default function PublicPlayoffs({ orgSlug, tournamentSlug, initialData, initialNow }: Props) {
  const orgHref = useOrgHref(orgSlug);
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [clock, setClock] = useState(() => new Date(initialNow));
  const [pick, setPick] = useState('');
  const initialized = useRef(false);
  const division = standingsDivision(data.divisions, pick);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const remembered = data.divisions.find(d => d.name === getDivisionPref(orgSlug));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device preference stays outside the cached server HTML
    if (remembered) setPick(remembered.id);
  }, [data.divisions, orgSlug]);
  usePublicTournamentLive({ orgSlug, tournamentSlug, section: 'playoffs',
    enabled: isTournamentInProgress(data.tournament),
    onData: next => {
      setData(next); setClock(new Date());
      if (competitionShellSignature(next) !== competitionShellSignature(data)) router.refresh();
    },
  });

  const tournament = data.tournament;
  if (!tournament || !data.pageEnabled) return <div className={styles.playoffs} data-public-playoffs="unavailable">
    <PublicTournamentState title="Playoff Picture unavailable" description="The organizer has hidden results and standings for this tournament." />
  </div>;

  const requireFinalization = data.organization.requireScoreFinalization ?? tournament.requireScoreFinalization ?? true;
  const games = division ? data.games.filter(game => game.divisionId === division.id && game.isPlayoff) : [];
  const teams = data.teams.filter(team => team.divisionId === division?.id);
  const teamName = (id?: string | null) => teams.find(team => team.id === id)?.name ?? 'TBD';
  const selected = nextPlayoffGame({ games, teams, divisions: data.divisions, divisionId: division?.id ?? '', requireFinalization, now: clock });
  const picture = buildPlayoffPicture(tournament, division ? [division] : [], teams, games, data.standingsByDivision,
    teamName, game => resolveGameVenueLabel(game, data.venues), tournamentToday(clock)).divisions[0];
  const nextGame = selected.kind === 'live' || selected.kind === 'upcoming' ? selected.game : null;
  const names = nextGame ? gameSideNames(nextGame, teamName, fanPlaceholder) : null;
  const stakes = nextGame ? getPlayoffStakes(nextGame, games, true) : null;
  const card = nextGame && names ? liveCardView(selected.kind === 'live' ? nextGame : { ...nextGame, homeScore: null, awayScore: null }, names,
    publicGameRound(nextGame), resolveGameVenueLabel(nextGame, data.venues), gameDirections(nextGame, data.venues)) : null;
  if (card && selected.kind === 'upcoming') card.noScore = null;
  const champions = selected.kind === 'champion' ? championCards(deriveTierChampions(games, teams, division ? [division] : [])
    .filter(champion => champion.isTopTier), false) : [];
  const base = orgHref(`/${tournamentSlug}`);
  const qualifier = division ? qualificationCaption(division).replace(/^Top/, 'top') : '';

  return <div className={styles.playoffs} data-public-playoffs-ready data-public-playoffs={games.length ? selected.kind : 'empty'}>
    <div className={styles.controls}>
      {division && <label className={styles.division}><span className={styles.srOnly}>Division</span>
        <select value={division.id} onChange={event => {
          const next = data.divisions.find(d => d.id === event.target.value);
          if (!next) return;
          setPick(next.id); setDivisionPref(orgSlug, next.name);
        }}>{data.divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      </label>}
      <SharePageButton url={`${base}/playoffs`} title={`${tournament.name} — Playoffs`} text={`The playoff bracket for ${tournament.name}`} compact className={styles.share} />
    </div>
    {games.length ? <div className={styles.columns}>
      <section className={styles.next} aria-label={selected.kind === 'champion' ? 'Champion' : selected.kind === 'none' ? 'Playoff results' : 'Next playoff game'}>
        {card && nextGame ? <>
          <PublicSectionHead title={selected.kind === 'live' ? 'Live now' : 'Up next'} />
          <PublicLiveCard view={card} href={`${base}/schedule/${nextGame.id}`} foot={stakes?.text}
            playoff={{ live: selected.kind === 'live', gold: Boolean(stakes?.gold),
              meta: [nextGame.bracketLabel, publicGameRound(nextGame), selected.kind !== 'live' ? formatShortWeekdayDate(nextGame.date) : null,
                nextGame.time ? formatTime(nextGame.time) : 'Time TBD', resolveGameVenueLabel(nextGame, data.venues) || 'Location TBD'].filter(Boolean).join(' · ') }} />
        </> : selected.kind === 'champion' ? <>
          <PublicSectionHead title="Champion" /><PublicChampions cards={champions} />
        </> : <PublicTournamentState title="No upcoming playoff games" description="The bracket below has the latest results. A champion has not been decided." compact />}
      </section>
      <section className={styles.bracket} data-sandbox-tour="playoff-bracket" aria-label="Playoff bracket">
        <PublicSectionHead title="Bracket" />
        <TieredBracket games={games} teams={teams} pools={division?.pools ?? []} tournamentId={tournament.id}
          orgSlug={orgSlug} tournamentSlug={tournamentSlug} venues={data.venues} requireFinalization={requireFinalization} publicFrame now={clock} />
      </section>
      {picture && <div className={styles.seeding}><PublicDisclosure title="How seeding works"
        sub={`${picture.formatLabel}${qualifier ? `, ${qualifier}` : ''}`}>
        <div className={styles.seedBody}>
          {picture.narrative.map(line => <p key={line}>{qualifier.includes('per pool')
            ? line.replace(`top ${picture.teamsQualifying} advancing`, `top ${picture.teamsQualifying} per pool advancing`) : line}</p>)}
          {picture.callouts.length > 0 && <div className={styles.callouts}>{picture.callouts.map(item => {
            const label = item.label === 'Best offense' ? 'Best offence' : item.label === 'Stingiest defense' ? 'Stingiest defence' : item.label;
            const Icon = label === 'Top seed' ? Crown : label === 'Best offence' ? Flame : label === 'Stingiest defence' ? Shield : Swords;
            return <article key={label}><span><Icon size={15} aria-hidden />{label}</span><b>{item.teamName}</b><small>{item.value}</small></article>;
          })}</div>}
          {picture.seeds.length > 0 && <ol className={styles.seeds} aria-label="Playoff seeds">{picture.seeds.map((seed, index) => {
            const cut = index > 0 && picture.seeds[index - 1].qualified && !seed.qualified;
            return <li key={seed.teamId} data-cut={cut || undefined} data-qualified={seed.qualified || undefined}>
              {cut && <span className={styles.cut}>Playoff cut line</span>}
              <span className={styles.seedLine}><b>{seed.seed}</b><span>{seed.teamName}{seed.poolName && <small>{formatPoolName(seed.poolName)}</small>}</span><b>{seed.pts} PTS</b></span>
              <span className={styles.seedStats}>{seed.w}-{seed.l}-{seed.t} · RD {seed.rdRaw > 0 ? '+' : ''}{seed.rdRaw}</span>
            </li>;
          })}</ol>}
          {picture.seeds.at(-1)?.qualified && <p className={styles.endCut}>Playoff cut line</p>}
        </div>
      </PublicDisclosure></div>}
    </div> : <PublicTournamentState title="The bracket isn't set yet" description="The organizer will publish the playoff bracket when it is ready." compact />}
  </div>;
}
