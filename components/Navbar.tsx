'use client';
/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useOrgNav } from './OrgNavContext';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { useRoleSummary, resolveOperatorDoor } from '@/lib/use-role-summary';
import { cn } from '@/lib/utils';
import { phaseOf, fmtRange, daysUntil } from '@/lib/tournament-phase-display';
import { tournamentToday } from '@/lib/timezone';
import TournamentNavStatus from '@/components/public/TournamentNavStatus';
import TournamentFlipPill from '@/components/public/TournamentFlipPill';
import FlipPill from '@/components/shared/FlipPill';
import WorkspacesPill from '@/components/shared/WorkspacesPill';
import { resolveOrgReturnFlip } from '@/lib/flip-twins';
import { showsOrgPublicChrome } from '@/lib/consumer-routes';
import { orgSectionCrumb } from '@/lib/org-public-sections';
import { reportNavClick } from '@/lib/nav-beacon';
import TournamentTopTabs from '@/components/public/TournamentTopTabs';
import { TOURNAMENT_PAGE_TABS } from '@/lib/tournament-page-tabs';
import styles from './Navbar.module.css';

const MARKETING_NAV_LINKS = [
  { href: '/for-tournament-organizers', label: 'Tournaments' },
  { href: '/for-leagues',               label: 'Leagues'    },
  { href: '/for-clubs',                 label: 'Clubs'      },
  { href: '/for-coaches',               label: 'Coaches'    },
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
    pathname.startsWith('/platform') ||
    pathname.startsWith('/for-') ||
    pathname.startsWith('/coaches') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/changelog') ||
    pathname.startsWith('/my')
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const params   = useParams();
  const orgSlug           = (params?.orgSlug as string) || '';
  const urlTournamentSlug = params?.tournamentSlug as string | undefined;
  const { logoUrl, orgName, orgHomeHref, tournamentSlug, tournamentName, tournamentFinished, tournamentColorMode, tournamentHiddenPages, tournamentStartDate, tournamentEndDate, tournamentStatus, tournamentRegisterCta } = useOrgNav();
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  // Hide on any /[orgSlug]/admin/* route (computed before the hooks below so their
  // `enabled` gates can reference it — the early return itself stays after all hooks).
  const isAdmin = /^\/[^/]+\/admin(\/|$)/.test(pathname) || pathname.startsWith('/admin');

  // Org-home actions (Desktop Public UX Phase 1, WI-6): the plain org homepage's nav gains
  // Sign In / Pricing / an operator door. Org pages are public — identity + role doors
  // resolve CLIENT-side (same rule as the tournament chrome; never SSR'd). Both hooks are
  // inert (`enabled=false`, no network) on marketing, tournament, and admin branches.
  const onOrgHome = !!orgSlug && !urlTournamentSlug && !isAdmin && !isMarketingPath(pathname);
  const orgHomeSignedIn = useClientSignedIn(onOrgHome);
  const orgHomeRoles = useRoleSummary(onOrgHome && orgHomeSignedIn);

  // R4 / audit D4 — the marketing bar was AUTH-BLIND. The app strip links to /pricing from every
  // consumer surface, so a signed-in owner tapping it landed on a bar offering "Sign In" and
  // "Get Started" — reading as being signed out, on the product's highest-traffic seam crossing.
  // Resolved the same way the org branch resolves its own identity: a LOCAL cookie read after
  // hydration (no network, nothing SSR'd), so marketing pages stay static and role-free and an
  // anonymous visitor's page is byte-identical to before. Deliberately does NOT fetch the role
  // summary: the two doors below need only "is someone signed in", and marketing is the one
  // surface where a per-visit identity round-trip would be pure cost.
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
    return (
      <>
        <nav className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          'border-b border-blueprint-blue/30',
          scrolled && 'border-blueprint-blue/80 bg-pitch-black/85 backdrop-blur-md',
          !scrolled && 'bg-transparent'
        )}>
          <div className={`container ${styles.marketingInner}`}>
            <Link href="/" className="flex items-center font-mono font-bold text-xl tracking-tighter">
              <span className="text-fl-text">FIELD</span>
              <span className="text-logic-lime">LOGIC</span>
              <span className="text-data-gray/50">HQ</span>
            </Link>

            <div className={styles.marketingLinks}>
              {MARKETING_NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    styles.marketingLink,
                    'transition-colors',
                    pathname.startsWith(href) ? 'text-logic-lime' : 'text-data-gray hover:text-fl-text'
                  )}
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
            <div className="flex items-center gap-3">
              <Link
                href={marketingSignedIn ? '/account' : '/auth/login'}
                className={`${styles.marketingCta} text-data-gray hover:text-fl-text border border-blueprint-blue/40 hover:border-blueprint-blue px-4 transition-colors`}
              >
                {marketingSignedIn ? 'Account' : 'Sign In'}
              </Link>
              <Link
                href={marketingSignedIn ? '/discover' : '/start'}
                className={`${styles.marketingCta} bg-logic-lime text-pitch-black px-4 hover:bg-white transition-colors`}
              >
                {marketingSignedIn ? 'Open app →' : 'Get Started'}
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

  /* ── Org home nav (/{orgSlug}/* — no tournament in URL) ──
     WI-6: no longer a logo-only dead end. Pricing is always there; identity resolves
     client-side, so anonymous fans get Sign In, signed-in fans get Account, and an
     operator gets their one persistent door (Admin Area outranks Coaches Portal). */
  if (!urlTournamentSlug) {
    // Stage D.2, via the shared resolver: 2+ places → the Workspaces popover; 0–1 → the
    // direct pill as before.
    const orgHomeDoor = resolveOperatorDoor(orgHomeRoles?.workspaces, orgHomeRoles?.adminHref, orgHomeRoles?.coachHref);
    // Stage E.3 — one level in, the identity row grows a trail so "up" works a step at a time.
    // Null at the org root and on any section Stage E doesn't name, which keeps today's identity.
    const sectionCrumb = orgSectionCrumb(pathname, orgSlug);
    // Stage E.2 — the return half of the org-level flip, for operators of THIS org only. It takes
    // the door slot ahead of the Workspaces pill, matching the tournament strip's ratified
    // precedence (Flip → pill → StartMenu): a flip back to the place you just left beats a chooser
    // of everywhere you could go. Renders nothing for fans, so the slot falls through unchanged.
    const orgReturnFlip = resolveOrgReturnFlip(orgHomeRoles?.workspaces, orgSlug);
    // One flat precedence chain rather than nested JSX branches, so the rule reads in source order.
    const orgDoorSlot = orgReturnFlip
      ? <FlipPill resolution={orgReturnFlip} variant="inline" className={styles.orgFlip} />
      : orgHomeDoor?.kind === 'workspaces'
        ? <WorkspacesPill workspaces={orgHomeDoor.workspaces} className={styles.actionPill} />
        : orgHomeDoor?.kind === 'pill'
          ? <Link href={orgHomeDoor.pill.href} className={styles.actionPill}>{orgHomeDoor.pill.label}</Link>
          : null;
    return (
      <nav className={navClass}>
        <div className={`container ${styles.inner}`}>
          {/* The identity block is a row, not a single link: at depth the org name self-links to
              the org root and the crumb names the section, so the two carry different jobs. */}
          <div className={styles.logo}>
            <Link href={`/${orgSlug}`} className={styles.logoLink}>
              {logoUrl && (
                <img src={logoUrl} alt={orgName || 'Org logo'} className={styles.logoImg} />
              )}
              {orgName && <span className={styles.orgName}>{orgName}</span>}
            </Link>
            {sectionCrumb && (
              <>
                <span className={styles.crumbSep} aria-hidden>›</span>
                <span className={styles.crumb}>{sectionCrumb}</span>
              </>
            )}
          </div>

          {/* D1 follow-through: where the phone bottom bar renders, this row sheds its utility
              links (see .actionsWithBottomBar). Discover/Account/Sign In are duplicates of the bar
              below; Pricing is DELIBERATELY dropped — the bar never carried it, and a paying
              customer's public page is not our billboard (ruled 2026-08-01). Without the shed, a
              390px screen showed the club's own name squeezed to nothing behind four links. */}
          <div className={`${styles.actions} ${showsOrgPublicChrome(pathname) ? styles.actionsWithBottomBar : ''}`}>
            {/* The way back into the app. Org pages carry no tab row and no bottom bar at any width,
                so before this a visitor who arrived here (from search, a follow card, or a link) had
                no route to Scores/Chat/Account except the browser's Back button. Deliberately a
                plain link at Pricing's weight, and labelled to match the identical link on the
                public tournament strip — not a second brand mark competing with the org's own name.

                Stage E.1: the click (never the render) reports to the beacon that feeds the plan's
                CTR gate — the number that decides whether one link is the permanent answer to the
                fan gap. The anchor itself is identical for every visitor, signed in or not. */}
            <Link
              href="/discover"
              className={styles.actionLink}
              onClick={() => reportNavClick('org_discover')}
            >
              Discover
            </Link>
            <Link href="/pricing" className={styles.actionLink}>Pricing</Link>
            {/* R7 (top-nav audit D7, 2026-08-01): Account sits INSIDE, the operator door OUTERMOST —
                the same Zone-3 order every platform strip already uses. This row had them reversed,
                making the org identity row the one corner in the product that read differently for a
                multi-hat operator. The two written rules had never been reconciled: the grammar says
                "everywhere", the Stage G ratification said "across strips", and this branded row fell
                between them. Ruled: Zone-3 order binds ALL top bars, branded identity rows included. */}
            {orgHomeSignedIn ? (
              <Link href="/account" className={styles.actionLink}>Account</Link>
            ) : (
              <Link href="/auth/login" className={styles.actionCta}>Sign In</Link>
            )}
            {orgDoorSlot}
          </div>
        </div>
      </nav>
    );
  }

  /* ── Tournament nav (/[orgSlug]/[tournamentSlug]/*) ── */
  /* The event's slug, taken from the URL when the nav CONTEXT hasn't landed yet.
     This branch only runs when the URL carries a tournament slug, so the two always name the same
     event — but the context is filled by OrgNavSync during the page render, so the server frame
     saw `tournamentSlug === null` and fell back to `/{orgSlug}`. On an org whose public page is
     switched off that is a door to a 404 in the first painted frame, and it built the section tabs
     as `/{org}/null/teams` besides. Found by the R1 guard, 2026-08-01: SSR and hydrated markup now
     name the same destinations. */
  const eventSlug = tournamentSlug ?? urlTournamentSlug;
  const homeHref = `/${orgSlug}/${eventSlug}`;
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
          {TOURNAMENT_PAGE_TABS.filter(l => !tournamentHiddenPages.includes(l.key)).map(l => {
            const href = `/${orgSlug}/${eventSlug}/${l.key}`;
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={l.key}
                href={href}
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
          <Link href={orgHomeHref} className={`${styles.ehOrg} ${styles.ehOrgLink}`}>{orgName}</Link>
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
