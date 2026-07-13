'use client';
/**
 * components/consumer/ConsumerNav.tsx
 *
 * Primary navigation for the logged-out consumer shell (unified-app Phase 1).
 * Renders an app-like top bar (wordmark + inline links on desktop) and a
 * mobile bottom tab bar — the same responsive pattern the rest of the site uses
 * (top links ≥900px, bottom nav below). Tabs: Discover / Scores / Following / Account.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Radio, Star, User } from 'lucide-react';
import styles from './ConsumerShell.module.css';

const TABS = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/scores', label: 'Scores', icon: Radio },
  { href: '/following', label: 'Following', icon: Star },
  { href: '/account', label: 'Account', icon: User },
] as const;

export default function ConsumerNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <header className={styles.topbar}>
        <Link href="/discover" className={styles.wordmark} aria-label="FieldLogicHQ home">
          <span className={styles.wm1}>FIELD</span>
          <span className={styles.wm2}>LOGIC</span>
          <span className={styles.wm3}>HQ</span>
        </Link>
        <nav className={styles.topNav} aria-label="Primary">
          {TABS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.topLink} ${active ? styles.active : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <nav className={styles.bottomNav} aria-label="Primary">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.tab} ${active ? styles.active : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.iconWrap}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {active && <span className={styles.activeDot} />}
              </span>
              <span className={styles.label}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
