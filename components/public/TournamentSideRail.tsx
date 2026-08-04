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
import { PanelsTopLeft } from 'lucide-react';
import { useOrgNav } from '@/components/OrgNavContext';
import type { PublicPageKey } from '@/lib/public-pages';
import { visibleTournamentTabs } from '@/lib/tournament-page-tabs';
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
  // The admin preview passes its own hidden-page list but has no bracket signal to pass, so it
  // falls back to the context — which the preview never populates, leaving the preview without a
  // Playoffs tab. That is correct: the preview's own rail links inside `/preview/…`, where there
  // is no bracket route to point at.
  const items = visibleTournamentTabs(resolvedHidden, !basePath && ctx.tournamentHasBracket);

  return (
    <aside
      className={styles.rail}
      data-color-mode={resolvedColorMode}
      aria-label="Tournament sections"
    >
      {/* Identity block — no longer a link to the event home (Nav Unification Stage B.4:
          the Overview item directly below is that door; the logo-link duplicated it).
          Stage B.2: when the org's public page is a real destination (layout-resolved
          orgHomeHref — live site only, never the admin preview), the org name appears
          above the event name as the breadcrumb up, suppressed when org and event share
          a name (no "X › X"). */}
      {/* Micro-ruling (a), 2026-08-01: the NAME always renders; it is a LINK only when the org's
          public page is a real destination. This used to drop the org's name entirely when the
          page wasn't real, while the phone eyebrow kept it as inert text — the same signal
          rendered two ways, and the desktop version lost information, not just a door. The phone
          rule wins because whose event this is remains true whether or not there is a page to
          visit. The chevron goes with the link: a trail marker pointing nowhere is a dead
          affordance, which is the whole class of defect this pass is closing. */}
      <div className={styles.railHeader}>
        {!basePath && ctx.orgName && ctx.orgName !== resolvedHeading && (
          ctx.orgHomeHref ? (
            <Link href={ctx.orgHomeHref} className={styles.railCrumb}>{ctx.orgName} ›</Link>
          ) : (
            <span className={styles.railCrumb}>{ctx.orgName}</span>
          )
        )}
        <div className={styles.railIdentity}>
          {resolvedLogo && <img src={resolvedLogo} alt="" className={styles.railLogo} />}
          {resolvedHeading && <span className={styles.railName}>{resolvedHeading}</span>}
        </div>
      </div>
      <nav className={styles.nav}>
        <Link
          href={homeHref}
          className={`${styles.item} ${pathname === homeHref ? styles.active : ''}`}
          aria-current={pathname === homeHref ? 'page' : undefined}
        >
          {/* PanelsTopLeft, not Home (Stage B.3): the house glyph now means exactly one
              thing platform-wide — the app's Home tab. */}
          <PanelsTopLeft size={18} />
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
