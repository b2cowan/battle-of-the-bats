/**
 * Tiny inline trend line — player-vs-self / metric-vs-itself only, never a comparison
 * between people. Renders NOTHING below 2 points (honest-data rule: a single reading is
 * not a trend). Shared so Player Development (3A), the evaluation-session surfaces (3B),
 * and the Development report (3D) draw trends identically.
 * (Two older hand-rolled sparklines exist in the admin dashboard + observability pages —
 * candidates to migrate here when next touched.)
 */
export default function Sparkline({
  values,
  width = 52,
  height = 16,
  stroke = 'var(--logic-lime)',
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (values.length < 2) return null;
  const pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i * (width - pad * 2)) / (values.length - 1);
    const y = height - pad - ((v - min) * (height - pad * 2)) / span;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lastX, lastY] = pts[pts.length - 1].split(',');
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="1.5" />
      <circle cx={lastX} cy={lastY} r="2" fill={stroke} />
    </svg>
  );
}
