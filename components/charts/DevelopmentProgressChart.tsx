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
 *   · one result is one point and no line (rule 3) — the scope line above the chart says so.
 * Nothing here ranks, scores, projects, or draws a team figure beside a child.
 *
 * ⚠ THE CAPTION IS A LEGEND, NOT A RULEBOOK (re-evaluation stage 4, owner ruling G3, 2026-09-16):
 * it says what the line is and what the marks are, and follows the Show choice. "Actual dates",
 * "Exact results" and "No fill beneath the axis" are true and live in the help article the page's
 * "?" opens. The one-result foot went with it — the scope line already says a single result is a
 * point, not a change.
 *
 * ⚠ TWO DRAWING SIZES (G4). The desktop drawing (720 × 262) scaled to a phone was 118px tall with
 * its labels switched off by the card's own container rule. Below 640 the SAME series is drawn at a
 * phone aspect (358 × 240) with 12px labels — the same marks, band, label stagger and date rule.
 * Both are rendered and the stylesheet shows one, so the drawing never re-measures on resize.
 */
interface Drawing {
  w: number; h: number; padL: number; padR: number; padT: number; padB: number;
  /** Two date labels closer than this on x take the lower row. */
  dateGap: number;
  /** A point label this close to an edge anchors inward. */
  edge: number;
  /** The phone's date labels anchor inward too — at 358 wide "15 Sept" centred on the last point would run past the edge. */
  datesAnchorInward: boolean;
  className: string;
}
const DESKTOP: Drawing = { w: 720, h: 262, padL: 54, padR: 50, padT: 34, padB: 34, dateGap: 64, edge: 90, datesAnchorInward: false, className: styles.progressDesktop };
const PHONE: Drawing = { w: 358, h: 240, padL: 40, padR: 34, padT: 30, padB: 30, dateGap: 56, edge: 60, datesAnchorInward: true, className: styles.progressPhone };

export default function DevelopmentProgressChart({ series, playerName }: { series: ProgressSeries; playerName: string }) {
  const { points, band, def } = series;
  if (points.length === 0) return null;
  const isRange = band != null;
  const { title, description } = describeSeries(series, playerName);
  const slug = def.name.replace(/\W+/g, '-');
  // The scale and the dates' spacing are the series' own — computed once, drawn twice.
  const axis = progressAxis(points.flatMap(p => [p.value, ...p.marks.map(m => m.value)]), band);
  const fractions = xFractions(points.map(p => p.row.recordedOn));
  const shared = { series, axis, fractions, title, description };

  return (
    <div className={styles.chartCard}>
      <div className={styles.ccHead}>
        <span className={styles.ccTitle}>{def.name}</span>
        {/* The legend: the line, the marks — and for a range test the band and the dashed average.
            Not `.secondary`: the card's container rule hides that below 420px, and the phone drawing
            needs its legend as much as its ticks. */}
        <span className={styles.ccCap}>
          {isRange
            ? 'The shaded band is the aim · filled marks landed in it · dashed line: the average per session'
            : `${series.lineWord[0].toUpperCase()}${series.lineWord.slice(1)} per session · grey marks: every attempt`}
        </span>
      </div>
      <Svg {...shared} drawing={DESKTOP} ids={`dpc-${slug}`} />
      <Svg {...shared} drawing={PHONE} ids={`dpc-phone-${slug}`} />
    </div>
  );
}

/** One drawing of the series at one size — only the scaling to the drawing's box happens here. */
function Svg({ series, axis, fractions, drawing: d, title, description, ids }: {
  series: ProgressSeries; axis: ReturnType<typeof progressAxis>; fractions: number[];
  drawing: Drawing; title: string; description: string; ids: string;
}) {
  const { points, band, unit } = series;
  const innerW = d.w - d.padL - d.padR;
  const innerH = d.h - d.padT - d.padB;
  const span = axis.max - axis.min || 1;
  const xs = fractions.map(f => d.padL + f * innerW);
  const yAt = (v: number) => d.padT + ((axis.max - v) / span) * innerH;
  const isRange = band != null;

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
    const row = x - lastX[0] < d.dateGap ? 1 : 0;
    lastX[row] = x;
    return row;
  });
  const dateY = dateRow.map(r => (r === 1 ? d.h - 4 : d.h - 15));
  // A label at either edge anchors inward, so "2 of 3 in range" never spills past the drawing.
  const anchorAt = (x: number) => (x > d.w - d.edge ? 'end' : x < d.edge ? 'start' : 'middle');

  return (
    <svg viewBox={`0 0 ${d.w} ${d.h}`} role="img" aria-labelledby={`${ids}-title ${ids}-desc`} className={`${styles.svg} ${d.className}`}>
      <title id={`${ids}-title`}>{title}</title>
      <desc id={`${ids}-desc`}>{description}</desc>

      {/* The band — the aim — drawn first so every mark sits on top of it. */}
      {band && (
        <>
          <rect x={d.padL} y={yAt(band.to)} width={innerW} height={Math.max(1, yAt(band.from) - yAt(band.to))} className={styles.progressBand} />
          <text x={d.w - d.padR + 6} y={yAt(band.to) + 3} className={styles.progressBandLabel}>{formatValue(band.to)} · aim</text>
          <text x={d.w - d.padR + 6} y={yAt(band.from) + 3} className={styles.progressBandLabel}>{formatValue(band.from)}</text>
        </>
      )}

      {/* Labelled ticks, no fill beneath (rule 5). */}
      {axis.ticks.map(t => (
        <g key={t}>
          <line x1={d.padL} y1={yAt(t)} x2={d.w - d.padR} y2={yAt(t)} className={styles.progressTick} />
          <text x={d.padL - 8} y={yAt(t) + 3} textAnchor="end" className={styles.progressAxisLabel}>{formatValue(t)}</text>
        </g>
      ))}
      <text x={d.padL} y={d.padT - 18} className={styles.progressUnit}>{unit}</text>

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
          <text x={xs[i]} y={dateY[i]} textAnchor={d.datesAnchorInward ? anchorAt(xs[i]) : 'middle'} className={styles.progressAxisLabel}>{formatShortDate(p.row.recordedOn)}</text>
        </g>
      ))}
    </svg>
  );
}
