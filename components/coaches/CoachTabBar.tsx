'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * The coach portal's hub tab row — one scrollable line of `<Link>` tabs with measured edge
 * arrows. Used by the Money hub (`/accounting`) and the Insights reports portal (`/history`).
 *
 * ⚠⚠ **A COMPONENT, NOT A SHARED CLASS** (memory: shared-component-beats-shared-class). The
 * classes alone were already shared-able — the Money hub's `.coachTab*` rules are generic — but a
 * class stops STYLE drift and does nothing about MARKUP drift, and the markup here is the part
 * carrying the invariants: the arrows are real buttons (they were briefly `pointer-events: none`
 * decoration, which looked clickable and passed the click through to the tab underneath), the
 * fades are per-edge so an end-of-row never fades against nothing, and the whole row is re-measured
 * on scroll, on resize and whenever the tab set changes (both hubs grow and lose tabs with the
 * season). Copying that into a second hub is how one of them quietly loses an arrow.
 *
 * ⚠ Tabs are LINKS, not buttons: every hub tab is a real, shareable address (`?section=`), so
 * middle-click, copy-link and browser Back all have to work. The caller owns the href — it is the
 * only thing that knows how to preserve its own page's live query state.
 */
export interface CoachTab<Id extends string> {
  id: Id;
  label: string;
  href: string;
}

export default function CoachTabBar<Id extends string>({
  tabs,
  activeId,
  ariaLabel,
  remeasureKey,
  sticky,
}: {
  tabs: readonly CoachTab<Id>[];
  activeId: Id;
  /** Names the row for a screen reader — "Money", "Reports". */
  ariaLabel: string;
  /**
   * Anything whose change can alter the row's WIDTH beyond the tab list itself (the hub's summary
   * landing, say). The tab list is already watched; this is the escape hatch for a caller that
   * knows its own layout settles later.
   */
  remeasureKey?: unknown;
  /**
   * ⚠ OPT-IN, DEFAULT FALSE — this component is shared with the Insights reports hub (`/history`),
   * and pinning is a Money-register-specific fix for a long, scrollable book. Insights' tab row is
   * untouched unless it opts in on its own; do not flip the default (reading-order ruling, follow-up
   * to P3).
   */
  sticky?: boolean;
  /* ⚠ NO ACTION SLOT — tried for one day (money centralization P1, per mockup 05's drawing) and
     REMOVED by owner ruling 2026-08-23: on a phone the button crowded the strip down to two
     visible tabs, and a control that belongs to the PAGE was scaling with the tab row. Hub-wide
     actions live in the page header (the 2026-08-13 page-actions rule), with per-action phone
     visibility — see the Money hub's Record button. Do not re-add a slot here for the next
     hub-wide control. */
}) {
  // Is a tab hidden past either edge? The arrows appear only on the side that actually has
  // something hidden — an arrow on a row that already fits, or pointing at nothing, is a lie.
  const barRef = useRef<HTMLElement>(null);
  const [scroll, setScroll] = useState({ left: false, right: false });
  /**
   * ⚠⚠ **THE EFFECT KEYS ON WHAT THE ROW SAYS, NOT ON THE ARRAY'S IDENTITY** — and the difference is
   * the whole cost of this component. Both hubs build their tabs inline (`tabs.map(t => ({ ...t,
   * href: sectionHref(t.id) }))`), so `tabs` is a brand-new array of brand-new objects on EVERY
   * parent render. Depending on it directly tore down the ResizeObserver and the scroll listener and
   * rebuilt them both on every render — roughly a dozen times in a session that visits a few tabs,
   * for a row whose contents had not changed once.
   *
   * Keying on the ids+labels string means the observer is rebuilt exactly when the row's WIDTH can
   * actually have changed (a tab appearing, disappearing or being renamed), which is what the
   * measurement depends on. Fixing it here rather than asking each caller to `useMemo` is
   * deliberate: a caller that forgets is silently slower, and there is no test that would notice.
   */
  const tabsKey = tabs.map(t => `${t.id}:${t.label}`).join('|');
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => setScroll({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', measure); };
  }, [tabsKey, remeasureKey]);

  function scrollTabs(dir: -1 | 1) {
    const el = barRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  }

  return (
    <div
      className={`${styles.coachTabBarWrap} ${sticky ? styles.coachTabBarSticky : ''}`}
      /* ⚠ A STABLE ID, ONLY WHEN STICKY — the register's own sticky zone measures this element's
         real rendered height (fonts/zoom/content all vary the estimate) rather than trusting a
         guessed CSS constant, which is what let content peek through a gap between the two sticky
         layers on the actual page. Safe as a page-wide singleton: only one CoachTabBar renders at
         a time, and only Money's Transactions tab ever sets `sticky`. */
      id={sticky ? 'coach-tabbar-sticky' : undefined}
    >
      {scroll.left && (
        <button
          type="button"
          className={`${styles.coachTabScrollBtn} ${styles.coachTabScrollLeft}`}
          onClick={() => scrollTabs(-1)}
          aria-label="Scroll tabs left"
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
      )}
      <nav
        ref={barRef}
        className={[
          styles.coachTabBar,
          scroll.left ? styles.coachTabFadeLeft : '',
          scroll.right ? styles.coachTabFadeRight : '',
        ].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
      >
        {tabs.map(t => (
          <Link
            key={t.id}
            href={t.href}
            className={`${styles.coachTabBtn} ${activeId === t.id ? styles.coachTabActive : ''}`}
            aria-current={activeId === t.id ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {scroll.right && (
        <button
          type="button"
          className={`${styles.coachTabScrollBtn} ${styles.coachTabScrollRight}`}
          onClick={() => scrollTabs(1)}
          aria-label="Scroll tabs right"
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
