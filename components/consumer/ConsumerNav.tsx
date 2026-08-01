'use client';
/**
 * components/consumer/ConsumerNav.tsx
 *
 * Primary navigation for the consumer shell (Unified Home IA redesign, Phase 0).
 * Renders an app-like top bar and a mobile bottom tab bar — the same responsive
 * pattern the rest of the site uses (top links ≥900px, bottom nav below).
 *
 * Tabs: Home / Scores / Chat / Account — STATE-BASED since Desktop Public UX Phase 1
 * (WI-4/WI-5): anonymous visitors see the browsable tabs (Home, Scores) with Chat +
 * Account collapsed into one Sign In door; the full four-tab row is signed-in chrome.
 * Home lives at /discover (the canonical, SEO-bearing directory URL — unchanged);
 * only its label/icon change. It absorbs the retired Discover + Following tabs and
 * the /home workspace launchpad. On desktop the header also carries the organizer
 * affordances (Pricing + the "Run a tournament" persona menu + one operator pill +
 * Sign in) so desktop visitors who land here from search can still convert or sign in.
 */
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Home, Radio, MessageCircle, User, LogIn } from 'lucide-react';
import { useChatUnread } from '@/lib/use-chat-unread';
import { usePendingInviteCount } from '@/lib/use-pending-invites';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { useRoleSummary, resolveOperatorDoor, type OperatorDoor } from '@/lib/use-role-summary';
import { usePublicFlip } from '@/lib/use-public-flip';
import FlipPill from '@/components/shared/FlipPill';
import flip from '@/components/shared/FlipPill.module.css';
import WorkspacesPill from '@/components/shared/WorkspacesPill';
import type { WorkspaceDoor } from '@/lib/user-contexts';
import { isWarmSkinPath, isConsumerShellPath, showsTournamentChrome, showsOrgPublicChrome } from '@/lib/consumer-routes';
import StartMenu from './StartMenu';
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

/** Space-holder for the strip's operator slot while the answer is in flight. FlipPill's own
 *  `pending` branch renders it invisible-but-sized, so the row never jumps and never paints a
 *  door it has to take back. The target is never navigable — it exists only to size the space. */
const FLIP_SLOT_PENDING = { kind: 'single' as const, target: { href: '#', label: 'Admin' }, pending: true };

export default function ConsumerNav({
  signedIn: signedInProp = false,
  isCoach = false,
  adminHref = null,
  workspaces = [],
  startMenu,
  variant = 'consumer',
  chatBackPath = null,
}: {
  signedIn?: boolean;
  /** Account has a coach context (Basic or Premium) — surfaces the coaches hub
   *  in the desktop utility area (Phase 3). Mobile stays four tabs; the Account
   *  tab carries the same door there. */
  isCoach?: boolean;
  /** The account's primary org-workspace destination, SSR'd by dynamic mounts (the
   *  consumer layout / coach journey chrome) from the access contexts. Drives the ONE
   *  persistent operator pill (WI-3): Admin Area outranks the coaches pill. The
   *  tournament variant resolves the same doors client-side via useRoleSummary. */
  adminHref?: string | null;
  /** Stage D.2: every place the account holds, SSR'd by the same dynamic mounts from the
   *  same shared resolver as Home's cards. 2+ turns the operator pill into the
   *  "Workspaces ▾" popover; 0–1 keeps the direct labelled door (zero change). The
   *  tournament variant gets the identical list client-side via useRoleSummary. */
  workspaces?: WorkspaceDoor[];
  /** Persona-menu gating resolved server-side (lib/start-menu.ts) by mounts that are
   *  already dynamic. Omitted → StartMenu's safe defaults (chooser-routed, league hidden). */
  startMenu?: { coachHref: string; showLeague: boolean };
  /** A3 QA (2026-07-27): the coach shell passes its CURRENT portal path here so the
   *  Chat tab deep-links `/chat?back=…` — the Chat surface then offers a "back to
   *  your Coaches Portal" return to the exact page the coach left. Null (all other
   *  mounts) keeps the plain `/chat` href — fans never see the affordance. */
  chatBackPath?: string | null;
  /** 'consumer' (default): the warm shell nav (top bar + bottom bar) mounted by the
   *  (consumer) layout, identity SSR'd via the `signedIn` prop. 'tournament' (Phase 5):
   *  the persistent bottom bar ONLY, root-mounted + self-gating on public tournament
   *  routes, in the NEUTRAL venue-following skin (no warm classes → the tournament's
   *  :root override themes it), with identity resolved CLIENT-SIDE — the tournament
   *  HTML is service-worker-cached anonymously, so identity must never be SSR'd in.
   *  'coach' (A2, 2026-07-25): mounted INSIDE CoachPortalShell on the free coach portal —
   *  identical to 'consumer' (warm skin, pref-gated) except the top bar hides ≤900px,
   *  where the coach team/event header owns the top of the screen. */
  variant?: 'consumer' | 'tournament' | 'coach';
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

  // D1 (owner ruling 2026-08-01, settled from mockups): an ORG's public pages take the bottom
  // bar on a PHONE and nothing above it — see showsOrgPublicChrome for why the asymmetry is the
  // decision rather than an omission. Same root mount, same bar; only the strip half is skipped.
  const onOrgPublicRoute = variant === 'tournament' && showsOrgPublicChrome(pathname);
  // Either public surface resolves identity the same way: client-side, never SSR'd.
  const onPublicRoute = onTournamentRoute || onOrgPublicRoute;

  // Tournament identity resolves CLIENT-SIDE via the shared hook (getSession = a local
  // cookie read; anonymous visitors never hit the network; re-resolves on SPA sign-in/
  // out). Inert off tournament routes; the consumer variant keeps its SSR prop — identity
  // is NEVER SSR'd into SW-cached tournament HTML (the shared-device replay guard).
  const clientSignedIn = useClientSignedIn(onPublicRoute);
  const signedIn = variant === 'tournament' ? clientSignedIn : signedInProp;

  // Unified cross-tab badge policy (Phase 5, owner-ratified): a red count means "something is
  // waiting for you to act." Two tabs qualify — Chat unread (rolled up, self-muted rooms excluded
  // server-side; R3-1) and Home pending team/org invitations. Scores carries NO nav badge: its
  // "Live · N" already lives in-page, and a badge lit every game-day would dull the red's meaning.
  // Signed-out visitors fetch neither. Keyed by href so both nav loops read `badges[href]`.
  const chatUnread = useChatUnread(signedIn);
  const pendingInvites = usePendingInviteCount(signedIn);

  // WI-3/WI-4: the tournament strip resolves the operator doors + chat membership
  // CLIENT-side (same rule as identity — never SSR'd into SW-cached tournament HTML).
  // Inert everywhere else and for anonymous visitors (no network).
  // Strip-only: the doors this feeds exist only on the tournament strip. Gated on
  // onTournamentRoute (NOT the wider public gate) because on an org public page the org's own
  // navbar already resolves this same summary for its operator door — asking again here would
  // be a second identical request for one answer.
  const roleSummary = useRoleSummary(onTournamentRoute && signedIn);

  // ONE operator door on a public event page, and it lives HERE — in the nav, the same slot the
  // consumer screens put it in (owner call 2026-07-31: consistency between screens). Before this
  // there were two on desktop: this strip's global pill AND the event header's Flip.
  //
  // The slot fills with the best door available, in this order:
  //   1. the Flip — page-matched and scoped to THIS event, so it beats a global pill outright;
  //   2. the global operator pill — for an operator who is a plain fan of this particular event
  //      (their own workspace is still one click away);
  //   3. the "Run a tournament" menu — fans and anonymous visitors, unchanged.
  // Shares one cached request per event with the phone-width header Flip, and stays silent for
  // anonymous visitors.
  // Both values come from the ONE hook, so the "still waiting" flag can never conclude the answer
  // has landed before the answer exists. An earlier version ran a second, independently-gated
  // readiness probe here; it could finish first and drop the slot back to the acquisition CTA for a
  // beat — the exact flash the placeholder exists to prevent, and worst on the admin→public trip
  // where the roles answer is already cached. Signed-out visitors are never held: their CTA is the
  // right answer and needs no lookup.
  const { resolution: eventFlip, resolving: stripDoorResolving } = usePublicFlip();
  // Stage D.2: the shared pill-vs-popover resolver (2+ places → Workspaces popover).
  const stripDoor = resolveOperatorDoor(roleSummary?.workspaces, roleSummary?.adminHref, roleSummary?.coachHref);

  // The root-mounted tournament variant renders on every route; bail here — AFTER the
  // hooks (React-safe) but BEFORE building any badges/markup — so it's free off its own
  // routes.
  if (variant === 'tournament' && !onPublicRoute) return null;

  const cap = (n: number) => (n > 9 ? '9+' : String(n));
  // Chat carries the coach return path when the coach shell provides one (tab-active
  // matching keys off `pathname`, so the query never affects highlight state).
  const tabHref = (href: string) =>
    href === '/chat' && chatBackPath ? `/chat?back=${encodeURIComponent(chatBackPath)}` : href;
  const badges: Record<string, string | null> = {
    '/discover': pendingInvites > 0 ? cap(pendingInvites) : null,
    '/chat': chatUnread > 0 ? cap(chatUnread) : null,
  };
  // Distinct screen-reader phrasing per badge so the count stays meaningful (invites vs unread).
  const badgeNoun: Record<string, string> = { '/discover': 'pending invitations', '/chat': 'unread' };

  // State-based chrome (Phase 1, WI-5): anonymous visitors get the browsable tabs only —
  // Chat and Account are sign-in walls for them, so both collapse into the single Sign In
  // door appended below. The full four-tab row is signed-in chrome. (On the tournament
  // variant `signedIn` is client-resolved, so SW-cached HTML correctly ships anonymous.)
  const visibleTabs = signedIn
    ? TABS
    : TABS.filter(t => t.href === '/discover' || t.href === '/scores');
  // Never a Sign In affordance ON the auth pages themselves (mirrors the utilCta rule).
  const showSignInTab = !signedIn && !pathname.startsWith('/auth');

  // Shared bottom-tab items — identical in both variants (the tournament variant
  // renders ONLY these, neutral-skinned; the consumer variant pairs them with the
  // warm top bar). On a tournament route none of Home/Scores/Chat/Account is a path
  // prefix, so every tab renders NEUTRAL — signalling a nested context, never a false
  // "you are on Discover/Scores".
  const tabItems = visibleTabs.map(({ href, label, icon: Icon }) => {
    const active = isActive(href);
    const badge = badges[href];
    return (
      <Link
        key={href}
        href={tabHref(href)}
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
  const bottomTabs = (
    <>
      {tabItems}
      {showSignInTab && (
        <Link href="/auth/login" className={styles.tab}>
          <span className={styles.iconWrap}>
            <LogIn size={22} strokeWidth={1.8} />
          </span>
          <span className={styles.label}>Sign In</span>
        </Link>
      )}
    </>
  );

  // D1 — org public pages: the bottom bar alone, in the same neutral venue-following skin the
  // tournament bar uses (no warm classes; the org layout's :root override themes it). Returned
  // BEFORE the tournament branch so none of the strip's door/flip machinery is built for a
  // surface that never renders it — the org navbar already owns the operator door here.
  if (onOrgPublicRoute && !onTournamentRoute) {
    return (
      <nav className={`${styles.bottomNav} ${styles.bottomNavTournament}`} aria-label="Primary">
        {bottomTabs}
      </nav>
    );
  }

  // Shared top-bar content — the wordmark, the visible tab links, and the organizer
  // utility cluster (consumer/coach variants only since WI-4 — the tournament strip
  // builds its own state-based content below).
  const topLinks = visibleTabs.map(({ href, label }) => {
    const active = isActive(href);
    const badge = badges[href];
    return (
      <Link
        key={href}
        href={tabHref(href)}
        className={`${styles.topLink} ${active ? styles.active : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        {label}
        {badge && <span className={styles.topBadge} aria-label={`${badge} ${badgeNoun[href] ?? 'unread'}`}>{badge}</span>}
      </Link>
    );
  });
  // The one wordmark block — shared by the consumer top bar and the tournament strip.
  const wordmark = (
    <Link href="/discover" className={styles.wordmark} aria-label="FieldLogicHQ home">
      <span className={styles.wm1}>FIELD</span>
      <span className={styles.wm2}>LOGIC</span>
      <span className={styles.wm3}>HQ</span>
    </Link>
  );
  // The nav skin decision, shared by the pill popover and the bar classes below (pure,
  // variant+path only — safe to compute before the tournament early return never uses it).
  const warmRoute = isWarmSkinPath(pathname) || variant === 'coach';

  // ONE persistent operator door (WI-3 precedence + Stage D.2 pill-vs-popover), via the
  // shared resolver: 2+ places → the "Workspaces ▾" popover (every place, one tap each,
  // in Home's order — including the one you're in: a chooser shows the same named
  // destinations every time, FlipPill ruling 2026-07-28); 0–1 → the direct labelled pill.
  // The coach shell (variant 'coach') IS the Coaches Portal — a self-referential door is
  // noise, so its coach door only feeds the SINGLE-pill branch outside that shell.
  const operatorDoor: OperatorDoor | null = signedIn
    ? resolveOperatorDoor(workspaces, adminHref, isCoach && variant !== 'coach' ? '/coaches' : null)
    : null;

  const topBarInner = (
    <>
      <div className={styles.topLeft}>
        {wordmark}
        <nav className={styles.topNav} aria-label="Primary">{topLinks}</nav>
      </div>
      <div className={styles.topUtil}>
        {/* Standing Pricing link (WI-1) — always visible on desktop, signed in or out. */}
        <Link href="/pricing" className={styles.utilLink}>Pricing</Link>
        {/* The ratified CTA, now a persona menu (WI-2) — same label, all four paths named. */}
        <StartMenu coachHref={startMenu?.coachHref} showLeague={startMenu?.showLeague} />
        {operatorDoor?.kind === 'workspaces' && (
          <WorkspacesPill workspaces={operatorDoor.workspaces} className={styles.utilCoach} warm={warmRoute} />
        )}
        {operatorDoor?.kind === 'pill' && (
          <Link href={operatorDoor.pill.href} className={styles.utilCoach}>{operatorDoor.pill.label}</Link>
        )}
        {/* Signed-out visitors keep a "Sign in" affordance (never ON the sign-in pages). */}
        {!signedIn && !pathname.startsWith('/auth') && (
          <Link href="/auth/login" className={styles.utilCta}>Sign in</Link>
        )}
      </div>
    </>
  );

  // Tournament variant (Phase 5 + Phase 3, state-based since Phase 1 WI-4 — binding
  // mockup: the fan-chrome addendum): the persistent app nav in the neutral
  // venue-following skin (no warm classes → the tournament :root override themes it).
  //   • ≤900px — the bottom bar (the branded event header owns the top), state-based
  //     like the consumer bar (anonymous = Home/Scores/Sign In).
  //   • >900px — a slim fixed STRIP with NO tab row: the org's side rail owns section
  //     nav, and dropping the platform "Home" link here kills the old Home-vs-Overview
  //     double-home ambiguity outright. Anonymous = Discover/Sign in/Run a tournament;
  //     a signed-in fan earns a chat door only with ≥1 real conversation, plus a compact
  //     Account avatar; an operator gets the persistent role pill instead of the CTA.
  if (variant === 'tournament') {
    // The Flip renders through the shared control — same glyph, same popover for a multi-hat
    // account — wearing the `strip` variant so it matches this row's all-caps mono typography and
    // pill sizing instead of the event-header typography it uses elsewhere (/design 2026-07-31).
    // While the answer is still in flight the slot holds its space and shows nothing, rather than
    // painting the acquisition CTA and taking it back.
    // Stage D.2 on the strip too, via the same shared resolver: an operator who is a
    // plain fan of THIS event (no Flip) with 2+ places gets the honest Workspaces
    // popover instead of the silent precedence winner.
    const doorSlot = stripDoorResolving
      ? <FlipPill resolution={FLIP_SLOT_PENDING} variant="inline" className={flip.strip} />
      : eventFlip
        ? <FlipPill resolution={eventFlip} variant="inline" className={flip.strip} />
        : stripDoor?.kind === 'workspaces'
          ? <WorkspacesPill workspaces={stripDoor.workspaces} className={styles.utilCoach} />
          : stripDoor?.kind === 'pill'
            ? <Link href={stripDoor.pill.href} className={styles.utilCoach}>{stripDoor.pill.label}</Link>
            : <StartMenu />;
    return (
      <>
        <header className={`${styles.topbar} ${styles.topbarStrip}`}>
          <div className={styles.topLeft}>
            {wordmark}
            <nav className={styles.topNav} aria-label="FieldLogicHQ">
              <Link href="/discover" className={styles.topLink}>Discover</Link>
            </nav>
          </div>
          <div className={styles.topUtil}>
            {/* Membership-gated chat door — unread>0 also opens it, so a fan added to a
                room AFTER the one-shot role-summary fetch never has live messages with
                no visible way in (the unread hook is realtime; hasChat is not). */}
            {signedIn && (roleSummary?.hasChat || chatUnread > 0) && (
              <Link
                href="/chat"
                className={styles.stripIcon}
                aria-label={chatUnread > 0 ? `Chat — ${cap(chatUnread)} unread` : 'Chat'}
              >
                <MessageCircle size={17} strokeWidth={1.8} />
                {chatUnread > 0 && (
                  <span className={`${styles.topBadge} ${styles.stripBadge}`} aria-hidden>{cap(chatUnread)}</span>
                )}
              </Link>
            )}
            {signedIn && (
              <Link href="/account" className={styles.stripIcon} aria-label="Account">
                <User size={17} strokeWidth={1.8} />
              </Link>
            )}
            {!signedIn && <Link href="/auth/login" className={styles.utilCta}>Sign in</Link>}
            {doorSlot}
          </div>
        </header>
        <nav className={`${styles.bottomNav} ${styles.bottomNavTournament}`} aria-label="Primary">
          {bottomTabs}
        </nav>
      </>
    );
  }

  // Consumer/coach variants only from here — the warm skin classes the tournament bar never
  // uses. The coach portal (A2) is warm-by-default + pref-gated exactly like the four tabs;
  // its routes aren't in isWarmSkinPath (that predicate also drives footer/theme-color for
  // the (consumer) group), so the variant itself carries the warm decision (warmRoute,
  // computed above the pill block since the Workspaces popover shares it).
  // The four consumer TABS follow the user's theme preference (Dark⇄Warm); the always-warm
  // sign-up JOURNEY does not. The `…WarmTab` marker lets the CSS dark-gate repaint only the tab
  // nav under `data-user-theme="dark"`, leaving the journey nav warm. (TH-1/TH-3.)
  const prefGated = isConsumerShellPath(pathname) || variant === 'coach';
  const coachCls = variant === 'coach' ? ` ${styles.topbarCoach}` : '';
  const topbarCls = `${styles.topbar}${coachCls}${warmRoute ? ` ${warm.warmVars} ${styles.topbarWarm}${prefGated ? ` ${styles.topbarWarmTab}` : ''}` : ''}`;
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
