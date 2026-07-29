'use client';

import { useEffect, useState } from 'react';
import type { TournamentViewer, ViewerHat } from '@/lib/tournament-viewer-hats';

/**
 * lib/use-admin-lateral-hats.ts — the OTHER roles this user holds on the event in admin context
 * ("The Flip", P4/WI-1).
 *
 * Feeds the admin shell's flip control its lateral rows, so a person who both runs an event and
 * coaches in it can jump straight across instead of detouring Admin → public → Coach.
 *
 * WHY A CLIENT FETCH (the P4 plan first proposed a server resolve in the admin layout):
 * the admin layout is a server component, but WHICH tournament is in context is resolved
 * CLIENT-side (TournamentProvider, driven by `?tournamentId=` / persisted selection). The server
 * therefore cannot know the event at layout time, so a server resolve is not available without
 * restructuring tournament selection — far beyond this phase's "deliberately light" mandate.
 *
 * The cost the plan worried about — a fetch on every admin screen — is avoided by a module-level
 * cache keyed on org+tournament that also dedupes in-flight requests. Result: ONE request per
 * event per session, shared by every consumer (the header and the mobile More mirror both call
 * `useAdminFlip`), not one per page view. Navigating between admin screens re-reads the cache.
 *
 * Failure is silent by design: no hats → no lateral rows → the control behaves exactly as it does
 * today. This never blocks or degrades the primary "Public site" flip.
 */

/** Resolved hats per `${orgSlug}/${tournamentSlug}` — survives client-side navigation. */
const cache = new Map<string, ViewerHat[]>();
/** In-flight requests, so concurrent consumers of the same key share one network call. */
const inflight = new Map<string, Promise<ViewerHat[]>>();

async function loadHats(orgSlug: string, tournamentSlug: string): Promise<ViewerHat[]> {
  const key = `${orgSlug}/${tournamentSlug}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const res = await fetch(
        `/api/public/tournament-viewer?org=${encodeURIComponent(orgSlug)}&tournament=${encodeURIComponent(tournamentSlug)}`,
      );
      const body = res.ok ? ((await res.json()) as { viewer?: TournamentViewer | null }) : null;
      // Drop the admin hat: the user is already standing in it. Only genuinely OTHER roles are lateral.
      const hats = (body?.viewer?.hats ?? []).filter(hat => hat.kind !== 'admin');
      cache.set(key, hats);
      return hats;
    } catch {
      cache.set(key, []); // negative-cache so a flaky call doesn't retry on every navigation
      return [];
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

/**
 * The user's non-admin roles on this event, or `[]` while resolving / when they hold none.
 * Callers must treat `[]` as "no lateral rows" — never as an error state.
 */
export function useAdminLateralHats(orgSlug: string | null | undefined, tournamentSlug: string | null | undefined): ViewerHat[] {
  const key = orgSlug && tournamentSlug ? `${orgSlug}/${tournamentSlug}` : null;
  // State holds the RESOLVED result keyed by the event it belongs to, so a tournament switch can
  // never show the previous event's rows. Everything else is derived during render — the cache is
  // read, not copied into state, which keeps the effect free of synchronous setState.
  const [resolved, setResolved] = useState<{ key: string; hats: ViewerHat[] } | null>(null);

  useEffect(() => {
    if (!key || !orgSlug || !tournamentSlug) return;
    if (cache.has(key)) return; // already known — render reads it directly
    let cancelled = false;
    loadHats(orgSlug, tournamentSlug).then(hats => {
      if (!cancelled) setResolved({ key, hats });
    });
    return () => { cancelled = true; };
  }, [key, orgSlug, tournamentSlug]);

  if (!key) return EMPTY;
  // Cache first (a repeat visit renders rows on first paint — no flash of the single-link pill),
  // then this render's own resolution, else nothing yet.
  return cache.get(key) ?? (resolved?.key === key ? resolved.hats : EMPTY);
}

/** Stable identity so consumers don't see a new array every render. */
const EMPTY: ViewerHat[] = [];
