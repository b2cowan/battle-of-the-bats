'use client';
/**
 * lib/hooks/useIsDesktop.ts — live ≥1024px breakpoint state for split-pane surfaces.
 *
 * 1024px is the platform's established desktop-widening gate (the same breakpoint every
 * consumer/desktop media query keys on — see --app-col in globals.css). Extracted from the
 * identical hand-copied blocks in CoachChatView and the consumer ChatInbox so the breakpoint
 * literal, the SSR guard, and the listener lifecycle have one home.
 *
 * Defaults to false (mobile) for SSR and corrects on mount — callers render the mobile
 * layout first, which is the safe direction (a flash of the one-pane flow, never a
 * desktop-only control on a phone).
 */
import { useEffect, useState } from 'react';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop;
}
