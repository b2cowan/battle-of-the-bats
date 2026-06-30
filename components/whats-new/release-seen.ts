import { LATEST_RELEASE_DATE } from '@/lib/release-notes';

// Per-device "last viewed release" marker. Shared by the Help-nav dot, the
// What's-New help links, and the /changelog page so they can't drift on the key
// or the comparison. Kept on the SAME localStorage key the old header button
// used, so a device that had already dismissed the sparkle stays dismissed.
export const RELEASE_SEEN_KEY = 'fl_whats_new_seen';

/** True when there's a release newer than the one this device last viewed. */
export function getReleaseUnread(): boolean {
  if (LATEST_RELEASE_DATE === '') return false;
  let seen: string | null = null;
  try {
    seen = localStorage.getItem(RELEASE_SEEN_KEY);
  } catch {
    /* localStorage unavailable — treat as nothing seen */
  }
  return (seen ?? '') < LATEST_RELEASE_DATE;
}

/** Mark the latest release as viewed on this device (clears the Help-nav dot). */
export function markReleasesSeen(): void {
  if (LATEST_RELEASE_DATE === '') return;
  try {
    localStorage.setItem(RELEASE_SEEN_KEY, LATEST_RELEASE_DATE);
  } catch {
    /* ignore */
  }
}
