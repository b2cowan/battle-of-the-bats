'use client';
/**
 * components/public/TournamentAccountSheet.tsx — Phase 3 "one-home connective tissue."
 *
 * The account chip in a tournament's public top bar (signed-in visitors only) and the
 * bottom sheet it opens: the hats this account owns on THIS event (coach / admin /
 * official rows) plus the two universal destinations, Following and Your FieldLogicHQ.
 * Deliberately pull-not-push (rev 2 owner direction): no persistent banner — one chip,
 * zero content real estate. Anonymous visitors render nothing.
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
import { ArrowRight, Star, LayoutGrid } from 'lucide-react';
import { useOrgNav } from '@/components/OrgNavContext';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase-browser';
import BottomSheet from '@/components/admin/BottomSheet';
import styles from './TournamentAccountSheet.module.css';

interface ViewerHat {
  kind: 'coach' | 'admin' | 'official';
  label: string;
  href: string;
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

export default function TournamentAccountSheet() {
  const { tournamentSlug, tournamentName } = useOrgNav();
  const params = useParams<{ orgSlug?: string }>();
  const orgSlug = typeof params?.orgSlug === 'string' ? params.orgSlug : null;
  const pathname = usePathname();
  const [viewer, setViewer] = useState<TournamentViewer | null>(null);
  // The sheet records WHERE it was opened; any route change (tab tap, browser back)
  // derives it closed — it must never sit open, holding the body scroll lock, over a
  // page the user navigated to underneath it. No effect needed: open is derived state.
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const open = openedAtPath === pathname;
  const [authTick, setAuthTick] = useState(0);

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
          if (!cancelled) setViewer(null);
          return;
        }
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

  if (!viewer || !orgSlug || !tournamentSlug) return null;
  const close = () => setOpenedAtPath(null);

  return (
    <>
      <button
        type="button"
        className={styles.chip}
        onClick={() => setOpenedAtPath(pathname)}
        aria-label="Your account on this event"
      >
        {viewer.initials}
      </button>
      <BottomSheet open={open} onClose={close} title={viewer.displayName || 'Signed in'}>
        {tournamentName && <p className={styles.context}>At {tournamentName}</p>}
        <div className={styles.rows}>
          {viewer.hats.map(hat => (
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
          <Link href="/following" className={styles.row} onClick={close}>
            <span className={styles.rowIcon}><Star size={15} strokeWidth={1.8} aria-hidden /></span>
            <span className={styles.rowText}>
              <span className={styles.label}>Following</span>
              <span className={styles.sub}>Your followed teams</span>
            </span>
            <span className={styles.chev}><ArrowRight size={14} strokeWidth={2.2} aria-hidden /></span>
          </Link>
          <Link href="/home" className={styles.row} onClick={close}>
            <span className={styles.rowIcon}><LayoutGrid size={15} strokeWidth={1.8} aria-hidden /></span>
            <span className={styles.rowText}>
              <span className={styles.label}>Your FieldLogicHQ</span>
              <span className={styles.sub}>All workspaces &amp; following</span>
            </span>
            <span className={styles.chev}><ArrowRight size={14} strokeWidth={2.2} aria-hidden /></span>
          </Link>
        </div>
      </BottomSheet>
    </>
  );
}
