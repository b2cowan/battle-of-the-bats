'use client';
/**
 * AdminKitBottomNav — the admin's phone bar and More menu on the coaches portal's kit (Admin Design
 * Continuity slice 1). The admin's only phone bar since Part B deleted the old console bar (2026-09-29).
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
 *   · the TOURNAMENT bar inside a tournament, and always for a tournament-only organization — its tabs follow the
 *     event's PHASE, the one the header shows (`tournamentBarKeys`, owner 2026-10-16), with Dashboard pinned to the
 *     left corner: Dashboard · Teams · Schedule · Site in Draft; Dashboard · Teams · Schedule · Chat while Open;
 *     Dashboard · Results · Schedule · Chat from game day on, Check-in in More. Today's counts and today's context
 *     strip sit above them. A club's More gains "Club overview" at its top. An invite-only event (the free plan, a
 *     Premium coach's event) has no Check-in or Chat, so Messages, which opens Communications, takes Chat's place
 *     (M6, the free tournament tier, 2026-10-16).
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ElementType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid, MoreHorizontal, X, ChevronRight, LogOut, Bell, Globe, Download,
  MessageSquarePlus, Home, User, Users2, HelpCircle,
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
import { isKitLinkActive, kitTournamentLabel, tournamentBarKeys, ORGANIZATION_ICON, type KitLink } from '@/lib/admin-kit-nav';
import { isGameDay, resolvePhase } from '@/lib/tournament-phase';
import { useAdminKitNav } from './useAdminKitNav';
import { briefProgramCount } from './club/ClubBriefProvider';
import { MESSAGES_TAB } from '@/lib/invite-only-words';
import styles from '@/components/coaches/CoachesBottomNav.module.css';
import kit from './AdminKitFrame.module.css';

const badge = (n: number): string => (n > 9 ? '9+' : String(n));
const noSubscribe = () => () => {};

type Tab = { key: string; href: string; icon: ElementType; label: string; active: boolean; count?: number; chat?: boolean };

export default function AdminKitBottomNav({ notifUnread = 0 }: { notifUnread?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = useAdminKitNav();
  const {
    base, programs, alsoOnPlan, brief, orgLinks, tournamentOnly, onTournaments, isCanceled, coachDoor, tournamentGroups,
    calendarLink, schedulesLink, helpHref, isSandbox,
  } = nav;
  const { currentOrg } = useOrg();
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();
  const worklist = useAdminWorklist();
  const flip = useAdminFlip();
  const mirror = flip ? primaryTarget(flip) : null;
  const tournamentBar = onTournaments || tournamentOnly;
  // Chat's unread count rides the bar only where Chat is a door (an invite-only event has none, R5).
  const chatInNav = tournamentGroups.some(g => g.items.some(i => i.key === 'chat'));
  const chatUnread = useChatUnread(tournamentBar && chatInNav);

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
  // The PHASE picks the tabs, read with the header's own rule (the dates, or the first game having started) the way
  // the context strip reads it, so the header, the board and the bar can never disagree (owner, 2026-10-16).
  const phase = currentTournament
    ? resolvePhase({
        status: currentTournament.status,
        isGameDay: isGameDay({
          startDate: currentTournament.startDate,
          endDate: currentTournament.endDate,
          firstGameStarted: Boolean(currentTournament.firstGameStarted),
        }),
      })
    : 'draft';
  const relabel = (item: TourNavItem | undefined, label: string, icon?: ElementType): TourNavItem | undefined =>
    (item ? { ...item, label, ...(icon ? { icon: icon as TourNavItem['icon'] } : {}) } : undefined);
  // Where the plan has no Chat (an invite-only event, M6), Messages (Communications) takes its place.
  const tourPrimary: TourNavItem[] = tournamentBarKeys(phase)
    .map(key =>
      key === 'branding' ? relabel(setupByKey.get('branding'), 'Site', Globe)
      : key === 'chat' ? opsByKey.get('chat') ?? relabel(opsByKey.get('communication'), MESSAGES_TAB)
      : opsByKey.get(key))
    .filter((i): i is TourNavItem => Boolean(i));
  const primaryKeys = new Set(tourPrimary.map(i => i.key));
  const chatIsPrimary = primaryKeys.has('chat');
  // More lists every group row the bar does not already show as a tab.
  const tourMoreGroups: { header: string; items: KitLink[] }[] = tournamentGroups
    .map(g => ({
      header: g.label,
      // An icon on every row, the sidebar's (N7) — the tournament's were the only sheet rows without one.
      items: g.items
        .filter(i => !primaryKeys.has(i.key))
        .map(i => ({ key: i.key, label: kitTournamentLabel(i.label), href: i.href ?? `${base}/tournaments/${i.key}`, icon: i.icon })),
    }))
    .filter(g => g.items.length > 0);

  // ── The club bar: Overview + the first three programs + More ─────────────────────────────────
  // The programs arrive in the plan-aware order (what the club runs first); what the plan carries
  // but the club does not run yet follows them in More's "More programs" (specimen 4).
  const clubTabs = programs.slice(0, 3);
  const morePrograms = [...programs.slice(3), ...alsoOnPlan];
  // ⚖ The Organization page's phone door (Ask B3): the first row of its group, where the sidebar's Organization row
  // opens it — the same gate (a club, not cancelled, with Organization rows to list).
  const orgPageLink: KitLink | null = !tournamentOnly && !isCanceled && orgLinks.length > 0
    ? { key: 'org', label: 'Organization', href: `${base}/org`, exact: true, icon: ORGANIZATION_ICON }
    : null;
  // Is the Public site program a door on this bar (a tab or a More row)? Then the live site's mirror would repeat it.
  const siteInNav = !isCanceled && [...programs, ...alsoOnPlan].some(p => p.key === 'public-site');

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
    : [...(calendarLink ? [calendarLink] : []), ...(schedulesLink ? [schedulesLink] : []), ...morePrograms.map(p => ({ key: p.key, label: p.label, href: p.href })), ...orgLinks];
  const moreActive = moreLinks.some(l => isKitLinkActive(pathname, l))
    || (!tournamentBar && nav.section === 'org')
    || pathname === `${base}/notifications`;
  const moreChat = tournamentBar && chatInNav && !chatIsPrimary ? chatUnread : 0;
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
  // Doors only, as the rail: an owner's area is not listed for anyone else (owner, 2026-10-01 —
  // the hub's Organization section says whose it is; `lib/admin-kit-nav.ts` ⚰).
  const group = (header: string, items: KitLink[]) => items.length > 0 && (
    <div key={header} className={styles.dropSection}>
      <div className={styles.dropSectionLabel}>{header}</div>
      <div className={styles.dropGrid} data-cols={items.length > 1 ? 2 : 1}>
        {items.map(l => row(l, l.icon, l.key === 'chat' ? moreChat : 0))}
      </div>
    </div>
  );

  return (
    <nav className={styles.bottomNav} aria-label="Admin mobile navigation">
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

              {/* ⚖ ONE MORE-SHEET ORDER FOR EVERY OPERATOR PORTAL (the nav standard's N7, Ask B2, 2026-10-17): (1) the place
                  you're in, a tournament only — Club overview, then the tournament picker; (2) Notifications; (3) the tiles;
                  (4) the sidebar's groups, under the sidebar's names, in its order, an icon on every row; (5) You — Account,
                  Home, the other portal; (6) Help, Send feedback, Download app, Sign out. */}
              {tournamentBar && !tournamentOnly && (
                // Named by where it goes, never "Back to…" (2026-07-31; N6, Ask A5): the club's Overview, in its icon.
                <Link className={styles.dropItem} href={base} role="menuitem" id="admin-mob-club-overview" onClick={() => setMoreOpen(false)}>
                  <LayoutGrid size={17} aria-hidden />
                  <span>Club overview</span>
                </Link>
              )}

              {currentOrg?.id && (
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
              )}

              {/* The club-wide doors — the calendar (Club Tier 6b) and the scheduler under it (11a), each with the rail's
                  gate. They span every program, so they belong to no group. */}
              {!tournamentBar && calendarLink && row(calendarLink, calendarLink.icon)}
              {!tournamentBar && schedulesLink && row(schedulesLink, schedulesLink.icon)}

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
                      {/* No "Review launch checklist" row: Dashboard, which holds the checklist, is pinned to the bar in
                          every phase (owner 2026-10-16), so More never needs a second door to it. */}
                    </div>
                  )}
                  {tourMoreGroups.map(g => group(g.header, g.items))}
                </>
              ) : (
                <>
                  {/* "Programs", the sidebar's word: you are already inside More. */}
                  {group('Programs', morePrograms.map(p => ({ key: p.key, label: p.label, href: p.href, icon: p.icon })))}
                  {group('Organization', orgPageLink ? [orgPageLink, ...orgLinks] : orgLinks)}
                </>
              )}

              <div className={styles.dropDivider} />
              <div className={styles.dropSectionLabel}>You</div>
              <div className={styles.dropGrid} data-cols="2">
                <Link className={styles.dropItem} href="/account" role="menuitem" id="admin-mob-account" onClick={() => setMoreOpen(false)}>
                  <User size={17} aria-hidden /><span>Account</span>
                </Link>
                <Link className={styles.dropItem} href="/discover" role="menuitem" id="admin-mob-home" onClick={() => setMoreOpen(false)}>
                  <Home size={17} aria-hidden /><span>Home</span>
                </Link>
                {coachDoor.show && (
                  <Link className={styles.dropItem} href={coachDoor.href} role="menuitem" id="admin-mob-coaches-portal" onClick={() => setMoreOpen(false)}>
                    <Users2 size={17} aria-hidden /><span>Coaches Portal</span>
                  </Link>
                )}
              </div>

              <div className={styles.dropDivider} />
              <div className={styles.dropGrid} data-cols="2">
                {/* Help comes to the admin phone (N7): the sidebar's guide for where you are, in a new tab. */}
                <Link className={styles.dropItem} href={helpHref} role="menuitem" id="admin-mob-help" target="_blank" rel="noopener noreferrer" onClick={() => setMoreOpen(false)}>
                  <HelpCircle size={17} aria-hidden /><span>Help</span>
                </Link>
                {/* Send feedback and Sign out are the account menu's (N4), which the demo sandbox hides: a shared demo
                    user is never signed out, and a prospect is never led out of the demo. */}
                {!isSandbox && (
                  <button
                    type="button"
                    className={styles.dropItem}
                    role="menuitem"
                    id="admin-mob-feedback"
                    onClick={() => { setMoreOpen(false); setFeedbackOpen(true); }}
                  >
                    <MessageSquarePlus size={17} aria-hidden /><span>Send feedback</span>
                  </button>
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
                {!isSandbox && (
                  <button
                    type="button"
                    className={`${styles.dropItem} ${styles.dropLogout}`}
                    role="menuitem"
                    id="admin-mob-logout"
                    onClick={handleSignOut}
                  >
                    <LogOut size={17} aria-hidden /><span>Sign out</span>
                  </button>
                )}
                {/* "Public site" once per screen (N4): the live site's door only on a club whose nav lists no Public site
                    program. Inside a tournament it goes: Setup's Public site page opens with "See your public site". */}
                {mirror && !tournamentBar && !siteInNav && (
                  <Link className={styles.dropItem} href={mirror.href} role="menuitem" id="admin-mob-view-site" onClick={() => setMoreOpen(false)}>
                    <Globe size={17} aria-hidden /><span>{mirror.label}</span>
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <FeedbackWidget open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </nav>
  );
}
