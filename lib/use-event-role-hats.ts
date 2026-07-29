'use client';

import { useEffect, useState } from 'react';
import type { TournamentViewer, ViewerHat } from '@/lib/tournament-viewer-hats';

/**
 * lib/use-event-role-hats.ts — every role this user holds on one event ("The Flip", P4/WI-1).
 *
 * Feeds the lateral rows on BOTH operator-side flip controls — the admin shell and the coach
 * tournament record — so a person who both runs an event and coaches in it can jump straight across
 * instead of detouring through the public site.
 *
 * Returns the hats UNFILTERED. Each caller drops the one it's currently standing in, because
 * "where am I?" differs by surface: the admin shell excludes by KIND (you're in the admin area), the
 * coach record excludes by DESTINATION (so a coach of two teams in one event still sees their other
 * team as a row).
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

// DELIBERATELY memory-only — no sessionStorage/localStorage mirror.
//
// An earlier pass persisted this to survive full page loads. That was a mistake: these hats name the
// signed-in user's teams, and browser storage outlives a sign-out. Someone signing in after a
// colleague on the same browser would have been shown the previous user's team on the control until
// something invalidated it. The flicker that persistence was solving is now handled honestly by the
// pending placeholder instead, so the risk buys nothing.
//
// In-memory still covers the case that matters most: client-side navigation between admin screens
// resolves once and stays resolved.
function peek(key: string): ViewerHat[] | null {
  return cache.get(key) ?? null;
}

async function loadHats(orgSlug: string, tournamentSlug: string): Promise<ViewerHat[]> {
  const key = `${orgSlug}/${tournamentSlug}`;
  const cached = peek(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const res = await fetch(
        `/api/public/tournament-viewer?org=${encodeURIComponent(orgSlug)}&tournament=${encodeURIComponent(tournamentSlug)}`,
      );
      const body = res.ok ? ((await res.json()) as { viewer?: TournamentViewer | null }) : null;
      const hats = body?.viewer?.hats ?? [];
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

export interface EventRoleHats {
  hats: ViewerHat[];
  /**
   * `false` while the answer is genuinely unknown (a fetch is in flight). Callers must NOT render a
   * label they'd have to take back — showing "Back to Coach view" and swapping it for "Roles" a
   * moment later is the exact flicker this flag exists to prevent. `true` also covers "resolved,
   * holds no other roles", which is a real answer.
   */
  ready: boolean;
}

/** Every role this user holds on the event. See `EventRoleHats.ready` before trusting `hats`. */
export function useEventRoleHats(orgSlug: string | null | undefined, tournamentSlug: string | null | undefined): EventRoleHats {
  const key = orgSlug && tournamentSlug ? `${orgSlug}/${tournamentSlug}` : null;
  // State holds the RESOLVED result keyed by the event it belongs to, so a tournament switch can
  // never show the previous event's rows. Everything else is derived during render — the cache is
  // read, not copied into state, which keeps the effect free of synchronous setState.
  const [resolved, setResolved] = useState<{ key: string; hats: ViewerHat[] } | null>(null);

  useEffect(() => {
    if (!key || !orgSlug || !tournamentSlug) return;
    if (peek(key)) return; // already known (memory or session) — render reads it directly
    let cancelled = false;
    loadHats(orgSlug, tournamentSlug).then(hats => {
      if (!cancelled) setResolved({ key, hats });
    });
    return () => { cancelled = true; };
  }, [key, orgSlug, tournamentSlug]);

  // No event in context is a settled answer, not a pending one — there is nothing to wait for.
  if (!key) return { hats: EMPTY, ready: true };

  // Cache first (memory, then this session's storage) so a repeat arrival paints the final control
  // immediately; otherwise this render's own resolution; otherwise we genuinely don't know yet.
  const known = peek(key) ?? (resolved?.key === key ? resolved.hats : null);
  return known ? { hats: known, ready: true } : { hats: EMPTY, ready: false };
}

/** Stable identity so consumers don't see a new array every render. */
const EMPTY: ViewerHat[] = [];
