'use client';
/**
 * lib/hooks/useWidthAtLeast.ts — whether an ELEMENT is at least `minPx` wide (a container's width, not the viewport's:
 * `useIsPhone` answers that). Its first consumer, the tournament game row (Sidebar Strip Stage 3), shows its columns only
 * where the list holds them — beside a folded or an open sidebar the same window gives the list two different widths.
 *
 * The answer is a boolean, so a resize re-renders the caller only when the width CROSSES `minPx`, never once per frame
 * of a drag. `null` until the element is attached; the ref callback reads it during the commit, before the first paint.
 */
import { useCallback, useRef, useState } from 'react';

export function useWidthAtLeast(minPx: number) {
  const [atLeast, setAtLeast] = useState<boolean | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setAtLeast(el.clientWidth >= minPx);
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(entries => setAtLeast(entries[0].contentRect.width >= minPx));
    observer.current.observe(el);
  }, [minPx]);
  return { ref, atLeast };
}
