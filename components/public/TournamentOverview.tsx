import { Fragment, type ReactNode } from 'react';
import { fanRoundLabel } from '@/lib/playoff-bracket';
import { resolveGameVenueLabel } from '@/lib/venue-label';
import { directionsHref } from '@/lib/family-schedule-format';
import { gameDayLists } from '@/lib/public-overview';
import { gameRowView, gameSideNames, liveCardView } from '@/lib/public-game-row';
import type { TournamentMoment } from '@/lib/tournament-moment';
import type { FactRow, RegisterCardView } from '@/lib/public-pre-event';
import type { ChampionCardView, HostCardView } from '@/lib/public-host-card';
import type { Announcement, Division, Game, Tournament, Venue } from '@/lib/types';
import PublicSectionHead from './PublicSectionHead';
import PublicLiveCard from './PublicLiveCard';
import { PublicGameRows } from './PublicGameRow';
import PublicDoorRow from './PublicDoorRow';
import PublicPostList from './PublicPostList';
import PublicRegisterCard from './PublicRegisterCard';
import PublicFactsList from './PublicFactsList';
import PublicChampions from './PublicChampions';
import PublicHostCard, { type HostCardColours } from './PublicHostCard';
import FollowTournamentLine from './FollowTournamentLine';
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
 * (the hub's "Desktop, game day · 1280px"). During the playoffs a "Playoff picture" door stands in for today's "The
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
  const label = (g: Game) => (g.isPlayoff && g.bracketCode ? fanRoundLabel(g.bracketCode) : divisionName(g.divisionId));
  const field = (g: Game) => resolveGameVenueLabel(g, venues) || null;
  const context = (g: Game) => [label(g), field(g)].filter(Boolean).join(' · ');
  const directions = (g: Game) => directionsHref(venues.find(v => v.id === g.venueId)?.address ?? null);

  const liveViews = live.map(g => liveCardView(g, gameSideNames(g, teamName), label(g), field(g), directions(g)));
  const upNextViews = upNext.map(g => gameRowView(g, gameSideNames(g, teamName), context(g), today));
  const latestViews = latest.map(g => gameRowView(g, gameSideNames(g, teamName), context(g), today));
  const posts = showNewsPage && moment !== 'after' ? announcements : [];

  // The parts, each null when it has nothing to say.
  const registerEl = moment === 'before' && register ? <PublicRegisterCard view={register} /> : null;
  const factsEl = moment === 'before' && facts.length > 0 ? <PublicFactsList rows={facts} /> : null;

  const liveEl = liveViews.length > 0 ? (
    <section className={styles.section} aria-labelledby="overview-live">
      <PublicSectionHead id="overview-live" title="Live now" count={liveViews.length} />
      <div className={styles.liveList}>
        {liveViews.map(v => <PublicLiveCard key={v.id} view={v} href={gameHref(v.id)} />)}
      </div>
    </section>
  ) : null;
  const playoffDoorEl = gameDay && playoffPictureHref
    ? <PublicDoorRow href={playoffPictureHref} label="Playoff picture" sub="The bracket is set: see who plays who" />
    : null;
  const upNextEl = upNextViews.length > 0 ? (
    <section className={styles.section} aria-labelledby="overview-next">
      <PublicSectionHead id="overview-next" title="Up next" link={{ href: scheduleHref, label: 'Full schedule' }} />
      <PublicGameRows views={upNextViews} href={gameHref} />
    </section>
  ) : null;
  const latestEl = latestViews.length > 0 ? (
    <section className={styles.section} aria-labelledby="overview-results">
      <PublicSectionHead id="overview-results" title="Latest results" link={{ href: scheduleHref, label: 'All results' }} />
      <PublicGameRows views={latestViews} href={gameHref} />
    </section>
  ) : null;
  // A schedule still held back leaves game day with no game to list: say so once, rather than a page of nothing
  // (Stage 0 · D1's fact, in the before-the-event facts list's words).
  const withheldEl = gameDay && showSchedulePage && scheduleWithheld && !liveViews.length && !upNextViews.length && !latestViews.length
    ? <p className={styles.note}>The schedule is not posted yet. Games and results show here once the organizer posts it.</p>
    : null;
  const newsEl = posts.length > 0 ? (
    <section className={styles.section} aria-labelledby="overview-news">
      <PublicSectionHead id="overview-news" title="News" link={{ href: newsHref, label: 'All announcements' }} />
      <PublicPostList posts={posts} />
    </section>
  ) : null;

  const championsEl = moment === 'after' && champions.length > 0 ? <PublicChampions cards={champions} /> : null;
  const afterDoorsEl = moment === 'after' && afterDoors.length > 0 ? (
    <div className={styles.doorList}>
      {afterDoors.map(d => <PublicDoorRow key={d.href} href={d.href} label={d.label} sub={d.sub} />)}
    </div>
  ) : null;
  const hostEl = host ? <PublicHostCard view={host} colours={hostColours} /> : null;

  const main = moment === 'before' ? [registerEl, factsEl] : gameDay ? [liveEl, playoffDoorEl, upNextEl, withheldEl] : [championsEl, afterDoorsEl];
  const side = moment === 'before' ? [hostEl, newsEl] : gameDay ? [latestEl, newsEl, hostEl] : [hostEl];

  const keyed = (parts: ReactNode[]) => parts.map((p, i) => (p ? <Fragment key={i}>{p}</Fragment> : null));

  return (
    <div className={styles.overview}>
      {!isPreview && <FollowTournamentLine orgSlug={orgSlug} tournamentSlug={tournamentSlug} tournamentName={tournament.name} />}
      <div className={styles.cols}>
        {main.some(Boolean) && <div className={styles.colMain}>{keyed(main)}</div>}
        {side.some(Boolean) && <div className={styles.colSide}>{keyed(side)}</div>}
      </div>
    </div>
  );
}
