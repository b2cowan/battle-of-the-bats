'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedbackModal from '@/components/FeedbackModal';

/**
 * Warns before leaving a form with unsaved changes — covers BOTH:
 *  • tab close / refresh / external navigation (native beforeunload prompt), and
 *  • in-app navigation (sidebar, bottom nav, in-page links, the FlipPill) via a capture-phase click
 *    interceptor that beats Next's <Link> handler and shows a confirm modal.
 *
 * Copy is parameterized so any shell can reuse it. Drop
 *   <UnsavedChangesGuard active={isDirty} message="…" />
 * into any edit screen. Same-tab flips (The Flip) can now navigate away from dirty forms that the old
 * new-tab "View Site" behavior accidentally protected — this closes that gap.
 */
export default function UnsavedChangesGuard({
  active,
  interceptClicks = active,
  message = 'You have unsaved changes. Leave without saving them?',
  onLeave,
}: {
  active: boolean;
  /**
   * Runs as the coach answers "Leave without saving", before the navigation. A window that guards the route passes its
   * own close: the guard stops the link's click, so the link's own close never runs, and in a hub that keeps hidden tabs
   * mounted the window would survive with the words the coach just agreed to drop (/review, One Window 2d).
   */
  onLeave?: () => void;
  /**
   * Separately gate the in-app click interceptor from the tab-close/refresh warning.
   * A form that's dirty but not currently on screen (e.g. a background tab in a
   * tabbed hub — the form itself is still mounted, just hidden) shouldn't hijack
   * clicks on whatever the coach IS looking at; closing/refreshing the tab would
   * still lose that work, so `active` alone keeps guarding beforeunload.
   */
  interceptClicks?: boolean;
  message?: string;
}) {
  const router = useRouter();
  /** The link the coach clicked, held while the guard asks — the element itself, so "Leave" can REPLAY that click. */
  const [pending, setPending] = useState<{ href: string; anchor: HTMLAnchorElement } | null>(null);
  /** Lets the replayed click through this guard's own interceptor. */
  const replaying = useRef(false);
  /** Until when the browser's own "Leave site?" stays quiet: a replayed PLAIN link (not a Next <Link>) unloads the
   *  page, and the coach has already answered Leave once. */
  const answeredUntil = useRef(0);

  // Tab close / refresh / external navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (Date.now() < answeredUntil.current) return;
      e.preventDefault(); e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);

  // In-app link clicks (capture phase, so we intercept before Next's <Link>).
  // Only attached while there are unsaved changes AND this guard's own form is
  // the one actually on screen.
  useEffect(() => {
    if (!interceptClicks) return;
    function onClick(e: MouseEvent) {
      if (replaying.current) return;
      // Let modified clicks (new tab, etc.) and non-primary buttons through
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      let url: URL;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return; // external
      // Same page (e.g. an in-page anchor) — nothing to guard
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending({ href: url.pathname + url.search + url.hash, anchor });
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [interceptClicks]);

  return (
    <FeedbackModal
      isOpen={!!pending}
      onClose={() => setPending(null)}
      onConfirm={() => {
        const held = pending;
        setPending(null);
        if (!held) return;
        /* ⚠ "LEAVE" REPLAYS THE COACH'S OWN CLICK, never a bare `router.push` (/review, One Window 2d). The link then does
           everything it does unguarded: its own handler runs (a door in a window closes that window), and the back-step
           press gate (`useBackStep`) hears a link leaving, so a window closed by it keeps its history entry for the
           navigation to push over. Closed beside a `router.push`, the window's exit ran `history.back()` and cancelled
           the navigation: the coach answered Leave and stayed. `onLeave` runs inside the same click, for the same reason. */
        if (held.anchor.isConnected) {
          answeredUntil.current = Date.now() + 3000;
          replaying.current = true;
          try { held.anchor.click(); onLeave?.(); } finally { replaying.current = false; }
          return;
        }
        router.push(held.href);
      }}
      title="Unsaved changes"
      message={message}
      confirmText="Leave without saving"
      cancelText="Stay on this page"
      type="danger"
    />
  );
}
