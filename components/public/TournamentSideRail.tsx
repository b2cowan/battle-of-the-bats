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
 *  - The live public layout passes the tab facts (hidden pages, the bracket, the frame's tab content) and links to
 *    `/{org}/{tournament}/…` from the route params; the crumb and heading come from the OrgNav context.
 *  - The admin tournament PREVIEW passes an explicit `basePath` (+ branding props)
 *    so the rail links stay inside `/…/preview/{tournament}/…` and active-state
 *    matches the preview pathname.
 *
 * UNDER THE PUBLIC FRAME (Public tournament pages Stage 1 Part 2) the rail is the same links in the club site's look: white
 * on the light ground, running the page's full height beside it, under the organizer's band (the layout places it in the
 * frame's desk grid). The band carries the event's name, logo and host, so the rail's identity block steps aside, and the
 * footer carries the credit, so its "Live on FieldLogicHQ" line does too. All of it is CSS keyed to the frame's marker
 * (TournamentSideRail.module.css). Every live page wears the frame since Stage 8 Part 3d; only the admin preview's
 * switch-off branch still draws the old dark rail (Part 4 deletes it).
 */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgHref, usePublicPathname } from '@/lib/use-public-pathname';
import { PanelsTopLeft } from 'lucide-react';
import { useOrgNav } from '@/components/OrgNavContext';
import type { PublicPageKey } from '@/lib/public-pages';
import { visibleTournamentTabs, type FrameTabContent } from '@/lib/tournament-page-tabs';
import DesktopMyTeamRailCard from '@/components/public/DesktopMyTeamRailCard';
import PublicAppOnly from '@/components/public/PublicAppOnly';
import styles from './TournamentSideRail.module.css';

type TournamentSideRailProps = {
  /** Link prefix for the rail. Omit on the public site (derived from route params);
   *  the preview passes its `/…/preview/{tournament}` base so links stay in-preview. */
  basePath?: string;
  logoUrl?: string | null;
  heading?: string | null;
  /** The live frame is light; only the preview's switch-off branch passes its own. */
  colorMode?: 'dark' | 'light' | null;
  hiddenPages: PublicPageKey[];
  /** The live layout's server answer; the preview has no Playoffs route, so it is ignored there. */
  hasBracket?: boolean;
  /** Both frame layouts pass their facts explicitly so the server's first paint agrees with the band/footer. */
  frameContent?: FrameTabContent;
};

export default function TournamentSideRail({
  basePath,
  logoUrl,
  heading,
  colorMode,
  hiddenPages,
  hasBracket = false,
  frameContent,
}: TournamentSideRailProps) {
  const pathname = usePublicPathname();
  const params = useParams();
  const ctx = useOrgNav();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const orgHref = useOrgHref(orgSlug);
  // `homeHref` and the tab paths stay in the club-named form (they are compared with the club-named pathname); what a link
  // SAYS is spelled for the address the visitor is on. The preview's basePath is not the club's public address: unchanged.
  const spell = (p: string) => (basePath ? p : orgHref(p.slice(orgSlug.length + 1)));

  // Public usage: links from the route params. Preview usage: an explicit basePath (and branding props) is passed.
  const homeHref = basePath ?? (orgSlug && tournamentSlug ? `/${orgSlug}/${tournamentSlug}` : null);
  if (!homeHref) return null;

  const resolvedLogo = logoUrl !== undefined ? logoUrl : ctx.logoUrl;
  const resolvedHeading = heading !== undefined ? heading : (ctx.tournamentName || ctx.orgName);
  // Preview has no Playoffs route; the live layout's bracket answer arrives from the server.
  const items = visibleTournamentTabs(hiddenPages, !basePath && hasBracket, frameContent);

  return (
    <aside
      className={styles.rail}
      data-color-mode={colorMode ?? 'light'}
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
      {/* The rail's contents ride the scroll under the frame (its column runs the page's height); `display: contents`
          otherwise, so today's rail is unchanged. */}
      <div className={styles.stick}>
      <div className={styles.railHeader}>
        {!basePath && ctx.orgName && ctx.orgName !== resolvedHeading && (
          ctx.orgHomeHref ? (
            <Link href={orgHref()} className={styles.railCrumb}>{ctx.orgName} ›</Link>
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
          href={spell(homeHref)}
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
              href={spell(href)}
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
      {!basePath && <PublicAppOnly><DesktopMyTeamRailCard /></PublicAppOnly>}
      <div className={styles.railFooter}>Live on FieldLogicHQ</div>
      </div>
    </aside>
  );
}
