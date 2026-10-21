import kit from './ClubKit.module.css';
import styles from './TryoutPage.module.css';
import DirectionsLink from './DirectionsLink';
import { tryoutDayParts, type TryoutDay } from '@/lib/tryout-season';

/**
 * "Tryout days" (Club Tier Stage 4b-2b; End state 4, S4-04): each day still ahead — the date as plain text first (the one
 * calendar recipe), then the time range and the place, then Directions when the coach gave an address. The coach already
 * enters these in the tryout setup; nothing new to type. A cancelled day, and a day already passed, is left out (the
 * caller hands in the remaining days). Absent when none remain.
 */
export default function TryoutDays({ days, sport }: { days: readonly TryoutDay[]; sport: string | null }) {
  if (days.length === 0) return null;
  return (
    <section className={kit.section} aria-labelledby="tryout-days">
      <h2 id="tryout-days" className={kit.sectionTitle}>Tryout days</h2>
      <div className={kit.list}>
        {days.map((d, i) => {
          const p = tryoutDayParts(d, sport);
          return (
            <div key={`${d.startsAt}-${i}`} className={styles.day}>
              <div className={styles.dayWhen}>{p.dayLabel}</div>
              <div className={styles.dayWhat}>
                <div className={styles.dayTime}>{p.time}</div>
                {p.place && <div className={styles.dayPlace}>{p.place}</div>}
              </div>
              {p.directions && <DirectionsLink href={p.directions} name={p.directionsName} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
