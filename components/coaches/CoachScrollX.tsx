'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MoveHorizontal } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * A horizontally-scrolling 2-D grid that CANNOT ship without its swipe affordance.
 *
 * The portal's `.scrollX` / `.scrollXSticky` primitives have carried the rule "never a
 * silent sideways scroll — always pair with a visible hint" since 2026-06-29, but there
 * was no hint class to pair with and consequently zero adopters. Bundling the scroller
 * and the hint into one component makes the rule structural rather than aspirational:
 * a future adopter gets the affordance whether or not they remember it.
 *
 * The hint is honest — it appears only while the content genuinely overflows, and
 * retires the moment the coach scrolls (the "one-time hint" the contract asks for).
 * A grid that fits on the current screen never claims a swipe that would do nothing,
 * which is why this can be used on surfaces that only overflow on small viewports.
 *
 * `sticky` pins the first column. Rows must then mark their first cell with
 * `shared.scrollXStickyCell` and carry an opaque background of their own — see the
 * primitive's comment in coaches.module.css.
 */
export default function CoachScrollX({
  children,
  hint,
  sticky = false,
  frame = true,
  className = '',
}: {
  children: ReactNode;
  /** What the coach gains by swiping — name the columns, not the gesture. */
  hint: string;
  sticky?: boolean;
  /** Set false when the content already carries its own borders, so the scroller
   *  doesn't draw a second frame around it on desktops that never overflow. */
  frame?: boolean;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // 1px of tolerance: sub-pixel layout rounding otherwise reports a permanent
    // 0.5px overflow on grids that visibly fit, which would pin the hint on forever.
    setOverflows(el.scrollWidth - el.clientWidth > 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    // Observe the scroller AND its content: a ResizeObserver on the scroller alone
    // misses content that grows wider without changing the scroller's own box
    // (expanding a budget category adds period rows with more columns).
    // Observing the CONTENT is what makes this correct without re-measuring on every
    // render: expanding a budget category or adding an installment column resizes the
    // inner track, which is exactly what scrollWidth is derived from. The inner element
    // is stable across renders (same position and type), so the observation survives.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className={className}>
      {overflows && !scrolled && (
        <p className={styles.scrollXHint} data-testid="coach-scrollx-hint" aria-hidden>
          <MoveHorizontal size={12} className={styles.scrollXHintIcon} />
          {hint}
        </p>
      )}
      <div
        ref={scrollerRef}
        // Stable handle for the layout probes: a `[class*="scrollX"]` selector also matches the
        // hint, which sits earlier in the DOM and has no overflow of its own.
        data-testid="coach-scrollx"
        className={`${styles.scrollX} ${sticky ? styles.scrollXSticky : ''} ${overflows ? styles.scrollXOverflowing : ''} ${frame ? '' : styles.scrollXBare}`}
        onScroll={e => { if (!scrolled && e.currentTarget.scrollLeft > 8) setScrolled(true); }}
        // Keyboard and screen-reader users get a real scrollable region rather than a
        // silently clipped one; the label carries the same information as the hint.
        tabIndex={overflows ? 0 : undefined}
        role={overflows ? 'region' : undefined}
        aria-label={overflows ? hint : undefined}
      >
        {children}
      </div>
    </div>
  );
}
