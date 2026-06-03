'use client';
/**
 * lib/hooks/usePublicTournamentLive.ts
 * Lightweight real-time refresh for public tournament pages. Re-invokes the
 * existing section fetch on an interval and hands the fresh payload to `onData`,
 * which each component merges into its own state (by id) so React only re-renders
 * changed rows — no skeleton flash, no layout jank.
 *
 * Designed to only run on game day: callers pass `enabled = isTournamentInProgress(...)`.
 * Polling pauses while the tab is hidden and fires an immediate catch-up refresh
 * when the tab becomes visible again.
 */
import { useEffect, useRef } from 'react';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import type {
  PublicTournamentPageData,
  PublicTournamentSection,
} from '@/lib/public-tournament-data';

interface Options {
  orgSlug: string;
  tournamentSlug: string;
  section: PublicTournamentSection;
  /** Gate polling — typically isTournamentInProgress(tournament). */
  enabled: boolean;
  /** Poll cadence in ms. Default 30s. */
  intervalMs?: number;
  onData: (data: PublicTournamentPageData) => void;
}

export function usePublicTournamentLive({
  orgSlug,
  tournamentSlug,
  section,
  enabled,
  intervalMs = 30_000,
  onData,
}: Options): void {
  // Keep the latest callback in a ref so the polling effect doesn't reset its
  // interval every render (onData is typically an inline closure).
  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    let cancelled = false;

    async function tick() {
      if (document.visibilityState === 'hidden') return;
      try {
        const data = await fetchPublicTournamentData(orgSlug, tournamentSlug, section);
        if (!cancelled && data) onDataRef.current(data);
      } catch {
        /* transient network failure — the next tick will retry */
      }
    }

    const intervalId = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [orgSlug, tournamentSlug, section, enabled, intervalMs]);
}
