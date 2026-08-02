'use client';
/**
 * components/public/Countdown.tsx
 * Live "time until <target>" label (e.g. "First pitch in 2 days"). Ticks each
 * minute. SSR-safe: the first value is computed from the server clock so no-JS
 * visitors still see a (static) countdown. Renders `whenPast` (default nothing)
 * once the target has passed.
 *
 * Mounted by the real public hero AND by the setup wizard's live preview
 * (components/admin/TournamentCreationPreview.tsx) — same component, so the
 * countdown an organizer watches while typing is literally the one fans get.
 */
import { useEffect, useState } from 'react';
import { formatCountdownDuration } from '@/lib/tournament-hero-copy';

interface Props {
  /** ISO datetime to count down to. */
  target: string;
  prefix?: string;
  className?: string;
  /** Rendered once the target is in the past. Default: render nothing. */
  whenPast?: React.ReactNode;
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

  return <span className={className}>{prefix}{formatCountdownDuration(ms)}</span>;
}
