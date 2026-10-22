'use client';
/* eslint-disable @next/next/no-img-element */
/**
 * components/public/ClubBar.tsx — the club's own bar at the top of every club page (Club Tier Stage 4b-1; End state 1
 * and Asks 7 + 8 of the Stage 4 drawings, ruled 2026-10-19; the staff door, Ask S1, ruled 2026-10-20).
 *
 * The club's colour band, 72 px: its logo (or initials) at 44 px, its name and one-line tagline, and at the right the
 * visitor's own door — "Sign in", or "Account" once signed in (the person icon, 2026-10-20). Its tabs sit in the band beside the name at a desk and
 * in a white row under it on a phone. It replaces the platform's bar on these pages: no Discover, no Pricing, no crumb
 * at any width (a club's own pages advertise nothing — BUSINESS_DECISIONS 2026-10-19), and the platform's phone bar is
 * gone too (Ask 8), so Sign in lives here.
 *
 * THE STAFF DOOR (Ask S1, option A): a member of THIS club's staff gets one quiet door back to their side, OUTERMOST,
 * right of Account (the ratified door order: Account is about you, the door is about somewhere else) — a bare icon at
 * every width, like Account beside it (owner 2026-10-20; its destination is its accessible name and its hover tooltip). Staff of another club and every family see none: the everywhere-chooser
 * (Workspaces) that the old bar fell back to drew a door into Riverbend on Lakeshore's own page.
 *
 * Identity resolves in the browser after the page loads, never on the server, so the page a service worker caches for
 * an anonymous visitor carries no one's doors (the anonymous-public invariant).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { useRoleSummary } from '@/lib/use-role-summary';
import { resolveOrgReturnFlip } from '@/lib/flip-twins';
import { signInHrefFor } from '@/lib/consumer-routes';
import { activeOrgSectionKey, ORG_SECTION_TABS_MIN } from '@/lib/org-public-sections';
import { clubInitials } from '@/lib/club-site';
import { siteEdit } from '@/lib/site-edit-marks';
import { isDemoOrgSlug } from '@/lib/demo-org';
import FlipPill from '@/components/shared/FlipPill';
import AccountMenu from '@/components/shared/AccountMenu';
import OrgSectionTabs from './OrgSectionTabs';
import type { ClubFrameClub } from './ClubFrame';
import flipStyles from '@/components/shared/FlipPill.module.css';
import styles from './ClubFrame.module.css';

/** `preview` (the editor's preview of the home): Home lit, and the visitor's corner a signed-out family's — never the
 *  editing owner's own Account or staff door. */
export default function ClubBar({ club, preview = false }: { club: ClubFrameClub; preview?: boolean }) {
  const realPath = usePathname() ?? '';
  const pathname = preview ? `/${club.slug}` : realPath;
  const signedIn = useClientSignedIn(!preview) && !preview;
  const roles = useRoleSummary(signedIn);
  const door = preview ? null : resolveOrgReturnFlip(roles?.workspaces, club.slug);
  const showTabs = club.sections.length >= ORG_SECTION_TABS_MIN;

  return (
    // data-club-chrome: the club refusal steps this bar aside (components/public/ClubNotFound.module.css).
    <header className={styles.bar} data-club-bar="" data-club-chrome="" {...siteEdit('look')}>
      {/* The way home from any depth. Named "{club} home": the visible name is in it, so voice control still finds it. */}
      <Link href={`/${club.slug}`} className={styles.identity} aria-label={`${club.name} home`}>
        {club.logoUrl ? (
          <img src={club.logoUrl} alt="" className={styles.logo} />
        ) : (
          <span className={`${styles.logo} ${styles.initials}`} aria-hidden>{clubInitials(club.name)}</span>
        )}
        <span className={styles.name}>
          <span className={styles.nameText}>{club.name}</span>
          {club.tagline && <span className={styles.tagline} {...siteEdit('about')}>{club.tagline}</span>}
        </span>
      </Link>

      {showTabs && (
        <OrgSectionTabs
          sections={club.sections}
          orgSlug={club.slug}
          activeKey={activeOrgSectionKey(pathname, club.slug, club.sections)}
          className={styles.tabsSlot}
        />
      )}

      <div className={styles.actions}>
        {signedIn ? (
          // The shared demo account is never offered Sign out (the strips' rule), so a demo club shows no Account.
          !isDemoOrgSlug(club.slug) && (
            <AccountMenu className={styles.word} wrapClassName={styles.account} signOutTo="here">
              <User className={styles.wordIcon} strokeWidth={1.8} aria-hidden />
            </AccountMenu>
          )
        ) : (
          <Link href={signInHrefFor(pathname)} className={styles.word}>Sign in</Link>
        )}
        {door && <FlipPill resolution={door} variant="inline" compact className={flipStyles.clubLook} />}
      </div>
    </header>
  );
}
