'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Trophy, Users, Megaphone, FileText } from 'lucide-react';
import styles from './BottomNav.module.css';

const TABS = [
  { href: '/news',      icon: Megaphone, label: 'News'     },
  { href: '/schedule',  icon: Calendar,  label: 'Schedule' },
  { href: '/results',   icon: Trophy,    label: 'Results'  },
  { href: '/teams',     icon: Users,     label: 'Teams'    },
  { href: '/rules',     icon: FileText,  label: 'Rules'    },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide on admin pages
  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      {TABS.map(({ href, icon: Icon, label }) => {
        const active = href === '/' ? pathname === '/' : (pathname === href || pathname.startsWith(href + '/'));
        return (
          <Link
            key={href}
            href={href}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            id={`bottom-nav-${label.toLowerCase()}`}
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
  );
}
