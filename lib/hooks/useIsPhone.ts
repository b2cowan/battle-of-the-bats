'use client';
/**
 * lib/hooks/useIsPhone.ts — live ≤640px state: the portal's CONTENT breakpoint, where a list breaks
 * into row-cards, a modal becomes a full-screen sheet and a page header's actions drop to the
 * title row's corner (`coaches.module.css`).
 *
 * The sibling of `useIsPhoneNav` (≤900, the nav breakpoint). Defaults to FALSE for SSR and the
 * first client frame and corrects on mount — the safe direction for its one consumer, the
 * Schedule's event sheet (phone re-evaluation stage 2 · C3, owner ruling 2026-09-21): the sheet
 * only ever opens after mount, so the value is real by the time anything reads it, and the
 * desktop order is what a server would otherwise have to guess at.
 *
 * ⚠ For anything that RENDERS on the server, render both forms and let the stylesheet decide —
 * this hook is for a decision the stylesheet cannot make (the ORDER of a dialog's blocks, which
 * must be DOM order so the tab sequence matches the reading order).
 */
import { useEffect, useState } from 'react';

export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isPhone;
}
