'use client';
import { useEffect, useState } from 'react';
import { useOrg } from '@/lib/org-context';
import { houseLeagueAccess, type HouseLeagueAccess } from '@/lib/house-league-access';
import { orderSeasons } from '@/lib/house-league-season';
import type { LeagueSeasonStatus } from '@/lib/types';

/** One season as the season frame (rail block, phone header and strip) lists it. */
export type FrameSeason = {
  id: string;
  name: string;
  status: LeagueSeasonStatus;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  createdAt: string | null;
  /** Registrations waiting for review: the amber count on Registrations. */
  pendingReviewCount: number;
};

const CHANGED = 'house-league-seasons-changed';

/** Tell the season frame a season changed (a status move, a rename, a review), so its list and counts re-read. */
export function announceSeasonsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED));
}

/**
 * The club's house-league seasons, in the switcher's order (live first, then Finished). Read from the seasons route's
 * SUMMARIES — `{ season, pendingReviewCount, … }` — which is what F02 got wrong: the rail read `id`/`name` off the summary
 * itself, found none, and the switcher never rendered. Only fetched while `enabled` (inside a season).
 */
export function useHouseLeagueSeasons(enabled: boolean): FrameSeason[] {
  const { currentOrg } = useOrg();
  const slug = enabled ? currentOrg?.slug : undefined;
  const [seasons, setSeasons] = useState<FrameSeason[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!slug) return;
    const bump = () => setTick(t => t + 1);
    window.addEventListener(CHANGED, bump);
    return () => window.removeEventListener(CHANGED, bump);
  }, [slug]);
  useEffect(() => {
    if (!slug) return;
    // A late answer for the org you just left must not overwrite this one's list.
    let stale = false;
    fetch(`/api/admin/house-league/seasons?orgSlug=${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (stale) return;
        const list: unknown[] = Array.isArray(d?.seasons) ? d.seasons : [];
        const rows: FrameSeason[] = [];
        for (const item of list) {
          const sum = item as { season?: Record<string, unknown>; pendingReviewCount?: unknown } | null;
          const s = sum?.season;
          if (!s || typeof s.id !== 'string' || typeof s.name !== 'string') continue;
          rows.push({
            id: s.id,
            name: s.name,
            status: s.status as LeagueSeasonStatus,
            seasonStartDate: (s.seasonStartDate as string | null) ?? null,
            seasonEndDate: (s.seasonEndDate as string | null) ?? null,
            createdAt: (s.createdAt as string | null) ?? null,
            pendingReviewCount: typeof sum?.pendingReviewCount === 'number' ? sum.pendingReviewCount : 0,
          });
        }
        setSeasons(orderSeasons(rows));
      })
      .catch(() => {});
    return () => { stale = true; };
  }, [slug, tick]);
  return seasons;
}

/** The one house-league gate's answer for the signed-in member (and a season, when given): what to render. */
export function useHouseLeagueAccess(season?: { status: string } | null): HouseLeagueAccess | null {
  const { currentOrg, userRole, userCapabilities } = useOrg();
  if (!currentOrg || !userRole) return null;
  return houseLeagueAccess({ role: userRole, capabilities: userCapabilities ?? null }, currentOrg, season);
}
