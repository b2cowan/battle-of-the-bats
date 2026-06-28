'use client';
/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useOrgNav } from './OrgNavContext';
import { cn } from '@/lib/utils';
import type { PublicPageKey } from '@/lib/public-pages';
import TournamentNavStatus from '@/components/public/TournamentNavStatus';
import SharePageButton from '@/components/public/SharePageButton';
import styles from './Navbar.module.css';

const MARKETING_NAV_LINKS = [
  { href: '/for-tournament-organizers', label: 'Tournaments' },
  { href: '/for-leagues',               label: 'Leagues'    },
  { href: '/for-clubs',                 label: 'Clubs'      },
  { href: '/for-coaches',               label: 'Coaches'    },
  { href: '/pricing',                   label: 'Pricing'    },
];

const TOURNAMENT_NAV_KEYS = [
  { key: 'news',      label: 'News'      },
  { key: 'schedule',  label: 'Schedule'  },
  { key: 'standings', label: 'Standings' },
  { key: 'teams',     label: 'Teams'     },
  { key: 'rules',     label: 'Rules'     },
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
  const { logoUrl, orgName, tournamentSlug, tournamentName, tournamentColorMode, tournamentHiddenPages } = useOrgNav();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
  return (
    <nav className={navClass} data-color-mode={tournamentColorMode ?? 'dark'}>
      <div className={`container ${styles.inner}`}>
        <Link href={tournamentSlug ? `/${orgSlug}/${tournamentSlug}` : `/${orgSlug}`} className={styles.logo}>
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
          {TOURNAMENT_NAV_KEYS.filter(l => !tournamentHiddenPages.includes(l.key as PublicPageKey)).map(l => {
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

        <div className={styles.actions}>
          {/* Persistent, consistent share — the SAME icon in the SAME spot on every
              page; it shares the page you're on (each public route has its own OG
              preview). Register lives on the home hero, not here. */}
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
        </div>
      </div>
    </nav>
  );
}
