'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * The `?section=<id>` ARRIVAL — one mechanism for every deep-linkable page section: when the
 * address names this section, scroll it into view (honouring reduced motion) and flash it once.
 *
 * ⚠ ONE COPY (roster + player page review /simplify, 2026-09-13). `CoachCollapseSection` owned
 * this effect, and `CoachPageSection` — the flat sibling — was born with a verbatim copy, comment
 * included. The two render trees genuinely differ (a `<details>` fold vs a `<section>` card), but
 * the arrival does not, and the reduced-motion detail below is exactly the kind of lesson that
 * gets re-learned in whichever copy the next fix misses.
 *
 * Returns the ref to put on the section's root, whether the address targets it (a fold opens on
 * it), and the one-shot flash flag for the highlight class.
 */
export function useSectionArrival<T extends HTMLElement>(sectionId: string | undefined) {
  const searchParams = useSearchParams();
  const ref = useRef<T>(null);
  const [flash, setFlash] = useState(false);
  const targeted = !!sectionId && searchParams.get('section') === sectionId;

  useEffect(() => {
    if (!targeted || !ref.current) return;
    // Scroll after the state paints (a fold needs its full height first).
    const t = requestAnimationFrame(() => {
      // An explicit JS 'smooth' overrides the global reduced-motion CSS kill-switch
      // (CSSOM View), so honour the preference here directly (/review 2026-08-02).
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      ref.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      setFlash(true);
    });
    return () => cancelAnimationFrame(t);
  }, [targeted]);

  return { ref, targeted, flash };
}
