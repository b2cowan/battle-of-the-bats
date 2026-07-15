'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Home, Calendar, Trophy, Users, Megaphone, ScrollText, Ellipsis } from 'lucide-react';
import { useOrgNav } from './OrgNavContext';
import { isConsumerShellPath } from '@/lib/consumer-routes';
import { OPEN_TOURNAMENT_SHEET_EVENT } from '@/components/public/TournamentAccountSheet';
import type { PublicPageKey } from '@/lib/public-pages';
import styles from './BottomNav.module.css';

// Mobile primary tabs (G5, owner decision 2026-07-14): Home leads, More closes —
// the More SHEET carries News + Rules (their old tab slots) plus notifications
// and the signed-in doors, mirroring the main app's bottom-right "everything
// else" corner. News/Rules pages still exist; only their bar slots moved.
const PAGE_TABS = [
  { key: 'schedule',  icon: Calendar, label: 'Schedule'  },
  { key: 'standings', icon: Trophy,   label: 'Standings' },
  { key: 'teams',     icon: Users,    label: 'Teams'     },
];

// Admin tournament PREVIEW keeps the classic five page tabs (News/Rules join
// the shared trio): the More sheet is live-site chrome (account/identity
// resolution) that doesn't exist in preview.
const PREVIEW_TABS = [
  { key: 'news', icon: Megaphone, label: 'News' },
  ...PAGE_TABS,
  { key: 'rules', icon: ScrollText, label: 'Rules' },
];

type BottomNavProps = {
  /** Link prefix override. Omit on the live public site (derived from route params);
   *  the admin tournament PREVIEW passes its `/…/preview/{tournament}` base so the
   *  tabs stay inside the preview instead of escaping to the live site. */
  basePath?: string;
  hiddenPages?: PublicPageKey[];
};

export default function BottomNav({ basePath, hiddenPages }: BottomNavProps = {}) {
  const pathname = usePathname();
  const params   = useParams();
  const orgSlug  = (params?.orgSlug as string) || 'milton-bats';
  const tournamentSlug = params?.tournamentSlug as string | undefined;
  const { tournamentHiddenPages } = useOrgNav();

  // Live usage: hide on admin/marketing/auth routes and when there's no tournament
  // in the URL. Preview usage: an explicit basePath is passed, so bypass the admin
  // guard (the preview lives under /…/admin/…) and link inside the preview.
  const isAdmin = /^\/[^/]+\/admin(\/|$)/.test(pathname) || pathname.startsWith('/admin');
  // Consumer shell (/discover, /scores, /following, /account) has its own bottom nav.
  const isMarketing = pathname === '/' || pathname.startsWith('/auth') || isConsumerShellPath(pathname);
  if (!basePath && (isAdmin || isMarketing || pathname.startsWith('/platform-admin') || !tournamentSlug)) return null;

  const homeHref = basePath ?? `/${orgSlug}/${tournamentSlug}`;
  const isPreviewBar = !!basePath;
  const pageTabs = (isPreviewBar ? PREVIEW_TABS : PAGE_TABS)
    .filter(tab => !(hiddenPages ?? tournamentHiddenPages).includes(tab.key as PublicPageKey));
  // Live bar: Home + up to 3 page tabs + More = 5 max. Preview keeps the classic
  // five page tabs (Home only when a page is hidden — J6-057 safeguard intact).
  const showHome = isPreviewBar ? pageTabs.length < 5 : true;

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      {showHome && (
        <Link
          href={homeHref}
          className={`${styles.tab} ${pathname === homeHref ? styles.active : ''}`}
          id="bottom-nav-home"
          aria-current={pathname === homeHref ? 'page' : undefined}
        >
          <span className={styles.iconWrap}>
            <Home size={22} strokeWidth={pathname === homeHref ? 2.5 : 1.8} />
            {pathname === homeHref && <span className={styles.activeDot} />}
          </span>
          <span className={styles.label}>Home</span>
        </Link>
      )}

      {pageTabs.map(({ key, icon: Icon, label }) => {
        const href   = `${homeHref}/${key}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            id={`bottom-nav-${label.toLowerCase()}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {active && <span className={styles.activeDot} />}
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}

      {/* More (G5) — opens the tournament sheet (mounted once in the Navbar):
          your doors + notifications + news + rules. A button, not a route. */}
      {!isPreviewBar && (
        <button
          type="button"
          className={styles.tab}
          id="bottom-nav-more"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_TOURNAMENT_SHEET_EVENT))}
          aria-haspopup="dialog"
        >
          <span className={styles.iconWrap}>
            <Ellipsis size={22} strokeWidth={1.8} />
          </span>
          <span className={styles.label}>More</span>
        </button>
      )}
    </nav>
  );
}
