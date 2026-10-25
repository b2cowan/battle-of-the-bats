// Calls-vs-errors line chart — pure SVG, no charting dependency. Cloned from the
// CumulativeChart pattern in app/[orgSlug]/coaches/.../budget-vs-actual/page.tsx.
// Renders two lines (instrumented calls + errors) on a shared axis so an error spike
// stands out against call volume. Server-renderable (no hooks / no 'use client').
// Colour is the palette's tokens only (olive for calls, danger for errors), so Warm and Dark both read.

import type { ChartPoint } from '@/lib/observability/dashboard';

function fmtInt(n: number) {
  return Math.round(n).toLocaleString('en-CA');
}

const AXIS_TEXT = { fill: 'var(--text-tertiary)', fontSize: 'var(--type-label)' } as const;

export default function CallsVsErrorsChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return null;
  }

  const VW = 1160;
  const VH = 220;
  const ML = 56;
  const MR = 12;
  const MT = 14;
  const MB = 34;
  const CW = VW - ML - MR;
  const CH = VH - MT - MB;

  const maxVal = Math.max(...data.map(d => Math.max(d.calls, d.errors)), 1);
  const n = data.length;

  function xPos(i: number) {
    return ML + (n === 1 ? CW / 2 : (i / (n - 1)) * CW);
  }
  function yPos(v: number) {
    return MT + (1 - v / maxVal) * CH;
  }

  const callsPts = data.map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.calls).toFixed(1)}`);
  const errorsPts = data.map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.errors).toFixed(1)}`);
  const callsPath = `M ${callsPts.join(' L ')}`;
  const errorsPath = `M ${errorsPts.join(' L ')}`;
  const callsArea = `M ${xPos(0).toFixed(1)},${(MT + CH).toFixed(1)} L ${callsPts.join(' L ')} L ${xPos(n - 1).toFixed(1)},${(MT + CH).toFixed(1)} Z`;

  const gridLines = [0.25, 0.5, 0.75, 1].map(ratio => ({
    y: MT + (1 - ratio) * CH,
    label: fmtInt(maxVal * ratio),
  }));

  // Show at most ~7 x-axis labels to avoid crowding.
  const labelStep = Math.max(1, Math.ceil(n / 7));

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Calls versus errors over time">
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={ML} y1={g.y} x2={ML + CW} y2={g.y} style={{ stroke: 'var(--home-line)' }} strokeWidth="1" />
          <text x={ML - 8} y={g.y + 4} textAnchor="end" style={AXIS_TEXT}>{g.label}</text>
        </g>
      ))}
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} style={{ stroke: 'var(--home-line-strong)' }} strokeWidth="1" />

      <path d={callsArea} style={{ fill: 'color-mix(in srgb, var(--home-olive) 8%, transparent)' }} />
      <path d={callsPath} style={{ stroke: 'var(--home-olive)' }} strokeWidth="2" fill="none" />
      <path d={errorsPath} style={{ stroke: 'var(--danger)' }} strokeWidth="2" fill="none" />

      {data.map((d, i) => (
        d.errors > 0 ? <circle key={`e${i}`} cx={xPos(i)} cy={yPos(d.errors)} r="2.5" style={{ fill: 'var(--danger)' }} /> : null
      ))}

      {data.map((d, i) => {
        if (i % labelStep !== 0 && i !== n - 1) return null;
        return (
          <text key={`x${i}`} x={xPos(i)} y={VH - 8} textAnchor={i === n - 1 ? "end" : "middle"} style={AXIS_TEXT}>
            {d.label}
          </text>
        );
      })}

      <g transform={`translate(${ML + 10},${MT + 4})`}>
        <line x1="0" y1="6" x2="18" y2="6" style={{ stroke: 'var(--home-olive)' }} strokeWidth="2" />
        <text x="24" y="10" style={AXIS_TEXT}>Calls</text>
        <line x1="76" y1="6" x2="94" y2="6" style={{ stroke: 'var(--danger)' }} strokeWidth="2" />
        <text x="100" y="10" style={AXIS_TEXT}>Errors</text>
      </g>
    </svg>
  );
}
