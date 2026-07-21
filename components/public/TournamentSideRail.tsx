'use client';
/* eslint-disable @next/next/no-img-element */
/**
 * components/public/TournamentSideRail.tsx
 * Desktop-only (≥1024px) persistent navigation rail for the public tournament
 * app shell. Spans the full left column (above the top nav) with a branded
 * header (logo + tournament name) so there's no empty nav band, then the
 * section links. Mobile/tablet render nothing here (CSS-gated) and keep the top
 * bar + bottom nav untouched.
 *
 * Two callers, one component (drift-proof):
 *  - The live public layout renders <TournamentSideRail/> with NO props — it reads
 *    the OrgNav context + route params and links to `/{org}/{tournament}/…`.
 *  - The admin tournament PREVIEW passes an explicit `basePath` (+ branding props)
 *    so the rail links stay inside `/…/preview/{tournament}/…` and active-state
 *    matches the preview pathname.
 */
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Home } from 'lucide-react';
import { useOrgNav } from '@/components/OrgNavContext';
import type { PublicPageKey } from '@/lib/public-pages';
import { TOURNAMENT_PAGE_TABS } from '@/lib/tournament-page-tabs';
import DesktopMyTeamRailCard from '@/components/public/DesktopMyTeamRailCard';
import styles from './TournamentSideRail.module.css';

type TournamentSideRailProps = {
  /** Link prefix for the rail. Omit on the public site (derived from route params);
   *  the preview passes its `/…/preview/{tournament}` base so links stay in-preview. */
  basePath?: string;
  logoUrl?: string | null;
  heading?: string | null;
  colorMode?: 'dark' | 'light' | null;
  hiddenPages?: PublicPageKey[];
};

export default function TournamentSideRail({
  basePath,
  logoUrl,
  heading,
  colorMode,
  hiddenPages,
}: TournamentSideRailProps = {}) {
  const pathname = usePathname();
  const params = useParams();
  const ctx = useOrgNav();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';

  // Public usage: no props → derive everything from route params + context (unchanged).
  // Preview usage: an explicit basePath (and branding props) is passed.
  const homeHref = basePath ?? (orgSlug && tournamentSlug ? `/${orgSlug}/${tournamentSlug}` : null);
  if (!homeHref) return null;

  const resolvedLogo = logoUrl !== undefined ? logoUrl : ctx.logoUrl;
  const resolvedHeading = heading !== undefined ? heading : (ctx.tournamentName || ctx.orgName);
  const resolvedColorMode = colorMode ?? ctx.tournamentColorMode ?? 'dark';
  const resolvedHidden = hiddenPages ?? ctx.tournamentHiddenPages;
  const items = TOURNAMENT_PAGE_TABS.filter(i => !resolvedHidden.includes(i.key));

  return (
    <aside
      className={styles.rail}
      data-color-mode={resolvedColorMode}
      aria-label="Tournament sections"
    >
      <Link href={homeHref} className={styles.railHeader}>
        {resolvedLogo && <img src={resolvedLogo} alt="" className={styles.railLogo} />}
        {resolvedHeading && <span className={styles.railName}>{resolvedHeading}</span>}
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
      {/* Persistent followed-team card — live public rail only, not admin preview (J6-042). */}
      {!basePath && <DesktopMyTeamRailCard />}
      <div className={styles.railFooter}>Live on FieldLogicHQ</div>
    </aside>
  );
}
