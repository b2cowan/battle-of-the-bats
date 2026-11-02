'use client';
/**
 * lib/hooks/useFlipReturn.ts — a door's return memory, shared by the labelled FlipPill and the account sheet's "Go to"
 * block so the subtle rules live once.
 *
 * Read (post-mount, so SSR/hydration is stateless — no flash, no CLS): after a flip, a fresh sessionStorage snapshot
 * overrides the stateless twin with a direct return to the exact page they came from, labelled by DESTINATION. The
 * direct return lives ONLY on the page the flip landed on (`arrivalPathRef`): once the visitor moves to a different
 * section the memory is spent. `stampReturn` writes the snapshot the instant a flip is taken, on every hop, both
 * directions, so the arrival side can offer a direct return.
 */
import { useEffect, useRef, useState } from 'react';
import { usePublicPathname } from '@/lib/use-public-pathname';
import { readReturnMemory, writeReturnMemory, clearReturnMemory, flipSurfaceLabel } from '@/lib/flip-twins';

export function useFlipReturn(): { back: { href: string; label: string } | null; stampReturn: () => void } {
  const pathname = usePublicPathname();
  const [back, setBack] = useState<{ href: string; label: string } | null>(null);
  const arrivalPathRef = useRef<string | null>(null);

  useEffect(() => {
    const mem = readReturnMemory(Date.now());
    if (!mem) { setBack(null); return; }
    const here = pathname;
    // Never offer a return to the page we're already on.
    if (mem.originUrl === here || mem.originUrl.startsWith(`${here}?`)) { setBack(null); return; }
    if (arrivalPathRef.current === null) arrivalPathRef.current = here; // first page after the hop
    if (arrivalPathRef.current === here) {
      // Labelled by DESTINATION, never "Back to …" (owner call 2026-07-31). Derived from the stored URL rather than
      // the stored label so a snapshot written by the PREVIOUS build (a screen name — "Dashboard", "Results") can't
      // surface the old vocabulary for the 20 minutes it stays fresh. Storage outlives a deploy; this read doesn't.
      setBack({ href: mem.originUrl, label: flipSurfaceLabel(mem.originUrl) });
    } else {
      // Moved on to another section → spend the memory so the door returns to the page-matched twin.
      clearReturnMemory();
      setBack(null);
    }
  }, [pathname]);

  // The origin is the exact current URL (search included, so a filtered schedule returns filtered).
  const stampReturn = () => {
    try {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      writeReturnMemory({ originUrl: `${pathname}${search}`, label: flipSurfaceLabel(pathname) }, Date.now());
    } catch {
      /* non-fatal — stateless resolution still works */
    }
  };

  return { back, stampReturn };
}
