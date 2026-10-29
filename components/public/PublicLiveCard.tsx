import Link from 'next/link';
import type { LiveCardView } from '@/lib/public-game-row';
import DirectionsLink from './DirectionsLink';
import styles from './PublicParts.module.css';
import scheduleStyles from './PublicSchedule.module.css';
import RollingNumber from './RollingNumber';

/**
 * One game in play (Public tournament pages Stage 2; hub "The end state", Live now): both teams with the score — the
 * team behind drawn soft — or "No score yet" once on the first line before anyone has entered one (Stage 0 · D2); under
 * a hairline, the division and field, and Directions (the club pages' own DirectionsLink: the word at a desk, its symbol
 * alone on a phone). Free of Overview assumptions: the Schedule's live game uses it in Stage 3. `href` (optional) makes
 * the teams a door to the game's page.
 */
export default function PublicLiveCard({ view, href, topLine, time, foot }: { view: LiveCardView; href?: string; topLine?: string; time?: string; foot?: string }) {
  const [away, home] = view.sides;
  const label = view.noScore
    ? `${away.name} vs ${home.name}, ${view.noScore.toLowerCase()}`
    : `${away.name} ${away.score}, ${home.name} ${home.score}`;
  const sides = (
    <>
      {view.sides.map((s, i) => (
        <span key={i} className={`${styles.side} ${s.trailing ? styles.trailing : ''} ${topLine ? scheduleStyles.liveSide : ''}`}>
          <span>{s.name}</span>
          {view.noScore
            ? i === 0 && <span className={styles.noScore}>{view.noScore}</span>
            : <span className={styles.score}>{topLine ? <RollingNumber value={s.score} /> : s.score}</span>}
        </span>
      ))}
    </>
  );
  return (
    <article className={`${styles.live} ${topLine ? scheduleStyles.liveCard : ''}`} aria-label={label} data-public-live-card={topLine ? true : undefined}>
      {topLine && <div className={scheduleStyles.liveTop}><span>{topLine}</span><span className={scheduleStyles.liveChip}>Live now</span></div>}
      {topLine && <span className={scheduleStyles.desktopLiveWhen}>{time}</span>}
      {href ? <Link className={`${styles.gameLink} ${topLine ? scheduleStyles.liveTeams : ''}`} href={href}>{sides}</Link> : <div className={topLine ? scheduleStyles.liveTeams : undefined}>{sides}</div>}
      {topLine && <span className={scheduleStyles.desktopLiveContext}><span className={scheduleStyles.liveChip}>Live now</span> {view.context}</span>}
      <div className={`${styles.liveMeta} ${topLine ? scheduleStyles.liveFooter : ''}`}>
        <span className={foot ? scheduleStyles.stakes : undefined}>{topLine ? foot ?? '' : view.context}</span>
        {view.directionsHref && view.field && <DirectionsLink href={view.directionsHref} name={`Directions to ${view.field}`} />}
      </div>
    </article>
  );
}
