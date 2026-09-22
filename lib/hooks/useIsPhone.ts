'use client';
/**
 * lib/hooks/useIsPhone.ts — live ≤640px state: the portal's CONTENT breakpoint, where a list breaks
 * into row-cards, a modal becomes a full-screen sheet and a page header's actions drop to the
 * title row's corner (`coaches.module.css`).
 *
 * The sibling of `useIsPhoneNav` (≤900, the nav breakpoint). Reads FALSE on the server and through
 * hydration — the desktop order is what a server would otherwise have to guess at — and the real
 * answer the moment the client renders on its own. Its first consumer, the Schedule's event sheet
 * (phone re-evaluation stage 2 · C3, owner ruling 2026-09-21), only ever opens after mount, so it
 * never saw the difference; the lineup editor (stage 3 · D5) does: it mounts AFTER its fetch, on
 * the client alone, and an effect-driven read painted the desktop's sideways grid for one frame on
 * a phone before the inning list replaced it. `useSyncExternalStore` answers a non-hydrating mount
 * from the media query synchronously, and a hydrating one with the server's false first — React
 * re-renders it with the client's answer without a mismatch.
 *
 * ⚠ For anything that RENDERS on the server, render both forms and let the stylesheet decide —
 * this hook is for a decision the stylesheet cannot make (the ORDER of a dialog's blocks, which
 * must be DOM order so the tab sequence matches the reading order; a list whose STRUCTURE differs
 * from the grid it replaces).
 */
import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 640px)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
function getSnapshot(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;
}
function getServerSnapshot(): boolean {
  return false;
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
