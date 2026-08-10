'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LogOut, Home, Trophy,
  ChevronRight, CreditCard, Settings,
  Users2, ArrowLeft, Globe, DollarSign,
  CalendarDays, ClipboardList, FileText, UserCheck, ExternalLink, HelpCircle,
  Link2, Plus, MapPin, Mail, Archive, Users, Calendar,
} from 'lucide-react';
import TournamentSetupWizard from '@/components/admin/TournamentSetupWizard';
import { hasPlanFeature, hasOrgVenueLibrary as hasOrgVenueLibraryPlan, requiresTournamentPlusCopy } from '@/lib/plan-features';
import ReleaseDot from '@/components/whats-new/ReleaseDot';
import { signOut } from '@/lib/auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { hasCapability, type Capability } from '@/lib/roles';
import { useCurrentOrgCoachAccess, coachDoorFor } from '@/lib/use-current-org-coach-access';
import { getBillingHref, isTournamentTier } from '@/lib/billing-urls';
import { useAdminWorklist } from '@/lib/admin-worklist';
import { useChatUnread } from '@/lib/use-chat-unread';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import { TOUR_GROUPS, type TourNavItem, type TourGroup } from './admin-nav-config';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { isNavKeyHiddenInSandbox } from '@/lib/sandbox-curation';
import FeedbackLauncher from '@/components/feedback/FeedbackLauncher';
import styles from './AdminSidebar.module.css';

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

export default function AdminSidebar({ chatUnread: chatUnreadProp }: {
  /** Hoisted from AdminChrome (one fetch + Realtime channel shared with the top strip's
   *  chat door — same contract as the notification count). Absent when the sidebar is
   *  mounted outside the admin shell — it self-serves then, tournament routes only. */
  chatUnread?: number;
} = {}) {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin`;
  const currentOrgSlug = currentOrg?.slug;
  const isCanceled = currentOrg?.subscriptionStatus === 'canceled';
  const { tournaments, currentTournament, setCurrentTournament, refresh: refreshTournaments } = useTournament();
  const worklist = useAdminWorklist();
  // "See it live" sandbox — drives the curated-surface hiding below. False for every real org.
  const isSandbox = useIsSandbox();

  // Tournament / Tournament Plus tiers have no org-admin concept — never treat them as
  // being "in org admin" even if a URL slips through (proxy.ts + the org layout redirect them).
  const isOrgAdmin     = pathname.startsWith(`${base}/org`) && !isTournamentTier(currentOrg?.planId);
  const isPublicSite   = pathname.startsWith(`${base}/public-site`);
  const isAccounting   = pathname.startsWith(`${base}/accounting`);
  const isHouseLeague  = pathname.startsWith(`${base}/house-league`);
  const isRepTeams     = pathname.startsWith(`${base}/rep-teams`);
  const isTournaments  = pathname.startsWith(`${base}/tournaments`);
  // Chat unread — hoisted count when the shell provides one; otherwise self-serve, and
  // only poll while the tournament nav is on screen (Chat lives there).
  const ownChatUnread = useChatUnread(chatUnreadProp === undefined && isTournaments);
  const chatUnread = chatUnreadProp ?? ownChatUnread;

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
    fetch(`/api/admin/house-league/seasons?orgSlug=${encodeURIComponent(currentOrgSlug)}`)
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
  // Enabled for ALL non-canceled admins (not just rep orgs) so a free-tier owner who also
  // coaches gets a coach-view door too (P3-2). The hook returns both rep + Basic presence;
  // coachDoorFor centralizes the show/href rule (shared with the mobile nav).
  const coachAccess = useCurrentOrgCoachAccess(currentOrgSlug, !isCanceled);
  const coachDoor = coachDoorFor(coachAccess, currentOrgSlug);

  const hasOnlyTournamentWorkspace = !!currentOrg && canUseModule('module_tournaments') && !canSeePublicSite && !canSeeAccounting && !canSeeHouseLeague && !canSeeRepTeams;
  // Org venue library is a League/Club-band feature — the shared predicate keeps this
  // matched to the API + page gates (omitting 'club_large' here once hid the nav for a
  // paid band).
  const hasOrgVenueLibrary = hasOrgVenueLibraryPlan(currentOrg?.planId);
  const showTournamentSummary = currentTournament?.status === 'completed' || currentTournament?.status === 'archived';
  const tournamentGroups = TOUR_GROUPS
    .map(group =>
      group.key === 'operations' && showTournamentSummary
        ? { ...group, items: [...group.items, { key: 'summary', icon: FileText, label: 'Summary' } as TourNavItem] }
        : group
    )
    // The sandbox's four curated corners — billing, staff invitations, exports, deep settings forms
    // (lib/sandbox-curation.ts). HIDE the entry point rather than let a stranger dead-end on it.
    // A group left with nothing in it drops out entirely rather than rendering an empty header.
    .map(group => isSandbox
      ? { ...group, items: group.items.filter(item => !isNavKeyHiddenInSandbox(true, item.key)) }
      : group)
    .filter(group => group.items.length > 0);

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
    const count = worklist[key] ?? 0;
    return (
      <Link
        key={key}
        href={href}
        className={`${styles.navItem} ${active ? styles.navActive : ''}`}
        id={`admin-nav-${label.toLowerCase().replace(/[\s&]+/g, '-')}`}
      >
        <Icon size={17} />
        <span>{label}</span>
        {count > 0 && (
          <span className={styles.navCount} aria-label={`${count} need attention`}>
            {count > 9 ? '9+' : count}
          </span>
        )}
        {key === 'chat' && <ChatUnreadBadge count={chatUnread} />}
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

  return (
    <>
    <aside className={styles.sidebar}>
      {/* NO org label here (owner ruling 2026-08-02, narrowing Stage C). Stage C moved the
          FieldLogicHQ wordmark up into AdminTopStrip and had the sidebar open with WHOSE place
          this is — right principle, redundant in practice: AdminEventHeader already names the org
          on EVERY admin screen (the eyebrow above a tournament name; the title itself on org-level
          screens). The rail was repeating it ~20px away and costing ~62px of head, pushing nav
          items below the fold on laptops. Zone-2 identity now lives once, in the page header; the
          WorkspacesPill remains the multi-org "am I in the right place" check. The rail opens on
          its first real block — switcher on tournament screens, section header otherwise. */}
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
              {coachAccess.hasRepAccess && navLink('rt-coaches-portal', ExternalLink, 'Coaches Portal',
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
              {/* NO status pill here (owner ruling 2026-08-02). It re-rendered the SAME five states
                  as AdminEventHeader's phase chip (Draft / Open / Live / Completed / Archived) from
                  the same tournament — but off its own hand-rolled copy of the status+date rules
                  instead of resolvePhase(), so the two could silently disagree the day the phase
                  rules change. One status, one resolver, in the header: it sits beside the date
                  range that explains it, carries the pulsing game-day dot, and the header is sticky
                  and never collapses on desktop, so nothing is lost on scroll. Mobile already had
                  only the header chip (this rail is display:none ≤900px), so desktop now matches. */}
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
          {/* The Flip: the tournament "View Site"/"Preview Site" footer link is retired — the always-
              visible header FlipPill (top-right of the content area) replaces it. Non-tournament
              sections keep their org-level "Public site" door (org-level is out of scope). */}
          {!isTournaments && !isOrgAdmin && (
            <Link href={`/${currentOrg?.slug ?? 'milton-bats'}`} className={styles.footerLink} id="admin-back-site">
              <Home size={15} /> Public site
            </Link>
          )}
          {coachDoor.show && (
            <Link href={coachDoor.href} className={styles.footerLink} id="admin-coaches-portal">
              <Users2 size={15} /> Coaches Portal
            </Link>
          )}
          {/* "All Workspaces" retired here (Stage C): the top strip's Workspaces popover is
              the one multi-place chooser, fed by the shared places resolver. */}
          <Link
            href={helpHref}
            className={styles.footerLink}
            id="admin-help"
            target="_blank"
            rel="noopener noreferrer"
          >
            <HelpCircle size={15} /> Help
            <ReleaseDot />
          </Link>
          <FeedbackLauncher className={styles.footerLink} label="Send feedback" />
          <button type="button" onClick={handleLogout} className={styles.logoutBtn} id="admin-logout">
            <LogOut size={15} /> Logout
          </button>
        </div>
      </div>{/* end sidebarScroll */}
    </aside>
    {/* Rendered outside <aside> so the modal overlay escapes the sidebar's
        position:sticky stacking context and covers the main content column. */}
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
        sourceSurface="sidebar_create"
        previewOrg={currentOrg}
        canManageBranding={Boolean(userRole && hasCapability(userRole, userCapabilities, 'manage_branding'))}
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
    </>
  );
}
