'use client';
import { useEffect, useState } from 'react';
import { getReleaseUnread, RELEASE_SEEN_KEY } from './release-seen';
import styles from './whats-new.module.css';

/**
 * Small lime "new release" dot for the Help nav entries (admin + coach sidebars)
 * and the What's-New help links. Renders nothing unless there's a release this
 * device hasn't viewed yet. "Seen" is per-device (localStorage); viewing the full
 * release notes (/changelog) clears it, and we pick that up cross-tab via the
 * `storage` event (the Help center opens in a new tab).
 */
export default function ReleaseDot({ className }: { className?: string }) {
  // `undefined` until read on mount → SSR and first client render both show no
  // dot, so there's no hydration mismatch.
  const [unread, setUnread] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from an external store (localStorage) after mount
    setUnread(getReleaseUnread());
    function onStorage(e: StorageEvent) {
      if (e.key === RELEASE_SEEN_KEY) setUnread(getReleaseUnread());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!unread) return null;
  return (
    <span
      className={`${styles.navDot}${className ? ` ${className}` : ''}`}
      aria-label="New updates available"
    />
  );
}
