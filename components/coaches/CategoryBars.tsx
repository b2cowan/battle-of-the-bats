'use client';
import styles from './CategoryBars.module.css';

/**
 * Scorecard category bars — ONE widget behind the tryout report's class-strength profile and the
 * per-player tryout snapshot.
 *
 * ⚠ **The caller decides what `thin` MEANS.** The report flags the class's weakest category; the
 * snapshot flags anything below the scorecard's midpoint. Those are different judgements about the
 * same picture, so the threshold stays at the call site and only the drawing lives here — pushing
 * a rule in would force one surface to lie about the other's question.
 *
 * ⚠ An unscored category renders its row with an EMPTY track and an em-dash, never a zero-width
 * bar and never `0.0`. "Nobody scored this" and "everybody scored it badly" must not look alike.
 */
export interface CategoryBarRow {
  key: string;
  label: string;
  avg: number | null;
  thin?: boolean;
}

export default function CategoryBars({ rows, scaleMax }: { rows: CategoryBarRow[]; scaleMax: number }) {
  return (
    <div className={styles.cats}>
      {rows.map(row => (
        <div key={row.key} className={styles.catRow}>
          <span className={styles.catLabel}>{row.label}</span>
          <span className={styles.catTrack}>
            {row.avg != null && (
              <span
                className={`${styles.catBar} ${row.thin ? styles.catBarThin : ''}`}
                // Clamped: a scorecard edited down after scoring could otherwise push a bar past
                // its own track.
                style={{ width: `${Math.min(100, (row.avg / scaleMax) * 100)}%` }}
              />
            )}
          </span>
          <span className={styles.catValue}>{row.avg != null ? row.avg.toFixed(1) : '—'}</span>
        </div>
      ))}
    </div>
  );
}
