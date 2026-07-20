/**
 * lib/consumer-routes.ts
 *
 * The logged-out "consumer shell" front door (unified-app Phase 1): the directory
 * plus its sibling tabs, wrapped in one app-like shell (top bar + mobile bottom nav)
 * instead of the marketing Navbar/Footer. Single source of truth so the shell layout,
 * SiteChrome, and Footer all agree on which routes are consumer-shell routes.
 */
// NOTE: /start and /auth live PHYSICALLY inside the (consumer) route group (tab bar
// mounts there) but are deliberately NOT in this list — this list also drives the warm
// theme skin and footer suppression classification, and those surfaces stay dark.
// SiteChrome suppresses the marketing Navbar for them via its own explicit matches.
// Adding '/start' here would silently flip its theme — don't.
export const CONSUMER_SHELL_PREFIXES = ['/discover', '/scores', '/chat', '/following', '/account'] as const;

export function isConsumerShellPath(pathname: string): boolean {
  return CONSUMER_SHELL_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}
