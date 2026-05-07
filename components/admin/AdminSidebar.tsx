'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Calendar, Trophy, Megaphone, Tag, LogOut, Home,
  ChevronRight, MapPin, RefreshCw, BookUser, BookOpen, CreditCard, Settings,
  Users2, Archive, ArrowLeft, Mail,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { hasCapability } from '@/lib/roles';
import styles from './AdminSidebar.module.css';

const TOURNAMENT_NAV = [
  { key: 'dashboard',     icon: LayoutDashboard, label: 'Dashboard'         },
  { key: 'announcements', icon: Megaphone,       label: 'Announcements'     },
  { key: 'contacts',      icon: BookUser,        label: 'Contacts'          },
  { key: 'age-groups',    icon: Tag,             label: 'Age Groups'        },
  { key: 'teams',         icon: Users,           label: 'Registrations'     },
  { key: 'schedule',      icon: Calendar,        label: 'Schedule'          },
  { key: 'results',       icon: Trophy,          label: 'Results'           },
  { key: 'rules',         icon: BookOpen,        label: 'Rules & Resources' },
  { key: 'communication', icon: Mail,            label: 'Communication'     },
  { key: 'archives',      icon: Archive,         label: 'Past Tournaments'  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin`;
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();

  const isHub      = pathname === base;
  const isOrgAdmin = pathname.startsWith(`${base}/org`);

  const canSeeMembersNav = userRole
    ? userRole === 'owner' || hasCapability(userRole, userCapabilities, 'module_members')
    : false;

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

  const backLink = (
    <Link href={base} className={`${styles.navItem} ${styles.backLink}`} id="admin-nav-all-sections">
      <ArrowLeft size={15} />
      <span>All Sections</span>
    </Link>
  );

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

      {/* Org Admin mode */}
      {isOrgAdmin && (
        <>
          {backLink}
          <div className={styles.navSection}>
            <div className={styles.sectionHeader}>Organization Admin</div>
            <nav className={styles.nav}>
              {navLink(
                'org/tournaments', RefreshCw, 'Tournament Records',
                `${base}/org/tournaments`,
                pathname.startsWith(`${base}/org/tournaments`),
              )}
              {canSeeMembersNav && navLink(
                'org/members', Users2, 'Members',
                `${base}/org/members`,
                pathname.startsWith(`${base}/org/members`),
              )}
              {navLink(
                'org/diamonds', MapPin, 'Diamonds',
                `${base}/org/diamonds`,
                pathname.startsWith(`${base}/org/diamonds`),
              )}
              {userRole === 'owner' && navLink(
                'org/billing', CreditCard, 'Billing',
                `${base}/org/billing`,
                pathname.startsWith(`${base}/org/billing`),
              )}
              {userRole === 'owner' && navLink(
                'org/settings', Settings, 'Settings',
                `${base}/org/settings`,
                pathname.startsWith(`${base}/org/settings`),
              )}
            </nav>
          </div>
        </>
      )}

      {/* Tournament operations mode */}
      {!isHub && !isOrgAdmin && (
        <>
          {backLink}
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
          <div className={styles.navSection}>
            <div className={styles.sectionHeader}>Tournament</div>
            <nav className={styles.nav}>
              {TOURNAMENT_NAV.map(item => {
                const href   = `${base}/${item.key}`;
                const active = pathname.startsWith(href);
                return navLink(item.key, item.icon, item.label, href, active);
              })}
            </nav>
          </div>
        </>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        {!isOrgAdmin && (
          <Link href={`/${currentOrg?.slug ?? 'milton-bats'}`} className={styles.footerLink} id="admin-back-site">
            <Home size={15} /> Back to Site
          </Link>
        )}
        <button onClick={handleLogout} className={styles.logoutBtn} id="admin-logout">
          <LogOut size={15} /> Logout
        </button>
      </div>
    </aside>
  );
}
