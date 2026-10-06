'use client';
import { useEffect, useState, type RefObject } from 'react';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A MONTH GRID OPENS ON THIS MONTH ON A PHONE (owner, Club Tier Stage 3b fix 2, 2026-10-06 — BOTH
 * portals: the coach's Budget vs. Actual › Months and Budget › By period, and the club's two, which
 * render the same components).
 *
 * The grids opened on their first month, so in September a reader on a phone met January to March and
 * swiped three times to reach the month they came for. At touch widths the grid now scrolls its OWN frame
 * (never the page) so this month sits wholly in view with up to `lead` months before it for context — a September
 * reader sees July to October. A desk is unchanged: it shows the whole window, and nothing moves there.
 *
 * ⚠ ONCE PER GRID, NEVER ON A RE-RENDER. `openKey` names the grid being read (a lens, a granularity, a
 * year); it re-opens on this month only when that changes, so a reader who swiped elsewhere is never
 * pulled back by an unrelated update.
 *
 * ⚠ THE HINT SURVIVES IT. The scroll is the product's, not the reader's, so it is flagged for
 * `CoachScrollX`, whose one-time swipe hint otherwise retires on the first scroll event — the reader
 * still needs to learn there are months either side.
 *
 * The column marked `data-now` in the grid's heading row is this month (or, on a grid whose columns
 * stop before it, the first month after it — the grid decides).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export const TOUCH_GRID_QUERY = '(max-width: 768px)';

/** Read by `CoachScrollX`: the next scroll event on this frame was the product's, not the reader's. */
export const AUTO_SCROLL_FLAG = 'autoScroll';

export function useOpenOnNow(
  scrollerRef: RefObject<HTMLDivElement | null>,
  openKey: string,
  lead = 2,
): boolean {
  const [opened, setOpened] = useState(false);
  /* The scroll needs the laid-out table, so it runs after paint; the boolean it sets is what the grid's
     hint reads (`other months` once it opened mid-year). */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof window === 'undefined' || !window.matchMedia(TOUCH_GRID_QUERY).matches) {
      setOpened(false);
      return;
    }
    const now = el.querySelector<HTMLElement>('thead th[data-now]');
    const row = now?.parentElement;
    if (!now || !row) { setOpened(false); return; }
    const cells = Array.from(row.children) as HTMLElement[];
    const at = cells.indexOf(now);
    // The pinned name column covers the frame's left edge, and a pinned Total (Months) its right edge: a
    // month is in view only in the band between them.
    const pinned = cells[0]?.offsetWidth ?? 0;
    const last = cells[cells.length - 1];
    const pinnedRight = last && last !== now && getComputedStyle(last).position === 'sticky' ? last.offsetWidth : 0;
    const band = el.clientWidth - pinned - pinnedRight;
    /* THIS month is always WHOLLY in the band; up to `lead` months before it ride along only while they
       fit (a 390px phone holds about two months, so with the pinned Total the lead used to push this
       month under it — /design, 2026-10-06). */
    const nowRight = now.offsetLeft + now.offsetWidth;
    let anchor = now;
    for (let i = Math.max(1, at - lead); i < at; i++) {
      if (nowRight - cells[i].offsetLeft <= band) { anchor = cells[i]; break; }
    }
    // Clamped to how far the frame CAN scroll: a write the browser would clamp to where it already is fires no
    // scroll event, and the flag would then swallow the reader's first swipe.
    const left = Math.min(Math.max(0, anchor.offsetLeft - pinned), Math.max(0, el.scrollWidth - el.clientWidth));
    if (Math.abs(el.scrollLeft - left) > 1) {
      el.dataset[AUTO_SCROLL_FLAG] = '1';
      el.scrollLeft = left;
    }
    setOpened(left > 0);
  }, [scrollerRef, openKey, lead]);
  return opened;
}
