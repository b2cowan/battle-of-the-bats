'use client';
/* eslint-disable @next/next/no-img-element */
/**
 * components/public/TournamentBand.tsx — the organizer's colour band over every public tournament page (Public tournament
 * pages Stage 1, behind the preview switch — lib/public-frame.ts; plan PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §4, hub
 * "Stage 1 · The frame", ruled Asks 1, 2, 8, 16 and the app-bar direction §10a).
 *
 * Built from the club bar's own parts (ClubBar, OrgSectionTabs, ClubFrame.module.css), so a club and its tournament read
 * as one product: a 72 px band in the organizer's colour, the logo at 44 px (or initials — none on a plan without
 * tournament branding), the event's name in the title face over at most two lines, one line of dates and the state word
 * (plain text after the dates, no pill);
 * at the right Share, the visitor's own door ("Sign in", or Account), and the operator door (the Flip amendment, on the
 * bar's neutral tokens). Under it the white tab row with the accent rule, which pins on a phone while the band scrolls
 * away (the club bar's sticky rule, keyed to `.tabsSlot`).
 *
 * WHERE THE PAGE IS OPENED decides the visitor's door (§10a, direction accepted 2026-10-27): in a browser it is here, in
 * the band; inside the installed app the app's own bar carries it, so the band drops it. That is decided by CSS
 * (`display-mode: standalone`) as the page first draws — never by script after it, so nothing appears and then vanishes.
 *
 * AT A DESK (Part 2; hub "The end state", desk frame) the same band runs the page's full width over the white side rail,
 * and "Hosted by {club} ›" sits on its right before Sign in — only when the organizer's home is a real destination
 * (lib/public-frame.ts publicFrameHost, the layout's one answer). From 1,024 px the rail is the navigation, so the band's
 * tab row steps aside; the name appears once, here, and the old centred page title is gone.
 *
 * IN THE ORGANIZER'S ADMIN PREVIEW (`basePath`) the band is the same, with its links kept inside the preview, and none of
 * the visitor's doors: no Share (it would share the preview), no Sign in, no operator door (the preview's own Exit pill
 * is the way out).
 *
 * Identity resolves in the browser after the page loads, never on the server, so the page a service worker caches for an
 * anonymous visitor carries no one's doors (the anonymous-public invariant, as ClubBar).
 *
 * ON THE FOCUSED PAGE (Stage 7, lib/public-focused-page.ts — the team pay page) it is the slim band: 52 px over the accent
 * rule, the event's name on one line and nothing else (no mark, dates, tabs, Share, Sign in or operator door — Asks A3,
 * A4). The name is still the way to the Overview, styled as the name. Never in the preview, which has no focused page.
 */
import Link from 'next/link';
import { User } from 'lucide-react';
import { useOrgHref, usePublicPathname, useSignInHref } from '@/lib/use-public-pathname';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { isDemoOrgSlug } from '@/lib/demo-org';
import { isFocusedPublicPage } from '@/lib/public-focused-page';
import type { PublicPageKey } from '@/lib/public-pages';
import type { FrameTabContent } from '@/lib/tournament-page-tabs';
import type { PublicFrameHost } from '@/lib/public-frame';
import AccountMenu from '@/components/shared/AccountMenu';
import SharePageButton from './SharePageButton';
import TournamentFlipPill, { TournamentFlipDoor } from './TournamentFlipPill';
import { usePublicFlip } from '@/lib/use-public-flip';
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
  /** Who runs the event (lib/public-frame.ts publicFrameHost); the band shows it only as a door, at a desk. */
  host?: PublicFrameHost | null;
  /** The admin preview's `/…/preview/{tournament}` base: links stay in the preview, and the visitor's doors are absent. */
  basePath?: string;
  /** Public tournament pages Stage 6 (Ask 14): News/Rules/Register/Champions tab facts, forwarded to the tab row. */
  frameContent?: FrameTabContent;
  /** Next's `prefetch`, on the name and every tab. `false` only in the Look card's inert window, whose links would each
   *  prefetch a 404 (`/…/branding/schedule` and the like; Stage 8 call 4). Omitted wherever the links lead somewhere. */
  prefetch?: boolean;
}

export default function TournamentBand({
  orgSlug, tournamentSlug, name, logoUrl, initials, dates, status, hiddenPages, hasBracket, host, basePath, frameContent, prefetch,
}: TournamentBandProps) {
  const pathname = usePublicPathname() ?? '';
  const preview = !!basePath;
  const href = useOrgHref(orgSlug);
  const signInHref = useSignInHref();
  const homeHref = basePath ?? href(`/${tournamentSlug}`);
  // The demo is a closed world: every sign-in door is a door out of it (ConsumerNav's strip rule), so it shows none.
  const inSandbox = isDemoOrgSlug(orgSlug);
  const focused = !preview && isFocusedPublicPage(pathname, orgSlug, tournamentSlug);
  // The preview, and the focused page, show no visitor's door, so they ask nobody who they are.
  const signedIn = useClientSignedIn(!inSandbox && !preview && !focused);

  if (focused) {
    return (
      <header className={styles.focusBand} data-public-frame-focused-band="">
        <Link href={homeHref} className={styles.focusName}>{name}</Link>
      </header>
    );
  }

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
      <Link href={homeHref} prefetch={prefetch} className={clubStyles.identity}>
        {mark}
        <span className={clubStyles.name}>
          <span className={clubStyles.nameText}>{name}</span>
          {(dates || status) && (
            <span className={styles.meta}>
              {dates && <span className={styles.dates}>{dates}</span>}
              {dates && status && <span className={styles.sep} aria-hidden="true">·</span>}
              {status && (
                <span className={styles.chip} data-live={status.live ? '' : undefined}>{status.word}</span>
              )}
            </span>
          )}
        </span>
      </Link>

      <div className={clubStyles.actions}>
        {host?.kind === 'hosted' && (
          preview
            ? <span className={styles.hostLink}>Hosted by {host.name}</span>
            : <Link href={href()} className={styles.hostLink}>Hosted by {host.name} ›</Link>
        )}
        {!preview && <SharePageButton url={homeHref} title={name} text="Live on FieldLogicHQ" compact className={styles.icon} />}
        {!inSandbox && !preview ? (
          <BandDoors signedIn={signedIn} signInHref={signInHref(pathname)} />
        ) : !preview && (
          // The demo sandbox shows no account menu, so nothing carries the door for it: it keeps its own icon at every width.
          <span className={styles.bandDoor}>
            <TournamentFlipPill look="band" />
          </span>
        )}
      </div>

      <TournamentTopTabs
        hiddenPages={hiddenPages}
        hasBracket={hasBracket}
        basePath={basePath}
        frameContent={frameContent}
        prefetch={prefetch}
        className={`${clubStyles.tabsSlot} ${styles.tabs}`}
      />
    </header>
  );
}

/** The visitor's own door and the operator door, sharing ONE read of the viewer's hats. In a browser on a phone the account
 *  sheet carries the operator door as its "Go to" block, so the band's separate icon steps aside there (TournamentFrame
 *  `.bandDoorInSheet`); the installed app has no account menu in the band, so it keeps the icon. Mounted only where the
 *  account menu is (not in the demo sandbox, not in the preview), which is also the only time there is a hat-holder to show. */
function BandDoors({ signedIn, signInHref }: { signedIn: boolean; signInHref: string }) {
  const { resolution } = usePublicFlip();
  return (
    <>
      <span className={styles.browserOnly}>
        {signedIn ? (
          <AccountMenu className={clubStyles.word} wrapClassName={clubStyles.account} signOutTo="here" door={resolution}>
            <User className={clubStyles.wordIcon} strokeWidth={1.8} aria-hidden />
          </AccountMenu>
        ) : (
          <Link href={signInHref} className={clubStyles.word}>Sign in</Link>
        )}
      </span>
      <span className={`${styles.bandDoor} ${styles.bandDoorInSheet}`}>
        <TournamentFlipDoor resolution={resolution} look="band" />
      </span>
    </>
  );
}
