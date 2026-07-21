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
import { usePathname, useParams } from 'next/navigation';
import { Home, Radio, MessageCircle, User } from 'lucide-react';
import { useChatUnread } from '@/lib/use-chat-unread';
import { usePendingInviteCount } from '@/lib/use-pending-invites';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { isWarmSkinPath, isConsumerShellPath, showsTournamentChrome } from '@/lib/consumer-routes';
import styles from './ConsumerShell.module.css';
import warm from './warmTheme.module.css';

const TABS = [
  { href: '/discover', label: 'Home', icon: Home },
  { href: '/scores', label: 'Scores', icon: Radio },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/account', label: 'Account', icon: User },
] as const;

// The nav skin follows the content. Warm surfaces = the four consumer-shell tabs PLUS the coach
// sign-up journey (/start + /coaches/start + the post-provision success screen), via `isWarmSkinPath`
// (the single source of truth in lib/consumer-routes). Auth / select-org / suspended are excluded and
// stay dark (R1-4), so navigating within the app never flips theme mid-surface.
const underPrefix = (path: string, p: string) => path === p || path.startsWith(p + '/');

export default function ConsumerNav({
  signedIn: signedInProp = false,
  isCoach = false,
  variant = 'consumer',
}: {
  signedIn?: boolean;
  /** Account has a coach context (Basic or Premium) — surfaces the coaches hub
   *  in the desktop utility area (Phase 3). Mobile stays four tabs; the Account
   *  tab carries the same door there. */
  isCoach?: boolean;
  /** 'consumer' (default): the warm shell nav (top bar + bottom bar) mounted by the
   *  (consumer) layout, identity SSR'd via the `signedIn` prop. 'tournament' (Phase 5):
   *  the persistent bottom bar ONLY, root-mounted + self-gating on public tournament
   *  routes, in the NEUTRAL venue-following skin (no warm classes → the tournament's
   *  :root override themes it), with identity resolved CLIENT-SIDE — the tournament
   *  HTML is service-worker-cached anonymously, so identity must never be SSR'd in. */
  variant?: 'consumer' | 'tournament';
}) {
  const pathname = usePathname();
  const params = useParams();
  const isActive = (href: string) => underPrefix(pathname, href);

  // Phase 5 tournament variant self-gates to REAL public tournament routes, needing
  // BOTH signals: showsTournamentChrome excludes org pages + every operator shell —
  // including the admin PREVIEW, whose route ALSO carries a [tournamentSlug] param, so
  // the param alone is not sufficient there — while the param additionally guards org
  // pages against a drifted section list (they lack the param). See lib/consumer-routes.
  const onTournamentRoute =
    variant === 'tournament' && showsTournamentChrome(pathname) && !!params?.tournamentSlug;

  // Tournament identity resolves CLIENT-SIDE via the shared hook (getSession = a local
  // cookie read; anonymous visitors never hit the network; re-resolves on SPA sign-in/
  // out). Inert off tournament routes; the consumer variant keeps its SSR prop — identity
  // is NEVER SSR'd into SW-cached tournament HTML (the shared-device replay guard).
  const clientSignedIn = useClientSignedIn(onTournamentRoute);
  const signedIn = variant === 'tournament' ? clientSignedIn : signedInProp;

  // Unified cross-tab badge policy (Phase 5, owner-ratified): a red count means "something is
  // waiting for you to act." Two tabs qualify — Chat unread (rolled up, self-muted rooms excluded
  // server-side; R3-1) and Home pending team/org invitations. Scores carries NO nav badge: its
  // "Live · N" already lives in-page, and a badge lit every game-day would dull the red's meaning.
  // Signed-out visitors fetch neither. Keyed by href so both nav loops read `badges[href]`.
  const chatUnread = useChatUnread(signedIn);
  const pendingInvites = usePendingInviteCount(signedIn);

  // The root-mounted tournament variant renders on every route; bail here — AFTER the
  // hooks (React-safe) but BEFORE building any badges/markup — so it's free off its own
  // routes.
  if (variant === 'tournament' && !onTournamentRoute) return null;

  const cap = (n: number) => (n > 9 ? '9+' : String(n));
  const badges: Record<string, string | null> = {
    '/discover': pendingInvites > 0 ? cap(pendingInvites) : null,
    '/chat': chatUnread > 0 ? cap(chatUnread) : null,
  };
  // Distinct screen-reader phrasing per badge so the count stays meaningful (invites vs unread).
  const badgeNoun: Record<string, string> = { '/discover': 'pending invitations', '/chat': 'unread' };

  // Shared bottom-tab items — identical in both variants (the tournament variant
  // renders ONLY these, neutral-skinned; the consumer variant pairs them with the
  // warm top bar). On a tournament route none of Home/Scores/Chat/Account is a path
  // prefix, so every tab renders NEUTRAL — signalling a nested context, never a false
  // "you are on Discover/Scores".
  const bottomTabs = TABS.map(({ href, label, icon: Icon }) => {
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
  });

  // Shared top-bar content — the wordmark, the four tab links, and the organizer utility
  // cluster. Rendered by BOTH the consumer top bar (warm-skinned) and the Phase 3 desktop
  // strip on tournament routes (neutral-skinned). isCoach is unresolved (false) on the
  // tournament variant, so its Coaches Portal link naturally hides there.
  const topLinks = TABS.map(({ href, label }) => {
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
  });
  const topBarInner = (
    <>
      <div className={styles.topLeft}>
        <Link href="/discover" className={styles.wordmark} aria-label="FieldLogicHQ home">
          <span className={styles.wm1}>FIELD</span>
          <span className={styles.wm2}>LOGIC</span>
          <span className={styles.wm3}>HQ</span>
        </Link>
        <nav className={styles.topNav} aria-label="Primary">{topLinks}</nav>
      </div>
      <div className={styles.topUtil}>
        <Link href="/start" className={styles.utilLink}>Run a tournament</Link>
        {signedIn && isCoach && (
          <Link href="/coaches" className={styles.utilCoach}>Coaches Portal</Link>
        )}
        {/* Signed-out visitors keep a "Sign in" affordance (never ON the sign-in pages). */}
        {!signedIn && !pathname.startsWith('/auth') && (
          <Link href="/auth/login" className={styles.utilCta}>Sign in</Link>
        )}
      </div>
    </>
  );

  // Tournament variant (Phase 5 + Phase 3): the persistent app nav in the neutral
  // venue-following skin (no warm classes → the tournament :root override themes it).
  //   • ≤900px — the bottom bar (the branded event header owns the top).
  //   • >900px — a slim fixed top STRIP above the event's side rail (Phase 3), reusing the
  //     shared top-bar content; the .bottomNav / .topbarStrip media queries pick by width.
  if (variant === 'tournament') {
    return (
      <>
        <header className={`${styles.topbar} ${styles.topbarStrip}`}>{topBarInner}</header>
        <nav className={`${styles.bottomNav} ${styles.bottomNavTournament}`} aria-label="Primary">
          {bottomTabs}
        </nav>
      </>
    );
  }

  // Consumer variant only from here — the warm skin classes the tournament bar never uses.
  const warmRoute = isWarmSkinPath(pathname);
  // The four consumer TABS follow the user's theme preference (Dark⇄Warm); the always-warm
  // sign-up JOURNEY does not. The `…WarmTab` marker lets the CSS dark-gate repaint only the tab
  // nav under `data-user-theme="dark"`, leaving the journey nav warm. (TH-1/TH-3.)
  const prefGated = isConsumerShellPath(pathname);
  const topbarCls = `${styles.topbar}${warmRoute ? ` ${warm.warmVars} ${styles.topbarWarm}${prefGated ? ` ${styles.topbarWarmTab}` : ''}` : ''}`;
  const bottomNavCls = `${styles.bottomNav}${warmRoute ? ` ${warm.warmVars} ${styles.bottomNavWarm}${prefGated ? ` ${styles.bottomNavWarmTab}` : ''}` : ''}`;

  return (
    <>
      <header id="consumer-topbar" className={topbarCls}>{topBarInner}</header>
      <nav className={bottomNavCls} aria-label="Primary">
        {bottomTabs}
      </nav>
    </>
  );
}
