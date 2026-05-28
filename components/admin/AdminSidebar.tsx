'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Calendar, Trophy, Tag, LogOut, Home,
  ChevronRight, MapPin, BookOpen, CreditCard, Settings, Settings2, Paintbrush,
  Users2, Archive, ArrowLeft, Mail, Globe, DollarSign,
  CalendarDays, ClipboardList, FileText, UserCheck, ExternalLink, HelpCircle,
  Link2, Bell, Plus,
} from 'lucide-react';
import TournamentSetupWizard from '@/components/admin/TournamentSetupWizard';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import NotificationBell from '@/components/notifications/NotificationBell';
import { signOut } from '@/lib/auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { hasCapability, type Capability } from '@/lib/roles';
import { useCurrentOrgCoachAccess } from '@/lib/use-current-org-coach-access';
import { getBillingHref } from '@/lib/billing-urls';
import styles from './AdminSidebar.module.css';

type TourNavItem = { key: string; icon: React.ElementType; label: string; roles?: string[] };
type TourGroup   = { key: string; label: string; defaultOpenFor: string[]; items: TourNavItem[] };

const TOUR_GROUPS: TourGroup[] = [
  {
    key: 'operations',
    label: 'Operations',
    defaultOpenFor: ['draft', 'active', 'completed'],
    items: [
      { key: 'dashboard',      icon: LayoutDashboard, label: 'Dashboard'       },
      { key: 'registrations',  icon: Users,           label: 'Teams'           },
      { key: 'schedule',       icon: Calendar,        label: 'Schedule'        },
      { key: 'results',        icon: Trophy,          label: 'Results'         },
      { key: 'communication',  icon: Mail,            label: 'Communications'  },
    ],
  },
  {
    key: 'setup',
    label: 'Setup',
    defaultOpenFor: ['draft'],
    items: [
      { key: 'settings/event', icon: Settings2,  label: 'Event Settings',       roles: ['owner', 'admin'] },
      { key: 'venues',         icon: MapPin,     label: 'Venues & Facilities'   },
      { key: 'divisions',      icon: Tag,        label: 'Divisions'             },
      { key: 'rules',          icon: BookOpen,   label: 'Rules & Resources'     },
      { key: 'branding',       icon: Paintbrush, label: 'Public Site'           },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    defaultOpenFor: [],
    items: [
      { key: 'settings', icon: Settings, label: 'Settings & Access' },
      { key: 'archives', icon: Archive,  label: 'Past Tournaments'  },
    ],
  },
];

type HouseLeagueSeasonOption = {
  id: string;
  name: string;
  status?: string;
};

function isHouseLeagueSeasonOption(value: unknown): value is HouseLeagueSeasonOption {
  if (!value || typeof value !== 'object') return false;
  const season = value as Record<string, unknown>;
  return typeof season.id === 'string' && typeof season.name === 'string';
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin`;
  const currentOrgSlug = currentOrg?.slug;
  const isCanceled = currentOrg?.subscriptionStatus === 'canceled';
  const { tournaments, currentTournament, setCurrentTournament, refresh: refreshTournaments } = useTournament();

  const isOrgAdmin     = pathname.startsWith(`${base}/org`);
  const isPublicSite   = pathname.startsWith(`${base}/public-site`);
  const isAccounting   = pathname.startsWith(`${base}/accounting`);
  const isHouseLeague  = pathname.startsWith(`${base}/house-league`);
  const isRepTeams     = pathname.startsWith(`${base}/rep-teams`);
  const isTournaments  = pathname.startsWith(`${base}/tournaments`);

  const seasonMatch     = pathname.match(/\/house-league\/seasons\/([^/]+)/);
  const repTeamMatch    = pathname.match(/\/rep-teams\/teams\/([^/]+)\/program-years\/([^/]+)/);
  const currentRepTeamId = repTeamMatch?.[1] ?? null;
  const currentRepYearId = repTeamMatch?.[2] ?? null;
  const currentSeasonId = seasonMatch?.[1] ?? null;

  const [showCreateModal, setShowCreateModal] = useState(false);

  const canUseModule = (capability: Capability) => currentOrg && userRole
    ? hasCapability(userRole, userCapabilities, capability) && hasModuleEntitlement(currentOrg, capability)
    : false;

  const isLeagueOrClub = !!currentOrg && ['league', 'club'].includes(currentOrg.planId);
  const tournamentSlotLimit = currentOrg?.tournamentLimit ?? 9999;
  const atSlotLimit = tournaments.length >= tournamentSlotLimit;
  const canClone = !!currentOrg && hasPlanFeature(currentOrg.planId, 'tournament_cloning');
  const cloneUpgradeCopy = requiresTournamentPlusCopy('tournament_cloning');
  const billingHref = currentOrg ? getBillingHref(currentOrg.slug, currentOrg.planId) : `${base}/org/billing`;

  const canSeeMembersNav = userRole
    ? (userRole === 'owner' || hasCapability(userRole, userCapabilities, 'module_members')) && canUseModule('module_members')
    : false;

  // Season switcher — loaded client-side when inside house league section
  const [houseLeagueSeasons, setHouseLeagueSeasons] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!isHouseLeague || !currentOrgSlug) return;
    fetch(`/api/admin/house-league/seasons`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const seasons = Array.isArray(d?.seasons)
          ? d.seasons
              .filter(isHouseLeagueSeasonOption)
              .filter((season: HouseLeagueSeasonOption) => season.status !== 'archived')
              .map((season: HouseLeagueSeasonOption) => ({ id: season.id, name: season.name }))
          : [];
        setHouseLeagueSeasons(seasons);
      })
      .catch(() => {});
  }, [isHouseLeague, currentOrgSlug]);

  const canSeePublicSite = userRole
    ? canUseModule('module_public_site')
    : false;

  const canSeeAccounting = userRole
    ? canUseModule('module_accounting')
    : false;

  const canSeeHouseLeague = userRole
    ? canUseModule('module_house_league')
    : false;

  const canSeeRepTeams = userRole
    ? canUseModule('module_rep_teams')
    : false;
  const hasCurrentOrgCoachAccess = useCurrentOrgCoachAccess(
    currentOrgSlug,
    Boolean(canSeeRepTeams && !isCanceled),
  );

  const hasOnlyTournamentWorkspace = !!currentOrg && canUseModule('module_tournaments') && !canSeePublicSite && !canSeeAccounting && !canSeeHouseLeague && !canSeeRepTeams;
  // Org venue library is a League/Club feature — not available to Tournament or Tournament Plus subscribers
  const hasOrgVenueLibrary = !!currentOrg && ['league', 'club'].includes(currentOrg.planId);
  const showTournamentSummary = currentTournament?.status === 'completed' || currentTournament?.status === 'archived';
  const tournamentGroups = TOUR_GROUPS.map(group =>
    group.key === 'operations' && showTournamentSummary
      ? { ...group, items: [...group.items, { key: 'summary', icon: FileText, label: 'Summary' } as TourNavItem] }
      : group
  );

  // Collapsible nav groups — persisted to localStorage
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set<string>());
  const [groupsReady, setGroupsReady] = useState(false);

  useEffect(() => {
    if (groupsReady) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = localStorage.getItem('fl_nav_groups');
        if (stored) {
          setOpenGroups(new Set(JSON.parse(stored) as string[]));
          setGroupsReady(true);
          return;
        }
      } catch {
        // Fall back to the default group below when stored state is unavailable.
      }
      const status = currentTournament?.status ?? 'draft';
      setOpenGroups(new Set(TOUR_GROUPS.filter(g => g.defaultOpenFor.includes(status)).map(g => g.key)));
      setGroupsReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [groupsReady, currentTournament?.status]);

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem('fl_nav_groups', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function isGroupOpen(groupKey: string, items: TourNavItem[]) {
    if (openGroups.has(groupKey)) return true;
    return items.some(item => pathname.startsWith(`${base}/tournaments/${item.key}`));
  }

  const helpHref = isTournaments  ? `${base}/help/tournaments`
                 : isHouseLeague  ? `${base}/help/house-league`
                 : isRepTeams     ? `${base}/help/rep-teams`
                 : isAccounting   ? `${base}/help/accounting`
                 : isOrgAdmin     ? `${base}/help/org`
                 : `${base}/help`;

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

  // Tournament-only orgs live entirely in the tournaments section; the org admin
  // shell is only accessible for billing/account management. Show a contextual
  // back link to tournaments rather than nothing or "All Sections".
  const tournamentBackLink = (
    <Link href={`${base}/tournaments`} className={`${styles.navItem} ${styles.backLink}`} id="admin-nav-back-tournaments">
      <ArrowLeft size={15} />
      <span>Tournaments</span>
    </Link>
  );

  const maybeBackLink = isCanceled ? null
    : (hasOnlyTournamentWorkspace && isOrgAdmin) ? tournamentBackLink
    : hasOnlyTournamentWorkspace ? null
    : backLink;
  const tournamentPreviewHref = currentOrg?.slug && currentTournament
    ? `/${currentOrg.slug}/admin/tournaments/preview/${currentTournament.slug}`
    : null;
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

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div>
          <div className={styles.logoMain}>
            <span className={styles.logoField}>Field</span>
            <span className={styles.logoLogic}>Logic</span>
            <span className={styles.logoHq}>HQ</span>
          </div>
          <div className={styles.logoSub}>{currentOrg?.name ?? 'Admin'}</div>
        </div>
        {currentOrg?.id && <NotificationBell orgId={currentOrg.id} />}
      </div>

      <div className={styles.sidebarScroll}>
      {/* Org Admin mode */}
      {isOrgAdmin && (
        <>
          {maybeBackLink}
          <div className={styles.navSection}>
            <div className={styles.sectionHeader}>
              {hasOnlyTournamentWorkspace ? 'Account' : 'Organization Admin'}
            </div>
            <nav className={styles.nav}>
              {!isCanceled && canSeeMembersNav && navLink(
                'org/members', Users2, 'Members',
                `${base}/org/members`,
                pathname.startsWith(`${base}/org/members`),
              )}
              {!isCanceled && hasOrgVenueLibrary && navLink(
                'org/venues', MapPin, 'Venue Library',
                `${base}/org/venues`,
                pathname.startsWith(`${base}/org/venues`),
              )}
              {userRole === 'owner' && navLink(
                'org/billing', CreditCard, 'Subscription',
                `${base}/org/billing`,
                pathname.startsWith(`${base}/org/billing`),
              )}
              {!isCanceled && (userRole === 'owner' || userRole === 'admin') && navLink(
                'org/coaches-portal-links', Link2, 'Coaches Portal Links',
                `${base}/org/coaches-portal-links`,
                pathname.startsWith(`${base}/org/coaches-portal-links`) || pathname.startsWith(`${base}/org/team-links`),
              )}
              {!isCanceled && userRole === 'owner' && navLink(
                'org/settings', Settings, 'Settings',
                `${base}/org/settings`,
                pathname.startsWith(`${base}/org/settings`),
              )}
              {!isCanceled && navLink(
                'org/notifications', Bell, 'Notifications',
                `${base}/org/notifications`,
                pathname.startsWith(`${base}/org/notifications`),
              )}
            </nav>
          </div>
        </>
      )}

      {/* Public Site mode */}
      {isPublicSite && canSeePublicSite && (
        <>
          {maybeBackLink}
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
          {maybeBackLink}
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
          {maybeBackLink}
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
              {houseLeagueSeasons.length > 1 && (
                <div className={styles.tournamentSwitcher}>
                  <label className={styles.switcherLabel} htmlFor="hl-season-select">Switch Season</label>
                  <select
                    id="hl-season-select"
                    className={styles.switcherSelect}
                    value={currentSeasonId}
                    onChange={e => {
                      const subPath = pathname.match(/\/seasons\/[^/]+\/([^/]+)/)?.[1] ?? 'registrations';
                      router.push(`${base}/house-league/seasons/${e.target.value}/${subPath}`);
                    }}
                  >
                    {houseLeagueSeasons.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
          {maybeBackLink}
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
              {hasCurrentOrgCoachAccess && navLink('rt-coaches-portal', ExternalLink, 'Coaches Portal',
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
      {isTournaments && (
        <>
          {maybeBackLink}
          {tournaments.length > 0 && (
            <div className={styles.tournamentSwitcher}>
              {tournaments.length > 1 ? (
                <>
                  <label className={styles.switcherLabel} htmlFor="admin-tournament-select">Editing Tournament</label>
                  <div className={styles.switcherRow}>
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
                    {(userRole === 'owner' || userRole === 'admin') && (
                      <button
                        type="button"
                        className={styles.switcherAddBtn}
                        onClick={() => atSlotLimit && userRole === 'owner'
                          ? router.push(billingHref)
                          : atSlotLimit
                          ? undefined
                          : setShowCreateModal(true)}
                        disabled={atSlotLimit && userRole !== 'owner'}
                        title={atSlotLimit && userRole === 'owner'
                          ? `All ${tournamentSlotLimit} tournament slot${tournamentSlotLimit === 1 ? '' : 's'} used. Upgrade your plan to add more.`
                          : atSlotLimit
                          ? 'Tournament slot limit reached. Ask your org owner to upgrade.'
                          : 'Create a new tournament'}
                        aria-label="Create new tournament"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.switcherRow}>
                  <span className={styles.switcherName}>{currentTournament?.name}</span>
                  {(userRole === 'owner' || userRole === 'admin') && (
                    <button
                      type="button"
                      className={styles.switcherAddBtn}
                      onClick={() => atSlotLimit && userRole === 'owner'
                        ? router.push(billingHref)
                        : atSlotLimit
                        ? undefined
                        : setShowCreateModal(true)}
                      disabled={atSlotLimit && userRole !== 'owner'}
                      title={atSlotLimit && userRole === 'owner'
                        ? `All ${tournamentSlotLimit} tournament slot${tournamentSlotLimit === 1 ? '' : 's'} used. Upgrade your plan to add more.`
                        : atSlotLimit
                        ? 'Tournament slot limit reached. Ask your org owner to upgrade.'
                        : 'Create a new tournament'}
                      aria-label="Create new tournament"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              )}
              {currentTournament?.status === 'active'    && <span className={styles.activePill}>● Live</span>}
              {currentTournament?.status === 'draft'     && <span className={styles.activePill} style={{ opacity: 0.5 }}>Draft</span>}
              {currentTournament?.status === 'completed' && <span className={styles.activePill} style={{ opacity: 0.5 }}>Completed</span>}
              {currentTournament?.status === 'archived'  && <span className={styles.activePill} style={{ opacity: 0.4 }}>Archived</span>}
            </div>
          )}
          <div className={styles.navSection}>
            {!hasOnlyTournamentWorkspace && <div className={styles.sectionHeader}>Tournament</div>}
            <nav className={styles.nav}>
              {tournamentGroups.map(group => {
                // For League/Club, hide the Settings & Access item in the Admin group
                const visibleItems = group.items.filter(item => {
                  if (item.roles && (!userRole || !item.roles.includes(userRole))) return false;
                  return true;
                });
                if (visibleItems.length === 0) return null;

                const open      = isGroupOpen(group.key, visibleItems);
                const allKeys = tournamentGroups.flatMap(g => g.items).map(i => i.key);
                const hasActive = visibleItems.some(item => {
                  const href = `${base}/tournaments/${item.key}`;
                  return pathname.startsWith(href) && !allKeys.some(
                    k => k !== item.key && pathname.startsWith(`${base}/tournaments/${k}`) && k.length > item.key.length,
                  );
                });
                return (
                  <div key={group.key} className={styles.navGroup}>
                    <button
                      type="button"
                      className={`${styles.navGroupHeader} ${hasActive ? styles.navGroupHeaderActive : ''}`}
                      onClick={() => toggleGroup(group.key)}
                    >
                      <span>{group.label}</span>
                      <ChevronRight
                        size={13}
                        className={`${styles.navGroupChevron} ${open ? styles.navGroupChevronOpen : ''}`}
                      />
                    </button>
                    {open && (
                      <div className={styles.navGroupItems}>
                        {visibleItems.map(item => {
                          const href = `${base}/tournaments/${item.key}`;
                          const hasMoreSpecificMatch = tournamentGroups.flatMap(g => g.items).some(
                            other => other.key !== item.key &&
                                     pathname.startsWith(`${base}/tournaments/${other.key}`) &&
                                     other.key.length > item.key.length,
                          );
                          return navLink(item.key, item.icon, item.label, href, pathname.startsWith(href) && !hasMoreSpecificMatch);
                        })}
                      </div>
                    )}
                  </div>
                );
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


        <div className={styles.navSpacer} />

        {/* Footer */}
        <div className={styles.footer}>
          {isTournaments ? (
            tournamentPreviewHref ? (
              <Link
                href={tournamentPreviewHref}
                className={styles.footerLink}
                id="admin-preview-site"
                target="_blank"
                rel="noopener noreferrer"
                title={tournamentPreviewTitle}
                aria-label={`${tournamentPreviewLabel} opens in a new tab`}
              >
                <ExternalLink size={15} /> {tournamentPreviewLabel}
              </Link>
            ) : null
          ) : !isOrgAdmin && (
            <Link href={`/${currentOrg?.slug ?? 'milton-bats'}`} className={styles.footerLink} id="admin-back-site">
              <Home size={15} /> Back to Site
            </Link>
          )}
          <Link
            href={helpHref}
            className={styles.footerLink}
            id="admin-help"
            target="_blank"
            rel="noopener noreferrer"
          >
            <HelpCircle size={15} /> Help
          </Link>
          <button type="button" onClick={handleLogout} className={styles.logoutBtn} id="admin-logout">
            <LogOut size={15} /> Logout
          </button>
        </div>
      </div>{/* end sidebarScroll */}
      {showCreateModal && currentOrg && (
        <TournamentSetupWizard
          isOpen={showCreateModal}
          orgSlug={currentOrg.slug}
          orgContactEmail={currentOrg.contactEmail ?? null}
          existingTournaments={tournaments.map(t => ({
            id: t.id,
            name: t.name,
            year: t.year ?? null,
            status: t.status ?? null,
          }))}
          canClone={canClone}
          upgradeCopy={cloneUpgradeCopy}
          onClose={() => setShowCreateModal(false)}
          onCreated={async () => {
            setShowCreateModal(false);
            await refreshTournaments();
            router.push(`${base}/tournaments/dashboard`);
          }}
        />
      )}
    </aside>
  );
}
