'use client';

/**
 * Shared admin header ("The Flip") — one persistent bar across the whole admin shell (desktop + mobile),
 * so the flip door to the public side is always in the same top-right spot and never disappears. Not
 * rendered on focused shells (onboarding/help/preview).
 *
 * THE BAR NAMES WHERE YOU ARE (Admin header bar, option 4, owner 2026-11-07; plan
 * `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`). The name sits on top; a small line UNDER it carries the
 * facts, in the coaches portal's masthead meta voice (`.teamHeaderMeta`). Inside a tournament: the event's
 * name (a link to its dashboard), then the dates · the status chip, a second line in the bar (A2 = a) that
 * never folds away. On the club's Overview it is the club's name alone.
 *
 * IN A CLUB PLACE (Phase 2): the place's name, its way up ("← Seasons"), the switcher beside the name, the
 * small line (the section · the status chip), and the place's TAB ROW pinned inside the bar (`HubTabBar
 * inBar`). The place's frame hands these over (`AdminBarPlace.tsx`); before it has, the bar knows the place
 * from the address alone (`clubPlaceAt`) and draws the frame's own placeholder, so the club's name never shows
 * and swaps. Every other screen shows the organization's name alone. What it names comes from ONE model
 * (`useAdminPlace`), which the desktop strip reads too.
 *
 * ⚖ ROUND 4 (owner 2026-11-08, D1–D5): ABOVE 900px THIS BAR IS THE TAB BAND ALONE. The place names itself in
 * the top strip (`AdminTopStrip`), View site sits there by the bell, and the club heads the sidebar in a cell
 * exactly the band's height (`--admin-band-h`, one variable both read), so the two bottom rules are one line. A
 * place without tabs (Overview, a tournament, every other screen) draws no desktop bar at all. The phone keeps
 * everything below exactly as it was.
 *
 * ⚠ NO SCROLL COLLAPSE, anywhere (owner 2026-11-07, the portal took it out 2026-09-21): the collapse made
 * content jump under the thumb. The bar's height changes only when you navigate, never on scroll, and
 * `--admin-header-h` publishes it for the in-page sticky toolbars.
 *
 * HEADING SEMANTICS. The bar's name is the page's one `<h1>` wherever it IS the page's title: the club's
 * Overview (its paper heading is gone, A3) and every club place that hands the bar its name (that place's
 * paper heading went with it). Inside a tournament the name stays a link and the page's own title (Teams,
 * Schedule…) stays the `<h1>` on the paper; on every other club screen (a team, a record page, a place not
 * moved yet) the page still draws its own heading, so the name is a `<span>` there. Two `<h1>`s on one
 * page is the defect to avoid: above 900px this name row is `display: none` and the strip's name is the
 * `<h1>`; at 900px and below the strip's place is `display: none` and this one is.
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';
import FlipPill from '@/components/shared/FlipPill';
import { useAdminFlip } from '@/lib/use-admin-flip';
import HubTabBar from '@/components/shared/HubTabBar';
import { useAdminPlace } from './useAdminPlace';
import styles from './kit/AdminKitEventHeader.module.css';

export default function AdminEventHeader({ suspended = false }: {
  /** A cancelled account (`AdminChrome` decides): the org's name alone — no tournament identity, no door to a public
   *  site whose pages are suspended. */
  suspended?: boolean;
} = {}) {
  const pathname = usePathname();
  const { title, titleHref, isPageTitle, place, tabbed, dates, phaseChip } = useAdminPlace(suspended);
  const flip = useAdminFlip();
  const ref = useRef<HTMLElement>(null);

  // The router doesn't reset the shell's inner scroller (.adminMain on a phone) on navigation, so a new
  // page could otherwise open mid-scroll. Reset it whenever the route changes.
  useEffect(() => {
    let node: HTMLElement | null = ref.current?.parentElement ?? null;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === 'auto' || oy === 'scroll') { node.scrollTo(0, 0); break; }
      node = node.parentElement;
    }
  }, [pathname]);

  // Publish the rendered bar height so in-page sticky toolbars can stick BELOW it (via
  // `top: var(--admin-header-h)`) instead of being buried under it. With no collapse it changes only when
  // the bar's content does (navigation, a name loading in, a breakpoint), never on scroll. On desktop the bar is the tab
  // band alone, or not drawn at all (`display: none`), and then this publishes 0.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty('--admin-header-h', `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--admin-header-h'); };
  }, [pathname]);

  // No door (focused/preview shells) → no header.
  if (!flip) return null;

  // The link wraps the name rather than being it: the name clamps its lines, and the link's own box is
  // free to grow into a thumb's target on a touch screen without un-clamping them.
  const name = isPageTitle
    ? <h1 className={styles.name}>{title}</h1>
    : <span className={styles.name}>{title}</span>;
  const nameEl = titleHref
    ? <Link href={titleHref} className={styles.nameLink} title={`${title} — open dashboard`}>{name}</Link>
    : name;

  const facts = place?.facts ?? [];
  // The phone's small line: the section, a tournament's dates, the status chip. ⚖ Round 4 (D1, D3, 2026-11-08): the
  // desktop has no small line at all (the club heads the sidebar, the place names itself in the strip), so the words
  // only a desk showed — the club, a team's group — are gone with it. The phone's line is unchanged.
  const hasMeta = Boolean(facts.length || dates || phaseChip || place?.chip);
  // ⚖ ON DESKTOP THE BAR IS THE TAB BAND ALONE (round 4, D1): the name row is the phone's (the strip names the place
  // above 900px), and a place without tabs draws no desktop bar at all. A cancelled account's one page keeps its row:
  // it has no sidebar to split the strip on, so its strip stays as it was and this bar keeps naming the organization.
  const deskClass = suspended ? '' : tabbed ? ` ${styles.deskBand}` : ` ${styles.deskNone}`;
  return (
    <header ref={ref} role="banner" className={`${styles.header}${tabbed ? ` ${styles.withTabs}` : ''}${deskClass}`}>
      <div className={styles.row}>
        {place?.back && (
          // The way up, named by where it goes (the paper header's `backTo`, moved in): the arrow alone on a phone.
          <>
            <Link href={place.back.href} className={styles.back} aria-label={`Back to ${place.back.label}`}>
              <ArrowLeft size={15} aria-hidden />
              <span className={styles.backLabel}>{place.back.label}</span>
            </Link>
            <span className={styles.backRule} aria-hidden />
          </>
        )}
        <div className={styles.identity}>
          {place?.switcher
            // The name is cut to one line with "…"; the switcher beside it never is.
            ? <div className={styles.titleRow}>{nameEl}<span className={styles.switcher}>{place.switcher}</span></div>
            : nameEl}
          {hasMeta && (
            // Each fact is its own span and the separator is drawn BETWEEN siblings (the portal's rule), so a
            // missing fact never strands a dot.
            <div className={styles.meta}>
              {facts.map(f => <span key={f}>{f}</span>)}
              {dates && <span>{dates}</span>}
              {phaseChip}
              {place?.chip && <span className={`${styles.chip} ${styles.metaChip}`}>{place.chip}</span>}
            </div>
          )}
        </div>
        {!suspended && <FlipPill resolution={flip} variant="inline" className={styles.pill} />}
      </div>
      {tabbed && <HubTabBar inBar tabs={tabbed.tabs} activeId={tabbed.activeId} ariaLabel={tabbed.ariaLabel} />}
    </header>
  );
}
