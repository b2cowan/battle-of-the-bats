'use client';
/**
 * lib/hooks/useIsPhoneNav.ts — live ≤900px state: the portal's NAV breakpoint, where the sidebar
 * gives way to the bottom bar (`CoachesBottomNav.module.css`, `coaches.module.css`).
 *
 * The mirror of `useIsDesktop` (≥1024), with the opposite default: TRUE for SSR and the first
 * client frame, corrected on mount. A phone-first default is the safe direction for the one
 * consumer this exists for — the masthead's team-switcher button (phone re-evaluation stage 1 ·
 * B1, owner ruling 2026-09-21): the server renders the button, a phone keeps it, and a desktop
 * replaces it with the plain name after mount. The desktop never SEES the button in between,
 * because the chevron it carries is `display: none` above 900 in the stylesheet, and the name's
 * text is the same either way — so the swap moves no pixels. The other default would have put a
 * dead, focusable control on every desktop for a frame, or a real switcher beside the sidebar's
 * own select, which the ruling keeps untouched.
 */
import { useEffect, useState } from 'react';

export function useIsPhoneNav(): boolean {
  const [isPhone, setIsPhone] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isPhone;
}
