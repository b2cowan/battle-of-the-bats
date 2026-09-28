'use client';
/**
 * AdminKitBottomNav — the admin's phone bar and More menu on the coaches portal's kit (Admin Design
 * Continuity slice 1). Renders ONLY with the switch on (`AdminChrome` picks it over `AdminBottomNav`).
 *
 * ⚠ THE SKIN IS THE COACH BAR'S OWN STYLESHEET, imported, not copied (`CoachesBottomNav.module.css`):
 * the 72px bar, its tabs, the More sheet that rises over a scrim while the bar stays visible and
 * tappable (the drawer-layers ruling, 2026-09-23: a MENU sits on top of the bar), its warm and dark
 * skins. One stylesheet is the only way two phone bars cannot drift.
 *
 * ⚠ TWO BARS, chosen by where you are (ratified club Stage 1 specimen 4, ADC specimen 4):
 *   · the CLUB bar everywhere outside a tournament — Overview, the club's first three programs,
 *     More. The same bar on every club screen; the program you are in lights up. (Today Families and
 *     the hub wear the TOURNAMENT bar, J4-045 / A12 — the defect this replaces.)
 *   · the TOURNAMENT bar inside a tournament, and always for a tournament-only organization — today's
 *     tabs in today's order (Setup · Teams · Schedule · Site before launch; Results · Check-in ·
 *     Schedule · Chat once live), today's counts and today's context strip above them. A club's More
 *     gains "Back to club" at its top.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ElementType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid, MoreHorizontal, X, ChevronRight, LogOut, Bell, Globe, Download,
  MessageSquarePlus, Home, User, UserCheck, ArrowLeft, Lock,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { isStandalonePWA } from '@/lib/device';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { useAdminWorklist } from '@/lib/admin-worklist';
import { useChatUnread } from '@/lib/use-chat-unread';
import { useAdminFlip } from '@/lib/use-admin-flip';
import { primaryTarget } from '@/lib/flip-twins';
import { useDismissable } from '@/lib/overlay-hooks';
import type { TourNavItem } from '@/components/admin/admin-nav-config';
import AdminContextStrip from '@/components/admin/AdminContextStrip';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';
import { isKitLinkActive, kitTournamentLabel, type KitLink, type KitLockedRow } from '@/lib/admin-kit-nav';
import { useAdminKitNav } from './useAdminKitNav';
import { briefProgramCount } from './club/ClubBriefProvider';
import styles from '@/components/coaches/CoachesBottomNav.module.css';
import kit from './AdminKitFrame.module.css';

const badge = (n: number): string => (n > 9 ? '9+' : String(n));
const noSubscribe = () => () => {};

type Tab = { key: string; href: string; icon: ElementType; label: string; active: boolean; count?: number; chat?: boolean };

export default function AdminKitBottomNav({ notifUnread = 0 }: { notifUnread?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = useAdminKitNav();
  const { base, programs, alsoOnPlan, brief, orgLinks, orgLockedRows, tournamentOnly, onTournaments, isCanceled, coachDoor, tournamentGroups } = nav;
  const { currentOrg } = useOrg();
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();
  const worklist = useAdminWorklist();
  const flip = useAdminFlip();
  const mirror = flip ? primaryTarget(flip) : null;
  const tournamentBar = onTournaments || tournamentOnly;
  const chatUnread = useChatUnread(tournamentBar);

  const [moreOpen, setMoreOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  // Installed as the app? Nothing to install then. Read after hydration (the server says no).
  const isStandalone = useSyncExternalStore(noSubscribe, isStandalonePWA, () => false);
  useDismissable(moreOpen, moreRef, () => setMoreOpen(false));
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMoreOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
  }

  // ── The tournament bar: today's lifecycle-aware tabs, from the SAME groups the rail lists ──────
  // (sandbox-curated, role-gated, Summary once the event is over — `kit-tournament-groups.ts`).
  const groupItems = (key: string) => tournamentGroups.find(g => g.key === key)?.items ?? [];
  const opsByKey = new Map(groupItems('operations').map(i => [i.key, i]));
  const setupByKey = new Map(groupItems('setup').map(i => [i.key, i]));
  const live = currentTournament?.status === 'active' || currentTournament?.status === 'completed';
  const resultsPhase = live || currentTournament?.status === 'archived';
  // Event Settings is owner/admin-only, so for any other role it is already gone from the groups;
  // those roles lead the draft bar with Divisions instead — today's rule.
  const eventSettings = setupByKey.get('settings/event');
  const relabel = (item: TourNavItem | undefined, label: string, icon?: ElementType): TourNavItem | undefined =>
    (item ? { ...item, label, ...(icon ? { icon: icon as TourNavItem['icon'] } : {}) } : undefined);
  const tourPrimary: TourNavItem[] = (resultsPhase
    ? [opsByKey.get('results'), opsByKey.get('check-in'), opsByKey.get('schedule'), opsByKey.get('chat')]
    : [
        eventSettings ? relabel(eventSettings, 'Setup') : setupByKey.get('divisions'),
        opsByKey.get('registrations'),
        opsByKey.get('schedule'),
        relabel(setupByKey.get('branding'), 'Site', Globe),
      ]).filter((i): i is TourNavItem => Boolean(i));
  const primaryKeys = new Set(tourPrimary.map(i => i.key));
  const chatIsPrimary = primaryKeys.has('chat');
  // More lists every group row the bar does not already show as a tab.
  const tourMoreGroups: { header: string; items: KitLink[] }[] = tournamentGroups
    .map(g => ({
      header: g.label,
      items: g.items
        .filter(i => !primaryKeys.has(i.key))
        .map(i => ({ key: i.key, label: kitTournamentLabel(i.label), href: `${base}/tournaments/${i.key}` })),
    }))
    .filter(g => g.items.length > 0);

  // ── The club bar: Overview + the first three programs + More ─────────────────────────────────
  // The programs arrive in the plan-aware order (what the club runs first); what the plan carries
  // but the club does not run yet follows them in More's "More programs" (specimen 4).
  const clubTabs = programs.slice(0, 3);
  const morePrograms = [...programs.slice(3), ...alsoOnPlan];

  const tabs: Tab[] = tournamentBar
    ? tourPrimary.map(i => {
        const href = `${base}/tournaments/${i.key}`;
        return {
          key: i.key, href, icon: i.icon, label: i.label,
          active: pathname === href || pathname.startsWith(`${href}/`),
          count: worklist[i.key] ?? 0,
          chat: i.key === 'chat',
        };
      })
    : [
        ...(isCanceled ? [] : [{ key: 'overview', href: base, icon: LayoutGrid, label: 'Overview', active: pathname === base }]),
        ...(isCanceled ? [] : clubTabs.map(p => ({
          key: p.key, href: p.href, icon: p.icon, label: p.label,
          active: nav.section === p.key,
          // The morning brief's waiting items — the number the hub's door and the rail show.
          count: briefProgramCount(brief, p.key),
        }))),
      ];

  const moreLinks: KitLink[] = tournamentBar
    ? tourMoreGroups.flatMap(g => g.items)
    : [...morePrograms.map(p => ({ key: p.key, label: p.label, href: p.href })), ...orgLinks];
  const moreActive = moreLinks.some(l => isKitLinkActive(pathname, l))
    || (!tournamentBar && nav.section === 'org')
    || pathname === `${base}/notifications`;
  const moreChat = tournamentBar && !chatIsPrimary ? chatUnread : 0;
  const moreBadge = moreChat + notifUnread;

  const row = (l: KitLink, icon?: ElementType, count = 0) => {
    const Icon = icon;
    const active = isKitLinkActive(pathname, l);
    return (
      <Link
        key={l.key}
        href={l.href}
        className={`${styles.dropItem}${active ? ` ${styles.dropActive}` : ''}`}
        role="menuitem"
        onClick={() => setMoreOpen(false)}
      >
        {Icon && <Icon size={17} aria-hidden />}
        <span>{l.label}</span>
        {count > 0 && <span className={styles.dropCount} aria-label={`${badge(count)} unread`}>{badge(count)}</span>}
        <ChevronRight size={14} className={styles.dropChevron} aria-hidden />
      </Link>
    );
  };
  // An owner's area, as a non-owner sees it: a LOCKED row that says whose it is (J10-016; the rail
  // shows the same rows — /review 2026-09-26: the phone sheet must not simply drop them). Not a link.
  const lockedRow = (r: KitLockedRow) => {
    const Icon = r.icon;
    return (
      <div key={r.key} className={`${styles.dropItem} ${kit.dropLocked}`} role="menuitem" aria-disabled="true" aria-label={`${r.label}, owner only`}>
        <Icon size={17} aria-hidden />
        <span>{r.label}</span>
        <span className={kit.dropLockedNote}><Lock size={11} aria-hidden /> Owner only</span>
      </div>
    );
  };
  const group = (header: string, items: KitLink[], icons?: Map<string, ElementType>, locked: KitLockedRow[] = []) => (items.length > 0 || locked.length > 0) && (
    <div key={header} className={styles.dropSection}>
      <div className={styles.dropSectionLabel}>{header}</div>
      <div className={styles.dropGrid} data-cols={items.length + locked.length > 1 ? 2 : 1}>
        {items.map(l => row(l, icons?.get(l.key) ?? l.icon, l.key === 'chat' ? moreChat : 0))}
        {locked.map(lockedRow)}
      </div>
    </div>
  );
  const programIcons = new Map<string, ElementType>([...programs, ...alsoOnPlan].map(p => [p.key, p.icon]));

  return (
    <nav className={`${styles.bottomNav} ${kit.bar}`} aria-label="Admin mobile navigation">
      {tournamentBar && <AdminContextStrip />}

      {tabs.map(t => (
        <Link
          key={t.key}
          href={t.href}
          className={`${styles.tab}${t.active ? ` ${styles.active}` : ''}`}
          id={`admin-mob-${t.label.toLowerCase().replace(/\s+/g, '-')}`}
          aria-current={t.active ? 'page' : undefined}
          aria-label={t.chat && chatUnread > 0 ? `${t.label}, ${badge(chatUnread)} unread` : undefined}
        >
          <span className={styles.iconWrap}>
            <t.icon size={22} strokeWidth={t.active ? 2.5 : 1.8} aria-hidden />
            {t.active && <span className={styles.activeDot} />}
            {(t.count ?? 0) > 0 && <span aria-hidden className={styles.tabCount}>{badge(t.count!)}</span>}
            {t.chat && chatUnread > 0 && <span aria-hidden className={styles.tabCount}>{badge(chatUnread)}</span>}
          </span>
          <span className={styles.label}>{t.label}</span>
        </Link>
      ))}

      <div ref={moreRef} className={styles.moreWrap}>
        <button
          type="button"
          className={`${styles.tab}${moreOpen || moreActive ? ` ${styles.active}` : ''}`}
          onClick={() => setMoreOpen(o => !o)}
          id="admin-mob-more"
          aria-haspopup="true"
          aria-expanded={moreOpen}
          aria-label={!moreOpen && moreBadge > 0 ? `More, ${badge(moreBadge)} unread` : undefined}
        >
          <span className={styles.iconWrap}>
            {moreOpen ? <X size={22} strokeWidth={2} aria-hidden /> : <MoreHorizontal size={22} strokeWidth={moreActive ? 2.5 : 1.8} aria-hidden />}
            {moreActive && !moreOpen && <span className={styles.activeDot} />}
            {!moreOpen && moreBadge > 0 && <span aria-hidden className={styles.tabCount}>{badge(moreBadge)}</span>}
          </span>
          <span className={styles.label}>More</span>
        </button>

        {moreOpen && (
          <>
            <div className={styles.sheetScrim} aria-hidden onClick={() => setMoreOpen(false)} />
            <div className={styles.dropdown} role="menu">
              <span className={styles.sheetGrab} aria-hidden />

              {tournamentBar && !tournamentOnly && (
                <>
                  <Link className={styles.dropItem} href={base} role="menuitem" id="admin-mob-back-to-club" onClick={() => setMoreOpen(false)}>
                    <ArrowLeft size={17} aria-hidden />
                    <span>Back to club</span>
                  </Link>
                  <div className={styles.dropDivider} />
                </>
              )}

              {currentOrg?.id && (
                <>
                  <Link
                    className={`${styles.dropItem}${pathname === `${base}/notifications` ? ` ${styles.dropActive}` : ''}`}
                    href={`${base}/notifications`}
                    role="menuitem"
                    id="admin-mob-notifications"
                    onClick={() => setMoreOpen(false)}
                  >
                    <Bell size={17} aria-hidden />
                    <span>Notifications</span>
                    {notifUnread > 0 && <span className={styles.dropCount} aria-label={`${badge(notifUnread)} unread`}>{badge(notifUnread)}</span>}
                  </Link>
                  <div className={styles.dropDivider} />
                </>
              )}

              {tournamentBar ? (
                <>
                  {tournaments.length > 0 && (
                    <div className={styles.dropSection}>
                      <div className={styles.dropSectionLabel}>Current tournament</div>
                      <div className={kit.switcher}>
                        {tournaments.length > 1 ? (
                          <select
                            className={kit.switcherSelect}
                            value={currentTournament?.id ?? ''}
                            onChange={e => { const t = tournaments.find(x => x.id === e.target.value); if (t) setCurrentTournament(t); }}
                            id="admin-mob-tournament-select"
                            aria-label="Current tournament"
                          >
                            {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}{t.isActive ? ' - Live' : ''}</option>)}
                          </select>
                        ) : (
                          <span className={kit.switcherName}>{currentTournament?.name}</span>
                        )}
                      </div>
                      {currentTournament && !currentTournament.isActive && (
                        <Link className={styles.dropItem} href={`${base}/tournaments/dashboard`} role="menuitem" id="admin-mob-review-launch">
                          <span>{currentTournament.status === 'draft' ? 'Review launch checklist' : 'Open dashboard'}</span>
                          <ChevronRight size={14} className={styles.dropChevron} aria-hidden />
                        </Link>
                      )}
                    </div>
                  )}
                  {tourMoreGroups.map(g => group(g.header, g.items))}
                </>
              ) : (
                <>
                  {group('More programs', morePrograms.map(p => ({ key: p.key, label: p.label, href: p.href })), programIcons)}
                  {group('Organization', orgLinks, undefined, orgLockedRows)}
                </>
              )}

              <div className={styles.dropDivider} />
              <div className={styles.dropSectionLabel}>You</div>
              <div className={styles.dropGrid} data-cols="2">
                {coachDoor.show && (
                  <Link className={styles.dropItem} href={coachDoor.href} role="menuitem" id="admin-mob-coaches-portal" onClick={() => setMoreOpen(false)}>
                    <UserCheck size={17} aria-hidden /><span>Coaches Portal</span>
                  </Link>
                )}
                <Link className={styles.dropItem} href="/discover" role="menuitem" id="admin-mob-home" onClick={() => setMoreOpen(false)}>
                  <Home size={17} aria-hidden /><span>Home</span>
                </Link>
                <Link className={styles.dropItem} href="/account" role="menuitem" id="admin-mob-account" onClick={() => setMoreOpen(false)}>
                  <User size={17} aria-hidden /><span>Account</span>
                </Link>
              </div>

              <div className={styles.dropDivider} />
              <div className={styles.dropGrid} data-cols="2">
                {mirror && (
                  <Link className={styles.dropItem} href={mirror.href} role="menuitem" id="admin-mob-view-site" onClick={() => setMoreOpen(false)}>
                    <Globe size={17} aria-hidden /><span>{mirror.label}</span>
                  </Link>
                )}
                {!isStandalone && (
                  <button
                    type="button"
                    className={styles.dropItem}
                    role="menuitem"
                    id="admin-mob-download-app"
                    onClick={() => { setMoreOpen(false); window.dispatchEvent(new Event('flhq:show-install')); }}
                  >
                    <Download size={17} aria-hidden /><span>Download app</span>
                  </button>
                )}
                <button
                  type="button"
                  className={styles.dropItem}
                  role="menuitem"
                  id="admin-mob-feedback"
                  onClick={() => { setMoreOpen(false); setFeedbackOpen(true); }}
                >
                  <MessageSquarePlus size={17} aria-hidden /><span>Send feedback</span>
                </button>
                <button
                  type="button"
                  className={`${styles.dropItem} ${styles.dropLogout}`}
                  role="menuitem"
                  id="admin-mob-logout"
                  onClick={handleSignOut}
                >
                  <LogOut size={17} aria-hidden /><span>Sign out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <FeedbackWidget open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </nav>
  );
}
