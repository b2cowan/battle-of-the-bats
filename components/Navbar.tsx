'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useOrgNav } from './OrgNavContext';
import { cn } from '@/lib/utils';
import styles from './Navbar.module.css';

const NAV_KEYS = [
  { key: 'news',     label: 'News'     },
  { key: 'schedule', label: 'Schedule' },
  { key: 'results',  label: 'Results'  },
  { key: 'teams',    label: 'Teams'    },
  { key: 'rules',    label: 'Rules'    },
];

function isMarketingPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/discover') ||
    pathname.startsWith('/auth')
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const params   = useParams();
  const orgSlug  = (params?.orgSlug as string) || 'milton-bats';
  const { logoUrl, orgName } = useOrgNav();
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
    return (
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
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/discover"
              className={cn(
                'font-mono text-xs uppercase tracking-widest transition-colors',
                pathname.startsWith('/discover') ? 'text-logic-lime' : 'text-data-gray hover:text-fl-text'
              )}
            >
              Discover
            </Link>
            <Link
              href="/#pricing"
              className="font-mono text-xs uppercase tracking-widest text-data-gray hover:text-fl-text transition-colors"
            >
              Pricing
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="font-mono text-xs uppercase tracking-widest text-data-gray hover:text-fl-text border border-blueprint-blue/40 hover:border-blueprint-blue px-4 py-2 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="font-mono text-xs uppercase tracking-widest font-bold bg-logic-lime text-pitch-black px-4 py-2 hover:bg-white transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  /* ── Tournament nav (/[orgSlug]/*) ── */
  return (
    <nav className={navClass}>
      <div className={`container ${styles.inner}`}>
        <Link href={`/${orgSlug}`} className={styles.logo}>
          {logoUrl ? (
            <img src={logoUrl} alt={orgName || 'Organization logo'} className={styles.logoImg} />
          ) : (
            <>
              <img src="/logo.png" alt="BOTB Platform logo" className={styles.logoImg} />
              <div className={styles.logoText}>
                <span className={styles.logoMain}>BATTLE</span>
                <span className={styles.logoSub}>OF THE BATS</span>
              </div>
            </>
          )}
        </Link>

        <div className={styles.links}>
          {NAV_KEYS.map(l => {
            const href = `/${orgSlug}/${l.key}`;
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
          <Link href={`/${orgSlug}/register`} className="btn btn-primary btn-sm" id="nav-register-btn">
            Register
          </Link>
        </div>
      </div>
    </nav>
  );
}
