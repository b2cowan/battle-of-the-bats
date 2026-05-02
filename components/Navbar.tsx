'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Check } from 'lucide-react'; // Removing Menu, X as they are no longer used
import styles from './Navbar.module.css';

const NAV_KEYS = [
  { key: 'news',     label: 'News'     },
  { key: 'schedule', label: 'Schedule' },
  { key: 'results',  label: 'Results'  },
  { key: 'teams',    label: 'Teams'    },
  { key: 'rules',    label: 'Rules'    },
];

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

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <div className={`container ${styles.inner}`}>
        {/* Logo */}
        <Link href={`/${orgSlug}`} className={styles.logo}>
          <img src="/logo.png" alt="Milton Bats Logo" className={styles.logoImg} />
          <div className={styles.logoText}>
            <span className={styles.logoMain}>BATTLE</span>
            <span className={styles.logoSub}>OF THE BATS</span>
          </div>
        </Link>

        {/* Desktop links */}
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

        {/* Register CTA */}
        <div className={styles.actions}>
          <Link href={`/${orgSlug}/register`} className="btn btn-primary btn-sm" id="nav-register-btn">
            Register
          </Link>
        </div>
      </div>


    </nav>
  );
}
