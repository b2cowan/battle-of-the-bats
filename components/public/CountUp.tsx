'use client';
/**
 * components/public/CountUp.tsx
 * Animates a number from 0 → value once on mount (easeOutCubic). Used for the
 * tournament-home hero stats. Reduced-motion (or value ≤ 0) shows the final value
 * immediately; the animation only ever runs once, so it never re-fires.
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  durationMs?: number;
  className?: string;
}

export default function CountUp({ value, durationMs = 900, className }: Props) {
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || value <= 0) {
      // Snap to the final value (no animation) — runs once on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      return;
    }

    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{display}</span>;
}
