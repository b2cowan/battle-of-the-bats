'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users, MoreHorizontal,
  LogOut, X, ChevronRight, ChevronDown,
  LayoutGrid, CalendarDays, UserCheck,
  ExternalLink, FileText, MessageSquarePlus, Globe,
  type LucideIcon,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { useCurrentOrgCoachAccess } from '@/lib/use-current-org-coach-access';
import { useAdminWorklist } from '@/lib/admin-worklist';
import { useChatUnread } from '@/lib/use-chat-unread';
import { TOUR_GROUPS, type TourNavItem } from './admin-nav-config';
import AdminContextStrip from './AdminContextStrip';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';
import styles from './AdminBottomNav.module.css';

type NavItem = {
  key: string;
  icon: LucideIcon;
  label: string;
};

function prefixKey(item: TourNavItem): NavItem {
  return { key: `tournaments/${item.key}`, icon: item.icon, label: item.label };
}

/** Clone a nav item with a shorter bottom-bar label (and optionally a tab-specific icon). */
function withBarLabel(item: TourNavItem | undefined, label: string, icon?: LucideIcon): TourNavItem | undefined {
  return item ? { ...item, label, ...(icon ? { icon } : {}) } : undefined;
}

export default function AdminBottomNav() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { currentOrg, userRole } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin`;
  const orgSlug = currentOrg?.slug ?? 'milton-bats';
  const currentOrgSlug = currentOrg?.slug;
  const [moreOpen, setMoreOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const moreRef   = useRef<HTMLDivElement>(null);
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();
  const worklist = useAdminWorklist();
  const tournamentIsLive = currentTournament?.status === 'active' || currentTournament?.status === 'completed';
  const tournamentPreviewLabel = tournamentIsLive ? 'View Site' : 'Preview Site';
  const tournamentPreviewTitle = tournamentIsLive
    ? 'View the live public tournament site.'
    : 'Preview the private draft tournament site. It is not public until activated.';
  const inactiveTournamentCtaLabel =
    currentTournament?.status === 'draft'
      ? 'Review launch checklist'
      : 'Open dashboard';

  const isRepTeams    = pathname.startsWith(`${base}/rep-teams`);
  const isHouseLeague = pathname.startsWith(`${base}/house-league`);
  const isModule      = isRepTeams || isHouseLeague || pathname.startsWith(`${base}/org`) || pathname.startsWith(`${base}/public-site`) || pathname.startsWith(`${base}/accounting`);
  const hasCurrentOrgCoachAccess = useCurrentOrgCoachAccess(currentOrgSlug, isRepTeams);
  const showTournamentSummary = currentTournament?.status === 'completed' || currentTournament?.status === 'archived';

  // Derive sections from shared config so labels stay in sync with the desktop sidebar.
  const opsItems   = TOUR_GROUPS.find(g => g.key === 'operations')!.items;
  const setupItems = TOUR_GROUPS.find(g => g.key === 'setup')!.items;
  const adminItems = TOUR_GROUPS.find(g => g.key === 'admin')!.items;

  // Lifecycle-aware primary tabs. Dashboard lives on the top-bar title ("home").
  // Draft ("getting ready") leans setup + the customer-facing page: Setup · Teams · Schedule · Site,
  // with Chat demoted to More (no audience pre-launch — its unread badge bubbles up to the More tab).
  // Once live/after ("running it") it flips to game-day: Results · Check-in · Schedule · Chat.
  // Schedule holds the same (third) slot across both bars as the constant anchor; everything else,
  // including Divisions (a do-once step surfaced by the setup checklist) and Dashboard, stays under "More".
  const resultsPhase = tournamentIsLive || currentTournament?.status === 'archived';
  const opsByKey = new Map(opsItems.map(i => [i.key, i]));
  const setupByKey = new Map(setupItems.map(i => [i.key, i]));
  // Event Settings is owner/admin-only. For roles that can't open it (staff/official/treasurer),
  // lead the draft bar with Divisions instead — a build step they can actually use.
  const eventSettings = setupByKey.get('settings/event');
  const canSeeEventSettings = !eventSettings?.roles || eventSettings.roles.includes(userRole ?? '');
  const draftLead = canSeeEventSettings
    ? withBarLabel(eventSettings, 'Setup')
    : setupByKey.get('divisions');
  const primaryDefs: TourNavItem[] = (resultsPhase
    ? [opsByKey.get('results'), opsByKey.get('check-in'), opsByKey.get('schedule'), opsByKey.get('chat')]
    : [
        draftLead,
        opsByKey.get('registrations'),
        opsByKey.get('schedule'),
        withBarLabel(setupByKey.get('branding'), 'Site', Globe),
      ]
  ).filter((i): i is TourNavItem => Boolean(i));
  const PRIMARY_KEYS = primaryDefs.map(prefixKey);
  const primaryKeys = new Set(primaryDefs.map(i => i.key));
  const chatIsPrimary = primaryKeys.has('chat');
  const operationsMoreBase = opsItems.filter(i => !primaryKeys.has(i.key)).map(prefixKey);
  const operationsMore: NavItem[] = showTournamentSummary
    ? [...operationsMoreBase, { key: 'tournaments/summary', icon: FileText, label: 'Summary' }]
    : operationsMoreBase;
  const setupMore = setupItems
    .filter(item => !item.roles || item.roles.includes(userRole ?? ''))
    .filter(item => !primaryKeys.has(item.key)) // Event Settings + Public Site are primary tabs pre-live; the rest (incl. Divisions) list here
    .map(prefixKey);
  const adminMore = adminItems.map(prefixKey);

  const allMoreKeys = [...operationsMore, ...setupMore, ...adminMore];

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

  function dropNavItems(items: NavItem[]) {
    return items.map(({ key, icon: Icon, label }) => {
      const href   = key ? `${base}/${key}` : base;
      const active = key === ''
        ? pathname === base
        : pathname === href || pathname.startsWith(href + '/');
      const unread = key === 'tournaments/chat' ? moreChatUnread : 0;
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
          {unread > 0 && (
            <span className={styles.dropCount} aria-label={`${unread > 9 ? '9+' : unread} unread`}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
          <ChevronRight size={14} className={styles.dropChevron} />
        </Link>
      );
    });
  }

  // Section-aware primary tabs
  const modulePrimaryTabs = isRepTeams
    ? [
        { href: `${base}/rep-teams`,   icon: Users,      label: 'Rep Teams'  },
        ...(hasCurrentOrgCoachAccess
          ? [{ href: `/${orgSlug}/coaches`, icon: UserCheck, label: 'Coaches' }]
          : []),
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

  // Chat unread — only in tournament-ops mode (where the Chat tab lives).
  const chatUnread = useChatUnread(!modulePrimaryTabs);
  // When Chat isn't a primary tab (draft phase), its unread badge bubbles up to the More tab + its row inside More.
  const moreChatUnread = !chatIsPrimary ? chatUnread : 0;

  return (
    <nav className={styles.bottomNav} aria-label="Admin mobile navigation">
      {!modulePrimaryTabs && <AdminContextStrip />}
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
          const count  = worklist[key.replace(/^tournaments\//, '')] ?? 0;
          return (
            <Link
              key={key}
              href={href}
              className={`${styles.tab} ${active ? styles.active : ''}`}
              id={`admin-mob-${label.toLowerCase()}`}
              aria-label={key === 'tournaments/chat' && chatUnread > 0 ? `${label}, ${chatUnread > 9 ? '9+' : chatUnread} unread` : undefined}
            >
              <span className={styles.iconWrap}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {active && <span className={styles.activeDot} />}
                {count > 0 && <span className={styles.tabCount}>{count > 9 ? '9+' : count}</span>}
                {key === 'tournaments/chat' && chatUnread > 0 && (
                  <span className={styles.tabCount} style={{ background: 'var(--logic-lime)', color: 'var(--pitch-black)' }}>
                    {chatUnread > 9 ? '9+' : chatUnread}
                  </span>
                )}
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
          aria-label={moreChatUnread > 0
            ? `More, ${moreChatUnread > 9 ? '9+' : moreChatUnread} unread chat ${moreChatUnread === 1 ? 'message' : 'messages'}`
            : undefined}
        >
          <span className={styles.iconWrap}>
            {moreOpen
              ? <X size={22} strokeWidth={2} />
              : <MoreHorizontal size={22} strokeWidth={isMoreActive ? 2.5 : 1.8} />
            }
            {isMoreActive && !moreOpen && <span className={styles.activeDot} />}
            {moreChatUnread > 0 && !moreOpen && (
              <span className={styles.tabCount} style={{ background: 'var(--logic-lime)', color: 'var(--pitch-black)' }}>
                {moreChatUnread > 9 ? '9+' : moreChatUnread}
              </span>
            )}
          </span>
          <span className={styles.label}>More</span>
        </button>

        {moreOpen && (
          <div className={styles.dropdown} role="menu">

            {/* Tournament switcher */}
            {tournaments.length > 0 && (
              <div className={styles.tournamentBlock}>
                <span className={styles.blockLabel}>Current tournament</span>
                {tournaments.length > 1 ? (
                  <div className={styles.seasonSelectShell}>
                    <select
                      className={styles.seasonSelect}
                      value={currentTournament?.id ?? ''}
                      onChange={e => handleTournamentChange(e.target.value)}
                      id="admin-mob-tournament-select"
                      aria-label="Current tournament"
                    >
                      {tournaments.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.isActive ? ' - Live' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className={styles.seasonChevron} aria-hidden />
                  </div>
                ) : (
                  <span className={styles.switcherName}>{currentTournament?.name}</span>
                )}
                {currentTournament && !currentTournament.isActive && (
                  <Link
                    className={styles.setLiveBtn}
                    href={`${base}/tournaments/dashboard`}
                    id="admin-mob-review-launch"
                  >
                    {inactiveTournamentCtaLabel}
                  </Link>
                )}
                {currentTournament?.isActive && (
                  <span className={styles.livePill}>● Live</span>
                )}
              </div>
            )}

            <div className={styles.dropDivider} />

            <div className={styles.dropSectionLabel}>Operations</div>
            {dropNavItems(operationsMore)}

            <div className={styles.dropDivider} />

            <div className={styles.dropSectionLabel}>Setup</div>
            {dropNavItems(setupMore)}

            <div className={styles.dropDivider} />

            <div className={styles.dropSectionLabel}>Admin</div>
            {dropNavItems(adminMore)}

            <div className={styles.dropDivider} />

            {currentTournament && (
              <Link
                className={`${styles.dropItem} ${styles.dropUtilItem}`}
                href={tournamentIsLive
                  ? `/${orgSlug}/${currentTournament.slug}`
                  : `/${orgSlug}/admin/tournaments/preview/${currentTournament.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                id="admin-mob-preview-site"
                title={tournamentPreviewTitle}
                aria-label={`${tournamentPreviewLabel} opens in a new tab`}
                role="menuitem"
              >
                <ExternalLink size={15} />
                <span>{tournamentPreviewLabel}</span>
              </Link>
            )}

            <button
              className={styles.dropItem}
              onClick={() => { setMoreOpen(false); setFeedbackOpen(true); }}
              role="menuitem"
              id="admin-mob-feedback"
            >
              <MessageSquarePlus size={17} />
              <span>Send feedback</span>
            </button>

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

      {/* Rendered at the nav root (not inside the transient More dropdown) so the modal survives
          the dropdown closing on outside-click — it portals to <body> and owns its own state. */}
      <FeedbackWidget open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </nav>
  );
}
