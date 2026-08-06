'use client';
import { useEffect } from 'react';

/**
 * Hold the screen awake while `enabled` is true.
 *
 * Purely mechanical: the POLICY — who may ask for it, when, and how the person is told — stays
 * with the caller. The game-day console, for example, only enables this during the live window,
 * only for a coach who runs the bench, and always shows a chip that switches it off, because a
 * screen that refuses to sleep without saying so reads as a broken phone.
 *
 * Three behaviours worth knowing:
 *  · The browser releases the lock itself when the tab hides, so a pocketed phone sleeps
 *    normally; the handle is cleared on release and re-requested the next time the tab is seen.
 *  · A refusal (battery saver, no user gesture yet) is swallowed. This is a request, never a
 *    promise — nothing on screen should claim the lock was granted.
 *  · Unsupported browsers no-op. Callers detect support themselves (`'wakeLock' in navigator`)
 *    when they need to decide whether to OFFER it.
 */
export function useScreenWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== 'visible' || sentinel) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        next.addEventListener('release', () => { if (sentinel === next) sentinel = null; });
        // Re-check AFTER the await: the effect may have been torn down, or a visibility change
        // may have started a second request that already won. An untracked sentinel is a lock
        // nothing will ever release — on this screen that means a phone left awake after a game.
        if (cancelled || sentinel) { void next.release().catch(() => {}); return; }
        sentinel = next;
      } catch { /* refused — a request, never a promise */ }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') void request(); };

    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
