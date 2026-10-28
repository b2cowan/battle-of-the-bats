import Link from 'next/link';
import type { LiveCardView } from '@/lib/public-game-row';
import DirectionsLink from './DirectionsLink';
import styles from './PublicParts.module.css';

/**
 * One game in play (Public tournament pages Stage 2; hub "The end state", Live now): both teams with the score — the
 * team behind drawn soft — or "No score yet" once on the first line before anyone has entered one (Stage 0 · D2); under
 * a hairline, the division and field, and Directions (the club pages' own DirectionsLink: the word at a desk, its symbol
 * alone on a phone). Free of Overview assumptions: the Schedule's live game uses it in Stage 3. `href` (optional) makes
 * the teams a door to the game's page.
 */
export default function PublicLiveCard({ view, href }: { view: LiveCardView; href?: string }) {
  const [away, home] = view.sides;
  const label = view.noScore
    ? `${away.name} vs ${home.name}, ${view.noScore.toLowerCase()}`
    : `${away.name} ${away.score}, ${home.name} ${home.score}`;
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
