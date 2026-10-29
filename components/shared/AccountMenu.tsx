'use client';

/**
 * AccountMenu — the strips' account door opens IN PLACE (owner-approved 2026-09-01;
 * `docs/projects/active/COACH_ACCOUNT_MENU_PLAN.md`, mockup-of-record in the plan header).
 *
 * Completes the 2026-07-31 chat-door ruling: a strip door that ejects the operator into
 * consumer chrome is the weaker of two doors, and the account link was the last one still
 * making that trip (with no rescue link — only /chat ever got one). The avatar now behaves
 * like the bell and the Workspaces pill beside it: a popover in place, navigation only when
 * a destination is picked, and the outbound rows carry `?back=<here>` so the account pages
 * can offer the way home (AccountReturnBar).
 *
 * One component, both strips. Deliberate asymmetry: the Warm/Dark flip renders on the COACH
 * strip only (`showTheme`) — tournament pages always show the organizer's colors, and a
 * toggle that visibly does nothing where you stand reads as broken. `showFeedback` is off on
 * the portal WALLS (portal function stays off a wall, exactly as the bell does — identity +
 * exits remain, which is the wall's stated philosophy).
 *
 * Public pages too (owner ask 2026-10-16: "anywhere that it exists it should behave the same
 * way") — the tournament strip, an org's public identity row and the marketing bar mount this
 * same menu, never a link to /account. Theme stays off on all three (organizer colors / an
 * always-dark marketing bar), and the host's own trigger content rides in as `children`. The
 * PHONE bottom bars keep Account as a tab (a link): a tab is a location marker, and a tab that
 * pops a menu can no longer say "you are here". The consumer shell's desktop top bar does NOT —
 * since 2026-10-23 its Account is this menu, at the right (the person icon lights on /account).
 *
 * THE SUPPORT CONSOLE (platform admin, Stage 1, owner 2026-10-24) wears this menu too, with two differences it asks for:
 * `signOutTo="platform"` lands on the console's own sign-in, and `showAccount={false}` leaves out Notification settings and
 * Account settings, which open the CUSTOMER account area (a staff member has no notification settings there). It also passes
 * `showFeedback={false}`: the feedback form would write to our own inbox. Every other host leaves all three as they were.
 *
 * Sign out lands on the sign-in page inside a portal (owner-ruled: a coach signing out
 * mid-errand is on a shared machine or switching accounts — fastest way back in; matches what
 * the portal's sidebar door did before it retired into this menu). A PUBLIC page passes
 * `signOutTo="here"` and reloads in place: nothing on it is protected, and a fan following an
 * event should still be looking at it afterwards. No confirm step: opening the menu is
 * already the soft confirm, and the row is visually set apart (`--danger`) so it isn't hit
 * reaching for a neighbor. The consumer account page's own sign-out keeps its Discover
 * landing — fan-side convention, deliberately not unified.
 *
 * Identity reads getSession() (local storage read, no network) lazily on first open — the
 * strip mounts on every portal pageview and must not open an auth roundtrip per view.
 * The theme block is AppearanceCard's exact contract: applyTheme (instant, device-wide) +
 * fire-and-forget PATCH so the choice follows the account to other devices.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePublicPathname } from '@/lib/use-public-pathname';
import { User, Shirt, Bell, Settings, MessageSquarePlus, LogOut, Check } from 'lucide-react';
import { getSession, signOut } from '@/lib/auth';
import { useDismissable } from '@/lib/overlay-hooks';
import {
  applyTheme,
  getEffectiveTheme,
  THEME_CHANGE_EVENT,
  type UserTheme,
} from '@/lib/user-theme';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';
import styles from './AccountMenu.module.css';

const THEME_OPTIONS: { value: UserTheme; label: string }[] = [
  { value: 'warm', label: 'Warm' },
  { value: 'dark', label: 'Dark' },
];

export default function AccountMenu({
  settingsHref = '/account/notifications',
  showTheme = false,
  showFeedback = true,
  warm = false,
  signOutTo = 'sign-in',
  showAccount = true,
  teams,
  className,
  wrapClassName,
  children,
}: {
  /** Notification-settings destination — hosts pass their org-focused deep link (the same
   *  door the bell's gear uses, so the two can never drift apart). */
  settingsHref?: string;
  /** Coach strip only — see the header comment. */
  showTheme?: boolean;
  /** False on the portal walls. */
  showFeedback?: boolean;
  /** Warm portal skin: popover reads the --home-* set, like WorkspacesPill. */
  warm?: boolean;
  /** 'here' on public pages; 'platform' in the support console — see the header comment. */
  signOutTo?: 'sign-in' | 'here' | 'platform';
  /** False in the support console: no Notification settings / Account settings rows. */
  showAccount?: boolean;
  /** A house-league coach's teams at THIS club (the club site passes them): one is a "My team" row, two or more sit under
   *  a "My teams" caption by name, the one being viewed shaded. The phone's way to the team, and a desk coach of two or more
   *  teams' only door from the bar; a desk coach of one also has the bar's own "My team" link. Nothing renders when empty. */
  teams?: { teamName: string; href: string; current: boolean }[];
  /** The host bar's icon-door class — the trigger wears that row's exact skin. */
  className?: string;
  /** Lets a host re-anchor the popover (the marketing bar pins it to its own right edge on a phone). */
  wrapClassName?: string;
  /** The trigger's content when the host's door is not the bare person glyph (a labelled pill,
   *  a word). The accessible name stays "Account" either way. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useDismissable(open, wrapRef, () => setOpen(false));

  // Close on ANY route change — persistent layout chrome, so browser Back/Forward would
  // otherwise leave a stale popover over the new page. The repo's lastPath render-time
  // pattern (mirrors WorkspacesPill), never setState-in-effect.
  const pathname = usePublicPathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Theme sync — same reconcile AppearanceCard does (SSR default, then the real value, then
  // stay in sync if another surface flips it). Listener is registered only when the block renders.
  const [theme, setTheme] = useState<UserTheme>('warm');
  useEffect(() => {
    if (!showTheme) return;
    const sync = () => setTheme(getEffectiveTheme() ?? 'warm');
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, [showTheme]);

  function chooseTheme(next: UserTheme) {
    if (next === theme) return;
    setTheme(next);
    applyTheme(next);
    // The strips only render signed-in, so always persist (source of truth, cross-device).
    // Local is already applied — a failed save just means it won't follow to other devices.
    fetch('/api/account/theme', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    // Fetch only when OPENING and still unresolved — closing must not re-issue the read,
    // and a session with no email (resolved null) shouldn't refetch forever.
    if (next && email === null) {
      getSession().then(s => setEmail(s?.user?.email ?? null)).catch(() => {});
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // Full navigation, not a router push — a fresh document guarantees no client state
      // (contexts, caches, realtime channels) survives the identity change.
      if (signOutTo === 'here') window.location.reload();
      else window.location.assign(signOutTo === 'platform' ? '/platform-admin/login' : '/auth/login');
    }
  }

  // Outbound rows carry the way home. The settings href may already hold a query (?focus=…).
  const back = encodeURIComponent(pathname);
  const notifHref = `${settingsHref}${settingsHref.includes('?') ? '&' : '?'}back=${back}`;
  const accountHref = `/account?back=${back}`;

  return (
    <div className={`${styles.wrap} ${warm ? styles.warm : ''} ${wrapClassName ?? ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${className ?? ''}`}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
      >
        {children ?? <User size={17} strokeWidth={1.8} />}
      </button>
      {open && (
        <div className={styles.popover} role="menu">
          <div className={styles.identity}>
            <span className={styles.avatar} aria-hidden>
              {email ? email.charAt(0).toUpperCase() : <User size={15} />}
            </span>
            <span className={styles.identityMeta}>
              <span className={styles.identityCap}>Signed in</span>
              <span className={styles.identityValue}>{email ?? '…'}</span>
            </span>
          </div>

          {showTheme && (
            <div className={styles.themeBlock}>
              <span className={styles.identityCap}>Appearance</span>
              <div className={styles.themeSeg} role="radiogroup" aria-label="App theme">
                {THEME_OPTIONS.map(opt => {
                  const active = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`${styles.themeOpt} ${active ? styles.themeOptActive : ''}`}
                      onClick={() => chooseTheme(opt.value)}
                    >
                      {opt.label}
                      {active && <Check size={12} strokeWidth={3} aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {teams && teams.length > 1 && <span className={`${styles.identityCap} ${styles.groupCap}`}>My teams</span>}
          {teams?.map(t => (
            <Link
              key={t.href}
              href={t.href}
              className={`${styles.row} ${t.current ? styles.rowCurrent : ''}`}
              role="menuitem"
              aria-current={t.current ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <Shirt size={15} aria-hidden />
              {teams.length > 1 ? t.teamName : 'My team'}
            </Link>
          ))}
          {teams && teams.length > 1 && <div className={styles.sep} aria-hidden />}
          {showAccount && (
            <Link href={notifHref} className={styles.row} role="menuitem" onClick={() => setOpen(false)}>
              <Bell size={15} aria-hidden />
              Notification settings
            </Link>
          )}
          {showFeedback && (
            <button
              type="button"
              className={styles.row}
              role="menuitem"
              onClick={() => { setOpen(false); setFeedbackOpen(true); }}
            >
              <MessageSquarePlus size={15} aria-hidden />
              Send feedback
            </button>
          )}
          {showAccount && (
            <Link href={accountHref} className={styles.row} role="menuitem" onClick={() => setOpen(false)}>
              <Settings size={15} aria-hidden />
              Account settings
            </Link>
          )}

          <div className={styles.sep} aria-hidden />
          <button
            type="button"
            className={`${styles.row} ${styles.signOut}`}
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut size={15} aria-hidden />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
      <FeedbackWidget open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
