'use client';
/**
 * components/public/TournamentSideRail.tsx
 * Desktop-only (≥1024px) persistent navigation rail for the public tournament pages: the section links, in the club
 * site's look — white on the light ground, running the page's full height beside it, under the organizer's band (the
 * layout places it in the frame's desk grid, TournamentFrame.module.css). Mobile/tablet render nothing here (CSS-gated).
 * Words only, as the drawing and the phone's tab row. The band carries the event's name, logo and host and the footer
 * carries the credit, so the rail has neither. (The old dark rail — its identity block, crumb, icons and
 * "Live on FieldLogicHQ" line — went with the preview switch, Public tournament pages Stage 8 Part 4a.)
 *
 * Two callers, one component (drift-proof):
 *  - The live public layout passes the tab facts (hidden pages, the bracket, the frame's tab content) and links to
 *    `/{org}/{tournament}/…` from the route params.
 *  - The admin tournament PREVIEW passes an explicit `basePath` so the rail links stay inside
 *    `/…/preview/{tournament}/…` and active-state matches the preview pathname.
 */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgHref, usePublicPathname } from '@/lib/use-public-pathname';
import type { PublicPageKey } from '@/lib/public-pages';
import { visibleTournamentTabs, type FrameTabContent } from '@/lib/tournament-page-tabs';
import DesktopMyTeamRailCard from '@/components/public/DesktopMyTeamRailCard';
import PublicAppOnly from '@/components/public/PublicAppOnly';
import styles from './TournamentSideRail.module.css';

type TournamentSideRailProps = {
  /** Link prefix for the rail. Omit on the public site (derived from route params);
   *  the preview passes its `/…/preview/{tournament}` base so links stay in-preview. */
  basePath?: string;
  hiddenPages: PublicPageKey[];
  /** The live layout's server answer; the preview has no Playoffs route, so it is ignored there. */
  hasBracket?: boolean;
  /** Both frame layouts pass their facts explicitly so the server's first paint agrees with the band/footer. */
  frameContent?: FrameTabContent;
};

export default function TournamentSideRail({
  basePath,
  hiddenPages,
  hasBracket = false,
  frameContent,
}: TournamentSideRailProps) {
  const pathname = usePublicPathname();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const orgHref = useOrgHref(orgSlug);
  // `homeHref` and the tab paths stay in the club-named form (they are compared with the club-named pathname); what a link
  // SAYS is spelled for the address the visitor is on. The preview's basePath is not the club's public address: unchanged.
  const spell = (p: string) => (basePath ? p : orgHref(p.slice(orgSlug.length + 1)));

  // Public usage: links from the route params. Preview usage: an explicit basePath is passed.
  const homeHref = basePath ?? (orgSlug && tournamentSlug ? `/${orgSlug}/${tournamentSlug}` : null);
  if (!homeHref) return null;

  // Preview has no Playoffs route; the live layout's bracket answer arrives from the server.
  const items = visibleTournamentTabs(hiddenPages, !basePath && hasBracket, frameContent);

  return (
    <aside className={styles.rail} aria-label="Tournament sections">
      {/* The rail's contents ride the scroll (its column runs the page's height). */}
      <div className={styles.stick}>
        <nav className={styles.nav}>
          <Link
            href={spell(homeHref)}
            className={`${styles.item} ${pathname === homeHref ? styles.active : ''}`}
            aria-current={pathname === homeHref ? 'page' : undefined}
          >
            Overview
          </Link>
          {items.map(({ key, label }) => {
            const href = `${homeHref}/${key}`;
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={key}
                href={spell(href)}
                className={`${styles.item} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {/* Persistent followed-team card — live public rail only, not admin preview (J6-042). */}
        {!basePath && <PublicAppOnly><DesktopMyTeamRailCard /></PublicAppOnly>}
      </div>
    </aside>
  );
}
