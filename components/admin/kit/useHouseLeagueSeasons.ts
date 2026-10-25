'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { useOrg } from '@/lib/org-context';
import { houseLeagueAccess, type HouseLeagueAccess } from '@/lib/house-league-access';
import { orderSeasons } from '@/lib/house-league-season';
import type { LeagueSeason, LeagueSeasonSummary } from '@/lib/types';

/** One season as the season frame (rail block, phone header and strip, lock line) lists it. */
export type FrameSeason = Pick<LeagueSeason, 'id' | 'name' | 'status' | 'seasonStartDate' | 'seasonEndDate' | 'createdAt'> & {
  /** Registrations waiting for review: the amber count on Registrations. */
  pendingReviewCount: number;
};

/**
 * THE CLUB'S HOUSE-LEAGUE SEASONS, READ ONCE PER PAGE (Club Tier Stage 9a). The rail, the phone frame and the lock line all
 * read this list; it lives in one module-level store per org, so a season page makes ONE request (not one per reader), and a
 * burst of changes (`announceSeasonsChanged` after each autosave or review) folds into one re-read. The list is the seasons
 * route's SUMMARIES — `{ season, pendingReviewCount, … }` — which is what F02 got wrong: the rail read `id`/`name` off the
 * summary itself, found none, and the switcher never rendered.
 */
type Store = { slug: string; seasons: FrameSeason[]; inflight: boolean; again: boolean };
const EMPTY: FrameSeason[] = [];
let store: Store | null = null;
const listeners = new Set<() => void>();
let debounce: ReturnType<typeof setTimeout> | null = null;

function emit() { listeners.forEach(l => l()); }

async function read(slug: string) {
  if (!store || store.slug !== slug) store = { slug, seasons: EMPTY, inflight: false, again: false };
  if (store.inflight) { store.again = true; return; }
  store.inflight = true;
  try {
    const res = await fetch(`/api/admin/house-league/seasons?orgSlug=${encodeURIComponent(slug)}`);
    const d = res.ok ? (await res.json()) as { seasons?: LeagueSeasonSummary[] } : null;
    // A late answer for an org you have since left must not overwrite this one's list.
    if (store?.slug !== slug || !d) return;
    store.seasons = orderSeasons((d.seasons ?? []).map(({ season: s, pendingReviewCount }) => ({
      id: s.id, name: s.name, status: s.status, seasonStartDate: s.seasonStartDate ?? null,
      seasonEndDate: s.seasonEndDate ?? null, createdAt: s.createdAt, pendingReviewCount,
    })));
    emit();
  } catch { /* the frame keeps what it had */ } finally {
    if (store?.slug === slug) {
      store.inflight = false;
      if (store.again) { store.again = false; void read(slug); }
    }
  }
}

/** Tell the season frame a season changed (a status move, a rename, a review), so its list and counts re-read — once. */
export function announceSeasonsChanged() {
  if (!store) return;
  const slug = store.slug;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => { debounce = null; void read(slug); }, 150);
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** The club's house-league seasons in the switcher's order (live first, then Finished). Only read while `enabled`. */
export function useHouseLeagueSeasons(enabled: boolean): FrameSeason[] {
  const { currentOrg } = useOrg();
  const slug = enabled ? currentOrg?.slug : undefined;
  useEffect(() => {
    // The first reader for this org reads it; every later reader shares that answer.
    if (slug && (!store || store.slug !== slug)) void read(slug);
  }, [slug]);
  const seasons = useSyncExternalStore(subscribe, () => store?.seasons ?? EMPTY, () => EMPTY);
  return slug && store?.slug === slug ? seasons : EMPTY;
}

/** The one house-league gate's answer for the signed-in member (and a season, when given): what to render. */
export function useHouseLeagueAccess(season?: { status: string } | null): HouseLeagueAccess | null {
  const { currentOrg, userRole, userCapabilities } = useOrg();
  if (!currentOrg || !userRole) return null;
  return houseLeagueAccess({ role: userRole, capabilities: userCapabilities ?? null }, currentOrg, season);
}

/**
 * The gate's answer for a page that works ON ONE SEASON: null until that season has loaded, so nothing writable paints
 * before the page knows whether the season is finished (Q16). Use this, not `useHouseLeagueAccess(season)`, wherever the
 * page's controls depend on the season.
 */
export function useSeasonAccess(season: { status: string } | null | undefined): HouseLeagueAccess | null {
  const access = useHouseLeagueAccess(season);
  return season ? access : null;
}
