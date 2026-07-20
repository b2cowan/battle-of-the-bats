'use client';
/**
 * components/consumer/ConsumerNav.tsx
 *
 * Primary navigation for the consumer shell (Unified Home IA redesign, Phase 0).
 * Renders an app-like top bar and a mobile bottom tab bar — the same responsive
 * pattern the rest of the site uses (top links ≥900px, bottom nav below).
 *
 * Tabs: Home / Scores / Chat / Account (identical shape signed-in vs signed-out).
 * Home lives at /discover (the canonical, SEO-bearing directory URL — unchanged);
 * only its label/icon change. It absorbs the retired Discover + Following tabs and
 * the /home workspace launchpad. On desktop the header also carries the organizer
 * affordances (Run a tournament + coach pill + Sign in) so desktop visitors who
 * land here from search can still convert or sign in. The old "Your workspaces"
 * utility link is gone — Home now carries the workspaces list.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Radio, MessageCircle, User } from 'lucide-react';
import { useChatUnread } from '@/lib/use-chat-unread';
import { usePendingInviteCount } from '@/lib/use-pending-invites';
import { isConsumerShellPath } from '@/lib/consumer-routes';
import styles from './ConsumerShell.module.css';
import warm from './warmTheme.module.css';

const TABS = [
  { href: '/discover', label: 'Home', icon: Home },
  { href: '/scores', label: 'Scores', icon: Radio },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/account', label: 'Account', icon: User },
] as const;

// The nav skin follows the content (Phase 5). The warm surfaces are exactly the consumer-shell
// tabs — so we reuse `isConsumerShellPath` (the single source of truth the layout/SiteChrome/Footer
// already share) rather than a second hardcoded route list that could silently drift when a tab is
// added. The consumer shell ALSO wraps the auth / select-org / suspended pages, which `isConsumerShellPath`
// correctly excludes, so they stay dark. Every consumer-shell content surface — including the
// notification-settings sub-page (warmed alongside the Account tab) — now paints warm, so navigating
// within the app never flips theme.
const underPrefix = (path: string, p: string) => path === p || path.startsWith(p + '/');

export default function ConsumerNav({
  signedIn = false,
  isCoach = false,
}: {
  signedIn?: boolean;
  /** Account has a coach context (Basic or Premium) — surfaces the coaches hub
   *  in the desktop utility area (Phase 3). Mobile stays four tabs; the Account
   *  tab carries the same door there. */
  isCoach?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => underPrefix(pathname, href);
  const warmRoute = isConsumerShellPath(pathname);

  // Unified cross-tab badge policy (Phase 5, owner-ratified): a red count means "something is
  // waiting for you to act." Two tabs qualify — Chat unread (rolled up, self-muted rooms excluded
  // server-side; R3-1) and Home pending team/org invitations. Scores carries NO nav badge: its
  // "Live · N" already lives in-page, and a badge lit every game-day would dull the red's meaning.
  // Signed-out visitors fetch neither. Keyed by href so both nav loops read `badges[href]`.
  const chatUnread = useChatUnread(signedIn);
  const pendingInvites = usePendingInviteCount(signedIn);
  const cap = (n: number) => (n > 9 ? '9+' : String(n));
  const badges: Record<string, string | null> = {
    '/discover': pendingInvites > 0 ? cap(pendingInvites) : null,
    '/chat': chatUnread > 0 ? cap(chatUnread) : null,
  };
  // Distinct screen-reader phrasing per badge so the count stays meaningful (invites vs unread).
  const badgeNoun: Record<string, string> = { '/discover': 'pending invitations', '/chat': 'unread' };

  const topbarCls = `${styles.topbar}${warmRoute ? ` ${warm.warmVars} ${styles.topbarWarm}` : ''}`;
  const bottomNavCls = `${styles.bottomNav}${warmRoute ? ` ${warm.warmVars} ${styles.bottomNavWarm}` : ''}`;

  return (
    <>
      <header id="consumer-topbar" className={topbarCls}>
        <div className={styles.topLeft}>
          <Link href="/discover" className={styles.wordmark} aria-label="FieldLogicHQ home">
            <span className={styles.wm1}>FIELD</span>
            <span className={styles.wm2}>LOGIC</span>
            <span className={styles.wm3}>HQ</span>
          </Link>
          <nav className={styles.topNav} aria-label="Primary">
            {TABS.map(({ href, label }) => {
              const active = isActive(href);
              const badge = badges[href];
              return (
                <Link
                  key={href}
                  href={href}
                  className={`${styles.topLink} ${active ? styles.active : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {label}
                  {badge && <span className={styles.topBadge} aria-label={`${badge} ${badgeNoun[href] ?? 'unread'}`}>{badge}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={styles.topUtil}>
          <Link href="/start" className={styles.utilLink}>Run a tournament</Link>
          {signedIn && isCoach && (
            <Link href="/coaches" className={styles.utilCoach}>Coaches Portal</Link>
          )}
          {/* "Your workspaces" retired — Home carries the workspaces list now.
             Signed-out visitors keep a "Sign in" affordance (never ON the sign-in pages). */}
          {!signedIn && !pathname.startsWith('/auth') && (
            <Link href="/auth/login" className={styles.utilCta}>Sign in</Link>
          )}
        </div>
      </header>

      <nav className={bottomNavCls} aria-label="Primary">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          const badge = badges[href];
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.tab} ${active ? styles.active : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.iconWrap}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {active && <span className={styles.activeDot} />}
                {badge && <span className={styles.tabBadge} aria-label={`${badge} ${badgeNoun[href] ?? 'unread'}`}>{badge}</span>}
              </span>
              <span className={styles.label}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
