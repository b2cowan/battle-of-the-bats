'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users, Calendar, Trophy, Megaphone,
  MoreHorizontal, LayoutDashboard, Tag, MapPin,
  RefreshCw, LogOut, X, ChevronRight, BookUser,
  Settings, Users2, LayoutGrid, CalendarDays, UserCheck,
  ExternalLink, BookOpen, Mail, Archive, FileText,
  Link2,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import styles from './AdminBottomNav.module.css';

const PRIMARY_KEYS = [
  { key: 'tournaments/teams',    icon: Users,    label: 'Registrations' },
  { key: 'tournaments/schedule', icon: Calendar, label: 'Schedule'      },
  { key: 'tournaments/results',  icon: Trophy,   label: 'Results'       },
];

const TOURNAMENT_MORE = [
  { key: 'tournaments/dashboard',     icon: LayoutDashboard, label: 'Dashboard'     },
  { key: 'tournaments/announcements', icon: Megaphone,       label: 'News Posts'    },
  { key: 'tournaments/communication', icon: Mail,            label: 'Communication' },
  { key: 'tournaments/rules',         icon: BookOpen,        label: 'Rules & Resources' },
  { key: 'tournaments/contacts',      icon: BookUser,        label: 'Contacts'      },
  { key: 'tournaments/venues',        icon: MapPin,          label: 'Venues'        },
  { key: 'tournaments/age-groups',    icon: Tag,             label: 'Divisions'     },
  { key: 'tournaments/manage',        icon: RefreshCw,       label: 'Manage'        },
  { key: 'tournaments/settings',      icon: Settings,        label: 'Settings'      },
  { key: 'tournaments/archives',      icon: Archive,         label: 'Past Tournaments' },
];

const ORG_MORE = [
  { key: 'org/diamonds', icon: MapPin, label: 'Diamonds' },
];

const ADMIN_ORG_MORE = [
  { key: 'org/team-links', icon: Link2, label: 'Team Links' },
];

const OWNER_ORG_MORE = [
  { key: 'org/members',  icon: Users2,   label: 'Members'  },
  { key: 'org/settings', icon: Settings, label: 'Settings' },
];

export default function AdminBottomNav() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { currentOrg, userRole } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin`;
  const orgSlug = currentOrg?.slug ?? 'milton-bats';
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef   = useRef<HTMLDivElement>(null);
  const { tournaments, currentTournament, setCurrentTournament, refresh } = useTournament();
  const tournamentPreviewLabel =
    currentTournament?.status === 'draft'
      ? 'Preview Draft Site'
      : currentTournament?.status === 'completed'
        ? 'Preview Completed Site'
        : 'Preview Site';
  const tournamentPreviewTitle =
    currentTournament?.status === 'draft'
      ? 'Preview the private draft tournament site. It is not public until activated.'
      : currentTournament?.status === 'completed'
        ? 'Preview the completed tournament site.'
        : 'Preview the public tournament site.';

  const isRepTeams    = pathname.startsWith(`${base}/rep-teams`);
  const isHouseLeague = pathname.startsWith(`${base}/house-league`);
  const isModule      = isRepTeams || isHouseLeague || pathname.startsWith(`${base}/org`) || pathname.startsWith(`${base}/public-site`) || pathname.startsWith(`${base}/accounting`);
  const showTournamentSummary = currentTournament?.status === 'completed' || currentTournament?.status === 'archived';
  const tournamentMore = showTournamentSummary
    ? [
        ...TOURNAMENT_MORE.slice(0, 3),
        { key: 'tournaments/summary', icon: FileText, label: 'Summary' },
        ...TOURNAMENT_MORE.slice(3),
      ]
    : TOURNAMENT_MORE;

  const allMoreKeys = [
    ...tournamentMore,
    ...ORG_MORE,
    ...(userRole === 'owner' || userRole === 'admin' ? ADMIN_ORG_MORE : []),
    ...(userRole === 'owner' ? OWNER_ORG_MORE : []),
  ];

  const isMoreActive = allMoreKeys.some(item => {
    const href = item.key ? `${base}/${item.key}` : base;
    return pathname === href || pathname.startsWith(href + '/');
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMoreOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

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
    const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
    const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set-status',
        id: currentTournament.id,
        data: { status: 'active' },
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(result.error ?? 'This tournament is not ready to go live.');
      return;
    }
    await refresh();
    setMoreOpen(false);
  }

  function dropNavItems(items: typeof TOURNAMENT_MORE) {
    return items.map(({ key, icon: Icon, label }) => {
      const href   = key ? `${base}/${key}` : base;
      const active = key === ''
        ? pathname === base
        : pathname === href || pathname.startsWith(href + '/');
      return (
        <Link
          key={key || '_dashboard'}
          href={href}
          className={`${styles.dropItem} ${active ? styles.dropActive : ''}`}
          role="menuitem"
          id={`admin-mob-more-${label.toLowerCase().replace(/[\s&]+/g, '-')}`}
        >
          <Icon size={17} />
          <span>{label}</span>
          <ChevronRight size={14} className={styles.dropChevron} />
        </Link>
      );
    });
  }

  // Section-aware primary tabs
  const modulePrimaryTabs = isRepTeams
    ? [
        { href: `${base}/rep-teams`,   icon: Users,      label: 'Rep Teams'  },
        { href: `/${orgSlug}/coaches`, icon: UserCheck,  label: 'Coaches'    },
        { href: base,                  icon: LayoutGrid, label: 'Hub'        },
      ]
    : isHouseLeague
    ? [
        { href: `${base}/house-league`, icon: CalendarDays, label: 'Seasons' },
        { href: base,                   icon: LayoutGrid,   label: 'Hub'     },
      ]
    : isModule
    ? [
        { href: base, icon: LayoutGrid, label: 'Hub' },
      ]
    : null; // tournament ops — use PRIMARY_KEYS

  return (
    <nav className={styles.bottomNav} aria-label="Admin mobile navigation">
      {modulePrimaryTabs ? (
        modulePrimaryTabs.map(({ href, icon: Icon, label }) => {
          const active = href === base ? pathname === base : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.tab} ${active ? styles.active : ''}`}
              id={`admin-mob-${label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <span className={styles.iconWrap}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {active && <span className={styles.activeDot} />}
              </span>
              <span className={styles.label}>{label}</span>
            </Link>
          );
        })
      ) : (
        PRIMARY_KEYS.map(({ key, icon: Icon, label }) => {
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
        })
      )}

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
                {currentTournament && (
                  <Link
                    className={styles.setLiveBtn}
                    href={`/${orgSlug}/admin/tournaments/preview/${currentTournament.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    id="admin-mob-preview-site"
                    title={tournamentPreviewTitle}
                    aria-label={`${tournamentPreviewLabel} opens in a new tab`}
                  >
                    <ExternalLink size={13} /> {tournamentPreviewLabel}
                  </Link>
                )}
                {currentTournament?.isActive && (
                  <span className={styles.livePill}>● Live</span>
                )}
              </div>
            )}

            <div className={styles.dropDivider} />

            {/* Tournament nav group */}
            <div className={styles.dropSectionLabel}>Tournament</div>
            {dropNavItems(tournamentMore)}

            <div className={styles.dropDivider} />

            {/* Organization nav group */}
            <div className={styles.dropSectionLabel}>Organization</div>
            {dropNavItems(ORG_MORE)}
            {(userRole === 'owner' || userRole === 'admin') && dropNavItems(ADMIN_ORG_MORE)}
            {userRole === 'owner' && dropNavItems(OWNER_ORG_MORE)}

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
