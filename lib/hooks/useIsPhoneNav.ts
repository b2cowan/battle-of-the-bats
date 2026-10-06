'use client';
/**
 * lib/hooks/useIsPhoneNav.ts — live ≤900px state: the portal's NAV breakpoint, where the sidebar
 * gives way to the bottom bar (`CoachesBottomNav.module.css`, `coaches.module.css`).
 *
 * The mirror of `useIsDesktop` (≥1024), with the opposite default: TRUE for SSR and through
 * hydration, the client's real answer as soon as the client renders on its own. A phone-first default
 * is the safe direction for its first consumer — the masthead's team-switcher button (phone
 * re-evaluation stage 1 · B1, owner ruling 2026-09-21): the server renders the button, a phone keeps
 * it, and a desktop replaces it with the plain name after hydration. The desktop never SEES the button
 * in between, because the chevron it carries is `display: none` above 900 in the stylesheet, and the
 * name's text is the same either way — so the swap moves no pixels. The other default would have put a
 * dead, focusable control on every desktop for a frame, or a real switcher beside the sidebar's own
 * select, which the ruling keeps untouched.
 *
 * ⚠ `useSyncExternalStore`, as `useIsPhone` (Sheet Frame step 4 /review, 2026-10-06). It read the media
 * query in an effect, so a component that MOUNTS after the page has hydrated — a sheet opened by a tap:
 * RSVP and the notification reader render the shared sheet frame at ≤900 and their centred dialog above —
 * rendered the phone branch for one commit on a computer and then swapped: a dialog floor and a history
 * step stood up and torn down, focus sent home and back, for nothing. A non-hydrating mount now gets the
 * media query's answer synchronously; a hydrating one still gets the server's `true` first, then the
 * client's, without a mismatch — the masthead behaves exactly as before.
 */
import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 900px)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
function getSnapshot(): boolean {
  return typeof window === 'undefined' || !window.matchMedia || window.matchMedia(QUERY).matches;
}
function getServerSnapshot(): boolean {
  return true;
}

export function useIsPhoneNav(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
