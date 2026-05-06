'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Calendar, Trophy, Megaphone, Tag, LogOut, Home, ChevronRight, MapPin, RefreshCw, BookUser, BookOpen, CreditCard, Settings, Users2, Archive } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import styles from './AdminSidebar.module.css';

const TOURNAMENT_NAV = [
  { key: '',              icon: LayoutDashboard, label: 'Dashboard'         },
  { key: 'tournaments',   icon: RefreshCw,       label: 'Tournaments'       },
  { key: 'announcements', icon: Megaphone,       label: 'Announcements'     },
  { key: 'contacts',      icon: BookUser,        label: 'Contacts'          },
  { key: 'age-groups',    icon: Tag,             label: 'Age Groups'        },
  { key: 'teams',         icon: Users,           label: 'Registrations'     },
  { key: 'schedule',      icon: Calendar,        label: 'Schedule'          },
  { key: 'results',       icon: Trophy,          label: 'Results'           },
  { key: 'rules',         icon: BookOpen,        label: 'Rules & Resources' },
];

const ORG_NAV = [
  { key: 'diamonds', icon: MapPin, label: 'Diamonds' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentOrg, userRole } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin`;
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();

  async function handleLogout() {
    await signOut();
    router.push('/auth/login');
  }

  function handleTournamentChange(id: string) {
    const t = tournaments.find(x => x.id === id);
    if (t) setCurrentTournament(t);
  }

  function navLink(key: string, icon: React.ElementType, label: string, href: string, active: boolean) {
    const Icon = icon;
    return (
      <Link
        key={key}
        href={href}
        className={`${styles.navItem} ${active ? styles.navActive : ''}`}
        id={`admin-nav-${label.toLowerCase().replace(/[\s&]+/g, '-')}`}
      >
        <Icon size={17} />
        <span>{label}</span>
        {active && <ChevronRight size={14} className={styles.navChevron} />}
      </Link>
    );
  }

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>⚾</div>
        <div>
          <div className={styles.logoMain}>FieldLogicHQ</div>
          <div className={styles.logoSub}>{currentOrg?.name ?? 'Admin'}</div>
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
                {t.name}
              </option>
            ))}
          </select>
          {currentTournament?.status === 'active'    && <span className={styles.activePill}>● Live</span>}
          {currentTournament?.status === 'draft'     && <span className={styles.activePill} style={{ opacity: 0.5 }}>Draft</span>}
          {currentTournament?.status === 'completed' && <span className={styles.activePill} style={{ opacity: 0.5 }}>Completed</span>}
          {currentTournament?.status === 'archived'  && <span className={styles.activePill} style={{ opacity: 0.4 }}>Archived</span>}
        </div>
      )}

      {/* Tournament Section */}
      <div className={styles.navSection}>
        <div className={styles.sectionHeader}>Tournament</div>
        <nav className={styles.nav}>
          {TOURNAMENT_NAV.map(item => {
            const href   = item.key ? `${base}/${item.key}` : base;
            const active = item.key === ''
              ? pathname === base
              : pathname.startsWith(`${base}/${item.key}`);
            return navLink(item.key || '_dashboard', item.icon, item.label, href, active);
          })}
        </nav>
      </div>

      {/* Organization Section */}
      <div className={`${styles.navSection} ${styles.orgSection}`}>
        <div className={styles.sectionHeader}>Organization</div>
        <nav className={styles.nav}>
          {ORG_NAV.map(item => {
            const href   = `${base}/${item.key}`;
            const active = pathname.startsWith(`${base}/${item.key}`);
            return navLink(item.key, item.icon, item.label, href, active);
          })}

          {/* Archives — all roles, links outside admin base */}
          {navLink(
            'archives',
            Archive,
            'Archives',
            `/${currentOrg?.slug ?? 'milton-bats'}/archives`,
            pathname.startsWith(`/${currentOrg?.slug ?? 'milton-bats'}/archives`),
          )}

          {/* Owner-only: Members, Billing, Settings */}
          {userRole === 'owner' && (
            <>
              {navLink('members',  Users2,     'Members',  `${base}/members`,  pathname.startsWith(`${base}/members`))}
              {navLink('billing',  CreditCard, 'Billing',  `${base}/billing`,  pathname.startsWith(`${base}/billing`))}
              {navLink('settings', Settings,   'Settings', `${base}/settings`, pathname.startsWith(`${base}/settings`))}
            </>
          )}
        </nav>
      </div>

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
