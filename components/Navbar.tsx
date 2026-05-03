'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
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
      <nav className={navClass}>
        <div className={`container ${styles.inner}`}>
          <Link href="/" className={styles.logo}>
            <img src="/logo.png" alt="BOTB Platform logo" className={styles.logoImg} />
            <div className={styles.logoText}>
              <span className={styles.logoMain}>BOTB</span>
              <span className={styles.logoSub}>PLATFORM</span>
            </div>
          </Link>

          <div className={styles.links}>
            <Link
              href="/discover"
              className={`${styles.link} ${pathname.startsWith('/discover') ? styles.active : ''}`}
            >
              Discover
            </Link>
            <Link href="/#pricing" className={styles.link}>
              Pricing
            </Link>
          </div>

          <div className={styles.actions}>
            <Link href="/auth/login"  className="btn btn-ghost btn-sm">Sign In</Link>
            <Link href="/auth/signup" className="btn btn-primary btn-sm">Start Free</Link>
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
          <img src="/logo.png" alt="Milton Bats Logo" className={styles.logoImg} />
          <div className={styles.logoText}>
            <span className={styles.logoMain}>BATTLE</span>
            <span className={styles.logoSub}>OF THE BATS</span>
          </div>
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
