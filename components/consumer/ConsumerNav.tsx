'use client';
/**
 * components/consumer/ConsumerNav.tsx
 *
 * Primary navigation for the consumer shell (Unified Home IA redesign, Phase 0).
 * Renders an app-like top bar and a mobile bottom tab bar — the same responsive
 * pattern the rest of the site uses (top links ≥900px, bottom nav below).
 *
 * Tabs: Home / Scores / Chat / Account (identical shape signed-in vs signed-out).
 * Home lives at /discover (the canonical, SEO-bearing directory URL — unchanged);
 * only its label/icon change. It absorbs the retired Discover + Following tabs and
 * the /home workspace launchpad. On desktop the header also carries the organizer
 * affordances (Run a tournament + coach pill + Sign in) so desktop visitors who
 * land here from search can still convert or sign in. The old "Your workspaces"
 * utility link is gone — Home now carries the workspaces list.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Radio, MessageCircle, User } from 'lucide-react';
import styles from './ConsumerShell.module.css';

const TABS = [
  { href: '/discover', label: 'Home', icon: Home },
  { href: '/scores', label: 'Scores', icon: Radio },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/account', label: 'Account', icon: User },
] as const;

export default function ConsumerNav({
  signedIn = false,
  isCoach = false,
}: {
  signedIn?: boolean;
  /** Account has a coach context (Basic or Premium) — surfaces the coaches hub
   *  in the desktop utility area (Phase 3). Mobile stays four tabs; the Account
   *  tab carries the same door there. */
  isCoach?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <header id="consumer-topbar" className={styles.topbar}>
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
          {signedIn && isCoach && (
            <Link href="/coaches" className={styles.utilCoach}>Coaches Portal</Link>
          )}
          {/* "Your workspaces" retired — Home carries the workspaces list now.
             Signed-out visitors keep a "Sign in" affordance (never ON the sign-in pages). */}
          {!signedIn && !pathname.startsWith('/auth') && (
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
