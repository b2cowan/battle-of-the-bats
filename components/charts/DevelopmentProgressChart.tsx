import styles from './CoachChart.module.css';
import { describeSeries, progressAxis, xFractions, type ProgressSeries } from '@/lib/development-report';
import { formatValue, formatShortDate } from '@/lib/measurable-format';

/**
 * A player's progress in ONE test — player-vs-self only (development lifecycle Phase 3, plan §8
 * chart rules 1–10; §16 for a range test). The SAME card chrome as the season-trend chart, drawn
 * from the ONE series object the answer line and the table beneath also read (rule 8):
 *   · actual calendar time on x — an interval with no assessment is simply time (rule 2);
 *   · the line follows the headline per session (or the average, on request); every attempt is a
 *     quiet mark at its own value, so spread is visible without a score (rule 9);
 *   · a narrowed y with labelled ticks and NO fill beneath it (rule 5); the unit on the axis;
 *   · a range test shades the band, fills the marks that landed in it, and dashes the average
 *     (rule 10) — its labels read "2 of 3 in range", never "best";
 *   · one reading is one point and no line (rule 3); a unit change is a break the caller states.
 * Nothing here ranks, scores, projects, or draws a team figure beside a child.
 */
const VIEW_W = 720;
const VIEW_H = 262;
const PAD_L = 54;
const PAD_R = 50;
const PAD_T = 34;
const PAD_B = 34;

export default function DevelopmentProgressChart({ series, playerName }: { series: ProgressSeries; playerName: string }) {
  const { points, band, unit, def } = series;
  if (points.length === 0) return null;

  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const axis = progressAxis(points.flatMap(p => [p.value, ...p.marks.map(m => m.value)]), band);
  const span = axis.max - axis.min || 1;
  const xs = xFractions(points.map(p => p.row.recordedOn)).map(f => PAD_L + f * innerW);
  const yAt = (v: number) => PAD_T + ((axis.max - v) / span) * innerH;
  const isRange = band != null;
  const { title, description } = describeSeries(series, playerName);
  const titleId = `dpc-title-${def.name.replace(/\W+/g, '-')}`;
  const descId = `dpc-desc-${def.name.replace(/\W+/g, '-')}`;

  const linePath = points.length >= 2
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${yAt(p.value).toFixed(1)}`).join(' ')
    : null;

  // A label above a point sits above its highest mark, so it never lands on an attempt.
  const labelY = (i: number) => {
    const top = Math.min(yAt(points[i].value), ...points[i].marks.map(m => yAt(m.value)));
    return top - 12;
  };
  // Date labels: a label takes the upper row unless it would overlap the last label placed there,
  // then the lower row — so three or four close dates still read.
  const lastX = [-Infinity, -Infinity];
  const dateRow = xs.map(x => {
    const row = x - lastX[0] < 64 ? 1 : 0;
    lastX[row] = x;
    return row;
  });
  const dateY = dateRow.map(r => (r === 1 ? VIEW_H - 4 : VIEW_H - 15));
  // A label at either edge anchors inward, so "2 of 3 in range" never spills past the drawing.
  const anchorAt = (x: number) => (x > VIEW_W - 90 ? 'end' : x < 90 ? 'start' : 'middle');

  return (
    <div className={styles.chartCard}>
      <div className={styles.ccHead}>
        <span className={styles.ccTitle}>{def.name}</span>
        <span className={`${styles.ccCap} ${styles.secondary}`}>
          {isRange
            ? 'Actual dates. Exact attempts. The shaded band is the aim; filled marks landed in it, hollow ones missed. The dashed line is the average per session.'
            : `Actual dates. Exact results. The line follows the ${series.lineWord} per session; the small grey marks are every attempt. No fill beneath the axis.`}
        </span>
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-labelledby={`${titleId} ${descId}`} className={styles.svg}>
        <title id={titleId}>{title}</title>
        <desc id={descId}>{description}</desc>

        {/* The band — the aim — drawn first so every mark sits on top of it. */}
        {band && (
          <>
            <rect x={PAD_L} y={yAt(band.to)} width={innerW} height={Math.max(1, yAt(band.from) - yAt(band.to))} className={styles.progressBand} />
            <text x={VIEW_W - PAD_R + 6} y={yAt(band.to) + 3} className={styles.progressBandLabel}>{formatValue(band.to)} · aim</text>
            <text x={VIEW_W - PAD_R + 6} y={yAt(band.from) + 3} className={styles.progressBandLabel}>{formatValue(band.from)}</text>
          </>
        )}

        {/* Labelled ticks, no fill beneath (rule 5). */}
        {axis.ticks.map(t => (
          <g key={t}>
            <line x1={PAD_L} y1={yAt(t)} x2={VIEW_W - PAD_R} y2={yAt(t)} className={styles.progressTick} />
            <text x={PAD_L - 8} y={yAt(t) + 3} textAnchor="end" className={styles.secondary}>{formatValue(t)}</text>
          </g>
        ))}
        <text x={PAD_L} y={PAD_T - 18} className={styles.progressUnit}>{unit}</text>

        {/* Every attempt, at its own value — quiet, or filled when it landed in the band. */}
        {points.map((p, i) => p.marks.map((m, k) => (
          <circle key={`${p.row.key}-${k}`} cx={xs[i]} cy={yAt(m.value)} r={isRange ? 4 : 3.5}
            className={m.inRange ? styles.progressMarkIn : styles.progressMark} />
        )))}

        {/* The line — the headline per session, or the average, dashed for a range test. */}
        {linePath && <path d={linePath} className={isRange ? styles.progressLineDashed : styles.progressLine} />}

        {/* The point the line passes through, its figure above it, its date beneath. */}
        {points.map((p, i) => (
          <g key={p.row.key}>
            {!isRange && <circle cx={xs[i]} cy={yAt(p.value)} r={5} className={styles.progressPoint} />}
            <text x={xs[i]} y={labelY(i)} textAnchor={anchorAt(xs[i])} className={styles.progressLabel}>{p.label}</text>
            <text x={xs[i]} y={dateY[i]} textAnchor="middle" className={styles.secondary}>{formatShortDate(p.row.recordedOn)}</text>
          </g>
        ))}
      </svg>
      {points.length === 1 && (
        <div className={styles.foot}>One result — a single reading is a point, not a change. The line appears with the next one.</div>
      )}
    </div>
  );
}
