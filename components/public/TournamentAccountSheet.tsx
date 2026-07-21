'use client';
/**
 * components/public/TournamentAccountSheet.tsx — Phase 3 "one-home connective tissue,"
 * reshaped by Tournament Mobile Polish G5 (2026-07-14) and the Unified Home nav merge
 * (Phase 5, 2026-07-21).
 *
 * The header chip is a TOOLS door, not an account door: it renders ONLY for a signed-in
 * viewer who holds a hat on THIS event (coach / admin / official) — the sole in-page jump
 * to Coach view / Open admin / Scorekeeper. Plain fans (signed-out, or signed-in with no
 * hat) get NO chip: the global Account tab + the "Follow this tournament" strip already
 * cover sign-in / account / follow, so a fan chip was redundant and ate header space
 * (owner call 2026-07-21; the retired bottom-nav "More" tab was the old mobile door).
 *
 * The sheet (opened by that chip) carries the hat-holder's event-scoped rows plus a few
 * shared conveniences:
 *   • The hats this account owns on THIS event (coach / admin / official) + one-tap coach alerts.
 *   • This event — the whole-event follow, follow-a-team, and the fan bell.
 *   • The app install; sign out.
 * RETIRED here (Phase 5): Following, Your FieldLogicHQ, Browse tournaments and Live
 * scores (now the global Home/Scores/Account tabs); News + Rules (now top tabs).
 *
 * Identity is fetched CLIENT-SIDE via /api/public/tournament-viewer, never
 * server-rendered into the page: the service worker offline-caches public tournament
 * HTML as anonymous content, so per-user identity in that payload would replay to the
 * next person on a shared device (/review 2026-07-14). Anonymous visitors cost nothing
 * — the session check is a local read, no network. Auth transitions are SPA
 * navigations, so the chip re-resolves on sign-in/out (fan-alert-prefs precedent).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ArrowRight, Star, LogIn, LogOut, Bell, BellRing, Download } from 'lucide-react';
import { useOrgNav } from '@/components/OrgNavContext';
import { getSession, signOut } from '@/lib/auth';
import { createClient } from '@/lib/supabase-browser';
import { readFollowedTeam, syncFollowToAccount, useFollowedTournament } from '@/lib/follow';
import { fireConsumerEvent } from '@/lib/consumer-events-client';
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

/** F1: the "Follow this tournament" door in the More sheet (rides beside follow-a-team wherever
 *  those doors move). A whole-event follow — toggled here in place, no account needed. Device
 *  state is the source of truth (the sheet is a convenience door; the follow mirrors to the
 *  account like everywhere else). */
function FollowTournamentSheetRow({ orgSlug, tournamentSlug, tournamentName, signedIn }: {
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
  signedIn: boolean;
}) {
  const { following, follow, unfollow } = useFollowedTournament(orgSlug, tournamentSlug);
  const toggle = () => {
    fireConsumerEvent('follow_tapped', { entityType: 'tournament', on: !following, signedIn });
    if (following) unfollow(); else follow(tournamentName);
  };
  return (
    <button
      type="button"
      className={`${styles.row} ${styles.rowBtn} ${styles.eventFollowRow}`}
      aria-pressed={following}
      onClick={toggle}
    >
      <span className={styles.rowIcon}><Star size={15} strokeWidth={1.8} fill={following ? 'currentColor' : 'none'} aria-hidden /></span>
      <span className={styles.rowText}>
        <span className={styles.label}>{following ? 'Following this event' : 'Follow this tournament'}</span>
        <span className={styles.sub}>{following ? 'On your Home & Scores — this device' : 'See it on your Home & Scores — no account needed'}</span>
      </span>
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
      {/* Header chip = the event-scoped TOOLS door for a signed-in coach / admin / official
          (the only in-page jump to Coach view / Open admin / Scorekeeper). NOT shown for
          plain fans — signed-out, or signed-in with no hat here — because the global Account
          tab + the "Follow this tournament" strip already cover sign-in / account / follow,
          so a fan chip here was redundant and ate header space (owner call 2026-07-21). */}
      {viewer && viewer.hats.length > 0 && (
        <button
          type="button"
          className={coachHat ? `${styles.chip} ${styles.chipCoach}` : styles.chip}
          onClick={() => setOpenedAtPath(pathname)}
          aria-label={coachHat ? 'Your tools on this event — you coach here' : 'Your tools on this event'}
        >
          {viewer.initials}
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

        {/* ── FieldLogicHQ (Phase 5): the four cross-app doors that used to live here —
            Following, Your FieldLogicHQ, Browse tournaments, Live scores — RETIRED; the
            always-present global bar (Home·Scores·Chat·Account) covers them now. What
            remains is the signed-out sign-in prompt (kept above the fold — the highest-
            value conversion row) and the app install. Rendered only when at least one
            row will show, so the group never sits empty for a signed-in installed app. ── */}
        {(!signedIn || showGetApp) && (
          <>
            {/* Kept its "FieldLogicHQ" kicker so this stays a labeled group beside the
                labeled "This event" group below — not an orphaned unlabeled block. */}
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
            </div>
          </>
        )}

        {/* ── This event: the whole-event follow, the device-level team follow, and the
            fan notification bell. News + Rules left this group in Phase 5 — they are real
            top tabs again. Rendered only when at least one row will show, so the "This
            event" kicker never sits alone over an empty group. ── */}
        {(tournamentName || showBell || (!signedIn && !hidden('teams'))) && (
          <>
            <p className={styles.sectionKicker}>This event</p>
            <div className={styles.rows}>
              {/* F1: follow the WHOLE event (above the follow-a-team door). */}
              {tournamentName && (
                <FollowTournamentSheetRow
                  orgSlug={orgSlug}
                  tournamentSlug={tournamentSlug}
                  tournamentName={tournamentName}
                  signedIn={signedIn}
                />
              )}
              {/* Both team-follow rows honor the organizer's hidden-Teams choice — the
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
