import { useSyncExternalStore } from 'react';
import { LATEST_ANNOUNCED, isAnnouncementUnread } from '@/lib/release-announcements';

// Per-device "last viewed release" marker. Shared by the account menu's What's-New row, the Overview note,
// and the /changelog page so they can't drift on the key or the comparison. Kept on the SAME localStorage key the
// old header button used, so a device that had already dismissed the sparkle stays dismissed.
// (This file reads only the tiny announcements list, never the whole changelog, so the account menu on every public page
// does not carry the release notes in its bundle.)
export const RELEASE_SEEN_KEY = 'fl_whats_new_seen';

// Same-tab signal: the `storage` event only reaches OTHER tabs, so clearing the note must also tell this tab's menu.
const RELEASE_SEEN_EVENT = 'flhq:release-seen';

// Held for the session when localStorage refuses a write (a private window, blocked site data), so the X still works.
let seenThisSession = '';

function readSeen(): string {
  let stored = '';
  try {
    stored = localStorage.getItem(RELEASE_SEEN_KEY) ?? '';
  } catch {
    /* localStorage unavailable — treat as nothing stored */
  }
  return stored > seenThisSession ? stored : seenThisSession;
}

/** True when an ANNOUNCED release, announced within the last month, is unread on this device (owner 2026-11-07). A
 *  release that was not announced never lights anything. No release is announced yet, so every device reads false. */
export function getReleaseUnread(): boolean {
  return isAnnouncementUnread(LATEST_ANNOUNCED, readSeen(), Date.now());
}

/** Mark the announced release as viewed on this device (clears the New tag and the Overview note). */
export function markReleasesSeen(): void {
  if (!LATEST_ANNOUNCED) return; // nothing is announced, so there is nothing to clear
  seenThisSession = LATEST_ANNOUNCED.date;
  try {
    localStorage.setItem(RELEASE_SEEN_KEY, LATEST_ANNOUNCED.date);
  } catch {
    /* ignore — seenThisSession still clears it for this visit */
  }
  try {
    window.dispatchEvent(new Event(RELEASE_SEEN_EVENT));
  } catch {
    /* ignore */
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === RELEASE_SEEN_KEY) onChange(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(RELEASE_SEEN_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(RELEASE_SEEN_EVENT, onChange);
  };
}

/** Live read of "an announced release is unread on this device". False on the server and before hydration. */
export function useReleaseUnread(): boolean {
  return useSyncExternalStore(subscribe, getReleaseUnread, () => false);
}
