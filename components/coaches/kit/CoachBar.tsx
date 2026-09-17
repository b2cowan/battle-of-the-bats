import clsx from 'clsx';
import type { ReactNode } from 'react';
import kit from './CoachKit.module.css';

export type CoachBarSegment = {
  /** Share of the track, 0–100. The component floors a visible slice at 2% so a coach SEES it. */
  pct: number;
  /** `fill` (olive), `bad` (a solid danger fill — the share itself is the alarm) or `over` (the
   *  hatched overrun past a plan — never just red, deutan ruling). */
  tone?: 'fill' | 'bad' | 'over';
};

export type CoachBarLegendItem = {
  dot: 'fill' | 'over' | 'track';
  text: ReactNode;
};

/**
 * A ratio as geometry: the 12px track, its segments with a 2px gap, and — when given — the legend
 * under it that says what each slice is. Money's "Bills settled", Skills & Goals' "Players
 * measured", the Overview's Dues tile all draw this one bar (the tile drew a 5px lime pill).
 *
 * Without `label` the bar is `aria-hidden`: the words live in the figure above it and the legend
 * beside it, where a screen reader already reads them. With `label` ("9 of 12 players measured")
 * it is an image with that name — for a card whose legend does not restate the ratio.
 */
export default function CoachBar({ segments, legend, label, title }: {
  segments: CoachBarSegment[];
  legend?: CoachBarLegendItem[];
  /** The bar's accessible name; without it the bar is `aria-hidden` (the figure and legend say it). */
  label?: string;
  /** A hover sentence for a mouse ("3 of 12 players have a jersey number and position") — the
   *  Overview tiles' gauge carried one distinct from the terse label under it. */
  title?: string;
}) {
  const shown = segments.filter(s => s.pct > 0);
  return (
    <>
      <div className={kit.bar} title={title} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
        {shown.map((s, i) => (
          <div
            key={i}
            className={clsx(kit.seg, s.tone === 'over' ? kit.segOver : s.tone === 'bad' ? kit.segBad : kit.segFill)}
            style={{ width: `${Math.min(Math.max(s.pct, 2), 100)}%` }}
          />
        ))}
      </div>
      {legend && legend.length > 0 && (
        <div className={kit.legend}>
          {legend.map((item, i) => (
            <span key={i}>
              <span className={clsx(kit.legendDot, item.dot === 'over' ? kit.dotOver : item.dot === 'track' ? kit.dotTrack : kit.dotFill)} />
              {item.text}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
