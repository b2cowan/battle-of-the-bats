// Calls-vs-errors line chart — pure SVG, no charting dependency. Cloned from the
// CumulativeChart pattern in app/[orgSlug]/coaches/.../budget-vs-actual/page.tsx.
// Renders two lines (instrumented calls + errors) on a shared axis so an error spike
// stands out against call volume. Server-renderable (no hooks / no 'use client').

import type { ChartPoint } from '@/lib/observability/dashboard';

function fmtInt(n: number) {
  return Math.round(n).toLocaleString('en-CA');
}

export default function CallsVsErrorsChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return null;
  }

  const VW = 880;
  const VH = 200;
  const ML = 52;
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
          <line x1={ML} y1={g.y} x2={ML + CW} y2={g.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={ML - 6} y={g.y + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)">{g.label}</text>
        </g>
      ))}
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

      <path d={callsArea} fill="rgba(132,204,22,0.06)" />
      <path d={callsPath} stroke="var(--logic-lime, #84cc16)" strokeWidth="2" fill="none" />
      <path d={errorsPath} stroke="#f87171" strokeWidth="2" fill="none" />

      {data.map((d, i) => (
        d.errors > 0 ? <circle key={`e${i}`} cx={xPos(i)} cy={yPos(d.errors)} r="2.5" fill="#f87171" /> : null
      ))}

      {data.map((d, i) => {
        if (i % labelStep !== 0 && i !== n - 1) return null;
        return (
          <text key={`x${i}`} x={xPos(i)} y={VH - 6} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.35)">
            {d.label}
          </text>
        );
      })}

      <g transform={`translate(${ML + 8},${MT + 6})`}>
        <line x1="0" y1="6" x2="18" y2="6" stroke="var(--logic-lime, #84cc16)" strokeWidth="2" />
        <text x="22" y="10" fontSize="9" fill="rgba(255,255,255,0.5)">Calls</text>
        <line x1="74" y1="6" x2="92" y2="6" stroke="#f87171" strokeWidth="2" />
        <text x="96" y="10" fontSize="9" fill="rgba(255,255,255,0.5)">Errors</text>
      </g>
    </svg>
  );
}
