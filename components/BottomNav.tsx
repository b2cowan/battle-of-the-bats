'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Home, Calendar, Trophy, Users, Megaphone, ScrollText } from 'lucide-react';
import { useOrgNav } from './OrgNavContext';
import type { PublicPageKey } from '@/lib/public-pages';
import styles from './BottomNav.module.css';

// Mobile primary tabs, in section order. Rules sits at the END (reference material
// fans hunt for once the tournament starts) — it used to be omitted, but fans
// couldn't find it. To keep the bar at its 5-tab max, Home is dropped when every
// page is enabled (see showHome below); the top-nav logo still returns to Overview.
const PAGE_TABS = [
  { key: 'news',     icon: Megaphone,  label: 'News'     },
  { key: 'schedule', icon: Calendar,   label: 'Schedule' },
  { key: 'standings', icon: Trophy,    label: 'Standings' },
  { key: 'teams',    icon: Users,      label: 'Teams'    },
  { key: 'rules',    icon: ScrollText, label: 'Rules'    },
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
  const isMarketing = pathname === '/' || pathname.startsWith('/discover') || pathname.startsWith('/auth');
  if (!basePath && (isAdmin || isMarketing || pathname.startsWith('/platform-admin') || !tournamentSlug)) return null;

  const homeHref = basePath ?? `/${orgSlug}/${tournamentSlug}`;
  const pageTabs = PAGE_TABS.filter(tab => !(hiddenPages ?? tournamentHiddenPages).includes(tab.key as PublicPageKey));

  // Cap the bar at five tabs. Home leads whenever there's room, but when every page
  // is enabled (five page tabs) we drop it so Rules stays visible at the end — the
  // top-nav logo/name still returns to Overview. This also preserves the J6-057
  // safeguard: with fewer page tabs Home is always shown, so the bar is never empty.
  const showHome = pageTabs.length < 5;

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
    </nav>
  );
}
