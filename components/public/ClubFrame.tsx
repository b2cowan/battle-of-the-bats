'use client';
/**
 * components/public/ClubFrame.tsx — the club's site around every club page (Club Tier Stage 4b-1; Asks 1, 7, 8, 13 of
 * the Stage 4 drawings, https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k, ruled 2026-10-19).
 *
 * A family who opens any of a club's own pages — home, a team, a tryout and its sign-up, the house league, past
 * tournaments, the in-club "not found" — sees the CLUB'S site: a light ground in the club's colours, the club's bar at
 * the top, the same footer at the bottom, the club's type. Club pages stay light whatever the visitor's theme (TH-1:
 * public pages never follow the account theme).
 *
 * WHY ONE WRAPPER HERE, mounted by the org layout, rather than a shared shell each page renders in: the org layout is
 * the one place that already holds the club (its colours, name, sections) and wraps every club page, so no page can
 * forget its frame. But that layout also wraps tournament pages, the admin and the coaches portal, and a server layout
 * has no pathname — so the decision of WHICH pages wear the frame is made here, in the browser-and-server component
 * that can read the address, by the same rule the club's "not found" faces use (`wearsClubFrame`, beside them in
 * lib/club-not-found-face.ts). usePathname renders on the server too, so the frame is in the first paint.
 *
 * Not on a club whose site is closed: every club page there is the 4a refusal, which wears no club bar (owner
 * 2026-10-20). Not on a tournament page ("the venue" keeps its own look and the platform's bars, Ask 8's carve-out).
 */
import { usePathname } from 'next/navigation';
import { wearsClubFrame } from '@/lib/club-not-found-face';
import type { OrgSection } from '@/lib/org-public-sections';
import type { ClubSocialKind } from '@/lib/club-site';
import ClubBar from './ClubBar';
import ClubFooter from './ClubFooter';
import ClubNoticeBanner, { type ClubFrameNotice } from './ClubNoticeBanner';
import { usePublicClub } from './PublicClubContext';
import styles from './ClubFrame.module.css';

/** What the frame needs of the club — server data, no identity (safe in the anonymous page a service worker caches). */
export interface ClubFrameClub {
  slug: string;
  name: string;
  logoUrl: string | null;
  tagline: string | null;
  sections: OrgSection[];
  contactEmail: string | null;
  socials: { kind: ClubSocialKind; href: string }[];
  /** The quiet "Built on FieldLogicHQ" credit: paid plans only (BUSINESS_DECISIONS 2026-07-30). */
  showCredit: boolean;
  /** The club's chosen font, as the frame's faces: the warm pair by default, DM Serif with DM Sans, or Inter alone. */
  face: 'warm' | 'dm-serif' | 'inter';
  /** The club's live notice (Stage 4c-1), already said in the club's zone; null when none is showing. */
  notice: ClubFrameNotice | null;
  /** The About page, when it has contacts, documents or questions: the footer's "Contacts and documents" door. */
  aboutHref: string | null;
}

/**
 * `preview` — the editor's preview (Public site builder, ruled 2026-10-21): the frame drawn at an admin address, for the
 * club's own owner and admins, whatever the switch says (A2). Its bar is the one a signed-out family sees.
 */
export default function ClubFrame({ club, preview = false, children }: { club: ClubFrameClub; preview?: boolean; children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  // The club's slug and whether its site is open come from the one provider the "not found" faces read too.
  const wears = wearsClubFrame(pathname, usePublicClub());
  // The preview is deliberately OUTSIDE `wearsClubFrame`: it is the one place the frame is drawn at an admin address, and
  // for a club whose site is closed (the editor shows its owner and admins the site they are making).
  if (!preview && !wears) return <>{children}</>;

  return (
    <div className={styles.site} data-club-site="" data-club-face={club.face}>
      {/* The page's own "Skip to content" (WCAG 2.4.1): the root one lands at the top of <main>, which on a club page is
          the club's bar — so it steps aside (ClubFrame.module.css) and this one skips the bar. */}
      <a href="#club-content" className="skip-link">Skip to content</a>
      <ClubBar club={club} preview={preview} />
      <div id="club-content" tabIndex={-1} className={styles.page}>
        {club.notice && <ClubNoticeBanner notice={club.notice} />}
        {children}
      </div>
      <ClubFooter club={club} />
    </div>
  );
}
