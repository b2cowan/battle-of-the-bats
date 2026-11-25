'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClubGamesRead } from '@/lib/club-games-read';
import { isNewerGamesRead, seasonCheckWindow, seasonGamesFingerprint } from '@/lib/club-game-live';
import { useClubGamesCheck } from '@/lib/hooks/useClubGamesCheck';

/**
 * THE HOUSE LEAGUE PAGES' REFRESH (Club Website Stage 1, G6; drawing tab 5): the schedule, the standings and the season
 * page mount this. It draws nothing. Inside the season's game window it runs the 30-second games-only check and, when
 * the season's games in it changed (a score, a Final, a game turning live), asks the server for a fresh render of the
 * page — `router.refresh()`, which keeps what the visitor opened (the schedule's "Show earlier weeks" is a native fold the
 * refresh does not remount) and redraws the score, the pill and the standings' order in place, once per check. The page
 * is never re-read on a check that found nothing new, and nothing on screen says it is checking.
 *
 * The first check is compared with the page itself: if it was made after the page was drawn, something may have landed
 * in between that the page does not show, so the page refreshes once (a deliberate cost: one extra render per visit
 * inside a window, never a missed score). Every later check is compared with the one before. Each check also carries
 * the season's window for today, so a game added or moved today moves the window with it.
 */
export default function LeagueScoresRefresher({ orgSlug, seasonSlug, renderedAt, window: initialWindow }: {
  orgSlug: string;
  seasonSlug: string;
  /** When the server drew this page (an instant). */
  renderedAt: string;
  /** The season's check window today, or null: the page never checks. */
  window: { from: string; to: string } | null;
}) {
  const router = useRouter();
  // The page's window to start; each check then carries today's (a refresh's new prop is the same day's facts).
  const [checkWindow, setCheckWindow] = useState(initialWindow);
  const last = useRef<{ fingerprint: string; asOf: string } | null>(null);
  const drawnAt = useRef(renderedAt);
  useEffect(() => { drawnAt.current = renderedAt; }, [renderedAt]);

  const onRead = useCallback((read: ClubGamesRead) => {
    if (last.current && !isNewerGamesRead(read, last.current)) return; // an older answer held at the edge
    const fingerprint = seasonGamesFingerprint(read.rows, seasonSlug);
    const changed = last.current ? fingerprint !== last.current.fingerprint : isNewerGamesRead(read, { asOf: drawnAt.current });
    last.current = { fingerprint, asOf: read.asOf };
    const w = seasonCheckWindow(read.rows, seasonSlug, read.today);
    if (w) setCheckWindow(w);
    if (changed) router.refresh();
  }, [router, seasonSlug]);

  useClubGamesCheck({ orgSlug, window: checkWindow, since: renderedAt, onRead });
  return null;
}
