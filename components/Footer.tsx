'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isCoachPortalShellPath } from '@/lib/coaches-portal-routes';
import { isConsumerShellPath, isWarmJourneyPath } from '@/lib/consumer-routes';
import GetAppQr from './shared/GetAppQr';
import styles from './Footer.module.css';

// Static top-level routes that live outside the org-slug space and should show the footer.
// (Consumer-shell routes like /discover are handled earlier via isConsumerShellPath.)
// /auth deliberately absent: focused sign-in/signup cards, no marketing chrome —
// the footer stack is what forced the mobile login page to scroll.
const STATIC_ROOTS = new Set([
  'pricing', 'coaches', 'blog', 'changelog',
  // The four persona marketing pages: without these the footer vanished there,
  // leaving /for-coaches a dead end in the installed app (no way back).
  'for-coaches', 'for-leagues', 'for-clubs', 'for-tournament-organizers',
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
      ['What’s New', '/changelog'],
    ],
  },
  {
    heading: 'Get started',
    links: [
      ['Start Free', '/auth/signup'],
      ['Coaches', '/coaches/start'],
      ['Sign In', '/auth/login'],
    ],
  },
] as const;

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
  const pathname = usePathname();
  const surface = resolveSurface(pathname);
  if (!surface) return null;

  const skin = surface === 'warm' ? styles.warm : '';
  // The footer yields its QR exactly where the page renders the same unit as content of its
  // own: the Account TAB's stacked page (phone/tablet) and the desktop shell's Get-the-app
  // section (Phase 2). EXACT matches only — a prefix would strip the QR from every other
  // /account/* section (that regression shipped once and was caught in /review).
  const isAccount = pathname === '/account' || pathname === '/account/get-the-app';

  return (
    <footer className={`${styles.footer} ${skin}`}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div className={styles.brandCol}>
            <div className={styles.wordmark}>
              <span className={styles.wordmarkA}>FIELD</span>
              <span className={styles.wordmarkB}>LOGIC</span>
              <span className={styles.wordmarkC}>HQ</span>
            </div>
            <p className={styles.blurb}>
              From first registration to final standings — built for the people running community sport.
            </p>
          </div>

          {FOOTER_GROUPS.map(group => {
            const links = group.links.filter(([, href]) => href !== pathname);
            if (links.length === 0) return null;
            return (
              <div key={group.heading} className={styles.linkCol}>
                <div className={`hud-label ${styles.colHead}`}>{group.heading}</div>
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

        <div className={styles.baseline}>
          <div className={styles.copyright}>
            &copy; {new Date().getFullYear()} FieldLogicHQ. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
