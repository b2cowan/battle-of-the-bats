'use client';
/**
 * components/consumer/ConsumerNav.tsx
 *
 * Primary navigation for the logged-out consumer shell (unified-app Phase 1).
 * Renders an app-like top bar and a mobile bottom tab bar — the same responsive
 * pattern the rest of the site uses (top links ≥900px, bottom nav below).
 *
 * Tabs: Discover / Scores / Following / Account. On desktop the header also carries
 * the organizer/utility affordances (Run a tournament + Sign in / Your workspaces)
 * so desktop visitors who land here from search can still convert or sign in —
 * the directory stays a funnel, not just a fan surface. Those utility links are
 * desktop-only; on mobile the bottom-nav Account tab covers the same ground.
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

export default function ConsumerNav({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
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
        </div>

        <div className={styles.topUtil}>
          <Link href="/start" className={styles.utilLink}>Run a tournament</Link>
          {signedIn ? (
            <Link href="/home" className={styles.utilCta}>Your workspaces</Link>
          ) : (
            <Link href="/auth/login" className={styles.utilCta}>Sign in</Link>
          )}
        </div>
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
