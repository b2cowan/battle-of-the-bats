import { Fragment, type ReactNode } from 'react';
import { fanRoundLabel } from '@/lib/playoff-bracket';
import { resolveGameVenueLabel } from '@/lib/venue-label';
import { directionsHref } from '@/lib/family-schedule-format';
import { gameDayLists } from '@/lib/public-overview';
import { SCHEDULE_BRACKET_DOOR } from '@/lib/public-schedule';
import { fanPlaceholder, gameRowView, gameSideNames, liveCardView } from '@/lib/public-game-row';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { formatTime } from '@/lib/utils';
import type { TournamentMoment } from '@/lib/tournament-moment';
import type { FactRow, RegisterCardView } from '@/lib/public-pre-event';
import type { ChampionCardView, HostCardView } from '@/lib/public-host-card';
import type { Announcement, Division, Game, Tournament, Venue } from '@/lib/types';
import PublicSectionHead from './PublicSectionHead';
import { ScheduleMatchup, type MatchupSide } from './PublicGameRow';
import DirectionsLink from './DirectionsLink';
import PublicDoorRow, { PublicLinkList } from './PublicDoorRow';
import PublicPostList from './PublicPostList';
import PublicRegisterCard from './PublicRegisterCard';
import PublicFactsList from './PublicFactsList';
import PublicChampions from './PublicChampions';
import PublicHostCard, { type HostCardColours } from './PublicHostCard';
import FollowTournamentLine from './FollowTournamentLine';
import PublicPage from './PublicPage';
import kit from './ClubKit.module.css';
import styles from './PublicParts.module.css';

/**
 * The Overview under the public frame (Public tournament pages Stage 2; plan §5, hub "The end state"). A new body, fed by
 * the data TournamentHomeContent already loads, so the switch-off Overview is untouched and Stage 8 deletes one thing.
 * It is three pages in one, and `moment` (lib/tournament-moment.ts) says which:
 *
 *   · GAME DAY (Part 2) — Live now → Up next → Latest results → News → the host card.
 *   · BEFORE THE EVENT (Part 3) — the Register card → the facts list → the host card (higher than on game day: a family
 *     has time) → News.
 *   · AFTER THE EVENT (Part 3) — the champions first → the doors → the host card. No News here: the News tab has it.
 *
 * "Follow this tournament" sits above all three, inside the installed app only. Absent beats empty: a part with nothing
 * in it does not render. No ticker here (the line's own page list, lib/public-ticker-pages.ts), no alerts control
 * (app-only, 2026-10-27), no Event Snapshot, no Explore row.
 *
 * ONE ORDER, TWO LAYOUTS. The parts are listed in reading order, split into a main column and a side column; a phone
 * stacks them (main, then side — so each moment's phone order is exactly the plan's), a desk puts them side by side
 * (the hub's "Desktop, game day · 1280px"). During the playoffs a "The playoff bracket" link row stands in for today's "The
 * Bracket Is Set" hero (not drawn; the bracket's own move is Stage 4) — only where the Playoffs page is where it lands.
 */
export default function TournamentOverview({
  orgSlug,
  tournamentSlug,
  tournament,
  isPreview,
  moment,
  today,
  games,
  teamName,
  divisions,
  venues,
  announcements,
  scheduleWithheld,
  showSchedulePage,
  showNewsPage,
  playoffPictureHref,
  scheduleHref,
  newsHref,
  gameHref,
  register,
  facts,
  champions,
  afterDoors,
  host,
  hostColours,
}: {
  orgSlug: string;
  tournamentSlug: string;
  tournament: Pick<Tournament, 'name'>;
  isPreview: boolean;
  moment: TournamentMoment;
  /** The club's today, YYYY-MM-DD. */
  today: string;
  /** The games families can see (`readPublicGames`: a held-back division is never here, D1). */
  games: Game[];
  teamName: (id: string) => string;
  divisions: Division[];
  venues: Venue[];
  /** Newest first, already cut to the few the page shows. */
  announcements: Announcement[];
  /** A division's schedule is still held back (`readPublicGames`'s `withheld`). */
  scheduleWithheld: boolean;
  showSchedulePage: boolean;
  showNewsPage: boolean;
  /** Set only while the bracket is set and the Playoffs page is where the door lands. */
  playoffPictureHref: string | null;
  scheduleHref: string;
  newsHref: string;
  gameHref: (id: string) => string;
  /** Before the event: the Register card (null = none) and the facts list. */
  register: RegisterCardView | null;
  facts: FactRow[];
  /** After the event: the champions, and the doors under them. */
  champions: ChampionCardView[];
  afterDoors: { href: string; label: string; sub?: string | null }[];
  /** The host card (null = the organizer has no public club page) and the club's own colours for it. */
  host: HostCardView | null;
  hostColours: HostCardColours;
}) {
  const gameDay = moment === 'gameDay';
  const now = new Date(); // a force-dynamic page: the render's own clock, as TournamentHomeContent's
  const { live, upNext, latest } = gameDay && showSchedulePage ? gameDayLists(games, today, now) : { live: [], upNext: [], latest: [] };

  const divisionName = (id: string) => divisions.find(d => d.id === id)?.name ?? '';
  const round = (g: Game) => (g.isPlayoff && g.bracketCode ? fanRoundLabel(g.bracketCode) : null);
  const field = (g: Game) => resolveGameVenueLabel(g, venues) || null;
  const directions = (g: Game) => directionsHref(venues.find(v => v.id === g.venueId)?.address ?? null);
  const startTime = (g: Game) => (g.time ? formatTime(g.time) : 'TBD');
  // The head line's context: the day when it is not today (the drawing's "Thu, Nov 5 · U11 · Championship"), then the
  // division; the stacked row adds the round after it.
  const context = (g: Game) => [g.date && g.date !== today ? formatShortWeekdayDate(g.date) : null, divisionName(g.divisionId)]
    .filter(Boolean).join(' · ') || null;
  const sides = (g: Game) => gameSideNames(g, teamName, fanPlaceholder);
  const unsetSides = (g: Game): MatchupSide[] => {
    const n = sides(g);
    return [{ name: n.away, score: null, result: null, placeholder: !g.awayTeamId }, { name: n.home, score: null, result: null, placeholder: !g.homeTeamId }];
  };
  const posts = showNewsPage && moment !== 'after' ? announcements : [];

  // The parts, each null when it has nothing to say. The page hands over register / facts / champions / afterDoors only
  // in their own moment, so the moment is not asked again here.
  const registerEl = register ? <PublicRegisterCard view={register} /> : null;
  const factsEl = facts.length > 0 ? <PublicFactsList rows={facts} /> : null;

  // THE THREE GAME LISTS ON THE STACKED FORM (Public page layout standard A3, R6): each a framed list of stacked game
  // rows. Live now keeps its field and Directions as a strip under the row, and says "live" with its green edge only
  // (the heading already says it, R9); Up next keeps its field; a result says Final, the winner first and bold.
  const gameList = (rows: ReactNode[]) => <ul className={`${kit.list} ${styles.gameList}`}>{rows}</ul>;
  const liveEl = live.length > 0 ? (
    <section className={styles.section} aria-labelledby="overview-live">
      <PublicSectionHead id="overview-live" title="Live now" count={live.length} />
      {gameList(live.map(g => {
        const v = liveCardView(g, sides(g), '', field(g), directions(g));
        return <li key={g.id}><ScheduleMatchup form="stacked" pill={false} state="live" time={startTime(g)} division={context(g)}
          round={round(g)} href={gameHref(g.id)} noScore={v.noScore}
          sides={v.sides.map((s, i) => ({ name: s.name, score: s.score, result: null, placeholder: !(i === 0 ? g.awayTeamId : g.homeTeamId) }))}
          place={v.field ? { text: v.field, action: v.directionsHref ? <DirectionsLink href={v.directionsHref} name={`Directions to ${v.field}`} /> : undefined } : undefined} /></li>;
      }))}
    </section>
  ) : null;
  const upNextEl = upNext.length > 0 ? (
    <section className={styles.section} aria-labelledby="overview-next">
      <PublicSectionHead id="overview-next" title="Up next" link={{ href: scheduleHref, label: 'Full schedule' }} />
      {gameList(upNext.map(g => {
        const f = field(g);
        return <li key={g.id}><ScheduleMatchup form="stacked" time={startTime(g)} division={context(g)} round={round(g)}
          href={gameHref(g.id)} sides={unsetSides(g)} place={f ? { text: f } : undefined} /></li>;
      }))}
    </section>
  ) : null;
  // data-sandbox-tour: the demo tour's first step rings it (the finished semifinals are the newest results). Inert off a
  // demo; tests/unit/demo-destinations-guard.test.ts reads this literal.
  const latestEl = latest.length > 0 ? (
    <section className={styles.section} aria-labelledby="overview-results" data-sandbox-tour="latest-results">
      <PublicSectionHead id="overview-results" title="Latest results" link={{ href: scheduleHref, label: 'All results' }} />
      {gameList(latest.map(g => <li key={g.id}><ScheduleMatchup form="stacked" time="" division={context(g)} round={round(g)}
        state="final" href={gameHref(g.id)} sides={gameRowView(g, sides(g), '', today).sides} /></li>))}
    </section>
  ) : null;
  // A6: the bracket link sits in the side column under the results, so the main column is just the games.
  const playoffDoorEl = gameDay && playoffPictureHref
    ? <PublicLinkList><PublicDoorRow href={playoffPictureHref} label={SCHEDULE_BRACKET_DOOR.label} sub={SCHEDULE_BRACKET_DOOR.line} /></PublicLinkList>
    : null;
  // A schedule still held back leaves game day with no game to list: say so once, rather than a page of nothing
  // (Stage 0 · D1's fact, in the before-the-event facts list's words).
  const withheldEl = gameDay && showSchedulePage && scheduleWithheld && !live.length && !upNext.length && !latest.length
    ? <p className={styles.note}>The schedule is not posted yet. Games and results show here once the organizer posts it.</p>
    : null;
  const newsEl = posts.length > 0 ? (
    <section className={styles.section} aria-labelledby="overview-news">
      <PublicSectionHead id="overview-news" title="News" link={{ href: newsHref, label: 'All announcements' }} />
      <PublicPostList posts={posts} />
    </section>
  ) : null;

  const championsEl = champions.length > 0 ? <PublicChampions cards={champions} /> : null;
  const afterDoorsEl = afterDoors.length > 0 ? (
    <PublicLinkList>
      {afterDoors.map(d => <PublicDoorRow key={d.href} href={d.href} label={d.label} sub={d.sub} />)}
    </PublicLinkList>
  ) : null;
  const hostEl = host ? <PublicHostCard view={host} colours={hostColours} /> : null;

  const main = moment === 'before' ? [registerEl, factsEl] : gameDay ? [liveEl, upNextEl, withheldEl] : [championsEl, afterDoorsEl];
  const side = moment === 'before' ? [hostEl, newsEl] : gameDay ? [latestEl, playoffDoorEl, newsEl, hostEl] : [hostEl];

  const keyed = (parts: ReactNode[]) => parts.map((p, i) => (p ? <Fragment key={i}>{p}</Fragment> : null));

  return (
    <PublicPage>
      {!isPreview && <FollowTournamentLine orgSlug={orgSlug} tournamentSlug={tournamentSlug} tournamentName={tournament.name} />}
      <div className={styles.cols}>
        {main.some(Boolean) && <div className={styles.colMain}>{keyed(main)}</div>}
        {side.some(Boolean) && <div className={styles.colSide}>{keyed(side)}</div>}
      </div>
    </PublicPage>
  );
}
