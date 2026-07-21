/**
 * lib/consumer-routes.ts
 *
 * The logged-out "consumer shell" front door (unified-app Phase 1): the directory
 * plus its sibling tabs, wrapped in one app-like shell (top bar + mobile bottom nav)
 * instead of the marketing Navbar/Footer. Single source of truth so the shell layout,
 * SiteChrome, and Footer all agree on which routes are consumer-shell routes.
 */
// NOTE: this is the "full consumer-shell tab" set — it drives the shell layout, the
// marketing Navbar/Footer suppression, AND the warm nav skin. /auth lives physically inside
// the (consumer) group (the tab bar mounts there) but is deliberately NOT here — sign-in /
// select-org / suspended stay DARK (R1-4). /start is also not a tab, but it DOES paint warm:
// see WARM_JOURNEY_PREFIXES below, kept separate so the warm skin can extend to the coach
// sign-up journey without entangling footer/Navbar classification.
export const CONSUMER_SHELL_PREFIXES = ['/discover', '/scores', '/chat', '/following', '/account'] as const;

export function isConsumerShellPath(pathname: string): boolean {
  return CONSUMER_SHELL_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

// Warm sign-up JOURNEY routes (Founding Season Coaches launch — design_decisions S1-1/S1-2):
// the coach get-started + Premium sign-up journey wears the warm ConsumerNav skin so it reads
// as one app, but these are NOT consumer-shell tabs (they stay out of CONSUMER_SHELL_PREFIXES).
// /start lives inside the (consumer) group so the nav already mounts; /coaches/start and the
// post-provision success screen (/coaches/welcome) mount the same warm nav via their own layout.
export const WARM_JOURNEY_PREFIXES = ['/start', '/coaches/start', '/coaches/claim', '/coaches/welcome'] as const;

export function isWarmJourneyPath(pathname: string): boolean {
  return WARM_JOURNEY_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

/** Routes that paint the warm ConsumerNav skin: the four consumer tabs + the warm sign-up journey. */
export function isWarmSkinPath(pathname: string): boolean {
  return isConsumerShellPath(pathname) || isWarmJourneyPath(pathname);
}
