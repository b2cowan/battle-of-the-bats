'use client';
/**
 * lib/device.ts — tiny browser device/standalone detection shared by the PWA
 * surfaces (FollowAlertsToggle, AlertsNudge). InstallAppPrompt keeps its own
 * inline copy (it also distinguishes iOS-Chrome) — these helpers cover the
 * common iOS + standalone checks so the alerts surfaces don't drift.
 */

/** True on iPhone/iPad/iPod (UA sniff — the only reliable signal for iOS Safari). */
export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * True on iPadOS 13+ with "Request Desktop Website" on (the default), where the UA
 * reads as macOS and isIOSDevice() misses it. Cross-checks touch points + the
 * iOS-Safari-only `standalone` property (undefined on real macOS) so a true Mac is
 * never matched. Used so iPad fans still get the "add to home screen" alerts
 * explainer instead of a dead push button (J6-048).
 */
export function isDesktopModeIPad(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  return (
    /Macintosh/i.test(navigator.userAgent) &&
    navigator.maxTouchPoints > 1 &&
    typeof (window.navigator as { standalone?: boolean }).standalone !== 'undefined'
  );
}

/** iOS proper OR an iPad masquerading as desktop — the full "needs home-screen for push" set. */
export function isIOSLike(): boolean {
  return isIOSDevice() || isDesktopModeIPad();
}

/** True when running as an installed/home-screen app (display-mode standalone). */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)')?.matches === true
  );
}

/**
 * True when a "Get the app" affordance makes sense: a phone/tablet BROWSER —
 * not desktop (nothing to install) and not the installed app itself. The ONE
 * definition of install eligibility (More-sheet row, and any future entry
 * point) so the gating rule can never drift between surfaces.
 */
export function isInstallEligibleBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  if (isStandalonePWA()) return false;
  return (
    window.matchMedia?.('(pointer: coarse)')?.matches === true ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}
