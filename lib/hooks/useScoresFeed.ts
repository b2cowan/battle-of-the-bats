'use client';
/**
 * lib/hooks/useScoresFeed.ts
 * Fetches the Scores tab's two-lane payload from /api/consumer/scores and keeps the LIVE
 * section fresh with a light foreground poll (Unified Home Phase 3). Same visibility-aware,
 * live-backoff cadence as useFollowFeed: ~30s while anything is live, a slow idle cadence
 * otherwise, and an immediate refetch when the tab regains focus — so an idle Scores tab
 * outside game windows isn't re-fetching every tick.
 *
 * Auth is discovered by the first GET: a signed-in account gets its server union; a
 * signed-out visitor's GET returns `signedIn:false`, after which the hook POSTs the
 * device's local team follows (which have no server session to resolve from) and polls
 * that instead. Device-only visitors with no follows never poll.
 */
import { useEffect, useRef, useState } from 'react';
import type { ScoresPayload } from '@/lib/scores-view';

export interface DeviceFollowTeam {
  teamId: string;
  teamName: string;
  orgSlug: string;
  tournamentSlug: string;
}
export interface DeviceFollowTournament { orgSlug: string; tournamentSlug: string; }
export interface DeviceFollowOrg { orgSlug: string; }

interface Options {
  /** The device's local team follows — used for the signed-out lanes. */
  deviceTeams: DeviceFollowTeam[];
  /** The device's local whole-event follows (Phase 6) — signed-out event tiles. */
  deviceTournaments?: DeviceFollowTournament[];
  /** The device's local org follows (Phase 6) — signed-out org tiles. */
  deviceOrgs?: DeviceFollowOrg[];
  /** True once localStorage device follows have resolved (avoids a premature empty POST). */
  deviceReady: boolean;
  /** Poll cadence (ms) while something is live. Default 30s. */
  intervalMs?: number;
  /** Poll cadence (ms) while nothing is live. Default 5 min. */
  idleIntervalMs?: number;
}

async function fetchSession(): Promise<ScoresPayload | null> {
  try {
    const res = await fetch('/api/consumer/scores', { headers: { 'Cache-Control': 'no-store' } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function fetchDevice(
  teams: DeviceFollowTeam[],
  tournaments: DeviceFollowTournament[],
  orgs: DeviceFollowOrg[],
): Promise<ScoresPayload | null> {
  try {
    const res = await fetch('/api/consumer/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams, tournaments, orgs }),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function useScoresFeed({
  deviceTeams,
  deviceTournaments = [],
  deviceOrgs = [],
  deviceReady,
  intervalMs = 30_000,
  idleIntervalMs = 5 * 60_000,
}: Options) {
  const [payload, setPayload] = useState<ScoresPayload | null>(null);
  const [loading, setLoading] = useState(true);
  // Which device team set the current `payload` reflects — lets a genuine follow-set change
  // invalidate a stale signed-out payload instead of leaving a now-unfollowed team on screen
  // until the refetch lands (mirrors useFollowFeed's renderedKeyRef).
  const renderedKeyRef = useRef<string | null>(null);

  // Stable key so the effect only re-runs when the device follow set (or readiness) actually
  // changes — the arrays are fresh each render. Covers all three device follow types.
  const teamsKey = [
    ...deviceTeams.map(t => `${t.orgSlug}/${t.tournamentSlug}/${t.teamId}`),
    ...deviceTournaments.map(t => `t:${t.orgSlug}/${t.tournamentSlug}`),
    ...deviceOrgs.map(o => `o:${o.orgSlug}`),
  ].sort().join(',');
  const hasDeviceFollows = deviceTeams.length > 0 || deviceTournaments.length > 0 || deviceOrgs.length > 0;

  useEffect(() => {
    if (renderedKeyRef.current !== null && renderedKeyRef.current !== teamsKey) {
      // Device follows changed mid-session (e.g. a cross-tab unfollow): drop a stale signed-out
      // payload so the removed team's rows don't linger during the refetch. A signed-in session
      // payload is independent of device follows, so leave it (no needless skeleton flash).
      setPayload(prev => (prev && !prev.signedIn ? null : prev));
    }
    renderedKeyRef.current = teamsKey;

    // 'auto' until the first GET tells us which mode to poll in.
    let mode: 'auto' | 'session' | 'device' = 'auto';
    let cancelled = false;
    let lastFetchAt = 0;
    let lastHadLive = false;
    let requestSeq = 0;

    async function tick(showLoading: boolean) {
      // Signed-out with no device follows → nothing personal to fetch; the board carries.
      if (mode === 'device' && !hasDeviceFollows) {
        if (showLoading) setLoading(false);
        return;
      }
      const seq = ++requestSeq;
      if (showLoading) setLoading(true);
      let data = mode === 'device' ? await fetchDevice(deviceTeams, deviceTournaments, deviceOrgs) : await fetchSession();
      if (cancelled || seq !== requestSeq) return;

      // The first GET reveals auth: a signed-out device that follows anything switches to the
      // POST/device path and re-fetches its real lanes in this SAME tick (no extra poll wait).
      if (mode === 'auto' && data) {
        mode = data.signedIn ? 'session' : 'device';
        if (mode === 'device' && hasDeviceFollows) {
          data = await fetchDevice(deviceTeams, deviceTournaments, deviceOrgs);
          if (cancelled || seq !== requestSeq) return;
        }
      }

      if (data) {
        setPayload(data);
        lastHadLive = data.liveCount > 0;
        lastFetchAt = Date.now();
      }
      if (showLoading) setLoading(false);
    }

    // Wait for localStorage follows before the first fetch so a signed-out visitor's
    // device lanes aren't skipped by an empty initial POST.
    if (deviceReady) void tick(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const due = lastHadLive ? intervalMs : idleIntervalMs;
      if (Date.now() - lastFetchAt >= due) void tick(false);
    }, intervalMs);
    const onVisible = () => { if (document.visibilityState === 'visible') void tick(false); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teamsKey (derived from deviceTeams) + deviceReady are the intentional deps; the effect re-closes over fresh values when they change
  }, [teamsKey, deviceReady, intervalMs, idleIntervalMs]);

  return { payload, loading };
}
