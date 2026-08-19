import { TrendingUp } from 'lucide-react';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import styles from './CoachChart.module.css';
import type { SeasonMomentumSeries } from '@/lib/coach-season-momentum';

export type ChartResultTone = 'win' | 'loss' | 'tie';

export interface SeasonTrendChartProps {
  title: string;
  /** cc-cap text, hidden under ~420px (the card title alone still names the chart there). */
  caption: string;
  series: SeasonMomentumSeries;
  /** lowercase unit word for the aria-label sentence, e.g. "run" / "point". */
  unitWord: string;
  /** singular noun for the aria-label and footer copy, e.g. "game". */
  sampleNoun: string;
  /** The one line that differs between callers when `series.scoredCount === 0` — everything else
   *  about that state (icon, headline, card chrome) is the same on every chart. */
  emptyDescription: string;
  /** Filled area under the line — the Dashboard's momentum chart draws one; Results trend does not. */
  fill?: boolean;
  /** One tone per game, SAME length and chronological order as the data fed to
   *  `computeSeasonMomentum` — draws the win/loss/tie strip beneath the line (Results trend only).
   *  Omit for the Dashboard, which has no strip. */
  strip?: ChartResultTone[];
  startLabel?: string;
  endLabel?: string;
}

const VIEW_W = 720;
const PAD_X = 40;

/**
 * The cumulative score-unit differential line shared by the Dashboard's "Season momentum" and the
 * Results tab's trend chart.
 *
 * ⚠ NOT YET UNIFIED with the codebase's other cumulative-line SVG chart — the Money hub's
 * `CumulativeChart` (budget-vs-actual panel), already cloned once into the observability
 * `CallsVsErrorsChart`. This is a third hand-rolled instance of the same x/y-scaling + path-building
 * shape. Left as its own component rather than generalizing the shared one, because that would mean
 * editing two already-shipped, unrelated surfaces (money accounting, platform observability) outside
 * this change's scope — a real consolidation opportunity for whoever next touches any of the three,
 * not a decision made here.
 *
 * A game with a recorded result but no score entered leaves a GAP, never a silent drop
 * (`unscoredIndexes`, memory/design_decisions.md decision 3c) — the line only threads scored games,
 * but each gap is marked at its true chronological position so the chart's game count never quietly
 * disagrees with the game log beside it.
 */
export default function SeasonTrendChart({
  title, caption, series, unitWord, sampleNoun, emptyDescription, fill = false, strip, startLabel, endLabel,
}: SeasonTrendChartProps) {
  const { points, unscoredIndexes, scoredCount, totalCount } = series;

  // No scored game to plot yet. The card holds its space with teaching copy rather than vanishing
  // (memory/decision 3a) — a deliberate departure from the shared Sparkline's literal "render
  // nothing", which fits a 52×16 inline mark, not a card the page already reserves height for.
  if (points.length === 0) {
    return (
      <CoachEmptyState
        quiet
        compact
        icon={<TrendingUp size={18} aria-hidden />}
        headline={`No scored ${sampleNoun}s yet`}
        description={emptyDescription}
      />
    );
  }

  const viewH = strip ? 150 : 130;
  const yBase = strip ? 100 : 108;
  const yTop = strip ? 18 : 22;
  const innerW = VIEW_W - PAD_X * 2;

  const xAt = (index: number) => (totalCount > 1 ? PAD_X + (index / (totalCount - 1)) * innerW : VIEW_W / 2);
  // One pass for both bounds — always includes 0, since the baseline itself must stay on-scale.
  let min = 0, max = 0;
  for (const p of points) {
    if (p.cumulative < min) min = p.cumulative;
    if (p.cumulative > max) max = p.cumulative;
  }
  const span = max - min || 1;
  const yAt = (v: number) => yBase - ((v - min) / span) * (yBase - yTop);
  const yZero = yAt(0);

  const last = points[points.length - 1];
  const lastX = xAt(last.index);
  const lastY = yAt(last.cumulative);
  const lastLabel = `${last.cumulative >= 0 ? '+' : ''}${last.cumulative}`;
  const labelAnchor = lastX > VIEW_W - 60 ? 'end' : 'middle';

  const linePath = points.length >= 2
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.index).toFixed(1)},${yAt(p.cumulative).toFixed(1)}`).join(' ')
    : null;
  const areaPath = linePath && fill
    ? `${linePath} L${xAt(last.index).toFixed(1)},${yBase} L${xAt(points[0].index).toFixed(1)},${yBase} Z`
    : null;

  const ariaLabel = scoredCount === totalCount
    ? `Cumulative ${unitWord} differential over ${scoredCount} ${sampleNoun}${scoredCount === 1 ? '' : 's'}, currently ${lastLabel}`
    : `Cumulative ${unitWord} differential over ${scoredCount} of ${totalCount} ${sampleNoun}s with a score entered, currently ${lastLabel}`;

  const footText = scoredCount === 1
    ? <>Just <b>1</b> {sampleNoun} scored so far &mdash; the line appears after your next one</>
    : scoredCount < totalCount
      ? <><b>{scoredCount} of {totalCount}</b> {sampleNoun}s have a score entered</>
      : null;

  // Gap lookups happen once per game in the strip below — a Set keeps that O(totalCount) rather
  // than an O(totalCount × unscoredIndexes.length) `.includes()` scan per pip.
  const unscoredSet = new Set(unscoredIndexes);

  return (
    <div className={styles.chartCard}>
      <div className={styles.ccHead}>
        <span className={styles.ccTitle}>{title}</span>
        <span className={`${styles.ccCap} ${styles.secondary}`}>{caption}</span>
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${viewH}`} role="img" aria-label={ariaLabel} className={styles.svg}>
        <line className={styles.secondary} x1={PAD_X - 4} y1={yBase} x2={VIEW_W - PAD_X + 12} y2={yBase} />
        <text className={styles.secondary} x={PAD_X - 10} y={yBase + 3} textAnchor="end">0</text>
        {areaPath && <path d={areaPath} className={styles.area} />}
        {linePath && <path d={linePath} className={styles.line} />}
        <circle cx={lastX} cy={lastY} r={points.length === 1 ? 4 : 3.5} className={styles.dot} />
        <text x={lastX} y={lastY - 12} textAnchor={labelAnchor} className={styles.bigLabel}>{lastLabel}</text>
        {unscoredIndexes.map(i => (
          <g key={i}>
            <circle cx={xAt(i)} cy={yZero} r="2.5" className={styles.gapDot} />
            <line x1={xAt(i)} y1={yZero + 6} x2={xAt(i)} y2={yBase} className={styles.gapTick} />
          </g>
        ))}
        {strip && (
          <g>
            {Array.from({ length: totalCount }, (_, i) => {
              const tone = strip[i];
              const cls = unscoredSet.has(i) ? styles.pipGap
                : tone === 'win' ? styles.pipWin
                : tone === 'loss' ? styles.pipLoss
                : styles.pipTie;
              return <rect key={i} x={xAt(i) - 6} y={yBase + 16} width="12" height="12" rx="3" className={cls} />;
            })}
          </g>
        )}
        {startLabel && <text className={styles.secondary} x={PAD_X} y={viewH - 6}>{startLabel}</text>}
        {endLabel && <text className={styles.secondary} x={VIEW_W - PAD_X} y={viewH - 6} textAnchor="end">{endLabel}</text>}
      </svg>
      {footText && <div className={styles.foot}>{footText}</div>}
    </div>
  );
}
