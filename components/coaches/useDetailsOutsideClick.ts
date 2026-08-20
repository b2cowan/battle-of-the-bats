'use client';
import { useEffect, useRef } from 'react';

/**
 * Close a `<details>` disclosure when a click lands outside it — the ONE behaviour the native
 * element doesn't provide (it already closes itself on repeat click and handles the keyboard).
 *
 * Extracted 2026-08-19 (/simplify on the Date pill): `MultiSelectDropdown` wrote this effect and
 * `DateRangeDropdown` copied it verbatim, which is exactly how an outside-click fix (Escape-to-
 * close, a pointer-event tweak) gets applied to one pill and silently not the other. Every
 * `<details>`-based pill takes its ref from here.
 */
export default function useDetailsOutsideClick() {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      const el = ref.current;
      if (el && el.open && !el.contains(ev.target as Node)) el.open = false;
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return ref;
}
