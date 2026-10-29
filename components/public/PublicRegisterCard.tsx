import Link from 'next/link';
import type { RegisterCardView } from '@/lib/public-pre-event';
import Countdown from './Countdown';
import styles from './PublicParts.module.css';

/**
 * The Register card (Public tournament pages Stage 2 Part 3; hub "Before the event, phone browser"): when the event
 * starts and how long until it does, the spots, the button and one line about the free Coaches Portal — one card, where
 * today's hero and phone panel each carry their own Register block. The words are lib/public-pre-event.ts's
 * (`registerCardView`); this only draws them. A line the event has nothing for is not drawn.
 */
export default function PublicRegisterCard({ view }: { view: RegisterCardView }) {
  return (
    <section className={styles.regCard} aria-label="Registration">
      {view.starts && (
        <div>
          <div className={styles.regStarts}>{view.starts}</div>
          {view.countdownTarget && (
            <div className={styles.regCount}>
              <Countdown target={view.countdownTarget} prefix="in " whenPast="Under way" />
            </div>
          )}
        </div>
      )}
      {view.spots && <p className={styles.regSpots}>{view.spots}</p>}
      {view.waitlistNote && <p className={styles.regNote}>{view.waitlistNote}</p>}
      {view.button && <Link href={view.button.href} className={styles.cta}>{view.button.label}</Link>}
      {view.portalNote && <p className={styles.regNote}>{view.portalNote}</p>}
    </section>
  );
}
