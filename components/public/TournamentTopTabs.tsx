'use client';
/**
 * components/public/TournamentTopTabs.tsx — Unified Home IA · Phase 5 (nav merge).
 *
 * The tournament's own page navigation as a horizontally-scrolling tab row (the GameChanger pattern).
 *
 * THE FRAME SKIN (Public tournament pages Stage 1): the organizer's band mounts this row with `skin="frame"` on every
 * live page and wears the club site's own tab row (OrgSectionTabs.module.css): white, 44 px, words only, the selected
 * tab ink-underlined. The server passes the hidden pages and the bracket so the first paint already has the right set.
 * The admin preview's switch-off branch still mounts the old row STANDALONE with a `basePath` + `fixed` (the
 * `.tabsFixed` skin pins it below the preview's top bar) — Part 4 deletes that. The platform's old tournament bar,
 * which mounted this row with no props and read the tab facts from the nav context, went in Stage 8 Part 3d.
 *
 * Landing tab = "Overview" (not "Home") so it never collides with the global bar's
 * Home tab. Register is CTA-only, never a tab. The venue-following skin comes for
 * free from the tournament's :root override (dark event → dark; light event → light;
 * active tab tinted with --primary-light) — no literal colour here.
 */
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useOrgHref, usePublicPathname } from '@/lib/use-public-pathname';
import { PanelsTopLeft } from 'lucide-react';
import { visibleTournamentTabs, type FrameTabContent } from '@/lib/tournament-page-tabs';
import type { PublicPageKey } from '@/lib/public-pages';
import styles from './TournamentTopTabs.module.css';
import frameTabs from './OrgSectionTabs.module.css';

type TournamentTopTabsProps = {
  /** Link prefix override. Omit on the live public site (derived from route params); the
   *  admin PREVIEW passes its `/…/preview/{tournament}` base so the tabs stay in-preview. */
  basePath?: string;
  hiddenPages: PublicPageKey[];
  /** The preview's switch-off branch mounts this row STANDALONE, so it fixes itself below the top bar. */
  fixed?: boolean;
  /** Server-resolved bracket answer (the frame's band passes it). */
  hasBracket?: boolean;
  /** `frame`: the club site's white tab row, words only (Stage 1's band). Omitted: today's row. */
  skin?: 'frame';
  /** Placement from the band (its grid slot). */
  className?: string;
  /** Public tournament pages Stage 6 (Ask 14): News/Rules/Register/Champions tab facts. The band passes this
   *  through from the layout; omitted (every switch-off mount), the row is exactly what it has always been. */
  frameContent?: FrameTabContent;
  /** Next's `prefetch`, on every tab (see TournamentBand: `false` only inside the Look card's window). */
  prefetch?: boolean;
};

export default function TournamentTopTabs({ basePath, hiddenPages, fixed, hasBracket: frameHasBracket = false, skin, className, frameContent, prefetch }: TournamentTopTabsProps) {
  const pathname = usePublicPathname();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const orgHref = useOrgHref(orgSlug);
  // Paths stay club-named for the active-tab match; the link is spelled for the visitor's address (the preview's basePath is not).
  const spell = (p: string) => (basePath ? p : orgHref(p.slice(orgSlug.length + 1)));
  // Preview links stay inside `/preview/…`, which has no bracket route — so no Playoffs tab there.
  const hasBracket = !basePath && frameHasBracket;
  const scrollerRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  // Stable key for the visible-tab SET — changes only when its contents change (a raw
  // array dep would re-fire on every parent render; join is content-stable).
  const visibleTabsKey = `${hiddenPages.join(',')}|${hasBracket}`;

  // Keep the current tab in view when the row overflows: centre the active tab in the
  // scroller (only ever scrolls the row horizontally — never the page). Re-runs on route
  // change AND when the visible-tab set changes (the organizer's hidden pages change), so the active tab is
  // recentred against the new layout even if the pathname didn't move.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const active = activeRef.current;
    if (!scroller || !active) return;
    const target = active.offsetLeft - (scroller.clientWidth - active.offsetWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
  }, [pathname, visibleTabsKey]);

  // The frame's row fades at its right edge while more tabs are off screen (`data-more`, read by TournamentFrame.module.css).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (skin !== 'frame' || !scroller) return;
    const update = () => {
      if (scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 1) scroller.dataset.more = '';
      else delete scroller.dataset.more;
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [skin, pathname, visibleTabsKey]);

  // Live: derive homeHref from route params. Preview: an explicit basePath keeps links in-preview.
  const homeHref = basePath ?? (orgSlug && tournamentSlug ? `/${orgSlug}/${tournamentSlug}` : null);
  if (!homeHref) return null;

  const overviewActive = pathname === homeHref;
  const tabs = visibleTournamentTabs(hiddenPages, hasBracket, frameContent);

  if (skin === 'frame') {
    const frameTab = (href: string, label: string, active: boolean) => (
      <Link
        key={href}
        href={spell(href)}
        prefetch={prefetch}
        ref={active ? activeRef : undefined}
        className={`${frameTabs.tab} ${active ? frameTabs.active : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        {label}
      </Link>
    );
    return (
      <nav ref={scrollerRef} className={`${frameTabs.tabs}${className ? ` ${className}` : ''}`} aria-label="Tournament pages">
        {frameTab(homeHref, 'Overview', overviewActive)}
        {tabs.map(({ key, label }) => {
          const href = `${homeHref}/${key}`;
          return frameTab(href, label, pathname === href || pathname.startsWith(`${href}/`));
        })}
      </nav>
    );
  }

  return (
    <nav className={`${styles.tabs}${fixed ? ` ${styles.tabsFixed}` : ''}`} aria-label="Tournament pages">
      <div className={styles.scroller} ref={el => { scrollerRef.current = el; }}>
        <div className={styles.track}>
          <Link
            href={spell(homeHref)}
            prefetch={prefetch}
            ref={overviewActive ? activeRef : undefined}
            className={`${styles.tab} ${overviewActive ? styles.active : ''}`}
            aria-current={overviewActive ? 'page' : undefined}
          >
            <PanelsTopLeft size={15} strokeWidth={overviewActive ? 2.4 : 1.9} aria-hidden />
            <span>Overview</span>
          </Link>
          {tabs.map(({ key, label, Icon }) => {
            const href = `${homeHref}/${key}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={key}
                href={spell(href)}
                prefetch={prefetch}
                ref={active ? activeRef : undefined}
                className={`${styles.tab} ${active ? styles.active : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={15} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
