import { fanRoundLabel } from '@/lib/playoff-bracket';
import { resolveGameVenueLabel } from '@/lib/venue-label';
import { directionsHref } from '@/lib/family-schedule-format';
import { gameDayLists } from '@/lib/public-overview';
import { gameRowView, gameSideNames, liveCardView } from '@/lib/public-game-row';
import type { Announcement, Division, Game, Tournament, Venue } from '@/lib/types';
import PublicSectionHead from './PublicSectionHead';
import PublicLiveCard from './PublicLiveCard';
import { PublicGameRows } from './PublicGameRow';
import PublicDoorRow from './PublicDoorRow';
import PublicPostList from './PublicPostList';
import FollowTournamentLine from './FollowTournamentLine';
import styles from './PublicParts.module.css';

/**
 * The Overview under the public frame (Public tournament pages Stage 2; plan §5, hub "The end state"). A new body, fed by
 * the data TournamentHomeContent already loads, so the switch-off Overview is untouched and Stage 8 deletes one thing.
 *
 * Part 2 is GAME DAY: Follow this tournament (inside the installed app only) → Live now → Up next → Latest results →
 * News. Absent beats empty: a section with nothing in it does not render. No ticker here (the line's own page list,
 * lib/public-ticker-pages.ts), no alerts control (app-only, 2026-10-27), no Event Snapshot, no Explore row. Before and
 * after the event, and the host card, are Part 3's; until then those moments keep today's body.
 *
 * During the playoffs a "Playoff picture" door stands in for today's "The Bracket Is Set" hero (not drawn; the
 * bracket's own move is Stage 4) — only where the Playoffs page is where it lands: Standings public, not the preview.
 */
export default function TournamentOverview({
  orgSlug,
  tournamentSlug,
  tournament,
  isPreview,
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
}: {
  orgSlug: string;
  tournamentSlug: string;
  tournament: Pick<Tournament, 'name'>;
  isPreview: boolean;
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
}) {
  const now = new Date(); // a force-dynamic page: the render's own clock, as TournamentHomeContent's
  const { live, upNext, latest } = showSchedulePage ? gameDayLists(games, today, now) : { live: [], upNext: [], latest: [] };

  const divisionName = (id: string) => divisions.find(d => d.id === id)?.name ?? '';
  const label = (g: Game) => (g.isPlayoff && g.bracketCode ? fanRoundLabel(g.bracketCode) : divisionName(g.divisionId));
  const field = (g: Game) => resolveGameVenueLabel(g, venues) || null;
  const context = (g: Game) => [label(g), field(g)].filter(Boolean).join(' · ');
  const directions = (g: Game) => directionsHref(venues.find(v => v.id === g.venueId)?.address ?? null);

  const liveViews = live.map(g => liveCardView(g, gameSideNames(g, teamName), label(g), field(g), directions(g)));
  const upNextViews = upNext.map(g => gameRowView(g, gameSideNames(g, teamName), context(g), today));
  const latestViews = latest.map(g => gameRowView(g, gameSideNames(g, teamName), context(g), today));
  const posts = showNewsPage ? announcements : [];

  return (
    <div className={styles.overview}>
      {!isPreview && <FollowTournamentLine orgSlug={orgSlug} tournamentSlug={tournamentSlug} tournamentName={tournament.name} />}

      {liveViews.length > 0 && (
        <section className={styles.section} aria-labelledby="overview-live">
          <PublicSectionHead id="overview-live" title="Live now" count={liveViews.length} />
          <div className={styles.liveList}>
            {liveViews.map(v => <PublicLiveCard key={v.id} view={v} href={gameHref(v.id)} />)}
          </div>
        </section>
      )}

      {playoffPictureHref && <PublicDoorRow href={playoffPictureHref} label="Playoff picture" sub="The bracket is set: see who plays who" />}

      {upNextViews.length > 0 && (
        <section className={styles.section} aria-labelledby="overview-next">
          <PublicSectionHead id="overview-next" title="Up next" link={{ href: scheduleHref, label: 'Full schedule' }} />
          <PublicGameRows views={upNextViews} href={gameHref} />
        </section>
      )}

      {latestViews.length > 0 && (
        <section className={styles.section} aria-labelledby="overview-results">
          <PublicSectionHead id="overview-results" title="Latest results" link={{ href: scheduleHref, label: 'All results' }} />
          <PublicGameRows views={latestViews} href={gameHref} />
        </section>
      )}

      {/* A schedule still held back leaves game day with no game to list: say so once, rather than a page of nothing
          (Stage 0 · D1's fact, in the before-the-event facts list's words). */}
      {showSchedulePage && scheduleWithheld && !liveViews.length && !upNextViews.length && !latestViews.length && (
        <p className={styles.note}>The schedule is not posted yet. Games and results show here once the organizer posts it.</p>
      )}

      {posts.length > 0 && (
        <section className={styles.section} aria-labelledby="overview-news">
          <PublicSectionHead id="overview-news" title="News" link={{ href: newsHref, label: 'All announcements' }} />
          <PublicPostList posts={posts} />
        </section>
      )}
    </div>
  );
}
