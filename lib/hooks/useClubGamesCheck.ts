'use client';
/**
 * lib/hooks/useClubGamesCheck.ts — THE 30-SECOND CHECK on a club's game day (Club Website Stage 1, G6, owner 2026-11-25).
 * The club home's games part and the house league schedule, standings and season page call it; each decides what to do
 * with the answer (the home redraws its bands; a house league page asks the server for a fresh render only when its
 * season's games changed).
 *
 * The rhythm is the game-day screens' own (`useVisiblePoll`): every 30 seconds while the tab is visible, at once when it
 * comes back, never while hidden. What this adds is WHEN: only from half an hour before the day's first game to the end
 * of the last game's window (`isGameDayCheckOn`), and past the close only until the page has seen an answer made after it,
 * so a game whose window just ended stops reading as live (even through an answer the edge held, or a tab hidden through
 * the close). A day with no window never checks. A check gives up after 15 seconds, so a hung one cannot stop the rest. A failed check is swallowed (G11: it says nothing and the page
 * keeps what it shows). It fetches the games-only check (`/api/public/club-games/{club}`), never the page.
 */
import { useEffect, useRef } from 'react';
import type { ClubGamesRead } from '@/lib/club-games-read';
import { isGameDayCheckOn } from '@/lib/club-game-live';
import { useVisiblePoll } from '@/lib/hooks/useVisiblePoll';

/** One check, or null when it failed (the caller says nothing about a failure, G11). The club is in the path and the
 *  address takes no query: the route refuses one. */
export async function fetchClubGames(orgSlug: string): Promise<ClubGamesRead | null> {
  try {
    // A check that never answers must not hold every later one: it gives up well inside the 30 seconds.
    const res = await fetch(`/api/public/club-games/${encodeURIComponent(orgSlug)}`, {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ClubGamesRead;
  } catch {
    return null;
  }
}

export function useClubGamesCheck({ orgSlug, window: checkWindow, since, onRead }: {
  orgSlug: string;
  /** When to check today (instants), or null — never. */
  window: { from: string; to: string } | null;
  /** When what the page shows was read (an instant): the page's own render, or the read it was drawn from. */
  since: string;
  onRead: (read: ClubGamesRead) => void;
}): void {
  const busy = useRef(false);
  const mounted = useRef(true);
  const seenAsOf = useRef(Date.parse(since));
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useVisiblePoll(async () => {
    if (busy.current || !checkWindow) return;
    const now = Date.now(), toMs = Date.parse(checkWindow.to);
    // Inside the window, every tick; past its close, until the page has seen an answer made AFTER the close — so the last
    // game's "live" turns over even when the closing check met an answer the edge held from before it, or the tab was
    // hidden through the close. Then never again today.
    const open = isGameDayCheckOn({ fromMs: Date.parse(checkWindow.from), toMs }, now) || (now >= toMs && seenAsOf.current < toMs);
    if (!open) return;
    busy.current = true;
    const read = await fetchClubGames(orgSlug);
    busy.current = false;
    if (!mounted.current || !read) return;
    seenAsOf.current = Math.max(seenAsOf.current, Date.parse(read.asOf));
    onRead(read);
  }, { enabled: !!checkWindow });
}
