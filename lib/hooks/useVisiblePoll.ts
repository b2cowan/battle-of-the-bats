'use client';
/**
 * lib/hooks/useVisiblePoll.ts — the game-day screens' "stays current by itself" (Tournament admin
 * redesign G6, 2026-09-29): the board, Results and Check-in each read again every 30 s while the page
 * is visible, and at once when the tab comes back into view. A hidden tab never polls.
 *
 * `paused` holds the next read while the organizer is IN something (a score editor, a team's sheet, a
 * confirm, an action in flight): a refresh would move the record they have in hand between lists. The
 * latest `onTick` and `paused` are read at tick time, so a caller may pass a fresh closure every render
 * without resetting the timer.
 */
import { useEffect, useRef } from 'react';

export const GAME_DAY_POLL_MS = 30_000;

export function useVisiblePoll(
  onTick: () => void,
  { enabled = true, paused = false, intervalMs = GAME_DAY_POLL_MS }: {
    /** False while there is nothing to read (no tournament yet). */
    enabled?: boolean;
    paused?: boolean;
    intervalMs?: number;
  } = {},
): void {
  const tickRef = useRef(onTick);
  const pausedRef = useRef(paused);
  useEffect(() => {
    tickRef.current = onTick;
    pausedRef.current = paused;
  });
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === 'visible' && !pausedRef.current) tickRef.current();
    };
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, intervalMs]);
}
