'use client';
/**
 * components/public/TournamentTopTabs.tsx — Unified Home IA · Phase 5 (nav merge).
 *
 * The tournament's own page navigation, moved OUT of the retired bottom bar into a
 * horizontally-scrolling tab row directly under the branded event header (the
 * GameChanger pattern). Renders ≤900px only (the desktop TournamentSideRail owns
 * the vertical nav ≥1024px; tablet keeps the top-bar links) — it is mounted inside
 * the Navbar's fixed event-header <nav>, so its height folds into the measured
 * --nav-visual-h / --nav-event-h automatically (ticker + sticky day-labels + page
 * padding all clear it with no extra plumbing). That auto-fold holds ONLY while the
 * nav stays auto-height ≤900px (Navbar.module.css .hasEventHead) and this row stays
 * in normal flow — making .tabs position:absolute/fixed would silently break the
 * measurement (no error, just wrong chrome height).
 *
 * TWO mounts (drift-proof, one component): the LIVE site renders it with no props inside
 * the Navbar's event-header nav (above); the admin PREVIEW renders it STANDALONE with a
 * `basePath` + `hiddenPages` + `fixed` (the `.tabsFixed` skin pins it below the preview's
 * top bar), so a preview mirrors the live tab row — identity chrome stays out of preview.
 *
 * Landing tab = "Overview" (not "Home") so it never collides with the global bar's
 * Home tab. Register is CTA-only, never a tab. The venue-following skin comes for
 * free from the tournament's :root override (dark event → dark; light event → light;
 * active tab tinted with --primary-light) — no literal colour here.
 */
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { Home } from 'lucide-react';
import { useOrgNav } from '@/components/OrgNavContext';
import { TOURNAMENT_PAGE_TABS } from '@/lib/tournament-page-tabs';
import type { PublicPageKey } from '@/lib/public-pages';
import styles from './TournamentTopTabs.module.css';

type TournamentTopTabsProps = {
  /** Link prefix override. Omit on the live public site (derived from route params); the
   *  admin PREVIEW passes its `/…/preview/{tournament}` base so the tabs stay in-preview. */
  basePath?: string;
  hiddenPages?: PublicPageKey[];
  /** The preview mounts this row STANDALONE (not inside the measured live event-header nav),
   *  so it fixes itself below the top bar instead of riding the nav's flow. Live omits it. */
  fixed?: boolean;
};

export default function TournamentTopTabs({ basePath, hiddenPages, fixed }: TournamentTopTabsProps = {}) {
  const pathname = usePathname();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const { tournamentHiddenPages } = useOrgNav();
  const resolvedHidden = hiddenPages ?? tournamentHiddenPages;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  // Stable key for the visible-tab SET — changes only when its contents change (a raw
  // array dep would re-fire on every context update; join is content-stable).
  const visibleTabsKey = resolvedHidden.join(',');

  // Keep the current tab in view when the row overflows: centre the active tab in the
  // scroller (only ever scrolls the row horizontally — never the page). Re-runs on route
  // change AND when the visible-tab set changes (tournamentHiddenPages populates from
  // context after mount, or the organizer's hidden pages change), so the active tab is
  // recentred against the new layout even if the pathname didn't move.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const active = activeRef.current;
    if (!scroller || !active) return;
    const target = active.offsetLeft - (scroller.clientWidth - active.offsetWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
  }, [pathname, visibleTabsKey]);

  // Live: derive homeHref from route params. Preview: an explicit basePath keeps links in-preview.
  const homeHref = basePath ?? (orgSlug && tournamentSlug ? `/${orgSlug}/${tournamentSlug}` : null);
  if (!homeHref) return null;

  const overviewActive = pathname === homeHref;
  const tabs = TOURNAMENT_PAGE_TABS.filter(t => !resolvedHidden.includes(t.key));

  return (
    <nav className={`${styles.tabs}${fixed ? ` ${styles.tabsFixed}` : ''}`} aria-label="Tournament pages">
      <div className={styles.scroller} ref={scrollerRef}>
        <div className={styles.track}>
          <Link
            href={homeHref}
            ref={overviewActive ? activeRef : undefined}
            className={`${styles.tab} ${overviewActive ? styles.active : ''}`}
            aria-current={overviewActive ? 'page' : undefined}
          >
            <Home size={15} strokeWidth={overviewActive ? 2.4 : 1.9} aria-hidden />
            <span>Overview</span>
          </Link>
          {tabs.map(({ key, label, Icon }) => {
            const href = `${homeHref}/${key}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={key}
                href={href}
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
