'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Calendar, Trophy, Megaphone, Tag, LogOut, Home, ChevronRight, MapPin, RefreshCw, BookUser, BookOpen, CreditCard, Settings, Users2 } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { setActiveTournament } from '@/lib/db';
import styles from './AdminSidebar.module.css';

const NAV_KEYS = [
  { key: '',               icon: LayoutDashboard, label: 'Dashboard'         },
  { key: 'tournaments',    icon: RefreshCw,       label: 'Tournaments'       },
  { key: 'announcements',  icon: Megaphone,       label: 'Announcements'     },
  { key: 'contacts',       icon: BookUser,        label: 'Contacts'          },
  { key: 'age-groups',     icon: Tag,             label: 'Age Groups'        },
  { key: 'teams',          icon: Users,           label: 'Registrations'     },
  { key: 'schedule',       icon: Calendar,        label: 'Schedule'          },
  { key: 'results',        icon: Trophy,          label: 'Results'           },
  { key: 'rules',          icon: BookOpen,        label: 'Rules & Resources' },
  { key: 'diamonds',       icon: MapPin,          label: 'Diamonds'          },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentOrg, userRole } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin`;
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
        {NAV_KEYS.map(item => {
          const href   = item.key ? `${base}/${item.key}` : base;
          const active = item.key === ''
            ? pathname === base
            : pathname.startsWith(`${base}/${item.key}`);
          return (
            <Link
              key={item.key}
              href={href}
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

      {/* Billing, Settings, Members — owner only */}
      {userRole === 'owner' && (
        <div className={styles.billingSection}>
          <Link
            href={`${base}/billing`}
            className={`${styles.navItem} ${pathname.startsWith(`${base}/billing`) ? styles.navActive : ''}`}
            id="admin-nav-billing"
          >
            <CreditCard size={17} />
            <span>Billing</span>
            {pathname.startsWith(`${base}/billing`) && <ChevronRight size={14} className={styles.navChevron} />}
          </Link>
          <Link
            href={`${base}/settings`}
            className={`${styles.navItem} ${pathname.startsWith(`${base}/settings`) ? styles.navActive : ''}`}
            id="admin-nav-settings"
          >
            <Settings size={17} />
            <span>Settings</span>
            {pathname.startsWith(`${base}/settings`) && <ChevronRight size={14} className={styles.navChevron} />}
          </Link>
          <Link
            href={`${base}/members`}
            className={`${styles.navItem} ${pathname.startsWith(`${base}/members`) ? styles.navActive : ''}`}
            id="admin-nav-members"
          >
            <Users2 size={17} />
            <span>Members</span>
            {pathname.startsWith(`${base}/members`) && <ChevronRight size={14} className={styles.navChevron} />}
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <Link href={`/${currentOrg?.slug ?? 'milton-bats'}`} className={styles.footerLink} id="admin-back-site">
          <Home size={15} /> Back to Site
        </Link>
        <button onClick={handleLogout} className={styles.logoutBtn} id="admin-logout">
          <LogOut size={15} /> Logout
        </button>
      </div>
    </aside>
  );
}
