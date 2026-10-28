'use client';
/**
 * Following a whole tournament (Unified Home Phase 6, F1): the one behaviour behind today's follow strip
 * (components/public/FollowTournamentStrip.tsx) and the frame Overview's app-only line (FollowTournamentLine.tsx, Public
 * tournament pages Stage 2), so the two cannot drift.
 *
 * Free-first: the device write (lib/follow) is the source of truth and always happens first; the account mirror is
 * fire-and-forget. Signed-in state is hydrated CLIENT-SIDE (GET ?entity=tournament) so a follow made on another device
 * shows here — never SSR'd into this SW-cached page (FP-2). A signed-out follower gets ONE quiet, dismissible nudge.
 */
import { useEffect, useRef, useState } from 'react';
import { useFollowedTournament } from '@/lib/follow';
import { getSession } from '@/lib/auth';
import { fireConsumerEvent } from '@/lib/consumer-events-client';

// One global dismissal key (plan §6): the sign-in nudge shows at most once per device until cleared.
const NUDGE_DISMISS_KEY = 'fl_follow_tourn_nudge_dismissed';

export function useTournamentFollowToggle(orgSlug: string, tournamentSlug: string, tournamentName: string) {
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
    // Follow: brief saving beat, then the followed state (the device write itself is instant).
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

  return { following, saving, showNudge, toggle, dismissNudge };
}
