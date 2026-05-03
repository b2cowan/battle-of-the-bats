'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users, Calendar, Trophy, Megaphone,
  MoreHorizontal, LayoutDashboard, Tag, MapPin,
  RefreshCw, LogOut, X, ChevronRight, BookUser,
  Settings, Users2,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { setActiveTournament } from '@/lib/db';
import styles from './AdminBottomNav.module.css';

const PRIMARY_KEYS = [
  { key: 'teams',    icon: Users,    label: 'Registrations' },
  { key: 'schedule', icon: Calendar, label: 'Schedule'      },
  { key: 'results',  icon: Trophy,   label: 'Results'       },
];

const BASE_MORE_KEYS = [
  { key: '',              icon: LayoutDashboard, label: 'Dashboard'     },
  { key: 'tournaments',   icon: RefreshCw,       label: 'Tournaments'   },
  { key: 'announcements', icon: Megaphone,       label: 'Announcements' },
  { key: 'contacts',      icon: BookUser,        label: 'Contacts'      },
  { key: 'age-groups',    icon: Tag,             label: 'Age Groups'    },
  { key: 'diamonds',      icon: MapPin,          label: 'Diamonds'      },
];

const OWNER_MORE_KEYS = [
  { key: 'settings', icon: Settings, label: 'Settings' },
  { key: 'members',  icon: Users2,   label: 'Members'  },
];

export default function AdminBottomNav() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { currentOrg, userRole } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin`;
  const MORE_KEYS = userRole === 'owner'
    ? [...BASE_MORE_KEYS, ...OWNER_MORE_KEYS]
    : BASE_MORE_KEYS;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef   = useRef<HTMLDivElement>(null);
  const { tournaments, currentTournament, setCurrentTournament, refresh } = useTournament();

  // Close dropdown when tapping outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  // Close on route change
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  async function handleLogout() {
    await signOut();
    router.push('/auth/login');
  }

  function handleTournamentChange(id: string) {
    const t = tournaments.find(x => x.id === id);
    if (t) setCurrentTournament(t);
  }

  async function handleSetLive() {
    if (!currentTournament) return;
    await setActiveTournament(currentTournament.id);
    refresh();
  }

  const isMoreActive = MORE_KEYS.some(item => {
    const href = item.key ? `${base}/${item.key}` : base;
    return pathname === href || pathname.startsWith(href + '/');
  });

  return (
    <nav className={styles.bottomNav} aria-label="Admin mobile navigation">
      {PRIMARY_KEYS.map(({ key, icon: Icon, label }) => {
        const href   = `${base}/${key}`;
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={key}
            href={href}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            id={`admin-mob-${label.toLowerCase()}`}
          >
            <span className={styles.iconWrap}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {active && <span className={styles.activeDot} />}
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}

      {/* More button */}
      <div ref={moreRef} className={styles.moreWrap}>
        <button
          className={`${styles.tab} ${(moreOpen || isMoreActive) ? styles.active : ''}`}
          onClick={() => setMoreOpen(o => !o)}
          id="admin-mob-more"
          aria-haspopup="true"
          aria-expanded={moreOpen}
        >
          <span className={styles.iconWrap}>
            {moreOpen
              ? <X size={22} strokeWidth={2} />
              : <MoreHorizontal size={22} strokeWidth={isMoreActive ? 2.5 : 1.8} />
            }
            {isMoreActive && !moreOpen && <span className={styles.activeDot} />}
          </span>
          <span className={styles.label}>More</span>
        </button>

        {/* Upward dropdown */}
        {moreOpen && (
          <div className={styles.dropdown} role="menu">

            {/* Tournament switcher */}
            {tournaments.length > 0 && (
              <div className={styles.tournamentBlock}>
                <span className={styles.blockLabel}>Season</span>
                <select
                  className={styles.seasonSelect}
                  value={currentTournament?.id ?? ''}
                  onChange={e => handleTournamentChange(e.target.value)}
                  id="admin-mob-tournament-select"
                >
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.isActive ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
                {currentTournament && !currentTournament.isActive && (
                  <button className={styles.setLiveBtn} onClick={handleSetLive} id="admin-mob-set-live">
                    Set as Live
                  </button>
                )}
                {currentTournament?.isActive && (
                  <span className={styles.livePill}>● Live</span>
                )}
              </div>
            )}

            <div className={styles.dropDivider} />

            {/* Nav items */}
            {MORE_KEYS.map(({ key, icon: Icon, label }) => {
              const href   = key ? `${base}/${key}` : base;
              const active = key === ''
                ? pathname === base
                : pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={key}
                  href={href}
                  className={`${styles.dropItem} ${active ? styles.dropActive : ''}`}
                  role="menuitem"
                  id={`admin-mob-more-${label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  <ChevronRight size={14} className={styles.dropChevron} />
                </Link>
              );
            })}

            <div className={styles.dropDivider} />

            <button
              className={`${styles.dropItem} ${styles.dropLogout}`}
              onClick={handleLogout}
              role="menuitem"
              id="admin-mob-logout"
            >
              <LogOut size={17} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
