'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users, Calendar, Trophy, Megaphone,
  MoreHorizontal, LayoutDashboard, Tag, MapPin,
  RefreshCw, LogOut, X, ChevronRight, ClipboardList, BookUser,
} from 'lucide-react';
import { logout } from '@/lib/auth';
import { useTournament } from '@/lib/tournament-context';
import { setActiveTournament } from '@/lib/db';
import styles from './AdminBottomNav.module.css';

const PRIMARY_TABS = [
  { href: '/admin/teams',         icon: Users,     label: 'Registrations' },
  { href: '/admin/schedule',      icon: Calendar,  label: 'Schedule' },
  { href: '/admin/results',       icon: Trophy,    label: 'Results' },
];

const MORE_ITEMS = [
  { href: '/admin',               icon: LayoutDashboard, label: 'Dashboard'     },
  { href: '/admin/tournaments',   icon: RefreshCw,       label: 'Tournaments'   },
  { href: '/admin/announcements', icon: Megaphone,       label: 'Announcements' },
  { href: '/admin/contacts',      icon: BookUser,        label: 'Contacts'      },
  { href: '/admin/age-groups',    icon: Tag,             label: 'Age Groups'    },
  { href: '/admin/diamonds',      icon: MapPin,          label: 'Diamonds'      },
];

export default function AdminBottomNav() {
  const pathname  = usePathname();
  const router    = useRouter();
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

  function handleLogout() {
    logout();
    router.push('/admin/login');
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

  const isMoreActive = MORE_ITEMS.some(item =>
    pathname === item.href || pathname.startsWith(item.href + '/')
  );

  return (
    <nav className={styles.bottomNav} aria-label="Admin mobile navigation">
      {PRIMARY_TABS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
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
            {MORE_ITEMS.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
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
