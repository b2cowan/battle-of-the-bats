'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Calendar, Trophy, Users, Megaphone, FileText } from 'lucide-react';
import styles from './BottomNav.module.css';

const TAB_KEYS = [
  { key: 'news',     icon: Megaphone, label: 'News'     },
  { key: 'schedule', icon: Calendar,  label: 'Schedule' },
  { key: 'results',  icon: Trophy,    label: 'Results'  },
  { key: 'teams',    icon: Users,     label: 'Teams'    },
  { key: 'rules',    icon: FileText,  label: 'Rules'    },
];

export default function BottomNav() {
  const pathname = usePathname();
  const params   = useParams();
  const orgSlug  = (params?.orgSlug as string) || 'milton-bats';

  // Hide on any /[orgSlug]/admin/* route
  const isAdmin = /^\/[^/]+\/admin(\/|$)/.test(pathname) || pathname.startsWith('/admin');
  if (isAdmin) return null;

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      {TAB_KEYS.map(({ key, icon: Icon, label }) => {
        const href   = `/${orgSlug}/${key}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={key}
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
