/**
 * lib/nav-beacon.ts — the fire-and-forget nav-click beacon (Nav Unification Stage E.1).
 *
 * ONE module owns both halves — the allowlist of event names and the browser-side send — so the
 * client can never emit a name the endpoint silently drops, and the endpoint's allowlist can never
 * drift from what the chrome actually fires.
 *
 * ANONYMOUS INVARIANT (plan §5): every call site must fire this on a USER GESTURE only. Nothing
 * here may run on render, on mount, or in an effect — an org page's anonymous network profile has
 * to stay byte-identical to what it was before this stage.
 */

export const NAV_BEACON_EVENTS = [
  /** The org public page's "Discover" link — the fan's door back into the app (plan §6 CTR gate). */
  'org_discover',
] as const;

export type NavBeaconEvent = (typeof NAV_BEACON_EVENTS)[number];

/**
 * Report one nav click. Best-effort and silent: a blocked, offline, or failed beacon must never
 * interfere with the navigation the user just asked for, so nothing here throws and nothing is
 * awaited. `sendBeacon` is preferred because the click is usually followed immediately by a page
 * navigation, which would cancel an ordinary in-flight fetch.
 */
export function reportNavClick(event: NavBeaconEvent): void {
  try {
    if (typeof window === 'undefined') return;
    const body = JSON.stringify({ event, from: window.location.pathname });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/client/nav-beacon', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/client/nav-beacon', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never let instrumentation break a navigation */
  }
}
