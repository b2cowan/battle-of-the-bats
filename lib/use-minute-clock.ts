'use client';

import { useEffect, useState } from 'react';

/**
 * "What time is it, to the minute?" — the clock a screen reads to decide a time-bound state:
 * the Practice plans hub's card (the ±3h run window), the practice sheet ("How it went" appears
 * once the practice has started).
 *
 * Snapshotted in state so the render body stays pure (the Lineups rule), and re-read once a
 * minute so a tab left open through an afternoon changes its mind at the right moment rather
 * than on the next reload (/review, 2026-09-14). One hook rather than a copy per screen: the
 * third copy of this interval is where a future refinement (pausing on a hidden tab, a
 * visibility re-read) would have been applied to two screens and missed on the third.
 */
export function useMinuteClock(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return nowMs;
}
