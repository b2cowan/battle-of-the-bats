'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * "Has the visitor scrolled far enough that top chrome should stand down?"
 *
 * The hysteresis pair, and why it is a pair
 * ────────────────────────────────────────
 * Collapse past `collapseAt`, expand only back under `expandAt`. A single threshold shakes: the
 * chrome collapsing makes the page shorter, which moves the scroll position back across the line,
 * which expands it, which moves it back again. The dead zone between the two must be WIDER than the
 * height the chrome gives up, or the loop closes. Admin's event header has shipped 64/12 since the
 * Flip and the coach masthead mirrors it, so those are the defaults here too.
 *
 * ⚠ Which element is scrolling is not knowable from the DOM position of the caller.
 * `AdminEventHeader` walks its own ancestors for a scroll parent, which works because it lives
 * inside the shell it is measuring. A `position: fixed` bar parented to <body> has no such chain —
 * its ancestors are body and html, and the shell's scroller (the admin shell scrolls an inner
 * container on mobile; the coach portal and the public side scroll the document) is a SIBLING
 * subtree it can never walk up into. So this reads the scroll EVENT's target instead, in the
 * capture phase, which catches both cases without knowing anything about the page.
 *
 * The size test on the target is what keeps a small widget from speaking for the page: the moments
 * dock scrolls sideways, a modal body scrolls vertically, and neither should be able to hide the
 * chrome behind them. Only the document, or a container tall enough to BE the page, counts.
 *
 * Intended adopters, not yet migrated: `components/admin/AdminEventHeader.tsx` and
 * `components/coaches/CoachTeamHeader.tsx` both carry this logic inline. They collapse in place
 * rather than standing down, but the reading half is the same; folding them in is a follow-up that
 * should not ride along with a demo-chrome change.
 */
export function useScrollCollapsed(options: {
  /** Only collapse below this width. Absent = collapse at every width. */
  maxWidth?: string;
  collapseAt?: number;
  expandAt?: number;
} = {}): {
  collapsed: boolean;
  /**
   * Scroll whatever is scrolling back to the top — i.e. back to the expanded state.
   *
   * Deliberately NOT a `setCollapsed(false)`: the collapse is a pure function of scroll position,
   * so a second source of truth would be one the very next scroll event silently contradicts. The
   * caller's "show me that again" control lands here, and the state follows the page as usual.
   */
  scrollToTop: () => void;
} {
  const { maxWidth, collapseAt = 64, expandAt = 12 } = options;
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // The element that last reported a scroll we accepted — null means the document is the scroller.
  const scrollerRef = useRef<HTMLElement | null>(null);

  const scrollToTop = useCallback(() => {
    const behavior: ScrollBehavior =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const el = scrollerRef.current;
    if (el && el.isConnected) el.scrollTo({ top: 0, behavior });
    else window.scrollTo({ top: 0, behavior });
  }, []);

  useEffect(() => {
    const mq = maxWidth ? window.matchMedia(`(max-width: ${maxWidth})`) : null;
    let raf = 0;
    // The last offset read from a source we accepted. Kept outside `read` so a scroll event on an
    // element we rejected leaves the previous reading standing instead of resetting it to zero.
    let y = 0;

    /**
     * Where the page actually is, asked rather than remembered.
     *
     * ⚠ Needed because `y` is otherwise only ever written by a scroll EVENT, and two situations
     * change the real offset without producing one we can use:
     *   • **Rotation / the soft keyboard.** Many mobile browsers reset the scroll position on a
     *     resize; re-checking only the media query left a phone folded at the top of the page until
     *     the visitor scrolled again — in the exact viewport this hook exists to serve.
     *   • **A shell that scrolls an inner container.** After a route change `window.scrollY` is 0
     *     there whatever the container is doing, so assuming the window would report "at the top"
     *     on a page that is not.
     */
    const measure = () => {
      const el = scrollerRef.current;
      if (el?.isConnected) return el.scrollTop;
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const read = () => {
      if (mq && !mq.matches) {
        setCollapsed(false);
        return;
      }
      setCollapsed(prev => (prev ? y > expandAt : y > collapseAt));
    };

    const onScroll = (e: Event) => {
      const target = e.target;
      if (target === document || target === window || target === document.documentElement) {
        scrollerRef.current = null;
        y = window.scrollY || document.documentElement.scrollTop || 0;
      } else if (target instanceof HTMLElement) {
        // Big enough to BE the page: page-tall AND page-wide. Height alone let the desktop nav
        // rails qualify — the admin sidebar and both portal side rails are full-height 240-280px
        // columns with their own scroll — so scrolling a NAV list folded the chrome, a rail's
        // remembered offset pre-folded the next route, and the way-back handle scrolled the rail
        // instead of the page (2026-08-11 review, found the day the fold went all-widths). A real
        // content scroller is never narrower than 60% of the viewport; a rail never reaches it.
        if (target.clientHeight < window.innerHeight * 0.6) return;
        if (target.clientWidth < window.innerWidth * 0.6) return;
        scrollerRef.current = target;
        y = target.scrollTop;
      } else {
        return;
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    };

    // A route change does not necessarily reset an inner scroller, so a new page could open
    // mid-scroll and pre-collapsed. Re-baseline on every path — by MEASURING, not by assuming the
    // window is the scroller. ⚠ The remembered scroller is deliberately kept if it survived the
    // navigation (an app shell's container does); it is only discarded once it leaves the document,
    // which `measure` checks. Clearing it here would throw away the only handle on the thing that
    // is actually scrolling.
    if (!scrollerRef.current?.isConnected) scrollerRef.current = null;
    y = measure();
    read();

    const onResize = () => { y = measure(); read(); };

    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [pathname, maxWidth, collapseAt, expandAt]);

  return { collapsed, scrollToTop };
}
