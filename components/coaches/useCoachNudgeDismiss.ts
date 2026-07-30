'use client';

import { useSyncExternalStore } from 'react';

/** Nudge id for the team Overview's setup panel. Its storage key is ALSO read pre-paint by the
 *  root layout's NO_FLASH_SCRIPT (lib/no-flash-script.ts) — change one, change both. */
export const COACH_SETUP_NUDGE = 'first_run_setup';

/** Set on <html> before first paint when the current team's setup panel is already skipped, so a
 *  skipped coach never sees the card paint and collapse. Removed at hydration by CoachPortalShell. */
export const COACH_SETUP_SKIPPED_ATTR = 'data-coach-setup-skipped';

/** The one storage-key shape. Mirrored as a string literal inside NO_FLASH_SCRIPT (an inline
 *  script cannot import), exactly as the density/theme keys already are. */
export function coachNudgeStorageKey(basicTeamId: string, nudge: string): string {
  return `fl_coach_nudge_dismissed:${basicTeamId}:${nudge}`;
}

/**
 * Per-team, per-nudge dismiss state for the free coach portal's Overview guidance
 * (the discovery invite + the first-run setup panel). Extracted from CoachOverviewInvite
 * so both surfaces share ONE dismiss idiom rather than two localStorage conventions.
 *
 * useSyncExternalStore reads localStorage hydration-safely: the server snapshot is always
 * `false` (show it), and the client subscribes to `storage` so a dismiss in another tab
 * collapses this one too. No effect, no hydration mismatch.
 *
 * Dismissal is intentionally per-device and NOT persisted server-side — this is guidance,
 * not data, and the thread is never cut (dismissing degrades to a faint Explore line, and
 * Explore stays a permanent tab).
 */
/** Module scope, NOT an inline arrow: an unstable `subscribe` identity makes React tear down and
 *  re-add the `storage` listener on every render. It closes over nothing, so it can live here. */
function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export function useCoachNudgeDismiss(basicTeamId: string, nudge: string): {
  dismissed: boolean;
  dismiss: () => void;
} {
  const storageKey = coachNudgeStorageKey(basicTeamId, nudge);

  const dismissed = useSyncExternalStore(
    subscribeToStorage,
    () => {
      try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
    },
    () => false, // server snapshot — never dismissed during SSR
  );

  // Not memoized: both call sites wire this straight to an onClick, so there is no
  // referential-stability requirement to earn a useCallback's dependency array.
  function dismiss() {
    try {
      localStorage.setItem(storageKey, '1');
      // useSyncExternalStore doesn't see same-tab writes (the `storage` event is cross-tab
      // only), so nudge React to re-read by dispatching a synthetic storage event.
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey }));
    } catch { /* ignore */ }
  }

  return { dismissed, dismiss };
}
