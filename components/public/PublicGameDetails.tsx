import { Calendar } from 'lucide-react';
import type { Game } from '@/lib/types';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import { publicGameDetailView } from '@/lib/public-game-detail';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { isWithinEventDates } from '@/lib/tournament-phase';
import Countdown from './Countdown';
import DirectionsLink from './DirectionsLink';
import GameDetailLiveRefresher from './GameDetailLiveRefresher';
import { GameStatusPill, ScheduleMatchup, type MatchupSide } from './PublicGameRow';
import PublicTournamentState from './PublicTournamentState';
import ShareScoreButton from './ShareScoreButton';
import PublicPage from './PublicPage';
import kit from './ClubKit.module.css';
import parts from './PublicParts.module.css';
import styles from './PublicGameDetails.module.css';

/** The game page when the organizer hid the Schedule: the state card inside the page's own frame body (Stage 8 Part 3d —
 *  it used to sit in the old global page wrappers, whose top padding cleared a bar the frame no longer has). */
export function PublicGameUnavailable({ homeHref }: { homeHref: string }) {
  return <PublicPage data-public-game data-state="unavailable">
    <PublicTournamentState
      icon={<Calendar size={40} />}
      eyebrow="Schedule"
      title="Schedule unavailable"
      description="The organizer has hidden the schedule for this tournament."
      actions={[{ href: homeHref, label: 'Tournament Home', variant: 'ghost' as const }]}
    />
  </PublicPage>;
}

/** Server-rendered preview body. The route has already applied the public schedule and division gates. */
export default function PublicGameDetails({ game, data, orgSlug, tournamentSlug, orgHref }: {
  game: Game; data: PublicTournamentPageData; orgSlug: string; tournamentSlug: string; orgHref: (path: string) => string;
}) {
  const tournament = data.tournament!;
  // The data layer already lays the tournament's own rule over the organization's.
  const requireFinalization = data.organization.requireScoreFinalization ?? true;
  const view = publicGameDetailView(game, { ...data, requireFinalization });
  const [away, home] = view.sides;
  const gameHref = orgHref(`/${tournamentSlug}/schedule/${game.id}`);
  const teamLinks = isPublicPageEnabled(tournament, 'teams');
  // Bold and soft only once the game is decided (final or unofficial): a live game keeps both names in full ink (R6).
  const decided = view.hasScore && !view.live;
  const sides: MatchupSide[] = view.sides.map((side, index) => {
    const other = view.sides[1 - index];
    return { name: side.name, score: side.score, placeholder: !side.teamId,
      result: decided && side.score !== other.score ? (side.trailing ? 'lose' : 'win') : null,
      href: side.teamId && teamLinks ? orgHref(`/${tournamentSlug}/teams/${side.teamId}`) : undefined };
  });
  const share = view.hasScore ? <ShareScoreButton iconOnly label={view.state === 'unofficial' ? 'Share this unofficial score' : 'Share this score'}
    className={styles.share} tournamentName={tournament.name} awayName={away.name} homeName={home.name}
    awayScore={away.score!} homeScore={home.score!} live={view.live} statusLabel={view.stateLabel ?? ''}
    dateLabel={view.date} venueLabel={view.field} gameType={view.round} gameHref={gameHref} menuAlign="right" menuPlacement="up" /> : null;
  // A GAME'S PAGE (Public page layout standard A11, A12, A14): no back link (the menu goes to the Schedule). ONE reading
  // order, when and where first — a phone keeps the Stage 3 order, Directions near the top; from a 1,200 px window the
  // shared columns put the score card in the main column and when-and-where beside it (placed by CSS, not re-ordered).
  return <PublicPage data-public-game data-state={view.state}>
    <GameDetailLiveRefresher orgSlug={orgSlug} tournamentSlug={tournamentSlug} gameId={game.id}
      initialSignature={view.refreshSignature} enabled={tournament.status === 'active' && isWithinEventDates(tournament.startDate, tournament.endDate)} requireFinalization={requireFinalization} />
    <div className={`${parts.cols} ${styles.cards}`}>
      <section className={styles.whenWhere} aria-label="When and where">
        <div className={styles.timeLine}><h1 className={view.cancelled ? styles.softTime : undefined}>{view.time}</h1>
          {view.cancelled && <GameStatusPill state="cancelled" className={styles.cancelled} />}
          {view.directions && <span className={styles.directionsSlot}><DirectionsLink href={view.directions} name={`Directions to ${view.field}`} /></span>}
        </div>
        <p className={styles.where}>{view.date} · {view.field}</p>
        {view.address && <p className={styles.address}>{view.address}</p>}
        <p className={styles.address}>{view.length}</p>
      </section>
      {/* The score card: the shared game card, large (R6). The round and division head it, said once (A12); Cancelled
          rides the when-and-where card instead, so the score card carries no pill then. */}
      <section className={`${kit.list} ${styles.scoreCard}`} aria-label="Game score">
        <ScheduleMatchup form="stacked" size="large" time="" division={`${view.round} · ${view.division}`} state={view.state}
          pill={!view.cancelled} sides={sides}
          noScore={view.countdown ? <Countdown target={view.countdown} prefix="Starts in " whenPast="Starting soon" /> : view.noScore}
          foot={view.foot} footTone={view.gold ? 'gold' : 'plain'} footAction={share} />
      </section>
    </div>
  </PublicPage>;
}

