'use client';
/**
 * components/public/TournamentAccountSheet.tsx — Phase 3 "one-home connective tissue,"
 * reshaped by Tournament Mobile Polish G5 (owner decision 2026-07-14).
 *
 * TWO doors, one sheet:
 *   • Desktop (>900px): the signed-in account chip in the top bar (Phase 3, unchanged).
 *   • Mobile (≤900px): the bottom-nav "More" tab dispatches `flhq:open-tournament-sheet`
 *     — the chip hides (the header keeps only Share).
 *
 * The sheet now serves EVERY visitor, never empty (G5):
 *   • Signed in — the hats this account owns on THIS event (coach / admin / official),
 *     Following, Your FieldLogicHQ.
 *   • Signed out — a sign-in row plus this device's followed team.
 *   • Everyone — THIS EVENT: Notifications (the fan bell, relocated from the mobile
 *     header), News and Rules (their tab-bar slots moved here).
 *
 * Identity is fetched CLIENT-SIDE via /api/public/tournament-viewer, never
 * server-rendered into the page: the service worker offline-caches public tournament
 * HTML as anonymous content, so per-user identity in that payload would replay to the
 * next person on a shared device (/review 2026-07-14). Anonymous visitors cost nothing
 * — the session check is a local read, no network. Auth transitions are SPA
 * navigations, so the chip re-resolves on sign-in/out (fan-alert-prefs precedent).
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ArrowRight, Star, LayoutGrid, LogIn, LogOut, Megaphone, ScrollText, Bell, BellRing, Download, Compass, Radio } from 'lucide-react';
import { useOrgNav } from '@/components/OrgNavContext';
import { getSession, signOut } from '@/lib/auth';
import { createClient } from '@/lib/supabase-browser';
import { readFollowedTeam, syncFollowToAccount } from '@/lib/follow';
import { isInstallEligibleBrowser } from '@/lib/device';
import { saveFanAlertPref } from '@/lib/fan-alert-prefs-client';
import type { PublicPageKey } from '@/lib/public-pages';
import BottomSheet from '@/components/admin/BottomSheet';
import FanNotificationBell from '@/components/public/FanNotificationBell';
import styles from './TournamentAccountSheet.module.css';

interface ViewerHat {
  kind: 'coach' | 'admin' | 'official';
  label: string;
  href: string;
  /** Coach hats only: the tournament registration id — powers the alerts row (N3b). */
  teamId?: string;
}
interface TournamentViewer {
  initials: string;
  displayName: string;
  hats: ViewerHat[];
}

const HAT_META: Record<ViewerHat['kind'], { eyebrow: string; action: string }> = {
  coach: { eyebrow: 'You coach here', action: 'Coach view' },
  admin: { eyebrow: 'You run this event', action: 'Open admin' },
  official: { eyebrow: 'You officiate here', action: 'Scorekeeper' },
};

/** BottomNav's More tab opens the sheet through this event (single mount here). */
export const OPEN_TOURNAMENT_SHEET_EVENT = 'flhq:open-tournament-sheet';

/** One standard sheet row — icon · label/sub · chevron. Link when href is given,
 *  button otherwise. The hat rows (eyebrow + action) and CoachAlertsRow keep
 *  their own richer anatomy. */
function SheetRow({ icon, label, sub, href, onClick, disabled }: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const body = (
    <>
      <span className={styles.rowIcon}>{icon}</span>
      <span className={styles.rowText}>
        <span className={styles.label}>{label}</span>
        <span className={styles.sub}>{sub}</span>
      </span>
      <span className={styles.chev}><ArrowRight size={14} strokeWidth={2.2} aria-hidden /></span>
    </>
  );
  return href ? (
    <Link href={href} className={styles.row} onClick={onClick}>{body}</Link>
  ) : (
    <button type="button" className={`${styles.row} ${styles.rowBtn}`} onClick={onClick} disabled={disabled}>{body}</button>
  );
}

/**
 * N3b: one-tap own-team alerts for a signed-in coach — the platform's highest-intent
 * alerts user finally gets a bridge. Mirrors FollowAlertsToggle's signed-in turn-on:
 * the account-level gameAlerts switch + THIS device's push registration in one gesture
 * (strictDevice — a device failure is a hard error, never a quiet account-only save),
 * then the idempotent fire-and-forget follow mirror so the team is on the account.
 */
function CoachAlertsRow({ teamId, teamName, orgSlug, tournamentSlug }: {
  teamId: string;
  teamName: string;
  orgSlug: string;
  tournamentSlug: string;
}) {
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  const [msg, setMsg] = useState('');

  async function enable() {
    if (state !== 'idle') return;
    setState('pending');
    setMsg('');
    const result = await saveFanAlertPref('gameAlerts', true, { strictDevice: true });
    if (!result.ok) {
      setMsg(result.error ?? 'Could not turn on alerts.');
      setState('idle');
      return;
    }
    // Alerts are on; the shared account mirror is best-effort + idempotent.
    syncFollowToAccount('follow', { teamId, orgSlug, tournamentSlug });
    setState('done');
  }

  const done = state === 'done';
  return (
    <button
      type="button"
      className={`${styles.row} ${styles.rowBtn}`}
      data-kind="coach"
      onClick={enable}
      disabled={state !== 'idle'}
      aria-live="polite"
    >
      <span className={styles.rowIcon}>
        {done
          ? <BellRing size={15} strokeWidth={1.8} aria-hidden />
          : <Bell size={15} strokeWidth={1.8} aria-hidden />}
      </span>
      <span className={styles.rowText}>
        <span className={styles.label}>
          {done ? 'Alerts on for your team' : state === 'pending' ? 'Turning on…' : 'Get alerts for your team'}
        </span>
        <span className={msg && !done ? `${styles.sub} ${styles.subError}` : styles.sub}>
          {done
            ? `A push hits this device when ${teamName}'s games go live`
            : msg || `Score alerts for ${teamName} — one tap`}
        </span>
      </span>
      {!done && <span className={styles.chev}><ArrowRight size={14} strokeWidth={2.2} aria-hidden /></span>}
    </button>
  );
}

export default function TournamentAccountSheet() {
  const { tournamentSlug, tournamentName, tournamentHiddenPages, tournamentId, fanAlertsEnabled, tournamentFinished } = useOrgNav();
  const params = useParams<{ orgSlug?: string }>();
  const orgSlug = typeof params?.orgSlug === 'string' ? params.orgSlug : null;
  const pathname = usePathname();
  const [viewer, setViewer] = useState<TournamentViewer | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // The sheet records WHERE it was opened; any route change (tab tap, browser back)
  // derives it closed — it must never sit open, holding the body scroll lock, over a
  // page the user navigated to underneath it. No effect needed: open is derived state.
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const open = openedAtPath === pathname;
  const [authTick, setAuthTick] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  // Sign-in/out are SPA navigations (no full reload) — re-resolve the chip so a
  // sign-out in another tab doesn't leave stale identity in the chrome.
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setAuthTick(tick => tick + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Mobile More tab → open here (the sheet mounts exactly once, in the Navbar).
  // Registered once; the handler reads the CURRENT pathname through a ref so the
  // listener isn't torn down and re-added on every navigation.
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => {
    const onOpen = () => setOpenedAtPath(pathnameRef.current);
    window.addEventListener(OPEN_TOURNAMENT_SHEET_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TOURNAMENT_SHEET_EVENT, onOpen);
  }, []);

  useEffect(() => {
    // No slugs → nothing to resolve; the render gate below keeps any previous
    // viewer from showing (the Navbar unmounts this component off tournament routes).
    if (!orgSlug || !tournamentSlug) return;
    let cancelled = false;
    (async () => {
      try {
        // Local cookie/session read — anonymous visitors never hit the network.
        const session = await getSession();
        if (!session?.user) {
          if (!cancelled) { setViewer(null); setSignedIn(false); }
          return;
        }
        if (!cancelled) setSignedIn(true);
        const res = await fetch(
          `/api/public/tournament-viewer?org=${encodeURIComponent(orgSlug)}&tournament=${encodeURIComponent(tournamentSlug)}`,
        );
        if (!res.ok) {
          if (!cancelled) setViewer(null);
          return;
        }
        const body = (await res.json()) as { viewer?: TournamentViewer | null };
        if (!cancelled) setViewer(body.viewer ?? null);
      } catch {
        if (!cancelled) setViewer(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, tournamentSlug, authTick]);

  if (!orgSlug || !tournamentSlug) return null;
  const close = () => setOpenedAtPath(null);

  // In-place sign-out (no full reload): the onAuthStateChange listener above bumps
  // authTick on SIGNED_OUT, which re-resolves the viewer to null — the sheet and
  // chip fall back to the signed-out state on their own (same SPA-transition
  // convention as sign-in, see the listener's comment).
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      close();
    } catch {
      setSigningOut(false);
    }
  }

  const publicBase = `/${orgSlug}/${tournamentSlug}`;
  const hidden = (key: PublicPageKey) => tournamentHiddenPages.includes(key);
  // N3b: the first coach hat drives the labeled chip + the one-tap alerts row.
  const coachHat = viewer?.hats.find(hat => hat.kind === 'coach') ?? null;
  // Device-level follow (anonymous fans). Read lazily at render — the sheet body
  // only exists after a user gesture, so there is no SSR/hydration surface here.
  const deviceFollow = open && !signedIn ? readFollowedTeam(orgSlug, tournamentSlug) : null;
  const showBell = !!tournamentId && fanAlertsEnabled && !tournamentFinished;
  // "Get the app" (owner 2026-07-15): phone/tablet BROWSERS only — nothing to
  // install on desktop or inside the installed app (one shared eligibility
  // rule in lib/device). Finished events don't mount the install prompt, so
  // the row hides there too. Evaluated on open (post-gesture).
  const showGetApp = open && !tournamentFinished && isInstallEligibleBrowser();

  return (
    <>
      {/* Desktop-only account chip (Phase 3). Hidden ≤900px by CSS — the More tab
          is mobile's door. Anonymous visitors have no chip on any width. */}
      {viewer && (
        <button
          type="button"
          className={coachHat ? `${styles.chip} ${styles.chipCoach}` : styles.chip}
          onClick={() => setOpenedAtPath(pathname)}
          aria-label={coachHat ? 'Your account on this event — you coach here' : 'Your account on this event'}
        >
          {viewer.initials}
          {/* N3b: the chip earns its space by saying WHY it's there (approved mockup:
              initials + role, desktop only — the chip is already hidden ≤900px). */}
          {coachHat && <span className={styles.chipRole}>· Coach</span>}
        </button>
      )}
      <BottomSheet open={open} onClose={close} title={viewer?.displayName || (signedIn ? 'Signed in' : 'More')}>
        {/* The "At {event}" line scopes the HAT rows ("you coach HERE") + the
            coach alerts row that rides under them — both are event-scoped.
            Without hats it read as a second group header fighting FieldLogicHQ —
            owner feedback 2026-07-15 — so it only renders when hats do. */}
        {tournamentName && (viewer?.hats.length ?? 0) > 0 && (
          <>
            <p className={styles.context}>At {tournamentName}</p>
            <div className={styles.rows}>
              {viewer?.hats.map(hat => (
                <Link
                  key={`${hat.kind}:${hat.href}`}
                  href={hat.href}
                  className={styles.row}
                  data-kind={hat.kind}
                  onClick={close}
                >
                  <span className={styles.rowText}>
                    <span className={styles.eyebrow}>{HAT_META[hat.kind].eyebrow}</span>
                    <span className={styles.label}>{hat.label}</span>
                  </span>
                  <span className={styles.action}>{HAT_META[hat.kind].action}</span>
                </Link>
              ))}
              {/* N3b: one-tap own-team alerts, directly under the coach hat (approved
                  mockup) — rides the account-alerts model, no new plumbing. */}
              {coachHat?.teamId && (
                <CoachAlertsRow
                  teamId={coachHat.teamId}
                  teamName={coachHat.label}
                  orgSlug={orgSlug}
                  tournamentSlug={tournamentSlug}
                />
              )}
            </div>
          </>
        )}

        {/* ── FieldLogicHQ: every platform-level (not event-level) door in one
            labeled group — identity (sign in, or Following/Your FieldLogicHQ),
            the app install, and the two platform-wide exits (N1, ratified §8
            decision). Kept FIRST, right where sign-in already sat, so the
            highest-value conversion row stays above the fold — merging it
            into the group that used to trail after "This event" would have
            buried it below Follow/Notifications/News/Rules (owner UX review
            2026-07-17: the old unlabeled top group and the labeled bottom
            FieldLogicHQ group were the same category of thing, split in two). ── */}
        <p className={styles.sectionKicker}>FieldLogicHQ</p>
        <div className={styles.rows}>
          {!signedIn && (
            <SheetRow
              icon={<LogIn size={15} strokeWidth={1.8} aria-hidden />}
              label="Sign in"
              sub="Follow everywhere & get score alerts"
              href={`/auth/login?next=${encodeURIComponent(pathname || publicBase)}`}
              onClick={close}
            />
          )}
          {signedIn && (
            <SheetRow
              icon={<Star size={15} strokeWidth={1.8} aria-hidden />}
              label="Following"
              sub="Your followed teams"
              href="/following"
              onClick={close}
            />
          )}
          {signedIn && (
            <SheetRow
              icon={<LayoutGrid size={15} strokeWidth={1.8} aria-hidden />}
              label="Your FieldLogicHQ"
              sub="All workspaces & following"
              href="/discover"
              onClick={close}
            />
          )}
          {/* Dispatch force-shows the shared install prompt (bypasses its dismissal gates). */}
          {showGetApp && (
            <SheetRow
              icon={<Download size={15} strokeWidth={1.8} aria-hidden />}
              label="Get the app"
              sub="FieldLogicHQ on your home screen"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('flhq:show-install'));
                close();
              }}
            />
          )}
          <SheetRow
            icon={<Compass size={15} strokeWidth={1.8} aria-hidden />}
            label="Browse tournaments"
            sub="FieldLogicHQ Discover"
            href="/discover"
            onClick={close}
          />
          <SheetRow
            icon={<Radio size={15} strokeWidth={1.8} aria-hidden />}
            label="Live scores"
            sub="Everything on right now"
            href="/scores"
            onClick={close}
          />
        </div>

        {/* ── This event: the device-level follow, notifications, and the pages
            that left the tab bar (G5). A signed-out fan's follow is event-scoped,
            so it lives HERE, separate from the platform-level FieldLogicHQ group above. ── */}
        {(showBell || !signedIn || !hidden('news') || !hidden('rules')) && (
          <>
            <p className={styles.sectionKicker}>This event</p>
            <div className={styles.rows}>
              {/* Both follow rows honor the organizer's hidden-Teams choice — the
                  sheet must not advertise a page the nav deliberately hides. */}
              {!signedIn && !hidden('teams') && (deviceFollow ? (
                <SheetRow
                  icon={<Star size={15} strokeWidth={1.8} aria-hidden />}
                  label={deviceFollow.name || 'Your team'}
                  sub="Following on this device"
                  href={`${publicBase}/teams/${deviceFollow.id}`}
                  onClick={close}
                />
              ) : (
                <SheetRow
                  icon={<Star size={15} strokeWidth={1.8} aria-hidden />}
                  label="Follow a team"
                  sub="Pin its score & next game — no account needed"
                  href={`${publicBase}/teams`}
                  onClick={close}
                />
              ))}
              {showBell && <FanNotificationBell variant="row" />}
              {!hidden('news') && (
                <SheetRow
                  icon={<Megaphone size={15} strokeWidth={1.8} aria-hidden />}
                  label="News & announcements"
                  sub="Latest from the organizer"
                  href={`${publicBase}/news`}
                  onClick={close}
                />
              )}
              {!hidden('rules') && (
                <SheetRow
                  icon={<ScrollText size={15} strokeWidth={1.8} aria-hidden />}
                  label="Rules"
                  sub="Format & tie-breakers"
                  href={`${publicBase}/rules`}
                  onClick={close}
                />
              )}
            </div>
          </>
        )}

        {/* Sign out sits alone at the very bottom, apart from the navigational rows
            above it (owner feedback 2026-07-17: it was missing from the sheet
            entirely — a signed-in fan had no way to sign out on mobile). */}
        {signedIn && (
          <div className={`${styles.rows} ${styles.signOutRow}`}>
            <SheetRow
              icon={<LogOut size={15} strokeWidth={1.8} aria-hidden />}
              label={signingOut ? 'Signing out…' : 'Sign out'}
              sub="End your session on this device"
              onClick={handleSignOut}
              disabled={signingOut}
            />
          </div>
        )}
      </BottomSheet>
    </>
  );
}
