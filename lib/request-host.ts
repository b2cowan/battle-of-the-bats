import 'server-only';
import { headers } from 'next/headers';

/**
 * The host this request was addressed to.
 *
 * ⚠ The plain `Host` header ONLY - never `X-Forwarded-Host`. Amplify's edge refuses a Host it does not serve (403,
 * proven in the 4e hosting spike §1), so Host is the one a visitor cannot choose; `X-Forwarded-Host` passes the edge
 * untouched, so a caller could set it and make robots.txt or a sitemap speak for a host that is not theirs. The
 * production `.ca` -> `www` redirect already depends on Host being the visitor's address.
 */
export async function requestHost(): Promise<string> {
  const h = await headers();
  return (h.get('host') ?? '').split(',')[0].trim();
}
