'use client';
/* eslint-disable @next/next/no-img-element */
/**
 * components/public/TournamentBand.tsx — the organizer's colour band over every public tournament page (Public tournament
 * pages Stage 1, behind the preview switch — lib/public-frame.ts; plan PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §4, hub
 * "Stage 1 · The frame", ruled Asks 1, 2, 8, 16 and the app-bar direction §10a).
 *
 * Built from the club bar's own parts (ClubBar, OrgSectionTabs, ClubFrame.module.css), so a club and its tournament read
 * as one product: a 72 px band in the organizer's colour, the logo at 44 px (or initials — none on a plan without
 * tournament branding), the event's name in the title face over at most two lines, one line of dates and the state chip;
 * at the right Share, the visitor's own door ("Sign in", or Account), and the operator door (the Flip amendment, on the
 * bar's neutral tokens). Under it the white tab row with the accent rule, which pins on a phone while the band scrolls
 * away (the club bar's sticky rule, keyed to `.tabsSlot`).
 *
 * WHERE THE PAGE IS OPENED decides the visitor's door (§10a, direction accepted 2026-10-27): in a browser it is here, in
 * the band; inside the installed app the app's own bar carries it, so the band drops it. That is decided by CSS
 * (`display-mode: standalone`) as the page first draws — never by script after it, so nothing appears and then vanishes.
 *
 * Identity resolves in the browser after the page loads, never on the server, so the page a service worker caches for an
 * anonymous visitor carries no one's doors (the anonymous-public invariant, as ClubBar).
 */
import Link from 'next/link';
import { User } from 'lucide-react';
import { useOrgHref, usePublicPathname, useSignInHref } from '@/lib/use-public-pathname';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { isDemoOrgSlug } from '@/lib/demo-org';
import type { PublicPageKey } from '@/lib/public-pages';
import AccountMenu from '@/components/shared/AccountMenu';
import SharePageButton from './SharePageButton';
import TournamentFlipPill from './TournamentFlipPill';
import TournamentTopTabs from './TournamentTopTabs';
import clubStyles from './ClubFrame.module.css';
import styles from './TournamentFrame.module.css';

export interface TournamentBandProps {
  orgSlug: string;
  tournamentSlug: string;
  name: string;
  /** The event's logo (today's rule: the tournament's, else the organizer's). Null on a plan without tournament branding. */
  logoUrl: string | null;
  /** Initials for the tile when there is no logo; null when the plan allows no mark at all. */
  initials: string | null;
  dates: string | null;
  /** One of the four state words (lib/club-site-home.ts TOURNAMENT_STATUS_WORD), or null when none applies. */
  status: { word: string; live: boolean } | null;
  hiddenPages: PublicPageKey[];
  hasBracket: boolean;
}

export default function TournamentBand({
  orgSlug, tournamentSlug, name, logoUrl, initials, dates, status, hiddenPages, hasBracket,
}: TournamentBandProps) {
  const pathname = usePublicPathname() ?? '';
  const href = useOrgHref(orgSlug);
  const signInHref = useSignInHref();
  const homeHref = href(`/${tournamentSlug}`);
  // The demo is a closed world: every sign-in door is a door out of it (ConsumerNav's strip rule), so it shows none.
  const inSandbox = isDemoOrgSlug(orgSlug);
  const signedIn = useClientSignedIn(!inSandbox);

  const mark = logoUrl
    ? <img src={logoUrl} alt="" className={clubStyles.logo} />
    : initials
      ? <span className={`${clubStyles.logo} ${clubStyles.initials}`}>{initials}</span>
      : null;

  return (
    <header className={clubStyles.bar} data-public-frame-band="">
      {/* The way to the Overview from any page: the whole identity is one link, the band's full height (the club bar's
          shape). Its text is the full name — two lines on screen, then an ellipsis, all of it read aloud — then the dates
          and the state word. */}
      <Link href={homeHref} className={clubStyles.identity}>
        {mark}
        <span className={clubStyles.name}>
          <span className={clubStyles.nameText}>{name}</span>
          {(dates || status) && (
            <span className={styles.meta}>
              {dates && <span className={styles.dates}>{dates}</span>}
              {status && (
                <span className={styles.chip} data-live={status.live ? '' : undefined}>{status.word}</span>
              )}
            </span>
          )}
        </span>
      </Link>

      <div className={clubStyles.actions}>
        <SharePageButton url={homeHref} title={name} text="Live on FieldLogicHQ" compact className={styles.icon} />
        {!inSandbox && (
          <span className={styles.browserOnly}>
            {signedIn ? (
              <AccountMenu className={clubStyles.word} wrapClassName={clubStyles.account} signOutTo="here">
                <User className={clubStyles.wordIcon} strokeWidth={1.8} aria-hidden />
              </AccountMenu>
            ) : (
              <Link href={signInHref(pathname)} className={clubStyles.word}>Sign in</Link>
            )}
          </span>
        )}
        <TournamentFlipPill look="band" />
      </div>

      <TournamentTopTabs
        skin="frame"
        hiddenPages={hiddenPages}
        hasBracket={hasBracket}
        className={`${clubStyles.tabsSlot} ${styles.tabs}`}
      />
    </header>
  );
}
