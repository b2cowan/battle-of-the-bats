'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check } from 'lucide-react'; // Removing Menu, X as they are no longer used
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { href: '/news',     label: 'News'     },
  { href: '/schedule', label: 'Schedule' },
  { href: '/results',  label: 'Results'  },
  { href: '/teams',    label: 'Teams'    },
  { href: '/rules',    label: 'Rules'    },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <div className={`container ${styles.inner}`}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <img src="/logo.png" alt="Milton Bats Logo" className={styles.logoImg} />
          <div className={styles.logoText}>
            <span className={styles.logoMain}>BATTLE</span>
            <span className={styles.logoSub}>OF THE BATS</span>
          </div>
        </Link>

        {/* Desktop links */}
        <div className={styles.links}>
          {NAV_LINKS.map(l => {
            const isActive = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`${styles.link} ${isActive ? styles.active : ''}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* Register CTA + Hamburger */}
        <div className={styles.actions}>
          <Link href="/register" className="btn btn-primary btn-sm" id="nav-register-btn">
            Register
          </Link>
        </div>
      </div>


    </nav>
  );
}
