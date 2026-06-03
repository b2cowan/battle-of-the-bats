'use client';

/**
 * Admin count-up (B8). Animates from the previously-settled value to `value`
 * (so it counts 0 → N on first data load — the dashboard starts at zeroed stats —
 * and re-animates old → new when a poll changes the number).
 *
 * Poll-stable: a re-render with an unchanged value does nothing (tracked in a ref).
 * Reduced motion snaps to the value. Uses requestAnimationFrame, so the global CSS
 * prefers-reduced-motion guard doesn't cover it — it's handled here.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  durationMs?: number;
  className?: string;
}

export default function CountUp({ value, durationMs = 800, className }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return; // unchanged (e.g. poll returned the same number)

    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{display}</span>;
}
