import Link from 'next/link';
import { Calendar, ChevronLeft } from 'lucide-react';
import type { Game } from '@/lib/types';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import { publicGameDetailView } from '@/lib/public-game-detail';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { isWithinEventDates } from '@/lib/tournament-phase';
import Countdown from './Countdown';
import DirectionsLink from './DirectionsLink';
import GameDetailLiveRefresher from './GameDetailLiveRefresher';
import PublicFactsList from './PublicFactsList';
import { GameStatusPill } from './PublicGameRow';
import PublicTournamentState from './PublicTournamentState';
import RollingNumber from './RollingNumber';
import ShareScoreButton from './ShareScoreButton';
import PublicPage from './PublicPage';
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
  return <PublicPage data-public-game data-state={view.state}>
    <GameDetailLiveRefresher orgSlug={orgSlug} tournamentSlug={tournamentSlug} gameId={game.id}
      initialSignature={view.refreshSignature} enabled={tournament.status === 'active' && isWithinEventDates(tournament.startDate, tournament.endDate)} requireFinalization={requireFinalization} />
    <Link className={styles.back} href={orgHref(`/${tournamentSlug}/schedule`)}><ChevronLeft size={20} aria-hidden />Schedule</Link>
    <div className={parts.cols}>
      <div className={styles.main}>
        <section className={styles.whenWhere} aria-label="When and where">
          <div className={styles.timeLine}><h1 className={view.cancelled ? styles.softTime : undefined}>{view.time}</h1>
            {view.cancelled && <GameStatusPill state="cancelled" className={styles.cancelled} />}
            {view.directions && <span className={styles.directionsSlot}><DirectionsLink href={view.directions} name={`Directions to ${view.field}`} /></span>}
          </div>
          <p className={styles.where}>{view.date} · {view.field}</p>
          {view.address && <p className={styles.address}>{view.address}</p>}
        </section>
        <section className={styles.scoreCard} aria-label="Game score">
          <div className={styles.scoreTop}><span>{view.round} · {view.division}</span>
            {view.stateLabel && <GameStatusPill state={view.state} />}
          </div>
          {/* Soft only once the game is decided: a live game keeps both names in full ink (R6). */}
          {view.sides.map((side, index) => <div key={index} className={`${styles.side} ${side.trailing && !view.live ? styles.trailing : ''}`}>
            {side.teamId && isPublicPageEnabled(tournament, 'teams')
              ? <Link className={styles.team} href={orgHref(`/${tournamentSlug}/teams/${side.teamId}`)}>{side.name}</Link>
              : <span className={styles.team}>{side.name}</span>}
            {view.hasScore && <RollingNumber className={styles.score} value={side.score} />}
          </div>)}
          {view.countdown ? <p className={styles.pending}><Countdown target={view.countdown} prefix="Starts in " whenPast="Starting soon" /></p>
            : view.noScore && <p className={styles.pending}>{view.noScore}</p>}
          {(view.foot || view.hasScore) && <div className={`${styles.foot} ${view.foot ? '' : styles.footShareOnly}`}><span className={view.gold ? styles.gold : undefined}>{view.foot}</span>
            {view.hasScore && <ShareScoreButton iconOnly label={view.state === 'unofficial' ? 'Share this unofficial score' : 'Share this score'}
              className={styles.share} tournamentName={tournament.name} awayName={away.name} homeName={home.name}
              awayScore={away.score!} homeScore={home.score!} live={view.live} statusLabel={view.stateLabel ?? ''}
              dateLabel={view.date} venueLabel={view.field} gameType={view.round} gameHref={gameHref} menuAlign="right" menuPlacement="up" />}
          </div>}
        </section>
      </div>
      <div className={styles.facts}><PublicFactsList rows={view.facts} /></div>
    </div>
  </PublicPage>;
}

