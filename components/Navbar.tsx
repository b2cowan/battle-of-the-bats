'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePublicPathname } from '@/lib/use-public-pathname';
import { User } from 'lucide-react';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { cn } from '@/lib/utils';
import AccountMenu from '@/components/shared/AccountMenu';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';
import BrandLockup from '@/components/shared/BrandLockup';
import { DEMOS_PATH } from '@/lib/sandbox-door';
import styles from './Navbar.module.css';

// Live products lead (owner-ratified 2026-08-08): the two purchasable doors sit adjacent and
// first; the coming-soon pair follows. Re-order deliberately when one of them launches.
const MARKETING_NAV_LINKS = [
  { href: '/for-tournament-organizers', label: 'Tournaments' },
  { href: '/for-coaches',               label: 'Coaches'    },
  { href: '/for-leagues',               label: 'Leagues'    },
  { href: '/for-clubs',                 label: 'Clubs'      },
  { href: '/pricing',                   label: 'Pricing'    },
];

/* Which paths get the MARKETING bar rather than an org/tournament one. Read only after
   SiteChrome has already decided this Navbar mounts at all (its single mount site), so it
   never needs to re-state SiteChrome's suppression list: `/discover` and `/auth` were listed
   here for years and could not be reached — the consumer shell and the auth-page rule drop the
   Navbar before this function runs. Removed 2026-08-01 (top-nav audit §D11) so the next reader
   doesn't infer a marketing bar exists on those surfaces. `/coaches` stays: the shell only
   suppresses the portal paths, so `/coaches/join` genuinely lands here. */
function isMarketingPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/for-') ||
    pathname.startsWith('/coaches') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/changelog') ||
    pathname.startsWith(DEMOS_PATH) ||
    pathname.startsWith('/my')
  );
}

export default function Navbar() {
  const pathname = usePublicPathname();
  const [scrolled, setScrolled] = useState(false);

  // Hide on any /[orgSlug]/admin/* route (the early return stays after all hooks). Asked explicitly because
  // isMarketingPath's `/my` prefix also matches an org slug that starts with "my".
  const isAdmin = /^\/[^/]+\/admin(\/|$)/.test(pathname) || pathname.startsWith('/admin');

  // R4 / audit D4 — the marketing bar was AUTH-BLIND. The app strip links to /pricing from every
  // consumer surface, so a signed-in owner tapping it landed on a bar offering "Sign In" and
  // "Get Started" — reading as being signed out, on the product's highest-traffic seam crossing.
  // Resolved the same way the org branch resolves its own identity: a LOCAL cookie read after
  // hydration (no network, nothing SSR'd), so marketing pages stay static and role-free and an
  // anonymous visitor's page is byte-identical to before. Deliberately does NOT fetch the role
  // summary: the two doors below need only "is someone signed in", and marketing is the one
  // surface where a per-visit identity round-trip would be pure cost.
  //
  // Marketing ground is also where a "See it live" visit ENDS — the demo doors establish a real
  // session for a shared fictional account, which this check would otherwise read as a login and
  // answer with "Account" / "Open app →", offering a prospect two doors into somebody else's demo
  // and telling them they have an account they never made. That teardown is no longer this call's
  // to ask for: the hook now ends a demo session on ANY page outside the demo world, the same rule
  // the request layer applies before a page renders (lib/sandbox-exit.ts, owner ruling 2026-08-26).
  // A real customer's session is untouched either way.
  const onMarketing = isMarketingPath(pathname);
  const marketingSignedIn = useClientSignedIn(onMarketing);

  useEffect(() => {
    if (!onMarketing) return;
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [onMarketing]);

  /* ── Only the marketing pages get this bar ──
     A club's own pages (/{orgSlug}/* with no tournament in the URL) draw the club's bar (Club Tier Stage 4b-1, Asks 7 + 8,
     ruled 2026-10-19: components/public/ClubBar.tsx, mounted by the org layout's ClubFrame). A public tournament page draws
     the organizer's band and its own tab row (components/public/TournamentBand.tsx) — Public tournament pages Stage 8 Part
     3d deleted the platform's old tournament bar, its event header and its status pill. Operator shells never reach here
     (SiteChrome drops them). */
  if (isAdmin || !onMarketing) return null;

  /* ── Marketing nav (/, /pricing, /for-*, /changelog, /coaches/join…) ── */
  // The quiet door's ONE shell and face, worn by the Sign in link and the account menu's trigger
  // alike, so the two states can never drift apart.
  const quietCtaClass = `${styles.marketingQuiet} ${styles.marketingQuietCta}`;
  const quietCtaFace = (label: string) => (
    <>
      {/* Sized by prop, matching how the coach and admin strips render this same glyph. */}
      <User size={20} strokeWidth={1.8} className={styles.marketingCtaIcon} aria-hidden="true" />
      <span className={styles.marketingCtaLabel}>{label}</span>
    </>
  );
  return (
    <>
      {/* `top` lives in the module (.marketingNav), not in a `top-0` utility: the Founding Season
          offer bar publishes --offer-bar-h while it is mounted and this bar must sit beneath it
          (the rendered layout check caught every nav link hidden under the bar when the utility
          pinned it to 0 — /review 2026-09-07). */}
      {/* ⚖ ALWAYS WARM (The public face, warm: S4, owner Ask 5 B, 2026-10-23): the marketing set has no
          Dark version, so the phone's browser bar takes the paper too, whatever the setting, and
          `data-warm-base` paints <body> the paper under it (the bounce past either end of a page,
          app/globals.css). The bar is white with a hairline at every scroll position, as drawn. */}
      <CoachThemeColor fixed="warm" />
      <nav
        className={cn(styles.marketingNav, scrolled && styles.marketingNavScrolled)}
        data-warm-base="marketing"
      >
        <div className={`container ${styles.marketingInner}`}>
          {/* The one name (P9): the marketing bar is warm always. Its size steps down on a phone —
              see .marketingWordmark, which the lockup reads because no `size` is passed. */}
          <BrandLockup href="/" tone="warm" className={styles.marketingWordmark} />

          <div className={styles.marketingLinks}>
            {MARKETING_NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(styles.marketingLink, pathname.startsWith(href) && styles.marketingLinkOn)}
                aria-current={pathname.startsWith(href) ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* The right cluster carried a second, unreachable "Portal / Upgrade" variant keyed on
              `/coaches/tournaments` — a path SiteChrome suppresses (the coach portal shell owns
              its own chrome), so it could never render. Removed 2026-08-01 (top-nav audit §D11).

              R4: two states now, not one. Signed out is exactly what it always was. Signed in
              swaps the pair for the doors that make sense to someone who already has an
              account: their Account, and the way back into the app. "Open app →" goes to
              /discover — the app's own Home and the one aggregator of every workspace they
              hold — by the Zone-1 rule, so no role lookup is needed to name it. */}
          {/* ONE pair of shells, two sets of destinations — so the quiet-link and lime-CTA
              styling each live in exactly one place and can't drift between the two states. */}
          {/* §68 (owner call 2026-08-21): the QUIET door sheds its words on the narrowest phones,
              the LIME one never does. The row could not shrink at all before — 386px of
              unshrinkable content on every screen — so "Get Started" ran off the right edge
              below 390px with no sideways scroll to reach it. Which of the three pieces gives
              way was the real decision, and it was made on evidence: six of the nine marketing
              pages carry no sign-up link above the fold at all (on /for-coaches the first one is
              ~8 screens down), so on most of this site the lime pill is the ONLY reachable door
              to signing up. It keeps its full label at every width. Sign In is the second job on
              a marketing page — the visitor usually isn't a customer yet — so that is the one
              that becomes an icon ≤375px.

              `aria-label` is unconditional rather than tied to the breakpoint: CSS decides which
              of the two children is painted, and a name that depended on a media query would be
              a name that can go missing. The visible label and the accessible name are the same
              string either way.

              Signed in, the quiet pill is the shared account MENU's trigger (owner ask
              2026-10-16 — the account door opens in place everywhere it exists), wearing the
              identical shell and face; signing out from it stays on this page. */}
          <div className={styles.marketingActions}>
            {marketingSignedIn ? (
              <AccountMenu className={quietCtaClass} signOutTo="here" warm>
                {quietCtaFace('Account')}
              </AccountMenu>
            ) : (
              <Link href="/auth/login" aria-label="Sign in" className={quietCtaClass}>
                {quietCtaFace('Sign in')}
              </Link>
            )}
            {/* Ask 14 (one lime per view): every marketing page carries its own lime door, and this
                bar is in every view, so its door is the white secondary. */}
            <Link href={marketingSignedIn ? '/discover' : '/start'} className={styles.marketingCta}>
              {marketingSignedIn ? 'Open app' : 'Get started'}
            </Link>
          </div>
        </div>
      </nav>

      <nav className={styles.bottomNav} aria-label="Main navigation">
        {MARKETING_NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.bottomNavLink} ${pathname.startsWith(href) ? styles.bottomNavActive : ''}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
