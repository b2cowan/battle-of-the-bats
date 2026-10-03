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
 *
 * ⚠ AND ITS PANEL OPENS WHERE IT FITS (/design 2026-10-01, owner "go ahead"). A pill's panel hangs
 * from the pill's LEFT edge, so a pill near the right of a phone — both Ledgers' Date pill — opened
 * its panel ~200px past the screen's edge, where nothing scrolls to reach it. When the panel would
 * run past the right edge and fits leftward, it hangs from the pill's RIGHT edge instead
 * (`data-align="end"` on the `[data-pill="panel"]` child; FilterPill.module.css draws it). Measured
 * on mount, on resize, on open and whenever its row changes, so a pill that already fits never moves,
 * and the layout sweep — which measures a closed panel too — sees where it will open. One home, so
 * every pill gets it.
 * ⚠ It measures against the WINDOW. A host whose pills sit in a narrower box that clips (the practice
 * plan's docked library) anchors its own panels, and its rules name `[data-align]` so they always win
 * (/review 2026-10-01). A panel wider than either side of the pill keeps the default left anchor.
 */
const EDGE = 8;

/**
 * `enabled` — ask only where the answer is used (`useIsPhone`'s own rule): a pill drawn as a ROW of the
 * Ledgers' phone Filter sheet is not a `<details>`, so it opens no document listener and fits no panel.
 * Fixed for the life of a pill: an element is either in the strip or in the sheet.
 */
export default function useDetailsOutsideClick(enabled = true) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!enabled) return;
    function onDocClick(ev: MouseEvent) {
      const el = ref.current;
      if (el && el.open && !el.contains(ev.target as Node)) el.open = false;
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const details = ref.current;
    const panel = details?.querySelector<HTMLElement>(':scope > [data-pill="panel"]');
    if (!details || !panel) return;
    const fit = () => {
      const pill = details.getBoundingClientRect();
      const width = Math.max(panel.offsetWidth, parseFloat(getComputedStyle(panel).minWidth) || 0);
      const room = document.documentElement.clientWidth - EDGE;
      if (pill.left + width > room && pill.right - width >= EDGE) panel.dataset.align = 'end';
      else delete panel.dataset.align;
    };
    // ⚠ A pill MOVES without changing size: its row fills in after the page's data arrives (the coach
    // Ledger's Item pill is added BEFORE Date, pushing it 72px right) and a sibling's value grows. So the
    // ROW is watched — the nearest ancestor that draws a box (the coach strip wraps its pills in a
    // `display: contents` element, which has none, so a ResizeObserver on it never fires) — for its size
    // and for any pill added or changed inside it.
    let row: HTMLElement | null = details.parentElement;
    while (row && getComputedStyle(row).display === 'contents') row = row.parentElement;
    fit();
    details.addEventListener('toggle', fit);
    window.addEventListener('resize', fit);
    const ro = new ResizeObserver(fit);
    ro.observe(details);
    const mo = new MutationObserver(fit);
    if (row) {
      ro.observe(row);
      mo.observe(row, { childList: true, subtree: true, characterData: true });
    }
    return () => {
      details.removeEventListener('toggle', fit);
      window.removeEventListener('resize', fit);
      ro.disconnect();
      mo.disconnect();
    };
  }, [enabled]);

  return ref;
}
