'use client';
/**
 * Desktop section rail for the Account settings shell (Phase 2). Plain links to real
 * routes — active state falls out of the pathname, so refresh, bookmarks, and the
 * browser back button all behave without any client section state. Hidden ≤1023px
 * (the phone stack keeps its own row list).
 *
 * Notifications hides when signed out, mirroring the stacked page (its row only
 * renders in the signed-in branch there too).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Bell, Sun, Smartphone, LifeBuoy } from 'lucide-react';
import styles from './account.module.css';

const SECTIONS = [
  { href: '/account', label: 'Profile', icon: User, signedInOnly: false },
  { href: '/account/notifications', label: 'Notifications', icon: Bell, signedInOnly: true },
  { href: '/account/appearance', label: 'Appearance', icon: Sun, signedInOnly: false },
  { href: '/account/get-the-app', label: 'Get the app', icon: Smartphone, signedInOnly: false },
  { href: '/account/help', label: 'Help', icon: LifeBuoy, signedInOnly: false },
] as const;

export default function AccountRail({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={styles.rail} aria-label="Account sections">
      {SECTIONS.filter(s => signedIn || !s.signedInOnly).map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`${styles.railItem}${active ? ` ${styles.railItemActive}` : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={17} aria-hidden />
            {label}
          </Link>
        );
      })}
      <p className={styles.railNote}>
        Run your own event?{' '}
        <Link href="/start" className={styles.pinLink}>Start a tournament →</Link>
      </p>
    </nav>
  );
}
