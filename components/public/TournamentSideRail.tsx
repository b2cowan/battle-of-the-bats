'use client';
/* eslint-disable @next/next/no-img-element */
/**
 * components/public/TournamentSideRail.tsx
 * Desktop-only (≥1024px) persistent navigation rail for the public tournament
 * app shell. Spans the full left column (above the top nav) with a branded
 * header (logo + tournament name) so there's no empty nav band, then the
 * section links. Reads the existing OrgNav context so it honours hidden pages
 * and the tournament's color mode. Mobile/tablet render nothing here (CSS-gated)
 * and keep the top bar + bottom nav untouched.
 */
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Home, Megaphone, Calendar, Trophy, Users, ScrollText, type LucideIcon } from 'lucide-react';
import { useOrgNav } from '@/components/OrgNavContext';
import type { PublicPageKey } from '@/lib/public-pages';
import styles from './TournamentSideRail.module.css';

const RAIL_ITEMS: { key: PublicPageKey; label: string; Icon: LucideIcon }[] = [
  { key: 'news', label: 'News', Icon: Megaphone },
  { key: 'schedule', label: 'Schedule', Icon: Calendar },
  { key: 'standings', label: 'Standings', Icon: Trophy },
  { key: 'teams', label: 'Teams', Icon: Users },
  { key: 'rules', label: 'Rules', Icon: ScrollText },
];

export default function TournamentSideRail() {
  const pathname = usePathname();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const { logoUrl, orgName, tournamentName, tournamentColorMode, tournamentHiddenPages } = useOrgNav();

  if (!orgSlug || !tournamentSlug) return null;

  const homeHref = `/${orgSlug}/${tournamentSlug}`;
  const items = RAIL_ITEMS.filter(i => !tournamentHiddenPages.includes(i.key));
  const heading = tournamentName || orgName;

  return (
    <aside
      className={styles.rail}
      data-color-mode={tournamentColorMode ?? 'dark'}
      aria-label="Tournament sections"
    >
      <Link href={homeHref} className={styles.railHeader}>
        {logoUrl && <img src={logoUrl} alt="" className={styles.railLogo} />}
        {heading && <span className={styles.railName}>{heading}</span>}
      </Link>
      <nav className={styles.nav}>
        <Link
          href={homeHref}
          className={`${styles.item} ${pathname === homeHref ? styles.active : ''}`}
          aria-current={pathname === homeHref ? 'page' : undefined}
        >
          <Home size={18} />
          <span>Overview</span>
        </Link>
        {items.map(({ key, label, Icon }) => {
          const href = `${homeHref}/${key}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={key}
              href={href}
              className={`${styles.item} ${isActive ? styles.active : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className={styles.railFooter}>Live on FieldLogicHQ</div>
    </aside>
  );
}
