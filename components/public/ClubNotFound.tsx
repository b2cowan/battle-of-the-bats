'use client';

import Link from 'next/link';
import { useOrgHref, usePublicPathname } from '@/lib/use-public-pathname';
import { clubNotFoundFace } from '@/lib/club-not-found-face';
import { usePublicClub } from './PublicClubContext';
import RootNotFound from '@/app/not-found';
import warm from '@/components/consumer/warmTheme.module.css';
import system from '@/app/system-screens.module.css';
import styles from './ClubNotFound.module.css';
import kit from './ClubKit.module.css';
import parts from './PublicParts.module.css';
import PublicPage from './PublicPage';

/**
 * A club's "not found" (Club Tier Stage 4a; Ask 5 ruled 2026-10-19; words through /marketing 2026-10-20).
 *
 * Two faces, chosen by `clubNotFoundFace` from the address and the club's site state:
 *   · THE REFUSAL — a club page of a club whose site is off or that was cancelled. Neutral, the same words on every
 *     page, never saying which reason (a family has no use for "cancelled" versus "offline"); the club's name once, so
 *     they know they reached the right place. Drawn WITHOUT the club's bar or footer (the club's frame is not drawn for
 *     a closed site — Stage 4b-1), on the platform's system-screen ground (owner 2026-10-20, on a screenshot of the
 *     refusal inside the club's bar).
 *   · NOT FOUND INSIDE THE CLUB — a live club's page that does not exist. It stays in the club's site (the club's frame —
 *     its bar and footer, Stage 4b-1) with a way home, on the club page column like every club page (club round Part 4:
 *     on the logo edge, never centred; its name at 24, C4; the buttons full width on a phone, their own width at a desk).
 * Any other address under the org (a tournament, the signed-in tools) gets the platform's page, as it always had —
 * imported here rather than handed down as a server element, which would ride in every org page's payload.
 * Each face is a <div>: the root layout already owns the page's <main>.
 */
export default function ClubNotFound() {
  const pathname = usePublicPathname() ?? '';
  const club = usePublicClub();
  const href = useOrgHref(club?.slug);
  const face = clubNotFoundFace(pathname, club);

  if (face.face === 'platform' || !club) return <RootNotFound />;

  if (face.face === 'refusal') {
    return (
      <div className={`${warm.warmVars} ${system.page} bg-pitch-black ${styles.refusal}`}>
        <div className={styles.body}>
          <p className={styles.club}>{club.name}</p>
          <h1 className={styles.title}>This club’s site isn’t available</h1>
          <p className={styles.text}>{club.name} has turned off its public site here, or no longer uses it.</p>
          <p className={styles.text}>If a coach or the club sent you this link, ask them for an up-to-date one.</p>
          <Link href="/discover" className={styles.quiet}>Find a club or event</Link>
        </div>
      </div>
    );
  }

  const text =
    face.variant === 'league' ? `${club.name} doesn’t run a house league on this site.`
    : face.variant === 'teams' ? 'The link may be old, or the team may have a new name.'
    : 'The link may be old, or the page may have moved.';

  // An unknown team's address offers the Teams page first, when the club has one (Stage 4b-2a, End state 5): the family
  // was looking for a team, and the list is where they find its new name.
  const seeTeams = face.variant === 'teams' && club.teamsPage;

  return (
    <PublicPage frame="club">
      <div className={kit.nameBlock}>
        <h1 className={kit.pageName}>We couldn’t find that page</h1>
        <p className={`${kit.body} ${parts.prose}`} style={{ margin: 0 }}>{text}</p>
      </div>
      <div className={kit.btnRow}>
        {seeTeams && <Link href={href('/teams')} className={`${kit.btn} ${kit.btnPrimary} ${kit.btnPhoneFull}`}>See all teams</Link>}
        <Link href={href()} className={`${kit.btn} ${kit.btnSecondary} ${kit.btnPhoneFull}`}>{club.name} home</Link>
      </div>
    </PublicPage>
  );
}
