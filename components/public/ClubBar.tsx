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
 * MY TEAM (2026-10-26, drawing CLUB_SITE_MY_TEAM_DRAWING.html): a signed-in house-league coach of THIS club gets a
 * "My team" link left of Account at a desk, drawn like a tab (it is a place on this site, the tabs' kind of thing), and lit
 * on that team's page, where House league goes unlit so one item says where they are. Two or more teams draw NO link here
 * (owner 2026-10-29: a dropdown there saved no click over the account menu, and the team page has its own chips); they
 * find their teams in the account menu. On a phone the band has no room for a word, so the same teams are the account
 * menu's first rows. It replaces the staff door for a coach, which drew a globe labelled "Public site" that ping-ponged
 * between Home and the team.
 *
 * Identity resolves in the browser after the page loads, never on the server, so the page a service worker caches for
 * an anonymous visitor carries no one's doors (the anonymous-public invariant).
 */
import Link from 'next/link';
import { useOrgHref, usePublicPathname, useSignInHref } from '@/lib/use-public-pathname';
import { Shirt, User } from 'lucide-react';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { useRoleSummary } from '@/lib/use-role-summary';
import { resolveOrgReturnFlip } from '@/lib/flip-twins';
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
  const realPath = usePublicPathname() ?? '';
  const href = useOrgHref(club.slug);
  const signInHref = useSignInHref();
  const pathname = preview ? `/${club.slug}` : realPath;
  const signedIn = useClientSignedIn(!preview) && !preview;
  const roles = useRoleSummary(signedIn);
  const door = preview ? null : resolveOrgReturnFlip(roles?.workspaces, club.slug);
  const showTabs = club.sections.length >= ORG_SECTION_TABS_MIN;
  // The teams this person coaches at THIS club, addressed through the club's own links; `current` is the one being viewed.
  const myTeams = (roles?.leagueTeams ?? []).filter(t => t.orgSlug === club.slug)
    .map(t => ({ teamName: t.teamName, href: href(t.href.slice(club.slug.length + 1)), current: pathname === t.href }));
  const onMyTeam = myTeams.some(t => t.current);

  return (
    // data-club-chrome: the club refusal steps this bar aside (components/public/ClubNotFound.module.css).
    <header className={styles.bar} data-club-bar="" data-club-chrome="" {...siteEdit('look')}>
      {/* The way home from any depth. Named "{club} home": the visible name is in it, so voice control still finds it. */}
      <Link href={href()} className={styles.identity} aria-label={`${club.name} home`}>
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
          activeKey={onMyTeam ? null : activeOrgSectionKey(pathname, club.slug, club.sections)}
          className={styles.tabsSlot}
        />
      )}

      <div className={styles.actions}>
        {signedIn && myTeams.length === 1 && <MyTeamDoor team={myTeams[0]} />}
        {signedIn ? (
          // The shared demo account is never offered Sign out (the strips' rule), so a demo club shows no Account.
          !isDemoOrgSlug(club.slug) && (
            <AccountMenu className={styles.word} wrapClassName={styles.account} signOutTo="here" teams={myTeams}>
              <User className={styles.wordIcon} strokeWidth={1.8} aria-hidden />
            </AccountMenu>
          )
        ) : (
          // On a club's own address sign-in lives on FieldLogicHQ (host-only cookies), and returns the visitor to this same page there.
          // pathname is the club-named path, which is exactly the page's address on fieldlogichq.ca.
          <Link href={signInHref(pathname)} className={styles.word}>Sign in</Link>
        )}
        {door && <FlipPill resolution={door} variant="inline" compact className={flipStyles.clubLook} />}
      </div>
    </header>
  );
}

type MyTeam = { teamName: string; href: string; current: boolean };

/** The desk's "My team" link, for a coach of exactly one team. Hidden on a phone, where the account menu carries the
 *  same row. */
function MyTeamDoor({ team }: { team: MyTeam }) {
  return (
    <Link href={team.href} className={`${styles.mine} ${team.current ? styles.mineOn : ''}`} aria-current={team.current ? 'page' : undefined}>
      <Shirt className={styles.mineIcon} strokeWidth={1.8} aria-hidden />
      My team
    </Link>
  );
}
