'use client';
/**
 * CoachFreeBottomNav — the free Coaches Portal's phone bar and its More sheet (Free coach header parity, the
 * phone step; owner direction and rulings 2026-10-15, hub "Phone" screens 2–5).
 *
 * ⚠ THE SKIN IS THE PAID BAR'S OWN STYLESHEET, imported, not copied (`CoachesBottomNav.module.css`) — the
 * admin's phone bar's pattern (2026-09-29), chosen for this one by the owner at build start (B1): the 72px
 * bar, its tabs and counts, the More sheet rising over a scrim with the bar still visible and tappable (a
 * MENU sits on the bar, the 2026-09-23 drawer-layers ruling), the tiles, rows, groups and foot, Warm and Dark.
 * One stylesheet is the only way the phone bars cannot drift; this file owns only what the free portal says.
 *
 * ⚖ FOUR TABS, FIXED: Overview · Tournaments · Chat · More, in the paid bar's look, order and mixed case. The
 * bar never changes as tools are turned on — a turned-on tool is a tile in More (owner: "when they add the
 * basic modules we just add them to more"). Chat hides while the coach has no chat and none is coming (P2:
 * the 10-13 A1 rule, the left menu's answer, `useChatDoor`).
 *
 * ⚖ MORE, in order: Notifications first, with the free bell's unread count (the paid sheet's first row and
 * `dropCount`); the team's turned-on tools as tiles in the tools' own order, Explore ALWAYS the last tile
 * (P3); "You" — Home, Scores, Account (the fan app's doors, two taps away by the owner's accepted cost; the
 * label is the admin More sheet's for the same kind of group — owner, on /marketing's recommendation, 2026-10-16);
 * then the paid foot, Help · Sign out. The count rides More while the sheet is shut (the paid bar's place).
 *
 * The overlay safety net is the paid portal's (B2): `CoachesOverlayProvider` is mounted by the free layout,
 * so a FORM-layer surface takes this bar out of reach of thumb, keyboard and screen reader.
 *
 * Which team it points at, and whether it shows at all, is the shell's call (`resolveFreeBarTeam` in
 * lib/coach-free-nav.ts); what it lights is `freeSectionActive` / `freeMoreActive` from the same file, the
 * rules the computer's left menu reads.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid, Trophy, MessageSquare, MoreHorizontal, X, Bell, Compass, Home, Radio, User,
  HelpCircle, LogOut, ChevronRight, MessageSquarePlus, Download,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';
import { isStandalonePWA } from '@/lib/device';
import { useAnyOverlayOpen } from '@/lib/coaches-overlay';
import { useDismissable } from '@/lib/overlay-hooks';
import { useNotificationUnread } from '@/lib/use-notification-unread';
import { TEAM_COACH_BELL } from '@/lib/notification-bell-scope';
import { coachTeamToolPath, coachTeamToolSub } from '@/lib/coach-team-tools';
import { COACHES_HELP_PATH, COACHES_NOTIFICATIONS_PATH, coachTeamPath } from '@/lib/coaches-portal-routes';
import { freeMoreActive, freeSectionActive, freeTeamTools, type FreeNavTeam } from '@/lib/coach-free-nav';
import styles from './CoachesBottomNav.module.css';

const badge = (n: number): string => (n > 9 ? '9+' : String(n));
const noSubscribe = () => () => {};

/** The marker the shell's keyboard rule finds the bar by (a focused field hides it — see the shell's CSS). */
const FREE_BAR_ATTR = { 'data-free-coach-bar': '' } as const;

export default function CoachFreeBottomNav({
  team,
  showChat,
  chatUnread,
}: {
  /** The team the bar points at; null = still loading, the bar's empty band (its tabs arrive together). */
  team: FreeNavTeam | null;
  showChat: boolean;
  chatUnread: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Installed as the app? Nothing to install then. Read after hydration (the server says no).
  const isStandalone = useSyncExternalStore(noSubscribe, isStandalonePWA, () => false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { count: notifUnread } = useNotificationUnread(TEAM_COACH_BELL);
  // The paid portal's safety net (B2): hidden — out of the thumb's, the keyboard's and the screen reader's
  // reach, with no layout shift — while a form-layer surface is open over the page.
  const anyOverlayOpen = useAnyOverlayOpen();

  useDismissable(moreOpen, moreRef, () => setMoreOpen(false)); // also Escape-to-close
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMoreOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
  }

  const navClass = `${styles.bottomNav}${anyOverlayOpen ? ` ${styles.navHidden}` : ''}`;
  if (!team) return <nav className={navClass} aria-label="Team navigation" aria-busy="true" {...FREE_BAR_ATTR} />;

  const base = coachTeamPath(team.id);
  const tabs = [
    // The Overview grid, the left menu's and the paid bar's (the nav standard's N5).
    { key: 'overview', sub: '', icon: LayoutGrid, label: 'Overview' },
    { key: 'tournaments', sub: '/tournaments', icon: Trophy, label: 'Tournaments' },
    ...(showChat ? [{ key: 'chat', sub: '/chat', icon: MessageSquare, label: 'Chat' }] : []),
  ];
  const tools = freeTeamTools(team);
  const exploreSub = '/explore';
  const moreActive = freeMoreActive(pathname, team);
  const onNotifications = pathname === COACHES_NOTIFICATIONS_PATH;
  const close = () => setMoreOpen(false);

  return (
    <nav className={navClass} aria-label="Team navigation" {...FREE_BAR_ATTR}>
      {tabs.map(({ key, sub, icon: Icon, label }) => {
        const active = freeSectionActive(pathname, team, sub);
        const isChat = key === 'chat';
        return (
          <Link
            key={key}
            href={`${base}${sub}`}
            className={`${styles.tab}${active ? ` ${styles.active}` : ''}`}
            id={`free-mob-${key}`}
            aria-current={active ? 'page' : undefined}
            aria-label={isChat && chatUnread > 0 ? `Chat, ${badge(chatUnread)} unread` : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} aria-hidden />
              {active && <span className={styles.activeDot} />}
              {isChat && chatUnread > 0 && <span aria-hidden className={styles.tabCount}>{badge(chatUnread)}</span>}
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}

      <div ref={moreRef} className={styles.moreWrap}>
        <button
          type="button"
          className={`${styles.tab}${moreOpen || moreActive ? ` ${styles.active}` : ''}`}
          onClick={() => setMoreOpen(o => !o)}
          id="free-mob-more"
          aria-haspopup="true"
          aria-expanded={moreOpen}
          aria-label={!moreOpen && notifUnread > 0 ? `More, ${badge(notifUnread)} unread notifications` : undefined}
        >
          <span className={styles.iconWrap}>
            {moreOpen
              ? <X size={22} strokeWidth={2} aria-hidden />
              : <MoreHorizontal size={22} strokeWidth={moreActive ? 2.5 : 1.8} aria-hidden />}
            {moreActive && !moreOpen && <span className={styles.activeDot} />}
            {/* The bell's count rides More while the sheet is shut; open, the Notifications row carries it. */}
            {!moreOpen && notifUnread > 0 && <span aria-hidden className={styles.tabCount}>{badge(notifUnread)}</span>}
          </span>
          <span className={styles.label}>More</span>
        </button>

        {moreOpen && (
          <>
            {/* Inside `moreRef` on purpose, as on the paid bar: `useDismissable` counts a tap in the ref as inside. */}
            <div className={styles.sheetScrim} aria-hidden onClick={close} />
            <div className={styles.dropdown} role="menu">
              <span className={styles.sheetGrab} aria-hidden />

              <Link
                className={`${styles.dropItem}${onNotifications ? ` ${styles.dropActive}` : ''}`}
                href={COACHES_NOTIFICATIONS_PATH}
                onClick={close}
                role="menuitem"
                id="free-mob-notifications"
              >
                <Bell size={17} aria-hidden />
                <span>Notifications</span>
                {notifUnread > 0 && (
                  <span className={styles.dropCount} aria-label={`${badge(notifUnread)} unread`}>{badge(notifUnread)}</span>
                )}
              </Link>
              <div className={styles.dropDivider} />

              {/* The team's tools — what the bar does not carry. Explore last, always: the door to the rest. */}
              <div className={styles.hotTiles} role="group" aria-label="Your team's tools">
                {tools.map(({ key, label, Icon }) => {
                  const active = freeSectionActive(pathname, team, coachTeamToolSub(key));
                  return (
                    <Link
                      key={key}
                      href={coachTeamToolPath(team.id, key)}
                      className={`${styles.hotTile}${active ? ` ${styles.dropActive}` : ''}`}
                      role="menuitem"
                      id={`free-mob-${key}`}
                      onClick={close}
                    >
                      <Icon size={20} aria-hidden />
                      <span>{label}</span>
                    </Link>
                  );
                })}
                <Link
                  href={`${base}${exploreSub}`}
                  className={`${styles.hotTile} ${styles.hotTileAdd}${freeSectionActive(pathname, team, exploreSub) ? ` ${styles.dropActive}` : ''}`}
                  role="menuitem"
                  id="free-mob-explore"
                  onClick={close}
                >
                  <Compass size={20} aria-hidden />
                  <span>Explore</span>
                </Link>
              </div>

              <div className={styles.dropSection}>
                <div className={styles.dropSectionLabel}>You</div>
                <div className={styles.dropGrid} data-cols="2">
                  <Link className={styles.dropItem} href="/discover" role="menuitem" id="free-mob-home" onClick={close}>
                    <Home size={17} aria-hidden /><span>Home</span>
                  </Link>
                  <Link className={styles.dropItem} href="/scores" role="menuitem" id="free-mob-scores" onClick={close}>
                    <Radio size={17} aria-hidden /><span>Scores</span>
                  </Link>
                  {/* `?back=` pins "Back to your Coaches Portal" over the account pages (AccountReturnBar). */}
                  <Link
                    className={styles.dropItem}
                    href={`/account?back=${encodeURIComponent(pathname)}`}
                    role="menuitem"
                    id="free-mob-account"
                    onClick={close}
                  >
                    <User size={17} aria-hidden /><span>Account</span>
                  </Link>
                </div>
              </div>

              <div className={styles.dropDivider} />
              <div className={styles.dropGrid} data-cols="2">
                <Link
                  href={COACHES_HELP_PATH}
                  className={styles.dropItem}
                  role="menuitem"
                  id="free-mob-help"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                >
                  <HelpCircle size={17} aria-hidden />
                  <span>Help</span>
                  <ChevronRight size={14} className={styles.dropChevron} aria-hidden />
                </Link>
                {/* Send feedback, as on every operator sheet (the nav standard's N7, Ask B2): the account menu that holds it
                    on a computer is hidden on a phone. */}
                <button
                  type="button"
                  className={styles.dropItem}
                  role="menuitem"
                  id="free-mob-feedback"
                  onClick={() => { close(); setFeedbackOpen(true); }}
                >
                  <MessageSquarePlus size={17} aria-hidden />
                  <span>Send feedback</span>
                </button>
                {/* Only where the phone can install it (the shell's InstallAppPrompt listens). */}
                {!isStandalone && (
                  <button
                    type="button"
                    className={styles.dropItem}
                    role="menuitem"
                    id="free-mob-download-app"
                    onClick={() => { close(); window.dispatchEvent(new Event('flhq:show-install')); }}
                  >
                    <Download size={17} aria-hidden />
                    <span>Download app</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.dropItem} ${styles.dropLogout}`}
                  onClick={handleSignOut}
                  role="menuitem"
                  id="free-mob-logout"
                >
                  <LogOut size={17} aria-hidden />
                  <span>Sign out</span>
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
