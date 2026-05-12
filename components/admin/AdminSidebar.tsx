'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Calendar, Trophy, Megaphone, Tag, LogOut, Home,
  ChevronRight, MapPin, RefreshCw, BookUser, BookOpen, CreditCard, Settings,
  Users2, Archive, ArrowLeft, Mail, Globe, DollarSign,
  CalendarDays, ClipboardList, FileText, UserCheck, ExternalLink,
} from 'lucide-react';import { signOut } from '@/lib/auth';
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

  const isHub          = pathname === base;
  const isOrgAdmin     = pathname.startsWith(`${base}/org`);
  const isPublicSite   = pathname.startsWith(`${base}/public-site`);
  const isAccounting   = pathname.startsWith(`${base}/accounting`);
  const isHouseLeague  = pathname.startsWith(`${base}/house-league`);
  const isRepTeams     = pathname.startsWith(`${base}/rep-teams`);

  const seasonMatch     = pathname.match(/\/house-league\/seasons\/([^/]+)/);
  const repTeamMatch    = pathname.match(/\/rep-teams\/teams\/([^/]+)\/program-years\/([^/]+)/);
  const currentRepTeamId = repTeamMatch?.[1] ?? null;
  const currentRepYearId = repTeamMatch?.[2] ?? null;
  const currentSeasonId = seasonMatch?.[1] ?? null;

  const canSeeMembersNav = userRole
    ? userRole === 'owner' || hasCapability(userRole, userCapabilities, 'module_members')
    : false;

  const canSeePublicSite = userRole
    ? hasCapability(userRole, userCapabilities, 'module_public_site')
    : false;

  const canSeeAccounting = userRole
    ? hasCapability(userRole, userCapabilities, 'module_accounting')
    : false;

  const canSeeHouseLeague = userRole
    ? hasCapability(userRole, userCapabilities, 'module_house_league')
    : false;

  const canSeeRepTeams = userRole
    ? hasCapability(userRole, userCapabilities, 'module_rep_teams')
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

      {/* Public Site mode */}
      {isPublicSite && canSeePublicSite && (
        <>
          {backLink}
          <div className={styles.navSection}>
            <div className={styles.sectionHeader}>Public Site</div>
            <nav className={styles.nav}>
              {navLink(
                'public-site', Globe, 'Site Editor',
                `${base}/public-site`,
                pathname === `${base}/public-site`,
              )}
            </nav>
          </div>
        </>
      )}

      {/* Accounting mode */}
      {isAccounting && canSeeAccounting && (
        <>
          {backLink}
          <div className={styles.navSection}>
            <div className={styles.sectionHeader}>Accounting</div>
            <nav className={styles.nav}>
              {navLink('accounting', DollarSign, 'Ledgers',
                `${base}/accounting`,
                pathname === `${base}/accounting`)}
            </nav>
          </div>
        </>
      )}

      {/* House League mode */}
      {isHouseLeague && canSeeHouseLeague && (
        <>
          {backLink}
          <div className={styles.navSection}>
            <div className={styles.sectionHeader}>House League</div>
            <nav className={styles.nav}>
              {navLink('hl-seasons', CalendarDays, 'Seasons',
                `${base}/house-league`,
                pathname === `${base}/house-league`)}
              {navLink('hl-past', Archive, 'Past Seasons',
                `${base}/house-league/past`,
                pathname.startsWith(`${base}/house-league/past`))}
            </nav>
          </div>
          {currentSeasonId && (
            <div className={styles.navSection}>
              <div className={styles.sectionHeader}>Season</div>
              <nav className={styles.nav}>
                {navLink('hl-registrations', ClipboardList, 'Registrations',
                  `${base}/house-league/seasons/${currentSeasonId}/registrations`,
                  pathname.startsWith(`${base}/house-league/seasons/${currentSeasonId}/registrations`))}
                {navLink('hl-teams', Users, 'Teams & Draft',
                  `${base}/house-league/seasons/${currentSeasonId}/teams`,
                  pathname.startsWith(`${base}/house-league/seasons/${currentSeasonId}/teams`))}
                {navLink('hl-schedule', Calendar, 'Schedule',
                  `${base}/house-league/seasons/${currentSeasonId}/schedule`,
                  pathname.startsWith(`${base}/house-league/seasons/${currentSeasonId}/schedule`))}
                {navLink('hl-standings', Trophy, 'Standings',
                  `${base}/house-league/seasons/${currentSeasonId}/standings`,
                  pathname.startsWith(`${base}/house-league/seasons/${currentSeasonId}/standings`))}
                {navLink('hl-notifications', Mail, 'Notifications',
                  `${base}/house-league/seasons/${currentSeasonId}/notifications`,
                  pathname.startsWith(`${base}/house-league/seasons/${currentSeasonId}/notifications`))}
              </nav>
            </div>
          )}
        </>
      )}

      {/* Rep Teams mode */}
      {isRepTeams && canSeeRepTeams && (
        <>
          {backLink}
          <div className={styles.navSection}>
            <div className={styles.sectionHeader}>Rep Teams</div>
            <nav className={styles.nav}>
              {navLink('rt-teams', Users, 'Teams',
                `${base}/rep-teams`,
                pathname === `${base}/rep-teams`)}
              {navLink('rt-allocations', DollarSign, 'Cost Allocation',
                `${base}/rep-teams/allocations`,
                pathname.startsWith(`${base}/rep-teams/allocations`))}
              {navLink('rt-docs', FileText, 'Document Templates',
                `${base}/rep-teams/documents`,
                pathname.startsWith(`${base}/rep-teams/documents`))}
              {navLink('rt-past', Archive, 'Past Seasons',
                `${base}/rep-teams/past`,
                pathname.startsWith(`${base}/rep-teams/past`))}
              {navLink('rt-coaches-portal', ExternalLink, 'Coaches Portal',
                `/${currentOrg?.slug ?? ''}/coaches`,
                pathname.startsWith(`/${currentOrg?.slug ?? ''}/coaches`))}
            </nav>
          </div>
          {currentRepTeamId && currentRepYearId && (
            <div className={styles.navSection}>
              <div className={styles.sectionHeader}>Team</div>
              <nav className={styles.nav}>
                {navLink('rt-tryouts', ClipboardList, 'Tryouts',
                  `${base}/rep-teams/teams/${currentRepTeamId}/program-years/${currentRepYearId}/tryouts`,
                  pathname.startsWith(`${base}/rep-teams/teams/${currentRepTeamId}/program-years/${currentRepYearId}/tryouts`))}
                {navLink('rt-roster', Users, 'Roster',
                  `${base}/rep-teams/teams/${currentRepTeamId}/program-years/${currentRepYearId}/roster`,
                  pathname.startsWith(`${base}/rep-teams/teams/${currentRepTeamId}/program-years/${currentRepYearId}/roster`))}
                {navLink('rt-schedule', Calendar, 'Schedule',
                  `${base}/rep-teams/teams/${currentRepTeamId}/program-years/${currentRepYearId}/schedule`,
                  pathname.startsWith(`${base}/rep-teams/teams/${currentRepTeamId}/program-years/${currentRepYearId}/schedule`))}
                {navLink('rt-documents', FileText, 'Documents',
                  `${base}/rep-teams/teams/${currentRepTeamId}/program-years/${currentRepYearId}/documents`,
                  pathname.startsWith(`${base}/rep-teams/teams/${currentRepTeamId}/program-years/${currentRepYearId}/documents`))}
                {navLink('rt-coaches', UserCheck, 'Coaches',
                  `${base}/rep-teams/teams/${currentRepTeamId}/program-years/${currentRepYearId}/coaches`,
                  pathname.startsWith(`${base}/rep-teams/teams/${currentRepTeamId}/program-years/${currentRepYearId}/coaches`))}
              </nav>
            </div>
          )}
        </>
      )}

      {/* Tournament operations mode */}
      {!isHub && !isOrgAdmin && !isPublicSite && !isAccounting && !isHouseLeague && !isRepTeams && (
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
              {canSeeAccounting && navLink(
                'tournament-accounting', DollarSign, 'Accounting',
                currentTournament
                  ? `${base}/accounting?tournamentId=${currentTournament.id}`
                  : `${base}/accounting`,
                false,
              )}
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
