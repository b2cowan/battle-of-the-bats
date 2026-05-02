'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Calendar, Trophy, Megaphone, Tag, LogOut, Home, ChevronRight, MapPin, RefreshCw, ClipboardList, BookUser, BookOpen } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useTournament } from '@/lib/tournament-context';
import { setActiveTournament } from '@/lib/db';
import styles from './AdminSidebar.module.css';

const NAV = [
  { href: '/admin',                 icon: LayoutDashboard, label: 'Dashboard'     },
  { href: '/admin/tournaments',     icon: RefreshCw,       label: 'Tournaments'   },
  { href: '/admin/announcements',   icon: Megaphone,       label: 'Announcements' },
  { href: '/admin/contacts',        icon: BookUser,        label: 'Contacts'      },
  { href: '/admin/age-groups',      icon: Tag,             label: 'Age Groups'    },
  { href: '/admin/teams',           icon: Users,           label: 'Registrations'  },
  { href: '/admin/schedule',        icon: Calendar,        label: 'Schedule'      },
  { href: '/admin/results',         icon: Trophy,          label: 'Results'       },
  { href: '/admin/rules',           icon: BookOpen,        label: 'Rules & Resources' },
  { href: '/admin/diamonds',        icon: MapPin,          label: 'Diamonds'      },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { tournaments, currentTournament, setCurrentTournament, refresh } = useTournament();

  async function handleLogout() {
    await signOut();
    router.push('/auth/login');
  }

  function handleTournamentChange(id: string) {
    const t = tournaments.find(x => x.id === id);
    if (t) setCurrentTournament(t);
  }

  async function handleSetActive() {
    if (!currentTournament) return;
    await setActiveTournament(currentTournament.id);
    refresh();
  }

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>⚾</div>
        <div>
          <div className={styles.logoMain}>Admin Panel</div>
          <div className={styles.logoSub}>Battle of the Bats</div>
        </div>
      </div>

      {/* Tournament Switcher */}
      {tournaments.length > 0 && (
        <div className={styles.tournamentSwitcher}>
          <label className={styles.switcherLabel}>Editing Tournament</label>
          <select
            className={styles.switcherSelect}
            value={currentTournament?.id ?? ''}
            onChange={e => handleTournamentChange(e.target.value)}
            id="admin-tournament-select"
          >
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}{t.isActive ? ' ✓' : ''}
              </option>
            ))}
          </select>
          {currentTournament && !currentTournament.isActive && (
            <button className={styles.setActiveBtn} onClick={handleSetActive} id="set-active-tournament-btn">
              Set as Live
            </button>
          )}
          {currentTournament?.isActive && (
            <span className={styles.activePill}>● Live</span>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.navActive : ''}`}
              id={`admin-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              {active && <ChevronRight size={14} className={styles.navChevron} />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={styles.footer}>
        <Link href="/" className={styles.footerLink} id="admin-back-site">
          <Home size={15} /> Back to Site
        </Link>
        <button onClick={handleLogout} className={styles.logoutBtn} id="admin-logout">
          <LogOut size={15} /> Logout
        </button>
      </div>
    </aside>
  );
}
