'use client';
/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgHref, usePublicPathname } from '@/lib/use-public-pathname';
import { User } from 'lucide-react';
import { useOrgNav } from './OrgNavContext';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { cn } from '@/lib/utils';
import { phaseOf, fmtRange, daysUntil } from '@/lib/tournament-phase-display';
import { tournamentToday } from '@/lib/timezone';
import TournamentNavStatus from '@/components/public/TournamentNavStatus';
import TournamentFlipPill from '@/components/public/TournamentFlipPill';
import AccountMenu from '@/components/shared/AccountMenu';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';
import BrandLockup from '@/components/shared/BrandLockup';
import { DEMOS_PATH } from '@/lib/sandbox-door';
import TournamentTopTabs from '@/components/public/TournamentTopTabs';
import { visibleTournamentTabs } from '@/lib/tournament-page-tabs';
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
  const params   = useParams();
  const orgSlug           = (params?.orgSlug as string) || '';
  const urlTournamentSlug = params?.tournamentSlug as string | undefined;
  const orgHref           = useOrgHref(orgSlug);
  const { logoUrl, orgName, orgHomeHref, tournamentSlug, tournamentName, tournamentFinished, tournamentColorMode, tournamentHiddenPages, tournamentHasBracket, tournamentStartDate, tournamentEndDate, tournamentStatus, tournamentRegisterCta } = useOrgNav();
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  // Hide on any /[orgSlug]/admin/* route (computed before the hooks below so their
  // `enabled` gates can reference it — the early return itself stays after all hooks).
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
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Mobile unified event header (G3): the nav grows past --nav-height to hold
  // eyebrow · title · meta, so publish its real heights as root CSS vars —
  // --nav-event-h (expanded height; page top padding) and --nav-visual-h
  // (current height; the ticker + sticky day labels ride the collapse). Desktop
  // and non-tournament routes clear both vars so every consumer falls back to
  // the plain --nav-height.
  const hasEventHead = !!urlTournamentSlug && !!(tournamentName || orgName);
  useEffect(() => {
    const rootStyle = document.documentElement.style;
    const clear = () => {
      rootStyle.removeProperty('--nav-event-h');
      rootStyle.removeProperty('--nav-visual-h');
    };
    if (!hasEventHead) { clear(); return; }
    const mq = window.matchMedia('(max-width: 900px)');
    const publish = () => {
      const el = navRef.current;
      if (!el || !mq.matches) { clear(); return; }
      const h = el.offsetHeight;
      rootStyle.setProperty('--nav-visual-h', `${h}px`);
      // Only the expanded (unscrolled) measurement drives page padding — and it
      // STAYS between publishes, so the collapse never shifts the layout under
      // the reader (clearing it mid-scroll would fall back to the SSR seed).
      if (window.scrollY <= 20) rootStyle.setProperty('--nav-event-h', `${h}px`);
    };
    publish();
    // The ResizeObserver alone tracks the collapse/expand (the scroll state
    // changes the nav's height via CSS, which fires the observer) — the effect
    // deliberately does NOT depend on the scrolled state, so the vars are never
    // torn down between flips. Cleared only on unmount / leaving mobile.
    const ro = new ResizeObserver(publish);
    if (navRef.current) ro.observe(navRef.current);
    mq.addEventListener('change', publish);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', publish);
      clear();
    };
    // hasEventHead only: the ResizeObserver already re-measures any height
    // change (title rename, wrapping) — a name-change dep would tear the vars
    // down and republish, flashing the layout for nothing.
  }, [hasEventHead]);

  if (isAdmin) return null;

  const navClass = `${styles.nav} ${scrolled ? styles.scrolled : ''}`;

  /* ── Marketing nav (/, /pricing, /for-*, /changelog, /coaches/join…) ── */
  if (isMarketingPath(pathname)) {
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
                <AccountMenu className={quietCtaClass} wrapClassName={styles.marketingAccount} signOutTo="here" warm>
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

  /* ── A club's own pages (/{orgSlug}/* with no tournament in the URL) ──
     Club Tier Stage 4b-1 (Asks 7 + 8, ruled 2026-10-19): the club draws its OWN bar — its colours, its name, Sign in,
     and the staff door for its own staff (components/public/ClubBar.tsx, mounted by the org layout's ClubFrame) — so
     the platform's bar steps aside here entirely. No Discover, no Pricing, no crumb at any width. Every such path is
     either a club page or an operator shell (which SiteChrome already drops): a club section is a static folder,
     which Next.js matches before [tournamentSlug], so it never carries that param. */
  if (!urlTournamentSlug) return null;

  /* ── Tournament nav (/[orgSlug]/[tournamentSlug]/*) ── */
  /* The event's slug, taken from the URL when the nav CONTEXT hasn't landed yet.
     This branch only runs when the URL carries a tournament slug, so the two always name the same
     event — but the context is filled by OrgNavSync during the page render, so the server frame
     saw `tournamentSlug === null` and fell back to `/{orgSlug}`. On an org whose public page is
     switched off that is a door to a 404 in the first painted frame, and it built the section tabs
     as `/{org}/null/teams` besides. Found by the R1 guard, 2026-08-01: SSR and hydrated markup now
     name the same destinations. */
  const eventSlug = tournamentSlug ?? urlTournamentSlug;
  // Links are spelled for the address the visitor is on (a club's own web address has no club name in it); the active-tab
  // test below still reads the club-named path.
  const homeHref = orgHref(`/${eventSlug}`);
  const today = tournamentToday();
  const phase = phaseOf(tournamentStartDate, tournamentEndDate, tournamentStatus, today, tournamentFinished);
  const dateRange = fmtRange(tournamentStartDate, tournamentEndDate);
  const startsIn = phase === 'pre' ? daysUntil(tournamentStartDate, today) : 0;
  // One phase pill for the mobile event header, built on the global badge
  // family (one chip system) with a local size modifier. Registration-open
  // outranks the plain Upcoming label; red stays reserved for the live window.
  const PILLS: Record<string, { cls: string; label: string; dot?: boolean } | undefined> = {
    reg: { cls: `badge badge-success ${styles.ehPill}`, label: 'Registration open' },
    pre: { cls: `badge badge-neutral ${styles.ehPill}`, label: 'Upcoming' },
    live: { cls: `badge badge-danger ${styles.ehPill}`, label: 'Game day', dot: true },
    done: { cls: `badge ${styles.ehPill} ${styles.ehPillDone}`, label: 'Final' },
  };
  const pill = PILLS[phase === 'pre' && tournamentRegisterCta === 'register' ? 'reg' : phase] ?? null;
  const showEyebrow = !!orgName && !!tournamentName && orgName !== tournamentName;

  return (
    <nav ref={navRef} className={`${navClass} ${styles.hasEventHead}`} data-color-mode={tournamentColorMode ?? 'dark'}>
      {/* Tablet/desktop bar — unchanged; hidden ≤900px where the event head takes over. */}
      <div className={`container ${styles.inner}`}>
        <Link href={homeHref} className={styles.logo}>
          {logoUrl && (
            <img src={logoUrl} alt={tournamentName || orgName || 'Tournament logo'} className={styles.logoImg} />
          )}
          {(tournamentName || orgName) ? (
            <span className={styles.orgName}>{tournamentName || orgName}</span>
          ) : null}
        </Link>

        {/* Desktop top-bar context (status pill + dates, live ticker on game day).
            Hidden ≤1023px; takes the left flex share where the logo sits on mobile. */}
        <div className={styles.navStatusSlot}>
          <TournamentNavStatus />
        </div>

        <div className={styles.links}>
          {visibleTournamentTabs(tournamentHiddenPages, tournamentHasBracket).map(l => {
            const href = `/${orgSlug}/${eventSlug}/${l.key}`;
            const isActive = pathname.startsWith(href);
            const linkHref = orgHref(`/${eventSlug}/${l.key}`);
            return (
              <Link
                key={l.key}
                href={linkHref}
                className={`${styles.link} ${isActive ? styles.active : ''}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile unified event header (G3): org eyebrow · title · one data line —
          deliberately TEXT-ONLY (owner 2026-07-15): the event logo's home is the
          pre-event brand card on the overview, not the chrome. Condenses to a
          slim title bar on scroll (eyebrow + meta fold away in CSS). */}
      <div className={styles.eventHead}>
        {/* Stage B.2 (Nav Unification): the org eyebrow becomes a real door up to the org's
            public page — but ONLY when that page is a real destination (the layout resolves
            the tier/active-count condition into orgHomeHref; null keeps today's inert text).
            Same text, same look — just tappable. */}
        {showEyebrow && (orgHomeHref ? (
          <Link href={orgHref()} className={`${styles.ehOrg} ${styles.ehOrgLink}`}>{orgName}</Link>
        ) : (
          <span className={styles.ehOrg}>{orgName}</span>
        ))}
        <Link href={homeHref} className={styles.ehTitle}>{tournamentName || orgName}</Link>
        {(dateRange || pill) && (
          <div className={styles.ehMeta}>
            {dateRange && (
              <span className={styles.ehRange}>
                {dateRange}
                {/* Calendar-day count ("starts in") — the body's countdown card
                    tracks the exact first-pitch clock, so the labels differ. */}
                {startsIn > 0 ? ` · Starts in ${startsIn} day${startsIn === 1 ? '' : 's'}` : ''}
              </span>
            )}
            {pill && (
              <span className={pill.cls}>
                {pill.dot && <span className="live-dot" />}
                {pill.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tournament page tabs (Phase 5): the scrolling row that replaced the retired
          bottom bar. Sits directly under the event header ≤900px and rides inside
          this measured <nav>, so its height folds into --nav-visual-h/--nav-event-h
          automatically (ticker + sticky day-labels + page padding all clear it). */}
      <TournamentTopTabs />

      {/* One actions cluster for every width — absolutely positioned so the flip pill mounts
          exactly once (portals + document listeners) and a late-resolving pill never shifts
          the page.

          The desktop fan notification bell was REMOVED here 2026-07-29 (owner call). Score
          alerts only ever fire for teams a fan follows, so a team-independent bell either had
          no payoff (no team followed) or duplicated the alerts toggle already sitting on the
          followed-team rail card and team pages. It never rendered ≤900px. Alerts remain
          reachable from those toggles and from Account → Notifications. */}
      <div className={styles.navActions}>
        {/* "The Flip" pill (Phase 2) — a signed-in hat-holder's one-tap door to their side of
            THIS event, page-matched. Self-gates: renders nothing for fans / signed-out visitors,
            so the header corner (and long event names) belong to fans again. Share moved into the
            Overview content. */}
        <TournamentFlipPill />
      </div>
    </nav>
  );
}
