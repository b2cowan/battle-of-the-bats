'use client';
/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useOrgNav } from './OrgNavContext';
import { cn } from '@/lib/utils';
import { phaseOf, fmtRange, daysUntil } from '@/lib/tournament-phase-display';
import { tournamentToday } from '@/lib/timezone';
import TournamentNavStatus from '@/components/public/TournamentNavStatus';
import SharePageButton from '@/components/public/SharePageButton';
import FanNotificationBell from '@/components/public/FanNotificationBell';
import TournamentAccountSheet from '@/components/public/TournamentAccountSheet';
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

function isMarketingPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/discover') ||
    pathname.startsWith('/platform') ||
    pathname.startsWith('/for-') ||
    pathname.startsWith('/coaches') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/changelog') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/my')
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const params   = useParams();
  const orgSlug           = (params?.orgSlug as string) || '';
  const urlTournamentSlug = params?.tournamentSlug as string | undefined;
  const { logoUrl, orgName, tournamentSlug, tournamentName, tournamentId, fanAlertsEnabled, tournamentFinished, tournamentColorMode, tournamentHiddenPages, tournamentStartDate, tournamentEndDate, tournamentStatus, tournamentRegisterCta } = useOrgNav();
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

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

  // Hide on any /[orgSlug]/admin/* route
  const isAdmin = /^\/[^/]+\/admin(\/|$)/.test(pathname) || pathname.startsWith('/admin');
  if (isAdmin) return null;

  const navClass = `${styles.nav} ${scrolled ? styles.scrolled : ''}`;

  /* ── Marketing nav (/, /discover, /auth/*) ── */
  if (isMarketingPath(pathname)) {
    const isProtectedCoachesPortalPath = pathname.startsWith('/coaches/tournaments');

    return (
      <>
        <nav className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          'border-b border-blueprint-blue/30',
          scrolled && 'border-blueprint-blue/80 bg-pitch-black/85 backdrop-blur-md',
          !scrolled && 'bg-transparent'
        )}>
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center font-mono font-bold text-xl tracking-tighter">
              <span className="text-fl-text">FIELD</span>
              <span className="text-logic-lime">LOGIC</span>
              <span className="text-data-gray/50">HQ</span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              {MARKETING_NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'font-mono text-xs uppercase tracking-widest transition-colors',
                    pathname.startsWith(href) ? 'text-logic-lime' : 'text-data-gray hover:text-fl-text'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {isProtectedCoachesPortalPath ? (
                <Link
                  href="/coaches/tournaments"
                  className="font-mono text-xs uppercase tracking-widest text-data-gray hover:text-fl-text border border-blueprint-blue/40 hover:border-blueprint-blue px-4 py-2 transition-colors"
                >
                  Portal
                </Link>
              ) : (
                <Link
                  href="/auth/login"
                  className="font-mono text-xs uppercase tracking-widest text-data-gray hover:text-fl-text border border-blueprint-blue/40 hover:border-blueprint-blue px-4 py-2 transition-colors"
                >
                  Sign In
                </Link>
              )}
              <Link
                href={isProtectedCoachesPortalPath ? '/coaches/start' : '/start'}
                className="font-mono text-xs uppercase tracking-widest font-bold bg-logic-lime text-pitch-black px-4 py-2 hover:bg-white transition-colors"
              >
                {isProtectedCoachesPortalPath ? 'Upgrade' : 'Get Started'}
              </Link>
            </div>
          </div>
        </nav>

        {!isProtectedCoachesPortalPath && (
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
        )}
      </>
    );
  }

  /* ── Org home nav (/{orgSlug}/* — no tournament in URL) ── */
  if (!urlTournamentSlug) {
    return (
      <nav className={navClass}>
        <div className={`container ${styles.inner}`}>
          <Link href={`/${orgSlug}`} className={styles.logo}>
            {logoUrl && (
              <img src={logoUrl} alt={orgName || 'Org logo'} className={styles.logoImg} />
            )}
            {orgName && <span className={styles.orgName}>{orgName}</span>}
          </Link>

          <div className={styles.actions} />
        </div>
      </nav>
    );
  }

  /* ── Tournament nav (/[orgSlug]/[tournamentSlug]/*) ── */
  const homeHref = tournamentSlug ? `/${orgSlug}/${tournamentSlug}` : `/${orgSlug}`;
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
            const href = `/${orgSlug}/${tournamentSlug}/${l.key}`;
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
        {showEyebrow && <span className={styles.ehOrg}>{orgName}</span>}
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

      {/* One actions cluster for every width — absolutely positioned so the sheet,
          bell and share mount exactly once (portals + document listeners). */}
      <div className={styles.navActions}>
        {/* Team-independent notification opt-in — Plus tournaments only, hidden once
            the event is over. DESKTOP-ONLY: on mobile the bell lives as a row inside the
            account sheet (opened from the header chip — the retired More tab was its old
            door), and the header keeps only Share. */}
        {tournamentSlug && tournamentId && fanAlertsEnabled && !tournamentFinished && (
          <span className={styles.bellSlot}>
            <FanNotificationBell />
          </span>
        )}
        {/* Persistent, consistent share — the SAME icon in the SAME spot on every
            page; it shares the page you're on (each public route has its own OG
            preview). Register lives on the home page, not here. */}
        {tournamentSlug && tournamentName && (
          <span className={styles.navShare}>
            <SharePageButton
              url={pathname}
              title={tournamentName}
              text="Live on FieldLogicHQ"
              className="btn btn-outline btn-sm"
              compact
            />
          </span>
        )}
        {/* Signed-in account chip → the "hats you own here" sheet (Phase 3).
            Self-gates: renders nothing when the viewer is anonymous. */}
        <TournamentAccountSheet />
      </div>
    </nav>
  );
}
