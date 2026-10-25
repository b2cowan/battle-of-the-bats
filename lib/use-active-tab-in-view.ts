import { useEffect, type DependencyList, type RefObject } from 'react';

/**
 * ⚠⚠ THE TAB YOU ARE ON IS IN VIEW — one rule for every sideways-scrolling tab row (the coach hubs' HubTabBar since
 * phone stage 6 · R3, owner 2026-09-24; the club's section tabs since Club Tier Stage 4f, Ask 5, 2026-10-25). A row
 * that opens scrolled to its START puts a tab further along off the screen, under a page that says only where you are.
 * So when the current tab changes, the ROW scrolls just enough to bring it `edge` px clear of either side.
 *
 * ⚠ `scrollTo` on the row, NEVER `element.scrollIntoView` — that also scrolls the WINDOW when the row is not fully on
 * screen, and the page would jump on a tab press. `instant`, so a landing never animates past other tabs (and nothing
 * moves for a visitor who asks for reduced motion). A tab already in view, or a row that fits, does nothing.
 *
 * The current tab is the row's `[aria-current="page"]` element. `deps`: whatever changes which tab that is, or the
 * row's usable width.
 */
export function useActiveTabInView(rowRef: RefObject<HTMLElement | null>, edge: number, deps: DependencyList): void {
  useEffect(() => {
    const row = rowRef.current;
    const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !active) return;
    const bar = row.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    let delta = 0;
    if (tab.left < bar.left + edge) delta = tab.left - bar.left - edge;
    else if (tab.right > bar.right - edge) delta = tab.right - bar.right + edge;
    if (Math.abs(delta) > 1) row.scrollTo({ left: row.scrollLeft + delta, behavior: 'instant' });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller names what moves the current tab
  }, deps);
}
