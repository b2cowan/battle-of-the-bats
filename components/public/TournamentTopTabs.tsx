'use client';
/**
 * components/public/TournamentTopTabs.tsx — Unified Home IA · Phase 5 (nav merge).
 *
 * The tournament's own page navigation as a horizontally-scrolling tab row (the GameChanger pattern).
 *
 * The organizer's band (Public tournament pages Stage 1) is its one mount, on every live page, in the admin preview and
 * in the Branding page's Look card. It wears the club site's own tab row (OrgSectionTabs.module.css): white, 44 px, words
 * only, the selected tab ink-underlined. The server passes the hidden pages and the bracket so the first paint already
 * has the right set. (The old dark row — its icons, its own sheet and the preview's `fixed` mount — went with the
 * preview switch, Stage 8 Part 4a.)
 *
 * Landing tab = "Overview" (not "Home") so it never collides with the global bar's Home tab. Register is CTA-only,
 * never a tab.
 */
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useOrgHref, usePublicPathname } from '@/lib/use-public-pathname';
import { visibleTournamentTabs, type FrameTabContent } from '@/lib/tournament-page-tabs';
import type { PublicPageKey } from '@/lib/public-pages';
import frameTabs from './OrgSectionTabs.module.css';

type TournamentTopTabsProps = {
  /** Link prefix override. Omit on the live public site (derived from route params); the
   *  admin PREVIEW passes its `/…/preview/{tournament}` base so the tabs stay in-preview. */
  basePath?: string;
  hiddenPages: PublicPageKey[];
  /** Server-resolved bracket answer (the frame's band passes it). */
  hasBracket?: boolean;
  /** Placement from the band (its grid slot). */
  className?: string;
  /** Public tournament pages Stage 6 (Ask 14): News/Rules/Register/Champions tab facts, passed through from the layout. */
  frameContent?: FrameTabContent;
  /** Next's `prefetch`, on every tab (see TournamentBand: `false` only inside the Look card's window). */
  prefetch?: boolean;
};

export default function TournamentTopTabs({ basePath, hiddenPages, hasBracket: frameHasBracket = false, className, frameContent, prefetch }: TournamentTopTabsProps) {
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

  // The row fades at its right edge while more tabs are off screen (`data-more`, read by TournamentFrame.module.css).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
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
  }, [pathname, visibleTabsKey]);

  // Live: derive homeHref from route params. Preview: an explicit basePath keeps links in-preview.
  const homeHref = basePath ?? (orgSlug && tournamentSlug ? `/${orgSlug}/${tournamentSlug}` : null);
  if (!homeHref) return null;

  const overviewActive = pathname === homeHref;
  const tabs = visibleTournamentTabs(hiddenPages, hasBracket, frameContent);

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
