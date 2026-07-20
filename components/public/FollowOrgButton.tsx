'use client';
/**
 * components/public/FollowOrgButton.tsx — Phase 6 (F1 / F3)
 *
 * The org-hero "Follow" button on `/{orgSlug}`. Following an organization is the year-round
 * relationship — the org's card then persists on the fan's Home so their NEXT event finds them.
 * One tap, no account (free-first). States: ghost-star "Follow" → dimmed saving beat →
 * ink-on-lime "★ Following". Tap again unfollows.
 *
 * The org landing page is SSR'd + SW-cached as anonymous HTML (F3: page content unchanged), so
 * this island hydrates its own device + account state CLIENT-SIDE — no per-user data is SSR'd.
 * The parent only renders this when the org is followable (isFollowableOrg), so the button never
 * offers a follow the API would reject.
 */
import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { useFollowedOrg } from '@/lib/follow';
import { getSession } from '@/lib/auth';
import { fireConsumerEvent } from '@/lib/consumer-events-client';
import styles from './FollowOrgButton.module.css';

interface Props {
  orgSlug: string;
  orgName: string;
}

export default function FollowOrgButton({ orgSlug, orgName }: Props) {
  const { following: deviceFollowing, follow, unfollow } = useFollowedOrg(orgSlug);
  const [accountFollowing, setAccountFollowing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: a still-in-flight hydration response must not overwrite the user's fresh tap intent.
  const acted = useRef(false);

  const following = deviceFollowing || accountFollowing;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await getSession().catch(() => null);
        if (!session?.user) return;
        if (!cancelled) setSignedIn(true);
        const res = await fetch(`/api/consumer/follows?entity=org&orgSlug=${encodeURIComponent(orgSlug)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { following?: boolean };
        if (!cancelled && !acted.current && typeof data.following === 'boolean') setAccountFollowing(data.following);
      } catch { /* account layer is additive */ }
    })();
    return () => { cancelled = true; };
  }, [orgSlug]);

  useEffect(() => () => { if (savingTimer.current) clearTimeout(savingTimer.current); }, []);

  function toggle() {
    acted.current = true; // freeze account-hydration from overwriting this intent
    fireConsumerEvent('follow_tapped', { entityType: 'org', on: !following, signedIn });
    if (following) {
      unfollow();
      setAccountFollowing(false);
      return;
    }
    setSaving(true);
    if (savingTimer.current) clearTimeout(savingTimer.current);
    savingTimer.current = setTimeout(() => setSaving(false), 320);
    follow(orgName);
  }

  return (
    <button
      type="button"
      className={`${styles.btn} ${following ? styles.btnOn : ''} ${saving ? styles.saving : ''}`}
      aria-pressed={following}
      onClick={toggle}
    >
      <Star size={15} strokeWidth={2.2} fill={following ? 'currentColor' : 'none'} aria-hidden />
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
