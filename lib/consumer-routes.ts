/**
 * lib/consumer-routes.ts
 *
 * The logged-out "consumer shell" front door (unified-app Phase 1): the directory
 * plus its sibling tabs, wrapped in one app-like shell (top bar + mobile bottom nav)
 * instead of the marketing Navbar/Footer. Single source of truth so the shell layout,
 * SiteChrome, and Footer all agree on which routes are consumer-shell routes.
 */
export const CONSUMER_SHELL_PREFIXES = ['/discover', '/scores', '/chat', '/following', '/account'] as const;

export function isConsumerShellPath(pathname: string): boolean {
  return CONSUMER_SHELL_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}
