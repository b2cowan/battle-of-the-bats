'use client';
import Link from 'next/link';
import { usePublicPathname } from '@/lib/use-public-pathname';
import { isCoachPortalShellPath } from '@/lib/coaches-portal-routes';
import { isConsumerShellPath, isWarmJourneyPath } from '@/lib/consumer-routes';
import { DEMOS_PATH, sandboxDoorsVisible } from '@/lib/sandbox-door';
import GetAppQr from './shared/GetAppQr';
import styles from './Footer.module.css';
import BrandLockup from '@/components/shared/BrandLockup';
import { useLegalLinks } from '@/components/legal/LegalLinksProvider';
import { DATA_TERMS_LINK, PRIVACY_TITLE, SUBPROCESSORS_LINK, TERMS_TITLE } from '@/lib/legal-words';
import { useClientSignedIn } from '@/lib/use-client-signed-in';

// Static top-level routes that live outside the org-slug space and should show the footer.
// (Consumer-shell routes like /discover are handled earlier via isConsumerShellPath.)
// /auth deliberately absent: focused sign-in/signup cards, no marketing chrome —
// the footer stack is what forced the mobile login page to scroll.
const STATIC_ROOTS = new Set([
  'pricing', 'coaches', 'blog', 'changelog',
  // The four persona marketing pages: without these the footer vanished there,
  // leaving /for-coaches a dead end in the installed app (no way back).
  'for-coaches', 'for-leagues', 'for-clubs', 'for-tournament-organizers',
  // The demo chooser — a shared outbound link, so it is the one page a stranger is most
  // likely to arrive on cold, and the least able to afford having no way onward.
  'demos',
  // The legal pages (GST/HST Stage 6.2): marketing ground, "not found" while they are off.
  'legal',
]);

// Footer link columns. Each group renders as a labelled column; the link for the
// page you're currently on is filtered out, and a column with no remaining links
// hides its heading.
const FOOTER_GROUPS = [
  {
    heading: 'Product',
    links: [
      ['Discover', '/discover'],
      ['Pricing', '/pricing'],
      // Filtered out below on two conditions (see `showDemosLink`): when the doors are closed,
      // and on the warm/in-app surface. A link to a page of doors nobody is meant to find yet is
      // the same mistake as advertising the doors themselves — and offering a DEMO to somebody
      // already signed in and using the product is the "marketing layout only" rule (binding,
      // design_decisions 2026-08-10 rule 1) being broken by a shared component's reach.
      ['Live demos', DEMOS_PATH],
      ['What’s new', '/changelog'],
    ],
  },
  // W63 (ruled 2026-11-18, Ask 25): the four persona pages. Before this nothing in the footer reached the Leagues or
  // Clubs pages. Same in both states; the nav ORDER changes at the flip (S3), not here.
  {
    heading: 'Built for',
    links: [
      ['Tournament organizers', '/for-tournament-organizers'],
      ['House leagues', '/for-leagues'],
      ['Clubs', '/for-clubs'],
      ['Coaches', '/for-coaches'],
    ],
  },
] as const;

type FooterLink = readonly [label: string, href: string];

/**
 * The account column (owner 2026-11-19). It holds ONE door to the chooser, never a door per product.
 *
 * It used to carry "Start free" → the tournament sign-up and "Coaches Portal" → the Premium sign-up: the same words
 * as the homepage's button leading somewhere else, two of four products with nothing saying why those two, and a
 * coach link that skipped the one coach rule (`lib/start-menu.ts`). The chooser (/start) already knows what is on sale and where each door leads;
 * this component is pathname-only and cannot. ⚠ Do not add a sign-up door here: a new product earns a card on the
 * chooser, and "Built for" beside this column already answers "is this for me?".
 *
 * "Get started", not "Start free": the top bar's words for the same door, and the chooser may hold a paid door one
 * day (W43, ruled 2026-11-18 — no "start free" over paid doors).
 *
 * Signed in, the column stops offering a sign-in and a sign-up to somebody who has both — the pair the top bar
 * already swaps for. "Open app" is offered on marketing ground only: on the app's own tabs you are already in it.
 */
const ACCOUNT_HEADING = 'Account';
const SIGNED_OUT_LINKS: readonly FooterLink[] = [
  ['Get started', '/start'],
  ['Sign in', '/auth/login'],
];
const OPEN_APP_LINK: FooterLink = ['Open app', '/discover'];
const YOUR_ACCOUNT_LINK: FooterLink = ['Your account', '/account'];

/**
 * Which ground the footer is landing on. `null` = don't render at all.
 *
 * NOTE on org/tournament space: those pages deliberately do NOT get this footer. A column
 * footer carrying our wordmark and a "Start Free" link is the loudest thing we could put on a
 * paid org's public page, and it directly contradicts the ratified constraint that the paid
 * presence be SUBTLE — text-only, no CTA block (BUSINESS_DECISIONS 2026-07-30). The approved
 * mockup shows the same thing: a slim credit line, not a column footer. Their footer region is
 * owned by <BuiltOnCredit>, which is rendered where the org's PLAN is known (this component is
 * a pathname-only client component and cannot tell a paid org from a free one — and free events
 * must keep their existing badge + banner untouched, with no second credit stacked on top).
 */
function resolveSurface(pathname: string): 'marketing' | 'warm' | null {
  const firstSegment = pathname.split('/')[1] ?? '';

  // Always hide on admin shells, platform-admin, the /home context-switcher and the
  // authenticated coach-portal routes — they render their own chrome.
  if (
    /^\/[^/]+\/admin(\/|$)/.test(pathname) ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/platform-admin') ||
    pathname.startsWith('/home') ||
    isCoachPortalShellPath(pathname) ||
    // The warm sign-up journey renders its own warm nav — no marketing footer.
    isWarmJourneyPath(pathname)
  ) return null;

  // Chat is a bounded viewport-height pane with a pinned composer — position:fixed on phones,
  // and since the Phase 2 split pane, an explicit 100dvh-minus-topbar shell on desktop too. A
  // footer below a non-scrolling pane is unreachable, so this one consumer tab opts out — the
  // only surface in the app with no path onward, which is the acceptable trade for not breaking
  // the one screen people type in. (Owner-affirmed at the Phase 2 mockup sign-off.)
  if (pathname === '/chat' || pathname.startsWith('/chat/')) return null;

  // /auth is inside CONSUMER_SHELL_PREFIXES (it follows the account theme like the tabs do), but
  // it must NOT inherit the tabs' footer: these are focused sign-in/sign-up cards, and the footer
  // stack is the exact thing that once forced the mobile login page to scroll. It would also
  // render a "Sign In" link on the sign-in page and "Start Free" on the signup page. Checked
  // BEFORE isConsumerShellPath, which would otherwise sweep it in.
  if (pathname === '/auth' || pathname.startsWith('/auth/')) return null;

  // The consumer app tabs: same footer, warm ground.
  if (isConsumerShellPath(pathname)) return 'warm';

  if (!firstSegment) return 'marketing';
  if (STATIC_ROOTS.has(firstSegment)) return 'marketing';

  // Everything left is `/{orgSlug}/...` (or a standalone utility route) — see the note above.
  return null;
}

export default function Footer() {
  const pathname = usePublicPathname();
  const legal = useLegalLinks();
  const surface = resolveSurface(pathname);
  // The shared sign-in read (a local cookie read; inert where the footer does not render). Starts signed-out, like
  // the top bar, so the server's HTML is the stranger's footer and nobody's identity is baked into a cached page.
  const signedIn = useClientSignedIn(surface !== null);
  if (!surface) return null;

  const skin = surface === 'warm' ? styles.warm : '';
  const accountLinks: readonly FooterLink[] = !signedIn
    ? SIGNED_OUT_LINKS
    : surface === 'marketing' ? [OPEN_APP_LINK, YOUR_ACCOUNT_LINK] : [YOUR_ACCOUNT_LINK];
  const groups: readonly { heading: string; links: readonly FooterLink[] }[] = [
    ...FOOTER_GROUPS,
    { heading: ACCOUNT_HEADING, links: accountLinks },
  ];
  // The footer yields its QR exactly where the page renders the same unit as content of its
  // own: the Account TAB's stacked page (phone/tablet) and the desktop shell's Get-the-app
  // section (Phase 2). EXACT matches only — a prefix would strip the QR from every other
  // /account/* section (that regression shipped once and was caught in /review).
  const isAccount = pathname === '/account' || pathname === '/account/get-the-app';
  const showDemosLink = surface === 'marketing' && sandboxDoorsVisible();

  return (
    <footer className={`${styles.footer} ${skin}`}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div className={styles.brandCol}>
            {/* The one name (P9), as text: the footer's links are below it. Warm always on marketing; the consumer
                app's footer follows the account's setting. */}
            <BrandLockup href={null} tone={surface === 'warm' ? 'follow' : 'warm'} size={17} className={styles.wordmark} />
            <p className={styles.blurb}>
              From first registration to final standings — built for the people running community sport.
            </p>
          </div>

          {groups.map(group => {
            const links = group.links.filter(
              ([, href]) => href !== pathname && (href !== DEMOS_PATH || showDemosLink),
            );
            if (links.length === 0) return null;
            return (
              <div key={group.heading} className={styles.linkCol}>
                <div className={styles.colHead}>{group.heading}</div>
                <ul className={styles.links}>
                  {links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className={styles.link}>{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* WI-11 — the first time the mobile app is discoverable from a desktop. A QR, not a
              prompt: nothing about install-prompt suppression changes, this is just a way to
              find the thing. Skipped on Account, which mounts the same unit as a settings card —
              without this the one screen that has both would say it twice. */}
          {!isAccount && (
            <div className={styles.qrCol}>
              <div className={styles.qrBlock}><GetAppQr /></div>
            </div>
          )}
        </div>

        <div className={`${styles.baseline} ${legal ? styles.baselineRow : ''}`}>
          <div className={styles.copyright}>
            &copy; {new Date().getFullYear()} FieldLogicHQ. All rights reserved.
          </div>
          {/* Rendered only while the legal pages are on (the provider hands null otherwise). The Data Terms and the list
              (Board Ready 0a-5) each appear only once their page has a published text; the sign-in doors never show them. */}
          {legal && (
            <div className={styles.legal}>
              <a href={legal.termsHref} className={styles.legalLink}>{TERMS_TITLE}</a>
              <a href={legal.privacyHref} className={styles.legalLink}>{PRIVACY_TITLE}</a>
              {legal.dataTermsHref && <a href={legal.dataTermsHref} className={styles.legalLink}>{DATA_TERMS_LINK}</a>}
              {legal.subprocessorsHref && <a href={legal.subprocessorsHref} className={styles.legalLink}>{SUBPROCESSORS_LINK}</a>}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
