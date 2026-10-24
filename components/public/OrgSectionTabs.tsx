'use client';
/**
 * components/public/OrgSectionTabs.tsx — a club's section tabs (Nav Unification Stage F; in the club's own bar since
 * Club Tier Stage 4b-1, End state 1 of the Stage 4 drawings).
 *
 * A club's public site reads as ONE place: Home · House league · Past tournaments, so a visitor moves between
 * sections instead of reversing out through the home each time. Rendered by the club's bar (ClubBar), which decides
 * where it sits: a white row under the bar on a phone, beside the club's name inside the bar at a desk. The bar has
 * already applied the "two or more sections" floor (ORG_SECTION_TABS_MIN) — a row holding only Home says nothing.
 *
 * Where no tab is current (a team page, a tryout, a shortcut address) none reads as current: the visitor is inside the
 * club but inside none of these sections, and the page's own title says where they are.
 */
import Link from 'next/link';
import { useOrgHref } from '@/lib/use-public-pathname';
import type { OrgSection } from '@/lib/org-public-sections';
import styles from './OrgSectionTabs.module.css';

export default function OrgSectionTabs({ sections, orgSlug, activeKey, className }: {
  sections: OrgSection[];
  orgSlug: string;
  /** The current section's key ('' = home), or null on a page that is in none of them. */
  activeKey: string | null;
  className?: string;
}) {
  const href = useOrgHref(orgSlug);
  return (
    // data-club-chrome: the club refusal steps this row aside (components/public/ClubNotFound.module.css).
    <nav className={`${styles.tabs} ${className ?? ''}`} aria-label="Sections" data-club-chrome="">
      {sections.map(({ key, label }) => {
        const active = activeKey === key;
        return (
          <Link
            key={key || 'home'}
            href={key ? href(`/${key}`) : href()}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
