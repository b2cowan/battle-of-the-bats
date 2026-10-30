import Link from 'next/link';
import type { LiveCardView } from '@/lib/public-game-row';
import DirectionsLink from './DirectionsLink';
import styles from './PublicParts.module.css';
import scheduleStyles from './PublicSchedule.module.css';
import playoffStyles from './PublicPlayoffs.module.css';
import { ScheduleMatchup } from './PublicGameRow';

/**
 * One game in play (Public tournament pages Stage 2; hub "The end state", Live now): both teams with the score — the
 * team behind drawn soft — or "No score yet" once on the first line before anyone has entered one (Stage 0 · D2); under
 * a hairline, the division and field, and Directions (the club pages' own DirectionsLink: the word at a desk, its symbol
 * alone on a phone). Free of Overview assumptions: the Schedule's live game uses it in Stage 3. `href` (optional) makes
 * the teams a door to the game's page.
 */
export default function PublicLiveCard({ view, href, schedule, foot, playoff }: {
  view: LiveCardView; href?: string; schedule?: { time: string; division: string; pool?: string | null; round?: string | null }; foot?: string;
  playoff?: { meta: string; live: boolean; gold: boolean };
}) {
  const [away, home] = view.sides;
  const label = view.noScore
    ? `${away.name} vs ${home.name}, ${view.noScore.toLowerCase()}`
    : `${away.name} ${away.score}, ${home.name} ${home.score}`;
  if (playoff) {
    const sides = <>{view.sides.map((side, i) => <span key={i} className={playoffStyles.gameSide} data-trailing={side.trailing || undefined}>
      <span>{side.name}</span>{side.score != null && <b>{side.score}</b>}
    </span>)}</>;
    return <article className={playoffStyles.gameCard} data-live={playoff.live || undefined} data-public-playoff-game={view.id}
      aria-label={playoff.live ? label : `${away.name} vs ${home.name}`}>
      <div className={playoffStyles.gameHead}><span>{playoff.meta}</span>{playoff.live && <span className={playoffStyles.liveWord}>Live now</span>}</div>
      {href ? <Link className={playoffStyles.gameLink} href={href}>{sides}</Link> : <div>{sides}</div>}
      {view.noScore && <p className={playoffStyles.noScore}>{view.noScore}</p>}
      {(foot || view.directionsHref) && <div className={playoffStyles.gameFoot}>
        {foot && <span data-gold={playoff.gold || undefined}>{foot}</span>}
        {view.directionsHref && <DirectionsLink href={view.directionsHref} name={`Directions to ${view.field || 'the game'}`} />}
      </div>}
    </article>;
  }
  if (schedule) return <article className={scheduleStyles.liveCard} aria-label={label} data-public-live-card>
    <ScheduleMatchup {...schedule} state="live" href={href} noScore={view.noScore} foot={foot}
      sides={view.sides.map(s => ({ name: s.name, score: s.score, result: s.trailing ? 'lose' : view.sides.some(other => other.trailing) ? 'win' : null }))} />
  </article>;
  const sides = (
    <>
      {view.sides.map((s, i) => (
        <span key={i} className={`${styles.side} ${s.trailing ? styles.trailing : ''}`}>
          <span>{s.name}</span>
          {view.noScore
            ? i === 0 && <span className={styles.noScore}>{view.noScore}</span>
            : <span className={styles.score}>{s.score}</span>}
        </span>
      ))}
    </>
  );
  return (
    <article className={styles.live} aria-label={label}>
      {href ? <Link className={styles.gameLink} href={href}>{sides}</Link> : <div>{sides}</div>}
      <div className={styles.liveMeta}>
        <span>{view.context}</span>
        {view.directionsHref && view.field && <DirectionsLink href={view.directionsHref} name={`Directions to ${view.field}`} />}
      </div>
    </article>
  );
}
