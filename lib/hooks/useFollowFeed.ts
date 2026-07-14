'use client';
/**
 * lib/hooks/useFollowFeed.ts
 * Fetches the enriched Following feed (live/next/recent per followed team)
 * from /api/consumer/follows/feed and keeps it fresh with a light poll while
 * the tab is visible — same visibility-aware cadence as usePublicTournamentLive,
 * generalized to a cross-tournament team list instead of one tournament's
 * section data (unified-app Phase 2 Slice 2). Backs off to a slow cadence
 * whenever nothing in the last fetch was actually live, so an idle Following
 * tab (the common case outside game windows) isn't re-fetching every tick.
 */
import { useEffect, useRef, useState } from 'react';
import type { FollowFeedEntry, FollowFeedInput } from '@/lib/follow-feed';

interface Options {
  teams: FollowFeedInput[];
  /** Poll cadence in ms while at least one followed team is live. Default 30s. */
  intervalMs?: number;
  /** Poll cadence in ms while nothing is live. Default 5 min. */
  idleIntervalMs?: number;
  /** Seed the hook with server-computed entries so the first paint has no flash. */
  initialEntries?: FollowFeedEntry[];
}

async function fetchFeed(teams: FollowFeedInput[]): Promise<FollowFeedEntry[] | null> {
  try {
    const res = await fetch('/api/consumer/follows/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.entries) ? data.entries : null;
  } catch {
    return null;
  }
}

export function useFollowFeed({ teams, intervalMs = 30_000, idleIntervalMs = 5 * 60_000, initialEntries }: Options) {
  const hasTeams = teams.length > 0;
  const [entries, setEntries] = useState<FollowFeedEntry[]>(initialEntries ?? []);
  const [loading, setLoading] = useState(!initialEntries);
  // Stable key so the fetch effect only re-runs when the actual team set changes,
  // not on every re-render of the parent (teams is a fresh array each render).
  const teamsKey = teams.map(t => `${t.orgSlug}/${t.tournamentSlug}/${t.teamId}`).sort().join(',');
  // Which team set `entries`/`loading` currently reflect — lets a genuine
  // change (not the initial mount, already seeded via the useState initializer
  // above) invalidate stale state instead of silently keeping the PREVIOUS
  // team set's cached game data on screen while the new fetch is in flight.
  const renderedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasTeams) return;

    if (renderedKeyRef.current !== null && renderedKeyRef.current !== teamsKey) {
      // A fresh server-computed seed for THIS exact team set (e.g. right after
      // claiming device follows onto the account, which re-renders with new
      // `initialEntries`) can be shown immediately with no flash; otherwise
      // clear so a stale prior team's data can't render mid-fetch.
      setEntries(initialEntries ?? []);
      setLoading(!initialEntries);
    }
    renderedKeyRef.current = teamsKey;

    let cancelled = false;
    let lastFetchAt = 0;
    let lastHadLive = false;
    // Guards against out-of-order responses: two ticks can be in flight at
    // once (e.g. the poll interval and a visibilitychange catch-up firing
    // close together on a flaky mobile connection) — only the response to
    // the MOST RECENTLY issued request is allowed to update state.
    let requestSeq = 0;

    async function tick(showLoading: boolean) {
      const seq = ++requestSeq;
      if (showLoading) setLoading(true);
      const data = await fetchFeed(teams);
      if (!cancelled && seq === requestSeq) {
        if (data) {
          setEntries(data);
          lastHadLive = data.some(e => e.group === 'live');
        }
        if (showLoading) setLoading(false);
        lastFetchAt = Date.now();
      }
    }

    void tick(!initialEntries);

    // The interval always fires at the fast cadence, but only actually fetches
    // once the applicable cadence (fast while live, idle otherwise) has elapsed.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const dueDelay = lastHadLive ? intervalMs : idleIntervalMs;
      if (Date.now() - lastFetchAt >= dueDelay) void tick(false);
    }, intervalMs);
    // Regaining focus is a natural "give me fresh data now" moment — always
    // refetch immediately rather than waiting out the idle backoff.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick(false);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teamsKey (derived from teams) and initialEntries are the intentional deps; the effect re-closes over fresh values whenever teamsKey actually changes
  }, [teamsKey, hasTeams, intervalMs, idleIntervalMs]);

  if (!hasTeams) return { entries: [] as FollowFeedEntry[], loading: false };
  return { entries, loading };
}
