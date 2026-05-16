'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Calendar, Trophy, Users, Megaphone, FileText } from 'lucide-react';
import { useOrgNav } from './OrgNavContext';
import type { PublicPageKey } from '@/lib/public-pages';
import styles from './BottomNav.module.css';

const TAB_KEYS = [
  { key: 'news',     icon: Megaphone, label: 'News'     },
  { key: 'schedule', icon: Calendar,  label: 'Schedule' },
  { key: 'standings', icon: Trophy,   label: 'Standings' },
  { key: 'teams',    icon: Users,     label: 'Teams'    },
  { key: 'rules',    icon: FileText,  label: 'Rules'    },
];

export default function BottomNav() {
  const pathname = usePathname();
  const params   = useParams();
  const orgSlug  = (params?.orgSlug as string) || 'milton-bats';
  const tournamentSlug = params?.tournamentSlug as string | undefined;
  const { tournamentHiddenPages } = useOrgNav();

  // Hide on admin routes and marketing/auth pages
  const isAdmin = /^\/[^/]+\/admin(\/|$)/.test(pathname) || pathname.startsWith('/admin');
  const isMarketing = pathname === '/' || pathname.startsWith('/discover') || pathname.startsWith('/auth');
  if (isAdmin || isMarketing || pathname.startsWith('/platform-admin') || !tournamentSlug) return null;

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      {TAB_KEYS.filter(tab => !tournamentHiddenPages.includes(tab.key as PublicPageKey)).map(({ key, icon: Icon, label }) => {
        const href   = `/${orgSlug}/${tournamentSlug}/${key}`;
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
