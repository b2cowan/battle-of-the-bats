/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { HostCardView } from '@/lib/public-host-card';
import styles from './PublicParts.module.css';

/** The club's own colours, worked through the club roles (lib/club-colour-roles.ts): the card wears the CLUB's, not the
 *  event's, since the event may carry its own. */
export interface HostCardColours {
  fill: string;
  onFill: string;
  edge: string;
}

/**
 * The host card (Public tournament pages Stage 2 Part 3; plan §6, Ask 4 / Ask B, hub `.host`): the club as advertising —
 * who hosts, what is open at the club right now (its own Open now list, nothing typed for it) and a Visit the club
 * button. What goes in it is lib/public-host-card.ts's (`hostCardView`); when the organizer has no public club page there
 * is no view and nothing is drawn. In the organizer's admin preview it is plain text (no `href` anywhere), as the band is.
 */
export default function PublicHostCard({ view, colours }: { view: HostCardView; colours: HostCardColours }) {
  const vars = {
    '--club-host-fill': colours.fill,
    '--club-host-on': colours.onFill,
    '--club-host-edge': colours.edge,
  } as CSSProperties;
  return (
    <section className={styles.host} style={vars} aria-labelledby="overview-host">
      <div className={styles.hostHead}>
        {view.logoUrl
          ? <img src={view.logoUrl} alt="" className={styles.hostLogo} />
          : <span className={styles.hostTile} aria-hidden>{view.initials}</span>}
        <div>
          <small>Hosted by</small>
          <b className={styles.hostName} id="overview-host">{view.name}</b>
        </div>
      </div>
      {view.open.length > 0 ? (
        <>
          <h2 className={styles.openHead}>Open now</h2>
          <ul className={styles.openList}>
            {view.open.map(o => {
              const body = <><span>{o.title}{o.sub && <small>{o.sub}</small>}</span></>;
              return (
                <li key={o.key}>
                  {o.href
                    ? <Link className={`${styles.openItem} ${styles.openLink}`} href={o.href}>{body}</Link>
                    : <div className={styles.openItem}>{body}</div>}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className={styles.hostLine}>{view.name} runs teams and programs all year</p>
      )}
      {view.href && <Link className={styles.hostBtn} href={view.href}>Visit the club</Link>}
    </section>
  );
}
