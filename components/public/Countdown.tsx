'use client';
/**
 * components/public/Countdown.tsx
 * Live "time until <target>" label (e.g. "First pitch in 2d 14h"). Ticks each
 * minute. SSR-safe: the first value is computed from the server clock so no-JS
 * visitors still see a (static) countdown. Renders `whenPast` (default nothing)
 * once the target has passed.
 */
import { useEffect, useState } from 'react';

interface Props {
  /** ISO datetime to count down to. */
  target: string;
  prefix?: string;
  className?: string;
  /** Rendered once the target is in the past. Default: render nothing. */
  whenPast?: React.ReactNode;
}

function fmt(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  // Plain, single-unit words — "41 days" reads better than "41d 19h" (and the
  // hours are noise that far out). Granularity tightens as the event nears.
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${Math.max(mins, 1)} minute${mins === 1 ? '' : 's'}`;
}

export default function Countdown({ target, prefix, className, whenPast = null }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const ms = Date.parse(target) - now;
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return <>{whenPast}</>;

  return <span className={className}>{prefix}{fmt(ms)}</span>;
}
