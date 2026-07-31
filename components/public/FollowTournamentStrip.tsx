'use client';
/**
 * components/public/FollowTournamentStrip.tsx — Phase 6 (F1)
 *
 * The event ACTION ROW that sits directly under the unified event header on the tournament HOME
 * tab only: Follow (leading) + Share (secondary), one row, one baseline. Share used to live in a
 * separate right-aligned row below the hero; on mobile the hero is hidden, so the two landed
 * back-to-back on opposite edges and read as a zig-zag (owner call 2026-07-29, Option A). The
 * desktop share row is unchanged and now hides ≤900px, so exactly one Share renders per width.
 *
 * One tap follows the WHOLE event (not a team) — instantly, no account (free-first business
 * decision). States:
 * ghost-star "Follow this tournament" → a dimmed saving beat → ink-on-lime "★ Following"
 * (standard pillOn). Tap again unfollows.
 *
 * Free-first: the device write (lib/follow) is the source of truth and always happens first; the
 * account mirror is fire-and-forget. Signed-in state is hydrated CLIENT-SIDE (GET ?entity=tournament)
 * so a follow made on another device shows here — never SSR'd into this SW-cached page (FP-2).
 *
 * Signed-out fans get ONE quiet, dismissible nudge under the strip after following (sync + alerts
 * pitch) — never a wall. Renders in the event's branded dark/light (on-event affordance).
 */
import { useEffect, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';
import { useFollowedTournament } from '@/lib/follow';
import { getSession } from '@/lib/auth';
import { fireConsumerEvent } from '@/lib/consumer-events-client';
import SharePageButton from '@/components/public/SharePageButton';
import styles from './FollowTournamentStrip.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
  /** Path the Share partner sends (origin prepended by SharePageButton). */
  shareUrl: string;
}

// One global dismissal key (plan §6): the sign-in nudge shows at most once per device until cleared.
const NUDGE_DISMISS_KEY = 'fl_follow_tourn_nudge_dismissed';

export default function FollowTournamentStrip({ orgSlug, tournamentSlug, tournamentName, shareUrl }: Props) {
  const { following: deviceFollowing, follow, unfollow } = useFollowedTournament(orgSlug, tournamentSlug);
  const [accountFollowing, setAccountFollowing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const savingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: once the user taps, a still-in-flight account-hydration response must NOT overwrite
  // their fresh intent (a stale "following:true" could otherwise re-show Following after an unfollow).
  const acted = useRef(false);

  const following = deviceFollowing || accountFollowing;

  // Client-side account hydration (signed-in only — anonymous visitors never hit the network).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await getSession().catch(() => null);
        if (!session?.user) return;
        if (!cancelled) setSignedIn(true);
        const res = await fetch(
          `/api/consumer/follows?entity=tournament&orgSlug=${encodeURIComponent(orgSlug)}&tournamentSlug=${encodeURIComponent(tournamentSlug)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { following?: boolean };
        if (!cancelled && !acted.current && typeof data.following === 'boolean') setAccountFollowing(data.following);
      } catch { /* account layer is additive — the device experience stands alone */ }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, tournamentSlug]);

  useEffect(() => () => { if (savingTimer.current) clearTimeout(savingTimer.current); }, []);

  function toggle() {
    acted.current = true; // freeze account-hydration from overwriting this intent
    const willFollow = !following;
    fireConsumerEvent('follow_tapped', { entityType: 'tournament', on: willFollow, signedIn });
    if (following) {
      unfollow();
      setAccountFollowing(false);
      setShowNudge(false);
      return;
    }
    // Follow: brief saving beat, then the pillOn state (the device write itself is instant).
    setSaving(true);
    if (savingTimer.current) clearTimeout(savingTimer.current);
    savingTimer.current = setTimeout(() => setSaving(false), 320);
    follow(tournamentName);
    maybeShowNudge();
  }

  function maybeShowNudge() {
    if (signedIn) return; // signed-in follows already travel — no nudge
    try {
      if (localStorage.getItem(NUDGE_DISMISS_KEY)) return;
    } catch { /* ignore */ }
    setShowNudge(true);
  }

  function dismissNudge() {
    try { localStorage.setItem(NUDGE_DISMISS_KEY, '1'); } catch { /* ignore */ }
    setShowNudge(false);
  }

  const returnPath = (() => {
    try { return window.location.pathname + window.location.search; } catch { return `/${orgSlug}/${tournamentSlug}`; }
  })();

  return (
    <div className={styles.wrap}>
      <div className={styles.strip}>
        <button
          type="button"
          className={`${styles.pill} ${following ? styles.pillOn : ''} ${saving ? styles.saving : ''}`}
          aria-pressed={following}
          onClick={toggle}
        >
          <Star size={14} strokeWidth={2.2} fill={following ? 'currentColor' : 'none'} aria-hidden />
          {following ? 'Following' : 'Follow this tournament'}
        </button>
        {/* The quieter partner: same height, same baseline, its own type register so
            Follow stays the one branded thing in the row. */}
        <SharePageButton
          url={shareUrl}
          title={tournamentName}
          text="Live on FieldLogicHQ"
          className={styles.share}
        />
      </div>

      {showNudge && (
        <div className={styles.nudge} role="status">
          <span className={styles.nudgeText}>
            Following on this device ·{' '}
            <a className={styles.nudgeLink} href={`/auth/login?next=${encodeURIComponent(returnPath)}`}>Sign in</a>{' '}
            and it goes with you — every device, plus score alerts.
          </span>
          <button type="button" className={styles.nudgeClose} onClick={dismissNudge} aria-label="Dismiss">
            <X size={14} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
