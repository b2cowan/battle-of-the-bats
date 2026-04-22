'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { href: '/schedule', label: 'Schedule' },
  { href: '/results',  label: 'Results'  },
  { href: '/teams',    label: 'Teams'    },
  { href: '/rules',    label: 'Rules'    },
  { href: '/news',     label: 'News'     },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

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
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`${styles.link} ${pathname.startsWith(l.href) ? styles.active : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Hamburger (mobile only) */}
        <div className={styles.actions}>
          <button
            className={styles.hamburger}
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
            id="nav-hamburger"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className={styles.mobileMenu}>
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`${styles.mobileLink} ${pathname.startsWith(l.href) ? styles.mobileActive : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
