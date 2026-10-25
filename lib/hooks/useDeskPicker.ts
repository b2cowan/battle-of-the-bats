'use client';
/**
 * lib/hooks/useDeskPicker.ts — does this device get OUR calendar and time list, or the device's own picker?
 *
 * Owner ruling 2026-10-25 (plan docs/projects/active/THEMED_DATE_PICKER_PLAN.md): a desk — a mouse or trackpad
 * (`hover: hover` + `pointer: fine`) on a window wider than 768px — opens the shared panels; anything touch, and
 * any window at the 768px touch band or narrower, keeps the native control. The device's picker is built for a
 * thumb, and our 36px days would sit below the 44px touch floor that holds through 768.
 *
 * `useSyncExternalStore`, as `useIsPhone` (whose header holds the reasoning): FALSE on the server and through
 * hydration, the real answer at once on a mount that does not hydrate — a window's date field draws the desk field on
 * its first frame instead of the native one and then the desk one. ONE MediaQueryList for the whole page, however many
 * fields a screen holds (a schedule's day rows, a dues plan's installments).
 */
import { useSyncExternalStore } from 'react';

export const DESK_PICKER_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 769px)';

let list: MediaQueryList | null = null;
const query = (): MediaQueryList | null => {
  if (!list && typeof window !== 'undefined' && window.matchMedia) list = window.matchMedia(DESK_PICKER_QUERY);
  return list;
};

function subscribe(onChange: () => void): () => void {
  const mq = query();
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}
const getSnapshot = (): boolean => query()?.matches ?? false;
const getServerSnapshot = (): boolean => false;

export function useDeskPicker(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
