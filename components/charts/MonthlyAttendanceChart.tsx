import styles from './CoachChart.module.css';
import type { MonthlyAttendanceBucket, MonthlyAttendanceCategory } from '@/lib/coach-monthly-attendance';
import { formatMonthKey } from '@/lib/timezone';

export interface MonthlyAttendanceChartProps {
  /** Oldest month first. The caller decides what "nothing recorded yet" looks like (decision 3a:
   *  the monthly chart folds into the Attendance table's existing empty note rather than growing a
   *  second one) — this component guards defensively but renders no note of its own on empty input. */
  buckets: MonthlyAttendanceBucket[];
}

const VIEW_W = 720;
const VIEW_H = 140;
// ⚠ Wider than the trend chart's 40 — "100%" is a longer right-anchored label than "+25"/"0", and
// a narrower margin here clipped it 4px past the viewBox edge at 1440 (check-layout-invariants).
const PAD_X = 46;
const Y_BASE = 112;
const Y_TOP = 32;
const MAX_BAR_W = 34;
const BAR_GAP = 4;

function pct(cat: MonthlyAttendanceCategory): number | null {
  return cat.known > 0 ? Math.round((cat.attended / cat.known) * 100) : null;
}

/** One month's games+practices bars, direct-labeled and hatched wherever a no-reply gap exists —
 *  the attendance-domain translation of the "played but unscored" honesty rule (decision 3c): the
 *  bar states its OWN known count rather than silently presenting a rate as though the sample were
 *  complete. */
export default function MonthlyAttendanceChart({ buckets }: MonthlyAttendanceChartProps) {
  if (buckets.length === 0) return null;

  const innerW = VIEW_W - PAD_X * 2;
  const step = buckets.length > 1 ? innerW / buckets.length : innerW;
  // ⚠ Bar width SHRINKS with the month count instead of a fixed 34px — a season spanning more than
  // ~8 recorded months (a normal fall-through-spring span) would otherwise pack a fixed-width pair
  // of bars into a narrower slot than they need and overlap the next month's (found in review). The
  // 0.86 factor leaves a visible gap between groups at every count.
  const barW = buckets.length > 1 ? Math.min(MAX_BAR_W, (step * 0.86 - BAR_GAP) / 2) : MAX_BAR_W;
  const groupW = barW * 2 + BAR_GAP;
  const groupX = (i: number) => buckets.length > 1
    ? PAD_X + i * step + (step - groupW) / 2
    : (VIEW_W - groupW) / 2;

  // A real 0% (known>0, nobody attended) gets a minimum sliver height so it still draws — height 0
  // would be visually identical to "no data" (pct === null), which is exactly the number this chart
  // exists to surface, not hide (found in review).
  const barH = (p: number | null) => (p == null ? 0 : Math.max((Y_BASE - Y_TOP) * (p / 100), p === 0 ? 2 : 0));

  // The single biggest no-reply gap across the whole chart — one footer sentence, not one per bar,
  // matching the Dashboard's "one thing worth knowing" restraint rather than a hatch report per cell.
  let worst: { label: string; known: number; recorded: number; gap: number } | null = null;
  for (const b of buckets) {
    for (const [label, cat] of [['Games', b.games], ['Practices', b.practices]] as const) {
      const gap = cat.recorded - cat.known;
      if (gap > 0 && (!worst || gap > worst.gap)) {
        worst = { label: `${formatMonthKey(b.month)} ${label.toLowerCase()}`, known: cat.known, recorded: cat.recorded, gap };
      }
    }
  }

  const ariaLabel = `Monthly attendance for games and practices, ${formatMonthKey(buckets[0].month)}`
    + (buckets.length > 1 ? ` through ${formatMonthKey(buckets[buckets.length - 1].month)}` : '');

  return (
    <div className={styles.chartCard}>
      <div className={styles.ccHead}>
        <span className={styles.ccTitle}>Month by month</span>
        <span className={styles.legend}>
          <span><i className={styles.legendSwatch} data-tone="games" />Games</span>
          <span><i className={styles.legendSwatch} data-tone="practices" />Practices</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={ariaLabel} className={styles.svg}>
        <line className={styles.secondary} x1={PAD_X} y1={Y_BASE} x2={VIEW_W - PAD_X} y2={Y_BASE} />
        <text className={styles.secondary} x={PAD_X - 10} y={Y_BASE + 3} textAnchor="end">0</text>
        <text className={styles.secondary} x={PAD_X - 10} y={Y_TOP + 3} textAnchor="end">100%</text>
        {buckets.map((b, i) => {
          const gx = groupX(i);
          const gPct = pct(b.games);
          const pPct = pct(b.practices);
          const gH = barH(gPct);
          const pH = barH(pPct);
          const gGap = b.games.recorded - b.games.known;
          const pGap = b.practices.recorded - b.practices.known;
          return (
            <g key={b.month}>
              {gPct != null && (
                <>
                  <rect x={gx} y={Y_BASE - gH} width={barW} height={gH} rx="4" className={styles.barGames} />
                  {gGap > 0 && <rect x={gx} y={Y_BASE - gH} width={barW} height={Math.min(gH, 10)} rx="4" className={styles.barHatch} />}
                  <text x={gx + barW / 2} y={Y_BASE - gH - 5} textAnchor="middle" className={styles.barLabel}>{gPct}</text>
                </>
              )}
              {pPct != null && (
                <>
                  <rect x={gx + barW + BAR_GAP} y={Y_BASE - pH} width={barW} height={pH} rx="4" className={styles.barPractices} />
                  {pGap > 0 && <rect x={gx + barW + BAR_GAP} y={Y_BASE - pH} width={barW} height={Math.min(pH, 10)} rx="4" className={styles.barHatch} />}
                  <text x={gx + barW + BAR_GAP + barW / 2} y={Y_BASE - pH - 5} textAnchor="middle" className={styles.barLabel}>{pPct}</text>
                </>
              )}
              <text x={gx + groupW / 2} y={VIEW_H - 6} textAnchor="middle" className={styles.monthLabel}>{formatMonthKey(b.month)}</text>
            </g>
          );
        })}
      </svg>
      {buckets.length === 1 && (
        <div className={styles.foot}>Only <b>1 month</b> recorded so far &mdash; more appear as the season goes</div>
      )}
      {worst && (
        <div className={styles.foot}>
          {worst.label}: <b>{worst.known} of {worst.recorded}</b> known &mdash; {worst.gap} left at no-reply, not counted either way
        </div>
      )}
    </div>
  );
}
