'use client';
/**
 * PLAN PANEL HOST — an upgrade link opens the plan's panel where you are (owner, the free tier walk 2026-10-16: "make
 * sure all of these upgrade links just open the upgrade drawer and don't navigate away from the page").
 *
 * Mounted ONCE in the admin layout. Every plan lock in the admin — a lock line, a Tools or Export menu's locked row, the
 * game-day board's "Running late?" door, Teams' upgrade links — is a plain link to Plan & billing with the plan asked
 * for (`?plan=tournament_plus`). A plain click on one is caught here before the router sees it and opens the same
 * panel Plan & billing opens, over the page: a message being written in the composer, a half-set filter, the page's
 * scroll all stay. Ctrl/⌘/Shift/middle-click is left alone, so the lock still opens Plan & billing in a new tab.
 * `planPanelFromHref` decides what counts — Plan & billing's two addresses with a plan named, nothing else.
 *
 * Only the listener ships with every admin page; the panel, its plan-gating read and its Upgrade load on the first
 * click (`PlanPanelDrawer`, as the help drawer defers its guides).
 */
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePublicPathname } from '@/lib/use-public-pathname';
import { planPanelFromHref, type PanelPlanKey } from '@/lib/plan-upgrade';

const PlanPanelDrawer = dynamic(() => import('./PlanPanelDrawer'), { ssr: false });

export default function PlanPanelHost() {
  const pathname = usePublicPathname();
  const [plan, setPlan] = useState<PanelPlanKey | null>(null);

  // The panel belongs to the page it was opened over: a navigation closes it (render-time reset, as the help drawer).
  const [openedOn, setOpenedOn] = useState(pathname);
  if (pathname !== openedOn) {
    setOpenedOn(pathname);
    setPlan(null);
  }

  useEffect(() => {
    // Capture on the window: this runs before React's own click handling, so the link's router push sees the
    // default already prevented and stands down (next/link checks `defaultPrevented`). No stopPropagation — a menu's
    // own click still closes the menu the locked row sat in.
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      // Nearly every click stops here, before any address is parsed.
      if (!link.getAttribute('href')?.includes('plan=')) return;
      if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      if (link.origin !== window.location.origin) return;
      const asked = planPanelFromHref(link.href);
      if (!asked) return;
      e.preventDefault();
      setPlan(asked);
    }
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, []);

  const close = useCallback(() => setPlan(null), []);
  return plan ? <PlanPanelDrawer plan={plan} onClose={close} /> : null;
}
