'use client';
/**
 * components/public/Countdown.tsx
 * Live "time until <target>" label (e.g. "Starts in 2 days"). Ticks each
 * minute. Renders `whenPast` (default nothing) once the target has passed.
 *
 * ⚠ BROWSER-ONLY, ON PURPOSE (2026-10-13). It used to compute its first value on the
 * server so a no-JS visitor saw a static countdown, but the server and the browser
 * cannot agree on the answer: a target is a wall-clock time with no zone, so the
 * server reads it in UTC and the browser in the viewer's zone. Every evening from
 * 8 p.m. to midnight Eastern they landed on different days ("260 days" vs "261"),
 * and close to a game one side said "Under way" while the other still counted.
 * That mismatch is not cosmetic — React rebuilds the WHOLE document when hydration
 * fails (the app has no Suspense boundary to contain it), which strips every
 * attribute the no-flash script put on <html>: a Warm coach watched the portal go
 * Dark under a white top bar. So the server and the hydration pass render the same
 * blank placeholder (one line tall, so the line does not jump), and the real value
 * arrives on the render right after hydration.
 *
 * Mounted by the real public hero AND by the setup wizard's live preview
 * (components/admin/TournamentCreationPreview.tsx) — same component, so the
 * countdown an organizer watches while typing is literally the one fans get.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { formatCountdownDuration } from '@/lib/tournament-hero-copy';

interface Props {
  /** ISO datetime to count down to. */
  target: string;
  prefix?: string;
  className?: string;
  /** Rendered once the target is in the past. Default: render nothing. */
  whenPast?: React.ReactNode;
}

// Nothing to subscribe to: the store only answers "is this the browser, after hydration?"
// (false on the server and during hydration, true from the next render on).
function subscribeHydrated() {
  return () => {};
}

export default function Countdown({ target, prefix, className, whenPast = null }: Props) {
  const hydrated = useSyncExternalStore(subscribeHydrated, () => true, () => false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!hydrated) return <span className={className} aria-hidden="true">{' '}</span>;

  const ms = Date.parse(target) - now;
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return <>{whenPast}</>;

  return <span className={className}>{prefix}{formatCountdownDuration(ms)}</span>;
}
