/**
 * Pure, no `server-only`, so a plain Node test pins it (`tests/unit/online-payments-profile.test.ts`). Used by
 * `lib/online-payment-profile.ts` to decide whether a club's site is handed to Stripe's sign-up.
 */

/** A web address Stripe's reviewers can open: https on the default port, a real public host name, no login in it — never a
 *  dev machine, a bare IP or a reserved test name. */
export function reachableSiteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.port || u.username || u.password) return null;
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null;
  if (/.(test|example|invalid|internal|localdomain)$/.test(host)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) return null;
  return u.toString().replace(/\/$/, '');
}
